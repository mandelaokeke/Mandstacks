#!/usr/bin/env node

import * as cdk from "aws-cdk-lib";
import { InfrastructureStack } from "../lib/infrastructure-stack";

const app = new cdk.App();
const stage = app.node.tryGetContext("stage") ?? "dev";
const frontendUrls = app.node.tryGetContext("frontendUrls") as Record<string, string> | undefined;
const frontendUrl = app.node.tryGetContext("frontendUrl") ?? frontendUrls?.[stage];

new InfrastructureStack(app, `LibraryManagementStack-${stage}`, {
  stage,
  frontendUrl,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
  description: `Library Management System infrastructure (${stage})`,
});
