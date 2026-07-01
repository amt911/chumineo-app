import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { ProfileCountrySection } from './profile-country-section';

vi.mock('@/lib/api');

let mockUsername: string | undefined;

vi.mock('@/lib/auth-store', () => ({
  useAuthStore: (
    selector: (s: { user: { username: string } | null }) => unknown,
  ) => selector({ user: mockUsername ? { username: mockUsername } : null }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider
        locale="en"
        messages={{
          Profile: { country: 'Country', save: 'Save', toastSaved: 'Saved' },
        }}
      >
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('ProfileCountrySection', () => {
  it('renders EditCountryForm when the store username matches the prop', () => {
    mockUsername = 'ash';
    renderWithProviders(<ProfileCountrySection username="ash" country="ES" />);
    expect(screen.getByLabelText('Country')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('renders nothing when the store username does not match the prop', () => {
    mockUsername = 'someoneElse';
    const { container } = renderWithProviders(
      <ProfileCountrySection username="ash" country="ES" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there is no logged-in user', () => {
    mockUsername = undefined;
    const { container } = renderWithProviders(
      <ProfileCountrySection username="ash" country="ES" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
