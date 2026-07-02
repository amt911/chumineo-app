import { describe, expect, it } from 'vitest';
import { matchesResponseSchema } from './match.dto';
import { Condition, ListingStatus, Rarity, WishlistPriority } from '../index';

const listing = {
  id: 'lst1',
  quantity: 1,
  condition: Condition.NEAR_MINT,
  price: '38.00',
  description: null,
  status: ListingStatus.ACTIVE,
  createdAt: '2026-07-02T00:00:00.000Z',
  item: {
    id: 'ci1',
    name: 'Charizard',
    rarity: Rarity.ULTRA_RARE,
    imageUrl: null,
  },
  collection: { slug: 'obsidian-flames', name: 'Obsidian Flames' },
  seller: { username: 'ana', country: 'ES', avatarUrl: null },
  photos: [],
  inBudget: true,
};

const match = {
  wishlistItemId: 'w1',
  priority: WishlistPriority.HIGH,
  maxPrice: '45.00',
  item: {
    id: 'ci1',
    name: 'Charizard',
    rarity: Rarity.ULTRA_RARE,
    imageUrl: null,
  },
  collection: { slug: 'obsidian-flames', name: 'Obsidian Flames' },
  listingCount: 1,
  inBudgetCount: 1,
  cheapestPrice: '38.00',
  listings: [listing],
};

describe('matchesResponseSchema', () => {
  it('parses a valid matches array', () => {
    expect(matchesResponseSchema.parse([match])).toEqual([match]);
  });

  it('accepts a null maxPrice', () => {
    const parsed = matchesResponseSchema.parse([{ ...match, maxPrice: null }]);
    expect(parsed[0].maxPrice).toBeNull();
  });

  it('requires inBudget on each listing', () => {
    const bad = { ...match, listings: [{ ...listing, inBudget: undefined }] };
    expect(() => matchesResponseSchema.parse([bad])).toThrow();
  });

  it('rejects a non-decimal cheapestPrice shape', () => {
    expect(() =>
      matchesResponseSchema.parse([{ ...match, cheapestPrice: 38 }]),
    ).toThrow();
  });
});
