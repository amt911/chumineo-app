import { Controller, Get, Param } from '@nestjs/common';
import { PublicProfileDto } from '@sobrebox/shared';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':username')
  profile(@Param('username') username: string): Promise<PublicProfileDto> {
    return this.users.getPublicProfile(username);
  }
}
