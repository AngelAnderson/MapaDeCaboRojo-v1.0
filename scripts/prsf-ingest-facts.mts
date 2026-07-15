// Puebla prsf_facts (RAG del buscador PRSF) desde las fuentes canon del monolito:
// datos citables (/comparte) + contradicciones + citas de video (/transicion) + índice de páginas.
// Idempotente por content_hash. Embeddings: OpenAI text-embedding-3-small a 768 dims (canon del stack).
// Uso: source /tmp/prsf-env (o env con OPENAI_API_KEY + SUPABASE_SERVICE_ROLE_KEY) && npx tsx scripts/prsf-ingest-facts.mts
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { citableFacts, CONTRA_PARES, TRANSICION_BLOQUES, BUSCAR_INDEX } from '../api/mapa-pages.ts'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)
const OPENAI_KEY = process.env.OPENAI_API_KEY || ''
if (!OPENAI_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error('faltan OPENAI_API_KEY / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

type Row = { kind: string; titulo: string; texto: string; fuente_texto: string | null; fuente_url: string | null; record_url: string; content_hash: string }
const hash = (s: string) => createHash('sha256').update(s).digest('hex')
const rows: Row[] = []

for (const f of citableFacts()) {
  rows.push({ kind: 'dato', titulo: f.q, texto: f.a, fuente_texto: f.srcText, fuente_url: f.srcUrl, record_url: '/comparte', content_hash: hash('dato|' + f.q + '|' + f.a) })
}
CONTRA_PARES.forEach((p, i) => {
  const texto = `DICEN: "${p.dicenC}" (${p.dicenQ}). EL RÉCORD: ${p.recordD} LA BRECHA: ${p.brecha}`
  rows.push({ kind: 'contradiccion', titulo: p.titulo, texto, fuente_texto: p.fuentes.map(x => x[0]).join(' · '), fuente_url: p.fuentes[0]?.[1] || null, record_url: `/contradicciones#par-${i + 1}`, content_hash: hash('contra|' + p.titulo + '|' + texto) })
})
for (const b of TRANSICION_BLOQUES) {
  for (const c of b.claims) {
    const texto = `"${c.c}" — ${c.d}`
    const yt = c.v ? `https://www.youtube.com/watch?v=${c.v}${c.t ? `&t=${c.t}s` : ''}` : null
    rows.push({ kind: 'cita_video', titulo: `${c.q} · ${b.titulo} (${b.tag})`, texto, fuente_texto: 'Vistas de transición 2024-2025, verificado al minuto contra el video', fuente_url: yt, record_url: `/transicion#${b.id}`, content_hash: hash('cita|' + c.q + '|' + c.c + '|' + (c.t || 0)) })
  }
}
for (const p of BUSCAR_INDEX) {
  rows.push({ kind: 'pagina', titulo: p.t, texto: `${p.d}. Temas: ${p.k}`, fuente_texto: null, fuente_url: null, record_url: p.u, content_hash: hash('pagina|' + p.u + '|' + p.t + '|' + p.d) })
}

async function embed(texts: string[]): Promise<number[][]> {
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 30000)
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST', signal: ctrl.signal,
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', dimensions: 768, input: texts }),
  })
  clearTimeout(to)
  if (!r.ok) throw new Error('openai ' + r.status + ' ' + (await r.text()).slice(0, 200))
  const j: any = await r.json()
  return j.data.map((d: any) => d.embedding)
}

const { data: existing, error: exErr } = await supabase.from('prsf_facts').select('content_hash').range(0, 4999)
if (exErr) { console.error(exErr); process.exit(1) }
const have = new Set((existing || []).map((r: any) => r.content_hash))
const fresh = rows.filter(r => !have.has(r.content_hash))
console.log(`total fuentes: ${rows.length} · ya en tabla: ${have.size} · nuevos: ${fresh.length}`)

for (let i = 0; i < fresh.length; i += 50) {
  const batch = fresh.slice(i, i + 50)
  const vecs = await embed(batch.map(r => `${r.titulo}\n${r.texto}`))
  const payload = batch.map((r, j) => ({ ...r, embedding: vecs[j] }))
  const { error } = await supabase.from('prsf_facts').upsert(payload, { onConflict: 'content_hash' })
  if (error) { console.error(error); process.exit(1) }
  console.log(`upsert ${i + batch.length}/${fresh.length}`)
}
// Poda: facts que ya no existen en las fuentes (contenido editado) salen de la tabla.
const valid = new Set(rows.map(r => r.content_hash))
const stale = (existing || []).map((r: any) => r.content_hash).filter((h: string) => !valid.has(h))
if (stale.length) {
  const { error } = await supabase.from('prsf_facts').delete().in('content_hash', stale)
  console.log(`podados ${stale.length} stale${error ? ' (ERROR: ' + error.message + ')' : ''}`)
}
console.log('done')
