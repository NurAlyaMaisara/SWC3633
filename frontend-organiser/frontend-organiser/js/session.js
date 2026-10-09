// =====================================================================
// Who is logged in. Stored in sessionStorage, so it is cleared when the
// browser tab closes.
// =====================================================================
const KEY = 'ticketexe.organiser.session';

export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

// session = { user: { id, full_name, role }, token? }
export function saveSession(session) {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(KEY);
}

export function currentUser() {
  return getSession()?.user || null;
}

export function isAdmin() {
  return currentUser()?.role === 'admin';
}

// Same rule as the backend: admins manage everything, organisers only what they own.
// The API still checks this; hiding buttons here is only for a clearer interface.
export function canManage(ownerId) {
  const user = currentUser();
  if (!user) return false;
  return user.role === 'admin' || Number(user.id) === Number(ownerId);
}
