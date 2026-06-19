import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCollections } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('fetchCollections', () => {
  it('returns parsed json on ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => [{ id: '1' }],
    }));
    await expect(fetchCollections()).resolves.toEqual([{ id: '1' }]);
  });

  it('throws on non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchCollections()).rejects.toThrow(/500/);
  });
});
