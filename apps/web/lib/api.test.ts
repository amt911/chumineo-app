import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CollectionCategory,
  CollectionSource,
  CollectionStatus,
} from '@sobrebox/shared';
import {
  fetchCollections,
  loginUser,
  fetchPublicProfile,
  registerUser,
  verifyEmail,
  resendVerification,
  logoutUser,
  fetchMe,
} from './api';

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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    await expect(fetchCollections()).rejects.toThrow(/500/);
  });

  it('throws when the payload shape is invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: '1' }],
      }),
    );
    await expect(fetchCollections()).rejects.toThrow();
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
      vi
        .fn()
        .mockResolvedValue({
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
      vi
        .fn()
        .mockResolvedValue({
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
      vi
        .fn()
        .mockResolvedValue({
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
