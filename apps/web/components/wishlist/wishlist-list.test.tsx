import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WishlistList } from './wishlist-list';
import { useAuthStore } from '@/lib/auth-store';
import * as api from '@/lib/api';
import { Rarity, WishlistPriority } from '@sobrebox/shared';

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
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
      },
    });
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

  it('shows a login hint when not authenticated', () => {
    useAuthStore.setState({ accessToken: null, user: null });
    wrap(<WishlistList />);
    expect(screen.getByText(/inicia sesi[oó]n/i)).toBeInTheDocument();
  });
});
