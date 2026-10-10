// =====================================================================
// My pass (profile) page - every role.
//   GET /auth/me          load my details
//   PUT /users/:id        update my name, email, phone
//   PUT /auth/password    change my password
// =====================================================================
import { api } from '../api.js';
import { updateSessionUser } from '../session.js';
import {
  esc, badgeHtml, updateBadge, field, clearFormErrors, showFormErrors, showApiError,
  setBusy, rules, check, toast, formatDate, roleLabel,
} from '../ui.js';
import { ROLES } from '../config.js';

export async function renderProfile(el) {
  el.innerHTML = '<div class="state"><span class="spinner"></span>Loading your pass…</div>';

  let me;
  try {
    me = (await api.get('/auth/me')).data;
  } catch (err) {
    el.innerHTML = `<div class="state"><h2>Your pass could not be loaded</h2><p>${esc(err.message)}</p></div>`;
    return;
  }

  el.innerHTML = `
    <div class="profile">
      <aside class="profile-pass">
        ${badgeHtml(me)}
        <dl class="facts">
          <div><dt>Access</dt><dd>${esc(ROLES[me.role]?.access)}</dd></div>
          <div><dt>Status</dt><dd>${me.status === 'active' ? 'Active' : 'Inactive'}</dd></div>
          <div><dt>Member since</dt><dd>${esc(formatDate(me.created_at))}</dd></div>
        </dl>
      </aside>

      <div class="profile-forms">
        <header class="page-head">
          <h1>My pass</h1>
          <p class="lede">Keep your details up to date. Your role is set by an administrator.</p>
        </header>

        <form class="panel" id="details-form" novalidate>
          <h2>Details</h2>
          <div class="alert" data-form-alert hidden></div>
          <div class="grid-2">
            ${field({ name: 'full_name', label: 'Full name', value: me.full_name, autocomplete: 'name', required: true })}
            ${field({ name: 'phone', label: 'Phone', type: 'tel', value: me.phone || '', autocomplete: 'tel' })}
          </div>
          ${field({ name: 'email', label: 'Email', type: 'email', value: me.email, autocomplete: 'email', required: true })}
          <div class="panel-foot">
            <span class="muted">Role: ${esc(roleLabel(me.role))}</span>
            <button class="btn btn-primary" type="submit">Save details</button>
          </div>
        </form>

        <form class="panel" id="password-form" novalidate>
          <h2>Password</h2>
          <div class="alert" data-form-alert hidden></div>
          ${field({ name: 'current_password', label: 'Current password', type: 'password', autocomplete: 'current-password', required: true })}
          <div class="grid-2">
            ${field({ name: 'new_password', label: 'New password', type: 'password', autocomplete: 'new-password', required: true,
                      hint: '8+ characters, upper and lower case, a number and a symbol' })}
            ${field({ name: 'confirm_password', label: 'Repeat new password', type: 'password', autocomplete: 'new-password', required: true })}
          </div>
          <div class="panel-foot">
            <span></span>
            <button class="btn btn-primary" type="submit">Change password</button>
          </div>
        </form>
      </div>
    </div>`;

  // ----- Save details -----
  const details = el.querySelector('#details-form');
  details.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(details);
    const v = Object.fromEntries(new FormData(details));
    const errors = check([['full_name', rules.name(v.full_name)], ['email', rules.email(v.email)], ['phone', rules.phone(v.phone)]]);
    if (errors.length) return showFormErrors(details, errors);

    const button = details.querySelector('[type="submit"]');
    setBusy(button, true, 'Saving…');
    try {
      const res = await api.put(`/users/${me.id}`, {
        full_name: v.full_name.trim(), email: v.email.trim(), phone: v.phone.trim(),
      });
      me = res.data;
      updateSessionUser(me);
      updateBadge(el, me);
      document.dispatchEvent(new CustomEvent('session-changed'));
      toast('Details saved');
    } catch (err) {
      showApiError(details, err);
    } finally {
      setBusy(button, false);
    }
  });

  // ----- Change password -----
  const pw = el.querySelector('#password-form');
  pw.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(pw);
    const v = Object.fromEntries(new FormData(pw));
    const errors = check([
      ['current_password', v.current_password ? '' : 'Enter your current password'],
      ['new_password', rules.password(v.new_password) || (v.new_password === v.current_password ? 'Choose a different password' : '')],
      ['confirm_password', v.confirm_password === v.new_password ? '' : 'Passwords do not match'],
    ]);
    if (errors.length) return showFormErrors(pw, errors);

    const button = pw.querySelector('[type="submit"]');
    setBusy(button, true, 'Changing…');
    try {
      await api.put('/auth/password', { current_password: v.current_password, new_password: v.new_password });
      pw.reset();
      toast('Password changed');
    } catch (err) {
      if (err.code === 'WRONG_PASSWORD') showFormErrors(pw, [{ field: 'current_password', message: 'Current password is incorrect' }]);
      else showApiError(pw, err);
    } finally {
      setBusy(button, false);
    }
  });
}
