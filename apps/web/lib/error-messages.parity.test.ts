import { describe, expect, it } from 'vitest';
import { AUTH_ERROR_CODES } from '@sobrebox/shared';
import es from '@/locales/es.json';
import en from '@/locales/en.json';

describe('error catalog parity', () => {
  it('every auth error code has an es + en translation', () => {
    for (const code of Object.values(AUTH_ERROR_CODES)) {
      expect(es.Errors).toHaveProperty(code);
      expect(en.Errors).toHaveProperty(code);
    }
  });
  it('both catalogs define Errors.UNKNOWN', () => {
    expect(es.Errors).toHaveProperty('UNKNOWN');
    expect(en.Errors).toHaveProperty('UNKNOWN');
  });
});
