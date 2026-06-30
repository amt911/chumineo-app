import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import '../globals.css';
import { Providers } from './providers';
import { SiteHeader } from '@/components/layout/site-header';
import { routing } from '@/i18n/routing';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '800'],
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-code',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'SobreBox',
  description: 'Track, analyze and trade surprise-box collectibles.',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// This [locale] layout is the app root: it owns <html lang> (per locale, so it's
// statically prerenderable via setRequestLocale) and the providers. Theme/query/
// auth live here. The locale switcher does a full-page nav (not a soft client
// switch) so this layout never re-renders next-themes' pre-hydration <script> on
// the client — which is what tripped React 19's "script tag while rendering".
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${jakartaSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased">
        <Providers>
          <NextIntlClientProvider locale={locale}>
            <SiteHeader />
            <main className="container mx-auto px-6 py-8">{children}</main>
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
