import { Injectable, NotFoundException } from '@nestjs/common';
import { PublicProfileDto, publicProfileSchema } from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async deriveUniqueUsername(base: string): Promise<string> {
    const clean =
      base
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 20) || 'user';
    let candidate = clean;
    let i = 0;
    while (
      await this.prisma.user.findUnique({ where: { username: candidate } })
    ) {
      i += 1;
      candidate = `${clean.slice(0, 19 - String(i).length)}${i}`;
    }
    return candidate;
  }

  async getPublicProfile(username: string): Promise<PublicProfileDto> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new NotFoundException('User not found');
    return publicProfileSchema.parse({
      username: user.username,
      avatarUrl: user.avatarUrl,
      memberSince: user.createdAt.toISOString(),
    });
  }
}
