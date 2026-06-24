import { describe, expect, it } from 'vitest';
import {
  addWishlistItemSchema,
  updateWishlistItemSchema,
  wishlistItemSchema,
} from './wishlist.dto';
import { WishlistPriority } from '../enums/wishlist-priority';
import { Rarity } from '../enums/rarity';

describe('addWishlistItemSchema', () => {
  it('defaults priority to MEDIUM and isPublic to true', () => {
    expect(addWishlistItemSchema.parse({ collectionItemId: 'ci1' })).toEqual({
      collectionItemId: 'ci1',
      priority: WishlistPriority.MEDIUM,
      isPublic: true,
    });
  });
  it('accepts a decimal-string maxPrice', () => {
    expect(
      addWishlistItemSchema.parse({
        collectionItemId: 'ci1',
        maxPrice: '80.00',
      }).maxPrice,
    ).toBe('80.00');
  });
  it('rejects a non-numeric maxPrice', () => {
    expect(
      addWishlistItemSchema.safeParse({
        collectionItemId: 'ci1',
        maxPrice: 'free',
      }).success,
    ).toBe(false);
  });
});

describe('updateWishlistItemSchema', () => {
  it('requires at least one field', () => {
    expect(updateWishlistItemSchema.safeParse({}).success).toBe(false);
  });
  it('allows clearing maxPrice with null', () => {
    expect(updateWishlistItemSchema.parse({ maxPrice: null })).toEqual({
      maxPrice: null,
    });
  });
});

describe('wishlistItemSchema', () => {
  it('accepts a full row', () => {
    const row = {
      id: 'w1',
      priority: WishlistPriority.HIGH,
      maxPrice: '80.00',
      isPublic: true,
      item: {
        id: 'ci1',
        name: 'Umbreon',
        rarity: Rarity.SECRET,
        imageUrl: null,
      },
      collection: { slug: 's', name: 'N' },
    };
    expect(wishlistItemSchema.parse(row)).toEqual(row);
  });
});
