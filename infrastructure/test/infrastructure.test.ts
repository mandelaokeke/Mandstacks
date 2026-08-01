import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { InfrastructureStack } from "../lib/infrastructure-stack";

function createTemplate(stage = "dev"): Template {
  const app = new cdk.App();
  const stack = new InfrastructureStack(app, `TestStack-${stage}`, { stage });
  return Template.fromStack(stack);
}

describe("Library infrastructure", () => {
  test("creates the three encrypted, on-demand DynamoDB tables", () => {
    const template = createTemplate();

    template.resourceCountIs("AWS::DynamoDB::Table", 3);
    template.allResourcesProperties("AWS::DynamoDB::Table", {
      BillingMode: "PAY_PER_REQUEST",
      SSESpecification: { SSEEnabled: true },
    });
  });

  test("creates indexes needed for catalog and loan queries", () => {
    const template = createTemplate();

    template.hasResourceProperties("AWS::DynamoDB::Table", {
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({ IndexName: "CategoryTitleIndex" }),
      ]),
    });
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({ IndexName: "UserLoansIndex" }),
        Match.objectLike({ IndexName: "BookLoansIndex" }),
        Match.objectLike({ IndexName: "StatusDueDateIndex" }),
      ]),
    });
  });

  test("creates Cognito registration, roles, and a secretless web client", () => {
    const template = createTemplate();

    template.hasResourceProperties("AWS::Cognito::UserPool", {
      AutoVerifiedAttributes: ["email"],
      UsernameAttributes: ["email"],
    });
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      GenerateSecret: false,
      PreventUserExistenceErrors: "ENABLED",
    });
    template.resourceCountIs("AWS::Cognito::UserPoolGroup", 2);
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "cognito-idp:AdminAddUserToGroup",
            Effect: "Allow",
          }),
        ]),
      },
    });
  });

  test("exposes a public health route and a JWT-protected route", () => {
    const template = createTemplate();

    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /health",
      AuthorizationType: "NONE",
    });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /auth-check",
      AuthorizationType: "JWT",
    });
    template.resourceCountIs("AWS::ApiGatewayV2::Route", 16);
    template.resourceCountIs("AWS::Lambda::Function", 5);
    for (const routeKey of [
      "GET /books",
      "POST /books",
      "GET /books/{id}",
      "GET /books/{id}/content",
      "PUT /books/{id}",
      "DELETE /books/{id}",
      "GET /profile",
      "PATCH /profile",
      "GET /users",
      "PATCH /users/{id}/role",
      "POST /borrow",
      "POST /return",
      "GET /my-loans",
      "GET /all-loans",
    ]) {
      template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
        RouteKey: routeKey,
        AuthorizationType: "JWT",
      });
    }
  });

  test("stores readable books privately and grants the books API read access", () => {
    const template = createTemplate();

    template.resourceCountIs("AWS::S3::Bucket", 1);
    template.hasResourceProperties("AWS::S3::Bucket", {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: Match.anyValue(),
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: Match.objectLike({ EBOOKS_BUCKET_NAME: Match.anyValue() }),
      },
    });
  });

  test("retains production data and enables point-in-time recovery", () => {
    const template = createTemplate("prod");

    template.allResourcesProperties("AWS::DynamoDB::Table", {
      PointInTimeRecoverySpecification: {
        PointInTimeRecoveryEnabled: true,
      },
    });
    template.allResources("AWS::DynamoDB::Table", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
    });
  });
});
