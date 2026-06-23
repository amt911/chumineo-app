import { afterEach, describe, expect, it, vi } from 'vitest';
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
