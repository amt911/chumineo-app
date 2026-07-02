import { describe, expect, it } from 'vitest';
import {
  createListingSchema,
  createListingFormSchema,
  listingAvailabilitySchema,
  listingAvailabilityQuerySchema,
  updateListingSchema,
  listingQuerySchema,
  listingSchema,
} from './marketplace.dto';
import { Condition } from '../enums/condition';
import { ListingStatus } from '../enums/listing-status';
import { Rarity } from '../enums/rarity';

describe('createListingSchema', () => {
  it('accepts a valid payload', () => {
    expect(
      createListingSchema.parse({
        collectionItemId: 'ci1',
        quantity: 1,
        condition: Condition.MINT,
        price: '19.99',
      }),
    ).toEqual({
      collectionItemId: 'ci1',
      quantity: 1,
      condition: Condition.MINT,
      price: '19.99',
    });
  });
  it('rejects quantity <= 0', () => {
    expect(
      createListingSchema.safeParse({
        collectionItemId: 'ci1',
        quantity: 0,
        condition: Condition.MINT,
        price: '19.99',
      }).success,
    ).toBe(false);
  });
  it('rejects a non-decimal price', () => {
    expect(
      createListingSchema.safeParse({
        collectionItemId: 'ci1',
        quantity: 1,
        condition: Condition.MINT,
        price: 'free',
      }).success,
    ).toBe(false);
  });
});

describe('createListingFormSchema', () => {
  it('accepts a valid form payload without collectionItemId', () => {
    expect(
      createListingFormSchema.parse({
        quantity: 2,
        condition: Condition.MINT,
        price: '19.99',
      }),
    ).toEqual({ quantity: 2, condition: Condition.MINT, price: '19.99' });
  });
  it('rejects a non-positive or non-integer quantity', () => {
    expect(
      createListingFormSchema.safeParse({
        quantity: 0,
        condition: Condition.MINT,
        price: '19.99',
      }).success,
    ).toBe(false);
    expect(
      createListingFormSchema.safeParse({
        quantity: 2.5,
        condition: Condition.MINT,
        price: '19.99',
      }).success,
    ).toBe(false);
  });
  it('rejects a malformed price', () => {
    expect(
      createListingFormSchema.safeParse({
        quantity: 1,
        condition: Condition.MINT,
        price: 'free',
      }).success,
    ).toBe(false);
  });
});

describe('listingAvailability schemas', () => {
  it('requires a collectionItemId in the query', () => {
    expect(
      listingAvailabilityQuerySchema.safeParse({ collectionItemId: '' })
        .success,
    ).toBe(false);
    expect(
      listingAvailabilityQuerySchema.parse({ collectionItemId: 'ci1' }),
    ).toEqual({ collectionItemId: 'ci1' });
  });
  it('accepts a non-negative owned/available response', () => {
    expect(listingAvailabilitySchema.parse({ owned: 3, available: 1 })).toEqual(
      { owned: 3, available: 1 },
    );
  });
  it('rejects a negative available count', () => {
    expect(
      listingAvailabilitySchema.safeParse({ owned: 1, available: -1 }).success,
    ).toBe(false);
  });
});

describe('updateListingSchema', () => {
  it('requires at least one field', () => {
    expect(updateListingSchema.safeParse({}).success).toBe(false);
  });
  it('accepts a status-only update', () => {
    expect(updateListingSchema.parse({ status: ListingStatus.PAUSED })).toEqual(
      { status: ListingStatus.PAUSED },
    );
  });
});

describe('listingQuerySchema', () => {
  it('defaults page to 1 and accepts a sort value', () => {
    expect(listingQuerySchema.parse({ sort: 'price_asc' })).toEqual({
      page: 1,
      sort: 'price_asc',
    });
  });
  it('rejects an unknown sort value', () => {
    expect(listingQuerySchema.safeParse({ sort: 'nonsense' }).success).toBe(
      false,
    );
  });
});

describe('listingSchema', () => {
  it('accepts a full row', () => {
    const row = {
      id: 'l1',
      quantity: 2,
      condition: Condition.MINT,
      price: '19.99',
      description: null,
      status: ListingStatus.ACTIVE,
      createdAt: '2026-07-01T00:00:00.000Z',
      item: {
        id: 'ci1',
        name: 'Charizard',
        rarity: Rarity.SECRET,
        imageUrl: null,
      },
      collection: { slug: 's', name: 'N' },
      seller: { username: 'ash', country: 'ES', avatarUrl: null },
      photos: [{ id: 'p1', url: 'https://example.com/p1.webp' }],
    };
    expect(listingSchema.parse(row)).toEqual(row);
  });
});
