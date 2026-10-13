// =====================================================================
// Who is logged in. Kept in sessionStorage, so it clears when the tab closes.
// session = { user: { id, full_name, email, role }, token }
// =====================================================================
const KEY = 'ticketexe.customer.session';
const RETURN_KEY = 'ticketexe.customer.return';

export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function saveSession(session) {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(KEY);
}

export function currentUser() {
  return getSession()?.user || null;
}

// Remember where a guest was going, so login can send them back there
export function setReturnTo(hash) {
  sessionStorage.setItem(RETURN_KEY, hash);
}

export function takeReturnTo() {
  const hash = sessionStorage.getItem(RETURN_KEY);
  sessionStorage.removeItem(RETURN_KEY);
  return hash || '#/events';
}
