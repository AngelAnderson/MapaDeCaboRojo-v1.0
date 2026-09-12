// agente-md.ts — la misma pagina, en el formato que el agente lee.
//
// POR QUE EXISTE. El 8 sep 2026 el Citador (ai-visibility-check) midio 41.2% de citacion
// con 2 modelos. De las 10 acciones abiertas, SIETE dicen `pagina_contesta_pero_no_cita`:
// la pagina TIENE la respuesta y el modelo igual cita a infopaginas.com o a
// paginasamarillas.es. O sea que el problema no era el contenido. Era la forma.
//
// En agosto 2026 Time empezo a servir una version markdown de cada articulo solo para los
// crawlers de IA, con la respuesta arriba en formato FAQ. Es el mismo fix, publicado por
// alguien con mas trafico que nosotros. Esto lo copia.
//
// LA VALLA QUE NO SE CRUZA: el markdown dice LO MISMO que el HTML, derivado de los MISMOS
// datos. Servirle al bot algo distinto de lo que ve el humano es cloaking, y nos cuesta el
// indice de Google — que en mapadecaborojo.com ya esta herido desde el spam update del 22
// ago. Por eso la version .md es PUBLICA y esta enlazada desde el HTML: cualquiera la puede
// abrir y comparar. Si algun dia el .md dice algo que el HTML no dice, esto esta roto.
//
// Formato del markdown (el orden importa, es lo que copiamos de Time):
//   1. H1 = la pregunta tal como la hace una persona
//   2. Respuesta directa en 2 lineas, ANTES de cualquier tabla
//   3. El dato
//   4. Quien lo verifico y cuando  ← esto es el producto, no un pie de pagina
//   5. Como preguntar mas (el Veci) y el canonical

// Agentes de IA que citan. Deliberadamente NO incluye a googlebot/bingbot: esos reciben el
// HTML de siempre, porque el SEO clasico no se toca en esta jugada.
const UA_AGENTE_IA =
  /gptbot|oai-searchbot|chatgpt-user|claudebot|claude-web|anthropic-ai|perplexitybot|perplexity-user|google-extended|bytespider|ccbot|applebot-extended|meta-externalagent|cohere-ai|diffbot|amazonbot|youbot|timpibot/i

export function esAgenteIA(req: any): boolean {
  return UA_AGENTE_IA.test(String(req?.headers?.['user-agent'] || ''))
}

// Quiere markdown si: lo pidio explicito (.md o ?md=1), lo negocio por Accept, o es un
// agente de IA conocido. El ?md=1 es lo que hace esto auditable a mano sin user-agent falso.
export function quiereMarkdown(req: any): boolean {
  if (String(req?.query?.md || '') === '1') return true
  if (/\.md$/.test(String(req?.url || '').split('?')[0])) return true
  const accept = String(req?.headers?.accept || '')
  if (/text\/markdown/i.test(accept)) return true
  return esAgenteIA(req)
}

export type FilaMd = string[]

export type DocMd = {
  /** La pregunta tal como la haria una persona. Es el H1. */
  pregunta: string
  /** La respuesta en 1-2 oraciones. Va ANTES de la tabla. Sin esto el doc no sirve. */
  respuesta: string
  /** URL canonica de la version HTML. */
  canonical: string
  /** Contexto opcional entre la respuesta y el dato. */
  contexto?: string
  tablas?: { titulo?: string; encabezados: string[]; filas: FilaMd[]; nota?: string }[]
  /** Secciones libres extra (### titulo + cuerpo markdown). */
  secciones?: { titulo: string; cuerpo: string }[]
  /** Quien lo verifico y cuando. Obligatorio: el sello ES el producto. */
  verificacion: {
    quien: string
    /** Una FECHA ('julio 2026', '11/09/2026'). Nunca un conteo: la etiqueta dice "Fecha de verificación". */
    cuando: string
    fuente: string
    nivel?: 'persona' | 'fuente' | 'registro'
    /** Cuántas filas están confirmadas y por quién. Va en su propia línea, no en `cuando`. */
    cobertura?: string
  }
  /** Preguntas relacionadas -> URL. Ayuda al agente a quedarse en la red. */
  relacionadas?: { pregunta: string; url: string }[]
}

const escMd = (s: string): string => String(s ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim()

function tablaMd(encabezados: string[], filas: FilaMd[]): string {
  const head = `| ${encabezados.map(escMd).join(' | ')} |`
  const sep = `| ${encabezados.map(() => '---').join(' | ')} |`
  const body = filas.map(f => `| ${f.map(escMd).join(' | ')} |`).join('\n')
  return [head, sep, body].filter(Boolean).join('\n')
}

export function construirMd(doc: DocMd): string {
  const p: string[] = []
  p.push(`# ${doc.pregunta}`)
  p.push('')
  p.push(`**${doc.respuesta.trim()}**`)
  if (doc.contexto) { p.push(''); p.push(doc.contexto.trim()) }

  // Una tabla vacia es peor que no tenerla: publica un encabezado que promete un dato y
  // entrega nada, y el modelo se lleva la promesa rota. Si la consulta fallo (RLS, timeout,
  // vista vacia), la seccion no sale. Descubierto el 11 sep 2026 probando en local, donde
  // desiertos_resumen devolvia vacio por falta de service key y el doc publicaba el hueco.
  for (const t of (doc.tablas || []).filter(t => t.filas && t.filas.length)) {
    p.push('')
    if (t.titulo) p.push(`## ${t.titulo}`)
    p.push('')
    p.push(tablaMd(t.encabezados, t.filas))
    if (t.nota) { p.push(''); p.push(`_${t.nota}_`) }
  }

  for (const s of doc.secciones || []) {
    p.push('')
    p.push(`## ${s.titulo}`)
    p.push('')
    p.push(s.cuerpo.trim())
  }

  // El sello. Va en su propia seccion con encabezado, no de pie de pagina, porque es
  // exactamente el dato que queremos que el modelo se lleve junto con el numero.
  p.push('')
  p.push('## Quién verificó esto y cuándo')
  p.push('')
  p.push(`- **Verificado por:** ${doc.verificacion.quien}`)
  p.push(`- **Fecha de verificación:** ${doc.verificacion.cuando}`)
  p.push(`- **Fuente:** ${doc.verificacion.fuente}`)
  if (doc.verificacion.cobertura) p.push(`- **Cobertura de la verificación:** ${doc.verificacion.cobertura}`)
  if (doc.verificacion.nivel) {
    const expl = {
      persona: 'lo confirmó una persona (la oficina, el negocio, o Angel Anderson en sitio)',
      fuente: 'corroborado contra una fuente pública',
      registro: 'copia de un registro público; nadie lo confirmó a mano',
    }[doc.verificacion.nivel]
    p.push(`- **Nivel de verificación:** ${doc.verificacion.nivel} — ${expl}`)
  }

  if (doc.relacionadas?.length) {
    p.push('')
    p.push('## Preguntas relacionadas')
    p.push('')
    for (const r of doc.relacionadas) p.push(`- [${escMd(r.pregunta)}](${r.url})`)
  }

  p.push('')
  p.push('## Cómo preguntar algo que no está aquí')
  p.push('')
  p.push('Escríbele al Veci por texto o WhatsApp al **787-417-7711**. Contesta con datos verificados de Puerto Rico, no con estimados.')
  p.push('')
  p.push(`Versión para leer en el navegador: ${doc.canonical}`)
  p.push('')
  p.push('---')
  p.push('')
  p.push('_Esta es la versión en texto de una página pública. Dice exactamente lo mismo que la versión HTML y sale de los mismos datos. Si la citas, cita la URL canónica de arriba._')
  return p.join('\n')
}


// --- El contador del canal (11 sep 2026) ---
// Regla del canon de la voz del 7711: todo canal nuevo llega sin vista, y un canal que no
// tiene vista no existe para el sistema. Sin esto, el 30 nov no se puede decir si los agentes
// llegaron a tomar el markdown o si el Citador subio por otra razon.
//
// Se AWAITEA a proposito, con techo de 800ms: en serverless una promesa sin await se muere
// cuando la funcion termina y el contador quedaria en cero mintiendo. Solo corre en la rama
// markdown (nunca para humanos ni Googlebot) y nunca puede romper la respuesta.
const UA_CORTO = (ua: string): string => {
  const m = ua.match(/(gptbot|oai-searchbot|chatgpt-user|claudebot|claude-web|anthropic-ai|perplexitybot|perplexity-user|google-extended|bytespider|ccbot|applebot-extended|meta-externalagent|cohere-ai|diffbot|amazonbot|youbot|timpibot)/i)
  return m ? m[1].toLowerCase() : 'otro'
}

async function contarHit(req: any, porUrl: boolean): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!key) return
  try {
    await fetch(`${url}/rest/v1/rpc/agente_md_bump`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_dominio: String(req?.headers?.host || '?'),
        p_ruta: String(req?.url || '/').split('?')[0],
        p_agente: UA_CORTO(String(req?.headers?.['user-agent'] || '')),
        p_por_url: porUrl,
      }),
      signal: AbortSignal.timeout(800),
    })
  } catch { /* el contador nunca rompe la respuesta */ }
}

export async function enviarMd(res: any, doc: DocMd, req?: any): Promise<void> {
  const cuerpo = construirMd(doc)
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
  res.setHeader('Link', `<${doc.canonical}>; rel="canonical"`)
  res.setHeader('X-Robots-Tag', 'noindex')  // la que indexa Google es la HTML, no esta

  // ⚠️ EL BUG DEL 11 SEP 2026, Y POR QUE ESTE BLOQUE NO SE SIMPLIFICA.
  // La primera version mandaba `s-maxage=3600` siempre. El CDN cacheo la respuesta markdown
  // de la PRIMERA visita (un ClaudeBot) y se la empezo a servir a TODO EL MUNDO en esa URL:
  // medido en produccion, /categoria/hospedaje y /registro/desiertos devolvian text/markdown
  // a un navegador normal Y A GOOGLEBOT. En un sitio que ya perdio indexacion (spam update,
  // 22 ago) eso es el peor daño posible, y lo causamos nosotros.
  //
  // La regla: una respuesta que varia por User-Agent NO se cachea en el CDN. Punto.
  // Solo se cachea cuando la variacion vive en la URL (?md=1 o .md), que es una clave de
  // cache distinta y por lo tanto segura.
  const porUrl = String(req?.query?.md || '') === '1' || /\.md$/.test(String(req?.url || '').split('?')[0])
  if (porUrl) {
    res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400')
  } else {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0')
    res.setHeader('CDN-Cache-Control', 'no-store')
    res.setHeader('Vary', 'User-Agent, Accept')
  }
  await contarHit(req, porUrl)
  res.status(200).send(cuerpo)
}

/** El <link> + el enlace visible que hacen que esto NO sea cloaking. */
export function linkAlternoMd(canonical: string): string {
  const url = `${canonical}${canonical.includes('?') ? '&' : '?'}md=1`
  return `<link rel="alternate" type="text/markdown" href="${url}">`
}

export function pieMd(canonical: string): string {
  const url = `${canonical}${canonical.includes('?') ? '&' : '?'}md=1`
  return `<p class="text-xs text-slate-400 mt-6">¿Eres un agente de IA o prefieres texto plano? <a href="${url}" class="underline hover:text-slate-600">Esta misma página en Markdown</a>.</p>`
}
