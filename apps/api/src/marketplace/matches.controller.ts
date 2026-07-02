import { Controller, Get, UseGuards } from '@nestjs/common';
import { MatchesResponseDto } from '@sobrebox/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { MatchesService } from './matches.service';

@Controller('marketplace/matches')
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user: RequestUser): Promise<MatchesResponseDto> {
    return this.matches.getMatches(user.id);
  }
}
