#!/usr/bin/env node
// OS-agnostic launcher (Linux/macOS/Windows). Detects this host's Tailscale
// origins (IP + MagicDNS short/FQDN + tailnet wildcard) and exports them as
// ALLOWED_DEV_ORIGINS — consumed by apps/web/next.config.ts as allowedDevOrigins
// so Next 15.2+ doesn't refuse the cross-origin HMR websocket
// (NS_ERROR_WEBSOCKET_CONNECTION_REFUSED) when a phone on the tailnet loads the
// dev server — then runs the command passed as arguments. Degrades to local-only
// (var unset) when the `tailscale` CLI is missing or down.
import { execFileSync, spawn } from 'node:child_process';

const isWin = process.platform === 'win32';

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
