import { describe, expect, it } from 'vitest';
import { CollectionCategory } from '../enums/collection-category';
import { Rarity } from '../enums/rarity';
import { validatePackModel } from './registry';

describe('validatePackModel', () => {
  it('accepts a valid TCG pack model', () => {
    expect(
      validatePackModel(CollectionCategory.TCG, {
        slots: [{ rarity: Rarity.COMMON, count: 5 }],
      }).success,
    ).toBe(true);
  });

  it('rejects a TCG pack model with no slots', () => {
    expect(validatePackModel(CollectionCategory.TCG, { slots: [] }).success).toBe(false);
  });

  it('accepts a valid BLIND_BOX pack model with a chase', () => {
    expect(
      validatePackModel(CollectionCategory.BLIND_BOX, {
        caseSize: 12,
        assortment: [{ itemId: 'a', count: 11 }],
        chase: { itemId: 'b', odds: 144 },
      }).success,
    ).toBe(true);
  });

  it('accepts a valid FIGURE pack model', () => {
    expect(
      validatePackModel(CollectionCategory.FIGURE, { items: [{ itemId: 'a' }] }).success,
    ).toBe(true);
  });

  it('rejects a TCG slot with a non-positive count', () => {
    expect(
      validatePackModel(CollectionCategory.TCG, {
        slots: [{ rarity: Rarity.COMMON, count: 0 }],
      }).success,
    ).toBe(false);
  });

  it('rejects a BLIND_BOX pack model with an empty assortment', () => {
    expect(
      validatePackModel(CollectionCategory.BLIND_BOX, { caseSize: 12, assortment: [] }).success,
    ).toBe(false);
  });

  it('rejects a FIGURE pack model with no items', () => {
    expect(validatePackModel(CollectionCategory.FIGURE, { items: [] }).success).toBe(false);
  });

  it('rejects an unknown category', () => {
    expect(validatePackModel('NOPE' as CollectionCategory, {}).success).toBe(false);
  });
});
