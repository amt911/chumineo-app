import { setRequestLocale } from 'next-intl/server';
import { CreateListingForm } from '@/components/marketplace/create-listing-form';

export default async function NewListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ itemId?: string }>;
}) {
  const { locale } = await params;
  const { itemId } = await searchParams;
  setRequestLocale(locale);
  if (!itemId) {
    return (
      <main className="container mx-auto px-4 py-8">
        <p>Missing itemId</p>
      </main>
    );
  }
  return (
    <main className="container mx-auto px-4 py-8">
      <CreateListingForm collectionItemId={itemId} />
    </main>
  );
}
