/**
 * api/_lib/comer.ts · "¿Dónde comemos hoy?" (29 oct 2026)
 *
 * Routes (vercel.json → api/mapa-pages.ts):
 *   /donde-comer-hoy → ?page=donde-comer-hoy   (todo Cabo Rojo, con zona)
 *   /ruta-joyuda     → ?page=ruta-joyuda        (la misma página con Joyuda escogido)
 *
 * Nació en paloeste.com/ruta-joyuda el 29 oct 2026 (Next). Angel: "me gustó cómo quedó,
 * integrarlo a mapadecaborojo.com y subirle el nivel". Aquí vive la única copia; paloeste
 * redirige 301 aquí. Server-rendered con querystring: funciona sin JavaScript.
 *
 * Reglas: no se dice "abierto" sin horario · la cuenta (IVU 11.5% + propina 15%) solo sale
 * con amenities.platos con fuente · contact_info.no_outreach (sinPromo) nunca va de primero
 * en las 3 opciones (misma regla que twilio-webhook/commands.ts) · cero menciones a Turismo.
 * Medición: la hoja "¿Te contestaron?" (hojaLlamadaScript, ya va en layout) registra cada
 * tel:; este archivo añade directions_click, menu_click y recommendation_view a registro_events.
 */

type Deps = { layout: (opts: any) => string; escapeHtml: (s: string) => string; supabase: any }

const SITE_URL = 'https://www.mapadecaborojo.com'
const VECI_TEL = '787-417-7711'
const RUTA_TAG = 'ruta-joyuda-2026'

// ---------- Hora de Puerto Rico ----------
type Estado = 'abierto' | 'abre-hoy' | 'cerrado' | 'sin-horario'
type EstadoHorario = { estado: Estado; texto: string; corto: string }
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export function ahoraPR(now: Date = new Date()): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Puerto_Rico', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value || ''
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { day: map[get('weekday')] ?? 0, minutes: (Number(get('hour')) % 24) * 60 + Number(get('minute')) }
}

export function hora12(t: string): string {
  const [h, m] = String(t || '').split(':').map(Number)
  if (Number.isNaN(h)) return t
  const suf = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suf}` : `${h12} ${suf}`
}

const aMin = (t?: string) => { const [h, m] = String(t || '').split(':').map(Number); return Number.isNaN(h) ? NaN : h * 60 + (m || 0) }

export function estadoHorario(p: any, now: Date = new Date()): EstadoHorario {
  const oh = p?.opening_hours
  if (oh && (oh.type === '24_7' || oh.type === 'always_open')) return { estado: 'abierto', texto: 'ABIERTO 24 horas', corto: 'abierto 24 horas' }
  const st = Array.isArray(oh?.structured) ? oh.structured : null
  if (!st || !st.length) return { estado: 'sin-horario', texto: 'Sin horario, llama antes', corto: 'sin horario, llama antes' }
  const { day, minutes } = ahoraPR(now)
  // Anoche cruzó la medianoche y sigue abierto.
  const ayer = st.find((d: any) => d.day === (day + 6) % 7)
  if (ayer && !ayer.isClosed) {
    const o = aMin(ayer.open), c = aMin(ayer.close)
    if (!Number.isNaN(o) && !Number.isNaN(c) && c <= o && minutes < c) return { estado: 'abierto', texto: `ABIERTO · cierra ${hora12(ayer.close)}`, corto: `cierra ${hora12(ayer.close)}` }
  }
  const hoy = st.find((d: any) => d.day === day)
  if (hoy && !hoy.isClosed) {
    const o = aMin(hoy.open), c = aMin(hoy.close)
    if (!Number.isNaN(o) && !Number.isNaN(c)) {
      const abierto = c <= o ? minutes >= o : minutes >= o && minutes < c
      if (abierto) return { estado: 'abierto', texto: `ABIERTO · cierra ${hora12(hoy.close)}`, corto: `cierra ${hora12(hoy.close)}` }
      if (minutes < o) return { estado: 'abre-hoy', texto: `CERRADO · abre hoy a las ${hora12(hoy.open)}`, corto: `abre hoy a las ${hora12(hoy.open)}` }
    }
  }
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7
    const e = st.find((x: any) => x.day === d)
    if (e && !e.isClosed && e.open) {
      const cuando = i === 1 ? 'mañana' : `el ${DIAS[d]}`
      return { estado: 'cerrado', texto: `CERRADO · abre ${cuando} ${hora12(e.open)}`, corto: `abre ${cuando} ${hora12(e.open)}` }
    }
  }
  return { estado: 'cerrado', texto: 'CERRADO', corto: 'cerrado' }
}

const abreEseDia = (p: any, dia: number) => {
  const oh = p?.opening_hours
  if (oh && (oh.type === '24_7' || oh.type === 'always_open')) return true
  return Array.isArray(oh?.structured) && oh.structured.some((d: any) => d.day === dia && !d.isClosed && d.open)
}

// ---------- Datos de contacto ----------
export function telDigitos(phone?: string | null): string | null {
  if (!phone) return null
  let d = String(phone).replace(/[^0-9]/g, '')
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1)
  return d.length === 10 ? d : null
}
const telVisible = (phone?: string | null) => { const d = telDigitos(phone); return d ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : '' }
const comoLlegar = (p: any): string | null => (p.lat != null && p.lon != null ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}` : p.gmaps_url || null)

export function verificadoEn(p: any): Date | null {
  const v = String(p?.last_verified_at || '')
  if (!v || v.startsWith('2026-01-01')) return null // fecha de carga masiva, no verificación
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}
const mesAnio = (d: Date) => new Intl.DateTimeFormat('es-PR', { month: 'long', year: 'numeric', timeZone: 'America/Puerto_Rico' }).format(d)

export const sinPromo = (p: any) => (p?.contact_info?.no_outreach === true || p?.contact_info?.no_outreach === 'true' ? 1 : 0)

// ---------- Zonas (cada restaurante cae en 1) ----------
const norm = (s: string) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const ZONAS: Record<string, { label: string; corto: string; emoji: string }> = {
  joyuda: { label: 'Joyuda', corto: 'Joyuda', emoji: '🦞' },
  boqueron: { label: 'Boquerón y El Combate', corto: 'Boquerón y El Combate', emoji: '🌅' },
  'puerto-real': { label: 'Puerto Real', corto: 'Puerto Real', emoji: '⚓' },
  pueblo: { label: 'El pueblo y el campo', corto: 'el pueblo', emoji: '🏘️' },
}

export function zonaDe(p: any): string {
  const txt = norm(`${p.address || ''} ${p.name || ''}`)
  const barrio = norm(p.barrio || '')
  if ((p.tags || []).includes(RUTA_TAG) || /joyuda/.test(txt) || barrio === 'guanajibo' || (barrio === 'miradero' && /102/.test(txt))) return 'joyuda'
  if (barrio === 'boqueron' || /boquer|combate/.test(txt)) return 'boqueron'
  if (barrio === 'miradero' || barrio === 'puerto real' || /puerto real/.test(txt)) return 'puerto-real'
  return 'pueblo'
}

// ---------- Coincidencias ----------
const pajar = (p: any) => norm([p.name, p.subcategory, p.description, p.one_liner, (p.tags || []).join(' '), (p.vibe || []).join(' ')].filter(Boolean).join(' | '))

const GANAS: Record<string, { re: RegExp; label: string; chip: string }> = {
  mariscos: { re: /marisc|seafood|ostion|pescad|langost|cangrejo|camaron|chillo|dorado|pulpo|carrucho/, label: 'Mariscos', chip: 'Mariscos' },
  criolla: { re: /criol|mofongo|lechon|puertorrique|comida tipica|alcapurria|empanadilla|carne frita|arroz con/, label: 'Comida criolla', chip: 'Criolla' },
  pizza: { re: /pizza|italian|pasta/, label: 'Italiana y pizza', chip: 'Pizza o italiana' },
  desayuno: { re: /desayun|breakfast|cafe|coffee|panader|bakery|reposter|brunch/, label: 'Desayuno o café', chip: 'Desayuno o café' },
}
const coincideGanas = (p: any, t: string) => (GANAS[t] ? GANAS[t].re.test(pajar(p)) : false)

const tagsDe = (p: any): string[] => (p.tags || []).map(norm)
function coincideImporta(p: any, q: string): boolean {
  const tags = tagsDe(p), txt = pajar(p)
  switch (q) {
    case 'vista': return tags.some((t) => ['sunset', 'vista al mar', 'atardecer', 'frente al mar'].includes(t)) || /vista al mar|frente al mar|atardecer|puesta del sol|bahia|sunset/.test(txt)
    case 'rapido': return tags.some((t) => ['food truck', 'rapido', 'comida rapida', 'para llevar'].includes(t)) || /food truck|comida rapida|frituras|para llevar|cuchifrito|fast food/.test(txt)
    case 'estacionamiento': { const park = p.amenities?.parking; return (Boolean(park) && !['false', 'none', 'no'].includes(String(park).toLowerCase())) || /estacionamiento|parking/.test(txt) }
    case 'familiar': return tags.some((t) => ['con-ninos', 'familiar', 'family', 'family friendly'].includes(t)) || (p.vibe || []).some((v: string) => /familiar|family/i.test(v)) || /familiar|ninos/.test(txt)
    default: return false
  }
}
const IMPORTA: Record<string, { label: string; chip: string }> = {
  vista: { label: 'con vista al mar', chip: 'Vista al mar' },
  rapido: { label: 'para salir rápido', chip: 'Rápido' },
  estacionamiento: { label: 'con estacionamiento', chip: 'Estacionamiento' },
  familiar: { label: 'ambiente familiar', chip: 'Familiar' },
}

// [supuesto] precio por persona según price_level; se dice en la nota.
const RANGO_NIVEL: Record<string, [number, number]> = { $: [15, 25], $$: [25, 45], $$$: [45, 80] }

// ---------- Parámetros ----------
type Params = { zona?: string; p?: number; g?: number; t?: string; q?: string }
type Filtros = { abierto?: boolean; ostiones?: boolean; ninos?: boolean; atardecer?: boolean; domingo?: boolean }

function leerParams(qy: any, zonaFija?: string): Params {
  const one = (k: string) => { const v = qy?.[k]; return Array.isArray(v) ? String(v[0]) : v != null ? String(v) : undefined }
  const num = (v: string | undefined, ok: number[]) => (v && ok.includes(Number(v)) ? Number(v) : undefined)
  const z = zonaFija || one('zona'), t = one('t'), q = one('q')
  return {
    zona: z && ZONAS[z] ? z : undefined,
    p: num(one('p'), [1, 2, 4, 6, 8]),
    g: num(one('g'), [20, 40, 60, 100, 150]),
    t: t && (GANAS[t] || t === 'sorprendeme') ? t : undefined,
    q: q && IMPORTA[q] ? q : undefined,
  }
}
function leerFiltros(qy: any): Filtros {
  const on = (k: string) => qy?.[k] === '1' || (Array.isArray(qy?.[k]) && qy[k][0] === '1')
  return { abierto: on('abierto'), ostiones: on('ostiones'), ninos: on('ninos'), atardecer: on('atardecer'), domingo: on('domingo') }
}
const hayRespuestas = (x: Params) => x.p != null || x.g != null || x.t != null || x.q != null

// ---------- Recomendación ----------
type Cuenta = { renglones: { texto: string; monto: number }[]; total: number; platos: string }
type Opcion = { place: any; estado: EstadoHorario; motivo: string; cuenta: Cuenta | null; g: boolean; im: boolean }

const round2 = (n: number) => Math.round(n * 100) / 100
export function cuentaCompleta(p: any, personas: number): Cuenta | null {
  const platos = (p.amenities?.platos || []).filter((x: any) => typeof x?.precio === 'number' && x.precio > 0 && x.fuente && x.verificado !== false)
  if (!platos.length) return null
  const precios = platos.map((x: any) => x.precio as number).sort((a: number, b: number) => a - b)
  const mid = Math.floor(precios.length / 2)
  const tipico = precios.length % 2 ? precios[mid] : (precios[mid - 1] + precios[mid]) / 2
  const sub = round2(tipico * personas), ivu = round2(sub * 0.115), prop = round2(sub * 0.15)
  return {
    renglones: [
      { texto: `${personas} ${personas === 1 ? 'persona' : 'personas'} × $${tipico.toFixed(2)} (plato típico)`, monto: sub },
      { texto: 'IVU 11.5%', monto: ivu },
      { texto: 'Propina 15%', monto: prop },
    ],
    total: round2(sub + ivu + prop),
    platos: platos.slice(0, 4).map((x: any) => `${x.nombre} $${(x.precio as number).toFixed(2)}`).join(' · '),
  }
}

export function recomendar(places: any[], x: Params, now: Date = new Date()): { opciones: Opcion[]; aviso: string | null } {
  const porPersona = x.g && x.p ? x.g / x.p : null
  const base = places.filter((p) => telDigitos(p.phone) || p.gmaps_url || p.lat != null).map((p) => ({ p, e: estadoHorario(p, now) }))
  // Abiertos, sin horario ("llama antes") y los que abren más tarde hoy. El peso del estado
  // ordena; lo que pidieron (ganas, importa) pesa más: un sitio de mariscos sin horario le gana
  // a una pizzería abierta cuando pidieron mariscos. Cerrado todo el día no entra.
  let elegibles = base.filter((b) => b.e.estado === 'abierto' || b.e.estado === 'sin-horario' || b.e.estado === 'abre-hoy')
  let aviso: string | null = null
  if (!base.some((b) => b.e.estado === 'abierto')) aviso = 'Ahora mismo no hay nada abierto con horario confirmado. Estos abren más tarde o no tienen horario: llama antes.'
  if (porPersona != null) {
    const dentro = elegibles.filter((b) => { const r = b.p.price_level ? RANGO_NIVEL[b.p.price_level] : null; return !r || r[0] <= porPersona })
    if (!dentro.length && elegibles.length) {
      return { opciones: [], aviso: `Con $${x.g} para ${x.p} (unos $${Math.floor(porPersona)} por persona) no alcanza para nada de lo que está abierto. Sube el presupuesto o baja las personas.` }
    }
    elegibles = dentro
  }
  const opciones = elegibles
    .map((b) => {
      const g = x.t && x.t !== 'sorprendeme' ? coincideGanas(b.p, x.t) : false
      const im = x.q ? coincideImporta(b.p, x.q) : false
      return { b, g, im, score: (g ? 2 : 0) + (im ? 2 : 0) + (b.e.estado === 'abierto' ? 1 : b.e.estado === 'abre-hoy' ? -0.5 : 0) }
    })
    .sort((a, c) => sinPromo(a.b.p) - sinPromo(c.b.p) || c.score - a.score || (Number(c.b.p.google_rating) || 0) - (Number(a.b.p.google_rating) || 0) || (c.b.p.google_review_count || 0) - (a.b.p.google_review_count || 0))
    .slice(0, 3)
    .map(({ b, g, im }) => ({ place: b.p, estado: b.e, g, im, motivo: motivo(b.p, b.e, g, im, x), cuenta: x.p ? cuentaCompleta(b.p, x.p) : null }))
  if (x.t && x.t !== 'sorprendeme' && opciones.length && !opciones.some((o) => o.g)) {
    aviso = aviso || 'Ninguno de los que abren hoy dice que sirva eso. Estas son las mejor calificadas: llama y confirma.'
  }
  return { opciones, aviso }
}

function motivo(p: any, e: EstadoHorario, g: boolean, im: boolean, x: Params): string {
  const partes: string[] = []
  if (g && x.t) partes.push(GANAS[x.t]?.label || 'Restaurante')
  else partes.push(p.subcategory && /^[A-Za-zÁÉÍÓÚáéíóúñÑ ]+$/.test(p.subcategory) ? p.subcategory.charAt(0).toUpperCase() + p.subcategory.slice(1) : 'Restaurante')
  if (im && x.q) partes.push(IMPORTA[x.q].label)
  return `${partes.join(' ')}, ${e.corto}`
}

function pasaFiltros(p: any, f: Filtros, e: EstadoHorario, dia: number): boolean {
  const tags = tagsDe(p)
  if (f.abierto && e.estado !== 'abierto') return false
  if (f.ostiones && !tags.includes('ostiones')) return false
  if (f.ninos && !tags.includes('con-ninos') && !coincideImporta(p, 'familiar')) return false
  if (f.atardecer && !tags.includes('atardecer') && !coincideImporta(p, 'vista')) return false
  if (f.domingo && !abreEseDia(p, 0)) return false
  return true
}
const ORDEN_ESTADO: Record<Estado, number> = { abierto: 0, 'abre-hoy': 1, cerrado: 2, 'sin-horario': 3 }

function tramosMapa(places: any[], max = 5) {
  const conCoord = places.filter((p) => p.lat != null && p.lon != null && p.amenities?.km_102 != null)
    .sort((a, b) => Number(a.amenities.km_102) - Number(b.amenities.km_102))
  const out: { desde: number; hasta: number; url: string }[] = []
  for (let i = 0; i < conCoord.length; i += max) {
    const tramo = conCoord.slice(i, i + max)
    if (tramo.length < 2 && out.length) continue
    out.push({ desde: i + 1, hasta: i + tramo.length, url: 'https://www.google.com/maps/dir/' + tramo.map((p) => `${p.lat},${p.lon}`).join('/') })
  }
  return out
}

// ---------- Página ----------
const COLS = 'id,name,slug,category,subcategory,phone,address,barrio,municipality,google_rating,google_review_count,status,tags,opening_hours,lat,lon,last_verified_at,website,gmaps_url,price_level,amenities,contact_info,description,one_liner,vibe'

function qs(base: Record<string, any>, extra: Record<string, any>): string {
  const m: Record<string, string> = {}
  for (const [k, v] of Object.entries({ ...base, ...extra })) if (v != null && v !== '' && v !== false) m[k] = String(v)
  const s = new URLSearchParams(m).toString()
  return s ? `?${s}` : ''
}

export async function handleDondeComerHoy(req: any, res: any, deps: Deps, opts: { zonaFija?: string } = {}) {
  const { layout, escapeHtml: esc, supabase } = deps
  const qy = req.query || {}
  const RECORD = opts.zonaFija === 'joyuda' ? '/ruta-joyuda' : '/donde-comer-hoy'
  const PATH = RECORD
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // 5 min: "abierto ahora" no puede quedarse viejo una hora.
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=120')

  let todos: any[] = []
  let falla = false
  try {
    const { data, error } = await supabase.from('places').select(COLS)
      .eq('category', 'FOOD').ilike('municipality', 'cabo rojo')
      .eq('status', 'open').eq('visibility', 'published').or('quality_tier.is.null,quality_tier.neq.hidden')
      .order('google_review_count', { ascending: false, nullsFirst: false }).limit(600)
    if (error) falla = true
    todos = data || []
  } catch { falla = true }

  const ahora = new Date()
  const { day: hoyDia } = ahoraPR(ahora)
  const x = leerParams(qy, opts.zonaFija)
  const f = leerFiltros(qy)
  const enZona = x.zona ? todos.filter((p) => zonaDe(p) === x.zona) : todos
  // Joyuda: la Ruta (tag) manda; los que la regla de zona añade van también, es la misma milla.
  const places = enZona
  const filas = places.map((p) => ({ p, e: estadoHorario(p, ahora) }))
  const abiertos = filas.filter((r) => r.e.estado === 'abierto').length
  const abiertosCR = todos.filter((p) => estadoHorario(p, ahora).estado === 'abierto').length
  const conHorario = filas.filter((r) => r.e.estado !== 'sin-horario').length
  const n = places.length
  const zonaLabel = x.zona ? ZONAS[x.zona].label : 'Cabo Rojo'
  const enDonde = x.zona ? `en ${ZONAS[x.zona].label}` : 'en Cabo Rojo'
  const reloj = new Intl.DateTimeFormat('es-PR', { weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Puerto_Rico' }).format(ahora).replace(/\s?a\.\s?m\./i, ' AM').replace(/\s?p\.\s?m\./i, ' PM')
  const hace90 = Date.now() - 90 * 86400_000
  const corroborados90 = places.filter((p) => { const v = verificadoEn(p); return v && v.getTime() > hace90 }).length

  const base: Record<string, any> = { zona: opts.zonaFija ? undefined : x.zona, p: x.p, g: x.g, t: x.t, q: x.q }
  const rec = hayRespuestas(x) ? recomendar(places, x, ahora) : null
  const lista = filas
    .filter((r) => pasaFiltros(r.p, f, r.e, hoyDia))
    .sort((a, b) => ORDEN_ESTADO[a.e.estado] - ORDEN_ESTADO[b.e.estado] || sinPromo(a.p) - sinPromo(b.p) || (b.p.google_review_count || 0) - (a.p.google_review_count || 0))

  // ----- piezas -----
  const BTN = 'inline-flex items-center justify-center gap-2 rounded-full px-5 font-bold no-underline'
  const BTN_ST = 'min-height:48px;font-size:17px;'
  const btnP = `${BTN} text-white" style="${BTN_ST}background:#0f766e;`
  const btnS = `${BTN} bg-white" style="${BTN_ST}border:2px solid #0f766e;color:#0f766e;`

  const chip = (href: string, activo: boolean, label: string) =>
    `<a href="${esc(href)}" ${activo ? 'aria-current="true"' : ''} class="inline-flex items-center justify-center rounded-full px-4 font-bold no-underline" style="min-height:48px;min-width:48px;font-size:17px;border:2px solid #0f766e;${activo ? 'background:#0f766e;color:#fff;' : 'background:#fff;color:#0f766e;'}">${esc(label)}</a>`

  const estadoPill = (e: EstadoHorario) => {
    const c = e.estado === 'abierto' ? 'background:#dcfce7;color:#14532d;' : e.estado === 'sin-horario' ? 'background:#f5f5f4;color:#44403c;' : 'background:#ffedd5;color:#9a3412;'
    return `<span class="inline-block rounded-md px-2 py-1 font-bold" style="font-size:16px;${c}">${esc(e.texto)}</span>`
  }

  const datos = (p: any) => {
    const v = verificadoEn(p)
    const partes: string[] = []
    partes.push(p.price_level ? `<strong>${esc(p.price_level)}</strong>` : 'Precio: llama antes')
    if (p.google_rating) partes.push(`★ ${Number(p.google_rating).toFixed(1)}${p.google_review_count ? ` (${p.google_review_count})` : ''}`)
    if (p.amenities?.km_102 != null) partes.push(`km ${esc(String(p.amenities.km_102))} de la 102`)
    partes.push(v ? `Corroborado ${mesAnio(v)}` : 'Sin corroborar, llama antes')
    return `<p style="font-size:16px;color:#57534e;margin:0">${partes.join(' · ')}</p>`
  }

  const botones = (p: any) => {
    const tel = telDigitos(p.phone)
    const dir = comoLlegar(p)
    const rec = `/negocio/${p.slug}`
    const fav = `<button type="button" class="${BTN} bg-white" style="${BTN_ST}border:2px solid #d6d3d1;color:#44403c;" data-fav="${esc(p.slug)}" data-nombre="${esc(p.name)}" data-tel="${tel || ''}" aria-pressed="false">☆ Guardar</button>`
    return `<div class="flex flex-wrap gap-2 mt-2">
${tel ? `<a href="tel:+1${tel}" class="${btnP}">📞 Llamar ${telVisible(p.phone)}</a>` : `<span class="inline-flex items-center" style="min-height:48px;font-size:16px;color:#57534e">Sin teléfono publicado</span>`}
${dir ? `<a href="${esc(dir)}" target="_blank" rel="noopener noreferrer" class="${btnS}" data-ev="directions_click" data-record="${esc(rec)}">📍 Cómo llegar</a>` : ''}
${p.website ? `<a href="${esc(p.website)}" target="_blank" rel="noopener noreferrer" class="${btnS}" data-ev="menu_click" data-record="${esc(rec)}">Menú o página</a>` : ''}
${fav}
</div>`
  }

  const tarjeta = (p: any, e: EstadoHorario, extra = '', num?: number) => `
<li class="rounded-2xl p-4" style="background:#fff;border:1px solid #e7e5e4;list-style:none">
  <h3 style="font-family:Fraunces,Georgia,serif;font-size:21px;font-weight:800;margin:0;color:#1c1917">${num ? `${num}. ` : ''}<a href="/negocio/${esc(p.slug)}" style="color:#0f766e;text-decoration:underline">${esc(p.name)}</a></h3>
  ${extra}
  <div class="mt-2">${estadoPill(e)}</div>
  <div class="mt-2">${datos(p)}</div>
  ${botones(p)}
</li>`

  // ----- las 3 opciones -----
  let tres = ''
  if (rec) {
    const url = `${SITE_URL}${PATH}${qs(base, {})}`
    const lineas = rec.opciones.map((o, i) => { const t = telDigitos(o.place.phone); return `${i + 1}. ${o.place.name}${t ? ' ' + telVisible(o.place.phone) : ''} (${o.estado.corto})` })
    const wa = `https://wa.me/?text=${encodeURIComponent(`¿Dónde comemos hoy ${enDonde}? Mis 3 opciones:\n${lineas.join('\n')}\n${url}`)}`
    const resumen = rec.opciones.map((o) => o.place.name).join(' · ')
    const items = rec.opciones.map((o, i) => {
      let cuentaHtml = ''
      if (x.p) {
        cuentaHtml = o.cuenta
          ? `<div class="mt-2" style="font-size:16px;color:#1c1917"><p style="margin:0;font-weight:700">La cuenta completa para ${x.p}:</p>
<table style="width:100%;border-collapse:collapse;margin-top:4px;font-size:16px">${o.cuenta.renglones.map((r) => `<tr><td style="padding:2px 0;border:0">${esc(r.texto)}</td><td style="padding:2px 0;border:0;text-align:right">$${r.monto.toFixed(2)}</td></tr>`).join('')}
<tr><td style="padding:4px 0 0;border:0;border-top:1px solid #a8a29e;font-weight:700">Total</td><td style="padding:4px 0 0;border:0;border-top:1px solid #a8a29e;text-align:right;font-weight:700">$${o.cuenta.total.toFixed(2)}</td></tr></table>
<p style="margin:4px 0 0">Con: ${esc(o.cuenta.platos)}.</p></div>`
          : `<p class="mt-2" style="font-size:16px;color:#57534e;margin:0">${o.place.price_level ? `Nivel ${esc(o.place.price_level)}. Llama antes para saber el precio.` : 'Llama antes para saber el precio.'}</p>`
      }
      return tarjeta(o.place, o.estado, `<p style="font-size:17px;margin:6px 0 0;color:#1c1917">${esc(o.motivo)}</p>${cuentaHtml}`, i + 1)
    }).join('')
    tres = `
<section aria-labelledby="tres" class="not-prose mt-6 rounded-2xl p-4" style="background:#f0fdfa;border:2px solid #0f766e" data-vista="${esc(rec.opciones.map((o) => o.place.slug).join(',').slice(0, 190))}">
  <h2 id="tres" style="font-family:Fraunces,Georgia,serif;font-size:26px;font-weight:800;margin:0;color:#1c1917">Tus 3 opciones</h2>
  ${rec.aviso ? `<p style="font-size:17px;font-weight:600;color:#9a3412;margin:8px 0 0">${esc(rec.aviso)}</p>` : ''}
  ${!rec.opciones.length && !rec.aviso ? `<p style="font-size:17px;margin:8px 0 0">Ahora no hay nada abierto que cuadre. Mira la lista completa abajo o textéale al Veci.</p>` : ''}
  <ol class="mt-3 space-y-3" style="padding:0;margin:12px 0 0">${items}</ol>
  ${rec.opciones.length ? `<div class="mt-4 flex flex-wrap gap-2">
    <a href="${esc(wa)}" target="_blank" rel="noopener noreferrer" class="${BTN} text-white" style="${BTN_ST}background:#166534;">Mándalas por WhatsApp</a>
    <button type="button" class="${BTN} bg-white" style="${BTN_ST}border:2px solid #0f766e;color:#0f766e;" data-guardar3="${esc(`${PATH}${qs(base, {})}`)}" data-resumen="${esc(resumen)}">Guardar estas 3</button>
  </div>` : ''}
  <p style="font-size:16px;color:#57534e;margin:12px 0 0">El presupuesto se calcula por nivel de precio, y es un estimado: $ son unos $15 a $25 por persona, $$ unos $25 a $45. La cuenta completa (con IVU 11.5% y propina 15%) solo sale cuando el restaurante tiene platos con precio y de dónde salió el precio.</p>
  <a href="${PATH}${opts.zonaFija ? '' : qs({ zona: x.zona }, {})}" class="inline-flex items-center" style="min-height:48px;font-size:17px;font-weight:600;color:#0f766e;text-decoration:underline">Empezar de nuevo</a>
</section>`
  }

  // ----- preguntas -----
  const fs = (titulo: string, chips: string) => `<fieldset style="border:0;padding:0;margin:16px 0 0"><legend style="font-size:18px;font-weight:700;color:#1c1917">${titulo}</legend><div class="flex flex-wrap gap-2 mt-2">${chips}</div></fieldset>`
  const zonaChips = opts.zonaFija
    ? `${chip(PATH, true, '🦞 Joyuda')}${Object.entries(ZONAS).filter(([k]) => k !== 'joyuda').map(([k, z]) => chip(`/donde-comer-hoy${qs({ ...base, zona: k }, {})}`, false, `${z.emoji} ${z.label}`)).join('')}${chip(`/donde-comer-hoy${qs({ ...base, zona: undefined }, {})}`, false, 'Donde sea')}`
    : Object.entries(ZONAS).map(([k, z]) => chip(k === 'joyuda' ? `/ruta-joyuda${qs({ ...base, zona: undefined }, {})}` : qs(base, { zona: k }) || PATH, x.zona === k, `${z.emoji} ${z.label}`)).join('') + chip(`${PATH}${qs(base, { zona: null })}`, !x.zona, 'Donde sea')
  const preguntas = `
<section aria-labelledby="donde" class="not-prose mt-6 rounded-2xl p-4" style="background:#fff;border:1px solid #e7e5e4">
  <h2 id="donde" style="font-family:Fraunces,Georgia,serif;font-size:26px;font-weight:800;margin:0;color:#1c1917">¿Dónde comemos hoy?</h2>
  <p style="font-size:17px;color:#57534e;margin:6px 0 0">Toca lo que aplica y te damos 3 opciones abiertas ahora, con teléfono.</p>
  ${fs('¿Por dónde?', zonaChips)}
  ${fs('¿Cuántos son?', [1, 2, 4, 6, 8].map((v) => chip(qs(base, { p: v }) || PATH, x.p === v, String(v))).join(''))}
  ${fs('¿Cuánto quieren gastar en total?', [20, 40, 60, 100, 150].map((v) => chip(qs(base, { g: v }) || PATH, x.g === v, `$${v}`)).join(''))}
  ${fs('¿Qué se les antoja?', [...Object.entries(GANAS).map(([k, g]) => [k, g.chip]), ['sorprendeme', 'Sorpréndeme']].map(([k, l]) => chip(qs(base, { t: k }) || PATH, x.t === k, l)).join(''))}
  ${fs('¿Qué es lo que más importa?', Object.entries(IMPORTA).map(([k, i]) => chip(qs(base, { q: k }) || PATH, x.q === k, i.chip)).join(''))}
  <div id="mis-guardados" class="mt-4" hidden></div>
</section>`

  // ----- filtros + lista -----
  const filtrosDef: [keyof Filtros, string][] = [['abierto', 'Abiertos ahora'], ['domingo', 'Abren los domingos'], ['ninos', 'Con niños'], ['atardecer', 'Vista o atardecer'], ...(x.zona === 'joyuda' ? [['ostiones', 'Ostiones'] as [keyof Filtros, string]] : [])]
  const activos = Object.fromEntries((Object.keys(f) as (keyof Filtros)[]).filter((k) => f[k]).map((k) => [k, 1]))
  const filtrosHtml = filtrosDef.map(([k, l]) => chip(qs(base, { ...activos, [k]: f[k] ? null : 1 }) || PATH, Boolean(f[k]), l)).join('')
    + (Object.values(f).some(Boolean) ? `<a href="${PATH}${qs(base, {})}" class="inline-flex items-center px-2" style="min-height:48px;font-size:17px;font-weight:600;color:#0f766e;text-decoration:underline">Quitar filtros</a>` : '')
  const listaHtml = lista.length
    ? `<ul class="mt-3 space-y-3" style="padding:0;margin:12px 0 0">${lista.map((r) => tarjeta(r.p, r.e)).join('')}</ul>`
    : `<p style="font-size:17px;margin:8px 0 0">${falla ? `No pudimos cargar la lista. Intenta de nuevo en un rato o textea COMER al ${VECI_TEL}.` : n ? 'Ninguno cumple esos filtros ahora. Quita uno.' : 'Todavía no tenemos restaurantes en esta zona.'}</p>`

  const tramos = x.zona === 'joyuda' ? tramosMapa(places) : []

  // ----- FAQ con datos de la consulta -----
  const nombres = (ps: any[], max = 8) => { const v = ps.slice(0, max).map((p) => p.name); return v.join(', ') + (ps.length > max ? ` y ${ps.length - max} más` : '') }
  const conPromo = (ps: any[]) => [...ps].sort((a, b) => sinPromo(a) - sinPromo(b))
  const domingo = conPromo(places.filter((p) => abreEseDia(p, 0)))
  const lunes = conPromo(places.filter((p) => abreEseDia(p, 1)))
  const nivel = (l: string) => places.filter((p) => p.price_level === l).length
  const faq: { q: string; a: string }[] = [
    { q: `¿Qué restaurantes abren los domingos ${enDonde}?`, a: domingo.length ? `Según el horario que tenemos guardado, ${domingo.length} de los ${n} abren los domingos: ${nombres(domingo)}. Llama antes, que el horario cambia.` : `Todavía no tenemos horario de domingo confirmado aquí. Llama antes o textea COMER al ${VECI_TEL}.` },
    { q: `¿Qué está abierto un lunes ${enDonde}?`, a: lunes.length ? `El lunes muchos cierran. Abren ${lunes.length}: ${nombres(lunes)}.` : `No tenemos ninguno con horario de lunes confirmado aquí. Textea COMER al ${VECI_TEL}.` },
    { q: `¿Cuánto cuesta comer ${enDonde}?`, a: `De los ${n}, ${nivel('$')} son de nivel $ (unos $15 a $25 por persona) y ${nivel('$$')} de nivel $$ (unos $25 a $45). Es un estimado por nivel de precio, no un menú: llama antes.` },
    { q: '¿De dónde salen estos datos?', a: `De la ficha de cada negocio en el Mapa de Cabo Rojo. ${corroborados90} de los ${n} se corroboraron en los últimos 90 días y cada ficha dice cuándo. Si llamas y el número está malo, la hoja "¿Te contestaron?" lo anota y la ficha se corrige.` },
  ]
  if (x.zona === 'joyuda') {
    const ost = conPromo(places.filter((p) => tagsDe(p).includes('ostiones')))
    faq.splice(2, 0, { q: '¿Dónde comer ostiones en Joyuda?', a: ost.length ? `Marcados con ostiones: ${nombres(ost)}.` : `Todavía no tenemos restaurantes marcados con ostiones. Textea JOYUDA al ${VECI_TEL} o llama a los de mariscos antes de ir.` })
  }

  // ----- JSON-LD -----
  const diasEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemList',
        name: `Restaurantes ${enDonde}, con teléfono y horario`,
        numberOfItems: n,
        itemListElement: conPromo(places).slice(0, 60).map((p, i) => {
          const r: any = {
            '@type': 'Restaurant', name: p.name, url: `${SITE_URL}/negocio/${p.slug}`,
            address: { '@type': 'PostalAddress', ...(p.address ? { streetAddress: p.address } : {}), addressLocality: 'Cabo Rojo', addressRegion: 'PR', addressCountry: 'US' },
          }
          if (p.phone) r.telephone = p.phone
          if (p.lat != null && p.lon != null) r.geo = { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lon }
          if (p.price_level) r.priceRange = p.price_level
          const st = (p.opening_hours?.structured || []).filter((d: any) => !d.isClosed && d.open && d.close)
          if (st.length) r.openingHoursSpecification = st.map((d: any) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: diasEn[d.day], opens: d.open, closes: d.close }))
          return { '@type': 'ListItem', position: i + 1, item: r }
        }),
      },
      { '@type': 'FAQPage', mainEntity: faq.map((q) => ({ '@type': 'Question', name: q.q, acceptedAnswer: { '@type': 'Answer', text: q.a } })) },
    ],
  }

  const esJoyuda = x.zona === 'joyuda'
  const h1 = esJoyuda ? 'Ruta Joyuda: dónde comer hoy, con teléfono y horario' : x.zona ? `Dónde comer hoy en ${zonaLabel}` : '¿Dónde comemos hoy en Cabo Rojo?'
  const veciKw = esJoyuda ? 'JOYUDA' : 'COMER'
  const veciUrl = `https://wa.me/17874177711?text=${veciKw}`

  const body = `
<h1>${esc(h1)}</h1>
<div class="not-prose rounded-2xl p-4 mt-3" style="background:#fff7ed;border:1px solid #fed7aa">
  <p style="font-size:19px;font-weight:700;margin:0;color:#1c1917">Ahora mismo, ${esc(reloj.replace(',', ''))}: <span style="color:#14532d">${abiertos} abiertos</span> ${esc(enDonde)}${x.zona ? ` (${abiertosCR} en todo Cabo Rojo)` : ''}.</p>
  <p style="font-size:16px;color:#57534e;margin:6px 0 0">${n} restaurantes, ${conHorario} con horario guardado. ${corroborados90} corroborados en los últimos 90 días. Lo que no tiene horario dice "llama antes", nunca "abierto".</p>
  <div class="mt-3"><a href="${PATH}${qs(base, { abierto: 1 })}#lista" class="${btnP}">Ver solo los abiertos ahora</a></div>
</div>
${preguntas}
${tres}
<section aria-labelledby="lista" id="lista" class="not-prose mt-8">
  <h2 id="lista-t" style="font-family:Fraunces,Georgia,serif;font-size:26px;font-weight:800;margin:0;color:#1c1917">Todos ${esc(enDonde)} (${lista.length})</h2>
  <p style="font-size:16px;color:#57534e;margin:6px 0 0">Los abiertos primero. Toca un filtro y la lista se ajusta.</p>
  <div class="flex flex-wrap gap-2 mt-3">${filtrosHtml}</div>
  ${listaHtml}
</section>
${tramos.length ? `<section class="not-prose mt-8"><h2 style="font-family:Fraunces,Georgia,serif;font-size:24px;font-weight:800;margin:0">La ruta en el mapa</h2><p style="font-size:16px;color:#57534e;margin:6px 0 0">Por el kilómetro de la carretera 102, de 5 en 5 paradas.</p><div class="flex flex-wrap gap-2 mt-2">${tramos.map((t) => `<a href="${esc(t.url)}" target="_blank" rel="noopener noreferrer" class="${btnS}" data-ev="directions_click" data-record="${RECORD}">🗺️ Paradas ${t.desde} a ${t.hasta}</a>`).join('')}</div></section>` : ''}
<section class="not-prose mt-8 rounded-2xl p-5 text-white" style="background:#0f766e">
  <h2 style="font-family:Fraunces,Georgia,serif;font-size:24px;font-weight:800;margin:0;color:#fff">¿En la carretera y sin datos? Textea al Veci</h2>
  <p style="font-size:17px;margin:6px 0 0">Textea ${veciKw} al ${VECI_TEL} y te contesta lo que está abierto, con teléfono.</p>
  <a href="${veciUrl}" target="_blank" rel="noopener noreferrer" class="${BTN} mt-3 bg-white" style="${BTN_ST}color:#0f766e;">Textear ${veciKw} al ${VECI_TEL}</a>
  <p style="font-size:17px;margin:16px 0 0">¿Un dato malo o falta un sitio? Textea CORRIGE y el nombre del lugar.</p>
  <a href="https://wa.me/17874177711?text=CORRIGE%20" target="_blank" rel="noopener noreferrer" class="${BTN} mt-2" style="${BTN_ST}border:2px solid #fff;color:#fff;">Textear CORRIGE</a>
</section>
<section class="not-prose mt-8">
  <h2 style="font-family:Fraunces,Georgia,serif;font-size:24px;font-weight:800;margin:0">Preguntas que nos hacen</h2>
  <dl style="margin:8px 0 0">${faq.map((q) => `<dt style="font-size:18px;font-weight:700;margin-top:14px">${esc(q.q)}</dt><dd style="font-size:17px;color:#44403c;margin:4px 0 0">${esc(q.a)}</dd>`).join('')}</dl>
  <p style="font-size:16px;color:#57534e;margin:16px 0 0">Más: <a href="/categoria/restaurantes" style="color:#0f766e;text-decoration:underline">todos los restaurantes por tipo</a> · <a href="/categoria/mariscos" style="color:#0f766e;text-decoration:underline">mariscos</a> · <a href="/barrios" style="color:#0f766e;text-decoration:underline">los barrios</a>.</p>
</section>
<script>
(function(){
  var V='';try{V=localStorage.getItem('rg_vid')||'';}catch(e){}
  function L(ev,r,t){try{fetch('/api/mapa-pages?page=registro-log',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({event:ev,record:(r||location.pathname).slice(0,120),target:(t||'').slice(0,200),referrer:document.referrer||'',vid:V})});}catch(e){}}
  var tres=document.querySelector('[data-vista]');
  if(tres&&tres.getAttribute('data-vista')){L('recommendation_view',${JSON.stringify(RECORD)},tres.getAttribute('data-vista')+'|'+location.search.slice(0,100));}
  document.addEventListener('click',function(e){var a=e.target.closest?e.target.closest('a[data-ev]'):null;if(a){L(a.getAttribute('data-ev'),a.getAttribute('data-record'),a.getAttribute('href'));try{gtag('event',a.getAttribute('data-ev'),{record:a.getAttribute('data-record')});}catch(x){}}},true);
  var K='mc_guardados';
  function lee(){try{return JSON.parse(localStorage.getItem(K)||'{}')||{};}catch(e){return {};}}
  function escr(o){try{localStorage.setItem(K,JSON.stringify(o));return true;}catch(e){return false;}}
  function esc(s){return String(s||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function pinta(){
    var o=lee(),box=document.getElementById('mis-guardados');if(!box)return;
    var favs=o.favs||{},ks=Object.keys(favs),h='';
    if(o.tres)h+='<p style="font-size:17px;margin:0"><strong>Tus 3 guardadas:</strong> '+esc(o.tres.resumen)+' <a href="'+esc(o.tres.url)+'" style="color:#0f766e;font-weight:700;text-decoration:underline">Abrir</a></p>';
    if(ks.length){h+='<p style="font-size:17px;font-weight:700;margin:10px 0 4px">Tus guardados</p><ul style="padding:0;margin:0;list-style:none">';ks.forEach(function(s){var f=favs[s];h+='<li style="font-size:17px;margin:6px 0"><a href="/negocio/'+esc(s)+'" style="color:#0f766e;text-decoration:underline">'+esc(f.n)+'</a>'+(f.t?' · <a href="tel:+1'+esc(f.t)+'" style="color:#0f766e;font-weight:700">Llamar</a>':'')+'</li>';});h+='</ul>';}
    box.innerHTML=h;box.hidden=!h;
    document.querySelectorAll('[data-fav]').forEach(function(b){var on=!!favs[b.getAttribute('data-fav')];b.setAttribute('aria-pressed',on?'true':'false');b.textContent=on?'★ Guardado':'☆ Guardar';});
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest?e.target.closest('[data-fav]'):null;
    if(b){var o=lee();o.favs=o.favs||{};var s=b.getAttribute('data-fav');if(o.favs[s])delete o.favs[s];else o.favs[s]={n:b.getAttribute('data-nombre'),t:b.getAttribute('data-tel')};if(!escr(o)){b.textContent='No se pudo guardar';return;}pinta();return;}
    var g=e.target.closest?e.target.closest('[data-guardar3]'):null;
    if(g){var o2=lee();o2.tres={url:g.getAttribute('data-guardar3'),resumen:g.getAttribute('data-resumen')};g.textContent=escr(o2)?'Guardadas en este teléfono':'No se pudo guardar';pinta();}
  });
  pinta();
})();
</script>`

  const titulo = esJoyuda
    ? `Ruta Joyuda: qué está abierto hoy, ${n} restaurantes con teléfono`
    : x.zona ? `Dónde comer hoy en ${zonaLabel}, Cabo Rojo: abiertos ahora` : `Dónde comer hoy en Cabo Rojo: ${n} restaurantes, qué está abierto`
  const desc = esJoyuda
    ? `Qué está abierto ahora en Joyuda, Cabo Rojo: ${n} restaurantes con teléfono, horario, precio y cómo llegar. Dinos cuántos son y qué les antoja y te damos 3 opciones.`
    : `Qué está abierto ahora ${enDonde}: ${n} restaurantes con teléfono, horario y cómo llegar. 5 toques y te damos 3 opciones abiertas.`
  const filtrada = Object.keys(qy).some((k) => !['page'].includes(k) && !(k === 'zona' && !opts.zonaFija))
  if (filtrada) res.setHeader('X-Robots-Tag', 'noindex, follow')
  res.status(200).send(layout({
    title: titulo,
    description: desc,
    slug: PATH.slice(1),
    canonicalUrl: x.zona === 'joyuda' ? `${SITE_URL}/ruta-joyuda` : x.zona ? `${SITE_URL}/donde-comer-hoy?zona=${x.zona}` : `${SITE_URL}${PATH}`,
    bodyHtml: body,
    jsonLd,
    bareTitle: true,
  }))
}
