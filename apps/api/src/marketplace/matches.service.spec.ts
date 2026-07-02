import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { ListingStatus, WishlistPriority } from '@sobrebox/shared';
import { MatchesService } from './matches.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const dec = (n: string) => new Prisma.Decimal(n);

function wishlistRow(over: {
  id: string;
  collectionItemId: string;
  priority: WishlistPriority;
  maxPrice: string | null;
  name?: string;
}) {
  return {
    id: over.id,
    userId: 'me',
    collectionItemId: over.collectionItemId,
    priority: over.priority,
    maxPrice: over.maxPrice === null ? null : dec(over.maxPrice),
    isPublic: true,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    collectionItem: {
      id: over.collectionItemId,
      name: over.name ?? 'Item',
      rarity: 'RARE',
      imageUrl: null,
      collection: { slug: 'set', name: 'Set' },
    },
  };
}

function listingRow(over: {
  id: string;
  collectionItemId: string;
  price: string;
  sellerId?: string;
}) {
  return {
    id: over.id,
    quantity: 1,
    condition: 'NEAR_MINT',
    price: dec(over.price),
    description: null,
    status: ListingStatus.ACTIVE,
    createdAt: new Date('2026-07-02T00:00:00Z'),
    sellerId: over.sellerId ?? 'other',
    collectionItemId: over.collectionItemId,
    seller: { username: 'ana', country: 'ES', avatarUrl: null },
    collectionItem: {
      id: over.collectionItemId,
      name: 'Item',
      rarity: 'RARE',
      imageUrl: null,
      collection: { slug: 'set', name: 'Set' },
    },
    photos: [],
  };
}

describe('MatchesService', () => {
  let service: MatchesService;
  const prisma = {
    wishlistItem: { findMany: jest.fn() },
    listing: { findMany: jest.fn() },
  };
  const storage = { getPublicUrl: jest.fn((k: string) => `https://cdn/${k}`) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        MatchesService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    service = mod.get(MatchesService);
  });

  it('returns [] when the wishlist is empty', async () => {
    prisma.wishlistItem.findMany.mockResolvedValue([]);
    expect(await service.getMatches('me')).toEqual([]);
    expect(prisma.listing.findMany).not.toHaveBeenCalled();
  });

  it('drops wishlist items that have no active listing', async () => {
    prisma.wishlistItem.findMany.mockResolvedValue([
      wishlistRow({
        id: 'w1',
        collectionItemId: 'ci1',
        priority: WishlistPriority.HIGH,
        maxPrice: null,
      }),
    ]);
    prisma.listing.findMany.mockResolvedValue([]);
    expect(await service.getMatches('me')).toEqual([]);
  });

  it('flags in-budget listings and counts them; null maxPrice => none in budget', async () => {
    prisma.wishlistItem.findMany.mockResolvedValue([
      wishlistRow({
        id: 'w1',
        collectionItemId: 'ci1',
        priority: WishlistPriority.HIGH,
        maxPrice: '40.00',
      }),
      wishlistRow({
        id: 'w2',
        collectionItemId: 'ci2',
        priority: WishlistPriority.HIGH,
        maxPrice: null,
      }),
    ]);
    prisma.listing.findMany.mockResolvedValue([
      listingRow({ id: 'l1', collectionItemId: 'ci1', price: '38.00' }),
      listingRow({ id: 'l2', collectionItemId: 'ci1', price: '50.00' }),
      listingRow({ id: 'l3', collectionItemId: 'ci2', price: '10.00' }),
    ]);
    const res = await service.getMatches('me');
    const ci1 = res.find((m) => m.item.id === 'ci1')!;
    expect(ci1.listingCount).toBe(2);
    expect(ci1.inBudgetCount).toBe(1);
    expect(ci1.listings.map((l) => l.inBudget)).toEqual([true, false]);
    expect(ci1.cheapestPrice).toBe('38.00');
    const ci2 = res.find((m) => m.item.id === 'ci2')!;
    expect(ci2.inBudgetCount).toBe(0);
    expect(ci2.listings[0].inBudget).toBe(false);
  });

  it('serializes prices with two decimals (trailing zeros kept)', async () => {
    prisma.wishlistItem.findMany.mockResolvedValue([
      wishlistRow({
        id: 'w1',
        collectionItemId: 'ci1',
        priority: WishlistPriority.LOW,
        maxPrice: '5.50',
      }),
    ]);
    prisma.listing.findMany.mockResolvedValue([
      listingRow({ id: 'l1', collectionItemId: 'ci1', price: '5.50' }),
    ]);
    const res = await service.getMatches('me');
    expect(res[0].maxPrice).toBe('5.50');
    expect(res[0].cheapestPrice).toBe('5.50');
    expect(res[0].listings[0].price).toBe('5.50');
  });

  it('sorts by priority, then in-budget-first, then cheapest', async () => {
    prisma.wishlistItem.findMany.mockResolvedValue([
      wishlistRow({
        id: 'wLow',
        collectionItemId: 'ciLow',
        priority: WishlistPriority.LOW,
        maxPrice: '100.00',
      }),
      wishlistRow({
        id: 'wHiOver',
        collectionItemId: 'ciHiOver',
        priority: WishlistPriority.HIGH,
        maxPrice: '5.00',
      }),
      wishlistRow({
        id: 'wHiBudget',
        collectionItemId: 'ciHiBudget',
        priority: WishlistPriority.HIGH,
        maxPrice: '100.00',
      }),
    ]);
    prisma.listing.findMany.mockResolvedValue([
      listingRow({ id: 'a', collectionItemId: 'ciLow', price: '9.00' }),
      listingRow({ id: 'b', collectionItemId: 'ciHiOver', price: '40.00' }),
      listingRow({ id: 'c', collectionItemId: 'ciHiBudget', price: '40.00' }),
    ]);
    const res = await service.getMatches('me');
    expect(res.map((m) => m.item.id)).toEqual([
      'ciHiBudget',
      'ciHiOver',
      'ciLow',
    ]);
  });

  it('queries only active listings from other sellers for wishlisted items', async () => {
    prisma.wishlistItem.findMany.mockResolvedValue([
      wishlistRow({
        id: 'w1',
        collectionItemId: 'ci1',
        priority: WishlistPriority.HIGH,
        maxPrice: null,
      }),
    ]);
    prisma.listing.findMany.mockResolvedValue([]);
    await service.getMatches('me');
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          collectionItemId: { in: ['ci1'] },
          status: ListingStatus.ACTIVE,
          sellerId: { not: 'me' },
        },
        orderBy: { price: 'asc' },
      }),
    );
  });
});
