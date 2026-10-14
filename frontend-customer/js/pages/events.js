// =====================================================================
// Discover: the next event as a big feature, then every published event
// as a poster grid with search, category, city and sort.
// GET /categories, GET /events (public: API key only)
// =====================================================================
import { api } from '../api.js';
import { CONFIG } from '../config.js';
import { posterHtml } from '../poster.js';
import {
  esc, formatMoney, formatTime, dateParts, loadingHtml, emptyHtml, showError,
  pagerHtml, bindPager, debounce, searchHtml,
} from '../ui.js';

const SORTS = [
  { value: 'next_start_time:asc', label: 'Soonest first' },
  { value: 'min_price:asc', label: 'Lowest price' },
  { value: 'min_price:desc', label: 'Highest price' },
  { value: 'title:asc', label: 'A to Z' },
];
const state = { search: '', category_id: '', city: '', sort: SORTS[0].value, page: 1 };

function whenText(iso) {
  if (!iso) return 'Dates coming soon';
  const d = dateParts(iso);
  return `${d.weekday} ${d.day} ${d.month}, ${formatTime(iso)}`;
}

function cardHtml(e) {
  return `
    <a class="card" href="#/events/${e.id}">
      ${posterHtml(e)}
      <span class="card-body">
        <span class="card-title">${esc(e.title)}</span>
        <span class="card-when">${esc(whenText(e.next_start_time))}</span>
        <span class="card-foot">
          <span class="card-price">${e.min_price !== null ? `From <strong>${esc(formatMoney(e.min_price))}</strong>` : 'Not on sale yet'}</span>
          <span class="card-go" aria-hidden="true">Tickets</span>
        </span>
      </span>
    </a>`;
}

function featureHtml(e) {
  return `
    <section class="feature">
      <div class="feature-poster">${posterHtml(e, { size: 'hero' })}</div>
      <div class="feature-text">
        <span class="kicker">Coming up next</span>
        <h1>${esc(e.title)}</h1>
        ${e.description ? `<p>${esc(e.description)}</p>` : ''}
        <dl class="feature-facts">
          <div><dt>Next date</dt><dd>${esc(whenText(e.next_start_time))}</dd></div>
          <div><dt>Tickets from</dt><dd>${esc(formatMoney(e.min_price))}</dd></div>
          <div><dt>Organiser</dt><dd>${esc(e.organiser_name)}</dd></div>
        </dl>
        <a class="btn btn-ink btn-lg" href="#/events/${e.id}">Get tickets</a>
      </div>
    </section>`;
}

export async function renderEvents(view) {
  view.innerHTML = `
    <div data-feature></div>
    <section class="browse">
      <div class="browse-head">
        <h2>All events</h2>
        <div class="browse-tools">
          ${searchHtml(state.search, 'Search by name', 'Search events')}
          <label class="field-inline"><span class="sr-only">City</span>
            <input name="city" placeholder="Any city" value="${esc(state.city)}" aria-label="City"></label>
          <label class="field-inline"><span class="sr-only">Sort</span>
            <select name="sort" aria-label="Sort events">${SORTS.map((s) => `<option value="${s.value}" ${s.value === state.sort ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
        </div>
      </div>
      <div class="chips" role="group" aria-label="Category" data-chips>
        <button type="button" class="chip" data-cat="" aria-pressed="${!state.category_id}">Everything</button>
      </div>
      <div data-list></div>
    </section>`;

  const list = view.querySelector('[data-list]');
  const chips = view.querySelector('[data-chips]');

  // Feature: the soonest upcoming event (only on the unfiltered first view)
  api.get('/events', { limit: 1, sort: 'next_start_time', order: 'asc' }).then((res) => {
    const first = res.data[0];
    if (first && first.next_start_time) view.querySelector('[data-feature]').innerHTML = featureHtml(first);
  }).catch(() => {});

  api.get('/categories').then((res) => {
    chips.insertAdjacentHTML('beforeend', res.data.filter((c) => c.event_count !== 0)
      .map((c) => `<button type="button" class="chip" data-cat="${c.id}" aria-pressed="${String(c.id) === String(state.category_id)}">${esc(c.name)}</button>`).join(''));
    chips.querySelectorAll('[data-cat]').forEach((chip) => chip.addEventListener('click', () => {
      state.category_id = chip.dataset.cat;
      state.page = 1;
      chips.querySelectorAll('[data-cat]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      load();
    }));
  }).catch(() => {});

  async function load() {
    list.innerHTML = loadingHtml('Finding events…');
    const [sort, order] = state.sort.split(':');
    try {
      const res = await api.get('/events', {
        search: state.search, category_id: state.category_id, city: state.city,
        page: state.page, limit: CONFIG.PAGE_SIZE, sort, order,
      });
      if (!res.data.length) {
        list.innerHTML = emptyHtml('No events match', 'Try another name, category or city.');
        return;
      }
      list.innerHTML = `<div class="grid">${res.data.map(cardHtml).join('')}</div>${pagerHtml(res.meta)}`;
      bindPager(list, (page) => { state.page = page; load(); list.scrollIntoView({ block: 'start' }); });
    } catch (err) {
      showError(list, err, load);
    }
  }

  const refilter = debounce(() => { state.page = 1; load(); });
  view.querySelector('input[name="search"]').addEventListener('input', (e) => { state.search = e.target.value.trim(); refilter(); });
  view.querySelector('input[name="city"]').addEventListener('input', (e) => { state.city = e.target.value.trim(); refilter(); });
  view.querySelector('select[name="sort"]').addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; load(); });

  load();
}
