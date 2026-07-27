// smoke.mjs — la prueba que le faltaba al sitio.
//
// POR QUÉ EXISTE (2026-07-27): el bot tiene 51 archivos de prueba. El sitio tenía
// cero. En una sola semana se rompieron, en producción y en silencio: el mapa sin
// un solo pin, "El Pulso del Pueblo" vacío por meses, eventos de junio en pleno
// julio, la búsqueda fallando 1 de cada 4 veces, y 918 KB de basura en cada carga.
// Ninguno lo agarró un sistema. Todos los agarró Angel abriendo el teléfono.
//
// El detector no puede ser un humano mirando.
//
// Corre:  npm run smoke                    (contra producción)
//         SMOKE_URL=http://localhost:3000 npm run smoke
//
// El mapa se prueba en un navegador DE VERDAD, sin ventana, con WebGL por
// software (swiftshader). Sin esos flags Chromium no da WebGL, MapLibre cae al
// fallback "necesita un navegador más nuevo" y la prueba pasaría con el mapa roto.
// Ese fue exactamente el agujero que dejó salir el bug del 27 de julio.
import { createRequire } from 'node:module';

const BASE = (process.env.SMOKE_URL || 'https://www.mapadecaborojo.com').replace(/\/$/, '');
// La prueba mide si el sitio está bien, no si el CDN cachea bien. Sin esto, un
// live3d guardado hace 39 minutos hacía fallar la prueba de coordenadas de
// eventos que en la base ya estaban resueltas.
const sinCache = (u) => u + (u.includes('?') ? '&' : '?') + '_sc=' + Date.now();
const CR = { lonMin: -67.30, lonMax: -66.95, latMin: 17.90, latMax: 18.20 };

let fallos = 0, pasadas = 0, saltadas = 0;
const ok   = (m) => { pasadas++; console.log(`  ✓ ${m}`); };
const fail = (m, d) => { fallos++; console.log(`  ✗ ${m}${d ? `\n      → ${d}` : ''}`); };
const skip = (m) => { saltadas++; console.log(`  · ${m} (saltada)`); };

function check(nombre, cond, detalle) { cond ? ok(nombre) : fail(nombre, detalle); }

// ── Capa 1: HTTP. Sin dependencias, corre donde sea. ─────────────────────────
async function capaHttp() {
  console.log('\nHTTP');

  const r = await fetch(BASE + '/');
  const html = await r.text();
  const kb = Math.round(Buffer.byteLength(html) / 1024);
  check('la portada responde 200', r.status === 200, `dio ${r.status}`);
  // La portada pesaba 1,124 KB cuando era el mapa. Si vuelve a pasar de 50, algo
  // se volvió a hornear dentro del HTML.
  check(`la portada pesa menos de 50 KB (${kb} KB)`, kb < 50, `pesa ${kb} KB`);
  check('la portada enlaza "pon tu negocio"', html.includes('/pon-tu-negocio-en-el-mapa'),
        'la página que hace dinero volvió a quedar sin puerta');
  check('la portada tiene el buscador', html.includes('id="q"'));

  const rb = await fetch(sinCache(`${BASE}/api/public?action=buscar&q=plomero&limit=5`));
  const b = await rb.json().catch(() => ({}));
  const res = b.results || [];
  check('buscar "plomero" devuelve resultados', res.length > 0, 'devolvió 0');
  check('el primer resultado es de Cabo Rojo', res[0]?.alcance === 'cabo_rojo',
        `salió ${res[0]?.municipality || 'nada'} de primero`);

  const rv = await fetch(`${BASE}/api/public?action=buscar&q=pruebasmoke${Date.now()}`);
  check('una búsqueda sin resultado no revienta', rv.status === 200, `dio ${rv.status}`);

  const rl = await fetch(sinCache(BASE + '/api/public?action=live3d'));
  const l3 = await rl.json().catch(() => ({}));
  const l3kb = Math.round(Buffer.byteLength(JSON.stringify(l3)) / 1024);
  // Esto mandaba los 27,107 slugs de la tabla completa: 918 KB en cada carga.
  check(`live3d pesa menos de 20 KB (${l3kb} KB)`, l3kb < 20, `pesa ${l3kb} KB`);
  check('el Pulso trae términos', (l3.demand || []).length > 0,
        'vacío: el cron pulso-cache-refresh puede estar caído');
  check('los conteos son números vivos', Number(l3.conteos?.cabo_rojo) > 0);
  const evViejos = (l3.eventos || []).filter(e => Date.parse(e.d) < Date.now());
  check('ningún evento publicado ya pasó', evViejos.length === 0,
        `${evViejos.length} vencidos, el primero: ${evViejos[0]?.n}`);
  // Un evento sin coordenadas no es un fallo: sale en la lista aunque no tenga
  // pin, y a veces el sitio de verdad no está en el directorio. Lo que SÍ es
  // fallo es que el resolver automático deje de resolver la mayoría.
  const ev = l3.eventos || [];
  const conPunto = ev.filter(e => e.lat != null).length;
  const pct = ev.length ? Math.round(100 * conPunto / ev.length) : 100;
  check(`la mayoría de los eventos salen como pin (${conPunto}/${ev.length}, ${pct}%)`, pct >= 70,
        'el trigger events_resolver_coords puede estar caído');

  console.log('\nRutas');
  for (const ruta of ['/3d', '/clasico', '/pon-tu-negocio-en-el-mapa', '/tienda',
                      '/barrios', '/registro', '/negocio/tano-plumbing', '/llms.txt']) {
    const rr = await fetch(BASE + ruta, { redirect: 'manual' });
    check(`${ruta} responde 200`, rr.status === 200, `dio ${rr.status}`);
  }
  // Las podadas tienen que redirigir, no caer al catch-all del SPA.
  for (const ruta of ['/moonshots', '/pueblo-en-numeros']) {
    const rr = await fetch(BASE + ruta, { redirect: 'manual' });
    check(`${ruta} redirige (podada)`, rr.status === 301 || rr.status === 308, `dio ${rr.status}`);
  }
}

// ── Capa 2: el mapa, en un navegador de verdad. ──────────────────────────────
function buscarPlaywright() {
  const req = createRequire(import.meta.url);
  for (const p of ['playwright',
                   '/Users/angelfanderson/.claude/skills/gstack/node_modules/playwright']) {
    try { return req(p); } catch { /* siguiente */ }
  }
  return null;
}

async function capaMapa() {
  console.log('\nMapa 3D (navegador real, WebGL por software)');
  const pw = buscarPlaywright();
  if (!pw) {
    skip('no encontré playwright, el mapa no se probó');
    console.log('      → instala con: npm i -D playwright && npx playwright install chromium');
    return;
  }

  const browser = await pw.chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errores = [];
    page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
    page.on('pageerror', e => errores.push(String(e.message)));

    await page.goto(`${BASE}/3d`, { waitUntil: 'load', timeout: 45000 });

    const vivo = await page.evaluate(() => typeof map !== 'undefined' && !!map).catch(() => false);
    if (!vivo) {
      // Si cayó al fallback de "navegador viejo", el WebGL falló y la prueba
      // no probó nada. Eso es un fallo, no un skip: es el agujero de siempre.
      const txt = await page.textContent('body').catch(() => '');
      fail('el mapa arrancó', txt.includes('navegador más nuevo')
        ? 'cayó al fallback sin WebGL: la prueba no pudo mirar el mapa'
        : 'window.map no existe, el script murió antes');
      return;
    }

    await page.waitForFunction(() => typeof map !== 'undefined' && map.isStyleLoaded(), { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(9000);   // que termine el vuelo a Cabo Rojo

    const est = await page.evaluate(() => {
      const capas = map.getStyle().layers.map(l => l.id);
      let pines = 0;
      try { pines = map.queryRenderedFeatures({ layers: ['dots'] }).length; } catch (e) {}
      const c = map.getCenter();
      return {
        capas: ['heat', 'glow', 'dots'].filter(id => capas.includes(id)),
        pines, lon: c.lng, lat: c.lat, zoom: map.getZoom(),
        tiempo: Array.from(document.querySelectorAll('.t-op')).map(b => b.textContent.trim()),
        inicio: /location\.href='\/'/.test(document.body.innerHTML) ||
                !!Array.from(document.querySelectorAll('button')).find(b => /Inicio/.test(b.textContent)),
        abiertosAhora: (typeof FEATS !== 'undefined' ? FEATS : []).filter(f => f.properties._op === 1).length,
      };
    });

    // El bug del 27 de julio: 'right' en addControl mató setupLayers() y el mapa
    // cargó sin una sola capa de datos. Esta línea sola lo habría agarrado.
    check('las capas de datos están montadas', est.capas.length === 3,
          `solo ${est.capas.join(', ') || 'ninguna'}`);
    check(`el mapa dibuja pines (${est.pines})`, est.pines > 100,
          `solo ${est.pines}: el mapa cargó vacío`);
    check('la cámara está sobre Cabo Rojo', est.lon > CR.lonMin && est.lon < CR.lonMax &&
          est.lat > CR.latMin && est.lat < CR.latMax,
          `quedó en ${est.lon.toFixed(3)},${est.lat.toFixed(3)} zoom ${est.zoom.toFixed(1)}`);
    check('el control de tiempo tiene sus 3 momentos', est.tiempo.length === 3,
          `encontré: ${est.tiempo.join(' / ') || 'ninguno'}`);
    check('hay camino de vuelta al inicio', est.inicio,
          'desde el mapa no se llega a la portada');

    // El 4D de verdad: cambiar el momento tiene que cambiar quién está abierto.
    const finde = await page.evaluate(async () => {
      const b = document.querySelector('.t-op[data-momento="finde"]');
      if (!b) return null;
      b.click();
      await new Promise(r => setTimeout(r, 1200));
      return (typeof FEATS !== 'undefined' ? FEATS : []).filter(f => f.properties._op === 1).length;
    });
    check('mover el mapa en el tiempo cambia lo que está abierto',
          finde !== null && finde !== est.abiertosAhora,
          `ahora ${est.abiertosAhora}, el finde ${finde}: el 4D no está moviendo nada`);

    const graves = errores.filter(e => !/favicon|Failed to load resource/i.test(e));
    check('la consola del mapa está limpia', graves.length === 0, graves.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
  }
}

// ── ─────────────────────────────────────────────────────────────────────────
console.log(`\nPrueba de humo · ${BASE}`);
try {
  await capaHttp();
  await capaMapa();
} catch (e) {
  fail('la prueba se cayó sola', e.message);
}

console.log(`\n${pasadas} pasaron · ${fallos} fallaron · ${saltadas} saltadas`);
if (fallos) {
  console.log('\nNO DEPLOYES. Arregla lo de arriba primero.\n');
  process.exit(1);
}
console.log('\nTodo bien.\n');
