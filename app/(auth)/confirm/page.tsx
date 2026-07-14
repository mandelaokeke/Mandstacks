import { Suspense } from "react";
import { ConfirmationForm } from "@/components/confirmation-form";

export default function ConfirmPage() {
  return <Suspense fallback={null}><ConfirmationForm initialEmail=""/></Suspense>;
}
