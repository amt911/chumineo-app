import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { SiteHeader } from '@/components/layout/site-header';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jakartaSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased">
        <Providers>
          <SiteHeader />
          <main className="container mx-auto px-6 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
