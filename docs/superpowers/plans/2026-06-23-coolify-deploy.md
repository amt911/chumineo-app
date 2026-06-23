# Coolify full-docker deploy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dockerize the monorepo (api + web) so it deploys to Coolify as separate services, with a local full-docker compose for dev.

**Architecture:** Two multi-stage Dockerfiles (api, web), each with a `dev` target (bind-mount + hot reload) and a `prod` target (slim runtime). Prod on Coolify = managed Postgres + Redis + api (internal) + web (public temp domain) with the existing same-origin `/api` proxy. `packages/shared` is compiled into each image (not a service). prod api runs `prisma migrate deploy` on start; prod web runs the Next standalone server.

**Tech Stack:** Docker multi-stage, node:22-alpine, pnpm 11 (corepack), Next 16 (Turbopack + `output:'standalone'`), Prisma 6, NestJS 10.

**Spec:** `docs/superpowers/specs/2026-06-23-coolify-deploy-design.md`

## Global Constraints

- **Next 16 is already on `main`** (prerequisite merged): Turbopack is the default builder and supports `output:'standalone'`.
- **pnpm workspace, single lockfile.** Build context for both Dockerfiles = **repo root**. Base image `node:22-alpine` + `corepack enable` (pnpm@11.3.0, pinned in root `package.json`).
- **`@sobrebox/shared` must be built (`pnpm build:shared`) before api/web build** inside the image.
- **api prod image must include the `prisma` CLI** (it is a devDependency) + `apps/api/prisma/` so the entrypoint can run `prisma migrate deploy`. v1 copies the whole built `/app` (spec-sanctioned; slimming is out of scope).
- **`argon2` is a native addon** → the api build stage needs Alpine `python3 make g++`.
- **api postinstall runs `prisma generate`** → `apps/api/prisma/schema.prisma` must exist before `pnpm install` in the api image.
- **Email is zero code** (transport switch exists): prod sets `MAIL_TRANSPORT=resend` + `RESEND_API_KEY` + `MAIL_FROM` in Coolify; dev = Mailpit. No `noop` service.
- **Coverage gate unchanged (80%).** This slice adds infra (Dockerfiles, compose, `.dockerignore`, docs) + one trivial code change (`next.config`), none of which add testable logic — the gate must stay green but no new unit tests are required. Infra is verified by `docker build` / `docker compose up` / smoke checks.
- **Conventional Commits, English. Never `git push`** (the developer pushes). Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File structure

- `apps/web/next.config.ts` — add `output:'standalone'` + `outputFileTracingRoot` (repo root) so the monorepo standalone layout is predictable. _(Task 1)_
- `.dockerignore` (root, **create**) — keep `node_modules`/`.next`/`.git`/`graphify-out` out of the build context. _(Task 2)_
- `apps/api/Dockerfile` (**create**) — multi-stage `build`/`prod`/`dev`. _(Task 2)_
- `apps/api/docker-entrypoint.sh` (**create**) — `prisma migrate deploy` then `node dist/main`. _(Task 2)_
- `apps/web/Dockerfile` (**create**) — multi-stage `build`/`prod`(standalone)/`dev`. _(Task 3)_
- `docker-compose.yml` (**modify**) — add `sobrebox-api` + `sobrebox-web` dev services. _(Task 4)_
- `.env.example` (**modify**) — prod env block + remove the stale `JWT_SECRET`. _(Task 5)_
- `docs/DEPLOY.md` (**create**) + `docs/FINDINGS.md` (**modify**) — Coolify runbook + gotchas. _(Task 6)_

---

### Task 1: Next standalone output

**Files:**

- Modify: `apps/web/next.config.ts`

**Interfaces:**

- Produces: a production build that emits `apps/web/.next/standalone/apps/web/server.js` (consumed by the web Dockerfile in Task 3).

- [ ] **Step 1: Add `output` + `outputFileTracingRoot` to next.config**

Edit `apps/web/next.config.ts` — add the two keys at the top of `nextConfig` and the `node:path` import. Final file:

```ts
import type { NextConfig } from 'next';
import path from 'node:path';

// Comma-separated hostnames/IPs allowed to reach the Turbopack dev server from a
// different origin (Next 15.2+ refuses the cross-origin HMR websocket otherwise).
// Populated by the `dev:tailscale` scripts with this host's tailnet origins so a
// phone on the tailnet can load the dev server. Empty/unset = local-only.
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// The API lives at API_PROXY_TARGET (default the local api port). The browser
// calls a same-origin `/api/*` path; Next proxies it server-side to the API.
// Device-agnostic (phone over tailnet) and CORS-free (same origin).
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

const nextConfig: NextConfig = {
  // Standalone server for the Docker prod image (self-contained .next/standalone).
  output: 'standalone',
  // Pin the file-tracing root to the monorepo root so the standalone layout is
  // deterministic: .next/standalone/apps/web/server.js + .next/standalone/node_modules.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@sobrebox/shared'],
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiProxyTarget}/:path*` }];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Build and verify the standalone server is emitted**

Run: `pnpm build:shared && pnpm --filter @sobrebox/web build && ls apps/web/.next/standalone/apps/web/server.js`
Expected: build succeeds and `ls` prints the `server.js` path (no "No such file"). This is the exact path the web Dockerfile copies in Task 3.

- [ ] **Step 3: Verify the gate still passes**

Run: `pnpm --filter @sobrebox/web type-check && pnpm --filter @sobrebox/web test`
Expected: type-check clean; 42 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "feat(web): emit Next standalone output for Docker

Add output:'standalone' + outputFileTracingRoot (repo root) so the prod
Docker image runs a self-contained server.js."
```

---

### Task 2: api Dockerfile + entrypoint + root .dockerignore

**Files:**

- Create: `.dockerignore`
- Create: `apps/api/Dockerfile`
- Create: `apps/api/docker-entrypoint.sh`

**Interfaces:**

- Produces: image targets `prod` (entrypoint runs migrations then `node dist/main`, listens :3000) and `dev` (`pnpm --filter @sobrebox/api start:dev`). Consumed by Task 4 (compose `dev` target) and the Coolify deploy.

- [ ] **Step 1: Create the root `.dockerignore`**

Create `.dockerignore`:

```gitignore
node_modules
**/node_modules
.next
**/.next
dist
**/dist
coverage
**/coverage
.turbo
**/.turbo
.git
graphify-out
*.log
.env
.env.local
```

- [ ] **Step 2: Create `apps/api/docker-entrypoint.sh`**

Create `apps/api/docker-entrypoint.sh`:

```sh
#!/bin/sh
set -e
# Apply pending migrations against DATABASE_URL, then start the server.
# Idempotent: a no-op when there is nothing to migrate.
pnpm exec prisma migrate deploy
exec node dist/main
```

- [ ] **Step 3: Create `apps/api/Dockerfile`**

Create `apps/api/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- build: install the api subgraph (+ shared), build shared + api ----
FROM base AS build
# argon2 is a native addon; alpine needs a build toolchain to compile it.
RUN apk add --no-cache python3 make g++
# Manifests first (workspace graph). All package.json are needed for the graph.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# api postinstall runs `prisma generate`, which needs the schema present first.
COPY apps/api/prisma apps/api/prisma
RUN pnpm install --filter @sobrebox/api... --frozen-lockfile
# Source + build (shared before api).
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @sobrebox/shared run build
RUN pnpm --filter @sobrebox/api run build

# ---- prod: slim-ish runtime (no build toolchain); copies the built workspace ----
FROM base AS prod
ENV NODE_ENV=production
# Copy the whole built /app: node_modules (incl. prisma CLI + @prisma/client and
# the compiled argon2 binary), packages/shared/dist, apps/api/dist, prisma/, and
# the entrypoint. v1 favours "it works" over a minimal image (see spec).
COPY --from=build /app /app
WORKDIR /app/apps/api
RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]

# ---- dev: hot reload (source bind-mounted by compose) ----
FROM build AS dev
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["pnpm", "--filter", "@sobrebox/api", "start:dev"]
```

- [ ] **Step 4: Build the prod image and verify it carries dist + the prisma CLI**

Run:

```bash
docker build --target prod -t sobrebox-api:test -f apps/api/Dockerfile . \
  && docker run --rm --entrypoint sh sobrebox-api:test -c "node -e \"require('fs').accessSync('dist/main.js')\" && pnpm exec prisma --version | head -1"
```

Expected: build completes; the run prints a `prisma : 6.x` version line and no "No such file" for `dist/main.js`. (Confirms the build output and the prisma CLI are present in the prod image. Migrations themselves need a DB and are exercised in Task 4 / on Coolify.)

- [ ] **Step 5: Commit**

```bash
git add .dockerignore apps/api/Dockerfile apps/api/docker-entrypoint.sh
git commit -m "feat(api): add multi-stage Dockerfile + migrate-on-start entrypoint"
```

---

### Task 3: web Dockerfile (standalone prod + dev)

**Files:**

- Create: `apps/web/Dockerfile`

**Interfaces:**

- Consumes: the standalone build from Task 1 (`apps/web/.next/standalone/apps/web/server.js`).
- Produces: image targets `prod` (runs `node apps/web/server.js`, listens :3000) and `dev` (`pnpm --filter @sobrebox/web dev`). Consumed by Task 4 + Coolify.

- [ ] **Step 1: Create `apps/web/Dockerfile`**

Create `apps/web/Dockerfile`. Note: the repo has **no `apps/web/public/`** today, so there is no `public` COPY — add one only if a `public/` dir is introduced later.

```dockerfile
# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- build: install the web subgraph (+ shared), build shared, then next build ----
FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
# --filter web... installs only web + shared, so the api postinstall (prisma
# generate) never runs here and we don't need the api source.
RUN pnpm install --filter @sobrebox/web... --frozen-lockfile
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @sobrebox/shared run build
# next build (Turbopack default in 16) emits .next/standalone via output:'standalone'.
RUN pnpm --filter @sobrebox/web run build

# ---- prod: run the self-contained standalone server ----
FROM base AS prod
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Standalone bundle (server + traced node_modules) lands under .next/standalone
# mirroring the workspace path because outputFileTracingRoot is the repo root.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# ---- dev: hot reload (source bind-mounted by compose) ----
FROM build AS dev
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "--filter", "@sobrebox/web", "dev"]
```

- [ ] **Step 2: Build the prod image and verify it boots and serves a page**

Run:

```bash
docker build --target prod -t sobrebox-web:test -f apps/web/Dockerfile . \
  && docker run -d --name sbweb-test -p 3999:3000 sobrebox-web:test \
  && sleep 3 && curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost:3999/ ; \
  docker logs sbweb-test | tail -5 ; docker rm -f sbweb-test
```

Expected: build completes; `curl` prints `200` for `/` (the home page is static and renders without the api). If it prints `200`, the standalone server works.

- [ ] **Step 3: Commit**

```bash
git add apps/web/Dockerfile
git commit -m "feat(web): add multi-stage Dockerfile (Next standalone prod + dev)"
```

---

### Task 4: docker-compose full-docker dev (api + web)

**Files:**

- Modify: `docker-compose.yml`

**Interfaces:**

- Consumes: the `dev` targets from Tasks 2 and 3.
- Produces: `docker compose up` runs all 5 services with hot reload. (Coolify prod does NOT use this compose — it builds the `prod` targets as separate apps.)

- [ ] **Step 1: Add api + web dev services to `docker-compose.yml`**

Add these two services to the existing `services:` map (keep `sobrebox-db`, `sobrebox-redis`, `sobrebox-mailpit` as-is). Container-network env values **override** the host-oriented `.env` (db/redis are reached by service name inside the compose network):

```yaml
sobrebox-api:
  build:
    context: .
    dockerfile: apps/api/Dockerfile
    target: dev
  depends_on:
    sobrebox-db:
      condition: service_healthy
    sobrebox-redis:
      condition: service_started
  environment:
    NODE_ENV: development
    API_PORT: 3000
    DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@sobrebox-db:5432/${POSTGRES_DB}
    REDIS_URL: redis://sobrebox-redis:6379
    MAIL_TRANSPORT: smtp
    MAIL_SMTP_HOST: sobrebox-mailpit
    MAIL_SMTP_PORT: 1025
    CORS_ORIGINS: http://localhost:${WEB_PORT}
  ports:
    - '${API_PORT}:3000'
  volumes:
    - .:/app
    - /app/node_modules
    - /app/apps/api/node_modules
    - /app/packages/shared/node_modules

sobrebox-web:
  build:
    context: .
    dockerfile: apps/web/Dockerfile
    target: dev
  depends_on:
    - sobrebox-api
  environment:
    NODE_ENV: development
    WEB_PORT: 3000
    API_INTERNAL_URL: http://sobrebox-api:3000
    API_PROXY_TARGET: http://sobrebox-api:3000
  ports:
    - '${WEB_PORT}:3000'
  volumes:
    - .:/app
    - /app/node_modules
    - /app/apps/web/node_modules
    - /app/packages/shared/node_modules
```

> The anonymous volumes (`- /app/node_modules`, …) keep the container's own
> `node_modules` (with Linux-compiled `argon2`) instead of the host's, while the
> source bind-mount (`.:/app`) gives hot reload. `WEB_PORT`/`API_PORT` come from
> the root `.env` (host ports); inside the network both apps listen on :3000.

- [ ] **Step 2: Bring the full stack up and verify both apps respond**

Run:

```bash
pnpm bootstrap  # ensures .env exists
docker compose up -d --build
sleep 8
curl -fsS -o /dev/null -w "api /health -> %{http_code}\n" http://localhost:${API_PORT:-3100}/health
curl -fsS -o /dev/null -w "web / -> %{http_code}\n" http://localhost:${WEB_PORT:-3101}/
docker compose down
```

Expected: `api /health -> 200` and `web / -> 200`. (Use the actual `API_PORT`/`WEB_PORT` from `.env`.)

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: run api + web in docker-compose for local full-docker dev"
```

---

### Task 5: prod env documentation in .env.example

**Files:**

- Modify: `.env.example`

**Interfaces:** none (documentation/config only).

- [ ] **Step 1: Add a prod block and remove the stale `JWT_SECRET`**

In `.env.example`: delete the unused `JWT_SECRET` line (auth uses `JWT_ACCESS_SECRET`), and append a commented production block documenting every var a Coolify deploy needs. Append:

```bash

# ──────────────────────────────────────────────────────────────────────────
# Production (Coolify) — set these per service in the Coolify UI, NOT in git.
# api (internal service):
#   NODE_ENV=production
#   API_PORT=3000
#   DATABASE_URL=postgresql://<user>:<pwd>@<coolify-postgres-host>:5432/<db>
#   REDIS_URL=redis://<coolify-redis-host>:6379        # add :<pwd>@ if required
#   JWT_ACCESS_SECRET=<long-random-secret>             # MUST override the dev default
#   JWT_ACCESS_TTL=15m
#   JWT_REFRESH_TTL_DAYS=7
#   JWT_REFRESH_REMEMBER_DAYS=30
#   LOCKOUT_MAX_ATTEMPTS=5
#   LOCKOUT_WINDOW_MIN=15
#   MAIL_TRANSPORT=resend
#   RESEND_API_KEY=<resend-key>
#   MAIL_FROM=<verified-resend-sender>
#   WEB_PUBLIC_URL=https://<coolify-web-temp-domain>   # email verification links
#   CORS_ORIGINS=https://<coolify-web-temp-domain>
# web (public service):
#   NODE_ENV=production
#   PORT=3000
#   HOSTNAME=0.0.0.0
#   API_INTERNAL_URL=http://<coolify-api-internal-host>:3000
#   API_PROXY_TARGET=http://<coolify-api-internal-host>:3000
# ──────────────────────────────────────────────────────────────────────────
```

> Confirm the exact dev var names already present (`JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_DAYS`, etc.) match the block; copy real names from the existing file, do not invent.

- [ ] **Step 2: Verify nothing references the removed var**

Run: `grep -rn "JWT_SECRET" apps/ packages/ --include="*.ts" || echo "no code references — safe"`
Expected: prints "no code references — safe" (auth uses `JWT_ACCESS_SECRET`).

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs(env): document prod env vars; drop stale JWT_SECRET"
```

---

### Task 6: deploy runbook + FINDINGS

**Files:**

- Create: `docs/DEPLOY.md`
- Modify: `docs/FINDINGS.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Create `docs/DEPLOY.md`**

Create `docs/DEPLOY.md`:

```markdown
# Deploy — Coolify (full docker)

Each running service is its own Coolify resource. `packages/shared` is not a
service: it is compiled into the api and web images.

## Resources

1. **Managed Postgres 16** + **Managed Redis 7** (internal, not exposed).
2. **Application: api** — Dockerfile `apps/api/Dockerfile`, build context = repo
   root, target `prod`. No public domain (internal network only). Env: see the
   api block in `.env.example`. The container runs `prisma migrate deploy` on
   start, then `node dist/main` on :3000.
3. **Application: web** — Dockerfile `apps/web/Dockerfile`, build context = repo
   root, target `prod`. Public **temporary Coolify domain** + SSL. Env: see the
   web block in `.env.example` (`API_INTERNAL_URL`/`API_PROXY_TARGET` point at the
   api's internal host:3000). Runs `node apps/web/server.js` on :3000.

## Steps

1. Create the managed Postgres + Redis; copy their internal connection details
   into the api env (`DATABASE_URL`, `REDIS_URL`).
2. Create the api application (internal); set all api env vars.
3. Create the web application (public temp domain); set the web env vars to the
   api's internal host.
4. Connect the GitHub repo and enable **autodeploy on push to `main`** (webhook).
5. First deploy: the api applies migrations automatically. Seed the catalog once
   via the Coolify console: `pnpm db:seed`.

## Email

Prod uses Resend (`MAIL_TRANSPORT=resend` + `RESEND_API_KEY` + `MAIL_FROM`). Dev
uses Mailpit. The transport switch already exists — no code change.

## Local full-docker (parity)

`docker compose up --build` runs db + redis + mailpit + api + web with hot
reload. `pnpm dev` (apps on host) still works as the lighter alternative.
```

- [ ] **Step 2: Append gotchas to `docs/FINDINGS.md`**

Append to `docs/FINDINGS.md`:

```markdown
## Docker / deploy (Coolify)

- **Next standalone needs Webpack tracing, not the issue here:** Turbopack prod
  builds emit `output:'standalone'` only on **Next 16+** (15.5 did not). Pin
  `outputFileTracingRoot` to the repo root so the monorepo layout is
  deterministic: `.next/standalone/apps/web/server.js`.
- **api image: copy `apps/api/prisma/` before `pnpm install`.** The api
  `postinstall` runs `prisma generate`, which reads `schema.prisma`; without it
  the install fails.
- **argon2 is native** → the api build stage needs Alpine `python3 make g++`.
  The prod stage doesn't (the compiled `.node` is copied in `node_modules`).
- **prisma CLI is a devDependency** but the prod entrypoint runs
  `prisma migrate deploy` → the prod image copies the whole built `/app`
  (includes the CLI). Slimming is deferred.
- **compose dev overrides host env:** inside the compose network the db/redis are
  reached by service name (`sobrebox-db`, `sobrebox-redis`), not the host ports in
  `.env`; anonymous volumes keep the container's `node_modules` (Linux argon2).
```

- [ ] **Step 3: Commit**

```bash
git add docs/DEPLOY.md docs/FINDINGS.md
git commit -m "docs(deploy): add Coolify runbook + docker FINDINGS"
```

---

## Self-review notes

- **Spec coverage:** Dockerfiles api+web (Tasks 2,3) ✓; dev full-docker compose (Task 4) ✓; `output:'standalone'` (Task 1) ✓; migrate-on-start entrypoint (Task 2) ✓; prod env names + drop stale JWT_SECRET (Task 5) ✓; email = Resend prod / Mailpit dev, zero code (documented Tasks 5,6) ✓; autodeploy + deploy steps (Task 6) ✓. Spec risks (prisma generate ordering, argon2 toolchain, prisma CLI in prod, standalone monorepo path) all addressed in Tasks 1–2 and FINDINGS.
- **Out of scope (not planned, per spec):** R2/Sharp storage, observability, image slimming, custom domain, `docker-compose.prod.yml`.
- **Verification is build/run, not unit tests** — correct for infra; the existing suite + `pnpm pr-check` must stay green (no logic added).

```

```
