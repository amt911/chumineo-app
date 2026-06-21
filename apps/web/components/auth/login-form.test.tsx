import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LoginForm } from './login-form';
import * as api from '@/lib/api';

vi.mock('@/lib/api');

describe('LoginForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a validation error for an invalid email', async () => {
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'not-an-email');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret12');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText(/invalid/i)).toBeInTheDocument();
    expect(api.loginUser).not.toHaveBeenCalled();
  });

  it('submits valid credentials and shows API errors', async () => {
    (
      api.loginUser as unknown as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new Error('Invalid credentials'));
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret12');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => expect(api.loginUser).toHaveBeenCalled());
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
