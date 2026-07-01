import type es from './locales/es.json';

declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof es;
  }
}
