/**
 * Thin fetch wrapper that:
 *   - Prefixes requests with /api/v1 (Vite dev proxy routes this to localhost:8000).
 *   - Parses JSON.
 *   - Throws ApiError on non-2xx responses with the server's detail string.
 */

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const API_BASE = "/api/v1";

async function request(path, params) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  let response;
  try {
    response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    throw new ApiError(`Network error: ${err.message}`, 0, null);
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Body wasn't JSON; fall through
  }

  if (!response.ok) {
    const detail = body?.detail || response.statusText || `HTTP ${response.status}`;
    throw new ApiError(detail, response.status, body);
  }

  return body;
}

export const api = {
  geocode: (q, { limit = 5, lang = "en" } = {}) =>
    request("/geocode", { q, limit, lang }),
  sky: (lat, lon, datetime, { mag_limit = 6.5 } = {}) =>
    request("/sky", { lat, lon, datetime, mag_limit }),
  planets: (lat, lon, datetime) =>
    request("/planets", { lat, lon, datetime }),
};
