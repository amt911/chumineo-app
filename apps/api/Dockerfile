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
