"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Book } from "@/lib/types";
import { BookCard, EmptyState, PageHeading } from "./ui";

export function ReadableBooksClient() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.allBooks()
      .then(items => {
        if (!active) return;
        setBooks(items
          .filter(book => book.digitalAccess === "PUBLIC_DOMAIN")
          .sort((left, right) => left.title.localeCompare(right.title)));
      })
      .catch(caught => active && setError(caught instanceof Error ? caught.message : "The digital shelf could not be loaded."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return <>
    <PageHeading eyebrow="Digital shelf" title="Read online." description="Choose a public-domain classic and continue reading right inside Mandstacks."/>
    <div className="digital-library-note"><strong>No borrowing required.</strong><span>Your position is saved automatically on this device. More licensed editions can be added later.</span></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {loading ? <div className="page-loading"><span className="auth-spinner"/><p>Opening the digital shelf…</p></div> : books.length === 0 ? <EmptyState icon="book" title="No digital books yet" copy="Readable public-domain editions will appear here."/> : <div className="book-grid catalog-grid">{books.map((book, index) => <BookCard key={book.bookId} book={book} index={index}/>)}</div>}
  </>;
}
