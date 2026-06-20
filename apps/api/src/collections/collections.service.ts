import { Injectable } from '@nestjs/common';
import {
  CollectionResponseDto,
  collectionResponseSchema,
  CollectionStatus,
} from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<CollectionResponseDto[]> {
    // `select` constrains the query to the DTO shape (no over-fetching); `parse`
    // then validates each row. A row that fails validation throws (500) — acceptable
    // for the curated Phase 0 catalog; revisit (safeParse + skip) once community rows land.
    const rows = await this.prisma.collection.findMany({
      where: { status: CollectionStatus.PUBLISHED },
      select: { id: true, slug: true, name: true, category: true, status: true, source: true },
    });
    return rows.map((r) => collectionResponseSchema.parse(r));
  }
}
