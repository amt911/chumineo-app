import { hashPassword, verifyPassword } from './password.util';

describe('password.util', () => {
  it('hashes to something other than the plaintext and verifies', async () => {
    const hash = await hashPassword('secret12');
    expect(hash).not.toBe('secret12');
    expect(await verifyPassword(hash, 'secret12')).toBe(true);
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });
});
