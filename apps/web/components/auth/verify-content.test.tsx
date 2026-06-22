import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { VerifyContent } from './verify-content';
import * as api from '@/lib/api';

const getMock = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: getMock }),
}));
vi.mock('@/lib/api', () => ({ verifyEmail: vi.fn() }));

describe('VerifyContent', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('shows an error and does not call verifyEmail when token is missing', async () => {
    getMock.mockReturnValue(null);
    render(<VerifyContent />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/missing verification token/i);
    expect(vi.mocked(api.verifyEmail)).not.toHaveBeenCalled();
  });

  it('shows the success message and calls verifyEmail with the token on success', async () => {
    getMock.mockReturnValue('tok');
    vi.mocked(api.verifyEmail).mockImplementation(() =>
      Promise.resolve({ message: 'Email verified' }),
    );
    render(<VerifyContent />);
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Email verified');
    expect(vi.mocked(api.verifyEmail)).toHaveBeenCalledWith('tok');
  });

  it('shows an error message when verifyEmail rejects', async () => {
    getMock.mockReturnValue('tok');
    vi.mocked(api.verifyEmail).mockImplementation(() =>
      Promise.reject(new Error('Invalid or expired token')),
    );
    render(<VerifyContent />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/invalid or expired token/i);
  });
});
