"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { isActiveLoan } from "@/lib/dates";
import type { Book, Loan, UserProfile } from "@/lib/types";
import { PageHeading, StatCard } from "./ui";

export function AdminReportsClient() {
  const [books, setBooks] = useState<Book[]>([]); const [users, setUsers] = useState<UserProfile[]>([]); const [loans, setLoans] = useState<Loan[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { Promise.all([api.allBooks(), api.users(), api.allLoans("?limit=50")]).then(([b, u, l]) => { setBooks(b); setUsers(u.items); setLoans(l.items); }).catch(caught => setError(caught instanceof Error ? caught.message : "Reports could not be loaded.")).finally(() => setLoading(false)); }, []);
  const categories = useMemo(() => { const byBook = Object.fromEntries(books.map(book => [book.bookId, book.category])); const counts = new Map<string, number>(); for (const loan of loans) { const category = byBook[loan.bookId] ?? "Other"; counts.set(category, (counts.get(category) ?? 0) + 1); } return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5); }, [books, loans]);
  const returned = loans.filter(loan => loan.status === "RETURNED").length; const active = loans.filter(loan => isActiveLoan(loan.status)).length; const totalCopies = books.reduce((sum, book) => sum + book.totalCopies, 0);
  const value = (number: number) => loading ? "—" : String(number);
  return <><PageHeading eyebrow="Library insights" title="Reports" description="A live snapshot of circulation, collection health, and community activity."/>{error && <div className="form-error" role="alert">{error}</div>}<div className="stats-grid admin-stats"><StatCard label="Borrow records" value={value(loans.length)} note={`${active} currently active`}/><StatCard label="Registered users" value={value(users.length)} note="confirmed profiles" icon="users" tone="green"/><StatCard label="Returns recorded" value={value(returned)} note={loans.length ? `${Math.round(returned / loans.length * 100)}% of records` : "No circulation yet"} icon="check" tone="gold"/><StatCard label="Catalog copies" value={value(totalCopies)} note={`${books.length} unique titles`} icon="plus"/></div><div className="reports-grid"><section className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">Inventory health</span><h2>Copies by title</h2></div></div><div className="bar-chart">{books.slice(0, 6).map(book => <div key={book.bookId}><span title={`${book.title}: ${book.totalCopies}`} style={{height: `${Math.max(12, Math.min(100, book.totalCopies * 12))}%`}}/><small>{book.title.split(" ")[0]}</small></div>)}</div></section><section className="panel category-report"><span className="eyebrow">Circulation</span><h2>Top categories</h2>{categories.length ? categories.map(([category, count], index) => <div key={category}><span><i style={{background: ["#294c3a", "#d1905c", "#607c72", "#bb9b5e", "#c7c1b6"][index]}}/>{category}</span><strong>{count}</strong></div>) : <p>Category rankings appear after members borrow books.</p>}</section></div></>;
}
