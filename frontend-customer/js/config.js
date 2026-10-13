// =====================================================================
// Settings for the Customer app. Change them here only.
// =====================================================================
export const CONFIG = {
  // Where the shared backend API is running
  API_BASE_URL: 'http://localhost:3000/api/v1',

  // Must match API_KEY in backend/.env (identifies this app; it is not a password)
  API_KEY: 'dev-key-123',

  // Only customers use this app; organisers and admins have their own frontends
  ALLOWED_ROLES: ['customer'],

  // Most tickets one booking can hold (same limit as the API)
  MAX_TICKETS: 10,

  // Rows per page on list pages
  PAGE_SIZE: 8,
};
