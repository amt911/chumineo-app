import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CollectionCategory,
  CollectionSource,
  CollectionStatus,
  Rarity,
} from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CollectionsService } from './collections.service';

const ROW = {
  id: '1',
  slug: 's',
  name: 'N',
  category: CollectionCategory.TCG,
  source: CollectionSource.API_IMPORT,
  releaseYear: 2023,
  coverImageUrl: null,
  brand: { slug: 'pokemon', name: 'Pokémon' },
  _count: { items: 4 },
};

describe('CollectionsService.findPage', () => {
  const collection = { findMany: jest.fn(), count: jest.fn() };
  const prisma = {
    collection,
    $transaction: jest
      .fn()
      .mockImplementation((ops: unknown[]) => Promise.all(ops)),
  } as unknown as PrismaService;
  let service: CollectionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    collection.findMany.mockResolvedValue([ROW]);
    collection.count.mockResolvedValue(1);
    const moduleRef = await Test.createTestingModule({
      providers: [
        CollectionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(CollectionsService);
  });

  it('maps rows to the page DTO with itemCount and hasMore', async () => {
    collection.count.mockResolvedValueOnce(25);
    const page = await service.findPage({ page: 1, limit: 20, sort: 'newest' });
    expect(page.items[0]).toEqual({
      id: '1',
      slug: 's',
      name: 'N',
      category: 'TCG',
      source: 'API_IMPORT',
      releaseYear: 2023,
      coverImageUrl: null,
      brand: { slug: 'pokemon', name: 'Pokémon' },
      itemCount: 4,
    });
    expect(page).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 25,
      hasMore: true,
    });
  });

  it('always filters to PUBLISHED and applies skip/take', async () => {
    await service.findPage({ page: 3, limit: 10, sort: 'newest' });
    expect(collection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: CollectionStatus.PUBLISHED }),
        skip: 20,
        take: 10,
      }),
    );
  });

  it('translates filters into the prisma where clause', async () => {
    await service.findPage({
      page: 1,
      limit: 20,
      sort: 'name',
      brand: 'pokemon',
      category: CollectionCategory.TCG,
      year: 2023,
      q: 'char',
    });
    const arg = collection.findMany.mock.calls[0][0];
    expect(arg.where).toMatchObject({
      brand: { slug: 'pokemon' },
      category: CollectionCategory.TCG,
      releaseYear: 2023,
      name: { contains: 'char', mode: 'insensitive' },
    });
    expect(arg.orderBy).toEqual({ name: 'asc' });
  });

  it('sorts by year and newest', async () => {
    await service.findPage({ page: 1, limit: 20, sort: 'year' });
    expect(collection.findMany.mock.calls[0][0].orderBy).toEqual({
      releaseYear: 'desc',
    });
    await service.findPage({ page: 1, limit: 20, sort: 'newest' });
    expect(collection.findMany.mock.calls[1][0].orderBy).toEqual({
      createdAt: 'desc',
    });
  });

  it('hasMore is false on the last page', async () => {
    collection.count.mockResolvedValueOnce(5);
    const page = await service.findPage({ page: 1, limit: 20, sort: 'newest' });
    expect(page.hasMore).toBe(false);
  });
});

describe('CollectionsService.findBySlug', () => {
  const collection = { findFirst: jest.fn() };
  const prisma = { collection } as unknown as PrismaService;
  let service: CollectionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CollectionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(CollectionsService);
  });

  it('throws NotFound when the slug is missing or unpublished', async () => {
    collection.findFirst.mockResolvedValueOnce(null);
    await expect(service.findBySlug('nope')).rejects.toThrow(NotFoundException);
  });

  it('maps detail: decimals to strings, rarity distribution, pack summary', async () => {
    collection.findFirst.mockResolvedValueOnce({
      id: '1',
      slug: 's',
      name: 'N',
      category: 'TCG',
      source: 'API_IMPORT',
      status: 'PUBLISHED',
      releaseYear: 2023,
      coverImageUrl: null,
      brand: { slug: 'pokemon', name: 'Pokémon' },
      createdBy: { username: 'neo' },
      items: [
        {
          id: 'i1',
          name: 'A',
          rarity: Rarity.COMMON,
          imageUrl: null,
          officialPullRate: { toString: () => '0.50000000' },
        },
        {
          id: 'i2',
          name: 'B',
          rarity: Rarity.COMMON,
          imageUrl: null,
          officialPullRate: null,
        },
        {
          id: 'i3',
          name: 'C',
          rarity: Rarity.RARE,
          imageUrl: null,
          officialPullRate: null,
        },
      ],
      packTypes: [
        {
          id: 'p1',
          name: 'Booster',
          price: { toString: () => '4.50' },
          packModel: { slots: [{ rarity: Rarity.COMMON, count: 5 }] },
        },
      ],
    });

    const detail = await service.findBySlug('s');
    expect(detail.createdBy).toEqual({ username: 'neo' });
    expect(detail.items[0].officialPullRate).toBe('0.50000000');
    expect(detail.items[1].officialPullRate).toBeNull();
    expect(detail.rarityDistribution).toEqual([
      { rarity: 'COMMON', count: 2 },
      { rarity: 'RARE', count: 1 },
    ]);
    expect(detail.packTypes[0]).toEqual({
      id: 'p1',
      name: 'Booster',
      price: '4.50',
      summary: '5 cards',
    });
  });
});
