// =====================================================================
// Who is logged in. Stored in sessionStorage, so it is cleared when the
// browser tab closes.  session = { token, user: { id, full_name, email, role, ... } }
// =====================================================================
const KEY = 'ticketexe.access.session';

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

// Keep the token, replace the user (after editing the profile)
export function updateSessionUser(user) {
  const session = getSession();
  if (session) saveSession({ ...session, user: { ...session.user, ...user } });
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
