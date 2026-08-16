// Busca pines que probablemente estén donde no va el negocio.
//
//   node scripts/pines-sospechosos.mjs [municipio]        (default: Cabo Rojo)
//
// Nace de 3 reportes de Angel el mismo día: The Gold Ice Cream 125 m fuera de su
// calle, el Dr. Silvestry a 4 m de la Parroquia San Miguel, y la Dra. Padilla en
// medio de una esquina. Cuando el mismo error se reporta 3 veces, deja de ser un
// arreglo y pasa a ser un detector.
//
// ⚠️ LO QUE ESTE SCRIPT NO HACE, Y POR QUÉ:
// La primera versión comparaba el pin contra la calle que dice su propia
// dirección. Salieron 36 sospechosos y **la mayoría eran falsos**: 15 decían
// "Calle Carbonell" y OSM llama a ese tramo "Avenida Doctor Pedro Albizu Campos /
// Carretera 311". En Puerto Rico una calle tiene nombre local Y número de
// carretera a la vez, así que comparar por nombre de calle no sirve.
// Los 2 detectores de abajo NO usan nombres de calle. Son inmunes a eso.
//
// Y lo que devuelve son CANDIDATOS PARA IR A MIRAR, no errores probados. Un
// negocio puede estar legítimamente pegado a un monumento si da a la plaza.
import { createClient } from '@supabase/supabase-js'

const MUNICIPIO = process.argv[2] || 'Cabo Rojo'
const BBOX = [18.078, -67.156, 18.096, -67.136]   // casco: sur, oeste, norte, este

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('Falta VITE_SUPABASE_URL / clave de Supabase en el entorno')
const supabase = createClient(url, key)

const ESPEJOS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const metros = (a, b, c, d) =>
  Math.hypot((a - c) * 111320, (b - d) * 111320 * Math.cos((a * Math.PI) / 180))

async function calles() {
  const q = `[out:json][timeout:120];(way["highway"]["name"](${BBOX.join(',')}););out geom;`
  for (const u of ESPEJOS) {
    try {
      const r = await fetch(u, { method: 'POST', body: new URLSearchParams({ data: q }),
        headers: { 'User-Agent': 'MapaDeCaboRojo/1.0 (angel@angelanderson.com)' } })
      if (!r.ok) throw new Error(`http ${r.status}`)
      const j = await r.json()
      const pts = j.elements.flatMap(w => (w.geometry || []).map(p => [p.lat, p.lon]))
      if (pts.length) { console.log(`[pines] ${pts.length} puntos de calle desde ${u.split('/')[2]}`); return pts }
    } catch (e) { console.warn(`[pines] ${u.split('/')[2]}: ${e.message}`) }
  }
  return null   // Overpass se cae seguido. Que no se lleve el detector 1 con él.
}

const { data: lugares } = await supabase.from('places')
  .select('name,slug,address,lat,lon,subcategory,sin_local')
  .eq('municipality', MUNICIPIO).eq('status', 'open')
  .not('lat', 'is', null).limit(2000)

const dentro = lugares.filter(x =>
  x.lat > BBOX[0] && x.lat < BBOX[2] && x.lon > BBOX[1] && x.lon < BBOX[3] && !x.sin_local)
console.log(`[pines] ${dentro.length} fichas con pin dentro del casco\n`)

// ── 1. Encima de un hito ────────────────────────────────────────────────────
// El más certero: es exactamente lo que le pasó al Dr. Silvestry. El
// geocodificador no supo la dirección y soltó el pin sobre lo único que sí tenía
// nombre propio cerca: la iglesia, el obelisco, la plaza.
const esHito = x => /parroquia|iglesia|plaza |monumento|obelisco|alcald/i.test(x.name) ||
  ['church', 'Monumento', 'Plaza', 'gobierno'].includes(x.subcategory)
const hitos = dentro.filter(esHito)

console.log(`═══ ENCIMA DE UN HITO (${hitos.length} hitos en el casco) ═══`)
const sobreHito = []
for (const x of dentro) {
  if (esHito(x)) continue
  for (const h of hitos) {
    const d = metros(x.lat, x.lon, h.lat, h.lon)
    if (d < 12) { sobreHito.push({ d: Math.round(d), x, h }); break }
  }
}
sobreHito.sort((a, b) => a.d - b.d)
for (const s of sobreHito) console.log(`  ${String(s.d).padStart(3)} m de «${s.h.name}»  ->  ${s.x.name}`)

// ── 2. Lejos de toda calle ──────────────────────────────────────────────────
// En un casco urbano nadie tiene la puerta a 45 m de cualquier calle. Suele ser
// el centroide de un centro comercial o de una manzana entera.
console.log(`\n═══ A MÁS DE 45 m DE CUALQUIER CALLE ═══`)
// El detector 1 ya imprimió. Si Overpass está caído (pasa seguido, da 504), se
// avisa y se sigue: media respuesta buena vale más que un stack trace.
const vias = await calles()
if (!vias) {
  console.log('  ⚠️ Overpass no respondió. Este detector se salta; el de arriba ya corrió.')
} else {
  const lejos = dentro
    .map(x => ({ d: Math.round(Math.min(...vias.map(p => metros(x.lat, x.lon, p[0], p[1])))), x }))
    .filter(o => o.d > 45).sort((a, b) => b.d - a.d)
  for (const o of lejos.slice(0, 20)) console.log(`  ${String(o.d).padStart(4)} m  ${o.x.name}  ·  ${o.x.address || 'sin dirección'}`)
  console.log(`\n  (${lejos.length} en total)`)
}
console.log(`\nEsto son candidatos para ir a mirar, no errores probados.`)
