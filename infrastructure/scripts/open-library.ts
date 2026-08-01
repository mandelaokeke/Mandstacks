import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

export interface CatalogBook {
  bookId: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  publisher: string;
  description: string;
  coverImage: string;
  totalCopies: number;
  source: "OPEN_LIBRARY";
  sourceUrl: string;
}

export interface OpenLibraryDocument {
  key?: string;
  title?: string;
  author_name?: string[];
  isbn?: string[];
  cover_i?: number;
  first_publish_year?: number;
  publisher?: string[];
  first_sentence?: string | string[];
}

interface OpenLibrarySearchResponse { docs?: OpenLibraryDocument[] }
interface CategoryDefinition { category: string; query: string }

export const categories: CategoryDefinition[] = [
  { category: "Fiction", query: "subject:fiction language:eng" },
  { category: "Science Fiction", query: 'subject:"science fiction" language:eng' },
  { category: "Mystery", query: "subject:mystery language:eng" },
  { category: "History", query: "subject:history language:eng" },
  { category: "Science", query: "subject:science language:eng" },
  { category: "Technology", query: "subject:technology language:eng" },
  { category: "Biography", query: "subject:biography language:eng" },
  { category: "Children", query: 'subject:"juvenile fiction" language:eng' },
];

const fields = ["key", "title", "author_name", "isbn", "cover_i", "first_publish_year", "publisher", "first_sentence"].join(",");

function normalizeIsbn(isbn: string): string {
  return isbn.replace(/[-\s]/g, "").toUpperCase();
}

function chooseIsbn(isbns: string[] | undefined): string | undefined {
  const normalized = (isbns ?? []).map(normalizeIsbn);
  return normalized.find((isbn) => /^97[89]\d{10}$/.test(isbn))
    ?? normalized.find((isbn) => /^\d{9}[\dX]$/.test(isbn));
}

function firstText(value: string | string[] | undefined): string | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  return text?.replace(/\s+/g, " ").trim() || undefined;
}

function stableCopies(key: string): number {
  const hash = [...key].reduce((total, character) => total + character.charCodeAt(0), 0);
  return 2 + (hash % 4);
}

export function toCatalogBook(document: OpenLibraryDocument, category: string): CatalogBook | undefined {
  const key = document.key?.match(/^\/works\/(OL\d+W)$/)?.[1];
  const title = document.title?.trim();
  const author = document.author_name?.find(Boolean)?.trim();
  const isbn = chooseIsbn(document.isbn);
  if (!key || !title || !author || !isbn || !document.cover_i) return undefined;

  const publisher = document.publisher?.find((value) => value.trim())?.trim().slice(0, 160)
    ?? "Open Library catalog";
  const firstSentence = firstText(document.first_sentence);
  const description = (firstSentence
    ?? `${title} is a ${category.toLowerCase()} title by ${author}${document.first_publish_year ? `, first published in ${document.first_publish_year}` : ""}.`)
    .slice(0, 4000);

  return {
    bookId: `open-library-${key.toLowerCase()}`,
    title: title.slice(0, 200),
    author: author.slice(0, 200),
    isbn,
    category,
    publisher,
    description,
    coverImage: `https://covers.openlibrary.org/b/id/${document.cover_i}-L.jpg`,
    totalCopies: stableCopies(key),
    source: "OPEN_LIBRARY",
    sourceUrl: `https://openlibrary.org/works/${key}`,
  };
}

export async function collectCatalog(
  limit: number,
  fetcher: typeof fetch = fetch,
  pause: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
): Promise<CatalogBook[]> {
  const targetPerCategory = Math.ceil(limit / categories.length);
  const requestLimit = Math.min(100, Math.max(25, targetPerCategory * 3));
  const books: CatalogBook[] = [];
  const seenIds = new Set<string>();
  const seenIsbns = new Set<string>();

  for (const [index, definition] of categories.entries()) {
    const url = new URL("https://openlibrary.org/search.json");
    url.searchParams.set("q", definition.query);
    url.searchParams.set("fields", fields);
    url.searchParams.set("limit", String(requestLimit));

    const response = await fetcher(url, {
      headers: { "user-agent": "Mandstacks/1.0 (https://github.com/mandelaokeke/Mandstacks)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Open Library request failed with ${response.status}`);
    const payload = await response.json() as OpenLibrarySearchResponse;
    let categoryCount = 0;

    for (const document of payload.docs ?? []) {
      const book = toCatalogBook(document, definition.category);
      if (!book || seenIds.has(book.bookId) || seenIsbns.has(book.isbn)) continue;
      books.push(book);
      seenIds.add(book.bookId);
      seenIsbns.add(book.isbn);
      categoryCount += 1;
      if (categoryCount >= targetPerCategory || books.length >= limit) break;
    }

    if (books.length >= limit) break;
    if (index < categories.length - 1) await pause(1_100);
  }

  return books.slice(0, limit);
}

export async function importCatalog(
  client: DynamoDBDocumentClient,
  tableName: string,
  books: CatalogBook[],
): Promise<{ created: number; skipped: number }> {
  const existingIds = new Set<string>();
  const existingIsbns = new Set<string>();
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await client.send(new ScanCommand({ TableName: tableName, ProjectionExpression: "bookId, isbn", ExclusiveStartKey: lastKey }));
    for (const item of result.Items ?? []) {
      if (typeof item.bookId === "string") existingIds.add(item.bookId);
      if (typeof item.isbn === "string") existingIsbns.add(normalizeIsbn(item.isbn));
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  const now = new Date().toISOString();
  let created = 0;
  let skipped = 0;

  for (const book of books) {
    if (existingIds.has(book.bookId) || existingIsbns.has(book.isbn)) {
      skipped += 1;
      continue;
    }
    try {
      await client.send(new PutCommand({
        TableName: tableName,
        Item: {
          ...book,
          titleSort: book.title.toLowerCase(),
          searchTitle: book.title.toLowerCase(),
          searchAuthor: book.author.toLowerCase(),
          availableCopies: book.totalCopies,
          createdAt: now,
          updatedAt: now,
        },
        ConditionExpression: "attribute_not_exists(bookId)",
      }));
      created += 1;
      existingIds.add(book.bookId);
      existingIsbns.add(book.isbn);
    } catch (error) {
      if (!(error instanceof ConditionalCheckFailedException) && (error as { name?: string }).name !== "ConditionalCheckFailedException") throw error;
      skipped += 1;
    }
  }

  return { created, skipped };
}
