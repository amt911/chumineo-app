import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('OptionalJwtAuthGuard', () => {
  const guard = new OptionalJwtAuthGuard();

  it('returns the user object unchanged when a valid user is passed', () => {
    const user = { id: 'u1', email: 'a@b.com', username: 'neo' };
    expect(guard.handleRequest(null, user)).toBe(user);
  });

  it('returns undefined (does not throw) when no user is present', () => {
    expect(() => guard.handleRequest(null, undefined)).not.toThrow();
    expect(guard.handleRequest(null, undefined)).toBeUndefined();
  });

  it('does not throw even when an error is passed alongside no user', () => {
    expect(() =>
      guard.handleRequest(new Error('invalid token'), undefined),
    ).not.toThrow();
  });
});
