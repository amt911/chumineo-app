import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AuthResponseDto,
  loginSchema,
  LoginDto,
  MessageResponseDto,
  PublicUserDto,
  registerSchema,
  RegisterDto,
  resendVerificationSchema,
  ResendVerificationDto,
  verifySchema,
  VerifyDto,
} from '@sobrebox/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from './decorators/current-user.decorator';
import { AUTH } from './auth.constants';

const DAY_MS = 86_400_000;
const REFRESH_COOKIE = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Post('register')
  register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto,
  ): Promise<MessageResponseDto> {
    return this.auth.register(dto);
  }

  @Post('resend-verification')
  resend(
    @Body(new ZodValidationPipe(resendVerificationSchema))
    dto: ResendVerificationDto,
  ): Promise<MessageResponseDto> {
    return this.auth.resendVerification(dto.email);
  }

  @Post('verify')
  verify(
    @Body(new ZodValidationPipe(verifySchema)) dto: VerifyDto,
  ): Promise<MessageResponseDto> {
    return this.auth.verifyEmail(dto.token);
  }

  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { auth, refreshToken, rememberMe } = await this.auth.login(
      dto,
      req.headers['user-agent'],
    );
    this.setRefreshCookie(res, refreshToken, rememberMe);
    return auth;
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const token = this.readRefreshCookie(req);
    const { accessToken, refreshToken } = await this.auth.refresh(
      token,
      req.headers['user-agent'],
    );
    // Rotation keeps the original window; re-set with the long maxAge is fine.
    this.setRefreshCookie(res, refreshToken, true);
    return { accessToken };
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponseDto> {
    const token = this.readRefreshCookie(req);
    const out = await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, this.cookieBaseOptions());
    return out;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: RequestUser): Promise<PublicUserDto> {
    return this.users.getAuthUser(user.id);
  }

  private readRefreshCookie(req: Request): string {
    const token = (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_COOKIE
    ];
    if (!token) throw new UnauthorizedException('Missing refresh token');
    return token;
  }

  private cookieBaseOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'none' | 'lax';
    path: string;
  } {
    const isProd = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/auth',
    };
  }

  private setRefreshCookie(
    res: Response,
    token: string,
    rememberMe: boolean,
  ): void {
    const days = rememberMe ? AUTH.rememberDays : AUTH.refreshDays;
    res.cookie(REFRESH_COOKIE, token, {
      ...this.cookieBaseOptions(),
      maxAge: days * DAY_MS,
    });
  }
}
