# Ticket.exe – Organiser Portal

Frontend for the **Organiser** role (Events & Venues Lead). Organisers create events,
add schedules (date, venue, price, tickets), publish or cancel events, and manage venues.
Admins can also use it to see and manage every event.

Built with plain HTML, CSS and JavaScript (ES modules). No build step. It calls the
shared Ticket.exe REST API with `fetch()`.

## How to run

1. Start the backend: in `backend/`, run `npm run dev`.
2. In VS Code, install the **Live Server** extension (by Ritwick Dey).
3. Right-click `frontend-organiser/index.html` → **Open with Live Server**.
   It opens at `http://127.0.0.1:5500/frontend-organiser/index.html`.
4. Pick a test account (Wyatt Anderson or Damon Vance = organiser).

> Opening `index.html` by double-clicking does **not** work, because browsers block
> JavaScript modules on `file://` pages. Always use Live Server.

Settings are in `js/config.js` (API URL, API key, login mode).

## Pages

| Page | URL | API calls |
|---|---|---|
| Login | `#/login` | none in dev mode; `POST /auth/login` in JWT mode |
| My events | `#/events` | `GET /events?mine=true` (+ search, status, category, sort, page) |
| New / edit event | `#/events/new`, `#/events/:id/edit` | `GET /categories`, `POST /events`, `PUT /events/:id` |
| Event detail | `#/events/:id` | `GET /events/:id`, `PATCH /events/:id`, `DELETE /events/:id` |
| Schedules (on event detail) | – | `GET /venues`, `POST /events/:id/schedules`, `PUT /schedules/:id`, `DELETE /schedules/:id` |
| Venues | `#/venues` | `GET /venues` (+ search, city, sort, page), `DELETE /venues/:id` (admin) |
| New / edit venue | `#/venues/new`, `#/venues/:id/edit` | `GET /venues/:id`, `POST /venues`, `PUT /venues/:id` |

## Folder structure

```
frontend-organiser/
├── index.html          page shell (top bar + #app)
├── css/styles.css      all styling
└── js/
    ├── app.js          hash router: picks the page from the URL
    ├── config.js       API URL, API key, login mode, test accounts
    ├── session.js      who is logged in (sessionStorage) + canManage()
    ├── api.js          the only file that calls the API (headers, JSON, errors)
    ├── ui.js           shared helpers: escaping, dates, toasts, form errors, pager
    └── pages/          one file per page
```

## Role behaviour

- Only **organiser** and **admin** can log in; a customer gets "Access denied".
- Organisers see **their own** events (including drafts); admins see **all** events.
- Edit buttons only appear on events and venues you own; Delete venue is admin-only.
- The API enforces the same rules, so hiding a button is never the only protection.

## Switching to the real login

When the Auth lead's `POST /auth/login` is ready, set `AUTH_MODE: 'jwt'` in
`js/config.js`. `api.js` then sends `Authorization: Bearer <token>` instead of the
dev headers. Confirm the login response is `{ data: { token, user: { id, full_name, role } } }`.
