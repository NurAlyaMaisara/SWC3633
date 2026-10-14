// =====================================================================
// Log in (POST /auth/login) or create an account (POST /auth/register).
// Only customers may use this app; other roles are turned away.
// The poster wall on the left uses the public GET /events.
// =====================================================================
import { api } from '../api.js';
import { CONFIG } from '../config.js';
import { saveSession, takeReturnTo } from '../session.js';
import { posterHtml } from '../poster.js';
import {
  fieldHtml, clearFormErrors, showFormErrors, showFormAlert, setBusy, toast,
} from '../ui.js';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/;

function formHtml(mode) {
  const register = mode === 'register';
  return `
    <form class="auth-form" novalidate>
      <div class="form-alert" data-form-alert hidden></div>
      ${register ? fieldHtml({ name: 'full_name', label: 'Full name', required: true,
        control: '<input id="f-full_name" name="full_name" autocomplete="name" maxlength="100">' }) : ''}
      ${fieldHtml({ name: 'email', label: 'Email', required: true,
        control: '<input id="f-email" name="email" type="email" autocomplete="email" placeholder="you@example.com">' })}
      ${fieldHtml({ name: 'password', label: 'Password', required: true,
        hint: register ? '8 to 64 characters with upper and lower case, a number and a symbol' : '',
        control: `<span class="pw"><input id="f-password" name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}"><button type="button" class="pw-toggle" aria-label="Show password" data-show>Show</button></span>` })}
      ${register ? fieldHtml({ name: 'phone', label: 'Mobile number', hint: 'Optional, e.g. 0123456789',
        control: '<input id="f-phone" name="phone" type="tel" autocomplete="tel">' }) : ''}
      <button class="btn btn-ink btn-lg btn-block" type="submit">${register ? 'Create account' : 'Log in'}</button>
    </form>`;
}

export function renderLogin(view) {
  let mode = 'login';

  view.innerHTML = `
    <section class="auth">
      <div class="auth-wall" data-wall>
        <h1>Your next night out starts here.</h1>
        <p>Concerts, workshops, matches and shows across Malaysia. Pick a date, pay, and your ticket is ready.</p>
        <div class="wall" data-posters></div>
      </div>
      <div class="auth-card">
        <div class="tabs" role="tablist" aria-label="Log in or create account">
          <button type="button" role="tab" data-mode="login" aria-selected="true">Log in</button>
          <button type="button" role="tab" data-mode="register" aria-selected="false">Create account</button>
        </div>
        <div data-form></div>
        <p class="auth-note">Demo customer: <strong>kimi@eventbook.test</strong> / <strong>Customer@123</strong></p>
        <a class="auth-browse" href="#/events">Browse events without logging in</a>
      </div>
    </section>`;

  // Decorative poster wall from real published events
  api.get('/events', { limit: 3, sort: 'next_start_time' }).then((res) => {
    view.querySelector('[data-posters]').innerHTML = res.data.map((e) => posterHtml(e, { size: 'card' })).join('');
  }).catch(() => {});

  const holder = view.querySelector('[data-form]');

  function draw() {
    holder.innerHTML = formHtml(mode);
    view.querySelectorAll('[data-mode]').forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.mode === mode)));
    const form = holder.querySelector('form');
    form.addEventListener('submit', (e) => submit(e, form));
    form.querySelector('[data-show]').addEventListener('click', (e) => {
      const input = form.password;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      e.target.textContent = show ? 'Hide' : 'Show';
      e.target.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
    form.querySelector('input').focus();
  }

  function check(values) {
    const errors = [];
    if (mode === 'register' && values.full_name.length < 2) errors.push({ field: 'full_name', message: 'Enter your full name' });
    if (!/^\S+@\S+\.\S+$/.test(values.email)) errors.push({ field: 'email', message: 'Enter a valid email address' });
    if (!values.password) errors.push({ field: 'password', message: 'Enter your password' });
    else if (mode === 'register' && !PASSWORD_RULE.test(values.password)) {
      errors.push({ field: 'password', message: 'Use 8 to 64 characters with upper and lower case, a number and a symbol' });
    }
    if (mode === 'register' && values.phone && !/^01\d{8,9}$/.test(values.phone)) {
      errors.push({ field: 'phone', message: 'Enter a Malaysian mobile number, e.g. 0123456789' });
    }
    return errors;
  }

  async function submit(event, form) {
    event.preventDefault();
    clearFormErrors(form);
    const values = {
      full_name: form.full_name?.value.trim() || '',
      email: form.email.value.trim(),
      password: form.password.value,
      phone: form.phone?.value.trim() || '',
    };
    const errors = check(values);
    if (errors.length) { showFormErrors(form, errors); return; }

    const button = form.querySelector('button[type="submit"]');
    setBusy(button, true, mode === 'register' ? 'Creating account…' : 'Logging in…');
    try {
      const body = mode === 'register'
        ? { full_name: values.full_name, email: values.email, password: values.password, ...(values.phone ? { phone: values.phone } : {}) }
        : { email: values.email, password: values.password };
      const res = await api.post(mode === 'register' ? '/auth/register' : '/auth/login', body);
      const { user, token } = res.data;
      if (!CONFIG.ALLOWED_ROLES.includes(user.role)) {
        showFormAlert(form, `This app is for customers. ${user.full_name} has the ${user.role} role, so please use the ${user.role} app instead.`);
        return;
      }
      saveSession({ user, token });
      toast(mode === 'register' ? `Welcome to Ticket.exe, ${user.full_name}.` : `Welcome back, ${user.full_name}.`);
      location.hash = takeReturnTo();
    } catch (err) {
      // A 401 here means wrong email or password, not an expired login
      if (err.details.length) showFormErrors(form, err.details, err.message);
      else showFormAlert(form, err.message);
    } finally {
      setBusy(button, false);
    }
  }

  view.querySelectorAll('[data-mode]').forEach((tab) => tab.addEventListener('click', () => {
    mode = tab.dataset.mode;
    draw();
  }));
  draw();
}
