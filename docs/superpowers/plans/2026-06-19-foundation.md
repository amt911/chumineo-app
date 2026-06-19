# SobreBox Foundation (Phase 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the SobreBox monorepo (Turborepo + pnpm), wire the modern stack (NestJS 10 + Prisma + Zod-shared + Next.js 15) with route-page-app's docker/makefile/docs shell, model the category-agnostic catalog core, and prove the wiring with a tested `GET /collections` vertical slice.

**Architecture:** pnpm-workspaces monorepo (`apps/api`, `apps/web`, `packages/shared`). Infra (Postgres 16, Redis, Mailpit) runs in docker-compose orchestrated by a makefile; api/web run on host for fast TDD. The catalog uses Approach C: a typed Prisma spine (`Brand`/`Collection`/`CollectionItem`/`PackType`) plus a variable `PackType.packModel` JSON validated per category by a Zod registry in `packages/shared`.

**Tech Stack:** pnpm + Turborepo, NestJS 10, Prisma 6, Zod 3, PostgreSQL 16, Redis, Next.js 15 (App Router), TanStack Query v5, shadcn/ui, Tailwind v4, Vitest, Jest + supertest. (Playwright e2e is deferred to epic 3 — the opening-animation flow.)

**Spec:** [docs/superpowers/specs/2026-06-19-foundation-design.md](../specs/2026-06-19-foundation-design.md)

**Conventions:** Conventional Commits (English). TDD for logic (shared schemas, services, web components); config/docs tasks are verified by commands. Never `git push`. Coverage gate 80%.

---

## Module & tooling strategy (READ FIRST — this is the single source of truth)

An adversarial review found the original raw-TS shared-package consumption broke
every consumer (Jest, Next, ts-node seed, runtime). This plan therefore commits to
**one explicit strategy**; do not deviate:

1. **`@sobrebox/shared` is BUILT, not consumed as raw TS.** It has a `tsc` `build`
   that emits `dist/` (CommonJS + `.d.ts`). Its `package.json` `main`/`types`/
   `exports` point at `dist/`. Consumers import compiled JS like any normal
   dependency — no `transpilePackages` gymnastics required (we add it anyway as
   harmless monorepo hygiene), no Jest `moduleNameMapper`, no ts-node ESM loader.
2. **CommonJS everywhere in `apps/api` and `packages/shared`.** No `"type": "module"`,
   no `.js` import extensions anywhere. NestJS's default ts-jest config works as-is.
3. **The seed runs under `tsx`** (handles TS + workspace deps with zero config).
4. **`@sobrebox/web` (Next.js 15)** keeps create-next-app defaults (Bundler
   resolution) and lists `transpilePackages: ['@sobrebox/shared']`.
5. **`shared` must be built before any consumer test/run.** Turbo's `^build` covers
   `turbo run`-driven tasks; the makefile test targets depend on a `build-shared`
   target; direct `pnpm --filter` commands in this plan prepend the build.
6. **Prisma enums and shared TS enums are intentionally duplicated** — Prisma cannot
   reference a TS enum, so the DB layer (schema.prisma) and the cross-HTTP layer
   (`packages/shared`) each declare them. A parity test (Task 5) asserts they never
   drift. This is the one sanctioned duplication; everything else imports from shared.

---

## File map (what gets created)

```text
chumineo-app/
├── pnpm-workspace.yaml            # Task 1
├── package.json                   # Task 1 (root scripts + devDeps)
├── turbo.json                     # Task 1
├── .gitignore .nvmrc .prettierrc  # Task 1
├── eslint.config.mjs              # Task 1
├── .env.example                   # Task 1
├── docker-compose.yml             # Task 2 (db · redis · mailpit)
├── makefile                       # Task 2
├── packages/shared/               # Task 3
│   ├── package.json tsconfig.json vitest.config.ts
│   └── src/
│       ├── enums/{rarity,collection-category,collection-source,collection-status}.ts
│       ├── pack-models/{tcg,blind-box,figure}.schema.ts
│       ├── pack-models/registry.ts        # validatePackModel(category, data)
│       ├── dto/collection.dto.ts          # collectionResponseSchema (added in Task 6)
│       └── index.ts
├── apps/api/                      # Tasks 4–6
│   ├── package.json nest-cli.json tsconfig*.json
│   ├── prisma/schema.prisma migrations/ seed.ts   # Task 5
│   └── src/
│       ├── main.ts app.module.ts
│       ├── common/{zod-validation.pipe.ts,zod-validation.pipe.spec.ts}  # Task 6
│       ├── prisma/{prisma.service.ts,prisma.module.ts}
│       ├── health/{health.controller.ts,health.controller.spec.ts}
│       ├── catalog/enum-parity.spec.ts            # Task 5 (drift guard)
│       └── collections/{collections.module.ts,collections.service.ts,
│                        collections.controller.ts,*.spec.ts}
└── apps/web/                      # Task 7
    ├── package.json next.config.ts tsconfig.json vitest.config.ts
    ├── app/{layout.tsx,providers.tsx,collections/page.tsx}
    ├── components/ui/             # shadcn baseline
    ├── components/collections/collection-list.tsx (+ .test.tsx)
    └── lib/api.ts (+ api.test.ts)
docs/{FINDINGS.md,ENDPOINT_PERMISSIONS.md}          # Task 8
CLAUDE.md  (rewritten)                              # Task 8
```

The `backend/` and `frontend/` scaffold dirs (which contain nested `.git` pointer
files) are removed in Task 1.

---

## Task 1: Root monorepo scaffolding

**Files:**
- Delete: `backend/`, `frontend/`
- Create: `pnpm-workspace.yaml`, `package.json`, `turbo.json`, `.gitignore`, `.nvmrc`, `.prettierrc`, `eslint.config.mjs`, `.env.example`

- [ ] **Step 1: Remove the scaffold dirs** (they contain nested `.git` files, so `rmdir` fails — use `rm -rf`)

```bash
rm -rf backend frontend
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create `.nvmrc` and `.gitignore`**

`.nvmrc`:

```text
22
```

`.gitignore`:

```text
node_modules/
dist/
.next/
coverage/
.turbo/
*.log
.env
.env.local
```

- [ ] **Step 4: Create root `package.json`**

```json
{
  "name": "sobrebox",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "test": "turbo run test",
    "test:cov": "turbo run test:cov"
  },
  "devDependencies": {
    "turbo": "^2.1.0",
    "prettier": "^3.3.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 5: Create `turbo.json`** (consumers depend on `^build`; `shared` provides a real build in Task 3)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "type-check": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] },
    "test:cov": { "dependsOn": ["^build"] }
  }
}
```

- [ ] **Step 6: Create `.prettierrc` and `eslint.config.mjs`**

`.prettierrc`:

```json
{ "singleQuote": true, "trailingComma": "all" }
```

`eslint.config.mjs`:

```js
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.recommended,
  { ignores: ['**/dist/**', '**/.next/**', '**/coverage/**'] },
);
```

Install its deps at root: `pnpm add -Dw typescript-eslint eslint`

- [ ] **Step 7: Create `.env.example`**

```text
# Postgres
POSTGRES_USER=sobrebox
POSTGRES_PASSWORD=sobrebox
POSTGRES_DB=sobrebox
POSTGRES_HOST_PORT=5432
DATABASE_URL=postgresql://sobrebox:sobrebox@localhost:5432/sobrebox?schema=public

# Redis
REDIS_HOST_PORT=6379
REDIS_URL=redis://localhost:6379

# Mailpit (dev mail sink)
MAILPIT_SMTP_PORT=1025
MAILPIT_UI_PORT=8025

# API
API_PORT=3000
JWT_SECRET=changeme

# Web
WEB_PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3000
```

- [ ] **Step 8: Verify and commit**

Run: `pnpm install`
Expected: installs root devDeps, creates `pnpm-lock.yaml` (workspace-package warnings OK — none exist yet).

```bash
git add -A
git commit -m "chore(repo): scaffold pnpm + turborepo monorepo root"
```

---

## Task 2: Infra — docker-compose + makefile

**Files:**
- Create: `docker-compose.yml`, `makefile`

- [ ] **Step 1: Create `docker-compose.yml`** (infra only; api/web run on host in Phase 0)

```yaml
services:
  sobrebox-db:
    image: postgres:16
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "${POSTGRES_HOST_PORT}:5432"
    volumes:
      - sobrebox_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

  sobrebox-redis:
    image: redis:7
    ports:
      - "${REDIS_HOST_PORT}:6379"

  sobrebox-mailpit:
    image: axllent/mailpit:latest
    ports:
      - "${MAILPIT_SMTP_PORT}:1025"
      - "${MAILPIT_UI_PORT}:8025"

volumes:
  sobrebox_db_data:
```

- [ ] **Step 2: Create `makefile`** (test targets build `shared` first via `build-shared`)

```makefile
include .env
export

.PHONY: up down restart clean build-shared migrate migration-run fixtures \
        shell-db lint test-backend-unit test-backend-unit-cov teste2e \
        test-frontend-unit test-frontend-unit-cov test-frontend-e2e \
        test-all test-coverage-check pr-check

up:            ## start infra (db, redis, mailpit)
	docker compose up -d

down:
	docker compose down

restart: down up

clean:
	docker compose down -v

build-shared:  ## compile @sobrebox/shared so consumers can import it
	pnpm --filter @sobrebox/shared run build

shell-db:
	docker compose exec sobrebox-db psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

migrate:       ## create a new prisma migration (name=...)
	pnpm --filter @sobrebox/api exec prisma migrate dev --name $(name)

migration-run: ## apply migrations
	pnpm --filter @sobrebox/api exec prisma migrate deploy

fixtures: build-shared  ## seed db
	pnpm --filter @sobrebox/api run seed

lint:
	pnpm run lint

test-backend-unit: build-shared
	pnpm --filter @sobrebox/api run test
test-backend-unit-cov: build-shared
	pnpm --filter @sobrebox/api run test:cov
teste2e: build-shared
	pnpm --filter @sobrebox/api run test:e2e

test-frontend-unit: build-shared
	pnpm --filter @sobrebox/web run test
test-frontend-unit-cov: build-shared
	pnpm --filter @sobrebox/web run test:cov
test-frontend-e2e:  ## Playwright deferred to epic 3
	@echo "frontend e2e deferred to epic 3 (opening-animation flow)"

test-all: test-backend-unit teste2e test-frontend-unit

test-coverage-check: test-backend-unit-cov test-frontend-unit-cov

pr-check: lint test-coverage-check
```

- [ ] **Step 3: Verify infra comes up**

```bash
cp .env.example .env
make up
docker compose ps
```

Expected: `sobrebox-db` healthy, `sobrebox-redis` and `sobrebox-mailpit` running. Mailpit UI at http://localhost:8025.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml makefile
git commit -m "chore(infra): add docker-compose (db, redis, mailpit) and makefile"
```

---

## Task 3: `packages/shared` — enums + PackModel Zod registry, built to `dist` (TDD)

**Files:**
- Create: `packages/shared/{package.json,tsconfig.json,vitest.config.ts}`
- Create: `packages/shared/src/enums/*.ts`, `packages/shared/src/pack-models/*.ts`, `packages/shared/src/index.ts`
- Test: `packages/shared/src/pack-models/registry.spec.ts`

- [ ] **Step 1: Create the manifest (built CommonJS, `main`/`types`/`exports` → `dist`)**

`packages/shared/package.json`:

```json
{
  "name": "@sobrebox/shared",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "eslint .",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:cov": "vitest run --coverage"
  },
  "dependencies": { "zod": "^3.23.0" },
  "devDependencies": {
    "vitest": "2.1.9",
    "@vitest/coverage-v8": "2.1.9",
    "typescript": "^5.6.0"
  }
}
```

> `vitest` and `@vitest/coverage-v8` are pinned to the SAME exact version (the
> coverage plugin hard-pins its vitest peer).

`packages/shared/tsconfig.json` (CommonJS, emits to `dist`, no `.js` import extensions in source):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["dist", "**/*.spec.ts"]
}
```

`packages/shared/vitest.config.ts` (runs on `src`, independent of the build):

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
      exclude: ['**/index.ts', '**/*.config.ts', 'dist/**'],
    },
  },
});
```

- [ ] **Step 2: Create the enums** (no `.js` extensions anywhere in this package)

`packages/shared/src/enums/rarity.ts`:

```ts
export enum Rarity {
  COMMON = 'COMMON',
  UNCOMMON = 'UNCOMMON',
  RARE = 'RARE',
  ULTRA_RARE = 'ULTRA_RARE',
  SECRET = 'SECRET',
  LIMITED = 'LIMITED',
}
```

`packages/shared/src/enums/collection-category.ts`:

```ts
export enum CollectionCategory {
  TCG = 'TCG',
  FIGURE = 'FIGURE',
  BLIND_BOX = 'BLIND_BOX',
}
```

`packages/shared/src/enums/collection-source.ts`:

```ts
export enum CollectionSource {
  API_IMPORT = 'API_IMPORT',
  COMMUNITY = 'COMMUNITY',
  ADMIN = 'ADMIN',
}
```

`packages/shared/src/enums/collection-status.ts`:

```ts
export enum CollectionStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  FLAGGED = 'FLAGGED',
  LOCKED = 'LOCKED',
}
```

- [ ] **Step 3: Create the per-category PackModel schemas**

`packages/shared/src/pack-models/tcg.schema.ts`:

```ts
import { z } from 'zod';
import { Rarity } from '../enums/rarity';

export const tcgPackModelSchema = z.object({
  slots: z
    .array(
      z.object({
        rarity: z.nativeEnum(Rarity),
        count: z.number().int().positive(),
      }),
    )
    .min(1),
});
export type TcgPackModel = z.infer<typeof tcgPackModelSchema>;
```

`packages/shared/src/pack-models/blind-box.schema.ts`:

```ts
import { z } from 'zod';

export const blindBoxPackModelSchema = z.object({
  caseSize: z.number().int().positive(),
  assortment: z
    .array(z.object({ itemId: z.string(), count: z.number().int().positive() }))
    .min(1),
  chase: z.object({ itemId: z.string(), odds: z.number().positive() }).optional(),
});
export type BlindBoxPackModel = z.infer<typeof blindBoxPackModelSchema>;
```

`packages/shared/src/pack-models/figure.schema.ts`:

```ts
import { z } from 'zod';

export const figurePackModelSchema = z.object({
  items: z.array(z.object({ itemId: z.string() })).min(1),
});
export type FigurePackModel = z.infer<typeof figurePackModelSchema>;
```

- [ ] **Step 4: Write the failing registry test**

`packages/shared/src/pack-models/registry.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CollectionCategory } from '../enums/collection-category';
import { Rarity } from '../enums/rarity';
import { validatePackModel } from './registry';

describe('validatePackModel', () => {
  it('accepts a valid TCG pack model', () => {
    expect(
      validatePackModel(CollectionCategory.TCG, {
        slots: [{ rarity: Rarity.COMMON, count: 5 }],
      }).success,
    ).toBe(true);
  });

  it('rejects a TCG pack model with no slots', () => {
    expect(validatePackModel(CollectionCategory.TCG, { slots: [] }).success).toBe(false);
  });

  it('accepts a valid BLIND_BOX pack model with a chase', () => {
    expect(
      validatePackModel(CollectionCategory.BLIND_BOX, {
        caseSize: 12,
        assortment: [{ itemId: 'a', count: 11 }],
        chase: { itemId: 'b', odds: 144 },
      }).success,
    ).toBe(true);
  });

  it('accepts a valid FIGURE pack model', () => {
    expect(
      validatePackModel(CollectionCategory.FIGURE, { items: [{ itemId: 'a' }] }).success,
    ).toBe(true);
  });

  it('rejects an unknown category', () => {
    expect(validatePackModel('NOPE' as CollectionCategory, {}).success).toBe(false);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm --filter @sobrebox/shared run test`
Expected: FAIL — `./registry` / `validatePackModel` not found.

- [ ] **Step 6: Implement the registry** (unknown-category returns an explicit failing parse)

`packages/shared/src/pack-models/registry.ts`:

```ts
import { z, type SafeParseReturnType, type ZodSchema } from 'zod';
import { CollectionCategory } from '../enums/collection-category';
import { tcgPackModelSchema } from './tcg.schema';
import { blindBoxPackModelSchema } from './blind-box.schema';
import { figurePackModelSchema } from './figure.schema';

export const packModelRegistry: Record<CollectionCategory, ZodSchema> = {
  [CollectionCategory.TCG]: tcgPackModelSchema,
  [CollectionCategory.FIGURE]: figurePackModelSchema,
  [CollectionCategory.BLIND_BOX]: blindBoxPackModelSchema,
};

export function validatePackModel(
  category: CollectionCategory,
  data: unknown,
): SafeParseReturnType<unknown, unknown> {
  const schema = packModelRegistry[category];
  // Unknown category → a schema that never matches, so callers always get success:false.
  return (schema ?? z.never()).safeParse(data);
}
```

- [ ] **Step 7: Create the barrel `src/index.ts`** (no dto export yet — added in Task 6)

```ts
export * from './enums/rarity';
export * from './enums/collection-category';
export * from './enums/collection-source';
export * from './enums/collection-status';
export * from './pack-models/tcg.schema';
export * from './pack-models/blind-box.schema';
export * from './pack-models/figure.schema';
export * from './pack-models/registry';
```

- [ ] **Step 8: Run tests to verify they pass, then build**

Run: `pnpm --filter @sobrebox/shared run test`
Expected: PASS, 5 tests.

Run: `pnpm --filter @sobrebox/shared run build`
Expected: emits `packages/shared/dist/index.js` + `index.d.ts` (verify the files exist).

- [ ] **Step 9: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add enums and per-category PackModel zod registry (built to dist)"
```

---

## Task 4: `apps/api` scaffold — Nest + Prisma + health (TDD)

**Files:**
- Create (via generator): `apps/api/*`
- Create: `apps/api/src/prisma/{prisma.service.ts,prisma.module.ts}`
- Test + impl: `apps/api/src/health/{health.controller.spec.ts,health.controller.ts}`

- [ ] **Step 1: Generate the Nest app into `apps/api`** (default CommonJS — keep it)

```bash
pnpm dlx @nestjs/cli@10 new api --directory apps/api --skip-git --skip-install --package-manager pnpm
```

Edit `apps/api/package.json`: set `"name": "@sobrebox/api"`, add script `"test:e2e": "jest --config ./test/jest-e2e.json"`. Then install deps:

```bash
pnpm --filter @sobrebox/api add @prisma/client zod
pnpm --filter @sobrebox/api add -D prisma tsx supertest @types/supertest
pnpm --filter @sobrebox/api add '@sobrebox/shared@workspace:*'
```

> Do NOT add `"type": "module"` and do NOT change tsconfig `module`/`moduleResolution`.
> The default CommonJS + ts-jest setup consumes `@sobrebox/shared`'s compiled `dist`
> like any normal dependency.

- [ ] **Step 2: Add the 80% coverage gate to `apps/api/package.json`**

Under the existing `"jest"` key, add:

```json
"coverageThreshold": {
  "global": { "statements": 80, "branches": 80, "functions": 80, "lines": 80 }
},
"coveragePathIgnorePatterns": [
  "/node_modules/", ".module.ts$", "main.ts$",
  "prisma/prisma.service.ts", "/prisma/seed.ts"
]
```

- [ ] **Step 3: Init Prisma (schema location `apps/api/prisma`)**

```bash
pnpm --filter @sobrebox/api exec prisma init --datasource-provider postgresql
```

Creates `apps/api/prisma/schema.prisma`. (Models defined in Task 5.)

- [ ] **Step 4: Create `PrismaService` and module** (no `.js` extensions)

`apps/api/src/prisma/prisma.service.ts`:

```ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
}
```

`apps/api/src/prisma/prisma.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

- [ ] **Step 5: Write the failing health controller test**

`apps/api/src/health/health.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok status', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    const controller = moduleRef.get(HealthController);
    expect(controller.check()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm --filter @sobrebox/api run test -- health`
Expected: FAIL — cannot find `./health.controller`.

- [ ] **Step 7: Implement the health controller**

`apps/api/src/health/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
```

- [ ] **Step 8: Wire modules in `apps/api/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 9: Run tests to verify pass**

Run: `pnpm --filter @sobrebox/api run test -- health`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/api
git commit -m "feat(api): scaffold nest app with prisma module and health endpoint"
```

---

## Task 5: Prisma schema (core spine) + migration + seed + enum-parity guard

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/seed.ts`, `apps/api/src/catalog/enum-parity.spec.ts`
- Modify: `apps/api/package.json` (add `prisma.seed` + `seed` script)

- [ ] **Step 1: Define the core spine in `apps/api/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Rarity {
  COMMON
  UNCOMMON
  RARE
  ULTRA_RARE
  SECRET
  LIMITED
}

enum CollectionCategory {
  TCG
  FIGURE
  BLIND_BOX
}

enum CollectionStatus {
  DRAFT
  PUBLISHED
  FLAGGED
  LOCKED
}

enum CollectionSource {
  API_IMPORT
  COMMUNITY
  ADMIN
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  username  String   @unique
  createdAt DateTime @default(now())

  collections Collection[]         @relation("CreatedCollections")
  revisions   CollectionRevision[]
  openings    Opening[]
  inventory   UserInventory[]
}

model Brand {
  id          String       @id @default(cuid())
  slug        String       @unique
  name        String
  collections Collection[]
}

model Collection {
  id            String             @id @default(cuid())
  slug          String             @unique
  name          String
  brandId       String
  brand         Brand              @relation(fields: [brandId], references: [id])
  category      CollectionCategory
  status        CollectionStatus   @default(DRAFT)
  source        CollectionSource   @default(COMMUNITY)
  releaseYear   Int?
  coverImageUrl String?
  externalId    String?
  createdById   String?
  createdBy     User?              @relation("CreatedCollections", fields: [createdById], references: [id])
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt

  items     CollectionItem[]
  packTypes PackType[]
  revisions CollectionRevision[]

  @@index([category])
  @@index([brandId])
}

model CollectionItem {
  id               String     @id @default(cuid())
  collectionId     String
  collection       Collection @relation(fields: [collectionId], references: [id])
  name             String
  rarity           Rarity
  imageUrl         String?
  officialPullRate Decimal?
  externalId       String?
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  openingItems OpeningItem[]
  inventory    UserInventory[]

  @@index([collectionId])
}

model PackType {
  id           String     @id @default(cuid())
  collectionId String
  collection   Collection @relation(fields: [collectionId], references: [id])
  name         String
  price        Decimal?
  packModel    Json
  openings     Opening[]
}

model Opening {
  id         String        @id @default(cuid())
  userId     String
  user       User          @relation(fields: [userId], references: [id])
  packTypeId String
  packType   PackType      @relation(fields: [packTypeId], references: [id])
  openedAt   DateTime      @default(now())
  isPublic   Boolean       @default(true)
  items      OpeningItem[]
}

model OpeningItem {
  id               String         @id @default(cuid())
  openingId        String
  opening          Opening        @relation(fields: [openingId], references: [id])
  collectionItemId String
  collectionItem   CollectionItem @relation(fields: [collectionItemId], references: [id])
  quantity         Int            @default(1)
}

model UserInventory {
  id               String         @id @default(cuid())
  userId           String
  user             User           @relation(fields: [userId], references: [id])
  collectionItemId String
  collectionItem   CollectionItem @relation(fields: [collectionItemId], references: [id])
  quantity         Int            @default(1)
  condition        String?

  @@unique([userId, collectionItemId])
}

model CollectionRevision {
  id           String     @id @default(cuid())
  collectionId String
  collection   Collection @relation(fields: [collectionId], references: [id])
  editorId     String
  editor       User       @relation(fields: [editorId], references: [id])
  snapshot     Json
  createdAt    DateTime   @default(now())

  @@index([collectionId])
}

model Flag {
  id         String   @id @default(cuid())
  targetType String
  targetId   String
  reporterId String
  reason     String
  status     String   @default("OPEN")
  createdAt  DateTime @default(now())
}
```

- [ ] **Step 2: Create the migration (db must be up)**

```bash
make up
make migrate name=init_catalog_core
```

Expected: creates `apps/api/prisma/migrations/<ts>_init_catalog_core/` and applies it. Verify with `make shell-db` then `\dt`.

- [ ] **Step 3: Write the enum-parity guard test** (proves Prisma ↔ shared enums never drift)

`apps/api/src/catalog/enum-parity.spec.ts`:

```ts
import {
  CollectionCategory as PrismaCategory,
  CollectionSource as PrismaSource,
  CollectionStatus as PrismaStatus,
  Rarity as PrismaRarity,
} from '@prisma/client';
import {
  CollectionCategory,
  CollectionSource,
  CollectionStatus,
  Rarity,
} from '@sobrebox/shared';

const sorted = (o: Record<string, string>) => Object.values(o).sort();

describe('enum parity (prisma <-> shared)', () => {
  it('Rarity matches', () => expect(sorted(Rarity)).toEqual(sorted(PrismaRarity)));
  it('CollectionCategory matches', () =>
    expect(sorted(CollectionCategory)).toEqual(sorted(PrismaCategory)));
  it('CollectionStatus matches', () =>
    expect(sorted(CollectionStatus)).toEqual(sorted(PrismaStatus)));
  it('CollectionSource matches', () =>
    expect(sorted(CollectionSource)).toEqual(sorted(PrismaSource)));
});
```

Run: `pnpm --filter @sobrebox/shared run build && pnpm --filter @sobrebox/api run test -- enum-parity`
Expected: PASS, 4 tests (requires `prisma generate`, which `prisma migrate dev` already ran).

- [ ] **Step 4: Add the seed config to `apps/api/package.json`** (`tsx`, not ts-node)

Add a top-level `"prisma": { "seed": "tsx prisma/seed.ts" }` and a script `"seed": "tsx prisma/seed.ts"`. (`tsx` was installed in Task 4 Step 1.)

- [ ] **Step 5: Write `apps/api/prisma/seed.ts`** (one collection per category; validates all three PackModels)

```ts
import { PrismaClient, Rarity } from '@prisma/client';
import {
  CollectionCategory,
  CollectionSource,
  CollectionStatus,
  validatePackModel,
} from '@sobrebox/shared';

const prisma = new PrismaClient();

async function main() {
  const tcgPack = {
    slots: [
      { rarity: Rarity.COMMON, count: 5 },
      { rarity: Rarity.RARE, count: 1 },
    ],
  };
  const figurePack = { items: [{ itemId: 'placeholder' }] };
  const blindPack = {
    caseSize: 12,
    assortment: [{ itemId: 'placeholder', count: 11 }],
    chase: { itemId: 'placeholder', odds: 144 },
  };

  for (const [category, model] of [
    [CollectionCategory.TCG, tcgPack],
    [CollectionCategory.FIGURE, figurePack],
    [CollectionCategory.BLIND_BOX, blindPack],
  ] as const) {
    if (!validatePackModel(category, model).success) {
      throw new Error(`Seed pack model invalid for ${category}`);
    }
  }

  const pokemon = await prisma.brand.upsert({
    where: { slug: 'pokemon' }, update: {}, create: { slug: 'pokemon', name: 'Pokémon' },
  });
  const funko = await prisma.brand.upsert({
    where: { slug: 'funko' }, update: {}, create: { slug: 'funko', name: 'Funko' },
  });
  const popmart = await prisma.brand.upsert({
    where: { slug: 'pop-mart' }, update: {}, create: { slug: 'pop-mart', name: 'Pop Mart' },
  });

  await prisma.collection.upsert({
    where: { slug: 'sv-obsidian-flames' },
    update: {},
    create: {
      slug: 'sv-obsidian-flames', name: 'Scarlet & Violet — Obsidian Flames',
      brandId: pokemon.id, category: CollectionCategory.TCG,
      status: CollectionStatus.PUBLISHED, source: CollectionSource.API_IMPORT,
      releaseYear: 2023,
      items: { create: [
        { name: 'Charizard ex', rarity: Rarity.ULTRA_RARE },
        { name: 'Pikachu', rarity: Rarity.COMMON },
      ] },
      packTypes: { create: [{ name: 'Booster', packModel: tcgPack }] },
    },
  });

  await prisma.collection.upsert({
    where: { slug: 'funko-marvel' },
    update: {},
    create: {
      slug: 'funko-marvel', name: 'Funko Pop! — Marvel',
      brandId: funko.id, category: CollectionCategory.FIGURE,
      status: CollectionStatus.PUBLISHED, source: CollectionSource.COMMUNITY,
      items: { create: [{ name: 'Spider-Man', rarity: Rarity.COMMON }] },
      packTypes: { create: [{ name: 'Single Box', packModel: figurePack }] },
    },
  });

  await prisma.collection.upsert({
    where: { slug: 'skullpanda-the-sound' },
    update: {},
    create: {
      slug: 'skullpanda-the-sound', name: 'Skullpanda — The Sound',
      brandId: popmart.id, category: CollectionCategory.BLIND_BOX,
      status: CollectionStatus.PUBLISHED, source: CollectionSource.COMMUNITY,
      items: { create: [
        { name: 'Melody', rarity: Rarity.COMMON },
        { name: 'Secret Chase', rarity: Rarity.SECRET },
      ] },
      packTypes: { create: [{ name: 'Case', packModel: blindPack }] },
    },
  });
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e); await prisma.$disconnect(); process.exit(1);
});
```

> `Rarity` is imported from `@prisma/client` for the DB write data (canonical for
> Prisma create input); the cross-boundary enums come from `@sobrebox/shared`. The
> Task 5 Step 3 parity test guarantees the two never diverge.

- [ ] **Step 6: Run the seed and verify**

Run: `make fixtures`
Expected: exits 0 (builds shared first, then `tsx prisma/seed.ts`). `make shell-db` → `SELECT slug FROM "Collection";` lists the 3 collections.

- [ ] **Step 7: Commit**

```bash
git add apps/api
git commit -m "feat(api): add catalog core prisma schema, seed and enum-parity guard"
```

---

## Task 6: Collections read slice — service + controller + ZodValidationPipe (TDD)

**Files:**
- Create: `packages/shared/src/dto/collection.dto.ts` (+ append its export to `index.ts`, rebuild)
- Create + test: `apps/api/src/common/{zod-validation.pipe.ts,zod-validation.pipe.spec.ts}`
- Create + test: `apps/api/src/collections/{collections.service.ts,collections.service.spec.ts,collections.controller.ts,collections.module.ts}`
- Test (e2e): `apps/api/test/collections.e2e-spec.ts`

- [ ] **Step 1: Add the response DTO to shared and rebuild**

`packages/shared/src/dto/collection.dto.ts`:

```ts
import { z } from 'zod';
import { CollectionCategory } from '../enums/collection-category';
import { CollectionStatus } from '../enums/collection-status';
import { CollectionSource } from '../enums/collection-source';

export const collectionResponseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: z.nativeEnum(CollectionCategory),
  status: z.nativeEnum(CollectionStatus),
  source: z.nativeEnum(CollectionSource),
});
export type CollectionResponseDto = z.infer<typeof collectionResponseSchema>;
```

Append to `packages/shared/src/index.ts`:

```ts
export * from './dto/collection.dto';
```

Run: `pnpm --filter @sobrebox/shared run test && pnpm --filter @sobrebox/shared run build`
Expected: still green; `dist` rebuilt with the new export.

- [ ] **Step 2: Write the failing ZodValidationPipe test, then implement it**

`apps/api/src/common/zod-validation.pipe.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(z.object({ name: z.string() }));

  it('returns parsed data when valid', () => {
    expect(pipe.transform({ name: 'ok' })).toEqual({ name: 'ok' });
  });

  it('throws BadRequest when invalid', () => {
    expect(() => pipe.transform({ name: 1 })).toThrow(BadRequestException);
  });
});
```

Run: `pnpm --filter @sobrebox/api run test -- zod-validation` → FAIL (not found).

`apps/api/src/common/zod-validation.pipe.ts`:

```ts
import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}
  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.format());
    }
    return result.data;
  }
}
```

Run again → PASS, 2 tests. (Phase 0 ships the pipe + its test; the first write
endpoint wires it onto a route in epic 2.)

- [ ] **Step 3: Write the failing service unit test**

`apps/api/src/collections/collections.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { CollectionCategory, CollectionSource, CollectionStatus } from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CollectionsService } from './collections.service';

describe('CollectionsService', () => {
  it('maps prisma collections to response dtos', async () => {
    const prisma = {
      collection: {
        findMany: jest.fn().mockResolvedValue([
          { id: '1', slug: 's', name: 'N', category: CollectionCategory.TCG,
            status: CollectionStatus.PUBLISHED, source: CollectionSource.ADMIN, extra: 'drop-me' },
        ]),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [CollectionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const service = moduleRef.get(CollectionsService);

    const result = await service.findAll();

    expect(prisma.collection.findMany).toHaveBeenCalledWith({
      where: { status: CollectionStatus.PUBLISHED },
    });
    expect(result).toEqual([
      { id: '1', slug: 's', name: 'N', category: 'TCG', status: 'PUBLISHED', source: 'ADMIN' },
    ]);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `pnpm --filter @sobrebox/shared run build && pnpm --filter @sobrebox/api run test -- collections.service`
Expected: FAIL — `CollectionsService` not found.

- [ ] **Step 5: Implement the service** (Zod `.parse` strips extra fields)

`apps/api/src/collections/collections.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import {
  CollectionResponseDto,
  collectionResponseSchema,
  CollectionStatus,
} from '@sobrebox/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<CollectionResponseDto[]> {
    const rows = await this.prisma.collection.findMany({
      where: { status: CollectionStatus.PUBLISHED },
    });
    return rows.map((r) => collectionResponseSchema.parse(r));
  }
}
```

- [ ] **Step 6: Run unit test to verify pass**

Run: `pnpm --filter @sobrebox/api run test -- collections.service`
Expected: PASS.

- [ ] **Step 7: Add the controller and module**

`apps/api/src/collections/collections.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { CollectionResponseDto } from '@sobrebox/shared';
import { CollectionsService } from './collections.service';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  findAll(): Promise<CollectionResponseDto[]> {
    return this.collections.findAll();
  }
}
```

`apps/api/src/collections/collections.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';

@Module({ controllers: [CollectionsController], providers: [CollectionsService] })
export class CollectionsModule {}
```

Register `CollectionsModule` in `apps/api/src/app.module.ts` imports.

- [ ] **Step 8: Write the e2e test**

`apps/api/test/collections.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('GET /collections (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  it('returns the seeded published collections', async () => {
    const res = await request(app.getHttpServer()).get('/collections').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    expect(res.body[0]).toHaveProperty('slug');
  });
});
```

- [ ] **Step 9: Run e2e (db up + seeded) to verify pass**

Run: `make up && make migration-run && make fixtures && pnpm --filter @sobrebox/api run test:e2e -- collections`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/shared apps/api
git commit -m "feat(api): add GET /collections read slice with zod-validated dto"
```

---

## Task 7: `apps/web` scaffold + shadcn baseline + collections page (TDD)

**Files:**
- Create (via generator): `apps/web/*`
- Create: `apps/web/lib/api.ts` (+ `api.test.ts`), `apps/web/app/providers.tsx`, `apps/web/next.config.ts`
- Create + test: `apps/web/components/collections/{collection-list.tsx,collection-list.test.tsx}`
- Create: `apps/web/app/collections/page.tsx`, shadcn `components/ui/`

- [ ] **Step 1: Generate the Next.js app** (note: `--no-src-dir`, not `--src-dir false`)

```bash
pnpm dlx create-next-app@15 apps/web --ts --app --tailwind --eslint --no-src-dir --import-alias "@/*" --use-pnpm
```

Set `"name": "@sobrebox/web"` in `apps/web/package.json`. Add deps:

```bash
pnpm --filter @sobrebox/web add @tanstack/react-query
pnpm --filter @sobrebox/web add '@sobrebox/shared@workspace:*'
pnpm --filter @sobrebox/web add -D vitest@2.1.9 @vitest/coverage-v8@2.1.9 @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Add `next.config.ts`, `vitest.config.ts`, setup + scripts**

`apps/web/next.config.ts` (transpile the workspace package — harmless even though it ships `dist`):

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@sobrebox/shared'],
};

export default nextConfig;
```

`apps/web/vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
      exclude: [
        '**/*.config.*', '.next/**',
        'app/layout.tsx', 'app/providers.tsx', 'app/collections/page.tsx',
      ],
    },
  },
});
```

> App-router wiring (`layout`, `providers`, the RSC `page`) is excluded — it is
> integration/smoke-tested, not unit-tested. The unit-tested surface is
> `components/**` and `lib/api.ts`, both covered below.

`apps/web/vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Add scripts to `apps/web/package.json`: `"test": "vitest run"`, `"test:cov": "vitest run --coverage"`, `"type-check": "tsc --noEmit"`. (No `test:e2e` — Playwright is deferred to epic 3.)

- [ ] **Step 3: Initialize shadcn/ui baseline** (satisfies spec §3 `components/ui/`)

```bash
pnpm --filter @sobrebox/web dlx shadcn@latest init -d
pnpm --filter @sobrebox/web dlx shadcn@latest add button
```

Expected: creates `apps/web/components/ui/button.tsx` and shadcn config. (`-d` accepts defaults.)

- [ ] **Step 4: Write the failing API-client test, then implement it**

`apps/web/lib/api.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCollections } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('fetchCollections', () => {
  it('returns parsed json on ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => [{ id: '1' }],
    }));
    await expect(fetchCollections()).resolves.toEqual([{ id: '1' }]);
  });

  it('throws on non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchCollections()).rejects.toThrow(/500/);
  });
});
```

Run: `pnpm --filter @sobrebox/web run test -- api` → FAIL (not found).

`apps/web/lib/api.ts`:

```ts
import type { CollectionResponseDto } from '@sobrebox/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function fetchCollections(): Promise<CollectionResponseDto[]> {
  const res = await fetch(`${API_URL}/collections`);
  if (!res.ok) throw new Error(`Failed to fetch collections: ${res.status}`);
  return res.json();
}
```

Run again → PASS, 2 tests.

- [ ] **Step 5: Write the failing component test**

`apps/web/components/collections/collection-list.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CollectionList } from './collection-list';

describe('CollectionList', () => {
  it('renders a collection name per item', () => {
    render(
      <CollectionList
        collections={[
          { id: '1', slug: 'a', name: 'Obsidian Flames', category: 'TCG', status: 'PUBLISHED', source: 'API_IMPORT' },
          { id: '2', slug: 'b', name: 'Skullpanda', category: 'BLIND_BOX', status: 'PUBLISHED', source: 'COMMUNITY' },
        ]}
      />,
    );
    expect(screen.getByText('Obsidian Flames')).toBeInTheDocument();
    expect(screen.getByText('Skullpanda')).toBeInTheDocument();
  });

  it('renders an empty state when there are no collections', () => {
    render(<CollectionList collections={[]} />);
    expect(screen.getByText(/no collections/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm --filter @sobrebox/web run test -- collection-list`
Expected: FAIL — cannot find `./collection-list`.

- [ ] **Step 7: Implement the component**

`apps/web/components/collections/collection-list.tsx`:

```tsx
import type { CollectionResponseDto } from '@sobrebox/shared';

export function CollectionList({ collections }: { collections: CollectionResponseDto[] }) {
  if (collections.length === 0) {
    return <p>No collections yet.</p>;
  }
  return (
    <ul>
      {collections.map((c) => (
        <li key={c.id}>{c.name}</li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 8: Run tests to verify pass**

Run: `pnpm --filter @sobrebox/web run test`
Expected: PASS — api (2) + collection-list (2).

- [ ] **Step 9: Wire the page + providers**

`apps/web/app/providers.tsx`:

```tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

Wrap `app/layout.tsx`'s body children in `<Providers>`. Then `apps/web/app/collections/page.tsx`:

```tsx
import { CollectionList } from '@/components/collections/collection-list';
import { fetchCollections } from '@/lib/api';

export default async function CollectionsPage() {
  const collections = await fetchCollections();
  return (
    <main>
      <h1>Collections</h1>
      <CollectionList collections={collections} />
    </main>
  );
}
```

- [ ] **Step 10: Manual smoke (optional) + commit**

Optional: with infra up + seeded, run api (`pnpm --filter @sobrebox/api run start:dev`) and web (`pnpm --filter @sobrebox/web run dev`), open http://localhost:3001/collections → 3 collections listed.

```bash
git add apps/web
git commit -m "feat(web): scaffold next app, shadcn baseline and collections slice"
```

---

## Task 8: CLAUDE.md rewrite + docs scaffolding

**Files:**
- Rewrite: `CLAUDE.md`
- Create: `docs/FINDINGS.md`, `docs/ENDPOINT_PERMISSIONS.md`

- [ ] **Step 1: Rewrite `CLAUDE.md`** following route-page-app's section order, with SobreBox's actual stack. Required sections, in order:
  1. **Start here** — run `/graphify`; read `docs/FINDINGS.md` before debugging; append-findings convention.
  2. **Skills & superpowers (MANDATORY)** — process skills first, then implementation.
  3. **TDD policy (MANDATORY)** — red/green/refactor; verification table (backend unit → `make test-backend-unit`; e2e → `make teste2e`; frontend → `make test-frontend-unit`; ambiguous → `make test-all`).
  4. **Coverage gate (MANDATORY)** — 80% both apps; `make test-coverage-check` before PR; no lowering; allowed ignores (`*.module.ts`, migrations, `seed.ts`, `main.ts`, `prisma.service.ts`).
  5. **Module strategy** — the rule from this plan's "Module & tooling strategy": shared builds to `dist` (CJS); api/shared CommonJS, no `.js` extensions; seed via `tsx`; web uses `transpilePackages`; rebuild shared (`make build-shared`) after changing it.
  6. **Project overview** — SobreBox (surprise-box tracking + stats + marketplace).
  7. **Architecture** — monorepo table (apps/api NestJS+Prisma, apps/web Next.js, packages/shared, infra in docker-compose).
  8. **Catalog model** — Approach C: typed spine + per-category PackModel Zod registry in `packages/shared`; official vs empirical pull rates; open-wiki + revisions + reactive moderation. Note the sanctioned Prisma↔shared enum duplication + parity test.
  9. **Backend modules** — list (auth, users, collections, openings, inventory, marketplace, stats, notifications, storage, prisma, common) — mark which exist (collections, health, prisma, common) vs planned.
  10. **Endpoint permissions** — point to `docs/ENDPOINT_PERMISSIONS.md`; keep it updated with endpoint changes.
  11. **Frontend structure** — app/, components/ui (shadcn), components/<domain>/, lib/, TanStack Query, Zustand.
  12. **Dev workflow** — `make up`, `make migration-run`, `make fixtures`, `make migrate name=...`, test targets, `make shell-db`.
  13. **Domain glossary** — keep the concept table from the current CLAUDE.md (Collection, CollectionItem, PackType, Opening, etc.).
  14. **Rules** — Prisma schema in `apps/api/prisma`; DTOs/Zod/enums in `packages/shared` (no duplication except the sanctioned Prisma enums); Rarity enum only — no hardcoded rarity strings; pull rates only in `stats/`; images only via `storage/`; no `any`.
  15. **Git & GitHub** — commits/branches OK, never push, conventional commits, `gh` allowed.

> Preserve the domain glossary + rules already in the current `CLAUDE.md`; change only stack references (TypeORM→Prisma, apps layout, make commands, module strategy).

- [ ] **Step 2: Create `docs/ENDPOINT_PERMISSIONS.md`**

```markdown
# Endpoint Permissions

> Last generated: 2026-06-19. Update in the same change as any endpoint change.

| Method | Path          | Auth   | Notes                         |
|--------|---------------|--------|-------------------------------|
| GET    | /health       | Public | Liveness check                |
| GET    | /collections  | Public | Lists PUBLISHED collections   |
```

- [ ] **Step 3: Create `docs/FINDINGS.md`**

```markdown
# Findings — non-obvious gotchas

> Append an entry whenever something costs real time and isn't derivable from the code.

- Infra (db/redis/mailpit) runs in docker-compose; api/web run on host in Phase 0.
  e2e/seed need `make up` + `make migration-run` + `make fixtures` first.
- `@sobrebox/shared` is BUILT (`tsc` → `dist`, CommonJS) and consumed as compiled
  JS. Rebuild it (`make build-shared`, or `pnpm --filter @sobrebox/shared run build`)
  after editing it, or api/web/seed will import stale code. The makefile test
  targets and `make fixtures` build it automatically.
- The seed runs under `tsx` (not ts-node) so it can import `@sobrebox/shared`.
- Prisma `Decimal` fields (`officialPullRate`, `price`) serialize to STRINGS over
  HTTP — model them as `z.string()` (or coerce) in shared DTOs, never `number`.
- Prisma enums (schema.prisma) and shared TS enums are intentionally duplicated
  (Prisma can't reference a TS enum). `apps/api/src/catalog/enum-parity.spec.ts`
  fails if they ever drift.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/FINDINGS.md docs/ENDPOINT_PERMISSIONS.md
git commit -m "docs: rewrite CLAUDE.md for SobreBox stack and add ops docs"
```

---

## Task 9: Final verification

- [ ] **Step 1: Build shared, then lint + type-check the monorepo**

Run: `pnpm --filter @sobrebox/shared run build && pnpm run lint && pnpm run type-check`
Expected: clean (fix any issues before proceeding).

- [ ] **Step 2: Full coverage gate**

Run: `make up && make migration-run && make fixtures && make test-coverage-check`
Expected: backend + frontend unit suites pass with ≥80% on all four metrics. (`test-coverage-check` builds shared first.)

- [ ] **Step 3: Run graphify**

Run: `/graphify` (builds `graphify-out/graph.json`).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore(foundation): graphify graph + final phase-0 verification"
```

---

## Self-review notes (post adversarial verification)

A 4-agent adversarial review (11 critical / 7 major / 11 minor) was run against the
first draft; all findings are folded in above. Key resolutions:

- **Root cause of ~10 criticals — raw-TS shared consumption — fixed** by giving
  `@sobrebox/shared` a real `tsc` build to `dist` (CommonJS) consumed as compiled JS.
- **Module coherence:** CommonJS across api+shared, zero `.js` import extensions,
  default Nest ts-jest; seed via `tsx`; web keeps Bundler + `transpilePackages`.
- **`rm -rf` not `rmdir`** (scaffold dirs contain `.git` pointer files).
- **shadcn baseline** added (Task 7 Step 3); **enum-parity guard** added (Task 5);
  **ZodValidationPipe** now has a unit test (Task 6); **Playwright deferred** to
  epic 3 (no dangling e2e target); **query-keys.ts dropped** (YAGNI); `Decimal`
  serialization documented in FINDINGS; vitest/coverage versions pinned equal.
- **Spec coverage:** §4 spine → Task 5; §5 PackModel → Task 3; §3 tooling → Tasks
  1–2; §8 testing → gates in Tasks 3/4/5/6/7/9; §6 population deferred to epic 2.
- **Type consistency:** `validatePackModel`, `collectionResponseSchema`/
  `CollectionResponseDto`, `CollectionsService.findAll`, `fetchCollections`,
  `CollectionList`, `ZodValidationPipe`, `Providers` each defined once, reused by
  exact name.
- **Deferred to epic 2:** API importers, wiki editing UI, revisions write path,
  moderation actions, empirical pull-rate computation.
```
