"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { confirmSignUp, resendSignUpCode } from "aws-amplify/auth";
import { FormEvent, useState } from "react";
import { authConfigured } from "./auth-provider";
import { Logo } from "./ui";

export function ConfirmationForm({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(initialEmail || searchParams.get("email") || "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      if (!authConfigured) throw new Error("Cognito is not configured for this environment.");
      const result = await confirmSignUp({ username: email, confirmationCode: String(data.get("code") ?? "").trim() });
      if (result.isSignUpComplete) router.replace("/login?confirmed=true");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The confirmation code could not be verified."); }
    finally { setPending(false); }
  }

  async function resend() {
    setError(""); setNotice("");
    try { await resendSignUpCode({ username: email }); setNotice("A new code has been sent to your email."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "A new code could not be sent."); }
  }

  return <main className="standalone-auth"><Logo/><section className="standalone-card"><span className="eyebrow">Check your inbox</span><h1>Confirm your email.</h1><p>Enter the six-digit code Cognito sent to your email address.</p><form onSubmit={submit}>{error && <div className="form-error" role="alert">{error}</div>}{notice && <div className="form-notice" role="status">{notice}</div>}<label>Email address<input required type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="email"/></label><label>Confirmation code<input required name="code" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="123456" autoComplete="one-time-code"/></label><button disabled={pending} className="button button-primary" type="submit">{pending ? "Verifying…" : "Confirm account"}</button></form><button className="text-button" type="button" onClick={resend}>Send a new code</button><Link href="/login">Back to login</Link></section></main>;
}
