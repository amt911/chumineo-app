import type { NextConfig } from 'next';
import path from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';

// Comma-separated hostnames/IPs allowed to reach the Turbopack dev server from a
// different origin (Next 15.2+ refuses the cross-origin HMR websocket otherwise).
// Populated by the `dev:tailscale` scripts with this host's tailnet origins so a
// phone on the tailnet can load the dev server. Empty/unset = local-only.
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// The API lives on the PC at API_PROXY_TARGET (default the local api port).
// The browser calls a same-origin `/api/*` path; Next proxies it server-side to
// the API. This makes client calls device-agnostic: a phone loading the dev
// server over the tailnet hits `<that-origin>/api/...` and never needs to resolve
// `localhost` itself. Avoids CORS entirely (same origin).
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

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
export default withNextIntl(nextConfig);
