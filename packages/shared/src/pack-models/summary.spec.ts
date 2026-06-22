import { describe, expect, it } from 'vitest';
import { CollectionCategory } from '../enums/collection-category';
import { Rarity } from '../enums/rarity';
import { packSummary } from './summary';

describe('packSummary', () => {
  it('sums TCG slot counts', () => {
    expect(
      packSummary(CollectionCategory.TCG, {
        slots: [
          { rarity: Rarity.COMMON, count: 5 },
          { rarity: Rarity.RARE, count: 1 },
        ],
      }),
    ).toBe('6 cards');
  });
  it('reports the BLIND_BOX case size', () => {
    expect(
      packSummary(CollectionCategory.BLIND_BOX, {
        caseSize: 12,
        assortment: [{ itemId: 'a', count: 11 }],
      }),
    ).toBe('case of 12');
  });
  it('counts FIGURE items (singular/plural)', () => {
    expect(
      packSummary(CollectionCategory.FIGURE, { items: [{ itemId: 'a' }] }),
    ).toBe('1 figure');
    expect(
      packSummary(CollectionCategory.FIGURE, {
        items: [{ itemId: 'a' }, { itemId: 'b' }],
      }),
    ).toBe('2 figures');
  });
  it('falls back for an invalid pack model', () => {
    expect(packSummary(CollectionCategory.TCG, { slots: [] })).toBe(
      'Unknown pack',
    );
  });
});
