import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";

export interface InfrastructureStackProps extends cdk.StackProps {
  stage: string;
  frontendUrl?: string;
}

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: InfrastructureStackProps) {
    super(scope, id, props);

    const { stage } = props;
    const isProduction = stage === "prod";
    const removalPolicy = isProduction
      ? cdk.RemovalPolicy.RETAIN
      : cdk.RemovalPolicy.DESTROY;

    cdk.Tags.of(this).add("Application", "library-management-system");
    cdk.Tags.of(this).add("Environment", stage);
    cdk.Tags.of(this).add("ManagedBy", "AWS-CDK");

    const tableDefaults = {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: isProduction,
      },
      removalPolicy,
    };

    const booksTable = new dynamodb.Table(this, "BooksTable", {
      ...tableDefaults,
      partitionKey: {
        name: "bookId",
        type: dynamodb.AttributeType.STRING,
      },
    });

    booksTable.addGlobalSecondaryIndex({
      indexName: "CategoryTitleIndex",
      partitionKey: {
        name: "category",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "titleSort",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const loansTable = new dynamodb.Table(this, "LoansTable", {
      ...tableDefaults,
      partitionKey: {
        name: "loanId",
        type: dynamodb.AttributeType.STRING,
      },
    });

    loansTable.addGlobalSecondaryIndex({
      indexName: "UserLoansIndex",
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "borrowedAt",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    loansTable.addGlobalSecondaryIndex({
      indexName: "BookLoansIndex",
      partitionKey: {
        name: "bookId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "borrowedAt",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    loansTable.addGlobalSecondaryIndex({
      indexName: "StatusDueDateIndex",
      partitionKey: {
        name: "status",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "dueDate",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const usersTable = new dynamodb.Table(this, "UsersTable", {
      ...tableDefaults,
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
    });

    const ebooksBucket = new s3.Bucket(this, "EbooksBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: isProduction,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET],
        allowedOrigins: props.frontendUrl
          ? [props.frontendUrl]
          : ["http://localhost:3000"],
        allowedHeaders: ["*"],
        maxAge: 300,
      }],
    });

    const userPool = new cognito.UserPool(this, "LibraryUserPool", {
      userPoolName: `library-management-users-${stage}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy,
    });

    const userPoolClient = userPool.addClient("LibraryWebClient", {
      userPoolClientName: `library-management-web-client-${stage}`,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    new cognito.CfnUserPoolGroup(this, "MembersGroup", {
      groupName: "Members",
      description: "Standard library members",
      userPoolId: userPool.userPoolId,
      precedence: 2,
    });

    new cognito.CfnUserPoolGroup(this, "AdminsGroup", {
      groupName: "Admins",
      description: "Library administrators",
      userPoolId: userPool.userPoolId,
      precedence: 1,
    });

    const healthFunction = new lambdaNodejs.NodejsFunction(
      this,
      "HealthFunction",
      {
        entry: path.join(__dirname, "../functions/system/handler.ts"),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        timeout: cdk.Duration.seconds(5),
        tracing: lambda.Tracing.ACTIVE,
        environment: {
          APP_STAGE: stage,
        },
        logGroup: new logs.LogGroup(this, "HealthFunctionLogs", {
          retention: isProduction
            ? logs.RetentionDays.THREE_MONTHS
            : logs.RetentionDays.ONE_WEEK,
          removalPolicy,
        }),
        bundling: {
          minify: true,
          sourceMap: true,
        },
      },
    );

    const createApiFunction = (
      id: string,
      entry: string,
      environment: Record<string, string>,
    ) => new lambdaNodejs.NodejsFunction(this, id, {
      entry: path.join(__dirname, `../functions/${entry}`),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: cdk.Duration.seconds(15),
      tracing: lambda.Tracing.ACTIVE,
      environment,
      logGroup: new logs.LogGroup(this, `${id}Logs`, {
        retention: isProduction
          ? logs.RetentionDays.THREE_MONTHS
          : logs.RetentionDays.ONE_WEEK,
        removalPolicy,
      }),
      bundling: { minify: true, sourceMap: true },
    });

    const booksFunction = createApiFunction("BooksFunction", "books/handler.ts", {
      BOOKS_TABLE_NAME: booksTable.tableName,
      EBOOKS_BUCKET_NAME: ebooksBucket.bucketName,
    });
    const usersFunction = createApiFunction("UsersFunction", "users/handler.ts", {
      USERS_TABLE_NAME: usersTable.tableName,
      USER_POOL_ID: userPool.userPoolId,
    });
    const loansFunction = createApiFunction("LoansFunction", "loans/handler.ts", {
      BOOKS_TABLE_NAME: booksTable.tableName,
      LOANS_TABLE_NAME: loansTable.tableName,
      USERS_TABLE_NAME: usersTable.tableName,
      LOAN_PERIOD_DAYS: "14",
      MAX_ACTIVE_LOANS: "5",
    });
    const postConfirmationFunction = createApiFunction(
      "PostConfirmationFunction",
      "users/post-confirmation.ts",
      { USERS_TABLE_NAME: usersTable.tableName },
    );

    booksTable.grantReadWriteData(booksFunction);
    ebooksBucket.grantRead(booksFunction);
    usersTable.grantReadWriteData(usersFunction);
    usersFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        "cognito-idp:AdminAddUserToGroup",
        "cognito-idp:AdminRemoveUserFromGroup",
      ],
      resources: [this.formatArn({
        service: "cognito-idp",
        resource: "userpool",
        resourceName: "*",
      })],
    }));
    booksTable.grantReadWriteData(loansFunction);
    loansTable.grantReadWriteData(loansFunction);
    usersTable.grantReadWriteData(loansFunction);
    usersTable.grantWriteData(postConfirmationFunction);
    // Referencing this pool's generated ARN here creates a CloudFormation cycle:
    // pool -> trigger -> role policy -> pool. Scope the wildcard to user pools in
    // this account and region while retaining the single required action.
    postConfirmationFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ["cognito-idp:AdminAddUserToGroup"],
      resources: [this.formatArn({
        service: "cognito-idp",
        resource: "userpool",
        resourceName: "*",
      })],
    }));
    userPool.addTrigger(
      cognito.UserPoolOperation.POST_CONFIRMATION,
      postConfirmationFunction,
    );

    const api = new apigwv2.HttpApi(this, "LibraryApi", {
      apiName: `library-management-api-${stage}`,
      description: "REST API for the Library Management System",
      corsPreflight: {
        allowHeaders: ["Authorization", "Content-Type"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: props.frontendUrl
          ? [props.frontendUrl]
          : ["http://localhost:3000"],
        maxAge: cdk.Duration.days(1),
      },
    });

    api.addRoutes({
      path: "/health",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        "HealthIntegration",
        healthFunction,
      ),
    });

    // Created now so every application route can share one Cognito JWT policy.
    const jwtAuthorizer = new authorizers.HttpJwtAuthorizer(
      "CognitoAuthorizer",
      userPool.userPoolProviderUrl,
      {
        jwtAudience: [userPoolClient.userPoolClientId],
      },
    );

    api.addRoutes({
      path: "/auth-check",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        "AuthCheckIntegration",
        healthFunction,
      ),
      authorizer: jwtAuthorizer,
    });

    const booksIntegration = new integrations.HttpLambdaIntegration(
      "BooksIntegration",
      booksFunction,
    );
    api.addRoutes({
      path: "/books",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: booksIntegration,
      authorizer: jwtAuthorizer,
    });
    api.addRoutes({
      path: "/books/{id}",
      methods: [
        apigwv2.HttpMethod.GET,
        apigwv2.HttpMethod.PUT,
        apigwv2.HttpMethod.DELETE,
      ],
      integration: booksIntegration,
      authorizer: jwtAuthorizer,
    });
    api.addRoutes({
      path: "/books/{id}/content",
      methods: [apigwv2.HttpMethod.GET],
      integration: booksIntegration,
      authorizer: jwtAuthorizer,
    });

    const usersIntegration = new integrations.HttpLambdaIntegration(
      "UsersIntegration",
      usersFunction,
    );
    api.addRoutes({
      path: "/profile",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PATCH],
      integration: usersIntegration,
      authorizer: jwtAuthorizer,
    });
    api.addRoutes({
      path: "/users",
      methods: [apigwv2.HttpMethod.GET],
      integration: usersIntegration,
      authorizer: jwtAuthorizer,
    });
    api.addRoutes({
      path: "/users/{id}/role",
      methods: [apigwv2.HttpMethod.PATCH],
      integration: usersIntegration,
      authorizer: jwtAuthorizer,
    });

    const loansIntegration = new integrations.HttpLambdaIntegration(
      "LoansIntegration",
      loansFunction,
    );
    for (const pathName of ["/borrow", "/return"]) {
      api.addRoutes({
        path: pathName,
        methods: [apigwv2.HttpMethod.POST],
        integration: loansIntegration,
        authorizer: jwtAuthorizer,
      });
    }
    for (const pathName of ["/my-loans", "/all-loans"]) {
      api.addRoutes({
        path: pathName,
        methods: [apigwv2.HttpMethod.GET],
        integration: loansIntegration,
        authorizer: jwtAuthorizer,
      });
    }

    const outputs: Record<string, string> = {
      ApiUrl: api.apiEndpoint,
      BooksTableName: booksTable.tableName,
      EbooksBucketName: ebooksBucket.bucketName,
      LoansTableName: loansTable.tableName,
      UsersTableName: usersTable.tableName,
      UserPoolId: userPool.userPoolId,
      UserPoolClientId: userPoolClient.userPoolClientId,
      AwsRegion: this.region,
      Stage: stage,
    };

    for (const [name, value] of Object.entries(outputs)) {
      new cdk.CfnOutput(this, name, { value });
    }
  }
}
