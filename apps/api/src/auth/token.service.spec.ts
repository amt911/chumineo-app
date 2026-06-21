import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';
import { sha256 } from './token.util';

describe('TokenService', () => {
  const session = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const prisma = { session } as unknown as PrismaService;
  const jwt = {
    sign: jest.fn().mockReturnValue('access.jwt'),
  } as unknown as JwtService;
  let service: TokenService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = moduleRef.get(TokenService);
  });

  it('issues an access token from the JWT payload', () => {
    expect(
      service.issueAccessToken({ id: '1', email: 'a@b.com', username: 'neo' }),
    ).toBe('access.jwt');
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: '1', email: 'a@b.com', username: 'neo' }),
    );
  });

  it('persists the HASH of a new refresh token', async () => {
    session.create.mockResolvedValueOnce({});
    const raw = await service.issueRefreshToken('1', 'ua', 7);
    expect(session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: '1', tokenHash: sha256(raw) }),
      }),
    );
  });

  it('rotates a valid token: revokes the old, issues a new', async () => {
    const now = Date.now();
    session.findUnique.mockResolvedValueOnce({
      id: 's1',
      userId: '1',
      revokedAt: null,
      expiresAt: new Date(now + 1e6),
      createdAt: new Date(now - 1e6),
    });
    session.create.mockResolvedValueOnce({});
    const out = await service.rotate('rawtok', 'ua');
    expect(session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
    expect(out.userId).toBe('1');
    expect(out.refreshToken).toEqual(expect.any(String));
  });

  it('detects reuse of a revoked token and revokes all sessions', async () => {
    session.findUnique.mockResolvedValueOnce({
      id: 's1',
      userId: '1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 1e6),
      createdAt: new Date(),
    });
    await expect(service.rotate('rawtok')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: '1' }),
      }),
    );
  });

  it('rejects an unknown token', async () => {
    session.findUnique.mockResolvedValueOnce(null);
    await expect(service.rotate('rawtok')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an expired token', async () => {
    session.findUnique.mockResolvedValueOnce({
      id: 's1',
      userId: '1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1),
      createdAt: new Date(Date.now() - 1e6),
    });
    await expect(service.rotate('rawtok')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
