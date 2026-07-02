import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/locales/es.json';
import { SiteHeader } from './site-header';
import { useAuthStore } from '@/lib/auth-store';
import type { PublicUserDto } from '@sobrebox/shared';

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}));

vi.mock('@/i18n/navigation', () => ({
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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

vi.mock('@/lib/api', () => ({
  logoutUser: vi.fn().mockResolvedValue(undefined),
}));

function renderHeader() {
  return render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <SiteHeader />
    </NextIntlClientProvider>,
  );
}

const mockUser: PublicUserDto = {
  id: '1',
  email: 'test@example.com',
  username: 'testuser',
  emailVerified: true,
  avatarUrl: null,
  country: null,
};

describe('SiteHeader', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      status: 'unauthenticated',
    });
  });

  it('shows translated Login and Register links when unauthenticated', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: /entrar/i })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /crear cuenta/i }),
    ).toBeInTheDocument();
  });

  it('always shows the collections and marketplace links and the locale switcher', () => {
    renderHeader();
    expect(
      screen.getByRole('link', { name: /colecciones/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /mercado/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'EN' })).toBeInTheDocument();
  });

  it('hides inventory/wishlist/my-listings nav when unauthenticated', () => {
    renderHeader();
    expect(
      screen.queryByRole('link', { name: /inventario/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /wishlist/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /mis anuncios/i }),
    ).not.toBeInTheDocument();
  });

  it('does not flash Login/Register while auth is loading', () => {
    useAuthStore.setState({ user: null, accessToken: null, status: 'loading' });
    renderHeader();
    expect(
      screen.queryByRole('link', { name: /entrar/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /crear cuenta/i }),
    ).not.toBeInTheDocument();
  });

  it('shows username, logout and inventory/wishlist nav when authenticated', () => {
    useAuthStore.setState({
      user: mockUser,
      accessToken: 'tok',
      status: 'authenticated',
    });
    renderHeader();
    expect(screen.getByText('@testuser')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salir/i })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /inventario/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /wishlist/i })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /mis anuncios/i }),
    ).toBeInTheDocument();
  });

  it('clears session on logout', async () => {
    useAuthStore.setState({
      user: mockUser,
      accessToken: 'tok',
      status: 'authenticated',
    });
    renderHeader();
    await userEvent.click(screen.getByRole('button', { name: /salir/i }));
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
