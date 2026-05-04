'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, AuthUser } from '../lib/api';

export function useAuth(): { user: AuthUser | null; loading: boolean } {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace('/login');
    } else {
      setUser(u);
      setLoading(false);
    }
  }, [router]);

  return { user, loading };
}
