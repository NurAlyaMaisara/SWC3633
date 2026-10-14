// =====================================================================
// Runtime configuration for the Staff frontend.
// API_KEY must match API_KEY in backend/.env
// (it is not a password: anyone using the app can see it).
// =====================================================================

export const CONFIG = {
  // Where the shared backend API is running
  API_BASE_URL: 'http://localhost:3000/api/v1',

  // Must match API_KEY in backend/.env
  API_KEY: 'ticketexe-local-key-2026',

  // Rows per page on list pages
  PAGE_SIZE: 8,
};

// One colour per role, like the colour-coded passes at a real event.
export const ROLES = {
  admin:     { label: 'Admin',     access: 'All areas' },
  organiser: { label: 'Organiser', access: 'Events & venues' },
  staff:     { label: 'Staff',     access: 'Event operations' },
  customer:  { label: 'Customer',  access: 'Ticket holder' },
};