import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const user = { findUnique: jest.fn() };
  const prisma = { user } as unknown as PrismaService;
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('returns the cleaned base username when free', async () => {
    user.findUnique.mockResolvedValueOnce(null);
    expect(await service.deriveUniqueUsername('Neo!')).toBe('neo');
  });

  it('appends a numeric suffix when taken', async () => {
    user.findUnique
      .mockResolvedValueOnce({ id: 'x' })
      .mockResolvedValueOnce(null);
    expect(await service.deriveUniqueUsername('neo')).toBe('neo1');
  });

  it('maps a profile and strips private fields', async () => {
    const created = new Date('2026-01-02T03:04:05.000Z');
    user.findUnique.mockResolvedValueOnce({
      username: 'neo',
      avatarUrl: null,
      createdAt: created,
      email: 'secret@b.com',
    });
    const profile = await service.getPublicProfile('neo');
    expect(profile).toEqual({
      username: 'neo',
      avatarUrl: null,
      memberSince: created.toISOString(),
    });
    expect(profile).not.toHaveProperty('email');
  });

  it('throws when the profile is missing', async () => {
    user.findUnique.mockResolvedValueOnce(null);
    await expect(service.getPublicProfile('ghost')).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('getAuthUser', () => {
    const dbUser = {
      id: 'user-id-1',
      email: 'alice@x.com',
      username: 'alice',
      emailVerified: true,
      avatarUrl: null,
      createdAt: new Date(),
      passwordHash: 'secret-hash',
    };

    it('returns PublicUserDto with real fields', async () => {
      user.findUnique.mockResolvedValueOnce(dbUser);
      const result = await service.getAuthUser('user-id-1');
      expect(result).toEqual({
        id: 'user-id-1',
        email: 'alice@x.com',
        username: 'alice',
        emailVerified: true,
        avatarUrl: null,
      });
    });

    it('strips private fields from result', async () => {
      user.findUnique.mockResolvedValueOnce(dbUser);
      const result = await service.getAuthUser('user-id-1');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('createdAt');
    });

    it('throws NotFoundException when user is missing', async () => {
      user.findUnique.mockResolvedValueOnce(null);
      await expect(service.getAuthUser('ghost-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
