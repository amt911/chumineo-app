# Findings — gotchas no obvios

> Añade una entrada cuando algo cueste tiempo real y no se deduzca del código. Consúltalo **antes** de depurar o tocar el build.

## Monorepo / build

- Los comandos del repo viven en `package.json` (cross-platform, sin `make`). Ojo: `infra:up`/`bootstrap` se llaman así porque `pnpm up` (= update) y `pnpm setup` son comandos internos de pnpm.
- **Git hooks (husky)** se activan tras `pnpm install` (`prepare: husky`): `pre-commit`=lint-staged, `commit-msg`=commitlint (Conventional Commits), `pre-push`=lint+type-check+test. Bypass: `--no-verify`. `lint-staged`/prettier ignoran el lockfile y generados vía `.prettierignore`.
- **CI** (`.github/workflows/ci.yml`) replica el gate (lint + type-check + test:cov) y corre el e2e contra un servicio Postgres cuyas credenciales coinciden con `.env.example` (sobrebox/sobrebox/sobrebox).
- La infra (db/redis/mailpit) corre en `docker-compose`; en Fase 0 `api`/`web` corren en host. Para e2e/seed: `pnpm infra:up` → `pnpm db:deploy` → `pnpm db:seed` primero.
- **`@sobrebox/shared` se COMPILA** (`tsc` → `dist`, CommonJS) y se consume como JS compilado. **Recompílalo (`pnpm build:shared`) tras editarlo** o `api`/`web`/seed importarán código viejo. Los scripts de test/cobertura (turbo `^build`) y `pnpm db:seed` lo compilan automáticamente.
- `api` y `shared` son **CommonJS, sin extensiones `.js`** en imports. `web` usa resolución Bundler de Next + `transpilePackages: ['@sobrebox/shared']`.
- El seed corre con **`tsx`** (no ts-node) para poder importar `@sobrebox/shared`.

## Prisma

- **Prisma fijado a la v6.** Prisma 7 cambia el generador por defecto a `prisma-client` con cliente **ESM** + `prisma.config.ts`, incompatible con la `api` CommonJS (`ERR_REQUIRE_ESM`). No subir a 7 sin migrar el módulo a ESM. Generador = `prisma-client-js`.
- Las **entidades** viven en `apps/api/prisma/schema.prisma` (fuente única). El cliente generado va a `node_modules/@prisma/client` (no se commitea); las migraciones SQL sí se commitean.
- El cliente se genera en `pnpm install` vía el `postinstall: "prisma generate"` de `apps/api` (un clon limpio queda listo sin pasos extra). Si tocas el schema, `pnpm db:migrate` (o `pnpm --filter @sobrebox/api exec prisma generate`) lo regenera. Ojo: `pnpm db:deploy` usa `prisma migrate deploy`, que **no** regenera.
- **Carga de `.env` en runtime:** la `api` usa `@nestjs/config` (`ConfigModule.forRoot` en `app.module.ts`) que carga el `.env` **raíz** (`../../.env`) al arrancar; las vars ya presentes en el entorno ganan. Por eso `start:dev`/e2e funcionan sin depender de un `apps/api/.env` hecho a mano.
- Los scripts `pnpm db:*` y `pnpm test:e2e` cargan el `.env` raíz con `dotenv-cli`, y `docker compose` lee `.env` solo. Corriendo el CLI de Prisma a pelo (sin los scripts), exporta antes: `set -a && . ./.env && set +a` (o `dotenv -e .env -- prisma …`).
- Los campos `Decimal` de Prisma (`officialPullRate`, `price`) **serializan como STRING** sobre HTTP — modélalos como `z.string()` (o coerce) en los DTOs de shared, nunca `number`.
- Enums Prisma (schema) y enums TS (shared) están **duplicados a propósito** (Prisma no referencia enums TS). `apps/api/src/catalog/enum-parity.spec.ts` falla si divergen.
- **`pnpm db:migrate -- --name <x>` NO forwardea el flag de forma fiable.** El script es
  `pnpm bootstrap && dotenv -e .env -- pnpm --filter @sobrebox/api exec prisma migrate dev`;
  los args tras `--` se cuelgan en el prompt interactivo "Enter a name for the new migration"
  (stdin no conectado → cuelga indefinidamente, sin error). Workaround fiable: cargar el env
  a mano y llamar prisma directo: `set -a && source .env && set +a && pnpm --filter
@sobrebox/api exec prisma migrate dev --name <x>`.
- **Añadir un campo required (aunque nullable) a un DTO Zod compartido rompe TODOS sus
  productores, no solo el "obvio".** Al añadir `country` a `publicUserSchema`
  (`packages/shared`), tanto `UsersService.getAuthUser` como `AuthService.toPublicUser`
  construyen un `PublicUserDto` de forma independiente — el segundo no se detectó hasta
  correr la suite completa de `api` (fallo de compilación TS en 3 specs de auth). Al tocar
  un schema compartido, busca TODOS los `.parse(...)`/objetos tipados como ese DTO antes
  de dar la tarea por cerrada, no solo el archivo "principal".

## Frontend (web)

- `vitest.config.mts` (no `.ts`): `@vitejs/plugin-react@6` es ESM-only e incompatible con el Vite 5 del repo → fijado a `@vitejs/plugin-react@4.3.4` + `vite@5`.
- Coverage de web excluye `app/**` (App Router, se prueba por integración) y `components/ui/**` + `lib/utils.ts` (generados por shadcn). La superficie unit-testeada es `components/<dominio>/**` y `lib/api.ts`.
- La página `/collections` es dinámica vía `fetch(..., { cache: 'no-store' })` en `lib/api.ts` (no `force-dynamic`), para no prerenderizar contra una API que puede no estar levantada en build.

## Auth

- Passwords use **argon2id** (`argon2`, native addon with prebuilt binaries).
  High-entropy opaque tokens (refresh, verification) are hashed with **SHA-256**,
  not argon2 — argon2 is only for low-entropy secrets.
- Refresh tokens are **stateful**: random opaque strings, only the SHA-256 hash is
  stored in `Session`, rotated on every `/auth/refresh`; reuse of a rotated token
  revokes the whole chain.
- Cross-origin cookies: web (`:3101`/tailnet) and api (`:3100`) are different
  origins → CORS needs `credentials:true` + explicit `CORS_ORIGINS` (not `*`).
  Same **site** in dev (different ports on one host) so `sameSite='lax'` works;
  prod is cross-site → `sameSite='none'; secure`, gated on `NODE_ENV=production`.
  For mobile-over-tailnet, add the MagicDNS origin to `CORS_ORIGINS`.
- Lockout counters live in Redis (`lockout:<email>`), TTL = `LOCKOUT_WINDOW_MIN`.
- Login is blocked until `emailVerified`; the api returns `403 EMAIL_NOT_VERIFIED`
  so the UI can offer "resend".
- **argon2 is a native addon** — requires `argon2: true` in `pnpm-workspace.yaml`
  `allowBuilds` (or pnpm won't run its build script and it fails at runtime).
- **`HttpStatus.LOCKED` does NOT exist in `@nestjs/common@10`** (the enum skips 423)
  — use the literal `423` for the lockout response.
- **`esModuleInterop: true`** is required in `apps/api/tsconfig.json` for
  default-importing CommonJS packages (e.g. `import cookieParser from 'cookie-parser'`)
  or it crashes at runtime.
- **`REDIS_CLIENT` DI token** lives in `apps/api/src/redis/redis.constants.ts`
  (NOT in redis.module.ts) to avoid a module↔service circular import that left
  the token `undefined` at runtime DI bootstrap.
- **Refresh cookie `sameSite`**: dev is same-site (localhost different ports) so
  `sameSite=lax`; prod cross-site needs `sameSite=none; secure` (gated on NODE_ENV).

## Catalog

- `GET /collections` returns a PAGED object `{ items, page, pageSize, total, hasMore }`
  (not a flat array). Query params: `page,limit,brand,category,year,q,sort`.
- Pack-type size labels come from the shared `packSummary(category, packModel)`
  helper (`packages/shared/src/pack-models/summary.ts`); it validates via the
  registry and returns "Unknown pack" rather than throwing on a bad packModel.
- Postgres enum order = declaration order, so `orderBy: { rarity: 'asc' }` yields
  COMMON→…→LIMITED — relied on for the detail items + rarity distribution order.

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
- Prisma `Decimal.toString()` drops trailing zeros (`80.00` → `'80'`); for fixed-scale
  money DTOs use `.toFixed(scale)` instead. `wishlist.service` maxPrice uses `.toFixed(2)`.
  NOTE: `catalog` service still uses `.toString()` for `price`/`officialPullRate` — same
  latent issue, follow-up.
- **TanStack query keys:** `/inventory` summary uses `['inventory','progress']`; per-collection
  detail uses `['inventory','progress',slug]`. Invalidate the SHORTER prefix to refresh both
  (prefix-matching is one-directional — the longer key does NOT match the shorter).
- **Wishlist POST is upsert-REPLACE:** a second POST for the same item overwrites `priority`/`isPublic`
  with the request's values (defaults `MEDIUM`/`true` if omitted). Inventory POST instead INCREMENTS
  quantity. The two verbs differ by design (spec 4.x).
- **Docker dev + cambios de lockfile:** los contenedores dev `sobrebox-api`/`sobrebox-web`
  guardan `node_modules` en **volúmenes anónimos** (enmascaran el host), horneados al construir
  la imagen. Cuando cambia el lockfile de pnpm (dep nueva), el `node_modules` del contenedor
  queda stale y pnpm **aborta al arrancar** con `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`
  (quiere purgar+reinstalar, sin TTY). Fix permanente aplicado: `CI: 'true'` en el `environment`
  de ambos servicios → pnpm reinstala solo. Recuperación puntual sin eso:
  `docker compose up -d --build --renew-anon-volumes --force-recreate sobrebox-api sobrebox-web`.
  (El mismo gotcha del volumen anónimo afecta al cliente Prisma generado — regenéralo dentro
  del contenedor.)

## Pendiente (Playwright)

- Playwright (e2e de frontend) está **declarado pero diferido a la épica 3** (animación de apertura). Aún no hay script de frontend-e2e.

## Docker / deploy (Coolify)

- **Next standalone necesita Next 16:** los builds de producción con Turbopack emiten
  `output:'standalone'` solo en **16+** (15.5 no). Fija `outputFileTracingRoot` a la raíz
  del repo para que el layout del monorepo sea determinista:
  `apps/web/.next/standalone/apps/web/server.js`.
- **nest build sacaba `dist/src/main.js`, no `dist/main.js`:** `tsconfig.build.json` no
  excluía `prisma/`, así que `prisma/seed.ts` se compilaba y empujaba el rootDir a
  `apps/api` → salida en `dist/src/`. El `start:prod` (`node dist/main`) estaba latentemente
  roto. Fix: excluir `prisma` en `tsconfig.build.json` → solo `src/` → `dist/main.js`.
- **Imagen api: copia `apps/api/prisma/` ANTES de `pnpm install`.** El `postinstall` de la
  api corre `prisma generate`, que lee `schema.prisma`; sin él, el install falla.
- **argon2 es nativo** → el build stage de la api necesita Alpine `python3 make g++`. El
  prod stage no (el `.node` compilado viaja en `node_modules`).
- **El CLI `prisma` es devDependency** pero el entrypoint prod corre `prisma migrate
deploy` → la imagen prod copia todo el `/app` construido (incluye el CLI). Slimming diferido.
- **compose dev sobrescribe el env del host:** dentro de la red de compose la db/redis se
  alcanzan por nombre de servicio (`sobrebox-db`, `sobrebox-redis`), no por los puertos de
  host del `.env`; los volúmenes anónimos preservan el `node_modules` del contenedor (argon2 musl).
- **El entorno es podman-compose** (no docker-compose): `docker compose rm` no existe; usa
  `docker compose stop` + `docker rm -f <contenedor>`. El port-forward de podman puede dar
  "connection reset" justo al arrancar — espera unos segundos. También: `podman-compose ps`
  no soporta `-a` (usa `docker compose ps` a secas).
- **`infra:up`/`infra:up:logs` listan servicios explícitamente** (no hacen `docker compose up`
  a secas), así que añadir un servicio nuevo a `docker-compose.yml` (p. ej. `sobrebox-rustfs`
  en Task 7) **no basta** — hay que añadirlo también a esos scripts en `package.json` o
  `pnpm infra:up` nunca lo arranca, y cualquier consumidor eager (`StorageModule` `@Global()`
  con `S3ClientProvider`) sigue rompiendo `test:e2e` aunque el compose ya lo declare.
