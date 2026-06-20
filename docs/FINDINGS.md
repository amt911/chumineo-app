# Findings — gotchas no obvios

> Añade una entrada cuando algo cueste tiempo real y no se deduzca del código. Consúltalo **antes** de depurar o tocar el build.

## Monorepo / build

- La infra (db/redis/mailpit) corre en `docker-compose`; en Fase 0 `api`/`web` corren en host. Para e2e/seed: `make up` → `make migration-run` → `make fixtures` primero.
- **`@sobrebox/shared` se COMPILA** (`tsc` → `dist`, CommonJS) y se consume como JS compilado. **Recompílalo (`make build-shared`) tras editarlo** o `api`/`web`/seed importarán código viejo. Los targets de test del makefile y `make fixtures` lo compilan automáticamente.
- `api` y `shared` son **CommonJS, sin extensiones `.js`** en imports. `web` usa resolución Bundler de Next + `transpilePackages: ['@sobrebox/shared']`.
- El seed corre con **`tsx`** (no ts-node) para poder importar `@sobrebox/shared`.

## Prisma

- **Prisma fijado a la v6.** Prisma 7 cambia el generador por defecto a `prisma-client` con cliente **ESM** + `prisma.config.ts`, incompatible con la `api` CommonJS (`ERR_REQUIRE_ESM`). No subir a 7 sin migrar el módulo a ESM. Generador = `prisma-client-js`.
- Las **entidades** viven en `apps/api/prisma/schema.prisma` (fuente única). El cliente generado va a `node_modules/@prisma/client` (no se commitea); las migraciones SQL sí se commitean.
- Los comandos Prisma vía `make` heredan `DATABASE_URL` (el makefile hace `include .env` + `export`). Corriendo `prisma` a pelo fuera de make, exporta antes: `set -a && . ./.env && set +a`.
- Los campos `Decimal` de Prisma (`officialPullRate`, `price`) **serializan como STRING** sobre HTTP — modélalos como `z.string()` (o coerce) en los DTOs de shared, nunca `number`.
- Enums Prisma (schema) y enums TS (shared) están **duplicados a propósito** (Prisma no referencia enums TS). `apps/api/src/catalog/enum-parity.spec.ts` falla si divergen.

## Frontend (web)

- `vitest.config.mts` (no `.ts`): `@vitejs/plugin-react@6` es ESM-only e incompatible con el Vite 5 del repo → fijado a `@vitejs/plugin-react@4.3.4` + `vite@5`.
- Coverage de web excluye `app/**` (App Router, se prueba por integración) y `components/ui/**` + `lib/utils.ts` (generados por shadcn). La superficie unit-testeada es `components/<dominio>/**` y `lib/api.ts`.
- La página `/collections` es dinámica vía `fetch(..., { cache: 'no-store' })` en `lib/api.ts` (no `force-dynamic`), para no prerenderizar contra una API que puede no estar levantada en build.

## Pendiente (Playwright)

- Playwright (e2e de frontend) está **declarado pero diferido a la épica 3** (animación de apertura). `make test-frontend-e2e` es un no-op por ahora.
