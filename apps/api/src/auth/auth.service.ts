import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AUTH_ERROR_CODES,
  AuthResponseDto,
  LoginDto,
  MessageResponseDto,
  PublicUserDto,
  RegisterDto,
} from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';
import { TokenService } from './token.service';
import { hashPassword, verifyPassword } from './password.util';
import { generateOpaqueToken, sha256 } from './token.util';
import { AUTH } from './auth.constants';

const HTTP_LOCKED = 423;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

type DbUser = {
  id: string;
  email: string;
  username: string;
  emailVerified: boolean;
  avatarUrl: string | null;
  country: string | null;
  passwordHash: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly redis: RedisService,
    private readonly tokens: TokenService,
  ) {}

  toPublicUser(
    u: Pick<
      DbUser,
      'id' | 'email' | 'username' | 'emailVerified' | 'avatarUrl' | 'country'
    >,
  ): PublicUserDto {
    return {
      id: u.id,
      email: u.email,
      username: u.username,
      emailVerified: u.emailVerified,
      avatarUrl: u.avatarUrl,
      country: u.country,
    };
  }

  async register(dto: RegisterDto): Promise<MessageResponseDto> {
    if (await this.prisma.user.findUnique({ where: { email: dto.email } })) {
      throw new ConflictException('Email already registered');
    }
    if (
      dto.username &&
      (await this.prisma.user.findUnique({ where: { username: dto.username } }))
    ) {
      throw new ConflictException('Username already taken');
    }
    const username = await this.users.deriveUniqueUsername(
      dto.username ?? dto.email.split('@')[0],
    );
    const passwordHash = await hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: { email: dto.email, username, passwordHash },
    });
    await this.issueVerification(user.id, dto.email);
    return {
      message:
        'Verification email sent. Check your inbox to activate your account.',
    };
  }

  async resendVerification(email: string): Promise<MessageResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerified)
      await this.issueVerification(user.id, user.email);
    // Generic response — never reveal whether the email exists.
    return {
      message:
        'If that account exists and is unverified, a new link has been sent.',
    };
  }

  async verifyEmail(token: string): Promise<MessageResponseDto> {
    const vt = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!vt || vt.consumedAt || vt.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: vt.userId },
        data: { emailVerified: true },
      }),
      this.prisma.verificationToken.update({
        where: { id: vt.id },
        data: { consumedAt: new Date() },
      }),
    ]);
    return { message: 'Email verified. You can now log in.' };
  }

  async login(
    dto: LoginDto,
    userAgent?: string,
  ): Promise<{
    auth: AuthResponseDto;
    refreshToken: string;
    rememberMe: boolean;
  }> {
    const key = `lockout:${dto.email.toLowerCase()}`;
    const attempts = Number(await this.redis.get(key)) || 0;
    if (attempts >= AUTH.lockoutMax) {
      throw new HttpException(
        'Too many failed attempts. Try again later.',
        HTTP_LOCKED,
      );
    }

    const user = (await this.prisma.user.findUnique({
      where: { email: dto.email },
    })) as DbUser | null;
    const ok =
      user !== null && (await verifyPassword(user.passwordHash, dto.password));
    if (!user || !ok) {
      await this.redis.incrWithTtl(key, AUTH.lockoutWindowMin * 60);
      throw new UnauthorizedException(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
    }
    if (!user.emailVerified)
      throw new ForbiddenException(AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED);

    await this.redis.del(key);
    const days = dto.rememberMe ? AUTH.rememberDays : AUTH.refreshDays;
    const refreshToken = await this.tokens.issueRefreshToken(
      user.id,
      userAgent,
      days,
    );
    const accessToken = this.tokens.issueAccessToken(user);
    return {
      auth: { accessToken, user: this.toPublicUser(user) },
      refreshToken,
      rememberMe: dto.rememberMe,
    };
  }

  async refresh(
    rawToken: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { userId, refreshToken } = await this.tokens.rotate(
      rawToken,
      userAgent,
    );
    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
    })) as DbUser | null;
    if (!user) throw new UnauthorizedException();
    return { accessToken: this.tokens.issueAccessToken(user), refreshToken };
  }

  async logout(rawToken: string): Promise<MessageResponseDto> {
    await this.tokens.revoke(rawToken);
    return { message: 'Logged out' };
  }

  private async issueVerification(
    userId: string,
    email: string,
  ): Promise<void> {
    await this.prisma.verificationToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    const raw = generateOpaqueToken();
    await this.prisma.verificationToken.create({
      data: {
        userId,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
      },
    });
    await this.mail.sendVerificationEmail(email, raw);
  }
}
