import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { fetchListing } from '@/lib/api';
import { ListingDetail } from '@/components/marketplace/listing-detail';

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  let listing;
  try {
    listing = await fetchListing(id);
  } catch {
    notFound();
  }
  return (
    <main className="container mx-auto px-4 py-8">
      <ListingDetail listing={listing} />
    </main>
  );
}
