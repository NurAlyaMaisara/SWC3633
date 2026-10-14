// =====================================================================
// Staff login page (Integration & API Management Lead)
//   Sign in -> POST /auth/login (JWT)
// Only staff, admin and organiser accounts can use the Staff portal.
// =====================================================================
import { api } from '../api.js';
import { saveSession } from '../session.js';
import {
  esc, badgeHtml, updateBadge, field, clearFormErrors, showFormErrors, showFormAlert,
  showApiError, setBusy, rules, check, toast, roleLabel,
} from '../ui.js';

// Test accounts from database/seed.sql - handy for the demo video
const DEMO = [
  { email: 'audrey@eventbook.test', password: 'Staff@123', name: 'Audrey Gomez', role: 'staff' },
  { email: 'admin@eventbook.test', password: 'Admin@123', name: 'System Admin', role: 'admin' },
  { email: 'wyatt@eventbook.test', password: 'Organiser@123', name: 'Wyatt Anderson', role: 'organiser' },
];

export function renderLogin(el) {
  el.innerHTML = `
    <div class="gate">
      <section class="gate-stage" aria-hidden="false">
        ${badgeHtml(null, { hanging: true })}
        <p class="gate-caption" data-caption>Sign in to start checking in tickets.</p>
      </section>

      <section class="gate-panel">
        <div class="gate-box">
          <a class="wordmark" href="#/login">Ticket.exe <span>Staff</span></a>

          <h2 class="gate-title">Staff sign in</h2>
          <p class="muted">Only staff, admin and organiser accounts can access this portal.</p>

          <form id="auth-form" novalidate>
            <div class="alert" data-form-alert hidden></div>
            <div data-fields></div>
            <button class="btn btn-primary btn-block" type="submit" data-submit>Sign in</button>
          </form>

          <div class="demo" data-demo>
            <p class="demo-title">Test accounts</p>
            <div class="demo-list">
              ${DEMO.map((d, i) => `
                <button type="button" class="demo-item" data-demo-i="${i}">
                  <span class="dot" data-role="${d.role}"></span>
                  <span><strong>${esc(d.name)}</strong><small>${esc(roleLabel(d.role))}</small></span>
                </button>`).join('')}
            </div>
          </div>
        </div>
      </section>
    </div>`;

  const form = el.querySelector('#auth-form');
  const fieldsBox = form.querySelector('[data-fields]');
  const submit = form.querySelector('[data-submit]');
  const caption = el.querySelector('[data-caption]');

  // A message left behind when the session expired (see api.js)
  const notice = sessionStorage.getItem('ticketexe.access.notice');
  if (notice) {
    sessionStorage.removeItem('ticketexe.access.notice');
    showFormAlert(form, `${notice}`);
  }

  fieldsBox.innerHTML = `
    ${field({ name: 'email', label: 'Email', type: 'email', autocomplete: 'username', required: true })}
    ${field({ name: 'password', label: 'Password', type: 'password', autocomplete: 'current-password', required: true })}`;

  updateBadge(el, { full_name: '', email: '' });
  form.querySelector('input')?.focus();

  el.querySelectorAll('[data-demo-i]').forEach((btn) => btn.addEventListener('click', () => {
    const d = DEMO[Number(btn.dataset.demoI)];
    form.email.value = d.email;
    form.password.value = d.password;
    submit.focus();
  }));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);
    const v = Object.fromEntries(new FormData(form));

    const errors = check([
      ['email', rules.email(v.email)],
      ['password', v.password ? '' : 'Password is required'],
    ]);
    if (errors.length) return showFormErrors(form, errors);

    setBusy(submit, true, 'Checking…');
    try {
      const res = await api.post('/auth/login', { email: v.email.trim(), password: v.password });
      const { token, user } = res.data;

      // Only staff / admin / organiser may enter this portal
      if (!['staff', 'admin', 'organiser'].includes(user.role)) {
        setBusy(submit, false);
        return showFormAlert(form, 'This portal is for staff only. Please use the customer app to book tickets.');
      }

      saveSession({ token, user });
      updateBadge(el, user);
      el.querySelector('.pass')?.classList.add('pass-issued');
      caption.textContent = `Pass issued: ${roleLabel(user.role)}`;
      toast(`Welcome back, ${user.full_name}`);
      setTimeout(() => { location.hash = '#/scan'; }, 900);
    } catch (err) {
      setBusy(submit, false);
      if (err.code === 'INVALID_CREDENTIALS') return showFormAlert(form, 'Wrong email or password.');
      showApiError(form, err);
    }
  });
}