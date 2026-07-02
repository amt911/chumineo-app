'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ListingDto } from '@sobrebox/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ListingDetail({ listing }: { listing: ListingDto }) {
  const t = useTranslations('Marketplace');
  const gallery = [
    ...listing.photos.map((p) => p.url),
    ...(listing.item.imageUrl ? [listing.item.imageUrl] : []),
  ];
  const [selected, setSelected] = useState(0);
  const main = gallery[selected];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-lg border p-4">
        {main ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={main}
              alt={listing.item.name}
              className="w-full rounded"
            />
            {gallery.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {gallery.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setSelected(i)}
                    aria-label={t('viewPhoto', { n: i + 1 })}
                    className={cn(
                      'h-16 w-16 overflow-hidden rounded border',
                      i === selected && 'ring-2 ring-primary',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="aspect-square rounded bg-muted" />
        )}
      </div>
      <div>
        <h1 className="text-2xl font-bold">{listing.item.name}</h1>
        <p className="text-sm text-muted-foreground">
          {listing.collection.name}
        </p>
        <p className="mt-4 text-3xl font-semibold">{listing.price} €</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {listing.condition} · <span>@{listing.seller.username}</span>
        </p>
        {listing.description && <p className="mt-4">{listing.description}</p>}
        <Button disabled title={t('offerSoon')} className="mt-6">
          {t('offerSoon')}
        </Button>
      </div>
    </div>
  );
}
