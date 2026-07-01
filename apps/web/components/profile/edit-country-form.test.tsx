import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { EditCountryForm } from './edit-country-form';
import * as api from '@/lib/api';

vi.mock('@/lib/api');
vi.mock('@/lib/auth-store', () => ({
  useAuthStore: (selector: (s: { accessToken: string }) => unknown) =>
    selector({ accessToken: 'token' }),
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

describe('EditCountryForm', () => {
  it('submits the selected country', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'updateProfile').mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      username: 'ash',
      emailVerified: true,
      avatarUrl: null,
      country: 'ES',
    });
    renderWithProviders(<EditCountryForm currentCountry={null} />);
    await user.selectOptions(screen.getByLabelText('Country'), 'ES');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.updateProfile).toHaveBeenCalledWith(
        { country: 'ES' },
        'token',
      ),
    );
  });
});
