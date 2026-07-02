import { setRequestLocale } from 'next-intl/server';
import { ListingBrowser } from '@/components/marketplace/listing-browser';

export default async function MarketplacePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="container mx-auto px-4 py-8">
      <ListingBrowser />
    </main>
  );
}
