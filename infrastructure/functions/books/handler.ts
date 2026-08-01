import { randomUUID } from "node:crypto";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyResultV2 } from "aws-lambda";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { documentClient } from "../common/dynamo";
import {
  ApiError,
  type ApiEvent,
  decodeCursor,
  encodeCursor,
  handleErrors,
  parseBody,
  requiredString,
  requireAdmin,
  response,
} from "../common/http";

const tableName = process.env.BOOKS_TABLE_NAME ?? "";
const ebooksBucketName = process.env.EBOOKS_BUCKET_NAME ?? "";
const s3Client = new S3Client({});

type ReadingUrlFactory = (key: string) => Promise<string>;

const createReadingUrl: ReadingUrlFactory = key => getSignedUrl(
  s3Client,
  new GetObjectCommand({ Bucket: ebooksBucketName, Key: key }),
  { expiresIn: 300 },
);

interface BookInput {
  title: string;
  author: string;
  isbn: string;
  category: string;
  publisher: string;
  description: string;
  coverImage?: string;
  totalCopies: number;
}

function publicBook(item: Record<string, unknown>): Record<string, unknown> {
  const book = { ...item };
  delete book.ebookKey;
  return book;
}

function validateBook(body: Record<string, unknown>): BookInput {
  const totalCopies = body.totalCopies;
  if (!Number.isInteger(totalCopies) || Number(totalCopies) < 1 || Number(totalCopies) > 10_000) {
    throw new ApiError(400, "VALIDATION_ERROR", "totalCopies must be an integer between 1 and 10000");
  }
  const coverImage = body.coverImage;
  if (coverImage !== undefined && typeof coverImage !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "coverImage must be a URL string");
  }

  return {
    title: requiredString(body, "title", 200),
    author: requiredString(body, "author", 200),
    isbn: requiredString(body, "isbn", 20).replace(/[-\s]/g, ""),
    category: requiredString(body, "category", 80),
    publisher: requiredString(body, "publisher", 160),
    description: requiredString(body, "description", 4000),
    coverImage: coverImage?.trim() || undefined,
    totalCopies: Number(totalCopies),
  };
}

export function createBooksHandler(
  client: DynamoDBDocumentClient,
  readingUrlFactory: ReadingUrlFactory = createReadingUrl,
) {
  return async (event: ApiEvent): Promise<APIGatewayProxyResultV2> =>
    handleErrors(event.requestContext.requestId, async () => {
      const route = event.routeKey;
      const bookId = event.pathParameters?.id;

      if (route === "GET /books") {
        const query = event.queryStringParameters ?? {};
        const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
        const cursor = decodeCursor(query.cursor);
        const category = query.category?.trim();
        const search = query.search?.trim().toLowerCase();
        const availableOnly = query.availableOnly === "true";
        const names: Record<string, string> = {};
        const values: Record<string, unknown> = {};
        const filters: string[] = [];

        if (search) {
          names["#searchTitle"] = "searchTitle";
          names["#searchAuthor"] = "searchAuthor";
          names["#isbn"] = "isbn";
          values[":search"] = search;
          filters.push("(contains(#searchTitle, :search) OR contains(#searchAuthor, :search) OR contains(#isbn, :search))");
        }
        if (availableOnly) {
          names["#available"] = "availableCopies";
          values[":zero"] = 0;
          filters.push("#available > :zero");
        }

        const common = {
          TableName: tableName,
          Limit: limit,
          ExclusiveStartKey: cursor,
          FilterExpression: filters.length ? filters.join(" AND ") : undefined,
          ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
          ExpressionAttributeValues: Object.keys(values).length ? values : undefined,
        };
        const result = category
          ? await client.send(new QueryCommand({
              ...common,
              IndexName: "CategoryTitleIndex",
              KeyConditionExpression: "#category = :category",
              ExpressionAttributeNames: { ...names, "#category": "category" },
              ExpressionAttributeValues: { ...values, ":category": category },
            }))
          : await client.send(new ScanCommand(common));

        return response(200, {
          items: (result.Items ?? []).map(publicBook),
          cursor: encodeCursor(result.LastEvaluatedKey),
        });
      }

      if (route === "GET /books/{id}") {
        const result = await client.send(new GetCommand({ TableName: tableName, Key: { bookId } }));
        if (!result.Item) throw new ApiError(404, "BOOK_NOT_FOUND", "Book not found");
        return response(200, publicBook(result.Item));
      }

      if (route === "GET /books/{id}/content") {
        const result = await client.send(new GetCommand({ TableName: tableName, Key: { bookId } }));
        if (!result.Item) throw new ApiError(404, "BOOK_NOT_FOUND", "Book not found");
        const ebookKey = result.Item.ebookKey;
        if (result.Item.digitalAccess !== "PUBLIC_DOMAIN" || typeof ebookKey !== "string" || !ebookKey) {
          throw new ApiError(404, "DIGITAL_COPY_UNAVAILABLE", "This book does not have a readable digital edition");
        }

        return response(200, {
          url: await readingUrlFactory(ebookKey),
          expiresIn: 300,
          format: "TEXT",
          license: result.Item.license ?? "Public domain in the United States",
          sourceUrl: result.Item.readingSourceUrl,
        });
      }

      if (route === "POST /books") {
        requireAdmin(event);
        const input = validateBook(parseBody(event));
        const now = new Date().toISOString();
        const book = {
          bookId: randomUUID(),
          ...input,
          titleSort: input.title.toLowerCase(),
          searchTitle: input.title.toLowerCase(),
          searchAuthor: input.author.toLowerCase(),
          availableCopies: input.totalCopies,
          createdAt: now,
          updatedAt: now,
        };
        await client.send(new PutCommand({ TableName: tableName, Item: book }));
        return response(201, book);
      }

      if (route === "PUT /books/{id}") {
        requireAdmin(event);
        const input = validateBook(parseBody(event));
        const current = await client.send(new GetCommand({ TableName: tableName, Key: { bookId } }));
        if (!current.Item) throw new ApiError(404, "BOOK_NOT_FOUND", "Book not found");
        const borrowedCopies = Number(current.Item.totalCopies) - Number(current.Item.availableCopies);
        if (input.totalCopies < borrowedCopies) {
          throw new ApiError(409, "COPIES_ON_LOAN", `totalCopies cannot be lower than ${borrowedCopies}`);
        }
        const updated = {
          ...current.Item,
          ...input,
          titleSort: input.title.toLowerCase(),
          searchTitle: input.title.toLowerCase(),
          searchAuthor: input.author.toLowerCase(),
          availableCopies: input.totalCopies - borrowedCopies,
          updatedAt: new Date().toISOString(),
        };
        await client.send(new PutCommand({ TableName: tableName, Item: updated }));
        return response(200, updated);
      }

      if (route === "DELETE /books/{id}") {
        requireAdmin(event);
        try {
          await client.send(new DeleteCommand({
            TableName: tableName,
            Key: { bookId },
            ConditionExpression: "attribute_exists(bookId) AND availableCopies = totalCopies",
          }));
        } catch (error) {
          if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
            throw new ApiError(409, "BOOK_IN_USE", "The book does not exist or has copies on loan");
          }
          throw error;
        }
        return { statusCode: 204, body: "" };
      }

      throw new ApiError(404, "ROUTE_NOT_FOUND", "Route not found");
    });
}

export const handler = createBooksHandler(documentClient);
