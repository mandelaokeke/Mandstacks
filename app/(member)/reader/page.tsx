"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ReaderClient } from "@/components/reader-client";

function SelectedReader() {
  const bookId = useSearchParams().get("id") ?? "";
  return <ReaderClient bookId={bookId}/>;
}

export default function ReaderPage() {
  return <Suspense fallback={<div className="page-loading"><span className="auth-spinner"/><p>Opening your book…</p></div>}><SelectedReader/></Suspense>;
}
