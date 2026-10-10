// =====================================================================
// Settings for the Organiser portal. Change them here only.
// =====================================================================
export const CONFIG = {
  // Where the shared backend API is running
  API_BASE_URL: 'http://localhost:3000/api/v1',

  // Must match API_KEY in backend/.env. It identifies this app to the API
  // (it is not a password: anyone using the app can see it).
  API_KEY: 'dev-key-123',

  // 'dev' = log in by picking a test account (uses the x-dev-* headers)
  // 'jwt' = real email + password login, once the Auth lead's /auth/login is ready
  AUTH_MODE: 'jwt',

  // Only these roles may use the Organiser portal
  ALLOWED_ROLES: ['organiser', 'admin'],

  // Rows per page on list pages
  PAGE_SIZE: 8,
};

// Test accounts for dev mode. Same ids and roles as database/01_dev_users_stub.sql
export const DEV_ACCOUNTS = [
  { id: 2, full_name: 'Wyatt Anderson', role: 'organiser' },
  { id: 3, full_name: 'Damon Vance', role: 'organiser' },
  { id: 1, full_name: 'System Admin', role: 'admin' },
  { id: 5, full_name: 'Kimi Antoneli', role: 'customer' }, // to demo "access denied"
];
