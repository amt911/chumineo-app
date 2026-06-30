# SobreBox — Claude Guide

Plataforma para llevar recuento de cajas/sobres sorpresa coleccionables (cartas TCG, Funko, blind boxes…), ver pull rates oficiales y empíricos de la comunidad, gestionar inventario y wishlist, y comprar / vender / intercambiar ítems en un marketplace.

## Start here

1. Ejecuta `/graphify` antes de cada sesión. El grafo persistente en `graphify-out/graph.json` resume arquitectura, dependencias y conceptos transversales sin re-leer el repo.
2. Lee `docs/FINDINGS.md` **antes** de depurar o de tocar el build — recoge gotchas no obvios (estrategia de módulos, Prisma, infra). **Convención:** cuando descubras algo no obvio que costó tiempo y no se deduce del código, añade una entrada corta a `docs/FINDINGS.md`.
3. Permisos de endpoints: `docs/ENDPOINT_PERMISSIONS.md` es la referencia autoritativa. Mantenla al día en el mismo cambio que añada/modifique endpoints.

## ⚡ graphify — cada sesión

```text
/graphify            # primera vez (construye el grafo)
/graphify --update   # incremental (solo re-extrae archivos cambiados)
/graphify query "<pregunta>"    # preguntas de arquitectura sin abrir N archivos
/graphify explain "<nombre>"    # localizar un concepto o símbolo
/graphify path "A" "B"          # ruta de dependencia entre dos módulos
```

Salida en `graphify-out/`: `graph.json` (fuente de verdad), `GRAPH_REPORT.md`, `graph.html`. Ejecuta `/graphify --update` al final si tocaste docs o imágenes (los cambios de código se reconstruyen vía hook si está instalado).

## ⚡ superpowers — siempre que aplique

Prefiere **superpowers** sobre enfoques ad-hoc. Si hay aunque sea una pequeña probabilidad de que una skill aplique, invócala vía `Skill` antes de actuar (incluso antes de preguntar).

- **Process skills primero** — `brainstorming` antes de trabajo creativo/feature, `systematic-debugging` antes de arreglar bugs, `test-driven-development` antes de escribir implementación.
- **Luego implementation skills** — guían la ejecución.
- **Verificar antes de declarar hecho** — `verification-before-completion` / `requesting-code-review` antes de mergear.

Las instrucciones del usuario siempre tienen prioridad sobre las skills; las skills sobreescriben el comportamiento por defecto.

### Interruptor de modos

- **"modo ligero"** — desactiva superpowers por completo: no se invoca ningún skill, ni
  siquiera el chequeo de si aplica, hasta decir "modo normal".
- **"modo normal"** (default) — comportamiento estándar de superpowers, más: al delegar
  trabajo de programación, lanza como mucho 1 agente a la vez, y nunca un modelo superior a
  Sonnet (nada de Opus).

Confirma brevemente el cambio de modo cuando ocurra.

---

## Estrategia de módulos (LEER — es la fuente de verdad)

Decidida tras un review adversarial; **no desviarse**:

1. **`@sobrebox/shared` se COMPILA, no se consume como TS crudo.** Tiene un `build` con `tsc` que emite `dist/` (CommonJS + `.d.ts`); `main`/`types`/`exports` apuntan a `dist/`. Los consumidores (`api`, `web`, el seed) lo importan como JS compilado.
2. **CommonJS en `apps/api` y `packages/shared`.** Sin `"type": "module"`, **sin extensiones `.js`** en imports. El ts-jest por defecto de NestJS funciona tal cual.
3. **El seed corre con `tsx`** (no ts-node).
4. **`apps/web` (Next 15)** usa resolución Bundler por defecto + `transpilePackages: ['@sobrebox/shared']`.
5. **Recompila `shared` antes de que cualquier consumidor lo use:** `pnpm build:shared`. Los scripts de test/cobertura (vía turbo `^build`) y `pnpm db:seed` lo hacen automáticamente.
6. **Prisma fijado a la v6.** Prisma 7 genera un cliente ESM incompatible con la `api` CommonJS. No subir a 7 sin migrar el módulo a ESM.

---

## Stack

### Backend (`apps/api/`)

| Tech                                               | Versión | Rol                                                                            |
| -------------------------------------------------- | ------- | ------------------------------------------------------------------------------ |
| **NestJS**                                         | v10     | Framework principal — módulos, DI, guards, interceptors                        |
| **Prisma**                                         | v6      | ORM — schema único, cliente generado, migraciones                              |
| **PostgreSQL**                                     | 16      | Base de datos principal                                                        |
| **Zod** (`packages/shared`)                        | v3      | Validación de DTOs (`ZodValidationPipe`), compartida con el front              |
| **Redis** + **BullMQ**                             | —       | _(planeado, épica stats)_ cache de pull rates + jobs asíncronos                |
| **Passport + JWT**                                 | —       | _(planeado, épica auth)_ estrategias `jwt`, `jwt-refresh`, `google`, `discord` |
| **Resend** / **Mailpit**                           | —       | _(planeado)_ email transaccional (Mailpit como sink en dev)                    |
| **Cloudflare R2** (@aws-sdk/client-s3) + **Sharp** | —       | _(planeado, épica storage)_ imágenes y procesado                               |

### Frontend (`apps/web/`)

| Tech                  | Versión         | Rol                                                                                                 |
| --------------------- | --------------- | --------------------------------------------------------------------------------------------------- |
| **Next.js**           | 15 (App Router) | SSR, RSC, routing                                                                                   |
| **shadcn/ui**         | —               | Componentes base (en `components/ui/`, **NO editar a mano**); customizados según `design-system.md` |
| **Tailwind CSS**      | v4              | Estilos                                                                                             |
| **TanStack Query**    | v5              | Server state — cache de colecciones, inventario, marketplace                                        |
| **Zustand**           | —               | _(planeado)_ client state — apertura en curso, carrito, UI global                                   |
| **motion-primitives** | —               | _(planeado)_ animaciones de apertura                                                                |

### Shared (`packages/shared/`)

Enums + schemas Zod + DTOs TypeScript compartidos entre `api` y `web`. Todo lo que cruza la frontera HTTP se define aquí una sola vez. Se compila a `dist/` (ver Estrategia de módulos).

---

## Estructura del monorepo (pnpm workspaces + Turborepo)

```text
/
├── apps/
│   ├── api/                        # NestJS 10 + Prisma 6 (CommonJS)
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # ⭐ todas las entidades + enums (fuente única)
│   │   │   ├── migrations/          # migraciones SQL (commiteadas)
│   │   │   └── seed.ts              # seed de dev (corre con tsx)
│   │   └── src/
│   │       ├── prisma/              # PrismaService + PrismaModule (@Global)
│   │       ├── collections/         # GET /collections (slice de lectura)
│   │       ├── catalog/             # enum-parity guard (prisma <-> shared)
│   │       ├── common/              # ZodValidationPipe, guards, filtros
│   │       ├── health/              # /health
│   │       └── …                    # (planeado) auth, users, openings,
│   │                                #  inventory, marketplace, stats,
│   │                                #  notifications, storage
│   └── web/                        # Next.js 15 (App Router)
│       ├── app/
│       │   ├── collections/         # página + error boundary
│       │   ├── providers.tsx        # QueryClientProvider
│       │   └── layout.tsx
│       ├── components/
│       │   ├── ui/                  # shadcn — NO EDITAR MANUALMENTE
│       │   └── collections/         # CollectionList (+ planeado: items, openings…)
│       └── lib/
│           ├── api.ts               # fetch wrappers tipados (valida con schemas de shared)
│           └── utils.ts             # cn() de shadcn
└── packages/
    └── shared/                     # compila a dist/ (CommonJS)
        └── src/
            ├── enums/              # Rarity, CollectionCategory, CollectionSource, CollectionStatus
            ├── pack-models/        # schemas Zod por categoría + registry (validatePackModel)
            └── dto/                # collectionResponseSchema, …
```

> **Entidades de BD = `apps/api/prisma/schema.prisma`** (no hay carpeta `entities/`; es Prisma, no TypeORM). Los tipos los genera Prisma en `node_modules/@prisma/client` (no se commitea). La infra (Postgres/Redis/Mailpit) corre en `docker-compose`; en Fase 0 `api`/`web` corren en host.

---

## Modelo de catálogo (agnóstico — enfoque C)

- **Espina tipada** en Prisma (`Brand`, `Collection`, `CollectionItem`, `PackType`, `Opening`, `OpeningItem`, `UserInventory`, `CollectionRevision`, `Flag`). De aquí cuelgan stats/inventario/marketplace.
- **Mecánica variable del sobre** en `PackType.packModel` (JSON), validada por categoría con un **registry de schemas Zod en `packages/shared/pack-models/`** (`validatePackModel`). Categorías: `TCG` (slots por rareza), `BLIND_BOX` (case + chase), `FIGURE` (items). Añadir categoría = enum + schema Zod + rama en pull-rate, sin tocar la espina.
- **Pull rate oficial** (campo del ítem, manual/comunidad, suele ser `null`) vs **empírico** (calculado de `Opening` reales, ≥50 muestras, cache Redis 1h, recálculo BullMQ). El empírico se indexa por `CollectionItem.id` estable → inmune a ediciones de texto del wiki.
- **Wiki abierto**: cualquier usuario logueado crea/edita; cada guardado = un `CollectionRevision` (versionado); moderación reactiva (`Flag` + revertir/lock). _(El subsistema completo de población — import por API, edición wiki, moderación — es la épica de catálogo.)_
- **Enums duplicados a propósito**: Prisma no puede referenciar un enum TS, así que los enums viven en `schema.prisma` (capa BD) **y** en `packages/shared` (capa HTTP). `apps/api/src/catalog/enum-parity.spec.ts` falla si divergen. Es la única duplicación sancionada.

---

## TDD (OBLIGATORIO para lógica nueva)

Para `services/`, `lib/`, schemas de shared, hooks custom y lógica de formularios:

1. **Red** — test fallando que describe el comportamiento.
2. **Green** — mínimo código para pasar.
3. **Refactor** — limpiar sin romper verde.
4. **Correr la suite relevante antes de declarar hecho.** No afirmar "funciona" sin ver tests verdes.

No aplica a: cambios puramente visuales (CSS/Tailwind), primitivas shadcn, spikes (se borran o se testean antes de mergear).

| Cambio toca                   | Correr antes de declarar éxito                                          |
| ----------------------------- | ----------------------------------------------------------------------- |
| service/controller backend    | `pnpm --filter @sobrebox/api test` (+ `pnpm test:e2e` si cruza módulos) |
| flujo backend e2e             | `pnpm test:e2e`                                                         |
| componente/hook/util frontend | `pnpm --filter @sobrebox/web test`                                      |
| algo ambiguo o grande         | `pnpm test:all`                                                         |

## Coverage gate (OBLIGATORIO antes de PR)

**80%** en statements/branches/functions/lines, en `api`, `web` y `shared`. Antes de abrir PR: `pnpm pr-check` (= `pnpm lint` + `pnpm test:cov`, que corre la cobertura de los 3 paquetes vía turbo; debe salir limpio). **No bajar el umbral**; excluir con justificación en config solo para infra (cliente Prisma, migraciones, `seed.ts`, `main.ts`, `*.module.ts`, `prisma.service.ts`, generados de shadcn). `stats/pull-rate.service.ts` ≥90%.

Tests: **Jest + supertest** (api), **Vitest + Testing Library + jsdom** (web y shared), **Playwright** _(diferido a la épica 3 — animación de apertura)_. Archivos `*.spec.ts` (backend) / `*.test.tsx` (frontend), colocados junto al fuente.

---

## Dev workflow (scripts en `package.json` — cross-platform, sin `make`)

```bash
pnpm install             # instala + genera el cliente Prisma (postinstall de api)
pnpm infra:up            # crea .env si falta + levanta infra (db pg16, redis, mailpit)
pnpm infra:down          # parar   | pnpm infra:restart | pnpm infra:clean (borra volúmenes)
pnpm db:deploy           # aplica migraciones (prisma migrate deploy)
pnpm db:migrate          # crea+aplica migración nueva (pide el nombre)
pnpm db:seed             # build de shared + seed de la BD
pnpm db:shell            # psql dentro del contenedor
pnpm build:shared        # compila packages/shared a dist/
pnpm test                # unit de los 3 paquetes (turbo)     | pnpm test:e2e (e2e api)
pnpm test:cov            # gate de cobertura 80% (3 paquetes)  | pnpm test:all (unit + e2e)
pnpm pr-check            # lint + cobertura   | pnpm lint   | pnpm type-check
```

Primer arranque (incl. clon nuevo): `pnpm install` → `pnpm infra:up` → `pnpm db:deploy` → `pnpm db:seed`. Dev en host: `pnpm --filter @sobrebox/api start:dev` (api :3000) y `pnpm --filter @sobrebox/web dev` (web :3001), con la infra arriba.

> Los comandos que tocan la BD cargan el `.env` raíz vía `dotenv-cli`; `docker compose` lo lee solo. Sin dependencia de `make` (funciona en Windows/macOS/Linux). Nota: `pnpm up`/`pnpm setup` son comandos internos de pnpm — por eso los scripts se llaman `infra:up` y `bootstrap`.

---

## CI & git hooks

- **GitHub Actions** (`.github/workflows/ci.yml`): en cada PR y push a `main` corre `pnpm lint` + `pnpm type-check` + `pnpm test:cov` (3 paquetes) + el e2e contra un Postgres de servicio. Es el gate real de CI.
- **Git hooks (husky)**: `pre-commit` → `lint-staged` (eslint + prettier solo sobre lo staged); `commit-msg` → `commitlint` (fuerza Conventional Commits); `pre-push` → `pnpm lint && pnpm type-check && pnpm test`. Bypass de emergencia: `git commit/push --no-verify`. Se activan solos tras `pnpm install` (script `prepare: husky`).

---

## Dominio — conceptos clave

| Concepto                                   | Descripción                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| `Collection`                               | Un set/línea: "Pokémon Escarlata y Púrpura - Llamas Obsidianas"             |
| `CollectionItem`                           | Ítem concreto dentro de una Collection, con rareza y pull rate (id estable) |
| `PackType`                                 | Tipo de sobre/caja; su `packModel` (JSON) define la mecánica por categoría  |
| `Opening`                                  | Registro de apertura de un PackType por un usuario                          |
| `OpeningItem`                              | Cada CollectionItem obtenido en una Opening                                 |
| `UserInventory`                            | CollectionItems que posee un usuario, con cantidad y condición              |
| `CollectionRevision`                       | Versión de una Collection (wiki) — para historial y revert                  |
| `Flag`                                     | Reporte de moderación sobre una Collection u otro objeto                    |
| `Rarity`                                   | Enum: `COMMON`, `UNCOMMON`, `RARE`, `ULTRA_RARE`, `SECRET`, `LIMITED`       |
| `Pull rate oficial`                        | Probabilidad publicada por el fabricante — puede ser null                   |
| `Pull rate empírico`                       | Calculado de Opening reales; requiere ≥50 muestras para mostrarse           |
| `Listing` / `ListingOffer` / `Transaction` | _(épica marketplace)_ anuncio / oferta / transacción cerrada                |
| `Reputation Score`                         | _(épica social)_ media ponderada de reviews como seller y buyer             |

### Flujo de apertura _(épica openings)_

```text
Selecciona PackType → crea Opening → selecciona CollectionItems obtenidos
  → crea OpeningItems → upsert UserInventory (quantity++)
  → BullMQ encola recálculo de pull rates → actualiza cache Redis
```

### Flujo de marketplace _(épica marketplace)_

```text
Marca UserInventory en venta → crea Listing → otro usuario crea ListingOffer
  → seller acepta → Listing PENDING + chat → ambos completan → Transaction
  → ambos dejan Review → actualiza reputationScore
```

---

## Reglas de trabajo

- **Superpowers primero** — process skills antes que implementation skills.
- **No instalar paquetes sin preguntar** — el stack es intencional. Excepción: devDependencies de test evidentes.
- **TDD por defecto** para lógica nueva. No mergear lógica sin tests.
- **No bajar el gate de cobertura** — excluir con justificación, nunca silenciosamente.
- **No usar `any`** — usar `unknown` + type guards o los tipos del dominio.
- **Sin strings hardcodeados de enum** — usar siempre los enums de `packages/shared` (`Rarity`, `CollectionCategory`, …). Un string de enum suelto es un bug.
- **Entidades de BD en `apps/api/prisma/schema.prisma`** — fuente única. Migraciones con `pnpm db:migrate`; nunca editar SQL de migración a mano salvo data-migrations conscientes.
- **DTOs/enums/schemas Zod en `packages/shared`** — nunca duplicar (excepto los enums de Prisma, que están sancionados y guardados por el enum-parity test). Si `web` necesita tipar una respuesta, importa de shared.
- **Recompilar `shared`** (`pnpm build:shared`) tras editarlo, o api/web/seed importarán código viejo.
- **Pull rates siempre en `stats/`** — empírico en `stats/pull-rate.service.ts`, cache Redis TTL 1h. Nunca en el controller ni en el frontend.
- **Imágenes siempre vía `storage/storage.service.ts`** — la API devuelve URLs firmadas de R2, nunca sirve binarios.
- **Commits en inglés**, Conventional Commits. Scope = módulo Nest o carpeta de componentes. Ej: `feat(stats): add empirical pull rate endpoint`.

---

## Git & GitHub

- **Commits y ramas: libremente** — no preguntar antes.
- **Nunca `git push`** — bajo ninguna circunstancia, tampoco `--force` / `--force-with-lease`. El push lo hace el desarrollador.
- **GitHub vía `gh`** — PRs, issues, comentarios, labels si `gh` está disponible (no implica push por tu parte más allá de lo que `gh` haga sobre una rama ya pusheada).
- **Ramas:** `feat/nombre`, `fix/descripcion`, `chore/tarea`.
