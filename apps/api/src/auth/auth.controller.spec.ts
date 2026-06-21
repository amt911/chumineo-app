import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  const auth = {
    register: jest.fn().mockResolvedValue({ message: 'ok' }),
    login: jest.fn().mockResolvedValue({
      auth: { accessToken: 'a', user: { id: '1' } },
      refreshToken: 'r',
      rememberMe: false,
    }),
    refresh: jest
      .fn()
      .mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2' }),
    logout: jest.fn().mockResolvedValue({ message: 'bye' }),
    verifyEmail: jest.fn().mockResolvedValue({ message: 'verified' }),
    resendVerification: jest.fn().mockResolvedValue({ message: 'sent' }),
  };
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compile();
    controller = moduleRef.get(AuthController);
  });

  it('login sets the refresh cookie and returns the auth payload', async () => {
    const res = { cookie: jest.fn(), clearCookie: jest.fn() };
    const out = await controller.login(
      { email: 'a@b.com', password: 'secret12', rememberMe: false },
      { headers: { 'user-agent': 'ua' }, cookies: {} } as never,
      res as never,
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'r',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(out).toEqual({ accessToken: 'a', user: { id: '1' } });
  });

  it('refresh reads the cookie and rotates', async () => {
    const res = { cookie: jest.fn() };
    await controller.refresh(
      { headers: {}, cookies: { refresh_token: 'r' } } as never,
      res as never,
    );
    expect(auth.refresh).toHaveBeenCalledWith('r', undefined);
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'r2',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('logout clears the cookie with matching options', async () => {
    const res = { clearCookie: jest.fn() };
    await controller.logout(
      { cookies: { refresh_token: 'r' } } as never,
      res as never,
    );
    expect(auth.logout).toHaveBeenCalledWith('r');
    expect(res.clearCookie).toHaveBeenCalledWith(
      'refresh_token',
      expect.objectContaining({ path: '/auth', httpOnly: true }),
    );
  });

  it('register delegates to auth.register and returns its result', async () => {
    const dto = {
      email: 'a@b.com',
      password: 'secret12',
      username: 'neo',
    };
    const result = await controller.register(dto as never);
    expect(auth.register).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ message: 'ok' });
  });

  it('resend calls auth.resendVerification with only the email', async () => {
    const dto = { email: 'a@b.com' };
    const result = await controller.resend(dto);
    expect(auth.resendVerification).toHaveBeenCalledWith('a@b.com');
    expect(result).toEqual({ message: 'sent' });
  });

  it('verify calls auth.verifyEmail with the token', async () => {
    const dto = { token: 'tok123' };
    const result = await controller.verify(dto);
    expect(auth.verifyEmail).toHaveBeenCalledWith('tok123');
    expect(result).toEqual({ message: 'verified' });
  });

  it('me returns identity fields from the current user', () => {
    const user = { id: '1', email: 'a@b.com', username: 'neo' };
    const result = controller.me(user);
    expect(result).toMatchObject({
      id: '1',
      email: 'a@b.com',
      username: 'neo',
    });
  });
});
