import { describe, expect, it } from 'vitest';
import { AUTH_ERROR_CODES } from './auth-error-codes';

describe('AUTH_ERROR_CODES', () => {
  it('maps each key to its own string value', () => {
    for (const [k, v] of Object.entries(AUTH_ERROR_CODES)) expect(v).toBe(k);
  });
  it('includes EMAIL_NOT_VERIFIED', () => {
    expect(AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED).toBe('EMAIL_NOT_VERIFIED');
  });
});
