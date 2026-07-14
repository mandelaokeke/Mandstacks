import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";

export type ApiEvent = APIGatewayProxyEventV2WithJWTAuthorizer;

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface Identity {
  userId: string;
  email?: string;
  name?: string;
  groups: string[];
  isAdmin: boolean;
}

export function identityFrom(event: ApiEvent): Identity {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  const userId = claims?.sub;
  if (typeof userId !== "string" || !userId) {
    throw new ApiError(401, "UNAUTHENTICATED", "A valid access token is required");
  }

  const rawGroups = claims["cognito:groups"];
  let groups: string[] = [];
  if (Array.isArray(rawGroups)) {
    groups = rawGroups.map(String);
  } else if (typeof rawGroups === "string") {
    // API Gateway can serialize an array claim as JSON, bracketed comma-separated
    // text, or space-delimited text. Cognito group names in this application use
    // identifier-safe characters, so tokenizing avoids depending on one encoding.
    groups = rawGroups.match(/[A-Za-z0-9:_-]+/g) ?? [];
  }

  return {
    userId,
    email: typeof claims.email === "string" ? claims.email : undefined,
    name: typeof claims.name === "string" ? claims.name : undefined,
    groups,
    isAdmin: groups.includes("Admins"),
  };
}

export function requireAdmin(event: ApiEvent): Identity {
  const identity = identityFrom(event);
  if (!identity.isAdmin) {
    throw new ApiError(403, "FORBIDDEN", "Administrator access is required");
  }
  return identity;
}

export function parseBody(event: ApiEvent): Record<string, unknown> {
  if (!event.body) {
    throw new ApiError(400, "INVALID_BODY", "A JSON request body is required");
  }
  try {
    const parsed = JSON.parse(event.body) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Body is not an object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "INVALID_BODY", "The request body must be a JSON object");
  }
}

export function response(statusCode: number, data: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify({ data }),
  };
}

export async function handleErrors(
  requestId: string,
  operation: () => Promise<APIGatewayProxyResultV2>,
): Promise<APIGatewayProxyResultV2> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        statusCode: error.statusCode,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
        body: JSON.stringify({
          error: { code: error.code, message: error.message, details: error.details },
          requestId,
        }),
      };
    }

    console.error(JSON.stringify({ level: "error", requestId, error }));
    return {
      statusCode: 500,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
      body: JSON.stringify({
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
        requestId,
      }),
    };
  }
}

export function requiredString(
  body: Record<string, unknown>,
  field: string,
  maxLength: number,
): string {
  const value = body[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} must be ${maxLength} characters or fewer`);
  }
  return trimmed;
}

export function decodeCursor(value?: string): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "INVALID_CURSOR", "The pagination cursor is invalid");
  }
}

export function encodeCursor(value?: Record<string, unknown>): string | undefined {
  return value
    ? Buffer.from(JSON.stringify(value), "utf8").toString("base64url")
    : undefined;
}
