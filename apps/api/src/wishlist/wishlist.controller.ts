import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  addWishlistItemSchema,
  AddWishlistItemDto,
  updateWishlistItemSchema,
  UpdateWishlistItemDto,
  WishlistItemDto,
} from '@sobrebox/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { WishlistService } from './wishlist.service';

@UseGuards(JwtAuthGuard)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Post()
  add(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(addWishlistItemSchema)) dto: AddWishlistItemDto,
  ): Promise<WishlistItemDto> {
    return this.wishlist.add(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: RequestUser): Promise<WishlistItemDto[]> {
    return this.wishlist.listMine(user.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWishlistItemSchema))
    dto: UpdateWishlistItemDto,
  ): Promise<WishlistItemDto> {
    return this.wishlist.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.wishlist.remove(user.id, id);
  }
}
