import { describe, expect, it } from 'vitest';
import { CollectionCategory } from '../enums/collection-category';
import { CollectionSource } from '../enums/collection-source';
import { CollectionStatus } from '../enums/collection-status';
import { collectionResponseSchema, collectionsResponseSchema } from './collection.dto';

const valid = {
  id: '1',
  slug: 's',
  name: 'N',
  category: CollectionCategory.TCG,
  status: CollectionStatus.PUBLISHED,
  source: CollectionSource.API_IMPORT,
};

describe('collectionResponseSchema', () => {
  it('accepts a valid collection and strips unknown fields', () => {
    expect(collectionResponseSchema.parse({ ...valid, brandId: 'x' })).toEqual(valid);
  });

  it('rejects an invalid category', () => {
    expect(collectionResponseSchema.safeParse({ ...valid, category: 'NOPE' }).success).toBe(false);
  });

  it('validates a list via collectionsResponseSchema', () => {
    expect(collectionsResponseSchema.parse([valid])).toEqual([valid]);
  });
});
