# AWS infrastructure

AWS CDK provisions one independently named stack per stage.

## Resources

- DynamoDB tables for books, loans, and profiles, with indexes for category browsing, member/book loan history, and status/due-date reporting.
- A private, encrypted S3 bucket for readable public-domain editions, delivered through short-lived signed URLs.
- Cognito user pool, secretless browser client, and `Members`/`Admins` groups. A post-confirmation Lambda creates the application profile and assigns new accounts to `Members`.
- API Gateway HTTP API with CORS, a public health check, and Cognito JWT-protected catalog, member, and administrator routes.
- ARM64 Node.js Lambdas for health, books, users, loans, and post-confirmation workflows, with X-Ray tracing and explicitly managed CloudWatch log groups.

Production enables DynamoDB point-in-time recovery and retains tables, users, and logs if the stack is deleted. Development resources are disposable and use shorter log retention.

## Verify

```bash
npm install
npm run build
npm test -- --runInBand
npm run synth -- -c stage=dev
```

## Deploy

Prerequisites are an AWS account, configured AWS credentials, and a CDK-bootstrapped account/region.

```bash
npx cdk bootstrap
npm run deploy:dev
```

To permit a hosted frontend instead of localhost, pass its exact origin:

```bash
npx cdk deploy -c stage=dev -c frontendUrl=https://example.amplifyapp.com
```

Deploy production deliberately with `npm run deploy:prod`. Copy the deployment outputs into the frontend environment:

```text
AwsRegion       → NEXT_PUBLIC_AWS_REGION
UserPoolId      → NEXT_PUBLIC_COGNITO_USER_POOL_ID
UserPoolClientId → NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID
ApiUrl          → NEXT_PUBLIC_API_URL
```

Seed the development catalog after deployment. The command only creates missing books and never resets live inventory:

```bash
BOOKS_TABLE_NAME=<BooksTableName output> npm run seed:books
```

### Import a larger catalog

Mandstacks can collect a balanced catalog from the Open Library Search API. The importer requests records in small batches, requires a cover and ISBN, removes duplicates, and never overwrites an existing title or its inventory.

Preview up to 150 records without changing AWS:

```bash
npm run import:books -- --limit=150
```

After reviewing the preview, import the records into the deployed development table:

```bash
BOOKS_TABLE_NAME=<BooksTableName output> npm run import:books -- --limit=150 --write
```

After deployment, attach the curated Project Gutenberg text editions to matching catalog records. This importer is a dry run unless `--write` is included and can be safely rerun:

```bash
BOOKS_TABLE_NAME=<BooksTableName output> EBOOKS_BUCKET_NAME=<EbooksBucketName output> npm run import:ebooks
BOOKS_TABLE_NAME=<BooksTableName output> EBOOKS_BUCKET_NAME=<EbooksBucketName output> npm run import:ebooks -- --write
```

The optional limit must be between 1 and 500. Imported records retain their Open Library source URL and use remotely hosted cover artwork. This workflow imports catalog metadata only; it does not copy or redistribute ebook files.
