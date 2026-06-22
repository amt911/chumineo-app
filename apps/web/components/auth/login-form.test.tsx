import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LoginForm } from './login-form';
import * as api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('@/lib/api');
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

const mockLogin = api.loginUser as unknown as ReturnType<typeof vi.fn>;
const verifiedUser = {
  id: '1',
  email: 'a@b.com',
  username: 'neo',
  emailVerified: true,
  avatarUrl: null,
};

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: null, accessToken: null });
  });

  it('shows a validation error for an invalid email and does not submit', async () => {
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'not-an-email');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret12');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText(/invalid/i)).toBeInTheDocument();
    expect(api.loginUser).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('shows the server error and does not redirect on failed login', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret12');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => expect(api.loginUser).toHaveBeenCalled());
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('stores the session and redirects to /collections on success', async () => {
    mockLogin.mockResolvedValueOnce({ accessToken: 'tok', user: verifiedUser });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret12');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/collections'));
    expect(useAuthStore.getState().accessToken).toBe('tok');
    expect(useAuthStore.getState().user?.username).toBe('neo');
  });

  it('submits rememberMe=true when the checkbox is checked', async () => {
    mockLogin.mockResolvedValueOnce({ accessToken: 'tok', user: verifiedUser });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret12');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => expect(api.loginUser).toHaveBeenCalled());
    expect(mockLogin).toHaveBeenCalledWith(
      expect.objectContaining({ rememberMe: true }),
    );
  });
});
