import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Rarity, WishlistPriority } from '@sobrebox/shared';
import { CollectionOwnershipPanel } from './collection-ownership-panel';
import { useAuthStore } from '@/lib/auth-store';
import * as api from '@/lib/api';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/locales/es.json';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
import { toast } from 'sonner';

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

const progress = {
  collection: { slug: 's', name: 'N' },
  owned: 1,
  total: 2,
  percent: 50,
  items: [
    {
      collectionItemId: 'a',
      name: 'A',
      rarity: Rarity.COMMON,
      ownedQuantity: 1,
      inventoryId: 'inv-a',
      wishlistId: null,
    },
    {
      collectionItemId: 'b',
      name: 'B',
      rarity: Rarity.RARE,
      ownedQuantity: 0,
      inventoryId: null,
      wishlistId: null,
    },
  ],
};

function authenticate() {
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
}

describe('CollectionOwnershipPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      accessToken: null,
      user: null,
      status: 'unauthenticated',
    });
  });

  it('renders nothing when logged out', () => {
    const { container } = wrap(<CollectionOwnershipPanel slug="s" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows owned/missing per item when logged in', async () => {
    authenticate();
    vi.spyOn(api, 'fetchCollectionProgress').mockResolvedValue(progress);
    wrap(<CollectionOwnershipPanel slug="s" />);
    await waitFor(() => expect(screen.getByText('A')).toBeInTheDocument());
    expect(screen.getByText(/1\s*\/\s*2/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /tengo.*B/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vender' })).toHaveAttribute(
      'href',
      '/marketplace/new?itemId=a',
    );
  });

  it('adds a missing item to inventory (with a success toast)', async () => {
    authenticate();
    vi.spyOn(api, 'fetchCollectionProgress').mockResolvedValue(progress);
    const add = vi.spyOn(api, 'addInventoryItem').mockResolvedValue({
      id: 'inv1',
      quantity: 1,
      condition: null,
      item: { id: 'b', name: 'B', rarity: Rarity.RARE, imageUrl: null },
      collection: { slug: 's', name: 'N' },
    });
    wrap(<CollectionOwnershipPanel slug="s" />);
    await waitFor(() => screen.getByText('B'));
    fireEvent.click(screen.getByRole('button', { name: /tengo.*B/i }));
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith(
        { collectionItemId: 'b', quantity: 1 },
        'tok',
      ),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('removes an owned item from inventory when toggled off', async () => {
    authenticate();
    vi.spyOn(api, 'fetchCollectionProgress').mockResolvedValue(progress);
    const del = vi.spyOn(api, 'deleteInventoryItem').mockResolvedValue();
    wrap(<CollectionOwnershipPanel slug="s" />);
    await waitFor(() => screen.getByText('A'));
    // owned item 'A' offers a "remove from inventory" affordance
    fireEvent.click(
      screen.getByRole('button', { name: /quitar.*A.*inventario/i }),
    );
    await waitFor(() => expect(del).toHaveBeenCalledWith('inv-a', 'tok'));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('increments an owned item by setting the absolute quantity', async () => {
    authenticate();
    vi.spyOn(api, 'fetchCollectionProgress').mockResolvedValue(progress);
    const upd = vi.spyOn(api, 'updateInventoryItem').mockResolvedValue({
      id: 'inv-a',
      quantity: 2,
      condition: null,
      item: { id: 'a', name: 'A', rarity: Rarity.COMMON, imageUrl: null },
      collection: { slug: 's', name: 'N' },
    });
    wrap(<CollectionOwnershipPanel slug="s" />);
    await waitFor(() => screen.getByText('A'));
    fireEvent.click(screen.getByRole('button', { name: /\+1.*A/i }));
    await waitFor(() =>
      expect(upd).toHaveBeenCalledWith('inv-a', { quantity: 2 }, 'tok'),
    );
  });

  it('decrements an owned item with quantity > 1 by setting quantity - 1', async () => {
    authenticate();
    vi.spyOn(api, 'fetchCollectionProgress').mockResolvedValue({
      ...progress,
      items: [{ ...progress.items[0], ownedQuantity: 3 }, progress.items[1]],
    });
    const upd = vi.spyOn(api, 'updateInventoryItem').mockResolvedValue({
      id: 'inv-a',
      quantity: 2,
      condition: null,
      item: { id: 'a', name: 'A', rarity: Rarity.COMMON, imageUrl: null },
      collection: { slug: 's', name: 'N' },
    });
    wrap(<CollectionOwnershipPanel slug="s" />);
    await waitFor(() => screen.getByText('A'));
    fireEvent.click(screen.getByRole('button', { name: /quitar uno de A/i }));
    await waitFor(() =>
      expect(upd).toHaveBeenCalledWith('inv-a', { quantity: 2 }, 'tok'),
    );
  });

  it('removes the item when decrementing at quantity 1', async () => {
    authenticate();
    vi.spyOn(api, 'fetchCollectionProgress').mockResolvedValue(progress);
    const del = vi.spyOn(api, 'deleteInventoryItem').mockResolvedValue();
    wrap(<CollectionOwnershipPanel slug="s" />);
    await waitFor(() => screen.getByText('A'));
    fireEvent.click(screen.getByRole('button', { name: /quitar uno de A/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('inv-a', 'tok'));
  });

  it('sets an exact quantity typed into the input', async () => {
    authenticate();
    vi.spyOn(api, 'fetchCollectionProgress').mockResolvedValue(progress);
    const upd = vi.spyOn(api, 'updateInventoryItem').mockResolvedValue({
      id: 'inv-a',
      quantity: 5,
      condition: null,
      item: { id: 'a', name: 'A', rarity: Rarity.COMMON, imageUrl: null },
      collection: { slug: 's', name: 'N' },
    });
    wrap(<CollectionOwnershipPanel slug="s" />);
    await waitFor(() => screen.getByText('A'));
    const input = screen.getByLabelText(/cantidad de A/i);
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.blur(input);
    await waitFor(() =>
      expect(upd).toHaveBeenCalledWith('inv-a', { quantity: 5 }, 'tok'),
    );
  });

  it('removes the item when the quantity input is set to 0', async () => {
    authenticate();
    vi.spyOn(api, 'fetchCollectionProgress').mockResolvedValue(progress);
    const del = vi.spyOn(api, 'deleteInventoryItem').mockResolvedValue();
    wrap(<CollectionOwnershipPanel slug="s" />);
    await waitFor(() => screen.getByText('A'));
    const input = screen.getByLabelText(/cantidad de A/i);
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.blur(input);
    await waitFor(() => expect(del).toHaveBeenCalledWith('inv-a', 'tok'));
  });

  it('adds a missing item to the wishlist', async () => {
    authenticate();
    vi.spyOn(api, 'fetchCollectionProgress').mockResolvedValue(progress);
    const wish = vi.spyOn(api, 'addWishlistItem').mockResolvedValue({
      id: 'w1',
      priority: WishlistPriority.MEDIUM,
      maxPrice: null,
      isPublic: true,
      item: { id: 'b', name: 'B', rarity: Rarity.RARE, imageUrl: null },
      collection: { slug: 's', name: 'N' },
    });
    wrap(<CollectionOwnershipPanel slug="s" />);
    await waitFor(() => screen.getByText('B'));
    fireEvent.click(
      screen.getByRole('button', { name: /añadir.*B.*wishlist/i }),
    );
    await waitFor(() =>
      expect(wish).toHaveBeenCalledWith(
        {
          collectionItemId: 'b',
          priority: WishlistPriority.MEDIUM,
          isPublic: true,
        },
        'tok',
      ),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('removes a wishlisted item from the wishlist when toggled off', async () => {
    authenticate();
    vi.spyOn(api, 'fetchCollectionProgress').mockResolvedValue({
      ...progress,
      items: [
        {
          collectionItemId: 'b',
          name: 'B',
          rarity: Rarity.RARE,
          ownedQuantity: 0,
          inventoryId: null,
          wishlistId: 'wish-b',
        },
      ],
    });
    const del = vi.spyOn(api, 'deleteWishlistItem').mockResolvedValue();
    wrap(<CollectionOwnershipPanel slug="s" />);
    await waitFor(() => screen.getByText('B'));
    fireEvent.click(
      screen.getByRole('button', { name: /quitar.*B.*wishlist/i }),
    );
    await waitFor(() => expect(del).toHaveBeenCalledWith('wish-b', 'tok'));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('shows an error toast when a mutation fails', async () => {
    authenticate();
    vi.spyOn(api, 'fetchCollectionProgress').mockResolvedValue(progress);
    vi.spyOn(api, 'addInventoryItem').mockRejectedValue(new Error('boom'));
    wrap(<CollectionOwnershipPanel slug="s" />);
    await waitFor(() => screen.getByText('B'));
    fireEvent.click(screen.getByRole('button', { name: /tengo.*B/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
