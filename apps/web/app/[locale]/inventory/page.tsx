import { getTranslations, setRequestLocale } from 'next-intl/server';
import { InventoryProgress } from '@/components/inventory/inventory-progress';

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Inventory');
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>
      <InventoryProgress />
    </main>
  );
}
