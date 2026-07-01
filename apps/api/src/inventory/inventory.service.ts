import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AddInventoryItemDto,
  UpdateInventoryItemDto,
  InventoryItemDto,
  inventoryItemSchema,
  CollectionProgressSummaryDto,
  collectionProgressSummarySchema,
  CollectionProgressDto,
  collectionProgressSchema,
} from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';

const INVENTORY_SELECT = {
  id: true,
  quantity: true,
  condition: true,
  collectionItem: {
    select: {
      id: true,
      name: true,
      rarity: true,
      imageUrl: true,
      collection: { select: { slug: true, name: true } },
    },
  },
} satisfies Prisma.UserInventorySelect;

type InventoryRow = Prisma.UserInventoryGetPayload<{
  select: typeof INVENTORY_SELECT;
}>;

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(row: InventoryRow): InventoryItemDto {
    return inventoryItemSchema.parse({
      id: row.id,
      quantity: row.quantity,
      condition: row.condition,
      item: {
        id: row.collectionItem.id,
        name: row.collectionItem.name,
        rarity: row.collectionItem.rarity,
        imageUrl: row.collectionItem.imageUrl,
      },
      collection: row.collectionItem.collection,
    });
  }

  async add(
    userId: string,
    dto: AddInventoryItemDto,
  ): Promise<InventoryItemDto> {
    const exists = await this.prisma.collectionItem.findUnique({
      where: { id: dto.collectionItemId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Collection item not found');

    const row = await this.prisma.userInventory.upsert({
      where: {
        userId_collectionItemId: {
          userId,
          collectionItemId: dto.collectionItemId,
        },
      },
      create: {
        userId,
        collectionItemId: dto.collectionItemId,
        quantity: dto.quantity,
        condition: dto.condition ?? null,
      },
      update: {
        quantity: { increment: dto.quantity },
        ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
      },
      select: INVENTORY_SELECT,
    });
    return this.toDto(row);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    const owned = await this.prisma.userInventory.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('Inventory item not found');

    const row = await this.prisma.userInventory.update({
      where: { id },
      data: {
        ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
        ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
      },
      select: INVENTORY_SELECT,
    });
    return this.toDto(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    const owned = await this.prisma.userInventory.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('Inventory item not found');
    await this.prisma.userInventory.delete({ where: { id } });
  }

  async listMine(userId: string): Promise<InventoryItemDto[]> {
    const rows = await this.prisma.userInventory.findMany({
      where: { userId },
      orderBy: { collectionItem: { name: 'asc' } },
      select: INVENTORY_SELECT,
    });
    return rows.map((r) => this.toDto(r));
  }

  async progressSummaries(
    userId: string,
  ): Promise<CollectionProgressSummaryDto[]> {
    const owned = await this.prisma.userInventory.findMany({
      where: { userId },
      select: { collectionItem: { select: { collectionId: true } } },
    });
    const collectionIds = [
      ...new Set(owned.map((o) => o.collectionItem.collectionId)),
    ];
    if (collectionIds.length === 0) return [];

    const collections = await this.prisma.collection.findMany({
      where: { id: { in: collectionIds } },
      select: {
        id: true,
        slug: true,
        name: true,
        _count: { select: { items: true } },
      },
    });

    return Promise.all(
      collections.map(async (c) => {
        const ownedCount = await this.prisma.userInventory.count({
          where: { userId, collectionItem: { collectionId: c.id } },
        });
        const total = c._count.items;
        return collectionProgressSummarySchema.parse({
          collection: { slug: c.slug, name: c.name },
          owned: ownedCount,
          total,
          percent: total === 0 ? 0 : Math.floor((ownedCount / total) * 100),
        });
      }),
    );
  }

  async collectionProgress(
    userId: string,
    slug: string,
  ): Promise<CollectionProgressDto> {
    const c = await this.prisma.collection.findFirst({
      where: { slug },
      select: {
        slug: true,
        name: true,
        items: {
          orderBy: [{ rarity: 'asc' }, { name: 'asc' }],
          select: { id: true, name: true, rarity: true },
        },
      },
    });
    if (!c) throw new NotFoundException('Collection not found');

    const owned = await this.prisma.userInventory.findMany({
      where: { userId, collectionItem: { collection: { slug } } },
      select: { id: true, collectionItemId: true, quantity: true },
    });
    const ownedMap = new Map(
      owned.map((o) => [
        o.collectionItemId,
        { id: o.id, quantity: o.quantity },
      ]),
    );

    const wishlisted = await this.prisma.wishlistItem.findMany({
      where: { userId, collectionItem: { collection: { slug } } },
      select: { id: true, collectionItemId: true },
    });
    const wishlistMap = new Map(
      wishlisted.map((w) => [w.collectionItemId, w.id]),
    );

    const items = c.items.map((i) => ({
      collectionItemId: i.id,
      name: i.name,
      rarity: i.rarity,
      ownedQuantity: ownedMap.get(i.id)?.quantity ?? 0,
      inventoryId: ownedMap.get(i.id)?.id ?? null,
      wishlistId: wishlistMap.get(i.id) ?? null,
    }));
    const ownedCount = items.filter((i) => i.ownedQuantity > 0).length;
    const total = c.items.length;

    return collectionProgressSchema.parse({
      collection: { slug: c.slug, name: c.name },
      owned: ownedCount,
      total,
      percent: total === 0 ? 0 : Math.floor((ownedCount / total) * 100),
      items,
    });
  }
}
