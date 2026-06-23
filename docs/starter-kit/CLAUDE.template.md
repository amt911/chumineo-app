# <PROYECTO> — Claude Guide

<Una o dos frases: qué es el producto y para quién.>

> Plantilla. Copia a `CLAUDE.md` en la raíz del repo nuevo y rellena los `<…>`.
> Reemplaza `@<scope>/shared` por el scope real (ej. `@miapp/shared`). Borra esta cita.

## Start here

1. Lee `design-system.md` antes de tocar UI y `user-stories.md` antes de definir un slice.
2. Lee `docs/FINDINGS.md` antes de depurar o tocar el build — gotchas no obvios.
   **Convención:** cuando descubras algo no obvio que costó tiempo y no se deduce del
   código, añade una entrada corta a `docs/FINDINGS.md`.
3. `docs/ENDPOINT_PERMISSIONS.md` es la referencia autoritativa de permisos de endpoints.
   Mantenla al día en el mismo cambio que añada/modifique endpoints.

## Superpowers — siempre que aplique

Prefiere **superpowers** sobre enfoques ad-hoc. Si hay aunque sea 1% de probabilidad de
que una skill aplique, invócala antes de actuar.

- **Process skills primero** — `brainstorming` antes de feature, `systematic-debugging`
  antes de arreglar bugs, `test-driven-development` antes de escribir implementación.
- **Implementation skills después** — guían la ejecución.
- **Verificar antes de declarar hecho** — `verification-before-completion` /
  `requesting-code-review` antes de mergear.

Flujo: `brainstorming -> spec (lo apruebas) -> writing-plans -> plan (lo apruebas) ->
subagent-driven-development -> finishing-a-development-branch`. **Nada se implementa sin
spec aprobado.**

---

## Estrategia de módulos (fuente de verdad — no desviarse)

1. **`@<scope>/shared` se COMPILA, no se consume como TS crudo.** Tiene `build` con `tsc`
   que emite `dist/` (CommonJS + `.d.ts`); `main`/`types`/`exports` apuntan a `dist/`.
   `api`, `web` y el seed lo importan como JS compilado.
2. **CommonJS en `apps/api` y `packages/shared`.** Sin `"type":"module"`, sin extensiones
   `.js` en imports. El ts-jest por defecto de NestJS funciona tal cual.
3. **El seed corre con `tsx`** (no ts-node).
4. **`apps/web` (Next 15)** usa resolución Bundler + `transpilePackages:['@<scope>/shared']`.
5. **Recompila `shared` antes de que cualquier consumidor lo use:** `pnpm build:shared`.
   Los scripts de test/cobertura (turbo `^build`) y el seed lo hacen automáticamente.
6. **Prisma fijado a la v6.** Prisma 7 genera cliente ESM incompatible con la `api`
   CommonJS. No subir sin migrar el módulo a ESM.

---

## Stack

### Backend (`apps/api/`)

| Tech                    | Versión | Rol                                                               |
| ----------------------- | ------- | ----------------------------------------------------------------- |
| NestJS                  | v10     | Framework — módulos, DI, guards, interceptors                     |
| Prisma                  | v6      | ORM — schema único, cliente generado, migraciones                 |
| PostgreSQL              | 16      | Base de datos principal                                           |
| Zod (`packages/shared`) | v3      | Validación de DTOs (`ZodValidationPipe`), compartida con el front |
| Redis + BullMQ          | —       | _(si aplica)_ cache + jobs asíncronos                             |
| Passport + JWT          | —       | _(si aplica)_ estrategias `jwt`, `jwt-refresh`, OAuth             |
| Resend / Mailpit        | —       | email transaccional (Mailpit como sink en dev), transport switch  |
| S3/R2 + Sharp           | —       | _(si aplica)_ imágenes y procesado; URLs firmadas                 |

### Frontend (`apps/web/`)

| Tech           | Versión         | Rol                                                                                      |
| -------------- | --------------- | ---------------------------------------------------------------------------------------- |
| Next.js        | 15 (App Router) | SSR, RSC, routing                                                                        |
| shadcn/ui      | —               | Componentes base en `components/ui/` (NO editar a mano); custom según `design-system.md` |
| Tailwind CSS   | v4              | Estilos                                                                                  |
| TanStack Query | v5              | Server state                                                                             |
| Zustand        | —               | _(si aplica)_ client state                                                               |

### Shared (`packages/shared/`)

Enums + schemas Zod + DTOs TS compartidos entre `api` y `web`. Todo lo que cruza la
frontera HTTP se define aquí una vez. Compila a `dist/`.

---

## Estructura del monorepo (pnpm workspaces + Turborepo)

```text
/
├── apps/
│   ├── api/            # NestJS 10 + Prisma 6 (CommonJS)
│   │   ├── prisma/     # schema.prisma (entidades + enums), migrations/, seed.ts (tsx)
│   │   └── src/        # prisma/ (PrismaService @Global), common/ (ZodValidationPipe, guards),
│   │                   #   health/, <módulos de dominio>
│   └── web/            # Next 15 App Router
│       ├── app/        # rutas, providers.tsx (QueryClientProvider), layout.tsx
│       ├── components/ # ui/ (shadcn, NO editar), <carpetas de dominio>
│       └── lib/        # api.ts (fetch tipado que valida con schemas de shared), utils.ts
└── packages/
    └── shared/         # compila a dist/ (CommonJS): enums/, schemas/, dto/
```

> Entidades de BD = `apps/api/prisma/schema.prisma` (es Prisma, no TypeORM; no hay
> carpeta `entities/`). Infra (Postgres/Redis/Mailpit) en `docker-compose`.

---

## TDD (OBLIGATORIO para lógica nueva)

Para `services/`, `lib/`, schemas de shared, hooks custom y lógica de formularios:
Red (test que falla) → Green (mínimo) → Refactor → correr la suite relevante antes de
declarar hecho. No aplica a CSS/Tailwind puro, primitivas shadcn, ni spikes.

| Cambio toca                   | Correr antes de declarar éxito                                         |
| ----------------------------- | ---------------------------------------------------------------------- |
| service/controller backend    | `pnpm --filter @<scope>/api test` (+ `pnpm test:e2e` si cruza módulos) |
| componente/hook/util frontend | `pnpm --filter @<scope>/web test`                                      |
| algo ambiguo o grande         | `pnpm test:all`                                                        |

## Coverage gate (OBLIGATORIO antes de PR)

**80%** en statements/branches/functions/lines, en `api`, `web` y `shared`. Lógica
crítica ≥90%. Antes de PR: `pnpm pr-check` (= `pnpm lint` + `pnpm test:cov`). No bajar el
umbral; excluir solo infra con justificación (cliente Prisma, migraciones, `seed.ts`,
`main.ts`, `*.module.ts`, `prisma.service.ts`, generados de shadcn).

Tests: Jest + supertest (api), Vitest + Testing Library + jsdom (web y shared),
Playwright (si hay flujos de navegador). `*.spec.ts` (backend) / `*.test.tsx` (frontend),
colocados junto al fuente.

---

## Dev workflow (scripts en `package.json` — cross-platform, sin `make`)

```bash
pnpm install        # instala + genera cliente Prisma
pnpm infra:up       # levanta infra (postgres, redis, mailpit)   | infra:down | infra:clean
pnpm db:deploy      # aplica migraciones    | db:migrate (crea nueva) | db:seed | db:shell
pnpm build:shared   # compila packages/shared a dist/
pnpm test           # unit de los 3 paquetes | test:e2e | test:cov (gate) | test:all
pnpm pr-check       # lint + cobertura       | lint | type-check
```

Primer arranque: `pnpm install` → `pnpm infra:up` → `pnpm db:deploy` → `pnpm db:seed`.

Dos modos de dev (elige uno por proyecto):

- **Apps en host** (rápido de iterar): `infra:up` (solo postgres/redis/mailpit en docker) +
  `pnpm --filter @<scope>/api start:dev` y `pnpm --filter @<scope>/web dev`.
- **Full docker** (todo en contenedores): `docker compose up` levanta infra + api + web;
  hot reload por bind-mount del código (target `dev` del Dockerfile de cada app).

## Docker & deploy (full docker en Coolify)

Servicios que CORREN = un contenedor cada uno. `packages/shared` NO es contenedor: es
librería, se compila **dentro** de las imágenes de api y web.

| Servicio     | Dónde             | Nota                                                |
| ------------ | ----------------- | --------------------------------------------------- |
| postgres     | Coolify-managed   | backups automáticos                                 |
| redis        | Coolify-managed   | cache/lockout                                       |
| api (NestJS) | Dockerfile propio | **interna**, sin dominio público                    |
| web (Next)   | Dockerfile propio | dominio público; proxy `/api` → api por red interna |
| shared       | —                 | sin contenedor, horneado en api y web al construir  |

- **Un Dockerfile por app** (`apps/api/Dockerfile`, `apps/web/Dockerfile`), multi-stage con
  targets `dev` (bind-mount + `pnpm dev`, para el compose local) y `prod` (imagen slim).
- **prod api:** `pnpm install` → `build:shared` → build api → runtime mínimo; el arranque
  corre `prisma migrate deploy` antes de levantar.
- **prod web:** Next `output:'standalone'`; copia `.next/standalone` + `static`.
- **Llamadas API same-origin:** `next.config` `rewrites()` mapea `/api/:path*` → api interna;
  `lib/api.ts` usa `process.env.API_INTERNAL_URL` en RSC y `'/api'` en cliente (sin CORS,
  funciona desde el móvil).
- **Email:** transport switch — Mailpit en dev, Resend en prod (`MAIL_TRANSPORT`).
- Env por servicio en Coolify; secretos fuera del repo.

## CI & git hooks

- **GitHub Actions**: en PR y push a `main` → `pnpm lint` + `pnpm type-check` +
  `pnpm test:cov` (3 paquetes) + e2e contra Postgres de servicio.
- **husky**: pre-commit `lint-staged`; commit-msg `commitlint` (Conventional Commits);
  pre-push `pnpm lint && pnpm type-check && pnpm test`. Bypass: `--no-verify`.

---

## Reglas de trabajo

- **Superpowers primero** — process skills antes que implementation skills.
- **No instalar paquetes sin preguntar** — el stack es intencional. Excepción: devDeps de test evidentes.
- **TDD por defecto** para lógica nueva. No mergear lógica sin tests.
- **No bajar el gate de cobertura** — excluir con justificación, nunca silenciosamente.
- **No usar `any`** — `unknown` + type guards o tipos del dominio.
- **Sin strings de enum hardcodeados** — usar los enums de `packages/shared`.
- **Entidades de BD en `schema.prisma`** — fuente única. Migraciones con `pnpm db:migrate`.
- **DTOs/enums/schemas Zod en `packages/shared`** — nunca duplicar (salvo enums Prisma,
  sancionados y guardados por un enum-parity test).
- **Recompilar `shared`** tras editarlo, o api/web/seed importarán código viejo.
- **Cache/cálculo pesado en services**, nunca en controller ni frontend.
- **Imágenes vía un storage service** — URLs firmadas, la API no sirve binarios.
- **Commits en inglés**, Conventional Commits. Scope = módulo/carpeta.

## Git & GitHub

- **Commits y ramas: libremente** — no preguntar antes.
- **Nunca `git push`** — bajo ninguna circunstancia, tampoco `--force` / `--force-with-lease`.
  El push lo hace el desarrollador.
- **GitHub vía `gh`** sobre ramas ya pusheadas.
- **Ramas:** `feat/nombre`, `fix/descripcion`, `chore/tarea`.
