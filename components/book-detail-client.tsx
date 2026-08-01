"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { isActiveLoan } from "@/lib/dates";
import type { Book, Loan } from "@/lib/types";
import { Icon } from "./icons";
import { BookCover, EmptyState } from "./ui";

export function BookDetailClient({ bookId }: { bookId: string }) {
  const [book, setBook] = useState<Book | null>(null);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api.book(bookId), api.myLoans()])
      .then(([nextBook, loans]) => {
        if (!active) return;
        setBook(nextBook);
        setLoan(loans.items.find(item => item.bookId === bookId && isActiveLoan(item.status)) ?? null);
      })
      .catch(caught => active && setError(caught instanceof Error ? caught.message : "This book could not be loaded."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [bookId]);

  async function borrow() {
    if (!book) return;
    setPending(true); setError(""); setMessage("");
    try {
      const nextLoan = await api.borrow(book.bookId);
      setLoan(nextLoan);
      setBook({ ...book, availableCopies: Math.max(0, book.availableCopies - 1) });
      setMessage(`Borrowed successfully. Return by ${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(nextLoan.dueDate))}.`);
    } catch (caught) {
      setError(caught instanceof ApiClientError && caught.code === "BORROW_NOT_ALLOWED" ? "This book can’t be borrowed right now. It may be unavailable, already on your account, or you may have reached your five-book limit." : caught instanceof Error ? caught.message : "The book could not be borrowed.");
    } finally { setPending(false); }
  }

  if (loading) return <div className="page-loading"><span className="auth-spinner"/><p>Finding that book…</p></div>;
  if (!book) return <><Link href="/catalog" className="back-link">← Back to collection</Link><EmptyState icon="book" title="Book not found" copy={error || "This title is no longer in the collection."}/></>;
  const available = book.availableCopies > 0;
  const readable = book.digitalAccess === "PUBLIC_DOMAIN";
  return <>
    <Link href="/catalog" className="back-link">← Back to collection</Link>
    <article className="book-detail"><div className="book-detail-art"><BookCover book={book} index={0} large/><div className="shelf-shadow"/></div><div className="book-detail-copy"><span className="eyebrow">{book.category}</span><h1>{book.title}</h1><p className="book-author">by {book.author}</p><div className="book-metadata"><div><small>Publisher</small><strong>{book.publisher}</strong></div><div><small>ISBN</small><strong>{book.isbn}</strong></div><div><small>Availability</small><span className={`availability ${available ? "available" : "unavailable"}`}><i/>{available ? `${book.availableCopies} of ${book.totalCopies} copies` : "No copies available"}</span></div></div><div className="book-description"><h2>About this book</h2><p>{book.description}</p></div>{readable && <div className="read-box"><div><Icon name="book"/><span><strong>Digital edition available</strong><small>Read this public-domain book in Mandstacks</small></span></div><Link href={`/reader?id=${encodeURIComponent(book.bookId)}`} className="button button-dark">Read now</Link></div>}{error && <div className="form-error" role="alert">{error}</div>}{message && <div className="form-notice" role="status">{message}</div>}<div className="borrow-box"><div><Icon name={loan ? "check" : available ? "check" : "clock"}/><span><strong>{loan ? "Already on your account" : available ? "Available to borrow" : "Currently unavailable"}</strong><small>{loan ? "View it under My books" : available ? "Due 14 days after borrowing" : "Check back after another member returns a copy"}</small></span></div>{loan ? <Link href="/borrowed" className="button button-quiet">View my books</Link> : <button disabled={!available || pending} onClick={borrow} className={`button ${available ? "button-primary" : "button-quiet"}`}>{pending ? "Borrowing…" : available ? "Borrow this book" : "Unavailable"}</button>}</div></div></article>
  </>;
}
