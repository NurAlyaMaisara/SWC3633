// =====================================================================
// Entry point: a tiny hash router. The part after # in the address bar
// decides which page is drawn, e.g. #/events/9 shows event 9.
// =====================================================================
import { getSession, clearSession } from './session.js';
import { initials } from './ui.js';
import { renderLogin } from './pages/login.js';
import { renderEvents } from './pages/events.js';
import { renderEventForm } from './pages/eventForm.js';
import { renderEventDetail } from './pages/eventDetail.js';
import { renderVenues } from './pages/venues.js';
import { renderVenueForm } from './pages/venueForm.js';

const routes = [
  { pattern: /^#\/login$/, page: renderLogin, isPublic: true },
  { pattern: /^#\/events$/, page: renderEvents, nav: 'events' },
  { pattern: /^#\/events\/new$/, page: (el) => renderEventForm(el, null), nav: 'events' },
  { pattern: /^#\/events\/(\d+)\/edit$/, page: renderEventForm, nav: 'events' },
  { pattern: /^#\/events\/(\d+)$/, page: renderEventDetail, nav: 'events' },
  { pattern: /^#\/venues$/, page: renderVenues, nav: 'venues' },
  { pattern: /^#\/venues\/new$/, page: (el) => renderVenueForm(el, null), nav: 'venues' },
  { pattern: /^#\/venues\/(\d+)\/edit$/, page: renderVenueForm, nav: 'venues' },
];

const app = document.getElementById('app');

function updateSidebar(session, nav) {
  const sidebar = document.getElementById('sidebar');
  sidebar.hidden = !session;
  if (!session) return;
  const { full_name: name, role } = session.user;
  document.getElementById('user-name').textContent = name;
  document.getElementById('user-role').textContent = role;
  document.getElementById('user-avatar').textContent = initials(name);
  sidebar.querySelectorAll('[data-nav]').forEach((link) => {
    link.classList.toggle('active', link.dataset.nav === nav);
    link.toggleAttribute('aria-current', link.dataset.nav === nav);
  });
}

async function router() {
  const hash = location.hash || '#/events';
  const route = routes.find((r) => r.pattern.test(hash));
  const session = getSession();

  if (!route) { location.hash = '#/events'; return; }
  if (!route.isPublic && !session) { location.hash = '#/login'; return; }
  if (route.isPublic && session) { location.hash = '#/events'; return; }

  updateSidebar(session, route.nav);

  // Draw into a fresh element, so a slow page can't overwrite the next one
  const view = document.createElement('div');
  app.replaceChildren(view);
  window.scrollTo(0, 0);

  const params = hash.match(route.pattern).slice(1);
  await route.page(view, ...params);
}

document.getElementById('logout-btn').addEventListener('click', () => {
  clearSession();
  location.hash = '#/login';
});

window.addEventListener('hashchange', router);
router();
