import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
            stock: 'You own {owned} · {available} available to list',
            maxAvailable: 'You can only list {available}',
          },
        }}
      >
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('CreateListingForm', () => {
  beforeEach(() => {
    // Default: plenty of stock so the cap never interferes.
    vi.mocked(api.fetchListingAvailability).mockResolvedValue({
      owned: 10,
      available: 10,
    });
  });

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

  it('blocks submit and shows a field error when quantity is empty', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'createListing').mockResolvedValue({
      id: 'l1',
    } as never);

    renderWithProviders(<CreateListingForm collectionItemId="ci1" />);

    // Leave quantity empty, fill only price.
    await user.type(screen.getByLabelText('Price'), '19.99');
    await user.click(screen.getByRole('button', { name: 'Publish listing' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('blocks submit and shows a field error when price is malformed', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'createListing').mockResolvedValue({
      id: 'l1',
    } as never);

    renderWithProviders(<CreateListingForm collectionItemId="ci1" />);

    await user.type(screen.getByLabelText('Quantity'), '2');
    await user.type(screen.getByLabelText('Price'), 'not-a-price');
    await user.click(screen.getByRole('button', { name: 'Publish listing' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('shows how many units the seller owns and how many are available', async () => {
    vi.mocked(api.fetchListingAvailability).mockResolvedValue({
      owned: 10,
      available: 7,
    });

    renderWithProviders(<CreateListingForm collectionItemId="ci1" />);

    expect(
      await screen.findByText('You own 10 · 7 available to list'),
    ).toBeInTheDocument();
  });

  it('blocks submit and shows an error when quantity exceeds available', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchListingAvailability).mockResolvedValue({
      owned: 10,
      available: 3,
    });
    const spy = vi.spyOn(api, 'createListing').mockResolvedValue({
      id: 'l1',
    } as never);

    renderWithProviders(<CreateListingForm collectionItemId="ci1" />);

    // Wait for availability to load before submitting so the cap applies.
    await screen.findByText('You own 10 · 3 available to list');
    await user.type(screen.getByLabelText('Quantity'), '5');
    await user.type(screen.getByLabelText('Price'), '19.99');
    await user.click(screen.getByRole('button', { name: 'Publish listing' }));

    expect(await screen.findByText('You can only list 3')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });
});
