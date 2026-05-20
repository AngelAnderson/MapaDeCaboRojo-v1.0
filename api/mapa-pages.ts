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
<nav class="hidden md:flex gap-4 text-sm text-slate-600">
<a href="/mision" class="hover:text-teal-600">Misión</a>
<a href="/transparencia" class="hover:text-teal-600">Transparencia</a>
<a href="/equipo" class="hover:text-teal-600">Equipo</a>
<a href="/vision" class="hover:text-teal-600">Visión</a>
<a href="/moonshots" class="hover:text-teal-600">Moonshots</a>
</nav>
</div>
</header>

<main class="max-w-3xl mx-auto px-4 py-8 prose-narrative">
${opts.bodyHtml}
</main>

<footer class="border-t border-slate-200 mt-12 py-8 bg-white">
<div class="max-w-4xl mx-auto px-4 text-center text-sm text-slate-500">
<p>— Angel | Menos revolú, más tiempo, más claridad.</p>
<div class="mt-3 flex justify-center gap-4 text-xs">
<a href="/mision" class="hover:text-teal-600">Misión</a>
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
<h1>Un pueblo de 50,000 puede tener mejor data que ciudades de millones.</h1>

<p class="text-lg text-slate-600 mt-4">Mapa de Cabo Rojo es un directorio de los negocios reales del pueblo — verificados uno por uno, llamando al dueño. No es Google Maps. No es Yelp. No es Facebook. Es lo que el pueblo le falta: <strong>un mapa que sí está al día</strong>.</p>

<h2>El problema que resuelve</h2>
<p>Cuando buscas un plomero en Cabo Rojo a las 9 de la noche, Google te muestra negocios que cerraron en 2019. Yelp tiene 3 reviews mexicanos. Facebook te muestra una página de un vecino que vendía tornillos.</p>
<p>Tú necesitas el número del plomero que SÍ contesta.</p>
<p>Eso es lo que falta. Y eso es lo que el Mapa de Cabo Rojo entrega.</p>

<h2>Cómo funciona</h2>
<p>Cada negocio del directorio tiene un campo: <code>last_verified_at</code>. Si la fecha es de hace más de 90 días, no cuenta como verificado.</p>
<p>Verificar significa: alguien (Angel o Noelia) llamó al número, confirmó que sigue abierto, anotó si el horario cambió, si el dueño se mudó, si cerró.</p>
<p>Si nadie contestó después de 2 intentos, el negocio se marca para visita en persona.</p>
<p>Esto se hace UNO POR UNO. Sin scraping. Sin AI inventando data. Sin "aproximaciones".</p>

<h2>Para quién es</h2>
<ul>
<li><strong>Si vives aquí</strong> — domingo 9pm se rompió algo, necesitas un plomero ahora. El mapa te da el número que contesta.</li>
<li><strong>Si vienes de visita</strong> — laundromat · farmacia que abra los domingos · plomero porque la casa alquilada tiene un goteo.</li>
<li><strong>Si estás de regreso después de 10 años fuera</strong> — el pueblo cambió. ¿Qué sigue abierto? ¿Quién es nuevo?</li>
<li><strong>Si tienes un negocio aquí</strong> — el badge "verificado" es gratis. La Vitrina ($799/año) es opcional.</li>
<li><strong>Si eres dev / periodista / agencia</strong> — <code>api.vecinoai.com</code> Pro $99/mes para PBMs, journalists, civic-tech researchers.</li>
</ul>

<h2>La promesa pública</h2>
<p>No esconder los números. Por eso existe <a href="/transparencia" class="text-teal-600 hover:underline">/transparencia</a>.</p>
<p>Ahí ves qué porcentaje del subset crítico (top 200) está al día. Cuántos negocios nunca fueron verificados. La última fecha que el directorio se actualizó.</p>
<p>Si la métrica baja, lo dice. Si subimos, lo dice. Si fallamos, lo dice.</p>

<h2>Cómo se mantiene cuando yo no estoy</h2>
<p>Hay 13 empleados invisibles que cuidan este mapa: vigilan que no se caiga, llaman a los negocios, miden qué busca la gente y no encontramos, vigilan Google, escriben los posts.</p>
<p>Lee <a href="/equipo" class="text-teal-600 hover:underline">/equipo</a> para ver cómo funciona.</p>

<div class="bg-teal-50 border border-teal-200 rounded-lg p-6 mt-8 text-center">
<p class="text-lg font-semibold">¿Buscas algo específico en Cabo Rojo?</p>
<p class="mt-2"><a href="sms:+17874177711" class="text-teal-600 font-bold underline">Textea al ${PHONE_CTA}</a> · El Veci te contesta.</p>
<p class="text-sm text-slate-600 mt-2 italic">Si te sirve, llégate. Si no, sigue tu camino — todos vamos pa' diferentes sitios.</p>
</div>
`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  res.status(200).send(layout({
    title: 'Misión · Un pueblo de 50,000 puede tener mejor data',
    description: 'Directorio verificado de negocios reales de Cabo Rojo PR. Verificación humana uno por uno. El mapa que sí está al día.',
    slug: 'mision',
    bodyHtml: body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      url: `${SITE_URL}/mision`,
      name: 'Misión · Mapa de Cabo Rojo',
      description: 'Directorio verificado de negocios reales de Cabo Rojo PR.',
    },
  }))
}

// =============== /transparencia ===============

async function handleTransparencia(_req: any, res: any) {
  // Live RPC binding
  let metrics: any = {}
  try {
    const { data } = await supabase.rpc('get_transparencia_metrics')
    metrics = data || {}
  } catch (e) {
    metrics = { error: 'metrics_unavailable' }
  }

  const freshness = metrics.freshness_pct_top_200 ?? 0
  const totalIndexed = metrics.total_indexed ?? '?'
  const totalVerified90d = metrics.total_verified_90d ?? '?'
  const totalNeverVerified = metrics.total_never_verified ?? '?'
  const weekVerified = metrics.week_verified ?? '?'
  const weekNew = metrics.week_new_places ?? '?'
  const weekClosed = metrics.week_closed ?? '?'
  const claimsPending = metrics.claims_pending ?? 0
  const claimsStuck30 = metrics.claims_stuck_30 ?? 0
  const lastMeasure = metrics.last_measurement_at ?? new Date().toISOString()

  const body = `
<h1>Lo que sí está al día — y lo que falta.</h1>

<p class="text-lg text-slate-600 mt-4">Honestidad antes que números bonitos. Aquí ves exactamente cómo va el directorio — el subset crítico, el total, los gaps, las acciones de la semana.</p>
<p class="text-sm text-slate-500">Update diario · automático · sin filtros.</p>

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

<p class="text-sm text-slate-600 mt-3"><strong>¿Por qué tantos sin verificar?</strong> El directorio es de 5+ años de scraping y collection inicial. Verificación humana uno por uno empezó como prioridad mayo 2026.</p>

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
<p><strong>🔍 SearchQuality — El motor de búsqueda.</strong> Mide latencia del search RPC + identifica synonym gaps.</p>

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
<p>Cada uno de los 13 empleados es un Supabase Edge Function (TypeScript, ~150-400 líneas) corriendo en pg_cron. Cuesta centavos por mes. El código vive en un repo abierto.</p>
<p>Si eres alcalde de Aguada, Aguadilla, Mayagüez, Ponce — puedes clonarlo. Si eres dev que quiere construir el mapa de su pueblo — puedes clonarlo.</p>
<p>El moat NO es el código. Es <strong>la verificación humana sostenida</strong>. 5 años de Angel y Noelia caminando y llamando es lo que diferencia este mapa de Google Maps. El código es la infraestructura que mantiene esa verificación al día sin que Angel sea el chokehold.</p>

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

<h2>Por qué existe el mapa</h2>
<p>Tres frases:</p>
<ol class="list-decimal pl-5">
<li>Cabo Rojo tiene ~50,000 habitantes y ~3,900 negocios.</li>
<li>Google Maps tiene 60% de esos datos desactualizados o equivocados.</li>
<li>Si una persona en CR a las 9pm un domingo necesita un plomero, Google le da el número de un plomero que cerró en 2019.</li>
</ol>
<p>Eso es el problema. Este mapa es la solución · hecha por una sola persona con AI como único empleado.</p>

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

<h2>Las 5 personas que sirvo</h2>
<p>Sin esta gente, el mapa no tiene razón de existir.</p>
<ol class="list-decimal pl-5">
<li><strong>La vecina con un problema doméstico a las 9 PM</strong> — necesita el plomero que SÍ contesta. No los 12 que aparecen en Google.</li>
<li><strong>El turista que se queda 4 días en una casa alquilada</strong> — laundromat · farmacia domingo · plomero por un goteo. NO necesita "los 10 mejores restaurantes" — eso lo encuentra solo.</li>
<li><strong>La persona que vuelve después de 10 años fuera</strong> — qué sigue abierto · qué cerró · dónde queda lo que era de su abuela.</li>
<li><strong>El dueño de negocio en Cabo Rojo</strong> — badge "verificado" gratis si alguien llama y confirma. Vitrina ($799/año) opcional.</li>
<li><strong>El dev / periodista / agencia</strong> — <code>api.vecinoai.com</code> Pro $99/mes para acceso programático.</li>
</ol>
<p>Más allá: cualquier alcalde o municipalidad que quiera replicar este modelo en SU pueblo. Open-source. Replicable.</p>

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
<li>Mes 8 sin $10K ARR → este es lifestyle business · no Tier S asset</li>
<li>Semana 6 freshness top 200 <60% → 25 verifications/sem no es realista</li>
<li>Angel tiempo operativo >3h/sem → la automation no funcionó · refactor</li>
</ol>
<p class="text-sm text-slate-600">Estas no son threats vagas. Son cláusulas explícitas. Si una se hit, el proyecto se honesta y muere o cambia. Sin spin.</p>

<h2>Cómo medimos (vivo en <a href="/transparencia" class="text-teal-600 hover:underline">/transparencia</a>)</h2>
<p>Una métrica madre + 11 métricas auxiliares.</p>
<p><strong>Métrica madre:</strong> <code>verification_freshness % en subset top 200</code></p>
<p>Si esto baja del 80% durante 2 meses consecutivos, todo el proyecto se cuestiona.</p>

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
    title: 'Visión · Hacia dónde camina el mapa',
    description: 'Visión pública: hacia dónde camina · qué nos mata · cómo nos medimos · por qué importa más allá de Cabo Rojo.',
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

<p class="text-lg text-slate-600 mt-4">Build-in-public. Estas son las ideas Tier 3 que estamos pensando construir en los próximos 6-12 meses. Algunas se van a hacer. Otras se van a matar. Si una te resuena (o te asusta), escríbeme.</p>

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
<li><strong>Downside:</strong> -$15,980 ARR si 20 sign up · sponsors actuales molestos</li>
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

// =============== HANDLER ===============

export default async function handler(req: any, res: any) {
  const page = String(req.query.page || '')

  switch (page) {
    case 'mision': return handleMision(req, res)
    case 'transparencia': return await handleTransparencia(req, res)
    case 'equipo': return handleEquipo(req, res)
    case 'vision': return handleVision(req, res)
    case 'moonshots': return handleMoonshots(req, res)
    default:
      res.status(404).send('Page not found')
  }
}
