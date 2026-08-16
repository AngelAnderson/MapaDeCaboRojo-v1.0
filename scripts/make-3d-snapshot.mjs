// make-3d-snapshot.mjs — regenera el GeoJSON embebido del mapa 3D desde Supabase.
//
// POR QUÉ EXISTE (2026-07-26): el snapshot del 3D estaba horneado a mano en
// public/3d/index.html desde el 10 de junio. 46 días después tenía 85 negocios
// fantasma (ya no existen en la DB), 18 cerrados, y le faltaban 49 negocios de
// Cabo Rojo con coordenadas. No había script: se regeneraba a mano o no se
// regeneraba. Ahora se corre con `npm run snapshot:3d`.
//
// ALCANCE: Cabo Rojo + los 5 pueblos del oeste que ya estaban en el mapa.
// El resto de Puerto Rico (los ~23k proveedores de salud del registro federal
// NPPES) NO entra al mapa: se llega a ellos por búsqueda y por el Veci, no por pin.
//
// Cada feature lleva 'm' (municipio) para que el mapa pueda separar
// "Cabo Rojo" de "el oeste" sin volver a adivinar por coordenadas.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const OESTE = ['Cabo Rojo', 'Mayagüez', 'San Germán', 'Lajas', 'Hormigueros', 'Sabana Grande'];
const TARGET = 'public/3d/index.html';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Falta VITE_SUPABASE_URL / clave de Supabase en el entorno');
const supabase = createClient(url, key);

// CATEGORY de la DB → bucket de color del mapa 3D (const CATS en public/3d/index.html)
const CAT = {
  FOOD: 'comida', HEALTH: 'salud', SERVICE: 'servicios', SHOPPING: 'compras',
  BEAUTY: 'belleza', CULTURE: 'cultura', AUTO: 'auto', EDUCATION: 'educacion',
  LODGING: 'hospedaje', NIGHTLIFE: 'nightlife', GOVERNMENT: 'gobierno',
  BEACH: 'naturaleza', SIGHTS: 'naturaleza', ACTIVITY: 'naturaleza',
  LOGISTICS: 'servicios', EMERGENCY: 'salud', PROJECT: 'otros',
};

// opening_hours.structured → "HHMM-HHMM|..." indexado por getDay() (0 = domingo).
// "24" = abierto 24 horas. Vacío = cerrado ese día. null = no sabemos (no se muestra).
function horasCompactas(oh) {
  const est = oh?.structured;
  if (!Array.isArray(est) || est.length === 0) return null;
  const dias = Array(7).fill('');
  let algunoConocido = false;
  for (const d of est) {
    const i = Number(d?.day);
    if (!Number.isInteger(i) || i < 0 || i > 6) continue;
    if (d.isClosed) { algunoConocido = true; continue; }
    const o = String(d.open || '').replace(':', '');
    const c = String(d.close || '').replace(':', '');
    if (!/^\d{4}$/.test(o) || !/^\d{4}$/.test(c)) continue;
    dias[i] = (o === '0000' && (c === '2359' || c === '0000')) ? '24' : `${o}-${c}`;
    algunoConocido = true;
  }
  return algunoConocido ? dias.join('|') : null;
}

const COLS = 'slug,name,category,subcategory,municipality,barrio,book_barrio,lat,lon,' +
             'phone,contact_info,google_rating,google_review_count,one_liner,tags,' +
             'opening_hours,is_featured,sponsor_weight,last_verified_at,' +
             'is_emergency_resource,emergency_type';

// El mapa muestra "verificados 90d". Antes esa cifra salía en 0 siempre porque el
// snapshot no traía el dato: el contador leía una propiedad que nadie escribía.
const HACE_90D = Date.now() - 90 * 24 * 60 * 60 * 1000;

async function traer() {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from('places').select(COLS)
      .eq('visibility', 'published').eq('status', 'open')
      .in('municipality', OESTE)
      .not('lat', 'is', null).not('lon', 'is', null)
      // Un negocio que va a TU casa no tiene un sitio al que ir, y ponerle pin es
      // decir "esta aqui" donde no esta. Oso Electric, 3 gruas y varios de
      // jardineria caian todos encima de la plaza: su direccion es solo "Cabo
      // Rojo, PR" y el geocodificador tira al centro del pueblo cuando no sabe.
      // Siguen en la busqueda y en el Veci, que es donde se les llama. Ya habia
      // precedente sin nombre: Pipeline Plumbing y Quickfix PR nunca tuvieron pin.
      .eq('sin_local', false)
      // Sin ORDER BY, Postgres no promete el mismo orden entre una página y la
      // siguiente: las fronteras se corren y salen filas dobles mientras otras no
      // salen nunca. Hoy son 3,528 filas, o sea 4 páginas — pasó de latente a real
      // en cuanto el oeste cruzó las 1,000. slug es único aquí.
      .order('slug', { ascending: true })
      .range(desde, desde + 999);
    if (error) throw new Error(`Supabase: ${error.message}`);
    if (!data?.length) break;
    filas.push(...data);
    if (data.length < 1000) break;
  }
  return filas;
}

const filas = await traer();

const features = filas
  .filter(p => p.slug && Number.isFinite(p.lat) && Number.isFinite(p.lon))
  .map(p => {
    const props = {
      n: p.name,
      c: CAT[String(p.category || '').toUpperCase()] || 'otros',
      m: p.municipality,
      u: p.slug,
    };
    const r = Number(p.google_rating);
    if (r > 0) { props.r = r; if (p.google_review_count) props.rc = p.google_review_count; }
    const tel = p.phone || p.contact_info?.phone;
    if (tel) props.p = tel;
    const barrio = p.barrio || p.book_barrio;
    if (barrio) props.b = barrio;
    if (p.one_liner) props.o = p.one_liner;
    if (p.subcategory) props.s = p.subcategory;
    if (Array.isArray(p.tags) && p.tags.length) props.g = p.tags.join(' ');
    const h = horasCompactas(p.opening_hours);
    if (h) props.h = h;
    if (p.is_featured || (p.sponsor_weight || 0) > 80) props.f = 1;
    // La antigüedad de la verificación se calculaba y se tiraba: quedaba un sí/no.
    // Con eso, un negocio confirmado ayer y uno sin tocar desde 2024 se pintaban
    // idénticos. Ahora viaja `d` = días desde la última verificación, y el mapa
    // desvanece el pin según envejece. Sin `d` = nunca se verificó, y eso también
    // se dice. `v` se queda por compatibilidad: lo usan la insignia y el contador.
    const ver = p.last_verified_at ? Date.parse(p.last_verified_at) : NaN;
    if (Number.isFinite(ver)) {
      props.d = Math.max(0, Math.round((Date.now() - ver) / 86400000));
      if (ver >= HACE_90D) props.v = 1;
    }
    // El chip 🚨 Emergencia filtra por 'e' y afina por 'et'. El snapshot viejo
    // marcaba 703 lugares como recurso de emergencia (incluyendo dentistas) con
    // solo 4 tipos: se calculaba por categoría al hornear, no se leía de la base.
    // Aquí sale de is_emergency_resource / emergency_type, que están curados:
    // farmacia, ambulancia, hospital, gasolinera, sala de urgencia, policía,
    // bomberos, defensa civil, psiquiátrico.
    if (p.is_emergency_resource) {
      props.e = 1;
      if (p.emergency_type) props.et = p.emergency_type;
    }
    return { type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: props };
  });

const geojson = { type: 'FeatureCollection', features };
const cuerpo = `const PLACES=${JSON.stringify(geojson)};`;

// La data sale del HTML a un archivo propio con hash de contenido.
//
// Antes vivía incrustada: el documento pesaba 1.03 MB (222 KB comprimido) y CADA
// deploy lo invalidaba entero, aunque no hubiera cambiado un solo negocio — porque
// el shell y la data eran el mismo archivo y ese archivo no puede cachearse (su
// contenido cambia sin cambiar de nombre).
//
// Separados: el shell queda chiquito y la data va a datos-<hash>.js, que SÍ se
// puede marcar inmutable (regla /3d/datos- en vercel.json). Segunda visita: cero
// bytes de data. Y un deploy que solo toca código ya no obliga a rebajar los 3,446
// lugares otra vez.
//
// Va como <script src> clásico, NO como fetch: sin defer/async los scripts corren
// en orden, así que `const PLACES` sigue definido antes de que arranque la app.
// Un fetch habría obligado a reestructurar 47 KB de código de mapa por una mejora
// de cache, y ese cambio sí puede romper algo que hoy funciona.
const hash = crypto.createHash('sha256').update(cuerpo).digest('hex').slice(0, 10);
const nombreDatos = `datos-${hash}.js`;
const dirDatos = path.dirname(TARGET);

// Los hash viejos se borran: si no, cada corrida deja un archivo de 1 MB tirado y
// el repo engorda callado hasta que alguien se pregunta por qué el deploy tarda.
for (const f of fs.readdirSync(dirDatos)) {
  if (/^datos-[0-9a-f]{10}\.js$/.test(f) && f !== nombreDatos) fs.unlinkSync(path.join(dirDatos, f));
}
fs.writeFileSync(path.join(dirDatos, nombreDatos), cuerpo);

const html = fs.readFileSync(TARGET, 'utf8');
const lineas = html.split('\n');
// Acepta las 2 formas: la línea vieja con la data pegada (primera migración) y la
// nueva con el <script src>. Así el script no se rompe si alguien revierte el HTML.
const idx = lineas.findIndex(l => l.startsWith('const PLACES=') || l.includes('id="datos-3d"'));
if (idx === -1) throw new Error(`No encontré ni "const PLACES=" ni el <script id="datos-3d"> en ${TARGET}`);
const antes = /^const PLACES=/.test(lineas[idx])
  ? (lineas[idx].match(/"type":"Feature"/g) || []).length
  : (() => { const m = lineas[idx].match(/data-lugares="(\d+)"/); return m ? Number(m[1]) : 0; })();
// `const PLACES=` es la PRIMERA línea de un <script> que sigue con más código
// (EVENTS, EVENTOS…). Meter una etiqueta ahí dejaría un script anidado y HTML roto.
// Se cierra el bloque, se carga el archivo, y se reabre: así no hay que saber dónde
// cierra el bloque original y el orden de ejecución queda idéntico al de hoy.
// Idempotencia. La primera versión reemplazaba SOLO la línea marcador, pero dejaba
// el </script> que había insertado antes y el <script> de después: cada corrida
// agregaba un par. A la tercera corrida había 3 </script> seguidos y 2 <script>.
// El conteo seguía balanceado, así que no se veía roto — otro fallo callado.
// Ahora se traga las etiquetas vecinas que este mismo script pudo haber puesto y
// escribe siempre las mismas 3 líneas, corra 1 vez o 50.
let ini = idx;
while (ini - 1 >= 0 && lineas[ini - 1].trim() === '</script>') ini--;
let fin = idx + 1;
while (fin < lineas.length && lineas[fin].trim() === '<script>') fin++;
lineas.splice(ini, fin - ini,
  '</script>',
  `<script id="datos-3d" src="/3d/${nombreDatos}" data-lugares="${features.length}"></script>`,
  '<script>');

// El meta description estaba escrito a mano y decía "944 negocios de Cabo Rojo y
// 2,522 del oeste, verificados uno a uno". Dos mentiras a la vez: los números eran
// viejos (son 931 y 2,515) y "verificados uno a uno" no es cierto — al 16 ago solo
// 260 de 3,446 estaban confirmados en 90 días y 2,616 no se han visto nunca.
//
// Ahora lo escribe el script con los números de la corrida, así que no puede
// envejecer, y dice lo que el mapa de verdad hace. Prometer verificación total en
// un sitio cuyo moat ES la verificación es la peor forma de gastarse el moat.
{
  const crAqui = features.filter(f => f.properties.m === 'Cabo Rojo').length;
  const frescos = features.filter(f => f.properties.v).length;
  // Coma de millar, igual que el panel del mapa ("3,446"). toLocaleString('es') no la
  // pone en números de 4 cifras y el meta salía "2515" al lado de un panel que dice
  // "3,446" — dos formatos del mismo número en la misma pantalla.
  const mil = (n) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const desc = `El mapa 3D de Cabo Rojo: ${mil(crAqui)} negocios del pueblo y ` +
    `${mil(features.length - crAqui)} del resto del oeste. ` +
    `${mil(frescos)} confirmados a mano en los últimos 90 días; los demás salen igual, ` +
    `marcados como sin confirmar. Busca, mira qué está abierto ahora, y pregúntale al Veci.`;
  const iMeta = lineas.findIndex(l => l.includes('name="description"'));
  if (iMeta !== -1) lineas[iMeta] = `<meta name="description" content="${desc.replace(/"/g, '&quot;')}">`;
  // og:description también decía "verificado uno a uno". Se arregló el meta normal y
  // este se quedó mintiendo — es el que se ve cuando alguien comparte el enlace por
  // WhatsApp, o sea el que más gente lee.
  const iOg = lineas.findIndex(l => l.includes('property="og:description"'));
  if (iOg !== -1) lineas[iOg] = `<meta property="og:description" content="El directorio del pueblo en 3D. ${mil(frescos)} de ${mil(features.length)} confirmados a mano en 90 días; los demás salen marcados como sin confirmar.">`;
}
fs.writeFileSync(TARGET, lineas.join('\n'));

const porMuni = features.reduce((a, f) => (a[f.properties.m] = (a[f.properties.m] || 0) + 1, a), {});
const cr = porMuni['Cabo Rojo'] || 0;
console.log(`[snapshot-3d] ${antes} → ${features.length} lugares (${features.length - antes >= 0 ? '+' : ''}${features.length - antes})`);
console.log(`[snapshot-3d] Cabo Rojo: ${cr} · resto del oeste: ${features.length - cr}`);
Object.entries(porMuni).sort((a, b) => b[1] - a[1]).forEach(([m, n]) => console.log(`             ${m}: ${n}`));
