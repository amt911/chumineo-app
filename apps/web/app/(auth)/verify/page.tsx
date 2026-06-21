'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { verifyEmail } from '@/lib/api';

export default function VerifyPage() {
  const params = useSearchParams();
  const [state, setState] = useState<'pending' | 'ok' | 'error'>('pending');
  const [message, setMessage] = useState('Verifying…');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setState('error');
      setMessage('Missing verification token.');
      return;
    }
    verifyEmail(token)
      .then((res) => {
        setState('ok');
        setMessage(res.message);
      })
      .catch((err: unknown) => {
        setState('error');
        setMessage(err instanceof Error ? err.message : 'Verification failed');
      });
  }, [params]);

  return (
    <main>
      <h1>Email verification</h1>
      <p role={state === 'error' ? 'alert' : 'status'}>{message}</p>
    </main>
  );
}
