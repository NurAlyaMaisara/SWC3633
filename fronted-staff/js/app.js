// =====================================================================
// Entry point: a tiny hash router. The part after # in the address bar
// decides which page is drawn, e.g. #/scan shows the scan page.
// =====================================================================
import { getSession, clearSession, isStaffRole } from './session.js';
import { esc, initials } from './ui.js';
import { renderLogin } from './pages/login.js';
import { renderScan } from './pages/scan.js';
import { renderAttendance } from './pages/attendance.js';

const routes = [
  { pattern: /^#\/login$/, page: renderLogin, isPublic: true },
  { pattern: /^#\/scan$/, page: renderScan, nav: 'scan' },
  { pattern: /^#\/attendance$/, page: renderAttendance, nav: 'attendance' },
];

const app = document.getElementById('app');
const topbar = document.getElementById('topbar');

function home() {
  return '#/scan';
}

function updateTopbar(session, nav) {
  topbar.hidden = !session;
  if (!session) return;
  const { full_name: name, role } = session.user;
  topbar.querySelector('[data-me]').innerHTML = `
    <span class="avatar" data-role="${esc(role)}" aria-hidden="true">${esc(initials(name))}</span>
    <span class="me-name">${esc(name)}</span>`;
  topbar.querySelectorAll('[data-nav]').forEach((link) => {
    const active = link.dataset.nav === nav;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
}

async function router() {
  const hash = location.hash || '#/login';
  const route = routes.find((r) => r.pattern.test(hash));
  const session = getSession();

  if (!route) { location.hash = session ? home() : '#/login'; return; }
  if (!route.isPublic && !session) { location.hash = '#/login'; return; }
  if (route.isPublic && session) { location.hash = home(); return; }
  // Only staff/admin/organiser can use this portal
  if (!route.isPublic && !isStaffRole()) { location.hash = '#/login'; return; }

  updateTopbar(session, route.nav);
  document.body.classList.toggle('is-gate', Boolean(route.isPublic));

  const view = document.createElement('div');
  view.className = 'view';
  app.replaceChildren(view);
  window.scrollTo(0, 0);
  await route.page(view, ...hash.match(route.pattern).slice(1));
}

document.getElementById('logout-btn').addEventListener('click', () => {
  clearSession();
  location.hash = '#/login';
});

document.addEventListener('session-changed', () => updateTopbar(getSession(), 'scan'));

window.addEventListener('hashchange', router);
router();