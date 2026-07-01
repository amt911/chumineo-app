import { setRequestLocale } from 'next-intl/server';
import { MyListings } from '@/components/marketplace/my-listings';

export default async function MyListingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="container mx-auto px-4 py-8">
      <MyListings />
    </main>
  );
}
