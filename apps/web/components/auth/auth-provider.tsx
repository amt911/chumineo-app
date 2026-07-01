'use client';
import { useEffect } from 'react';
import { refreshSession, fetchMe } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const { accessToken, status } = useAuthStore.getState();
    // Already hydrated this session (e.g. just logged in) — skip.
    if (accessToken || status !== 'loading') return;
    let active = true;
    refreshSession()
      .then(async ({ accessToken: tok }) => {
        const user = await fetchMe(tok);
        if (active) useAuthStore.getState().setSession(tok, user);
      })
      .catch(() => {
        if (active) useAuthStore.getState().setStatus('unauthenticated');
      });
    return () => {
      active = false;
    };
  }, []);

  return <>{children}</>;
}
