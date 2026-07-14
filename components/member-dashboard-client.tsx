"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatLibraryDate, isActiveLoan, isDueSoon } from "@/lib/dates";
import type { Book, Loan } from "@/lib/types";
import { Icon } from "./icons";
import { BookCover, EmptyState, PageHeading, StatCard, Status } from "./ui";
import { UserFirstName } from "./user-name";

export function MemberDashboardClient() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [books, setBooks] = useState<Record<string, Book>>({});
  const [recommendation, setRecommendation] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api.myLoans(), api.books("?availableOnly=true&limit=20")])
      .then(async ([loanResult, bookResult]) => {
        const activeLoans = loanResult.items.filter(loan => isActiveLoan(loan.status));
        const details = await Promise.all(activeLoans.map(loan => api.book(loan.bookId).catch(() => null)));
        if (!active) return;
        setLoans(activeLoans);
        setBooks(Object.fromEntries(details.filter((book): book is Book => Boolean(book)).map(book => [book.bookId, book])));
        setRecommendation(bookResult.items.find(book => !activeLoans.some(loan => loan.bookId === book.bookId)) ?? null);
      })
      .catch(caught => active && setError(caught instanceof Error ? caught.message : "Your dashboard could not be loaded."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const dueSoon = useMemo(() => loans.filter(loan => isDueSoon(loan.dueDate)).length, [loans]);
  const overdue = useMemo(() => loans.filter(loan => loan.status === "OVERDUE").length, [loans]);
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());

  return <>
    <PageHeading eyebrow={today} title={<>Welcome back, <UserFirstName/>.</>} description="Here’s the live status of your library account." action={<Link href="/catalog" className="button button-primary"><Icon name="search" size={18}/> Find a book</Link>}/>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="stats-grid member-stats"><StatCard label="Books borrowed" value={loading ? "—" : String(loans.length)} note="of 5 book limit" icon="book"/><StatCard label="Due this week" value={loading ? "—" : String(dueSoon)} note={dueSoon ? "Plan your returns" : "Nothing due soon"} icon="clock" tone="gold"/><StatCard label="Overdue" value={loading ? "—" : String(overdue)} note={overdue ? "Please return promptly" : "You’re all caught up"} icon={overdue ? "warning" : "check"} tone={overdue ? "gold" : "green"}/></div>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Currently reading</span><h2>Your borrowed books</h2></div><Link href="/borrowed">View all <Icon name="arrow" size={16}/></Link></div>{loading ? <div className="page-loading compact"><span className="auth-spinner"/><p>Loading your shelves…</p></div> : loans.length === 0 ? <EmptyState title="Nothing borrowed yet" copy="Your active loans and due dates will appear here." action={<Link href="/catalog" className="button button-primary">Browse books</Link>}/> : <div className="loan-list">{loans.slice(0, 3).map((loan, index) => { const book = books[loan.bookId]; return <article className="loan-row" key={loan.loanId}>{book && <BookCover book={book} index={index}/>}<div className="loan-main"><span className="eyebrow">{book?.category ?? "Library book"}</span><h3>{loan.bookTitle}</h3><p>{book?.author ?? ""}</p></div><div className="loan-date"><small>Due date</small><strong>{formatLibraryDate(loan.dueDate)}</strong></div><Status status={loan.status}/><Link href={`/catalog/book?id=${encodeURIComponent(loan.bookId)}`} className="icon-button" aria-label={`View ${loan.bookTitle}`}><Icon name="arrow"/></Link></article>; })}</div>}</section>
    {recommendation && <section className="panel dashboard-recommendation"><div className="panel-heading"><div><span className="eyebrow">Available now</span><h2>Your next read</h2></div></div><article className="recommendation"><BookCover book={recommendation} index={0}/><div><h3>{recommendation.title}</h3><p>{recommendation.author}</p><span className="availability available"><i/>{recommendation.availableCopies} available</span><Link href={`/catalog/book?id=${encodeURIComponent(recommendation.bookId)}`}>View book <Icon name="arrow" size={15}/></Link></div></article></section>}
  </>;
}
