// make-3d-home.mjs — postbuild swap de la homepage.
//
// HISTORIA
//   2026-06-10: la homepage pasó de ser el SPA Vite a ser el mapa 3D.
//   2026-07-26 (Tier 3): la homepage deja de ser el mapa. Ahora es una portada
//   de búsqueda. Razón, con data de 30 días: la búsqueda del 3D fallaba 1 de cada
//   4 veces (140 de 513 sin resultado, varias con el negocio SÍ en la base),
//   la portada pesaba 2 MB entre HTML y un JSON de 918 KB, y el tráfico real
//   está en las páginas de negocio (33,171 visitas) que es donde se convierte.
//   El mapa 3D no se mata: pasa a ser atracción en /3d.
//
// Corre después de `vite build` (ver package.json "build"). Hace:
//   1. dist/index.html (SPA Vite recién generado) → dist/clasico/index.html
//   2. dist/home/index.html (portada de búsqueda)  → dist/index.html
//   3. dist/3d/index.html se queda donde está (el mapa vive en /3d)
//
// REVERT a "el mapa es la home": cambiar HOME de 'dist/home/index.html' a
// 'dist/3d/index.html' y devolver el canonical de public/3d/index.html a "/".
// Detalle completo: docs/HOMEPAGE-3D.md
import fs from 'node:fs';

const SPA  = 'dist/index.html';
const HOME = 'dist/home/index.html';
const TRES = 'dist/3d/index.html';

if (!fs.existsSync(SPA))  throw new Error('dist/index.html no existe — ¿corrió vite build?');
if (!fs.existsSync(HOME)) throw new Error('dist/home/index.html no existe — falta public/home/index.html');
if (!fs.existsSync(TRES)) throw new Error('dist/3d/index.html no existe — falta public/3d/index.html');

fs.mkdirSync('dist/clasico', { recursive: true });
fs.renameSync(SPA, 'dist/clasico/index.html');
fs.copyFileSync(HOME, SPA);

const kb = (p) => Math.round(fs.statSync(p).size / 1024);
console.log(`[make-3d-home] ✓ / = portada de búsqueda (${kb(SPA)} KB) · /3d = mapa 3D (${kb(TRES)} KB) · /clasico = SPA`);
