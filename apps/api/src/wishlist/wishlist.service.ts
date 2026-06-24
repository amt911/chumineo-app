import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AddWishlistItemDto,
  UpdateWishlistItemDto,
  WishlistItemDto,
  wishlistItemSchema,
} from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';

const WISHLIST_SELECT = {
  id: true,
  priority: true,
  maxPrice: true,
  isPublic: true,
  collectionItem: {
    select: {
      id: true,
      name: true,
      rarity: true,
      imageUrl: true,
      collection: { select: { slug: true, name: true } },
    },
  },
} satisfies Prisma.WishlistItemSelect;

type WishlistRow = Prisma.WishlistItemGetPayload<{
  select: typeof WISHLIST_SELECT;
}>;

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(row: WishlistRow): WishlistItemDto {
    return wishlistItemSchema.parse({
      id: row.id,
      priority: row.priority,
      maxPrice: row.maxPrice != null ? row.maxPrice.toFixed(2) : null,
      isPublic: row.isPublic,
      item: {
        id: row.collectionItem.id,
        name: row.collectionItem.name,
        rarity: row.collectionItem.rarity,
        imageUrl: row.collectionItem.imageUrl,
      },
      collection: row.collectionItem.collection,
    });
  }

  async add(userId: string, dto: AddWishlistItemDto): Promise<WishlistItemDto> {
    const exists = await this.prisma.collectionItem.findUnique({
      where: { id: dto.collectionItemId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Collection item not found');

    const row = await this.prisma.wishlistItem.upsert({
      where: {
        userId_collectionItemId: {
          userId,
          collectionItemId: dto.collectionItemId,
        },
      },
      create: {
        userId,
        collectionItemId: dto.collectionItemId,
        priority: dto.priority,
        maxPrice: dto.maxPrice ?? null,
        isPublic: dto.isPublic,
      },
      update: {
        priority: dto.priority,
        ...(dto.maxPrice !== undefined ? { maxPrice: dto.maxPrice } : {}),
        isPublic: dto.isPublic,
      },
      select: WISHLIST_SELECT,
    });
    return this.toDto(row);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateWishlistItemDto,
  ): Promise<WishlistItemDto> {
    const owned = await this.prisma.wishlistItem.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('Wishlist item not found');

    const row = await this.prisma.wishlistItem.update({
      where: { id },
      data: {
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.maxPrice !== undefined ? { maxPrice: dto.maxPrice } : {}),
        ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
      },
      select: WISHLIST_SELECT,
    });
    return this.toDto(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    const owned = await this.prisma.wishlistItem.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('Wishlist item not found');
    await this.prisma.wishlistItem.delete({ where: { id } });
  }

  async listMine(userId: string): Promise<WishlistItemDto[]> {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      select: WISHLIST_SELECT,
    });
    return rows.map((r) => this.toDto(r));
  }
}
