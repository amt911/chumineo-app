# Deploy full-docker en Coolify — design

> Spec de despliegue. Brainstormeado y aprobado el 2026-06-23. Saca el monorepo a
> producción en Coolify con cada servicio dockerizado, y unifica el dev local en docker
> (hoy api/web corren en host). Web en dominio temporal de Coolify; **email real vía
> Resend** (transport switch, igual que route-page-app); **autodeploy** en push.

## Prerequisito (slice aparte, ANTES de este)

**Subir Next.js 15.5 → 16** en `apps/web`, como su propio slice (brainstorm/plan/PR +
gate verde). Motivo: en Next 16 el build de producción con **Turbopack** es estable y
emite `output:'standalone'`; en 15.5 no. Es un upgrade major (re-test completo, posibles
breaking changes), por eso va aislado. Este spec de deploy **asume Next 16** ya mergeado.

## Contexto

Hoy: `docker-compose.yml` levanta **solo infra** (postgres 16, redis 7, mailpit) con
puertos de host desplazados; `api` y `web` corren en host vía `pnpm dev`. No hay
Dockerfiles. `next.config` no tiene `output:'standalone'`. El proxy same-origin
(`/api` → api) y `lib/api.ts` (`API_INTERNAL_URL` en RSC, `/api` en cliente) ya existen y
son la base de la comunicación web↔api en cualquier entorno. El transport switch de email
(`MAIL_TRANSPORT` → Mailpit/SMTP o Resend) ya existe.

route-page-app NO sirve de plantilla de Dockerfiles (submódulos git, no pnpm workspace, y
sus `Dockerfile.prod` son stubs), pero **sí** es el modelo del email (mailpit dev / resend
prod) y del enfoque de imágenes (diferido, ver fuera de alcance).

## Objetivos

1. **2 Dockerfiles** (`apps/api`, `apps/web`), multi-stage, monorepo-aware, con targets
   `dev` (hot reload) y `prod` (slim).
2. **Dev full-docker:** `docker compose up` levanta infra + api + web, hot reload.
3. **Prod en Coolify:** Postgres y Redis **managed**; api y web como **Applications**
   separadas (cada una su Dockerfile, montable en más servicios); api interna, web pública
   (dominio temporal Coolify) con proxy `/api` → api por red interna.
4. **Migraciones automáticas:** la api corre `prisma migrate deploy` al arrancar.
5. **Email real:** prod `MAIL_TRANSPORT=resend`; dev `mailpit`. Sin cambios de código.
6. **Autodeploy:** Coolify reconstruye y despliega en cada push a `main` (webhook GitHub).

## No-objetivos (v1)

- **Storage R2 + Sharp** (subida/proceso de imágenes) — diferido; cuando toque, modelo =
  route-page-app, posiblemente como paquete propio.
- **Observabilidad** (Sentry/métricas/log aggregation) — Coolify ya da logs/CPU básicos.
- **Slimming agresivo** de imágenes (`pnpm deploy --prod` por app).
- **Dominio propio para el web** — de momento dominio temporal Coolify.
- **`docker-compose.prod.yml` con todo dentro** — **rechazado a propósito**: se quiere
  separación por servicio (Postgres/Redis managed + apps independientes), no un monolito.

---

## Arquitectura — topología prod

Cada cosa que corre = un recurso Coolify. `packages/shared` NO corre: es librería, se
compila **dentro** de las imágenes de api y web.

| Recurso Coolify | Tipo                            | Expuesto                               | Notas                                                    |
| --------------- | ------------------------------- | -------------------------------------- | -------------------------------------------------------- |
| Postgres 16     | Managed database                | no (interno)                           | backups Coolify                                          |
| Redis 7         | Managed database                | no (interno)                           | cache + lockout auth                                     |
| `api` (NestJS)  | Application (Dockerfile `prod`) | **no** (solo red interna)              | escucha :3000; `migrate deploy` al arrancar              |
| `web` (Next)    | Application (Dockerfile `prod`) | **sí**, dominio temporal Coolify + SSL | escucha :3000 (standalone); proxy `/api` → `api` interna |

```text
navegador ──HTTPS──> web (dominio temporal Coolify)
   /api/* ─(rewrites, red interna)─> api:3000 ──> Postgres / Redis (managed)
                                       └─ email ──> Resend
```

Sin CORS público (todo same-origin vía el proxy). La api nunca recibe tráfico directo de
internet.

---

## Componentes

### 1. `apps/api/Dockerfile` (multi-stage)

Build context = **raíz del repo** (necesita `pnpm-workspace.yaml`, `pnpm-lock.yaml`,
`packages/shared`, `apps/api`). Base `node:22-alpine` + `corepack enable` (pnpm 11.3).

- **deps/build stage:** instala toolchain nativo de Alpine (`apk add --no-cache python3
make g++`) para compilar `argon2`; **copia `apps/api/prisma/` ANTES de `pnpm install`**
  (el `postinstall: prisma generate` lee `schema.prisma`, sin él el install falla);
  `pnpm install --frozen-lockfile`, `pnpm build:shared`, `nest build` → `dist/`.
- **target `prod`:** imagen slim con `dist/`, `node_modules` (incluido `@prisma/client`
  generado **y el CLI `prisma`**) y `apps/api/prisma/` (schema + migrations).
  **Entrypoint:** `prisma migrate deploy && node dist/main`.
- **target `dev`:** sin build; bind-mount del código + `pnpm --filter @sobrebox/api start:dev`.

> **Riesgo:** `prisma` es `devDependency`; con `--prod` el `migrate deploy` fallaría.
> Plan: copiar `node_modules` del build stage (incluye el CLI) o mover `prisma` a deps. v1
> prioriza que funcione sobre tamaño mínimo.

### 2. `apps/web/Dockerfile` (multi-stage) — asume Next 16

Base `node:22-alpine` + corepack. Build context = raíz.

- **build stage:** `pnpm install`, `pnpm build:shared`, `next build` **(con `--turbopack`,
  estable en Next 16)** y `output:'standalone'` → `.next/standalone` + `.next/static` +
  `public`.
- **target `prod`:** copia el output standalone, fija `PORT=3000` y `HOSTNAME=0.0.0.0`,
  **CMD `node server.js`** (NO `pnpm start` / `dev.mjs`, que son convenience de host/dev).
- **target `dev`:** bind-mount + `pnpm --filter @sobrebox/web dev`.

> **Riesgo:** en monorepo, Next standalone emite el server bajo
> `.next/standalone/apps/web/server.js` y replica la estructura del workspace; copiar
> `.next/static` y `public` a las rutas correctas es el gotcha habitual. El plan fija las
> rutas con un `docker build` real y verifica que `server.js` existe antes de cablear el CMD.

### 3. `docker-compose.yml` (dev full-docker)

Añadir a la infra existente:

- `api` → build target `dev`, bind-mount del repo, depende de db (healthcheck) + redis,
  env desde `.env` raíz, puerto `${API_PORT}`.
- `web` → build target `dev`, bind-mount, depende de api, env desde `.env`, puerto
  `${WEB_PORT}`, `API_PROXY_TARGET=http://api:3000` (red de compose).

`pnpm dev` (host) sigue funcionando; el compose full-docker es alternativa. Bind-mount +
`node_modules` del contenedor (volumen anónimo para no pisar los del host).

### 4. `next.config.ts`

Añadir `output: 'standalone'`. El resto (transpilePackages, rewrites, allowedDevOrigins)
intacto. `apiProxyTarget` en prod = `API_PROXY_TARGET` (red interna, `http://api:3000`).

### 5. Entrypoint api

Script (`apps/api/docker-entrypoint.sh` o inline): `prisma migrate deploy` contra
`DATABASE_URL`, luego `node dist/main`. Idempotente.

---

## Cambios de código (mínimos)

Con email vía Resend, la lista se reduce mucho (sin `noop`, sin usuario sembrado):

1. **(Prerequisito, slice aparte)** Upgrade Next 15.5 → 16.
2. **`next.config.ts`** → `output:'standalone'`.
3. **Entrypoint api** (`migrate deploy` + arranque).
4. **`.env.example`:** bloque prod + **quitar el `JWT_SECRET` obsoleto** (auth usa
   `JWT_ACCESS_SECRET`).

El **email es cero código** (el transport switch ya existe: `MAIL_TRANSPORT=resend` +
`RESEND_API_KEY` + `MAIL_FROM` en Coolify). `lib/api.ts` y el proxy `/api` tampoco se tocan.

---

## Variables de entorno

Nombres exactos verificados en código/`.env.example`.

**api:** `NODE_ENV=production`, `API_PORT=3000`, `DATABASE_URL` (Postgres interno Coolify),
`REDIS_URL=redis://<host>:6379` (única var de Redis que lee el código; con password si la
managed la pide: `redis://:<pwd>@host:6379`), `JWT_ACCESS_SECRET` (**secreto real, no el
default `dev-access-secret`**), `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_DAYS`,
`JWT_REFRESH_REMEMBER_DAYS`, `LOCKOUT_MAX_ATTEMPTS`, `LOCKOUT_WINDOW_MIN`,
`MAIL_TRANSPORT=resend`, `RESEND_API_KEY`, `MAIL_FROM` (remitente verificado en Resend),
`WEB_PUBLIC_URL` (dominio temporal Coolify — para los links de verificación del email),
`CORS_ORIGINS` (dominio temporal del web; el default `localhost:3101` es solo fallback,
**hay que sobrescribirlo**).

**web:** `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`,
`API_INTERNAL_URL=http://api:3000` (RSC), `API_PROXY_TARGET=http://api:3000` (rewrites).

Secretos (JWT, DB password, Resend key) se guardan en Coolify, nunca en el repo.

---

## Email / auth

Email **funciona** en prod vía Resend (tienes dominio + Resend genérico). El registro
envía verificación real; el login bloquea a no-verificados (confirmado:
`auth.service` lanza `EMAIL_NOT_VERIFIED`); tras verificar, login OK. Dev sigue con Mailpit.
`WEB_PUBLIC_URL` = dominio temporal Coolify para que los links del email apunten al web. El
catálogo (público) funciona sin login.

## Datos iniciales (seed)

`pnpm db:seed` puebla el catálogo (brands/colecciones, como ahora) para tener algo que
mostrar. Se corre una vez tras el primer deploy vía consola/exec de Coolify (no en el
arranque, para no re-sembrar en cada reinicio). **No** hace falta usuario sembrado: el
registro+verificación real ya permiten crear cuentas.

## Despliegue en Coolify (pasos)

1. Crear **managed Postgres 16** + **managed Redis 7** (internos).
2. Crear **Application api**: repo + `apps/api/Dockerfile`, build context raíz, target
   `prod`; env (tabla arriba); sin dominio público (solo red interna).
3. Crear **Application web**: `apps/web/Dockerfile`, target `prod`; env; **dominio temporal
   Coolify + SSL**.
4. **Conectar el repo GitHub → autodeploy** en push a `main` (webhook).
5. Primer deploy: la api aplica migraciones sola; correr `pnpm db:seed` una vez por exec.

---

## Verificación

- **`docker build --target prod`** api y web — verde; verificar que
  `.next/standalone/apps/web/server.js` **existe** tras el build web.
- **`docker compose up`** local (full-docker dev) levanta los 5 servicios; web carga el
  catálogo con hot reload.
- Imagen prod web arranca con `node server.js` y sirve `/collections`.
- Imagen prod api arranca, aplica migraciones, responde `/health`; `register` devuelve 200
  y **envía email real** vía Resend (verificar en una bandeja de prueba).
- `pnpm pr-check` (lint + cobertura) verde. El cambio de código de este slice es trivial
  (`next.config`, entrypoint, `.env.example`); el upgrade a Next 16 se valida en su propio
  slice. Dockerfiles/compose/docs son infra, excluidos del gate.

## Riesgos / decisiones abiertas

- **Upgrade a Next 16** (prerequisito): re-test completo en su slice, con gate verde, antes
  de este deploy.
- Next standalone en monorepo: rutas de copia de `server.js`/`static`/`public` — el plan
  las fija con build real.
- Prisma CLI en imagen prod (resuelto: copiar node_modules del build stage + `apps/api/prisma/`).
- argon2 nativo en Alpine: el build stage añade `python3 make g++` (o binarios musl).
