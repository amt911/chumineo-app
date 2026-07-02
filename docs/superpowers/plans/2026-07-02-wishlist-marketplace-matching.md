# Wishlist ↔ Marketplace Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a logged-in user a private, read-only view of their wishlist items that are currently for sale by other users, surfaced both as a badge on `/wishlist` and as a dedicated `/wishlist/matches` feed.

**Architecture:** One new read endpoint `GET /marketplace/matches` (JWT, owner-scoped) backed by a `MatchesService` that joins the user's `WishlistItem`s against ACTIVE `Listing`s (from other sellers) by `collectionItemId`, flags each listing as in-budget vs the wishlist `maxPrice`, and sorts matches priority→in-budget→cheapest. A shared Zod DTO reuses the existing `listingSchema`. Two web surfaces consume one TanStack Query hook. Zero schema/migration change.

**Tech Stack:** NestJS 10 + Prisma 6 (CommonJS) · Zod (`@sobrebox/shared`, compiled to `dist/`) · Next.js 16 App Router + next-intl + TanStack Query v5 · Vitest/Testing Library (web + shared) · Jest/supertest (api).

## Global Constraints

- **Zero schema change** — read-only over existing `WishlistItem` + `Listing`. No migration.
- **Decimal serialization gotcha (`docs/FINDINGS.md`):** serialize every `Prisma.Decimal` money field with `Number(d.toString()).toFixed(2)` (never bare `.toString()`, which drops trailing zeros). Applies to `price`, `maxPrice`, `cheapestPrice`.
- **No hardcoded enum strings** — use `WishlistPriority`, `Condition`, `ListingStatus`, `Rarity` from `@sobrebox/shared`.
- **No `any`** — use `unknown` + guards or domain types.
- **Recompile shared after editing it:** `pnpm build:shared` before api/web consume it.
- **Owner-scoped:** endpoint always derives the user from the JWT (`user.id`); a user can never request another user's matches.
- **Match rule:** `collectionItemId` equal · `status === ACTIVE` · `sellerId !== userId`. `inBudget` = `maxPrice != null && listing.price <= maxPrice`; when `maxPrice` is null all listings show but none is in-budget.
- **Coverage gate 80%** (statements/branches/functions/lines) in api/web/shared. Final check before PR: `pnpm pr-check`.
- **Commits:** English, Conventional Commits, scope = module/folder.
- **Branch:** implement on `feat/wishlist-marketplace-matching` (already cut from `main`, holds the spec commit). Do not branch again.

---

## File Structure

**shared (`packages/shared/src/`)**

- Create `dto/match.dto.ts` — `matchListingSchema` (= `listingSchema` + `inBudget`), `matchItemSchema`, `matchesResponseSchema` + inferred types.
- Create `dto/match.dto.spec.ts` — schema tests.
- Modify `index.ts` — export the new DTO.

**api (`apps/api/src/marketplace/`)**

- Create `matches.service.ts` — `MatchesService.getMatches(userId)`.
- Create `matches.service.spec.ts` — unit tests (the bulk of the logic).
- Create `matches.controller.ts` — `GET /marketplace/matches`.
- Create `matches.controller.spec.ts` — controller wiring test.
- Modify `marketplace.module.ts` — register controller + provider.
- Modify `apps/api/test/*` — e2e for auth + owner-scoping (follow existing e2e file).
- Modify `docs/ENDPOINT_PERMISSIONS.md` — document the endpoint.

**web (`apps/web/`)**

- Modify `lib/api.ts` — `fetchMatches(accessToken)`.
- Create `components/matches/use-matches.ts` — shared TanStack Query hook.
- Create `components/matches/matches-feed.tsx` — dedicated feed (Surface B).
- Create `components/matches/matches-feed.test.tsx`.
- Create `app/[locale]/wishlist/matches/page.tsx` — route for the feed.
- Modify `components/wishlist/wishlist-list.tsx` — per-item badge + header link (Surface A).
- Modify `components/wishlist/wishlist-list.test.tsx` (create if absent) — badge tests.
- Modify `locales/en.json` + `locales/es.json` — `Matches` namespace + a `Wishlist.matchesLink` key.

---

## Task 1: Shared match DTO

**Files:**

- Create: `packages/shared/src/dto/match.dto.ts`
- Test: `packages/shared/src/dto/match.dto.spec.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**

- Consumes: `listingSchema` / `ListingDto` from `dto/marketplace.dto.ts`; `WishlistPriority` from `enums/wishlist-priority`; `Rarity` from `enums/rarity`.
- Produces: `matchListingSchema` / `MatchListingDto`, `matchItemSchema` / `MatchItemDto`, `matchesResponseSchema` / `MatchesResponseDto`. A `MatchItemDto` has: `wishlistItemId: string`, `priority: WishlistPriority`, `maxPrice: string | null`, `item: {id,name,rarity,imageUrl}`, `collection: {slug,name}`, `listingCount: number`, `inBudgetCount: number`, `cheapestPrice: string`, `listings: MatchListingDto[]`. A `MatchListingDto` is a `ListingDto` plus `inBudget: boolean`.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/dto/match.dto.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { matchesResponseSchema } from './match.dto';
import { Condition, ListingStatus, Rarity, WishlistPriority } from '../index';

const listing = {
  id: 'lst1',
  quantity: 1,
  condition: Condition.NEAR_MINT,
  price: '38.00',
  description: null,
  status: ListingStatus.ACTIVE,
  createdAt: '2026-07-02T00:00:00.000Z',
  item: {
    id: 'ci1',
    name: 'Charizard',
    rarity: Rarity.ULTRA_RARE,
    imageUrl: null,
  },
  collection: { slug: 'obsidian-flames', name: 'Obsidian Flames' },
  seller: { username: 'ana', country: 'ES', avatarUrl: null },
  photos: [],
  inBudget: true,
};

const match = {
  wishlistItemId: 'w1',
  priority: WishlistPriority.HIGH,
  maxPrice: '45.00',
  item: {
    id: 'ci1',
    name: 'Charizard',
    rarity: Rarity.ULTRA_RARE,
    imageUrl: null,
  },
  collection: { slug: 'obsidian-flames', name: 'Obsidian Flames' },
  listingCount: 1,
  inBudgetCount: 1,
  cheapestPrice: '38.00',
  listings: [listing],
};

describe('matchesResponseSchema', () => {
  it('parses a valid matches array', () => {
    expect(matchesResponseSchema.parse([match])).toEqual([match]);
  });

  it('accepts a null maxPrice', () => {
    const parsed = matchesResponseSchema.parse([{ ...match, maxPrice: null }]);
    expect(parsed[0].maxPrice).toBeNull();
  });

  it('requires inBudget on each listing', () => {
    const bad = { ...match, listings: [{ ...listing, inBudget: undefined }] };
    expect(() => matchesResponseSchema.parse([bad])).toThrow();
  });

  it('rejects a non-decimal cheapestPrice shape', () => {
    expect(() =>
      matchesResponseSchema.parse([{ ...match, cheapestPrice: 38 }]),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sobrebox/shared test -- match.dto`
Expected: FAIL — `Cannot find module './match.dto'`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/shared/src/dto/match.dto.ts`:

```ts
import { z } from 'zod';
import { WishlistPriority } from '../enums/wishlist-priority';
import { Rarity } from '../enums/rarity';
import { listingSchema } from './marketplace.dto';

// A marketplace listing that matches a wishlist item, tagged with whether its
// price fits the wishlist item's maxPrice budget.
export const matchListingSchema = listingSchema.extend({
  inBudget: z.boolean(),
});
export type MatchListingDto = z.infer<typeof matchListingSchema>;

// A wishlist item that has at least one active listing from another seller.
// `item`/`collection` are duplicated inside each listing intentionally so the
// web can reuse the existing marketplace listing card unchanged.
export const matchItemSchema = z.object({
  wishlistItemId: z.string(),
  priority: z.nativeEnum(WishlistPriority),
  maxPrice: z.string().nullable(),
  item: z.object({
    id: z.string(),
    name: z.string(),
    rarity: z.nativeEnum(Rarity),
    imageUrl: z.string().nullable(),
  }),
  collection: z.object({ slug: z.string(), name: z.string() }),
  listingCount: z.number().int(),
  inBudgetCount: z.number().int(),
  cheapestPrice: z.string(),
  listings: z.array(matchListingSchema),
});
export type MatchItemDto = z.infer<typeof matchItemSchema>;

export const matchesResponseSchema = z.array(matchItemSchema);
export type MatchesResponseDto = z.infer<typeof matchesResponseSchema>;
```

Add to `packages/shared/src/index.ts` (after the `export * from './dto/marketplace.dto';` line):

```ts
export * from './dto/match.dto';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sobrebox/shared test -- match.dto`
Expected: PASS (4 tests).

- [ ] **Step 5: Rebuild shared so api/web see it**

Run: `pnpm build:shared`
Expected: exits 0, emits to `packages/shared/dist/`.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/dto/match.dto.ts packages/shared/src/dto/match.dto.spec.ts packages/shared/src/index.ts
git commit -m "feat(shared): add wishlist-marketplace match DTO"
```

---

## Task 2: MatchesService (api)

**Files:**

- Create: `apps/api/src/marketplace/matches.service.ts`
- Test: `apps/api/src/marketplace/matches.service.spec.ts`

**Interfaces:**

- Consumes: `PrismaService` (`prisma.wishlistItem.findMany`, `prisma.listing.findMany`), `StorageService.getPublicUrl(key)`, `matchesResponseSchema` / `MatchesResponseDto`, `ListingStatus`, `WishlistPriority` from `@sobrebox/shared`.
- Produces: `MatchesService.getMatches(userId: string): Promise<MatchesResponseDto>`. Returns `[]` when the user has no wishlist or no matching listings. Sorted priority (HIGH→MEDIUM→LOW), then items with any in-budget listing first, then ascending `cheapestPrice`. Each item's `listings` are ascending by price.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/marketplace/matches.service.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sobrebox/api test -- matches.service`
Expected: FAIL — cannot find `./matches.service`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/marketplace/matches.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ListingStatus,
  MatchesResponseDto,
  MatchItemDto,
  MatchListingDto,
  WishlistPriority,
  matchesResponseSchema,
} from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const PRIORITY_RANK: Record<WishlistPriority, number> = {
  [WishlistPriority.HIGH]: 0,
  [WishlistPriority.MEDIUM]: 1,
  [WishlistPriority.LOW]: 2,
};

const money = (d: Prisma.Decimal): string => Number(d.toString()).toFixed(2);

type ListingRow = {
  id: string;
  quantity: number;
  condition: string;
  price: Prisma.Decimal;
  description: string | null;
  status: string;
  createdAt: Date;
  collectionItemId: string;
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
};

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private toListingDto(row: ListingRow, inBudget: boolean): MatchListingDto {
    return {
      id: row.id,
      quantity: row.quantity,
      condition: row.condition as MatchListingDto['condition'],
      price: money(row.price),
      description: row.description,
      status: row.status as MatchListingDto['status'],
      createdAt: row.createdAt.toISOString(),
      item: {
        id: row.collectionItem.id,
        name: row.collectionItem.name,
        rarity: row.collectionItem.rarity as MatchListingDto['item']['rarity'],
        imageUrl: row.collectionItem.imageUrl,
      },
      collection: row.collectionItem.collection,
      seller: row.seller,
      photos: row.photos.map((p) => ({
        id: p.id,
        url: this.storage.getPublicUrl(p.key),
      })),
      inBudget,
    };
  }

  async getMatches(userId: string): Promise<MatchesResponseDto> {
    const wishlist = await this.prisma.wishlistItem.findMany({
      where: { userId },
      include: { collectionItem: { include: { collection: true } } },
    });
    if (wishlist.length === 0) return [];

    const collectionItemIds = wishlist.map((w) => w.collectionItemId);
    const listings = (await this.prisma.listing.findMany({
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
    })) as unknown as ListingRow[];

    const byItem = new Map<string, ListingRow[]>();
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sobrebox/api test -- matches.service`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/marketplace/matches.service.ts apps/api/src/marketplace/matches.service.spec.ts
git commit -m "feat(marketplace): matches service (wishlist x active listings)"
```

---

## Task 3: MatchesController + module wiring + endpoint doc

**Files:**

- Create: `apps/api/src/marketplace/matches.controller.ts`
- Test: `apps/api/src/marketplace/matches.controller.spec.ts`
- Modify: `apps/api/src/marketplace/marketplace.module.ts`
- Modify: `docs/ENDPOINT_PERMISSIONS.md`

**Interfaces:**

- Consumes: `MatchesService.getMatches`, `JwtAuthGuard`, `CurrentUser`/`RequestUser`, `MatchesResponseDto`.
- Produces: HTTP `GET /marketplace/matches` (JWT-guarded) → `MatchesResponseDto`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/marketplace/matches.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

describe('MatchesController', () => {
  let controller: MatchesController;
  const matches = { getMatches: jest.fn().mockResolvedValue([]) };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [{ provide: MatchesService, useValue: matches }],
    }).compile();
    controller = mod.get(MatchesController);
  });

  it('delegates to the service with the current user id', async () => {
    const result = await controller.list({
      id: 'u1',
      email: 'u@x.com',
      username: 'u',
    });
    expect(matches.getMatches).toHaveBeenCalledWith('u1');
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sobrebox/api test -- matches.controller`
Expected: FAIL — cannot find `./matches.controller`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/marketplace/matches.controller.ts`:

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { MatchesResponseDto } from '@sobrebox/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { MatchesService } from './matches.service';

@Controller('marketplace/matches')
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user: RequestUser): Promise<MatchesResponseDto> {
    return this.matches.getMatches(user.id);
  }
}
```

Modify `apps/api/src/marketplace/marketplace.module.ts` to register both:

```ts
import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { ListingPhotosController } from './listing-photos.controller';
import { ListingPhotosService } from './listing-photos.service';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  controllers: [ListingsController, ListingPhotosController, MatchesController],
  providers: [ListingsService, ListingPhotosService, MatchesService],
  exports: [ListingsService],
})
export class MarketplaceModule {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sobrebox/api test -- matches.controller`
Expected: PASS (1 test).

- [ ] **Step 5: Document the endpoint**

In `docs/ENDPOINT_PERMISSIONS.md`, add this row to the marketplace table (after the `/marketplace/listings/:id/photos/:photoId` row):

```markdown
| GET | /marketplace/matches | JWT | owner-scoped; wishlist items with active listings from other sellers (in-budget flagged) |
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/marketplace/matches.controller.ts apps/api/src/marketplace/matches.controller.spec.ts apps/api/src/marketplace/marketplace.module.ts docs/ENDPOINT_PERMISSIONS.md
git commit -m "feat(marketplace): expose GET /marketplace/matches endpoint"
```

---

## Task 4: e2e — auth required + owner-scoped

**Files:**

- Modify: the existing marketplace e2e spec under `apps/api/test/` (find it: `ls apps/api/test` — e.g. `marketplace.e2e-spec.ts`). Add a `describe('GET /marketplace/matches')` block following the auth/seed helpers already in that file.

**Interfaces:**

- Consumes: existing e2e app bootstrap + auth-token helper + Prisma seeding used by the neighboring marketplace e2e tests. Reuse them verbatim — do not invent a new harness.

- [ ] **Step 1: Add the failing e2e cases**

Open the existing marketplace e2e file. Mirroring its existing helpers (app instance, a helper that registers/logs in a user and returns a bearer token, and direct Prisma inserts), add:

```ts
describe('GET /marketplace/matches', () => {
  it('rejects unauthenticated requests with 401', async () => {
    await request(app.getHttpServer()).get('/marketplace/matches').expect(401);
  });

  it("returns only the caller's matches (owner-scoped)", async () => {
    // Arrange: userA wishlists item X; userB lists item X for sale.
    // Use the same token/seed helpers the other tests in this file use.
    const tokenA = await registerAndLogin('a@example.com', 'ana');
    const { collectionItemId } = await seedCollectionItem();
    await seedWishlistItem(userAId, collectionItemId, {
      maxPrice: '50.00',
      priority: 'HIGH',
    });
    await seedListing(userBId, collectionItemId, {
      price: '40.00',
      status: 'ACTIVE',
    });

    const res = await request(app.getHttpServer())
      .get('/marketplace/matches')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].item.id).toBe(collectionItemId);
    expect(res.body[0].listings[0].inBudget).toBe(true);

    // userB (the seller) has no wishlist => no matches, and never sees A's.
    const tokenB = await loginExisting('b@example.com');
    const resB = await request(app.getHttpServer())
      .get('/marketplace/matches')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(resB.body).toEqual([]);
  });
});
```

> Adapt `registerAndLogin` / `seedCollectionItem` / `seedWishlistItem` / `seedListing` / `userAId` / `userBId` to the exact helper names already present in the file. If a helper doesn't exist, build the fixtures with the same `prisma.*.create` calls the other tests use.

- [ ] **Step 2: Run the e2e to verify the new cases pass**

Run: `pnpm --filter @sobrebox/api test:e2e`
Expected: PASS, including the two new `GET /marketplace/matches` cases (existing e2e stay green).

- [ ] **Step 3: Commit**

```bash
git add apps/api/test
git commit -m "test(marketplace): e2e for matches auth + owner scoping"
```

---

## Task 5: Web API wrapper + hook (Surface plumbing)

**Files:**

- Modify: `apps/web/lib/api.ts`
- Create: `apps/web/components/matches/use-matches.ts`

**Interfaces:**

- Consumes: `authedJson` (private in `api.ts`), `matchesResponseSchema` / `MatchesResponseDto`, `useAuthStore`.
- Produces: `fetchMatches(accessToken: string): Promise<MatchesResponseDto>`; `useMatches()` → TanStack Query result keyed `['matches']`, enabled only when authenticated.

- [ ] **Step 1: Add the typed fetch wrapper**

In `apps/web/lib/api.ts`, add `MatchesResponseDto` to the type imports and `matchesResponseSchema` to the value imports from `@sobrebox/shared`, then add near the wishlist wrappers:

```ts
// --- matches (wishlist x marketplace) ---
export async function fetchMatches(
  accessToken: string,
): Promise<MatchesResponseDto> {
  return matchesResponseSchema.parse(
    await authedJson('/marketplace/matches', accessToken),
  );
}
```

- [ ] **Step 2: Create the shared hook**

Create `apps/web/components/matches/use-matches.ts`:

```ts
'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchMatches } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export function useMatches() {
  const status = useAuthStore((s) => s.status);
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['matches'],
    queryFn: () => fetchMatches(accessToken as string),
    enabled: status === 'authenticated',
  });
}
```

- [ ] **Step 3: Type-check to confirm the wiring compiles**

Run: `pnpm --filter @sobrebox/web type-check`
Expected: exits 0 (no type errors). (Behavior is covered by the component tests in Tasks 6–7.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/api.ts apps/web/components/matches/use-matches.ts
git commit -m "feat(web): fetchMatches wrapper + useMatches hook"
```

---

## Task 6: Web — dedicated `/wishlist/matches` feed (Surface B)

**Files:**

- Create: `apps/web/components/matches/matches-feed.tsx`
- Test: `apps/web/components/matches/matches-feed.test.tsx`
- Create: `apps/web/app/[locale]/wishlist/matches/page.tsx`
- Modify: `apps/web/locales/en.json`, `apps/web/locales/es.json`

**Interfaces:**

- Consumes: `useMatches()`, `useTranslations('Matches')`, `useAuthStore` (for auth gating), `Link` from `@/i18n/navigation`, `MatchItemDto`.
- Produces: `MatchesFeed` client component; `/wishlist/matches` route.

- [ ] **Step 1: Add i18n keys**

In `apps/web/locales/en.json`, add a top-level `Matches` object:

```json
"Matches": {
  "title": "Your wanted items on sale",
  "loginPrompt": "Log in to see your matches.",
  "empty": "None of your wishlist items are on sale right now.",
  "browse": "Browse the marketplace",
  "inBudget": "{count} within budget",
  "onSale": "{count} on sale",
  "maxPrice": "max {price}€",
  "viewListing": "View listing"
}
```

In `apps/web/locales/es.json`, add:

```json
"Matches": {
  "title": "Tus ítems deseados en venta",
  "loginPrompt": "Inicia sesión para ver tus coincidencias.",
  "empty": "Ninguno de tus ítems de wishlist está en venta ahora mismo.",
  "browse": "Explorar el marketplace",
  "inBudget": "{count} dentro de presupuesto",
  "onSale": "{count} en venta",
  "maxPrice": "máx {price}€",
  "viewListing": "Ver anuncio"
}
```

- [ ] **Step 2: Write the failing component test**

Create `apps/web/components/matches/matches-feed.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MatchesFeed } from './matches-feed';
import { useAuthStore } from '@/lib/auth-store';
import * as api from '@/lib/api';
import {
  Condition,
  ListingStatus,
  Rarity,
  WishlistPriority,
} from '@sobrebox/shared';

vi.mock('@/lib/api');
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const messages = {
  Matches: {
    title: 'Your wanted items on sale',
    loginPrompt: 'Log in to see your matches.',
    empty: 'None of your wishlist items are on sale right now.',
    browse: 'Browse the marketplace',
    inBudget: '{count} within budget',
    onSale: '{count} on sale',
    maxPrice: 'max {price}€',
    viewListing: 'View listing',
  },
};

function renderFeed() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <MatchesFeed />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const match = {
  wishlistItemId: 'w1',
  priority: WishlistPriority.HIGH,
  maxPrice: '45.00',
  item: {
    id: 'ci1',
    name: 'Charizard',
    rarity: Rarity.ULTRA_RARE,
    imageUrl: null,
  },
  collection: { slug: 'set', name: 'Set' },
  listingCount: 1,
  inBudgetCount: 1,
  cheapestPrice: '38.00',
  listings: [
    {
      id: 'l1',
      quantity: 1,
      condition: Condition.NEAR_MINT,
      price: '38.00',
      description: null,
      status: ListingStatus.ACTIVE,
      createdAt: '2026-07-02T00:00:00.000Z',
      item: {
        id: 'ci1',
        name: 'Charizard',
        rarity: Rarity.ULTRA_RARE,
        imageUrl: null,
      },
      collection: { slug: 'set', name: 'Set' },
      seller: { username: 'ana', country: 'ES', avatarUrl: null },
      photos: [],
      inBudget: true,
    },
  ],
};

describe('MatchesFeed', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'tok',
      user: null,
    });
  });

  it('renders a card per match with the item name and a listing link', async () => {
    vi.spyOn(api, 'fetchMatches').mockResolvedValue([match]);
    renderFeed();
    await waitFor(() =>
      expect(screen.getByText('Charizard')).toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: 'View listing' })).toHaveAttribute(
      'href',
      '/marketplace/l1',
    );
  });

  it('shows the empty state when there are no matches', async () => {
    vi.spyOn(api, 'fetchMatches').mockResolvedValue([]);
    renderFeed();
    await waitFor(() =>
      expect(
        screen.getByText('None of your wishlist items are on sale right now.'),
      ).toBeInTheDocument(),
    );
  });

  it('prompts login when unauthenticated', () => {
    useAuthStore.setState({
      status: 'unauthenticated',
      accessToken: null,
      user: null,
    });
    vi.spyOn(api, 'fetchMatches').mockResolvedValue([]);
    renderFeed();
    expect(screen.getByText('Log in to see your matches.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @sobrebox/web test -- matches-feed`
Expected: FAIL — cannot resolve `./matches-feed`.

- [ ] **Step 4: Write the component**

Create `apps/web/components/matches/matches-feed.tsx`:

```tsx
'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { useMatches } from './use-matches';

export function MatchesFeed() {
  const t = useTranslations('Matches');
  const status = useAuthStore((s) => s.status);
  const { data, isLoading } = useMatches();

  if (status === 'unauthenticated') return <p>{t('loginPrompt')}</p>;
  if (status === 'loading' || isLoading)
    return <p className="text-muted-foreground">…</p>;
  if (!data || data.length === 0) {
    return (
      <div className="text-muted-foreground">
        <p>{t('empty')}</p>
        <Link href="/marketplace" className="underline">
          {t('browse')}
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {data.map((m) => (
        <li key={m.wishlistItemId} className="rounded border p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-medium">{m.item.name}</span>
            <span className="text-xs text-muted-foreground">
              {m.priority}
              {m.maxPrice ? ` · ${t('maxPrice', { price: m.maxPrice })}` : ''}
              {' · '}
              {t('onSale', { count: m.listingCount })}
              {m.inBudgetCount > 0
                ? ` · ${t('inBudget', { count: m.inBudgetCount })}`
                : ''}
            </span>
          </div>
          <ul className="space-y-1">
            {m.listings.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span>
                  {l.price}€ · {l.condition} · {l.seller.username}
                  {l.seller.country ? ` (${l.seller.country})` : ''}
                  {l.inBudget ? (
                    <span className="ml-2 text-green-600">
                      {t('inBudget', { count: 1 })}
                    </span>
                  ) : null}
                </span>
                <Link href={`/marketplace/${l.id}`} className="underline">
                  {t('viewListing')}
                </Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @sobrebox/web test -- matches-feed`
Expected: PASS (3 tests).

- [ ] **Step 6: Add the route**

Create `apps/web/app/[locale]/wishlist/matches/page.tsx`:

```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MatchesFeed } from '@/components/matches/matches-feed';

export default async function MatchesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Matches');
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>
      <MatchesFeed />
    </main>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/matches/matches-feed.tsx apps/web/components/matches/matches-feed.test.tsx apps/web/app/\[locale\]/wishlist/matches/page.tsx apps/web/locales/en.json apps/web/locales/es.json
git commit -m "feat(web): wishlist/matches feed page"
```

---

## Task 7: Web — badge + link on `/wishlist` (Surface A)

**Files:**

- Modify: `apps/web/components/wishlist/wishlist-list.tsx`
- Create/Modify: `apps/web/components/wishlist/wishlist-list.test.tsx`
- Modify: `apps/web/locales/en.json`, `apps/web/locales/es.json`

**Interfaces:**

- Consumes: `useMatches()`, existing `fetchWishlist`, `Link` from `@/i18n/navigation`, `useTranslations('Wishlist')` + `useTranslations('Matches')`.
- Produces: per-row badge ("N on sale" + "M within budget" when any) linking to `/wishlist/matches`, plus a header link to the feed. Rows with no match render no badge.

- [ ] **Step 1: Add the header-link i18n key**

In `apps/web/locales/en.json` under `Wishlist`, add:

```json
"matchesLink": "See what's on sale"
```

In `apps/web/locales/es.json` under `Wishlist`, add:

```json
"matchesLink": "Ver qué está en venta"
```

- [ ] **Step 2: Write the failing test**

Create `apps/web/components/wishlist/wishlist-list.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WishlistList } from './wishlist-list';
import { useAuthStore } from '@/lib/auth-store';
import * as api from '@/lib/api';
import { Rarity, WishlistPriority } from '@sobrebox/shared';

vi.mock('@/lib/api');
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const messages = {
  Common: { loading: 'Loading…' },
  Wishlist: {
    title: 'My wishlist',
    loginPrompt: 'Log in.',
    empty: 'Empty.',
    remove: 'Remove',
    maxPrice: 'max {price}€',
    matchesLink: "See what's on sale",
  },
  Matches: { onSale: '{count} on sale', inBudget: '{count} within budget' },
};

function renderList() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <WishlistList />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const wishItem = {
  id: 'w1',
  priority: WishlistPriority.HIGH,
  maxPrice: '45.00',
  isPublic: true,
  item: {
    id: 'ci1',
    name: 'Charizard',
    rarity: Rarity.ULTRA_RARE,
    imageUrl: null,
  },
  collection: { slug: 'set', name: 'Set' },
};

describe('WishlistList badge', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'tok',
      user: null,
    });
    vi.spyOn(api, 'fetchWishlist').mockResolvedValue([wishItem]);
  });

  it('shows an on-sale badge for a wishlist item that has matches', async () => {
    vi.spyOn(api, 'fetchMatches').mockResolvedValue([
      {
        wishlistItemId: 'w1',
        priority: WishlistPriority.HIGH,
        maxPrice: '45.00',
        item: wishItem.item,
        collection: wishItem.collection,
        listingCount: 2,
        inBudgetCount: 1,
        cheapestPrice: '38.00',
        listings: [],
      },
    ]);
    renderList();
    await waitFor(() =>
      expect(screen.getByText('2 on sale')).toBeInTheDocument(),
    );
    expect(screen.getByText('1 within budget')).toBeInTheDocument();
  });

  it('shows no badge when the item has no match', async () => {
    vi.spyOn(api, 'fetchMatches').mockResolvedValue([]);
    renderList();
    await waitFor(() =>
      expect(screen.getByText('Charizard')).toBeInTheDocument(),
    );
    expect(screen.queryByText(/on sale/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @sobrebox/web test -- wishlist-list`
Expected: FAIL — no on-sale badge rendered (or missing import).

- [ ] **Step 4: Modify the component**

Edit `apps/web/components/wishlist/wishlist-list.tsx` to consume matches and render the badge. Full updated file:

```tsx
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { deleteWishlistItem, fetchWishlist } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useMatches } from '@/components/matches/use-matches';

export function WishlistList() {
  const t = useTranslations('Wishlist');
  const tm = useTranslations('Matches');
  const tc = useTranslations('Common');
  const status = useAuthStore((s) => s.status);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => fetchWishlist(accessToken as string),
    enabled: status === 'authenticated',
  });
  const { data: matches } = useMatches();
  const matchByItemId = new Map((matches ?? []).map((m) => [m.item.id, m]));

  const remove = useMutation({
    mutationFn: (id: string) => deleteWishlistItem(id, accessToken as string),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
  });

  if (status === 'loading') return <p>{tc('loading')}</p>;
  if (status === 'unauthenticated') return <p>{t('loginPrompt')}</p>;
  if (isLoading) return <p>{tc('loading')}</p>;
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground">{t('empty')}</p>;
  }

  return (
    <>
      {matchByItemId.size > 0 ? (
        <Link
          href="/wishlist/matches"
          className="mb-4 inline-block text-sm underline"
        >
          {t('matchesLink')}
        </Link>
      ) : null}
      <ul className="space-y-2">
        {data.map((w) => {
          const match = matchByItemId.get(w.item.id);
          return (
            <li
              key={w.id}
              className="flex items-center justify-between gap-2 rounded border p-3"
            >
              <span>
                <span className="font-medium">{w.item.name}</span>{' '}
                <span className="text-xs text-muted-foreground">
                  {w.priority}
                  {w.maxPrice
                    ? ` · ${t('maxPrice', { price: w.maxPrice })}`
                    : ''}
                </span>
                {match ? (
                  <Link
                    href="/wishlist/matches"
                    className="ml-2 text-xs text-primary underline"
                  >
                    🛒 {tm('onSale', { count: match.listingCount })}
                    {match.inBudgetCount > 0 ? (
                      <span className="ml-1 text-green-600">
                        {tm('inBudget', { count: match.inBudgetCount })}
                      </span>
                    ) : null}
                  </Link>
                ) : null}
              </span>
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={() => remove.mutate(w.id)}
              >
                {t('remove')}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @sobrebox/web test -- wishlist-list`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/wishlist/wishlist-list.tsx apps/web/components/wishlist/wishlist-list.test.tsx apps/web/locales/en.json apps/web/locales/es.json
git commit -m "feat(web): on-sale badge + matches link on wishlist"
```

---

## Task 8: Full gate + coverage

**Files:** none (verification only).

- [ ] **Step 1: Rebuild shared (consumers must see the compiled DTO)**

Run: `pnpm build:shared`
Expected: exits 0.

- [ ] **Step 2: Run the full gate**

Run: `pnpm pr-check`
Expected: lint clean, type-check clean, coverage ≥80% (statements/branches/functions/lines) in api/web/shared. If any new file dips branch coverage below 80%, add the missing-branch test (e.g. a match with `maxPrice` null in the feed, a listing with a `seller.country` of null in the badge) — do NOT lower the threshold.

- [ ] **Step 3: Run e2e**

Run: `pnpm test:e2e`
Expected: all pass, including the two new matches cases.

- [ ] **Step 4: Commit any coverage top-up tests**

```bash
git add -A
git commit -m "test(marketplace): cover matches branch edge cases"
```

---

## Notes / deferred (from spec, do NOT build here)

- No push notifications when a new match appears (Epic 8).
- No offers/contact-seller (US-23) — matches link to the existing listing detail only.
- No reverse direction ("who wants what I sell").
- No pagination on the feed (wishlists are small); add if it grows.
