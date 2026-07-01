'use client';
import { useLocale } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname(); // path WITHOUT the locale prefix
  const other = locale === 'en' ? 'es' : 'en';
  const href =
    other === routing.defaultLocale
      ? pathname
      : `/${other}${pathname === '/' ? '' : pathname}`;

  // Full-page navigation (not a soft client switch). This keeps next-themes'
  // pre-hydration <script> out of a client re-render (React 19's "script tag
  // while rendering on the client") and lets the target locale render via SSR.
  // The cookie persists the choice so next-intl's locale detection agrees on
  // return visits (mirrors what the next-intl router would set).
  return (
    <a
      href={href}
      onClick={() => {
        document.cookie = `NEXT_LOCALE=${other};path=/;max-age=31536000;samesite=lax`;
      }}
      className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
    >
      {other.toUpperCase()}
    </a>
  );
}
