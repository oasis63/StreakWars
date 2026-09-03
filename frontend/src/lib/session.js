import { API_BASE_URL } from '../config';

const USER_KEY = 'streakwars_user';
const TOKEN_KEY = 'streakwars_token';

export function loadSessionUser() {
  try {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function saveSession(user) {
  if (!user) {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  if (user.token) localStorage.setItem(TOKEN_KEY, user.token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : {};
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function navigate(to) {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function parseRoute() {
  const path = (window.location.pathname.replace(/\/$/, '') || '/');
  if (path.startsWith('/superadmin')) return { name: 'superadmin' };
  if (path.startsWith('/create')) return { name: 'create' };
  if (path.startsWith('/join/')) return { name: 'join', code: decodeURIComponent(path.slice(6)) };
  const match = path.match(/^\/c\/(\d+)/);
  if (match) return { name: 'challenge', id: match[1] };
  return { name: 'home' };
}
