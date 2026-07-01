import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ListingPhotosService } from './listing-photos.service';

function makePrisma() {
  return {
    listing: { findFirst: jest.fn() },
    listingPhoto: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function makeListingsService() {
  return { assertOwned: jest.fn() };
}

function makeCompressor() {
  return {
    compress: jest.fn().mockResolvedValue({
      buffer: Buffer.from('x'),
      mime: 'image/webp',
      ext: 'webp',
    }),
  };
}

function makeStorage() {
  return {
    upload: jest.fn().mockResolvedValue('marketplace-listings/l1/a.webp'),
    delete: jest.fn().mockResolvedValue(undefined),
    getPublicUrl: jest.fn((k: string) => `http://cdn/${k}`),
  };
}

describe('ListingPhotosService.add', () => {
  it('403s when the listing is not owned by the user', async () => {
    const listingsService = makeListingsService();
    listingsService.assertOwned.mockRejectedValue(new ForbiddenException());
    const service = new ListingPhotosService(
      makePrisma() as never,
      listingsService as never,
      makeCompressor() as never,
      makeStorage() as never,
    );
    await expect(
      service.add('u2', 'l1', [
        { buffer: Buffer.from('x'), mimetype: 'image/png' } as never,
      ]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('400s when the total would exceed 5 photos', async () => {
    const prisma = makePrisma();
    prisma.listingPhoto.count.mockResolvedValue(5);
    const listingsService = makeListingsService();
    listingsService.assertOwned.mockResolvedValue({ id: 'l1' });
    const service = new ListingPhotosService(
      prisma as never,
      listingsService as never,
      makeCompressor() as never,
      makeStorage() as never,
    );
    await expect(
      service.add('u1', 'l1', [
        { buffer: Buffer.from('x'), mimetype: 'image/png' } as never,
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('compresses, uploads and persists each photo', async () => {
    const prisma = makePrisma();
    prisma.listingPhoto.count.mockResolvedValue(0);
    prisma.listingPhoto.create.mockResolvedValue({
      id: 'p1',
      key: 'marketplace-listings/l1/a.webp',
    });
    const listingsService = makeListingsService();
    listingsService.assertOwned.mockResolvedValue({ id: 'l1' });
    const storage = makeStorage();
    const service = new ListingPhotosService(
      prisma as never,
      listingsService as never,
      makeCompressor() as never,
      storage as never,
    );
    const photos = await service.add('u1', 'l1', [
      { buffer: Buffer.from('x'), mimetype: 'image/png' } as never,
    ]);
    expect(photos).toEqual([
      { id: 'p1', url: 'http://cdn/marketplace-listings/l1/a.webp' },
    ]);
    expect(storage.upload).toHaveBeenCalledTimes(1);
  });
});

describe('ListingPhotosService.remove', () => {
  it('403s when the listing is not owned by the user', async () => {
    const listingsService = makeListingsService();
    listingsService.assertOwned.mockRejectedValue(new ForbiddenException());
    const service = new ListingPhotosService(
      makePrisma() as never,
      listingsService as never,
      makeCompressor() as never,
      makeStorage() as never,
    );
    await expect(service.remove('u2', 'l1', 'p1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
