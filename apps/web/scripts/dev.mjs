#!/usr/bin/env node
// Web dev/start launcher. Three jobs the bare `next` CLI can't do cross-platform:
//   1. Load the monorepo root .env (Next only auto-loads apps/web/.env, but the
//      single source of truth lives at the repo root, like the api's ConfigModule
//      reads it). Real environment wins over the file.
//   2. Port from WEB_PORT (default 3001) — so the web app can be shifted off the
//      route-page-app / api defaults without hardcoding a port in package.json.
//   3. Optional Tailscale exposure (--tailscale): detect this host's tailnet
//      origins and export ALLOWED_DEV_ORIGINS so a phone on the tailnet can load
//      the dev server (next.config.ts feeds it to allowedDevOrigins). If something
//      upstream (the root `dev:tailscale`) already set it, we leave it alone.
// `next dev` binds 0.0.0.0 by default, so the server is reachable over the tailnet
// once the origin is allow-listed.
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url)); // apps/web/scripts
const repoRoot = path.resolve(here, '../../..');

// Minimal .env loader (no dep): KEY=VALUE lines, # comments, real env wins.
function loadRootEnv() {
  try {
    const raw = readFileSync(path.join(repoRoot, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (!m || line.trim().startsWith('#')) continue;
      const key = m[1];
      let val = (m[2] ?? '').trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* no root .env — fall back to defaults / inherited env */
  }
}

loadRootEnv();

const args = process.argv.slice(2);
const useTailscale =
  args.includes('--tailscale') || process.env.WITH_TAILSCALE === '1';
const isStart = args.includes('--start');

if (useTailscale && !process.env.ALLOWED_DEV_ORIGINS) {
  // Reuse the root detector so the logic lives in exactly one place.
  const detectorUrl = pathToFileURL(
    path.join(repoRoot, 'scripts/with-tailscale-origins.mjs'),
  ).href;
  try {
    const { detectOrigins } = await import(detectorUrl);
    const origins = detectOrigins();
    if (origins.length > 0) {
      process.env.ALLOWED_DEV_ORIGINS = origins.join(',');
      console.log(
        `[dev:tailscale] allowedDevOrigins = ${process.env.ALLOWED_DEV_ORIGINS}`,
      );
    } else {
      console.warn(
        '[dev:tailscale] no Tailscale origins detected — local-only',
      );
    }
  } catch (err) {
    console.warn(`[dev:tailscale] origin detection failed: ${err.message}`);
  }
}

const port = process.env.WEB_PORT ?? '3001';
const isWin = process.platform === 'win32';
const nextArgs = isStart
  ? ['start', '-p', port]
  : ['dev', '--turbopack', '-p', port];

// `next` is on PATH via node_modules/.bin when run through pnpm scripts.
const child = spawn('next', nextArgs, { stdio: 'inherit', shell: isWin });
child.on('error', (err) => {
  console.error(err.message);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 0));
