# Inventory + Wishlist (v1) — Design Spec

> Epic 4, slice 1. Covers US-14 (ver inventario), US-15 (gestionar ítem) and
> US-16 (wishlist), scoped to "control de colección + lo que te falta".
> **Product pivot:** openings (Epic 3) are demoted — the core primitive is now
> _"I own / I'm missing this item"_, not _"I opened a pack"_. Pull-rate
> centerpiece and the 3D opening animation are dropped from the near-term path.

**Date:** 2026-06-24
**Status:** approved (brainstorming) → pending implementation plan
**Builds on:** the merged auth slice (JWT guard + `@CurrentUser`), the catalog
browse/detail slice (`GET /collections/:slug` returns `items[]` with rarity),
and the shared-DTO + enum-parity conventions.

---

## 1. Goals & non-goals

**Goals**

- A logged-in user can mark a catalog item as owned, with quantity and
  condition; edit it; and remove it (qty→0 deletes).
- Per collection, the user sees progress: owned `X / Y`, `%` complete, and the
  derived list of what they are **missing** (collection items not in inventory).
- A logged-in user can keep an explicit **wishlist** of items they want, each
  with a priority (High/Medium/Low), an optional max price, and a public/private
  flag.
- On a collection detail page, a logged-in user sees per-item "tengo / a
  wishlist" state and can toggle it inline.

**Non-goals (deferred — do NOT build now):**

- Marketplace coupling: "para vender" / "para intercambiar" flags, estimated
  sale price, listing status on inventory items → **Epic 6**.
- Wishlist notifications ("alguien listó un ítem de tu wishlist") and matching
  against other users' inventory → **Epic 6 / 8**.
- CSV export, global paginated all-items view with advanced filters, in-inventory
  name search → polish followup.
- Private notes per inventory item → minor, deferred.
- Openings as an inventory-entry path → separate later slice (animation-free).
- Playwright (still deferred; no animation in this slice).

---

## 2. Decisions (locked in brainstorming)

| Topic                 | Decision                                                                                                                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module layout         | Two Nest modules: `inventory/` and `wishlist/` (one-module-per-domain, matches `auth`/`catalog`/`collections`).                                                                                                                              |
| "Missing" computation | Derived on read (collection items − owned); no denormalized counter table (collections are small).                                                                                                                                           |
| Catalog endpoint      | `GET /collections/:slug` stays **Public and untouched**. The detail page, when logged in, makes a second authenticated fetch (`/inventory/collections/:slug/progress` + wishlist state) and merges client-side. No auth coupling in catalog. |
| Condition             | New enum `Condition`; `UserInventory.condition` migrates `String?` → `Condition?`.                                                                                                                                                           |
| Wishlist              | New model `WishlistItem` + enum `WishlistPriority`.                                                                                                                                                                                          |
| Money over HTTP       | `maxPrice` is `Decimal?` in Prisma, serialized as **string** in DTOs (per FINDINGS).                                                                                                                                                         |
| Ownership             | Enforced by scoping every query to `CurrentUser.id`. PATCH/DELETE by `:id` return **404** if the row is not the caller's.                                                                                                                    |
| Auth                  | All inventory + wishlist endpoints require **JWT** (`JwtAuthGuard` + `@CurrentUser`).                                                                                                                                                        |

---

## 3. Schema changes (Prisma + migration)

### 3.1 New enums (duplicated Prisma ⇄ shared, guarded by `enum-parity.spec.ts`)

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

Mirror each in `packages/shared/src/enums/` (`condition.ts`,
`wishlist-priority.ts`) and add both to
`apps/api/src/catalog/enum-parity.spec.ts`.

### 3.2 `UserInventory` — change `condition` type

```prisma
// before: condition String?
condition Condition?
```

(No data migration needed: dev/seed data does not populate `condition` yet.
If any rows exist, the migration must cast/clear invalid strings — handled as a
conscious data-migration step if `prisma migrate` flags it.)

### 3.3 New model `WishlistItem`

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

Add back-relations: `wishlist WishlistItem[]` on `User`, `wishlistItems
WishlistItem[]` on `CollectionItem`.

Migration created via `pnpm db:migrate` (name e.g. `inventory_wishlist`).

---

## 4. API surface

All endpoints **JWT**, owner-scoped. Update `docs/ENDPOINT_PERMISSIONS.md` in
the same change (bump the date).

### 4.1 `inventory/` module

| Method | Path                                    | Body / Query                                    | Returns                                                                                                                |
| ------ | --------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| POST   | `/inventory`                            | `{ collectionItemId, quantity?=1, condition? }` | upserts `UserInventory` (increments `quantity` by the given amount; sets `condition` if provided) → `InventoryItemDto` |
| PATCH  | `/inventory/:id`                        | `{ quantity?≥1, condition? }`                   | owner-only; 404 if not caller's → updated `InventoryItemDto`                                                           |
| DELETE | `/inventory/:id`                        | —                                               | owner-only; 404 if not caller's → 204                                                                                  |
| GET    | `/inventory`                            | —                                               | array of `InventoryItemDto` (all my rows; item + collection summary attached)                                          |
| GET    | `/inventory/progress`                   | —                                               | array of `CollectionProgressSummaryDto` (one per collection I own ≥1 item in) — backs the `/inventory` page cards      |
| GET    | `/inventory/collections/:slug/progress` | —                                               | `CollectionProgressDto` (the full version, with the per-item `items[]` for the missing list)                           |

Notes:

- POST is **upsert + increment**: marking an already-owned item adds to its
  quantity (uses the `@@unique([userId, collectionItemId])` constraint).
- PATCH `quantity` must be ≥ 1; to remove, use DELETE (qty→0 = delete, per
  US-15, enforced at the controller/service boundary, not a magic 0 in PATCH).
- `:id` is the `UserInventory.id`. Service filters `where: { id, userId }`;
  a miss → `NotFoundException`.
- `GET /inventory/progress` returns lightweight summaries (no `items[]`); the
  `/inventory` page lists them as cards and only fetches the heavy per-`:slug`
  endpoint when a card is expanded or the user opens the collection detail.
- `GET /inventory` (flat list) backs the US-14 "vista global"; pagination,
  filters and search on it are the deferred polish followup.

### 4.2 `wishlist/` module

| Method | Path            | Body                                                                | Returns                                                         |
| ------ | --------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| POST   | `/wishlist`     | `{ collectionItemId, priority?=MEDIUM, maxPrice?, isPublic?=true }` | upserts `WishlistItem` → `WishlistItemDto`                      |
| PATCH  | `/wishlist/:id` | `{ priority?, maxPrice?, isPublic? }`                               | owner-only; 404 if not caller's                                 |
| DELETE | `/wishlist/:id` | —                                                                   | owner-only; 404 if not caller's → 204                           |
| GET    | `/wishlist`     | —                                                                   | array of `WishlistItemDto` (item + collection summary attached) |

POST upsert: a second POST for the same item updates its fields (no duplicate
rows; `@@unique([userId, collectionItemId])`).

---

## 5. Shared DTOs (`packages/shared/src`)

Each schema gets a colocated `*.spec.ts` (vitest), validating happy path + at
least one rejection.

### 5.1 `enums/condition.ts`, `enums/wishlist-priority.ts`

TS enums mirroring the Prisma enums (string-valued, same members/order).

### 5.2 `dto/inventory.dto.ts`

```ts
addInventoryItemSchema; // { collectionItemId: string; quantity?: int≥1 (default 1); condition?: Condition }
updateInventoryItemSchema; // { quantity?: int≥1; condition?: Condition } — at least one key
inventoryItemSchema; // response: { id, quantity, condition: Condition|null,
//   item: { id, name, rarity, imageUrl|null },
//   collection: { slug, name } }
collectionProgressSummarySchema; // { collection: { slug, name }, owned: int, total: int, percent: int }
collectionProgressSchema; // summary + items: [{ collectionItemId, name, rarity, ownedQuantity: int }]
```

`ownedQuantity === 0` ⇒ the item is "missing". `percent = floor(owned/total*100)`,
`0` when `total === 0`. `collectionProgressSchema` extends the summary with the
full `items[]`; `GET /inventory/progress` returns the summary array, the
per-`:slug` endpoint returns the full object.

### 5.3 `dto/wishlist.dto.ts`

```ts
addWishlistItemSchema; // { collectionItemId; priority?: WishlistPriority (default MEDIUM);
//   maxPrice?: string (decimal); isPublic?: boolean (default true) }
updateWishlistItemSchema; // { priority?; maxPrice?: string|null; isPublic? } — at least one key
wishlistItemSchema; // response: { id, priority, maxPrice: string|null, isPublic,
//   item: { id, name, rarity, imageUrl|null },
//   collection: { slug, name } }
```

`maxPrice` is a **string** end-to-end (Prisma `Decimal` serializes as string).
Validate as a non-negative decimal string in the request schema.

---

## 6. Web (`apps/web`)

Follow the authenticated-fetch + TanStack Query pattern established by the auth
/ profile slice.

- **`lib/api.ts`** — typed wrappers for the new endpoints, validating responses
  with the shared schemas; authenticated (access token attached the same way the
  profile slice does).
- **`/inventory`** (`app/inventory/page.tsx`) — per-collection progress cards
  (owned `X/Y`, `%` bar) and, per card, the list of missing items. Empty state
  when the user owns nothing.
- **`/wishlist`** (`app/wishlist/page.tsx`) — wishlist grouped/sorted by
  priority; each row shows item, priority, max price; edit/remove controls.
- **Collection detail overlay** — on `app/collections/[slug]`, when logged in,
  fetch `/inventory/collections/:slug/progress` + wishlist state and render
  per-item "tengo (qty)" and "a wishlist" toggles. Logged-out: controls hidden
  (or a "inicia sesión" hint), detail page otherwise unchanged.
- **Mutations** — optimistic toggles via TanStack `useMutation` +
  `invalidateQueries`. Components live in `components/inventory/` and
  `components/wishlist/`.

UI uses the existing design system (RarityBadge etc.). No bespoke animation in
this slice; a small "100% completed" delight is optional polish, not required.

---

## 7. Testing (TDD, coverage gate 80%)

| Layer    | Tests                                                                                                                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| shared   | `inventory.dto.spec.ts`, `wishlist.dto.spec.ts` (vitest): accept valid, reject invalid (bad condition, qty 0, negative maxPrice, empty update).                                                               |
| api unit | `inventory.service.spec.ts`, `inventory.controller.spec.ts`, `wishlist.service.spec.ts`, `wishlist.controller.spec.ts` (jest): upsert/increment, progress math (incl. `total=0`), ownership 404, qty≥1 guard. |
| api e2e  | supertest flow: login → POST inventory → GET progress (owned/missing/percent) → PATCH → DELETE → 404 on another user's row; same for wishlist.                                                                |
| parity   | `enum-parity.spec.ts` extended for `Condition` + `WishlistPriority`.                                                                                                                                          |
| web      | `components/inventory/**`, `components/wishlist/**`, `lib/api.ts` wrappers (vitest + RTL): render progress, toggle owned/wishlist, optimistic update.                                                         |

`pnpm pr-check` (lint + 80% cov across api/web/shared) must pass before PR.
Recompile shared (`pnpm build:shared`) after editing it so api/web/seed pick up
the new enums/DTOs.

---

## 8. Build order (informs the plan)

1. Schema: enums + `WishlistItem` + `UserInventory.condition` migration; update
   enum-parity. (`pnpm db:migrate`)
2. Shared: enums + DTOs (+ specs); `pnpm build:shared`.
3. api `inventory/`: service → controller → e2e (TDD red→green each).
4. api `wishlist/`: service → controller → e2e.
5. `docs/ENDPOINT_PERMISSIONS.md` updated (+ date bump).
6. web: `lib/api.ts` wrappers → `/inventory` + `/wishlist` pages → collection
   detail overlay; component tests.
7. `pnpm pr-check` green → PR.

---

## 9. Open risks

- **Migrating `condition` String?→enum:** safe only if no incompatible string
  values exist. Confirm against current DB/seed; treat any as a conscious data
  migration.
- **Detail-page double fetch:** keeps catalog decoupled but adds one authed
  request on `[slug]`. Acceptable; revisit only if it becomes a perf issue.
- **Upsert-increment semantics:** POST adds to quantity. If a "set exact
  quantity" UX is ever needed, that's PATCH — keep the two verbs distinct.
