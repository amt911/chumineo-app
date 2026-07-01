import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import {
  PublicProfileDto,
  PublicUserDto,
  UpdateProfileDto,
  updateProfileSchema,
} from '@sobrebox/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':username')
  profile(@Param('username') username: string): Promise<PublicProfileDto> {
    return this.users.getPublicProfile(username);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileDto,
  ): Promise<PublicUserDto> {
    return this.users.updateProfile(user.id, dto);
  }
}
