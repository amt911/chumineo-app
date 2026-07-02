'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { useMatches } from './use-matches';

export function MatchesFeed() {
  const t = useTranslations('Matches');
  const status = useAuthStore((s) => s.status);
  const { data, isLoading } = useMatches();

  if (status === 'unauthenticated') return <p>{t('loginPrompt')}</p>;
  if (status === 'loading' || isLoading)
    return <p className="text-muted-foreground">…</p>;
  if (!data || data.length === 0) {
    return (
      <div className="text-muted-foreground">
        <p>{t('empty')}</p>
        <Link href="/marketplace" className="underline">
          {t('browse')}
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {data.map((m) => (
        <li key={m.wishlistItemId} className="rounded border p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-medium">{m.item.name}</span>
            <span className="text-xs text-muted-foreground">
              {m.priority}
              {m.maxPrice ? ` · ${t('maxPrice', { price: m.maxPrice })}` : ''}
              {' · '}
              {t('onSale', { count: m.listingCount })}
              {m.inBudgetCount > 0
                ? ` · ${t('inBudget', { count: m.inBudgetCount })}`
                : ''}
            </span>
          </div>
          <ul className="space-y-1">
            {m.listings.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span>
                  {l.price}€ · {l.condition} · {l.seller.username}
                  {l.seller.country ? ` (${l.seller.country})` : ''}
                  {l.inBudget ? (
                    <span className="ml-2 text-green-600">
                      {t('inBudget', { count: 1 })}
                    </span>
                  ) : null}
                </span>
                <Link href={`/marketplace/${l.id}`} className="underline">
                  {t('viewListing')}
                </Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
