import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
      messages={{
        Marketplace: {
          offerSoon: 'Offers coming soon',
          viewPhoto: 'View photo {n}',
        },
      }}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

const withPhotos: ListingDto = {
  ...listing,
  item: { ...listing.item, imageUrl: 'https://cdn/catalog.webp' },
  photos: [
    { id: 'p1', url: 'https://cdn/p1.webp' },
    { id: 'p2', url: 'https://cdn/p2.webp' },
  ],
};

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

  it('shows the first seller photo as the main image', () => {
    renderWithProviders(<ListingDetail listing={withPhotos} />);
    const main = screen.getByRole('img', { name: 'Charizard' });
    expect(main).toHaveAttribute('src', 'https://cdn/p1.webp');
  });

  it('renders a thumbnail button per gallery image (photos + catalog)', () => {
    renderWithProviders(<ListingDetail listing={withPhotos} />);
    expect(screen.getAllByRole('button', { name: /view photo/i })).toHaveLength(
      3,
    );
  });

  it('switches the main image when a thumbnail is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ListingDetail listing={withPhotos} />);
    await user.click(screen.getByRole('button', { name: 'View photo 3' }));
    expect(screen.getByRole('img', { name: 'Charizard' })).toHaveAttribute(
      'src',
      'https://cdn/catalog.webp',
    );
  });

  it('falls back to the catalog image when there are no seller photos', () => {
    renderWithProviders(
      <ListingDetail
        listing={{
          ...listing,
          item: { ...listing.item, imageUrl: 'https://cdn/catalog.webp' },
        }}
      />,
    );
    expect(screen.getByRole('img', { name: 'Charizard' })).toHaveAttribute(
      'src',
      'https://cdn/catalog.webp',
    );
    expect(
      screen.queryByRole('button', { name: /view photo/i }),
    ).not.toBeInTheDocument();
  });

  it('renders a placeholder when there are no images at all', () => {
    const { container } = renderWithProviders(
      <ListingDetail listing={listing} />,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('.bg-muted')).toBeInTheDocument();
  });
});
