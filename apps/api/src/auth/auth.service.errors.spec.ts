import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';
import * as pw from './password.util';

jest.mock('./password.util');

describe('AuthService (errors)', () => {
  const prisma = {
    user: { findUnique: jest.fn(), create: jest.fn() },
    verificationToken: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const users = { deriveUniqueUsername: jest.fn().mockResolvedValue('neo') };
  const mail = { sendVerificationEmail: jest.fn() };
  const redis = { get: jest.fn(), del: jest.fn(), incrWithTtl: jest.fn() };
  const tokens = { issueAccessToken: jest.fn(), issueRefreshToken: jest.fn() };
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

  it('rejects a duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'x' });
    await expect(
      service.register({ email: 'a@b.com', password: 'secret12' }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects an explicit username already taken', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null) // email free
      .mockResolvedValueOnce({ id: 'y' }); // username taken
    await expect(
      service.register({
        email: 'a@b.com',
        password: 'secret12',
        username: 'taken',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('verifyEmail rejects an expired token', async () => {
    prisma.verificationToken.findUnique.mockResolvedValueOnce({
      id: 'vt',
      userId: '1',
      consumedAt: null,
      expiresAt: new Date(Date.now() - 1),
    });
    await expect(service.verifyEmail('t')).rejects.toThrow(BadRequestException);
  });

  it('login rejects a wrong password and counts the attempt', async () => {
    redis.get.mockResolvedValueOnce(null);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: '1',
      email: 'a@b.com',
      passwordHash: 'h',
      emailVerified: true,
    });
    (pw.verifyPassword as jest.Mock).mockResolvedValueOnce(false);
    await expect(
      service.login({ email: 'a@b.com', password: 'bad', rememberMe: false }),
    ).rejects.toThrow(UnauthorizedException);
    expect(redis.incrWithTtl).toHaveBeenCalled();
  });

  it('login blocks an unverified user', async () => {
    redis.get.mockResolvedValueOnce(null);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: '1',
      email: 'a@b.com',
      passwordHash: 'h',
      emailVerified: false,
    });
    await expect(
      service.login({
        email: 'a@b.com',
        password: 'secret12',
        rememberMe: false,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('login locks out after too many attempts', async () => {
    redis.get.mockResolvedValueOnce('5');
    await expect(
      service.login({
        email: 'a@b.com',
        password: 'secret12',
        rememberMe: false,
      }),
    ).rejects.toThrow(HttpException);
  });
});
