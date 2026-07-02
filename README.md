# SobreBox

Plataforma para llevar recuento de cajas/sobres sorpresa coleccionables (cartas TCG, Funko,
blind boxes…), ver pull rates oficiales y empíricos de la comunidad, gestionar inventario y
wishlist, y comprar / vender / intercambiar en un marketplace.

Monorepo **pnpm workspaces + Turborepo**: NestJS 10 (`apps/api`) + Next.js 15 (`apps/web`) +
código compartido compilado (`packages/shared`). Para arquitectura, dominio y convenciones,
ver [`CLAUDE.md`](CLAUDE.md); gotchas de build/infra en [`docs/FINDINGS.md`](docs/FINDINGS.md).

## Requisitos

- Node ≥ 20, **pnpm** (`corepack enable`)
- **Docker** + Docker Compose (infra: Postgres 16, Redis, Mailpit, RustFS)

## Arranque rápido (clon nuevo)

```bash
pnpm install        # instala deps + genera el cliente Prisma
pnpm infra:up       # crea .env si falta + levanta la infra en Docker
pnpm db:deploy      # aplica las migraciones
pnpm db:seed        # compila shared + siembra datos de dev
```

Luego, en **dos terminales** (con la infra arriba):

```bash
pnpm --filter @sobrebox/api start:dev    # API en :3000
pnpm --filter @sobrebox/web dev          # Web en :3001
```

> Los puertos por defecto son API `:3000` y Web `:3001`; se leen del `.env` raíz, así que un
> entorno local puede desplazarlos (p. ej. `:3100`/`:3101`). Mailpit expone su UI de correo
> en `:8025` (sink de emails en dev) y la consola de RustFS en `:9001`.

## Comandos

Todos se ejecutan desde la raíz salvo que se indique lo contrario. Los que tocan la BD cargan
el `.env` raíz vía `dotenv-cli`; `docker compose` lo lee solo.

### Setup e infraestructura

| Comando              | Qué hace                                                                                               | Cuándo usarlo                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `pnpm install`       | Instala dependencias y genera el cliente Prisma (postinstall de la api).                               | Tras clonar y cada vez que cambie un `package.json` o el `schema.prisma`.                    |
| `pnpm infra:up`      | Crea `.env` si falta y levanta la infra en Docker (Postgres, Redis, Mailpit, RustFS) en segundo plano. | Antes de arrancar api/web o correr e2e.                                                      |
| `pnpm infra:up:logs` | Igual que `infra:up` pero en primer plano (logs en vivo).                                              | Para depurar la infra (ver por qué no arranca un contenedor).                                |
| `pnpm infra:down`    | Para los contenedores (conserva los volúmenes/datos).                                                  | Al terminar de trabajar sin borrar la BD.                                                    |
| `pnpm infra:restart` | `infra:down` + `infra:up`.                                                                             | Cuando la infra queda en mal estado y basta reiniciar.                                       |
| `pnpm infra:clean`   | Para los contenedores **y borra los volúmenes** (datos incluidos).                                     | Empezar de cero (BD corrupta o migraciones divergentes). Tras esto: `db:deploy` + `db:seed`. |
| `pnpm bootstrap`     | Genera el `.env` a partir del ejemplo si no existe.                                                    | Rara vez a mano; lo invocan los scripts de infra/db.                                         |

### Base de datos (Prisma)

| Comando           | Qué hace                                                                           | Cuándo usarlo                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm db:deploy`  | Aplica las migraciones existentes (`prisma migrate deploy`).                       | Primer arranque y tras hacer `git pull` con migraciones nuevas.                                               |
| `pnpm db:migrate` | Crea y aplica una migración nueva desde cambios del `schema.prisma` (pide nombre). | Al modificar el `schema.prisma`. **Nunca** editar el SQL generado a mano (salvo data-migrations conscientes). |
| `pnpm db:seed`    | Compila `shared` y siembra la BD con datos de dev.                                 | Tras `db:deploy` en un entorno vacío, o para repoblar datos de prueba.                                        |
| `pnpm db:shell`   | Abre `psql` dentro del contenedor de Postgres.                                     | Inspeccionar/consultar la BD a mano.                                                                          |

### Desarrollo

| Comando                                       | Qué hace                                                                 | Cuándo usarlo                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `pnpm --filter @sobrebox/api start:dev`       | Arranca la API (NestJS) en modo watch (`:3000`).                         | Desarrollo del backend en host.                                                  |
| `pnpm --filter @sobrebox/web dev`             | Arranca la web (Next.js) en modo dev (`:3001`).                          | Desarrollo del frontend en host.                                                 |
| `pnpm dev`                                    | Levanta la infra y arranca **api + web** juntos vía Turbo.               | Arranque de todo el stack en host con un solo comando.                           |
| `pnpm dev:docker`                             | Levanta **todo** (infra + api + web) en Docker.                          | Reproducir el entorno completo en contenedores (más cercano a prod).             |
| `pnpm build:shared`                           | Compila `packages/shared` a `dist/`.                                     | Tras editar `packages/shared` (api/web/seed importan el JS compilado, no el TS). |
| `pnpm build`                                  | Build de producción de todos los paquetes (Turbo).                       | Verificar que todo compila; preparar artefactos.                                 |
| `pnpm dev:tailscale` / `dev:docker:tailscale` | Igual que `dev`/`dev:docker` añadiendo orígenes de Tailscale permitidos. | Probar la app desde otro dispositivo de tu tailnet.                              |

### Tests y calidad

| Comando                               | Qué hace                                                                                        | Cuándo usarlo                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `pnpm test`                           | Tests unitarios de los 3 paquetes (Turbo).                                                      | Bucle rápido de TDD; antes de commitear lógica.            |
| `pnpm --filter @sobrebox/api test`    | Solo unit de la api (Jest).                                                                     | Al tocar un service/controller del backend.                |
| `pnpm --filter @sobrebox/web test`    | Solo unit de la web (Vitest).                                                                   | Al tocar un componente/hook/util del frontend.             |
| `pnpm --filter @sobrebox/shared test` | Solo unit de shared (Vitest).                                                                   | Al tocar enums/schemas/DTOs compartidos.                   |
| `pnpm test:e2e`                       | E2E de la api (Jest + supertest). Compila shared y necesita la **infra arriba** (incl. RustFS). | Cuando un cambio cruza módulos del backend o toca storage. |
| `pnpm test:all`                       | `test` + `test:e2e`.                                                                            | Cambio grande o ambiguo; antes de un PR de peso.           |
| `pnpm test:cov`                       | Cobertura de los 3 paquetes (gate **80%**).                                                     | Comprobar el gate de cobertura.                            |
| `pnpm lint`                           | ESLint en todos los paquetes (Turbo).                                                           | Antes de commitear/PR.                                     |
| `pnpm type-check`                     | `tsc --noEmit` en todos los paquetes.                                                           | Verificar tipos sin compilar.                              |
| `pnpm pr-check`                       | `lint` + `test:cov`. **Debe salir limpio antes de abrir un PR.**                                | Gate local previo a cada PR.                               |

## Flujo de trabajo típico

1. `pnpm infra:up` (una vez por sesión).
2. Arranca api y web en modo dev (o `pnpm dev`).
3. Programa con **TDD** (test rojo → verde → refactor). Si tocas `packages/shared`,
   ejecuta `pnpm build:shared` para que api/web/seed vean el cambio.
4. Antes del PR: `pnpm pr-check` en verde (y `pnpm test:e2e` si el cambio cruza módulos del
   backend).

## Más documentación

- [`CLAUDE.md`](CLAUDE.md) — arquitectura, estrategia de módulos, dominio y reglas de trabajo.
- [`docs/FINDINGS.md`](docs/FINDINGS.md) — gotchas no obvios de build/infra/Prisma.
- [`docs/ENDPOINT_PERMISSIONS.md`](docs/ENDPOINT_PERMISSIONS.md) — permisos de endpoints (referencia autoritativa).
