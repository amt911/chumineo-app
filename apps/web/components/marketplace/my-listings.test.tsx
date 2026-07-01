import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
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
});
