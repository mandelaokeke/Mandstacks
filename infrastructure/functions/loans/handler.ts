import { randomUUID } from "node:crypto";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyResultV2 } from "aws-lambda";
import { documentClient } from "../common/dynamo";
import {
  ApiError,
  type ApiEvent,
  decodeCursor,
  encodeCursor,
  handleErrors,
  identityFrom,
  parseBody,
  requireAdmin,
  response,
} from "../common/http";

const booksTable = process.env.BOOKS_TABLE_NAME ?? "";
const loansTable = process.env.LOANS_TABLE_NAME ?? "";
const usersTable = process.env.USERS_TABLE_NAME ?? "";
const loanPeriodDays = Number(process.env.LOAN_PERIOD_DAYS ?? 14);
const maxActiveLoans = Number(process.env.MAX_ACTIVE_LOANS ?? 5);

function effectiveLoan<T extends Record<string, unknown>>(loan: T): T {
  if (loan.status === "BORROWED" && typeof loan.dueDate === "string" && loan.dueDate < new Date().toISOString()) {
    return { ...loan, status: "OVERDUE" };
  }
  return loan;
}

function transactionConflict(error: unknown): boolean {
  return (error as { name?: string }).name === "TransactionCanceledException";
}

export function createLoansHandler(client: DynamoDBDocumentClient) {
  return async (event: ApiEvent): Promise<APIGatewayProxyResultV2> =>
    handleErrors(event.requestContext.requestId, async () => {
      const route = event.routeKey;

      if (route === "POST /borrow") {
        const identity = identityFrom(event);
        const body = parseBody(event);
        if (typeof body.bookId !== "string" || !body.bookId) {
          throw new ApiError(400, "VALIDATION_ERROR", "bookId is required");
        }
        const book = await client.send(new GetCommand({
          TableName: booksTable,
          Key: { bookId: body.bookId },
          ConsistentRead: true,
        }));
        if (!book.Item) throw new ApiError(404, "BOOK_NOT_FOUND", "Book not found");

        const borrowedAt = new Date();
        const dueDate = new Date(borrowedAt);
        dueDate.setUTCDate(dueDate.getUTCDate() + loanPeriodDays);
        const loan = {
          loanId: randomUUID(),
          userId: identity.userId,
          bookId: body.bookId,
          bookTitle: book.Item.title,
          borrowedAt: borrowedAt.toISOString(),
          dueDate: dueDate.toISOString(),
          status: "BORROWED",
        };
        const activeLoanId = `ACTIVE#${identity.userId}#${body.bookId}`;

        try {
          await client.send(new TransactWriteCommand({
            TransactItems: [
              {
                Update: {
                  TableName: booksTable,
                  Key: { bookId: body.bookId },
                  UpdateExpression: "SET availableCopies = availableCopies - :one, updatedAt = :now",
                  ConditionExpression: "attribute_exists(bookId) AND availableCopies >= :one",
                  ExpressionAttributeValues: { ":one": 1, ":now": borrowedAt.toISOString() },
                },
              },
              {
                Update: {
                  TableName: usersTable,
                  Key: { userId: identity.userId },
                  UpdateExpression: "SET currentLoanCount = currentLoanCount + :one, updatedAt = :now",
                  ConditionExpression: "attribute_exists(userId) AND currentLoanCount < :max",
                  ExpressionAttributeValues: { ":one": 1, ":max": maxActiveLoans, ":now": borrowedAt.toISOString() },
                },
              },
              {
                Put: {
                  TableName: loansTable,
                  Item: { loanId: activeLoanId, entityType: "ACTIVE_LOAN_GUARD" },
                  ConditionExpression: "attribute_not_exists(loanId)",
                },
              },
              {
                Put: {
                  TableName: loansTable,
                  Item: loan,
                  ConditionExpression: "attribute_not_exists(loanId)",
                },
              },
            ],
          }));
        } catch (error) {
          if (transactionConflict(error)) {
            throw new ApiError(409, "BORROW_NOT_ALLOWED", "The book is unavailable, already borrowed, or the member loan limit was reached");
          }
          throw error;
        }
        return response(201, loan);
      }

      if (route === "POST /return") {
        const identity = identityFrom(event);
        const body = parseBody(event);
        if (typeof body.loanId !== "string" || !body.loanId) {
          throw new ApiError(400, "VALIDATION_ERROR", "loanId is required");
        }
        const existing = await client.send(new GetCommand({
          TableName: loansTable,
          Key: { loanId: body.loanId },
          ConsistentRead: true,
        }));
        const loan = existing.Item;
        if (!loan || loan.entityType === "ACTIVE_LOAN_GUARD") {
          throw new ApiError(404, "LOAN_NOT_FOUND", "Loan not found");
        }
        if (loan.userId !== identity.userId && !identity.isAdmin) {
          throw new ApiError(403, "FORBIDDEN", "This loan belongs to another member");
        }
        if (loan.status !== "BORROWED") {
          throw new ApiError(409, "LOAN_ALREADY_RETURNED", "This loan has already been returned");
        }
        const returnedAt = new Date().toISOString();
        try {
          await client.send(new TransactWriteCommand({
            TransactItems: [
              {
                Update: {
                  TableName: loansTable,
                  Key: { loanId: body.loanId },
                  UpdateExpression: "SET #status = :returned, returnedAt = :now",
                  ConditionExpression: "#status = :borrowed",
                  ExpressionAttributeNames: { "#status": "status" },
                  ExpressionAttributeValues: { ":returned": "RETURNED", ":borrowed": "BORROWED", ":now": returnedAt },
                },
              },
              {
                Delete: {
                  TableName: loansTable,
                  Key: { loanId: `ACTIVE#${loan.userId}#${loan.bookId}` },
                  ConditionExpression: "attribute_exists(loanId)",
                },
              },
              {
                Update: {
                  TableName: booksTable,
                  Key: { bookId: loan.bookId },
                  UpdateExpression: "SET availableCopies = availableCopies + :one, updatedAt = :now",
                  ConditionExpression: "availableCopies < totalCopies",
                  ExpressionAttributeValues: { ":one": 1, ":now": returnedAt },
                },
              },
              {
                Update: {
                  TableName: usersTable,
                  Key: { userId: loan.userId },
                  UpdateExpression: "SET currentLoanCount = currentLoanCount - :one, updatedAt = :now",
                  ConditionExpression: "currentLoanCount >= :one",
                  ExpressionAttributeValues: { ":one": 1, ":now": returnedAt },
                },
              },
            ],
          }));
        } catch (error) {
          if (transactionConflict(error)) {
            throw new ApiError(409, "RETURN_CONFLICT", "The loan could not be returned because its state changed");
          }
          throw error;
        }
        return response(200, { ...loan, status: "RETURNED", returnedAt });
      }

      if (route === "GET /my-loans") {
        const identity = identityFrom(event);
        const query = event.queryStringParameters ?? {};
        const result = await client.send(new QueryCommand({
          TableName: loansTable,
          IndexName: "UserLoansIndex",
          KeyConditionExpression: "userId = :userId",
          ExpressionAttributeValues: { ":userId": identity.userId },
          Limit: Math.min(Math.max(Number(query.limit) || 20, 1), 50),
          ExclusiveStartKey: decodeCursor(query.cursor),
          ScanIndexForward: false,
        }));
        return response(200, {
          items: (result.Items ?? []).map(effectiveLoan),
          cursor: encodeCursor(result.LastEvaluatedKey),
        });
      }

      if (route === "GET /all-loans") {
        requireAdmin(event);
        const query = event.queryStringParameters ?? {};
        const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
        const cursor = decodeCursor(query.cursor);
        const status = query.status?.toUpperCase();
        const result = status && ["BORROWED", "RETURNED", "OVERDUE"].includes(status)
          ? await client.send(new QueryCommand({
              TableName: loansTable,
              IndexName: "StatusDueDateIndex",
              KeyConditionExpression: "#status = :status",
              ExpressionAttributeNames: { "#status": "status" },
              ExpressionAttributeValues: { ":status": status === "OVERDUE" ? "BORROWED" : status },
              FilterExpression: status === "OVERDUE" ? "dueDate < :now" : undefined,
              ...(status === "OVERDUE" ? { ExpressionAttributeValues: { ":status": "BORROWED", ":now": new Date().toISOString() } } : {}),
              Limit: limit,
              ExclusiveStartKey: cursor,
            }))
          : await client.send(new ScanCommand({
              TableName: loansTable,
              FilterExpression: "attribute_exists(userId)",
              Limit: limit,
              ExclusiveStartKey: cursor,
            }));
        return response(200, {
          items: (result.Items ?? []).map(effectiveLoan),
          cursor: encodeCursor(result.LastEvaluatedKey),
        });
      }

      throw new ApiError(404, "ROUTE_NOT_FOUND", "Route not found");
    });
}

export const handler = createLoansHandler(documentClient);
