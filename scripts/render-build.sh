#!/usr/bin/env bash
#
# Build step for the Render deployment (see render.yaml and docs/DEPLOY.md).
#
# Produces the single-service layout: one Node process that serves both the API
# and the frontend bundle out of backend/public.
#
# Kept as a script rather than a long `&&` chain in render.yaml so each step is
# readable, `set -e` aborts the deploy on the first failure, and the same
# sequence can be run by hand on any other host.

set -euo pipefail

# Render sets NODE_ENV=production in the build environment, which makes npm omit
# devDependencies. Both build tools live there — vite (frontend) and prisma
# (backend) — so they have to be pulled in explicitly or the build fails.
#
# The repo root has no runtime dependencies of its own (only `concurrently`, for
# local dev), so it is skipped; `npm run build` below needs no node_modules.
echo "==> Installing dependencies"
npm ci --include=dev --prefix backend
npm ci --include=dev --prefix frontend

# The generated client is written into backend/node_modules and must exist
# before the server boots.
echo "==> Generating Prisma client"
npm run prisma:generate --prefix backend

# Builds frontend/dist, then copies it to backend/public (scripts/copy-frontend.js).
echo "==> Building frontend"
npm run build

# Schema first, then the seed. Both are safe to re-run: `migrate deploy` applies
# only pending migrations, and the seed upserts on unique keys — it never resets
# an existing admin password or already-configured tax rates.
echo "==> Applying database migrations"
npm run db:deploy --prefix backend

echo "==> Seeding reference data"
npm run db:seed --prefix backend

echo "==> Build complete"
