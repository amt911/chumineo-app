import { Suspense } from 'react';
import { VerifyContent } from '@/components/auth/verify-content';
import { Card, CardContent } from '@/components/ui/card';

export default function VerifyPage() {
  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <h1 className="mb-4 font-heading text-xl font-semibold">
            Email verification
          </h1>
          <Suspense fallback={<p role="status">Verifying…</p>}>
            <VerifyContent />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
