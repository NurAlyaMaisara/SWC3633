// =====================================================================
// Entry point: a tiny hash router. The part after # in the address bar
// decides which page is drawn, e.g. #/users shows the People page.
// =====================================================================
import { getSession, clearSession, isAdmin } from './session.js';
import { esc, initials } from './ui.js';
import { renderLogin } from './pages/login.js';
import { renderProfile } from './pages/profile.js';
import { renderUsers } from './pages/users.js';

const routes = [
  { pattern: /^#\/login$/, page: renderLogin, isPublic: true },
  { pattern: /^#\/profile$/, page: renderProfile, nav: 'profile' },
  { pattern: /^#\/users$/, page: renderUsers, nav: 'users', adminOnly: true },
];

const app = document.getElementById('app');
const topbar = document.getElementById('topbar');

function home() {
  return isAdmin() ? '#/users' : '#/profile';
}

function updateTopbar(session, nav) {
  topbar.hidden = !session;
  if (!session) return;
  const { full_name: name, role } = session.user;
  topbar.querySelector('[data-me]').innerHTML = `
    <span class="avatar" data-role="${esc(role)}" aria-hidden="true">${esc(initials(name))}</span>
    <span class="me-name">${esc(name)}</span>`;
  topbar.querySelector('[data-nav="users"]').hidden = role !== 'admin';
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
  // Hiding the link is only for clarity: the API also returns 403 to non-admins
  if (route.adminOnly && !isAdmin()) { location.hash = '#/profile'; return; }

  updateTopbar(session, route.nav);
  document.body.classList.toggle('is-gate', Boolean(route.isPublic));

  // Draw into a fresh element, so a slow page can't overwrite the next one
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

// Name changed on the profile page -> refresh the top bar
document.addEventListener('session-changed', () => updateTopbar(getSession(), 'profile'));

window.addEventListener('hashchange', router);
router();
