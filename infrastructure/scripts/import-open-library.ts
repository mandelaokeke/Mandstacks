import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { collectCatalog, importCatalog } from "./open-library";

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const requestedLimit = Number(option("limit") ?? 150);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 500) {
    throw new Error("--limit must be an integer between 1 and 500");
  }

  const shouldWrite = process.argv.includes("--write");
  console.log(`Collecting up to ${requestedLimit} curated Open Library records...`);
  const books = await collectCatalog(requestedLimit);
  const categoryCounts = books.reduce<Record<string, number>>((counts, book) => {
    counts[book.category] = (counts[book.category] ?? 0) + 1;
    return counts;
  }, {});

  console.table(Object.entries(categoryCounts).map(([category, count]) => ({ category, count })));
  console.table(books.slice(0, 10).map(({ title, author, category, isbn }) => ({ title, author, category, isbn })));

  if (!shouldWrite) {
    console.log(`Dry run complete: ${books.length} valid books found. Add --write to import them.`);
    return;
  }

  const tableName = process.env.BOOKS_TABLE_NAME;
  if (!tableName) throw new Error("BOOKS_TABLE_NAME is required with --write");
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const result = await importCatalog(client, tableName, books);
  console.log(`Catalog import complete: ${result.created} created, ${result.skipped} already present.`);
}

void main();
