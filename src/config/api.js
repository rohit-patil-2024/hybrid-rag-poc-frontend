const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:3001").replace(/\/$/, "");
const ACCESS_TOKEN_STORAGE_KEY = "graphrag_access_token";

export function buildApiUrl(path) {
  const normalizedPath = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function getAccessToken() {
  return String(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || "").trim();
}

export function setAccessToken(token) {
  const normalizedToken = String(token || "").trim();
  if (normalizedToken) {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, normalizedToken);
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function appendAccessToken(path, tokenOverride) {
  const token = String(tokenOverride || getAccessToken() || "").trim();
  const url = new URL(buildApiUrl(path));
  if (token) {
    url.searchParams.set("accessToken", token);
  }
  return url.toString();
}

export async function authedFetch(path, options = {}) {
  const token = getAccessToken();
  const nextHeaders = new Headers(options.headers || {});

  if (token) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  return fetch(buildApiUrl(path), {
    ...options,
    headers: nextHeaders,
  });
}

export async function validateAccessToken(token) {
  const response = await fetch(buildApiUrl("/auth/validate"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token: String(token || "").trim() }),
  });

  const payload = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    message: payload?.message || (response.ok ? "Token validated." : "Token validation failed."),
  };
}

export { API_BASE_URL };
