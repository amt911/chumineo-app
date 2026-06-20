# Findings — gotchas no obvios

> Añade una entrada cuando algo cueste tiempo real y no se deduzca del código. Consúltalo **antes** de depurar o tocar el build.

## Monorepo / build

- Los comandos del repo viven en `package.json` (cross-platform, sin `make`). Ojo: `infra:up`/`bootstrap` se llaman así porque `pnpm up` (= update) y `pnpm setup` son comandos internos de pnpm.
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

## Frontend (web)

- `vitest.config.mts` (no `.ts`): `@vitejs/plugin-react@6` es ESM-only e incompatible con el Vite 5 del repo → fijado a `@vitejs/plugin-react@4.3.4` + `vite@5`.
- Coverage de web excluye `app/**` (App Router, se prueba por integración) y `components/ui/**` + `lib/utils.ts` (generados por shadcn). La superficie unit-testeada es `components/<dominio>/**` y `lib/api.ts`.
- La página `/collections` es dinámica vía `fetch(..., { cache: 'no-store' })` en `lib/api.ts` (no `force-dynamic`), para no prerenderizar contra una API que puede no estar levantada en build.

## Pendiente (Playwright)

- Playwright (e2e de frontend) está **declarado pero diferido a la épica 3** (animación de apertura). Aún no hay script de frontend-e2e.
