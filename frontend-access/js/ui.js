// =====================================================================
// Helpers shared by every page: safe HTML, the access badge, dates,
// form errors, toasts, the dialog and the pager.
// =====================================================================
import { ROLES } from './config.js';

// Escape text before putting it into HTML so user data such as a name
// like <img onerror=...> is shown as text and never runs (prevents XSS).
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export function roleLabel(role) {
  return ROLES[role]?.label || 'Guest';
}

export function passNumber(id) {
  return id ? `TX-${String(id).padStart(4, '0')}` : 'TX-····';
}

export function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(value));
}

// ---------- The access badge (the signature element) ----------
// Barcode bars are generated from the user id, so every pass is unique.
function barcode(seed) {
  let n = Number(seed) || 7;
  const bars = [];
  for (let i = 0; i < 62; i += 1) {
    n = (n * 9301 + 49297) % 233280;
    const w = 1 + (n % 3);
    bars.push(`<i style="width:${w}px;margin-right:${1 + ((n >> 3) % 3)}px"></i>`);
  }
  return bars.join('');
}

// user = { id, full_name, email, role } or null for an empty guest pass
export function badgeHtml(user, { hanging = false } = {}) {
  const role = user?.role || 'guest';
  return `
    <figure class="pass ${hanging ? 'pass-hanging' : ''}" data-role="${esc(role)}" aria-label="Access pass">
      ${hanging ? '<span class="lanyard" aria-hidden="true"></span>' : ''}
      <div class="pass-card">
        <span class="pass-slot" aria-hidden="true"></span>
        <header class="pass-head">
          <span class="pass-brand">Ticket.exe</span>
          <span class="pass-no" data-pass-no>${esc(passNumber(user?.id))}</span>
        </header>
        <div class="pass-photo" data-pass-initials aria-hidden="true">${esc(user ? initials(user.full_name) : '')}</div>
        <p class="pass-name" data-pass-name>${esc(user?.full_name || 'Your name here')}</p>
        <p class="pass-email" data-pass-email>${esc(user?.email || 'guest@eventbook.test')}</p>
        <div class="pass-band">
          <strong data-pass-role>${esc(roleLabel(role))}</strong>
          <span data-pass-access>${esc(ROLES[role]?.access || 'No access yet')}</span>
        </div>
        <div class="pass-code" aria-hidden="true">${barcode(user?.id)}</div>
      </div>
    </figure>`;
}

// Re-colour and re-label a badge that is already on the page
export function updateBadge(root, user) {
  const pass = root.querySelector('.pass');
  if (!pass) return;
  const set = (sel, text) => { const el = pass.querySelector(sel); if (el) el.textContent = text; };
  if (user.role) {
    pass.dataset.role = user.role;
    set('[data-pass-role]', roleLabel(user.role));
    set('[data-pass-access]', ROLES[user.role]?.access || '');
  }
  if (user.full_name !== undefined) {
    set('[data-pass-name]', user.full_name || 'Your name here');
    set('[data-pass-initials]', user.full_name ? initials(user.full_name) : '');
  }
  if (user.email !== undefined) set('[data-pass-email]', user.email || 'guest@eventbook.test');
  if (user.id) {
    set('[data-pass-no]', passNumber(user.id));
    pass.querySelector('.pass-code').innerHTML = barcode(user.id);
  }
}

export function roleChip(role) {
  return `<span class="chip" data-role="${esc(role)}">${esc(roleLabel(role))}</span>`;
}

export function statusChip(status) {
  return `<span class="status status-${esc(status)}">${status === 'active' ? 'Active' : 'Inactive'}</span>`;
}

// ---------- Form fields ----------
export function field({ name, label, type = 'text', value = '', hint = '', autocomplete = 'off', required = false, control }) {
  const input = control || `<input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}"
    autocomplete="${autocomplete}" ${required ? 'required' : ''}>`;
  return `
    <div class="field">
      <label for="f-${name}">${esc(label)}${required ? '' : ' <span class="optional">optional</span>'}</label>
      ${input}
      ${hint ? `<small class="hint">${esc(hint)}</small>` : ''}
      <small class="error-text" role="alert"></small>
    </div>`;
}

export function clearFormErrors(form) {
  form.querySelectorAll('.field.has-error').forEach((f) => f.classList.remove('has-error'));
  form.querySelectorAll('.error-text').forEach((e) => { e.textContent = ''; });
  const alert = form.querySelector('[data-form-alert]');
  if (alert) { alert.hidden = true; alert.textContent = ''; }
}

// details = [{ field, message }] from client checks or from the API's 422 response
export function showFormErrors(form, details, summary) {
  const unmatched = [];
  details.forEach(({ field: name, message }) => {
    const box = form.querySelector(`[name="${name}"]`)?.closest('.field');
    if (box) {
      box.classList.add('has-error');
      box.querySelector('.error-text').textContent = message;
    } else {
      unmatched.push(message);
    }
  });
  if (summary || unmatched.length) showFormAlert(form, [summary, ...unmatched].filter(Boolean).join(' '));
  form.querySelector('.has-error input, .has-error select')?.focus();
}

export function showFormAlert(form, message) {
  const alert = form.querySelector('[data-form-alert]');
  if (!alert) return toast(message, 'error');
  alert.textContent = message;
  alert.hidden = false;
}

// Puts an ApiError on a form: field errors for 422, a message for the rest
export function showApiError(form, err) {
  if (err.code === 'VALIDATION_ERROR' && err.details.length) return showFormErrors(form, err.details);
  if (err.code === 'CONFLICT' && /email/i.test(err.message)) {
    return showFormErrors(form, [{ field: 'email', message: err.message }]);
  }
  showFormAlert(form, err.message);
}

export function setBusy(button, busy, busyText) {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyText || 'Working…';
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}

// Client-side checks that mirror the API rules (the API checks again)
export const rules = {
  email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? '' : 'Enter a valid email address'),
  name: (v) => (v.trim().length >= 2 ? '' : 'Name must be at least 2 characters'),
  password: (v) => (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/.test(v)
    ? '' : 'Use 8+ characters with upper and lower case, a number and a symbol'),
  phone: (v) => (!v || /^(\+?60|0)1\d{8,9}$/.test(v.replace(/[\s-]/g, '')) ? '' : 'Use a Malaysian mobile number, e.g. 0123456789'),
};

export function check(pairs) {
  return pairs.map(([fieldName, message]) => (message ? { field: fieldName, message } : null)).filter(Boolean);
}

// ---------- Toast ----------
export function toast(message, type = 'ok') {
  const box = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.setAttribute('role', type === 'error' ? 'alert' : 'status');
  t.textContent = message;
  box.appendChild(t);
  setTimeout(() => t.classList.add('toast-out'), 3200);
  setTimeout(() => t.remove(), 3600);
}

// ---------- Dialog (uses the native <dialog> element) ----------
export function openDialog(html) {
  const dialog = document.getElementById('dialog');
  dialog.innerHTML = `<div class="dialog-body">${html}</div>`;
  dialog.showModal();
  dialog.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dialog.close()));
  return dialog;
}

export function closeDialog() {
  document.getElementById('dialog').close();
}

// Promise-based confirm, styled like the rest of the app
export function confirmDialog({ title, text, confirmLabel, danger = false }) {
  return new Promise((resolve) => {
    const dialog = openDialog(`
      <h2>${esc(title)}</h2>
      <p class="dialog-text">${esc(text)}</p>
      <div class="dialog-actions">
        <button class="btn btn-ghost" type="button" data-close>Cancel</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="button" data-ok>${esc(confirmLabel)}</button>
      </div>`);
    let ok = false;
    dialog.querySelector('[data-ok]').addEventListener('click', () => { ok = true; dialog.close(); });
    dialog.addEventListener('close', () => resolve(ok), { once: true });
  });
}

// ---------- Pager ----------
export function pagerHtml(meta) {
  if (!meta || meta.total_pages <= 1) return '';
  const { page, total_pages: pages, total } = meta;
  return `
    <nav class="pager" aria-label="Pages">
      <button class="btn btn-ghost btn-sm" type="button" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Previous</button>
      <span>Page ${page} of ${pages} <span class="muted">(${total} users)</span></span>
      <button class="btn btn-ghost btn-sm" type="button" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Next</button>
    </nav>`;
}
