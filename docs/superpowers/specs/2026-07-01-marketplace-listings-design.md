# Epic 6 · Marketplace — Slice 1: Publicar venta + explorar (US-20, US-22)

## Contexto

Epic 4 (Inventario + Wishlist) mergeado (PR #9). Epic 6 Marketplace tiene 6 historias
(US-20 a US-25): publicar venta, publicar intercambio, explorar, ofertas/contraofertas,
chat en tiempo real, transacción+review. Demasiado grande para un slice — se decompone.

**Slice 1** cubre US-20 (publicar listing de venta) + US-22 (explorar/filtrar
marketplace). Fuera de scope: intercambios (US-21), ofertas/contraofertas (US-23,
requiere negociación+notificaciones), chat (US-24, requiere WebSocket), transacción real
y reviews (US-25, requiere `reputationScore`). Estas historias quedan para slices
posteriores de Epic 6, una vez exista la infra de notificaciones (Epic 8).

Este slice también introduce el módulo de **storage** que estaba planeado en el stack
(`docs/../CLAUDE.md` lo listaba como Cloudflare R2 "planeado") pero usando **RustFS
self-hosted** (S3-compatible, Apache 2.0) en su lugar — mismo `@aws-sdk/client-s3`, solo
cambia el endpoint. Se sigue el patrón ya validado en `route-page-app`
(`backend/route-page-api/src/storage/`, `src/image/image-compressor.service.ts`).

## Arquitectura

### `apps/api/src/storage/` (genérico, reusable — no solo marketplace)

- `S3ClientProvider` — construye `S3Client` desde `S3_ENDPOINT`, `S3_REGION`,
  `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `forcePathStyle: true`.
- `StorageService` — `upload(key, buffer, mimeType, cacheControl?): Promise<string>`,
  `delete(key): Promise<void>`, resuelve URL pública vía `S3_PUBLIC_URL`.
- `S3BucketInitializer` — en boot, crea bucket `marketplace-listings` si no existe y le
  aplica policy public-read (RustFS soporta `PutBucketPolicy`).
- `StorageModule` — `@Global()`, expone `StorageService`.

### `apps/api/src/image/`

- `ImageCompressorService.compress(buffer): Promise<{buffer, mime: 'image/webp', ext}>`
  — Sharp: `rotate()` + `resize({width/height: 2048, fit: 'inside', withoutEnlargement:
true})`, luego WebP con calidad adaptativa (80 → baja de 10 en 10 hasta 40, luego
  downscale ×0.75) hasta caber en budget de bytes (256 KB por defecto), igual algoritmo
  que route-page-app.

### `apps/api/src/marketplace/`

Módulo nuevo: `ListingsController`, `ListingsService`, `ListingPhotosController`
(o rutas anidadas en el mismo controller), DTOs Zod importados de `packages/shared`.

## Modelo de datos (Prisma)

```prisma
enum ListingStatus {
  ACTIVE
  PAUSED
  SOLD_OUT
}

model Listing {
  id               String         @id @default(cuid())
  sellerId         String
  seller           User           @relation(fields: [sellerId], references: [id])
  collectionItemId String
  collectionItem   CollectionItem @relation(fields: [collectionItemId], references: [id])
  quantity         Int
  condition        Condition
  price            Decimal        @db.Decimal(12, 2)
  description      String?
  status           ListingStatus  @default(ACTIVE)
  photos           ListingPhoto[]
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  @@index([collectionItemId])
  @@index([sellerId])
  @@index([status])
}

model ListingPhoto {
  id        String   @id @default(cuid())
  listingId String
  listing   Listing  @relation(fields: [listingId], references: [id], onDelete: Cascade)
  key       String
  createdAt DateTime @default(now())
}
```

`User.country String?` (ISO-3166 alpha-2, ej. `"ES"`) añadido al modelo `User` existente.
Editable vía el endpoint de perfil de Epic 1 (`PATCH /users/me`).

`Condition` y `ListingStatus` se duplican en `packages/shared` (enum-parity, igual que el
resto de enums Prisma — ver `apps/api/src/catalog/enum-parity.spec.ts`, hay que añadir
`ListingStatus` a ese guard).

### Disponibilidad (sin mutar `UserInventory.quantity`)

No se resta cantidad de `UserInventory` al crear un listing (evita doble fuente de
verdad). Al crear/reactivar/editar cantidad de un listing:

```
disponible = inventory.quantity - SUM(listing.quantity WHERE collectionItemId = X
             AND sellerId = user AND status = ACTIVE AND id != <este listing>)
```

Si `listing.quantity > disponible` → 400. El vendedor decide manualmente cuándo pasar a
`SOLD_OUT` (no hay compra real todavía; eso es US-23/25). "Pausar" = `PAUSED` (no visible
en `GET /marketplace/listings` público, sí en `/marketplace/mine`). "Eliminar" = hard
delete (cascada de `ListingPhoto`, borrando también los objetos en RustFS).

## API

Rutas nuevas, JWT donde se indique (reusa `JwtAuthGuard` de Epic 1):

| Método | Ruta                                        | Auth      | Descripción                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/marketplace/listings`                     | JWT       | Crea listing. Body: `collectionItemId, quantity, condition, price, description?`. Valida disponibilidad.                                                                                                                                                                                                                                                          |
| GET    | `/marketplace/listings`                     | público   | Filtros: `collectionId?, collectionItemId?, q?, priceMin?, priceMax?, condition?, country?, sort? (price_asc\|price_desc\|recent\|best_rated), page?`. Solo `status=ACTIVE`. `best_rated` se acepta pero es no-op (placeholder hasta que exista `reputationScore`, US-25) — documentado en el DTO de shared con comentario, y en la UI deshabilitado con tooltip. |
| GET    | `/marketplace/listings/:id`                 | público   | Detalle + fotos + `seller {username, country, avatarUrl}`. Incluye listings en `PAUSED`/`SOLD_OUT` solo si el requester es el owner.                                                                                                                                                                                                                              |
| PATCH  | `/marketplace/listings/:id`                 | JWT owner | Edita `price, description, status, quantity` (revalida disponibilidad si sube `quantity`).                                                                                                                                                                                                                                                                        |
| DELETE | `/marketplace/listings/:id`                 | JWT owner | Hard delete + borra fotos de RustFS.                                                                                                                                                                                                                                                                                                                              |
| POST   | `/marketplace/listings/:id/photos`          | JWT owner | Multipart, máx 5 fotos totales por listing, comprime a WebP.                                                                                                                                                                                                                                                                                                      |
| DELETE | `/marketplace/listings/:id/photos/:photoId` | JWT owner | Borra foto (DB + RustFS).                                                                                                                                                                                                                                                                                                                                         |

`PATCH /users/me` (Epic 1, existente) gana campo opcional `country`.

## Web (`apps/web`)

- `/marketplace` — grid/lista toggle, filtros (colección, ítem con autocomplete, precio
  min/max, condición, país), orden (precio↑/↓, reciente; "mejor valorado" visible pero
  deshabilitado con tooltip "próximamente"). Público, sin login.
- `/marketplace/[id]` — detalle. CTA "Ofertar"/"Comprar" deshabilitado con badge
  "próximamente" (US-23 fuera de scope).
- `/marketplace/new?itemId=` — formulario de creación desde un ítem del inventario;
  entrypoint también añadido al panel de inventario existente (`/inventory`).
- `/marketplace/mine` — gestión de listings propios: editar precio/descripción,
  pausar/reactivar, eliminar, subir/borrar fotos (máx 5, preview).
- Formulario de perfil (Epic 1) gana select de país (lista ISO-3166 fija).

## Testing

- TDD por pieza: `storage`, `image`, `marketplace`. Gate 80% (statements/branches/
  functions/lines) en `api`/`web`/`shared`.
- `storage/`: unit tests con `S3Client` mockado (jest). E2E real contra RustFS del nuevo
  servicio dev en `docker-compose.yml`.
- Casos borde a cubrir:
  - Subir >5 fotos en total → 400.
  - Archivo no-imagen o corrupto → 422 (compresión falla antes de tocar RustFS).
  - `quantity` > disponible al crear o al subir cantidad en edit → 400.
  - Editar/borrar listing o foto ajena → 403.
  - Listing/foto inexistente → 404.
  - Fallo de upload a RustFS tras validar DTO → no crea fila en DB.
  - Fallo al guardar en DB tras subir a RustFS → cleanup simétrico (borra el objeto ya
    subido), igual que route-page-app.
  - `enum-parity.spec.ts` extendido para cubrir `ListingStatus`.

## Infra dev

Añadir a `docker-compose.yml`:

```yaml
rustfs:
  image: rustfs/rustfs
  container_name: sobrebox-rustfs
  ports:
    - '9000:9000' # S3 API
    - '9001:9001' # consola
  environment:
    RUSTFS_ACCESS_KEY: ${S3_ACCESS_KEY}
    RUSTFS_SECRET_KEY: ${S3_SECRET_KEY}
    RUSTFS_VOLUMES: /data
  volumes:
    - rustfs_data:/data
```

Nuevas env vars (`.env`, documentadas en `.env.example`):
`S3_ENDPOINT=http://rustfs:9000`, `S3_REGION=us-east-1`, `S3_ACCESS_KEY`,
`S3_SECRET_KEY`, `S3_PUBLIC_URL` (para dev, ej. `http://localhost:9000`),
`S3_AUTO_CREATE_BUCKETS=true`.

## Deferred (fuera de este slice)

- US-21 intercambios, US-23 ofertas/contraofertas, US-24 chat, US-25 transacción+review.
- Reputación de vendedor real (bloquea el sort `best_rated`).
- Reutilizar `storage/` para avatares de perfil e imágenes de catálogo (ya queda listo
  el módulo genérico, pero no se migra nada existente en este slice).
- Búsqueda de país en filtro asume que el vendedor lo rellenó; sin `country` es excluido
  del filtro (no hay fallback a IP/geolocalización).
