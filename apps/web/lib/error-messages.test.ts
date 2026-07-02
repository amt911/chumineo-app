import { describe, expect, it } from 'vitest';
import { errorMessageKey } from './error-messages';

describe('errorMessageKey', () => {
  it('maps a known code', () => {
    expect(errorMessageKey('EMAIL_NOT_VERIFIED')).toBe(
      'Errors.EMAIL_NOT_VERIFIED',
    );
  });
  it('maps INVALID_CREDENTIALS', () => {
    expect(errorMessageKey('INVALID_CREDENTIALS')).toBe(
      'Errors.INVALID_CREDENTIALS',
    );
  });
  it('maps marketplace codes', () => {
    expect(errorMessageKey('INSUFFICIENT_STOCK')).toBe(
      'Errors.INSUFFICIENT_STOCK',
    );
    expect(errorMessageKey('UNITS_RESERVED')).toBe('Errors.UNITS_RESERVED');
  });
  it('falls back to UNKNOWN for an unknown message', () => {
    expect(errorMessageKey('Request failed: 500')).toBe('Errors.UNKNOWN');
  });
});
