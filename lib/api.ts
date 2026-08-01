import type { Book, BookInput, Loan, PageResult, UserProfile } from "./types";
import { fetchAuthSession } from "aws-amplify/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

export class ApiClientError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) throw new ApiClientError(401, "UNAUTHENTICATED", "Please log in to continue");
  const result = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const payload = result.status === 204 ? { data: undefined } : await result.json();
  if (!result.ok) {
    throw new ApiClientError(result.status, payload.error?.code ?? "API_ERROR", payload.error?.message ?? "Request failed");
  }
  return payload.data as T;
}

async function requestAllPages<T>(path: string, query = ""): Promise<T[]> {
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  params.set("limit", "50");
  const items: T[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    if (cursor) params.set("cursor", cursor);
    else params.delete("cursor");
    const result = await request<PageResult<T>>(`${path}?${params.toString()}`);
    items.push(...result.items);
    cursor = result.cursor;
    pages += 1;
  } while (cursor && pages < 20);
  return items;
}

export const api = {
  books: (query = "") => request<PageResult<Book>>(`/books${query}`),
  allBooks: (query = "") => requestAllPages<Book>("/books", query),
  book: (id: string) => request<Book>(`/books/${id}`),
  createBook: (book: BookInput) => request<Book>("/books", { method: "POST", body: JSON.stringify(book) }),
  updateBook: (id: string, book: BookInput) => request<Book>(`/books/${id}`, { method: "PUT", body: JSON.stringify(book) }),
  deleteBook: (id: string) => request<void>(`/books/${id}`, { method: "DELETE" }),
  profile: () => request<UserProfile>("/profile"),
  updateProfile: (name: string) => request<UserProfile>("/profile", { method: "PATCH", body: JSON.stringify({ name }) }),
  users: () => request<PageResult<UserProfile>>("/users?limit=50"),
  updateUserRole: (id: string, role: UserProfile["role"]) => request<UserProfile>(`/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  myLoans: () => request<PageResult<Loan>>("/my-loans"),
  allLoans: (query = "") => request<PageResult<Loan>>(`/all-loans${query}`),
  borrow: (bookId: string) => request<Loan>("/borrow", { method: "POST", body: JSON.stringify({ bookId }) }),
  returnBook: (loanId: string) => request<Loan>("/return", { method: "POST", body: JSON.stringify({ loanId }) }),
};
