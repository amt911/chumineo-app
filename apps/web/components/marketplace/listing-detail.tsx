import { useTranslations } from 'next-intl';
import type { ListingDto } from '@sobrebox/shared';
import { Button } from '@/components/ui/button';

export function ListingDetail({ listing }: { listing: ListingDto }) {
  const t = useTranslations('Marketplace');
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-lg border p-4">
        {listing.item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.item.imageUrl}
            alt={listing.item.name}
            className="w-full rounded"
          />
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
