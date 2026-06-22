# RESUME — catalog browse+detail slice (subagent-driven execution)

> Portable resume note (committed, travels with the branch). The live ledger at
> `.superpowers/sdd/progress.md` is git-ignored and machine-local — this mirrors
> it. Trust `git log` + this file.

**Branch:** `feat/catalog-browse`
**Plan:** `docs/superpowers/plans/2026-06-22-catalog-browse-detail.md` (14 TDD tasks)
**Spec:** `docs/superpowers/specs/2026-06-22-catalog-browse-detail-design.md`
**Method:** superpowers `subagent-driven-development` (fresh implementer + reviewer per task).

## Progress (as of 2026-06-22, end of session)

- **T1** shared contracts (query/list/detail/brand DTOs) ✅
- **T2** `packSummary` helper ✅
- **T3** brands module (GET /brands) ✅
- **T4** `collections.service.findPage` (filter/sort/paginate) ✅
- **T5** `collections.service.findBySlug` (detail) ✅
- **T6** collections controller + wire BrandsModule ✅ (api build/tsc green here)
- **T7** catalog e2e (6/6) ✅ — **backend complete**
- **T8** web api client (`fetchCollectionsPage`/`fetchBrands`/`fetchCollectionDetail`) ✅
- **T9** RarityBadge + rarity tokens ✅
- **T10** CollectionCard — IMPLEMENTED (commit `08e706b`) but **NOT yet reviewed** ← resume here

## Resume here (next session)

1. **Review Task 10** (range `65f25cd..08e706b`) → mark complete.
2. **T11** CollectionFilters (brand/category/year/q; tests need a `QueryClientProvider` wrapper for `useQuery(fetchBrands)`).
3. **T12** CollectionBrowser + `/collections` page (TanStack `useInfiniteQuery` + IntersectionObserver, sort, grid/list). **DELETES** the old `collection-list.tsx` (+ test). This is the task that **fixes the currently-broken web build** (old page imports the removed `fetchCollections`).
4. **T13** collection detail page (RSC, excluded from coverage).
5. **T14** docs (`ENDPOINT_PERMISSIONS` + `FINDINGS` incl. the enum-order note) + full gate (lint/type-check/test:cov/e2e) — needs infra up.
6. **Final whole-branch review** → `finishing-a-development-branch` (PR to `main`; user pushes).

## Known state / carry-forwards

- **Web build is intentionally broken until T12** (old `app/collections/page.tsx` + `collection-list.tsx` still import the removed `fetchCollections`). Don't treat as a defect.
- `GET /collections` is now a PAGED object (not a flat array) — breaking change handled across T6/T8/T12.
- Catalog fetchers use `as` casts, not zod parse (runtime validation dropped vs old `fetchCollections`) — minor, deferred.
- `findBySlug` `createdBy:null` path untested; e2e category-filter `.every()` vacuous if 0 TCG — minor.
- Rarity ordering relies on Prisma enum decl order == shared enum order (FINDINGS note to add in T14).

## Bootstrapping on a fresh machine

1. `git pull` the `feat/catalog-browse` branch (must be pushed).
2. `cp .env.example .env`, shift ports if running beside another stack.
3. `pnpm install`
4. `pnpm infra:up && pnpm db:deploy && pnpm db:seed`
5. Resume from the ledger / this file.
