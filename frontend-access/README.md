# Ticket.exe – Access Portal

Frontend for the **Auth & Users** module (Auth & Users Lead). Everyone signs in here
and manages their own pass; admins also manage every account.

Built with plain HTML, CSS and JavaScript (ES modules). No build step. It calls the
shared Ticket.exe REST API with `fetch()` and sends a **JWT** on every protected request.

## Design idea

Every account is an **event access pass on a lanyard**. The colour of the pass is the
role, like colour-coded passes at a real event: Admin red, Organiser blue, Staff amber,
Customer green. While you type your name on the register form the pass updates live,
and when the API accepts your login the pass is issued in the colour of your role.

## How to run

1. Start the backend: in `backend/`, run `npm run dev`.
2. In VS Code, install the **Live Server** extension (by Ritwick Dey).
3. Right-click `frontend-access/index.html` → **Open with Live Server**.
4. Click a test account under the form, then **Sign in**.

> Opening `index.html` by double-clicking does **not** work, because browsers block
> JavaScript modules on `file://` pages. Always use Live Server.

Settings are in `js/config.js` (API URL, API key). The API key must match `API_KEY` in `backend/.env`.

## Pages

| Page | URL | Who | API calls |
|---|---|---|---|
| Sign in / Create account | `#/login` | everyone | `POST /auth/login`, `POST /auth/register` |
| My pass | `#/profile` | every role | `GET /auth/me`, `PUT /users/:id`, `PUT /auth/password` |
| People | `#/users` | admin | `GET /users` (search, role, status, sort, page), `GET /users/:id`, `POST /users`, `PUT /users/:id`, `DELETE /users/:id` |

## Folder structure

```
frontend-access/
├── index.html          page shell (top bar + #app + dialog + toasts)
├── css/styles.css      all styling, including the access pass
└── js/
    ├── app.js          hash router: picks the page from the URL, admin-only guard
    ├── config.js       API URL, API key, role colours/labels
    ├── session.js      token + user in sessionStorage
    ├── api.js          the only file that calls the API (x-api-key, Bearer token, errors)
    ├── ui.js           the pass, form errors, toasts, dialog, pager, XSS escaping
    └── pages/
        ├── login.js    sign in, create account, live pass preview
        ├── profile.js  my pass, edit details, change password
        └── users.js    people list, roster strip, add / manage / deactivate / delete
```

## Security and role behaviour

- After login the JWT is kept in `sessionStorage` (cleared when the tab closes) and sent as
  `Authorization: Bearer <token>`.
- If the API answers **401** (token expired or invalid) or **403 ACCOUNT_INACTIVE**, the app
  signs out and shows the reason on the login page.
- The **People** link and page are only for admins. The API also returns 403 to everyone else,
  so hiding the link is never the only protection.
- An admin cannot change their own role or status, or delete themselves (the API enforces this too).
- Deleting someone who owns events or bookings returns **409**; the app then offers to
  **deactivate** the account instead.
- All user data is escaped before it is put into HTML (prevents XSS).
- Forms are checked in the browser first (same rules as the API) and API validation errors
  (422) are shown next to the right field.
