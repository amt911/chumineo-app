import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CollectionBrowser } from './collection-browser';

vi.mock('@/lib/api', () => ({
  fetchBrands: vi.fn().mockResolvedValue([]),
  fetchCollectionsPage: vi.fn().mockResolvedValue({
    items: [
      {
        id: '1',
        slug: 'a',
        name: 'Obsidian Flames',
        category: 'TCG',
        source: 'API_IMPORT',
        releaseYear: 2023,
        coverImageUrl: null,
        brand: { slug: 'pokemon', name: 'Pokémon' },
        itemCount: 3,
      },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
    hasMore: false,
  }),
}));

function renderBrowser() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CollectionBrowser />
    </QueryClientProvider>,
  );
}

describe('CollectionBrowser', () => {
  it('renders fetched collections', async () => {
    renderBrowser();
    expect(await screen.findByText('Obsidian Flames')).toBeInTheDocument();
  });

  it('renders the sort control', async () => {
    renderBrowser();
    expect(await screen.findByLabelText(/sort/i)).toBeInTheDocument();
  });
});
