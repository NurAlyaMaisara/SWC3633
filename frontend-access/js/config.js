// =====================================================================
// Settings for the Access portal (Auth & Users). Change them here only.
// =====================================================================
export const CONFIG = {
  // Where the shared backend API is running
  API_BASE_URL: 'http://localhost:3000/api/v1',

  // Must match API_KEY in backend/.env. It identifies this app to the API
  // (it is not a password: anyone using the app can see it).
  API_KEY: 'dev-key-123',

  // Rows per page on the Users page
  PAGE_SIZE: 8,
};

// One colour per role, like the colour-coded passes at a real event.
// The same colours are used for the badge, the role chips and the table.
export const ROLES = {
  admin:     { label: 'Admin',     access: 'All areas' },
  organiser: { label: 'Organiser', access: 'Events & venues' },
  staff:     { label: 'Staff',     access: 'Event operations' },
  customer:  { label: 'Customer',  access: 'Ticket holder' },
};
