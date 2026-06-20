import { Test } from '@nestjs/testing';
import { CollectionCategory, CollectionSource, CollectionStatus } from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CollectionsService } from './collections.service';

const buildService = async (rows: unknown[]) => {
  const prisma = { collection: { findMany: jest.fn().mockResolvedValue(rows) } };
  const moduleRef = await Test.createTestingModule({
    providers: [CollectionsService, { provide: PrismaService, useValue: prisma }],
  }).compile();
  return { service: moduleRef.get(CollectionsService), prisma };
};

describe('CollectionsService', () => {
  it('queries only PUBLISHED collections, selecting only the DTO fields', async () => {
    const { service, prisma } = await buildService([
      { id: '1', slug: 's', name: 'N', category: CollectionCategory.TCG,
        status: CollectionStatus.PUBLISHED, source: CollectionSource.ADMIN, extra: 'drop-me' },
    ]);

    const result = await service.findAll();

    expect(prisma.collection.findMany).toHaveBeenCalledWith({
      where: { status: CollectionStatus.PUBLISHED },
      select: { id: true, slug: true, name: true, category: true, status: true, source: true },
    });
    expect(result).toEqual([
      { id: '1', slug: 's', name: 'N', category: 'TCG', status: 'PUBLISHED', source: 'ADMIN' },
    ]);
  });

  it('returns an empty array when there are no published collections', async () => {
    const { service } = await buildService([]);
    await expect(service.findAll()).resolves.toEqual([]);
  });
});
