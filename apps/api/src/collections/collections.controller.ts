import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  CollectionDetailDto,
  CollectionsPageDto,
  collectionsQuerySchema,
  CollectionsQueryDto,
} from '@sobrebox/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CollectionsService } from './collections.service';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(collectionsQuerySchema))
    query: CollectionsQueryDto,
  ): Promise<CollectionsPageDto> {
    return this.collections.findPage(query);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string): Promise<CollectionDetailDto> {
    return this.collections.findBySlug(slug);
  }
}
