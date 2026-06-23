# Starter kit — levantar proyectos rápido (mismo estilo que SobreBox)

Kit para arrancar un proyecto nuevo con el mismo stack, diseño y flujo que este repo,
sin re-decidir nada. La idea: **rellenas 3 documentos génesis**, los pones en el repo
nuevo, y le pasas al agente el prompt de bootstrap. El resto sale solo, épica a épica.

## Los 3 documentos génesis

Todo proyecto en este estilo nace de tres docs (más un CLAUDE.md operativo). Cópialos
de aquí, renómbralos quitando `.template`, y rellénalos:

| Plantilla                   | Va a                              | Qué define                                                      | Quién lo lee                  |
| --------------------------- | --------------------------------- | --------------------------------------------------------------- | ----------------------------- |
| `CLAUDE.template.md`        | `CLAUDE.md` (raíz del repo nuevo) | Stack, estrategia de módulos, reglas de trabajo                 | El **agente**, cada sesión    |
| `DESIGN-SYSTEM.template.md` | `design-system.md` (raíz)         | Identidad visual: paleta, tipografía, componentes, motion, a11y | Agente al hacer UI            |
| `USER-STORIES.template.md`  | `user-stories.md` (raíz)          | Backlog: roles, épicas, user stories, prioridad MVP             | Tú + agente al definir slices |

> Por qué CLAUDE.md y no re-pegar el stack cada vez: lo que vive en `CLAUDE.md` el
> agente lo lee solo en cada sesión. Es la forma de no repetirte. Las plantillas de
> prompts sueltas (`../PROMPT_TEMPLATES.md`) son para tareas concretas, no para el stack.

## Flujo de bootstrap (de cero a primer slice)

```text
1. Crear repo nuevo + git init.
2. Copiar las 3 plantillas, quitar .template, rellenar los <…>.
   - CLAUDE.md: ajustar scope del paquete (@<scope>/shared), nombre, qué épicas hay.
   - design-system.md: paleta + tipografía + componentes clave del producto nuevo.
   - user-stories.md: roles + épicas + US con criterios de aceptación + tabla MVP.
3. Pegar al agente el prompt "arrancar proyecto nuevo" de ../PROMPT_TEMPLATES.md §2.
   El agente hace Fase 0 (scaffolding monorepo) vía superpowers, con spec que apruebas.
4. Por cada épica: prompt de slice (§3) -> brainstorming -> spec -> plan -> implementa.
```

Regla de oro (de CLAUDE.md): **nada se implementa sin spec aprobado por ti**, y **el
push lo haces tú** (el agente nunca pushea).

## Qué da "velocidad" aquí

- **Decisiones ya tomadas** (chat.md de este repo es la genealogía): Prisma sobre TypeORM,
  Zod sobre class-validator (compartible en `shared`), monorepo pnpm, shared compilado.
  No re-litigar; van pre-rellenadas en `CLAUDE.template.md`.
- **Diseño parametrizado**: cambias 6 colores base + 3 fuentes y el sistema entero se
  re-tematiza (tokens semánticos + shadcn vars derivan de ahí).
- **Backlog estructurado**: épicas con prioridad MVP -> el orden de slices es obvio.
- **Flujo fijo**: superpowers (brainstorming -> spec -> plan -> SDD -> finishing) + TDD +
  gate 80% + Conventional Commits. Igual en todos los proyectos.

## Archivos del kit

- `CLAUDE.template.md` — instrucciones operativas del repo (stack + módulos + reglas).
- `DESIGN-SYSTEM.template.md` — sistema de diseño rellenable.
- `USER-STORIES.template.md` — backlog rellenable.
- `../PROMPT_TEMPLATES.md` — prompts pegables por tarea (arrancar, slice, página, endpoint, email, deploy, bug).
