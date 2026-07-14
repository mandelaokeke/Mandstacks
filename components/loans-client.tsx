"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatLibraryDate, isActiveLoan } from "@/lib/dates";
import type { Book, Loan } from "@/lib/types";
import { Icon } from "./icons";
import { BookCover, EmptyState, PageHeading, Status } from "./ui";

export function LoansClient({ mode }: { mode: "current" | "history" }) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [books, setBooks] = useState<Record<string, Book>>({});
  const [loading, setLoading] = useState(true);
  const [pendingLoan, setPendingLoan] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await api.myLoans();
      setLoans(result.items);
      const ids = [...new Set(result.items.map(item => item.bookId))];
      const details = await Promise.all(ids.map(id => api.book(id).catch(() => null)));
      setBooks(Object.fromEntries(details.filter((book): book is Book => Boolean(book)).map(book => [book.bookId, book])));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Your loans could not be loaded."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleLoans = useMemo(() => loans.filter(loan => mode === "current" ? isActiveLoan(loan.status) : loan.status === "RETURNED"), [loans, mode]);

  async function returnBook(loan: Loan) {
    setPendingLoan(loan.loanId); setError(""); setMessage("");
    try {
      const returned = await api.returnBook(loan.loanId);
      setLoans(items => items.map(item => item.loanId === returned.loanId ? returned : item));
      setMessage(`${loan.bookTitle} was returned successfully.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The book could not be returned."); }
    finally { setPendingLoan(""); }
  }

  if (mode === "history") return <>
    <PageHeading eyebrow="Your reading life" title="Borrowing history" description="A live record of every title you’ve returned."/>
    {error && <div className="form-error" role="alert">{error}</div>}
    <section className="panel table-panel">{loading ? <div className="page-loading compact"><span className="auth-spinner"/><p>Loading your history…</p></div> : visibleLoans.length === 0 ? <EmptyState icon="history" title="No returned books yet" copy="Books will appear here after you return them." action={<Link href="/catalog" className="button button-primary">Browse the collection</Link>}/> : <table><thead><tr><th>Book</th><th>Borrowed</th><th>Returned</th><th>Status</th></tr></thead><tbody>{visibleLoans.map(loan => <tr key={loan.loanId}><td><strong>{loan.bookTitle}</strong><small>{books[loan.bookId]?.author ?? "Library collection"}</small></td><td>{formatLibraryDate(loan.borrowedAt)}</td><td>{loan.returnedAt ? formatLibraryDate(loan.returnedAt) : "—"}</td><td><Status status={loan.status}/></td></tr>)}</tbody></table>}</section>
  </>;

  return <>
    <PageHeading eyebrow="My library" title="Borrowed books" description="Keep an eye on live due dates and return books when you’re finished."/>
    {error && <div className="form-error" role="alert">{error}</div>}{message && <div className="form-notice" role="status">{message}</div>}
    <section className="panel">{loading ? <div className="page-loading compact"><span className="auth-spinner"/><p>Checking your shelves…</p></div> : visibleLoans.length === 0 ? <EmptyState title="Your shelf is empty" copy="Borrow a book from the collection and it will appear here." action={<Link href="/catalog" className="button button-primary">Find a book</Link>}/> : <div className="loan-list">{visibleLoans.map((loan, index) => { const book = books[loan.bookId]; return <article className="loan-row loan-row-detailed" key={loan.loanId}>{book ? <BookCover book={book} index={index}/> : <div className="book-cover cover-navy"><strong>{loan.bookTitle}</strong></div>}<div className="loan-main"><span className="eyebrow">{book?.category ?? "Library book"}</span><h3>{loan.bookTitle}</h3><p>{book?.author ?? ""}</p></div><div className="loan-date"><small>Borrowed</small><strong>{formatLibraryDate(loan.borrowedAt)}</strong></div><div className="loan-date"><small>Due</small><strong>{formatLibraryDate(loan.dueDate)}</strong></div><Status status={loan.status}/><button disabled={pendingLoan === loan.loanId} onClick={() => returnBook(loan)} className="button button-quiet">{pendingLoan === loan.loanId ? "Returning…" : "Return book"}</button></article>; })}</div>}</section>
    <div className="page-note"><Icon name="clock"/><p><strong>Need more time?</strong> Return your book and borrow it again if a copy is still available.</p><Link href="/catalog">Browse books</Link></div>
  </>;
}
