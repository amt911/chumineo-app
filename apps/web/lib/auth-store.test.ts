import { describe, expect, it, beforeEach } from 'vitest';
import { useAuthStore } from './auth-store';

const user = {
  id: 'u1',
  email: 'a@b',
  username: 'neo',
  emailVerified: true,
  avatarUrl: null,
  country: null,
};

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      user: null,
      status: 'loading',
    });
  });

  it('starts in loading', () => {
    expect(useAuthStore.getState().status).toBe('loading');
  });

  it('setSession authenticates', () => {
    useAuthStore.getState().setSession('tok', user);
    const s = useAuthStore.getState();
    expect(s.accessToken).toBe('tok');
    expect(s.user).toEqual(user);
    expect(s.status).toBe('authenticated');
  });

  it('clear unauthenticates', () => {
    useAuthStore.getState().setSession('tok', user);
    useAuthStore.getState().clear();
    const s = useAuthStore.getState();
    expect(s.accessToken).toBeNull();
    expect(s.user).toBeNull();
    expect(s.status).toBe('unauthenticated');
  });

  it('setAccessToken keeps the user', () => {
    useAuthStore.getState().setSession('tok', user);
    useAuthStore.getState().setAccessToken('tok2');
    const s = useAuthStore.getState();
    expect(s.accessToken).toBe('tok2');
    expect(s.user).toEqual(user);
  });

  it('setStatus updates only status', () => {
    useAuthStore.getState().setSession('tok', user);
    const beforeAccessToken = useAuthStore.getState().accessToken;
    const beforeUser = useAuthStore.getState().user;
    useAuthStore.getState().setStatus('unauthenticated');
    const s = useAuthStore.getState();
    expect(s.status).toBe('unauthenticated');
    expect(s.accessToken).toBe(beforeAccessToken);
    expect(s.user).toEqual(beforeUser);
  });
});
