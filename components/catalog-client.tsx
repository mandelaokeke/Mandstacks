"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons";
import { BookCard, EmptyState, PageHeading } from "./ui";
import { api } from "@/lib/api";
import type { Book } from "@/lib/types";

const categories = ["Fiction", "Memoir", "Nature", "Personal Growth", "Science Fiction", "Design"];

export function CatalogClient() {
  const [books, setBooks] = useState<Book[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ limit: "50" });
      if (search.trim()) params.set("search", search.trim());
      if (category) params.set("category", category);
      if (availableOnly) params.set("availableOnly", "true");
      try {
        const result = await api.books(`?${params.toString()}`);
        if (active) setBooks(result.items);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "The catalog could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [availableOnly, category, search]);

  return <>
    <PageHeading eyebrow="The collection" title="Discover your next book." description="Search the live collection by title, author, ISBN, category, or availability."/>
    <div className="catalog-tools">
      <label className="search-box"><Icon name="search"/><input aria-label="Search books" placeholder="Search by title, author, or ISBN" value={search} onChange={event => setSearch(event.target.value)}/></label>
      <select aria-label="Filter by category" value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(item => <option key={item}>{item}</option>)}</select>
      <label className="toggle"><input type="checkbox" checked={availableOnly} onChange={event => setAvailableOnly(event.target.checked)}/><span/> Available now</label>
    </div>
    <div className="results-meta"><p>{loading ? "Searching the shelves…" : <><strong>{books.length}</strong> {books.length === 1 ? "book" : "books"} found</>}</p></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {!loading && !error && books.length === 0 ? <EmptyState icon="search" title="No books matched" copy="Try a broader search or remove one of the filters."/> : <div className={`book-grid catalog-grid ${loading ? "content-loading" : ""}`}>{books.map((book, index) => <BookCard key={book.bookId} book={book} index={index}/>)}</div>}
  </>;
}
