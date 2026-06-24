# Inventory + Wishlist (v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a logged-in user mark catalog items as owned (qty + condition), see per-collection completion and the derived "missing" list, and keep an explicit wishlist (priority + max price + public flag).

**Architecture:** Two owner-scoped NestJS modules (`inventory/`, `wishlist/`) over the existing `UserInventory` table plus a new `WishlistItem` model. "Missing" is derived on read (collection items − owned), no denormalized counter. Catalog endpoints stay public and untouched; the web collection-detail page mounts a logged-in client island that fetches an authenticated progress overlay. Shared Zod DTOs cross the HTTP boundary; the web uses TanStack Query with the in-memory Zustand access token.

**Tech Stack:** NestJS 10 + Prisma 6 (CommonJS), Zod 3 in `@sobrebox/shared`, Next 16 App Router + TanStack Query v5 + Zustand, Jest/supertest (api), Vitest/RTL (web/shared).

## Global Constraints

- **Module strategy:** `@sobrebox/shared` compiles to `dist/` (CommonJS). Run `pnpm build:shared` after editing it or api/web/seed import stale code. No `.js` extensions in api/shared imports.
- **Prisma pinned to v6.** Entities live only in `apps/api/prisma/schema.prisma`. Schema changes via `pnpm db:migrate` (never hand-edit migration SQL except conscious data migrations).
- **Enums are duplicated on purpose** (Prisma layer + shared layer); `apps/api/src/catalog/enum-parity.spec.ts` fails if they diverge. Never use a bare enum string — import from `@sobrebox/shared`.
- **Prisma `Decimal` serializes as a STRING over HTTP** — model `maxPrice` as `z.string()` in DTOs, never `number`.
- **No `any`** — use `unknown` + type guards or domain types.
- **TDD required** for services/DTOs/components. **Coverage gate 80%** (statements/branches/functions/lines) across api/web/shared; `pnpm pr-check` must pass before PR.
- **Auth:** all inventory + wishlist endpoints require JWT via `JwtAuthGuard` + `@CurrentUser()` (`RequestUser = { id, email, username }`).
- **Commits:** Conventional Commits, English, scope = module. Never `git push`.

---

## File Structure

**Prisma / schema**

- Modify `apps/api/prisma/schema.prisma` — add `Condition` + `WishlistPriority` enums, `WishlistItem` model, back-relations on `User`/`CollectionItem`, change `UserInventory.condition` to `Condition?`.

**Shared (`packages/shared/src`)**

- Create `enums/condition.ts`, `enums/wishlist-priority.ts`
- Create `dto/inventory.dto.ts` (+ `dto/inventory.dto.spec.ts`)
- Create `dto/wishlist.dto.ts` (+ `dto/wishlist.dto.spec.ts`)
- Modify `index.ts` (export the new modules)

**API (`apps/api/src`)**

- Create `inventory/inventory.service.ts` (+ `.spec.ts`), `inventory/inventory.controller.ts` (+ `.spec.ts`), `inventory/inventory.module.ts`
- Create `wishlist/wishlist.service.ts` (+ `.spec.ts`), `wishlist/wishlist.controller.ts` (+ `.spec.ts`), `wishlist/wishlist.module.ts`
- Modify `app.module.ts` (register both modules), `catalog/enum-parity.spec.ts` (two new assertions)
- Create `apps/api/test/inventory.e2e-spec.ts`, `apps/api/test/wishlist.e2e-spec.ts`

**Web (`apps/web`)**

- Modify `lib/api.ts` (+ `lib/api.test.ts`) — authed wrappers
- Create `components/inventory/inventory-progress.tsx` (+ test), `components/inventory/collection-ownership-panel.tsx` (+ test)
- Create `components/wishlist/wishlist-list.tsx` (+ test)
- Create `app/inventory/page.tsx`, `app/wishlist/page.tsx`
- Modify `app/collections/[slug]/page.tsx` (mount the ownership panel)

**Docs**

- Modify `docs/ENDPOINT_PERMISSIONS.md` (new rows + date bump), `docs/FINDINGS.md` (one gotcha entry)

---

## Task 1: Schema — enums, WishlistItem model, condition migration

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Generated: `apps/api/prisma/migrations/<ts>_inventory_wishlist/migration.sql`

**Interfaces:**

- Produces: Prisma client types `Condition`, `WishlistPriority`, `WishlistItem`; `UserInventory.condition: Condition | null`; unique inputs `userId_collectionItemId` on `UserInventory` and `WishlistItem`.

- [ ] **Step 1: Add the two enums** after the existing `CollectionSource` enum in `apps/api/prisma/schema.prisma`:

```prisma
enum Condition {
  MINT
  NEAR_MINT
  GOOD
  PLAYED
  DAMAGED
}

enum WishlistPriority {
  HIGH
  MEDIUM
  LOW
}
```

- [ ] **Step 2: Change `UserInventory.condition`** from `String?` to the enum:

```prisma
// in model UserInventory
condition Condition?
```

- [ ] **Step 3: Add the `WishlistItem` model** (place near `UserInventory`):

```prisma
model WishlistItem {
  id               String           @id @default(cuid())
  userId           String
  user             User             @relation(fields: [userId], references: [id])
  collectionItemId String
  collectionItem   CollectionItem   @relation(fields: [collectionItemId], references: [id])
  priority         WishlistPriority @default(MEDIUM)
  maxPrice         Decimal?         @db.Decimal(12, 2)
  isPublic         Boolean          @default(true)
  createdAt        DateTime         @default(now())

  @@unique([userId, collectionItemId])
  @@index([userId])
}
```

- [ ] **Step 4: Add back-relations.** In `model User` add `wishlist WishlistItem[]`; in `model CollectionItem` add `wishlistItems WishlistItem[]` (next to its existing `inventory UserInventory[]`).

- [ ] **Step 5: Create + apply the migration**

Run: `pnpm db:migrate` → when prompted for a name, enter `inventory_wishlist`
Expected: migration created and applied; client regenerated. (The repo seed never sets `condition`, so the `String?`→enum change has no rows to migrate.)

- [ ] **Step 6: Sanity-check the generated client compiles**

Run: `pnpm --filter @sobrebox/api type-check`
Expected: PASS (no usages yet; this just confirms the schema is valid).

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(inventory): add Condition/WishlistPriority enums + WishlistItem model"
```

---

## Task 2: Shared enums + enum-parity assertions

**Files:**

- Create: `packages/shared/src/enums/condition.ts`, `packages/shared/src/enums/wishlist-priority.ts`
- Modify: `packages/shared/src/index.ts`, `apps/api/src/catalog/enum-parity.spec.ts`

**Interfaces:**

- Produces: `Condition`, `WishlistPriority` TS enums exported from `@sobrebox/shared`.

- [ ] **Step 1: Write the failing parity assertions.** In `apps/api/src/catalog/enum-parity.spec.ts`, extend the imports and add two `it`s:

```ts
import {
  CollectionCategory as PrismaCategory,
  CollectionSource as PrismaSource,
  CollectionStatus as PrismaStatus,
  Rarity as PrismaRarity,
  Condition as PrismaCondition,
  WishlistPriority as PrismaWishlistPriority,
} from '@prisma/client';
import {
  CollectionCategory,
  CollectionSource,
  CollectionStatus,
  Rarity,
  Condition,
  WishlistPriority,
} from '@sobrebox/shared';
```

Add inside the `describe`:

```ts
it('Condition matches', () =>
  expect(sorted(Condition)).toEqual(sorted(PrismaCondition)));
it('WishlistPriority matches', () =>
  expect(sorted(WishlistPriority)).toEqual(sorted(PrismaWishlistPriority)));
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @sobrebox/api test -- enum-parity`
Expected: FAIL — `Condition`/`WishlistPriority` are not exported from `@sobrebox/shared` yet.

- [ ] **Step 3: Create the shared enums.**

`packages/shared/src/enums/condition.ts`:

```ts
export enum Condition {
  MINT = 'MINT',
  NEAR_MINT = 'NEAR_MINT',
  GOOD = 'GOOD',
  PLAYED = 'PLAYED',
  DAMAGED = 'DAMAGED',
}
```

`packages/shared/src/enums/wishlist-priority.ts`:

```ts
export enum WishlistPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}
```

- [ ] **Step 4: Export them.** Add to `packages/shared/src/index.ts` (after the existing enum exports):

```ts
export * from './enums/condition';
export * from './enums/wishlist-priority';
```

- [ ] **Step 5: Rebuild shared + run parity**

Run: `pnpm build:shared && pnpm --filter @sobrebox/api test -- enum-parity`
Expected: PASS (all six enum assertions green).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/enums/condition.ts packages/shared/src/enums/wishlist-priority.ts packages/shared/src/index.ts apps/api/src/catalog/enum-parity.spec.ts
git commit -m "feat(shared): add Condition + WishlistPriority enums with parity guard"
```

---

## Task 3: Shared inventory DTOs

**Files:**

- Create: `packages/shared/src/dto/inventory.dto.ts`, `packages/shared/src/dto/inventory.dto.spec.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**

- Produces: `addInventoryItemSchema`/`AddInventoryItemDto`, `updateInventoryItemSchema`/`UpdateInventoryItemDto`, `inventoryItemSchema`/`InventoryItemDto`, `collectionProgressSummarySchema`/`CollectionProgressSummaryDto`, `collectionProgressSchema`/`CollectionProgressDto`.

- [ ] **Step 1: Write the failing spec** `packages/shared/src/dto/inventory.dto.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  addInventoryItemSchema,
  updateInventoryItemSchema,
  inventoryItemSchema,
  collectionProgressSchema,
} from './inventory.dto';
import { Condition } from '../enums/condition';
import { Rarity } from '../enums/rarity';

describe('addInventoryItemSchema', () => {
  it('defaults quantity to 1', () => {
    const r = addInventoryItemSchema.parse({ collectionItemId: 'ci1' });
    expect(r).toEqual({ collectionItemId: 'ci1', quantity: 1 });
  });
  it('accepts a condition', () => {
    expect(
      addInventoryItemSchema.parse({
        collectionItemId: 'ci1',
        condition: Condition.MINT,
      }).condition,
    ).toBe(Condition.MINT);
  });
  it('rejects quantity 0', () => {
    expect(
      addInventoryItemSchema.safeParse({ collectionItemId: 'ci1', quantity: 0 })
        .success,
    ).toBe(false);
  });
});

describe('updateInventoryItemSchema', () => {
  it('requires at least one field', () => {
    expect(updateInventoryItemSchema.safeParse({}).success).toBe(false);
  });
  it('accepts a quantity-only update', () => {
    expect(updateInventoryItemSchema.parse({ quantity: 3 })).toEqual({
      quantity: 3,
    });
  });
});

describe('inventoryItemSchema', () => {
  it('accepts a full row', () => {
    const row = {
      id: 'inv1',
      quantity: 2,
      condition: null,
      item: {
        id: 'ci1',
        name: 'Charizard',
        rarity: Rarity.ULTRA_RARE,
        imageUrl: null,
      },
      collection: { slug: 'obsidian-flames', name: 'Obsidian Flames' },
    };
    expect(inventoryItemSchema.parse(row)).toEqual(row);
  });
});

describe('collectionProgressSchema', () => {
  it('accepts derived progress with items', () => {
    const p = {
      collection: { slug: 's', name: 'N' },
      owned: 1,
      total: 2,
      percent: 50,
      items: [
        {
          collectionItemId: 'a',
          name: 'A',
          rarity: Rarity.COMMON,
          ownedQuantity: 1,
        },
        {
          collectionItemId: 'b',
          name: 'B',
          rarity: Rarity.RARE,
          ownedQuantity: 0,
        },
      ],
    };
    expect(collectionProgressSchema.parse(p)).toEqual(p);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @sobrebox/shared test -- inventory.dto`
Expected: FAIL — `./inventory.dto` does not exist.

- [ ] **Step 3: Create `packages/shared/src/dto/inventory.dto.ts`:**

```ts
import { z } from 'zod';
import { Condition } from '../enums/condition';
import { Rarity } from '../enums/rarity';

const itemRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  rarity: z.nativeEnum(Rarity),
  imageUrl: z.string().nullable(),
});

const collectionRefSchema = z.object({
  slug: z.string(),
  name: z.string(),
});

export const addInventoryItemSchema = z.object({
  collectionItemId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  condition: z.nativeEnum(Condition).optional(),
});
export type AddInventoryItemDto = z.infer<typeof addInventoryItemSchema>;

export const updateInventoryItemSchema = z
  .object({
    quantity: z.number().int().positive().optional(),
    condition: z.nativeEnum(Condition).nullable().optional(),
  })
  .refine((v) => v.quantity !== undefined || v.condition !== undefined, {
    message: 'At least one field is required',
  });
export type UpdateInventoryItemDto = z.infer<typeof updateInventoryItemSchema>;

export const inventoryItemSchema = z.object({
  id: z.string(),
  quantity: z.number().int(),
  condition: z.nativeEnum(Condition).nullable(),
  item: itemRefSchema,
  collection: collectionRefSchema,
});
export type InventoryItemDto = z.infer<typeof inventoryItemSchema>;

export const collectionProgressSummarySchema = z.object({
  collection: collectionRefSchema,
  owned: z.number().int(),
  total: z.number().int(),
  percent: z.number().int(),
});
export type CollectionProgressSummaryDto = z.infer<
  typeof collectionProgressSummarySchema
>;

export const collectionProgressItemSchema = z.object({
  collectionItemId: z.string(),
  name: z.string(),
  rarity: z.nativeEnum(Rarity),
  ownedQuantity: z.number().int(),
});

export const collectionProgressSchema = collectionProgressSummarySchema.extend({
  items: z.array(collectionProgressItemSchema),
});
export type CollectionProgressDto = z.infer<typeof collectionProgressSchema>;
```

- [ ] **Step 4: Export it.** Add to `packages/shared/src/index.ts`:

```ts
export * from './dto/inventory.dto';
```

- [ ] **Step 5: Rebuild shared + run the spec**

Run: `pnpm build:shared && pnpm --filter @sobrebox/shared test -- inventory.dto`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/dto/inventory.dto.ts packages/shared/src/dto/inventory.dto.spec.ts packages/shared/src/index.ts
git commit -m "feat(shared): add inventory DTOs (add/update/item/progress)"
```

---

## Task 4: Shared wishlist DTOs

**Files:**

- Create: `packages/shared/src/dto/wishlist.dto.ts`, `packages/shared/src/dto/wishlist.dto.spec.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**

- Produces: `addWishlistItemSchema`/`AddWishlistItemDto`, `updateWishlistItemSchema`/`UpdateWishlistItemDto`, `wishlistItemSchema`/`WishlistItemDto`.

- [ ] **Step 1: Write the failing spec** `packages/shared/src/dto/wishlist.dto.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  addWishlistItemSchema,
  updateWishlistItemSchema,
  wishlistItemSchema,
} from './wishlist.dto';
import { WishlistPriority } from '../enums/wishlist-priority';
import { Rarity } from '../enums/rarity';

describe('addWishlistItemSchema', () => {
  it('defaults priority to MEDIUM and isPublic to true', () => {
    expect(addWishlistItemSchema.parse({ collectionItemId: 'ci1' })).toEqual({
      collectionItemId: 'ci1',
      priority: WishlistPriority.MEDIUM,
      isPublic: true,
    });
  });
  it('accepts a decimal-string maxPrice', () => {
    expect(
      addWishlistItemSchema.parse({
        collectionItemId: 'ci1',
        maxPrice: '80.00',
      }).maxPrice,
    ).toBe('80.00');
  });
  it('rejects a non-numeric maxPrice', () => {
    expect(
      addWishlistItemSchema.safeParse({
        collectionItemId: 'ci1',
        maxPrice: 'free',
      }).success,
    ).toBe(false);
  });
});

describe('updateWishlistItemSchema', () => {
  it('requires at least one field', () => {
    expect(updateWishlistItemSchema.safeParse({}).success).toBe(false);
  });
  it('allows clearing maxPrice with null', () => {
    expect(updateWishlistItemSchema.parse({ maxPrice: null })).toEqual({
      maxPrice: null,
    });
  });
});

describe('wishlistItemSchema', () => {
  it('accepts a full row', () => {
    const row = {
      id: 'w1',
      priority: WishlistPriority.HIGH,
      maxPrice: '80.00',
      isPublic: true,
      item: {
        id: 'ci1',
        name: 'Umbreon',
        rarity: Rarity.SECRET,
        imageUrl: null,
      },
      collection: { slug: 's', name: 'N' },
    };
    expect(wishlistItemSchema.parse(row)).toEqual(row);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @sobrebox/shared test -- wishlist.dto`
Expected: FAIL — `./wishlist.dto` does not exist.

- [ ] **Step 3: Create `packages/shared/src/dto/wishlist.dto.ts`:**

```ts
import { z } from 'zod';
import { WishlistPriority } from '../enums/wishlist-priority';
import { Rarity } from '../enums/rarity';

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a non-negative decimal string');

export const addWishlistItemSchema = z.object({
  collectionItemId: z.string().min(1),
  priority: z.nativeEnum(WishlistPriority).default(WishlistPriority.MEDIUM),
  maxPrice: decimalString.optional(),
  isPublic: z.boolean().default(true),
});
export type AddWishlistItemDto = z.infer<typeof addWishlistItemSchema>;

export const updateWishlistItemSchema = z
  .object({
    priority: z.nativeEnum(WishlistPriority).optional(),
    maxPrice: decimalString.nullable().optional(),
    isPublic: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.priority !== undefined ||
      v.maxPrice !== undefined ||
      v.isPublic !== undefined,
    { message: 'At least one field is required' },
  );
export type UpdateWishlistItemDto = z.infer<typeof updateWishlistItemSchema>;

export const wishlistItemSchema = z.object({
  id: z.string(),
  priority: z.nativeEnum(WishlistPriority),
  maxPrice: z.string().nullable(),
  isPublic: z.boolean(),
  item: z.object({
    id: z.string(),
    name: z.string(),
    rarity: z.nativeEnum(Rarity),
    imageUrl: z.string().nullable(),
  }),
  collection: z.object({ slug: z.string(), name: z.string() }),
});
export type WishlistItemDto = z.infer<typeof wishlistItemSchema>;
```

- [ ] **Step 4: Export it.** Add to `packages/shared/src/index.ts`:

```ts
export * from './dto/wishlist.dto';
```

- [ ] **Step 5: Rebuild shared + run the spec**

Run: `pnpm build:shared && pnpm --filter @sobrebox/shared test -- wishlist.dto`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/dto/wishlist.dto.ts packages/shared/src/dto/wishlist.dto.spec.ts packages/shared/src/index.ts
git commit -m "feat(shared): add wishlist DTOs (add/update/item)"
```

---

## Task 5: Inventory service

**Files:**

- Create: `apps/api/src/inventory/inventory.service.ts`, `apps/api/src/inventory/inventory.service.spec.ts`

**Interfaces:**

- Consumes: `PrismaService`; shared `AddInventoryItemDto`, `UpdateInventoryItemDto`, `InventoryItemDto`, `CollectionProgressSummaryDto`, `CollectionProgressDto`.
- Produces: `InventoryService` with `add(userId, dto)`, `update(userId, id, dto)`, `remove(userId, id)`, `listMine(userId)`, `progressSummaries(userId)`, `collectionProgress(userId, slug)`.

- [ ] **Step 1: Write the failing spec** `apps/api/src/inventory/inventory.service.spec.ts`. Uses a hand-rolled Prisma mock (matches the repo's service-test style):

```ts
import { NotFoundException } from '@nestjs/common';
import { Condition } from '@sobrebox/shared';
import { InventoryService } from './inventory.service';

type AnyFn = jest.Mock;
interface PrismaMock {
  collectionItem: { findUnique: AnyFn };
  userInventory: {
    upsert: AnyFn;
    update: AnyFn;
    delete: AnyFn;
    findFirst: AnyFn;
    findMany: AnyFn;
    count: AnyFn;
  };
  collection: { findFirst: AnyFn; findMany: AnyFn };
}

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'inv1',
  quantity: 2,
  condition: null,
  collectionItem: {
    id: 'ci1',
    name: 'Charizard',
    rarity: 'ULTRA_RARE',
    imageUrl: null,
    collection: { slug: 'obsidian-flames', name: 'Obsidian Flames' },
  },
  ...over,
});

function makePrisma(): PrismaMock {
  return {
    collectionItem: { findUnique: jest.fn() },
    userInventory: {
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    collection: { findFirst: jest.fn(), findMany: jest.fn() },
  };
}

describe('InventoryService', () => {
  let prisma: PrismaMock;
  let service: InventoryService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new InventoryService(prisma as never);
  });

  describe('add', () => {
    it('404s when the catalog item does not exist', async () => {
      prisma.collectionItem.findUnique.mockResolvedValue(null);
      await expect(
        service.add('u1', { collectionItemId: 'missing', quantity: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('upserts and returns a mapped DTO', async () => {
      prisma.collectionItem.findUnique.mockResolvedValue({ id: 'ci1' });
      prisma.userInventory.upsert.mockResolvedValue(row());
      const dto = await service.add('u1', {
        collectionItemId: 'ci1',
        quantity: 2,
        condition: Condition.MINT,
      });
      expect(dto).toEqual({
        id: 'inv1',
        quantity: 2,
        condition: null,
        item: {
          id: 'ci1',
          name: 'Charizard',
          rarity: 'ULTRA_RARE',
          imageUrl: null,
        },
        collection: { slug: 'obsidian-flames', name: 'Obsidian Flames' },
      });
      expect(prisma.userInventory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_collectionItemId: { userId: 'u1', collectionItemId: 'ci1' },
          },
        }),
      );
    });
  });

  describe('update', () => {
    it('404s when the row is not the user’s', async () => {
      prisma.userInventory.findFirst.mockResolvedValue(null);
      await expect(
        service.update('u1', 'inv1', { quantity: 3 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
    it('updates an owned row', async () => {
      prisma.userInventory.findFirst.mockResolvedValue({ id: 'inv1' });
      prisma.userInventory.update.mockResolvedValue(row({ quantity: 3 }));
      const dto = await service.update('u1', 'inv1', { quantity: 3 });
      expect(dto.quantity).toBe(3);
    });
  });

  describe('remove', () => {
    it('404s when the row is not the user’s', async () => {
      prisma.userInventory.findFirst.mockResolvedValue(null);
      await expect(service.remove('u1', 'inv1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
    it('deletes an owned row', async () => {
      prisma.userInventory.findFirst.mockResolvedValue({ id: 'inv1' });
      prisma.userInventory.delete.mockResolvedValue(row());
      await service.remove('u1', 'inv1');
      expect(prisma.userInventory.delete).toHaveBeenCalledWith({
        where: { id: 'inv1' },
      });
    });
  });

  describe('collectionProgress', () => {
    it('404s on an unknown slug', async () => {
      prisma.collection.findFirst.mockResolvedValue(null);
      await expect(
        service.collectionProgress('u1', 'nope'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
    it('floors percent and marks unowned items as missing (ownedQuantity 0)', async () => {
      prisma.collection.findFirst.mockResolvedValue({
        slug: 's',
        name: 'N',
        items: [
          { id: 'a', name: 'A', rarity: 'COMMON' },
          { id: 'b', name: 'B', rarity: 'RARE' },
          { id: 'c', name: 'C', rarity: 'SECRET' },
        ],
      });
      prisma.userInventory.findMany.mockResolvedValue([
        { collectionItemId: 'a', quantity: 1 },
      ]);
      const p = await service.collectionProgress('u1', 's');
      expect(p.owned).toBe(1);
      expect(p.total).toBe(3);
      expect(p.percent).toBe(33);
      expect(
        p.items.find((i) => i.collectionItemId === 'b')?.ownedQuantity,
      ).toBe(0);
    });
  });

  describe('progressSummaries', () => {
    it('returns [] when the user owns nothing', async () => {
      prisma.userInventory.findMany.mockResolvedValue([]);
      expect(await service.progressSummaries('u1')).toEqual([]);
    });
    it('builds one summary per owned collection', async () => {
      prisma.userInventory.findMany.mockResolvedValue([
        { collectionItem: { collectionId: 'col1' } },
      ]);
      prisma.collection.findMany.mockResolvedValue([
        { id: 'col1', slug: 's', name: 'N', _count: { items: 4 } },
      ]);
      prisma.userInventory.count.mockResolvedValue(1);
      const r = await service.progressSummaries('u1');
      expect(r).toEqual([
        {
          collection: { slug: 's', name: 'N' },
          owned: 1,
          total: 4,
          percent: 25,
        },
      ]);
    });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @sobrebox/api test -- inventory.service`
Expected: FAIL — `./inventory.service` does not exist.

- [ ] **Step 3: Implement `apps/api/src/inventory/inventory.service.ts`:**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AddInventoryItemDto,
  UpdateInventoryItemDto,
  InventoryItemDto,
  inventoryItemSchema,
  CollectionProgressSummaryDto,
  collectionProgressSummarySchema,
  CollectionProgressDto,
  collectionProgressSchema,
} from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';

const INVENTORY_SELECT = {
  id: true,
  quantity: true,
  condition: true,
  collectionItem: {
    select: {
      id: true,
      name: true,
      rarity: true,
      imageUrl: true,
      collection: { select: { slug: true, name: true } },
    },
  },
} satisfies Prisma.UserInventorySelect;

type InventoryRow = Prisma.UserInventoryGetPayload<{
  select: typeof INVENTORY_SELECT;
}>;

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(row: InventoryRow): InventoryItemDto {
    return inventoryItemSchema.parse({
      id: row.id,
      quantity: row.quantity,
      condition: row.condition,
      item: {
        id: row.collectionItem.id,
        name: row.collectionItem.name,
        rarity: row.collectionItem.rarity,
        imageUrl: row.collectionItem.imageUrl,
      },
      collection: row.collectionItem.collection,
    });
  }

  async add(
    userId: string,
    dto: AddInventoryItemDto,
  ): Promise<InventoryItemDto> {
    const exists = await this.prisma.collectionItem.findUnique({
      where: { id: dto.collectionItemId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Collection item not found');

    const row = await this.prisma.userInventory.upsert({
      where: {
        userId_collectionItemId: {
          userId,
          collectionItemId: dto.collectionItemId,
        },
      },
      create: {
        userId,
        collectionItemId: dto.collectionItemId,
        quantity: dto.quantity,
        condition: dto.condition ?? null,
      },
      update: {
        quantity: { increment: dto.quantity },
        ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
      },
      select: INVENTORY_SELECT,
    });
    return this.toDto(row);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    const owned = await this.prisma.userInventory.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('Inventory item not found');

    const row = await this.prisma.userInventory.update({
      where: { id },
      data: {
        ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
        ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
      },
      select: INVENTORY_SELECT,
    });
    return this.toDto(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    const owned = await this.prisma.userInventory.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('Inventory item not found');
    await this.prisma.userInventory.delete({ where: { id } });
  }

  async listMine(userId: string): Promise<InventoryItemDto[]> {
    const rows = await this.prisma.userInventory.findMany({
      where: { userId },
      orderBy: { collectionItem: { name: 'asc' } },
      select: INVENTORY_SELECT,
    });
    return rows.map((r) => this.toDto(r));
  }

  async progressSummaries(
    userId: string,
  ): Promise<CollectionProgressSummaryDto[]> {
    const owned = await this.prisma.userInventory.findMany({
      where: { userId },
      select: { collectionItem: { select: { collectionId: true } } },
    });
    const collectionIds = [
      ...new Set(owned.map((o) => o.collectionItem.collectionId)),
    ];
    if (collectionIds.length === 0) return [];

    const collections = await this.prisma.collection.findMany({
      where: { id: { in: collectionIds } },
      select: {
        id: true,
        slug: true,
        name: true,
        _count: { select: { items: true } },
      },
    });

    return Promise.all(
      collections.map(async (c) => {
        const ownedCount = await this.prisma.userInventory.count({
          where: { userId, collectionItem: { collectionId: c.id } },
        });
        const total = c._count.items;
        return collectionProgressSummarySchema.parse({
          collection: { slug: c.slug, name: c.name },
          owned: ownedCount,
          total,
          percent: total === 0 ? 0 : Math.floor((ownedCount / total) * 100),
        });
      }),
    );
  }

  async collectionProgress(
    userId: string,
    slug: string,
  ): Promise<CollectionProgressDto> {
    const c = await this.prisma.collection.findFirst({
      where: { slug },
      select: {
        slug: true,
        name: true,
        items: {
          orderBy: [{ rarity: 'asc' }, { name: 'asc' }],
          select: { id: true, name: true, rarity: true },
        },
      },
    });
    if (!c) throw new NotFoundException('Collection not found');

    const owned = await this.prisma.userInventory.findMany({
      where: { userId, collectionItem: { collection: { slug } } },
      select: { collectionItemId: true, quantity: true },
    });
    const ownedMap = new Map(
      owned.map((o) => [o.collectionItemId, o.quantity]),
    );

    const items = c.items.map((i) => ({
      collectionItemId: i.id,
      name: i.name,
      rarity: i.rarity,
      ownedQuantity: ownedMap.get(i.id) ?? 0,
    }));
    const ownedCount = items.filter((i) => i.ownedQuantity > 0).length;
    const total = c.items.length;

    return collectionProgressSchema.parse({
      collection: { slug: c.slug, name: c.name },
      owned: ownedCount,
      total,
      percent: total === 0 ? 0 : Math.floor((ownedCount / total) * 100),
      items,
    });
  }
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `pnpm --filter @sobrebox/api test -- inventory.service`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/inventory/inventory.service.ts apps/api/src/inventory/inventory.service.spec.ts
git commit -m "feat(inventory): add InventoryService (upsert, progress, ownership 404)"
```

---

## Task 6: Inventory controller + module + wiring

**Files:**

- Create: `apps/api/src/inventory/inventory.controller.ts`, `apps/api/src/inventory/inventory.controller.spec.ts`, `apps/api/src/inventory/inventory.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**

- Consumes: `InventoryService` (Task 5), `JwtAuthGuard`, `CurrentUser`/`RequestUser`, `ZodValidationPipe`.
- Produces: routes `POST /inventory`, `GET /inventory`, `GET /inventory/progress`, `GET /inventory/collections/:slug/progress`, `PATCH /inventory/:id`, `DELETE /inventory/:id`.

- [ ] **Step 1: Write the failing controller spec** `apps/api/src/inventory/inventory.controller.spec.ts`:

```ts
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

const user = { id: 'u1', email: 'a@b.com', username: 'neo' };

describe('InventoryController', () => {
  let service: jest.Mocked<
    Pick<
      InventoryService,
      | 'add'
      | 'update'
      | 'remove'
      | 'listMine'
      | 'progressSummaries'
      | 'collectionProgress'
    >
  >;
  let controller: InventoryController;

  beforeEach(() => {
    service = {
      add: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      listMine: jest.fn(),
      progressSummaries: jest.fn(),
      collectionProgress: jest.fn(),
    };
    controller = new InventoryController(
      service as unknown as InventoryService,
    );
  });

  it('POST forwards the current user id + dto', () => {
    controller.add(user, { collectionItemId: 'ci1', quantity: 1 });
    expect(service.add).toHaveBeenCalledWith('u1', {
      collectionItemId: 'ci1',
      quantity: 1,
    });
  });

  it('GET /progress forwards the user id', () => {
    controller.progress(user);
    expect(service.progressSummaries).toHaveBeenCalledWith('u1');
  });

  it('GET collection progress forwards user id + slug', () => {
    controller.collectionProgress(user, 'obsidian-flames');
    expect(service.collectionProgress).toHaveBeenCalledWith(
      'u1',
      'obsidian-flames',
    );
  });

  it('PATCH forwards user id, id, dto', () => {
    controller.update(user, 'inv1', { quantity: 3 });
    expect(service.update).toHaveBeenCalledWith('u1', 'inv1', { quantity: 3 });
  });

  it('DELETE forwards user id + id', () => {
    controller.remove(user, 'inv1');
    expect(service.remove).toHaveBeenCalledWith('u1', 'inv1');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @sobrebox/api test -- inventory.controller`
Expected: FAIL — `./inventory.controller` does not exist.

- [ ] **Step 3: Implement `apps/api/src/inventory/inventory.controller.ts`:**

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  addInventoryItemSchema,
  AddInventoryItemDto,
  updateInventoryItemSchema,
  UpdateInventoryItemDto,
  InventoryItemDto,
  CollectionProgressSummaryDto,
  CollectionProgressDto,
} from '@sobrebox/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { InventoryService } from './inventory.service';

@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Post()
  add(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(addInventoryItemSchema))
    dto: AddInventoryItemDto,
  ): Promise<InventoryItemDto> {
    return this.inventory.add(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: RequestUser): Promise<InventoryItemDto[]> {
    return this.inventory.listMine(user.id);
  }

  @Get('progress')
  progress(
    @CurrentUser() user: RequestUser,
  ): Promise<CollectionProgressSummaryDto[]> {
    return this.inventory.progressSummaries(user.id);
  }

  @Get('collections/:slug/progress')
  collectionProgress(
    @CurrentUser() user: RequestUser,
    @Param('slug') slug: string,
  ): Promise<CollectionProgressDto> {
    return this.inventory.collectionProgress(user.id, slug);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateInventoryItemSchema))
    dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    return this.inventory.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.inventory.remove(user.id, id);
  }
}
```

- [ ] **Step 4: Create `apps/api/src/inventory/inventory.module.ts`:**

```ts
import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
```

- [ ] **Step 5: Register it in `apps/api/src/app.module.ts`** — add the import and put `InventoryModule` in the `imports` array (after `BrandsModule`).

- [ ] **Step 6: Run the controller spec + type-check**

Run: `pnpm --filter @sobrebox/api test -- inventory.controller && pnpm --filter @sobrebox/api type-check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/inventory/inventory.controller.ts apps/api/src/inventory/inventory.controller.spec.ts apps/api/src/inventory/inventory.module.ts apps/api/src/app.module.ts
git commit -m "feat(inventory): add InventoryController + module wiring"
```

---

## Task 7: Inventory e2e

**Files:**

- Create: `apps/api/test/inventory.e2e-spec.ts`

**Interfaces:**

- Consumes: a verified+logged-in user (via the auth endpoints + DB token mint, mirroring `auth.e2e-spec.ts`) and a real seeded `collectionItem` (via `GET /collections` → `GET /collections/:slug`).

- [ ] **Step 1: Write the e2e** `apps/api/test/inventory.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { sha256 } from '../src/auth/token.util';

describe('Inventory (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `inv_e2e_${Date.now()}@test.com`;
  let accessToken = '';
  let collectionItemId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    const server = app.getHttpServer();

    // 1) register → verify (mint a known token in the DB) → login
    await request(server)
      .post('/auth/register')
      .send({ email, password: 'secret12' })
      .expect(201);
    const user = await prisma.user.findUnique({ where: { email } });
    const vt = await prisma.verificationToken.findFirst({
      where: { userId: user!.id, consumedAt: null },
    });
    const known = 'inv-e2e-token';
    await prisma.verificationToken.update({
      where: { id: vt!.id },
      data: { tokenHash: sha256(known) },
    });
    await request(server)
      .post('/auth/verify')
      .send({ token: known })
      .expect(201);
    const login = await request(server)
      .post('/auth/login')
      .send({ email, password: 'secret12' })
      .expect(201);
    accessToken = login.body.accessToken as string;

    // 2) grab a real seeded collection item
    const page = await request(server).get('/collections?limit=1').expect(200);
    const slug = page.body.items[0].slug as string;
    const detail = await request(server)
      .get(`/collections/${slug}`)
      .expect(200);
    collectionItemId = detail.body.items[0].id as string;
  });

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.userInventory.deleteMany({ where: { userId: user.id } });
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.verificationToken.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/inventory').expect(401);
  });

  it('adds an item, reflects it in progress, updates and deletes it', async () => {
    const server = app.getHttpServer();

    const added = await request(server)
      .post('/inventory')
      .set(auth())
      .send({ collectionItemId, quantity: 2, condition: 'MINT' })
      .expect(201);
    expect(added.body.quantity).toBe(2);
    const invId = added.body.id as string;

    const slug = added.body.collection.slug as string;
    const progress = await request(server)
      .get(`/inventory/collections/${slug}/progress`)
      .set(auth())
      .expect(200);
    expect(progress.body.owned).toBeGreaterThanOrEqual(1);
    expect(
      progress.body.items.find(
        (i: { collectionItemId: string }) =>
          i.collectionItemId === collectionItemId,
      ).ownedQuantity,
    ).toBe(2);

    const summaries = await request(server)
      .get('/inventory/progress')
      .set(auth())
      .expect(200);
    expect(summaries.body.length).toBeGreaterThanOrEqual(1);

    await request(server)
      .patch(`/inventory/${invId}`)
      .set(auth())
      .send({ quantity: 5 })
      .expect(200);

    await request(server).delete(`/inventory/${invId}`).set(auth()).expect(204);
  });

  it('404s when patching another user’s (nonexistent) row', async () => {
    await request(app.getHttpServer())
      .patch('/inventory/does-not-exist')
      .set(auth())
      .send({ quantity: 2 })
      .expect(404);
  });
});
```

- [ ] **Step 2: Run the e2e** (requires infra up + DB seeded)

Run: `pnpm infra:up && pnpm db:deploy && pnpm db:seed && pnpm test:e2e -- inventory`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/inventory.e2e-spec.ts
git commit -m "test(inventory): e2e add/progress/update/delete + auth + 404"
```

---

## Task 8: Wishlist service

**Files:**

- Create: `apps/api/src/wishlist/wishlist.service.ts`, `apps/api/src/wishlist/wishlist.service.spec.ts`

**Interfaces:**

- Consumes: `PrismaService`; shared `AddWishlistItemDto`, `UpdateWishlistItemDto`, `WishlistItemDto`.
- Produces: `WishlistService` with `add(userId, dto)`, `update(userId, id, dto)`, `remove(userId, id)`, `listMine(userId)`.

- [ ] **Step 1: Write the failing spec** `apps/api/src/wishlist/wishlist.service.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { WishlistPriority } from '@sobrebox/shared';
import { WishlistService } from './wishlist.service';

type AnyFn = jest.Mock;
interface PrismaMock {
  collectionItem: { findUnique: AnyFn };
  wishlistItem: {
    upsert: AnyFn;
    update: AnyFn;
    delete: AnyFn;
    findFirst: AnyFn;
    findMany: AnyFn;
  };
}

// maxPrice comes back from Prisma as a Decimal-like with .toString()
const decimal = (s: string) => ({ toString: () => s });

const row = (over: Record<string, unknown> = {}) => ({
  id: 'w1',
  priority: 'HIGH',
  maxPrice: decimal('80.00'),
  isPublic: true,
  collectionItem: {
    id: 'ci1',
    name: 'Umbreon',
    rarity: 'SECRET',
    imageUrl: null,
    collection: { slug: 's', name: 'N' },
  },
  ...over,
});

function makePrisma(): PrismaMock {
  return {
    collectionItem: { findUnique: jest.fn() },
    wishlistItem: {
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };
}

describe('WishlistService', () => {
  let prisma: PrismaMock;
  let service: WishlistService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new WishlistService(prisma as never);
  });

  it('404s adding an unknown catalog item', async () => {
    prisma.collectionItem.findUnique.mockResolvedValue(null);
    await expect(
      service.add('u1', {
        collectionItemId: 'x',
        priority: WishlistPriority.MEDIUM,
        isPublic: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('upserts and serializes maxPrice as a string', async () => {
    prisma.collectionItem.findUnique.mockResolvedValue({ id: 'ci1' });
    prisma.wishlistItem.upsert.mockResolvedValue(row());
    const dto = await service.add('u1', {
      collectionItemId: 'ci1',
      priority: WishlistPriority.HIGH,
      maxPrice: '80.00',
      isPublic: true,
    });
    expect(dto.maxPrice).toBe('80.00');
    expect(dto.item.name).toBe('Umbreon');
  });

  it('404s updating a row that is not the user’s', async () => {
    prisma.wishlistItem.findFirst.mockResolvedValue(null);
    await expect(
      service.update('u1', 'w1', { priority: WishlistPriority.LOW }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps a null maxPrice to null', async () => {
    prisma.wishlistItem.findFirst.mockResolvedValue({ id: 'w1' });
    prisma.wishlistItem.update.mockResolvedValue(row({ maxPrice: null }));
    const dto = await service.update('u1', 'w1', { maxPrice: null });
    expect(dto.maxPrice).toBeNull();
  });

  it('404s deleting a row that is not the user’s', async () => {
    prisma.wishlistItem.findFirst.mockResolvedValue(null);
    await expect(service.remove('u1', 'w1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @sobrebox/api test -- wishlist.service`
Expected: FAIL — `./wishlist.service` does not exist.

- [ ] **Step 3: Implement `apps/api/src/wishlist/wishlist.service.ts`:**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AddWishlistItemDto,
  UpdateWishlistItemDto,
  WishlistItemDto,
  wishlistItemSchema,
} from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';

const WISHLIST_SELECT = {
  id: true,
  priority: true,
  maxPrice: true,
  isPublic: true,
  collectionItem: {
    select: {
      id: true,
      name: true,
      rarity: true,
      imageUrl: true,
      collection: { select: { slug: true, name: true } },
    },
  },
} satisfies Prisma.WishlistItemSelect;

type WishlistRow = Prisma.WishlistItemGetPayload<{
  select: typeof WISHLIST_SELECT;
}>;

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(row: WishlistRow): WishlistItemDto {
    return wishlistItemSchema.parse({
      id: row.id,
      priority: row.priority,
      maxPrice: row.maxPrice?.toString() ?? null,
      isPublic: row.isPublic,
      item: {
        id: row.collectionItem.id,
        name: row.collectionItem.name,
        rarity: row.collectionItem.rarity,
        imageUrl: row.collectionItem.imageUrl,
      },
      collection: row.collectionItem.collection,
    });
  }

  async add(userId: string, dto: AddWishlistItemDto): Promise<WishlistItemDto> {
    const exists = await this.prisma.collectionItem.findUnique({
      where: { id: dto.collectionItemId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Collection item not found');

    const row = await this.prisma.wishlistItem.upsert({
      where: {
        userId_collectionItemId: {
          userId,
          collectionItemId: dto.collectionItemId,
        },
      },
      create: {
        userId,
        collectionItemId: dto.collectionItemId,
        priority: dto.priority,
        maxPrice: dto.maxPrice ?? null,
        isPublic: dto.isPublic,
      },
      update: {
        priority: dto.priority,
        ...(dto.maxPrice !== undefined ? { maxPrice: dto.maxPrice } : {}),
        isPublic: dto.isPublic,
      },
      select: WISHLIST_SELECT,
    });
    return this.toDto(row);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateWishlistItemDto,
  ): Promise<WishlistItemDto> {
    const owned = await this.prisma.wishlistItem.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('Wishlist item not found');

    const row = await this.prisma.wishlistItem.update({
      where: { id },
      data: {
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.maxPrice !== undefined ? { maxPrice: dto.maxPrice } : {}),
        ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
      },
      select: WISHLIST_SELECT,
    });
    return this.toDto(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    const owned = await this.prisma.wishlistItem.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('Wishlist item not found');
    await this.prisma.wishlistItem.delete({ where: { id } });
  }

  async listMine(userId: string): Promise<WishlistItemDto[]> {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      select: WISHLIST_SELECT,
    });
    return rows.map((r) => this.toDto(r));
  }
}
```

(Note: `priority asc` sorts by Postgres enum declaration order `HIGH→MEDIUM→LOW`, same trick the catalog uses for rarity.)

- [ ] **Step 4: Run the spec to verify it passes**

Run: `pnpm --filter @sobrebox/api test -- wishlist.service`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/wishlist/wishlist.service.ts apps/api/src/wishlist/wishlist.service.spec.ts
git commit -m "feat(wishlist): add WishlistService (upsert, ownership 404, decimal->string)"
```

---

## Task 9: Wishlist controller + module + wiring

**Files:**

- Create: `apps/api/src/wishlist/wishlist.controller.ts`, `apps/api/src/wishlist/wishlist.controller.spec.ts`, `apps/api/src/wishlist/wishlist.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**

- Consumes: `WishlistService` (Task 8), `JwtAuthGuard`, `CurrentUser`/`RequestUser`, `ZodValidationPipe`.
- Produces: routes `POST /wishlist`, `GET /wishlist`, `PATCH /wishlist/:id`, `DELETE /wishlist/:id`.

- [ ] **Step 1: Write the failing controller spec** `apps/api/src/wishlist/wishlist.controller.spec.ts`:

```ts
import { WishlistPriority } from '@sobrebox/shared';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

const user = { id: 'u1', email: 'a@b.com', username: 'neo' };

describe('WishlistController', () => {
  let service: jest.Mocked<
    Pick<WishlistService, 'add' | 'update' | 'remove' | 'listMine'>
  >;
  let controller: WishlistController;

  beforeEach(() => {
    service = {
      add: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      listMine: jest.fn(),
    };
    controller = new WishlistController(service as unknown as WishlistService);
  });

  it('POST forwards user id + dto', () => {
    const dto = {
      collectionItemId: 'ci1',
      priority: WishlistPriority.MEDIUM,
      isPublic: true,
    };
    controller.add(user, dto);
    expect(service.add).toHaveBeenCalledWith('u1', dto);
  });

  it('GET forwards user id', () => {
    controller.list(user);
    expect(service.listMine).toHaveBeenCalledWith('u1');
  });

  it('PATCH forwards user id, id, dto', () => {
    controller.update(user, 'w1', { priority: WishlistPriority.LOW });
    expect(service.update).toHaveBeenCalledWith('u1', 'w1', {
      priority: WishlistPriority.LOW,
    });
  });

  it('DELETE forwards user id + id', () => {
    controller.remove(user, 'w1');
    expect(service.remove).toHaveBeenCalledWith('u1', 'w1');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @sobrebox/api test -- wishlist.controller`
Expected: FAIL — `./wishlist.controller` does not exist.

- [ ] **Step 3: Implement `apps/api/src/wishlist/wishlist.controller.ts`:**

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  addWishlistItemSchema,
  AddWishlistItemDto,
  updateWishlistItemSchema,
  UpdateWishlistItemDto,
  WishlistItemDto,
} from '@sobrebox/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { WishlistService } from './wishlist.service';

@UseGuards(JwtAuthGuard)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Post()
  add(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(addWishlistItemSchema)) dto: AddWishlistItemDto,
  ): Promise<WishlistItemDto> {
    return this.wishlist.add(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: RequestUser): Promise<WishlistItemDto[]> {
    return this.wishlist.listMine(user.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWishlistItemSchema))
    dto: UpdateWishlistItemDto,
  ): Promise<WishlistItemDto> {
    return this.wishlist.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.wishlist.remove(user.id, id);
  }
}
```

- [ ] **Step 4: Create `apps/api/src/wishlist/wishlist.module.ts`:**

```ts
import { Module } from '@nestjs/common';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

@Module({
  controllers: [WishlistController],
  providers: [WishlistService],
})
export class WishlistModule {}
```

- [ ] **Step 5: Register it in `apps/api/src/app.module.ts`** — add the import and `WishlistModule` to `imports` (after `InventoryModule`).

- [ ] **Step 6: Run the controller spec + type-check**

Run: `pnpm --filter @sobrebox/api test -- wishlist.controller && pnpm --filter @sobrebox/api type-check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/wishlist/wishlist.controller.ts apps/api/src/wishlist/wishlist.controller.spec.ts apps/api/src/wishlist/wishlist.module.ts apps/api/src/app.module.ts
git commit -m "feat(wishlist): add WishlistController + module wiring"
```

---

## Task 10: Wishlist e2e

**Files:**

- Create: `apps/api/test/wishlist.e2e-spec.ts`

- [ ] **Step 1: Write the e2e** `apps/api/test/wishlist.e2e-spec.ts` (same auth+item bootstrap as Task 7):

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { sha256 } from '../src/auth/token.util';

describe('Wishlist (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `wish_e2e_${Date.now()}@test.com`;
  let accessToken = '';
  let collectionItemId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    const server = app.getHttpServer();

    await request(server)
      .post('/auth/register')
      .send({ email, password: 'secret12' })
      .expect(201);
    const user = await prisma.user.findUnique({ where: { email } });
    const vt = await prisma.verificationToken.findFirst({
      where: { userId: user!.id, consumedAt: null },
    });
    const known = 'wish-e2e-token';
    await prisma.verificationToken.update({
      where: { id: vt!.id },
      data: { tokenHash: sha256(known) },
    });
    await request(server)
      .post('/auth/verify')
      .send({ token: known })
      .expect(201);
    const login = await request(server)
      .post('/auth/login')
      .send({ email, password: 'secret12' })
      .expect(201);
    accessToken = login.body.accessToken as string;

    const page = await request(server).get('/collections?limit=1').expect(200);
    const slug = page.body.items[0].slug as string;
    const detail = await request(server)
      .get(`/collections/${slug}`)
      .expect(200);
    collectionItemId = detail.body.items[0].id as string;
  });

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.wishlistItem.deleteMany({ where: { userId: user.id } });
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.verificationToken.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/wishlist').expect(401);
  });

  it('adds, lists, updates and deletes a wishlist item', async () => {
    const server = app.getHttpServer();

    const added = await request(server)
      .post('/wishlist')
      .set(auth())
      .send({ collectionItemId, priority: 'HIGH', maxPrice: '80.00' })
      .expect(201);
    expect(added.body.maxPrice).toBe('80.00');
    const id = added.body.id as string;

    const list = await request(server).get('/wishlist').set(auth()).expect(200);
    expect(list.body.some((w: { id: string }) => w.id === id)).toBe(true);

    await request(server)
      .patch(`/wishlist/${id}`)
      .set(auth())
      .send({ maxPrice: null })
      .expect(200);

    await request(server).delete(`/wishlist/${id}`).set(auth()).expect(204);
  });

  it('404s patching a nonexistent row', async () => {
    await request(app.getHttpServer())
      .patch('/wishlist/nope')
      .set(auth())
      .send({ priority: 'LOW' })
      .expect(404);
  });
});
```

- [ ] **Step 2: Run the e2e**

Run: `pnpm test:e2e -- wishlist`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/wishlist.e2e-spec.ts
git commit -m "test(wishlist): e2e add/list/update/delete + auth + 404"
```

---

## Task 11: Update permissions + findings docs

**Files:**

- Modify: `docs/ENDPOINT_PERMISSIONS.md`, `docs/FINDINGS.md`

- [ ] **Step 1: Add the new rows** to the table in `docs/ENDPOINT_PERMISSIONS.md` and bump the "Última generación" date to `2026-06-24`:

```markdown
| POST | /inventory | JWT | add/increment owned item (collectionItemId, quantity?, condition?) |
| GET | /inventory | JWT | my inventory rows |
| GET | /inventory/progress | JWT | per-collection completion summaries (cards) |
| GET | /inventory/collections/:slug/progress | JWT | full progress + derived missing list |
| PATCH | /inventory/:id | JWT | owner-only; 404 if not yours |
| DELETE | /inventory/:id | JWT | owner-only; 404 if not yours |
| POST | /wishlist | JWT | add/replace wishlist item |
| GET | /wishlist | JWT | my wishlist (priority order) |
| PATCH | /wishlist/:id | JWT | owner-only; 404 if not yours |
| DELETE | /wishlist/:id | JWT | owner-only; 404 if not yours |
```

- [ ] **Step 2: Add a Findings entry** under a new `## Inventory / Wishlist` section in `docs/FINDINGS.md`:

```markdown
## Inventory / Wishlist

- `UserInventory.condition` and `WishlistItem` migrated `condition` from `String?`
  to the `Condition` enum; the repo seed never set it, so no data migration was
  needed. New enums `Condition` + `WishlistPriority` are parity-guarded.
- `WishlistItem.maxPrice` is `Decimal(12,2)` → serializes as a **string** over HTTP
  (DTO `z.string()`), same as `officialPullRate`/`price`.
- "Lo que falta" is **derived on read** (collection items − owned), no counter table.
  `GET /inventory/progress` returns light summaries; `/inventory/collections/:slug/progress`
  returns the full per-item list. Catalog endpoints stay public/untouched.
- `priority asc` / `rarity asc` rely on Postgres enum **declaration order**
  (HIGH→LOW, COMMON→LIMITED).
```

- [ ] **Step 3: Commit**

```bash
git add docs/ENDPOINT_PERMISSIONS.md docs/FINDINGS.md
git commit -m "docs(inventory): document inventory + wishlist endpoints and gotchas"
```

---

## Task 12: Web API wrappers

**Files:**

- Modify: `apps/web/lib/api.ts`, `apps/web/lib/api.test.ts`

**Interfaces:**

- Consumes: shared DTO schemas + types; the in-memory access token (passed in by callers, mirroring `fetchMe`).
- Produces: `fetchMyInventory`, `fetchInventoryProgress`, `fetchCollectionProgress`, `addInventoryItem`, `updateInventoryItem`, `deleteInventoryItem`, `fetchWishlist`, `addWishlistItem`, `updateWishlistItem`, `deleteWishlistItem`.

- [ ] **Step 1: Write failing tests** — append to `apps/web/lib/api.test.ts`:

```ts
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  fetchInventoryProgress,
  addInventoryItem,
  deleteInventoryItem,
  fetchWishlist,
} from './api';

afterEach(() => vi.restoreAllMocks());

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

describe('inventory/wishlist api wrappers', () => {
  it('fetchInventoryProgress validates the response', async () => {
    mockFetch(200, [
      { collection: { slug: 's', name: 'N' }, owned: 1, total: 2, percent: 50 },
    ]);
    const r = await fetchInventoryProgress('tok');
    expect(r[0].percent).toBe(50);
  });

  it('addInventoryItem sends a Bearer token', async () => {
    const spy = mockFetch(201, {
      id: 'inv1',
      quantity: 1,
      condition: null,
      item: { id: 'ci1', name: 'A', rarity: 'COMMON', imageUrl: null },
      collection: { slug: 's', name: 'N' },
    });
    await addInventoryItem({ collectionItemId: 'ci1', quantity: 1 }, 'tok');
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/inventory'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      }),
    );
  });

  it('deleteInventoryItem tolerates a 204', async () => {
    mockFetch(204, null);
    await expect(deleteInventoryItem('inv1', 'tok')).resolves.toBeUndefined();
  });

  it('fetchWishlist throws on a non-ok response', async () => {
    mockFetch(401, { message: 'nope' });
    await expect(fetchWishlist('tok')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @sobrebox/web test -- api.test`
Expected: FAIL — the new wrappers are not exported.

- [ ] **Step 3: Add the wrappers** to `apps/web/lib/api.ts`. First add imports at the top alongside the existing shared imports:

```ts
import type {
  AddInventoryItemDto,
  UpdateInventoryItemDto,
  InventoryItemDto,
  CollectionProgressSummaryDto,
  CollectionProgressDto,
  AddWishlistItemDto,
  UpdateWishlistItemDto,
  WishlistItemDto,
} from '@sobrebox/shared';
import {
  inventoryItemSchema,
  collectionProgressSummarySchema,
  collectionProgressSchema,
  wishlistItemSchema,
} from '@sobrebox/shared';
import { z } from 'zod';
```

Then add an authed helper + the wrappers at the bottom of the file:

```ts
async function authedJson<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(data?.message ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// --- inventory ---
export async function fetchMyInventory(
  accessToken: string,
): Promise<InventoryItemDto[]> {
  return z
    .array(inventoryItemSchema)
    .parse(await authedJson('/inventory', accessToken));
}

export async function fetchInventoryProgress(
  accessToken: string,
): Promise<CollectionProgressSummaryDto[]> {
  return z
    .array(collectionProgressSummarySchema)
    .parse(await authedJson('/inventory/progress', accessToken));
}

export async function fetchCollectionProgress(
  slug: string,
  accessToken: string,
): Promise<CollectionProgressDto> {
  return collectionProgressSchema.parse(
    await authedJson(`/inventory/collections/${slug}/progress`, accessToken),
  );
}

export async function addInventoryItem(
  dto: AddInventoryItemDto,
  accessToken: string,
): Promise<InventoryItemDto> {
  return inventoryItemSchema.parse(
    await authedJson('/inventory', accessToken, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  );
}

export async function updateInventoryItem(
  id: string,
  dto: UpdateInventoryItemDto,
  accessToken: string,
): Promise<InventoryItemDto> {
  return inventoryItemSchema.parse(
    await authedJson(`/inventory/${id}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
  );
}

export async function deleteInventoryItem(
  id: string,
  accessToken: string,
): Promise<void> {
  await authedJson(`/inventory/${id}`, accessToken, { method: 'DELETE' });
}

// --- wishlist ---
export async function fetchWishlist(
  accessToken: string,
): Promise<WishlistItemDto[]> {
  return z
    .array(wishlistItemSchema)
    .parse(await authedJson('/wishlist', accessToken));
}

export async function addWishlistItem(
  dto: AddWishlistItemDto,
  accessToken: string,
): Promise<WishlistItemDto> {
  return wishlistItemSchema.parse(
    await authedJson('/wishlist', accessToken, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  );
}

export async function updateWishlistItem(
  id: string,
  dto: UpdateWishlistItemDto,
  accessToken: string,
): Promise<WishlistItemDto> {
  return wishlistItemSchema.parse(
    await authedJson(`/wishlist/${id}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
  );
}

export async function deleteWishlistItem(
  id: string,
  accessToken: string,
): Promise<void> {
  await authedJson(`/wishlist/${id}`, accessToken, { method: 'DELETE' });
}
```

- [ ] **Step 4: Run the tests + type-check**

Run: `pnpm --filter @sobrebox/web test -- api.test && pnpm --filter @sobrebox/web type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/api.ts apps/web/lib/api.test.ts
git commit -m "feat(web): add authed inventory + wishlist api wrappers"
```

---

## Task 13: Inventory progress UI + page

**Files:**

- Create: `apps/web/components/inventory/inventory-progress.tsx`, `apps/web/components/inventory/inventory-progress.test.tsx`, `apps/web/app/inventory/page.tsx`

**Interfaces:**

- Consumes: `fetchInventoryProgress` (Task 12), `useAuthStore` (`accessToken`), `CollectionProgressSummaryDto`.
- Produces: `InventoryProgress` client component listing per-collection completion cards.

- [ ] **Step 1: Write the failing component test** `apps/web/components/inventory/inventory-progress.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InventoryProgress } from './inventory-progress';
import { useAuthStore } from '@/lib/auth-store';
import * as api from '@/lib/api';

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe('InventoryProgress', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'u1',
        email: 'a@b',
        username: 'neo',
        emailVerified: true,
        avatarUrl: null,
      },
    });
  });

  it('renders a card per collection with the percent', async () => {
    vi.spyOn(api, 'fetchInventoryProgress').mockResolvedValue([
      {
        collection: { slug: 's', name: 'Obsidian Flames' },
        owned: 12,
        total: 50,
        percent: 24,
      },
    ]);
    wrap(<InventoryProgress />);
    await waitFor(() =>
      expect(screen.getByText('Obsidian Flames')).toBeInTheDocument(),
    );
    expect(screen.getByText(/12\s*\/\s*50/)).toBeInTheDocument();
    expect(screen.getByText(/24%/)).toBeInTheDocument();
  });

  it('shows an empty state when nothing is owned', async () => {
    vi.spyOn(api, 'fetchInventoryProgress').mockResolvedValue([]);
    wrap(<InventoryProgress />);
    await waitFor(() =>
      expect(screen.getByText(/todav[íi]a no tienes/i)).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @sobrebox/web test -- inventory-progress`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement `apps/web/components/inventory/inventory-progress.tsx`:**

```tsx
'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchInventoryProgress } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export function InventoryProgress() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', 'progress'],
    queryFn: () => fetchInventoryProgress(accessToken as string),
    enabled: !!accessToken,
  });

  if (!accessToken) return <p>Inicia sesión para ver tu inventario.</p>;
  if (isLoading) return <p>Cargando…</p>;
  if (!data || data.length === 0) {
    return (
      <p className="text-muted-foreground">
        Todavía no tienes ítems. Marca lo que tienes desde una colección.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {data.map((p) => (
        <li
          key={p.collection.slug}
          className="rounded-lg border p-4"
          data-testid="progress-card"
        >
          <Link
            href={`/collections/${p.collection.slug}`}
            className="font-medium hover:underline"
          >
            {p.collection.name}
          </Link>
          <p className="text-sm text-muted-foreground">
            {p.owned} / {p.total} · {p.percent}%
          </p>
          <div className="mt-2 h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${p.percent}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Create the page `apps/web/app/inventory/page.tsx`:**

```tsx
import { InventoryProgress } from '@/components/inventory/inventory-progress';

export default function InventoryPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Mi inventario</h1>
      <InventoryProgress />
    </main>
  );
}
```

- [ ] **Step 5: Run the component test + type-check**

Run: `pnpm --filter @sobrebox/web test -- inventory-progress && pnpm --filter @sobrebox/web type-check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/inventory/inventory-progress.tsx apps/web/components/inventory/inventory-progress.test.tsx apps/web/app/inventory/page.tsx
git commit -m "feat(web): inventory progress cards + /inventory page"
```

---

## Task 14: Collection-detail ownership panel

**Files:**

- Create: `apps/web/components/inventory/collection-ownership-panel.tsx`, `apps/web/components/inventory/collection-ownership-panel.test.tsx`
- Modify: `apps/web/app/collections/[slug]/page.tsx`

**Interfaces:**

- Consumes: `fetchCollectionProgress`, `addInventoryItem`, `addWishlistItem` (Task 12), `useAuthStore`. Props: `{ slug: string }`.
- Produces: `CollectionOwnershipPanel` — a logged-in island showing per-item "tengo / a wishlist" controls and live owned/missing counts.

- [ ] **Step 1: Write the failing test** `apps/web/components/inventory/collection-ownership-panel.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CollectionOwnershipPanel } from './collection-ownership-panel';
import { useAuthStore } from '@/lib/auth-store';
import * as api from '@/lib/api';

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const progress = {
  collection: { slug: 's', name: 'N' },
  owned: 1,
  total: 2,
  percent: 50,
  items: [
    { collectionItemId: 'a', name: 'A', rarity: 'COMMON', ownedQuantity: 1 },
    { collectionItemId: 'b', name: 'B', rarity: 'RARE', ownedQuantity: 0 },
  ],
};

describe('CollectionOwnershipPanel', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, user: null });
  });

  it('renders nothing when logged out', () => {
    const { container } = wrap(<CollectionOwnershipPanel slug="s" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows owned/missing per item when logged in', async () => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'u1',
        email: 'a@b',
        username: 'neo',
        emailVerified: true,
        avatarUrl: null,
      },
    });
    vi.spyOn(api, 'fetchCollectionProgress').mockResolvedValue(progress);
    wrap(<CollectionOwnershipPanel slug="s" />);
    await waitFor(() => expect(screen.getByText('A')).toBeInTheDocument());
    expect(screen.getByText(/1\s*\/\s*2/)).toBeInTheDocument();
    // missing item 'b' shows an "add" affordance
    expect(
      screen.getByRole('button', { name: /tengo.*B/i }),
    ).toBeInTheDocument();
  });

  it('calls addInventoryItem when marking a missing item as owned', async () => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'u1',
        email: 'a@b',
        username: 'neo',
        emailVerified: true,
        avatarUrl: null,
      },
    });
    vi.spyOn(api, 'fetchCollectionProgress').mockResolvedValue(progress);
    const add = vi.spyOn(api, 'addInventoryItem').mockResolvedValue({
      id: 'inv1',
      quantity: 1,
      condition: null,
      item: { id: 'b', name: 'B', rarity: 'RARE', imageUrl: null },
      collection: { slug: 's', name: 'N' },
    });
    wrap(<CollectionOwnershipPanel slug="s" />);
    await waitFor(() => screen.getByText('B'));
    fireEvent.click(screen.getByRole('button', { name: /tengo.*B/i }));
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith(
        { collectionItemId: 'b', quantity: 1 },
        'tok',
      ),
    );
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @sobrebox/web test -- collection-ownership-panel`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement `apps/web/components/inventory/collection-ownership-panel.tsx`:**

```tsx
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addInventoryItem,
  addWishlistItem,
  fetchCollectionProgress,
} from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export function CollectionOwnershipPanel({ slug }: { slug: string }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['inventory', 'progress', slug],
    queryFn: () => fetchCollectionProgress(slug, accessToken as string),
    enabled: !!accessToken,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ['inventory', 'progress', slug],
    });

  const markOwned = useMutation({
    mutationFn: (collectionItemId: string) =>
      addInventoryItem(
        { collectionItemId, quantity: 1 },
        accessToken as string,
      ),
    onSuccess: invalidate,
  });

  const wantIt = useMutation({
    mutationFn: (collectionItemId: string) =>
      addWishlistItem({ collectionItemId }, accessToken as string),
  });

  if (!accessToken) return null;
  if (!data) return null;

  return (
    <section className="mt-8 rounded-lg border p-4">
      <h2 className="mb-1 text-lg font-semibold">Tu progreso</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {data.owned} / {data.total} · {data.percent}%
      </p>
      <ul className="space-y-2">
        {data.items.map((it) => (
          <li
            key={it.collectionItemId}
            className="flex items-center justify-between gap-2"
          >
            <span
              className={
                it.ownedQuantity > 0 ? 'font-medium' : 'text-muted-foreground'
              }
            >
              {it.name}
              {it.ownedQuantity > 0 ? ` ×${it.ownedQuantity}` : ' (te falta)'}
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={() => markOwned.mutate(it.collectionItemId)}
              >
                {it.ownedQuantity > 0 ? `+1 ${it.name}` : `Tengo ${it.name}`}
              </button>
              {it.ownedQuantity === 0 && (
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => wantIt.mutate(it.collectionItemId)}
                >
                  Wishlist
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Mount it on the detail page.** In `apps/web/app/collections/[slug]/page.tsx`, import the panel and render it after the existing item list, passing the slug:

```tsx
import { CollectionOwnershipPanel } from '@/components/inventory/collection-ownership-panel';
// …inside the returned JSX, after the items section:
<CollectionOwnershipPanel slug={collection.slug} />;
```

(Use whatever the detail variable is named in that file — it holds the `CollectionDetailDto`; pass its `.slug`.)

- [ ] **Step 5: Run the test + type-check**

Run: `pnpm --filter @sobrebox/web test -- collection-ownership-panel && pnpm --filter @sobrebox/web type-check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/inventory/collection-ownership-panel.tsx apps/web/components/inventory/collection-ownership-panel.test.tsx apps/web/app/collections/[slug]/page.tsx
git commit -m "feat(web): collection-detail ownership + wishlist panel"
```

---

## Task 15: Wishlist UI + page

**Files:**

- Create: `apps/web/components/wishlist/wishlist-list.tsx`, `apps/web/components/wishlist/wishlist-list.test.tsx`, `apps/web/app/wishlist/page.tsx`

**Interfaces:**

- Consumes: `fetchWishlist`, `deleteWishlistItem` (Task 12), `useAuthStore`.
- Produces: `WishlistList` client component grouped by priority with a remove action.

- [ ] **Step 1: Write the failing test** `apps/web/components/wishlist/wishlist-list.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WishlistList } from './wishlist-list';
import { useAuthStore } from '@/lib/auth-store';
import * as api from '@/lib/api';

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const items = [
  {
    id: 'w1',
    priority: 'HIGH',
    maxPrice: '80.00',
    isPublic: true,
    item: { id: 'ci1', name: 'Umbreon', rarity: 'SECRET', imageUrl: null },
    collection: { slug: 's', name: 'N' },
  },
];

describe('WishlistList', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: {
        id: 'u1',
        email: 'a@b',
        username: 'neo',
        emailVerified: true,
        avatarUrl: null,
      },
    });
  });

  it('renders wishlist rows with the max price', async () => {
    vi.spyOn(api, 'fetchWishlist').mockResolvedValue(items);
    wrap(<WishlistList />);
    await waitFor(() =>
      expect(screen.getByText('Umbreon')).toBeInTheDocument(),
    );
    expect(screen.getByText(/80\.00/)).toBeInTheDocument();
  });

  it('removes an item', async () => {
    vi.spyOn(api, 'fetchWishlist').mockResolvedValue(items);
    const del = vi.spyOn(api, 'deleteWishlistItem').mockResolvedValue();
    wrap(<WishlistList />);
    await waitFor(() => screen.getByText('Umbreon'));
    fireEvent.click(screen.getByRole('button', { name: /quitar/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('w1', 'tok'));
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @sobrebox/web test -- wishlist-list`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement `apps/web/components/wishlist/wishlist-list.tsx`:**

```tsx
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteWishlistItem, fetchWishlist } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export function WishlistList() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => fetchWishlist(accessToken as string),
    enabled: !!accessToken,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteWishlistItem(id, accessToken as string),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
  });

  if (!accessToken) return <p>Inicia sesión para ver tu wishlist.</p>;
  if (isLoading) return <p>Cargando…</p>;
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground">Tu wishlist está vacía.</p>;
  }

  return (
    <ul className="space-y-2">
      {data.map((w) => (
        <li
          key={w.id}
          className="flex items-center justify-between gap-2 rounded border p-3"
        >
          <span>
            <span className="font-medium">{w.item.name}</span>{' '}
            <span className="text-xs text-muted-foreground">
              {w.priority}
              {w.maxPrice ? ` · máx ${w.maxPrice}€` : ''}
            </span>
          </span>
          <button
            type="button"
            className="rounded border px-2 py-1 text-xs"
            onClick={() => remove.mutate(w.id)}
          >
            Quitar
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Create the page `apps/web/app/wishlist/page.tsx`:**

```tsx
import { WishlistList } from '@/components/wishlist/wishlist-list';

export default function WishlistPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Mi wishlist</h1>
      <WishlistList />
    </main>
  );
}
```

- [ ] **Step 5: Run the test + type-check**

Run: `pnpm --filter @sobrebox/web test -- wishlist-list && pnpm --filter @sobrebox/web type-check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/wishlist/wishlist-list.tsx apps/web/components/wishlist/wishlist-list.test.tsx apps/web/app/wishlist/page.tsx
git commit -m "feat(web): wishlist list + /wishlist page"
```

---

## Task 16: Full gate + PR

**Files:** none (verification only)

- [ ] **Step 1: Rebuild shared and run the whole gate**

Run: `pnpm build:shared && pnpm pr-check`
Expected: lint clean + 80% coverage across api/web/shared, all green. If coverage dips below 80% on a new file, add the missing-branch test (e.g. the `total === 0` percent path, the logged-out component branches) — do NOT lower the threshold.

- [ ] **Step 2: Run the e2e suite once more with infra up**

Run: `pnpm test:e2e`
Expected: auth + collections + inventory + wishlist e2e all PASS.

- [ ] **Step 3: Open the PR** (branch `feat/inventory-wishlist`; do not push — the developer pushes)

```bash
gh pr create --title "feat: inventory + wishlist (Epic 4 slice 1)" --body "Implements US-14/15/16 core: own/missing per collection + wishlist. Spec: docs/superpowers/specs/2026-06-24-inventory-wishlist-design.md"
```

---

## Self-Review notes (already reconciled)

- **Spec coverage:** schema (Task 1) ✓; enums+parity (Task 2) ✓; inventory DTOs (Task 3) ✓; wishlist DTOs (Task 4) ✓; inventory service/controller/e2e (Tasks 5–7) ✓; wishlist service/controller/e2e (Tasks 8–10) ✓; docs (Task 11) ✓; web wrappers+pages+overlay (Tasks 12–15) ✓; gate (Task 16) ✓. Deferred items stay deferred.
- **Type consistency:** `INVENTORY_SELECT`/`WISHLIST_SELECT`, `toDto`, `userId_collectionItemId` unique input, and the shared schema names (`collectionProgressSummarySchema` vs `collectionProgressSchema`) are used identically across service, controller, and web wrappers.
- **No placeholders:** every code step carries full code; e2e bootstraps a real verified user + real seeded item.
