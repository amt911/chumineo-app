import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateListingDto,
  ListingAvailabilityDto,
  ListingDto,
  ListingQueryDto,
  ListingsPageDto,
  ListingStatus,
  MARKETPLACE_ERROR_CODES,
  UpdateListingDto,
  listingAvailabilitySchema,
  listingSchema,
  listingsPageSchema,
} from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const PAGE_SIZE = 24;

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private toDto(row: {
    id: string;
    quantity: number;
    condition: string;
    price: { toString(): string };
    description: string | null;
    status: string;
    createdAt: Date;
    seller: {
      username: string;
      country: string | null;
      avatarUrl: string | null;
    };
    collectionItem: {
      id: string;
      name: string;
      rarity: string;
      imageUrl: string | null;
      collection: { slug: string; name: string };
    };
    photos: { id: string; key: string }[];
  }): ListingDto {
    return listingSchema.parse({
      id: row.id,
      quantity: row.quantity,
      condition: row.condition,
      price: Number(row.price.toString()).toFixed(2),
      description: row.description,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      item: {
        id: row.collectionItem.id,
        name: row.collectionItem.name,
        rarity: row.collectionItem.rarity,
        imageUrl: row.collectionItem.imageUrl,
      },
      collection: row.collectionItem.collection,
      seller: row.seller,
      photos: row.photos.map((p) => ({
        id: p.id,
        url: this.storage.getPublicUrl(p.key),
      })),
    });
  }

  private async availableQuantity(
    userId: string,
    collectionItemId: string,
    excludeListingId?: string,
  ): Promise<number> {
    const inventory = await this.prisma.userInventory.findFirst({
      where: { userId, collectionItemId },
    });
    if (!inventory) {
      throw new NotFoundException('Item not found in your inventory');
    }
    const reserved = await this.prisma.listing.aggregate({
      where: {
        sellerId: userId,
        collectionItemId,
        status: ListingStatus.ACTIVE,
        ...(excludeListingId ? { id: { not: excludeListingId } } : {}),
      },
      _sum: { quantity: true },
    });
    // Clamp to 0: an inventory row that was reduced below its already-reserved
    // units (legacy/corrupt data) must never surface as a negative "available".
    return Math.max(0, inventory.quantity - (reserved._sum.quantity ?? 0));
  }

  // Public read used by the sell form to show owned units and cap the quantity
  // input. Unlike availableQuantity(), a missing inventory row is not an error
  // here — it just means 0 owned / 0 available.
  async availability(
    userId: string,
    collectionItemId: string,
  ): Promise<ListingAvailabilityDto> {
    const inventory = await this.prisma.userInventory.findFirst({
      where: { userId, collectionItemId },
    });
    if (!inventory) {
      return listingAvailabilitySchema.parse({ owned: 0, available: 0 });
    }
    const reserved = await this.prisma.listing.aggregate({
      where: {
        sellerId: userId,
        collectionItemId,
        status: ListingStatus.ACTIVE,
      },
      _sum: { quantity: true },
    });
    return listingAvailabilitySchema.parse({
      owned: inventory.quantity,
      available: Math.max(
        0,
        inventory.quantity - (reserved._sum.quantity ?? 0),
      ),
    });
  }

  async create(userId: string, dto: CreateListingDto): Promise<ListingDto> {
    const available = await this.availableQuantity(
      userId,
      dto.collectionItemId,
    );
    if (dto.quantity > available) {
      throw new BadRequestException(MARKETPLACE_ERROR_CODES.INSUFFICIENT_STOCK);
    }
    const created = await this.prisma.listing.create({
      data: {
        sellerId: userId,
        collectionItemId: dto.collectionItemId,
        quantity: dto.quantity,
        condition: dto.condition,
        price: dto.price,
        description: dto.description,
      },
      include: {
        seller: true,
        collectionItem: { include: { collection: true } },
        photos: true,
      },
    });
    return this.toDto(created);
  }

  async listPublic(
    query: ListingQueryDto,
    ownerId?: string,
  ): Promise<ListingsPageDto> {
    const where = {
      ...(ownerId ? { sellerId: ownerId } : { status: ListingStatus.ACTIVE }),
      ...(query.collectionItemId
        ? { collectionItemId: query.collectionItemId }
        : {}),
      ...(query.collectionId
        ? { collectionItem: { collectionId: query.collectionId } }
        : {}),
      ...(query.condition ? { condition: query.condition } : {}),
      ...(!ownerId && query.country
        ? { seller: { country: query.country } }
        : {}),
      ...(query.q
        ? {
            collectionItem: {
              name: { contains: query.q, mode: 'insensitive' as const },
            },
          }
        : {}),
      ...(query.priceMin || query.priceMax
        ? {
            price: {
              ...(query.priceMin ? { gte: query.priceMin } : {}),
              ...(query.priceMax ? { lte: query.priceMax } : {}),
            },
          }
        : {}),
    };
    const orderBy =
      query.sort === 'price_asc'
        ? { price: 'asc' as const }
        : query.sort === 'price_desc'
          ? { price: 'desc' as const }
          : { createdAt: 'desc' as const }; // 'recent' and the 'best_rated' no-op both fall back to recency

    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          seller: true,
          collectionItem: { include: { collection: true } },
          photos: true,
        },
      }),
      this.prisma.listing.count({ where }),
    ]);

    return listingsPageSchema.parse({
      items: items.map((i) => this.toDto(i)),
      page: query.page,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  }

  async getById(id: string, requesterId?: string): Promise<ListingDto> {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        seller: true,
        collectionItem: { include: { collection: true } },
        photos: true,
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (
      listing.status !== ListingStatus.ACTIVE &&
      listing.sellerId !== requesterId
    ) {
      throw new NotFoundException('Listing not found');
    }
    return this.toDto(listing);
  }

  async assertOwned(
    userId: string,
    id: string,
  ): Promise<{ id: string; collectionItemId: string }> {
    const listing = await this.prisma.listing.findFirst({
      where: { id, sellerId: userId },
    });
    if (!listing) throw new ForbiddenException('Not your listing');
    return listing;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateListingDto,
  ): Promise<ListingDto> {
    const listing = await this.assertOwned(userId, id);
    if (dto.quantity !== undefined) {
      const available = await this.availableQuantity(
        userId,
        listing.collectionItemId,
        id,
      );
      if (dto.quantity > available) {
        throw new BadRequestException(
          MARKETPLACE_ERROR_CODES.INSUFFICIENT_STOCK,
        );
      }
    }
    const updated = await this.prisma.listing.update({
      where: { id: listing.id },
      data: {
        ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: {
        seller: true,
        collectionItem: { include: { collection: true } },
        photos: true,
      },
    });
    return this.toDto(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    const listing = await this.assertOwned(userId, id);
    const photos = await this.prisma.listing
      .findUnique({ where: { id: listing.id }, include: { photos: true } })
      .then((l) => l?.photos ?? []);
    await Promise.all(photos.map((p) => this.storage.delete(p.key)));
    await this.prisma.listing.delete({ where: { id: listing.id } });
  }
}
