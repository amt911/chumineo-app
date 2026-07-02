# Spec — Fotos de anuncios en la UI del marketplace

Fecha: 2026-07-02
Épica: 6 (Marketplace) — cierre de deuda del slice-1
Rama: `feat/marketplace-listing-photos-ui`

## Problema

El backend de fotos de anuncios está completo y el cliente HTTP también, pero no hay
UI que lo use:

- **Backend** (ya existe, PR #10): `POST /marketplace/listings/:id/photos` (máx 5,
  WebP→RustFS) y `DELETE /marketplace/listings/:id/photos/:photoId`.
- **Cliente** (ya existe, `apps/web/lib/api.ts`): `uploadListingPhotos(id, files, token)`
  y `deleteListingPhoto(listingId, photoId, token)`. `ListingDto.photos: ListingPhotoDto[]`
  (`{ id, url }`) ya viaja en las respuestas.

Faltan dos piezas puramente de front:

1. **Detalle** (`components/marketplace/listing-detail.tsx`) sólo pinta la imagen de
   catálogo (`item.imageUrl`) e ignora `listing.photos`.
2. **Mis anuncios** (`components/marketplace/my-listings.tsx`) no permite subir ni borrar
   fotos.

Este spec es **frontend-only**. No toca API, Prisma ni shared.

## Alcance

### 1. Galería en el detalle — `listing-detail.tsx`

- Construir el array de galería: `listing.photos.map(p => p.url)` (fotos del vendedor
  primero) seguido de `item.imageUrl` si existe (catálogo al final).
- Imagen **principal** = `gallery[selectedIndex]`, `selectedIndex` en `useState` (0 por
  defecto → primera foto del vendedor, o catálogo si no hay fotos).
- **Tira de miniaturas** debajo de la principal; click en una miniatura cambia
  `selectedIndex`. La miniatura activa se resalta (p.ej. `ring-2 ring-primary`).
- Si la galería está vacía → placeholder `aspect-square rounded bg-muted` (como hoy).
- El componente pasa a ser cliente (`'use client'`) por el `useState`. Alternativa
  descartada por complejidad innecesaria: dejar el server component y extraer sólo la
  galería a un componente cliente hijo.
- Cuando la galería tiene una sola imagen, la tira de miniaturas puede omitirse (no aporta).

### 2. Gestión de fotos en Mis anuncios — `my-listings.tsx`

Por cada anuncio de la lista (thumbnails **siempre visibles**, opción elegida):

- **Tira de miniaturas** de `listing.photos`. Cada miniatura lleva un botón `×` que llama
  `deleteListingPhoto(listing.id, photo.id, token)` y, en éxito, invalida
  `['marketplace','mine']`.
- **Botón "Subir"** que dispara un `<input type="file" accept="image/*" multiple>` oculto.
  Al elegir archivos → `uploadListingPhotos(listing.id, files, token)`; en éxito invalida
  `['marketplace','mine']`. Toast de éxito/error.
- El botón "Subir" se **deshabilita** cuando `listing.photos.length >= 5` (el server
  también valida; el disable es UX). Con archivos que excederían 5, el server responde 400
  y se muestra toast de error.
- La fila mantiene el layout actual (nombre — precio — estado — pausar/borrar); las
  miniaturas + botón subir se añaden en la misma tarjeta.

### Contrato de datos a verificar en implementación

`fetchMyListings` (`GET /marketplace/listings/mine`) **debe** devolver `photos` en cada
anuncio. `listingSchema` exige `photos: z.array(listingPhotoSchema)`, así que si el
endpoint no lo incluyera, el `.parse` ya fallaría hoy; se confirma en el primer test/manual.
No se asume: es un check explícito en la Task de implementación.

## Fuera de alcance (deuda consciente, ya listada en el handoff)

- **Atomicidad del multi-upload**: si falla a mitad, las fotos ya subidas quedan. Se
  mantiene como está (el backend sube una a una). No se aborda aquí.
- Reordenar fotos / elegir foto de portada.
- Recorte/preview antes de subir.
- Paginación de `/marketplace`, label dinámico pausar/reactivar, código muerto `mine` en
  `listingQuerySchema` — deuda separada, no entra en este slice.

## i18n

Nuevas claves en el namespace `Marketplace` (en `apps/web/locales/en.json` y
`apps/web/locales/es.json`), p.ej.:

- `uploadPhotos` — etiqueta del botón subir ("Subir fotos").
- `deletePhoto` — aria-label/título del botón `×` ("Borrar foto").
- `photoLimit` — texto/tooltip cuando se alcanza el máximo ("Máximo 5 fotos").
- `photosUploaded` / `photoDeleted` — toasts de éxito.
- `photoUploadError` — toast de error.

Sin strings hardcodeados en los componentes; todo vía `useTranslations('Marketplace')`.
Añadir las claves en ambos locales (`en.json` y `es.json`).

## Testing (TDD obligatorio)

Vitest + Testing Library. Mockear las funciones de `@/lib/api`.

**`listing-detail.test.tsx`** (extender):

- Renderiza la primera foto del vendedor como principal cuando hay `photos`.
- Renderiza una miniatura por cada imagen de la galería (fotos + catálogo).
- Click en una miniatura cambia la imagen principal.
- Sin `photos` → usa `item.imageUrl` como principal.
- Sin `photos` ni `item.imageUrl` → placeholder.

**`my-listings.test.tsx`** (extender):

- Renderiza una miniatura por cada `listing.photos`.
- Click en `×` llama `deleteListingPhoto` con `(listingId, photoId, token)`.
- Elegir archivos en el input llama `uploadListingPhotos` con `(listingId, files, token)`.
- Botón subir deshabilitado cuando el anuncio ya tiene 5 fotos.
- (Opcional) toast de error cuando `uploadListingPhotos` rechaza.

Gate: `pnpm --filter @sobrebox/web test` verde y cobertura del web ≥80% (no bajar el gate).

## Criterios de aceptación

1. En `/marketplace/[id]`, un anuncio con fotos muestra la foto del vendedor como
   principal y una tira de miniaturas navegable; sin fotos, cae al catálogo o placeholder.
2. En `/marketplace/mine`, cada anuncio muestra sus fotos, permite borrarlas
   individualmente y subir nuevas (hasta 5), con la lista refrescándose tras cada acción.
3. Tests verdes y `pnpm pr-check` limpio.
