// Central API configuration & connection helpers.
//
// How the backend URL is resolved:
// 1. VITE_API_BASE_URL (set this in production, e.g. https://my-api.onrender.com)
// 2. Same origin ("") while running `npm run dev`, where Vite proxies /api
//    to http://localhost:8000 (see vite.config.js)
// 3. http://localhost:8000 as a fallback for production builds without config
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = (
  configuredBaseUrl || (import.meta.env.DEV ? '' : 'http://localhost:8000')
).replace(/\/+$/, '');

export const apiUrl = (path) => `${API_BASE_URL}${path}`;

export const isLocalApi = /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(API_BASE_URL);

const HEALTH_TIMEOUT_MS = 5000;

/**
 * Ping the backend health endpoint.
 * Never throws: returns { online: boolean, error?: unknown }.
 */
export async function checkBackendHealth(timeoutMs = HEALTH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl('/api/health'), {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      // A gateway error means the proxy/host could not reach the backend.
      // Any other status still proves the server itself answered.
      if (isGatewayError(response.status)) {
        return { online: false, error: new Error(`HTTP ${response.status}`) };
      }
      return { online: true, data: null };
    }

    return { online: true, data: await response.json().catch(() => ({})) };
  } catch (error) {
    return { online: false, error };
  } finally {
    clearTimeout(timer);
  }
}

export function isGatewayError(status) {
  return status === 502 || status === 503 || status === 504;
}

/** True when the request never reached the server (DNS, CORS, refused, offline). */
export function isNetworkError(error) {
  return error instanceof TypeError || error?.name === 'AbortError';
}

/**
 * Turn a low-level fetch error into an actionable message for the user.
 */
export function getConnectionErrorMessage(error) {
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
    return 'The conversion server did not respond in time. Please try again.';
  }

  const target = API_BASE_URL ? ` (${API_BASE_URL})` : '';
  const localHint = isLocalApi
    ? ' This build points to a local backend, so it only works while the server is running on your computer.'
    : '';

  return (
    `Cannot reach the conversion server${target}. ` +
    'Make sure the FastAPI backend is running: cd backend && python -m uvicorn main:app --reload.' +
    localHint
  );
}
