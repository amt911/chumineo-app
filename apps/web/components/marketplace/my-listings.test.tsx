import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import {
  Condition,
  ListingStatus,
  Rarity,
  type ListingDto,
} from '@sobrebox/shared';
import { MyListings } from './my-listings';
import * as api from '@/lib/api';

vi.mock('@/lib/api');
vi.mock('@/lib/auth-store', () => ({
  useAuthStore: (
    selector: (s: { status: string; accessToken: string }) => unknown,
  ) => selector({ status: 'authenticated', accessToken: 'token' }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider
        locale="en"
        messages={{
          Marketplace: {
            mineEmpty: 'You have no listings.',
            pause: 'Pause',
            delete: 'Delete',
          },
        }}
      >
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function makeListing(overrides: Partial<ListingDto> = {}): ListingDto {
  return {
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
    ...overrides,
  };
}

describe('MyListings', () => {
  it('shows the empty state when the seller has no listings', async () => {
    vi.spyOn(api, 'fetchMyListings').mockResolvedValue({
      items: [],
      page: 1,
      total: 0,
      totalPages: 1,
    });
    renderWithProviders(<MyListings />);
    await waitFor(() =>
      expect(screen.getByText('You have no listings.')).toBeInTheDocument(),
    );
  });

  it('renders a populated listing with its price and status', async () => {
    vi.spyOn(api, 'fetchMyListings').mockResolvedValue({
      items: [makeListing()],
      page: 1,
      total: 1,
      totalPages: 1,
    });
    renderWithProviders(<MyListings />);
    await waitFor(() =>
      expect(screen.getByText(/Charizard/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/19.99/)).toBeInTheDocument();
    expect(screen.getByText(/ACTIVE/)).toBeInTheDocument();
  });

  it('pauses an active listing via the pause action', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'fetchMyListings').mockResolvedValue({
      items: [makeListing({ id: 'l1', status: ListingStatus.ACTIVE })],
      page: 1,
      total: 1,
      totalPages: 1,
    });
    vi.spyOn(api, 'updateListing').mockResolvedValue(
      makeListing({ id: 'l1', status: ListingStatus.PAUSED }),
    );
    renderWithProviders(<MyListings />);
    await waitFor(() =>
      expect(screen.getByText(/Charizard/)).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() =>
      expect(api.updateListing).toHaveBeenCalledWith(
        'l1',
        { status: ListingStatus.PAUSED },
        'token',
      ),
    );
  });

  it('resumes a paused listing via the same toggle action', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'fetchMyListings').mockResolvedValue({
      items: [makeListing({ id: 'l2', status: ListingStatus.PAUSED })],
      page: 1,
      total: 1,
      totalPages: 1,
    });
    vi.spyOn(api, 'updateListing').mockResolvedValue(
      makeListing({ id: 'l2', status: ListingStatus.ACTIVE }),
    );
    renderWithProviders(<MyListings />);
    await waitFor(() =>
      expect(screen.getByText(/Charizard/)).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() =>
      expect(api.updateListing).toHaveBeenCalledWith(
        'l2',
        { status: ListingStatus.ACTIVE },
        'token',
      ),
    );
  });

  it('deletes a listing via the delete action', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'fetchMyListings').mockResolvedValue({
      items: [makeListing({ id: 'l3' })],
      page: 1,
      total: 1,
      totalPages: 1,
    });
    vi.spyOn(api, 'deleteListing').mockResolvedValue(undefined);
    renderWithProviders(<MyListings />);
    await waitFor(() =>
      expect(screen.getByText(/Charizard/)).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(api.deleteListing).toHaveBeenCalledWith('l3', 'token'),
    );
  });
});
