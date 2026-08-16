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
    const ver = p.last_verified_at ? Date.parse(p.last_verified_at) : NaN;
    if (Number.isFinite(ver) && ver >= HACE_90D) props.v = 1;
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
const linea = `const PLACES=${JSON.stringify(geojson)};`;

const html = fs.readFileSync(TARGET, 'utf8');
const lineas = html.split('\n');
const idx = lineas.findIndex(l => l.startsWith('const PLACES='));
if (idx === -1) throw new Error(`No encontré la línea "const PLACES=" en ${TARGET}`);
const antes = (lineas[idx].match(/"type":"Feature"/g) || []).length;
lineas[idx] = linea;
fs.writeFileSync(TARGET, lineas.join('\n'));

const porMuni = features.reduce((a, f) => (a[f.properties.m] = (a[f.properties.m] || 0) + 1, a), {});
const cr = porMuni['Cabo Rojo'] || 0;
console.log(`[snapshot-3d] ${antes} → ${features.length} lugares (${features.length - antes >= 0 ? '+' : ''}${features.length - antes})`);
console.log(`[snapshot-3d] Cabo Rojo: ${cr} · resto del oeste: ${features.length - cr}`);
Object.entries(porMuni).sort((a, b) => b[1] - a[1]).forEach(([m, n]) => console.log(`             ${m}: ${n}`));
