import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InventoryProgress } from './inventory-progress';
import { useAuthStore } from '@/lib/auth-store';
import * as api from '@/lib/api';

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe('InventoryProgress', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'u1',
        email: 'a@b',
        username: 'neo',
        emailVerified: true,
        avatarUrl: null,
      },
    });
  });

  it('renders a card per collection with the percent', async () => {
    vi.spyOn(api, 'fetchInventoryProgress').mockResolvedValue([
      {
        collection: { slug: 's', name: 'Obsidian Flames' },
        owned: 12,
        total: 50,
        percent: 24,
      },
    ]);
    wrap(<InventoryProgress />);
    await waitFor(() =>
      expect(screen.getByText('Obsidian Flames')).toBeInTheDocument(),
    );
    expect(screen.getByText(/12\s*\/\s*50/)).toBeInTheDocument();
    expect(screen.getByText(/24%/)).toBeInTheDocument();
  });

  it('shows an empty state when nothing is owned', async () => {
    vi.spyOn(api, 'fetchInventoryProgress').mockResolvedValue([]);
    wrap(<InventoryProgress />);
    await waitFor(() =>
      expect(screen.getByText(/todav[íi]a no tienes/i)).toBeInTheDocument(),
    );
  });
});
