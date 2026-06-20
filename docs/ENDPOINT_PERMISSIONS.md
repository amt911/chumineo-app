# Endpoint Permissions

> Referencia autoritativa de permisos de cada endpoint HTTP del backend.
> Última generación: 2026-06-20. **Actualiza esta tabla en el mismo cambio que añada o modifique endpoints**, y bump la fecha.

Auth: `Public` (sin token) · `Optional JWT` (público pero context-aware) · `JWT` (requiere token) · `Owner-only` (dueño del recurso) · `Admin`.

| Method | Path          | Auth   | Notas                                   |
|--------|---------------|--------|-----------------------------------------|
| GET    | /health       | Public | Liveness check (`{ status: 'ok' }`)     |
| GET    | /collections  | Public | Lista las colecciones en estado PUBLISHED |
