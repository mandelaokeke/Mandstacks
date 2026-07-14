import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const authenticated = Boolean(event.requestContext.authorizer?.jwt?.claims?.sub);

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify({
      status: "ok",
      service: "library-management-api",
      stage: process.env.APP_STAGE ?? "unknown",
      authenticated,
      timestamp: new Date().toISOString(),
    }),
  };
}
