# Catalog Browse + Detail (v1) — Design Spec

> Epic 2, slice 1. Covers US-05 (explorar catálogo) and US-06 (detalle de
> colección), scoped to data that exists today. **Out of scope (deferred):**
> anything that needs Openings (Epic 3), UserInventory (Epic 4) or Stats
> (Epic 5) — nº aperturas, nº coleccionistas, % completado, empirical pull
> rate, popularity sort, "ítems más difíciles", and URL-synced filters.

**Date:** 2026-06-22
**Status:** approved (brainstorming) → pending implementation plan
**Builds on:** the foundation `GET /collections` read slice, the merged auth
slice, and the shadcn/system-theme UI pass.

---

## 1. Goals & non-goals

**Goals**

- A visitor can browse the published catalog: filter by brand, category, year
  and name search; sort by name / newest / year; toggle grid vs list; load more
  via infinite scroll.
- A visitor can open a collection detail page: header + verified/community badge
  - author, rarity distribution, items grouped by rarity (with official pull
    rate when present), and pack types with a size summary.
- The rarity colour system (design-system.md signature) debuts here via a
  `RarityBadge`.

**Non-goals (deferred — shown as honest "Próximamente"/"—" placeholders, not
built):** opening counts, collector counts, % completion, empirical pull rate,
popularity sort, hardest-to-pull items, URL-synced filter state, schema indexes.

---

## 2. Decisions (locked in brainstorming)

| Topic             | Decision                                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Scope             | Browse + detail v1 on current data; deferred stats are visible placeholders.                                                      |
| Pagination        | Offset (`page`/`limit`=20); web infinite scroll via TanStack `useInfiniteQuery` + IntersectionObserver.                           |
| Filters           | brand, category, year, name search (`q`, ILIKE).                                                                                  |
| Sort              | `name` (A-Z), `newest` (createdAt desc), `year` (releaseYear desc).                                                               |
| Detail            | items by rarity, official pull rate, pack types (with summary), header + verified/community badge + author + rarity distribution. |
| Deferred stats UI | Honest placeholder ("Próximamente"/"—"), not omitted.                                                                             |

---

## 3. Data model

No migration. All fields exist: `Collection.{slug,name,brand,category,status,
source,releaseYear,coverImageUrl,createdBy,createdAt}`, `CollectionItem.{name,
rarity,imageUrl,officialPullRate}`, `PackType.{name,price,packModel}`, `Brand.
{slug,name}`. Counts via Prisma `_count`. New DB indexes are deferred (tiny
data); note for when the catalog grows (`releaseYear`, a name/trigram index for
`q`).

Only `status = PUBLISHED` collections are exposed (same rule as today).

---

## 4. Shared contracts (`packages/shared`, rebuild `dist`)

`schemas/collection-query.schema.ts`:

```ts
collectionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  brand: z.string().optional(), // brand slug
  category: z.nativeEnum(CollectionCategory).optional(),
  year: z.coerce.number().int().optional(),
  q: z.string().trim().min(1).optional(),
  sort: z.enum(['name', 'newest', 'year']).default('newest'),
});
```

`dto/collection.dto.ts` (extend the existing file):

- `collectionListItemSchema` = `{ id, slug, name, category, source, releaseYear: number|null, coverImageUrl: string|null, brand: { slug, name }, itemCount: number }`.
- `collectionsPageSchema` = `{ items: collectionListItemSchema[], page, pageSize, total, hasMore: boolean }`.
- `collectionItemSchema` = `{ id, name, rarity: nativeEnum(Rarity), imageUrl: string|null, officialPullRate: string|null }` (Decimal serializes to STRING — FINDINGS rule).
- `packTypeSummarySchema` = `{ id, name, price: string|null, summary: string }`.
- `rarityCountSchema` = `{ rarity: nativeEnum(Rarity), count: number }`.
- `collectionDetailSchema` = `{ id, slug, name, category, source, status, releaseYear, coverImageUrl, brand, createdBy: { username }|null, rarityDistribution: rarityCountSchema[], items: collectionItemSchema[], packTypes: packTypeSummarySchema[] }`.

`dto/brand.dto.ts`: `brandSchema = { slug, name }`, `brandsResponseSchema = brandSchema[]`.

Keep the old `collectionResponseSchema` only if still referenced; otherwise
remove it and update consumers. Export all from `index.ts`; rebuild dist.

**Pack `summary` derivation** lives in a shared helper
`pack-models/summary.ts` (`packSummary(category, packModel): string`) reusing the
existing pack-model registry: TCG → `${sum of slot counts} cards`; BLIND_BOX →
`case of ${caseSize}`; FIGURE → `${items.length} figure(s)`. Server computes it
so the DTO stays flat.

---

## 5. API (`apps/api`)

### collections

- `collections.service.findPage(query: CollectionsQueryDto): Promise<CollectionsPageDto>` — builds a Prisma `where` (status PUBLISHED + optional brand.slug / category / releaseYear / name ILIKE via `contains` mode insensitive), `orderBy` from sort, `skip/take` from page/limit, `select` brand{slug,name} + `_count.items`, plus a `count` for `total`. Maps rows → `collectionListItemSchema.parse`.
- `collections.service.findBySlug(slug): Promise<CollectionDetailDto>` — fetch PUBLISHED collection by slug with brand, createdBy{username}, items (orderBy rarity then name), packTypes; `NotFoundException` if missing. Compute `rarityDistribution` (count per rarity from items) and pack `summary` (shared helper, validating packModel by category). Parse → `collectionDetailSchema`.
- `collections.controller`:
  - `GET /collections` — `@Query(new ZodValidationPipe(collectionsQuerySchema))` → `findPage`. (Replaces the flat-array shape.)
  - `GET /collections/:slug` → `findBySlug`.

### brands (new module)

- `brands.service.findAll(): Promise<BrandDto[]>` — all brands (slug,name) ordered by name. (Brands list is small and public.)
- `brands.controller`: `GET /brands`.
- `BrandsModule` registered in `AppModule`.

All endpoints **Public**. Update `docs/ENDPOINT_PERMISSIONS.md`.

> Official pull rate is a stored field read here; empirical pull rate (computed)
> remains in `stats/` per the project rule.

---

## 6. Web (`apps/web`)

### Browse — `/collections`

- `app/collections/page.tsx` → thin shell rendering `<CollectionBrowser />`.
- `components/collections/collection-browser.tsx` (`'use client'`): holds filter
  - sort + view(grid|list) state (local for v1); `useInfiniteQuery` over
    `fetchCollectionsPage` keyed by the query; `getNextPageParam` from `hasMore`;
    an IntersectionObserver sentinel calls `fetchNextPage`. Renders
    `CollectionFilters`, a sort `Select`, a grid/list toggle, the results, loading
    skeletons, an empty state, and an error state.
- `components/collections/collection-filters.tsx`: brand `Select` (from
  `fetchBrands`), category `Select`, year input, debounced `q` search. On mobile,
  rendered inside a shadcn `Sheet`.
- `components/collections/collection-card.tsx`: cover image (or placeholder),
  name, brand, category badge, itemCount, verified/community badge; deferred
  stats as "Próximamente". A `list` variant renders a compact row. Links to
  `/collections/[slug]`.

### Detail — `/collections/[slug]`

- `app/collections/[slug]/page.tsx` (RSC, `await params`): `fetchCollectionDetail(slug)`;
  on error → `notFound()`. Renders header (cover, name, brand, year,
  verified/community badge + author), a rarity-distribution summary, items
  grouped by rarity (each group headed by a `RarityBadge`, items show image +
  name + official pull rate or "—"), pack types (name, price, summary), and a
  clearly-labelled "Próximamente" block for the deferred stats.

### Shared UI

- `components/collections/rarity-badge.tsx`: dot + label + rarity colour, never
  colour-only (label always present — a11y). Colours from new `--rarity-*` tokens.
- `app/globals.css`: add the `--rarity-*` tokens (from design-system.md) under
  `:root`/`.dark` as needed (light + dark legible).

### lib/api

- `fetchCollectionsPage(query): Promise<CollectionsPageDto>` (client, `/api` proxy).
- `fetchBrands(): Promise<BrandDto[]>`.
- `fetchCollectionDetail(slug): Promise<CollectionDetailDto>` (RSC, internal URL).
- Validate payloads with the shared schemas (honest return types, like
  `fetchCollections` did). Remove/replace the old `fetchCollections`.

---

## 7. Testing (TDD; gate 80%)

**Shared (Vitest):** `collectionsQuerySchema` (defaults, coercion, bad sort);
list/page/detail/brand schemas; `packSummary` per category.

**API (Jest, mocked Prisma):** `collections.service.findPage` (each filter, each
sort, pagination math, hasMore, itemCount mapping); `findBySlug` (rarity
ordering, distribution counts, packType summary, 404); `brands.service`;
controller query validation (400 on bad params). **e2e (supertest, seeded DB):**
list default + filtered (by category/brand) + paginated; detail by slug (items,
distribution, packTypes); 404 for unknown/DRAFT slug; `GET /brands`.

**Web (Vitest + RTL):** `CollectionCard` (grid + list, placeholders),
`CollectionFilters` (emits filter changes), `CollectionBrowser` (renders pages,
empty/error, infinite-scroll fetchNextPage — mock `useInfiniteQuery`/fetch),
`RarityBadge` (label + colour per rarity), `lib/api` (page/brands/detail calls +
proxy path). App-router pages excluded from coverage (integration), as elsewhere.

---

## 8. Docs & migration of existing code

- `docs/ENDPOINT_PERMISSIONS.md`: update `GET /collections` (now paginated +
  filters) and add `GET /collections/:slug`, `GET /brands` (all Public). Bump date.
- `docs/FINDINGS.md`: note the `GET /collections` shape change (array →
  paged object) and the pack `summary` helper location.
- Replace the old `collection-list.tsx` (+ its test) and the old
  `fetchCollections`/`collectionResponseSchema` usages; update the
  `collections.e2e` + `lib/api` tests to the new shapes.

---

## 9. Risks / call-outs

- **Breaking change to `GET /collections`** — the foundation slice + its tests
  assume a flat array. The plan must update the API test, the e2e, `lib/api`,
  and remove the old list component in the same change.
- **`q` search** uses Prisma `contains` with `mode: 'insensitive'` (Postgres
  ILIKE); fine for small data, add a trigram index later.
- **Pack `summary`** depends on `packModel` matching its category schema; the
  helper validates via the registry and falls back to a neutral label if invalid
  (don't throw the whole detail on one bad packModel — log + neutral summary).
- **Decimal as string** — `officialPullRate` and `price` serialize to strings;
  DTOs model them as `z.string().nullable()`.
