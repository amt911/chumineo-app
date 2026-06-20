import type { NextConfig } from 'next';

// Comma-separated hostnames/IPs allowed to reach the Turbopack dev server from a
// different origin (Next 15.2+ refuses the cross-origin HMR websocket otherwise).
// Populated by the `dev:tailscale` scripts with this host's tailnet origins so a
// phone on the tailnet can load the dev server. Empty/unset = local-only.
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  transpilePackages: ['@sobrebox/shared'],
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
};

export default nextConfig;
