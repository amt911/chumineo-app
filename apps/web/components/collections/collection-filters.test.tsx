import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  CollectionFilters,
  type CatalogFilterState,
} from './collection-filters';

vi.mock('@/lib/api', () => ({
  fetchBrands: vi
    .fn()
    .mockResolvedValue([{ slug: 'pokemon', name: 'Pokémon' }]),
}));

const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Wrapper({
  onChange,
  initial = {},
}: {
  onChange: (next: CatalogFilterState) => void;
  initial?: CatalogFilterState;
}) {
  const [value, setValue] = useState<CatalogFilterState>(initial);
  return (
    <QueryClientProvider client={client}>
      <CollectionFilters
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    </QueryClientProvider>
  );
}

describe('CollectionFilters', () => {
  it('emits a q change as the user types', async () => {
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'char');
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)?.[0];
    expect(last.q).toContain('char');
  });

  it('emits a year change when user types a number', async () => {
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    await userEvent.type(screen.getByPlaceholderText(/any year/i), '2023');
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)?.[0];
    expect(last.year).toBe(2023);
  });

  it('renders controlled values for search and year', () => {
    render(
      <Wrapper onChange={vi.fn()} initial={{ q: 'pikachu', year: 2024 }} />,
    );
    expect(screen.getByDisplayValue('pikachu')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2024')).toBeInTheDocument();
  });
});
