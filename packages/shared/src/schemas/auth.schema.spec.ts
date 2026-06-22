import { describe, expect, it } from 'vitest';
import {
  registerSchema,
  loginSchema,
  verifySchema,
  resendVerificationSchema,
} from './auth.schema';

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
  it('normalizes email to lowercase and trims whitespace', () => {
    const result = registerSchema.safeParse({
      email: '  Alice@X.COM ',
      password: 'secret12',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('alice@x.com');
    }
  });
});

describe('loginSchema', () => {
  it('defaults rememberMe to false', () => {
    const parsed = loginSchema.parse({ email: 'a@b.com', password: 'x' });
    expect(parsed.rememberMe).toBe(false);
  });
  it('normalizes email to lowercase and trims whitespace', () => {
    const result = loginSchema.safeParse({
      email: '  Alice@X.COM ',
      password: 'secret12',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('alice@x.com');
    }
  });
});

describe('verifySchema', () => {
  it('rejects an empty token', () => {
    expect(verifySchema.safeParse({ token: '' }).success).toBe(false);
  });
});

describe('resendVerificationSchema', () => {
  it('normalizes email to lowercase and trims whitespace', () => {
    const result = resendVerificationSchema.safeParse({
      email: '  Alice@X.COM ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('alice@x.com');
    }
  });
});
