import {
  AdminAddUserToGroupCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { PostConfirmationTriggerHandler } from "aws-lambda";
import { documentClient } from "../common/dynamo";

const tableName = process.env.USERS_TABLE_NAME ?? "";
const cognitoClient = new CognitoIdentityProviderClient({});

export const handler: PostConfirmationTriggerHandler = async (event) => {
  const now = new Date().toISOString();

  if (event.triggerSource === "PostConfirmation_ConfirmSignUp") {
    await cognitoClient.send(new AdminAddUserToGroupCommand({
      GroupName: "Members",
      UserPoolId: event.userPoolId,
      Username: event.userName,
    }));
  }

  await documentClient.send(new UpdateCommand({
    TableName: tableName,
    Key: { userId: event.request.userAttributes.sub },
    UpdateExpression: [
      "SET #name = if_not_exists(#name, :name)",
      "email = if_not_exists(email, :email)",
      "#role = if_not_exists(#role, :role)",
      "currentLoanCount = if_not_exists(currentLoanCount, :zero)",
      "createdAt = if_not_exists(createdAt, :now)",
      "updatedAt = if_not_exists(updatedAt, :now)",
    ].join(", "),
    ExpressionAttributeNames: {
      "#name": "name",
      "#role": "role",
    },
    ExpressionAttributeValues: {
      ":name": event.request.userAttributes.name ?? "Library member",
      ":email": event.request.userAttributes.email ?? "",
      ":role": "MEMBER",
      ":zero": 0,
      ":now": now,
    },
  }));
  return event;
};
