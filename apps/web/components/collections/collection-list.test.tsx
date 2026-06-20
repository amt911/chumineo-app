import { render, screen } from '@testing-library/react';
import { CollectionCategory, CollectionSource, CollectionStatus } from '@sobrebox/shared';
import { describe, expect, it } from 'vitest';
import { CollectionList } from './collection-list';

describe('CollectionList', () => {
  it('renders a collection name per item', () => {
    render(
      <CollectionList
        collections={[
          { id: '1', slug: 'a', name: 'Obsidian Flames', category: CollectionCategory.TCG, status: CollectionStatus.PUBLISHED, source: CollectionSource.API_IMPORT },
          { id: '2', slug: 'b', name: 'Skullpanda', category: CollectionCategory.BLIND_BOX, status: CollectionStatus.PUBLISHED, source: CollectionSource.COMMUNITY },
        ]}
      />,
    );
    expect(screen.getByText('Obsidian Flames')).toBeInTheDocument();
    expect(screen.getByText('Skullpanda')).toBeInTheDocument();
  });

  it('renders an empty state when there are no collections', () => {
    render(<CollectionList collections={[]} />);
    expect(screen.getByText(/no collections/i)).toBeInTheDocument();
  });
});
