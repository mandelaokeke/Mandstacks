import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

interface PublicDomainEdition {
  bookId: string;
  title: string;
  gutenbergId: number;
}

const editions: PublicDomainEdition[] = [
  { bookId: "open-library-ol450063w", title: "Frankenstein; or, The Modern Prometheus", gutenbergId: 84 },
  { bookId: "open-library-ol8193416w", title: "The Picture of Dorian Gray", gutenbergId: 174 },
  { bookId: "open-library-ol52266w", title: "The Invisible Man", gutenbergId: 5230 },
  { bookId: "open-library-ol52267w", title: "The Time Machine", gutenbergId: 35 },
  { bookId: "open-library-ol18417w", title: "The Wonderful Wizard of Oz", gutenbergId: 55 },
  { bookId: "open-library-ol18396w", title: "The Marvelous Land of Oz", gutenbergId: 54 },
  { bookId: "open-library-ol21177w", title: "Wuthering Heights", gutenbergId: 768 },
  { bookId: "open-library-ol77746w", title: "Anne of Green Gables", gutenbergId: 45 },
  { bookId: "open-library-ol69630w", title: "A Little Princess", gutenbergId: 146 },
  { bookId: "open-library-ol2895536w", title: "Carmilla", gutenbergId: 10007 },
];

const userAgent = "Mandstacks/1.0 (https://github.com/mandelaokeke/Mandstacks)";

async function downloadText(gutenbergId: number): Promise<string> {
  const url = `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`;
  const response = await fetch(url, {
    headers: { "user-agent": userAgent },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Project Gutenberg ${gutenbergId} returned ${response.status}`);
  const text = await response.text();
  if (text.length < 10_000) throw new Error(`Project Gutenberg ${gutenbergId} returned an unexpectedly short file`);
  return text;
}

async function main() {
  const shouldWrite = process.argv.includes("--write");
  console.table(editions.map(({ title, gutenbergId }) => ({ title, gutenbergId })));
  if (!shouldWrite) {
    console.log(`Dry run complete: ${editions.length} public-domain editions selected. Add --write to upload them.`);
    return;
  }

  const tableName = process.env.BOOKS_TABLE_NAME;
  const bucketName = process.env.EBOOKS_BUCKET_NAME;
  if (!tableName || !bucketName) throw new Error("BOOKS_TABLE_NAME and EBOOKS_BUCKET_NAME are required with --write");

  const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const s3 = new S3Client({});
  let imported = 0;
  let missing = 0;

  for (const [index, edition] of editions.entries()) {
    const existing = await dynamo.send(new GetCommand({ TableName: tableName, Key: { bookId: edition.bookId } }));
    if (!existing.Item) {
      console.warn(`Skipping ${edition.title}: matching catalog record not found.`);
      missing += 1;
      continue;
    }

    const text = await downloadText(edition.gutenbergId);
    const ebookKey = `public-domain/gutenberg-${edition.gutenbergId}.txt`;
    const sourceUrl = `https://www.gutenberg.org/ebooks/${edition.gutenbergId}`;
    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: ebookKey,
      Body: text,
      ContentType: "text/plain; charset=utf-8",
      Metadata: { source: sourceUrl, license: "public-domain-us" },
    }));
    await dynamo.send(new UpdateCommand({
      TableName: tableName,
      Key: { bookId: edition.bookId },
      UpdateExpression: "SET digitalAccess = :access, ebookFormat = :format, ebookKey = :key, #license = :license, readingSourceUrl = :source, updatedAt = :updated",
      ExpressionAttributeNames: { "#license": "license" },
      ExpressionAttributeValues: {
        ":access": "PUBLIC_DOMAIN",
        ":format": "TEXT",
        ":key": ebookKey,
        ":license": "Public domain in the United States",
        ":source": sourceUrl,
        ":updated": new Date().toISOString(),
      },
    }));
    imported += 1;
    console.log(`Added digital edition: ${edition.title}`);
    if (index < editions.length - 1) await new Promise(resolve => setTimeout(resolve, 1_000));
  }

  console.log(`Digital import complete: ${imported} added, ${missing} catalog records missing.`);
}

void main();
