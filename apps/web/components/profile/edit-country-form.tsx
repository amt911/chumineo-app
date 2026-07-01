'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { updateProfile } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';

const COUNTRIES = ['ES', 'US', 'MX', 'AR', 'FR', 'DE', 'IT', 'PT', 'GB'];

export function EditCountryForm({
  currentCountry,
}: {
  currentCountry: string | null;
}) {
  const t = useTranslations('Profile');
  const accessToken = useAuthStore((s) => s.accessToken);
  const [country, setCountry] = useState(currentCountry ?? '');

  const mutation = useMutation({
    mutationFn: () =>
      updateProfile({ country: country || null }, accessToken as string),
    onSuccess: () => toast.success(t('toastSaved')),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="flex items-end gap-2"
    >
      <label className="grid gap-1 text-sm">
        {t('country')}
        <select
          aria-label={t('country')}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="rounded border px-2 py-1"
        >
          <option value="">—</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={mutation.isPending}>
        {t('save')}
      </Button>
    </form>
  );
}
