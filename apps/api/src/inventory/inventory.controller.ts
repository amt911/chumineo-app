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
  addInventoryItemSchema,
  AddInventoryItemDto,
  updateInventoryItemSchema,
  UpdateInventoryItemDto,
  InventoryItemDto,
  CollectionProgressSummaryDto,
  CollectionProgressDto,
} from '@sobrebox/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { InventoryService } from './inventory.service';

@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Post()
  add(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(addInventoryItemSchema))
    dto: AddInventoryItemDto,
  ): Promise<InventoryItemDto> {
    return this.inventory.add(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: RequestUser): Promise<InventoryItemDto[]> {
    return this.inventory.listMine(user.id);
  }

  @Get('progress')
  progress(
    @CurrentUser() user: RequestUser,
  ): Promise<CollectionProgressSummaryDto[]> {
    return this.inventory.progressSummaries(user.id);
  }

  @Get('collections/:slug/progress')
  collectionProgress(
    @CurrentUser() user: RequestUser,
    @Param('slug') slug: string,
  ): Promise<CollectionProgressDto> {
    return this.inventory.collectionProgress(user.id, slug);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateInventoryItemSchema))
    dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    return this.inventory.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.inventory.remove(user.id, id);
  }
}
