"use client";

import { Amplify } from "aws-amplify";
import {
  fetchAuthSession,
  fetchUserAttributes,
  getCurrentUser,
  signOut,
} from "aws-amplify/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID;
export const authConfigured = Boolean(userPoolId && userPoolClientId);

if (authConfigured) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: userPoolId!,
        userPoolClientId: userPoolClientId!,
        loginWith: { email: true },
        signUpVerificationMethod: "code",
        userAttributes: {
          email: { required: true },
          name: { required: true },
        },
        passwordFormat: {
          minLength: 8,
          requireLowercase: true,
          requireUppercase: true,
          requireNumbers: true,
          requireSpecialCharacters: false,
        },
      },
    },
  });
}

interface AuthUser {
  userId: string;
  username: string;
  name: string;
  email: string;
  groups: string[];
  isAdmin: boolean;
}

interface AuthContextValue {
  status: "loading" | "authenticated" | "guest" | "unconfigured";
  user: AuthUser | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue["status"]>(
    authConfigured ? "loading" : "unconfigured",
  );
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async () => {
    if (!authConfigured) {
      setStatus("unconfigured");
      return;
    }
    try {
      const [currentUser, session, attributes] = await Promise.all([
        getCurrentUser(),
        fetchAuthSession(),
        fetchUserAttributes(),
      ]);
      const rawGroups = session.tokens?.idToken?.payload["cognito:groups"];
      const groups = Array.isArray(rawGroups) ? rawGroups.map(String) : [];
      setUser({
        userId: currentUser.userId,
        username: currentUser.username,
        name: attributes.name ?? attributes.email ?? "Library member",
        email: attributes.email ?? "",
        groups,
        isAdmin: groups.includes("Admins"),
      });
      setStatus("authenticated");
    } catch {
      // A password reset or revoked refresh token can leave enough cached state
      // for Amplify to reject the next sign-in as "already signed in". Clear the
      // local Cognito session before presenting the application as signed out.
      await signOut().catch(() => undefined);
      setUser(null);
      setStatus("guest");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
    setStatus("guest");
  }, []);

  const value = useMemo(
    () => ({ status, user, refresh, logout }),
    [status, user, refresh, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export function AuthGuard({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "guest") router.replace("/login");
    if (status === "authenticated" && admin && !user?.isAdmin) router.replace("/dashboard");
  }, [admin, router, status, user]);

  if (status === "unconfigured") {
    return <main className="auth-gate"><span className="eyebrow">Configuration needed</span><h1>Connect this environment to Cognito.</h1><p>Add the public Cognito values from the CDK outputs to your local environment before opening a protected workspace.</p></main>;
  }
  if (status !== "authenticated" || (admin && !user?.isAdmin)) {
    return <main className="auth-gate"><span className="auth-spinner"/><p>Checking your library account…</p></main>;
  }
  return children;
}
