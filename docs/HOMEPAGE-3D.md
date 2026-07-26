# Homepage = portada de búsqueda · Mapa 3D en /3d · SPA clásico en /clasico

**Decisión Angel 2026-06-10:** el mapa 3D pasó a ser la homepage.
**Decisión Angel 2026-07-26 (Tier 3):** la homepage deja de ser el mapa. Ahora es
una portada de búsqueda. El mapa 3D no se mata, pasa a ser atracción en `/3d`.

## Por qué cambió (data de 30 días, no opinión)

| Señal | Número |
|---|---|
| Búsquedas en la portada 3D | 513 |
| De esas, sin resultado | 140 (27%) |
| Fallas donde el negocio SÍ estaba en la base | varias ("el rey de los monchis", "air bnb", "billar", "el taller") |
| Peso de la portada | ~2 MB (1.1 MB HTML + 918 KB de JSON) |
| Visitas a páginas de negocio | 33,171 |
| Búsquedas en el buscador del SPA clásico | 2 |

La portada buscaba contra un snapshot horneado el 10 de junio, no contra la tabla.
Y el JSON de 918 KB bajaba los 27,107 slugs de `places` completa solo para saber
quién estaba abierto: el 96% eran proveedores de salud de todo PR que ni pin tienen.

## Cómo funciona (4 piezas)

| Pieza | Qué hace |
|---|---|
| `public/home/index.html` | La portada. 14 KB, self-contained. Busca contra `/api/public?action=buscar` (RPC `mapa_buscar`, ~27 ms) y jala pulso + conteos de `?action=live3d`. |
| `public/3d/index.html` | El mapa 3D, self-contained (MapLibre + snapshot embebido). Vite lo copia a `dist/3d/`. |
| `scripts/make-3d-snapshot.mjs` | Regenera el snapshot embebido desde Supabase. `npm run snapshot:3d`. |
| `scripts/make-3d-home.mjs` | Postbuild: `dist/index.html` (SPA) → `dist/clasico/index.html`, y `dist/home/index.html` → `dist/index.html`. |

## Mapa de rutas resultante

- `/` → portada de búsqueda
- `/3d` → mapa 3D (los deep links del bot `mapadecaborojo.com/3d#lugar/<slug>` siguen funcionando)
- `/clasico` → SPA clásico completo
- `/negocio/:slug`, `/categoria/:cat`, etc. → sin cambios (server-rendered, api/*)
- Rutas desconocidas → SPA clásico (catch-all)

## El snapshot del 3D

Es estático a propósito (el mapa carga sin esperar red). **Se regenera con
`npm run snapshot:3d`**, no a mano. Antes no había script: se quedó 46 días sin
tocar y acumuló 85 negocios fantasma, 18 cerrados, y le faltaban 49 de Cabo Rojo.

Alcance: Cabo Rojo + Mayagüez + San Germán + Lajas + Hormigueros + Sabana Grande.
El resto de PR (los ~23k proveedores del registro federal NPPES) NO entra al mapa:
se llega por búsqueda y por el Veci, no por pin.

**Los stats del 3D separan Cabo Rojo del oeste a propósito.** Decir "3,466 de Cabo
Rojo" sería mentira: 2,522 son de los pueblos vecinos. Los números al 2026-07-26:
944 en Cabo Rojo · 3,466 en el oeste · 208 verificados en los últimos 90 días.

## Base de datos (migraciones que sostienen esto)

- `mapa_buscar(q, lim)` — búsqueda viva, Cabo Rojo primero, oeste después, resto de
  PR al final, cada fila etiquetada con `alcance`. Dos pasadas: todas las palabras,
  y si sale vacía, cualquiera de las palabras.
- `immutable_unaccent()` + `idx_places_name_unaccent_trgm` — búsqueda sin acentos.
  La data está mezclada ("Encarnacion" sin tilde en 10 filas, "Encarnación" en 1).
- `pulso_cache` + `pulso_refresh()` + cron `pulso-cache-refresh` (jobid 169, cada
  hora al :17) — "El Pulso del Pueblo" salía vacío porque lo alimentaba
  `get_demand_opportunities()`, que tarda 9.6 s y revienta el timeout de 8 s de anon.

## ⏪ REVERT

**Volver el mapa 3D a homepage:** en `scripts/make-3d-home.mjs`, cambiar `HOME` de
`'dist/home/index.html'` a `'dist/3d/index.html'`, y devolver el canonical y og:url
de `public/3d/index.html` a `https://www.mapadecaborojo.com/`.

**Volver el SPA a homepage:** quitar `node scripts/make-3d-home.mjs` del `build` en
package.json y devolver el catch-all de vercel.json a `/index.html`.

## Gotchas conocidos

- **Límite de serverless functions de Vercel.** Cualquier `.ts` nuevo bajo `api/`
  (fuera de `api/_lib/`) cuenta. Helpers compartidos van en `api/_lib/` (con underscore).
- El SW de raíz (`public/sw.js`) es self-destroying; ni el 3D ni la portada registran SW.
- **El 3D no se puede verificar en navegador headless**: sin WebGL cae al fallback
  "necesita un navegador más nuevo". Hay que mirarlo en un navegador real.
- Google Analytics `G-6KBMV0LKQ4` está en la portada, en el 3D y en el clásico.
