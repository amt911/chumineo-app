import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ThemeToggle } from './theme-toggle';

const setThemeMock = vi.fn();

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: setThemeMock }),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    setThemeMock.mockReset();
  });

  it('renders the toggle button after mounting', async () => {
    render(<ThemeToggle />);
    // After mount the button should appear (initially a placeholder div)
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /toggle theme/i }),
      ).toBeInTheDocument();
    });
  });

  it('calls setTheme with dark when clicked in light mode', async () => {
    render(<ThemeToggle />);
    const button = await screen.findByRole('button', { name: /toggle theme/i });
    await userEvent.click(button);
    expect(setThemeMock).toHaveBeenCalledWith('dark');
  });
});
