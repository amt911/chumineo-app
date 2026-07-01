import { describe, expect, it } from 'vitest';
import { authResponseSchema, messageResponseSchema } from './auth.dto';
import { publicUserSchema, publicProfileSchema } from './user.dto';

const validUser = {
  id: 'u1',
  email: 'a@b.com',
  username: 'neo',
  emailVerified: true,
  avatarUrl: null,
  country: null,
};

describe('publicUserSchema', () => {
  it('accepts a valid user', () => {
    expect(publicUserSchema.parse(validUser)).toEqual(validUser);
  });

  it('rejects an invalid email', () => {
    expect(
      publicUserSchema.safeParse({ ...validUser, email: 'not-an-email' })
        .success,
    ).toBe(false);
  });
});

describe('publicProfileSchema', () => {
  it('accepts a valid public profile', () => {
    const profile = {
      username: 'neo',
      avatarUrl: null,
      memberSince: '2026-01-01T00:00:00.000Z',
    };
    expect(publicProfileSchema.parse(profile)).toEqual(profile);
  });

  it('rejects a missing memberSince', () => {
    expect(
      publicProfileSchema.safeParse({ username: 'neo', avatarUrl: null })
        .success,
    ).toBe(false);
  });
});

describe('authResponseSchema', () => {
  it('accepts a valid auth response', () => {
    const response = { accessToken: 'tok', user: validUser };
    expect(authResponseSchema.parse(response)).toEqual(response);
  });

  it('rejects a missing accessToken', () => {
    expect(authResponseSchema.safeParse({ user: validUser }).success).toBe(
      false,
    );
  });
});

describe('messageResponseSchema', () => {
  it('accepts a valid message response', () => {
    expect(messageResponseSchema.parse({ message: 'ok' })).toEqual({
      message: 'ok',
    });
  });

  it('rejects a missing message', () => {
    expect(messageResponseSchema.safeParse({}).success).toBe(false);
  });
});
