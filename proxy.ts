import { NextRequest, NextResponse } from 'next/server';

// Guards the workflow-builder API routes: the caller's portal token must be accepted by the
// TakeTenDash backend (same /auth/profile check the SSO page uses).
const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || '') + '/api/v1';
const CACHE_MS = 60_000;
const cache = new Map<string, number>();

export async function proxy(req: NextRequest) {
  // Local development only (never honoured in production builds).
  if (process.env.NODE_ENV !== 'production' && process.env.WORKFLOW_AUTH_DISABLED === '1') return NextResponse.next();

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const seen = cache.get(token);
  if (seen && seen > Date.now()) return NextResponse.next();

  try {
    const res = await fetch(`${BACKEND}/auth/profile`, { headers: { Authorization: auth } });
    if (!res.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Auth service unavailable' }, { status: 503 });
  }
  cache.set(token, Date.now() + CACHE_MS);
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/workflows/:path*',
    '/api/roles/:path*',
    '/api/role-groups/:path*',
    '/api/locations/:path*',
    '/api/bins/:path*',
    '/api/paths/:path*',
  ],
};
