import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'es'],
  // English is the default → it gets the clean, prefix-less URLs (/inventory);
  // Spanish is served under /es (/es/inventory).
  defaultLocale: 'en',
  localePrefix: 'as-needed',
});
