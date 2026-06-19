Stack concreto, con opinión. Cambios respecto a lo que propusiste marcados con 🔄.

---

## Backend

**NestJS 10** — sin cambios, es la opción correcta para una API de este tamaño.

**🔄 Prisma en lugar de TypeORM**
El cambio más importante. TypeORM tiene bugs históricos con migraciones complejas, relaciones lazy/eager inconsistentes, y el tipado basado en decoradores no es tan preciso. Prisma tiene:
- `schema.prisma` como única fuente de verdad del esquema
- Tipos generados automáticamente, sin decoradores
- Migraciones deterministas y predecibles
- Prisma Studio para inspeccionar la base de datos en dev

**🔄 Zod en lugar de class-validator**
class-validator funciona con decoradores en clases, lo que no se puede compartir con el frontend. Zod define los schemas como objetos TypeScript normales, lo que permite ponerlos en `packages/shared` y usarlos tanto en NestJS (via `ZodValidationPipe`) como en React Hook Form. Defines la validación una sola vez.

```
packages/shared/
  schemas/
    collection.schema.ts    → z.object({ name: z.string()... })
    opening.schema.ts
    listing.schema.ts
  types/
    → inferidos de los schemas con z.infer<typeof ...>
```

**PostgreSQL 16** — sin cambios.

**Redis + BullMQ** — sin cambios. Redis para cachear pull rates, BullMQ para jobs (recalcular stats, generar OG images).

**Passport + JWT** — sin cambios. Estrategias `jwt`, `jwt-refresh`, `google`, `discord`.

**Socket.io via NestJS Gateway** — para el chat del marketplace. Integración nativa en NestJS, sin servicios externos.

**Resend** — email transaccional.

**Cloudflare R2** — almacenamiento de imágenes. S3-compatible, baratísimo, CDN incluido.

**Sharp** — procesamiento de imágenes server-side (thumbnails, OG images para compartir aperturas).

---

## Frontend

**Next.js 15 (App Router)** — sin cambios.

**shadcn/ui** — sin cambios.

**motion-primitives + Framer Motion** — motion-primitives encima de Framer Motion. Sin cambios.

**TanStack Query v5** — sin cambios. Para todas las llamadas al API: colecciones, inventario, marketplace. Con `staleTime` generoso en datos de catálogo (cambian poco) y corto en listings del marketplace (cambian mucho).

**🔄 TanStack Table** — para las vistas de inventario y marketplace con filtros, sorting y paginación. shadcn tiene una integración directa vía el componente `DataTable`.

**Zustand** — sin cambios. Para estado client-side: flujo de apertura en curso (qué ítems se han seleccionado), estado del drawer de filtros, preferencias de vista (grid/lista).

**React Hook Form + Zod** — formularios. El resolver de Zod para React Hook Form acepta directamente los schemas de `packages/shared`, así la validación frontend y backend son idénticas.

**Recharts** — estadísticas y gráficos. shadcn/ui charts ya lo envuelve con estilos consistentes. Para las barras de pull rates, el donut de distribución de rarezas, el gráfico de actividad mensual.

---

## Tooling

**pnpm workspaces + Turborepo** — monorepo. Turborepo añade caché de builds local y en CI: si no has tocado `apps/api` no re-buildea el backend.

**TypeScript strict** — en las tres partes del monorepo.

**ESLint + Prettier** — estándar.

**Husky + lint-staged** — pre-commit que solo lintea los archivos modificados.

**Commitlint** — fuerza conventional commits, que ya tienes en el CLAUDE.md.

---

## Testing

**Jest** — backend (viene con NestJS, nada que instalar).

**Vitest + Testing Library** — frontend. Vitest es Jest compatible pero mucho más rápido, integra perfectamente con Vite/Next.

**Playwright** — E2E. Especialmente para el flujo de apertura de sobre (la animación y el registro del ítem), que es difícil de testear con Testing Library.

---

## Infraestructura

| Servicio | Para qué | Por qué |
|---------|----------|---------|
| **Vercel** | Next.js | Deploy automático, edge functions, OG image generation |
| **Railway** | NestJS | Lo más sencillo para deploy de Node.js con Redis incluido |
| **Neon** | PostgreSQL | Serverless, branching de base de datos (una rama por PR), integración directa con Prisma |
| **Upstash** | Redis | Serverless Redis, compatible con BullMQ, free tier generoso |
| **Cloudflare R2** | Imágenes | 10 GB gratis, CDN global, S3-compatible |
| **Resend** | Email | 3000 emails/mes gratis, SDK moderno |

---

## Lo que cambia respecto a tu propuesta original

| Original | Recomendado | Motivo |
|----------|-------------|--------|
| TypeORM | **Prisma** | Mejor DX, migraciones más robustas, tipado sin decoradores |
| class-validator | **Zod** | Compartible con el frontend vía `packages/shared` |
| — | **TanStack Table** | Necesario para inventario y marketplace con filtros complejos |
| — | **React Hook Form** | Gestión de formularios (registro, listings, ofertas) |
| — | **Playwright** | E2E del flujo de apertura |
| — | **Turborepo** | Caché de builds en monorepo |
| — | **Neon** | PostgreSQL gestionado con branching por PR |