# Pre-merge polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Before merging the Epic 4 (inventory + wishlist) slice, ship three independent improvements: persist the web session across hard reloads, add real i18n (next-intl, es+en) that also fixes the raw-error-code leak, and move the DB seed data into JSON fixtures.

**Architecture:** Three independent parts on the current `feat/inventory-wishlist` branch, implemented in order **A → B → C** as separate commit groups. (A) Backend seed reads Zod-validated JSON fixtures. (B) A client `AuthProvider` rehydrates the in-memory access token on mount via the existing `/auth/refresh` httpOnly cookie. (C) next-intl with `app/[locale]/` routing, es/en catalogs, type-safe messages, and shared error-code constants mapped to translated messages.

**Tech Stack:** NestJS 10 + Prisma 6 (CommonJS) + Zod 3 (`@sobrebox/shared`), Next 16.2.9 App Router + next-intl v4 + TanStack Query v5 + Zustand 5, Jest (api), Vitest + Testing Library + jsdom (web/shared).

## Global Constraints

- **Module strategy:** `@sobrebox/shared` compiles to `dist/` (CommonJS). Run `pnpm build:shared` after editing it or api/web/seed import stale code. No `.js` extensions in api/shared imports.
- **Prisma pinned to v6.** When the schema/client are in the docker dev stack, regenerate inside the container (`docker compose exec sobrebox-api pnpm --filter @sobrebox/api exec prisma generate`) — host regen is masked by the anonymous `node_modules` volume.
- **No `any`** — use `unknown` + type guards or domain types (`strictNullChecks` is off in api; still avoid `any`).
- **No bare enum / magic strings** — import enums and the new `AUTH_ERROR_CODES` from `@sobrebox/shared`.
- **TDD required** for services/lib/schemas/hooks/components. **Coverage gate 80%** (statements/branches/functions/lines) across api/web/shared; `pnpm pr-check` (lint + `test:cov`) must pass before PR. Never lower the threshold.
- **Commits:** Conventional Commits, English, scope = module/folder. **Never `git push`** (developer pushes).
- **i18n locales:** `es` (default) + `en`. `localePrefix: 'as-needed'`.

---

# PART A — JSON seed fixtures (backend)

## Task A1: Zod fixture schema + loader + JSON files (TDD)

**Files:**

- Modify: `apps/api/tsconfig.json` (add `resolveJsonModule`)
- Create: `apps/api/prisma/fixtures/brands.json`
- Create: `apps/api/prisma/fixtures/collections.json`
- Create: `apps/api/prisma/fixtures.ts` (schema + `loadFixtures`)
- Test: `apps/api/src/prisma-fixtures.spec.ts`

**Interfaces:**

- Produces: `loadFixtures(): { brands: BrandFixture[]; collections: CollectionFixture[] }`, `brandFixtureSchema`, `collectionFixtureSchema`. Enum strings are coerced to `Rarity`/`CollectionCategory`/`CollectionStatus`/`CollectionSource`. `packModel` stays raw JSON (validated separately by `validatePackModel` in the seed).

- [ ] **Step 1: Enable JSON imports for ts-jest.** In `apps/api/tsconfig.json`, add to `compilerOptions`:

```jsonc
"resolveJsonModule": true,
```

- [ ] **Step 2: Create `apps/api/prisma/fixtures/brands.json`:**

```json
[
  { "slug": "pokemon", "name": "Pokémon" },
  { "slug": "funko", "name": "Funko" },
  { "slug": "pop-mart", "name": "Pop Mart" }
]
```

- [ ] **Step 3: Create `apps/api/prisma/fixtures/collections.json`** (mirrors the current inline data, nested items + packTypes, enum values as strings, `itemId: "placeholder"` kept as-is):

```json
[
  {
    "slug": "sv-obsidian-flames",
    "name": "Scarlet & Violet — Obsidian Flames",
    "brandSlug": "pokemon",
    "category": "TCG",
    "status": "PUBLISHED",
    "source": "API_IMPORT",
    "releaseYear": 2023,
    "items": [
      { "name": "Charizard ex", "rarity": "ULTRA_RARE" },
      { "name": "Pikachu", "rarity": "COMMON" }
    ],
    "packTypes": [
      {
        "name": "Booster",
        "packModel": {
          "slots": [
            { "rarity": "COMMON", "count": 5 },
            { "rarity": "RARE", "count": 1 }
          ]
        }
      }
    ]
  },
  {
    "slug": "funko-marvel",
    "name": "Funko Pop! — Marvel",
    "brandSlug": "funko",
    "category": "FIGURE",
    "status": "PUBLISHED",
    "source": "COMMUNITY",
    "releaseYear": null,
    "items": [{ "name": "Spider-Man", "rarity": "COMMON" }],
    "packTypes": [
      {
        "name": "Single Box",
        "packModel": { "items": [{ "itemId": "placeholder" }] }
      }
    ]
  },
  {
    "slug": "skullpanda-the-sound",
    "name": "Skullpanda — The Sound",
    "brandSlug": "pop-mart",
    "category": "BLIND_BOX",
    "status": "PUBLISHED",
    "source": "COMMUNITY",
    "releaseYear": null,
    "items": [
      { "name": "Melody", "rarity": "COMMON" },
      { "name": "Secret Chase", "rarity": "SECRET" }
    ],
    "packTypes": [
      {
        "name": "Case",
        "packModel": {
          "caseSize": 12,
          "assortment": [{ "itemId": "placeholder", "count": 11 }],
          "chase": { "itemId": "placeholder", "odds": 144 }
        }
      }
    ]
  }
]
```

> Note: the current inline seed wires `brandId` directly. Fixtures reference the brand by `brandSlug` (resolved to an id in Task A2) — fixtures must not hardcode generated ids.

- [ ] **Step 4: Write the failing test** `apps/api/src/prisma-fixtures.spec.ts`:

```ts
import { Rarity } from '@prisma/client';
import { loadFixtures, collectionFixtureSchema } from '../prisma/fixtures';

describe('seed fixtures', () => {
  it('loads and coerces the real fixture files', () => {
    const { brands, collections } = loadFixtures();
    expect(brands.map((b) => b.slug)).toContain('pokemon');
    const obsidian = collections.find((c) => c.slug === 'sv-obsidian-flames');
    expect(obsidian?.brandSlug).toBe('pokemon');
    expect(obsidian?.items[0].rarity).toBe(Rarity.ULTRA_RARE);
  });

  it('rejects an invalid rarity', () => {
    expect(
      collectionFixtureSchema.safeParse({
        slug: 's',
        name: 'N',
        brandSlug: 'b',
        category: 'TCG',
        status: 'PUBLISHED',
        source: 'COMMUNITY',
        releaseYear: null,
        items: [{ name: 'X', rarity: 'NOT_A_RARITY' }],
        packTypes: [],
      }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 5: Run it to confirm it fails**

Run: `pnpm --filter @sobrebox/api test -- prisma-fixtures`
Expected: FAIL — `../prisma/fixtures` does not exist.

- [ ] **Step 6: Implement `apps/api/prisma/fixtures.ts`:**

```ts
import { z } from 'zod';
import {
  CollectionCategory,
  CollectionSource,
  CollectionStatus,
} from '@sobrebox/shared';
import { Rarity } from '@prisma/client';
import brandsJson from './fixtures/brands.json';
import collectionsJson from './fixtures/collections.json';

export const brandFixtureSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
});
export type BrandFixture = z.infer<typeof brandFixtureSchema>;

const itemFixtureSchema = z.object({
  name: z.string().min(1),
  rarity: z.nativeEnum(Rarity),
});

const packTypeFixtureSchema = z.object({
  name: z.string().min(1),
  // packModel is category-specific JSON; validated by validatePackModel in the seed.
  packModel: z.record(z.unknown()),
});

export const collectionFixtureSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  brandSlug: z.string().min(1),
  category: z.nativeEnum(CollectionCategory),
  status: z.nativeEnum(CollectionStatus),
  source: z.nativeEnum(CollectionSource),
  releaseYear: z.number().int().nullable(),
  items: z.array(itemFixtureSchema),
  packTypes: z.array(packTypeFixtureSchema),
});
export type CollectionFixture = z.infer<typeof collectionFixtureSchema>;

export function loadFixtures(): {
  brands: BrandFixture[];
  collections: CollectionFixture[];
} {
  return {
    brands: z.array(brandFixtureSchema).parse(brandsJson),
    collections: z.array(collectionFixtureSchema).parse(collectionsJson),
  };
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm build:shared && pnpm --filter @sobrebox/api test -- prisma-fixtures`
Expected: PASS.

> `prisma/fixtures.ts` lives outside the jest `rootDir` (`src`), so it is unit-tested but not coverage-collected — same treatment as `seed.ts` (seed infra). No gate impact.

- [ ] **Step 8: Commit**

```bash
git add apps/api/tsconfig.json apps/api/prisma/fixtures apps/api/prisma/fixtures.ts apps/api/src/prisma-fixtures.spec.ts
git commit -m "feat(seed): add Zod-validated JSON fixtures + loader"
```

---

## Task A2: Refactor `seed.ts` to use the loader

**Files:**

- Modify: `apps/api/prisma/seed.ts`

**Interfaces:**

- Consumes: `loadFixtures` (Task A1), `validatePackModel` (`@sobrebox/shared`).

- [ ] **Step 1: Replace the inline data in `apps/api/prisma/seed.ts`** with the loader. Full new file:

```ts
import { PrismaClient, Prisma } from '@prisma/client';
import { CollectionCategory, validatePackModel } from '@sobrebox/shared';
import { loadFixtures } from './fixtures';

const prisma = new PrismaClient();

async function main() {
  const { brands, collections } = loadFixtures();

  // Validate every pack model against its category schema before writing.
  for (const c of collections) {
    for (const pt of c.packTypes) {
      if (!validatePackModel(c.category, pt.packModel).success) {
        throw new Error(
          `Seed pack model invalid for ${c.slug} / ${pt.name} (${c.category})`,
        );
      }
    }
  }

  // Brands: idempotent upsert by slug → slug→id map for collection FKs.
  const brandIdBySlug = new Map<string, string>();
  for (const b of brands) {
    const row = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: {},
      create: { slug: b.slug, name: b.name },
    });
    brandIdBySlug.set(b.slug, row.id);
  }

  for (const c of collections) {
    const brandId = brandIdBySlug.get(c.brandSlug);
    if (!brandId) throw new Error(`Unknown brandSlug "${c.brandSlug}"`);
    await prisma.collection.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        slug: c.slug,
        name: c.name,
        brandId,
        category: c.category,
        status: c.status,
        source: c.source,
        releaseYear: c.releaseYear ?? null,
        items: {
          create: c.items.map((i) => ({ name: i.name, rarity: i.rarity })),
        },
        packTypes: {
          create: c.packTypes.map((pt) => ({
            name: pt.name,
            packModel: pt.packModel as Prisma.InputJsonValue,
          })),
        },
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Run the seed against the dev DB** (infra up + migrations applied)

Run: `pnpm db:seed`
Expected: completes without error; re-running is idempotent (upserts).

- [ ] **Step 3: Spot-check the data**

Run: `pnpm --filter @sobrebox/api exec prisma studio` _(or)_ `pnpm db:shell` then `SELECT slug FROM "Collection";`
Expected: the 3 collections present with their items/packTypes.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/seed.ts
git commit -m "refactor(seed): read fixtures from JSON via loader"
```

---

# PART B — Session persistence (web)

## Task B1: Auth store hydration status (TDD)

**Files:**

- Modify: `apps/web/lib/auth-store.ts`
- Test: `apps/web/lib/auth-store.test.ts`

**Interfaces:**

- Produces: `AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'`; store adds `status`, `setStatus(status)`, `setAccessToken(token)`. `setSession` → `status: 'authenticated'`; `clear` → `status: 'unauthenticated'`.

- [ ] **Step 1: Write the failing test** `apps/web/lib/auth-store.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { useAuthStore } from './auth-store';

const user = {
  id: 'u1',
  email: 'a@b',
  username: 'neo',
  emailVerified: true,
  avatarUrl: null,
};

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      user: null,
      status: 'loading',
    });
  });

  it('starts in loading', () => {
    expect(useAuthStore.getState().status).toBe('loading');
  });

  it('setSession authenticates', () => {
    useAuthStore.getState().setSession('tok', user);
    const s = useAuthStore.getState();
    expect(s.accessToken).toBe('tok');
    expect(s.user).toEqual(user);
    expect(s.status).toBe('authenticated');
  });

  it('clear unauthenticates', () => {
    useAuthStore.getState().setSession('tok', user);
    useAuthStore.getState().clear();
    const s = useAuthStore.getState();
    expect(s.accessToken).toBeNull();
    expect(s.status).toBe('unauthenticated');
  });

  it('setAccessToken keeps the user', () => {
    useAuthStore.getState().setSession('tok', user);
    useAuthStore.getState().setAccessToken('tok2');
    const s = useAuthStore.getState();
    expect(s.accessToken).toBe('tok2');
    expect(s.user).toEqual(user);
  });

  it('setStatus updates only status', () => {
    useAuthStore.getState().setStatus('unauthenticated');
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @sobrebox/web test -- auth-store`
Expected: FAIL — `status`/`setStatus`/`setAccessToken` do not exist.

- [ ] **Step 3: Implement `apps/web/lib/auth-store.ts`:**

```ts
import { create } from 'zustand';
import type { PublicUserDto } from '@sobrebox/shared';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  accessToken: string | null;
  user: PublicUserDto | null;
  status: AuthStatus;
  setSession: (accessToken: string, user: PublicUserDto) => void;
  setAccessToken: (accessToken: string) => void;
  setStatus: (status: AuthStatus) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: 'loading',
  setSession: (accessToken, user) =>
    set({ accessToken, user, status: 'authenticated' }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setStatus: (status) => set({ status }),
  clear: () =>
    set({ accessToken: null, user: null, status: 'unauthenticated' }),
}));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @sobrebox/web test -- auth-store`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/auth-store.ts apps/web/lib/auth-store.test.ts
git commit -m "feat(web): add hydration status to auth store"
```

---

## Task B2: `refreshSession` + 401 refresh-and-retry (TDD)

**Files:**

- Modify: `apps/web/lib/api.ts`
- Test: `apps/web/lib/api.test.ts` (extend)

**Interfaces:**

- Produces: `refreshSession(): Promise<{ accessToken: string }>`. `authedJson` retries once on `401`: refresh → `useAuthStore.getState().setAccessToken(newToken)` → retry with the new token; on refresh failure it clears the store and rethrows.

- [ ] **Step 1: Write the failing test** (add to `apps/web/lib/api.test.ts`):

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { refreshSession, fetchWishlist } from './api';
import { useAuthStore } from './auth-store';

describe('refreshSession + 401 retry', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'old',
      user: null,
      status: 'authenticated',
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('refreshSession posts to /api/auth/refresh', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ accessToken: 'new' }), { status: 200 }),
      );
    expect(await refreshSession()).toEqual({ accessToken: 'new' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('retries an authed call once after a 401 by refreshing', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 401 })) // wishlist 401
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'new' }), { status: 200 }),
      ) // refresh
      .mockResolvedValueOnce(new Response('[]', { status: 200 })); // retry
    const data = await fetchWishlist('old');
    expect(data).toEqual([]);
    expect(useAuthStore.getState().accessToken).toBe('new');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @sobrebox/web test -- api.test`
Expected: FAIL — `refreshSession` not exported; no retry behavior.

- [ ] **Step 3: Implement.** In `apps/web/lib/api.ts` add the import and `refreshSession`, and rewrite `authedJson` to retry once on 401:

```ts
import { useAuthStore } from '@/lib/auth-store';

export async function refreshSession(): Promise<{ accessToken: string }> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
  return res.json() as Promise<{ accessToken: string }>;
}

async function authedJson<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
  retry = true,
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
  if (res.status === 401 && retry) {
    try {
      const { accessToken: fresh } = await refreshSession();
      useAuthStore.getState().setAccessToken(fresh);
      return authedJson<T>(path, fresh, init, false);
    } catch {
      useAuthStore.getState().clear();
      throw new Error('Request failed: 401');
    }
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(data?.message ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
```

> `init.body` is re-sent on retry because the same `init` object is passed through — fine for the JSON string bodies used here.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @sobrebox/web test -- api.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/api.ts apps/web/lib/api.test.ts
git commit -m "feat(web): add refreshSession + 401 refresh-and-retry"
```

---

## Task B3: `AuthProvider` rehydrate-on-mount (TDD) + mount it

**Files:**

- Create: `apps/web/components/auth/auth-provider.tsx`
- Test: `apps/web/components/auth/auth-provider.test.tsx`
- Modify: `apps/web/app/providers.tsx`

**Interfaces:**

- Consumes: `refreshSession`, `fetchMe` (`lib/api`), `useAuthStore`.
- Produces: `<AuthProvider>{children}</AuthProvider>` — on mount, when `status === 'loading'` and no token, refreshes + loads the user; renders children unconditionally.

- [ ] **Step 1: Write the failing test** `apps/web/components/auth/auth-provider.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from './auth-provider';
import { useAuthStore } from '@/lib/auth-store';
import * as api from '@/lib/api';

const user = {
  id: 'u1',
  email: 'a@b',
  username: 'neo',
  emailVerified: true,
  avatarUrl: null,
};

describe('AuthProvider', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, status: 'loading' });
  });
  afterEach(() => vi.restoreAllMocks());

  it('rehydrates the session on mount', async () => {
    vi.spyOn(api, 'refreshSession').mockResolvedValue({ accessToken: 'tok' });
    vi.spyOn(api, 'fetchMe').mockResolvedValue(user);
    render(<AuthProvider>hi</AuthProvider>);
    await waitFor(() =>
      expect(useAuthStore.getState().status).toBe('authenticated'),
    );
    expect(useAuthStore.getState().accessToken).toBe('tok');
    expect(screen.getByText('hi')).toBeInTheDocument();
  });

  it('marks unauthenticated when refresh fails', async () => {
    vi.spyOn(api, 'refreshSession').mockRejectedValue(new Error('401'));
    render(<AuthProvider>hi</AuthProvider>);
    await waitFor(() =>
      expect(useAuthStore.getState().status).toBe('unauthenticated'),
    );
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @sobrebox/web test -- auth-provider`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement `apps/web/components/auth/auth-provider.tsx`:**

```tsx
'use client';
import { useEffect } from 'react';
import { refreshSession, fetchMe } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const { accessToken, status } = useAuthStore.getState();
    // Already hydrated this session (e.g. just logged in) — skip.
    if (accessToken || status !== 'loading') return;
    let active = true;
    refreshSession()
      .then(async ({ accessToken: tok }) => {
        const user = await fetchMe(tok);
        if (active) useAuthStore.getState().setSession(tok, user);
      })
      .catch(() => {
        if (active) useAuthStore.getState().setStatus('unauthenticated');
      });
    return () => {
      active = false;
    };
  }, []);

  return <>{children}</>;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @sobrebox/web test -- auth-provider`
Expected: PASS.

- [ ] **Step 5: Mount it in `apps/web/app/providers.tsx`** (inside `QueryClientProvider`):

```tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { AuthProvider } from '@/components/auth/auth-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
```

- [ ] **Step 6: Type-check + commit**

Run: `pnpm --filter @sobrebox/web type-check`
Expected: PASS.

```bash
git add apps/web/components/auth/auth-provider.tsx apps/web/components/auth/auth-provider.test.tsx apps/web/app/providers.tsx
git commit -m "feat(web): rehydrate session on mount via AuthProvider"
```

---

## Task B4: Authed components branch on status (TDD)

**Files:**

- Modify: `apps/web/components/inventory/inventory-progress.tsx`
- Modify: `apps/web/components/wishlist/wishlist-list.tsx`
- Modify: `apps/web/components/inventory/collection-ownership-panel.tsx`
- Test: extend the three components' existing tests (`*.test.tsx` colocated)

**Interfaces:**

- Consumes: `useAuthStore` `status` (Task B1). `loading` → skeleton/`null` (no login prompt); `unauthenticated` → existing prompt; `authenticated` → data.

- [ ] **Step 1: Write a failing test** in `apps/web/components/inventory/inventory-progress.test.tsx` (add):

```tsx
it('does not show the login prompt while auth is loading', () => {
  useAuthStore.setState({ accessToken: null, user: null, status: 'loading' });
  wrap(<InventoryProgress />);
  expect(screen.queryByText(/Inicia sesión/i)).not.toBeInTheDocument();
});

it('shows the login prompt only when unauthenticated', () => {
  useAuthStore.setState({
    accessToken: null,
    user: null,
    status: 'unauthenticated',
  });
  wrap(<InventoryProgress />);
  expect(screen.getByText(/Inicia sesión/i)).toBeInTheDocument();
});
```

_(Use the file's existing `wrap` helper / `useAuthStore.setState` setup. Mirror the same two tests in `wishlist-list.test.tsx`.)_

- [ ] **Step 2: Run them to confirm they fail**

Run: `pnpm --filter @sobrebox/web test -- inventory-progress`
Expected: FAIL — the loading state currently shows the prompt (token null → prompt).

- [ ] **Step 3: Update `inventory-progress.tsx`** — replace the `if (!accessToken)` guard:

```tsx
const status = useAuthStore((s) => s.status);
const accessToken = useAuthStore((s) => s.accessToken);

const { data, isLoading } = useQuery({
  queryKey: ['inventory', 'progress'],
  queryFn: () => fetchInventoryProgress(accessToken as string),
  enabled: !!accessToken,
});

if (status === 'loading') return <p>Cargando…</p>;
if (status === 'unauthenticated')
  return <p>Inicia sesión para ver tu inventario.</p>;
if (isLoading) return <p>Cargando…</p>;
```

_(rest of the component unchanged.)_

- [ ] **Step 4: Update `wishlist-list.tsx`** the same way:

```tsx
const status = useAuthStore((s) => s.status);
const accessToken = useAuthStore((s) => s.accessToken);
// ...query unchanged...
if (status === 'loading') return <p>Cargando…</p>;
if (status === 'unauthenticated')
  return <p>Inicia sesión para ver tu wishlist.</p>;
if (isLoading) return <p>Cargando…</p>;
```

- [ ] **Step 5: Update `collection-ownership-panel.tsx`** — only render once authenticated:

```tsx
const status = useAuthStore((s) => s.status);
// ...
if (status !== 'authenticated') return null;
if (!data) return null;
```

- [ ] **Step 6: Run the three components' tests**

Run: `pnpm --filter @sobrebox/web test -- inventory-progress wishlist-list collection-ownership-panel`
Expected: PASS. Fix any existing test that assumed token-null → prompt by setting `status: 'unauthenticated'` in that test's setup.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/inventory/inventory-progress.tsx apps/web/components/inventory/inventory-progress.test.tsx apps/web/components/wishlist/wishlist-list.tsx apps/web/components/wishlist/wishlist-list.test.tsx apps/web/components/inventory/collection-ownership-panel.tsx
git commit -m "fix(web): branch authed components on auth status (no login flash)"
```

---

# PART C — i18n (next-intl, es + en)

## Task C1: Shared `AUTH_ERROR_CODES` + parity test (TDD)

**Files:**

- Create: `packages/shared/src/errors/auth-error-codes.ts`
- Create: `packages/shared/src/errors/auth-error-codes.spec.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**

- Produces: `AUTH_ERROR_CODES` (const object), `AuthErrorCode` (union type). Codes enumerated from the strings `auth.service.ts` currently throws: `EMAIL_NOT_VERIFIED`, `INVALID_CREDENTIALS` (add others only if `auth.service.ts` throws them — verify in Task C7).

- [ ] **Step 1: Write the failing test** `packages/shared/src/errors/auth-error-codes.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AUTH_ERROR_CODES } from './auth-error-codes';

describe('AUTH_ERROR_CODES', () => {
  it('maps each key to its own string value', () => {
    for (const [k, v] of Object.entries(AUTH_ERROR_CODES)) expect(v).toBe(k);
  });
  it('includes EMAIL_NOT_VERIFIED', () => {
    expect(AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED).toBe('EMAIL_NOT_VERIFIED');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @sobrebox/shared test -- auth-error-codes`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `packages/shared/src/errors/auth-error-codes.ts`:**

```ts
export const AUTH_ERROR_CODES = {
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
} as const;

export type AuthErrorCode =
  (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];
```

- [ ] **Step 4: Export from `packages/shared/src/index.ts`:**

```ts
export * from './errors/auth-error-codes';
```

- [ ] **Step 5: Rebuild + test**

Run: `pnpm build:shared && pnpm --filter @sobrebox/shared test -- auth-error-codes`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/errors packages/shared/src/index.ts
git commit -m "feat(shared): add AUTH_ERROR_CODES constants"
```

---

## Task C2: Install next-intl + config scaffolding

**Files:**

- Modify: `apps/web/package.json` (add `next-intl`)
- Create: `apps/web/i18n/routing.ts`, `apps/web/i18n/navigation.ts`, `apps/web/i18n/request.ts`
- Create: `apps/web/middleware.ts`
- Modify: `apps/web/next.config.ts`
- Create: `apps/web/locales/es.json`, `apps/web/locales/en.json` (start minimal; filled in C5)

**Interfaces:**

- Produces: `routing` (locales `['es','en']`, default `es`, `localePrefix: 'as-needed'`); locale-aware `Link`/`useRouter`/`usePathname`/`redirect` from `@/i18n/navigation`; request config loading `locales/${locale}.json`.

- [ ] **Step 1: Install next-intl**

Run: `pnpm --filter @sobrebox/web add next-intl`
Expected: `next-intl` (v4.x) added. (Compatible with Next 16.2.9 — if install warns of a peer mismatch, stop and report.)

- [ ] **Step 2: Create `apps/web/i18n/routing.ts`:**

```ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['es', 'en'],
  defaultLocale: 'es',
  localePrefix: 'as-needed',
});
```

- [ ] **Step 3: Create `apps/web/i18n/navigation.ts`:**

```ts
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

- [ ] **Step 4: Create `apps/web/i18n/request.ts`:**

```ts
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = routing.locales.includes(requested as 'es' | 'en')
    ? (requested as 'es' | 'en')
    : routing.defaultLocale;
  return {
    locale,
    messages: (await import(`../locales/${locale}.json`)).default,
  };
});
```

- [ ] **Step 5: Create `apps/web/middleware.ts`** (matcher excludes `/api`, `/_next`, static):

```ts
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Skip the same-origin API proxy, Next internals, and files with an extension.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

- [ ] **Step 6: Wrap `apps/web/next.config.ts` with the plugin** (keep the existing rewrite/standalone config):

```ts
import createNextIntlPlugin from 'next-intl/plugin';
// ...existing imports and nextConfig unchanged...
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
export default withNextIntl(nextConfig);
```

_(Replace the current `export default nextConfig;` line.)_

- [ ] **Step 7: Create minimal `apps/web/locales/es.json` and `apps/web/locales/en.json`** (full catalogs land in C5):

`es.json`:

```json
{ "Common": { "loading": "Cargando…" } }
```

`en.json`:

```json
{ "Common": { "loading": "Loading…" } }
```

- [ ] **Step 8: Commit** (app not yet moved — build is exercised in C4)

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/i18n apps/web/middleware.ts apps/web/next.config.ts apps/web/locales pnpm-lock.yaml
git commit -m "chore(web): scaffold next-intl (routing, request, middleware, plugin)"
```

> The lockfile may be at the repo root — `git add` whichever `pnpm-lock.yaml` changed.

---

## Task C3: Move the app tree under `app/[locale]/`

**Files:**

- Move: everything in `apps/web/app/*` (except `globals.css`, `favicon.ico`) into `apps/web/app/[locale]/`
- Create: `apps/web/app/[locale]/layout.tsx` (locale layout with `NextIntlClientProvider`)
- Rewrite: `apps/web/app/layout.tsx` (minimal root)
- Modify: `apps/web/vitest.config.mts` (remap coverage excludes)

**Interfaces:**

- Produces: localized routes under `/[locale]/...`; `setRequestLocale`-aware layout; `<html lang={locale}>`.

- [ ] **Step 1: Move the routes** (use `git mv` to preserve history):

```bash
cd apps/web
mkdir -p "app/[locale]"
git mv "app/(auth)" "app/[locale]/(auth)"
git mv app/collections "app/[locale]/collections"
git mv app/inventory "app/[locale]/inventory"
git mv app/wishlist "app/[locale]/wishlist"
git mv app/profile "app/[locale]/profile"
git mv app/page.tsx "app/[locale]/page.tsx"
git mv app/providers.tsx "app/[locale]/providers.tsx"
# keep app/globals.css, app/favicon.ico, app/layout.tsx at the root
```

- [ ] **Step 2: Rewrite the root `apps/web/app/layout.tsx`** to a minimal shell (fonts + html move to the locale layout; root must still render `<html>` for Next, but next-intl recommends locale on the inner html — use a passthrough root that only renders children):

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SobreBox',
  description: 'Track, analyze and trade surprise-box collectibles.',
};

// The locale layout (app/[locale]/layout.tsx) renders <html>/<body>.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
```

- [ ] **Step 3: Create `apps/web/app/[locale]/layout.tsx`** (owns `<html>`/`<body>`, fonts, providers, header, and `NextIntlClientProvider`):

```tsx
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import '../globals.css';
import { Providers } from './providers';
import { SiteHeader } from '@/components/layout/site-header';
import { routing } from '@/i18n/routing';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '800'],
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-code',
  weight: ['400', '500'],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${jakartaSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased">
        <NextIntlClientProvider>
          <Providers>
            <SiteHeader />
            <main className="container mx-auto px-6 py-8">{children}</main>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Remap web coverage excludes** in `apps/web/vitest.config.mts` so the moved pages stay excluded and i18n infra isn't gated:

```ts
exclude: [
  '**/*.config.*', '.next/**', 'components/ui/**',
  'next-env.d.ts', 'vitest.setup.ts', 'coverage/**',
  'lib/utils.ts',
  'scripts/**',
  'i18n/**',
  'middleware.ts',
  'app/**', // App Router pages — integration-tested, excluded from unit coverage
],
```

_(Collapse the old `app/(auth)/**` + `app/profile/**` entries into `app/**`, matching the moved tree. Components under `components/**` stay covered.)_

- [ ] **Step 5: Boot the dev server to verify routing**

Run: `pnpm --filter @sobrebox/web dev` (with infra + api up), then open `/` (should serve `es`) and `/en`.
Expected: pages render; `/inventory` works (default-locale, no prefix); `/en/inventory` works.

- [ ] **Step 6: Type-check + commit**

Run: `pnpm --filter @sobrebox/web type-check`
Expected: PASS (fix any import that referenced a moved path).

```bash
git add apps/web/app apps/web/vitest.config.mts
git commit -m "feat(web): move app routes under [locale] with NextIntlClientProvider"
```

---

## Task C4: Catalogs + type-safe messages + migrate component strings (TDD)

**Files:**

- Modify: `apps/web/locales/es.json`, `apps/web/locales/en.json` (full namespaces)
- Create: `apps/web/global.d.ts` (message type augmentation)
- Modify: `apps/web/components/inventory/inventory-progress.tsx`, `apps/web/components/wishlist/wishlist-list.tsx`, `apps/web/components/inventory/collection-ownership-panel.tsx`, and pages `app/[locale]/inventory/page.tsx`, `app/[locale]/wishlist/page.tsx`
- Modify: the three component tests to wrap in `NextIntlClientProvider`

**Interfaces:**

- Consumes: `useTranslations` (next-intl). Components read strings from namespaces `Inventory`, `Wishlist`, `Collections`, `Common`.

- [ ] **Step 1: Fill `apps/web/locales/es.json`:**

```json
{
  "Common": { "loading": "Cargando…" },
  "Nav": { "login": "Entrar", "register": "Crear cuenta", "logout": "Salir" },
  "Inventory": {
    "title": "Mi inventario",
    "loginPrompt": "Inicia sesión para ver tu inventario.",
    "empty": "Todavía no tienes ítems. Marca lo que tienes desde una colección.",
    "progress": "{owned} / {total} · {percent}%"
  },
  "Wishlist": {
    "title": "Mi wishlist",
    "loginPrompt": "Inicia sesión para ver tu wishlist.",
    "empty": "Tu wishlist está vacía.",
    "remove": "Quitar",
    "maxPrice": "máx {price}€"
  },
  "Collections": {
    "progressTitle": "Tu progreso",
    "have": "Tengo {name}",
    "addOne": "+1 {name}",
    "missing": "(te falta)",
    "wishlist": "Wishlist"
  },
  "Errors": {
    "EMAIL_NOT_VERIFIED": "Verifica tu correo antes de iniciar sesión.",
    "INVALID_CREDENTIALS": "Email o contraseña incorrectos.",
    "UNKNOWN": "Algo salió mal. Inténtalo de nuevo."
  }
}
```

- [ ] **Step 2: Fill `apps/web/locales/en.json`** (same keys, English):

```json
{
  "Common": { "loading": "Loading…" },
  "Nav": { "login": "Log in", "register": "Sign up", "logout": "Log out" },
  "Inventory": {
    "title": "My inventory",
    "loginPrompt": "Log in to see your inventory.",
    "empty": "No items yet. Mark what you own from a collection.",
    "progress": "{owned} / {total} · {percent}%"
  },
  "Wishlist": {
    "title": "My wishlist",
    "loginPrompt": "Log in to see your wishlist.",
    "empty": "Your wishlist is empty.",
    "remove": "Remove",
    "maxPrice": "max {price}€"
  },
  "Collections": {
    "progressTitle": "Your progress",
    "have": "Have {name}",
    "addOne": "+1 {name}",
    "missing": "(missing)",
    "wishlist": "Wishlist"
  },
  "Errors": {
    "EMAIL_NOT_VERIFIED": "Please verify your email before logging in.",
    "INVALID_CREDENTIALS": "Wrong email or password.",
    "UNKNOWN": "Something went wrong. Please try again."
  }
}
```

- [ ] **Step 3: Add `apps/web/global.d.ts`** for type-safe keys:

```ts
import type es from './locales/es.json';

declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof es;
  }
}
```

- [ ] **Step 4: Write the failing test** in `apps/web/components/wishlist/wishlist-list.test.tsx` — wrap renders in `NextIntlClientProvider` and assert a translated string. Update the file's `wrap` helper:

```tsx
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/locales/es.json';

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

it('shows the translated empty state', async () => {
  useAuthStore.setState({
    accessToken: 'tok',
    user: null,
    status: 'authenticated',
  });
  vi.spyOn(api, 'fetchWishlist').mockResolvedValue([]);
  wrap(<WishlistList />);
  await waitFor(() =>
    expect(screen.getByText('Tu wishlist está vacía.')).toBeInTheDocument(),
  );
});
```

_(Apply the same `wrap` change to `inventory-progress.test.tsx` and `collection-ownership-panel.test.tsx`.)_

- [ ] **Step 5: Run it to confirm it fails**

Run: `pnpm --filter @sobrebox/web test -- wishlist-list`
Expected: FAIL — component still renders the hardcoded string / `useTranslations` throws without a provider.

- [ ] **Step 6: Migrate `wishlist-list.tsx`** to translations:

```tsx
import { useTranslations } from 'next-intl';
// inside the component:
const t = useTranslations('Wishlist');
// ...
if (status === 'unauthenticated') return <p>{t('loginPrompt')}</p>;
if (status === 'loading' || isLoading) return <p>{t('loading' as never)}</p>;
if (!data || data.length === 0)
  return <p className="text-muted-foreground">{t('empty')}</p>;
// row maxPrice + button:
{
  w.maxPrice ? ` · ${t('maxPrice', { price: w.maxPrice })}` : '';
}
// ...
{
  t('remove');
}
```

> For shared strings like "Cargando…" use a second `const tc = useTranslations('Common'); tc('loading')` rather than the `as never` cast. Apply that pattern in all three components.

- [ ] **Step 7: Migrate `inventory-progress.tsx`** (`useTranslations('Inventory')` + `Common`): `loginPrompt`, `empty`, `loading`, and `t('progress', { owned, total, percent })`.

- [ ] **Step 8: Migrate `collection-ownership-panel.tsx`** (`useTranslations('Collections')`): `progressTitle`, `have`/`addOne` with `{name}`, `missing`, `wishlist`.

- [ ] **Step 9: Migrate the pages** `app/[locale]/inventory/page.tsx` and `app/[locale]/wishlist/page.tsx` to use `useTranslations` for their `<h1>` (make them client components or read via `getTranslations` server-side):

```tsx
import { getTranslations } from 'next-intl/server';
import { InventoryProgress } from '@/components/inventory/inventory-progress';

export default async function InventoryPage() {
  const t = await getTranslations('Inventory');
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>
      <InventoryProgress />
    </main>
  );
}
```

- [ ] **Step 10: Run the component tests + type-check**

Run: `pnpm --filter @sobrebox/web test -- inventory-progress wishlist-list collection-ownership-panel && pnpm --filter @sobrebox/web type-check`
Expected: PASS (type-check validates message keys against `es.json`).

- [ ] **Step 11: Commit**

```bash
git add apps/web/locales apps/web/global.d.ts apps/web/components apps/web/app/[locale]/inventory/page.tsx apps/web/app/[locale]/wishlist/page.tsx
git commit -m "feat(web): translate inventory/wishlist/collection strings (es+en)"
```

---

## Task C5: Login error → translated message (TDD)

**Files:**

- Create: `apps/web/lib/error-messages.ts` (+ `apps/web/lib/error-messages.test.ts`)
- Create: `apps/web/lib/error-messages.parity.test.ts` (catalog parity over `AUTH_ERROR_CODES`)
- Modify: `apps/web/components/auth/login-form.tsx`

**Interfaces:**

- Consumes: `AUTH_ERROR_CODES` (`@sobrebox/shared`). Produces: `errorMessageKey(code: string): string` → `` `Errors.${code}` `` for known codes, else `'Errors.UNKNOWN'`.

- [ ] **Step 1: Write the failing tests** `apps/web/lib/error-messages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { errorMessageKey } from './error-messages';

describe('errorMessageKey', () => {
  it('maps a known code', () => {
    expect(errorMessageKey('EMAIL_NOT_VERIFIED')).toBe(
      'Errors.EMAIL_NOT_VERIFIED',
    );
  });
  it('falls back to UNKNOWN', () => {
    expect(errorMessageKey('Request failed: 500')).toBe('Errors.UNKNOWN');
  });
});
```

And `apps/web/lib/error-messages.parity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AUTH_ERROR_CODES } from '@sobrebox/shared';
import es from '@/locales/es.json';
import en from '@/locales/en.json';

describe('error catalog parity', () => {
  it('every auth error code has an es + en translation', () => {
    for (const code of Object.values(AUTH_ERROR_CODES)) {
      expect(es.Errors).toHaveProperty(code);
      expect(en.Errors).toHaveProperty(code);
    }
  });
});
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `pnpm --filter @sobrebox/web test -- error-messages`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `apps/web/lib/error-messages.ts`:**

```ts
import { AUTH_ERROR_CODES } from '@sobrebox/shared';

const KNOWN = new Set<string>(Object.values(AUTH_ERROR_CODES));

export function errorMessageKey(code: string): string {
  return KNOWN.has(code) ? `Errors.${code}` : 'Errors.UNKNOWN';
}
```

- [ ] **Step 4: Wire `login-form.tsx`** — translate the server error instead of showing it raw:

```tsx
import { useTranslations } from 'next-intl';
import { errorMessageKey } from '@/lib/error-messages';
// inside the component:
const t = useTranslations();
const [serverErrorKey, setServerErrorKey] = useState<string | null>(null);
// in catch:
setServerErrorKey(errorMessageKey(err instanceof Error ? err.message : ''));
// in JSX:
{
  serverErrorKey && (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{t(serverErrorKey as never)}</AlertDescription>
    </Alert>
  );
}
```

> `login-form.tsx` lives under `components/`, which is coverage-collected. It has an existing test (`login-form.test.tsx` if present) — wrap it in `NextIntlClientProvider` (as in Task C4) and add an assertion that `EMAIL_NOT_VERIFIED` renders the translated message. If no test file exists, create one with that single case.

- [ ] **Step 5: Run + build shared + commit**

Run: `pnpm build:shared && pnpm --filter @sobrebox/web test -- error-messages login-form && pnpm --filter @sobrebox/web type-check`
Expected: PASS.

```bash
git add apps/web/lib/error-messages.ts apps/web/lib/error-messages.test.ts apps/web/lib/error-messages.parity.test.ts apps/web/components/auth/login-form.tsx apps/web/components/auth/login-form.test.tsx
git commit -m "feat(web): translate auth error codes (fixes raw EMAIL_NOT_VERIFIED leak)"
```

---

## Task C6: Locale switcher in the header (TDD)

**Files:**

- Create: `apps/web/components/layout/locale-switcher.tsx` (+ `locale-switcher.test.tsx`)
- Modify: `apps/web/components/layout/site-header.tsx` (mount the switcher; translate nav labels)

**Interfaces:**

- Consumes: `useRouter`, `usePathname` (`@/i18n/navigation`), `useLocale` (next-intl).

- [ ] **Step 1: Write the failing test** `apps/web/components/layout/locale-switcher.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/locales/es.json';
import { LocaleSwitcher } from './locale-switcher';

const replace = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/inventory',
  useRouter: () => ({ replace }),
}));

it('switches to en preserving the path', () => {
  render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <LocaleSwitcher />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'EN' }));
  expect(replace).toHaveBeenCalledWith('/inventory', { locale: 'en' });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @sobrebox/web test -- locale-switcher`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement `apps/web/components/layout/locale-switcher.tsx`:**

```tsx
'use client';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const other = locale === 'es' ? 'en' : 'es';
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.replace(pathname, { locale: other })}
    >
      {other.toUpperCase()}
    </Button>
  );
}
```

- [ ] **Step 4: Mount it in `site-header.tsx`** — add `<LocaleSwitcher />` next to `<ThemeToggle />`, switch `next/link` + `useRouter` to the locale-aware ones from `@/i18n/navigation`, and translate the Login/Register/Logout labels with `useTranslations('Nav')`. Key edits:

```tsx
import { Link, useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { LocaleSwitcher } from './locale-switcher';
// inside: const t = useTranslations('Nav');
// header right cluster: <ThemeToggle /> <LocaleSwitcher /> ...
// labels: {t('login')}, {t('register')}, {t('logout')}
```

> `site-header.test.tsx` already exists — wrap it in `NextIntlClientProvider` (Task C4 pattern) and keep its existing assertions, updating any label text it checks to the translated value.

- [ ] **Step 5: Run tests + type-check**

Run: `pnpm --filter @sobrebox/web test -- locale-switcher site-header && pnpm --filter @sobrebox/web type-check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/layout/locale-switcher.tsx apps/web/components/layout/locale-switcher.test.tsx apps/web/components/layout/site-header.tsx apps/web/components/layout/site-header.test.tsx
git commit -m "feat(web): add locale switcher + translate header nav"
```

---

## Task C7: API throws the shared error-code constant

**Files:**

- Modify: `apps/api/src/auth/auth.service.ts`

**Interfaces:**

- Consumes: `AUTH_ERROR_CODES` (`@sobrebox/shared`). Replaces bare strings; serialized HTTP body is unchanged (`{ message: 'EMAIL_NOT_VERIFIED' }`), so **e2e is unaffected**.

- [ ] **Step 1: Find the bare error strings**

Run: `grep -n "EMAIL_NOT_VERIFIED\|INVALID_CREDENTIALS" apps/api/src/auth/auth.service.ts`
Expected: the throw sites (e.g. `throw new ForbiddenException('EMAIL_NOT_VERIFIED')`). If the invalid-credentials path throws a different string (e.g. a generic message), either add that exact string to `AUTH_ERROR_CODES` (Task C1) or leave it — only codes the web maps need to be constants.

- [ ] **Step 2: Replace them** with the constant:

```ts
import { AUTH_ERROR_CODES } from '@sobrebox/shared';
// ...
if (!user.emailVerified)
  throw new ForbiddenException(AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED);
```

- [ ] **Step 3: Run the auth tests (unit + e2e) to prove behavior is unchanged**

Run: `pnpm build:shared && pnpm --filter @sobrebox/api test -- auth && pnpm --filter @sobrebox/api test:e2e -- auth`
Expected: PASS (the thrown string is identical).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/auth/auth.service.ts
git commit -m "refactor(auth): throw AUTH_ERROR_CODES constants"
```

---

## Task C8: Full gate

**Files:** none (verification only)

- [ ] **Step 1: Rebuild shared + run the whole gate**

Run: `pnpm build:shared && pnpm pr-check`
Expected: lint clean + coverage ≥80% across api/web/shared. If a new web file dips below 80%, add the missing-branch test (e.g. the `errorMessageKey` UNKNOWN path, the `loading` vs `unauthenticated` branches) — do NOT lower the threshold or silently exclude non-infra files.

- [ ] **Step 2: Run the e2e suite with infra up**

Run: `pnpm test:e2e`
Expected: auth + collections + inventory + wishlist e2e all PASS (no API behavior changed).

- [ ] **Step 3: Manual smoke** (dev stack up)

- Log in, then hard-reload `/inventory` and `/wishlist` → still authenticated (no "inicia sesión").
- Log in without verifying email → translated message, not `EMAIL_NOT_VERIFIED`.
- Toggle the locale switcher → strings + URL change (`/inventory` ↔ `/en/inventory`).

---

## Self-Review notes (reconciled)

- **Spec coverage:** Feature 1 session → Tasks B1–B4 (store status, refreshSession+retry, AuthProvider, component branching). Feature 2 i18n → C1 (error codes), C2 (next-intl scaffold), C3 ([locale] move), C4 (catalogs + type-safe + component strings), C5 (login error translation + parity), C6 (switcher + header), C7 (API constants). Feature 3 fixtures → A1 (schema/loader/JSON) + A2 (seed refactor). Gate → C8.
- **Type consistency:** `AuthStatus`, `setAccessToken`, `setStatus`, `setSession` names match across B1/B2/B3/B4. `AUTH_ERROR_CODES`/`AuthErrorCode` consistent across C1/C5/C7. `refreshSession` returns `{ accessToken }` everywhere (matches the real `/auth/refresh` body). `loadFixtures`/`collectionFixtureSchema` names match A1↔A2.
- **No placeholders:** every code/test step carries full code or an exact edit with the new block; fixture JSON mirrors the verified inline seed data.
- **Ordering:** A (backend, isolated) → B (web session) → C (i18n, depends on C1 const + moves the pages). All on `feat/inventory-wishlist`; the developer pushes/merges.
