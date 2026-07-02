import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MatchesFeed } from '@/components/matches/matches-feed';

export default async function MatchesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Matches');
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>
      <MatchesFeed />
    </main>
  );
}
