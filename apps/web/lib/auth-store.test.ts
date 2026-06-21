import { describe, expect, it, beforeEach } from 'vitest';
import { useAuthStore } from './auth-store';

describe('useAuthStore', () => {
  beforeEach(() => useAuthStore.getState().clear());

  it('stores and clears a session', () => {
    useAuthStore.getState().setSession('tok', {
      id: '1',
      email: 'a@b.com',
      username: 'neo',
      emailVerified: true,
      avatarUrl: null,
    });
    expect(useAuthStore.getState().accessToken).toBe('tok');
    expect(useAuthStore.getState().user?.username).toBe('neo');
    useAuthStore.getState().clear();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
