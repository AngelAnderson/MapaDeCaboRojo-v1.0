#!/usr/bin/env node
// El Delator — afirma invariantes y solo habla cuando uno se rompe.
//
// POR QUÉ EXISTE. El 16 ago 2026 se arreglaron 9 bugs en un día y los 9 tenían la
// misma forma: ninguno gritó. Un sitemap topado se ve igual que uno completo. Un
// comentario decía "~230KB" con 19.83 MB corriendo. El snapshot del mapa 3D llevaba
// 20 días congelado. llms-full.txt publicaba 28% de la tabla bajo el título
// "Directorio Completo". Nada se cayó: todo se veía bien.
//
// Hay 105 crons que reportan LO QUE HICIERON. No había nada que reportara LO QUE
// DEJÓ DE SER CIERTO. Eso es esto.
//
// REGLAS:
//   · Silencio = sano. Si no hay violación, no se imprime nada y sale 0.
//   · Determinista. Cero LLM: un modelo re-derivando "¿2,680 está cerca de 3,000?"
//     cada semana es gasto que además puede alucinar. Aquí es una resta.
//   · Solo lee. Ni un UPDATE, ni un envío, ni un deploy.
//   · Cada invariante nombra el incidente que lo parió, para que nadie lo borre por
//     parecer arbitrario.
//
// USO:  node scripts/delator.mjs [--json]
// SALE: 0 = todo bien · 1 = hay ROTO · 0 con avisos = solo AVISO

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Las rutas salen de DONDE VIVE EL SCRIPT, no de cwd. El Delator lo corre un
// empleado desde un escritorio limpio fuera del repo: si dependiera de cwd,
// fallaría el primer lunes y el fallo sería, otra vez, silencioso.
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// El script del snapshot 3D no cargaba .env.local y por eso no corría con un
// `npm run` pelado — parte de por qué llevaba 20 días sin regenerarse. Aquí se
// carga a propósito: una herramienta que no arranca sola no se usa.
const envPath = path.join(RAIZ, '.env.local');
if (fs.existsSync(envPath)) {
  for (const linea of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const URL_SB = process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!URL_SB || !KEY) {
  console.error('Falta VITE_SUPABASE_URL / llave de Supabase. Revisa .env.local.');
  process.exit(2);
}

const hallazgos = [];
// Un vigilante que solo dice "todo bien" no se puede auditar: no distingues
// "revise y esta sano" de "no revise nada". --verbose imprime lo que midio cada
// invariante, pase o falle.
const medidas = [];
const medir = (que, valor) => medidas.push([que, valor]);
// nivel: 'ROTO' = ya está mintiendo · 'AVISO' = le queda poco
const delatar = (nivel, invariante, dice, incidente) =>
  hallazgos.push({ nivel, invariante, dice, incidente });

// ── acceso ────────────────────────────────────────────────────────────────────
async function contar(tabla, filtro = '') {
  const r = await fetch(`${URL_SB}/rest/v1/${tabla}?select=*${filtro ? '&' + filtro : ''}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact', Range: '0-0' },
  });
  if (!r.ok) throw new Error(`${tabla}: HTTP ${r.status}`);
  return Number((r.headers.get('content-range') || '0-0/0').split('/')[1]);
}
async function rpcTexto(fn) {
  const r = await fetch(`${URL_SB}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!r.ok) throw new Error(`rpc ${fn}: HTTP ${r.status}`);
  return r.text();
}
const traer = async (u) => {
  const r = await fetch(u + (u.includes('?') ? '&' : '?') + 'cb=' + Date.now());
  return { ok: r.ok, status: r.status, texto: await r.text() };
};

// ── las especialidades del registro (espejo de _lib/registro-subs.ts) ─────────
// Se lee del archivo en vez de copiarla: una lista duplicada es el próximo drift,
// y eso ya costó que llms-full.txt naciera sin filtro.
function specialistSubs() {
  const f = path.join(RAIZ, 'api/_lib/registro-subs.ts');
  const m = fs.readFileSync(f, 'utf8').match(/export const SPECIALIST_SUBS = \[(.*?)\];/s);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

// ── invariantes ───────────────────────────────────────────────────────────────

// 1 · Un sitemap topado se ve igual que uno completo. Ese fue el corte de 25,000
//     del 9 ago y el de 10,000 de llms-full. Se compara contra la base, no a ojo.
async function sitemapDelRegistro() {
  const { ok, texto } = await traer('https://registromedicopr.com/sitemap.xml');
  if (!ok) return delatar('ROTO', 'sitemap del registro', 'no responde', '—');
  const esp = [...texto.matchAll(/registromedicopr\.com\/especialista\/([^<]*)</g)].map((m) => m[1]);
  const unicos = new Set(esp);
  medir('sitemap: especialistas únicos', unicos.size);
  if (esp.length !== unicos.size)
    delatar('ROTO', 'sitemap del registro', `${esp.length - unicos.size} URLs duplicadas`,
      'paginar sin ORDER BY, 16 ago');

  const subs = specialistSubs();
  const inList = `(${subs.map((s) => `"${s}"`).join(',')})`;
  const elegibles = await contar('places',
    `npi=not.is.null&slug=not.is.null&status=eq.open&subcategory=in.${encodeURIComponent(inList)}`);
  medir('sitemap: elegibles en la base', elegibles);
  if (unicos.size !== elegibles)
    delatar('ROTO', 'sitemap del registro',
      `anuncia ${unicos.size} especialistas y la base publica ${elegibles} (faltan ${elegibles - unicos.size})`,
      'corte silencioso de 25,000, 9 ago');
}

// 2 · El mapa 3D es un archivo GENERADO que no se regenera en el build. Se pudre
//     callado: llevaba 20 días (27 jul → 16 ago) con 3 negocios sin aparecer.
async function snapshot3d() {
  const { ok, texto } = await traer('https://www.mapadecaborojo.com/3d');
  if (!ok) return delatar('ROTO', 'mapa 3D', 'no responde', '—');

  // La data salió del HTML a /3d/datos-<hash>.js el 16 ago. Este chequeo buscaba
  // `const PLACES=` dentro del documento y empezó a gritar "no lo encuentro" — o
  // sea que hizo su trabajo: noto que la forma cambio en vez de pasar callado.
  // Ahora sigue el <script id="datos-3d"> hasta el archivo real y cuenta ahi.
  // Se cuenta el archivo, NO el atributo data-lugares: ese numero es la promesa
  // del generador, y un guardia que verifica contra la promesa no verifica nada.
  const ref = texto.match(/id="datos-3d"[^>]*src="([^"]+)"/);
  let vivos;
  if (ref) {
    const datos = await traer('https://www.mapadecaborojo.com' + ref[1]);
    if (!datos.ok) return delatar('ROTO', 'mapa 3D', `el HTML apunta a ${ref[1]} y ese archivo no responde`, 'data partida del shell, 16 ago');
    const md = datos.texto.match(/const PLACES=(\{.*\});\s*$/s);
    if (!md) return delatar('ROTO', 'mapa 3D', `${ref[1]} no define PLACES`, 'data partida del shell, 16 ago');
    vivos = JSON.parse(md[1]).features.length;
  } else {
    // Forma vieja: data pegada en el HTML. Se acepta para no gritar si alguien revierte.
    const m = texto.match(/const PLACES=(\{.*?\});\s*$/ms);
    if (!m) return delatar('ROTO', 'mapa 3D', 'no encuentro ni el <script id="datos-3d"> ni const PLACES', 'data partida del shell, 16 ago');
    vivos = JSON.parse(m[1]).features.length;
  }

  const oeste = ['Cabo Rojo', 'Mayagüez', 'San Germán', 'Lajas', 'Hormigueros', 'Sabana Grande'];
  const debe = await contar('places',
    `visibility=eq.published&status=eq.open&lat=not.is.null&lon=not.is.null&slug=not.is.null` +
    `&municipality=in.(${oeste.map((x) => `"${x}"`).join(',')})`);
  medir('mapa 3D: pintados', vivos);
  medir('mapa 3D: en la base', debe);
  const dif = Math.abs(vivos - debe);
  if (dif > 0)
    delatar(dif > 25 ? 'ROTO' : 'AVISO', 'mapa 3D',
      `pinta ${vivos} lugares y la base tiene ${debe} (${dif} de diferencia) · corre: npm run snapshot:3d`,
      'snapshot congelado 20 días, 27 jul → 16 ago');
}

// 3 · llms-full.txt es lo que leen los LLMs. Salió meses diciendo "Total: 10000"
//     sobre 35,757 publicados, bajo el título "Directorio Completo de Cabo Rojo".
async function llmsFull() {
  const { ok, texto } = await traer('https://www.mapadecaborojo.com/llms-full.txt');
  if (!ok) return delatar('ROTO', 'llms-full.txt', 'no responde', '—');
  const declarado = Number((texto.match(/^# Total de negocios: (\d+)/m) || [])[1] || 0);
  const reales = (texto.match(/^## /gm) || []).length;
  medir('llms-full: entradas', reales);
  if (declarado !== reales)
    delatar('ROTO', 'llms-full.txt', `declara ${declarado} y trae ${reales}`, '—');
  if (declarado % 1000 === 0 && declarado > 0)
    delatar('ROTO', 'llms-full.txt',
      `${declarado} es múltiplo exacto de 1000: eso es un tope, no un total`,
      'cortaba en 10,000 de 35,757, hasta el 16 ago');
}

// 4 · El payload del mapa. El comentario del código declaraba "~230KB" mientras
//     servía 19.83 MB: 86× lo documentado, en una isla que navega por celular.
async function pesoDelMapa() {
  const t = await rpcTexto('get_map_places_minimal');
  const mb = t.length / 1048576;
  medir('peso del mapa (MB)', mb.toFixed(2));
  if (mb > 6)
    delatar('ROTO', 'peso del mapa', `${mb.toFixed(2)} MB en cada carga`,
      '19.83 MB sin filtro, hasta el 16 ago');
  else if (mb > 4)
    delatar('AVISO', 'peso del mapa', `${mb.toFixed(2)} MB, subiendo`,
      '19.83 MB sin filtro, hasta el 16 ago');
}

// 5 · Topes de una sola tirada. No cortan hoy, pero cuando crucen lo harán en
//     silencio y publicarán números subcontados que se ven igual de creíbles.
async function topesConMargen() {
  const vistas = [
    ['v_registro_muni_spec', 3000, ''],
    ['pr_hpsa_designations', 500, ''],
    ['pr_nhsc_sites', 301, ''],
    ['v_recuperacion', 101, ''],
  ];
  for (const [vista, tope, filtro] of vistas) {
    let n;
    // Un `catch { continue }` aquí es el mismo bug que este script persigue: la
    // vista se vuelve invisible y el silencio se lee como salud. v_recuperacion se
    // colaba así. Si no se puede medir, se dice que no se pudo medir.
    try {
      n = await contar(vista, filtro);
    } catch (e) {
      medir(`tope ${vista}`, 'NO SE PUDO LEER');
      delatar('AVISO', `tope de ${vista}`,
        `no se puede leer (${e.message}): este invariante está ciego`,
        'el vigilante ciego no avisa');
      continue;
    }
    medir(`tope ${vista}`, `${n}/${tope}`);
    const pct = n / tope;
    if (n >= tope)
      delatar('ROTO', `tope de ${vista}`, `${n} filas con tope ${tope}: ya está cortando`, 'auditoría 16 ago');
    else if (pct >= 0.85)
      delatar('AVISO', `tope de ${vista}`,
        `${n} de ${tope} (${Math.round(pct * 100)}%), quedan ${tope - n} filas`, 'auditoría 16 ago');
  }
}

// 6 · Un récord, un dominio. Sin esto, la misma página sirve 200 desde 3 hosts y
//     Search Console reporta 180 URLs peleando por ser 60.
async function duenoUnico() {
  const paginas = [
    ['registro/opciones', 'registromedicopr.com'],
    ['tu-ficha', 'registromedicopr.com'],
    ['cuido', 'registromedicopr.com'],
    ['faro', 'www.mapadecaborojo.com'],
    ['suelo', 'www.mapadecaborojo.com'],
    ['notas/kit', 'puertoricosinfiltros.com'],
  ];
  const hosts = ['registromedicopr.com', 'www.mapadecaborojo.com', 'puertoricosinfiltros.com'];
  for (const [ruta, dueno] of paginas) {
    const doscientos = [];
    for (const h of hosts) {
      const r = await fetch(`https://${h}/${ruta}`, { redirect: 'manual' });
      if (r.status === 200) doscientos.push(h);
    }
    medir(`dueño /${ruta}`, doscientos.join(',') || 'ninguno');
    if (doscientos.length !== 1 || doscientos[0] !== dueno)
      delatar('ROTO', `dueño de /${ruta}`,
        `sirve 200 en [${doscientos.join(', ') || 'ninguno'}] y el dueño es ${dueno}`,
        '180 URLs duplicadas, Search Console 28 jul');
  }
}

// 7 · Data que existe pero nadie puede ver. Un negocio sin slug no tiene página y
//     el snapshot 3D lo descarta: está publicado y es invisible.
async function invisibles() {
  const base = 'visibility=eq.published&status=eq.open&lat=not.is.null&slug=is.null';
  const sinSlug = await contar('places', base);
  const oeste = ['Cabo Rojo', 'Mayagüez', 'San Germán', 'Lajas', 'Hormigueros', 'Sabana Grande'];
  const sinSlugOeste = await contar('places',
    `${base}&municipality=in.(${oeste.map((x) => `"${x}"`).join(',')})`);
  medir('sin slug (isla)', sinSlug);
  medir('sin slug (oeste)', sinSlugOeste);
  if (sinSlug > 0)
    delatar(sinSlug > 300 ? 'ROTO' : 'AVISO', 'negocios invisibles',
      `${sinSlug} publicados con coordenadas y SIN slug no tienen página; ${sinSlugOeste} de ellos son del oeste y tampoco salen en el mapa 3D`,
      'medido 16 ago: 923 en la isla, 82 en el oeste, 0 son NPPES');

  const incoherentes = await contar('places',
    'status=eq.open&visibility=neq.published&npi=not.is.null');
  if (incoherentes > 0)
    delatar('AVISO', 'status vs visibility',
      `${incoherentes} filas dicen status=open y visibility≠published: el buscador las esconde`,
      'medido 16 ago: 53, sin columna que diga por qué');
}

// 8 · La frescura ES el moat, según el canon del Substrato Cívico, y su kill
//     criteria es 80%. Que el número exista no sirve si nadie lo mira.
async function frescura() {
  const hace90 = new Date(Date.now() - 90 * 864e5).toISOString();
  const conPin = await contar('places',
    'visibility=eq.published&status=eq.open&lat=not.is.null&municipality=eq.Cabo%20Rojo');
  const frescos = await contar('places',
    `visibility=eq.published&status=eq.open&lat=not.is.null&municipality=eq.Cabo%20Rojo&last_verified_at=gte.${hace90}`);
  medir('frescura Cabo Rojo', `${frescos}/${conPin}`);
  const pct = conPin ? frescos / conPin : 0;
  if (pct < 0.8)
    delatar(pct < 0.25 ? 'ROTO' : 'AVISO', 'frescura de Cabo Rojo',
      `${frescos} de ${conPin} verificados en 90d (${Math.round(pct * 100)}%), la meta del canon es 80%`,
      'kill criteria del Substrato Cívico, cruzado desde antes del 5 ago');
}

// ── correr ────────────────────────────────────────────────────────────────────
const chequeos = [
  ['sitemap del registro', sitemapDelRegistro],
  ['mapa 3D', snapshot3d],
  ['llms-full.txt', llmsFull],
  ['peso del mapa', pesoDelMapa],
  ['topes', topesConMargen],
  ['dueño único', duenoUnico],
  ['invisibles', invisibles],
  ['frescura', frescura],
];

for (const [nombre, fn] of chequeos) {
  try { await fn(); }
  catch (e) {
    // Un chequeo que revienta es en sí un hallazgo: significa que el Delator
    // dejó de poder vigilar eso. Callarlo sería repetir el bug que persigue.
    delatar('ROTO', `chequeo "${nombre}"`, `reventó: ${e.message}`, 'el vigilante ciego no avisa');
  }
}

const rotos = hallazgos.filter((h) => h.nivel === 'ROTO');
const avisos = hallazgos.filter((h) => h.nivel === 'AVISO');

// --recibo emite el markdown final ya armado. Nació porque el empleado que lo
// corría parafraseó la procedencia de cada hallazgo: donde el script decía
// "medido 16 ago: 923 en la isla, 82 en el oeste, 0 son NPPES", el recibo salió
// diciendo "registro de negocios geolocalizados sin página". Plausible e inventado,
// con el contrato prohibiéndolo en dos renglones distintos.
//
// La lección no es endurecer la instrucción: es que un modelo no debe re-derivar
// lo que un script ya sabe. Ahora el empleado corre esto y guarda la salida tal
// cual; su único trabajo es entregar, no redactar.
if (process.argv.includes('--recibo')) {
  const hoy = new Date().toISOString().slice(0, 10);
  const L = [`# El Delator · ${hoy}`, '',
    `**${rotos.length} roto(s) · ${avisos.length} aviso(s) · ${medidas.length} invariantes medidos**`, ''];
  if (rotos.length) {
    L.push('## 🔴 Roto', '');
    for (const h of rotos) L.push(`- **${h.invariante}**: ${h.dice}`, `  viene de: ${h.incidente}`, '');
  }
  if (avisos.length) {
    L.push('## 🟡 Aviso', '');
    for (const h of avisos) L.push(`- **${h.invariante}**: ${h.dice}`, `  viene de: ${h.incidente}`, '');
  }
  if (!hallazgos.length) L.push('Sin hallazgos. Todos los invariantes se midieron y ninguno se rompió.', '');
  L.push('## Medidas', '', '```');
  for (const [q, v] of medidas) L.push(`${q}: ${v}`);
  L.push('```', '');
  console.log(L.join('\n'));
} else if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ rotos: rotos.length, avisos: avisos.length, hallazgos }, null, 2));
} else if (process.argv.includes('--verbose')) {
  for (const [que, valor] of medidas) console.log(`   ${que}: ${valor}`);
  console.log('');
  for (const h of [...rotos, ...avisos]) console.log(`${h.nivel === 'ROTO' ? '🔴' : '🟡'} ${h.invariante}: ${h.dice}`);
  console.log(`\n${medidas.length} invariantes medidos · ${rotos.length} roto(s) · ${avisos.length} aviso(s)`);
} else if (!hallazgos.length) {
  // Silencio = sano. No se imprime nada a propósito: un guardia que saluda todos
  // los días enseña a ignorarlo, y entonces no sirve el día que sí tiene algo.
} else {
  for (const h of [...rotos, ...avisos]) {
    console.log(`${h.nivel === 'ROTO' ? '🔴' : '🟡'} ${h.invariante}: ${h.dice}`);
    console.log(`   viene de: ${h.incidente}`);
  }
  console.log(`\n${rotos.length} roto(s) · ${avisos.length} aviso(s)`);
}

process.exit(rotos.length ? 1 : 0);
