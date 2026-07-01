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
# Drop the prod `next build` output inherited from the build stage so the `.next`
# anon volume (compose) seeds EMPTY. Dev Turbopack then owns a clean cache that
# persists across restarts and never reconciles stale prod/host artifacts (which
# stalls compilation for 30s+). Done at build time — the runtime dir is a mount
# point, so it can't be removed while the container runs.
RUN rm -rf .next
EXPOSE 3000
CMD ["pnpm", "--filter", "@sobrebox/web", "dev"]
