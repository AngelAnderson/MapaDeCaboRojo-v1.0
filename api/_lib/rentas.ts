/**
 * api/_lib/rentas.ts — Casas en Cabo Rojo (lista viva de renta larga)
 *
 * Ruta (via vercel.json rewrite → api/mapa-pages.ts dispatcher):
 *   /rentas → ?page=rentas
 *
 * Data: vista `rentals_activos` (solo status='activo' y no vencido).
 * La lista se alimenta por texto al 787-417-7711 con el keyword RENTA y se limpia
 * sola: el cron rentals-guardia pregunta a los 14 dias y expira a los 21.
 */

type Deps = { layout: (opts: any) => string; escapeHtml: (s: string) => string; supabase: any }

const BARRIO_LABEL: Record<string, string> = {
  pueblo: 'El Pueblo', boqueron: 'Boquerón', miradero: 'Puerto Real / Miradero',
  guanajibo: 'Joyuda / Guanajibo', pedernales: 'Pedernales', bajura: 'Bajura',
  'monte-grande': 'Monte Grande', 'llanos-tuna': 'Llanos Tuna', 'llanos-costa': 'Llanos Costa',
}

const TIPO_EMOJI: Record<string, string> = {
  casa: '🏠', apartamento: '🏢', cuarto: '🚪', efficiency: '🛏️', estudio: '🛋️',
}

function diasDesde(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))
}

export async function handleRentas(req: any, res: any, deps: Deps) {
  const { layout, escapeHtml, supabase } = deps
  const host = String(req.headers?.host || '')
  const zona = typeof req.query?.zona === 'string' ? req.query.zona : ''

  // Se trae TODO y se filtra en memoria. Filtrar en la query dejaria los chips de
  // zona mostrando solo la zona ya seleccionada, que es un callejon sin salida.
  let todas: any[] = []
  let dbError = false
  try {
    const { data, error } = await supabase.from('rentals_activos').select('*').limit(100)
    if (error) throw error
    todas = data || []
  } catch (e) {
    console.error('rentas query error:', e)
    dbError = true
  }

  const zonasConAlgo = Array.from(new Set(todas.map(r => r.barrio_slug).filter(Boolean)))
  const rows = zona && BARRIO_LABEL[zona] ? todas.filter(r => r.barrio_slug === zona) : todas

  const cards = rows.map((r: any) => {
    const emoji = TIPO_EMOJI[r.tipo] || '🏠'
    const zonaTxt = escapeHtml(r.zona_texto || BARRIO_LABEL[r.barrio_slug] || 'Cabo Rojo')
    const precio = r.precio_mensual ? `$${r.precio_mensual}<span class="text-sm font-normal text-slate-500">/mes</span>` : '<span class="text-base font-normal text-slate-500">Precio a preguntar</span>'
    const cuartos = r.cuartos !== null ? `${r.cuartos} cuartos` : ''
    const banos = r.banos !== null ? `${r.banos} baños` : ''
    const extras = [cuartos, banos,
      r.amueblado ? 'amueblado' : '',
      r.mascotas ? 'acepta mascotas' : '',
      r.incluye_agua_luz ? 'incluye agua y luz' : '',
    ].filter(Boolean).join(' · ')
    const d = diasDesde(r.last_verified_at)
    const verif = d === 0 ? 'Verificada hoy' : d === 1 ? 'Verificada ayer' : `Verificada hace ${d} días`
    const frescor = d <= 7 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
    const badge = r.licencia_verificada
      ? '<span class="inline-block px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-xs font-bold">✅ Corredor con licencia verificada</span>'
      : ''
    const tel = r.contacto_phone
      ? `<a href="tel:${escapeHtml(String(r.contacto_phone).replace(/[^\d+]/g, ''))}" class="inline-block mt-3 px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-sm">Llamar ${escapeHtml(r.contacto_phone)}</a>`
      : `<a href="sms:+17874177711?body=CASA" class="inline-block mt-3 px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-sm">Pregúntale al Veci</a>`

    return `<article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-xs uppercase tracking-wide text-slate-500 font-bold">${emoji} ${escapeHtml(r.tipo)}</div>
          <h3 class="text-lg font-black text-slate-900 mt-0.5">${zonaTxt}</h3>
        </div>
        <div class="text-2xl font-black text-slate-900 whitespace-nowrap">${precio}</div>
      </div>
      ${extras ? `<p class="text-sm text-slate-600 mt-2">${escapeHtml(extras)}</p>` : ''}
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <span class="inline-block px-2 py-0.5 rounded-full ${frescor} text-xs font-bold">${verif}</span>
        ${badge}
      </div>
      ${tel}
    </article>`
  }).join('\n')

  const filtros = ['', ...zonasConAlgo].map(z => {
    const activo = z === zona
    const label = z ? BARRIO_LABEL[z] || z : 'Todas las zonas'
    const cls = activo ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-300'
    return `<a href="/rentas${z ? `?zona=${z}` : ''}" class="px-3 py-1.5 rounded-full text-sm font-bold ${cls}">${escapeHtml(label)}</a>`
  }).join(' ')

  const vacio = `<div class="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center">
    <p class="text-lg font-black text-slate-900">Ahora mismo la lista está vacía.</p>
    <p class="text-slate-600 mt-2">Prefiero no tener nada que tener casas que ya se rentaron. Escríbele CASA al 787-417-7711 y te aviso yo cuando entre algo.</p>
    <a href="sms:+17874177711?body=CASA" class="inline-block mt-4 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-bold">Que me avisen</a>
  </div>`

  const vacioEnZona = `<div class="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center">
    <p class="text-lg font-black text-slate-900">Nada en ${escapeHtml(BARRIO_LABEL[zona] || zona)} ahora mismo.</p>
    <p class="text-slate-600 mt-2">Hay ${todas.length} en otras zonas de Cabo Rojo.</p>
    <a href="/rentas" class="inline-block mt-4 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-bold">Ver todas</a>
  </div>`

  const errorBox = `<div class="rounded-2xl bg-amber-50 border border-amber-200 p-5 text-amber-900">
    No pude leer la lista ahora mismo. Escríbele CASA al 787-417-7711 y te contesto por texto.</div>`

  const cuerpo = dbError ? errorBox
    : rows.length ? cards
    : todas.length ? vacioEnZona
    : vacio

  const bodyHtml = `
  <section class="max-w-3xl mx-auto px-4 py-10">
    <h1 class="text-3xl sm:text-4xl font-black text-slate-900">Casas pa' rentar en Cabo Rojo</h1>
    <p class="text-lg text-slate-600 mt-3">
      Esto no es un clasificado. Es lo que estaba vivo esta semana, con la fecha de verificación en cada una.
      Si no me contestan que sigue disponible, la bajo a los 21 días.
    </p>

    <div class="mt-6 rounded-2xl bg-slate-900 text-white p-5">
      <p class="font-black text-lg">¿Tienes una pa' rentar?</p>
      <p class="text-slate-300 text-sm mt-1">Escríbeme RENTA al 787-417-7711 con qué es, la zona, cuántos cuartos y cuánto. Yo la reviso y la pongo.</p>
      <a href="sms:+17874177711?body=RENTA" class="inline-block mt-3 px-4 py-2 rounded-xl bg-white text-slate-900 font-bold text-sm">Poner la mía</a>
    </div>

    ${todas.length ? `<div class="mt-8 flex flex-wrap gap-2">${filtros}</div>` : ''}

    <div class="mt-6 grid gap-4">
      ${cuerpo}
    </div>

    <div class="mt-10 rounded-2xl bg-rose-50 border border-rose-200 p-5">
      <p class="font-black text-rose-900">Antes de dar un peso</p>
      <ul class="mt-2 text-sm text-rose-900 space-y-1 list-disc list-inside">
        <li>No des depósito sin ver la propiedad en persona.</li>
        <li>Si te apuran o solo quieren hablar por mensaje, es bandera roja.</li>
        <li>Si dice corredor, pídele el número de licencia. El que la tiene te la da.</li>
      </ul>
    </div>
  </section>`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: "Casas pa' rentar en Cabo Rojo",
    description: 'Lista verificada de casas y apartamentos de renta larga en Cabo Rojo, con fecha de verificación en cada listado.',
    url: 'https://www.mapadecaborojo.com/rentas',
    numberOfItems: rows.length,
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600')
  res.status(200).send(layout({
    title: "Casas pa' rentar en Cabo Rojo · verificadas esta semana",
    description: 'Lo que está disponible de verdad pa\' vivir en Cabo Rojo, con fecha de verificación. Si no confirman que sigue, se baja a los 21 días.',
    slug: 'rentas',
    bodyHtml,
    jsonLd,
    host,
  }))
}
