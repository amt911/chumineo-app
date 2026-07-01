'use client';
import { Link } from '@/i18n/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { fetchInventoryProgress } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export function InventoryProgress() {
  const t = useTranslations('Inventory');
  const tc = useTranslations('Common');
  const status = useAuthStore((s) => s.status);
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', 'progress'],
    queryFn: () => fetchInventoryProgress(accessToken as string),
    enabled: status === 'authenticated',
  });

  if (status === 'loading') return <p>{tc('loading')}</p>;
  if (status === 'unauthenticated') return <p>{t('loginPrompt')}</p>;
  if (isLoading) return <p>{tc('loading')}</p>;
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground">{t('empty')}</p>;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {data.map((p) => (
        <li
          key={p.collection.slug}
          className="rounded-lg border p-4"
          data-testid="progress-card"
        >
          <Link
            href={`/collections/${p.collection.slug}`}
            className="font-medium hover:underline"
          >
            {p.collection.name}
          </Link>
          <p className="text-sm text-muted-foreground">
            {t('progress', {
              owned: p.owned,
              total: p.total,
              percent: p.percent,
            })}
          </p>
          <div className="mt-2 h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${p.percent}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
