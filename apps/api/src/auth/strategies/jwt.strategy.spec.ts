import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('maps a JWT payload to the request user', () => {
    const user = new JwtStrategy().validate({
      sub: '1',
      email: 'a@b.com',
      username: 'neo',
    });
    expect(user).toEqual({ id: '1', email: 'a@b.com', username: 'neo' });
  });
});
