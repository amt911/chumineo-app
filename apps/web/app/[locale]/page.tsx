import { redirect } from '@/i18n/navigation';

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // Phase 0 has no landing/dashboard yet (later epic) — send the root to the
  // catalog, keeping the active locale (locale-aware redirect).
  const { locale } = await params;
  redirect({ href: '/collections', locale });
}
