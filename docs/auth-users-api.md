# Auth & Users API

Owner: Auth & Users Lead
Base URL: `http://localhost:3000/api/v1`

## How authentication works

1. The client calls `POST /auth/login` (or `/auth/register`) with the `x-api-key` header.
2. The API checks the password against the bcrypt hash and returns a **JWT** (valid for `JWT_EXPIRES_IN`, default 1 hour).
3. The client sends `Authorization: Bearer <token>` on every protected request.
4. `authenticate` verifies the token **and** re-reads the user from the database, so a deactivated account loses access immediately.
5. `authorize(...roles)` allows the request only for the listed roles (RBAC).

| Header | Used for |
|---|---|
| `x-api-key: <API_KEY>` | Public endpoints: register, login, and public GET endpoints (events, venues, ...) |
| `Authorization: Bearer <JWT>` | Every endpoint that needs a logged-in user |

### Roles

| Role | Can do (Auth & Users module) |
|---|---|
| `admin` | Everything: list, create, update (incl. role/status) and delete users |
| `organiser`, `staff`, `customer` | View and update **their own** profile, change their own password |

### Middleware (`backend/src/middleware/auth.js`)

| Export | Purpose |
|---|---|
| `authenticate` | Requires a valid JWT; sets `req.user = { id, role }` |
| `optionalAuthenticate` | Sets `req.user` if a valid JWT is sent, otherwise `null` (never blocks) |
| `authorize(...roles)` | 403 unless `req.user.role` is one of `roles` |
| `authorizeSelfOrAdmin()` | Admin, or the user whose id is `:id` |
| `requireApiKey` | 401 unless `x-api-key` matches `API_KEY` (constant-time compare) |

### Security measures

- Passwords hashed with **bcrypt** (cost 10); the hash is never returned by any endpoint.
- Strong password rule: 8-64 chars with uppercase, lowercase, number and symbol.
- Login returns the same `401 INVALID_CREDENTIALS` for an unknown email and for a wrong password, and compares against a dummy hash for unknown emails, so attackers cannot discover which emails are registered.
- Public registration always creates a `customer`; sending `role` or `status` is rejected (prevents privilege escalation).
- Only admins can change `role`/`status`. An admin cannot demote, deactivate or delete themselves, and the last active admin cannot be deleted.
- Users who own events or have bookings cannot be deleted (protects history; DB uses `ON DELETE RESTRICT`). They are deactivated instead.

## Response format

Success:
```json
{ "success": true, "message": "...", "data": { }, "meta": { } }
```
Error:
```json
{ "success": false, "message": "...", "error": { "code": "VALIDATION_ERROR", "details": [ { "field": "email", "message": "email must be a valid email address" } ] } }
```

---

## Endpoints summary

| # | Method | URL | Auth | Purpose |
|---|---|---|---|---|
| 1 | POST | `/auth/register` | API key | Register a customer account |
| 2 | POST | `/auth/login` | API key | Log in, receive JWT |
| 3 | GET | `/auth/me` | JWT (any role) | Current user's profile |
| 4 | PUT | `/auth/password` | JWT (any role) | Change own password |
| 5 | GET | `/users` | JWT (admin) | List users (pagination, filter, search, sort) |
| 6 | GET | `/users/:id` | JWT (admin or self) | Get one user |
| 7 | POST | `/users` | JWT (admin) | Create a user with any role |
| 8 | PUT | `/users/:id` | JWT (admin or self) | Update a user |
| 9 | DELETE | `/users/:id` | JWT (admin) | Delete a user |

---

### 1. POST `/auth/register`

Creates a **customer** account and logs the user in.

Headers: `x-api-key`, `Content-Type: application/json`

Request body:

| Field | Type | Required | Rule |
|---|---|---|---|
| full_name | string | yes | 2-100 chars |
| email | string | yes | valid email, max 150, unique |
| password | string | yes | 8-64, upper + lower + number + symbol |
| phone | string | no | Malaysian mobile, e.g. `0123456789` |

```json
{ "full_name": "Aiman Hakim", "email": "aiman@eventbook.test", "password": "Aiman@2026", "phone": "0123456789" }
```

Response `201 Created`:
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": "1h",
    "user": { "id": 8, "full_name": "Aiman Hakim", "email": "aiman@eventbook.test", "phone": "0123456789",
              "role": "customer", "status": "active", "created_at": "...", "updated_at": "..." }
  }
}
```

| Status | When |
|---|---|
| 201 | Registered |
| 401 | Missing/invalid API key |
| 409 | Email already registered |
| 422 | Validation failed, or body contains `role`/`status` |

### 2. POST `/auth/login`

Headers: `x-api-key`

```json
{ "email": "admin@eventbook.test", "password": "Admin@123" }
```

Response `200 OK`: same shape as register (`data.token`, `data.user`), message `"Login successful"`.

| Status | Code | When |
|---|---|---|
| 200 | | Logged in |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 401 | `UNAUTHORIZED` | Missing/invalid API key |
| 403 | `ACCOUNT_INACTIVE` | Account deactivated by admin |
| 422 | `VALIDATION_ERROR` | Missing/invalid email or password |

### 3. GET `/auth/me`

Headers: `Authorization: Bearer <token>`

Response `200 OK`:
```json
{ "success": true, "message": "Profile retrieved successfully",
  "data": { "id": 5, "full_name": "Kimi Antoneli", "email": "kimi@eventbook.test", "phone": "0123000005",
            "role": "customer", "status": "active", "created_at": "...", "updated_at": "..." } }
```

| Status | Code | When |
|---|---|---|
| 200 | | OK |
| 401 | `UNAUTHORIZED` / `TOKEN_EXPIRED` | No token, invalid token, or expired token |
| 403 | `ACCOUNT_INACTIVE` | Account was deactivated after login |

### 4. PUT `/auth/password`

Headers: `Authorization: Bearer <token>`

```json
{ "current_password": "Aiman@2026", "new_password": "Aiman@2027" }
```

Response `200 OK`: `{ "success": true, "message": "Password changed successfully", "data": null }`

| Status | Code | When |
|---|---|---|
| 200 | | Changed |
| 400 | `WRONG_PASSWORD` | `current_password` is wrong |
| 401 | | Not logged in |
| 422 | `VALIDATION_ERROR` | Weak new password, or same as current |

### 5. GET `/users` (admin)

Query parameters (all optional):

| Param | Example | Meaning |
|---|---|---|
| page | `1` | Page number (default 1) |
| limit | `10` | Rows per page, 1-50 (default 10) |
| search | `kimi` | Matches name, email or phone |
| role | `customer` | `admin`, `organiser`, `staff`, `customer` |
| status | `active` | `active`, `inactive` |
| sort | `full_name` | `id`, `full_name`, `email`, `role`, `status`, `created_at` |
| order | `desc` | `asc` (default) or `desc` |

Example: `GET /users?role=customer&search=eventbook&sort=full_name&order=desc&page=1&limit=5`

Response `200 OK`:
```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": [
    { "id": 5, "full_name": "Kimi Antoneli", "email": "kimi@eventbook.test", "phone": "0123000005",
      "role": "customer", "status": "active", "created_at": "...", "updated_at": "..." }
  ],
  "meta": { "page": 1, "limit": 5, "total": 3, "total_pages": 1 }
}
```

| Status | When |
|---|---|
| 200 | OK |
| 401 | Not logged in |
| 403 | Not an admin |
| 422 | Invalid query value (e.g. `sort=password_hash`) |

### 6. GET `/users/:id` (admin or self)

Response `200 OK` (includes a summary of what the user owns):
```json
{ "success": true, "message": "User retrieved successfully",
  "data": { "id": 2, "full_name": "Wyatt Anderson", "email": "wyatt@eventbook.test", "phone": "0123000002",
            "role": "organiser", "status": "active", "created_at": "...", "updated_at": "...",
            "summary": { "events_owned": 4, "bookings_made": 0 } } }
```

| Status | When |
|---|---|
| 200 | OK |
| 401 | Not logged in |
| 403 | Non-admin viewing another user |
| 404 | User not found |
| 422 | `id` is not a positive integer |

### 7. POST `/users` (admin)

```json
{ "full_name": "Nadia Organiser", "email": "nadia@eventbook.test", "password": "Nadia@2026",
  "phone": "0198765432", "role": "organiser", "status": "active" }
```
`role` is required; `status` defaults to `active`.

Response `201 Created` with header `Location: /api/v1/users/<id>` and the new user in `data`.

| Status | When |
|---|---|
| 201 | Created |
| 401 / 403 | Not logged in / not admin |
| 409 | Email already used |
| 422 | Validation failed (e.g. `role: "superuser"`) |

### 8. PUT `/users/:id` (admin or self)

Send any of: `full_name`, `email`, `phone`, `role`*, `status`* (*admin only).

```json
{ "full_name": "Kimi Antonelli", "phone": "0123000005" }
```
```json
{ "role": "staff", "status": "inactive" }
```

Response `200 OK` with the updated user.

| Status | Code | When |
|---|---|---|
| 200 | | Updated |
| 400 | `SELF_LOCKOUT` | Admin tries to demote/deactivate themselves |
| 403 | `FORBIDDEN` | Non-admin edits another user, or sends `role`/`status` |
| 404 | `NOT_FOUND` | User not found |
| 409 | `CONFLICT` | Email used by another account |
| 422 | `VALIDATION_ERROR` | Empty body, invalid value, or `password` sent (use `/auth/password`) |

### 9. DELETE `/users/:id` (admin)

Response `200 OK`: `{ "success": true, "message": "User deleted successfully", "data": { "id": 9 } }`

| Status | Code | When |
|---|---|---|
| 200 | | Deleted |
| 400 | `SELF_DELETE` / `LAST_ADMIN` | Deleting yourself, or the last active admin |
| 403 | `FORBIDDEN` | Not admin |
| 404 | `NOT_FOUND` | User not found |
| 409 | `CONFLICT` | User owns events or has bookings (deactivate instead). `details` shows the counts |

---

## Test accounts (`database/seed.sql`)

| Email | Password | Role | Status |
|---|---|---|---|
| admin@eventbook.test | Admin@123 | admin | active |
| wyatt@eventbook.test | Organiser@123 | organiser | active |
| damon@eventbook.test | Organiser@123 | organiser | active |
| audrey@eventbook.test | Staff@123 | staff | active |
| kimi@eventbook.test | Customer@123 | customer | active |
| jace@eventbook.test | Customer@123 | customer | active |

## Postman

Folder **Auth & Users** in `postman/Ticket.exe API.postman_collection.json`.
Log in first - each login request saves its JWT into a variable that the
protected requests send as `Authorization: Bearer <token>`.
