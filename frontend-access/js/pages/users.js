// =====================================================================
// People page (admin only) - user management.
//   GET    /users?search=&role=&status=&sort=&order=&page=&limit=
//   GET    /users/:id          details + what the user owns
//   POST   /users              add a person with any role
//   PUT    /users/:id          change details, role or status
//   DELETE /users/:id          delete (409 if they own events/bookings)
// =====================================================================
import { api } from '../api.js';
import { currentUser } from '../session.js';
import { CONFIG, ROLES } from '../config.js';
import {
  esc, initials, roleChip, statusChip, passNumber, formatDate, field, clearFormErrors,
  showFormErrors, showFormAlert, showApiError, setBusy, rules, check, toast, openDialog,
  closeDialog, confirmDialog, pagerHtml, roleLabel,
} from '../ui.js';

const SORTS = {
  newest: { sort: 'created_at', order: 'desc', label: 'Newest first' },
  oldest: { sort: 'created_at', order: 'asc', label: 'Oldest first' },
  name: { sort: 'full_name', order: 'asc', label: 'Name A–Z' },
  name_desc: { sort: 'full_name', order: 'desc', label: 'Name Z–A' },
  email: { sort: 'email', order: 'asc', label: 'Email A–Z' },
  role: { sort: 'role', order: 'asc', label: 'Role' },
};

export function renderUsers(el) {
  const state = { search: '', role: '', status: '', sortKey: 'newest', page: 1 };
  const me = currentUser();

  el.innerHTML = `
    <header class="page-head page-head-row">
      <div>
        <h1>People</h1>
        <p class="lede">Every account and the pass it carries.</p>
      </div>
      <button class="btn btn-primary" type="button" data-add>Add person</button>
    </header>

    <section class="roster" data-roster aria-label="Passes by role"></section>

    <div class="toolbar">
      <label class="search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" placeholder="Search name, email or phone" aria-label="Search people" data-search>
      </label>
      <div class="role-filter" role="group" aria-label="Filter by role">
        <button type="button" data-role-filter="" aria-pressed="true">All</button>
        ${Object.keys(ROLES).map((r) => `<button type="button" data-role-filter="${r}" data-role="${r}" aria-pressed="false">${ROLES[r].label}</button>`).join('')}
      </div>
      <select aria-label="Filter by status" data-status>
        <option value="">Any status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <select aria-label="Sort" data-sort>
        ${Object.entries(SORTS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('')}
      </select>
    </div>

    <div data-list></div>`;

  const list = el.querySelector('[data-list]');

  // ----- Roster strip: how many passes of each role exist -----
  async function loadRoster() {
    const roster = el.querySelector('[data-roster]');
    try {
      const counts = await Promise.all(Object.keys(ROLES).map(async (role) => {
        const res = await api.get('/users', { role, limit: 1 });
        return { role, total: res.meta.total };
      }));
      const total = counts.reduce((sum, c) => sum + c.total, 0) || 1;
      roster.innerHTML = `
        <div class="roster-bar">
          ${counts.map((c) => `<span data-role="${c.role}" style="flex:${c.total || 0.001}" title="${roleLabel(c.role)}: ${c.total}"></span>`).join('')}
        </div>
        <ul class="roster-legend">
          ${counts.map((c) => `<li><span class="dot" data-role="${c.role}"></span>${roleLabel(c.role)} <strong>${c.total}</strong>
            <span class="muted">${Math.round((c.total / total) * 100)}%</span></li>`).join('')}
        </ul>`;
    } catch {
      roster.innerHTML = '';
    }
  }

  // ----- The table -----
  async function load() {
    list.innerHTML = '<div class="state"><span class="spinner"></span>Loading people…</div>';
    const { sort, order } = SORTS[state.sortKey];
    try {
      const res = await api.get('/users', {
        search: state.search, role: state.role, status: state.status, sort, order,
        page: state.page, limit: CONFIG.PAGE_SIZE,
      });
      if (!res.data.length) {
        list.innerHTML = `<div class="state"><h2>No one matches</h2><p>Try another name, or clear the filters.</p>
          <button class="btn btn-ghost" type="button" data-clear>Clear filters</button></div>`;
        list.querySelector('[data-clear]').addEventListener('click', resetFilters);
        return;
      }
      list.innerHTML = `
        <div class="table-wrap">
          <table class="people">
            <thead><tr><th>Person</th><th>Role</th><th>Status</th><th>Pass</th><th>Joined</th><th><span class="sr-only">Actions</span></th></tr></thead>
            <tbody>
              ${res.data.map((u) => `
                <tr data-role="${u.role}" class="${u.status === 'inactive' ? 'is-inactive' : ''}">
                  <td>
                    <div class="person">
                      <span class="avatar" data-role="${u.role}" aria-hidden="true">${esc(initials(u.full_name))}</span>
                      <span><strong>${esc(u.full_name)}${u.id === me.id ? ' <span class="you">you</span>' : ''}</strong>
                        <small>${esc(u.email)}</small></span>
                    </div>
                  </td>
                  <td>${roleChip(u.role)}</td>
                  <td>${statusChip(u.status)}</td>
                  <td class="num">${esc(passNumber(u.id))}</td>
                  <td>${esc(formatDate(u.created_at))}</td>
                  <td class="actions"><button class="btn btn-ghost btn-sm" type="button" data-open="${u.id}">Manage</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        ${pagerHtml(res.meta)}`;

      list.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openManage(Number(b.dataset.open))));
      list.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => {
        state.page = Number(b.dataset.page);
        load();
      }));
    } catch (err) {
      list.innerHTML = `<div class="state"><h2>People could not be loaded</h2><p>${esc(err.message)}</p>
        <button class="btn btn-ghost" type="button" data-retry>Try again</button></div>`;
      list.querySelector('[data-retry]').addEventListener('click', load);
    }
  }

  function refresh() { load(); loadRoster(); }

  function resetFilters() {
    Object.assign(state, { search: '', role: '', status: '', page: 1 });
    el.querySelector('[data-search]').value = '';
    el.querySelector('[data-status]').value = '';
    el.querySelectorAll('[data-role-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.roleFilter === '')));
    load();
  }

  // ----- Toolbar events -----
  let timer;
  el.querySelector('[data-search]').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 300);
  });
  el.querySelectorAll('[data-role-filter]').forEach((b) => b.addEventListener('click', () => {
    state.role = b.dataset.roleFilter;
    state.page = 1;
    el.querySelectorAll('[data-role-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    load();
  }));
  el.querySelector('[data-status]').addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; load(); });
  el.querySelector('[data-sort]').addEventListener('change', (e) => { state.sortKey = e.target.value; state.page = 1; load(); });
  el.querySelector('[data-add]').addEventListener('click', openCreate);

  const roleOptions = (selected) => Object.keys(ROLES)
    .map((r) => `<option value="${r}" ${r === selected ? 'selected' : ''}>${ROLES[r].label}</option>`).join('');

  // ----- Add person -----
  function openCreate() {
    const dialog = openDialog(`
      <h2>Add person</h2>
      <p class="dialog-text">Create an account for an organiser, staff member, admin or customer.</p>
      <form id="create-form" novalidate>
        <div class="alert" data-form-alert hidden></div>
        ${field({ name: 'full_name', label: 'Full name', required: true })}
        ${field({ name: 'email', label: 'Email', type: 'email', required: true })}
        <div class="grid-2">
          ${field({ name: 'phone', label: 'Phone', type: 'tel' })}
          ${field({ name: 'role', label: 'Role', required: true, control: `<select id="f-role" name="role">${roleOptions('organiser')}</select>` })}
        </div>
        ${field({ name: 'password', label: 'Temporary password', type: 'password', required: true, autocomplete: 'new-password',
                  hint: '8+ characters, upper and lower case, a number and a symbol' })}
        <div class="dialog-actions">
          <button class="btn btn-ghost" type="button" data-close>Cancel</button>
          <button class="btn btn-primary" type="submit">Add person</button>
        </div>
      </form>`);

    const form = dialog.querySelector('#create-form');
    form.full_name.focus();
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFormErrors(form);
      const v = Object.fromEntries(new FormData(form));
      const errors = check([['full_name', rules.name(v.full_name)], ['email', rules.email(v.email)],
        ['phone', rules.phone(v.phone)], ['password', rules.password(v.password)]]);
      if (errors.length) return showFormErrors(form, errors);

      const button = form.querySelector('[type="submit"]');
      setBusy(button, true, 'Adding…');
      try {
        const res = await api.post('/users', {
          full_name: v.full_name.trim(), email: v.email.trim(), phone: v.phone || undefined,
          password: v.password, role: v.role,
        });
        closeDialog();
        toast(`${res.data.full_name} added as ${roleLabel(res.data.role)}`);
        refresh();
      } catch (err) {
        setBusy(button, false);
        showApiError(form, err);
      }
    });
  }

  // ----- Manage one person -----
  async function openManage(id) {
    let user;
    try {
      user = (await api.get(`/users/${id}`)).data;
    } catch (err) {
      toast(err.message, 'error');
      return;
    }
    const isSelf = user.id === me.id;
    const owns = [];
    if (user.summary?.events_owned) owns.push(`${user.summary.events_owned} event${user.summary.events_owned > 1 ? 's' : ''}`);
    if (user.summary?.bookings_made) owns.push(`${user.summary.bookings_made} booking${user.summary.bookings_made > 1 ? 's' : ''}`);

    const dialog = openDialog(`
      <div class="manage-head" data-role="${user.role}">
        <span class="avatar avatar-lg" data-role="${user.role}" aria-hidden="true">${esc(initials(user.full_name))}</span>
        <div>
          <h2>${esc(user.full_name)}</h2>
          <p class="muted">Pass ${esc(passNumber(user.id))}, joined ${esc(formatDate(user.created_at))}.
            ${owns.length ? `Owns ${esc(owns.join(' and '))}.` : ''}</p>
        </div>
      </div>
      <form id="manage-form" novalidate>
        <div class="alert" data-form-alert hidden></div>
        ${field({ name: 'full_name', label: 'Full name', value: user.full_name, required: true })}
        ${field({ name: 'email', label: 'Email', type: 'email', value: user.email, required: true })}
        ${field({ name: 'phone', label: 'Phone', type: 'tel', value: user.phone || '' })}
        <div class="grid-2">
          ${field({ name: 'role', label: 'Role', required: true,
                    control: `<select id="f-role" name="role" ${isSelf ? 'disabled' : ''}>${roleOptions(user.role)}</select>`,
                    hint: isSelf ? 'You cannot change your own role.' : '' })}
          ${field({ name: 'status', label: 'Status', required: true,
                    control: `<select id="f-status" name="status" ${isSelf ? 'disabled' : ''}>
                      <option value="active" ${user.status === 'active' ? 'selected' : ''}>Active</option>
                      <option value="inactive" ${user.status === 'inactive' ? 'selected' : ''}>Inactive (cannot sign in)</option>
                    </select>` })}
        </div>
        <div class="dialog-actions dialog-actions-split">
          ${isSelf ? '<span></span>' : '<button class="btn btn-danger-ghost" type="button" data-delete>Delete account</button>'}
          <span>
            <button class="btn btn-ghost" type="button" data-close>Cancel</button>
            <button class="btn btn-primary" type="submit">Save changes</button>
          </span>
        </div>
      </form>`);

    const form = dialog.querySelector('#manage-form');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFormErrors(form);
      const v = Object.fromEntries(new FormData(form));
      const errors = check([['full_name', rules.name(v.full_name)], ['email', rules.email(v.email)], ['phone', rules.phone(v.phone)]]);
      if (errors.length) return showFormErrors(form, errors);

      const body = { full_name: v.full_name.trim(), email: v.email.trim(), phone: v.phone.trim() };
      if (!isSelf) { body.role = v.role; body.status = v.status; } // disabled selects are not sent

      const button = form.querySelector('[type="submit"]');
      setBusy(button, true, 'Saving…');
      try {
        await api.put(`/users/${user.id}`, body);
        closeDialog();
        toast('Changes saved');
        refresh();
      } catch (err) {
        setBusy(button, false);
        showApiError(form, err);
      }
    });

    form.querySelector('[data-delete]')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: `Delete ${user.full_name}?`,
        text: 'This removes the account for good. People who own events or have bookings cannot be deleted; deactivate them instead.',
        confirmLabel: 'Delete account',
        danger: true,
      });
      if (!ok) return;
      try {
        await api.del(`/users/${user.id}`);
        toast(`${user.full_name} deleted`);
        refresh();
      } catch (err) {
        if (err.status === 409 && user.status === 'active') {
          const deactivate = await confirmDialog({
            title: 'This account has history',
            text: `${err.message}. Deactivate ${user.full_name} so they can no longer sign in?`,
            confirmLabel: 'Deactivate',
          });
          if (deactivate) {
            try {
              await api.put(`/users/${user.id}`, { status: 'inactive' });
              toast(`${user.full_name} deactivated`);
              refresh();
            } catch (e) { toast(e.message, 'error'); }
          }
        } else {
          toast(err.message, 'error');
        }
      }
    });
  }

  refresh();
}
