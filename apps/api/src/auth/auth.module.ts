import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AUTH } from './auth.constants';

@Module({
  imports: [
    PassportModule,
    MailModule,
    UsersModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
      // AUTH.accessTtl is always a valid ms StringValue at runtime; the cast is needed
      // because process.env widens the type to string, losing the template-literal constraint.
      signOptions: {
        expiresIn: AUTH.accessTtl as `${number}${'m' | 's' | 'h' | 'd'}`,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy],
})
export class AuthModule {}
