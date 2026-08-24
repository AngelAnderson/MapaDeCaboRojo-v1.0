/**
 * LA SEÑAL — agregador único de demanda pública. (EL SALTO v2 · 2026-08-19,
 * fuente actualizada a demand_signals_humano · 2026-08-23)
 *
 * Una sola fuente: demand_signals_humano (se para encima de demand_signals_real
 * y además quita el arnés del canal web — scripts/veci-smoke.mjs pegaba sin
 * bandera de prueba y contaminaba el 50%+ de la demanda "real" del canal web,
 * ver CLAUDE.md § Regla 2026-08-23). demand_signals_real quedó DEPRECATED pa'
 * reportes públicos. Aquí NO se lee mv_top_searches_30d ni demand_weekly:
 * mv_top_searches_30d demostró estar contaminada con data de test
 * ("afinador de clavicordios" x14) y fue lo que mató la página vieja
 * /senales-del-pueblo. Un solo pozo, y el pozo limpio.
 *
 * CONTRATO DEL MOLDE (lo que este módulo NUNCA devuelve):
 *   - texto crudo de mensajes de vecinos (solo la columna category)
 *   - user_hash, teléfonos, nombres de personas
 *   - categorías con menos de MIN_N búsquedas en 28 días
 *   - números inventados: si la fuente falla, devuelve null y el que
 *     llama enseña su estado honesto (nunca un cero disfrazado de dato)
 *
 * Kill switch: INSERT INTO app_config(key,value) VALUES ('la_senal','off')
 *   ON CONFLICT (key) DO UPDATE SET value='off';
 * (la página cae a "descansando" y el cron escribe recibo de apagada)
 */

export const SENAL_MIN_N = 3
const DIAS_VENTANA = 84 // 12 semanas: 28d para la tabla + 12 sem para tendencia

// Cubetas genéricas del clasificador que no significan nada pa' un vecino.
const CATS_OCULTAS = new Set(['other', 'service', 'general', 'unknown', 'otro', 'otros'])

export interface SenalCategoria {
  nombre: string        // display (la variante más frecuente tal cual vino)
  n28: number
  n7: number
  sinRespuesta28: number
  personas28: number     // vecinos DISTINTOS (user_hash) en 28 días — no "veces"
  semanas: Array<{ semana: string; n: number }>  // hasta 12 puntos, ascendente
}

export interface Senal {
  off: boolean
  total28: number
  total7: number
  conRespuesta28: number
  personasTotal28: number        // vecinos distintos, todas las categorías, 28 días
  categorias: SenalCategoria[]   // solo n28 >= SENAL_MIN_N, orden n28 desc
  huecos: SenalCategoria[]       // n28 >= MIN_N y >=50% sin respuesta, orden n28 desc
  huecosSemana: SenalCategoria[] // huecos ordenados por n7 (esta semana), top 5
  generadoEl: string             // YYYY-MM-DD (AT)
}

export function normCat(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

function fechaAT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' })
}

/** Lee el kill switch. Ante error responde 'on' (la data decide, no el error). */
export async function senalApagada(sb: any): Promise<boolean> {
  try {
    const { data } = await sb.from('app_config').select('value').eq('key', 'la_senal').maybeSingle()
    return String(data?.value || '').toLowerCase() === 'off'
  } catch { return false }
}

/**
 * Carga y agrega la señal. Devuelve null si la fuente falla o viene vacía
 * (84 días sin UNA señal real = pipeline roto, no "demanda cero").
 */
export async function cargarSenal(sb: any): Promise<Senal | null> {
  if (await senalApagada(sb)) {
    return { off: true, total28: 0, total7: 0, conRespuesta28: 0, personasTotal28: 0, categorias: [], huecos: [], huecosSemana: [], generadoEl: fechaAT() }
  }

  const desde = new Date(Date.now() - DIAS_VENTANA * 86400000).toISOString()
  const filas: Array<{ category: string | null; matched: boolean; created_at: string; user_hash: string | null }> = []
  try {
    // Pagina por si la ventana crece más allá del cap de PostgREST.
    const PAGE = 1000
    for (let page = 0; page < 10; page++) {
      const { data, error } = await sb
        .from('demand_signals_humano')
        .select('category,matched,created_at,user_hash')
        .gte('created_at', desde)
        .order('created_at', { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1)
      if (error) return null
      filas.push(...(data || []))
      if (!data || data.length < PAGE) break
    }
  } catch { return null }
  if (filas.length === 0) return null

  const corte7 = Date.now() - 7 * 86400000
  const corte28 = Date.now() - 28 * 86400000

  type Acc = { display: Record<string, number>; n28: number; n7: number; sin28: number; semanas: Record<string, number>; personas28: Set<string> }
  const acc: Record<string, Acc> = {}
  let total28 = 0, total7 = 0, conRespuesta28 = 0
  const personasTotalSet = new Set<string>()

  for (const f of filas) {
    const raw = String(f.category || '').trim()
    const key = normCat(raw)
    if (!key || CATS_OCULTAS.has(key)) continue
    const t = Date.parse(f.created_at)
    if (!acc[key]) acc[key] = { display: {}, n28: 0, n7: 0, sin28: 0, semanas: {}, personas28: new Set() }
    const a = acc[key]
    a.display[raw] = (a.display[raw] || 0) + 1
    // semana ISO-ish: lunes de esa semana (AT aproximado con UTC es suficiente pa' tendencia)
    const d = new Date(t)
    const lunes = new Date(d)
    lunes.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
    const wk = lunes.toISOString().slice(0, 10)
    a.semanas[wk] = (a.semanas[wk] || 0) + 1
    if (t >= corte28) {
      a.n28++; total28++
      if (f.user_hash) { a.personas28.add(f.user_hash); personasTotalSet.add(f.user_hash) }
      if (f.matched) conRespuesta28++
      else a.sin28++
      if (t >= corte7) { a.n7++; total7++ }
    }
  }

  const categorias: SenalCategoria[] = Object.values(acc)
    .filter(a => a.n28 >= SENAL_MIN_N)
    .map(a => ({
      nombre: Object.entries(a.display).sort((x, y) => y[1] - x[1])[0][0],
      n28: a.n28,
      n7: a.n7,
      sinRespuesta28: a.sin28,
      personas28: a.personas28.size || a.n28, // fallback: si no hay hash, usamos n28 (nunca infla)
      semanas: Object.entries(a.semanas).sort((x, y) => x[0] < y[0] ? -1 : 1).map(([semana, n]) => ({ semana, n })),
    }))
    .sort((x, y) => y.n28 - x.n28)

  const huecos = categorias.filter(c => c.sinRespuesta28 / c.n28 >= 0.5)
  const huecosSemana = huecos.filter(c => c.n7 > 0).sort((x, y) => y.n7 - x.n7).slice(0, 5)

  return { off: false, total28, total7, conRespuesta28, personasTotal28: personasTotalSet.size || total28, categorias, huecos, huecosSemana, generadoEl: fechaAT() }
}
