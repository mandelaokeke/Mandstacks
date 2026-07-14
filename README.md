# Mandstacks

Mandstacks is a cloud-native Integrated Library Management System for a small library, school, or university. The project is designed as a production-style portfolio application rather than a CRUD tutorial.

## Architecture

```text
Next.js → AWS Amplify → Amazon Cognito → API Gateway → Lambda → DynamoDB
```

- **Next.js and TypeScript** provide the member and librarian experiences.
- **Amazon Cognito** owns passwords, sign-up, recovery, tokens, and roles.
- **API Gateway and Lambda** expose serverless REST APIs.
- **DynamoDB** stores books, application profiles, and loan records.
- **AWS CDK** defines repeatable development and production environments.
- **CloudWatch and X-Ray** provide logs and request tracing.

The detailed product scope and milestone acceptance criteria live in [docs/PROJECT_VISION.md](docs/PROJECT_VISION.md).

## Current status

Milestones 1–6 are complete. The development AWS stack and frontend are deployed. Members have live catalog, borrowing, returns, due dates, history, and profile workflows. Librarians have live operational metrics, catalog CRUD, member-role management, circulation processing, overdue views, and reports. Automated smoke tests verify Cognito → Lambda → DynamoDB → API Gateway behavior and server-side authorization.

View the current development release at [dev.dp4bdvmab1flk.amplifyapp.com](https://dev.dp4bdvmab1flk.amplifyapp.com).

The request and response contract is documented in [docs/API.md](docs/API.md).

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Populate `.env.local` with the `AwsRegion`, `UserPoolId`, `UserPoolClientId`, and `ApiUrl` outputs from the development infrastructure deployment.

Infrastructure commands are run from `infrastructure/`:

```bash
npm install
npm test
npm run synth -- -c stage=dev
```
