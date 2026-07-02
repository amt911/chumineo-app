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

describe('ListingPhotosService.add error cleanup', () => {
  it('deletes the just-uploaded object and rethrows when the DB insert fails', async () => {
    const prisma = makePrisma();
    prisma.listingPhoto.count.mockResolvedValue(0);
    const dbError = new Error('unique constraint violation');
    prisma.listingPhoto.create.mockRejectedValue(dbError);
    const listingsService = makeListingsService();
    listingsService.assertOwned.mockResolvedValue({ id: 'l1' });
    const storage = makeStorage();
    const service = new ListingPhotosService(
      prisma as never,
      listingsService as never,
      makeCompressor() as never,
      storage as never,
    );
    await expect(
      service.add('u1', 'l1', [
        { buffer: Buffer.from('x'), mimetype: 'image/png' } as never,
      ]),
    ).rejects.toBe(dbError);
    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect(storage.delete).toHaveBeenCalledWith(
      expect.stringMatching(/^marketplace-listings\/l1\/.+\.webp$/),
    );
  });

  it('swallows a failure to delete the orphaned object and still rethrows the original error', async () => {
    const prisma = makePrisma();
    prisma.listingPhoto.count.mockResolvedValue(0);
    const dbError = new Error('unique constraint violation');
    prisma.listingPhoto.create.mockRejectedValue(dbError);
    const listingsService = makeListingsService();
    listingsService.assertOwned.mockResolvedValue({ id: 'l1' });
    const storage = makeStorage();
    storage.delete.mockRejectedValue(new Error('storage unreachable'));
    const service = new ListingPhotosService(
      prisma as never,
      listingsService as never,
      makeCompressor() as never,
      storage as never,
    );
    await expect(
      service.add('u1', 'l1', [
        { buffer: Buffer.from('x'), mimetype: 'image/png' } as never,
      ]),
    ).rejects.toBe(dbError);
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

  it('is a no-op when the photo does not exist (or belongs to another listing)', async () => {
    const prisma = makePrisma();
    prisma.listingPhoto.findFirst.mockResolvedValue(null);
    const listingsService = makeListingsService();
    listingsService.assertOwned.mockResolvedValue({ id: 'l1' });
    const storage = makeStorage();
    const service = new ListingPhotosService(
      prisma as never,
      listingsService as never,
      makeCompressor() as never,
      storage as never,
    );
    await service.remove('u1', 'l1', 'missing');
    expect(storage.delete).not.toHaveBeenCalled();
    expect(prisma.listingPhoto.delete).not.toHaveBeenCalled();
  });

  it('deletes the storage object and the DB row when the photo exists', async () => {
    const prisma = makePrisma();
    prisma.listingPhoto.findFirst.mockResolvedValue({
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
    await service.remove('u1', 'l1', 'p1');
    expect(storage.delete).toHaveBeenCalledWith(
      'marketplace-listings/l1/a.webp',
    );
    expect(prisma.listingPhoto.delete).toHaveBeenCalledWith({
      where: { id: 'p1' },
    });
  });
});
