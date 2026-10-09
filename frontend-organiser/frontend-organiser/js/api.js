// =====================================================================
// The ONLY file that talks to the backend. Every page calls api.get/post/...
// It adds the API key and login headers, sends JSON, and turns error
// responses into an ApiError the pages can show.
// =====================================================================
import { CONFIG } from './config.js';
import { getSession } from './session.js';

export class ApiError extends Error {
  constructor(status, body, fallbackMessage) {
    super(body?.message || fallbackMessage || `Request failed (${status})`);
    this.status = status;                        // 0 = could not reach the server
    this.code = body?.error?.code || 'UNKNOWN';  // e.g. VALIDATION_ERROR, CONFLICT
    this.details = body?.error?.details || [];   // [{ field, message }]
  }
}

// Login headers: dev headers now, a JWT later. Only this function changes.
function authHeaders() {
  const session = getSession();
  if (!session) return {};
  if (CONFIG.AUTH_MODE === 'jwt') {
    return { Authorization: `Bearer ${session.token}` };
  }
  return {
    'x-dev-user-id': String(session.user.id),
    'x-dev-role': session.user.role,
  };
}

async function request(method, path, { query, body } = {}) {
  const url = new URL(CONFIG.API_BASE_URL + path);

  // Add only the query parameters that have a value
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  const headers = { 'x-api-key': CONFIG.API_KEY, ...authHeaders() };
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
    // Response had no JSON body
  }

  if (!response.ok) throw new ApiError(response.status, data);
  return data; // { success, message, data, meta? }
}

export const api = {
  get: (path, query) => request('GET', path, { query }),
  post: (path, body) => request('POST', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  del: (path) => request('DELETE', path),
};
