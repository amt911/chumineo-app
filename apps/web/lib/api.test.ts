import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCollectionsPage,
  fetchBrands,
  fetchCollectionDetail,
  loginUser,
  fetchPublicProfile,
  registerUser,
  verifyEmail,
  resendVerification,
  logoutUser,
  fetchMe,
} from './api';

afterEach(() => vi.unstubAllGlobals());

describe('fetchCollectionsPage', () => {
  it('builds the query string and returns the parsed page', async () => {
    const page = {
      items: [],
      page: 2,
      pageSize: 20,
      total: 0,
      hasMore: false,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => page });
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      fetchCollectionsPage({ page: 2, category: undefined, q: 'char' }),
    ).resolves.toEqual(page);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/collections?');
    expect(url).toContain('page=2');
    expect(url).toContain('q=char');
    expect(url).not.toContain('category=');
  });

  it('throws on non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    await expect(fetchCollectionsPage({})).rejects.toThrow(/500/);
  });

  it('rejects when the response payload is invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ bad: true }),
      }),
    );
    await expect(fetchCollectionsPage({})).rejects.toThrow();
  });
});

describe('fetchBrands', () => {
  it('returns the brand list', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ slug: 'funko', name: 'Funko' }],
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchBrands()).resolves.toEqual([
      { slug: 'funko', name: 'Funko' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/brands'),
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('throws on non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    await expect(fetchBrands()).rejects.toThrow(/500/);
  });
});

describe('fetchCollectionDetail', () => {
  const validDetail = {
    id: 'col-1',
    slug: 's',
    name: 'Test Collection',
    category: 'TCG' as const,
    source: 'API_IMPORT' as const,
    status: 'PUBLISHED' as const,
    releaseYear: 2023,
    coverImageUrl: null,
    brand: { slug: 'pokemon', name: 'Pokémon' },
    createdBy: null,
    rarityDistribution: [],
    items: [],
    packTypes: [],
  };

  it('returns the detail json for a valid payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => validDetail }),
    );
    await expect(fetchCollectionDetail('s')).resolves.toEqual(validDetail);
  });

  it('throws on non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );
    await expect(fetchCollectionDetail('s')).rejects.toThrow(/404/);
  });
});

describe('loginUser', () => {
  it('posts credentials and returns the auth payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        accessToken: 'a',
        user: { id: '1', username: 'neo' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const out = await loginUser({
      email: 'a@b.com',
      password: 'secret12',
      rememberMe: false,
    });
    expect(out.accessToken).toBe('a');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('throws the server message on non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid credentials' }),
      }),
    );
    await expect(
      loginUser({ email: 'a@b.com', password: 'x', rememberMe: false }),
    ).rejects.toThrow(/Invalid credentials/);
  });
});

describe('fetchPublicProfile', () => {
  it('returns the profile json', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ username: 'neo' }),
      }),
    );
    await expect(fetchPublicProfile('neo')).resolves.toEqual({
      username: 'neo',
    });
  });

  it('throws on non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );
    await expect(fetchPublicProfile('ghost')).rejects.toThrow(/404/);
  });
});

describe('registerUser', () => {
  it('posts to /auth/register and returns message', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ message: 'ok' }) }),
    );
    await expect(
      registerUser({ email: 'a@b.com', password: 'secret12' }),
    ).resolves.toEqual({ message: 'ok' });
  });
});

describe('verifyEmail', () => {
  it('posts to /auth/verify with token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'verified' }),
      }),
    );
    await expect(verifyEmail('tok123')).resolves.toEqual({
      message: 'verified',
    });
  });
});

describe('resendVerification', () => {
  it('posts to /auth/resend-verification', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'sent' }),
      }),
    );
    await expect(resendVerification('a@b.com')).resolves.toEqual({
      message: 'sent',
    });
  });
});

describe('logoutUser', () => {
  it('posts to /auth/logout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'logged out' }),
      }),
    );
    await expect(logoutUser()).resolves.toEqual({ message: 'logged out' });
  });
});

describe('fetchMe', () => {
  it('fetches user with bearer token', async () => {
    const user = {
      id: '1',
      email: 'a@b.com',
      username: 'neo',
      emailVerified: true,
      avatarUrl: null,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => user });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchMe('mytoken')).resolves.toEqual(user);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me'),
      expect.objectContaining({ headers: { Authorization: 'Bearer mytoken' } }),
    );
  });

  it('throws on non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );
    await expect(fetchMe('bad')).rejects.toThrow(/401/);
  });
});

import {
  fetchInventoryProgress,
  addInventoryItem,
  deleteInventoryItem,
  fetchWishlist,
  refreshSession,
  createListing,
  updateListing,
  deleteListing,
  fetchMyListings,
  uploadListingPhotos,
  deleteListingPhoto,
  updateProfile,
} from './api';
import { useAuthStore } from './auth-store';
import { Condition, ListingStatus, Rarity } from '@sobrebox/shared';

afterEach(() => vi.restoreAllMocks());

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

describe('inventory/wishlist api wrappers', () => {
  it('fetchInventoryProgress validates the response', async () => {
    mockFetch(200, [
      { collection: { slug: 's', name: 'N' }, owned: 1, total: 2, percent: 50 },
    ]);
    const r = await fetchInventoryProgress('tok');
    expect(r[0].percent).toBe(50);
  });

  it('addInventoryItem sends a Bearer token', async () => {
    const spy = mockFetch(201, {
      id: 'inv1',
      quantity: 1,
      condition: null,
      item: { id: 'ci1', name: 'A', rarity: 'COMMON', imageUrl: null },
      collection: { slug: 's', name: 'N' },
    });
    await addInventoryItem({ collectionItemId: 'ci1', quantity: 1 }, 'tok');
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/inventory'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      }),
    );
  });

  it('deleteInventoryItem tolerates a 204', async () => {
    mockFetch(204, null);
    await expect(deleteInventoryItem('inv1', 'tok')).resolves.toBeUndefined();
  });

  it('fetchWishlist throws on a non-ok response', async () => {
    mockFetch(401, { message: 'nope' });
    await expect(fetchWishlist('tok')).rejects.toThrow();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

describe('refreshSession + 401 retry', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'old',
      user: null,
      status: 'authenticated',
    });
  });

  it('refreshSession posts to /api/auth/refresh', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ accessToken: 'new' }), { status: 200 }),
      );
    expect(await refreshSession()).toEqual({ accessToken: 'new' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('retries an authed call once after a 401 by refreshing', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 401 })) // wishlist 401
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'new' }), { status: 200 }),
      ) // refresh
      .mockResolvedValueOnce(new Response('[]', { status: 200 })); // retry
    const data = await fetchWishlist('old');
    expect(data).toEqual([]);
    expect(useAuthStore.getState().accessToken).toBe('new');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

function makeListingPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'l1',
    quantity: 1,
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
    photos: [],
    ...overrides,
  };
}

describe('marketplace api wrappers', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: null,
      status: 'authenticated',
    });
  });

  it('createListing posts the dto and returns the parsed listing', async () => {
    const spy = mockFetch(201, makeListingPayload());
    const dto = {
      collectionItemId: 'ci1',
      quantity: 1,
      condition: Condition.MINT,
      price: '19.99',
    };
    const result = await createListing(dto, 'tok');
    expect(result.id).toBe('l1');
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/marketplace/listings'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
        body: JSON.stringify(dto),
      }),
    );
  });

  it('updateListing patches the listing and returns the parsed result', async () => {
    const spy = mockFetch(
      200,
      makeListingPayload({ status: ListingStatus.PAUSED }),
    );
    const result = await updateListing(
      'l1',
      { status: ListingStatus.PAUSED },
      'tok',
    );
    expect(result.status).toBe(ListingStatus.PAUSED);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/marketplace/listings/l1'),
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
        body: JSON.stringify({ status: ListingStatus.PAUSED }),
      }),
    );
  });

  it('deleteListing sends a DELETE and tolerates a 204', async () => {
    const spy = mockFetch(204, null);
    await expect(deleteListing('l1', 'tok')).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/marketplace/listings/l1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('fetchMyListings validates and returns the listings page', async () => {
    mockFetch(200, {
      items: [makeListingPayload()],
      page: 1,
      total: 1,
      totalPages: 1,
    });
    const page = await fetchMyListings('tok');
    expect(page.items).toHaveLength(1);
    expect(page.items[0].id).toBe('l1');
  });

  it('deleteListingPhoto sends a DELETE to the photo endpoint', async () => {
    const spy = mockFetch(204, null);
    await expect(
      deleteListingPhoto('l1', 'p1', 'tok'),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/marketplace/listings/l1/photos/p1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('uploadListingPhotos sends a multipart FormData body with the bearer token', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => [{ id: 'p1', url: 'https://cdn.example.com/p1.jpg' }],
    } as Response);

    const file = new File(['fake-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    const result = await uploadListingPhotos('l1', [file], 'tok');

    expect(result).toEqual([
      { id: 'p1', url: 'https://cdn.example.com/p1.jpg' },
    ]);
    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/marketplace/listings/l1/photos');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).getAll('files')).toEqual([file]);
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok' });
  });

  it('uploadListingPhotos throws on non-ok', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 413,
    } as Response);
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    await expect(uploadListingPhotos('l1', [file], 'tok')).rejects.toThrow(
      /413/,
    );
  });
});

describe('updateProfile', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: null,
      status: 'authenticated',
    });
  });

  it('patches the profile and returns the parsed user', async () => {
    const spy = mockFetch(200, {
      id: 'u1',
      email: 'a@b.com',
      username: 'ash',
      emailVerified: true,
      avatarUrl: null,
      country: 'ES',
    });
    const result = await updateProfile({ country: 'ES' }, 'tok');
    expect(result.country).toBe('ES');
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/users/me'),
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
        body: JSON.stringify({ country: 'ES' }),
      }),
    );
  });
});
