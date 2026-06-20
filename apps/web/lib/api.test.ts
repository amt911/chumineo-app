import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CollectionCategory,
  CollectionSource,
  CollectionStatus,
} from '@sobrebox/shared';
import { fetchCollections } from './api';

afterEach(() => vi.unstubAllGlobals());

const validCollection = {
  id: '1',
  slug: 'a',
  name: 'N',
  category: CollectionCategory.TCG,
  status: CollectionStatus.PUBLISHED,
  source: CollectionSource.API_IMPORT,
};

describe('fetchCollections', () => {
  it('returns the validated collections and hits /collections (no-store)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [validCollection] });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCollections()).resolves.toEqual([validCollection]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/collections'),
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchCollections()).rejects.toThrow(/500/);
  });

  it('throws when the payload shape is invalid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: '1' }],
    }));
    await expect(fetchCollections()).rejects.toThrow();
  });
});
