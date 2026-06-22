#!/usr/bin/env node
// OS-agnostic launcher (Linux/macOS/Windows). Detects this host's Tailscale
// origins (IP + MagicDNS short/FQDN + tailnet wildcard) and exports them so the
// dev stack is reachable from a phone on the tailnet, then runs the command
// passed as arguments. Exports:
//   - ALLOWED_DEV_ORIGINS — apps/web/next.config.ts -> allowedDevOrigins, so
//     Next 15.2+ doesn't refuse the cross-origin HMR websocket.
//   - WEB_PUBLIC_URL — the API bakes this into the verification email link, so it
//     must be reachable from the device opening the email. Derived from the
//     MagicDNS FQDN + WEB_PORT so the link works on the phone (no hardcoding).
//   - CORS_ORIGINS — localhost + the tailnet web origin (harmless with the
//     same-origin /api proxy; correct if CORS is ever exercised directly).
// Degrades to local-only (vars unset) when the `tailscale` CLI is missing/down.
// An explicit WEB_PUBLIC_URL/CORS_ORIGINS already in the environment is respected.
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const isWin = process.platform === 'win32';
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

// Exported so apps/web/scripts/dev.mjs can reuse the detection without dup logic.
export function detectOrigins() {
  const origins = [];
  const run = (args) =>
    execFileSync('tailscale', args, { encoding: 'utf8', shell: isWin });
  try {
    const ip = run(['ip', '-4']).trim().split('\n')[0];
    if (ip) origins.push(ip);
  } catch {
    /* tailscale not installed / not up */
  }
  try {
    const status = JSON.parse(run(['status', '--json']));
    const fqdn = status?.Self?.DNSName?.replace(/\.$/, '');
    if (fqdn) {
      origins.push(fqdn); // FQDN        host.tailnet.ts.net
      origins.push(fqdn.split('.')[0]); // short name  host
      origins.push(`*.${fqdn.split('.').slice(1).join('.')}`); // *.tailnet.ts.net
    }
  } catch {
    /* no status / no MagicDNS */
  }
  return origins;
}

// The MagicDNS FQDN (host.tailnet.ts.net) or null. It's the one origin that
// has dots, isn't the wildcard, and isn't the numeric IP.
function detectFqdn(origins) {
  return (
    origins.find(
      (o) => o.includes('.ts.net') && !o.startsWith('*') && !/^\d/.test(o),
    ) ?? null
  );
}

// Read a single key from the repo-root .env (the launcher's own env doesn't have
// it loaded). Minimal parser; returns undefined if absent.
function rootEnv(key) {
  try {
    const raw = readFileSync(path.join(repoRoot, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      if (line.trim().startsWith('#')) continue;
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (m && m[1] === key)
        return (m[2] ?? '').trim().replace(/^['"]|['"]$/g, '');
    }
  } catch {
    /* no .env */
  }
  return undefined;
}

// Run as a CLI only when invoked directly (not when imported).
const invokedDirectly =
  process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (invokedDirectly) {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) {
    console.error(
      'usage: node scripts/with-tailscale-origins.mjs <command> [args...]',
    );
    process.exit(2);
  }

  const origins = detectOrigins();
  const env = { ...process.env };
  if (origins.length > 0) {
    env.ALLOWED_DEV_ORIGINS = origins.join(',');
    console.log(`[tailscale] allowedDevOrigins = ${env.ALLOWED_DEV_ORIGINS}`);

    const fqdn = detectFqdn(origins);
    const webPort = process.env.WEB_PORT ?? rootEnv('WEB_PORT') ?? '3001';
    if (fqdn) {
      const webOrigin = `http://${fqdn}:${webPort}`;
      // Respect an explicit override; otherwise point the email link + CORS at
      // the tailnet host so the phone can open the verification link.
      if (!process.env.WEB_PUBLIC_URL) {
        env.WEB_PUBLIC_URL = webOrigin;
        console.log(`[tailscale] WEB_PUBLIC_URL = ${env.WEB_PUBLIC_URL}`);
      }
      if (!process.env.CORS_ORIGINS) {
        env.CORS_ORIGINS = `http://localhost:${webPort},${webOrigin}`;
      }
    }
  } else {
    console.warn(
      '[tailscale] no Tailscale origins detected — starting local-only',
    );
  }

  const child = spawn(cmd, args, { stdio: 'inherit', env, shell: isWin });
  child.on('error', (err) => {
    console.error(err.message);
    process.exit(1);
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}
