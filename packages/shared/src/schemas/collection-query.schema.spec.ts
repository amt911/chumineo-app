import { describe, expect, it } from 'vitest';
import { collectionsQuerySchema } from './collection-query.schema';

describe('collectionsQuerySchema', () => {
  it('applies defaults', () => {
    const q = collectionsQuerySchema.parse({});
    expect(q).toEqual({ page: 1, limit: 20, sort: 'newest' });
  });
  it('coerces numeric strings (query params arrive as strings)', () => {
    const q = collectionsQuerySchema.parse({
      page: '2',
      limit: '5',
      year: '2023',
    });
    expect(q.page).toBe(2);
    expect(q.limit).toBe(5);
    expect(q.year).toBe(2023);
  });
  it('rejects an unknown sort', () => {
    expect(
      collectionsQuerySchema.safeParse({ sort: 'popularity' }).success,
    ).toBe(false);
  });
  it('caps limit at 50', () => {
    expect(collectionsQuerySchema.safeParse({ limit: 999 }).success).toBe(
      false,
    );
  });
});
