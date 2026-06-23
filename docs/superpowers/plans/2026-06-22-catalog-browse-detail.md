# Catalog Browse + Detail (v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the public catalog browse page (filter/sort/grid-list/infinite-scroll) and the collection detail page (items by rarity, official pull rate, pack types, badges), plus the rarity badge — Epic 2 slice 1, on data that exists today.

**Architecture:** Extend the existing `collections` Nest module with a paginated/filtered `GET /collections` and a `GET /collections/:slug` detail; add a tiny `brands` module for the filter. Contracts are shared Zod schemas. The web browse page is a client component using TanStack `useInfiniteQuery` + IntersectionObserver; the detail page is an RSC. The rarity colour system debuts via a `RarityBadge`.

**Tech Stack:** NestJS 10, Prisma 6, Zod 3, Next.js 15 (App Router), TanStack Query v5, shadcn/ui, Tailwind v4, Jest + supertest, Vitest + RTL.

**Spec:** [docs/superpowers/specs/2026-06-22-catalog-browse-detail-design.md](../specs/2026-06-22-catalog-browse-detail-design.md)

## Global Constraints

- **No `any`** — `unknown` + guards or domain types.
- **DTOs/enums/schemas only in `packages/shared`**; import compiled JS in api/web. **Rebuild shared (`pnpm build:shared`) after editing it.**
- **CommonJS, no `.js` import extensions** in `apps/api` and `packages/shared`.
- **Coverage gate 80%** (statements/branches/functions/lines), all 3 packages.
- **TDD** — red → green → refactor for all logic.
- **Conventional Commits (English)**, scope = module. **Never `git push`.**
- Only `status = PUBLISHED` collections are exposed.
- Prisma `Decimal` (`officialPullRate`, `price`) serialize to **STRING** over HTTP — DTOs use `z.string().nullable()`, map with `value?.toString() ?? null`.
- Client web calls go through the same-origin `/api` proxy; RSC uses the absolute internal URL (existing `lib/api` `API_URL` split).
- Empirical pull rate stays in `stats/` (not built here); official pull rate is a stored field read in `collections`.

---

## File map

```text
packages/shared/src/
  schemas/collection-query.schema.ts        # Task 1
  dto/brand.dto.ts                           # Task 1
  dto/collection.dto.ts                      # Task 1 (extend)
  pack-models/summary.ts (+ summary.spec.ts) # Task 2
  index.ts                                   # Task 1 (append)
apps/api/src/
  brands/{brands.service.ts,brands.controller.ts,brands.module.ts} (+ specs)  # Task 3
  collections/collections.service.ts (+ spec)   # Tasks 4-5 (replace findAll)
  collections/collections.controller.ts (+ spec) # Task 6
  app.module.ts                                 # Task 6 (register BrandsModule)
  test/collections.e2e-spec.ts                  # Task 7 (rewrite)
apps/web/
  lib/api.ts (+ api.test.ts)                    # Task 8 (replace fetchCollections)
  app/globals.css                               # Task 9 (rarity tokens)
  components/collections/rarity-badge.tsx (+ test) # Task 9
  components/collections/collection-card.tsx (+ test) # Task 10
  components/collections/collection-filters.tsx (+ test) # Task 11
  components/collections/collection-browser.tsx (+ test) # Task 12
  app/collections/page.tsx                      # Task 12 (replace)
  components/collections/collection-list.tsx (+ test)  # Task 12 (DELETE)
  app/collections/[slug]/page.tsx               # Task 13
docs/ENDPOINT_PERMISSIONS.md  docs/FINDINGS.md  # Task 14
```

---

## Task 1: Shared contracts — query + list/page/detail/brand DTOs (TDD)

**Files:**

- Create: `packages/shared/src/schemas/collection-query.schema.ts`, `packages/shared/src/dto/brand.dto.ts`
- Modify: `packages/shared/src/dto/collection.dto.ts`, `packages/shared/src/index.ts`
- Test: `packages/shared/src/schemas/collection-query.schema.spec.ts`

**Interfaces — Produces:** `collectionsQuerySchema`/`CollectionsQueryDto`; `brandSchema`/`BrandDto`, `brandsResponseSchema`; `collectionListItemSchema`/`CollectionListItemDto`, `collectionsPageSchema`/`CollectionsPageDto`, `collectionItemSchema`/`CollectionItemDto`, `packTypeSummarySchema`/`PackTypeSummaryDto`, `rarityCountSchema`/`RarityCountDto`, `collectionDetailSchema`/`CollectionDetailDto`.

- [ ] **Step 1: Write the failing query-schema test** — `collection-query.schema.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { collectionsQuerySchema } from './collection-query.schema';

describe('collectionsQuerySchema', () => {
  it('applies defaults', () => {
    const q = collectionsQuerySchema.parse({});
    expect(q).toEqual({ page: 1, limit: 20, sort: 'newest' });
  });
  it('coerces numeric strings (query params arrive as strings)', () => {
    const q = collectionsQuerySchema.parse({
      page: '2',
      limit: '5',
      year: '2023',
    });
    expect(q.page).toBe(2);
    expect(q.limit).toBe(5);
    expect(q.year).toBe(2023);
  });
  it('rejects an unknown sort', () => {
    expect(
      collectionsQuerySchema.safeParse({ sort: 'popularity' }).success,
    ).toBe(false);
  });
  it('caps limit at 50', () => {
    expect(collectionsQuerySchema.safeParse({ limit: 999 }).success).toBe(
      false,
    );
  });
});
```

- [ ] **Step 2: Run it (FAIL — module missing)**

Run: `pnpm --filter @sobrebox/shared run test -- collection-query`
Expected: FAIL.

- [ ] **Step 3: Implement the query schema** — `collection-query.schema.ts`

```ts
import { z } from 'zod';
import { CollectionCategory } from '../enums/collection-category';

export const collectionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  brand: z.string().optional(),
  category: z.nativeEnum(CollectionCategory).optional(),
  year: z.coerce.number().int().optional(),
  q: z.string().trim().min(1).optional(),
  sort: z.enum(['name', 'newest', 'year']).default('newest'),
});
export type CollectionsQueryDto = z.infer<typeof collectionsQuerySchema>;
```

- [ ] **Step 4: Implement the brand DTO** — `dto/brand.dto.ts`

```ts
import { z } from 'zod';

export const brandSchema = z.object({ slug: z.string(), name: z.string() });
export type BrandDto = z.infer<typeof brandSchema>;

export const brandsResponseSchema = z.array(brandSchema);
```

- [ ] **Step 5: Extend `dto/collection.dto.ts`** (append below the existing exports; keep `collectionResponseSchema`/`collectionsResponseSchema` removal to Task 8 when consumers are migrated)

```ts
import { Rarity } from '../enums/rarity';
import { brandSchema } from './brand.dto';

export const collectionListItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: z.nativeEnum(CollectionCategory),
  source: z.nativeEnum(CollectionSource),
  releaseYear: z.number().int().nullable(),
  coverImageUrl: z.string().nullable(),
  brand: brandSchema,
  itemCount: z.number().int(),
});
export type CollectionListItemDto = z.infer<typeof collectionListItemSchema>;

export const collectionsPageSchema = z.object({
  items: z.array(collectionListItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  hasMore: z.boolean(),
});
export type CollectionsPageDto = z.infer<typeof collectionsPageSchema>;

export const collectionItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  rarity: z.nativeEnum(Rarity),
  imageUrl: z.string().nullable(),
  officialPullRate: z.string().nullable(),
});
export type CollectionItemDto = z.infer<typeof collectionItemSchema>;

export const packTypeSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.string().nullable(),
  summary: z.string(),
});
export type PackTypeSummaryDto = z.infer<typeof packTypeSummarySchema>;

export const rarityCountSchema = z.object({
  rarity: z.nativeEnum(Rarity),
  count: z.number().int(),
});
export type RarityCountDto = z.infer<typeof rarityCountSchema>;

export const collectionDetailSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: z.nativeEnum(CollectionCategory),
  source: z.nativeEnum(CollectionSource),
  status: z.nativeEnum(CollectionStatus),
  releaseYear: z.number().int().nullable(),
  coverImageUrl: z.string().nullable(),
  brand: brandSchema,
  createdBy: z.object({ username: z.string() }).nullable(),
  rarityDistribution: z.array(rarityCountSchema),
  items: z.array(collectionItemSchema),
  packTypes: z.array(packTypeSummarySchema),
});
export type CollectionDetailDto = z.infer<typeof collectionDetailSchema>;
```

> `collection.dto.ts` already imports `z`, `CollectionCategory`, `CollectionStatus`, `CollectionSource` — add the `Rarity` and `brandSchema` imports at the top with the rest.

- [ ] **Step 6: Append exports to `index.ts`**

```ts
export * from './schemas/collection-query.schema';
export * from './dto/brand.dto';
```

(`./dto/collection.dto` is already exported.)

- [ ] **Step 7: Run tests + build**

Run: `pnpm --filter @sobrebox/shared run test -- collection-query` → PASS.
Run: `pnpm --filter @sobrebox/shared run build` → emits dist.

- [ ] **Step 8: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add catalog query + list/detail/brand contracts"
```

---

## Task 2: Shared `packSummary` helper (TDD)

**Files:**

- Create: `packages/shared/src/pack-models/summary.ts`
- Test: `packages/shared/src/pack-models/summary.spec.ts`
- Modify: `packages/shared/src/index.ts` (append export)

**Interfaces — Consumes:** `validatePackModel`, the pack-model types. **Produces:** `packSummary(category: CollectionCategory, packModel: unknown): string`.

- [ ] **Step 1: Write the failing test** — `summary.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { CollectionCategory } from '../enums/collection-category';
import { Rarity } from '../enums/rarity';
import { packSummary } from './summary';

describe('packSummary', () => {
  it('sums TCG slot counts', () => {
    expect(
      packSummary(CollectionCategory.TCG, {
        slots: [
          { rarity: Rarity.COMMON, count: 5 },
          { rarity: Rarity.RARE, count: 1 },
        ],
      }),
    ).toBe('6 cards');
  });
  it('reports the BLIND_BOX case size', () => {
    expect(
      packSummary(CollectionCategory.BLIND_BOX, {
        caseSize: 12,
        assortment: [{ itemId: 'a', count: 11 }],
      }),
    ).toBe('case of 12');
  });
  it('counts FIGURE items (singular/plural)', () => {
    expect(
      packSummary(CollectionCategory.FIGURE, { items: [{ itemId: 'a' }] }),
    ).toBe('1 figure');
    expect(
      packSummary(CollectionCategory.FIGURE, {
        items: [{ itemId: 'a' }, { itemId: 'b' }],
      }),
    ).toBe('2 figures');
  });
  it('falls back for an invalid pack model', () => {
    expect(packSummary(CollectionCategory.TCG, { slots: [] })).toBe(
      'Unknown pack',
    );
  });
});
```

- [ ] **Step 2: Run it (FAIL)**

Run: `pnpm --filter @sobrebox/shared run test -- summary`
Expected: FAIL.

- [ ] **Step 3: Implement** — `pack-models/summary.ts`

```ts
import { CollectionCategory } from '../enums/collection-category';
import { validatePackModel } from './registry';
import type { TcgPackModel } from './tcg.schema';
import type { BlindBoxPackModel } from './blind-box.schema';
import type { FigurePackModel } from './figure.schema';

export function packSummary(
  category: CollectionCategory,
  packModel: unknown,
): string {
  const result = validatePackModel(category, packModel);
  if (!result.success) return 'Unknown pack';
  const data = result.data;

  switch (category) {
    case CollectionCategory.TCG: {
      const total = (data as TcgPackModel).slots.reduce(
        (n, s) => n + s.count,
        0,
      );
      return `${total} cards`;
    }
    case CollectionCategory.BLIND_BOX:
      return `case of ${(data as BlindBoxPackModel).caseSize}`;
    case CollectionCategory.FIGURE: {
      const n = (data as FigurePackModel).items.length;
      return `${n} figure${n === 1 ? '' : 's'}`;
    }
    default:
      return 'Unknown pack';
  }
}
```

- [ ] **Step 4: Run it (PASS) + build**

Run: `pnpm --filter @sobrebox/shared run test -- summary` → PASS.
Run: `pnpm --filter @sobrebox/shared run build`.

- [ ] **Step 5: Append export to `index.ts` + commit**

```ts
export * from './pack-models/summary';
```

```bash
git add packages/shared
git commit -m "feat(shared): add packSummary helper for pack-type size labels"
```

---

## Task 3: Brands module (TDD)

**Files:**

- Create: `apps/api/src/brands/{brands.service.ts,brands.controller.ts,brands.module.ts}`
- Test: `apps/api/src/brands/{brands.service.spec.ts,brands.controller.spec.ts}`

**Interfaces — Produces:** `BrandsService.findAll(): Promise<BrandDto[]>`; `BrandsController` `GET /brands`; `BrandsModule` (exports nothing; declares controller + provider).

- [ ] **Step 1: Write the failing service test** — `brands.service.spec.ts`

```ts
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
```

- [ ] **Step 2: Run it (FAIL)**

Run: `pnpm --filter @sobrebox/shared run build && pnpm --filter @sobrebox/api run test -- brands.service`
Expected: FAIL.

- [ ] **Step 3: Implement service** — `brands.service.ts`

```ts
import { Injectable } from '@nestjs/common';
import { BrandDto, brandSchema } from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<BrandDto[]> {
    const rows = await this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
      select: { slug: true, name: true },
    });
    return rows.map((r) => brandSchema.parse(r));
  }
}
```

- [ ] **Step 4: Write the failing controller test** — `brands.controller.spec.ts`

```ts
import { Test } from '@nestjs/testing';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';

describe('BrandsController', () => {
  const brands = {
    findAll: jest.fn().mockResolvedValue([{ slug: 'funko', name: 'Funko' }]),
  };
  let controller: BrandsController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BrandsController],
      providers: [{ provide: BrandsService, useValue: brands }],
    }).compile();
    controller = moduleRef.get(BrandsController);
  });

  it('returns all brands', async () => {
    expect(await controller.findAll()).toEqual([
      { slug: 'funko', name: 'Funko' },
    ]);
  });
});
```

- [ ] **Step 5: Implement controller + module**

`brands.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { BrandDto } from '@sobrebox/shared';
import { BrandsService } from './brands.service';

@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  findAll(): Promise<BrandDto[]> {
    return this.brands.findAll();
  }
}
```

`brands.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';

@Module({ controllers: [BrandsController], providers: [BrandsService] })
export class BrandsModule {}
```

- [ ] **Step 6: Run tests (PASS) + commit**

Run: `pnpm --filter @sobrebox/api run test -- "brands.service|brands.controller"` → PASS.

```bash
git add apps/api/src/brands
git commit -m "feat(api): add brands module (GET /brands)"
```

---

## Task 4: collections.service.findPage — filter/sort/paginate (TDD)

**Files:**

- Modify: `apps/api/src/collections/collections.service.ts` (replace `findAll` with `findPage`)
- Test: `apps/api/src/collections/collections.service.spec.ts` (rewrite)

**Interfaces — Consumes:** `CollectionsQueryDto`, `collectionsPageSchema`, `collectionListItemSchema`, `CollectionStatus`. **Produces:** `CollectionsService.findPage(query: CollectionsQueryDto): Promise<CollectionsPageDto>`.

- [ ] **Step 1: Rewrite the service test** — `collections.service.spec.ts`

```ts
import { Test } from '@nestjs/testing';
import {
  CollectionCategory,
  CollectionSource,
  CollectionStatus,
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
```

- [ ] **Step 2: Run it (FAIL)**

Run: `pnpm --filter @sobrebox/shared run build && pnpm --filter @sobrebox/api run test -- collections.service`
Expected: FAIL (`findPage` not defined).

- [ ] **Step 3: Implement** — replace the body of `collections.service.ts`

```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CollectionsPageDto,
  collectionsPageSchema,
  CollectionListItemDto,
  collectionListItemSchema,
  CollectionsQueryDto,
  CollectionStatus,
} from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findPage(query: CollectionsQueryDto): Promise<CollectionsPageDto> {
    const { page, limit, brand, category, year, q, sort } = query;

    const where: Prisma.CollectionWhereInput = {
      status: CollectionStatus.PUBLISHED,
      ...(brand ? { brand: { slug: brand } } : {}),
      ...(category ? { category } : {}),
      ...(year !== undefined ? { releaseYear: year } : {}),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    };

    const orderBy: Prisma.CollectionOrderByWithRelationInput =
      sort === 'name'
        ? { name: 'asc' }
        : sort === 'year'
          ? { releaseYear: 'desc' }
          : { createdAt: 'desc' };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.collection.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          name: true,
          category: true,
          source: true,
          releaseYear: true,
          coverImageUrl: true,
          brand: { select: { slug: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.collection.count({ where }),
    ]);

    const items: CollectionListItemDto[] = rows.map((r) =>
      collectionListItemSchema.parse({
        id: r.id,
        slug: r.slug,
        name: r.name,
        category: r.category,
        source: r.source,
        releaseYear: r.releaseYear,
        coverImageUrl: r.coverImageUrl,
        brand: r.brand,
        itemCount: r._count.items,
      }),
    );

    return collectionsPageSchema.parse({
      items,
      page,
      pageSize: limit,
      total,
      hasMore: page * limit < total,
    });
  }
}
```

- [ ] **Step 4: Run it (PASS)**

Run: `pnpm --filter @sobrebox/api run test -- collections.service` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/collections/collections.service.ts apps/api/src/collections/collections.service.spec.ts
git commit -m "feat(api): paginate+filter+sort GET /collections (findPage)"
```

---

## Task 5: collections.service.findBySlug — detail (TDD)

**Files:**

- Modify: `apps/api/src/collections/collections.service.ts` (add `findBySlug`)
- Test: `apps/api/src/collections/collections.service.spec.ts` (append a `findBySlug` describe block)

**Interfaces — Consumes:** `collectionDetailSchema`, `packSummary`, `Rarity`. **Produces:** `CollectionsService.findBySlug(slug: string): Promise<CollectionDetailDto>`.

- [ ] **Step 1: Append the failing test** — in `collections.service.spec.ts`

```ts
import { NotFoundException } from '@nestjs/common';
import { Rarity } from '@sobrebox/shared';

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
```

- [ ] **Step 2: Run it (FAIL)**

Run: `pnpm --filter @sobrebox/api run test -- collections.service`
Expected: FAIL (`findBySlug` not defined).

- [ ] **Step 3: Implement** — add to `collections.service.ts` (add imports: `NotFoundException` from `@nestjs/common`; `CollectionDetailDto, collectionDetailSchema, packSummary, Rarity` from `@sobrebox/shared`)

```ts
  async findBySlug(slug: string): Promise<CollectionDetailDto> {
    const c = await this.prisma.collection.findFirst({
      where: { slug, status: CollectionStatus.PUBLISHED },
      select: {
        id: true, slug: true, name: true, category: true, source: true, status: true,
        releaseYear: true, coverImageUrl: true,
        brand: { select: { slug: true, name: true } },
        createdBy: { select: { username: true } },
        items: {
          orderBy: [{ rarity: 'asc' }, { name: 'asc' }],
          select: { id: true, name: true, rarity: true, imageUrl: true, officialPullRate: true },
        },
        packTypes: { select: { id: true, name: true, price: true, packModel: true } },
      },
    });
    if (!c) throw new NotFoundException('Collection not found');

    const counts = new Map<Rarity, number>();
    for (const it of c.items) counts.set(it.rarity, (counts.get(it.rarity) ?? 0) + 1);
    const rarityDistribution = [...counts.entries()].map(([rarity, count]) => ({ rarity, count }));

    return collectionDetailSchema.parse({
      id: c.id, slug: c.slug, name: c.name, category: c.category, source: c.source, status: c.status,
      releaseYear: c.releaseYear, coverImageUrl: c.coverImageUrl,
      brand: c.brand,
      createdBy: c.createdBy ? { username: c.createdBy.username } : null,
      rarityDistribution,
      items: c.items.map((i) => ({
        id: i.id, name: i.name, rarity: i.rarity, imageUrl: i.imageUrl,
        officialPullRate: i.officialPullRate?.toString() ?? null,
      })),
      packTypes: c.packTypes.map((p) => ({
        id: p.id, name: p.name,
        price: p.price?.toString() ?? null,
        summary: packSummary(c.category, p.packModel),
      })),
    });
  }
```

> Because items are queried `orderBy rarity asc` (Postgres enum order = declaration order: COMMON→…→LIMITED), inserting into the Map in row order yields the distribution already in rarity order.

- [ ] **Step 4: Run it (PASS)**

Run: `pnpm --filter @sobrebox/api run test -- collections.service` → PASS (findPage + findBySlug).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/collections/collections.service.ts apps/api/src/collections/collections.service.spec.ts
git commit -m "feat(api): add GET /collections/:slug detail (items, distribution, packs)"
```

---

## Task 6: collections.controller + wire brands (TDD)

**Files:**

- Modify: `apps/api/src/collections/collections.controller.ts`, `apps/api/src/collections/collections.controller.spec.ts`, `apps/api/src/app.module.ts`

**Interfaces — Consumes:** `CollectionsService.findPage/findBySlug`, `collectionsQuerySchema`, `ZodValidationPipe`. **Produces:** `GET /collections` (query) + `GET /collections/:slug`.

- [ ] **Step 1: Rewrite the controller test** — `collections.controller.spec.ts`

```ts
import { Test } from '@nestjs/testing';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';

describe('CollectionsController', () => {
  const collections = {
    findPage: jest
      .fn()
      .mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        hasMore: false,
      }),
    findBySlug: jest.fn().mockResolvedValue({ slug: 's' }),
  };
  let controller: CollectionsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [CollectionsController],
      providers: [{ provide: CollectionsService, useValue: collections }],
    }).compile();
    controller = moduleRef.get(CollectionsController);
  });

  it('delegates list to findPage with the parsed query', async () => {
    const query = { page: 1, limit: 20, sort: 'newest' as const };
    await controller.findAll(query);
    expect(collections.findPage).toHaveBeenCalledWith(query);
  });

  it('delegates detail to findBySlug', async () => {
    await controller.findOne('s');
    expect(collections.findBySlug).toHaveBeenCalledWith('s');
  });
});
```

- [ ] **Step 2: Run it (FAIL)**

Run: `pnpm --filter @sobrebox/api run test -- collections.controller`
Expected: FAIL.

- [ ] **Step 3: Implement** — `collections.controller.ts`

```ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  CollectionDetailDto,
  CollectionsPageDto,
  collectionsQuerySchema,
  CollectionsQueryDto,
} from '@sobrebox/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CollectionsService } from './collections.service';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(collectionsQuerySchema))
    query: CollectionsQueryDto,
  ): Promise<CollectionsPageDto> {
    return this.collections.findPage(query);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string): Promise<CollectionDetailDto> {
    return this.collections.findBySlug(slug);
  }
}
```

> The existing `ZodValidationPipe` validates the value it's given; on a `@Query()` arg it receives the full query object, so `collectionsQuerySchema` (with coercion + defaults) parses it. Confirm by reading `apps/api/src/common/zod-validation.pipe.ts`.

- [ ] **Step 4: Register BrandsModule** — `app.module.ts` imports (add alongside CollectionsModule)

```ts
import { BrandsModule } from './brands/brands.module';
// ...
imports: [
  // ...existing: ConfigModule, PrismaModule, RedisModule, AuthModule, UsersModule, CollectionsModule
  BrandsModule,
],
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm --filter @sobrebox/api run test -- collections.controller` → PASS.
Run: `pnpm --filter @sobrebox/api exec tsc --noEmit` → clean.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/collections apps/api/src/app.module.ts
git commit -m "feat(api): wire paginated collections list + detail endpoints"
```

---

## Task 7: Collections e2e — list/detail/brands (TDD against seeded DB)

**Files:**

- Rewrite: `apps/api/test/collections.e2e-spec.ts`

- [ ] **Step 1: Rewrite the e2e** — `collections.e2e-spec.ts`

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Catalog (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  it('GET /collections returns a paged published list', async () => {
    const res = await request(app.getHttpServer())
      .get('/collections')
      .expect(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 20 });
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(3);
    expect(res.body.items[0]).toHaveProperty('brand.name');
    expect(res.body.items[0]).toHaveProperty('itemCount');
  });

  it('GET /collections filters by category', async () => {
    const res = await request(app.getHttpServer())
      .get('/collections?category=TCG')
      .expect(200);
    expect(
      res.body.items.every((c: { category: string }) => c.category === 'TCG'),
    ).toBe(true);
  });

  it('GET /collections rejects an invalid sort', async () => {
    await request(app.getHttpServer())
      .get('/collections?sort=popularity')
      .expect(400);
  });

  it('GET /collections/:slug returns detail', async () => {
    const res = await request(app.getHttpServer())
      .get('/collections/sv-obsidian-flames')
      .expect(200);
    expect(res.body).toMatchObject({ slug: 'sv-obsidian-flames' });
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(Array.isArray(res.body.rarityDistribution)).toBe(true);
    expect(Array.isArray(res.body.packTypes)).toBe(true);
  });

  it('GET /collections/:slug 404s for an unknown slug', async () => {
    await request(app.getHttpServer())
      .get('/collections/does-not-exist')
      .expect(404);
  });

  it('GET /brands lists brands', async () => {
    const res = await request(app.getHttpServer()).get('/brands').expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    expect(res.body[0]).toHaveProperty('slug');
  });
});
```

> Slugs (`sv-obsidian-flames`) come from `apps/api/prisma/seed.ts`.

- [ ] **Step 2: Run the e2e (infra up + seeded)**

Run:

```bash
pnpm infra:up && pnpm db:deploy && pnpm db:seed
pnpm --filter @sobrebox/shared run build
pnpm test:e2e -- collections
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/collections.e2e-spec.ts
git commit -m "test(api): rewrite collections e2e for paged list + detail + brands"
```

---

## Task 8: Web API client — page/brands/detail (TDD)

**Files:**

- Modify: `apps/web/lib/api.ts`, `apps/web/lib/api.test.ts`

**Interfaces — Produces:** `fetchCollectionsPage(query: Partial<CollectionsQueryDto>): Promise<CollectionsPageDto>`, `fetchBrands(): Promise<BrandDto[]>`, `fetchCollectionDetail(slug: string): Promise<CollectionDetailDto>`. Removes `fetchCollections`.

- [ ] **Step 1: Rewrite the relevant api tests** — replace the `fetchCollections` describe in `apps/web/lib/api.test.ts` with:

```ts
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  fetchCollectionsPage,
  fetchBrands,
  fetchCollectionDetail,
} from './api';

afterEach(() => vi.unstubAllGlobals());

describe('fetchCollectionsPage', () => {
  it('builds the query string and returns the parsed page', async () => {
    const page = {
      items: [],
      page: 2,
      pageSize: 20,
      total: 0,
      hasMore: false,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => page });
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      fetchCollectionsPage({ page: 2, category: undefined, q: 'char' }),
    ).resolves.toEqual(page);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/collections?');
    expect(url).toContain('page=2');
    expect(url).toContain('q=char');
    expect(url).not.toContain('category=');
  });

  it('throws on non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    await expect(fetchCollectionsPage({})).rejects.toThrow(/500/);
  });
});

describe('fetchBrands', () => {
  it('returns the brand list', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => [{ slug: 'funko', name: 'Funko' }],
        }),
    );
    await expect(fetchBrands()).resolves.toEqual([
      { slug: 'funko', name: 'Funko' },
    ]);
  });
});

describe('fetchCollectionDetail', () => {
  it('returns the detail json', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ slug: 's' }) }),
    );
    await expect(fetchCollectionDetail('s')).resolves.toEqual({ slug: 's' });
  });
  it('throws on non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );
    await expect(fetchCollectionDetail('s')).rejects.toThrow(/404/);
  });
});
```

- [ ] **Step 2: Run it (FAIL)**

Run: `pnpm --filter @sobrebox/shared run build && pnpm --filter @sobrebox/web run test -- api`
Expected: FAIL (functions missing).

- [ ] **Step 3: Implement** — in `apps/web/lib/api.ts`, remove `fetchCollections`/`collectionsResponseSchema` import and add (keep the existing `API_URL` server/client split + `postJson` helper):

```ts
import type {
  BrandDto,
  CollectionDetailDto,
  CollectionsPageDto,
  CollectionsQueryDto,
} from '@sobrebox/shared';

function buildQuery(query: Partial<CollectionsQueryDto>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export async function fetchCollectionsPage(
  query: Partial<CollectionsQueryDto>,
): Promise<CollectionsPageDto> {
  const res = await fetch(`${API_URL}/collections${buildQuery(query)}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch collections: ${res.status}`);
  return res.json() as Promise<CollectionsPageDto>;
}

export async function fetchBrands(): Promise<BrandDto[]> {
  const res = await fetch(`${API_URL}/brands`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch brands: ${res.status}`);
  return res.json() as Promise<BrandDto[]>;
}

export async function fetchCollectionDetail(
  slug: string,
): Promise<CollectionDetailDto> {
  const res = await fetch(`${API_URL}/collections/${slug}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch collection: ${res.status}`);
  return res.json() as Promise<CollectionDetailDto>;
}
```

> Remove the now-unused `collectionsResponseSchema` import. If `collectionResponseSchema`/`collectionsResponseSchema` are referenced nowhere else after Task 12, delete them from `packages/shared/src/dto/collection.dto.ts` and rebuild.

- [ ] **Step 4: Run it (PASS) + commit**

Run: `pnpm --filter @sobrebox/web run test -- api` → PASS.

```bash
git add apps/web/lib/api.ts apps/web/lib/api.test.ts
git commit -m "feat(web): add catalog page/brands/detail api clients"
```

---

## Task 9: RarityBadge + rarity tokens (TDD)

**Files:**

- Modify: `apps/web/app/globals.css` (add `--rarity-*` tokens)
- Create: `apps/web/components/collections/rarity-badge.tsx`
- Test: `apps/web/components/collections/rarity-badge.test.tsx`

**Interfaces — Produces:** `RarityBadge({ rarity }: { rarity: Rarity })`.

- [ ] **Step 1: Add rarity tokens to `globals.css`** (inside both `:root` and `.dark` — same hues read fine on light + dark; place after the existing token blocks)

```css
:root {
  /* rarity system (design-system.md) */
  --rarity-common: oklch(0.72 0.03 250);
  --rarity-uncommon: oklch(0.78 0.16 150);
  --rarity-rare: oklch(0.72 0.16 255);
  --rarity-ultra: oklch(0.72 0.17 300);
  --rarity-secret: oklch(0.78 0.16 75);
  --rarity-limited: oklch(0.7 0.2 20);
}
.dark {
  --rarity-common: oklch(0.74 0.03 250);
  --rarity-uncommon: oklch(0.82 0.17 150);
  --rarity-rare: oklch(0.76 0.16 255);
  --rarity-ultra: oklch(0.78 0.17 300);
  --rarity-secret: oklch(0.83 0.16 75);
  --rarity-limited: oklch(0.74 0.2 20);
}
```

> Add these as additional declarations inside the existing `:root {}` and `.dark {}` blocks (don't create duplicate selectors).

- [ ] **Step 2: Write the failing test** — `rarity-badge.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Rarity } from '@sobrebox/shared';
import { RarityBadge } from './rarity-badge';

describe('RarityBadge', () => {
  it('renders a human label for each rarity (text, not just colour)', () => {
    render(<RarityBadge rarity={Rarity.ULTRA_RARE} />);
    expect(screen.getByText(/ultra rare/i)).toBeInTheDocument();
  });
  it('sets the rarity colour via CSS variable', () => {
    render(<RarityBadge rarity={Rarity.SECRET} />);
    const el = screen.getByText(/secret/i).closest('span');
    expect(el?.getAttribute('style') ?? '').toContain('--rarity-secret');
  });
});
```

- [ ] **Step 3: Run it (FAIL)**

Run: `pnpm --filter @sobrebox/web run test -- rarity-badge`
Expected: FAIL.

- [ ] **Step 4: Implement** — `rarity-badge.tsx`

```tsx
import type { CSSProperties } from 'react';
import { Rarity } from '@sobrebox/shared';
import { cn } from '@/lib/utils';

const LABEL: Record<Rarity, string> = {
  [Rarity.COMMON]: 'Common',
  [Rarity.UNCOMMON]: 'Uncommon',
  [Rarity.RARE]: 'Rare',
  [Rarity.ULTRA_RARE]: 'Ultra Rare',
  [Rarity.SECRET]: 'Secret',
  [Rarity.LIMITED]: 'Limited',
};

const TOKEN: Record<Rarity, string> = {
  [Rarity.COMMON]: '--rarity-common',
  [Rarity.UNCOMMON]: '--rarity-uncommon',
  [Rarity.RARE]: '--rarity-rare',
  [Rarity.ULTRA_RARE]: '--rarity-ultra',
  [Rarity.SECRET]: '--rarity-secret',
  [Rarity.LIMITED]: '--rarity-limited',
};

export function RarityBadge({
  rarity,
  className,
}: {
  rarity: Rarity;
  className?: string;
}) {
  const color = `var(${TOKEN[rarity]})`;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        className,
      )}
      style={{ color, borderColor: color } as CSSProperties}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {LABEL[rarity]}
    </span>
  );
}
```

- [ ] **Step 5: Run it (PASS) + commit**

Run: `pnpm --filter @sobrebox/web run test -- rarity-badge` → PASS.

```bash
git add apps/web/app/globals.css apps/web/components/collections/rarity-badge.tsx apps/web/components/collections/rarity-badge.test.tsx
git commit -m "feat(web): add RarityBadge and rarity colour tokens"
```

---

## Task 10: CollectionCard (grid + list) (TDD)

**Files:**

- Create: `apps/web/components/collections/collection-card.tsx`
- Test: `apps/web/components/collections/collection-card.test.tsx`

**Interfaces — Consumes:** `CollectionListItemDto`. **Produces:** `CollectionCard({ collection, variant }: { collection: CollectionListItemDto; variant?: 'grid' | 'list' })`.

- [ ] **Step 1: Write the failing test** — `collection-card.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CollectionCard } from './collection-card';
import type { CollectionListItemDto } from '@sobrebox/shared';

const item: CollectionListItemDto = {
  id: '1',
  slug: 'sv-obsidian-flames',
  name: 'Obsidian Flames',
  category: 'TCG' as CollectionListItemDto['category'],
  source: 'API_IMPORT' as CollectionListItemDto['source'],
  releaseYear: 2023,
  coverImageUrl: null,
  brand: { slug: 'pokemon', name: 'Pokémon' },
  itemCount: 12,
};

describe('CollectionCard', () => {
  it('shows name, brand, item count and links to the detail page', () => {
    render(<CollectionCard collection={item} />);
    expect(screen.getByText('Obsidian Flames')).toBeInTheDocument();
    expect(screen.getByText(/pokémon/i)).toBeInTheDocument();
    expect(screen.getByText(/12 items/i)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/collections/sv-obsidian-flames',
    );
  });

  it('marks the verified source', () => {
    render(<CollectionCard collection={item} />);
    expect(screen.getByText(/verified/i)).toBeInTheDocument();
  });

  it('marks community source', () => {
    render(
      <CollectionCard
        collection={{
          ...item,
          source: 'COMMUNITY' as CollectionListItemDto['source'],
        }}
      />,
    );
    expect(screen.getByText(/community/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it (FAIL)**

Run: `pnpm --filter @sobrebox/web run test -- collection-card`
Expected: FAIL.

- [ ] **Step 3: Implement** — `collection-card.tsx`

```tsx
import Link from 'next/link';
import { CollectionSource, type CollectionListItemDto } from '@sobrebox/shared';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function SourceBadge({ source }: { source: CollectionListItemDto['source'] }) {
  const verified = source !== CollectionSource.COMMUNITY;
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {verified ? 'Verified' : 'Community'}
    </span>
  );
}

export function CollectionCard({
  collection,
  variant = 'grid',
}: {
  collection: CollectionListItemDto;
  variant?: 'grid' | 'list';
}) {
  const {
    slug,
    name,
    brand,
    category,
    itemCount,
    releaseYear,
    coverImageUrl,
    source,
  } = collection;
  return (
    <Link href={`/collections/${slug}`} className="group block">
      <Card
        className={cn(
          'overflow-hidden transition-colors hover:border-primary/50',
          variant === 'list' && 'flex-row',
        )}
      >
        <CardContent
          className={cn(
            'p-4',
            variant === 'grid'
              ? 'flex flex-col gap-2'
              : 'flex items-center gap-4',
          )}
        >
          <div
            className="aspect-[4/3] w-full shrink-0 rounded-md bg-muted bg-cover bg-center"
            style={
              coverImageUrl
                ? { backgroundImage: `url(${coverImageUrl})` }
                : undefined
            }
            role="img"
            aria-label={name}
          />
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-heading text-base font-semibold leading-tight">
                {name}
              </h3>
              <SourceBadge source={source} />
            </div>
            <p className="text-sm text-muted-foreground">
              {brand.name} · {category}
              {releaseYear ? ` · ${releaseYear}` : ''}
            </p>
            <p className="text-sm text-muted-foreground">{itemCount} items</p>
            <p className="text-xs text-muted-foreground/70">
              Openings &amp; pull rates: coming soon
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
```

> The "coming soon" line is the honest placeholder for the deferred opening/collector stats.

- [ ] **Step 4: Run it (PASS) + commit**

Run: `pnpm --filter @sobrebox/web run test -- collection-card` → PASS.

```bash
git add apps/web/components/collections/collection-card.tsx apps/web/components/collections/collection-card.test.tsx
git commit -m "feat(web): add CollectionCard (grid + list variants)"
```

---

## Task 11: CollectionFilters (TDD)

**Files:**

- Create: `apps/web/components/collections/collection-filters.tsx`
- Test: `apps/web/components/collections/collection-filters.test.tsx`

**Interfaces — Consumes:** `fetchBrands`, `CollectionsQueryDto`, `CollectionCategory`. **Produces:** `CollectionFilters({ value, onChange })` where `value: CatalogFilterState` and `onChange(next: CatalogFilterState): void`; export `type CatalogFilterState = { brand?: string; category?: CollectionCategory; year?: number; q?: string }`.

- [ ] **Step 1: Write the failing test** — `collection-filters.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CollectionFilters } from './collection-filters';

vi.mock('@/lib/api', () => ({
  fetchBrands: vi
    .fn()
    .mockResolvedValue([{ slug: 'pokemon', name: 'Pokémon' }]),
}));

describe('CollectionFilters', () => {
  it('emits a q change as the user types', async () => {
    const onChange = vi.fn();
    render(<CollectionFilters value={{}} onChange={onChange} />);
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'char');
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)?.[0];
    expect(last.q).toContain('char');
  });
});
```

- [ ] **Step 2: Run it (FAIL)**

Run: `pnpm --filter @sobrebox/web run test -- collection-filters`
Expected: FAIL.

- [ ] **Step 3: Implement** — `collection-filters.tsx`

```tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { CollectionCategory } from '@sobrebox/shared';
import { fetchBrands } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type CatalogFilterState = {
  brand?: string;
  category?: CollectionCategory;
  year?: number;
  q?: string;
};

export function CollectionFilters({
  value,
  onChange,
}: {
  value: CatalogFilterState;
  onChange: (next: CatalogFilterState) => void;
}) {
  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: fetchBrands,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="q">Search</Label>
        <Input
          id="q"
          placeholder="Search collections"
          value={value.q ?? ''}
          onChange={(e) =>
            onChange({ ...value, q: e.target.value || undefined })
          }
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brand">Brand</Label>
        <select
          id="brand"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={value.brand ?? ''}
          onChange={(e) =>
            onChange({ ...value, brand: e.target.value || undefined })
          }
        >
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={value.category ?? ''}
          onChange={(e) =>
            onChange({
              ...value,
              category: (e.target.value || undefined) as
                | CollectionCategory
                | undefined,
            })
          }
        >
          <option value="">All categories</option>
          {Object.values(CollectionCategory).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="year">Year</Label>
        <Input
          id="year"
          type="number"
          placeholder="Any year"
          value={value.year ?? ''}
          onChange={(e) =>
            onChange({
              ...value,
              year: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        />
      </div>
    </div>
  );
}
```

> Native `<select>` keeps the task small and dependency-light; a shadcn `Select` swap is a later polish. The test wraps in no provider — `useQuery` works without one only if a `QueryClientProvider` is present; the test must wrap. Update the test to render inside a `QueryClientProvider`:

Add to the top of `collection-filters.test.tsx` and wrap `render`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const client = new QueryClient();
const wrap = (ui: React.ReactNode) => (
  <QueryClientProvider client={client}>{ui}</QueryClientProvider>
);
// render(wrap(<CollectionFilters value={{}} onChange={onChange} />));
```

- [ ] **Step 4: Run it (PASS) + commit**

Run: `pnpm --filter @sobrebox/web run test -- collection-filters` → PASS.

```bash
git add apps/web/components/collections/collection-filters.tsx apps/web/components/collections/collection-filters.test.tsx
git commit -m "feat(web): add CollectionFilters (brand/category/year/search)"
```

---

## Task 12: CollectionBrowser + page (infinite scroll) (TDD)

**Files:**

- Create: `apps/web/components/collections/collection-browser.tsx`
- Test: `apps/web/components/collections/collection-browser.test.tsx`
- Replace: `apps/web/app/collections/page.tsx`
- Delete: `apps/web/components/collections/collection-list.tsx`, `apps/web/components/collections/collection-list.test.tsx`

**Interfaces — Consumes:** `fetchCollectionsPage`, `CollectionCard`, `CollectionFilters`/`CatalogFilterState`, `useInfiniteQuery`. **Produces:** `CollectionBrowser()` (no props).

- [ ] **Step 1: Delete the obsolete list component + test**

```bash
git rm apps/web/components/collections/collection-list.tsx apps/web/components/collections/collection-list.test.tsx
```

- [ ] **Step 2: Write the failing test** — `collection-browser.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CollectionBrowser } from './collection-browser';

vi.mock('@/lib/api', () => ({
  fetchBrands: vi.fn().mockResolvedValue([]),
  fetchCollectionsPage: vi.fn().mockResolvedValue({
    items: [
      {
        id: '1',
        slug: 'a',
        name: 'Obsidian Flames',
        category: 'TCG',
        source: 'API_IMPORT',
        releaseYear: 2023,
        coverImageUrl: null,
        brand: { slug: 'pokemon', name: 'Pokémon' },
        itemCount: 3,
      },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
    hasMore: false,
  }),
}));

function renderBrowser() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <CollectionBrowser />
    </QueryClientProvider>,
  );
}

describe('CollectionBrowser', () => {
  it('renders fetched collections', async () => {
    renderBrowser();
    expect(await screen.findByText('Obsidian Flames')).toBeInTheDocument();
  });

  it('renders the sort control', async () => {
    renderBrowser();
    expect(await screen.findByLabelText(/sort/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run it (FAIL)**

Run: `pnpm --filter @sobrebox/web run test -- collection-browser`
Expected: FAIL.

- [ ] **Step 4: Implement** — `collection-browser.tsx`

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { CollectionsQueryDto } from '@sobrebox/shared';
import { fetchCollectionsPage } from '@/lib/api';
import { CollectionCard } from './collection-card';
import {
  CollectionFilters,
  type CatalogFilterState,
} from './collection-filters';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Sort = CollectionsQueryDto['sort'];

export function CollectionBrowser() {
  const [filters, setFilters] = useState<CatalogFilterState>({});
  const [sort, setSort] = useState<Sort>('newest');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const query = useInfiniteQuery({
    queryKey: ['collections', filters, sort],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchCollectionsPage({ ...filters, sort, page: pageParam, limit: 20 }),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (
        entries[0].isIntersecting &&
        query.hasNextPage &&
        !query.isFetchingNextPage
      ) {
        void query.fetchNextPage();
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [query.hasNextPage, query.isFetchingNextPage, query]);

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <aside className="md:w-64 md:shrink-0">
        <CollectionFilters value={filters} onChange={setFilters} />
      </aside>

      <div className="flex-1">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="sort">Sort</Label>
            <select
              id="sort"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
            >
              <option value="newest">Newest</option>
              <option value="name">Name A-Z</option>
              <option value="year">Year</option>
            </select>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              aria-label="Grid view"
              className={cn(
                'rounded-md border px-2 py-1 text-sm',
                view === 'grid' && 'bg-muted',
              )}
              onClick={() => setView('grid')}
            >
              Grid
            </button>
            <button
              type="button"
              aria-label="List view"
              className={cn(
                'rounded-md border px-2 py-1 text-sm',
                view === 'list' && 'bg-muted',
              )}
              onClick={() => setView('list')}
            >
              List
            </button>
          </div>
        </div>

        {query.isError && <p role="alert">Could not load collections.</p>}
        {query.isPending && <p className="text-muted-foreground">Loading…</p>}
        {!query.isPending && items.length === 0 && (
          <p className="text-muted-foreground">
            No collections match your filters.
          </p>
        )}

        <div
          className={cn(
            view === 'grid'
              ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
              : 'flex flex-col gap-3',
          )}
        >
          {items.map((c) => (
            <CollectionCard key={c.id} collection={c} variant={view} />
          ))}
        </div>

        <div ref={sentinel} className="h-8" />
        {query.isFetchingNextPage && (
          <p className="text-muted-foreground">Loading more…</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Replace the page** — `apps/web/app/collections/page.tsx`

```tsx
import { CollectionBrowser } from '@/components/collections/collection-browser';

export default function CollectionsPage() {
  return (
    <main className="container mx-auto px-6 py-8">
      <h1 className="mb-6 font-heading text-2xl font-bold">Collections</h1>
      <CollectionBrowser />
    </main>
  );
}
```

- [ ] **Step 6: Run tests (PASS)**

Run: `pnpm --filter @sobrebox/web run test -- collection-browser` → PASS.
Run: `pnpm --filter @sobrebox/web run test` → whole web suite green (the old collection-list test is gone).

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): add CollectionBrowser with filters, sort and infinite scroll"
```

---

## Task 13: Collection detail page (RSC)

**Files:**

- Create: `apps/web/app/collections/[slug]/page.tsx`

> App-router pages are excluded from web coverage (`app/**`), so this task has no unit test; it's covered by the API e2e + manual smoke. Keep logic in the page minimal (presentational).

- [ ] **Step 1: Implement the detail page** — `apps/web/app/collections/[slug]/page.tsx`

```tsx
import { notFound } from 'next/navigation';
import {
  CollectionSource,
  Rarity,
  type CollectionDetailDto,
} from '@sobrebox/shared';
import { fetchCollectionDetail } from '@/lib/api';
import { RarityBadge } from '@/components/collections/rarity-badge';

const RARITY_ORDER: Rarity[] = [
  Rarity.COMMON,
  Rarity.UNCOMMON,
  Rarity.RARE,
  Rarity.ULTRA_RARE,
  Rarity.SECRET,
  Rarity.LIMITED,
];

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let detail: CollectionDetailDto;
  try {
    detail = await fetchCollectionDetail(slug);
  } catch {
    notFound();
  }

  const verified = detail.source !== CollectionSource.COMMUNITY;
  const itemsByRarity = RARITY_ORDER.map((rarity) => ({
    rarity,
    items: detail.items.filter((i) => i.rarity === rarity),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="container mx-auto px-6 py-8">
      <header className="mb-8 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-3xl font-bold">{detail.name}</h1>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {verified ? 'Verified' : 'Community'}
          </span>
        </div>
        <p className="text-muted-foreground">
          {detail.brand.name} · {detail.category}
          {detail.releaseYear ? ` · ${detail.releaseYear}` : ''}
          {detail.createdBy ? ` · by @${detail.createdBy.username}` : ''}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {detail.rarityDistribution.map((r) => (
            <span key={r.rarity} className="text-xs text-muted-foreground">
              <RarityBadge rarity={r.rarity} /> ×{r.count}
            </span>
          ))}
        </div>
      </header>

      {detail.packTypes.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-heading text-xl font-semibold">
            Pack types
          </h2>
          <ul className="flex flex-col gap-2">
            {detail.packTypes.map((p) => (
              <li
                key={p.id}
                className="flex justify-between rounded-md border p-3 text-sm"
              >
                <span>
                  {p.name} · {p.summary}
                </span>
                <span className="font-mono">
                  {p.price ? `${p.price} €` : '—'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-6">
        {itemsByRarity.map((group) => (
          <div key={group.rarity}>
            <div className="mb-2">
              <RarityBadge rarity={group.rarity} />
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {group.items.map((i) => (
                <li key={i.id} className="rounded-md border p-3">
                  <div
                    className="mb-2 aspect-[3/4] rounded bg-muted bg-cover bg-center"
                    style={
                      i.imageUrl
                        ? { backgroundImage: `url(${i.imageUrl})` }
                        : undefined
                    }
                    role="img"
                    aria-label={i.name}
                  />
                  <p className="text-sm font-medium leading-tight">{i.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    Official: {i.officialPullRate ?? '—'}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <p className="mt-8 text-sm text-muted-foreground/70">
        Community pull rates, opening counts and collectors: coming soon.
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @sobrebox/shared run build && pnpm --filter @sobrebox/web run build`
Expected: `next build` succeeds (`/collections/[slug]` as a dynamic route).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/collections/[slug]/page.tsx
git commit -m "feat(web): add collection detail page (items by rarity, packs)"
```

---

## Task 14: Docs + final verification

**Files:**

- Modify: `docs/ENDPOINT_PERMISSIONS.md`, `docs/FINDINGS.md`

- [ ] **Step 1: Update `docs/ENDPOINT_PERMISSIONS.md`** — change the `/collections` row and add rows (bump the date)

```markdown
| GET | /collections | Public | Paginated PUBLISHED list (filters: brand, category, year, q; sort: name/newest/year) |
| GET | /collections/:slug | Public | Collection detail (items by rarity, pack types) |
| GET | /brands | Public | Brand list for catalog filters |
```

- [ ] **Step 2: Append to `docs/FINDINGS.md`**

```markdown
## Catalog

- `GET /collections` returns a PAGED object `{ items, page, pageSize, total, hasMore }`
  (not a flat array). Query params: `page,limit,brand,category,year,q,sort`.
- Pack-type size labels come from the shared `packSummary(category, packModel)`
  helper (`packages/shared/src/pack-models/summary.ts`); it validates via the
  registry and returns "Unknown pack" rather than throwing on a bad packModel.
- Postgres enum order = declaration order, so `orderBy: { rarity: 'asc' }` yields
  COMMON→…→LIMITED — relied on for the detail items + rarity distribution order.
```

- [ ] **Step 3: Full gate** (infra up)

Run:

```bash
pnpm infra:up && pnpm db:deploy && pnpm db:seed
pnpm --filter @sobrebox/shared run build
pnpm lint && pnpm type-check && pnpm test:cov
pnpm test:e2e
```

Expected: lint clean, types clean, coverage ≥80% all 3 packages, e2e PASS.

- [ ] **Step 4: graphify + commit**

```bash
graphify update . || true
git add docs/ENDPOINT_PERMISSIONS.md docs/FINDINGS.md
git commit -m "docs(catalog): document catalog endpoints + gotchas"
```

---

## Self-review (against the spec)

- **§3 data model (no migration)** → Tasks 4/5 use existing fields + `_count`.
- **§4 shared contracts** → Tasks 1 (schemas/DTOs) + 2 (`packSummary`).
- **§5 API** → Task 3 (brands), 4 (findPage), 5 (findBySlug), 6 (controller + wiring), 7 (e2e).
- **§6 web** → Task 8 (api client), 9 (RarityBadge + tokens), 10 (card), 11 (filters), 12 (browser + page), 13 (detail RSC).
- **§7 testing** → folded per task + Task 7 e2e.
- **§8 docs/migration** → Task 14 + the `GET /collections` shape change handled in Tasks 6/8/12 (controller, api client, page) and the old `collection-list` deleted in Task 12.
- **Type consistency:** `CollectionsQueryDto`, `CollectionsPageDto`, `CollectionListItemDto`, `CollectionDetailDto`, `BrandDto`, `packSummary`, `CollectionsService.findPage/findBySlug`, `BrandsService.findAll`, web `fetchCollectionsPage/fetchBrands/fetchCollectionDetail`, `RarityBadge`, `CollectionCard`, `CollectionFilters`/`CatalogFilterState`, `CollectionBrowser` — each defined once, referenced by the same name.
- **No placeholders:** every code step carries real code; commands have expected output. The only intentional "coming soon" strings are the spec-mandated deferred-stat placeholders.
- **Cleanup:** old `collectionResponseSchema`/`collectionsResponseSchema` + `fetchCollections` removed once consumers migrate (Tasks 8/12); if still referenced elsewhere, leave and note.

```

```
