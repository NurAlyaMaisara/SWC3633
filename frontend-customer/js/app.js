// =====================================================================
// Entry point: a small hash router. The part after # decides the page,
// e.g. #/events/1 shows event 1. Guests can browse events; booking and
// My tickets need a login.
// =====================================================================
import { getSession, clearSession, setReturnTo } from './session.js';
import { esc, initials, toast } from './ui.js';
import { renderLogin } from './pages/login.js';
import { renderEvents } from './pages/events.js';
import { renderEventDetail } from './pages/eventDetail.js';
import { renderCheckout } from './pages/checkout.js';
import { renderBookings } from './pages/bookings.js';
import { renderBookingDetail } from './pages/bookingDetail.js';

const routes = [
  { pattern: /^#\/login$/, page: renderLogin, guestOnly: true },
  { pattern: /^#\/events$/, page: renderEvents, nav: 'events', open: true },
  { pattern: /^#\/events\/(\d+)$/, page: renderEventDetail, nav: 'events', open: true },
  { pattern: /^#\/bookings$/, page: renderBookings, nav: 'bookings' },
  { pattern: /^#\/bookings\/(\d+)\/pay$/, page: renderCheckout, nav: 'bookings' },
  { pattern: /^#\/bookings\/(\d+)$/, page: renderBookingDetail, nav: 'bookings' },
];

const app = document.getElementById('app');

function drawAccount(session) {
  const box = document.getElementById('account');
  if (!session) {
    box.innerHTML = '<a class="btn btn-ink btn-sm" href="#/login">Log in</a>';
    return;
  }
  const { full_name: name, email } = session.user;
  box.innerHTML = `
    <details class="menu">
      <summary aria-label="Account menu"><span class="avatar">${esc(initials(name))}</span><span class="menu-name">${esc(name.split(' ')[0])}</span></summary>
      <div class="menu-panel">
        <strong>${esc(name)}</strong>
        <span>${esc(email || '')}</span>
        <a href="#/bookings">My tickets</a>
        <button type="button" data-logout>Log out</button>
      </div>
    </details>`;
  box.querySelector('[data-logout]').addEventListener('click', () => {
    clearSession();
    toast('You are logged out.');
    location.hash = '#/events';
    drawAccount(null);
  });
}

function markNav(nav) {
  document.querySelectorAll('.nav [data-nav]').forEach((link) => {
    const active = link.dataset.nav === nav;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
}

async function router() {
  const full = location.hash || '#/events';
  const [hash, queryString] = full.split('?');
  const query = new URLSearchParams(queryString || '');
  const route = routes.find((r) => r.pattern.test(hash));
  const session = getSession();

  if (!route) { location.hash = '#/events'; return; }
  if (!route.open && !route.guestOnly && !session) {
    setReturnTo(full);
    location.hash = '#/login';
    return;
  }
  if (route.guestOnly && session) { location.hash = '#/events'; return; }

  drawAccount(session);
  markNav(route.nav);
  document.body.dataset.page = route.nav || 'login';
  document.querySelector('.menu')?.removeAttribute('open');

  // Draw into a fresh element, so a slow page can't overwrite the next one
  const view = document.createElement('div');
  view.className = 'view';
  app.replaceChildren(view);
  window.scrollTo(0, 0);

  const params = hash.match(route.pattern).slice(1);
  await route.page(view, ...params, query);
}

window.addEventListener('hashchange', router);
router();
