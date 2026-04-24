
import { auth } from './auth.js';

export async function apiFetch(url, options = {}) {
  const idToken = await auth.getToken();

  const headers = {
    ...options.headers,
    "Content-Type": "application/json",
  };
  if (idToken) headers["Authorization"] = `Bearer ${idToken}`;

  const response = await fetch(url, { ...options, headers });

  if (response.status === 404) return null;

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  } else {
    return response.text();
  }
}

export async function publicFetch(url, options = {}) {
  const headers = {
    ...options.headers,
    "Content-Type": "application/json",
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 404) return null;

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status} from ${url}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  } else {
    return response.text();
  }
}
