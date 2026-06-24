import { NotFoundException } from '@nestjs/common';
import { WishlistPriority } from '@sobrebox/shared';
import { WishlistService } from './wishlist.service';

type AnyFn = jest.Mock;
interface PrismaMock {
  collectionItem: { findUnique: AnyFn };
  wishlistItem: {
    upsert: AnyFn;
    update: AnyFn;
    delete: AnyFn;
    findFirst: AnyFn;
    findMany: AnyFn;
  };
}

// maxPrice comes back from Prisma as a Decimal-like with .toString()
const decimal = (s: string) => ({ toString: () => s });

const row = (over: Record<string, unknown> = {}) => ({
  id: 'w1',
  priority: 'HIGH',
  maxPrice: decimal('80.00'),
  isPublic: true,
  collectionItem: {
    id: 'ci1',
    name: 'Umbreon',
    rarity: 'SECRET',
    imageUrl: null,
    collection: { slug: 's', name: 'N' },
  },
  ...over,
});

function makePrisma(): PrismaMock {
  return {
    collectionItem: { findUnique: jest.fn() },
    wishlistItem: {
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };
}

describe('WishlistService', () => {
  let prisma: PrismaMock;
  let service: WishlistService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new WishlistService(prisma as never);
  });

  it('404s adding an unknown catalog item', async () => {
    prisma.collectionItem.findUnique.mockResolvedValue(null);
    await expect(
      service.add('u1', {
        collectionItemId: 'x',
        priority: WishlistPriority.MEDIUM,
        isPublic: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('upserts and serializes maxPrice as a string', async () => {
    prisma.collectionItem.findUnique.mockResolvedValue({ id: 'ci1' });
    prisma.wishlistItem.upsert.mockResolvedValue(row());
    const dto = await service.add('u1', {
      collectionItemId: 'ci1',
      priority: WishlistPriority.HIGH,
      maxPrice: '80.00',
      isPublic: true,
    });
    expect(dto.maxPrice).toBe('80.00');
    expect(dto.item.name).toBe('Umbreon');
  });

  it('404s updating a row that is not the user’s', async () => {
    prisma.wishlistItem.findFirst.mockResolvedValue(null);
    await expect(
      service.update('u1', 'w1', { priority: WishlistPriority.LOW }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps a null maxPrice to null', async () => {
    prisma.wishlistItem.findFirst.mockResolvedValue({ id: 'w1' });
    prisma.wishlistItem.update.mockResolvedValue(row({ maxPrice: null }));
    const dto = await service.update('u1', 'w1', { maxPrice: null });
    expect(dto.maxPrice).toBeNull();
  });

  it('404s deleting a row that is not the user’s', async () => {
    prisma.wishlistItem.findFirst.mockResolvedValue(null);
    await expect(service.remove('u1', 'w1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
