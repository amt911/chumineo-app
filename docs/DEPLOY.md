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
