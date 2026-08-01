# REST API contract

All application endpoints require a Cognito JWT in `Authorization: Bearer <token>`. The health endpoint is public. Administrative operations also verify the `Admins` Cognito group inside the Lambda handler.

Successful JSON responses use `{ "data": ... }`. Errors use:

```json
{
  "error": { "code": "VALIDATION_ERROR", "message": "..." },
  "requestId": "..."
}
```

List endpoints accept `limit` (1–50) and an opaque `cursor` returned by the previous page.

## System

- `GET /health` — service health; public.
- `GET /auth-check` — verifies that API Gateway accepted the JWT.

## Books

- `GET /books` — paginated catalog. Optional `search`, `category`, and `availableOnly=true` parameters.
- `GET /books/{id}` — one catalog record.
- `GET /books/{id}/content` — returns a five-minute signed reading URL when a public-domain digital edition is available.
- `POST /books` — admin only. Creates a book.
- `PUT /books/{id}` — admin only. Replaces editable book fields while preserving the number of copies currently on loan.
- `DELETE /books/{id}` — admin only. Rejected while any copy is on loan.

Create and update body:

```json
{
  "title": "Dune",
  "author": "Frank Herbert",
  "isbn": "9780441172719",
  "category": "Science Fiction",
  "publisher": "Ace",
  "description": "A science-fiction novel.",
  "coverImage": "https://example.com/dune.jpg",
  "totalCopies": 4
}
```

## Profiles and users

- `GET /profile` — current profile. Safely provisions a missing profile from verified token claims.
- `PATCH /profile` — updates the current member's display name with `{ "name": "..." }`.
- `GET /users` — admin-only paginated user list.
- `PATCH /users/{id}/role` — admin only. Promotes or demotes a profile with `{ "role": "ADMIN|MEMBER" }` and synchronizes its Cognito group. Administrators cannot demote themselves.

Cognito's post-confirmation trigger normally provisions profiles. It is retry-safe and never stores a password. New accounts are members by default; administrators are promoted deliberately by adding them to the `Admins` Cognito group.

## Loans

- `POST /borrow` with `{ "bookId": "..." }` — borrows an available copy for 14 days.
- `POST /return` with `{ "loanId": "..." }` — returns the current member's loan; admins may process any return.
- `GET /my-loans` — the current member's paginated history.
- `GET /all-loans` — admin-only paginated loan list. Optional `status=BORROWED|RETURNED|OVERDUE`.

Borrow and return operations are transactional. A borrow atomically checks/decrements availability, checks/increments the five-loan member limit, creates the historical loan, and creates an active-loan uniqueness guard. A return atomically updates the loan, removes that guard, restores inventory, and decrements the member counter.

Overdue state is derived from a `BORROWED` loan whose due date is in the past, so it is accurate without relying on a scheduled job. It is returned to clients as `OVERDUE` and can be queried through `GET /all-loans?status=OVERDUE`.
