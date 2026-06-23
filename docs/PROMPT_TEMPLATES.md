# Prompt templates — arrancar / extender un proyecto en este estilo

Plantillas pegables para que un agente (Claude Code) construya **otro** proyecto con
el mismo stack, las mismas convenciones y el mismo flujo que SobreBox, o para añadir
páginas/features a este. Copia el bloque que necesites, rellena los `<…>` y pégalo.

> Orden mental: **stack canónico** (qué tecnologías) → **convenciones** (cómo se
> trabaja) → **prompts** (qué pedir). Los tres primeros bloques son contexto que
> pegas una vez; los prompts son lo que pides en cada tarea.
>
> **Para levantar un proyecto nuevo rápido**, no pegues los bloques 0/1 a mano: usa el
> kit en [`starter-kit/`](starter-kit/README.md) — plantillas rellenables de los 3 docs
> génesis (`CLAUDE.md`, `design-system.md`, `user-stories.md`) que viven en el repo y el
> agente lee solas. Este archivo es la librería de prompts por tarea.

---

## 0. Stack canónico (pégalo como contexto al arrancar un proyecto nuevo)

```text
Stack y arquitectura (NO desviarse sin avisar):

MONOREPO
- pnpm workspaces + Turborepo. Un solo repo.
- apps/api  (backend), apps/web (frontend), packages/shared (código compartido).
- packages/shared se COMPILA a dist/ (CommonJS + .d.ts) con tsc; main/types/exports
  apuntan a dist/. Api, web y seed lo consumen como JS compilado, NUNCA TS crudo.
  Recompilar con `pnpm build:shared` tras editarlo (turbo ^build lo encadena).

BACKEND (apps/api)
- NestJS 10 (módulos, DI, guards, interceptors). CommonJS, SIN "type":"module",
  SIN extensiones .js en imports. ts-jest por defecto de Nest.
- Prisma 6 (fijado; Prisma 7 genera cliente ESM incompatible). schema.prisma = fuente
  única de entidades + enums. Migraciones commiteadas. Seed corre con tsx.
- PostgreSQL 16.
- Validación con Zod (esquemas en packages/shared) vía un ZodValidationPipe.
- Redis + BullMQ para cache/jobs cuando haga falta (cache TTL en services, no en controllers).
- Passport + JWT para auth (access JWT + refresh opaco rotado y hasheado en BD).
- Email por transport switch (interface MailTransport): Mailpit/SMTP en dev, Resend en prod,
  seleccionado por env MAIL_TRANSPORT. Nunca acoplar el código a un proveedor.
- Imágenes vía un storage.service (URLs firmadas de S3/R2); la API nunca sirve binarios.

FRONTEND (apps/web)
- Next.js 15 (App Router, RSC, SSR). output:'standalone' para Docker.
- shadcn/ui en components/ui/ (NO editar a mano; regenerar). Tailwind CSS v4.
- TanStack Query v5 para server state (cache de listados/detalle).
- Zustand para client state (carrito, UI global, flujos en curso).
- transpilePackages:['@<scope>/shared'] en next.config.
- Llamadas API same-origin: rewrites() mapea /api/:path* -> API interno; lib/api.ts usa
  process.env.API_INTERNAL_URL en RSC y '/api' en cliente (funciona desde el móvil, sin CORS).

SHARED (packages/shared)
- Enums + schemas Zod + DTOs TypeScript. Todo lo que cruza la frontera HTTP se define
  AQUÍ una sola vez (api y web importan de shared). Compila a dist/.
- Enums de dominio viven aquí Y en schema.prisma (Prisma no referencia enums TS). Un
  test de enum-parity falla si divergen. Es la ÚNICA duplicación sancionada.

INFRA
- docker-compose para infra (postgres, redis, mailpit). En dev puede correr también
  api+web (full docker, hot reload por bind-mount) o en host, según el proyecto.
- Variables de entorno en .env raíz (gitignored) + .env.example commiteado.
```

---

## 1. Convenciones de trabajo (pégalo junto al stack)

```text
Reglas de trabajo (OBLIGATORIO):

SUPERPOWERS
- Process skills antes que implementation skills. Para feature/creativo: brainstorming.
  Para bug: systematic-debugging. Antes de implementar lógica: test-driven-development.
- Flujo: brainstorming -> spec en docs/superpowers/specs/ (revisado por mí) ->
  writing-plans -> plan revisado -> subagent-driven-development -> finishing-a-development-branch.
- NUNCA implementar sin spec aprobado por mí.

TDD (obligatorio para lógica: services, lib, schemas de shared, hooks, formularios)
- Red (test que falla) -> Green (mínimo) -> Refactor. Correr la suite relevante antes
  de decir "hecho". No aplica a CSS/Tailwind puro, primitivas shadcn, ni spikes.

COBERTURA
- Gate 80% (statements/branches/functions/lines) en api, web y shared. Lógica crítica >=90%.
- No bajar el umbral. Excluir solo infra (cliente Prisma, migraciones, seed, main.ts,
  *.module.ts, prisma.service, generados de shadcn) con justificación en config.

CÓDIGO
- Nada de `any` -> usar `unknown` + type guards o tipos de dominio.
- Sin strings de enum hardcodeados -> usar los enums de packages/shared.
- DTOs/enums/schemas SOLO en packages/shared, nunca duplicar (salvo enums Prisma sancionados).
- Cache/cálculos pesados en services, nunca en controllers ni frontend.

TESTS
- Backend: Jest + supertest (unit *.spec.ts colocados; e2e aparte). Frontend/shared:
  Vitest + Testing Library + jsdom (*.test.tsx colocados). E2E navegador: Playwright si aplica.

GIT
- Conventional Commits en inglés. Scope = módulo/carpeta. Ej: feat(stats): add empirical pull rate.
- Ramas feat/… fix/… chore/…. Commits y ramas libremente, sin preguntar.
- NUNCA `git push` (ni --force / --force-with-lease). El push lo hago YO.
- GitHub vía `gh` solo sobre ramas que YO ya pusheé.
- No instalar paquetes sin preguntar (excepto devDependencies de test evidentes).
```

---

## 2. Prompt — arrancar un proyecto nuevo desde cero

> Forma rápida: copia las plantillas de `starter-kit/` a la raíz del repo nuevo
> (`CLAUDE.md`, `design-system.md`, `user-stories.md`), rellénalas, y pega este prompt.
> El agente ya lee el stack/convenciones de `CLAUDE.md` — no hace falta pegar los bloques 0/1.

```text
Vamos a arrancar <NOMBRE_PROYECTO>: <una frase de qué hace y para quién>.

Ya están en el repo: CLAUDE.md (stack, módulos, reglas), design-system.md y
user-stories.md (backlog con prioridad MVP). Léelos. Si falta CLAUDE.md, los bloques 0 y 1
de abajo son su contenido.

Usa superpowers. Empieza por brainstorming para definir el alcance del PRIMER slice
(no todo el producto). Decomponer en épicas si es grande; brainstormear solo la primera.

Fase 0 (scaffolding) que quiero antes de cualquier feature:
- Monorepo pnpm + Turborepo con apps/api, apps/web, packages/shared.
- packages/shared compilando a dist/ con un enum y un schema Zod de ejemplo + su test.
- apps/api: NestJS 10 + Prisma 6 + Postgres, ZodValidationPipe, /health, PrismaModule @Global.
- apps/web: Next 15 App Router + shadcn + Tailwind v4 + TanStack Query provider.
- docker-compose con postgres, redis, mailpit. .env.example + scripts pnpm
  (infra:up/down, db:deploy/migrate/seed, build:shared, test, test:cov, pr-check, lint, type-check).
- husky: pre-commit lint-staged, commit-msg commitlint, pre-push lint+type-check+test.
- CI en GitHub Actions: lint + type-check + test:cov (3 paquetes) + e2e con Postgres de servicio.
- Un CLAUDE.md que documente stack, estrategia de módulos y reglas (como el de SobreBox).

No escribas código hasta que yo apruebe el spec del scaffolding. Pásame el diseño primero.
```

---

## 3. Prompt — nuevo slice / feature (épica)

```text
Quiero el slice "<NOMBRE_SLICE>" de la épica <ÉPICA>.

Objetivo de usuario: <user story: como X quiero Y para Z>.
Alcance v1 (YAGNI): <qué entra>. Fuera de alcance (placeholders honestos): <qué se difiere>.
Datos: <entidades nuevas/cambios en schema.prisma, si los hay>.

Usa superpowers: brainstorming -> spec (lo reviso) -> writing-plans -> plan (lo reviso) ->
subagent-driven-development (implementer+reviewer frescos por tarea, review final con opus) ->
finishing-a-development-branch.

Recuerda: contratos (DTOs/enums/Zod) en packages/shared; lógica con TDD; gate 80%;
endpoints documentados en docs/ENDPOINT_PERMISSIONS.md en el mismo cambio; gotchas no
obvios en docs/FINDINGS.md. No pushees: cuando esté, lo pusheo yo y abrimos PR con gh.
```

---

## 4. Prompt — nueva página (frontend)

```text
Quiero la página <RUTA, ej. /coleccion/[slug]> : <qué muestra y qué hace el usuario>.

- App Router. RSC por defecto; "use client" solo donde haya estado/interacción.
- Server state con TanStack Query (hook + fetcher tipado en lib/api.ts que valida la
  respuesta con un schema de packages/shared). Client state con Zustand si hace falta.
- UI con shadcn (components/ui), Tailwind v4, tokens del design-system. No editar ui/ a mano.
- Estados: loading (skeleton), empty, error boundary. Responsive y accesible.
- Si necesita datos nuevos del backend, primero el endpoint + su DTO en shared (otra tarea).

TDD para hooks/lógica de la página (Vitest + Testing Library). Cambios visuales puros sin test.
Pásame el diseño antes de implementar si la página tiene lógica no trivial.
```

---

## 5. Prompt — nuevo endpoint (backend)

```text
Quiero el endpoint <MÉTODO /ruta> : <qué hace>.

- DTO de entrada y salida + schema Zod en packages/shared (recompilar shared).
- Validación con ZodValidationPipe. Permisos: <público / auth / rol>; documéntalo en
  docs/ENDPOINT_PERMISSIONS.md en el mismo cambio.
- Lógica en el service (no en el controller). Cache/cálculo pesado en su service dedicado.
- Si toca BD: cambio en schema.prisma + `pnpm db:migrate` (no editar SQL a mano).
- TDD: unit *.spec.ts del service + e2e supertest del endpoint. Gate 80% (crítico >=90%).
```

---

## 6. Prompt — email (transport switch)

```text
Quiero enviar el email "<para qué, ej. verificación / reset>".

- Usa la interface MailTransport existente; NO acoples a un proveedor.
- Dev: Mailpit/SMTP (sink local, ver en su UI). Prod: Resend. Selección por env MAIL_TRANSPORT.
- La plantilla y el envío van en un mail service; el caller solo pide "manda este email".
- Links del email usan la URL pública del front (env, no hardcodear localhost).
- Test: unit del service con el transport mockeado.
```

---

## 7. Prompt — deploy full-docker en Coolify

```text
Quiero desplegar en Coolify, full docker. Servicios que corren = un contenedor cada uno:
postgres (managed por Coolify), redis (managed), api (Dockerfile propio), web (Dockerfile propio).
packages/shared NO es contenedor: es librería, se compila DENTRO de las imágenes de api y web.

- Un Dockerfile por app (apps/api/Dockerfile, apps/web/Dockerfile), multi-stage con
  targets `dev` (bind-mount + pnpm dev, para compose local) y `prod` (imagen slim).
- prod api: pnpm install -> build:shared -> build api -> imagen runtime mínima;
  arranque corre `prisma migrate deploy` antes de levantar.
- prod web: Next output:'standalone'; copia .next/standalone + static.
- api interna (sin dominio público); web con dominio + proxy /api -> api por red interna.
- Local: docker-compose.yml con infra + api(dev) + web(dev), hot reload.
- Env por servicio en Coolify; secretos fuera del repo.

Usa superpowers (brainstorming -> spec -> plan). Pásame el diseño antes de tocar nada.
```

---

## 8. Prompt — arreglar un bug

```text
Bug: <síntoma exacto, pasos para reproducir, comportamiento esperado vs real, logs/error textual>.

Usa systematic-debugging: reproducir primero, encontrar la causa raíz (no parchear el
síntoma), test que falle que capture el bug, arreglar, ver verde. Si el arreglo es no
obvio, añade nota a docs/FINDINGS.md.
```

---

## Notas de uso

- Pega **0 + 1** una vez por proyecto/sesión nueva (o asegúrate de que viven en el
  CLAUDE.md del repo, que es lo ideal). Luego usa los prompts 2–8 según la tarea.
- Cambia `@<scope>/shared` por el scope real del paquete (aquí `@sobrebox/shared`).
- Todos los prompts asumen: **no implementar sin spec aprobado** y **nunca pushear** (lo
  haces tú). Son la espina del flujo; el resto es relleno por tarea.
