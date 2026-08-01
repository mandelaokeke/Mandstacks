"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Book, BookInput } from "@/lib/types";
import { Icon } from "./icons";
import { EmptyState, PageHeading, Status } from "./ui";

function BookEditor({ book, onClose, onSaved }: { book?: Book; onClose: () => void; onSaved: (book: Book) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const data = new FormData(event.currentTarget);
    const input: BookInput = {
      title: String(data.get("title") ?? ""), author: String(data.get("author") ?? ""),
      isbn: String(data.get("isbn") ?? ""), category: String(data.get("category") ?? ""),
      publisher: String(data.get("publisher") ?? ""), description: String(data.get("description") ?? ""),
      coverImage: String(data.get("coverImage") ?? "") || undefined,
      totalCopies: Number(data.get("totalCopies")),
    };
    try { onSaved(book ? await api.updateBook(book.bookId, input) : await api.createBook(input)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The book could not be saved."); }
    finally { setPending(false); }
  }
  return <section className="panel admin-editor"><div className="panel-heading"><div><span className="eyebrow">{book ? "Edit catalog record" : "New catalog record"}</span><h2>{book ? book.title : "Add a book"}</h2></div><button className="table-action" onClick={onClose}>Close</button></div>{error && <div className="form-error" role="alert">{error}</div>}<form onSubmit={submit}><label>Title<input required name="title" defaultValue={book?.title}/></label><label>Author<input required name="author" defaultValue={book?.author}/></label><label>ISBN<input required name="isbn" defaultValue={book?.isbn}/></label><label>Category<input required name="category" defaultValue={book?.category}/></label><label>Publisher<input required name="publisher" defaultValue={book?.publisher}/></label><label>Total copies<input required min={1} max={10000} type="number" name="totalCopies" defaultValue={book?.totalCopies ?? 1}/></label><label className="form-wide">Cover image URL<input type="url" name="coverImage" defaultValue={book?.coverImage}/></label><label className="form-wide">Description<textarea required name="description" defaultValue={book?.description}/></label><div className="form-wide editor-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button disabled={pending} className="button button-primary" type="submit">{pending ? "Saving…" : "Save book"}</button></div></form></section>;
}

export function AdminBooksClient() {
  const [books, setBooks] = useState<Book[]>([]); const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Book | "new" | null>(null); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const load = useCallback(async () => { setLoading(true); try { setBooks(await api.allBooks()); } catch (caught) { setError(caught instanceof Error ? caught.message : "The catalog could not be loaded."); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => { const term = search.toLowerCase(); return books.filter(book => [book.title, book.author, book.isbn].some(value => value.toLowerCase().includes(term))); }, [books, search]);
  function saved(book: Book) { setBooks(items => { const exists = items.some(item => item.bookId === book.bookId); return exists ? items.map(item => item.bookId === book.bookId ? book : item) : [book, ...items]; }); setEditor(null); setMessage("The catalog record was saved."); }
  async function remove(book: Book) { if (!window.confirm(`Delete ${book.title}? This is only allowed when every copy is available.`)) return; setError(""); try { await api.deleteBook(book.bookId); setBooks(items => items.filter(item => item.bookId !== book.bookId)); setMessage(`${book.title} was deleted.`); } catch (caught) { setError(caught instanceof Error ? caught.message : "The book could not be deleted."); } }
  return <><PageHeading eyebrow="Catalog management" title="Books" description="Add titles, manage copies, and keep catalog details accurate." action={<button onClick={() => setEditor("new")} className="button button-primary"><Icon name="plus" size={18}/> Add book</button>}/>{editor && <BookEditor key={editor === "new" ? "new" : editor.bookId} book={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSaved={saved}/>} {error && <div className="form-error" role="alert">{error}</div>}{message && <div className="form-notice" role="status">{message}</div>}<div className="admin-tools"><label className="search-box"><Icon name="search"/><input aria-label="Search catalog" placeholder="Search title, author, or ISBN" value={search} onChange={event => setSearch(event.target.value)}/></label></div><section className="panel table-panel">{loading ? <div className="page-loading compact"><span className="auth-spinner"/></div> : visible.length === 0 ? <EmptyState title="No books found" copy="Add the first catalog record or change your search."/> : <table><thead><tr><th>Title</th><th>Category</th><th>ISBN</th><th>Copies</th><th>Status</th><th></th></tr></thead><tbody>{visible.map(book => <tr key={book.bookId}><td><strong>{book.title}</strong><small>{book.author}</small></td><td>{book.category}</td><td>{book.isbn}</td><td><strong>{book.availableCopies}</strong> / {book.totalCopies}</td><td><Status status={book.availableCopies ? "AVAILABLE" : "BORROWED"}/></td><td><div className="row-actions"><button onClick={() => setEditor(book)} className="table-action">Edit</button><button onClick={() => remove(book)} className="table-action danger-text">Delete</button></div></td></tr>)}</tbody></table>}</section></>;
}
