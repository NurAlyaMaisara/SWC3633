// =====================================================================
// Login & register page.
//   Sign in          -> POST /auth/login
//   Create account   -> POST /auth/register (always a customer account)
// The hanging access pass updates live while you type your name, and
// takes the colour of your role when the API accepts the login.
// =====================================================================
import { api } from '../api.js';
import { saveSession } from '../session.js';
import {
  esc, badgeHtml, updateBadge, field, clearFormErrors, showFormErrors, showFormAlert,
  showApiError, setBusy, rules, check, toast, roleLabel,
} from '../ui.js';

// Test accounts from database/seed.sql - handy for the demo video
const DEMO = [
  { email: 'admin@eventbook.test', password: 'Admin@123', name: 'System Admin', role: 'admin' },
  { email: 'wyatt@eventbook.test', password: 'Organiser@123', name: 'Wyatt Anderson', role: 'organiser' },
  { email: 'audrey@eventbook.test', password: 'Staff@123', name: 'Audrey Gomez', role: 'staff' },
  { email: 'kimi@eventbook.test', password: 'Customer@123', name: 'Kimi Antoneli', role: 'customer' },
];

export function renderLogin(el) {
  let mode = 'login';

  el.innerHTML = `
    <div class="gate">
      <section class="gate-stage" aria-hidden="false">
        ${badgeHtml(null, { hanging: true })}
        <p class="gate-caption" data-caption>Sign in to collect your pass.</p>
      </section>

      <section class="gate-panel">
        <div class="gate-box">
          <a class="wordmark" href="#/login">Ticket.exe <span>Access</span></a>

          <div class="tabs" role="tablist">
            <button type="button" role="tab" data-mode="login" aria-selected="true">Sign in</button>
            <button type="button" role="tab" data-mode="register" aria-selected="false">Create account</button>
          </div>

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

  function drawFields() {
    clearFormErrors(form);
    fieldsBox.innerHTML = mode === 'login'
      ? `${field({ name: 'email', label: 'Email', type: 'email', autocomplete: 'username', required: true })}
         ${field({ name: 'password', label: 'Password', type: 'password', autocomplete: 'current-password', required: true })}`
      : `${field({ name: 'full_name', label: 'Full name', autocomplete: 'name', required: true })}
         ${field({ name: 'email', label: 'Email', type: 'email', autocomplete: 'email', required: true })}
         ${field({ name: 'phone', label: 'Phone', type: 'tel', autocomplete: 'tel', hint: 'Malaysian mobile, e.g. 0123456789' })}
         ${field({ name: 'password', label: 'Password', type: 'password', autocomplete: 'new-password', required: true,
                   hint: '8+ characters with upper and lower case, a number and a symbol' })}`;
    submit.textContent = mode === 'login' ? 'Sign in' : 'Create account';
    el.querySelector('[data-demo]').hidden = mode !== 'login';
    caption.textContent = mode === 'login'
      ? 'Sign in to collect your pass.'
      : 'New accounts get a customer pass.';
    el.querySelectorAll('[data-mode]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.mode === mode)));
    updateBadge(el, { full_name: '', email: '' });

    // Live preview: the pass shows what you type
    if (mode === 'register') {
      form.full_name.addEventListener('input', () => updateBadge(el, { full_name: form.full_name.value.trim() }));
      form.email.addEventListener('input', () => updateBadge(el, { email: form.email.value.trim() }));
    }
    form.querySelector('input')?.focus();
  }

  el.querySelectorAll('[data-mode]').forEach((tab) => tab.addEventListener('click', () => {
    mode = tab.dataset.mode;
    drawFields();
  }));

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

    const errors = mode === 'login'
      ? check([['email', rules.email(v.email)], ['password', v.password ? '' : 'Password is required']])
      : check([['full_name', rules.name(v.full_name)], ['email', rules.email(v.email)],
               ['phone', rules.phone(v.phone || '')], ['password', rules.password(v.password)]]);
    if (errors.length) return showFormErrors(form, errors);

    setBusy(submit, true, mode === 'login' ? 'Checking…' : 'Creating…');
    try {
      const res = mode === 'login'
        ? await api.post('/auth/login', { email: v.email.trim(), password: v.password })
        : await api.post('/auth/register', {
            full_name: v.full_name.trim(), email: v.email.trim(), password: v.password, phone: v.phone || undefined,
          });

      const { token, user } = res.data;
      saveSession({ token, user });

      // The moment of truth: the pass is issued in the colour of your role
      updateBadge(el, user);
      el.querySelector('.pass').classList.add('pass-issued');
      caption.textContent = `Pass issued: ${roleLabel(user.role)}`;
      toast(mode === 'login' ? `Welcome back, ${user.full_name}` : 'Account created');
      setTimeout(() => { location.hash = user.role === 'admin' ? '#/users' : '#/profile'; }, 1100);
    } catch (err) {
      setBusy(submit, false);
      if (err.code === 'INVALID_CREDENTIALS') return showFormAlert(form, 'Wrong email or password.');
      showApiError(form, err);
    }
  });

  drawFields();
}
