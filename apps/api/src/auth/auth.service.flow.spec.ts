import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';
import * as pw from './password.util';

jest.mock('./password.util');

const VERIFIED_USER = {
  id: '1',
  email: 'a@b.com',
  username: 'neo',
  emailVerified: true,
  avatarUrl: null,
  passwordHash: 'h',
  bio: null,
  createdAt: new Date(),
};

describe('AuthService (flow)', () => {
  const prisma = {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    verificationToken: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest
      .fn()
      .mockImplementation((ops: unknown[]) => Promise.all(ops)),
  };
  const users = { deriveUniqueUsername: jest.fn().mockResolvedValue('neo') };
  const mail = { sendVerificationEmail: jest.fn() };
  const redis = { get: jest.fn(), del: jest.fn(), incrWithTtl: jest.fn() };
  const tokens = {
    issueAccessToken: jest.fn().mockReturnValue('access.jwt'),
    issueRefreshToken: jest.fn().mockResolvedValue('refresh.raw'),
  };
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    (pw.hashPassword as jest.Mock).mockResolvedValue('hashed');
    (pw.verifyPassword as jest.Mock).mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: users },
        { provide: MailService, useValue: mail },
        { provide: RedisService, useValue: redis },
        { provide: TokenService, useValue: tokens },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('register creates a user and sends a verification email', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null); // email free
    prisma.user.create.mockResolvedValueOnce({ id: '1', email: 'a@b.com' });
    const res = await service.register({
      email: 'a@b.com',
      password: 'secret12',
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'a@b.com',
          username: 'neo',
          passwordHash: 'hashed',
        }),
      }),
    );
    expect(mail.sendVerificationEmail).toHaveBeenCalled();
    expect(res.message).toEqual(expect.any(String));
  });

  it('verifyEmail marks the user verified and consumes the token', async () => {
    prisma.verificationToken.findUnique.mockResolvedValueOnce({
      id: 'vt1',
      userId: '1',
      consumedAt: null,
      expiresAt: new Date(Date.now() + 1e6),
    });
    await service.verifyEmail('rawtok');
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('login returns access + refresh for a verified user', async () => {
    redis.get.mockResolvedValueOnce(null);
    prisma.user.findUnique.mockResolvedValueOnce(VERIFIED_USER);
    const out = await service.login(
      { email: 'a@b.com', password: 'secret12', rememberMe: false },
      'ua',
    );
    expect(out.auth.accessToken).toBe('access.jwt');
    expect(out.refreshToken).toBe('refresh.raw');
    expect(out.auth.user).toEqual(
      expect.objectContaining({
        id: '1',
        email: 'a@b.com',
        username: 'neo',
        emailVerified: true,
        avatarUrl: null,
      }),
    );
    expect(redis.del).toHaveBeenCalled();
  });
});
