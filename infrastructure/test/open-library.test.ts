import { collectCatalog, toCatalogBook } from "../scripts/open-library";

describe("Open Library catalog importer", () => {
  test("normalizes a complete result into the Mandstacks schema", () => {
    const book = toCatalogBook({
      key: "/works/OL123W",
      title: "A Useful Book",
      author_name: ["Ada Author"],
      isbn: ["1-23456789-X", "9781234567897"],
      cover_i: 42,
      first_publish_year: 1925,
      publisher: ["Example Press"],
      first_sentence: ["A concise opening sentence."],
    }, "Fiction");

    expect(book).toMatchObject({
      bookId: "open-library-ol123w",
      isbn: "9781234567897",
      coverImage: "https://covers.openlibrary.org/b/id/42-L.jpg",
      sourceUrl: "https://openlibrary.org/works/OL123W",
      description: "A concise opening sentence.",
    });
    expect(book?.totalCopies).toBeGreaterThanOrEqual(2);
    expect(book?.totalCopies).toBeLessThanOrEqual(5);
  });

  test("rejects incomplete records", () => {
    expect(toCatalogBook({ key: "/works/OL123W", title: "No cover" }, "Fiction")).toBeUndefined();
  });

  test("deduplicates records by ISBN across category requests", async () => {
    const fetcher = jest.fn(async () => ({
      ok: true,
      json: async () => ({ docs: [{ key: "/works/OL123W", title: "Repeated Book", author_name: ["Ada Author"], isbn: ["9781234567897"], cover_i: 42 }] }),
    } as Response));

    const books = await collectCatalog(8, fetcher, async () => undefined);
    expect(fetcher).toHaveBeenCalledTimes(8);
    expect(books).toHaveLength(1);
  });
});
