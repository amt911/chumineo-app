import { Injectable } from '@nestjs/common';
import {
  ListingStatus,
  MatchesResponseDto,
  MatchItemDto,
  MatchListingDto,
  WishlistPriority,
  matchListingSchema,
  matchesResponseSchema,
} from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const PRIORITY_RANK: Record<WishlistPriority, number> = {
  [WishlistPriority.HIGH]: 0,
  [WishlistPriority.MEDIUM]: 1,
  [WishlistPriority.LOW]: 2,
};

const money = (d: { toString(): string }): string =>
  Number(d.toString()).toFixed(2);

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private toListingDto(
    row: {
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
    },
    inBudget: boolean,
  ): MatchListingDto {
    return matchListingSchema.parse({
      id: row.id,
      quantity: row.quantity,
      condition: row.condition,
      price: money(row.price),
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
      inBudget,
    });
  }

  async getMatches(userId: string): Promise<MatchesResponseDto> {
    const wishlist = await this.prisma.wishlistItem.findMany({
      where: { userId },
      include: { collectionItem: { include: { collection: true } } },
    });
    if (wishlist.length === 0) return [];

    const collectionItemIds = wishlist.map((w) => w.collectionItemId);
    const listings = await this.prisma.listing.findMany({
      where: {
        collectionItemId: { in: collectionItemIds },
        status: ListingStatus.ACTIVE,
        sellerId: { not: userId },
      },
      orderBy: { price: 'asc' },
      include: {
        seller: true,
        collectionItem: { include: { collection: true } },
        photos: true,
      },
    });

    const byItem = new Map<string, typeof listings>();
    for (const l of listings) {
      const bucket = byItem.get(l.collectionItemId);
      if (bucket) bucket.push(l);
      else byItem.set(l.collectionItemId, [l]);
    }

    const matches: MatchItemDto[] = [];
    for (const w of wishlist) {
      const rows = byItem.get(w.collectionItemId);
      if (!rows || rows.length === 0) continue;
      const maxPrice = w.maxPrice;
      const dtoListings = rows.map((r) =>
        this.toListingDto(r, maxPrice != null && r.price.lte(maxPrice)),
      );
      matches.push({
        wishlistItemId: w.id,
        priority: w.priority as WishlistPriority,
        maxPrice: maxPrice != null ? money(maxPrice) : null,
        item: {
          id: w.collectionItem.id,
          name: w.collectionItem.name,
          rarity: w.collectionItem.rarity as MatchItemDto['item']['rarity'],
          imageUrl: w.collectionItem.imageUrl,
        },
        collection: w.collectionItem.collection,
        listingCount: dtoListings.length,
        inBudgetCount: dtoListings.filter((l) => l.inBudget).length,
        cheapestPrice: dtoListings[0].price,
        listings: dtoListings,
      });
    }

    matches.sort((a, b) => {
      const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pr !== 0) return pr;
      const ab = (a.inBudgetCount > 0 ? 0 : 1) - (b.inBudgetCount > 0 ? 0 : 1);
      if (ab !== 0) return ab;
      return Number(a.cheapestPrice) - Number(b.cheapestPrice);
    });

    return matchesResponseSchema.parse(matches);
  }
}
