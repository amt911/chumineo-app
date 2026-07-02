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

  it('ignores the country filter when scoped to an owner (mine view)', async () => {
    const prisma = makePrisma();
    prisma.listing.findMany.mockResolvedValue([]);
    prisma.listing.count.mockResolvedValue(0);
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    await service.listPublic({ page: 1, country: 'ES' } as never, 'u1');
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sellerId: 'u1' } }),
    );
  });
});

describe('ListingsService.listPublic filter permutations (anonymous/public)', () => {
  function setup() {
    const prisma = makePrisma();
    prisma.listing.findMany.mockResolvedValue([]);
    prisma.listing.count.mockResolvedValue(0);
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    return { prisma, service };
  }

  it('defaults to ACTIVE-only and recency sort when no filters are set', async () => {
    const { prisma, service } = setup();
    await service.listPublic({ page: 1 } as never);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: ListingStatus.ACTIVE },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('sorts by price ascending when requested', async () => {
    const { prisma, service } = setup();
    await service.listPublic({ page: 1, sort: 'price_asc' } as never);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { price: 'asc' } }),
    );
  });

  it('sorts by price descending when requested', async () => {
    const { prisma, service } = setup();
    await service.listPublic({ page: 1, sort: 'price_desc' } as never);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { price: 'desc' } }),
    );
  });

  it('falls back to recency for best_rated (no-op sort)', async () => {
    const { prisma, service } = setup();
    await service.listPublic({ page: 1, sort: 'best_rated' } as never);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });

  it('filters by collectionItemId when present', async () => {
    const { prisma, service } = setup();
    await service.listPublic({ page: 1, collectionItemId: 'ci1' } as never);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ collectionItemId: 'ci1' }),
      }),
    );
  });

  it('filters by collectionId when present', async () => {
    const { prisma, service } = setup();
    await service.listPublic({ page: 1, collectionId: 'c1' } as never);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          collectionItem: { collectionId: 'c1' },
        }),
      }),
    );
  });

  it('filters by condition when present', async () => {
    const { prisma, service } = setup();
    await service.listPublic({ page: 1, condition: Condition.MINT } as never);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ condition: Condition.MINT }),
      }),
    );
  });

  it('filters by country when present and anonymous (public browse)', async () => {
    const { prisma, service } = setup();
    await service.listPublic({ page: 1, country: 'US' } as never);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ seller: { country: 'US' } }),
      }),
    );
  });

  it('filters by free-text query q when present', async () => {
    const { prisma, service } = setup();
    await service.listPublic({ page: 1, q: 'char' } as never);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          collectionItem: {
            name: { contains: 'char', mode: 'insensitive' },
          },
        }),
      }),
    );
  });

  it('filters by priceMin only', async () => {
    const { prisma, service } = setup();
    await service.listPublic({ page: 1, priceMin: '5.00' } as never);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ price: { gte: '5.00' } }),
      }),
    );
  });

  it('filters by priceMax only', async () => {
    const { prisma, service } = setup();
    await service.listPublic({ page: 1, priceMax: '20.00' } as never);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ price: { lte: '20.00' } }),
      }),
    );
  });

  it('filters by both priceMin and priceMax when present', async () => {
    const { prisma, service } = setup();
    await service.listPublic({
      page: 1,
      priceMin: '5.00',
      priceMax: '20.00',
    } as never);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          price: { gte: '5.00', lte: '20.00' },
        }),
      }),
    );
  });

  it('paginates using (page - 1) * PAGE_SIZE as skip', async () => {
    const { prisma, service } = setup();
    await service.listPublic({ page: 3 } as never);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 48, take: 24 }),
    );
  });

  it('computes totalPages from total count, at least 1', async () => {
    const prisma = makePrisma();
    prisma.listing.findMany.mockResolvedValue([]);
    prisma.listing.count.mockResolvedValue(0);
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    const page = await service.listPublic({ page: 1 } as never);
    expect(page.totalPages).toBe(1);
  });

  it('computes totalPages > 1 when total exceeds a single page', async () => {
    const prisma = makePrisma();
    prisma.listing.findMany.mockResolvedValue([]);
    prisma.listing.count.mockResolvedValue(50);
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    const page = await service.listPublic({ page: 1 } as never);
    expect(page.totalPages).toBe(3);
  });
});

describe('ListingsService.getById', () => {
  it('404s when the listing does not exist', async () => {
    const prisma = makePrisma();
    prisma.listing.findUnique.mockResolvedValue(null);
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    await expect(service.getById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('404s a non-active listing to a non-owner requester', async () => {
    const prisma = makePrisma();
    prisma.listing.findUnique.mockResolvedValue(
      row({ status: ListingStatus.PAUSED, sellerId: 'u1' }),
    );
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    await expect(service.getById('l1', 'someone-else')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('404s a non-active listing to an anonymous requester', async () => {
    const prisma = makePrisma();
    prisma.listing.findUnique.mockResolvedValue(
      row({ status: ListingStatus.SOLD_OUT, sellerId: 'u1' }),
    );
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    await expect(service.getById('l1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns a non-active listing to its owner (preview)', async () => {
    const prisma = makePrisma();
    prisma.listing.findUnique.mockResolvedValue(
      row({ status: ListingStatus.PAUSED, sellerId: 'u1' }),
    );
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    const dto = await service.getById('l1', 'u1');
    expect(dto.status).toBe(ListingStatus.PAUSED);
  });

  it('returns an active listing to anyone', async () => {
    const prisma = makePrisma();
    prisma.listing.findUnique.mockResolvedValue(row());
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    const dto = await service.getById('l1');
    expect(dto.id).toBe('l1');
  });
});

describe('ListingsService.update additional branches', () => {
  it('updates without touching quantity when quantity is not provided', async () => {
    const prisma = makePrisma();
    prisma.listing.findFirst.mockResolvedValue(
      row({ sellerId: 'u1', quantity: 1 }),
    );
    prisma.listing.update.mockResolvedValue(row({ description: 'updated' }));
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    const dto = await service.update('u1', 'l1', { description: 'updated' });
    expect(dto.description).toBe('updated');
    expect(prisma.userInventory.findFirst).not.toHaveBeenCalled();
    expect(prisma.listing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { description: 'updated' },
      }),
    );
  });

  it('updates quantity, price, description and status together when all are provided', async () => {
    const prisma = makePrisma();
    prisma.listing.findFirst.mockResolvedValue(
      row({ sellerId: 'u1', quantity: 1 }),
    );
    prisma.userInventory.findFirst.mockResolvedValue({ quantity: 5 });
    prisma.listing.aggregate.mockResolvedValue({ _sum: { quantity: 1 } });
    prisma.listing.update.mockResolvedValue(row({ quantity: 2 }));
    const service = new ListingsService(
      prisma as never,
      makeStorage() as never,
    );
    await service.update('u1', 'l1', {
      quantity: 2,
      price: '9.99',
      description: 'new desc',
      status: ListingStatus.PAUSED,
    });
    expect(prisma.listing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          quantity: 2,
          price: '9.99',
          description: 'new desc',
          status: ListingStatus.PAUSED,
        },
      }),
    );
  });
});

describe('ListingsService.remove full flow', () => {
  it('deletes storage photos and the listing when it has photos', async () => {
    const prisma = makePrisma();
    prisma.listing.findFirst.mockResolvedValue(
      row({ sellerId: 'u1', id: 'l1' }),
    );
    prisma.listing.findUnique.mockResolvedValue({
      photos: [
        { id: 'p1', key: 'k1' },
        { id: 'p2', key: 'k2' },
      ],
    });
    prisma.listing.delete.mockResolvedValue(row());
    const storage = {
      ...makeStorage(),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ListingsService(prisma as never, storage as never);
    await service.remove('u1', 'l1');
    expect(storage.delete).toHaveBeenCalledTimes(2);
    expect(storage.delete).toHaveBeenCalledWith('k1');
    expect(storage.delete).toHaveBeenCalledWith('k2');
    expect(prisma.listing.delete).toHaveBeenCalledWith({ where: { id: 'l1' } });
  });

  it('deletes the listing with no storage calls when it has no photos', async () => {
    const prisma = makePrisma();
    prisma.listing.findFirst.mockResolvedValue(
      row({ sellerId: 'u1', id: 'l1' }),
    );
    prisma.listing.findUnique.mockResolvedValue({ photos: [] });
    prisma.listing.delete.mockResolvedValue(row());
    const storage = {
      ...makeStorage(),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ListingsService(prisma as never, storage as never);
    await service.remove('u1', 'l1');
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('treats a missing findUnique result as having no photos', async () => {
    const prisma = makePrisma();
    prisma.listing.findFirst.mockResolvedValue(
      row({ sellerId: 'u1', id: 'l1' }),
    );
    prisma.listing.findUnique.mockResolvedValue(null);
    prisma.listing.delete.mockResolvedValue(row());
    const storage = {
      ...makeStorage(),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ListingsService(prisma as never, storage as never);
    await service.remove('u1', 'l1');
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
