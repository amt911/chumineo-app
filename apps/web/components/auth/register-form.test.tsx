import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RegisterForm } from './register-form';
import * as api from '@/lib/api';

vi.mock('@/lib/api');

describe('RegisterForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a password with no number', async () => {
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password');
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }));
    expect(await screen.findByText(/number/i)).toBeInTheDocument();
    expect(api.registerUser).not.toHaveBeenCalled();
  });

  it('shows the success message after registering', async () => {
    (
      api.registerUser as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({ message: 'Verification email sent' });
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret12');
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }));
    await waitFor(() => expect(api.registerUser).toHaveBeenCalled());
    expect(
      await screen.findByText(/verification email sent/i),
    ).toBeInTheDocument();
  });
});
