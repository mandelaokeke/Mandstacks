"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BookDetailClient } from "@/components/book-detail-client";

function SelectedBook() {
  const bookId = useSearchParams().get("id") ?? "";
  return <BookDetailClient bookId={bookId}/>;
}

export default function BookPage() {
  return <Suspense fallback={<div className="page-loading"><span className="auth-spinner"/><p>Finding that book…</p></div>}><SelectedBook/></Suspense>;
}
