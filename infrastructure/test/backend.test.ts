import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { ApiEvent } from "../functions/common/http";
import { createBooksHandler } from "../functions/books/handler";
import { createLoansHandler } from "../functions/loans/handler";
import { createUsersHandler } from "../functions/users/handler";

function event(
  routeKey: string,
  options: {
    body?: Record<string, unknown>;
    groups?: string[];
    userId?: string;
  } = {},
): ApiEvent {
  return {
    version: "2.0",
    routeKey,
    rawPath: routeKey.split(" ")[1],
    rawQueryString: "",
    headers: {},
    requestContext: {
      accountId: "test",
      apiId: "test",
      domainName: "test",
      domainPrefix: "test",
      http: { method: routeKey.split(" ")[0], path: "/", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "jest" },
      requestId: "request-1",
      routeKey,
      stage: "$default",
      time: "",
      timeEpoch: 0,
      authorizer: {
        jwt: {
          claims: {
            sub: options.userId ?? "user-1",
            email: "reader@example.com",
            name: "Reader",
            "cognito:groups": options.groups ?? [],
          },
          scopes: [],
        },
      },
    },
    isBase64Encoded: false,
    body: options.body ? JSON.stringify(options.body) : undefined,
  } as unknown as ApiEvent;
}

function eventWithSerializedGroups(routeKey: string, groups: string[]): ApiEvent {
  const result = event(routeKey, { groups });
  result.requestContext.authorizer.jwt.claims["cognito:groups"] = JSON.stringify(groups);
  return result;
}

function clientWith(send: jest.Mock): DynamoDBDocumentClient {
  return { send } as unknown as DynamoDBDocumentClient;
}

describe("books API", () => {
  const validBook = {
    title: "Clean Architecture",
    author: "Robert C. Martin",
    isbn: "9780134494166",
    category: "Software Engineering",
    publisher: "Pearson",
    description: "A practical software architecture book.",
    totalCopies: 3,
  };

  test("rejects catalog writes from members", async () => {
    const send = jest.fn();
    const result = await createBooksHandler(clientWith(send))(
      event("POST /books", { body: validBook }),
    );

    expect(result).toMatchObject({ statusCode: 403 });
    expect(send).not.toHaveBeenCalled();
  });

  test("normalizes and creates a valid book for an administrator", async () => {
    const send = jest.fn().mockResolvedValue({});
    const result = await createBooksHandler(clientWith(send))(
      event("POST /books", { body: validBook, groups: ["Admins"] }),
    );

    expect(result).toMatchObject({ statusCode: 201 });
    const command = send.mock.calls[0][0];
    expect(command.input.Item).toMatchObject({
      titleSort: "clean architecture",
      searchAuthor: "robert c. martin",
      totalCopies: 3,
      availableCopies: 3,
    });
  });

  test("validates inventory counts", async () => {
    const send = jest.fn();
    const result = await createBooksHandler(clientWith(send))(
      event("POST /books", {
        body: { ...validBook, totalCopies: 0 },
        groups: ["Admins"],
      }),
    );
    expect(result).toMatchObject({ statusCode: 400 });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("loans API", () => {
  test("borrows with one four-part transaction", async () => {
    const send = jest.fn()
      .mockResolvedValueOnce({ Item: { bookId: "book-1", title: "Dune", availableCopies: 1 } })
      .mockResolvedValueOnce({});
    const result = await createLoansHandler(clientWith(send))(
      event("POST /borrow", { body: { bookId: "book-1" } }),
    );

    expect(result).toMatchObject({ statusCode: 201 });
    expect(send).toHaveBeenCalledTimes(2);
    const transaction = send.mock.calls[1][0];
    expect(transaction.input.TransactItems).toHaveLength(4);
    expect(transaction.input.TransactItems[0].Update.ConditionExpression).toContain("availableCopies");
    expect(transaction.input.TransactItems[2].Put.Item.loanId).toBe("ACTIVE#user-1#book-1");
  });

  test("does not let a member return another member's loan", async () => {
    const send = jest.fn().mockResolvedValueOnce({
      Item: { loanId: "loan-1", userId: "someone-else", bookId: "book-1", status: "BORROWED" },
    });
    const result = await createLoansHandler(clientWith(send))(
      event("POST /return", { body: { loanId: "loan-1" } }),
    );

    expect(result).toMatchObject({ statusCode: 403 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  test("returns a book with one four-part transaction", async () => {
    const send = jest.fn()
      .mockResolvedValueOnce({
        Item: {
          loanId: "loan-1",
          userId: "user-1",
          bookId: "book-1",
          bookTitle: "Dune",
          borrowedAt: "2026-07-01T00:00:00.000Z",
          dueDate: "2026-07-15T00:00:00.000Z",
          status: "BORROWED",
        },
      })
      .mockResolvedValueOnce({});

    const result = await createLoansHandler(clientWith(send))(
      event("POST /return", { body: { loanId: "loan-1" } }),
    );

    expect(result).toMatchObject({ statusCode: 200 });
    const transaction = send.mock.calls[1][0];
    expect(transaction.input.TransactItems).toHaveLength(4);
    expect(transaction.input.TransactItems[0].Update.ExpressionAttributeValues[":returned"]).toBe("RETURNED");
    expect(transaction.input.TransactItems[1].Delete.Key.loanId).toBe("ACTIVE#user-1#book-1");
  });

  test("reports a past-due active loan as overdue", async () => {
    const send = jest.fn().mockResolvedValueOnce({
      Items: [{
        loanId: "loan-1",
        userId: "user-1",
        bookId: "book-1",
        dueDate: "2020-01-01T00:00:00.000Z",
        status: "BORROWED",
      }],
    });

    const result = await createLoansHandler(clientWith(send))(event("GET /my-loans"));
    const body = JSON.parse(String((result as { body: string }).body));

    expect(result).toMatchObject({ statusCode: 200 });
    expect(body.data.items[0].status).toBe("OVERDUE");
  });

  test("returns a stable conflict when a borrowing condition fails", async () => {
    const conflict = Object.assign(new Error("cancelled"), { name: "TransactionCanceledException" });
    const send = jest.fn()
      .mockResolvedValueOnce({ Item: { bookId: "book-1", title: "Dune", availableCopies: 1 } })
      .mockRejectedValueOnce(conflict);
    const result = await createLoansHandler(clientWith(send))(
      event("POST /borrow", { body: { bookId: "book-1" } }),
    );

    expect(result).toMatchObject({ statusCode: 409 });
    expect(JSON.parse(String((result as { body: string }).body)).error.code).toBe("BORROW_NOT_ALLOWED");
  });
});

describe("users API", () => {
  test("accepts the serialized group claim emitted by API Gateway", async () => {
    const send = jest.fn().mockResolvedValueOnce({ Items: [] });

    const result = await createUsersHandler(clientWith(send))(
      eventWithSerializedGroups("GET /users", ["Admins", "Members"]),
    );

    expect(result).toMatchObject({ statusCode: 200 });
  });

  test("accepts a space-delimited group claim", async () => {
    const send = jest.fn().mockResolvedValueOnce({ Items: [] });
    const request = event("GET /users");
    request.requestContext.authorizer.jwt.claims["cognito:groups"] = "Admins Members";

    const result = await createUsersHandler(clientWith(send))(request);

    expect(result).toMatchObject({ statusCode: 200 });
  });

  test("rejects role changes from members", async () => {
    const send = jest.fn();
    const cognito = { send: jest.fn() };
    const request = event("PATCH /users/{id}/role", { body: { role: "ADMIN" } });
    request.pathParameters = { id: "member-2" };

    const result = await createUsersHandler(clientWith(send), cognito)(request);

    expect(result).toMatchObject({ statusCode: 403 });
    expect(send).not.toHaveBeenCalled();
    expect(cognito.send).not.toHaveBeenCalled();
  });

  test("promotes a member in Cognito and their application profile", async () => {
    const send = jest.fn()
      .mockResolvedValueOnce({ Item: { userId: "member-2", email: "member@example.com", role: "MEMBER" } })
      .mockResolvedValueOnce({ Attributes: { userId: "member-2", email: "member@example.com", role: "ADMIN" } });
    const cognito = { send: jest.fn().mockResolvedValue({}) };
    const request = event("PATCH /users/{id}/role", { body: { role: "ADMIN" }, groups: ["Admins"] });
    request.pathParameters = { id: "member-2" };

    const result = await createUsersHandler(clientWith(send), cognito)(request);

    expect(result).toMatchObject({ statusCode: 200 });
    expect(cognito.send.mock.calls[0][0].input).toMatchObject({
      Username: "member@example.com",
      GroupName: "Admins",
    });
    expect(send.mock.calls[1][0].input.ExpressionAttributeValues[":role"]).toBe("ADMIN");
  });
});
