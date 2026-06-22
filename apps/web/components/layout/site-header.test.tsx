import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SiteHeader } from './site-header';
import { useAuthStore } from '@/lib/auth-store';
import type { PublicUserDto } from '@sobrebox/shared';

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/api', () => ({
  logoutUser: vi.fn().mockResolvedValue(undefined),
}));

const mockUser: PublicUserDto = {
  id: '1',
  email: 'test@example.com',
  username: 'testuser',
  emailVerified: true,
  avatarUrl: null,
};

describe('SiteHeader', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: null });
  });

  it('shows Login and Register links when user is not authenticated', () => {
    render(<SiteHeader />);
    expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /register/i })).toBeInTheDocument();
  });

  it('shows username and Log out button when user is authenticated', () => {
    useAuthStore.setState({ user: mockUser, accessToken: 'tok' });
    render(<SiteHeader />);
    expect(screen.getByText('@testuser')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /log out/i }),
    ).toBeInTheDocument();
  });

  it('clears session and redirects on logout', async () => {
    useAuthStore.setState({ user: mockUser, accessToken: 'tok' });
    render(<SiteHeader />);
    await userEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
