# Pre-merge polish: session refresh, i18n (next-intl), JSON seed fixtures

**Date:** 2026-06-30
**Branch:** `feat/inventory-wishlist` (lands with PR #9, before merge)
**Status:** approved design

Three independent improvements requested before merging the Epic 4 (inventory + wishlist) slice:

1. **Session persistence** — the in-memory access token is lost on hard reload, so authed pages (`/inventory`, `/wishlist`) wrongly show "inicia sesión".
2. **i18n (next-intl)** — the web has no i18n; a raw API error code (`EMAIL_NOT_VERIFIED`) leaks to the UI on login-before-verify. We want real multi-language support mirroring `route-page-app`, improved where possible.
3. **Seed fixtures in JSON** — move the inline `seed.ts` data into JSON files the script reads, like `route-page-app`.

All three are independent. Implement on the current branch as three separate commit groups, in this order: **fixtures → session → i18n** (i18n is largest, depends on the error-code const, and moves the inventory/wishlist pages under `app/[locale]/`).

---

## Feature 1 — Session persistence (refresh-on-mount)

### Problem

`useAuthStore` (Zustand) keeps `accessToken` only in memory, with no `persist` middleware (`apps/web/lib/auth-store.ts`). Nothing rehydrates it on page load. The backend already issues an httpOnly `refresh_token` cookie and exposes `POST /auth/refresh`, but the frontend never calls it. So any hard navigation / reload / direct URL to an authed page re-initializes the store to `accessToken: null`, and `inventory-progress.tsx` / `wishlist-list.tsx` render their `if (!accessToken)` login prompt. `collection-ownership-panel.tsx` has the same bug, masked by `return null`.

### Backend facts (confirmed, unchanged)

- `POST /auth/refresh` reads the httpOnly `refresh_token` cookie and returns **`{ accessToken }`** only (no user). Rotates the refresh cookie. Returns 401 (`Missing refresh token`) when no cookie.
- `GET /auth/me` (JWT-guarded) returns `PublicUserDto`.
- Cookie is `path: '/'`, and the browser reaches the API through a same-origin `/api/*` rewrite (`next.config.ts`), so **no CORS** — the cookie flows on proxied calls. `api.ts` already sends `credentials: 'include'`.

### Design

- **`auth-store.ts`** — add a hydration `status`:
  ```ts
  type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
  // status starts 'loading'; setSession -> 'authenticated'; clear -> 'unauthenticated';
  // add setStatus for the refresh failure path.
  ```
- **`lib/api.ts`** — add `refreshSession(): Promise<{ accessToken: string }>` (`POST /api/auth/refresh`, `credentials: 'include'`, no body). On non-OK, throw so the provider treats it as unauthenticated.
- **`components/auth/auth-provider.tsx`** (new, client) — on mount, if `status === 'loading'` and no token: `refreshSession()` → on success `fetchMe(accessToken)` → `setSession(accessToken, user)`; on failure `setStatus('unauthenticated')`. Render `children` always (non-blocking).
- **`app/providers.tsx`** — mount `<AuthProvider>` inside the existing providers (under `QueryClientProvider`, so `fetchMe` errors don't crash the tree).
- **Authed components** — `inventory-progress.tsx`, `wishlist-list.tsx`, `collection-ownership-panel.tsx`: branch on `status`:
  - `loading` → skeleton / `null` (no login prompt flash),
  - `unauthenticated` → the existing "inicia sesión" prompt,
  - `authenticated` → data.
- **Improvement — 401 refresh+retry:** wrap `authedJson` so a `401` triggers one `refreshSession()` + `setSession` + retry with the new token before failing. Keeps long sessions working when only the short access token expired. The token stays in memory (no localStorage → no XSS exposure).

### Testing (vitest)

- `auth-provider`: mocks `refreshSession` + `fetchMe`; asserts store goes `loading → authenticated`; on refresh 401 goes `loading → unauthenticated`.
- authed components: while `loading` they do **not** render the login prompt; render it only on `unauthenticated`; render data on `authenticated`.
- `api.refreshSession` + the 401-retry path (first call 401 → refresh → retry succeeds).

---

## Feature 2 — i18n with next-intl (es + en)

Mirror `route-page-app`'s next-intl App-Router setup (`i18n/{routing,request,navigation}.ts`, `app/[locale]/`, `locales/*.json`, `useTranslations`), with the improvements below. Locales: **`es` (default) + `en`**. `localePrefix: 'as-needed'` (default `es` → clean `/inventory`; `en` → `/en/inventory`).

### Structure

- **Install** `next-intl` (v4, compatible with Next 16.2.9 — verify on install).
- **`next.config.ts`** — wrap with `createNextIntlPlugin('./i18n/request.ts')`; keep the existing `/api/*` rewrite.
- **`i18n/routing.ts`** — `defineRouting({ locales: ['es','en'], defaultLocale: 'es', localePrefix: 'as-needed' })`.
- **`i18n/navigation.ts`** — `createNavigation(routing)` → locale-aware `Link`, `useRouter`, `redirect`, `usePathname`.
- **`i18n/request.ts`** — `getRequestConfig` loading `../locales/${locale}.json`.
- **`middleware.ts`** — `createMiddleware(routing)`; **matcher must exclude `/api`, `/_next`, and static assets** (the same-origin API proxy must never be locale-prefixed).
- **Move `app/` → `app/[locale]/`** — `(auth)/{login,register,verify}`, `collections`, `collections/[slug]`, `inventory`, `wishlist`, `profile`, `profile/[username]`, plus `layout.tsx`, `page.tsx`, `providers.tsx`. Root `app/layout.tsx` stays minimal; the `[locale]/layout.tsx` reads the locale param, sets `<html lang>`, and wraps children in `NextIntlClientProvider`.

### Message catalogs

`locales/es.json` + `locales/en.json`, namespaced: `Common`, `Nav`, `Auth`, `Inventory`, `Wishlist`, `Collections`, `Errors`. Migrate currently-hardcoded Spanish UI strings into the catalogs via `useTranslations`, e.g.:

- `Inventory`: "Inicia sesión para ver tu inventario", progress card labels.
- `Wishlist`: "Mi wishlist", "Tu wishlist está vacía", "Quitar", priority/maxPrice labels.
- `Collections` / ownership panel: "tengo", "+1", "Wishlist".
- `Errors`: one key per API error code (see below).

### Improvement 1 — error codes in `@sobrebox/shared` (no magic strings)

- **`packages/shared/src/errors/auth-error-codes.ts`** — `export const AUTH_ERROR_CODES = { EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED', INVALID_CREDENTIALS: 'INVALID_CREDENTIALS', ... } as const;` + `export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];`. Export from `index.ts`.
- **API** — replace the bare strings in `auth.service.ts` (e.g. line ~143 `throw new ForbiddenException('EMAIL_NOT_VERIFIED')`) with `AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED`. Serializes identically, so **e2e is unaffected**. Inventory existing error strings stay as-is unless trivially in scope.
- **Web** — a helper `errorMessageKey(code: string): string` maps a known `AuthErrorCode` to its `Errors.<code>` translation key, falling back to `Errors.UNKNOWN`. `login-form.tsx` renders `t(errorMessageKey(err.message))` instead of the raw message. A test asserts every `AUTH_ERROR_CODES` value has a matching `Errors.<code>` entry in **both** catalogs (parity), so a new code without a translation fails CI.

### Improvement 2 — type-safe messages

Augment next-intl's `Messages`/`Formats` types from the `es` catalog so `t('...')` keys are type-checked at build (caught by `type-check`).

### Language switcher

`components/locale-switcher.tsx` in `SiteHeader` — toggles `es`/`en` using `i18n/navigation`'s `useRouter`/`usePathname`, preserving the current path.

### Testing (vitest)

- Components render wrapped in `NextIntlClientProvider` with a test catalog; assert translated strings appear (es and en variants).
- `errorMessageKey` maps known codes and falls back to `UNKNOWN`; catalog-parity test over `AUTH_ERROR_CODES`.
- Login form shows the translated verify-email message (not the raw code) on `EMAIL_NOT_VERIFIED`.
- Locale switcher swaps locale and preserves the path.
- `type-check` validates message keys.

---

## Feature 3 — JSON seed fixtures

### Design

- **`apps/api/prisma/fixtures/brands.json`** and **`apps/api/prisma/fixtures/collections.json`**. `collections.json` keeps `items[]` and `packTypes[]` **nested per collection**, preserving the current upsert-by-slug nested `create` and the `packModel` JSON shape (incl. existing `itemId: 'placeholder'` values — no resolution, current behavior).
- **`apps/api/prisma/fixtures.schema.ts`** (or `seed-fixtures.ts`) — Zod schemas typing the fixtures (`Brand`, `Collection` with nested items/packTypes), coercing enum strings (`Rarity`, `CollectionCategory`, `CollectionStatus`, `CollectionSource`) via `z.nativeEnum`. A `loadFixtures()` helper imports the JSON (ES6 import, `resolveJsonModule`), parses through the schemas, and returns typed data. Catches typos at seed time.
- **`seed.ts`** — replace inline literals with `loadFixtures()`; keep `validatePackModel(category, packModel)` on each pack model; keep the slug-based upserts (idempotent, re-runnable, non-destructive).

### Testing (vitest)

- `fixtures.schema` / `loadFixtures`: parses the real fixture files successfully; rejects a malformed fixture (bad enum, missing slug). The loader/validator is the tested unit; `seed.ts` glue stays excluded from coverage (as today).

---

## Cross-cutting

### Ordering & PR hygiene

Same branch (`feat/inventory-wishlist`), three commit groups in order **fixtures → session → i18n**. i18n moves the #9 pages under `app/[locale]/`, so doing it pre-merge avoids a churn PR later. (Could be split into stacked PRs if preferred; default is one branch.)

### Coverage gate

`pnpm pr-check` must stay green (≥80% statements/branches/functions/lines across api/web/shared). New tests: auth-provider + authed-component states, `api.refreshSession`/401-retry, error-code const + catalog parity, i18n component renders, fixtures loader/validation. e2e unchanged (API error code string identical; refresh/me endpoints already exist).

### Risks / verify during implementation

- next-intl v4 ↔ Next 16.2.9 compatibility (verify on install).
- next-intl middleware matcher must exclude `/api` (same-origin proxy) — otherwise authed calls break.
- After moving pages under `[locale]`, all existing web tests and imports (`@/` paths) must still resolve; update any absolute route strings/redirects to use `i18n/navigation`.
- Confirm the refresh cookie round-trips through the `/api` proxy in dev (same-origin, `sameSite: 'lax'`).

### Non-goals (deferred)

- Locales beyond es/en (trivial to add a catalog later).
- Translating the API's own emails/messages (only HTTP error codes are mapped client-side).
- Switching the seed to TRUNCATE+insert (keeping idempotent upsert).
