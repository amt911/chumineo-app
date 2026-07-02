import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { CreateListingForm } from './create-listing-form';
import * as api from '@/lib/api';

vi.mock('@/lib/api');
vi.mock('@/lib/auth-store', () => ({
  useAuthStore: (selector: (s: { accessToken: string }) => unknown) =>
    selector({ accessToken: 'token' }),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider
        locale="en"
        messages={{
          Marketplace: {
            createTitle: 'Sell an item',
            quantity: 'Quantity',
            condition: 'Condition',
            price: 'Price',
            description: 'Description',
            submit: 'Publish listing',
            toastCreated: 'Listing published',
          },
        }}
      >
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('CreateListingForm', () => {
  it('submits the form and calls createListing with the entered values', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'createListing').mockResolvedValue({
      id: 'l1',
    } as never);

    renderWithProviders(<CreateListingForm collectionItemId="ci1" />);

    await user.type(screen.getByLabelText('Quantity'), '1');
    await user.selectOptions(screen.getByLabelText('Condition'), 'MINT');
    await user.type(screen.getByLabelText('Price'), '19.99');
    await user.click(screen.getByRole('button', { name: 'Publish listing' }));

    await waitFor(() =>
      expect(api.createListing).toHaveBeenCalledWith(
        {
          collectionItemId: 'ci1',
          quantity: 1,
          condition: 'MINT',
          price: '19.99',
        },
        'token',
      ),
    );
  });
});
