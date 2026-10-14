// =====================================================================
// My tickets: a summary of the customer's bookings and the list itself,
// filtered by status, newest first.
// GET /bookings (with status filters; limit=1 just to read the totals)
// =====================================================================
import { api } from '../api.js';
import { CONFIG } from '../config.js';
import { currentUser } from '../session.js';
import { ticketHtml } from '../ticket.js';
import { esc, loadingHtml, emptyHtml, showError, pagerHtml, bindPager } from '../ui.js';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending', label: 'Awaiting payment' },
  { value: 'cancelled', label: 'Cancelled' },
];
const state = { status: '', page: 1 };

export async function renderBookings(view) {
  const user = currentUser();
  view.innerHTML = `
    <section class="tickets-head">
      <h1>My tickets</h1>
      <p class="muted">Hi ${esc(user.full_name.split(' ')[0])}. Tickets awaiting payment are held until you pay or cancel.</p>
      <div class="stats" data-stats></div>
    </section>
    <div class="chips" role="group" aria-label="Filter by status">
      ${FILTERS.map((f) => `<button type="button" class="chip" data-status="${f.value}" aria-pressed="${f.value === state.status}">${f.label}</button>`).join('')}
    </div>
    <div data-list></div>`;

  const list = view.querySelector('[data-list]');

  // Totals per status: one small request each, reading meta.total
  Promise.all(['confirmed', 'pending', 'cancelled'].map((status) => api.get('/bookings', { status, limit: 1 })
    .then((r) => r.meta.total).catch(() => null)))
    .then(([confirmed, pending, cancelled]) => {
      if (confirmed === null) return;
      view.querySelector('[data-stats]').innerHTML = `
        <div class="stat"><strong>${confirmed}</strong><span>confirmed</span></div>
        <div class="stat${pending ? ' stat-warn' : ''}"><strong>${pending}</strong><span>awaiting payment</span></div>
        <div class="stat"><strong>${cancelled}</strong><span>cancelled</span></div>`;
    });

  async function load() {
    list.innerHTML = loadingHtml('Loading your tickets…');
    try {
      const res = await api.get('/bookings', {
        status: state.status, page: state.page, limit: CONFIG.PAGE_SIZE, sort: 'created_at', order: 'desc',
      });
      if (!res.data.length) {
        list.innerHTML = state.status
          ? emptyHtml('Nothing here', 'You have no bookings with this status.')
          : emptyHtml('No tickets yet', 'Find something you like and your tickets will appear here.',
            '<a class="btn btn-ink" href="#/events">Discover events</a>');
        return;
      }
      list.innerHTML = `<div class="ticket-list">${res.data.map((b) => ticketHtml(b, { link: true })).join('')}</div>${pagerHtml(res.meta)}`;
      bindPager(list, (page) => { state.page = page; load(); });
    } catch (err) {
      showError(list, err, load);
    }
  }

  view.querySelectorAll('[data-status]').forEach((chip) => chip.addEventListener('click', () => {
    state.status = chip.dataset.status;
    state.page = 1;
    view.querySelectorAll('[data-status]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    load();
  }));

  load();
}
