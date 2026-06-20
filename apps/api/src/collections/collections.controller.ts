import { Controller, Get } from '@nestjs/common';
import { CollectionResponseDto } from '@sobrebox/shared';
import { CollectionsService } from './collections.service';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  findAll(): Promise<CollectionResponseDto[]> {
    return this.collections.findAll();
  }
}
