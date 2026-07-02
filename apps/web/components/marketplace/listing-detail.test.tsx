import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { ListingDetail } from './listing-detail';
import {
  Condition,
  ListingStatus,
  Rarity,
  type ListingDto,
} from '@sobrebox/shared';

const listing: ListingDto = {
  id: 'l1',
  quantity: 1,
  condition: Condition.MINT,
  price: '19.99',
  description: 'Mint condition, straight from the pack.',
  status: ListingStatus.ACTIVE,
  createdAt: '2026-07-01T00:00:00.000Z',
  item: { id: 'ci1', name: 'Charizard', rarity: Rarity.SECRET, imageUrl: null },
  collection: { slug: 's', name: 'N' },
  seller: { username: 'ash', country: 'ES', avatarUrl: null },
  photos: [],
};

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={{ Marketplace: { offerSoon: 'Offers coming soon' } }}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('ListingDetail', () => {
  it('renders price, description and seller', () => {
    renderWithProviders(<ListingDetail listing={listing} />);
    expect(screen.getByText('Charizard')).toBeInTheDocument();
    expect(screen.getByText(/19.99/)).toBeInTheDocument();
    expect(
      screen.getByText('Mint condition, straight from the pack.'),
    ).toBeInTheDocument();
    expect(screen.getByText('@ash')).toBeInTheDocument();
  });

  it('shows a disabled offer CTA with the "coming soon" label', () => {
    renderWithProviders(<ListingDetail listing={listing} />);
    const button = screen.getByRole('button', { name: /offers coming soon/i });
    expect(button).toBeDisabled();
  });
});
