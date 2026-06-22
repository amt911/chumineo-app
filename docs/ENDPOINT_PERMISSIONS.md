# Endpoint Permissions

> Referencia autoritativa de permisos de cada endpoint HTTP del backend.
> Última generación: 2026-06-22. **Actualiza esta tabla en el mismo cambio que añada o modifique endpoints**, y bump la fecha.

Auth: `Public` (sin token) · `Optional JWT` (público pero context-aware) · `JWT` (requiere token) · `Owner-only` (dueño del recurso) · `Admin`.

| Method | Path                      | Auth           | Notas                                          |
| ------ | ------------------------- | -------------- | ---------------------------------------------- |
| GET    | /health                   | Public         | Liveness check (`{ status: 'ok' }`)            |
| GET    | /collections              | Public         | Lista las colecciones en estado PUBLISHED      |
| POST   | /auth/register            | Public         | email, password, username?; sends verification |
| POST   | /auth/resend-verification | Public         | idempotent; no account enumeration             |
| POST   | /auth/verify              | Public         | { token } → marks email verified               |
| POST   | /auth/login               | Public         | sets refresh cookie; returns access + user     |
| POST   | /auth/refresh             | Refresh cookie | rotates the refresh token; returns access      |
| POST   | /auth/logout              | Refresh cookie | revokes the session; clears the cookie         |
| GET    | /auth/me                  | JWT            | current user (access token)                    |
| GET    | /users/:username          | Public         | public profile                                 |
