import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CollectionsPageDto,
  collectionsPageSchema,
  CollectionListItemDto,
  collectionListItemSchema,
  CollectionsQueryDto,
  CollectionStatus,
} from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findPage(query: CollectionsQueryDto): Promise<CollectionsPageDto> {
    const { page, limit, brand, category, year, q, sort } = query;

    const where: Prisma.CollectionWhereInput = {
      status: CollectionStatus.PUBLISHED,
      ...(brand ? { brand: { slug: brand } } : {}),
      ...(category ? { category } : {}),
      ...(year !== undefined ? { releaseYear: year } : {}),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    };

    const orderBy: Prisma.CollectionOrderByWithRelationInput =
      sort === 'name'
        ? { name: 'asc' }
        : sort === 'year'
          ? { releaseYear: 'desc' }
          : { createdAt: 'desc' };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.collection.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          name: true,
          category: true,
          source: true,
          releaseYear: true,
          coverImageUrl: true,
          brand: { select: { slug: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.collection.count({ where }),
    ]);

    const items: CollectionListItemDto[] = rows.map((r) =>
      collectionListItemSchema.parse({
        id: r.id,
        slug: r.slug,
        name: r.name,
        category: r.category,
        source: r.source,
        releaseYear: r.releaseYear,
        coverImageUrl: r.coverImageUrl,
        brand: r.brand,
        itemCount: r._count.items,
      }),
    );

    return collectionsPageSchema.parse({
      items,
      page,
      pageSize: limit,
      total,
      hasMore: page * limit < total,
    });
  }
}
