// Hornea las huellas de los edificios del casco de Cabo Rojo para el mapa 3D.
//
//   node scripts/make-casco.mjs
//
// De donde sale: OpenStreetMap via Overpass. Las HUELLAS son reales y estan
// levantadas a mano por mapeadores. La ALTURA no existe en OSM para Cabo Rojo
// (0 de 3,341 edificios traen `building:levels` o `height`), asi que se calcula
// a partir del area de la huella y se declara en la pagina como representativa.
// Si algun dia OSM trae niveles de verdad, este script los prefiere solo.
//
// El archivo sale con hash en el nombre, igual que datos-*.js, para que el
// navegador lo cachee para siempre y un cambio invalide el cache solo.
//
// Lo que hace propio a este mapa: cada edificio se cruza contra el directorio.
// El que tiene adentro un negocio que existe se pinta con el color de su
// categoria; el que tiene uno CONFIRMADO en los ultimos 90 dias se levanta y se
// pinta fuerte. El resto del pueblo queda en hueso, de escenario. Eso ningun
// otro mapa lo puede hacer: OSM tiene las paredes, nosotros tenemos quien esta
// adentro.
import { writeFileSync, readdirSync, unlinkSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

// El casco: la plaza, Munoz Rivera, y el nucleo urbano alrededor.
const BBOX = [18.078, -67.156, 18.096, -67.136]   // sur, oeste, norte, este
const SALIDA = 'public/3d'

const ESPEJOS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]

const consulta = `[out:json][timeout:240];(way["building"](${BBOX.join(',')}););out geom;`

async function bajar() {
  let ultimoError
  for (const url of ESPEJOS) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': 'MapaDeCaboRojo/1.0 (angel@angelanderson.com)' },
        body: new URLSearchParams({ data: consulta }),
      })
      if (!r.ok) throw new Error(`http ${r.status}`)
      const j = await r.json()
      if (!j.elements?.length) throw new Error('respuesta vacia')
      console.log(`[casco] ${url.split('/')[2]}: ${j.elements.length} edificios`)
      return j.elements
    } catch (e) {
      ultimoError = e
      console.warn(`[casco] ${url.split('/')[2]} fallo: ${e.message}`)
    }
  }
  throw ultimoError
}

// Area aproximada de la huella en m2. Sirve para dos cosas: descartar ruido
// (garajes de 6 m2 que ensucian la vista) y estimar cuantos pisos parece tener.
function areaM2(pts) {
  const latMed = pts.reduce((s, p) => s + p.lat, 0) / pts.length
  const mx = 111320 * Math.cos((latMed * Math.PI) / 180)
  let a = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j].lon * mx) * (pts[i].lat * 110540) - (pts[i].lon * mx) * (pts[j].lat * 110540)
  }
  return Math.abs(a / 2)
}

// ── el directorio, del mismo archivo que ya carga el mapa ───────────────────
// Se lee de public/3d/datos-*.js en vez de ir a Supabase: es la misma verdad
// que el mapa esta enseñando en ese momento, y no hace falta ninguna llave.
function leerLugares() {
  const dir = readdirSync(SALIDA).find(f => /^datos-[a-f0-9]+\.js$/.test(f))
  if (!dir) { console.warn('[casco] no encontre datos-*.js, los edificios van sin cruzar'); return [] }
  const src = readFileSync(join(SALIDA, dir), 'utf8')
  const geo = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1))
  const dentro = geo.features.filter(f => {
    const [lon, lat] = f.geometry.coordinates
    return lat >= BBOX[0] && lat <= BBOX[2] && lon >= BBOX[1] && lon <= BBOX[3]
  })
  console.log(`[casco] ${dir}: ${dentro.length} negocios dentro del casco`)
  return dentro
}

// Punto en poligono, rayo horizontal. Los anillos son chiquitos (huellas de
// edificio), asi que la fuerza bruta con caja envolvente alcanza y sobra.
function dentroDe(lon, lat, anillo, caja) {
  if (lon < caja[0] || lon > caja[2] || lat < caja[1] || lat > caja[3]) return false
  let d = false
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j]
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) d = !d
  }
  return d
}

const elementos = await bajar()
const lugares = leerLugares()
const rasgos = []
let sinAltura = 0, conNegocio = 0, confirmados = 0

for (const e of elementos) {
  const pts = e.geometry
  if (!pts || pts.length < 4) continue
  const area = areaM2(pts)
  if (area < 25) continue                      // casetas y ruido de importacion

  const t = e.tags || {}
  // OSM primero, siempre. Hoy no hay ninguno, pero el dia que lo haya, manda.
  const niveles = parseFloat(t['building:levels'])
  const altOSM = parseFloat(t.height)
  let h, real = false
  if (Number.isFinite(altOSM)) { h = altOSM; real = true }
  else if (Number.isFinite(niveles)) { h = niveles * 3.2; real = true }
  else {
    sinAltura++
    // Representativa: el pueblo es de 1 y 2 plantas, y lo grande (iglesia,
    // escuela, plaza del mercado) se levanta un poco mas. No es data, es masa.
    h = area > 900 ? 9 : area > 380 ? 7 : area > 140 ? 5.2 : 4
  }

  // 5 decimales = ~1.1 m. Mas que suficiente para una huella, y baja el archivo
  // a menos de la mitad.
  const anillo = pts.map(p => [+p.lon.toFixed(5), +p.lat.toFixed(5)])
  const pri = anillo[0], ult = anillo[anillo.length - 1]
  if (pri[0] !== ult[0] || pri[1] !== ult[1]) anillo.push(pri)

  // ¿quien vive aqui adentro?
  let minx = 180, miny = 90, maxx = -180, maxy = -90
  for (const [x, y] of anillo) {
    if (x < minx) minx = x; if (x > maxx) maxx = x
    if (y < miny) miny = y; if (y > maxy) maxy = y
  }
  const caja = [minx, miny, maxx, maxy]
  const adentro = []
  for (const l of lugares) {
    const [lon, lat] = l.geometry.coordinates
    if (dentroDe(lon, lat, anillo, caja)) adentro.push(l.properties)
  }

  const props = { h: 0, r: real ? 1 : 0 }
  if (adentro.length) {
    conNegocio++
    // El confirmado manda sobre el que solo esta listado: es el que costo ir.
    const jefe = adentro.find(p => p.v) || adentro[0]
    props.k = jefe.c || 'otros'
    props.n = adentro.length
    if (adentro.some(p => p.v)) { props.v = 1; confirmados++ }
    // Un edificio con negocio adentro es comercio: en el casco eso es 2 plantas
    // con el local abajo. Se levanta para que la calle comercial se lea sola.
    h = Math.max(h, props.v ? 8.5 : 7)
  }
  props.h = +h.toFixed(1)

  rasgos.push({
    type: 'Feature',
    properties: props,
    geometry: { type: 'Polygon', coordinates: [anillo] },
  })
}

const geo = { type: 'FeatureCollection', features: rasgos }
const json = JSON.stringify(geo)
const hash = createHash('sha256').update(json).digest('hex').slice(0, 10)
const nombre = `casco-${hash}.json`

for (const f of readdirSync(SALIDA)) {
  if (/^casco-[a-f0-9]{10}\.json$/.test(f) && f !== nombre) {
    unlinkSync(join(SALIDA, f))
    console.log(`[casco] borrado el viejo ${f}`)
  }
}
writeFileSync(join(SALIDA, nombre), json)

const kb = (json.length / 1024).toFixed(0)
console.log(`[casco] ✓ ${SALIDA}/${nombre} · ${rasgos.length} edificios · ${kb} KB`)
console.log(`[casco]   ${sinAltura} con altura representativa (OSM no la trae), ` +
            `${rasgos.length - sinAltura} con altura real de OSM`)
console.log(`[casco]   ${conNegocio} con un negocio del directorio adentro, ` +
            `de esos ${confirmados} confirmados en 90 dias`)
console.log(`[casco]   pega esto en public/3d/index.html:  const CASCO_URL='/3d/${nombre}'`)
