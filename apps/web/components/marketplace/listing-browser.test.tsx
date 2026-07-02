import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { ListingBrowser } from './listing-browser';
import * as api from '@/lib/api';
import { Condition, ListingStatus, Rarity } from '@sobrebox/shared';

vi.mock('@/lib/api');

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

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider
        locale="en"
        messages={{
          Marketplace: {
            title: 'Marketplace',
            empty: 'No listings yet.',
            sortRecent: 'Most recent',
            sortPriceAsc: 'Price: low to high',
            sortPriceDesc: 'Price: high to low',
            sortBestRated: 'Best rated (soon)',
          },
        }}
      >
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('ListingBrowser', () => {
  it('shows the empty state when there are no listings', async () => {
    vi.spyOn(api, 'fetchListings').mockResolvedValue({
      items: [],
      page: 1,
      total: 0,
      totalPages: 1,
    });
    renderWithProviders(<ListingBrowser />);
    await waitFor(() =>
      expect(screen.getByText('No listings yet.')).toBeInTheDocument(),
    );
  });

  it('renders a listing card with its price', async () => {
    vi.spyOn(api, 'fetchListings').mockResolvedValue({
      items: [
        {
          id: 'l1',
          quantity: 1,
          condition: Condition.MINT,
          price: '19.99',
          description: null,
          status: ListingStatus.ACTIVE,
          createdAt: '2026-07-01T00:00:00.000Z',
          item: {
            id: 'ci1',
            name: 'Charizard',
            rarity: Rarity.SECRET,
            imageUrl: null,
          },
          collection: { slug: 's', name: 'N' },
          seller: { username: 'ash', country: 'ES', avatarUrl: null },
          photos: [],
        },
      ],
      page: 1,
      total: 1,
      totalPages: 1,
    });
    renderWithProviders(<ListingBrowser />);
    await waitFor(() =>
      expect(screen.getByText('Charizard')).toBeInTheDocument(),
    );
    expect(screen.getByText(/19.99/)).toBeInTheDocument();
  });
});
