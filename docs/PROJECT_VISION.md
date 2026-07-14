# Project vision

## Product goal

Build a deployable Integrated Library Management System that a small library, school, or university could realistically use. It should demonstrate secure full-stack engineering, serverless AWS architecture, inventory management, transactional borrowing rules, observability, and infrastructure as code.

## Experiences

Members can register, sign in, search and filter the catalog, view book details, borrow and return available copies, see due and overdue items, review borrowing history, and edit their profile.

Librarians receive a role-specific experience where they can manage books and copies, manage users, inspect current and overdue loans, and view operational statistics and recent activity.

## Core domain

- **Book:** title, author, ISBN, category, publisher, description, cover image, total copies, and available copies.
- **User profile:** Cognito subject, name, email, role, and application preferences. Passwords never enter application storage.
- **Loan:** member, book, borrowed time, due date, returned time, and status (`BORROWED`, `RETURNED`, or `OVERDUE`).

Borrowing and returning must use DynamoDB transactions so the loan record and inventory count cannot drift apart under concurrent requests.

## API surface

```text
GET    /books              GET    /books/{id}
POST   /books              PUT    /books/{id}
DELETE /books/{id}

POST   /borrow             POST   /return
GET    /my-loans           GET    /all-loans

GET    /profile            PATCH  /profile
GET    /users
```

Member routes require a valid Cognito JWT. Administrative routes additionally require membership in the `Admins` Cognito group. Authorization is enforced in the API, not only hidden in the interface.

## Milestones and acceptance criteria

1. **Infrastructure** — CDK synthesizes tested development and production stacks containing DynamoDB, Cognito, API Gateway, Lambda, logs, tracing, and safe data-retention policies.
2. **Backend APIs** — versioned handlers validate inputs, return consistent errors, paginate list results, and are covered by unit tests.
3. **Frontend UI** — responsive public, member, and admin page shells are accessible and work against a typed API client.
4. **Authentication** — registration, verification, login, recovery, token refresh, protected navigation, and role-aware routing work end to end.
5. **Borrow and return** — transactional inventory rules prevent duplicate loans, unavailable inventory, and member limit violations.
6. **Admin dashboard** — librarians can manage catalog/users and see current loans, overdue items, statistics, and recent activity.
7. **Deployment and polish** — Amplify deployment, environment configuration, monitoring, seed/demo data, documentation, and an end-to-end smoke test are complete.

Current progress: milestones 1–6 are complete, and both the development AWS stack and Amplify frontend are deployed. Live temporary-user smoke tests verify member and administrator authorization, catalog CRUD, Cognito-backed role promotion/demotion, duplicate-loan prevention, atomic inventory changes, librarian-processed returns, and history. Temporary records are removed afterward. Infrastructure compilation, 17 backend/infrastructure tests, CDK synthesis, frontend type checking, and the static production build pass.

## Engineering standards

- TypeScript strict mode across frontend, infrastructure, and backend.
- Least-privilege IAM permissions and server-side role checks.
- Structured logs with request identifiers; no credentials or tokens in logs.
- Production data is retained and recoverable; development resources are disposable.
- Automated linting, tests, CDK synthesis, and frontend builds gate changes.
- Secrets and account-specific values are supplied through environment configuration, never committed.
