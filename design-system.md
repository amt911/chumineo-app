# SobreBox — Design System

## Concepto visual

SobreBox es la plataforma donde los coleccionistas *sienten* la emoción del unboxing. El diseño tiene un trabajo principal: hacer que cada interacción refleje ese instante de tensión antes de descubrir qué hay dentro del sobre. No es un marketplace frío ni una tienda genérica — es un espacio de comunidad donde los datos importan tanto como el coleccionismo en sí.

**Audiencia:** Coleccionistas y traders de 16-35 años, experiencia en plataformas de gaming y TCG. Prefieren interfaces oscuras para sesiones largas.

**Tema principal:** Dark-first. El modo claro existe como alternativa accesible, no como primario.

**La firma única de esta UI:** El sistema de rareza. Cada ítem en la plataforma tiene un color que le pertenece según su rareza. Ese color aparece en la card, en el glow del hover, en el ring de selected, en la barra de pull rate, en el badge. Es el hilo conductor visual de toda la experiencia — tan consistente que el usuario lo interioriza como lenguaje antes de leerlo.

---

## Paleta de colores

### Nombrada (6 valores base)

| Nombre | Hex | Rol |
|--------|-----|-----|
| **Abyss** | `#090910` | Fondo raíz de la app |
| **Vault** | `#111120` | Superficie: cards, modales, sidebars |
| **Chamber** | `#1A1A2E` | Superficie elevada: dropdowns, popovers, tooltips |
| **Signal** | `#7C3AED` | Primary brand — CTAs, focus, links activos |
| **Gold** | `#F0A500` | Logros, secret rare, highlights premium |
| **Frost** | `#8B99B0` | Texto secundario, metadatos, placeholders |

### Tokens semánticos (CSS custom properties)

```css
/* Fondos */
--color-bg:           #090910;
--color-surface:      #111120;
--color-elevated:     #1A1A2E;
--color-hover:        #22223C;

/* Brand */
--color-primary:      #7C3AED;
--color-primary-h:    #8B5CF6;   /* hover */
--color-primary-a:    #6D28D9;   /* active/pressed */
--color-primary-muted:#7C3AED1A; /* fondo sutil */

/* Texto */
--color-text-1: #F1F5F9;         /* principal */
--color-text-2: #8B99B0;         /* secundario */
--color-text-3: #4A5568;         /* muted, disabled */

/* Bordes */
--color-border:       #1E2540;
--color-border-hover: #2D3650;

/* Semánticos */
--color-success:  #10B981;
--color-warning:  #F59E0B;
--color-error:    #F43F5E;
--color-info:     #38BDF8;

/* Semánticos — texto */
--color-success-text: #34D399;
--color-warning-text: #FCD34D;
--color-error-text:   #FB7185;
--color-info-text:    #7DD3FC;
```

### Sistema de rareza — tokens por nivel

El corazón del diseño. Cada rareza tiene: color de identidad, glow para hover/featured, texto para legibilidad en fondos oscuros.

```css
/* Common */
--rarity-common:       #94A3B8;
--rarity-common-glow:  rgba(148, 163, 184, 0.15);
--rarity-common-bg:    rgba(148, 163, 184, 0.08);

/* Uncommon */
--rarity-uncommon:       #4ADE80;
--rarity-uncommon-glow:  rgba(74, 222, 128, 0.20);
--rarity-uncommon-bg:    rgba(74, 222, 128, 0.08);

/* Rare */
--rarity-rare:       #60A5FA;
--rarity-rare-glow:  rgba(96, 165, 250, 0.25);
--rarity-rare-bg:    rgba(96, 165, 250, 0.08);

/* Ultra Rare */
--rarity-ultra:       #A78BFA;
--rarity-ultra-glow:  rgba(167, 139, 250, 0.30);
--rarity-ultra-bg:    rgba(167, 139, 250, 0.10);

/* Secret Rare */
--rarity-secret:       #F0A500;
--rarity-secret-glow:  rgba(240, 165, 0, 0.40);
--rarity-secret-bg:    rgba(240, 165, 0, 0.10);

/* Limited Edition — animated gradient */
--rarity-limited-start: #FF6B6B;
--rarity-limited-mid:   #A78BFA;
--rarity-limited-end:   #60A5FA;
```

---

## Tipografía

### Fuentes

```css
/* globals.css */
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

--font-display: 'Plus Jakarta Sans', sans-serif; /* Headings, logotipo */
--font-body:    'Inter', sans-serif;              /* UI, cuerpo */
--font-mono:    'JetBrains Mono', monospace;      /* Estadísticas, pull rates, precios */
```

**Por qué estas fuentes:** Plus Jakarta Sans tiene levemente más carácter que Inter — sus mayúsculas son ligeramente expandidas y sus remates dan energía sin perder legibilidad. Contrasta bien con JetBrains Mono, que aporta credibilidad técnica a los números de stats. Inter como cuerpo es invisible en el buen sentido: no compite.

### Escala tipográfica

| Token | Tamaño | Line-height | Weight | Fuente | Uso |
|-------|--------|-------------|--------|--------|-----|
| `text-display-xl` | 48px | 1.1 | 800 | Display | Hero, landing |
| `text-display-lg` | 36px | 1.15 | 700 | Display | Títulos de página |
| `text-display-md` | 28px | 1.2 | 700 | Display | Títulos de sección |
| `text-heading-lg` | 22px | 1.3 | 600 | Display | Cards grandes, h3 |
| `text-heading-md` | 18px | 1.35 | 600 | Body | Sub-sección |
| `text-heading-sm` | 15px | 1.4 | 600 | Body | Labels grandes |
| `text-body-lg` | 16px | 1.65 | 400 | Body | Texto principal |
| `text-body-md` | 14px | 1.55 | 400 | Body | Cuerpo secundario |
| `text-body-sm` | 12px | 1.4 | 400 | Body | Metadata, captions |
| `text-mono-xl` | 32px | 1.1 | 500 | Mono | Stat hero grande |
| `text-mono-lg` | 22px | 1.2 | 500 | Mono | Stats normales |
| `text-mono-md` | 14px | 1.2 | 400 | Mono | Pull rates, %, precios |
| `text-mono-sm` | 12px | 1.2 | 400 | Mono | Decimales, nº de ítem |

**Regla de uso de mono:** Cualquier número que sea una estadística o probabilidad va en mono. Precios también. Los contadores animados de motion-primitives usan `text-mono-xl/lg`.

---

## Spacing

Sistema de 4px base. Tailwind estándar — no customizar a menos que sea necesario.

```
4px   → gap-1   — micro-spacing (dentro de badges, pills)
8px   → gap-2   — spacing dentro de componentes (icon + label)
12px  → gap-3   — padding interno de cards compactas
16px  → gap-4   — padding estándar de cards
24px  → gap-6   — gap entre cards en grid
32px  → gap-8   — separador de secciones compactas
48px  → gap-12  — separador de secciones principales
64px  → gap-16  — padding de página en desktop
```

---

## Border radius

```css
--radius-xs:   4px;   /* Badges, tags inline */
--radius-sm:   6px;   /* Inputs, botones pequeños */
--radius-md:   10px;  /* Botones estándar, form inputs */
--radius-lg:   14px;  /* Cards de ítems, modales compactos */
--radius-xl:   20px;  /* Cards de colección, hero cards */
--radius-2xl:  28px;  /* Modales grandes */
--radius-full: 9999px; /* Pills de rareza, avatares, chips */
```

---

## Shadows y glows

```css
/* Sombra base para cards sobre --color-bg */
--shadow-sm:   0 1px 2px rgba(0,0,0,0.4);
--shadow-card: 0 2px 8px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4);
--shadow-lg:   0 8px 24px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4);

/* Glows de rareza — usar en hover y selected states */
--glow-common:   0 0 12px var(--rarity-common-glow);
--glow-uncommon: 0 0 16px var(--rarity-uncommon-glow);
--glow-rare:     0 0 20px var(--rarity-rare-glow);
--glow-ultra:    0 0 24px var(--rarity-ultra-glow);
--glow-secret:   0 0 32px var(--rarity-secret-glow), 0 0 64px var(--rarity-secret-glow);
```

---

## Componentes clave

### ItemCard

La unidad visual más repetida de la plataforma. Representa un ítem coleccionable en cualquier contexto (catálogo, inventario, marketplace, wishlist).

```
┌────────────────────┐
│                    │  ← aspect-ratio: 2/3 (portrait)
│   [imagen ítem]    │
│                    │
│▓▓▓▓▓▓ overlay ▓▓▓▓▓│  ← gradient de bottom 40% a opaco
│ ● ULTRA RARE       │  ← RarityBadge (color del sistema)
│ Charizard ex       │  ← font-display, 13px bold
│ 006/198            │  ← mono-sm, text-2
└────────────────────┘
```

**Estados:**
- `default`: shadow-card, border 1px color-border
- `hover`: scale(1.04), box-shadow aplicando `--glow-{rarity}`, border color de la rareza al 40%
- `selected`: ring 2px color de rareza, scale leve (1.01), glow activo
- `locked` (no tengo el ítem): `filter: grayscale(0.8) brightness(0.5)`, cursor bloqueado
- `loading`: skeleton animation con shimmer en --color-hover

**Implementación Tailwind sugerida:**
```tsx
// Hover glow dinámico según rareza via CSS variable en inline style
<div
  className="group relative rounded-lg overflow-hidden transition-all duration-200
             border border-border hover:scale-[1.04]"
  style={{ '--glow': `var(--glow-${rarity})` } as CSSProperties}
>
  {/* hover:shadow aplicado via CSS var */}
</div>
```

---

### RarityBadge

```tsx
// Pill con color de rareza, dot indicator, texto
// Secret Rare: background con animated gradient
<RarityBadge rarity="ULTRA_RARE" />
// → "● ULTRA RARE" con --rarity-ultra como color
```

La rareza nunca se comunica solo por color — siempre incluye texto y el dot como redundancia visual (accesibilidad).

---

### PullRateBar

Muestra pull rate oficial vs empírico de la comunidad para un ítem.

```
Charizard ex     ████████████░░░░ 78.3%    comunidad
                 ██████████░░░░░░ 60.0%    oficial
                                  ↑1,247 aperturas
```

- Barras coloreadas según rareza del ítem
- Texto en `--font-mono` para los %
- Si no hay pull rate oficial, solo se muestra la barra de comunidad
- Si hay menos de 50 aperturas: mostrar "Datos insuficientes · N aperturas" en lugar de la barra

---

### StatCard

Tarjeta para dashboard personal y colecciones.

```
┌──────────────────────────┐
│ 🎴                       │
│ 342                      │  ← mono-xl
│ Sobres abiertos          │  ← body-sm, text-2
│ ↑ +12 esta semana        │  ← success-text o warning-text
└──────────────────────────┘
```

El número usa `<AnimatedNumber>` de motion-primitives al montar el componente.

---

### OpeningAnimation

El momento de mayor carga emocional de la app. La animación debe sentirse merecida.

**Secuencia:**

1. **Cover** (0ms): Card boca abajo, oscura, con el arte del sobre en el dorso. Scale ligeramente pulsante.
2. **Flip** (0-400ms): Rotación 3D en Y de 180°. En el punto medio (90°), flash de luz blanco (opacity 1 → 0 en 100ms).
3. **Reveal** (400-700ms): El ítem aparece. Escala desde 0.8 → 1 con ease-out.
4. **Rarity burst** (700ms):
   - **Common/Uncommon:** Fade simple del ítem, nada más.
   - **Rare:** Partículas pequeñas del color de rareza salen del ítem. Glow se activa.
   - **Ultra Rare:** Screen-wide color wash del color de rareza (opacity 0.15, fade out en 600ms) + partículas más densas + sonido opcional.
   - **Secret Rare:** Todo lo anterior multiplicado. El ítem tiembla levemente (shake animation). El background pulsa. La rareza merece su momento.
5. **Land** (1200ms+): El ítem aparece en el inventario con slide down y scale desde 1.1 → 1.

**Implementar con Framer Motion + motion-primitives:**
- `AnimatePresence` para el flip
- `motion.div` con `rotateY` para la animación de carta
- `useAnimate` para el burst de partículas vía canvas 2D overlay
- Respetar `prefers-reduced-motion`: saltar directamente al reveal sin animación

---

### MarketplaceCard

Card de listing. Hereda de ItemCard añadiendo una banda inferior con datos de transacción.

```
┌────────────────────┐
│ [imagen ítem]      │
│ ● RARE             │
│ Articuno           │
├────────────────────┤
│ 4,50 €  · Mint     │  ← precio mono-md + condición
│ ⭐ 4.9  · @user    │  ← rating del vendedor
│ [COMPRAR] [OFERTA] │  ← CTAs
└────────────────────┘
```

Badge de tipo en esquina superior: "VENTA" (success) / "INTERCAMBIO" (info) / "REGALO" (gold).

---

## Customización de shadcn/ui

### `globals.css` — variables en modo dark (default)

```css
:root {
  --background:           235 44% 6%;    /* #090910 Abyss */
  --foreground:           210 40% 95%;   /* #F1F5F9 */
  --card:                 238 40% 10%;   /* #111120 Vault */
  --card-foreground:      210 40% 95%;
  --popover:              238 30% 14%;   /* #1A1A2E Chamber */
  --popover-foreground:   210 40% 95%;
  --primary:              263 69% 57%;   /* #7C3AED Signal */
  --primary-foreground:   0 0% 100%;
  --secondary:            238 30% 14%;
  --secondary-foreground: 215 20% 65%;
  --muted:                238 30% 14%;
  --muted-foreground:     215 20% 55%;   /* Frost */
  --accent:               263 69% 57%;
  --accent-foreground:    0 0% 100%;
  --destructive:          350 89% 60%;   /* #F43F5E */
  --destructive-foreground: 0 0% 100%;
  --border:               223 38% 18%;   /* #1E2540 */
  --input:                223 38% 18%;
  --ring:                 263 69% 57%;
  --radius:               0.625rem;      /* 10px — --radius-md */
}

.light {
  --background:           0 0% 98%;
  --foreground:           238 44% 8%;
  --card:                 0 0% 100%;
  --card-foreground:      238 44% 8%;
  --popover:              0 0% 100%;
  --popover-foreground:   238 44% 8%;
  --primary:              263 69% 50%;
  --primary-foreground:   0 0% 100%;
  --secondary:            220 14% 94%;
  --secondary-foreground: 238 30% 25%;
  --muted:                220 14% 94%;
  --muted-foreground:     220 10% 50%;
  --accent:               263 69% 50%;
  --accent-foreground:    0 0% 100%;
  --destructive:          350 89% 55%;
  --destructive-foreground: 0 0% 100%;
  --border:               220 14% 88%;
  --input:                220 14% 88%;
  --ring:                 263 69% 50%;
}
```

### Componentes shadcn que más se modifican

**Button:** El `variant="default"` usa `--primary`. Añadir variant custom `"rarity"` que recibe el color de rareza como CSS var para CTAs contextualizados.

**Badge:** Crear variantes: `common`, `uncommon`, `rare`, `ultra`, `secret`, `limited`. Reutilizar en todo el sistema.

**Card:** Aumentar el `border-radius` a `--radius-lg` (14px) en lugar del default (8px). El shadow debe usar `--shadow-card`.

**Separator:** Color `--border` con opacity 0.6.

**Input / Textarea:** Background `--color-surface`, border `--border`, focus-ring color `--primary`.

---

## Layout y grid

- **Breakpoints:** Tailwind defaults (sm 640, md 768, lg 1024, xl 1280, 2xl 1536)
- **Contenedor máximo:** `max-w-7xl` (1280px) con padding horizontal `px-6 md:px-10`
- **Grid de ítems (catálogo/inventario):**
  `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6`
- **Grid de colecciones:**
  `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- **Grid de marketplace:**
  `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`
- **Sidebar de filtros:** 256px fija en desktop, drawer (Sheet de shadcn) en mobile
- **Header:** sticky, altura 64px, backdrop-blur con `--color-bg` a 85% opacity

---

## Motion

### Principios

- **Velocidad por defecto:** La UI no debe sentirse pesada. Los estados hover/active son instantáneos o casi.
- **Contenido tiene peso:** La apertura del sobre, la aparición de un ítem raro, un modal — merecen duración y easing.
- **Un único momento dramático por sesión:** El reveal de apertura. El resto es instrumental.
- **`prefers-reduced-motion`** desactiva todas las animaciones decorativas y las de contenido largas (sustituir por fade simple de 150ms).

### Duraciones

```
micro:    80ms   — hover states, active states, checkbox toggle
fast:     150ms  — dropdown open, tooltip appear, badge aparecer
normal:   250ms  — modal enter/exit, page transition fade
slow:     400ms  — card flip de apertura
dramatic: 800ms  — rarity burst en Secret Rare
```

### Easing

```
ease-out:    cubic-bezier(0, 0, 0.3, 1)  — entradas de elementos
ease-in:     cubic-bezier(0.7, 0, 1, 1)  — salidas de elementos
ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1) — scale/bounce (hover de ItemCard)
```

### motion-primitives específicos a usar

| Componente | Uso |
|-----------|-----|
| `AnimatedNumber` | Contadores en StatCards, pull rates al cargar |
| `BlurIn` / `FadeIn` | Entradas de página, modales |
| `TextEffect` | Título de la página de apertura ("¿Qué habrá dentro?") |
| `Reveal` | Reveal del ítem tras el flip |
| `AnimatePresence` | Transiciones de ruta (Next.js page transitions) |

---

## Iconografía

**Librería principal:** Lucide React (incluida con shadcn). Stroke-width 1.5, size 20px estándar.

**Iconos custom a crear como SVG:**
- `<SparkleRare />` — icono de rareza para Secret Rare (5 puntas, animated shimmer)
- `<PackClosed />` y `<PackOpen />` — sobre cerrado y abierto (estilo flat)
- `<HoloShimmer />` — efecto para ítems Limited Edition

---

## Accesibilidad

- **Contraste WCAG AA** obligatorio para todo el texto. Los colores de rareza sobre `--color-surface` cumplen mínimo AA excepto Common sobre fondos muy oscuros — compensar con font-weight 500.
- **Focus visible siempre.** Nunca `outline: none` sin alternativa. Usar `--ring` de shadcn.
- **Rareza comunicada siempre con texto + color.** Nunca solo color.
- **Skip links** al main content para usuarios de teclado.
- **`aria-label`** en todos los botones icon-only.
- **`prefers-reduced-motion`** desactiva animaciones decorativas (convección, shimmer, partículas). La lógica de apertura se mantiene: solo se elimina la animación visual.
- **`role="img"` con `alt` descriptivo** en imágenes de ítems: `"Charizard ex - Ultra Rare - Número 006/198"`.
