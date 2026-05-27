'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { saveAuth, AuthUser } from '../lib/api';

const BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || '') + '/api/v1';

function SSOHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      router.replace('/login');
      return;
    }

    fetch(`${BASE}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Invalid token');
        const userRaw = await res.json();

        const user: AuthUser = {
          id: userRaw.id ?? userRaw.sub ?? '',
          username: userRaw.username ?? userRaw.email ?? '',
          firstName: userRaw.firstName,
          lastName: userRaw.lastName,
          role: userRaw.role ?? 'EMPLOYEE',
          scopes: userRaw.scopes ?? [],
          stores: userRaw.stores ?? [],
        };

        saveAuth(token, user);
        router.replace('/');
      })
      .catch(() => {
        setStatus('error');
        setTimeout(() => router.replace('/login'), 2000);
      });
  }, [router, searchParams]);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg font-medium">Session transfer failed</p>
          <p className="text-gray-400 text-sm mt-2">Redirecting to login…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-600 mb-4 animate-pulse">
          <span className="text-white text-2xl font-bold">TT</span>
        </div>
        <p className="text-white text-lg font-medium">Signing you in…</p>
        <p className="text-gray-400 text-sm mt-1">Transferring your session</p>
      </div>
    </div>
  );
}

export default function SSOPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-600 animate-pulse">
          <span className="text-white text-2xl font-bold">TT</span>
        </div>
      </div>
    }>
      <SSOHandler />
    </Suspense>
  );
}
