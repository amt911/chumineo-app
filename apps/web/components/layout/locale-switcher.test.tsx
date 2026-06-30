import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/locales/en.json';
import { LocaleSwitcher } from './locale-switcher';

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/inventory',
}));

describe('LocaleSwitcher', () => {
  it('links (full-page) to the other locale preserving the path', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <LocaleSwitcher />
      </NextIntlClientProvider>,
    );
    // default locale (en) has no prefix; the non-default (es) gets /es
    const link = screen.getByRole('link', { name: 'ES' });
    expect(link).toHaveAttribute('href', '/es/inventory');
  });
});
