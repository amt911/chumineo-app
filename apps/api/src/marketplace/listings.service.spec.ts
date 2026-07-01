import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Condition, ListingStatus } from '@sobrebox/shared';
import { ListingsService } from './listings.service';

function makePrisma() {
  return {
    userInventory: { findFirst: jest.fn() },
    listing: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function makeStorage() {
  return { getPublicUrl: jest.fn((k: string) => `http://cdn/${k}`) };
}

const row = (over: Record<string, unknown> = {}) => ({
  id: 'l1',
  quantity: 1,
  condition: Condition.MINT,
  price: '19.99',
  description: null,
  status: ListingStatus.ACTIVE,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  sellerId: 'u1',
  seller: { username: 'ash', country: 'ES', avatarUrl: null },
  collectionItem: {
    id: 'ci1',
    name: 'Charizard',
    rarity: 'SECRET',
    imageUrl: null,
    collection: { slug: 's', name: 'N' },
  },
  photos: [],
  ...over,
});

describe('ListingsService.create', () => {
  it('404s when the item is not in the seller inventory', async () => {
    const prisma = makePrisma();
    prisma.userInventory.findFirst.mockResolvedValue(null);
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    await expect(
      service.create('u1', {
        collectionItemId: 'ci1',
        quantity: 1,
        condition: Condition.MINT,
        price: '19.99',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('400s when quantity exceeds what is available', async () => {
    const prisma = makePrisma();
    prisma.userInventory.findFirst.mockResolvedValue({ quantity: 2 });
    prisma.listing.aggregate.mockResolvedValue({ _sum: { quantity: 2 } });
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    await expect(
      service.create('u1', {
        collectionItemId: 'ci1',
        quantity: 1,
        condition: Condition.MINT,
        price: '19.99',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a listing when quantity is available', async () => {
    const prisma = makePrisma();
    prisma.userInventory.findFirst.mockResolvedValue({ quantity: 3 });
    prisma.listing.aggregate.mockResolvedValue({ _sum: { quantity: 1 } });
    prisma.listing.create.mockResolvedValue(row());
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    const dto = await service.create('u1', {
      collectionItemId: 'ci1',
      quantity: 1,
      condition: Condition.MINT,
      price: '19.99',
    });
    expect(dto.id).toBe('l1');
  });
});

describe('ListingsService.update', () => {
  it('403s when the listing belongs to another user', async () => {
    const prisma = makePrisma();
    prisma.listing.findFirst.mockResolvedValue(null);
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    await expect(
      service.update('u2', 'l1', { status: ListingStatus.PAUSED }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('400s when raising quantity above what is available', async () => {
    const prisma = makePrisma();
    prisma.listing.findFirst.mockResolvedValue(
      row({ sellerId: 'u1', quantity: 1 }),
    );
    prisma.userInventory.findFirst.mockResolvedValue({ quantity: 2 });
    prisma.listing.aggregate.mockResolvedValue({ _sum: { quantity: 1 } });
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    await expect(
      service.update('u1', 'l1', { quantity: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ListingsService.remove', () => {
  it('403s when the listing belongs to another user', async () => {
    const prisma = makePrisma();
    prisma.listing.findFirst.mockResolvedValue(null);
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    await expect(service.remove('u2', 'l1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('ListingsService.listPublic with ownerId', () => {
  it('returns all statuses for the owner, ignoring the ACTIVE-only public filter', async () => {
    const prisma = makePrisma();
    prisma.listing.findMany.mockResolvedValue([
      row({ status: ListingStatus.PAUSED }),
    ]);
    prisma.listing.count.mockResolvedValue(1);
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    const page = await service.listPublic({ page: 1 } as never, 'u1');
    expect(page.items[0].status).toBe(ListingStatus.PAUSED);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sellerId: 'u1' } }),
    );
  });
});
