import type { Book, Loan } from "./types";

export const books: Book[] = [
  { bookId: "the-midnight-library", title: "The Midnight Library", author: "Matt Haig", isbn: "9780525559474", category: "Fiction", publisher: "Viking", description: "Between life and death there is a library, and within that library, the shelves go on forever. A moving exploration of regret, hope, and the lives we might have lived.", totalCopies: 5, availableCopies: 3 },
  { bookId: "atomic-habits", title: "Atomic Habits", author: "James Clear", isbn: "9780735211292", category: "Personal Growth", publisher: "Avery", description: "A practical guide to building good habits, breaking bad ones, and mastering the tiny behaviors that lead to remarkable results.", totalCopies: 4, availableCopies: 1 },
  { bookId: "educated", title: "Educated", author: "Tara Westover", isbn: "9780399590504", category: "Memoir", publisher: "Random House", description: "A memoir about a young woman who leaves an isolated upbringing and discovers the transforming power of education.", totalCopies: 3, availableCopies: 0 },
  { bookId: "project-hail-mary", title: "Project Hail Mary", author: "Andy Weir", isbn: "9780593135204", category: "Science Fiction", publisher: "Ballantine", description: "A lone astronaut must save the earth from disaster in this inventive story of discovery, survival, and unexpected friendship.", totalCopies: 6, availableCopies: 4 },
  { bookId: "the-design-of-everyday-things", title: "The Design of Everyday Things", author: "Don Norman", isbn: "9780465050659", category: "Design", publisher: "Basic Books", description: "A foundational examination of how thoughtful design serves as communication between object and user.", totalCopies: 2, availableCopies: 2 },
  { bookId: "braiding-sweetgrass", title: "Braiding Sweetgrass", author: "Robin Wall Kimmerer", isbn: "9781571313560", category: "Nature", publisher: "Milkweed Editions", description: "Indigenous wisdom, scientific knowledge, and the teachings of plants woven into a celebration of our relationship with the natural world.", totalCopies: 4, availableCopies: 2 },
];

export const loans: Loan[] = [
  { loanId: "loan-1", userId: "member", bookId: "atomic-habits", bookTitle: "Atomic Habits", borrowedAt: "2026-07-06T12:00:00Z", dueDate: "2026-07-20T12:00:00Z", status: "BORROWED" },
  { loanId: "loan-2", userId: "member", bookId: "project-hail-mary", bookTitle: "Project Hail Mary", borrowedAt: "2026-06-30T12:00:00Z", dueDate: "2026-07-14T12:00:00Z", status: "BORROWED" },
  { loanId: "loan-3", userId: "member", bookId: "educated", bookTitle: "Educated", borrowedAt: "2026-05-12T12:00:00Z", dueDate: "2026-05-26T12:00:00Z", returnedAt: "2026-05-24T12:00:00Z", status: "RETURNED" },
];

export const coverColors = ["sage", "clay", "navy", "gold", "plum", "forest"];
