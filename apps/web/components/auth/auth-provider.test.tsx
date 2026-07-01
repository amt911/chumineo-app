import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from './auth-provider';
import { useAuthStore } from '@/lib/auth-store';
import * as api from '@/lib/api';

const user = {
  id: 'u1',
  email: 'a@b',
  username: 'neo',
  emailVerified: true,
  avatarUrl: null,
};

describe('AuthProvider', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, status: 'loading' });
  });
  afterEach(() => vi.restoreAllMocks());

  it('rehydrates the session on mount', async () => {
    vi.spyOn(api, 'refreshSession').mockResolvedValue({ accessToken: 'tok' });
    vi.spyOn(api, 'fetchMe').mockResolvedValue(user);
    render(<AuthProvider>hi</AuthProvider>);
    await waitFor(() =>
      expect(useAuthStore.getState().status).toBe('authenticated'),
    );
    expect(useAuthStore.getState().accessToken).toBe('tok');
    expect(screen.getByText('hi')).toBeInTheDocument();
  });

  it('marks unauthenticated when refresh fails', async () => {
    vi.spyOn(api, 'refreshSession').mockRejectedValue(new Error('401'));
    render(<AuthProvider>hi</AuthProvider>);
    await waitFor(() =>
      expect(useAuthStore.getState().status).toBe('unauthenticated'),
    );
    expect(screen.getByText('hi')).toBeInTheDocument();
  });

  it('does not refresh when already authenticated', async () => {
    useAuthStore.setState({
      accessToken: 'existing',
      user,
      status: 'authenticated',
    });
    const spy = vi
      .spyOn(api, 'refreshSession')
      .mockResolvedValue({ accessToken: 'x' });
    render(<AuthProvider>hi</AuthProvider>);
    await Promise.resolve();
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByText('hi')).toBeInTheDocument();
  });
});
