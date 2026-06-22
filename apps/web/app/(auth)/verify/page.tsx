import { Suspense } from 'react';
import { VerifyContent } from '@/components/auth/verify-content';

export default function VerifyPage() {
  return (
    <main>
      <h1>Email verification</h1>
      <Suspense fallback={<p>Verifying…</p>}>
        <VerifyContent />
      </Suspense>
    </main>
  );
}
