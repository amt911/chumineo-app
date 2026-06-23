'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { verifyEmail } from '@/lib/api';

export function VerifyContent() {
  const params = useSearchParams();
  const token = params.get('token');
  // Derive the no-token state during render so we don't setState in the effect.
  const [state, setState] = useState<'pending' | 'ok' | 'error'>(
    token ? 'pending' : 'error',
  );
  const [message, setMessage] = useState(
    token ? 'Verifying…' : 'Missing verification token.',
  );

  useEffect(() => {
    if (!token) return;
    verifyEmail(token)
      .then((res) => {
        setState('ok');
        setMessage(res.message);
      })
      .catch((err: unknown) => {
        setState('error');
        setMessage(err instanceof Error ? err.message : 'Verification failed');
      });
  }, [token]);

  return <p role={state === 'error' ? 'alert' : 'status'}>{message}</p>;
}
