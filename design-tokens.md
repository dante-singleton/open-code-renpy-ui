# Design Tokens — Open-Code-RenPy-UI

Dark UI with **orange** and **purple** accents. These tokens are the single
source of truth for colors, spacing, radii, and typography, and are consumed by:

- Tailwind (`tailwind.config.ts`) as theme extensions
- Raw CSS via `:root` custom properties (for React Flow, which is styled with CSS)
- The `packages/ui` primitives

---

## 1. Color palette

### 1.1 Neutral surfaces (dark)

| Token                | Hex        | Usage                                      |
|----------------------|------------|--------------------------------------------|
| `--color-bg-0`       | `#0B0B10`  | App background (the furthest-back surface) |
| `--color-bg-1`       | `#111118`  | Panels, sidebar                            |
| `--color-bg-2`       | `#17171F`  | Cards, node bodies                         |
| `--color-bg-3`       | `#1E1E27`  | Hover / elevated surfaces                  |
| `--color-bg-4`       | `#262631`  | Popovers, menus                            |
| `--color-border`     | `#2C2C38`  | Default 1px borders                        |
| `--color-border-strong` | `#3A3A48` | Emphasized borders (focused panels)      |
| `--color-divider`    | `#1F1F28`  | Thin separators                            |

### 1.2 Text

| Token                  | Hex        | Usage                           |
|------------------------|------------|---------------------------------|
| `--color-text-primary` | `#F2F2F7`  | Default body text               |
| `--color-text-secondary` | `#B7B7C6` | Labels, helper text            |
| `--color-text-muted`   | `#7E7E90`  | Disabled, placeholders          |
| `--color-text-inverse` | `#0B0B10`  | Text on orange buttons          |

### 1.3 Orange (primary accent)

| Token                     | Hex        | Usage                              |
|---------------------------|------------|------------------------------------|
| `--color-orange-50`       | `#FFF2E6`  | Rarely used tints                  |
| `--color-orange-200`      | `#FFC899`  | Hover backgrounds on dark          |
| `--color-orange-400`      | `#FF9447`  | Primary button hover               |
| `--color-orange-500`      | `#FF7A1A`  | **Primary accent** (buttons, links, selected nodes) |
| `--color-orange-600`      | `#E36610`  | Primary button active              |
| `--color-orange-700`      | `#B94F06`  | Deep accent / badges               |
| `--color-orange-glow`     | `rgba(255,122,26,0.35)` | Focus ring / selection glow |

### 1.4 Purple (secondary accent)

| Token                     | Hex        | Usage                              |
|---------------------------|------------|------------------------------------|
| `--color-purple-200`      | `#D6B3FF`  | Pale purple labels                 |
| `--color-purple-400`      | `#B478FF`  | Hover for secondary controls       |
| `--color-purple-500`      | `#9D4EDD`  | **Secondary accent** (logic nodes, tags) |
| `--color-purple-600`      | `#7E30C4`  | Active state                       |
| `--color-purple-700`      | `#5C1F94`  | Deep purple / headings             |
| `--color-purple-glow`     | `rgba(157,78,221,0.35)` | Secondary focus glow       |

### 1.5 Semantic

| Token                   | Hex        | Usage                              |
|-------------------------|------------|------------------------------------|
| `--color-success`       | `#3DD68C`  | Valid / passes                     |
| `--color-warning`       | `#F5A524`  | Non-blocking warning               |
| `--color-danger`        | `#F0506B`  | Errors, destructive actions        |
| `--color-info`          | `#4DA3FF`  | Informational                      |

### 1.6 Node category colors (graph)

Each node category gets a stable hue used on its header, edge labels, and minimap.

| Category   | Token              | Hex        |
|------------|--------------------|------------|
| Flow       | `--node-flow`      | `#7E7E90`  (neutral) |
| Narrative  | `--node-narrative` | `#FF7A1A`  (orange) |
| Stage      | `--node-stage`     | `#4DA3FF`  (blue)   |
| Audio      | `--node-audio`     | `#3DD68C`  (green)  |
| Logic      | `--node-logic`     | `#9D4EDD`  (purple) |
| Systems    | `--node-systems`   | `#F5A524`  (amber)  |
| Screens    | `--node-screens`   | `#D6B3FF`  (lavender)|

---

## 2. Typography

- **UI font:** Inter Variable (fallback: system-ui, sans-serif)
- **Monospace:** JetBrains Mono Variable (fallback: ui-monospace, Menlo, Consolas)
- **Narrative preview font:** Source Serif 4 Variable (fallback: Georgia, serif)

| Token              | Size / Line-height | Weight | Usage             |
|--------------------|--------------------|--------|-------------------|
| `--text-xs`        | 11 / 16            | 500    | Badges, meta      |
| `--text-sm`        | 12 / 18            | 500    | Secondary labels  |
| `--text-base`      | 13 / 20            | 400    | Default UI body   |
| `--text-md`        | 14 / 22            | 500    | Panel titles      |
| `--text-lg`        | 16 / 24            | 600    | Section headings  |
| `--text-xl`        | 20 / 28            | 600    | Dialog titles     |
| `--text-2xl`       | 24 / 32            | 700    | Onboarding        |

Letter spacing: `-0.01em` for sizes >= `--text-md`; `0` otherwise.

---

## 3. Spacing (4 px base)

```
--space-0: 0;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

## 4. Radii

```
--radius-xs: 2px;   /* pill inserts */
--radius-sm: 4px;   /* inputs */
--radius-md: 6px;   /* buttons, menu items */
--radius-lg: 10px;  /* nodes, panels */
--radius-xl: 14px;  /* modals */
--radius-pill: 999px;
```

## 5. Shadows

```
--shadow-sm:  0 1px 2px rgba(0,0,0,0.4);
--shadow-md:  0 4px 12px rgba(0,0,0,0.45);
--shadow-lg:  0 12px 32px rgba(0,0,0,0.55);
--shadow-focus-orange: 0 0 0 2px #0B0B10, 0 0 0 4px var(--color-orange-500);
--shadow-focus-purple: 0 0 0 2px #0B0B10, 0 0 0 4px var(--color-purple-500);
```

## 6. Motion

```
--ease-standard: cubic-bezier(0.2, 0, 0, 1);
--ease-emphasized: cubic-bezier(0.2, 0, 0, 1.2);
--duration-fast: 120ms;
--duration-base: 180ms;
--duration-slow: 280ms;
```

Respect `prefers-reduced-motion: reduce` — disable non-essential transitions.

## 7. Z-index scale

```
--z-canvas: 0;
--z-panel: 10;
--z-popover: 100;
--z-modal: 1000;
--z-toast: 1100;
--z-tooltip: 1200;
```

---

## 8. Canvas (React Flow) theming

| React Flow variable                  | Value                                 |
|--------------------------------------|---------------------------------------|
| `--rf-background-color`              | `var(--color-bg-0)`                   |
| `--rf-background-pattern-color`      | `#1B1B24`                             |
| `--rf-background-pattern-color-strong` | `#23232F`                            |
| `--rf-edge-stroke`                   | `#4A4A58`                             |
| `--rf-edge-stroke-selected`          | `var(--color-orange-500)`             |
| `--rf-connectionline-stroke`         | `var(--color-purple-500)`             |
| `--rf-handle-background`             | `var(--color-bg-3)`                   |
| `--rf-handle-border-color`           | `var(--color-orange-500)`             |
| `--rf-minimap-background`            | `var(--color-bg-1)`                   |
| `--rf-controls-bg`                   | `var(--color-bg-2)`                   |
| `--rf-controls-bg-hover`             | `var(--color-bg-3)`                   |
| `--rf-controls-color`                | `var(--color-text-secondary)`         |

Node visual rules:

- Default node: `--color-bg-2` body, 1 px `--color-border` outline, 10 px radius.
- Hover: outline becomes `--color-border-strong`; shadow `--shadow-md`.
- Selected: 2 px outline in the node's category color; `--shadow-focus-orange`.
- Errored: 2 px outline in `--color-danger` with a red dot badge on the header.
- Node header: 8 px tall color strip in the category color; title + icon below.
- Menu/If nodes: multiple colored output handles (one per choice/branch) with
  labels rendered on the edge pill.

---

## 9. Accessibility

- Minimum contrast ratio **4.5:1** for body text; verified via CI token lint.
- Focus indicators always visible (`--shadow-focus-orange` / `-purple`).
- Orange/purple are never the sole signal — always paired with an icon or label
  (for color-blind users).
- Keyboard shortcuts discoverable via `?` overlay.

---

## 10. Implementation snippet

```ts
// tailwind.config.ts (excerpt)
export default {
  theme: {
    extend: {
      colors: {
        bg:      { 0:'#0B0B10', 1:'#111118', 2:'#17171F', 3:'#1E1E27', 4:'#262631' },
        border:  { DEFAULT:'#2C2C38', strong:'#3A3A48' },
        fg:      { DEFAULT:'#F2F2F7', muted:'#7E7E90', secondary:'#B7B7C6' },
        orange:  { 200:'#FFC899', 400:'#FF9447', 500:'#FF7A1A', 600:'#E36610', 700:'#B94F06' },
        purple:  { 200:'#D6B3FF', 400:'#B478FF', 500:'#9D4EDD', 600:'#7E30C4', 700:'#5C1F94' },
        success:'#3DD68C', warning:'#F5A524', danger:'#F0506B', info:'#4DA3FF',
      },
      borderRadius: { xs:'2px', sm:'4px', md:'6px', lg:'10px', xl:'14px' },
      fontFamily: {
        sans:  ['Inter Variable', 'system-ui', 'sans-serif'],
        mono:  ['JetBrains Mono Variable', 'ui-monospace', 'monospace'],
        serif: ['Source Serif 4 Variable', 'Georgia', 'serif'],
      },
    },
  },
};
```

```css
/* apps/desktop/src/styles/tokens.css */
:root {
  color-scheme: dark;
  --color-bg-0:#0B0B10; --color-bg-1:#111118; --color-bg-2:#17171F;
  --color-bg-3:#1E1E27; --color-bg-4:#262631;
  --color-border:#2C2C38; --color-border-strong:#3A3A48;
  --color-text-primary:#F2F2F7; --color-text-secondary:#B7B7C6; --color-text-muted:#7E7E90;
  --color-orange-500:#FF7A1A; --color-purple-500:#9D4EDD;
  /* ...rest of the tokens from sections 1–7... */
}
```
