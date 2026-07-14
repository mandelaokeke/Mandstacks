"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { confirmResetPassword, resetPassword } from "aws-amplify/auth";
import { FormEvent, useState } from "react";
import { authConfigured } from "./auth-provider";
import { Logo } from "./ui";

export function ResetPasswordForm({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryEmail = initialEmail || searchParams.get("email") || "";
  const [email, setEmail] = useState(queryEmail);
  const [step, setStep] = useState<"request" | "confirm">(queryEmail ? "confirm" : "request");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      if (!authConfigured) throw new Error("Cognito is not configured for this environment.");
      if (step === "request") {
        const result = await resetPassword({ username: email });
        if (result.nextStep.resetPasswordStep === "CONFIRM_RESET_PASSWORD_WITH_CODE") setStep("confirm");
      } else {
        await confirmResetPassword({
          username: email,
          confirmationCode: String(data.get("code") ?? "").trim(),
          newPassword: String(data.get("password") ?? ""),
        });
        router.replace("/login?reset=true");
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The password could not be reset."); }
    finally { setPending(false); }
  }

  return <main className="standalone-auth"><Logo/><section className="standalone-card"><span className="eyebrow">Account recovery</span><h1>{step === "request" ? "Reset your password." : "Choose a new password."}</h1><p>{step === "request" ? "We’ll send a confirmation code to your verified email." : "Enter the code from your email and a new secure password."}</p><form onSubmit={submit}>{error && <div className="form-error" role="alert">{error}</div>}<label>Email address<input required type="email" value={email} onChange={event=>setEmail(event.target.value)} disabled={step === "confirm"} autoComplete="email"/></label>{step === "confirm" && <><label>Confirmation code<input required name="code" inputMode="numeric" maxLength={6} autoComplete="one-time-code"/></label><label>New password<input required name="password" type="password" minLength={8} autoComplete="new-password"/></label></>}<button disabled={pending} className="button button-primary" type="submit">{pending ? "Please wait…" : step === "request" ? "Send reset code" : "Update password"}</button></form>{step === "confirm" && <button className="text-button" type="button" onClick={()=>setStep("request")}>Use a different email</button>}<Link href="/login">Back to login</Link></section></main>;
}
