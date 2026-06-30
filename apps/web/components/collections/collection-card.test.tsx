import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CollectionCard } from './collection-card';
import type { CollectionListItemDto } from '@sobrebox/shared';

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

const item: CollectionListItemDto = {
  id: '1',
  slug: 'sv-obsidian-flames',
  name: 'Obsidian Flames',
  category: 'TCG' as CollectionListItemDto['category'],
  source: 'API_IMPORT' as CollectionListItemDto['source'],
  releaseYear: 2023,
  coverImageUrl: null,
  brand: { slug: 'pokemon', name: 'Pokémon' },
  itemCount: 12,
};

describe('CollectionCard', () => {
  it('shows name, brand, item count and links to the detail page', () => {
    render(<CollectionCard collection={item} />);
    expect(screen.getByText('Obsidian Flames')).toBeInTheDocument();
    expect(screen.getByText(/pokémon/i)).toBeInTheDocument();
    expect(screen.getByText(/12 items/i)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/collections/sv-obsidian-flames',
    );
  });

  it('marks the verified source', () => {
    render(<CollectionCard collection={item} />);
    expect(screen.getByText(/verified/i)).toBeInTheDocument();
  });

  it('marks community source', () => {
    render(
      <CollectionCard
        collection={{
          ...item,
          source: 'COMMUNITY' as CollectionListItemDto['source'],
        }}
      />,
    );
    expect(screen.getByText(/community/i)).toBeInTheDocument();
  });
});
