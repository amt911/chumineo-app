import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MatchesFeed } from './matches-feed';
import { useAuthStore } from '@/lib/auth-store';
import * as api from '@/lib/api';
import {
  Condition,
  ListingStatus,
  Rarity,
  WishlistPriority,
} from '@sobrebox/shared';

vi.mock('@/lib/api');
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const messages = {
  Matches: {
    title: 'Your wanted items on sale',
    loginPrompt: 'Log in to see your matches.',
    empty: 'None of your wishlist items are on sale right now.',
    browse: 'Browse the marketplace',
    inBudget: '{count} within budget',
    onSale: '{count} on sale',
    maxPrice: 'max {price}€',
    viewListing: 'View listing',
  },
};

function renderFeed() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <MatchesFeed />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const match = {
  wishlistItemId: 'w1',
  priority: WishlistPriority.HIGH,
  maxPrice: '45.00',
  item: {
    id: 'ci1',
    name: 'Charizard',
    rarity: Rarity.ULTRA_RARE,
    imageUrl: null,
  },
  collection: { slug: 'set', name: 'Set' },
  listingCount: 1,
  inBudgetCount: 1,
  cheapestPrice: '38.00',
  listings: [
    {
      id: 'l1',
      quantity: 1,
      condition: Condition.NEAR_MINT,
      price: '38.00',
      description: null,
      status: ListingStatus.ACTIVE,
      createdAt: '2026-07-02T00:00:00.000Z',
      item: {
        id: 'ci1',
        name: 'Charizard',
        rarity: Rarity.ULTRA_RARE,
        imageUrl: null,
      },
      collection: { slug: 'set', name: 'Set' },
      seller: { username: 'ana', country: 'ES', avatarUrl: null },
      photos: [],
      inBudget: true,
    },
  ],
};

describe('MatchesFeed', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'tok',
      user: null,
    });
  });

  it('renders a card per match with the item name and a listing link', async () => {
    vi.spyOn(api, 'fetchMatches').mockResolvedValue([match]);
    renderFeed();
    await waitFor(() =>
      expect(screen.getByText('Charizard')).toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: 'View listing' })).toHaveAttribute(
      'href',
      '/marketplace/l1',
    );
  });

  it('shows the empty state when there are no matches', async () => {
    vi.spyOn(api, 'fetchMatches').mockResolvedValue([]);
    renderFeed();
    await waitFor(() =>
      expect(
        screen.getByText('None of your wishlist items are on sale right now.'),
      ).toBeInTheDocument(),
    );
  });

  it('prompts login when unauthenticated', () => {
    useAuthStore.setState({
      status: 'unauthenticated',
      accessToken: null,
      user: null,
    });
    vi.spyOn(api, 'fetchMatches').mockResolvedValue([]);
    renderFeed();
    expect(screen.getByText('Log in to see your matches.')).toBeInTheDocument();
  });
});
