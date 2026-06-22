import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { generateOpaqueToken, sha256 } from './token.util';

const DAY_MS = 86_400_000;

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  issueAccessToken(user: {
    id: string;
    email: string;
    username: string;
  }): string {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
      username: user.username,
    });
  }

  async issueRefreshToken(
    userId: string,
    userAgent: string | undefined,
    days: number,
  ): Promise<string> {
    const raw = generateOpaqueToken();
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: sha256(raw),
        userAgent,
        expiresAt: new Date(Date.now() + days * DAY_MS),
      },
    });
    return raw;
  }

  async rotate(
    rawToken: string,
    userAgent?: string,
  ): Promise<{ userId: string; refreshToken: string }> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256(rawToken) },
    });
    if (!session) throw new UnauthorizedException('Invalid refresh token');
    if (session.revokedAt) {
      // Reuse of an already-rotated token → assume theft, kill the whole chain.
      await this.revokeAllForUser(session.userId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (session.expiresAt.getTime() < Date.now())
      throw new UnauthorizedException('Refresh token expired');

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    // Preserve the original remember-window length across rotations.
    const days = Math.max(
      1,
      Math.round(
        (session.expiresAt.getTime() - session.createdAt.getTime()) / DAY_MS,
      ),
    );
    const refreshToken = await this.issueRefreshToken(
      session.userId,
      userAgent,
      days,
    );
    return { userId: session.userId, refreshToken };
  }

  async revoke(rawToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash: sha256(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
