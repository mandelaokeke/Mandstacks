import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
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

const tableName = process.env.USERS_TABLE_NAME ?? "";
const userPoolId = process.env.USER_POOL_ID ?? "";
const cognitoClient = new CognitoIdentityProviderClient({});

interface CognitoClient {
  send(command: AdminAddUserToGroupCommand | AdminRemoveUserFromGroupCommand): Promise<unknown>;
}

export function createUsersHandler(client: DynamoDBDocumentClient, cognito: CognitoClient = cognitoClient) {
  return async (event: ApiEvent): Promise<APIGatewayProxyResultV2> =>
    handleErrors(event.requestContext.requestId, async () => {
      const route = event.routeKey;

      if (route === "GET /profile") {
        const identity = identityFrom(event);
        const result = await client.send(new GetCommand({
          TableName: tableName,
          Key: { userId: identity.userId },
          ConsistentRead: true,
        }));
        if (result.Item) return response(200, result.Item);

        const now = new Date().toISOString();
        const profile = {
          userId: identity.userId,
          name: identity.name ?? "Library member",
          email: identity.email ?? "",
          role: identity.isAdmin ? "ADMIN" : "MEMBER",
          currentLoanCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        await client.send(new PutCommand({
          TableName: tableName,
          Item: profile,
          ConditionExpression: "attribute_not_exists(userId)",
        }));
        return response(200, profile);
      }

      if (route === "PATCH /profile") {
        const identity = identityFrom(event);
        const body = parseBody(event);
        const name = body.name;
        if (typeof name !== "string" || !name.trim() || name.trim().length > 120) {
          throw new ApiError(400, "VALIDATION_ERROR", "name must be between 1 and 120 characters");
        }
        const result = await client.send(new UpdateCommand({
          TableName: tableName,
          Key: { userId: identity.userId },
          UpdateExpression: "SET #name = :name, updatedAt = :updatedAt",
          ConditionExpression: "attribute_exists(userId)",
          ExpressionAttributeNames: { "#name": "name" },
          ExpressionAttributeValues: {
            ":name": name.trim(),
            ":updatedAt": new Date().toISOString(),
          },
          ReturnValues: "ALL_NEW",
        }));
        return response(200, result.Attributes);
      }

      if (route === "GET /users") {
        requireAdmin(event);
        const query = event.queryStringParameters ?? {};
        const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);
        const result = await client.send(new ScanCommand({
          TableName: tableName,
          Limit: limit,
          ExclusiveStartKey: decodeCursor(query.cursor),
        }));
        return response(200, {
          items: result.Items ?? [],
          cursor: encodeCursor(result.LastEvaluatedKey),
        });
      }

      if (route === "PATCH /users/{id}/role") {
        const identity = requireAdmin(event);
        const userId = event.pathParameters?.id;
        const body = parseBody(event);
        const role = typeof body.role === "string" ? body.role.toUpperCase() : "";
        if (!userId || !["MEMBER", "ADMIN"].includes(role)) {
          throw new ApiError(400, "VALIDATION_ERROR", "A user id and role of MEMBER or ADMIN are required");
        }
        if (userId === identity.userId && role !== "ADMIN") {
          throw new ApiError(409, "SELF_DEMOTION", "Administrators cannot remove their own access");
        }
        const existing = await client.send(new GetCommand({
          TableName: tableName,
          Key: { userId },
          ConsistentRead: true,
        }));
        const profile = existing.Item;
        if (!profile || typeof profile.email !== "string" || !profile.email) {
          throw new ApiError(404, "USER_NOT_FOUND", "User profile not found");
        }

        if (role === "ADMIN") {
          await cognito.send(new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: profile.email, GroupName: "Admins" }));
        } else {
          await cognito.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: userPoolId, Username: profile.email, GroupName: "Admins" }));
          await cognito.send(new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: profile.email, GroupName: "Members" }));
        }

        const result = await client.send(new UpdateCommand({
          TableName: tableName,
          Key: { userId },
          UpdateExpression: "SET #role = :role, updatedAt = :updatedAt",
          ExpressionAttributeNames: { "#role": "role" },
          ExpressionAttributeValues: { ":role": role, ":updatedAt": new Date().toISOString() },
          ReturnValues: "ALL_NEW",
        }));
        return response(200, result.Attributes);
      }

      throw new ApiError(404, "ROUTE_NOT_FOUND", "Route not found");
    });
}

export const handler = createUsersHandler(documentClient);
