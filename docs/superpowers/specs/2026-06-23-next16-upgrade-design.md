# Upgrade Next.js 15.5 → 16 — design

> Prerequisito del slice de deploy Coolify
> ([2026-06-23-coolify-deploy-design.md](2026-06-23-coolify-deploy-design.md)). Slice
> pequeño: bump de deps + verificación, sin lógica nueva.

## Por qué

Next 16 hace **Turbopack** el bundler por defecto y estable también en el **build de
producción**, soportando `output:'standalone'` — que es lo que necesita el deploy
dockerizado. En 15.5 el build prod con turbopack no emitía el standalone.

## Riesgo: BAJO

Research del 2026-06-23 (guía oficial Next 16 + escaneo de `apps/web`): la app ya cumple
casi todos los breaking changes.

- ✅ params async ya se await-ean (`app/collections/[slug]`, `app/profile/[username]`).
- ✅ sin `next/image` ni config `images`; `next/link` con sintaxis moderna.
- ✅ sin middleware / AMP / PPR / `dynamicIO` / `revalidateTag` / claves de config removidas.
- ✅ flat eslint config ya en uso; `useSearchParams` ya envuelto en `<Suspense>`.
- ✅ Node 26 ≥ 20.9, TS ^5 ≥ 5.1.
- ✅ `output:'standalone'` compatible con Turbopack en 16 (desbloquea el deploy).

## Cambios

- `apps/web/package.json`: `next` 15.5.19 → `^16`; `eslint-config-next` 15.5.19 → `^16`
  (**lockstep obligatorio** con `next`); `react`/`react-dom` 19.1 → `^19.2`.
- Opcional: quitar `--turbopack` de los scripts dev/build (ya es default en 16; dejarlo es
  inocuo). Decidir en implementación.
- Verificar `scroll-behavior` en `app/layout.tsx` (16 ya no fuerza `smooth` en navegación;
  solo actuar si se usa).

## Fuera de alcance

`output:'standalone'` (va en el slice de deploy); features nuevas (Cache Components, etc.);
bump de otras deps (vitest / @vitejs/plugin-react — en su propia cadencia, no acopladas a
Next 16).

## Cómo

Bump manual de los 4 paquetes + `pnpm install` (predecible y revisable). Codemod oficial
(`pnpm dlx @next/codemod@canary upgrade latest`) como **fallback** si el build se queja.

## Verificación (gate como red — no hay lógica nueva)

`pnpm --filter @sobrebox/web build` (turbopack default) · `test` · `type-check` ·
`pnpm lint` (eslint-config-next 16) · smoke manual (catálogo / auth / perfil) ·
`pnpm pr-check` verde.

## Fuentes

- <https://nextjs.org/docs/app/guides/upgrading/version-16>
- <https://nextjs.org/blog/next-16>
