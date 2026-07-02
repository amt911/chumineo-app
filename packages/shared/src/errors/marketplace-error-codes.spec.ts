import { describe, expect, it } from 'vitest';
import { MARKETPLACE_ERROR_CODES } from './marketplace-error-codes';

describe('MARKETPLACE_ERROR_CODES', () => {
  it('maps each key to its own string value', () => {
    for (const [k, v] of Object.entries(MARKETPLACE_ERROR_CODES))
      expect(v).toBe(k);
  });
  it('includes INSUFFICIENT_STOCK and UNITS_RESERVED', () => {
    expect(MARKETPLACE_ERROR_CODES.INSUFFICIENT_STOCK).toBe(
      'INSUFFICIENT_STOCK',
    );
    expect(MARKETPLACE_ERROR_CODES.UNITS_RESERVED).toBe('UNITS_RESERVED');
  });
});
