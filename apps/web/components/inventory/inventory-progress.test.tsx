import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InventoryProgress } from './inventory-progress';
import { useAuthStore } from '@/lib/auth-store';
import * as api from '@/lib/api';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/locales/es.json';

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe('InventoryProgress', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'u1',
        email: 'a@b',
        username: 'neo',
        emailVerified: true,
        avatarUrl: null,
      },
      status: 'authenticated',
    });
  });

  it('renders a card per collection with the percent', async () => {
    vi.spyOn(api, 'fetchInventoryProgress').mockResolvedValue([
      {
        collection: { slug: 's', name: 'Obsidian Flames' },
        owned: 12,
        total: 50,
        percent: 24,
      },
    ]);
    wrap(<InventoryProgress />);
    await waitFor(() =>
      expect(screen.getByText('Obsidian Flames')).toBeInTheDocument(),
    );
    expect(screen.getByText(/12\s*\/\s*50/)).toBeInTheDocument();
    expect(screen.getByText(/24%/)).toBeInTheDocument();
  });

  it('shows an empty state when nothing is owned', async () => {
    vi.spyOn(api, 'fetchInventoryProgress').mockResolvedValue([]);
    wrap(<InventoryProgress />);
    await waitFor(() =>
      expect(screen.getByText(/todav[íi]a no tienes/i)).toBeInTheDocument(),
    );
  });

  it('does not show the login prompt while auth is loading', () => {
    useAuthStore.setState({ accessToken: null, user: null, status: 'loading' });
    wrap(<InventoryProgress />);
    expect(screen.queryByText(/inicia sesi[oó]n/i)).not.toBeInTheDocument();
  });

  it('shows the login prompt only when unauthenticated', () => {
    useAuthStore.setState({
      accessToken: null,
      user: null,
      status: 'unauthenticated',
    });
    wrap(<InventoryProgress />);
    expect(screen.getByText(/inicia sesi[oó]n/i)).toBeInTheDocument();
  });
});
