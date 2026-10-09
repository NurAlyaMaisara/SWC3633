// =====================================================================
// Venues list: search, city filter, sort and pagination.
// Edit is shown only for venues you created (or for an admin).
// Delete is admin-only, the same as the API rule.
// =====================================================================
import { CONFIG } from '../config.js';
import { api } from '../api.js';
import { canManage, isAdmin } from '../session.js';
import {
  esc, searchHtml, loadingHtml, emptyHtml, showError, pagerHtml, bindPager, debounce, toast,
  setBusy, handleAuthError,
} from '../ui.js';

const filters = { page: 1, search: '', city: '', sort: 'name', order: 'asc' };

export function renderVenues(el) {
  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Venues</h1>
        <p class="muted">Places you can schedule events at. You can edit the venues you added.</p>
      </div>
      <a class="btn btn-primary" href="#/venues/new">New venue</a>
    </div>

    <form class="filters" id="filters" role="search">
      ${searchHtml(filters.search, 'Search venues', 'Search venues')}
      <input name="city" placeholder="City" value="${esc(filters.city)}" aria-label="City">
      <select name="sort" aria-label="Sort by">
        <option value="name">Sort: name</option>
        <option value="capacity">Sort: capacity</option>
        <option value="city">Sort: city</option>
        <option value="created_at">Sort: newest added</option>
      </select>
      <select name="order" aria-label="Order">
        <option value="asc">Ascending</option>
        <option value="desc">Descending</option>
      </select>
    </form>

    <div id="list"></div>`;

  const form = el.querySelector('#filters');
  const list = el.querySelector('#list');
  form.sort.value = filters.sort;
  form.order.value = filters.order;

  const applyFilters = () => {
    filters.search = form.search.value.trim();
    filters.city = form.city.value.trim();
    filters.sort = form.sort.value;
    filters.order = form.order.value;
    filters.page = 1;
    loadList(list);
  };
  form.search.addEventListener('input', debounce(applyFilters));
  form.city.addEventListener('input', debounce(applyFilters));
  form.querySelectorAll('select').forEach((s) => s.addEventListener('change', applyFilters));
  form.addEventListener('submit', (e) => { e.preventDefault(); applyFilters(); });

  loadList(list);
}

async function loadList(list) {
  list.innerHTML = loadingHtml('Loading venues…');
  try {
    const res = await api.get('/venues', {
      page: filters.page,
      limit: CONFIG.PAGE_SIZE,
      search: filters.search,
      city: filters.city,
      sort: filters.sort,
      order: filters.order,
    });

    if (!res.data.length) {
      list.innerHTML = emptyHtml('No venues found', 'Try a different search, or add a new venue.');
      return;
    }

    const admin = isAdmin();
    const biggest = Math.max(...res.data.map((v) => v.capacity));
    list.innerHTML = `
      <div class="venue-grid">
        ${res.data.map((v) => `
          <article class="venue-card">
            <div class="vc-head">
              <div>
                <h3>${esc(v.name)}</h3>
                <p class="sub">${esc(v.address)}, ${esc(v.city)}</p>
              </div>
            </div>
            <div class="vc-cap">
              <div class="vc-cap-row"><span class="vc-num">${Number(v.capacity).toLocaleString('en-MY')}</span><span class="vc-unit">people</span></div>
              <div class="meter-track" role="img" aria-label="Capacity compared with the largest venue on this page">
                <span class="meter-fill" style="width:${Math.max(4, Math.round((v.capacity / biggest) * 100))}%"></span>
              </div>
            </div>
            ${v.facilities ? `<div class="chips">${v.facilities.split(',').map((f) => f.trim()).filter(Boolean)
              .map((f) => `<span class="chip">${esc(f)}</span>`).join('')}</div>` : ''}
            <div class="sub">${esc(v.state)}</div>
            ${canManage(v.created_by) || admin ? `<div class="vc-foot">
              ${canManage(v.created_by) ? `<a class="btn btn-secondary btn-sm" href="#/venues/${v.id}/edit">Edit</a>` : ''}
              ${admin ? `<button class="btn btn-danger btn-sm" type="button" data-delete="${v.id}" data-name="${esc(v.name)}">Delete</button>` : ''}
            </div>` : ''}
          </article>`).join('')}
      </div>
      ${pagerHtml(res.meta)}`;

    bindPager(list, (page) => { filters.page = page; loadList(list); });

    list.querySelectorAll('[data-delete]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm(`Delete venue "${button.dataset.name}"?`)) return;
        setBusy(button, true);
        try {
          const del = await api.del(`/venues/${button.dataset.delete}`);
          toast(del.message);
          loadList(list);
        } catch (err) {
          // e.g. 409 "Venue cannot be deleted because it has 2 schedule(s)"
          if (!handleAuthError(err)) toast(err.message, 'error');
          setBusy(button, false);
        }
      });
    });
  } catch (err) {
    showError(list, err, () => loadList(list));
  }
}
