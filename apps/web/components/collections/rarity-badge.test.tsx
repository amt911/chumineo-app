import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Rarity } from '@sobrebox/shared';
import { RarityBadge } from './rarity-badge';

describe('RarityBadge', () => {
  it('renders a human label for each rarity (text, not just colour)', () => {
    render(<RarityBadge rarity={Rarity.ULTRA_RARE} />);
    expect(screen.getByText(/ultra rare/i)).toBeInTheDocument();
  });
  it('sets the rarity colour via CSS variable', () => {
    render(<RarityBadge rarity={Rarity.SECRET} />);
    const el = screen.getByText(/secret/i).closest('span');
    expect(el?.getAttribute('style') ?? '').toContain('--rarity-secret');
  });
});
