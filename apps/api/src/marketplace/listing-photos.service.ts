import { BadRequestException, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ListingPhotoDto } from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ImageCompressorService } from '../image/image-compressor.service';
import { ListingsService } from './listings.service';

const MAX_PHOTOS = 5;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

@Injectable()
export class ListingPhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listings: ListingsService,
    private readonly compressor: ImageCompressorService,
    private readonly storage: StorageService,
  ) {}

  async add(
    userId: string,
    listingId: string,
    files: { buffer: Buffer; mimetype: string }[],
  ): Promise<ListingPhotoDto[]> {
    await this.listings.assertOwned(userId, listingId);
    const existing = await this.prisma.listingPhoto.count({
      where: { listingId },
    });
    if (existing + files.length > MAX_PHOTOS) {
      throw new BadRequestException(
        `A listing can have at most ${MAX_PHOTOS} photos`,
      );
    }

    const created: ListingPhotoDto[] = [];
    for (const file of files) {
      const compressed = await this.compressor.compress(file.buffer);
      const key = `marketplace-listings/${listingId}/${uuidv4()}.${compressed.ext}`;
      await this.storage.upload(
        key,
        compressed.buffer,
        compressed.mime,
        CACHE_CONTROL,
      );
      try {
        const saved = await this.prisma.listingPhoto.create({
          data: { listingId, key },
        });
        created.push({
          id: saved.id,
          url: this.storage.getPublicUrl(saved.key),
        });
      } catch (err) {
        await this.storage.delete(key).catch(() => undefined);
        throw err;
      }
    }
    return created;
  }

  async remove(
    userId: string,
    listingId: string,
    photoId: string,
  ): Promise<void> {
    await this.listings.assertOwned(userId, listingId);
    const photo = await this.prisma.listingPhoto.findFirst({
      where: { id: photoId, listingId },
    });
    if (!photo) return;
    await this.storage.delete(photo.key);
    await this.prisma.listingPhoto.delete({ where: { id: photo.id } });
  }
}
