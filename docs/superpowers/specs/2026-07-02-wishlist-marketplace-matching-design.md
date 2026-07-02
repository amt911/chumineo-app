# Epic 6 · Marketplace — Slice 2: Wishlist ↔ Marketplace matching

## Contexto

Tras el PIVOT (2026-06-24) el loop central del producto es **track collection → see
gaps → trade/buy/sell missing pieces**. Ya están mergeados los eslabones de los
extremos:

- **Track / gaps:** Epic 4 Inventario + Wishlist (PR #9) — el usuario marca qué le
  falta en su `WishlistItem` (con `priority` y `maxPrice?`).
- **Sell / browse:** Epic 6 slice-1 Marketplace (PR #10 listings + #11 fotos) —
  publicar `Listing` de venta y explorar/filtrar el marketplace.

Falta el **eslabón conector**: hoy el marketplace es un callejón sin salida respecto a
la wishlist. El usuario marca huecos en su colección, pero nada le dice cuáles de esos
huecos están **en venta ahora mismo**. Este slice pega ese eslabón: una vista privada,
read-only, "tus ítems de wishlist en venta por otros".

No es una historia nueva del `user-stories.md`; es glue de bajo coste entre US-16
(wishlist) y US-22 (explorar) que materializa el loop del pivot. Requiere **cero cambios
de schema** — es una lectura sobre `WishlistItem` + `Listing` existentes.

## Scope

**Dentro:**

- Vista privada del usuario logueado que cruza **su** wishlist con `Listing` activos de
  **otros** vendedores, sobre el mismo `CollectionItem`.
- Dos superficies:
  1. **Badge** en `/wishlist` — cada ítem con matches muestra "N en venta" (+ marca de
     in-budget).
  2. **Feed dedicado** `/wishlist/matches` — "Tus ítems faltantes en venta".
- Consciente de `maxPrice`: se muestran **todos** los listings, marcando cuáles están
  dentro de presupuesto (enfoque A — no se oculta nada).

**Fuera (diferido explícitamente para no hacer scope creep):**

- **Sin notificaciones/alertas** cuando aparece un match nuevo. Esto es pull-only: se
  computa on-page-load. Las alertas push son Epic 8 (Notificaciones).
- **Sin ofertas / contactar vendedor** (US-23) — el match enlaza al detalle del listing
  existente; comprar/ofertar es otro slice.
- **Sin dirección inversa** ("quién quiere lo que yo vendo").
- **Sin paginación** en este slice (la wishlist de un usuario es pequeña; se anota como
  follow-up si crece).

## Regla de match

Para el usuario logueado, un match es un `WishlistItem` suyo tal que existe al menos un
`Listing` con:

- `collectionItemId` == `wishlistItem.collectionItemId`
- `status == ACTIVE`
- `sellerId != userId` (nunca los propios listings del usuario)

`inBudget` de un listing = `wishlistItem.maxPrice != null && listing.price <= maxPrice`.
Si `maxPrice` es `null`, ningún listing se marca in-budget (pero todos se muestran).

## Arquitectura

### `apps/api` — nuevo slice de lectura en el módulo `marketplace`

Se sigue el layout ya existente del módulo `marketplace` (controller thin + service con
la lógica testeable en aislamiento). Un solo endpoint nuevo:

```
GET /marketplace/matches        (JWT requerido, owner-scoped a req.user.id)
```

- **`MatchesService`** — toda la lógica: query, cálculo de `inBudget`, counts y
  ordenación. Testeable sin HTTP.
- **Controller** — thin; extrae `userId` del JWT, delega en el service.

**Query:** cargar los `WishlistItem` del usuario con sus `Listing` activos asociados por
`collectionItemId` (join vía `CollectionItem`, ambos modelos ya indexados en
`collectionItemId`). Filtrar en memoria `sellerId != userId` y descartar wishlist items
sin ningún listing. Incluir datos del `collectionItem` (reusar el DTO de catálogo
existente) y del vendedor (`sellerName`, `country`) + `thumbnailUrl` de la primera foto
del listing.

**Serialización de Decimal — GOTCHA de `docs/FINDINGS.md`:** `price` y `maxPrice` son
`Prisma.Decimal`. Serializar SIEMPRE con `.toFixed(2)`, nunca `.toString()` (que
descarta ceros finales: `38.50` → `"38.5"`). El mismo bug latente ya documentado para
catalog/inventory.

**Ordenación (aplicada server-side para que ambas superficies coincidan):**

1. `priority` DESC (HIGH → MEDIUM → LOW)
2. dentro de misma priority, ítems con algún listing in-budget primero
3. desempate por `cheapestPrice` ascendente

Los `listings` dentro de cada match van ordenados `price_asc`.

### `packages/shared` — DTO

Nuevo `matchResponseSchema` (Zod) en `packages/shared/dto/`, exportado y recompilado
(`pnpm build:shared`). Forma:

```jsonc
// matchResponseSchema = z.array(matchItemSchema)
{
  "wishlistItemId": "clx...",
  "collectionItem": {
    /* collectionItemResponseSchema existente */
  },
  "priority": "HIGH", // WishlistPriority enum de shared
  "maxPrice": "45.00", // string | null (Decimal .toFixed(2))
  "listingCount": 3,
  "inBudgetCount": 2,
  "cheapestPrice": "38.00", // string (Decimal .toFixed(2))
  "listings": [
    // ordenado price_asc
    {
      "id": "cly...",
      "price": "38.00",
      "condition": "NEAR_MINT", // Condition enum de shared
      "sellerId": "clu...",
      "sellerName": "Ana",
      "country": "ES", // string | null
      "thumbnailUrl": "https://...", // string | null
      "inBudget": true,
    },
  ],
}
```

El badge de `/wishlist` se deriva de esta misma respuesta (`listingCount` +
`inBudgetCount`) — **un solo endpoint, una sola fuente de verdad**; el web deriva el
badge, sin segundo code path.

### `apps/web` — dos superficies

- **`lib/api.ts`** — wrapper tipado `getMatches()` que valida contra
  `matchResponseSchema`.
- **Hook** `useMatches()` (TanStack Query) — cache compartida por ambas superficies.
- **Superficie A · badge en `/wishlist`:** cada fila de wishlist con matches muestra un
  link-badge `🛒 N en venta` y, si `inBudgetCount > 0`, una marca verde
  `M dentro de presupuesto`. Click → `/wishlist/matches` anclado a ese ítem. Filas con 0
  matches no muestran nada (sin ruido). Link a `/wishlist/matches` en el header de
  `/wishlist`.
- **Superficie B · feed `/wishlist/matches`:** una card por ítem deseado (orden
  priority→in-budget→cheapest). Cada card: thumbnail + nombre + rareza del
  `collectionItem`, tu `priority` y `maxPrice`, y debajo la lista compacta de listings
  (precio, condición, `sellerName` + `country`, marca verde in-budget, thumbnail, link
  "Ver anuncio" al detalle del listing existente). Reusar componentes de card/foto del
  marketplace donde encajen. Empty state cuando no hay matches ("Ninguno de tus ítems de
  wishlist está en venta ahora mismo") con link a explorar el marketplace.

## Manejo de errores

- Endpoint owner-scoped: sin JWT → 401 (guard existente). No hay forma de pedir matches
  de otro usuario (siempre `req.user.id`).
- Usuario sin wishlist o sin ningún match → `200` con array vacío → empty state en el
  feed, ningún badge.
- Listing sin fotos → `thumbnailUrl: null`, el web muestra placeholder.

## Testing

TDD (obligatorio para lógica nueva). Gate de cobertura 80% en api/web/shared.

- **shared:** `matchResponseSchema` — válido/ inválido, `maxPrice` null, Decimal-como-
  string, enums (`priority`, `condition`).
- **api — `MatchesService` (el grueso):**
  - regla de match: excluye `status != ACTIVE`, excluye `sellerId == userId`, excluye
    wishlist items sin listings.
  - `inBudget`: `price <= maxPrice` → true; `price > maxPrice` → false pero mostrado;
    `maxPrice == null` → todos false pero mostrados.
  - ordenación priority→in-budget→cheapest y `listings` por `price_asc`.
  - counts (`listingCount`, `inBudgetCount`) y `cheapestPrice`.
  - serialización Decimal con `.toFixed(2)` (regresión del gotcha de FINDINGS).
  - resultado vacío.
- **api — controller/e2e:** JWT requerido (401 sin token); owner-scoped (usuario A no ve
  matches de B).
- **web:** `useMatches` hook + componentes badge y feed (Vitest + Testing Library) —
  badge renderiza count/in-budget, orden del feed, empty state.

Antes de PR: `pnpm pr-check` verde (lint + tsc + cobertura 3 paquetes).

## Documentación

Añadir `GET /marketplace/matches` a `docs/ENDPOINT_PERMISSIONS.md` en el mismo cambio.

## Sizing

1 endpoint de lectura + `MatchesService`, 1 schema de shared, 2 superficies web. Sin
migración, sin dependencias nuevas. Slice pequeño y auto-contenido.
