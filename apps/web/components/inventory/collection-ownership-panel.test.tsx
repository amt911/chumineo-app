import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Rarity } from '@sobrebox/shared';
import { CollectionOwnershipPanel } from './collection-ownership-panel';
import { useAuthStore } from '@/lib/auth-store';
import * as api from '@/lib/api';

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
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
    },
    {
      collectionItemId: 'b',
      name: 'B',
      rarity: Rarity.RARE,
      ownedQuantity: 0,
    },
  ],
};

describe('CollectionOwnershipPanel', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, user: null });
  });

  it('renders nothing when logged out', () => {
    const { container } = wrap(<CollectionOwnershipPanel slug="s" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows owned/missing per item when logged in', async () => {
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
    vi.spyOn(api, 'fetchCollectionProgress').mockResolvedValue(progress);
    wrap(<CollectionOwnershipPanel slug="s" />);
    await waitFor(() => expect(screen.getByText('A')).toBeInTheDocument());
    expect(screen.getByText(/1\s*\/\s*2/)).toBeInTheDocument();
    // missing item 'b' shows an "add" affordance
    expect(
      screen.getByRole('button', { name: /tengo.*B/i }),
    ).toBeInTheDocument();
  });

  it('calls addInventoryItem when marking a missing item as owned', async () => {
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
  });
});
