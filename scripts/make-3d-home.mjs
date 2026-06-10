// make-3d-home.mjs — postbuild swap: el mapa 3D es la homepage, el SPA clásico vive en /clasico
//
// Corre después de `vite build` (ver package.json "build"). Hace:
//   1. dist/index.html (SPA Vite recién generado) → dist/clasico/index.html
//   2. dist/3d/index.html (mapa 3D estático)      → dist/index.html
//
// REVERT: borrar este script del "build" en package.json (dejar "vite build" solo)
// y devolver el catch-all de vercel.json a "/index.html". Detalle completo:
// docs/HOMEPAGE-3D.md
import fs from 'node:fs';

const spa = 'dist/index.html';
const tres = 'dist/3d/index.html';

if (!fs.existsSync(spa)) throw new Error('dist/index.html no existe — ¿corrió vite build?');
if (!fs.existsSync(tres)) throw new Error('dist/3d/index.html no existe — falta public/3d/index.html');

fs.mkdirSync('dist/clasico', { recursive: true });
fs.renameSync(spa, 'dist/clasico/index.html');
fs.copyFileSync(tres, spa);

console.log('[make-3d-home] ✓ homepage = mapa 3D · SPA clásico = /clasico');
