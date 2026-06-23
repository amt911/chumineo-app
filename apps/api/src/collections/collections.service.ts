import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CollectionsPageDto,
  collectionsPageSchema,
  CollectionListItemDto,
  collectionListItemSchema,
  CollectionsQueryDto,
  CollectionStatus,
  CollectionCategory,
  CollectionDetailDto,
  collectionDetailSchema,
  packSummary,
  Rarity,
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

  async findBySlug(slug: string): Promise<CollectionDetailDto> {
    const c = await this.prisma.collection.findFirst({
      where: { slug, status: CollectionStatus.PUBLISHED },
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        source: true,
        status: true,
        releaseYear: true,
        coverImageUrl: true,
        brand: { select: { slug: true, name: true } },
        createdBy: { select: { username: true } },
        items: {
          orderBy: [{ rarity: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            rarity: true,
            imageUrl: true,
            officialPullRate: true,
          },
        },
        packTypes: {
          select: { id: true, name: true, price: true, packModel: true },
        },
      },
    });
    if (!c) throw new NotFoundException('Collection not found');

    const counts = new Map<Rarity, number>();
    for (const it of c.items) {
      const r = it.rarity as Rarity;
      counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    const rarityDistribution = [...counts.entries()].map(([rarity, count]) => ({
      rarity,
      count,
    }));

    return collectionDetailSchema.parse({
      id: c.id,
      slug: c.slug,
      name: c.name,
      category: c.category,
      source: c.source,
      status: c.status,
      releaseYear: c.releaseYear,
      coverImageUrl: c.coverImageUrl,
      brand: c.brand,
      createdBy: c.createdBy ? { username: c.createdBy.username } : null,
      rarityDistribution,
      items: c.items.map((i) => ({
        id: i.id,
        name: i.name,
        rarity: i.rarity,
        imageUrl: i.imageUrl,
        officialPullRate: i.officialPullRate?.toString() ?? null,
      })),
      packTypes: c.packTypes.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price?.toString() ?? null,
        summary: packSummary(c.category as CollectionCategory, p.packModel),
      })),
    });
  }
}
