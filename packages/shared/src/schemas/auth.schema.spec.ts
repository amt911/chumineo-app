import { describe, expect, it } from 'vitest';
import { registerSchema, loginSchema, verifySchema } from './auth.schema';

describe('registerSchema', () => {
  it('accepts a valid registration', () => {
    expect(
      registerSchema.safeParse({
        email: 'a@b.com',
        password: 'secret12',
        username: 'neo',
      }).success,
    ).toBe(true);
  });
  it('rejects a password under 8 chars', () => {
    expect(
      registerSchema.safeParse({ email: 'a@b.com', password: 'sec1' }).success,
    ).toBe(false);
  });
  it('rejects a password with no number', () => {
    expect(
      registerSchema.safeParse({ email: 'a@b.com', password: 'password' })
        .success,
    ).toBe(false);
  });
  it('rejects a username with spaces', () => {
    expect(
      registerSchema.safeParse({
        email: 'a@b.com',
        password: 'secret12',
        username: 'a b',
      }).success,
    ).toBe(false);
  });
  it('allows an omitted username', () => {
    expect(
      registerSchema.safeParse({ email: 'a@b.com', password: 'secret12' })
        .success,
    ).toBe(true);
  });
});

describe('loginSchema', () => {
  it('defaults rememberMe to false', () => {
    const parsed = loginSchema.parse({ email: 'a@b.com', password: 'x' });
    expect(parsed.rememberMe).toBe(false);
  });
});

describe('verifySchema', () => {
  it('rejects an empty token', () => {
    expect(verifySchema.safeParse({ token: '' }).success).toBe(false);
  });
});
