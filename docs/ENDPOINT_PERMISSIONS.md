# Endpoint Permissions

> Referencia autoritativa de permisos de cada endpoint HTTP del backend.
> Última generación: 2026-07-02. **Actualiza esta tabla en el mismo cambio que añada o modifique endpoints**, y bump la fecha.

Auth: `Public` (sin token) · `Optional JWT` (público pero context-aware) · `JWT` (requiere token) · `Owner-only` (dueño del recurso) · `Admin`.

| Method | Path                                      | Auth           | Notas                                                                                                                   |
| ------ | ----------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| GET    | /health                                   | Public         | Liveness check (`{ status: 'ok' }`)                                                                                     |
| GET    | /collections                              | Public         | Paginated PUBLISHED list (filters: brand, category, year, q; sort: name/newest/year)                                    |
| GET    | /collections/:slug                        | Public         | Collection detail (items by rarity, pack types)                                                                         |
| GET    | /brands                                   | Public         | Brand list for catalog filters                                                                                          |
| POST   | /auth/register                            | Public         | email, password, username?; sends verification                                                                          |
| POST   | /auth/resend-verification                 | Public         | idempotent; no account enumeration                                                                                      |
| POST   | /auth/verify                              | Public         | { token } → marks email verified                                                                                        |
| POST   | /auth/login                               | Public         | sets refresh cookie; returns access + user                                                                              |
| POST   | /auth/refresh                             | Refresh cookie | rotates the refresh token; returns access                                                                               |
| POST   | /auth/logout                              | Refresh cookie | revokes the session; clears the cookie                                                                                  |
| GET    | /auth/me                                  | JWT            | current user (access token)                                                                                             |
| GET    | /users/:username                          | Public         | public profile                                                                                                          |
| PATCH  | /users/me                                 | JWT            | update own profile (currently: country)                                                                                 |
| POST   | /inventory                                | JWT            | add/increment owned item (collectionItemId, quantity?, condition?)                                                      |
| GET    | /inventory                                | JWT            | my inventory rows                                                                                                       |
| GET    | /inventory/progress                       | JWT            | per-collection completion summaries (cards)                                                                             |
| GET    | /inventory/collections/:slug/progress     | JWT            | full progress + derived missing list                                                                                    |
| PATCH  | /inventory/:id                            | JWT            | owner-only; 404 if not yours                                                                                            |
| DELETE | /inventory/:id                            | JWT            | owner-only; 404 if not yours                                                                                            |
| POST   | /wishlist                                 | JWT            | add/replace wishlist item                                                                                               |
| GET    | /wishlist                                 | JWT            | my wishlist (priority order)                                                                                            |
| PATCH  | /wishlist/:id                             | JWT            | owner-only; 404 if not yours                                                                                            |
| DELETE | /wishlist/:id                             | JWT            | owner-only; 404 if not yours                                                                                            |
| POST   | /marketplace/listings                     | JWT            | create listing from owned inventory item                                                                                |
| GET    | /marketplace/listings                     | Public         | paginated ACTIVE listings (filters: item, collection, condition, country, q, price)                                     |
| GET    | /marketplace/listings/mine                | JWT            | owner's own listings across all statuses (route declared before `:id`)                                                  |
| GET    | /marketplace/listings/availability        | JWT            | owned + available-to-list units for a collectionItemId (query); powers the sell form (route declared before `:id`)      |
| GET    | /marketplace/listings/:id                 | Optional JWT   | listing detail; non-ACTIVE only visible to the owner                                                                    |
| PATCH  | /marketplace/listings/:id                 | JWT            | owner-only; 403 if not yours                                                                                            |
| DELETE | /marketplace/listings/:id                 | JWT            | owner-only; 403 if not yours; also deletes its photos from storage                                                      |
| POST   | /marketplace/listings/:id/photos          | JWT            | owner-only; multipart `files` (max 5 total/listing, jpeg/png/webp, 2MB/file), compressed to WebP and uploaded to RustFS |
| DELETE | /marketplace/listings/:id/photos/:photoId | JWT            | owner-only; 403 if not yours; no-op (204) if the photo doesn't exist                                                    |
| GET    | /marketplace/matches                      | JWT            | owner-scoped; wishlist items with active listings from other sellers (in-budget flagged)                                |
