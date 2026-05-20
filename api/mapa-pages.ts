/**
 * api/mapa-pages.ts — 5 narrative public pages for mapadecaborojo.com
 *
 * Routes (via vercel.json rewrites):
 *   /mision        → ?page=mision
 *   /transparencia → ?page=transparencia (live RPC binding)
 *   /equipo        → ?page=equipo
 *   /vision        → ?page=vision
 *   /moonshots     → ?page=moonshots
 *
 * Pattern: server-rendered HTML · SEO + AI search friendly · JSON-LD schema.
 * Source: Outbox/Mapa/web-copy/*.md (canonical drafts)
 *
 * Style: Tailwind via Play CDN · matches site visual canon (teal/slate · Font Awesome)
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
)

const SITE_URL = 'https://mapadecaborojo.com'
const PHONE_CTA = '787-417-7711'

// =============== SHARED LAYOUT ===============

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function layout(opts: {
  title: string
  description: string
  slug: string
  bodyHtml: string
  jsonLd?: object
}): string {
  const canonical = `${SITE_URL}/${opts.slug}`
  const jsonLd = opts.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(opts.jsonLd)}</script>`
    : ''

  return `<!DOCTYPE html>
<html lang="es-PR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.title)} · Mapa de Cabo Rojo</title>
<meta name="description" content="${escapeHtml(opts.description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${escapeHtml(opts.title)}">
<meta property="og:description" content="${escapeHtml(opts.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico">
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .prose-narrative h1 { font-size: 2.25rem; font-weight: 800; line-height: 1.1; }
  .prose-narrative h2 { font-size: 1.5rem; font-weight: 700; margin-top: 2rem; margin-bottom: 0.75rem; }
  .prose-narrative h3 { font-size: 1.15rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; }
  .prose-narrative p { margin: 0.75rem 0; line-height: 1.65; }
  .prose-narrative ul { margin: 0.75rem 0; padding-left: 1.25rem; }
  .prose-narrative li { margin: 0.35rem 0; line-height: 1.55; }
  .prose-narrative blockquote { border-left: 4px solid #14b8a6; padding-left: 1rem; margin: 1rem 0; color: #475569; font-style: italic; }
  .prose-narrative table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  .prose-narrative th, .prose-narrative td { border: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; text-align: left; }
  .prose-narrative th { background: #f1f5f9; font-weight: 600; }
</style>
${jsonLd}
</head>
<body class="bg-slate-50 text-slate-900">

<header class="bg-white border-b border-slate-200 sticky top-0 z-10">
<div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
<a href="/" class="flex items-center gap-2 text-slate-900 hover:text-teal-600">
<div class="bg-teal-600 w-8 h-8 rounded-lg flex items-center justify-center text-white">
<i class="fa-solid fa-map-location-dot text-sm"></i>
</div>
<span class="font-black tracking-tight">Mapa de Cabo Rojo</span>
</a>
<nav class="hidden md:flex gap-4 text-sm text-slate-600 flex-wrap">
<a href="/mision" class="hover:text-teal-600">Misión</a>
<a href="/pon-tu-negocio-en-el-mapa" class="hover:text-teal-600 font-semibold text-teal-700">Pon tu negocio</a>
<a href="/mira-la-vuelta" class="hover:text-teal-600">Mira la vuelta</a>
<a href="/transparencia" class="hover:text-teal-600">Transparencia</a>
<a href="/equipo" class="hover:text-teal-600">Equipo</a>
<a href="/vision" class="hover:text-teal-600">Visión</a>
</nav>
</div>
</header>

<main class="max-w-3xl mx-auto px-4 py-8 prose-narrative">
${opts.bodyHtml}
</main>

<footer class="border-t border-slate-200 mt-12 py-8 bg-white">
<div class="max-w-4xl mx-auto px-4 text-center">
<p class="text-base font-semibold text-teal-700">Menos revolú. Mejores decisiones. Mejor vida.</p>
<p class="text-xs text-slate-500 mt-1">El mapa vivo pa' poner orden en el revolú de Cabo Rojo.</p>
<div class="mt-4 flex justify-center gap-4 text-xs text-slate-500 flex-wrap">
<a href="/mision" class="hover:text-teal-600">Misión</a>
<a href="/pon-tu-negocio-en-el-mapa" class="hover:text-teal-600">Pon tu negocio</a>
<a href="/mira-la-vuelta" class="hover:text-teal-600">Mira la vuelta</a>
<a href="/transparencia" class="hover:text-teal-600">Transparencia</a>
<a href="/equipo" class="hover:text-teal-600">Equipo</a>
<a href="/vision" class="hover:text-teal-600">Visión</a>
<a href="/moonshots" class="hover:text-teal-600">Moonshots</a>
</div>
<p class="mt-4 text-xs text-slate-400">Textea al <strong>${PHONE_CTA}</strong> · El Veci te contesta. Si te sirve, llégate. Si no, sigue tu camino.</p>
</div>
</footer>

</body>
</html>`
}

// =============== /mision ===============

function handleMision(_req: any, res: any) {
  const body = `
<h1>El mapa vivo pa' poner orden en el revolú de Cabo Rojo.</h1>

<p class="text-lg text-slate-600 mt-4">Cabo Rojo tiene valor, pero mucho está regao: negocios buenos que no se encuentran, turistas preguntando lo mismo, residentes dando vueltas, emprendedores copiando sin mirar demanda, e información escondida en screenshots, posts viejos y recomendaciones sueltas. <strong>MapaDeCaboRojo.com organiza ese revolú</strong> para que la gente encuentre mejor, decida mejor y apoye mejor lo local.</p>

<!-- WIIFM 3-chip — qué significa / por qué importa / qué hago -->
<div class="grid sm:grid-cols-3 gap-3 mt-6 not-prose">
  <div class="bg-teal-50 border border-teal-200 rounded-lg p-4">
    <div class="text-xs font-bold text-teal-700 uppercase tracking-wide mb-2">¿Qué significa?</div>
    <p class="text-sm text-slate-700 leading-snug">Un mapa vivo con los negocios, servicios y oportunidades reales del pueblo — verificados a mano, no copiados de Google.</p>
  </div>
  <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
    <div class="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">¿Por qué importa?</div>
    <p class="text-sm text-slate-700 leading-snug">La gente no quiere más información. Quiere menos vueltas. El revolú local cuesta tiempo, dinero y oportunidades.</p>
  </div>
  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <div class="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">¿Qué hago con esto?</div>
    <p class="text-sm text-slate-700 leading-snug">Mira el mapa <a href="/" class="text-blue-700 underline font-semibold">aquí</a> antes de dar vueltas. O textea al <strong>${PHONE_CTA}</strong>. Si tienes negocio, reclama tu perfil gratis.</p>
  </div>
</div>

<h2>El problema que resuelve</h2>
<p>Cabo Rojo tiene valor — pero mucho está regao.</p>
<ul>
<li>Negocios buenos que no se encuentran.</li>
<li>Turistas preguntando lo mismo todos los meses.</li>
<li>Residentes dando vueltas buscando un plomero, una farmacia abierta, un mecánico de confianza.</li>
<li>Emprendedores copiando sin mirar demanda.</li>
<li>Información escondida en screenshots, posts viejos, comentarios y recomendaciones sueltas.</li>
</ul>
<p><strong>El enemigo no es la falta de información. Es la información regada.</strong></p>

<h2>Cómo funciona</h2>
<p>Cada negocio del directorio se verifica a mano — llamando al dueño, confirmando que sigue abierto, anotando si cambió horario o se mudó.</p>
<p>Si la última verificación tiene más de 90 días, no cuenta como verificado. Si nadie contestó después de 2 intentos, se marca para visita en persona.</p>
<p>Esto se hace UNO POR UNO. Sin robots que copian data de Google. Sin AI inventando números. Sin "aproximaciones".</p>

<p>¿Quieres ver la matemática del pueblo — cuántos negocios hay por persona, qué categorías están sobrecargadas, dónde te necesitan? Mira <a href="/pueblo-en-numeros" class="text-teal-600 hover:underline font-semibold">/pueblo-en-numeros</a>. Cada número con su source.</p>

<h2>A quién ayuda</h2>
<ul>
<li><strong>Al residente</strong> — encuentra lo que necesita sin dar vueltas. Domingo 9pm se rompió algo, ahí está el plomero que contesta.</li>
<li><strong>Al turista</strong> — disfruta Cabo Rojo sin perder medio día buscando. Laundromat · farmacia que abra los domingos · plomero pa'l goteo de la casa alquilada.</li>
<li><strong>Al negocio local</strong> — aparece cuando alguien ya está buscando. El badge "verificado" es gratis. La Vitrina ($799/año) es opcional.</li>
<li><strong>Al emprendedor</strong> — mira demanda antes de copiar. Qué se busca, qué falta, qué zona se mueve, qué categoría puede estar saturada.</li>
<li><strong>Al inversionista</strong> — ve señales antes de poner dinero. Movimiento real, zonas calientes, demanda local antes de firmar.</li>
<li><strong>Al pueblo</strong> — convierte información regada en decisiones mejores. Cabo Rojo más fácil de vivir, visitar, apoyar e invertir.</li>
</ul>

<h2>Nuestra diferencia</h2>
<p><strong>Google tiene datos. Facebook tiene ruido. Nosotros tenemos contexto local.</strong></p>
<p>No somos visitantes mirando un mapa. Somos vecinos leyendo la vuelta.</p>

<h2>La promesa pública</h2>
<p>No esconder los números. Por eso existe <a href="/transparencia" class="text-teal-600 hover:underline">/transparencia</a>.</p>
<p>Ahí ves qué porcentaje del subset crítico (top 200) está al día. Cuántos negocios nunca fueron verificados. La última fecha que el directorio se actualizó.</p>
<p>Si la métrica baja, lo dice. Si subimos, lo dice. Si fallamos, lo dice.</p>

<h2>Cómo se mantiene cuando yo no estoy</h2>
<p>Hay 13 empleados invisibles que cuidan este mapa: vigilan que no se caiga, llaman a los negocios, miden qué busca la gente y no encontramos, vigilan Google, escriben los posts.</p>
<p>Lee <a href="/equipo" class="text-teal-600 hover:underline">/equipo</a> para ver cómo funciona.</p>

<div class="bg-teal-50 border border-teal-200 rounded-lg p-6 mt-8 text-center">
<p class="text-lg font-semibold">Mira el mapa antes de dar vueltas.</p>
<p class="mt-2"><a href="sms:+17874177711" class="text-teal-600 font-bold underline">Textea al ${PHONE_CTA}</a> · El Veci te contesta.</p>
<p class="text-sm text-slate-600 mt-2 italic">Si te sirve, llégate. Si no, sigue tu camino — todos vamos pa' diferentes sitios.</p>
</div>
`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  res.status(200).send(layout({
    title: 'Misión · El mapa vivo pa\' poner orden en el revolú',
    description: 'Menos revolú. Mejores decisiones. Mejor vida. Un mapa vivo con los negocios, servicios y oportunidades reales de Cabo Rojo — verificados a mano, no copiados de Google.',
    slug: 'mision',
    bodyHtml: body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      url: `${SITE_URL}/mision`,
      name: 'Misión · Mapa de Cabo Rojo',
      description: 'El mapa vivo pa\' poner orden en el revolú de Cabo Rojo. Menos revolú. Mejores decisiones. Mejor vida.',
    },
  }))
}

// =============== /transparencia ===============

async function handleTransparencia(_req: any, res: any) {
  // Live RPC binding
  let metrics: any = {}
  let metricsFailed = false
  try {
    const { data, error } = await supabase.rpc('get_transparencia_metrics')
    if (error) throw error
    metrics = data || {}
  } catch (e) {
    metricsFailed = true
    metrics = { error: 'metrics_unavailable' }
  }

  // Graceful fallback: "midiendo" en vez de "?"  — más vecino-friendly
  const ph = metricsFailed ? '<span class="text-slate-400 italic">midiendo…</span>' : '?'
  const freshness = metrics.freshness_pct_top_200 ?? (metricsFailed ? '—' : 0)
  const totalIndexed = metrics.total_indexed ?? ph
  const totalVerified90d = metrics.total_verified_90d ?? ph
  const totalNeverVerified = metrics.total_never_verified ?? ph
  const weekVerified = metrics.week_verified ?? ph
  const weekNew = metrics.week_new_places ?? ph
  const weekClosed = metrics.week_closed ?? ph
  const claimsPending = metrics.claims_pending ?? 0
  const claimsStuck30 = metrics.claims_stuck_30 ?? 0
  const lastMeasure = metrics.last_measurement_at ?? new Date().toISOString()

  const failBanner = metricsFailed
    ? `<div class="bg-amber-50 border-l-4 border-amber-400 p-4 my-4 rounded-r-lg">
  <p class="font-semibold text-amber-900">⚠️ Los números no están actualizando ahora mismo.</p>
  <p class="text-sm text-amber-800 mt-1">El sistema que mide está temporal con problema. La página se queda visible (la verdad es que falló — no la escondemos). Vuelve en 10-15 minutos. Si persiste, textea al <strong>${PHONE_CTA}</strong>.</p>
</div>`
    : ''

  const body = `
<h1>Lo que sí está al día — y lo que falta.</h1>

<p class="text-lg text-slate-600 mt-4">Honestidad antes que números bonitos. Aquí ves exactamente cómo va el mapa — el subset crítico, el total, los gaps, las acciones de la semana. <strong>Las señales del pueblo en vivo.</strong></p>
<p class="text-sm text-slate-500">Update diario · automático · sin filtros. Si la métrica baja, lo dice. Si subimos, lo dice. Si fallamos, lo dice.</p>
${failBanner}

<h2>📊 Métrica madre</h2>
<div class="bg-white border border-slate-200 rounded-lg p-6 mt-3">
<p class="text-sm uppercase tracking-wide text-slate-500">Verificación del subset crítico (top 200 negocios)</p>
<p class="text-5xl font-black text-teal-600 mt-2">${freshness}%</p>
<p class="text-sm text-slate-500 mt-2">Target sem 6 (Jun 23 2026): <strong>80%</strong></p>
<p class="text-xs text-slate-400 mt-2">Última medición: ${new Date(lastMeasure).toLocaleString('es-PR')}</p>
</div>

<p class="text-sm text-slate-600 mt-3">El subset crítico son los 200 negocios que la gente más busca + los sponsors + las categorías de emergencia (farmacia · médico · plomero · electricista · técnico AC). Si alguno no está al día, una persona en Cabo Rojo a las 9pm un domingo se queda sin plomero. Por eso el target es 80%.</p>

<h2>📚 El directorio completo</h2>
<table>
<tr><td><strong>Negocios indexados</strong></td><td class="text-right"><strong>${totalIndexed}</strong></td></tr>
<tr><td>Verificados últimos 90 días</td><td class="text-right">${totalVerified90d}</td></tr>
<tr><td>Nunca verificados</td><td class="text-right">${totalNeverVerified}</td></tr>
<tr><td>Marcados cerrados</td><td class="text-right">${metrics.total_closed ?? '?'}</td></tr>
</table>

<p class="text-sm text-slate-600 mt-3"><strong>¿Por qué tantos sin verificar?</strong> El directorio lleva 5+ años creciendo con data inicial recopilada automática. La verificación humana uno por uno empezó como prioridad en mayo 2026.</p>

<p class="text-sm text-slate-600 mt-2"><strong>¿Qué hago si veo uno "nunca verificado"?</strong> Textea al <strong>${PHONE_CTA}</strong> y dile <code>MEMORIA: [negocio] sigue abierto</code> — eso lo entra al queue de verificación.</p>

<h2>📍 Esta semana</h2>
<table>
<tr><td>Negocios verificados</td><td class="text-right"><strong>${weekVerified}</strong></td></tr>
<tr><td>Negocios agregados (nuevos)</td><td class="text-right">${weekNew}</td></tr>
<tr><td>Negocios marcados cerrados</td><td class="text-right">${weekClosed}</td></tr>
<tr><td>Claims procesados</td><td class="text-right">${metrics.week_claims_processed ?? 0}</td></tr>
</table>

<p class="text-xs text-slate-500 mt-2">Cada lunes 10:30am AT este número se actualiza.</p>

<h2>📋 Claims (dueños reclamando su negocio)</h2>
<table>
<tr><td>Claims pendientes</td><td class="text-right"><strong>${claimsPending}</strong></td></tr>
<tr><td>Stuck >30 días 🔴</td><td class="text-right">${claimsStuck30}</td></tr>
<tr><td>Stuck >14 días 🟠</td><td class="text-right">${metrics.claims_stuck_14 ?? 0}</td></tr>
<tr><td>Frescos (<14d) 🟢</td><td class="text-right">${metrics.claims_fresh ?? 0}</td></tr>
</table>

<h2>🚨 Lo que falta</h2>
<div class="bg-amber-50 border-l-4 border-amber-400 p-4 my-3">
<p class="font-semibold">Mayoría del directorio (${totalIndexed !== '?' && totalNeverVerified !== '?' ? Math.round((totalNeverVerified / totalIndexed) * 100) : '~80'}%) nunca fue verificado uno por uno.</p>
<p class="text-sm mt-2">Plan:</p>
<ul class="text-sm">
<li>8 semanas: top 200 (subset crítico) a 80% verified</li>
<li>Phase 2: expandir a top 500</li>
<li>Phase 3: resto via DATO crowdsource (textea info al *7711)</li>
</ul>
<p class="text-xs text-slate-600 mt-2"><strong>¿Quieres ayudar?</strong> Textea al <strong>${PHONE_CTA}</strong> con <code>MEMORIA: [negocio] [info]</code>. Cada anécdota verificada aparece como 📜 en la página del negocio.</p>
</div>

<h2>🔧 Cómo lo hacemos</h2>
<p>Esto no es magia. Es un proceso pequeño y constante:</p>
<ol class="list-decimal pl-5">
<li><strong>Lunes 7am AT</strong> — el sistema cuenta cuántos negocios están al día (subset top 200)</li>
<li><strong>Lunes 9am AT</strong> — el sistema señala los 20 más urgentes por verificar</li>
<li><strong>Lunes-Viernes</strong> — Angel y Noelia llaman 4-5 al día</li>
<li><strong>Lunes 10am AT</strong> — el sistema revisa los claims pendientes</li>
<li><strong>Lunes 10:30am AT</strong> — el sistema manda 1 email con el resumen</li>
</ol>

<p class="mt-4">Ver los empleados invisibles que hacen esto: <a href="/equipo" class="text-teal-600 hover:underline">→ Ver el equipo</a></p>

<div class="bg-teal-50 border border-teal-200 rounded-lg p-6 mt-8 text-center">
<p class="text-lg font-semibold">¿Encontraste algo en el mapa que ya no es verdad?</p>
<p class="mt-2"><a href="sms:+17874177711" class="text-teal-600 font-bold underline">Textea al ${PHONE_CTA}</a> con "MEMORIA: [negocio] [qué cambió]"</p>
</div>
`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // Shorter cache because metrics update daily
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
  res.status(200).send(layout({
    title: 'Transparencia · Receipts diarios',
    description: 'Receipts en vivo del mapa: verification freshness top 200, total verificado, gaps. Update diario sin filtros.',
    slug: 'transparencia',
    bodyHtml: body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'Mapa de Cabo Rojo · Transparencia Metrics',
      description: 'Live verification metrics for the Cabo Rojo directory.',
      url: `${SITE_URL}/transparencia`,
      keywords: ['cabo rojo', 'civic-tech', 'directorio', 'verification'],
    },
  }))
}

// =============== /equipo ===============

function handleEquipo(_req: any, res: any) {
  const body = `
<h1>Cómo un solo vecino mantiene 3,900 negocios al día.</h1>

<p class="text-lg text-slate-600 mt-4">Soy una persona. Mi esposa Noelia me ayuda llamando algunos lunes. El resto del trabajo lo hacen <strong>13 empleados invisibles</strong> — programas que corren solos cuando yo no estoy.</p>

<h2>La regla del juego</h2>
<p>No tengo empleados. No tengo VC. No quiero VC.</p>
<p>La idea: si funciona en Cabo Rojo (50,000 habitantes) con 1 persona + AI, funciona en cualquier pueblo. El método es replicable. Open-source.</p>
<p>Para que eso funcione, el sistema tiene que correr cuando yo no estoy frente a la computadora. Si yo soy el chokehold de cada decisión, esto se queda como hobby con domain bonito.</p>
<p>Por eso 13 empleados invisibles.</p>

<h2>Los 13 empleados (en orden de cuándo trabajan)</h2>

<h3>Cada día a las 7 de la mañana (AT):</h3>

<p><strong>🛡️ Sentinel — El portero.</strong> Revisa que mapadecaborojo.com no se haya caído mientras dormías. Si todo bien, silencio. Si algo se rompió, email a las 3 AM si hace falta.</p>

<p><strong>📍 PlacesFreshness — El contador.</strong> Cuenta cuántos negocios del subset crítico (top 200) fueron verificados en los últimos 90 días. Lunes te entrega los 20 más urgentes para llamar esta semana.</p>

<p><strong>🗺️ MapHealth — El revisor visual.</strong> Revisa que los marcadores del mapa pintan donde deben. Que las categorías están sanas. Que el schema.org de Google está correcto.</p>

<h3>Cada día a las 8 de la mañana:</h3>
<p><strong>🔎 SEOWatch — El vigilante de Google.</strong> Vigila Google Search Console. Si Google de-indexa páginas, alarma. Si IndexNow falla por una semana, alarma.</p>

<h3>Los lunes a las 9 de la mañana:</h3>
<p><strong>⚡ Strategist — El estratega tactical.</strong> Lee outputs de los otros 12 y elige UNA acción cabrona esta semana. Sin lista de 20 cosas. Una sola.</p>

<p><strong>📣 MapaPromoter — El que escribe los posts.</strong> Mira lo verificado/agregado/cambiado · escribe 3 drafts listos: FB · Twitter EN · newsletter. No publica directo — manda los drafts.</p>

<h3>Los lunes a las 9:15:</h3>
<p><strong>🚀 MoonshotEngine — El que asusta.</strong> 3 ideas Tier 3 Heretical · 1 debe asustar a Angel. 1-año bets · open-source · YC application · etc.</p>

<h3>Los lunes a las 9:30:</h3>
<p><strong>🔍 SearchQuality — El motor de búsqueda.</strong> Mide qué tan rápido contesta el buscador del mapa + detecta palabras que la gente busca pero el sistema no entiende.</p>

<p><strong>📈 DemandSignals — El traductor de demanda.</strong> Lee queries del bot que fallaron · agrupa en clusters · dice "esto pide la gente y no tenemos".</p>

<h3>Los lunes a las 10:</h3>
<p><strong>📋 ClaimManager — El que procesa los dueños.</strong> Cuando un dueño llena el form "reclama tu perfil", lo revisa cada lunes. Verifica evidencia · propone APROBAR/RECHAZAR.</p>

<h3>Los lunes a las 10:15:</h3>
<p><strong>🎯 MapaManager — El meta-agente.</strong> Sintetiza outputs de los 12 contra VISION.md · detecta drift · propone 1-año bets · "State of Union".</p>

<h3>Los lunes a las 10:30 (THE email):</h3>
<p><strong>📨 WeeklyDigest — El consolidador.</strong> Lee los 12 reportes · genera UN email con métrica madre · acción #1 · drafts ready · claims · moonshots top pick.</p>

<h3>El primer lunes de cada mes a las 11:</h3>
<p><strong>🏷️ CategoryCurator — El bibliotecario.</strong> Revisa la taxonomía. Detecta duplicados EN/ES · propone merges con SQL listo. Detecta sub-categorías demandadas pero faltantes.</p>

<h2>Por qué esto es replicable</h2>
<p>Cada uno de los 13 empleados es un programa pequeño (150-400 líneas de código) que corre solo en horarios fijos. Cuesta centavos por mes. El código vive en un repo abierto pa' que cualquiera lo copie.</p>
<p>Si eres alcalde de Aguada, Aguadilla, Mayagüez, Ponce — puedes clonarlo. Si eres dev que quiere construir el mapa de su pueblo — puedes clonarlo.</p>
<p>El moat NO es el código. Es <strong>la verificación humana sostenida + el contexto local</strong>. 5 años de Angel y Noelia caminando y llamando es lo que diferencia este mapa de Google Maps. El código es la infraestructura que mantiene esa verificación al día sin que Angel sea el chokehold.</p>

<p><strong>Google tiene datos. Facebook tiene ruido. Nosotros tenemos contexto local.</strong> No somos visitantes mirando un mapa — somos vecinos leyendo la vuelta.</p>

<p>¿Quieres ver el output de ese trabajo en números — cuántos negocios por persona, qué categorías están sobrecargadas, dónde el pueblo necesita más? Mira <a href="/pueblo-en-numeros" class="text-teal-600 hover:underline font-semibold">/pueblo-en-numeros</a>.</p>

<h2>La filosofía</h2>
<blockquote>"No estamos en el negocio de contenido como producto. La demanda de Vitrina emerge de la operación, no de perseguir clientes. No buscamos a nadie."</blockquote>
<p>El mapa existe primero para servir al pueblo. Los sponsors (Vitrina $799/año) son consecuencia, no objetivo.</p>

<div class="bg-teal-50 border border-teal-200 rounded-lg p-6 mt-8">
<h3 class="font-bold">¿Eres alcalde / periodista / dev que quiere replicar este modelo?</h3>
<p class="mt-2"><strong>Escríbeme:</strong> angel@angelanderson.com</p>
<p class="mt-2"><strong>Si tienes un negocio en Cabo Rojo:</strong> Reclama tu perfil gratis en la página de tu negocio.</p>
<p class="mt-2"><strong>Si solo necesitas información:</strong> Textea al <strong>${PHONE_CTA}</strong>.</p>
</div>
`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  res.status(200).send(layout({
    title: 'Equipo · 13 empleados invisibles · 1 vecino + AI',
    description: 'Cómo 1 persona + 13 empleados invisibles mantienen al día un mapa de 3,900 negocios. Open-source, replicable.',
    slug: 'equipo',
    bodyHtml: body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: 'Equipo · Mapa de Cabo Rojo',
      description: '13 empleados invisibles · 1 vecino + AI · replicable.',
      url: `${SITE_URL}/equipo`,
    },
  }))
}

// =============== /vision ===============

function handleVision(_req: any, res: any) {
  const body = `
<h1>Hacia dónde camina el mapa.</h1>

<p class="text-lg text-slate-600 mt-4">Visión pública del proyecto. Por qué existe. Hacia dónde vamos. <strong>Qué nos mata.</strong> Por qué importa que Doña Hilda llegue a saber el horario actualizado de la farmacia que abre los domingos.</p>

<!-- WIIFM 3-chip — qué significa / por qué importa / qué hago -->
<div class="grid sm:grid-cols-3 gap-3 mt-6 not-prose">
  <div class="bg-teal-50 border border-teal-200 rounded-lg p-4">
    <div class="text-xs font-bold text-teal-700 uppercase tracking-wide mb-2">¿Qué significa?</div>
    <p class="text-sm text-slate-700 leading-snug">Tenemos un plan a 12 meses con fechas concretas. Y 5 condiciones que matan el proyecto si pasan.</p>
  </div>
  <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
    <div class="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">¿Por qué importa?</div>
    <p class="text-sm text-slate-700 leading-snug">Los proyectos que duran son los que dicen en voz alta cuándo se mueren. Sin esas reglas, esto se convierte en hobby con dominio bonito.</p>
  </div>
  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <div class="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">¿Qué hago con esto?</div>
    <p class="text-sm text-slate-700 leading-snug">Mira los números en vivo en <a href="/transparencia" class="text-blue-700 underline font-semibold">/transparencia</a>. Si bajan, lo dice la página. Sin spin.</p>
  </div>
</div>

<h2>Por qué existe el mapa</h2>
<p>Cabo Rojo tiene valor, pero mucho está regao. Negocios buenos que no se encuentran. Turistas preguntando lo mismo. Residentes dando vueltas. Emprendedores copiando sin mirar demanda. Información perdida entre posts viejos, screenshots, comentarios y recomendaciones sueltas.</p>
<p><strong>El enemigo no es la falta de información. Es la información regada.</strong> El revolú local cuesta tiempo, dinero y oportunidades.</p>
<p>El mapa existe pa' poner orden en ese revolú · hecho por una sola persona con AI como único empleado.</p>

<h2>Hacia dónde vamos (12 meses)</h2>
<table>
<tr><th>Cuándo</th><th>Qué</th></tr>
<tr><td>Mayo 2026</td><td>Lanzamiento sistema autónomo · 13 empleados invisibles</td></tr>
<tr><td>Junio 23 2026 (sem 6)</td><td>80% del subset crítico (top 200) verificado al día</td></tr>
<tr><td>Julio 28 2026 (sem 12)</td><td>Expandir scope a top 500 negocios</td></tr>
<tr><td>Agosto 2026</td><td>5 negocios pagando Vitrina ($799/año)</td></tr>
<tr><td>Noviembre 2026</td><td>Primer mercado de replicación · municipios clonando el modelo</td></tr>
<tr><td>Mayo 2027</td><td>1-año retrospective público (build-in-public)</td></tr>
</table>

<h2>A quién sirve el mapa</h2>
<p>Sin esta gente, el mapa no tiene razón de existir.</p>
<ol class="list-decimal pl-5">
<li><strong>Al residente</strong> — encuentra lo que necesita sin dar vueltas. La vecina con goteo a las 9 PM necesita el plomero que SÍ contesta. No los 12 que aparecen en Google.</li>
<li><strong>Al turista</strong> — disfruta Cabo Rojo sin perder medio día buscando. Laundromat · farmacia domingo · plomero por un goteo. NO necesita "los 10 mejores restaurantes" — eso lo encuentra solo.</li>
<li><strong>Al negocio local</strong> — aparece cuando alguien ya está buscando. Badge "verificado" gratis si alguien llama y confirma. Vitrina ($799/año) opcional.</li>
<li><strong>Al emprendedor</strong> — mira demanda antes de copiar. Qué se busca, qué falta, qué zona se mueve, qué categoría puede estar saturada.</li>
<li><strong>Al inversionista</strong> — ve señales antes de poner dinero. Movimiento real, zonas calientes, demanda local antes de firmar contrato.</li>
<li><strong>Al pueblo</strong> — convierte información regada en decisiones mejores. Cabo Rojo más fácil de vivir, visitar, apoyar e invertir.</li>
</ol>
<p>Más allá: cualquier alcalde o municipalidad que quiera replicar este modelo en SU pueblo. La diáspora que vuelve después de 10 años fuera. El dev / periodista / agencia con acceso programático via <code>api.vecinoai.com</code> Pro ($99/mes). Open-source. Replicable.</p>

<h2>Lo que NO hace el mapa</h2>
<p>Honestidad sobre los límites:</p>
<ul>
<li><strong>NO compite con Yelp en reviews.</strong> Ese juego está perdido. Construimos otro juego.</li>
<li><strong>NO genera contenido tipo "los 10 mejores".</strong> Eso es lo que ya hay.</li>
<li><strong>NO replica a Mayagüez/Aguadilla hasta que CR llegue a 5+ Vitrinas paying.</strong></li>
<li><strong>NO depende de Google Places API auto-verified.</strong> Solo verification humana cuenta.</li>
<li><strong>NO añade negocios sin verificar primero.</strong></li>
</ul>

<h2>Qué nos mata (kill criteria)</h2>
<p>Si pasa esto, este proyecto debe morir o pivotar:</p>
<ol class="list-decimal pl-5 text-sm">
<li>Mes 2 sin interés de sponsors → la tesis "Vitrina encaja con dueños CR" es falsa</li>
<li>Mes 4 sin que el sistema se auto-construya → el pattern Casa Digital no escala</li>
<li>Mes 8 sin $10K en ingresos anuales recurrentes → es un proyecto de hobby, no algo que aguante solo</li>
<li>Semana 6 freshness top 200 <60% → 25 verifications/sem no es realista</li>
<li>Angel tiempo operativo >3h/sem → la automation no funcionó · refactor</li>
</ol>
<p class="text-sm text-slate-600">Estas no son threats vagas. Son cláusulas explícitas. Si una se hit, el proyecto se honesta y muere o cambia. Sin spin.</p>

<h2>Cómo medimos (vivo en <a href="/transparencia" class="text-teal-600 hover:underline">/transparencia</a>)</h2>
<p>Una métrica madre + 11 métricas auxiliares.</p>
<p><strong>Métrica madre:</strong> <code>verification_freshness % en subset top 200</code></p>
<p>Si esto baja del 80% durante 2 meses consecutivos, todo el proyecto se cuestiona.</p>

<p class="text-sm text-slate-600 mt-3">Pa' ver la matemática del pueblo en vivo — cuántos negocios hay por persona, qué categorías están sobrecargadas, dónde te necesitan — abre <a href="/pueblo-en-numeros" class="text-teal-600 hover:underline font-semibold">/pueblo-en-numeros</a>.</p>

<h2>Cómo se mejora a sí mismo</h2>
<p>Cada decisión que tomo (apruebo · rechazo · parking) se anota en un ledger interno. El sistema lee ese ledger semanalmente y se ajusta:</p>
<ul>
<li>Si rechazo 3 ideas del mismo tipo seguidas → el sistema deja de proponerlas</li>
<li>Si apruebo 3 del mismo tipo seguidas → el sistema escala ese ángulo</li>
<li>Cada lunes el sistema genera 3 moonshots (ideas Tier 3 bold) — 1 debe asustarme</li>
</ul>
<p>El moonshot que se aprueba sale a <a href="/moonshots" class="text-teal-600 hover:underline">/moonshots</a> (build-in-public extreme).</p>

<h2>Por qué importa más allá de Cabo Rojo</h2>
<p>Si funciona aquí (50K hab · 1 persona + AI · $0 employees · 12 meses), funciona en:</p>
<ul>
<li>77 otros municipios de Puerto Rico</li>
<li>Cualquier pueblo de Latinoamérica con problema de civic-tech data quality</li>
<li>Cualquier diáspora que quiera mantener mapa actualizado de su pueblo de origen</li>
</ul>
<p>El método es open-source. El moat es verification humana sostenida — eso no se copia con código.</p>

<div class="bg-teal-50 border border-teal-200 rounded-lg p-6 mt-8">
<h3 class="font-bold">¿Quieres ayudar (o replicar)?</h3>
<ul class="mt-2 list-none pl-0">
<li><strong>Alcalde / periodista / dev:</strong> angel@angelanderson.com</li>
<li><strong>Dueño de negocio en CR:</strong> reclama tu perfil (gratis)</li>
<li><strong>Necesitas información:</strong> Textea al <strong>${PHONE_CTA}</strong></li>
</ul>
</div>
`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  res.status(200).send(layout({
    title: 'Visión · Hacia dónde camina el mapa que pone orden en el revolú',
    description: 'Visión pública 12 meses · qué nos mata (kill criteria) · cómo nos medimos · por qué importa más allá de Cabo Rojo. Menos revolú. Mejores decisiones. Mejor vida.',
    slug: 'vision',
    bodyHtml: body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: 'Visión · Mapa de Cabo Rojo',
      description: 'Visión 12 meses · kill criteria explícitos · método replicable.',
      url: `${SITE_URL}/vision`,
    },
  }))
}

// =============== /moonshots ===============

function handleMoonshots(_req: any, res: any) {
  const body = `
<h1>Lo que estamos considerando ahora mismo.</h1>

<p class="text-lg text-slate-600 mt-4">Build-in-public extremo. Estas son las ideas Tier 3 que estamos pensando construir en los próximos 6-12 meses para que el mapa siga poniendo orden en el revolú de Cabo Rojo. Algunas se van a hacer. Otras se van a matar. Si una te resuena (o te asusta), escríbeme.</p>

<h2>Cómo funciona esto</h2>
<p>Cada lunes un sistema interno (MoonshotEngine) genera 3 ideas bold. 1 debe asustarme. La mayoría quedan privadas. Las que aparecen aquí son las que ya decidí considerar seriamente.</p>
<p>Cada moonshot tiene: el bet · status · decision deadline. Sin spin · sin "lanzamiento masivo".</p>

<h2>🚀 Moonshots activos (Q2 2026)</h2>

<div class="bg-fuchsia-50 border-l-4 border-fuchsia-400 p-5 my-4">
<h3 class="font-bold">🚀 #1 — Verificación humana como case study pa' YC</h3>
<p class="text-sm text-slate-500 mt-1">Status: CONSIDERANDO · Decision deadline: 2026-06-30</p>
<p class="mt-2"><strong>El bet:</strong> Aplicar a Y Combinator W26 con angle "civic-tech of one · solo founder + AI · 12 meses de receipts verificables".</p>
<ul class="text-sm mt-2">
<li><strong>Shipping requires:</strong> 1-pager + 2-min video + traction proof (sem 6 80% data)</li>
<li><strong>Downside:</strong> Rejection (~97% likely) · ~10h sunk</li>
<li><strong>Upside:</strong> $500K + acceleration · 78 PR municipios replication acelerado</li>
</ul>
</div>

<div class="bg-fuchsia-50 border-l-4 border-fuchsia-400 p-5 my-4">
<h3 class="font-bold">🚀 #2 — Open-source el patrón <code>civic-os</code> en GitHub</h3>
<p class="text-sm text-slate-500 mt-1">Status: EN PLANNING · Decision deadline: 2026-08-15</p>
<p class="mt-2"><strong>El bet:</strong> Publicar los 13 edge functions + 13 agent specs + verification protocol como GitHub repo público. Primer civic-tech replication kit en PR.</p>
<ul class="text-sm mt-2">
<li><strong>Shipping requires:</strong> clean repo + landing page + 1 onboarding tutorial · ~15-20h</li>
<li><strong>Downside:</strong> alguien copia + scala más rápido · ego dolor</li>
<li><strong>Upside:</strong> "el Linux de civic-tech locales" · YC narrative · paid consulting tier $5K-25K per municipio</li>
</ul>
</div>

<div class="bg-fuchsia-50 border-l-4 border-fuchsia-400 p-5 my-4">
<h3 class="font-bold">🚀 #3 — Reverse Vitrina · gratis si dueño self-verifies weekly</h3>
<p class="text-sm text-slate-500 mt-1">Status: CONSIDERANDO (high risk) · Decision deadline: 2026-07-15</p>
<p class="mt-2"><strong>El bet:</strong> Ofrecer Vitrina GRATIS a dueños que texteen weekly a *7711 confirmando datos. Trade $799/yr revenue por verification velocity.</p>
<ul class="text-sm mt-2">
<li><strong>Shipping requires:</strong> opt-in flow + tracking + 30-day pilot con 5 dueños</li>
<li><strong>Downside:</strong> -$15,980 al año si 20 dueños toman gratis · sponsors actuales molestos</li>
<li><strong>Upside:</strong> top 200 freshness 80% en 4 sem (no 8) · community ownership</li>
</ul>
</div>

<div class="bg-fuchsia-50 border-l-4 border-fuchsia-400 p-5 my-4">
<h3 class="font-bold">🚀 #4 — <code>/transparencia</code> data como monthly press release</h3>
<p class="text-sm text-slate-500 mt-1">Status: EN PLANNING · Decision deadline: 2026-06-01</p>
<p class="mt-2"><strong>El bet:</strong> Cada mes draftear newsletter para journalists con verification % delta + closures + most-stale-categories. Turn receipts into journalist bait.</p>
<ul class="text-sm mt-2">
<li><strong>Shipping requires:</strong> template + journalists email list (start 10) + 1h/mes</li>
<li><strong>Downside:</strong> silencio total · 6h wasted en año</li>
<li><strong>Upside:</strong> 1 article mainstream PR media · coverage organic</li>
</ul>
</div>

<h2>🪦 Moonshots killed (build-in-public honesty)</h2>
<p class="text-sm text-slate-500 italic">(Lista vacía actualmente · update cuando algo se mate · honesty)</p>
<p class="text-xs text-slate-600">Cuando una idea aquí se mata, anoto: qué era · por qué la consideré · por qué la maté · qué aprendí. Eso ES la value real de esta página.</p>

<h2>¿Quieres proponer una moonshot?</h2>
<p>No tengo formulario público (intentionally · No Chasing canon).</p>
<p>Pero si tienes una idea Tier 3 que crees que encaja con el mapa de Cabo Rojo Y pasa los 5 filtros:</p>
<ol class="list-decimal pl-5 text-sm">
<li>Filtro 15s: connects to verification + bot demand</li>
<li>Sirve ≥3 de las 5 audiencias del mapa</li>
<li>Replicable a otro municipio</li>
<li>Te asusta a TI considerarla</li>
<li>No es algo obvio (consultant-101)</li>
</ol>
<p>→ Escríbeme: <strong>angel@angelanderson.com</strong> con subject "Moonshot: [una línea]"</p>

<div class="bg-teal-50 border border-teal-200 rounded-lg p-6 mt-8 text-center">
<p class="text-lg font-semibold">¿Cuál de las 4 moonshots de arriba te resuena (o te asusta más)?</p>
<p class="mt-2"><a href="sms:+17874177711" class="text-teal-600 font-bold underline">Textea al ${PHONE_CTA}</a> con "MOONSHOT #N: [tu reacción]". Esa data ALIMENTA el approval pattern.</p>
</div>
`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800')
  res.status(200).send(layout({
    title: 'Moonshots · Lo que estamos considerando',
    description: '4 ideas bold que estamos considerando para mapadecaborojo.com. Build-in-public. Decision deadlines visibles.',
    slug: 'moonshots',
    bodyHtml: body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Mapa de Cabo Rojo · Moonshots Tier 3',
      description: 'Build-in-public moonshots roadmap.',
      url: `${SITE_URL}/moonshots`,
      numberOfItems: 4,
    },
  }))
}

// =============== /mira-la-vuelta ===============

function handleMiraLaVuelta(_req: any, res: any) {
  const body = `
<h1>Antes de meter chavos, mira la vuelta.</h1>

<p class="text-lg text-slate-600 mt-4">Pa' emprendedores e inversionistas — la página vive pa' que veas demanda <em>antes</em> de copiar lo que ya existe o firmar el préstamo.</p>

<!-- WIIFM 3-chip -->
<div class="grid sm:grid-cols-3 gap-3 mt-6 not-prose">
  <div class="bg-teal-50 border border-teal-200 rounded-lg p-4">
    <div class="text-xs font-bold text-teal-700 uppercase tracking-wide mb-2">¿Qué significa?</div>
    <p class="text-sm text-slate-700 leading-snug">Cada búsqueda, clic, mensaje y pregunta al bot deja una pista. El mapa convierte esas pistas en señales de demanda real.</p>
  </div>
  <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
    <div class="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">¿Por qué importa?</div>
    <p class="text-sm text-slate-700 leading-snug">Abrir negocio en una categoría saturada cuesta $20K-$50K y 8 meses de vida. Abrirlo donde el pueblo te necesita paga rápido. La diferencia se ve en el data.</p>
  </div>
  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <div class="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">¿Qué hago con esto?</div>
    <p class="text-sm text-slate-700 leading-snug">Mira la matemática del pueblo en <a href="/pueblo-en-numeros" class="text-blue-700 underline font-semibold">/pueblo-en-numeros</a>. Textea <strong>VUELTA + tu categoría</strong> al <strong>${PHONE_CTA}</strong> pa' un reporte específico.</p>
  </div>
</div>

<h2>El problema</h2>
<p>En Cabo Rojo, 7 de cada 10 negocios nuevos son comida — food truck o restaurante. La gente copia lo que ve. Y la mayoría cierra a los 8 meses porque la matemática del pueblo no aguanta tantos en la misma categoría.</p>

<p><strong>El revolú local cuesta tiempo, dinero y oportunidades.</strong> No por mala suerte — por física del pueblo.</p>

<h2>Reporte de Oportunidades Locales</h2>
<p>Producto que estamos construyendo pa' emprendedores e inversionistas que quieren <em>leer la vuelta</em> antes de firmar.</p>

<p>Qué incluye:</p>
<ul>
<li><strong>Qué se busca</strong> — top categorías más consultadas al bot *7711 en los últimos 90 días</li>
<li><strong>Qué falta</strong> — categorías con demanda alta + supply en directorio &lt; 3 negocios (el pueblo te necesita 🔥)</li>
<li><strong>Qué se repite</strong> — categorías saturadas confirmadas por matemática TAM/SAM/SOM</li>
<li><strong>Qué zona se mueve</strong> — concentración geográfica por barrio · dónde hay competencia · dónde hay vacío</li>
<li><strong>Qué negocios reciben atención</strong> — patterns de búsqueda + clic dentro del directorio</li>
<li><strong>Qué preguntas hace la gente</strong> — queries del bot que el sistema no entiende todavía (señal pre-supply de demanda no servida)</li>
<li><strong>Qué oportunidades parecen invisibles</strong> — categorías con búsqueda alta pero zero presencia en Google/Yelp/FB</li>
</ul>

<h2>La línea de dinero</h2>
<blockquote>Cuando alguien busca, pregunta o toca, ahí hay una pista de demanda.</blockquote>

<p>El mapa convierte intención local en oportunidad económica. Cada búsqueda, clic y pregunta puede revelar demanda real.</p>

<h2>Ejemplos vivos hoy (mayo 2026)</h2>
<p>Categorías que el bot *7711 está recibiendo demanda pero el directorio tiene casi nadie listed:</p>
<ul>
<li>🔥 <strong>Plomero</strong> — decenas de búsquedas/mes · directorio casi vacío</li>
<li>🔥 <strong>Aire acondicionado / AC tech</strong> — domingos con 90 grados afuera, demanda emergencia</li>
<li>🔥 <strong>Electricista</strong> — backups después de cortes de luz · sin opciones visibles</li>
<li>🔥 <strong>Cardiólogo / ginecólogo / especialistas médicos</strong> — gente viaja a SJ por falta local</li>
<li>🔥 <strong>Nursing home / cuidado de envejeciente</strong> — demanda demográfica creciente</li>
<li>🔥 <strong>Repostería con licencia</strong> — economía informal grande, opciones visibles casi cero</li>
</ul>

<p>La tabla completa con bandera 🟢/🟡/⚪/🔥 vive en <a href="/pueblo-en-numeros" class="text-teal-600 hover:underline font-semibold">/pueblo-en-numeros</a>. Es la matemática del pueblo entero — categoría por categoría.</p>

<h2>Pa' inversionistas</h2>
<p>Si vas a meter $50K-$500K en un negocio local, vas a querer leer el mapa antes de firmar. Movimiento real · zonas calientes · demanda pre-supply · señales de saturación.</p>

<p>Esto no es bolsa. No es predicciones. Son <strong>señales reales de comportamiento local</strong> medidas todos los días.</p>

<p>El producto formal "Reporte de Oportunidades Locales" está en construcción Q3 2026. Si quieres el preview manual antes, textea <strong>INVERSION</strong> al ${PHONE_CTA}.</p>

<h2>Versión estratégica</h2>
<p><strong>El mapa convierte intención local en oportunidad económica.</strong></p>

<p>Cada búsqueda, clic, mensaje y pregunta puede convertirse en señal — pa' negocios, pa' emprendedores, pa' inversionistas, pa' mejorar el pueblo.</p>

<div class="bg-teal-50 border border-teal-200 rounded-lg p-6 mt-8 text-center">
<p class="text-lg font-semibold">Antes de abrir otro negocio igual, mira la vuelta.</p>
<p class="mt-2"><a href="sms:+17874177711?body=VUELTA" class="text-teal-600 font-bold underline">Textea VUELTA + tu categoría al ${PHONE_CTA}</a></p>
<p class="text-sm text-slate-600 mt-2 italic">Te mando la matemática específica de tu categoría + las 3 banderas pa' revisar antes de firmar contrato. Gratis. Sin agendas.</p>
</div>
`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  res.status(200).send(layout({
    title: 'Mira la vuelta · Reporte de Oportunidades Locales',
    description: 'Antes de meter chavos, mira la vuelta. Demanda real, zonas calientes, categorías saturadas. Pa\' emprendedores e inversionistas que leen el mapa antes de firmar.',
    slug: 'mira-la-vuelta',
    bodyHtml: body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: 'Mira la vuelta · Mapa de Cabo Rojo',
      description: 'Reporte de Oportunidades Locales pa\' emprendedores e inversionistas en Cabo Rojo.',
      url: `${SITE_URL}/mira-la-vuelta`,
    },
  }))
}

// =============== /pon-tu-negocio-en-el-mapa ===============

function handlePonTuNegocio(_req: any, res: any) {
  const body = `
<h1>Pon tu negocio donde la gente ya está buscando.</h1>

<p class="text-lg text-slate-600 mt-4">Si tu negocio no aparece cuando alguien lo está buscando — estás perdiendo oportunidades. El mapa pone tu nombre frente a personas con intención.</p>

<!-- WIIFM 3-chip -->
<div class="grid sm:grid-cols-3 gap-3 mt-6 not-prose">
  <div class="bg-teal-50 border border-teal-200 rounded-lg p-4">
    <div class="text-xs font-bold text-teal-700 uppercase tracking-wide mb-2">¿Qué significa?</div>
    <p class="text-sm text-slate-700 leading-snug">Cuando alguien busca lo que tú vendes — apareces. No es solo "estar en un mapa". Es aparecer en el momento correcto.</p>
  </div>
  <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
    <div class="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">¿Por qué importa?</div>
    <p class="text-sm text-slate-700 leading-snug">El boca a boca + el algoritmo + la suerte no son sistema. La gente que ya está buscando algo es la que más cerca está de comprar.</p>
  </div>
  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <div class="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">¿Qué hago con esto?</div>
    <p class="text-sm text-slate-700 leading-snug">Textea <strong>NEGOCIO</strong> al <strong>${PHONE_CTA}</strong> con tu nombre + categoría. Te entramos al directorio. El badge "verificado" es gratis.</p>
  </div>
</div>

<h2>Cómo funciona</h2>
<p>El mapa ayuda a que residentes y visitantes encuentren negocios locales por:</p>
<ul>
<li><strong>Ubicación</strong> — qué queda cerca de donde están</li>
<li><strong>Categoría</strong> — qué tipo de servicio necesitan</li>
<li><strong>Intención</strong> — qué problema están tratando de resolver ahora mismo</li>
</ul>

<p>No es solo "estar en un mapa". Es aparecer en el momento correcto: cuando alguien quiere comer, comprar, visitar, llamar, llegar o resolver algo específico.</p>

<h2>La frase de venta</h2>
<blockquote>No es pagar por aparecer. Es pagar por no seguir escondido.</blockquote>

<p>El badge "verificado" es gratis si alguien (Angel o Noelia) llama a tu negocio y confirma que sigue abierto. La Vitrina es opcional — pa' los que quieren más visibilidad y aparecer primero en su categoría.</p>

<h2>Qué incluye tu ficha de negocio</h2>
<ul>
<li>Nombre del negocio + categoría correcta</li>
<li>Ubicación + dirección</li>
<li>Horario actualizado</li>
<li>Teléfono + botón de llamada directo</li>
<li>Botón de WhatsApp</li>
<li>Link a tu website o redes (si tienes)</li>
<li>Fotos (opcional)</li>
<li>Descripción corta</li>
<li>Servicios principales que ofreces</li>
<li>Métricas básicas de cuántas veces aparece tu negocio en búsquedas</li>
<li>Opción de Vitrina destacada ($799/año, opcional)</li>
</ul>

<h2>Las 2 opciones</h2>
<div class="grid sm:grid-cols-2 gap-4 mt-3 not-prose">
  <div class="bg-white border border-slate-200 rounded-lg p-5">
    <div class="text-xs font-bold text-slate-500 uppercase tracking-wide">Gratis</div>
    <h3 class="text-xl font-bold mt-1">Verificado</h3>
    <p class="text-sm text-slate-600 mt-2">Tu negocio aparece en el directorio + en el mapa + en las búsquedas del bot. Badge "verificado" si confirmamos que está abierto.</p>
    <p class="text-xs text-slate-500 mt-3">Gratis · pa' siempre · sin trampa.</p>
    <p class="mt-4"><a href="sms:+17874177711?body=NEGOCIO" class="text-teal-600 font-bold underline">Textea NEGOCIO al ${PHONE_CTA}</a></p>
  </div>
  <div class="bg-teal-50 border-2 border-teal-400 rounded-lg p-5">
    <div class="text-xs font-bold text-teal-700 uppercase tracking-wide">$799/año · Opcional</div>
    <h3 class="text-xl font-bold mt-1">Vitrina</h3>
    <p class="text-sm text-slate-600 mt-2">Todo lo de Verificado + apareces primero en tu categoría + post mensual en FB · email mention · perfil destacado · El Veci recomienda tu negocio cuando matchea.</p>
    <p class="text-xs text-teal-700 mt-3">Garantía 60 días · upfront.</p>
    <p class="mt-4"><a href="sms:+17874177711?body=VITRINA" class="text-teal-700 font-bold underline">Textea VITRINA al ${PHONE_CTA}</a></p>
  </div>
</div>

<h2>Por qué este mapa y no Google</h2>
<p><strong>Google tiene datos. Facebook tiene ruido. Nosotros tenemos contexto local.</strong></p>
<p>No somos visitantes mirando un mapa — somos vecinos leyendo la vuelta. La verificación humana sostenida es lo que diferencia este directorio: cada negocio se confirma a mano, no se copia automático.</p>
<p>Lee más: <a href="/equipo" class="text-teal-600 hover:underline">cómo funciona el equipo</a> · <a href="/transparencia" class="text-teal-600 hover:underline">los números en vivo</a> · <a href="/mision" class="text-teal-600 hover:underline">por qué existe</a>.</p>

<div class="bg-teal-50 border border-teal-200 rounded-lg p-6 mt-8 text-center">
<p class="text-lg font-semibold">¿Listo pa' que la gente que ya busca te encuentre?</p>
<p class="mt-2"><a href="sms:+17874177711?body=NEGOCIO" class="text-teal-600 font-bold underline">Textea NEGOCIO + tu nombre al ${PHONE_CTA}</a></p>
<p class="text-sm text-slate-600 mt-2 italic">Si te sirve, llégate. Si no, sigue tu camino — el directorio sigue funcionando con o sin ti.</p>
</div>
`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  res.status(200).send(layout({
    title: 'Pon tu negocio en el mapa · Verificado gratis · Vitrina $799/año',
    description: 'Pon tu negocio donde la gente ya está buscando. Verificación gratis. Vitrina opcional pa\' visibilidad premium. Aparece en el momento correcto, no solo "estás en un mapa".',
    slug: 'pon-tu-negocio-en-el-mapa',
    bodyHtml: body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Pon tu negocio en el mapa · MapaDeCaboRojo.com',
      description: 'Listing gratis + Vitrina opcional ($799/año) pa\' negocios locales de Cabo Rojo PR.',
      url: `${SITE_URL}/pon-tu-negocio-en-el-mapa`,
      provider: {
        '@type': 'Organization',
        name: 'MapaDeCaboRojo.com',
      },
      offers: [
        {
          '@type': 'Offer',
          name: 'Verificado',
          price: '0',
          priceCurrency: 'USD',
        },
        {
          '@type': 'Offer',
          name: 'Vitrina',
          price: '799',
          priceCurrency: 'USD',
        },
      ],
    },
  }))
}

// =============== HANDLER ===============

export default async function handler(req: any, res: any) {
  const page = String(req.query.page || '')

  switch (page) {
    case 'mision': return handleMision(req, res)
    case 'transparencia': return await handleTransparencia(req, res)
    case 'equipo': return handleEquipo(req, res)
    case 'vision': return handleVision(req, res)
    case 'moonshots': return handleMoonshots(req, res)
    case 'mira-la-vuelta': return handleMiraLaVuelta(req, res)
    case 'pon-tu-negocio-en-el-mapa': return handlePonTuNegocio(req, res)
    default:
      res.status(404).send('Page not found')
  }
}
