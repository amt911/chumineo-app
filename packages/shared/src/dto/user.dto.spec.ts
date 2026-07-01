import { describe, expect, it } from 'vitest';
import { updateProfileSchema, publicUserSchema } from './user.dto';

describe('updateProfileSchema', () => {
  it('accepts a 2-letter uppercase ISO country code', () => {
    expect(updateProfileSchema.parse({ country: 'ES' })).toEqual({
      country: 'ES',
    });
  });
  it('allows clearing country with null', () => {
    expect(updateProfileSchema.parse({ country: null })).toEqual({
      country: null,
    });
  });
  it('rejects a lowercase or non-2-letter code', () => {
    expect(updateProfileSchema.safeParse({ country: 'es' }).success).toBe(
      false,
    );
    expect(updateProfileSchema.safeParse({ country: 'ESP' }).success).toBe(
      false,
    );
  });
});

describe('publicUserSchema', () => {
  it('accepts a row with country', () => {
    const row = {
      id: 'u1',
      email: 'a@b.com',
      username: 'a',
      emailVerified: true,
      avatarUrl: null,
      country: 'ES',
    };
    expect(publicUserSchema.parse(row)).toEqual(row);
  });
});
