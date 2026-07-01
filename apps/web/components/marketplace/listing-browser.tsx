'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { fetchListings } from '@/lib/api';
import type { ListingQueryDto } from '@sobrebox/shared';

export function ListingBrowser() {
  const t = useTranslations('Marketplace');
  const [sort, setSort] = useState<ListingQueryDto['sort']>('recent');

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace', 'listings', { sort }],
    queryFn: () => fetchListings({ sort, page: 1 }),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as ListingQueryDto['sort'])}
          className="rounded border px-2 py-1 text-sm"
        >
          <option value="recent">{t('sortRecent')}</option>
          <option value="price_asc">{t('sortPriceAsc')}</option>
          <option value="price_desc">{t('sortPriceDesc')}</option>
          <option value="best_rated" disabled title={t('sortBestRated')}>
            {t('sortBestRated')}
          </option>
        </select>
      </div>

      {isLoading && <p>{t('title')}…</p>}
      {!isLoading && (!data || data.items.length === 0) && (
        <p className="text-muted-foreground">{t('empty')}</p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.items.map((listing) => (
          <li key={listing.id} className="rounded-lg border p-4">
            <Link
              href={`/marketplace/${listing.id}`}
              className="font-medium hover:underline"
            >
              {listing.item.name}
            </Link>
            <p className="text-sm text-muted-foreground">
              {listing.collection.name}
            </p>
            <p className="mt-2 font-semibold">{listing.price} €</p>
            <p className="text-xs text-muted-foreground">
              @{listing.seller.username}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
