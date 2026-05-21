# Molotov · Overrides del sistema de diseño

> **Precedencia:** este documento manda sobre `SKILL.md` (la guía de diseño base).
> Donde haya conflicto entre la guía base y estos overrides, gana este archivo.
> Lo que no esté acá se hereda de la base (grid 8pt, WCAG 2.2 AA, estados de
> componente, workflow de autoría).
>
> Prosa en español (Argentina). Identificadores de tokens, nombres de fuentes y
> código, en inglés.

---

## 1. Contexto y objetivos

Molotov es un marketplace de arte digital con estética **editorial / galería,
anti-cripto-bro**. La guía de diseño base aporta la estructura
(grids, jerarquía, ritmo de espaciado), pero su paleta es **clara** y sus fuentes
son otras. Estos overrides reorientan el sistema a una **base oscura** con
tipografía display de carácter y un acento azul muy puntual.

Cambios respecto de la base que hay que tener presentes:

- La base es light (`surface #FFFFFF`, `text #111827`). **Acá el fondo es oscuro
  por default.** Cualquier mención a "surface blanco" de la base se ignora.
- Fuentes de la base (Gelasio / Ubuntu Mono) → **reemplazadas** (ver §3).
- Escala tipográfica de la base topa en 40px → **se extiende hacia arriba** para
  el hero (ver §3).

---

## 2. Color — tokens (override total de la paleta base)

Base oscura. Negro como fondo, off-white como texto. Azul Molotov como acento
puntual, **nunca inundatorio**.

```
/* Núcleo */
--color-bg:            #000000;  /* negro puro: fondo base */
--color-bg-elevated:   #0A0A0B;  /* casi negro: cards y superficies elevadas */
--color-fg:            #F5F4ED;  /* off-white: texto primario */
--color-fg-muted:      rgba(245, 244, 237, 0.64);  /* texto secundario */
--color-fg-subtle:     rgba(245, 244, 237, 0.40);  /* labels, metadata */
--color-border:        rgba(245, 244, 237, 0.12);  /* hairlines, divisores */

/* Acento Molotov */
--color-accent:          #2D43FF;  /* azul electrico: fills, bordes, focus, dots, underlines */
--color-accent-on-dark:  #5B6CFF;  /* tint claro para TEXTO de acento sobre fondo oscuro */
--color-accent-hover:    #4B5EFF;  /* estado hover de elementos accent */

/* Semánticos funcionales (heredados de la base, sólo para estados de sistema) */
--color-success: #16A34A;
--color-warning: #D97706;
--color-danger:  #DC2626;
```

**Reglas de color:**

- El acento `--color-accent` (#2D43FF) **must** usarse de forma puntual:
  underlines, dots, focus rings, fills de botón primario, bordes activos. No
  pintar bloques grandes ni fondos enteros con él.
- **Contraste del acento como texto:** #2D43FF sobre #000000 da ~2.6:1, que
  **no pasa WCAG AA** ni para texto grande. Por eso:
  - Para **texto de acento sobre fondo oscuro** (links, palabra resaltada en el
    H1) usar `--color-accent-on-dark` (#5B6CFF, ~4.6:1). ✅
  - #2D43FF como texto sólo es válido **sobre off-white** (`--color-fg` de
    fondo), no sobre negro. ✅
- **Prohibido** todo gradiente purple→pink o variantes (cliché de marketplaces
  NFT). Si se usa gradiente, que sea monocromo sutil (negro→casi-negro) o
  basado en el acento azul a baja opacidad.
- Don't: `background: linear-gradient(#7C3AED, #EC4899)` ← prohibido.

---

## 3. Tipografía — tokens (override de fuentes y escala)

```
--font-display: "Fraunces", Georgia, "Times New Roman", serif;
--font-body:    "Geist", "IBM Plex Sans", system-ui, sans-serif;
--font-mono:    "Geist Mono", "IBM Plex Mono", ui-monospace, monospace;
```

- **Display = Fraunces** (Google Fonts, variable). Aprovechar el eje `opsz`
  (optical size) de forma dinámica y permitir `italic` para resaltar palabras
  clave.
- **Body = Geist**; si Geist no está disponible, **IBM Plex Sans**.
- **Mono = Geist Mono** (fallback IBM Plex Mono): obligatorio para **precios,
  direcciones de wallet, hashes y basis points**.
- **Prohibido** usar Inter, Roboto o Arial en cualquier contexto.

**Escala tipográfica** (la base 14/16/18/24/32/40 se mantiene para body/UI y se
extiende hacia arriba para display):

```
/* body / UI (heredado) */
--text-xs: 14px;  --text-sm: 16px;  --text-base: 18px;
--text-lg: 24px;  --text-xl: 32px;  --text-2xl: 40px;
/* display (extensión Molotov, para hero y manifiesto) */
--text-3xl: 56px; --text-4xl: 72px; --text-5xl: 96px; --text-6xl: 128px;
```

**Mapeo `opsz` de Fraunces** (recomendado):

- `--text-5xl`/`--text-6xl` (hero): `opsz` 144 (máximo), weight 300–500.
- `--text-3xl`/`--text-4xl`: `opsz` ~72.
- ≤ `--text-2xl`: `opsz` 24–40.

Italics de Fraunces: should reservarse para 1–2 palabras clave por bloque, no
para frases enteras.

---

## 4. Background, textura y layout

- **Fondo base oscuro** siempre: `--color-bg` (#000000) o `--color-bg-elevated`
  (#0A0A0B) para zonas/cards.
- **Grain / noise overlay** permitido y recomendado, sutil: `opacity ~0.04`,
  `position: fixed`, `pointer-events: none`, por encima del fondo y debajo del
  contenido. Implementación sugerida: SVG `feTurbulence` (no imagen rasterizada
  pesada). Respetar `prefers-reduced-motion` si el grain anima.
- **Layout:** asimetría deliberada, **negative space generoso**, y
  **grid-breaking** en hero y secciones de manifiesto (elementos que rompen la
  columna). Mantener el baseline grid de 8pt de la base para el ritmo vertical.
- **Cards de obra:** foto/media **grande arriba**, info **abajo** (artista,
  título, precio dual XLM+USD en `--font-mono`, badge de royalty). El media es
  el protagonista; la metadata es secundaria y discreta (`--color-fg-muted`/
  `--color-fg-subtle`).

---

## 5. Accesibilidad (acceptance criteria, sobre base oscura)

- Mantener **WCAG 2.2 AA**. Texto normal ≥4.5:1, texto grande ≥3:1.
  - `--color-fg` sobre `--color-bg`: ✅ alto contraste.
  - Acento como texto sobre oscuro → usar `--color-accent-on-dark` (§2).
- **Focus visible** sobre fondo oscuro: ring de 2px con `--color-accent` +
  `outline-offset: 2px`. Si el elemento ya es azul, usar `--color-fg` para el
  ring. Nunca eliminar el focus.
- Touch targets ≥44px. Soporte `prefers-reduced-motion` para marquee, hero
  motion y grain animado. Semántica HTML antes que ARIA.

---

## 6. Contenido y tono

- Idioma por default: **español de Argentina**. Tono editorial, curatorial,
  sobrio, latinoamericano.
- **Prohibido** el vocabulario cripto-bro: `moonshot`, `diamond hands`, `to the
  moon`, `WAGMI`, `GM`, `ape in` (y equivalentes).
- **Sin emojis** de cohete, fuego, dinero o gemas en copy de producción.
- Do: "El ingreso vuelve *hacia* el artista." / "Regalías inmutables, grabadas
  on-chain."
- Don't: "🚀 WAGMI fam, esta obra va to the moon 💎🙌".

---

## 7. Anti-patterns (prohibido)

- Gradientes purple→pink o cualquier paleta "NFT genérica".
- Fondos claros / surfaces blancas heredadas de la base.
- Inter, Roboto o Arial.
- #2D43FF como texto chico sobre negro (falla contraste; usar accent-on-dark).
- Acento azul inundando bloques grandes o fondos.
- Lenguaje cripto-bro o emojis de cohete/fuego/dinero/gemas.

---

## 8. QA checklist (ejecutable en code review)

- [ ] Fondo oscuro (`--color-bg`/`--color-bg-elevated`); no hay surfaces blancas.
- [ ] Sólo Fraunces / Geist / Geist Mono; no aparece Inter/Roboto/Arial.
- [ ] Precios, wallets, hashes y bps van en `--font-mono`.
- [ ] El acento azul es puntual; texto de acento sobre oscuro usa
      `--color-accent-on-dark`.
- [ ] No hay gradientes purple-pink.
- [ ] Contraste verificado (≥4.5:1 normal / ≥3:1 grande).
- [ ] Focus visible en todos los interactivos; touch targets ≥44px.
- [ ] Copy en es-AR, sin jerga cripto-bro ni emojis prohibidos.
- [ ] Grain overlay ≤4% opacity y respeta reduced-motion.
- [ ] Cards de obra: media grande arriba, metadata discreta abajo.

---

## 9. Watchpoints a revisar en el Paso 5 (landing renderizada)

No bloquean; revisar cuando se vea la landing en pantalla.

- **`--color-bg` en #000000 puro:** defendible (matchea lo agresivo/contrastado de
  "Molotov"), pero el negro absoluto puede sentirse áspero en OLED. Muchos dark
  themes modernos warman el negro (Vercel ~#0A0A0A, Linear similar). Si al ver la
  landing se siente demasiado duro, considerar bajar `--color-bg` también a
  `#0A0A0B` (ajuste de 5 min). Por ahora se mantiene #000000.
- **`--text-base` en 18px** (heredado de la guía de diseño base, > 16px estándar):
  encaja con la idea de galería/curaduría (lectura más pausada, gravitas), pero
  en mobile puede sentirse grande de más. Si pasa, ajustar por breakpoint, no el
  token base.
