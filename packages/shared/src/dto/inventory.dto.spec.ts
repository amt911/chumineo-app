import { describe, expect, it } from 'vitest';
import {
  addInventoryItemSchema,
  updateInventoryItemSchema,
  inventoryItemSchema,
  collectionProgressSchema,
} from './inventory.dto';
import { Condition } from '../enums/condition';
import { Rarity } from '../enums/rarity';

describe('addInventoryItemSchema', () => {
  it('defaults quantity to 1', () => {
    const r = addInventoryItemSchema.parse({ collectionItemId: 'ci1' });
    expect(r).toEqual({ collectionItemId: 'ci1', quantity: 1 });
  });
  it('accepts a condition', () => {
    expect(
      addInventoryItemSchema.parse({
        collectionItemId: 'ci1',
        condition: Condition.MINT,
      }).condition,
    ).toBe(Condition.MINT);
  });
  it('rejects quantity 0', () => {
    expect(
      addInventoryItemSchema.safeParse({ collectionItemId: 'ci1', quantity: 0 })
        .success,
    ).toBe(false);
  });
});

describe('updateInventoryItemSchema', () => {
  it('requires at least one field', () => {
    expect(updateInventoryItemSchema.safeParse({}).success).toBe(false);
  });
  it('accepts a quantity-only update', () => {
    expect(updateInventoryItemSchema.parse({ quantity: 3 })).toEqual({
      quantity: 3,
    });
  });
});

describe('inventoryItemSchema', () => {
  it('accepts a full row', () => {
    const row = {
      id: 'inv1',
      quantity: 2,
      condition: null,
      item: {
        id: 'ci1',
        name: 'Charizard',
        rarity: Rarity.ULTRA_RARE,
        imageUrl: null,
      },
      collection: { slug: 'obsidian-flames', name: 'Obsidian Flames' },
    };
    expect(inventoryItemSchema.parse(row)).toEqual(row);
  });
});

describe('collectionProgressSchema', () => {
  it('accepts derived progress with items', () => {
    const p = {
      collection: { slug: 's', name: 'N' },
      owned: 1,
      total: 2,
      percent: 50,
      items: [
        {
          collectionItemId: 'a',
          name: 'A',
          rarity: Rarity.COMMON,
          ownedQuantity: 1,
          inventoryId: 'inv-a',
          wishlistId: null,
        },
        {
          collectionItemId: 'b',
          name: 'B',
          rarity: Rarity.RARE,
          ownedQuantity: 0,
          inventoryId: null,
          wishlistId: 'wish-b',
        },
      ],
    };
    expect(collectionProgressSchema.parse(p)).toEqual(p);
  });

  it('requires inventoryId and wishlistId on each item (nullable)', () => {
    const missing = {
      collection: { slug: 's', name: 'N' },
      owned: 0,
      total: 1,
      percent: 0,
      items: [
        {
          collectionItemId: 'a',
          name: 'A',
          rarity: Rarity.COMMON,
          ownedQuantity: 0,
        },
      ],
    };
    expect(collectionProgressSchema.safeParse(missing).success).toBe(false);
  });
});
