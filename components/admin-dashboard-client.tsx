"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatLibraryDate, isActiveLoan } from "@/lib/dates";
import type { Book, Loan, UserProfile } from "@/lib/types";
import { Icon } from "./icons";
import { PageHeading, StatCard, Status } from "./ui";
import { UserFirstName } from "./user-name";

export function AdminDashboardClient() {
  const [books, setBooks] = useState<Book[]>([]); const [users, setUsers] = useState<UserProfile[]>([]); const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { Promise.all([api.allBooks(), api.users(), api.allLoans("?limit=50")]).then(([bookResult, userResult, loanResult]) => { setBooks(bookResult); setUsers(userResult.items); setLoans(loanResult.items); }).catch(caught => setError(caught instanceof Error ? caught.message : "Operational data could not be loaded.")).finally(() => setLoading(false)); }, []);
  const totalCopies = books.reduce((sum, book) => sum + book.totalCopies, 0); const availableCopies = books.reduce((sum, book) => sum + book.availableCopies, 0);
  const active = loans.filter(loan => isActiveLoan(loan.status)); const overdue = active.filter(loan => loan.status === "OVERDUE");
  const userMap = useMemo(() => Object.fromEntries(users.map(user => [user.userId, user])), [users]);
  const value = (number: number) => loading ? "—" : String(number);
  return <><PageHeading eyebrow="Library operations" title={<>Welcome, <UserFirstName/>.</>} description="Here’s the live pulse of Mandstacks." action={<Link href="/admin/books" className="button button-primary"><Icon name="plus" size={18}/> Manage books</Link>}/>{error && <div className="form-error" role="alert">{error}</div>}<div className="stats-grid admin-stats"><StatCard label="Total copies" value={value(totalCopies)} note={`${books.length} unique titles`} icon="book"/><StatCard label="Available now" value={value(availableCopies)} note={totalCopies ? `${Math.round(availableCopies / totalCopies * 100)}% of inventory` : "Catalog ready"} icon="check" tone="green"/><StatCard label="Registered users" value={value(users.length)} note={`${active.length} active loans`} icon="users" tone="gold"/><StatCard label="Overdue" value={value(overdue.length)} note="Needs attention" icon="warning" tone="red"/></div><div className="admin-dashboard-grid"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">Recent activity</span><h2>Borrow records</h2></div><Link href="/admin/loans">View all</Link></div><div className="activity-list">{loans.slice(0, 5).map(loan => <div key={loan.loanId}><span className="activity-icon"><Icon name={loan.status === "RETURNED" ? "check" : "book"}/></span><p><strong>{userMap[loan.userId]?.name ?? "Library member"}</strong> {loan.status === "RETURNED" ? "returned" : "borrowed"} <b>{loan.bookTitle}</b><small>{formatLibraryDate(loan.returnedAt ?? loan.borrowedAt)}</small></p></div>)}</div></section><section className="panel overdue-preview"><div className="panel-heading"><div><span className="eyebrow">Needs attention</span><h2>Overdue loans</h2></div><Status status="OVERDUE"/></div><strong className="big-number">{value(overdue.length)}</strong><p>{overdue.length === 1 ? "book is" : "books are"} currently past the due date.</p><Link href="/admin/overdue" className="button button-quiet">Review overdue books</Link></section></div></>;
}
