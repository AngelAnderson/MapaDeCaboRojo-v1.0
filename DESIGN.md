# Design System: mapadecaborojo.com

> Extracted from the live code on 2026-09-17 (commit `86252c2`), not invented. Sources: `public/home/index.html` (the front door), `tailwind.config.js` + `src/index.css` (the React app), `api/pages.ts` + `api/mapa-pages.ts` (server-rendered SEO pages), `constants.ts` (category colors). Read this before touching anything visual on the Mapa. Skill: `diseno-web`.

## Product context
- **What it is:** the verified directory of Cabo Rojo (and the west, and PR) as a search box first and a map second. Job of the page: *"Escribe lo que buscas. Te decimos quién lo resuelve."*
- **Who it's for:** a resident on a phone who needs a plumber, a pharmacy or a dentist now; then visitors; then business owners ("¿Tienes negocio en Cabo Rojo?").
- **Sister brand:** caborojo.com (`~/Dropbox/Claude/DESIGN.md`). Same type pair (Fraunces + Source Sans 3), same warm neutrals, **different accent**: Mapa is teal `#0d9488`, caborojo.com is ocean `#1B4B5A`. They are siblings, not twins.
- **Signature:** the live numbers (`1,166 en Cabo Rojo · 5,476 en el oeste · 35,602 en todo PR`) and "Lo que el pueblo buscó este mes". The page proves it is alive with real counts; that is the one memorable thing. Everything else stays quiet.

## Three visual dialects live today

| Dialect | Where | Accent | Neutrals | Type | Status |
|---|---|---|---|---|---|
| **A · Portada** | `public/home/index.html` (served at `/`) | teal `#0d9488` → `#0f766e` gradient, coral `#f97316` | warm sand/stone | Fraunces + Source Sans 3 | **CANON** (newest, the front door, iterated Aug 2026) |
| B · App ("Versión clásica") | React: `App.tsx`, `components/` | emerald `#10b981` ("brand") + coral `#f0491f` | sand ramp (tokens) but **357 uses of cold `slate`**, 12 of `sand` | Fraunces (6 uses) + Source Sans 3 | Drift. Admin (`components/admin/`) holds almost all the slate: acceptable as an internal zone |
| C · SEO pages | `api/pages.ts` (6,969 lines), `api/mapa-pages.ts` (22,522 lines) | teal `#0d9488` | **cold slate** (`#0f172a`, `#1e293b`, `#64748b`, `#94a3b8`, `#e2e8f0`) | **system font** (`-apple-system`), no Fraunces | Drift. These are what Google indexes and where most visitors land |

**Rule for new work:** build in dialect A. When you touch a B or C file, move what you touch toward A; never introduce a 4th dialect.

## Tokens (dialect A, canonical)

### Color
| Token | Hex | Role |
|---|---|---|
| `--teal` | `#0d9488` | Brand. Header gradient start, focus ring, spinner, call button |
| `--teal-dark` | `#0f766e` | Header gradient end, links, secondary action text. **Use this for any small white-on-teal text** (5.47:1) |
| `--coral` | `#f97316` | Business CTA, "recomendado" warmth, hover on "Volver". **Never as a background under white text** (2.80:1, fails AA) |
| `--canvas` | `#faf9f7` | Page background (warm, never pure white) |
| `--paper` | `#ffffff` | Cards, search box, panels |
| `--ink` | `#1c1917` | Primary text |
| `--ink-soft` | `#57534e` | Secondary text (7.63:1 on paper) |
| `--ink-cap` | `#78716c` | Small readable captions: footer, timestamp, counts (4.56:1) |
| `--coral-ink` | `#c2410c` | Coral when it carries white text or is itself text (5.18:1) |
| `--ink-mut` | `#a8a29e` | Placeholder only. **Not for readable text** (2.40:1 on canvas) |
| `--line` | `#e7e5e4` | Hairline borders |
| Tints | `#fff7ed` / `#fed7aa` / `#c2410c` | "Recomendado" tag and "hueco" (search with no answer): orange-50 bg, orange-200 border, orange-700 text |
| Recessed | `#f5f5f4` | Pulse chips, hover rows |

Dark mode: dialect A has none; the React app has `.dark` tokens in `src/index.css` (canvas `18 16 14`, brand brightened to `#34d399`). If A gets dark mode, derive it from those.

### Category colors (map pins and category chips)
Kept separate from the brand palette on purpose. They are the iOS system colors, defined in `constants.ts` and mirrored in the `categories` table (owned by the Mapa Casa):

BEACH `#FF9500` · FOOD `#FF3B30` · SIGHTS `#007AFF` · NIGHTLIFE `#AF52DE` · ACTIVITY `#34C759` · CULTURE `#5856D6` · LODGING `#5AC8FA` · SHOPPING `#FF2D55` · HEALTH `#10b981` · SERVICE `#8E8E93` · LOGISTICS `#FFCC00` · EMERGENCY `#D22B2B`

Use them only to say "what kind of place", never as UI accents.

### Type
- **Display:** Fraunces 600/700, `letter-spacing: -.02em`. Headings, the live numbers, panel titles. Use sparingly.
- **Body/UI:** Source Sans 3 400/600/700. Everything else. Loaded from Google Fonts with `display=swap`.
- **Scale (A):** h1 `1.6rem` · panel h2 `1.12rem` · body `1rem` · meta `.87rem` · tag `.68rem` uppercase `+.04em`. Search input `17px` (never below 16px on iOS or it zooms).

### Shape, depth, motion
- **Radius:** search box and cards `14px` · panels `16px` · buttons `9-10px` · chips and tags `999px`.
- **Shadow:** one warm shadow, `0 1px 2px rgba(28,25,23,.06), 0 8px 24px rgba(28,25,23,.06)`. No cold gray shadows.
- **Tap targets:** minimum `44px` (chips were 33px and people missed them; see the comment in the file). Event links `52px`.
- **Motion:** only the search spinner (`.7s` rotation). The app respects `prefers-reduced-motion` globally; A should too if motion is ever added.
- **Width:** content column `max-width: 640px`, `20px` side padding. Mobile first.

## Components (A)
- **Header:** teal gradient `150deg`, white Fraunces h1, 1-line promise, search box, starter chips, live-number row separated by 1px white dividers.
- **Search box:** white, `14px` radius, emoji icon left, spinner right while busy, teal focus ring `0 0 0 3px rgba(13,148,136,.16)`.
- **Result card:** name (700) + tags, meta line in `--ink-soft`, action row: call button filled teal, others outlined with `--teal-dark` text.
- **Empty state (`.vacio`):** says what happened and offers the next step (button in `--coral-ink` with white text). An empty result is an invitation, never an apology.
- **Pulse panel:** "Lo que el pueblo buscó este mes": terms as recessed chips with the count in `--ink-cap`, holes (`.hueco`) tinted orange.
- **Business tile:** orange-50 background, orange-700 heading: "¿Tienes negocio en Cabo Rojo?" / "Verificarte es gratis."
- **Footer:** the promise ("Cada ficha de aquí la verificó una persona..."), data timestamp, link row, "Verificado a mano, uno por uno, desde Cabo Rojo."

## Copy rules inside the design
Spanish first, abuelita-friendly. "El Veci", never bot or AI. CTA phone **787-417-7711**. Numbers in digits with a date ("Datos al 17 de septiembre a las 10:22 p. m."). "Verificado" only where a person verified it (`procedenciaSello()` is the single source). Verification badge is free; La Vitrina buys prominence, never verification. No public prices.

## Debt (verified 2026-09-17, fix in this order)
1. **Coral button fails contrast (2.80:1).** `.btn{background:var(--coral)}` with white text. Fix: button background `#c2410c` (5.18:1), keep `--coral` for borders and hovers. It is the rescue button on an empty search ("escríbele al Veci"). **FIXED 2026-09-18 (`fe15195`)** via `--coral-ink`.
2. **`--ink-mut` used as readable text (2.40:1)** in the timestamp and footer lines. Fix: `#78716c` (4.56:1) for text; keep `#a8a29e` for placeholders only. **FIXED 2026-09-18** via `--ink-cap`.
3. **White chips on teal (3.74:1)** at 14.4px bold. Fix: move the header gradient toward `#0f766e`, or darken the chip text shadow. Needs a render to judge.
4. **`theme-color` in `index.html` is `#374C8A`** (a blue that exists nowhere in the system). **FIXED 2026-09-18.** (The portada already had `#0d9488`; the blue was the app shell.)
5. **Dialect C (SEO pages) uses cold slate + system font.** Largest surface Google sees. Migrate token by token: slate → stone/sand equivalents, add the Fraunces/Source Sans link, headings in Fraunces.
6. **Dialect B coral `#f0491f` ≠ A coral `#f97316`.** Pick A's.
7. `components/PlaceCard.tsx` has 18 off-system color classes in public UI.

## How to verify a change
`bash ~/.claude/skills/diseno-web/scripts/render.sh https://mapadecaborojo.com <dir>` → read `movil-390.png` and `escritorio-1280.png`. Deploy with `/deploy` (6 gates) and look at the live URL, not the preview.
