// =====================================================================
// Small helpers shared by every page: safe HTML, dates, money, loading
// and error states, form errors, toasts and pagination.
// =====================================================================
import { clearSession } from './session.js';

// Escape text before putting it into HTML, so data such as an event title
// like <script>...</script> is shown as text and never runs (prevents XSS).
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Dates (always shown in Malaysia time) ----------
export function formatDateTime(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(iso));
}

export function formatTime(iso) {
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', minute: '2-digit',
  }).format(new Date(iso));
}

export function formatMoney(amount) {
  if (amount === null || amount === undefined) return '—';
  return `RM ${Number(amount).toFixed(2)}`;
}

const BADGE_LABELS = { pending: 'Pending', sold_out: 'Sold out' };

export function badge(status) {
  const label = BADGE_LABELS[status] || String(status).replace('_', ' ');
  return `<span class="badge badge-${esc(status)}">${esc(label)}</span>`;
}

// ---------- Page states ----------
export function loadingHtml(text = 'Loading…') {
  return `<div class="state"><div class="spinner"></div>${esc(text)}</div>`;
}

export function emptyHtml(title, text = '', actionHtml = '') {
  return `<div class="state"><h3>${esc(title)}</h3><p>${esc(text)}</p>${actionHtml}</div>`;
}

export function errorHtml(message) {
  return `<div class="state">
    <h3>Something went wrong</h3>
    <p>${esc(message)}</p>
    <button class="btn btn-secondary" type="button" data-retry>Try again</button>
  </div>`;
}

// Shows an error state with a working "Try again" button
export function showError(container, err, retry) {
  if (handleAuthError(err)) return;
  container.innerHTML = errorHtml(err.message);
  container.querySelector('[data-retry]')?.addEventListener('click', retry);
}

// 401 means the login is missing or expired: go back to the login page
export function handleAuthError(err) {
  if (err?.status === 401) {
    clearSession();
    toast('Your login has expired. Please log in again.', 'error');
    location.hash = '#/login';
    return true;
  }
  return false;
}

// ---------- Forms ----------
export function clearFormErrors(form) {
  form.querySelectorAll('.field.has-error').forEach((f) => f.classList.remove('has-error'));
  form.querySelectorAll('.error-text').forEach((e) => { e.textContent = ''; });
  const alert = form.querySelector('[data-form-alert]');
  if (alert) { alert.hidden = true; alert.innerHTML = ''; }
}

// details = [{ field, message }] from client checks or from the API's 422/409 response
export function showFormErrors(form, details, summary) {
  const unmatched = [];
  details.forEach(({ field, message }) => {
    const input = form.querySelector(`[name="${field}"]`);
    const box = input?.closest('.field');
    if (box) {
      box.classList.add('has-error');
      box.querySelector('.error-text').textContent = message;
    } else {
      unmatched.push(message);
    }
  });
  if (summary || unmatched.length) {
    showFormAlert(form, summary || 'Please fix the errors below.', unmatched);
  }
  form.querySelector('.has-error input, .has-error select, .has-error textarea')?.focus();
}

export function showFormAlert(form, message, items = []) {
  const alert = form.querySelector('[data-form-alert]');
  if (!alert) return toast(message, 'error');
  alert.innerHTML = `${esc(message)}${items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}`;
  alert.hidden = false;
  alert.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// Shows API errors on a form: field errors for 422, a message for everything else
export function showApiFormError(form, err) {
  if (handleAuthError(err)) return;
  if (err.details.length) {
    showFormErrors(form, err.details, err.message);
  } else {
    showFormAlert(form, err.message);
  }
}

export function setBusy(button, busy, busyText) {
  if (busy) {
    button.dataset.label = button.textContent;
    if (busyText) button.textContent = busyText;
  } else if (button.dataset.label) {
    button.textContent = button.dataset.label;
  }
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
}

export function fieldHtml({ name, label, required = false, hint = '', control, full = false }) {
  return `<div class="field${full ? ' full' : ''}">
    <label for="f-${name}">${esc(label)}${required ? ' <span class="req">*</span>' : ''}</label>
    ${control}
    ${hint ? `<span class="hint">${esc(hint)}</span>` : ''}
    <span class="error-text"></span>
  </div>`;
}

// ---------- Toasts ----------
export function toast(message, type = 'success') {
  const box = document.createElement('div');
  box.className = `toast toast-${type}`;
  box.textContent = message;
  document.getElementById('toasts').appendChild(box);
  setTimeout(() => box.remove(), 4000);
}

// ---------- Pagination ----------
export function pagerHtml(meta) {
  if (!meta || meta.total_pages <= 1) {
    return meta ? `<div class="pager"><span>${meta.total} result${meta.total === 1 ? '' : 's'}</span></div>` : '';
  }
  return `<div class="pager">
    <span>Page ${meta.page} of ${meta.total_pages} · ${meta.total} results</span>
    <span class="actions">
      <button class="btn btn-secondary btn-sm" type="button" data-page="${meta.page - 1}" ${meta.page <= 1 ? 'disabled' : ''}>Previous</button>
      <button class="btn btn-secondary btn-sm" type="button" data-page="${meta.page + 1}" ${meta.page >= meta.total_pages ? 'disabled' : ''}>Next</button>
    </span>
  </div>`;
}

export function bindPager(container, onPage) {
  container.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => onPage(Number(btn.dataset.page)));
  });
}

export function debounce(fn, ms = 350) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Search input with a magnifier icon
export function searchHtml(value, placeholder, label) {
  return `<label class="search">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>
    <input type="search" name="search" placeholder="${esc(placeholder)}" value="${esc(value)}" aria-label="${esc(label)}">
  </label>`;
}

// Short date for compact places, e.g. "14 Nov"
export function formatShortDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-MY', { timeZone: 'Asia/Kuala_Lumpur', day: 'numeric', month: 'short' }).format(new Date(iso));
}

// "Wyatt Anderson" -> "WA" for the avatar circle
export function initials(name) {
  return String(name).split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

// Day number and month for the date block, e.g. { day: '14', month: 'Nov' }
export function dateParts(iso) {
  const d = new Date(iso);
  const fmt = (o) => new Intl.DateTimeFormat('en-MY', { timeZone: 'Asia/Kuala_Lumpur', ...o }).format(d);
  return { day: fmt({ day: 'numeric' }), month: fmt({ month: 'short' }), weekday: fmt({ weekday: 'short' }) };
}

export function isPast(iso) {
  return new Date(iso) <= new Date();
}
