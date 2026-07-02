import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WishlistList } from './wishlist-list';
import { useAuthStore } from '@/lib/auth-store';
import * as api from '@/lib/api';
import { Rarity, WishlistPriority } from '@sobrebox/shared';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/locales/es.json';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
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

const items = [
  {
    id: 'w1',
    priority: WishlistPriority.HIGH,
    maxPrice: '80.00',
    isPublic: true,
    item: { id: 'ci1', name: 'Umbreon', rarity: Rarity.SECRET, imageUrl: null },
    collection: { slug: 's', name: 'N' },
  },
];

describe('WishlistList', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'u1',
        email: 'a@b',
        username: 'neo',
        emailVerified: true,
        avatarUrl: null,
        country: null,
      },
      status: 'authenticated',
    });
    vi.spyOn(api, 'fetchMatches').mockResolvedValue([]);
  });

  it('renders wishlist rows with the max price', async () => {
    vi.spyOn(api, 'fetchWishlist').mockResolvedValue(items);
    wrap(<WishlistList />);
    await waitFor(() =>
      expect(screen.getByText('Umbreon')).toBeInTheDocument(),
    );
    expect(screen.getByText(/80\.00/)).toBeInTheDocument();
  });

  it('removes an item', async () => {
    vi.spyOn(api, 'fetchWishlist').mockResolvedValue(items);
    const del = vi.spyOn(api, 'deleteWishlistItem').mockResolvedValue();
    wrap(<WishlistList />);
    await waitFor(() => screen.getByText('Umbreon'));
    fireEvent.click(screen.getByRole('button', { name: /quitar/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('w1', 'tok'));
  });

  it('shows the translated empty state', async () => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: null,
      status: 'authenticated',
    });
    vi.spyOn(api, 'fetchWishlist').mockResolvedValue([]);
    wrap(<WishlistList />);
    await waitFor(() =>
      expect(screen.getByText('Tu wishlist está vacía.')).toBeInTheDocument(),
    );
  });

  it('does not show the login prompt while auth is loading', () => {
    useAuthStore.setState({ accessToken: null, user: null, status: 'loading' });
    wrap(<WishlistList />);
    expect(screen.queryByText(/inicia sesi[oó]n/i)).not.toBeInTheDocument();
  });

  it('shows the login prompt only when unauthenticated', () => {
    useAuthStore.setState({
      accessToken: null,
      user: null,
      status: 'unauthenticated',
    });
    wrap(<WishlistList />);
    expect(screen.getByText(/inicia sesi[oó]n/i)).toBeInTheDocument();
  });
});

describe('WishlistList badge', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'tok',
      user: null,
    });
    vi.spyOn(api, 'fetchWishlist').mockResolvedValue([items[0]]);
  });

  it('shows an on-sale badge for a wishlist item that has matches', async () => {
    vi.spyOn(api, 'fetchMatches').mockResolvedValue([
      {
        wishlistItemId: 'w1',
        priority: WishlistPriority.HIGH,
        maxPrice: '80.00',
        item: items[0].item,
        collection: items[0].collection,
        listingCount: 2,
        inBudgetCount: 1,
        cheapestPrice: '38.00',
        listings: [],
      },
    ]);
    wrap(<WishlistList />);
    await waitFor(() =>
      expect(screen.getByText(/\b2 en venta\b/)).toBeInTheDocument(),
    );
    expect(screen.getByText('1 dentro de presupuesto')).toBeInTheDocument();
  });

  it('shows no badge when the item has no match', async () => {
    vi.spyOn(api, 'fetchMatches').mockResolvedValue([]);
    wrap(<WishlistList />);
    await waitFor(() =>
      expect(screen.getByText('Umbreon')).toBeInTheDocument(),
    );
    expect(screen.queryByText(/en venta/)).not.toBeInTheDocument();
  });

  it('shows the badge only on the matched row when the wishlist has multiple items', async () => {
    const espeon = {
      id: 'w2',
      priority: WishlistPriority.MEDIUM,
      maxPrice: null,
      isPublic: true,
      item: { id: 'ci2', name: 'Espeon', rarity: Rarity.RARE, imageUrl: null },
      collection: { slug: 's2', name: 'N2' },
    };
    vi.spyOn(api, 'fetchWishlist').mockResolvedValue([items[0], espeon]);
    vi.spyOn(api, 'fetchMatches').mockResolvedValue([
      {
        wishlistItemId: 'w1',
        priority: WishlistPriority.HIGH,
        maxPrice: '80.00',
        item: items[0].item,
        collection: items[0].collection,
        listingCount: 1,
        inBudgetCount: 0,
        cheapestPrice: '38.00',
        listings: [],
      },
    ]);
    wrap(<WishlistList />);
    await waitFor(() => expect(screen.getByText('Espeon')).toBeInTheDocument());

    expect(screen.getByText(/\b1 en venta\b/)).toBeInTheDocument();

    const espeonRow = screen.getByText('Espeon').closest('li');
    expect(espeonRow?.textContent).not.toMatch(/en venta/);
  });

  it('shows a header link to the matches feed when any match exists', async () => {
    vi.spyOn(api, 'fetchMatches').mockResolvedValue([
      {
        wishlistItemId: 'w1',
        priority: WishlistPriority.HIGH,
        maxPrice: '80.00',
        item: items[0].item,
        collection: items[0].collection,
        listingCount: 1,
        inBudgetCount: 0,
        cheapestPrice: '38.00',
        listings: [],
      },
    ]);
    wrap(<WishlistList />);
    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: 'Ver qué está en venta' }),
      ).toHaveAttribute('href', '/wishlist/matches'),
    );
  });
});
