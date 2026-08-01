import Link from "next/link";
import { coverColors } from "@/lib/demo";
import type { Book, LoanStatus } from "@/lib/types";
import { Icon } from "./icons";

/* Open Library cover URLs are already image-sized and intentionally rendered directly. */

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" className={`logo ${inverse ? "logo-inverse" : ""}`} aria-label="Mandstacks home"><span className="logo-mark"><i/><i/><i/></span><span>Mandstacks</span></Link>;
}

export function BookCover({ book, index = 0, large = false }: { book: Book; index?: number; large?: boolean }) {
  return <div className={`book-cover cover-${coverColors[index % coverColors.length]} ${book.coverImage ? "book-cover-image" : ""} ${large ? "book-cover-large" : ""}`}>{book.coverImage ? <img src={book.coverImage} alt={`Cover of ${book.title}`} loading="lazy"/> : <><span className="cover-category">{book.category}</span><strong>{book.title}</strong><small>{book.author}</small></>}</div>;
}

export function BookCard({ book, index }: { book: Book; index: number }) {
  const available = book.availableCopies > 0;
  const href = `/catalog/book?id=${encodeURIComponent(book.bookId)}`;
  return <article className="book-card"><Link href={href}><BookCover book={book} index={index}/></Link><div className="book-card-copy"><span className="eyebrow">{book.category}</span><h3><Link href={href}>{book.title}</Link></h3><p>{book.author}</p><span className={`availability ${available ? "available" : "unavailable"}`}><i/>{available ? `${book.availableCopies} available` : "Waitlist only"}</span></div></article>;
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: React.ReactNode; description?: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

export function StatCard({ label, value, note, icon = "chart", tone = "default" }: { label: string; value: string; note: string; icon?: string; tone?: string }) {
  return <article className={`stat-card stat-${tone}`}><span className="stat-icon"><Icon name={icon}/></span><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div></article>;
}

export function Status({ status }: { status: LoanStatus | "AVAILABLE" | "ACTIVE" }) {
  return <span className={`status status-${status.toLowerCase()}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

export function EmptyState({ icon = "book", title, copy, action }: { icon?: string; title: string; copy: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span><Icon name={icon} size={26}/></span><h3>{title}</h3><p>{copy}</p>{action}</div>;
}
