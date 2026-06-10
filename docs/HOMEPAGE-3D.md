# Homepage = Mapa 3D · SPA clásico archivado en /clasico

**Decisión de Angel: 2026-06-10.** El mapa 3D standalone es la homepage de
mapadecaborojo.com. El SPA Vite/React original ("El Veci — El Copiloto del
Pueblo") NO se borró: vive en **`/clasico`** y se puede restaurar como home
en un solo commit (ver § Revert).

## Cómo funciona (3 piezas)

| Pieza | Qué hace |
|---|---|
| `public/3d/index.html` | El mapa 3D completo, self-contained (MapLibre + 3,432 places embebidos + data viva vía `/api/public?action=live3d`). Vite lo copia a `dist/3d/`. |
| `scripts/make-3d-home.mjs` | Postbuild (corre en `npm run build` después de `vite build`): mueve `dist/index.html` (SPA) → `dist/clasico/index.html` y copia `dist/3d/index.html` → `dist/index.html`. |
| `vercel.json` catch-all | `/(.*)` → `/clasico/index.html` (las rutas sueltas siguen cayendo en el SPA, como antes). El resto de rewrites (negocio/categoria/farmacia/evento/api/...) NO cambió. |

## Mapa de rutas resultante

- `/` → mapa 3D (servido del filesystem, `dist/index.html`)
- `/3d` → el mismo mapa 3D (los deep links del bot `mapadecaborojo.com/3d#lugar/<slug>` siguen funcionando; canonical de ambas copias apunta a `/`)
- `/clasico` → SPA clásico completo (assets en `/assets/*` son absolutos, funciona igual)
- `/negocio/:slug`, `/categoria/:cat`, `/pueblo-en-numeros`, `/demanda`, etc. → sin cambios (server-rendered, api/*)
- Rutas desconocidas → SPA clásico (catch-all), igual que siempre

## Enlaces cruzados

- El 3D tiene botón **🗂 Clásico** (controles abajo-izquierda) → `/clasico`
- El SPA tiene botón **⛰ 3D** (header) → `/3d`
- El fallback sin-WebGL del 3D manda a `/clasico` (NO a `/`, evita loop)
- Google Analytics `G-6KBMV0LKQ4` está en AMBAS páginas

## ⏪ REVERT (volver el SPA a homepage)

Un commit, 3 cambios:

1. **package.json** — `"build": "vite build && node scripts/make-3d-home.mjs"` → `"build": "vite build"`
2. **vercel.json** — catch-all `"destination": "/clasico/index.html"` → `"/index.html"`
3. **public/3d/index.html** — (opcional, SEO) canonical y og:url de vuelta a `https://www.mapadecaborojo.com/3d`; el fallback sin-WebGL de vuelta a `https://www.mapadecaborojo.com`

`git push` y listo: `/` vuelve a ser el SPA, `/3d` sigue siendo el mapa 3D, `/clasico` deja de existir (404 → catch-all → SPA, inofensivo). Nada se pierde porque el SPA nunca se movió de sitio en el repo — el swap pasa solo en build time.

Commit de referencia del cambio original: buscar `feat(home): el mapa 3D es la homepage` en git log.

## Gotchas conocidos

- **Límite Vercel Hobby: 12/12 serverless functions.** Cualquier `.ts` nuevo bajo `api/` (fuera de `api/_lib/`) ROMPE el deploy. Helpers compartidos van en `api/_lib/` (con underscore).
- El snapshot de places del 3D es estático (generado 2026-06-10, 3,432 lugares tras quitar 8 con coords en el agua — ver `Outbox/Mapa/Auditoria-Coordenadas-Agua-2026-06-10.md` en Dropbox/Claude). La data viva (`live3d`) refresca demanda, cierres y featured, pero NO agrega negocios nuevos — para eso hay que regenerar el snapshot.
- El SW de raíz (`public/sw.js`) es self-destroying; el 3D no registra SW.
