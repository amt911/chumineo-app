import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/locales/es.json';
import { LoginForm } from './login-form';
import * as api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('@/lib/api');
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

function renderForm() {
  return render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <LoginForm />
    </NextIntlClientProvider>,
  );
}

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
    renderForm();
    await userEvent.type(screen.getByLabelText(/email/i), 'not-an-email');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret12');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText(/invalid/i)).toBeInTheDocument();
    expect(api.loginUser).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('translates a known error code and does not redirect on failed login', async () => {
    mockLogin.mockRejectedValueOnce(new Error('INVALID_CREDENTIALS'));
    renderForm();
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret12');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => expect(api.loginUser).toHaveBeenCalled());
    // raw code is NOT shown; the es translation is
    expect(
      await screen.findByText(/email o contrase[ñn]a incorrectos/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('INVALID_CREDENTIALS')).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('shows the translated verify-email message on EMAIL_NOT_VERIFIED', async () => {
    mockLogin.mockRejectedValueOnce(new Error('EMAIL_NOT_VERIFIED'));
    renderForm();
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret12');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText(/verifica tu correo/i)).toBeInTheDocument();
    expect(screen.queryByText('EMAIL_NOT_VERIFIED')).not.toBeInTheDocument();
  });

  it('falls back to a generic message for an unknown error', async () => {
    mockLogin.mockRejectedValueOnce(new Error('kaboom'));
    renderForm();
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret12');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText(/algo sali[óo] mal/i)).toBeInTheDocument();
  });

  it('stores the session and redirects to /collections on success', async () => {
    mockLogin.mockResolvedValueOnce({ accessToken: 'tok', user: verifiedUser });
    renderForm();
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret12');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/collections'));
    expect(useAuthStore.getState().accessToken).toBe('tok');
    expect(useAuthStore.getState().user?.username).toBe('neo');
  });

  it('submits rememberMe=true when the checkbox is checked', async () => {
    mockLogin.mockResolvedValueOnce({ accessToken: 'tok', user: verifiedUser });
    renderForm();
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
