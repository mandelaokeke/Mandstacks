export type LoanStatus = "BORROWED" | "RETURNED" | "OVERDUE";

export interface Book {
  bookId: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  publisher: string;
  description: string;
  coverImage?: string;
  source?: "OPEN_LIBRARY";
  sourceUrl?: string;
  digitalAccess?: "PUBLIC_DOMAIN";
  ebookFormat?: "TEXT";
  license?: string;
  totalCopies: number;
  availableCopies: number;
  createdAt?: string;
  updatedAt?: string;
}

export type BookInput = Omit<Book, "bookId" | "availableCopies" | "createdAt" | "updatedAt" | "source" | "sourceUrl" | "digitalAccess" | "ebookFormat" | "license">;

export interface ReadingAccess {
  url: string;
  expiresIn: number;
  format: "TEXT";
  license: string;
  sourceUrl?: string;
}

export interface Loan {
  loanId: string;
  userId: string;
  bookId: string;
  bookTitle: string;
  borrowedAt: string;
  dueDate: string;
  returnedAt?: string;
  status: LoanStatus;
}

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  role: "MEMBER" | "ADMIN";
  currentLoanCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PageResult<T> {
  items: T[];
  cursor?: string;
}
