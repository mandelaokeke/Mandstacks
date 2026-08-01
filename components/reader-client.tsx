"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Book, ReadingAccess } from "@/lib/types";

type Theme = "paper" | "sepia" | "night";

export function ReaderClient({ bookId }: { bookId: string }) {
  const [book, setBook] = useState<Book | null>(null);
  const [access, setAccess] = useState<ReadingAccess | null>(null);
  const [content, setContent] = useState("");
  const [fontSize, setFontSize] = useState(19);
  const [theme, setTheme] = useState<Theme>("paper");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!bookId) { setError("No book was selected."); return; }
    let active = true;
    Promise.all([api.book(bookId), api.readingAccess(bookId)])
      .then(async ([nextBook, nextAccess]) => {
        const result = await fetch(nextAccess.url);
        if (!result.ok) throw new Error("The digital edition could not be downloaded.");
        const text = await result.text();
        if (!active) return;
        setBook(nextBook);
        setAccess(nextAccess);
        setContent(text.replace(/\r\n/g, "\n"));
        const saved = Number(localStorage.getItem(`mandstacks:reader:${bookId}`) ?? 0);
        requestAnimationFrame(() => {
          const distance = document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo({ top: distance * Math.min(Math.max(saved, 0), 1) });
        });
      })
      .catch(caught => active && setError(caught instanceof Error ? caught.message : "This book could not be opened."));
    return () => { active = false; };
  }, [bookId]);

  useEffect(() => {
    let frame = 0;
    const saveProgress = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const distance = document.documentElement.scrollHeight - window.innerHeight;
        const next = distance > 0 ? Math.min(window.scrollY / distance, 1) : 0;
        setProgress(next);
        if (bookId) localStorage.setItem(`mandstacks:reader:${bookId}`, String(next));
      });
    };
    window.addEventListener("scroll", saveProgress, { passive: true });
    return () => { window.removeEventListener("scroll", saveProgress); cancelAnimationFrame(frame); };
  }, [bookId]);

  if (error) return <section className="reader-error"><span className="eyebrow">Reader unavailable</span><h1>We couldn’t open this book.</h1><p>{error}</p><Link href={`/catalog/book?id=${encodeURIComponent(bookId)}`} className="button button-primary">Back to book</Link></section>;
  if (!content || !book) return <div className="page-loading"><span className="auth-spinner"/><p>Opening your book…</p></div>;

  return <article className={`reader reader-${theme}`}>
    <header className="reader-toolbar">
      <div><Link href={`/catalog/book?id=${encodeURIComponent(bookId)}`} className="back-link">← Back to book</Link><strong>{book.title}</strong><small>{book.author}</small></div>
      <div className="reader-controls" aria-label="Reader settings">
        <button type="button" onClick={() => setFontSize(size => Math.max(15, size - 2))} aria-label="Decrease text size">A−</button>
        <button type="button" onClick={() => setFontSize(size => Math.min(29, size + 2))} aria-label="Increase text size">A+</button>
        <select value={theme} onChange={event => setTheme(event.target.value as Theme)} aria-label="Reading theme"><option value="paper">Paper</option><option value="sepia">Sepia</option><option value="night">Night</option></select>
      </div>
    </header>
    <div className="reader-progress" aria-label={`${Math.round(progress * 100)} percent read`}><span style={{ width: `${progress * 100}%` }}/></div>
    <section className="reader-page" style={{ fontSize }}><pre>{content}</pre></section>
    <footer className="reader-footer"><span>{Math.round(progress * 100)}% read</span><span>{access?.license}</span>{access?.sourceUrl && <a href={access.sourceUrl} target="_blank" rel="noreferrer">Source</a>}</footer>
  </article>;
}
