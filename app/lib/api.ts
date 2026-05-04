const BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || '') + '/api/v1';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ep_token');
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...opts.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export async function apiUpload<T = unknown>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: authHeaders() as Record<string, string>,
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export function downloadUrl(docId: string): string {
  return `${BASE}/documents/${docId}/download`;
}

export function getAuthHeaders(): Record<string, string> {
  return authHeaders() as Record<string, string>;
}

// Auth
export interface AuthUser {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  role: string;
  scopes: string[];
  stores: string[];
}

export function saveAuth(token: string, user: AuthUser) {
  localStorage.setItem('ep_token', token);
  localStorage.setItem('ep_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('ep_token');
  localStorage.removeItem('ep_user');
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('ep_user');
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function isAdmin(user: AuthUser | null): boolean {
  return !!user && ['ADMIN', 'CORPORATE'].includes(user.role);
}
