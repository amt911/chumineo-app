# Foundation (Phase 0) — Design

- **Date:** 2026-06-19
- **Status:** Approved (pending final user review)
- **Author:** brainstorming session
- **Product:** SobreBox (repo: `chumineo-app`)

A platform to track, analyze and trade surprise/blind boxes across collectible
families (TCG cards, Funko figures, Pop Mart-style blind boxes). Users register
openings, see official vs community-empirical pull rates, manage inventory and
wishlists, and buy/sell/trade items in a marketplace.

This document designs **Phase 0: the foundation** — repo skeleton, tooling, the
agnostic catalog core data model, and the architecture the later epics hang off.
It is intentionally scoped to a single implementation plan. Every other epic gets
its own `spec → plan → implementation` cycle.

---

## 1. Foundational decisions (locked in this session)

1. **Stack = modern (from `chat.md`), ops/docs shell = inspired by `route-page-app`.**
   We keep Turborepo + pnpm + Prisma + Zod-shared (`packages/shared`) and the
   modern frontend stack. From `route-page-app` we copy only the *shell*:
   docker-compose + makefile orchestration, the CLAUDE.md style/conventions,
   `docs/superpowers/{specs,plans}`, `FINDINGS.md`, `ENDPOINT_PERMISSIONS.md`,
   graphify, and the TDD + 80% coverage gates. We do **not** adopt route-page-app's
   TypeORM, its lack of a shared package, or its git-submodule layout.

2. **Catalog is category-agnostic from day 1.** Seed via public APIs where they
   exist (Pokémon TCG, Scryfall/Magic…), manual/community elsewhere. The data
   model must support TCG, figures and blind boxes without schema migrations per
   new category.

3. **Catalog editing = open wiki.** Any logged-in user can add/edit collections.
   Edits are versioned (`CollectionRevision`), moderation is reactive (flag →
   revert/lock), with light guardrails (rate limits, new-account restrictions,
   duplicate detection).

4. **Agnostic model = Approach C (typed spine + per-category PackModel strategy).**
   A strongly-typed core spine, plus a variable "pack mechanics" layer behind a
   `PackModel` strategy whose config is a JSON blob validated by a per-category
   Zod schema living in `packages/shared`. See §5.

---

## 2. Scope

**In scope (this plan):**

- Monorepo scaffolding: pnpm workspaces + Turborepo (`apps/api`, `apps/web`,
  `packages/shared`).
- `apps/api`: NestJS 10 + Prisma init, health endpoint, `ZodValidationPipe` wiring.
- `apps/web`: Next.js 15 (App Router) init, TanStack Query + shadcn/ui baseline.
- `packages/shared`: enums + the per-category Zod `PackModel` schema registry skeleton.
- docker-compose (db · redis · api · web · mailpit) + makefile + `.env.example`.
- Docs scaffolding: rewritten `CLAUDE.md`, `docs/FINDINGS.md`,
  `docs/ENDPOINT_PERMISSIONS.md`, `docs/superpowers/{specs,plans}/`.
- Prisma schema for the **catalog core spine** (§4) + a seed/fixtures with one
  example collection per category.
- One **vertical slice** proving end-to-end wiring: `GET /collections` returns
  seeded data, rendered by a minimal `apps/web` page — with unit + e2e tests, to
  establish the TDD/coverage baseline.

**Out of scope (own future specs — see §6):** auth & profile, the full
catalog/wiki/import subsystem, openings, inventory & wishlist, stats/pull rates,
marketplace, social, notifications. Phase 0 only defines the *model and
architecture* those epics need.

---

## 3. Repo structure & tooling

```text
chumineo-app/
├── apps/
│   ├── api/                  # NestJS 10 + Prisma
│   │   ├── prisma/           # schema.prisma + migrations (lives with the backend)
│   │   └── src/
│   │       ├── collections/  # catalog read slice (Phase 0); wiki/import → epic 2
│   │       ├── prisma/       # PrismaService + module (DI wrapper)
│   │       ├── common/       # ZodValidationPipe, guards, filters
│   │       └── health/
│   └── web/                  # Next.js 15 (App Router)
│       ├── app/
│       ├── components/ui/    # shadcn — generated, do not hand-edit
│       └── lib/              # api client, query-keys, rarity helpers
├── packages/
│   └── shared/               # enums + Zod schemas (DTOs + PackModel registry)
│       └── src/
│           ├── enums/
│           ├── dto/
│           └── pack-models/  # per-category Zod schemas + registry
├── prisma/                   # schema.prisma + migrations (or apps/api/prisma)
├── docs/
│   ├── FINDINGS.md
│   ├── ENDPOINT_PERMISSIONS.md
│   └── superpowers/{specs,plans}/
├── docker-compose.yml        # db (pg16) · redis · api · web · mailpit
├── makefile
├── turbo.json
├── pnpm-workspace.yaml
├── CLAUDE.md
└── graphify-out/
```

The empty `backend/` and `frontend/` scaffold dirs are replaced by `apps/`.

**makefile targets** (route-page-app naming, adapted to Prisma/Turbo/Docker):
`up`, `down`, `restart`, `reinstall-deps`, `clean`, `migrate` (prisma migrate dev),
`migration-run` (deploy), `fixtures` (seed), `shell-api`, `shell-web`, `lint`,
`test-backend-unit[-cov]`, `teste2e[-<module>]`, `test-frontend-unit[-cov]`,
`test-frontend-e2e`, `test-all`, `test-coverage-check`, `pr-check`.

**docker-compose services:** `chumineo-db` (postgres:16), `chumineo-redis`,
`chumineo-api`, `chumineo-web`, `chumineo-mailpit` (dev mail sink; Resend in prod).
Named volumes preserve db data + node_modules across `restart`.

---

## 4. Core data model — the typed spine

Prisma entities. Inventory/stats/marketplace all hang off these stable IDs.

```text
Brand ─< Collection ─< CollectionItem
                    └─< PackType
                    └─< CollectionRevision

Collection {
  id, slug, name, brandId, category: CollectionCategory,
  releaseYear?, coverImageUrl?,
  status:  CollectionStatus  (DRAFT | PUBLISHED | FLAGGED | LOCKED),
  source:  CollectionSource  (API_IMPORT | COMMUNITY | ADMIN),
  externalId?,               // for idempotent API import
  createdById, createdAt, updatedAt
}

CollectionItem {
  id,                        // STABLE — never reissued; stats key off this
  collectionId, name, rarity: Rarity, imageUrl?,
  officialPullRate?: Decimal,
  externalId?, createdAt, updatedAt
}

PackType {
  id, collectionId, name, price?,
  packModel: Json            // validated per-category by a Zod schema (§5)
}

Opening      { id, userId, packTypeId, openedAt, isPublic }     // epic 3
OpeningItem  { id, openingId, collectionItemId, quantity }      // epic 3
UserInventory{ userId, collectionItemId, quantity, condition }  // epic 4

CollectionRevision { id, collectionId, editorId, snapshot: Json, createdAt }  // wiki
Flag { id, targetType, targetId, reporterId, reason, status, createdAt }      // moderation

User { id, email, username, ... }   // minimal stub here; fleshed out in epic 1
```

**Enums (in `packages/shared`, single source of truth):**

- `CollectionCategory = TCG | FIGURE | BLIND_BOX` (extensible without migration of
  variable pack data; adding one only touches the PackModel registry + a possible
  enum value).
- `Rarity = COMMON | UNCOMMON | RARE | ULTRA_RARE | SECRET | LIMITED`. No hardcoded
  rarity strings anywhere else — a stray rarity string is a bug. (Future note:
  per-collection custom rarity tiers may be layered on later; Phase 0 uses the
  shared enum to honor the existing convention.)
- `CollectionStatus`, `CollectionSource`.

---

## 5. The variable layer — PackModel strategy (Approach C)

The differences between a TCG booster, a blind-box case, and a figure line live in
`PackType.packModel` (JSON), **not** in separate tables. A registry in
`packages/shared/pack-models/` maps each `CollectionCategory` to the Zod schema that
validates that JSON:

```text
TCG        → { slots: [{ rarity: Rarity, count: int, distribution?: {...} }] }
BLIND_BOX  → { caseSize: int, assortment: [{ itemId, count }], chase?: { itemId, odds } }
FIGURE     → { items: [{ itemId }] }
```

One schema, three consumers:

- **`ZodValidationPipe`** validates `packModel` on write by category.
- **`stats/pull-rate.service`** dispatches on `category` to compute *expected*
  rates from the pack model.
- **The wiki form** (`apps/web`) renders its fields per category from the same
  schema (React Hook Form + Zod resolver) — one form serves a Pokémon card and a
  Pop Mart case.

Adding a new category = add an enum value + a Zod schema + a pull-rate strategy
branch. The typed spine and all downstream modules are untouched.

---

## 6. Population subsystem (architecture only; built in epic 2)

- **API import:** idempotent adapters (`PokemonTcgImporter`, `ScryfallImporter`, …)
  map external sets → `Collection` + `CollectionItem` with `source = API_IMPORT`,
  deduped by `externalId`.
- **Open wiki:** any logged-in user creates/edits. Every save writes a
  `CollectionRevision` (snapshot + editor + timestamp). Item IDs are stable.
- **Reactive moderation:** `Flag` entity; admins/mods revert to a prior revision or
  `LOCK` a collection. Light guardrails even in open mode: edit rate limits,
  new-account restrictions, duplicate detection on create.
- **Pull rates:** *official* (item field, manual/community, often `null`) +
  *empirical* (`stats/pull-rate.service`, ≥50 registered openings, cached in Redis
  1h TTL, recomputed via a BullMQ job on new openings). Empirical rates key off the
  stable `CollectionItem.id`, so they are **immune to wiki text edits**.

---

## 7. Decomposition roadmap

Each epic = its own `docs/superpowers/specs/<date>-<topic>-design.md` → plan →
implementation. Order follows dependencies.

| # | Epic | User stories | MVP |
|---|---|---|---|
| 0 | **Foundation** (this doc) | — | 🔴 Critical |
| 1 | Auth & Profile | US-01–04 | 🔴 Critical |
| 2 | Catalog + wiki + import | US-05–09 | 🔴 Critical |
| 3 | Opening flow | US-10–13 | 🔴 Critical |
| 4 | Inventory + wishlist | US-14–16 | 🔴 Critical |
| 5 | Stats / pull rates | US-17–19 | 🟡 High |
| 6 | Marketplace | US-20–25 | 🟡 High |
| 7 | Social | US-26–27 | 🟢 Medium |
| 8 | Notifications | US-28–29 | 🟢 Medium |

MVP = epics 0–4.

---

## 8. Testing & quality

- **TDD mandatory** for new logic (services, `lib/`, custom hooks, form logic):
  red → green → refactor. Not required for purely visual changes or shadcn primitives.
- **Coverage gate 80%** on statements/branches/functions/lines, both apps. Do not
  lower the gate; exclude infra (Prisma client, migrations, seed, bootstrap, DI
  modules) with justification in config.
- `stats/pull-rate.service` ≥ 90% coverage — critical path.
- Backend: Jest + supertest e2e. Frontend: Vitest + Testing Library + jsdom;
  Playwright for the opening animation flow.
- Convention: `*.spec.ts` (backend), `*.test.tsx` (frontend), colocated.

---

## 9. Open questions / deferred

- **Product name:** Resolved — **SobreBox** (the repo stays `chumineo-app`).
- **Prisma schema location:** Resolved — `apps/api/prisma/` (lives with the backend).
- **Custom per-collection rarity tiers:** deferred; Phase 0 uses the shared `Rarity` enum.
- **Which import adapters ship first** (Pokémon TCG vs Scryfall): decided in epic 2's spec.
