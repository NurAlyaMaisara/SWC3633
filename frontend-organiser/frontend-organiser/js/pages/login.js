// =====================================================================
// Login page.
// Dev mode: pick a test account (until the Auth lead's login is ready).
// JWT mode: email + password, calling POST /auth/login.
// Only organisers and admins are allowed into this portal.
// =====================================================================
import { CONFIG, DEV_ACCOUNTS } from '../config.js';
import { api } from '../api.js';
import { saveSession } from '../session.js';
import { esc, initials, fieldHtml, clearFormErrors, showFormErrors, showFormAlert, setBusy, toast } from '../ui.js';

function startSession(user, token) {
  if (!CONFIG.ALLOWED_ROLES.includes(user.role)) {
    return `Access denied: the Organiser portal is only for organisers and admins. You are logged in as a ${user.role}.`;
  }
  saveSession({ user, token });
  toast(`Signed in as ${user.full_name}`);
  location.hash = '#/events';
  return null;
}

export function renderLogin(el) {
  const devMode = CONFIG.AUTH_MODE === 'dev';

  el.innerHTML = `
    <div class="login">
      <section class="login-hero">
        <span class="brand">
          <svg class="brand-mark" viewBox="0 0 32 22" aria-hidden="true">
            <path d="M3 1h26a2 2 0 0 1 2 2v5a3 3 0 0 0 0 6v5a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-5a3 3 0 0 0 0-6V3a2 2 0 0 1 2-2z"/>
            <path class="brand-perf" d="M21 4v14"/>
          </svg>
          <span class="brand-text">Ticket.exe</span>
        </span>
        <div class="hero-ticket" aria-hidden="true"></div>
        <div class="hero-copy">
          <h1>Every seat, <span>scheduled.</span></h1>
          <p>Create events, book venues without clashes and control ticket stock from one console.</p>
        </div>
        <p class="hero-foot">Organiser console for event organisers and admins</p>
      </section>

      <section class="login-panel">
        <form class="login-box" id="login-form" novalidate>
          <h2>Sign in</h2>
          <p class="muted">${devMode ? 'Choose a test account to continue.' : 'Use your Ticket.exe organiser account.'}</p>
          <div class="alert alert-error" data-form-alert hidden></div>
          ${devMode ? `
            <div class="account-list">
              ${DEV_ACCOUNTS.map((a) => `
                <button class="account" type="button" data-id="${a.id}">
                  <span class="avatar" aria-hidden="true">${esc(initials(a.full_name))}</span>
                  <span class="account-text"><strong>${esc(a.full_name)}</strong><small>${esc(a.role)} · user ${a.id}</small></span>
                  <svg class="account-go" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
                </button>`).join('')}
            </div>
            <p class="dev-note">Development sign-in. The real email and password login comes from the Auth &amp; Users module.</p>
          ` : `
            <div class="form-grid" style="grid-template-columns:1fr">
              ${fieldHtml({ name: 'email', label: 'Email', required: true, control: '<input id="f-email" name="email" type="email" autocomplete="username">' })}
              ${fieldHtml({ name: 'password', label: 'Password', required: true, control: '<input id="f-password" name="password" type="password" autocomplete="current-password">' })}
            </div>
            <div class="form-footer" style="border:0;padding-top:0"><button class="btn btn-primary" type="submit" style="width:100%">Sign in</button></div>
          `}
        </form>
      </section>
    </div>`;

  const form = el.querySelector('#login-form');

  if (devMode) {
    form.querySelectorAll('[data-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const account = DEV_ACCOUNTS.find((a) => a.id === Number(button.dataset.id));
        const denied = startSession(account);
        if (denied) showFormAlert(form, denied);
      });
    });
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);
    const email = form.email.value.trim();
    const password = form.password.value;

    const errors = [];
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.push({ field: 'email', message: 'Enter a valid email address' });
    if (!password) errors.push({ field: 'password', message: 'Password is required' });
    if (errors.length) return showFormErrors(form, errors);

    const button = form.querySelector('[type="submit"]');
    setBusy(button, true, 'Logging in…');
    try {
      // To confirm with the Auth lead: response shape { data: { token, user } }
      const res = await api.post('/auth/login', { email, password });
      const denied = startSession(res.data.user, res.data.token);
      if (denied) showFormAlert(form, denied);
    } catch (err) {
      showFormAlert(form, err.status === 401 ? 'Wrong email or password.' : err.message);
    } finally {
      setBusy(button, false);
    }
  });
}
