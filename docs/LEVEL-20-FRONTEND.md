# Frontend Level 20 — mapadecaborojo.com

Autonomous overhaul (branch `feat/frontend-level-20`). Goal: take the frontend from a
competent-but-generic iOS-glass map app (~level 5-7) to a distinctive, cohesive, premium
civic product. Additive and surgical — the working app must never break.

## Design direction: Warm Coastal Cabo Rojo

Move away from generic iOS-glass + cold slate. Establish a coherent language that feels
like Cabo Rojo itself: the salt flats (Las Salinas), El Faro, the coral cliffs, warm light.

- **Display**: Fraunces (serif, already loaded) — personality, headings, big numbers.
- **Body**: Source Sans 3.
- **Palette**: emerald primary (kept) + coral/terracotta secondary (El Faro / cliffs) +
  warm sand neutrals (replace cold slate). Full 50-950 ramps as CSS variables.
- **Neutrals**: warm stone, not blue-slate. Feels Caribbean, not corporate SaaS.
- **Glass**: keep, but lighter and more intentional. Real elevation scale.
- **Tokens**: 8px spacing, type scale, radii, elevation, z-index scale (fixes modal chaos),
  motion durations/easings. All semantic (light + dark consume the same vars).

## Phases

1. **Design system foundation** — tokens in `src/index.css` (CSS vars) + `tailwind.config.js`
   extend; base layer (focus rings, selection, scrollbar, motion-reduce); UI primitives in
   `components/ui/` (Button, Chip, Card, Sheet, Badge, Skeleton, Field, Toast, Spinner).
2. **Map core** — basemap restyle, unified brand markers/clusters, redesigned PlaceCard +
   bottom sheet with image skeletons and a clean action row.
3. **Entry / home / nav** — Pueblo-en-Números hero, BottomNav, search pill, CommandMenu,
   initial-load skeletons.
4. **Sub-pages** — /tienda, /sistema, /pueblo-en-numeros, /me-conviene, category pages to
   premium editorial / data-viz quality.
5. **Polish & correctness** — silence 401 heartbeat noise, motion + reduced-motion, empty
   states, a11y (aria-labels, non-color status), dark-mode consistency.
6. **QA + deploy preview + verify live + handoff**.

## Non-negotiables (from CLAUDE.md)

- Spanish, abuelita-friendly, Cabo Rojo audience. No em dashes in user-facing copy.
- Verify names/data against Supabase before displaying.
- Deploy = Vercel preview first, verify live URL renders new build, watch 307s.
- Never touch prod data destructively.
