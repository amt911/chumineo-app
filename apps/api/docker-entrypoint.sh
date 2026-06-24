#!/bin/sh
set -e
# Apply pending migrations against DATABASE_URL, then start the server.
# Idempotent: a no-op when there is nothing to migrate.
pnpm exec prisma migrate deploy
exec node dist/main
