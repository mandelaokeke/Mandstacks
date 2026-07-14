import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/reset-password-form";

export default function ForgotPasswordPage() {
  return <Suspense fallback={null}><ResetPasswordForm initialEmail=""/></Suspense>;
}
