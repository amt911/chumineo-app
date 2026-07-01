import { getTranslations, setRequestLocale } from 'next-intl/server';
import { WishlistList } from '@/components/wishlist/wishlist-list';

export default async function WishlistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Wishlist');
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>
      <WishlistList />
    </main>
  );
}
