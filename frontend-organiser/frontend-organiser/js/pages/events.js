// =====================================================================
// Events dashboard: stats, search, filter, sort and pagination.
// Organisers see their own events (GET /events?mine=true).
// Admins see every event (GET /events).
// =====================================================================
import { CONFIG } from '../config.js';
import { api } from '../api.js';
import { isAdmin, currentUser } from '../session.js';
import {
  esc, badge, searchHtml, formatTime, formatMoney, loadingHtml, emptyHtml, showError,
  pagerHtml, bindPager, debounce,
} from '../ui.js';

// Kept between visits, so filters stay when you come back from an event
const filters = { page: 1, search: '', status: '', category_id: '', sort: 'next_start_time', order: 'asc' };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-MY', { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// Day and month of the next date, in Malaysia time, for the ticket stub
function stubDate(iso) {
  if (!iso) return '<span class="tr-tba">No date</span>';
  const parts = new Intl.DateTimeFormat('en-MY', { timeZone: 'Asia/Kuala_Lumpur', day: 'numeric', month: 'short' }).formatToParts(new Date(iso));
  const day = parts.find((p) => p.type === 'day').value;
  const month = parts.find((p) => p.type === 'month').value;
  return `<span class="tr-day">${day}</span><span class="tr-month">${month}</span>`;
}

function scopeQuery() {
  return isAdmin() ? {} : { mine: 'true' };
}

export function renderEvents(el) {
  const admin = isAdmin();

  el.innerHTML = `
    <div class="page-head">
      <div>
        <p class="greeting">${greeting()}, <strong>${esc(currentUser().full_name.split(' ')[0])}</strong></p>
        <h1>${admin ? 'All events' : 'My events'}</h1>
        <p class="muted">${admin ? 'Every event in Ticket.exe, from all organisers.' : 'Events you organise, including drafts only you can see.'}</p>
      </div>
      <a class="btn btn-primary" href="#/events/new">New event</a>
    </div>

    <section class="overview" id="stats" aria-label="Events by status">
      <div class="ov-item ov-published"><span class="ov-value">–</span><span class="ov-label">Published</span></div>
      <div class="ov-item ov-draft"><span class="ov-value">–</span><span class="ov-label">Drafts</span></div>
      <div class="ov-item ov-cancelled"><span class="ov-value">–</span><span class="ov-label">Cancelled</span></div>
      <div class="ov-bar" aria-hidden="true"><span class="seg-published"></span><span class="seg-draft"></span><span class="seg-cancelled"></span></div>
    </section>

    <form class="filters" id="filters" role="search">
      ${searchHtml(filters.search, 'Search events', 'Search events')}
      <select name="status" aria-label="Status">
        <option value="">All statuses</option>
        <option value="published">Published</option>
        <option value="draft">Draft</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <select name="category_id" aria-label="Category"><option value="">All categories</option></select>
      <select name="sort" aria-label="Sort by">
        <option value="next_start_time">Sort: next date</option>
        <option value="title">Sort: title</option>
        <option value="min_price">Sort: price</option>
        <option value="created_at">Sort: newest created</option>
      </select>
      <select name="order" aria-label="Order">
        <option value="asc">Ascending</option>
        <option value="desc">Descending</option>
      </select>
    </form>

    <div id="list"></div>`;

  const form = el.querySelector('#filters');
  const list = el.querySelector('#list');
  form.status.value = filters.status;
  form.sort.value = filters.sort;
  form.order.value = filters.order;

  loadCategories(form);
  loadStats(el.querySelector('#stats'));
  loadList(list);

  const applyFilters = () => {
    filters.search = form.search.value.trim();
    filters.status = form.status.value;
    filters.category_id = form.category_id.value;
    filters.sort = form.sort.value;
    filters.order = form.order.value;
    filters.page = 1;
    loadList(list);
  };
  form.search.addEventListener('input', debounce(applyFilters));
  form.querySelectorAll('select').forEach((s) => s.addEventListener('change', applyFilters));
  form.addEventListener('submit', (e) => { e.preventDefault(); applyFilters(); });
}

async function loadCategories(form) {
  try {
    const res = await api.get('/categories');
    form.category_id.insertAdjacentHTML('beforeend',
      res.data.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join(''));
    form.category_id.value = filters.category_id;
  } catch {
    // The list still works without the category filter
  }
}

async function loadStats(box) {
  const statuses = ['published', 'draft', 'cancelled'];
  try {
    const results = await Promise.all(statuses.map((status) =>
      api.get('/events', { ...scopeQuery(), status, limit: 1 })));
    const totals = results.map((r) => r.meta.total);
    box.querySelectorAll('.ov-value').forEach((value, i) => { value.textContent = totals[i]; });
    // Bar shows the share of each status
    box.querySelectorAll('.ov-bar span').forEach((seg, i) => { seg.style.flexGrow = totals[i]; });
  } catch {
    box.querySelectorAll('.ov-value').forEach((value) => { value.textContent = '—'; });
  }
}

async function loadList(list) {
  list.innerHTML = loadingHtml('Loading events…');
  try {
    const res = await api.get('/events', {
      ...scopeQuery(),
      page: filters.page,
      limit: CONFIG.PAGE_SIZE,
      search: filters.search,
      status: filters.status,
      category_id: filters.category_id,
      sort: filters.sort,
      order: filters.order,
    });

    if (!res.data.length) {
      const filtered = filters.search || filters.status || filters.category_id;
      list.innerHTML = filtered
        ? emptyHtml('No matching events', 'Try a different search or filter.')
        : emptyHtml('No events yet', 'Create an event, add a date and venue, then publish it for customers.',
          '<a class="btn btn-primary" href="#/events/new">New event</a>');
      return;
    }

    const admin = isAdmin();
    // Each event is drawn as a ticket: date stub on the left, details, then price
    list.innerHTML = `
      <div class="ticket-list">
        ${res.data.map((e) => `
          <a class="ticket-row" href="#/events/${e.id}">
            <div class="tr-date">${stubDate(e.next_start_time)}</div>
            <div class="tr-body">
              <div class="tr-top">${badge(e.status)}<span>${esc(e.category_name)}</span>${admin ? `<span>by ${esc(e.organiser_name)}</span>` : ''}</div>
              <div class="tr-title">${esc(e.title)}</div>
              <div class="sub">${e.next_start_time ? `Next date starts ${formatTime(e.next_start_time)}` : 'Add a date to start selling tickets'}</div>
            </div>
            <div class="tr-price">${e.min_price === null || e.min_price === undefined ? '<small>No price yet</small>' : `<small>From</small><strong>${formatMoney(e.min_price)}</strong>`}</div>
            <span class="tr-go" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></span>
          </a>`).join('')}
      </div>
      ${pagerHtml(res.meta)}`;

    bindPager(list, (page) => { filters.page = page; loadList(list); });
  } catch (err) {
    showError(list, err, () => loadList(list));
  }
}
