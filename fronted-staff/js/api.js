// =====================================================================
// The ONLY file that talks to the backend. Every page calls api.get/post/...
// It adds the x-api-key header and the JWT (Authorization: Bearer ...),
// sends JSON, and turns error responses into an ApiError the pages can show.
// =====================================================================
import { CONFIG } from './config.js';
import { getSession, clearSession } from './session.js';

export class ApiError extends Error {
  constructor(status, body, fallbackMessage) {
    super(body?.message || fallbackMessage || `Request failed (${status})`);
    this.status = status;                        // 0 = could not reach the server
    this.code = body?.error?.code || 'UNKNOWN';  // e.g. VALIDATION_ERROR, CONFLICT
    this.details = body?.error?.details || [];   // [{ field, message }]
  }
}

async function request(method, path, { query, body } = {}) {
  const url = new URL(CONFIG.API_BASE_URL + path);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });

  const headers = { 'x-api-key': CONFIG.API_KEY };
  const session = getSession();
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, null, 'Cannot reach the API. Check that the backend is running (npm run dev).');
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // no JSON body
  }

  if (!response.ok) {
    const error = new ApiError(response.status, data);
    // Token expired, invalid, or the account was deactivated: log out.
    // (Login itself also returns 401/403, so only do this when we had a token.)
    const sessionDead = response.status === 401 || error.code === 'ACCOUNT_INACTIVE';
    if (session?.token && sessionDead) {
      clearSession();
      sessionStorage.setItem('ticketexe.access.notice', error.message);
      location.hash = '#/login';
    }
    throw error;
  }
  return data; // { success, message, data, meta? }
}

export const api = {
  get: (path, query) => request('GET', path, { query }),
  post: (path, body) => request('POST', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  del: (path) => request('DELETE', path),
};