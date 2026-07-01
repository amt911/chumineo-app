import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateListingDto,
  ListingDto,
  ListingQueryDto,
  ListingsPageDto,
  UpdateListingDto,
  createListingSchema,
  listingQuerySchema,
  updateListingSchema,
} from '@sobrebox/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { ListingsService } from './listings.service';

@Controller('marketplace/listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createListingSchema)) dto: CreateListingDto,
  ): Promise<ListingDto> {
    return this.listings.create(user.id, dto);
  }

  @Get()
  list(
    @Query(new ZodValidationPipe(listingQuerySchema)) query: ListingQueryDto,
  ): Promise<ListingsPageDto> {
    return this.listings.listPublic(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  listMine(@CurrentUser() user: RequestUser): Promise<ListingsPageDto> {
    return this.listings.listPublic({ page: 1 } as never, user.id);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  get(
    @CurrentUser() user: RequestUser | undefined,
    @Param('id') id: string,
  ): Promise<ListingDto> {
    return this.listings.getById(id, user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateListingSchema)) dto: UpdateListingDto,
  ): Promise<ListingDto> {
    return this.listings.update(user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.listings.remove(user.id, id);
  }
}
