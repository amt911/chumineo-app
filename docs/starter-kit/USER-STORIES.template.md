# <PROYECTO> — User Stories

> Plantilla. Copia a `user-stories.md` en la raíz del repo nuevo y rellena los `<…>`.
> Esto es el backlog: el agente saca de aquí el alcance de cada slice. Una US bien
> escrita (con criterios de aceptación) ≈ medio spec ya hecho. Borra esta cita.

## Roles

| Símbolo | Rol       | Descripción                      |
| ------- | --------- | -------------------------------- |
| 👤      | `visitor` | Visitante anónimo                |
| 🧑      | `user`    | Usuario registrado y autenticado |
| 🛡️      | `admin`   | Administrador / moderador        |
| <…>     | `<rol>`   | <descripción>                    |

---

## Epic <N> — <Nombre de la épica>

### US-<NN> <Título corto>

**Como** <rol> **quiero** <acción> **para** <beneficio>.

**Criterios de aceptación:**

- <Criterio verificable 1 — concreto, testeable, sin ambigüedad>
- <Criterio 2: incluye reglas de validación, límites, estados>
- <Criterio 3: qué pasa en el caso de error / vacío / borde>
- <Criterio 4: permisos — quién puede, qué ve cada rol>

### US-<NN+1> <Título>

**Como** … **quiero** … **para** …
**Criterios de aceptación:**

- …

<Repite el bloque Epic/US por cada épica. Guía rápida:>

> - Una US = un objetivo de usuario, no una tarea técnica.
> - Los criterios de aceptación son la fuente de los tests. Si no es testeable, reescríbelo.
> - Marca explícitamente lo que NO entra (out of scope) cuando sea ambiguo.
> - Stats/cálculos pesados, permisos y validaciones: dilos aquí, son decisiones de producto.

---

## Resumen por épica (prioridad MVP)

| Epic    | Stories        | Prioridad  |
| ------- | -------------- | ---------- |
| 1 · <…> | US-01 a US-0\_ | 🔴 Crítico |
| 2 · <…> | US-0* a US-0*  | 🔴 Crítico |
| 3 · <…> | US-_ a US-_    | 🟡 Alta    |
| 4 · <…> | US-_ a US-_    | 🟢 Media   |

> El orden de construcción sale de esta tabla: 🔴 primero, una épica = uno o varios
> slices. Cada slice: prompt de slice (`../PROMPT_TEMPLATES.md` §3) → brainstorming →
> spec → plan → implementación. Recorta a v1 con YAGNI y deja placeholders honestos para
> lo que dependa de épicas futuras.
