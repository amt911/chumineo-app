import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { BrandsService } from './brands.service';

describe('BrandsService', () => {
  const brand = { findMany: jest.fn() };
  const prisma = { brand } as unknown as PrismaService;
  let service: BrandsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [BrandsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(BrandsService);
  });

  it('returns brands ordered by name as {slug,name}', async () => {
    brand.findMany.mockResolvedValueOnce([
      { slug: 'funko', name: 'Funko', extra: 'x' },
    ]);
    const result = await service.findAll();
    expect(brand.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
      select: { slug: true, name: true },
    });
    expect(result).toEqual([{ slug: 'funko', name: 'Funko' }]);
  });
});
