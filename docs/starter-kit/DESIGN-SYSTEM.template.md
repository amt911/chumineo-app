# <PROYECTO> — Design System

> Plantilla. Copia a `design-system.md` en la raíz del repo nuevo y rellena los `<…>`.
> Velocidad: define los **6 colores base + 3 fuentes + tokens de la firma visual**; el
> resto del sistema (tokens semánticos, vars de shadcn) deriva de ahí. Borra esta cita.

## Concepto visual

<2-4 frases: qué siente el usuario, qué hace único a este producto, su "firma" visual.
Ej: "El hilo conductor es el color por <dimensión clave del dominio>; aparece en la card,
el hover, el selected y el badge — tan consistente que el usuario lo lee como lenguaje.">

**Audiencia:** <quién, rango de edad, contexto de uso>.
**Tema principal:** <dark-first / light-first>. El otro modo existe como alternativa accesible.
**La firma única de esta UI:** <el sistema/elemento visual que define la marca>.

---

## Paleta de colores

### Nombrada (6 valores base)

| Nombre         | Hex       | Rol                                               |
| -------------- | --------- | ------------------------------------------------- |
| **<Bg>**       | `#______` | Fondo raíz                                        |
| **<Surface>**  | `#______` | Superficie: cards, modales, sidebars              |
| **<Elevated>** | `#______` | Superficie elevada: dropdowns, popovers, tooltips |
| **<Primary>**  | `#______` | Brand — CTAs, focus, links activos                |
| **<Accent>**   | `#______` | Highlights / logros / premium                     |
| **<Muted>**    | `#______` | Texto secundario, metadatos, placeholders         |

### Tokens semánticos (CSS custom properties)

```css
/* Fondos */
--color-bg: #______;
--color-surface: #______;
--color-elevated: #______;
--color-hover: #______;
/* Brand */
--color-primary: #______;
--color-primary-h: #______; /* hover */
--color-primary-a: #______; /* active */
/* Texto */
--color-text-1: #______; /* principal */
--color-text-2: #______; /* secundario */
--color-text-3: #______; /* muted/disabled */
/* Bordes */
--color-border: #______;
--color-border-hover: #______;
/* Semánticos */
--color-success: #______;
--color-warning: #______;
--color-error: #______;
--color-info: #______;
```

### Sistema de la firma — tokens por nivel (si aplica)

<Si el producto tiene una dimensión que se codifica por color (rareza, estado, categoría,
nivel…), define aquí un token de color + glow + bg por cada nivel. Es lo que da identidad.
Si no aplica, borra esta sección.>

```css
--<dim>-<nivel1>: #______;
--<dim>-<nivel1>-glow: rgba(_, _, _, 0.2);
--<dim>-<nivel1>-bg: rgba(_, _, _, 0.08);
/* …un bloque por nivel… */
```

---

## Tipografía

```css
@import url('https://fonts.googleapis.com/css2?family=<Display>&family=<Body>&family=<Mono>&display=swap');
--font-display: '<Display>', sans-serif; /* headings, logotipo */
--font-body: '<Body>', sans-serif; /* UI, cuerpo */
--font-mono: '<Mono>', monospace; /* números, stats, precios */
```

**Regla:** cualquier número que sea estadística, probabilidad o precio va en `--font-mono`.

| Token                  | Tamaño | LH   | Weight | Fuente  | Uso                |
| ---------------------- | ------ | ---- | ------ | ------- | ------------------ |
| `text-display-lg`      | 36px   | 1.15 | 700    | Display | Títulos de página  |
| `text-heading-lg`      | 22px   | 1.3  | 600    | Display | Cards grandes, h3  |
| `text-body-lg`         | 16px   | 1.65 | 400    | Body    | Texto principal    |
| `text-body-sm`         | 12px   | 1.4  | 400    | Body    | Metadata, captions |
| `text-mono-md`         | 14px   | 1.2  | 400    | Mono    | Números/precios    |
| <…añade los que uses…> |        |      |        |         |                    |

---

## Spacing, radius, shadows

- **Spacing:** base 4px, Tailwind estándar (gap-1=4 … gap-16=64). No customizar salvo necesidad.
- **Radius:** `--radius-sm 6 / --radius-md 10 / --radius-lg 14 / --radius-xl 20 / --radius-full 9999`.
- **Shadows/glows:**

```css
--shadow-card: 0 2px 8px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0, 0, 0, 0.4);
/* glows de la firma, para hover/selected: 0 0 Npx var(--<dim>-<nivel>-glow) */
```

---

## Componentes clave

<Lista 3-6 componentes que se repiten en el producto. Para cada uno: para qué sirve, un
mini-mockup ASCII, y sus estados (default/hover/selected/loading/disabled). Ejemplo de
formato:>

### <Card principal del dominio>

```
┌────────────────┐
│  [imagen]      │  ← aspect-ratio: <ej. 2/3>
│ ● <BADGE>      │  ← badge de la firma
│ <Título>       │  ← font-display
│ <metadato>     │  ← mono-sm, text-2
└────────────────┘
```

**Estados:** default (shadow-card, border) · hover (scale 1.04 + glow) · selected (ring) ·
loading (skeleton shimmer) · disabled (grayscale).

### <Badge de la firma>

Comunica `<dimensión>` con **color + texto + dot** (nunca solo color; accesibilidad).

---

## Customización de shadcn/ui

`globals.css` — mapea tu paleta a las vars de shadcn (HSL), en modo `:root` (tema
principal) y la clase del otro modo:

```css
:root {
  --background: <H S% L%>;
  --foreground: <…>;
  --card: <…>;
  --card-foreground: <…>;
  --popover: <…>;
  --popover-foreground: <…>;
  --primary: <…>;
  --primary-foreground: <…>;
  --secondary: <…>;
  --muted: <…>;
  --muted-foreground: <…>;
  --accent: <…>;
  --destructive: <…>;
  --border: <…>;
  --input: <…>;
  --ring: <…>;
  --radius: 0.625rem; /* 10px */
}
.<otro-modo > {
  /* … overrides … */
}
```

**Componentes shadcn que más se tocan:** Button (variant de la firma), Badge (variantes
por nivel), Card (radius-lg + shadow-card), Input/Textarea (bg surface, ring primary).

---

## Layout y grid

- **Breakpoints:** Tailwind defaults. **Contenedor:** `max-w-7xl` + `px-6 md:px-10`.
- **Grids del dominio:** <ej. catálogo `grid-cols-2 sm:3 md:4 lg:5 xl:6`; listados `1 sm:2 lg:3`>.
- **Sidebar de filtros:** fija en desktop, `Sheet` (drawer) en mobile.
- **Header:** sticky, 64px, backdrop-blur.

## Motion

- **Velocidad por defecto** (hover/active casi instantáneos); **un único momento dramático**
  reservado a `<el momento clave del producto, si lo hay>`.
- Duraciones: `micro 80 / fast 150 / normal 250 / slow 400 / dramatic 800` (ms).
- Respetar `prefers-reduced-motion`: sustituir animaciones por fade simple de 150ms.

## Iconografía y accesibilidad

- **Iconos:** Lucide React (con shadcn), stroke 1.5, 20px. Custom como SVG si hace falta.
- **A11y:** contraste WCAG AA en todo el texto; focus visible siempre (`--ring`, nunca
  `outline:none` a secas); la firma comunicada con texto+color; `aria-label` en botones
  icon-only; `alt` descriptivo en imágenes; `prefers-reduced-motion` honrado.
