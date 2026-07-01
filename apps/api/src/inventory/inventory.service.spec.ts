import { NotFoundException } from '@nestjs/common';
import { Condition } from '@sobrebox/shared';
import { InventoryService } from './inventory.service';

type AnyFn = jest.Mock;
interface PrismaMock {
  collectionItem: { findUnique: AnyFn };
  userInventory: {
    upsert: AnyFn;
    update: AnyFn;
    delete: AnyFn;
    findFirst: AnyFn;
    findMany: AnyFn;
    count: AnyFn;
  };
  collection: { findFirst: AnyFn; findMany: AnyFn };
  wishlistItem: { findMany: AnyFn };
}

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'inv1',
  quantity: 2,
  condition: null,
  collectionItem: {
    id: 'ci1',
    name: 'Charizard',
    rarity: 'ULTRA_RARE',
    imageUrl: null,
    collection: { slug: 'obsidian-flames', name: 'Obsidian Flames' },
  },
  ...over,
});

function makePrisma(): PrismaMock {
  return {
    collectionItem: { findUnique: jest.fn() },
    userInventory: {
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    collection: { findFirst: jest.fn(), findMany: jest.fn() },
    wishlistItem: { findMany: jest.fn() },
  };
}

describe('InventoryService', () => {
  let prisma: PrismaMock;
  let service: InventoryService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new InventoryService(prisma as never);
  });

  describe('add', () => {
    it('404s when the catalog item does not exist', async () => {
      prisma.collectionItem.findUnique.mockResolvedValue(null);
      await expect(
        service.add('u1', { collectionItemId: 'missing', quantity: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('upserts and returns a mapped DTO', async () => {
      prisma.collectionItem.findUnique.mockResolvedValue({ id: 'ci1' });
      prisma.userInventory.upsert.mockResolvedValue(row());
      const dto = await service.add('u1', {
        collectionItemId: 'ci1',
        quantity: 2,
        condition: Condition.MINT,
      });
      expect(dto).toEqual({
        id: 'inv1',
        quantity: 2,
        condition: null,
        item: {
          id: 'ci1',
          name: 'Charizard',
          rarity: 'ULTRA_RARE',
          imageUrl: null,
        },
        collection: { slug: 'obsidian-flames', name: 'Obsidian Flames' },
      });
      expect(prisma.userInventory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_collectionItemId: { userId: 'u1', collectionItemId: 'ci1' },
          },
          update: expect.objectContaining({
            quantity: { increment: 2 },
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('404s when the row is not the user’s', async () => {
      prisma.userInventory.findFirst.mockResolvedValue(null);
      await expect(
        service.update('u1', 'inv1', { quantity: 3 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
    it('updates an owned row', async () => {
      prisma.userInventory.findFirst.mockResolvedValue({ id: 'inv1' });
      prisma.userInventory.update.mockResolvedValue(row({ quantity: 3 }));
      const dto = await service.update('u1', 'inv1', { quantity: 3 });
      expect(dto.quantity).toBe(3);
    });
  });

  describe('remove', () => {
    it('404s when the row is not the user’s', async () => {
      prisma.userInventory.findFirst.mockResolvedValue(null);
      await expect(service.remove('u1', 'inv1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
    it('deletes an owned row', async () => {
      prisma.userInventory.findFirst.mockResolvedValue({ id: 'inv1' });
      prisma.userInventory.delete.mockResolvedValue(row());
      await service.remove('u1', 'inv1');
      expect(prisma.userInventory.delete).toHaveBeenCalledWith({
        where: { id: 'inv1' },
      });
    });
  });

  describe('collectionProgress', () => {
    it('404s on an unknown slug', async () => {
      prisma.collection.findFirst.mockResolvedValue(null);
      await expect(
        service.collectionProgress('u1', 'nope'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
    it('floors percent and marks unowned items as missing (ownedQuantity 0)', async () => {
      prisma.collection.findFirst.mockResolvedValue({
        slug: 's',
        name: 'N',
        items: [
          { id: 'a', name: 'A', rarity: 'COMMON' },
          { id: 'b', name: 'B', rarity: 'RARE' },
          { id: 'c', name: 'C', rarity: 'SECRET' },
        ],
      });
      prisma.userInventory.findMany.mockResolvedValue([
        { id: 'inv-a', collectionItemId: 'a', quantity: 1 },
      ]);
      prisma.wishlistItem.findMany.mockResolvedValue([]);
      const p = await service.collectionProgress('u1', 's');
      expect(p.owned).toBe(1);
      expect(p.total).toBe(3);
      expect(p.percent).toBe(33);
      expect(
        p.items.find((i) => i.collectionItemId === 'b')?.ownedQuantity,
      ).toBe(0);
    });

    it('exposes inventoryId for owned items and wishlistId for wishlisted ones', async () => {
      prisma.collection.findFirst.mockResolvedValue({
        slug: 's',
        name: 'N',
        items: [
          { id: 'a', name: 'A', rarity: 'COMMON' },
          { id: 'b', name: 'B', rarity: 'RARE' },
          { id: 'c', name: 'C', rarity: 'SECRET' },
        ],
      });
      prisma.userInventory.findMany.mockResolvedValue([
        { id: 'inv-a', collectionItemId: 'a', quantity: 1 },
      ]);
      prisma.wishlistItem.findMany.mockResolvedValue([
        { id: 'wish-b', collectionItemId: 'b' },
      ]);
      const p = await service.collectionProgress('u1', 's');
      const a = p.items.find((i) => i.collectionItemId === 'a');
      const b = p.items.find((i) => i.collectionItemId === 'b');
      const c = p.items.find((i) => i.collectionItemId === 'c');
      expect(a).toMatchObject({ inventoryId: 'inv-a', wishlistId: null });
      expect(b).toMatchObject({ inventoryId: null, wishlistId: 'wish-b' });
      expect(c).toMatchObject({ inventoryId: null, wishlistId: null });
      expect(prisma.wishlistItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'u1',
            collectionItem: { collection: { slug: 's' } },
          },
        }),
      );
    });
  });

  describe('listMine', () => {
    it('returns an empty array when the user owns nothing', async () => {
      prisma.userInventory.findMany.mockResolvedValue([]);
      expect(await service.listMine('u1')).toEqual([]);
    });
    it('maps each row to a DTO array', async () => {
      prisma.userInventory.findMany.mockResolvedValue([row()]);
      const dtos = await service.listMine('u1');
      expect(dtos).toHaveLength(1);
      expect(dtos[0]).toEqual({
        id: 'inv1',
        quantity: 2,
        condition: null,
        item: {
          id: 'ci1',
          name: 'Charizard',
          rarity: 'ULTRA_RARE',
          imageUrl: null,
        },
        collection: { slug: 'obsidian-flames', name: 'Obsidian Flames' },
      });
      expect(prisma.userInventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' } }),
      );
    });
  });

  describe('progressSummaries', () => {
    it('returns [] when the user owns nothing', async () => {
      prisma.userInventory.findMany.mockResolvedValue([]);
      expect(await service.progressSummaries('u1')).toEqual([]);
    });
    it('builds one summary per owned collection', async () => {
      prisma.userInventory.findMany.mockResolvedValue([
        { collectionItem: { collectionId: 'col1' } },
      ]);
      prisma.collection.findMany.mockResolvedValue([
        { id: 'col1', slug: 's', name: 'N', _count: { items: 4 } },
      ]);
      prisma.userInventory.count.mockResolvedValue(1);
      const r = await service.progressSummaries('u1');
      expect(r).toEqual([
        {
          collection: { slug: 's', name: 'N' },
          owned: 1,
          total: 4,
          percent: 25,
        },
      ]);
    });
  });
});
