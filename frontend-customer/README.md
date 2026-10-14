# Ticket.exe Customer app

Frontend 3 (Bookings & Payments lead). Anyone can browse published events;
customers log in or register to book tickets for a date, pay (simulated card,
FPX or e-wallet), and keep, print or cancel their tickets. Every event gets a
generated poster and every booking is shown as a ticket with a barcode.
Plain HTML, CSS and JavaScript modules; it talks only to the shared API.

## Run

1. Start the backend (`cd backend`, `npm run dev`).
2. Check `js/config.js`: `API_KEY` must match `API_KEY` in `backend/.env`.
3. In VS Code, right-click `frontend-customer/index.html` and choose **Open with Live Server**.
4. Log in as `kimi@eventbook.test` / `Customer@123` (or create an account).

## Pages

| Page | Address | API requests |
|---|---|---|
| Log in / create account | `#/login` | POST /auth/login, POST /auth/register |
| Discover (no login needed) | `#/events` | GET /categories, GET /events |
| Event and its dates (no login to view) | `#/events/:id` | GET /events/:id, POST /bookings |
| Checkout | `#/bookings/:id/pay` | GET /bookings/:id, POST /bookings/:id/payments, PATCH /bookings/:id/cancel |
| My tickets | `#/bookings` | GET /bookings |
| Ticket (add to calendar, print) | `#/bookings/:id` | GET /bookings/:id, PATCH /bookings/:id/cancel |

## Files

- `js/config.js` settings (API address, API key, page size)
- `js/api.js` the only file that calls the API (adds x-api-key and the Bearer token)
- `js/session.js` the logged-in user and token (sessionStorage)
- `js/ui.js` shared helpers (escaping, dates, money, errors, toasts, paging)
- `js/poster.js` draws a poster for each event from its category
- `js/ticket.js` draws a booking as a ticket with a barcode
- `js/pages/` one file per page
