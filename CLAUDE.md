# SobreBox — Claude Guide

## Start here

Run `/graphify` before each session. The persistent graph at `graphify-out/graph.json` summarizes architecture, dependencies, and cross-cutting concepts without re-reading the repo each time.

## ⚡ graphify — use every session

```
/graphify            # first run (builds graph from scratch)
/graphify --update   # incremental update (only re-extracts changed files)
/graphify query "<question>"    # architecture questions instead of opening multiple files
/graphify explain "<name>"      # locate a concept or symbol
/graphify path "A" "B"          # dependency path between two modules
```

Outputs in `graphify-out/`: `graph.json` (source of truth), `GRAPH_REPORT.md` (god nodes, communities, surprising connections), `graph.html` (interactive view).

Run `/graphify --update` at end of session if you touched docs or images (code changes rebuild via hook if installed).

## ⚡ superpowers — use whenever applicable

Always prefer **superpowers** skills over ad-hoc approaches. If there's even a small chance a skill applies to the task, invoke it via the `Skill` tool before acting (including before clarifying questions).

- **Process skills first** — `brainstorming` before creative/feature work, `systematic-debugging` before fixing bugs, `test-driven-development` before writing implementation.
- **Then implementation skills** — domain-specific skills guide execution.
- **Verify before claiming done** — `verification-before-completion` / `requesting-code-review` before merging.

User instructions always take precedence over skills; skills override default behavior.

---

## Stack

### Backend (`apps/api/`)

| Tech | Versión | Rol |
|------|---------|-----|
| **NestJS** | v10 | Framework principal — módulos, DI, guards, interceptors |
| **TypeORM** | v0.3 | ORM — entities, repositories, migrations |
| **PostgreSQL** | 16 | Base de datos principal |
| **Redis** (via ioredis) | — | Cache de estadísticas de pull rates; cola de jobs (BullMQ) |
| **Passport + JWT** | — | Auth; estrategias: `jwt`, `jwt-refresh`, `google`, `discord` |
| **class-validator / class-transformer** | — | Validación y transformación de DTOs |
| **Resend** | — | Emails transaccionales (verificación, notificaciones) |
| **Cloudflare R2** (via @aws-sdk/client-s3) | — | Almacenamiento de imágenes (ítems, avatares, og-images) |
| **BullMQ** | — | Jobs asíncronos: recalcular pull rates, generar imágenes OG |

### Frontend (`apps/web/`)

| Tech | Versión | Rol |
|------|---------|-----|
| **Next.js** | 15 (App Router) | SSR, RSC, server actions, routing |
| **shadcn/ui** | — | Componentes base; customizados según design-system.md |
| **motion-primitives** | — | Animaciones: apertura de sobres, AnimatedNumber, TextEffect |
| **Tailwind CSS** | v4 | Estilos |
| **TanStack Query** | v5 | Server state — cache de colecciones, inventario, marketplace |
| **Zustand** | — | Client state — estado de apertura en curso, carrito, UI global |

### Shared (`packages/shared/`)

DTOs, enums, interfaces TypeScript compartidos entre `api` y `web`. Todo lo que cruza la frontera HTTP se define aquí y se importa en ambos lados.

---

## Estructura del monorepo

```
/
├── apps/
│   ├── api/                        # NestJS backend
│   │   └── src/
│   │       ├── auth/               # Auth module — JWT, OAuth, guards
│   │       ├── users/              # Users module — perfil, follows, reviews
│   │       ├── collections/        # Colecciones + items + pack types
│   │       ├── openings/           # Registro de aperturas + opening items
│   │       ├── inventory/          # Inventario personal + wishlists
│   │       ├── marketplace/        # Listings, offers, transactions, chat
│   │       ├── stats/              # Pull rates, leaderboards, personal stats
│   │       ├── notifications/      # Sistema de notificaciones in-app + email
│   │       ├── storage/            # Wrapper de R2 (upload, get signed URL)
│   │       ├── db/
│   │       │   ├── entities/       # TypeORM entities (una por archivo)
│   │       │   └── migrations/     # Migraciones TypeORM generadas
│   │       └── common/             # Guards, decorators, pipes, filters globales
│   │
│   └── web/                        # Next.js frontend
│       ├── app/
│       │   ├── (auth)/             # /login, /register, /verify
│       │   └── (app)/              # Rutas autenticadas
│       │       ├── dashboard/
│       │       ├── collections/    # Catálogo + detalle de colección
│       │       ├── open/           # Flujo de apertura de sobre
│       │       ├── inventory/      # Inventario + wishlist
│       │       ├── marketplace/    # Browse + listing detail
│       │       ├── profile/[username]/
│       │       └── stats/
│       ├── components/
│       │   ├── ui/                 # Generados por shadcn — NO EDITAR MANUALMENTE
│       │   ├── items/              # ItemCard, RarityBadge, PullRateBar
│       │   ├── openings/           # OpeningAnimation, OpeningHistory, Feed
│       │   ├── collections/        # CollectionCard, CollectionProgress
│       │   ├── marketplace/        # MarketplaceCard, OfferModal, ChatPanel
│       │   ├── stats/              # StatCard, PullRateChart, Leaderboard
│       │   └── layout/             # Header, Sidebar, Footer, PageWrapper
│       └── lib/
│           ├── api.ts              # Fetch wrappers tipados (usa DTOs de shared)
│           ├── query-keys.ts       # TanStack Query key factory
│           ├── rarity.ts           # Helpers de rareza (color, label, orden)
│           └── utils.ts
│
└── packages/
    └── shared/                     # DTOs, enums, tipos compartidos
        ├── src/
        │   ├── enums/              # Rarity, ListingType, Condition, etc.
        │   └── dto/                # DTOs por módulo
        └── package.json
```

---

## Commands

```bash
# Instalar todas las dependencias desde root
pnpm install

# ── Backend ─────────────────────────────────────────────────────────────────

cd apps/api

pnpm run start:dev          # dev con hot reload
pnpm run start:debug        # dev con debug port 9229
pnpm run build              # compilar a dist/

# Tests
pnpm run test               # unit (Jest)
pnpm run test:watch         # watch mode
pnpm run test:cov           # coverage report (gate: 80%)
pnpm run test:e2e           # e2e con supertest

# Migraciones TypeORM
pnpm run migration:generate -- src/db/migrations/NombreMigracion
pnpm run migration:run
pnpm run migration:revert
pnpm run migration:show     # lista migraciones pendientes

# ── Frontend ─────────────────────────────────────────────────────────────────

cd apps/web

pnpm run dev                # dev con Turbopack
pnpm run build              # build de producción
pnpm run start              # servidor de producción local

# Tests
pnpm run test               # Vitest
pnpm run test:watch
pnpm run test:cov           # coverage (gate: 80%)

# ── Ambos desde root ─────────────────────────────────────────────────────────

pnpm run build              # build ambas apps en paralelo
pnpm run lint               # ESLint en todo el monorepo
pnpm run type-check         # tsc --noEmit en ambas apps + shared
```

---

## Tests y calidad

**Backend:** Jest + supertest (e2e). Config: `apps/api/jest.config.ts`.

**Frontend:** Vitest + Testing Library + jsdom. Config: `apps/web/vitest.config.ts`.

Convención de archivos: `*.spec.ts` (backend), `*.test.tsx` (frontend), colocados junto al fuente.

**Coverage gate: 80%** (statements / branches / functions / lines). No bajar el gate — excluir con justificación en config en lugar de reducir el umbral.

### Qué testear por carpeta

#### Backend (`apps/api/src/`)

| Módulo | Qué testear |
|--------|-------------|
| `*/services/` | Lógica de negocio con repositorios mockeados. Caso feliz + cada error esperado. |
| `*/controllers/` | Validación de DTOs, código HTTP correcto, guards aplicados (mock del guard). |
| `stats/` | Cálculos de pull rates con datos sintéticos conocidos — **crítico, cobertura ≥90%**. |
| `*/guards/` | Comportamiento con token válido, inválido y expirado. |
| `auth/` | Flujo completo de login/refresh/revoke con repositorios mockeados. |

#### Frontend (`apps/web/`)

| Carpeta | Qué testear |
|---------|-------------|
| `lib/` | Funciones puras (rarity.ts, utils.ts) — sin mocks, deterministas. |
| `components/items/` | ItemCard con todas las rarezas, estados hover/selected/locked. Verificar que los glows se aplican. |
| `components/openings/` | Lógica de registro del ítem — no la animación. Mock de la llamada API. |
| `components/marketplace/` | Formularios: validación, submit happy path, manejo de errores de API. |
| `app/(app)/collections/` | RSC: mock de fetch, render correcto de lista de colecciones. |

### TDD — obligatorio para nueva lógica

Para `services/`, `lib/`, hooks custom, y lógica de formularios:

1. **Red** — test fallando que describe el comportamiento esperado.
2. **Green** — mínimo código para que pase.
3. **Refactor** — limpiar sin romper verde.

No aplica a: cambios puramente visuales (CSS, Tailwind classes), primitivas de UI (shadcn), spikes. Los spikes se borran o se añaden tests antes de mergear.

### Convenciones operativas

- **Global setup** `apps/web/vitest.setup.ts`: stub de `matchMedia`, `ResizeObserver`, `IntersectionObserver`, `window.URL.createObjectURL`. No redefinir por test.
- **Split por aspecto** si un test file supera ~300 LoC: `.flow.test.ts`, `.errors.test.ts`, `.branches.test.ts`.
- **Excluir con justificación** en config, nunca silenciosamente:
  ```ts
  // OpeningAnimation.tsx usa requestAnimationFrame y canvas 2D — cubrir via E2E con Playwright
  exclude: ['src/components/openings/OpeningAnimation.tsx']
  ```

---

## Reglas de trabajo

- **Superpowers primero** — invocar via `Skill` antes de actuar; process skills antes que implementation skills.
- **No instalar paquetes sin preguntar** — el stack es intencional. Excepción: devDependencies de test evidentes (jest-mock-extended, etc.).
- **TDD por defecto** para nueva lógica. No mergear lógica sin tests.
- **No bajar el gate de cobertura** — excluir con justificación en config.
- **No usar `any`** — usar `unknown` + type guards o los tipos correctos del dominio.
- **Sin strings hardcodeados para rareza** — usar siempre el enum `Rarity` de `packages/shared`. Si aparece un string de rareza en cualquier otro sitio, es un bug.
- **Pull rates siempre en `stats/`** — los cálculos de pull rate empírico se hacen en `stats/services/pull-rate.service.ts` y se cachean en Redis con TTL de 1 hora. Nunca calcular en el controller, nunca en el frontend.
- **Imágenes siempre via `storage/storage.service.ts`** — nunca servir directamente desde la API. La API devuelve URLs firmadas de R2.
- **TypeORM entities en `apps/api/src/db/entities/`** — una entidad por archivo, nombre en PascalCase, misma estructura que el ERD del proyecto.
- **DTOs en `packages/shared`** — nunca duplicar un DTO. Si `web` necesita tipar una respuesta, importa el DTO de shared.
- **Commits en inglés** con conventional commits: `feat(openings): add bulk opening flow`, `fix(stats): clamp pull rate below 100%`, `chore(deps): bump typeorm to 0.3.20`.
- **Nunca hacer push** — dejar el push al desarrollador. Commits y branches se pueden crear libremente.

---

## Dominio — conceptos clave

| Concepto | Descripción |
|----------|-------------|
| `Collection` | Un set/línea de colección: "Pokémon Escarlata y Púrpura - Llamas Obsidianas" |
| `CollectionItem` | Ítem concreto dentro de una Collection, con rareza y pull rate |
| `PackType` | Tipo de sobre/caja (Booster, Blister, Display) que pertenece a una Collection |
| `Opening` | Registro de apertura de un PackType por un usuario en un momento concreto |
| `OpeningItem` | Cada CollectionItem obtenido en una Opening (relación N-a-N con Opening) |
| `UserInventory` | Todos los CollectionItems que posee un usuario, con cantidad y condición |
| `Listing` | Anuncio en el marketplace — puede ser SELL, TRADE o GIVE |
| `ListingOffer` | Oferta de un comprador sobre un Listing activo |
| `Transaction` | Listing cerrado: la transacción completada entre seller y buyer |
| `Rarity` | Enum: `COMMON`, `UNCOMMON`, `RARE`, `ULTRA_RARE`, `SECRET`, `LIMITED` |
| `Pull rate oficial` | Probabilidad publicada por el fabricante — puede ser null |
| `Pull rate empírico` | Calculado a partir de Opening reales; requiere ≥ 50 muestras para mostrarse |
| `Reputation Score` | Media ponderada de reviews recibidas como seller y buyer en Transactions |

### Flujo de apertura

```
Usuario selecciona PackType
  → Crea Opening (userId, packTypeId, openedAt)
  → Selecciona CollectionItems obtenidos
  → Crea OpeningItems (openingId, collectionItemId) por cada ítem
  → Se upsert UserInventory (userId, collectionItemId, quantity++)
  → BullMQ encola job de recálculo de pull rates para esa Collection
  → Job actualiza cache Redis con nuevo pull rate empírico
```

### Flujo de marketplace

```
Usuario marca UserInventory como forSale=true
  → Crea Listing (type=SELL, userInventoryId, price)
  → Otro usuario crea ListingOffer (listingId, buyerId, offeredPrice)
  → Seller acepta → Listing.status=PENDING, se abre chat
  → Ambos marcan completado → se crea Transaction, Listing.status=COMPLETED
  → Ambos dejan Review → actualiza reputationScore de ambos
```

---

## Git & GitHub

- **Commits y branches: crear libremente** — no preguntar antes de hacer commits o nuevas ramas.
- **Nunca `git push`** — bajo ninguna circunstancia, tampoco `--force` ni `--force-with-lease`.
- **GitHub via `gh`** — se pueden abrir PRs, issues, comentarios, labels si `gh` está disponible.
- **Formato de commits:** Conventional Commits en inglés. Scope = nombre del módulo NestJS o carpeta de componentes. Ej: `feat(stats): add empirical pull rate endpoint`, `fix(items): correct rarity glow in dark mode`.
- **Nomenclatura de ramas:** `feat/nombre-feature`, `fix/descripcion-bug`, `chore/tarea`.
