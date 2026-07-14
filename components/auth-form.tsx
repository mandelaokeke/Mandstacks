"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchAuthSession, signIn, signUp } from "aws-amplify/auth";
import { FormEvent, useState } from "react";
import { authConfigured, useAuth } from "./auth-provider";
import { Logo } from "./ui";

function messageFrom(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const login = mode === "login";
  const router = useRouter();
  const { refresh } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!authConfigured) {
      setError("Cognito is not configured for this environment. Add the values from the CDK outputs to .env.local.");
      return;
    }
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const password = String(data.get("password") ?? "");
    setPending(true);
    try {
      if (login) {
        const result = await signIn({ username: email, password });
        if (result.nextStep.signInStep === "CONFIRM_SIGN_UP") {
          router.push(`/confirm?email=${encodeURIComponent(email)}`);
          return;
        }
        if (result.nextStep.signInStep === "RESET_PASSWORD") {
          router.push(`/forgot-password?email=${encodeURIComponent(email)}`);
          return;
        }
        if (!result.isSignedIn) {
          setError("This account requires an additional sign-in step that is not enabled for this library.");
          return;
        }
        await refresh();
        const session = await fetchAuthSession();
        const groups = session.tokens?.idToken?.payload["cognito:groups"];
        router.replace(Array.isArray(groups) && groups.includes("Admins") ? "/admin" : "/dashboard");
      } else {
        const name = String(data.get("name") ?? "").trim();
        const result = await signUp({
          username: email,
          password,
          options: { userAttributes: { email, name } },
        });
        if (result.isSignUpComplete) router.push("/login?registered=true");
        else router.push(`/confirm?email=${encodeURIComponent(email)}`);
      }
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setPending(false);
    }
  }

  return <div className="auth-page"><section className="auth-art"><Logo inverse/><div><span className="eyebrow">A place for every story</span><blockquote>“A reader lives a thousand lives before he dies.”</blockquote><p>— George R. R. Martin</p></div><small>Mandstacks · Est. 2026</small></section><section className="auth-panel"><div className="auth-mobile-logo"><Logo/></div><div className="auth-card"><span className="eyebrow">{login ? "Welcome back" : "Become a member"}</span><h1>{login ? "Return to your shelves." : "Start your next chapter."}</h1><p>{login ? "Log in to manage your books, due dates, and reading history." : "Create your account to browse and borrow from the collection."}</p><form onSubmit={submit}>{error && <div className="form-error" role="alert">{error}</div>}<label>Email address<input required type="email" name="email" placeholder="you@example.com" autoComplete="email"/></label>{!login && <label>Full name<input required name="name" placeholder="Maya Johnson" autoComplete="name" maxLength={120}/></label>}<label>Password<input required minLength={8} type="password" name="password" placeholder="At least 8 characters" autoComplete={login ? "current-password" : "new-password"}/></label>{login && <div className="form-row"><span/><Link href="/forgot-password">Forgot password?</Link></div>}<button disabled={pending} type="submit" className="button button-primary auth-submit">{pending ? "Please wait…" : login ? "Log in" : "Create account"}</button></form><p className="auth-switch">{login ? "New to Mandstacks?" : "Already have an account?"} <Link href={login ? "/register" : "/login"}>{login ? "Create an account" : "Log in"}</Link></p></div></section></div>;
}
