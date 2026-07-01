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
import { createHash, createHmac, timingSafeEqual } from 'crypto'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
)

const SITE_URL = 'https://mapadecaborojo.com'
const PHONE_CTA = '787-417-7711'
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const FROM_EMAIL = 'MapaDeCaboRojo <newsletter@mapadecaborojo.com>'
const REPLY_TO = 'angel@angelanderson.com'

// =============== SHARED LAYOUT ===============

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Newsletter subscribe form — reusable across pages.
// Native form submission with progressive enhancement via inline JS for fetch + inline status.
function subscribeForm(source: string, opts?: { compact?: boolean; audience?: string }): string {
  const compact = opts?.compact ?? false
  const formId = `nl-${source.replace(/[^a-z0-9]/gi, '-')}-${Math.random().toString(36).slice(2, 7)}`
  const audienceTag = opts?.audience ? `<input type="hidden" name="audience" value="${escapeHtml(opts.audience)}">` : ''

  if (compact) {
    return `<form id="${formId}" class="not-prose flex flex-col sm:flex-row gap-2 max-w-md" data-subscribe-form>
  <input type="hidden" name="source" value="${escapeHtml(source)}">
  ${audienceTag}
  <input type="text" name="company" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;" aria-hidden="true">
  <input type="email" name="email" required placeholder="tu@correo.com" class="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" autocomplete="email">
  <button type="submit" class="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold whitespace-nowrap">Suscríbete</button>
  <div class="text-xs text-slate-500 mt-1 hidden" data-subscribe-status></div>
</form>`
  }

  return `<form id="${formId}" class="not-prose bg-white border border-slate-200 rounded-xl p-5 mt-3" data-subscribe-form>
  <p class="text-base font-bold text-slate-900 mb-1">📬 Recibe el espejo del pueblo · mensual</p>
  <p class="text-sm text-slate-600 mb-3">Updates de qué busca Cabo Rojo, verificaciones, oportunidades — directo a tu correo. Sin spam.</p>
  <input type="hidden" name="source" value="${escapeHtml(source)}">
  ${audienceTag}
  <input type="text" name="company" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;" aria-hidden="true">
  <div class="flex flex-col sm:flex-row gap-2">
    <input type="email" name="email" required placeholder="tu@correo.com" class="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" autocomplete="email">
    <button type="submit" class="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold whitespace-nowrap">Suscríbete</button>
  </div>
  <div class="text-xs text-slate-500 mt-2 hidden" data-subscribe-status></div>
  <p class="text-[10px] text-slate-400 mt-2 italic">Si te sirve, llégate. Si no, "Unsubscribe" un click y listo.</p>
</form>`
}

// JS handler injected once per page — handles all data-subscribe-form elements.
const SUBSCRIBE_FORM_SCRIPT = `
<script>
document.addEventListener('submit', async function(e) {
  var form = e.target;
  if (!form.matches('[data-subscribe-form]')) return;
  e.preventDefault();
  var btn = form.querySelector('button[type="submit"]');
  var status = form.querySelector('[data-subscribe-status]');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
  if (status) { status.classList.remove('hidden'); status.className = 'text-xs text-slate-500 mt-2'; status.textContent = ''; }
  try {
    var fd = new FormData(form);
    var body = {};
    fd.forEach(function(v, k) { body[k] = v; });
    var r = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    var data = await r.json();
    if (r.ok && data.ok) {
      if (status) { status.className = 'text-sm text-teal-700 mt-2 font-semibold'; status.textContent = '✓ ' + (data.message || 'Listo. Te enviamos un correo de bienvenida.'); }
      form.querySelector('input[name="email"]').value = '';
    } else {
      if (status) { status.className = 'text-sm text-red-600 mt-2'; status.textContent = '✗ ' + (data.error || 'Error · intenta de nuevo o textea al 787-417-7711'); }
    }
  } catch (err) {
    if (status) { status.className = 'text-sm text-red-600 mt-2'; status.textContent = '✗ Error de red · intenta de nuevo'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Suscríbete'; }
  }
});
</script>
`

function layout(opts: {
  title: string
  description: string
  slug: string
  bodyHtml: string
  jsonLd?: object
  ogImage?: string  // custom OG image path (relative or absolute); falls back to menos-revolu canonical OG
  host?: string     // serving host header — switches branding (registromedicopr.com gets its own shell)
  canonicalHost?: string // force canonical/og base to a specific origin (SEO consolidation across domains)
  canonicalUrl?: string  // full canonical URL override (e.g. the clean root) — wins over host+slug
  lang?: 'es' | 'en'     // registry pages can render English for the diaspora
}): string {
  // Host-aware branding. registromedicopr.com is its OWN property — not Mapa de Cabo Rojo.
  const isReg = /registromedicopr\.com/i.test(opts.host || '')
  const isEn = opts.lang === 'en'
  const langHref = `/${opts.slug}?lang=${isEn ? 'es' : 'en'}`
  const canonicalBase = opts.canonicalHost || (isReg ? 'https://registromedicopr.com' : SITE_URL)
  const brandName = isReg ? 'Registro Médico PR' : 'Mapa de Cabo Rojo'
  const GA = 'G-6KBMV0LKQ4'
  const canonical = opts.canonicalUrl || `${canonicalBase}/${opts.slug}`
  const jsonLd = opts.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(opts.jsonLd)}</script>`
    : ''

  // OG image — per-page if provided, else fall back to canonical /menos-revolu OG.
  const ogImagePath = opts.ogImage || '/og/menos-revolu.png'
  const ogImageUrl = ogImagePath.startsWith('http')
    ? ogImagePath
    : `${canonicalBase}${ogImagePath}`

  // --- Header (host-aware) ---
  const header = isReg ? `
<header class="bg-white border-b border-slate-200 sticky top-0 z-10">
<div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
<a href="/registro" class="flex items-center gap-2 text-slate-900 hover:text-teal-700">
<div class="bg-teal-700 w-8 h-8 rounded-lg flex items-center justify-center text-white">
<i class="fa-solid fa-user-doctor text-sm"></i>
</div>
<span class="font-black tracking-tight">Registro Médico PR</span>
</a>
<div class="flex items-center gap-3">
<nav class="hidden md:flex gap-5 text-sm text-slate-600">
<a href="/registro${isEn ? '?lang=en' : ''}" class="hover:text-teal-700">${isEn ? 'Find a specialist' : 'Buscar especialista'}</a>
<a href="/registro#como-se-hizo" class="hover:text-teal-700">${isEn ? 'How it works' : 'Cómo se verifica'}</a>
</nav>
<a href="${langHref}" class="text-xs font-bold text-slate-500 hover:text-teal-700 border border-slate-200 rounded-lg px-2.5 py-1.5" aria-label="Language">${isEn ? 'ES' : 'EN'}</a>
<button id="theme-toggle" type="button" aria-label="Theme" class="w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:border-teal-400 flex items-center justify-center"><i class="fa-solid fa-moon" id="theme-icon"></i></button>
</div>
</div>
</header>` : `
<header class="bg-white border-b border-slate-200 sticky top-0 z-10">
<div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
<a href="/" class="flex items-center gap-2 text-slate-900 hover:text-teal-600">
<div class="bg-teal-600 w-8 h-8 rounded-lg flex items-center justify-center text-white">
<i class="fa-solid fa-map-location-dot text-sm"></i>
</div>
<span class="font-black tracking-tight">Mapa de Cabo Rojo</span>
</a>
<nav class="hidden md:flex gap-4 text-sm text-slate-600 flex-wrap">
<a href="/menos-revolu" class="hover:text-teal-600">Menos Revolú</a>
<a href="/tienda" class="hover:text-teal-600 font-semibold text-teal-700">Tienda</a>
<a href="/pon-tu-negocio-en-el-mapa" class="hover:text-teal-600 font-semibold text-teal-700">Pon tu negocio</a>
<a href="/mira-la-vuelta" class="hover:text-teal-600">Mira la vuelta</a>
<a href="/senales-del-pueblo" class="hover:text-teal-600">Señales</a>
<a href="/transparencia" class="hover:text-teal-600">Transparencia</a>
<a href="/equipo" class="hover:text-teal-600">Equipo</a>
</nav>
</div>
</header>`

  // --- Footer (host-aware). Registro = quiet, no newsletter/tienda; desiertos kept low-key. ---
  const footer = isReg ? `
<footer class="border-t border-slate-200 mt-12 py-8 bg-white">
<div class="max-w-4xl mx-auto px-4 text-center">
<p class="text-base font-semibold text-teal-800">El registro verificado de especialistas médicos de Puerto Rico.</p>
<p class="text-xs text-slate-500 mt-1">Cada nombre verificado contra el registro federal NPPES/CMS. En español, por especialidad y por región.</p>
<div class="mt-6 flex justify-center gap-4 text-xs text-slate-500 flex-wrap">
<a href="/registro" class="hover:text-teal-700 font-semibold">Buscar especialista</a>
<a href="/registro/desiertos" class="hover:text-teal-700">Acceso por región</a>
<a href="/observatorio" class="hover:text-teal-700">Observatorio</a>
<a href="/registro#como-se-hizo" class="hover:text-teal-700">Cómo se verifica</a>
</div>
<p class="mt-4 text-xs text-slate-400">¿Dudas de a quién ir? Escríbele al Veci: <strong>${PHONE_CTA}</strong>. Si te sirve, llégate.</p>
</div>
</footer>` : `
<footer class="border-t border-slate-200 mt-12 py-8 bg-white">
<div class="max-w-4xl mx-auto px-4 text-center">
<p class="text-base font-semibold text-teal-700">Menos revolú. Mejores decisiones. Mejor vida.</p>
<p class="text-xs text-slate-500 mt-1">El mapa vivo pa' poner orden en el revolú de Cabo Rojo.</p>

<div class="mt-5 mx-auto max-w-md">
  <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">📬 Recibe el espejo del pueblo · mensual</p>
  ${subscribeForm(`footer-${opts.slug}`, { compact: true })}
</div>

<div class="mt-6 flex justify-center gap-4 text-xs text-slate-500 flex-wrap">
<a href="/menos-revolu" class="hover:text-teal-600 font-semibold">Menos Revolú</a>
<a href="/tienda" class="hover:text-teal-600 font-semibold text-teal-700">Tienda</a>
<a href="/mision" class="hover:text-teal-600">Misión</a>
<a href="/pon-tu-negocio-en-el-mapa" class="hover:text-teal-600">Pon tu negocio</a>
<a href="/mira-la-vuelta" class="hover:text-teal-600">Mira la vuelta</a>
<a href="/senales-del-pueblo" class="hover:text-teal-600">Señales del pueblo</a>
<a href="/transparencia" class="hover:text-teal-600">Transparencia</a>
<a href="/equipo" class="hover:text-teal-600">Equipo</a>
<a href="/historia" class="hover:text-teal-600">Historia</a>
<a href="/vision" class="hover:text-teal-600">Visión</a>
<a href="/preguntas" class="hover:text-teal-600">Preguntas</a>
<a href="/moonshots" class="hover:text-teal-600">Moonshots</a>
</div>
<p class="mt-4 text-xs text-slate-400">Textea al <strong>${PHONE_CTA}</strong> · El Veci te contesta. Si te sirve, llégate. Si no, sigue tu camino.</p>
</div>
</footer>`

  return `<!DOCTYPE html>
<html lang="es-PR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.title)} · ${brandName}</title>
<meta name="description" content="${escapeHtml(opts.description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${escapeHtml(opts.title)}">
<meta property="og:description" content="${escapeHtml(opts.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${brandName}">
<meta property="og:image" content="${ogImageUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="es_PR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${ogImageUrl}">
<link rel="icon" href="/favicon.ico">
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA}');</script>
<script defer src="/_vercel/insights/script.js"></script>
${isReg ? `<script>(function(){try{var m=localStorage.getItem('theme');var d=m?(m==='dark'):window.matchMedia('(prefers-color-scheme:dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();</script>` : ''}
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
  .prose-narrative th, .prose-narrative td { border: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; text-align: left; vertical-align: top; }
  .prose-narrative th { background: #f1f5f9; font-weight: 600; }
  @media (max-width: 640px) {
    .prose-narrative table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; font-size: 0.82rem; }
    .prose-narrative th, .prose-narrative td { padding: 0.4rem 0.5rem; min-width: 7.5rem; }
    .prose-narrative td:first-child, .prose-narrative th:first-child { min-width: 12rem; }
  }
</style>
${isReg ? `<style>
html.dark body{background:#0f172a !important;color:#e2e8f0;}
html.dark .bg-slate-50{background-color:#0f172a !important;}
html.dark .bg-white{background-color:#1e293b !important;}
html.dark .bg-slate-100{background-color:#1e293b !important;}
html.dark .text-slate-900{color:#f1f5f9 !important;}
html.dark .text-slate-800{color:#e2e8f0 !important;}
html.dark .text-slate-700,html.dark .text-slate-600{color:#cbd5e1 !important;}
html.dark .text-slate-500,html.dark .text-slate-400{color:#94a3b8 !important;}
html.dark .border-slate-200,html.dark .border-slate-100{border-color:#334155 !important;}
html.dark .border-slate-300{border-color:#475569 !important;}
html.dark thead tr.bg-slate-50,html.dark thead tr{background-color:#1e293b !important;}
html.dark .prose-narrative th{background:#1e293b;}
html.dark .prose-narrative th,html.dark .prose-narrative td{border-color:#334155;}
html.dark .prose-narrative blockquote{color:#94a3b8;}
html.dark .bg-teal-50{background-color:#134e4a !important;}
html.dark .bg-emerald-50{background-color:#064e3b !important;}
html.dark .bg-amber-50{background-color:#451a03 !important;}
html.dark .bg-red-50,html.dark .bg-red-100{background-color:#450a0a !important;}
html.dark .border-teal-200,html.dark .border-teal-300{border-color:#0f766e !important;}
html.dark .border-emerald-200{border-color:#047857 !important;}
html.dark .border-amber-200,html.dark .border-amber-300{border-color:#b45309 !important;}
html.dark .border-red-200,html.dark .border-red-300{border-color:#b91c1c !important;}
html.dark .text-teal-800,html.dark .text-teal-700{color:#5eead4 !important;}
html.dark .text-emerald-800{color:#6ee7b7 !important;}
html.dark .text-amber-900,html.dark .text-amber-800,html.dark .text-amber-700{color:#fcd34d !important;}
html.dark .text-red-700,html.dark .text-red-600{color:#fca5a5 !important;}
html.dark input,html.dark select{background-color:#1e293b !important;color:#e2e8f0 !important;border-color:#475569 !important;}
html.dark input::placeholder{color:#64748b !important;}
/* Search results are injected by JS with inline hex styles — override them in dark mode */
html.dark #rg-result [style*="color:#0f172a"],html.dark #rg-search-result [style*="color:#0f172a"]{color:#f1f5f9 !important;}
html.dark #rg-result [style*="color:#475569"],html.dark #rg-search-result [style*="color:#475569"],html.dark #rg-result [style*="color:#334155"],html.dark #rg-search-result [style*="color:#334155"]{color:#cbd5e1 !important;}
html.dark #rg-result [style*="color:#64748b"],html.dark #rg-search-result [style*="color:#64748b"]{color:#94a3b8 !important;}
html.dark #rg-result [style*="color:#0f766e"],html.dark #rg-search-result [style*="color:#0f766e"]{color:#5eead4 !important;}
html.dark #rg-result [style*="#e2e8f0"],html.dark #rg-search-result [style*="#e2e8f0"]{border-color:#334155 !important;}
html.dark #rg-result [style*="background:#ecfdf5"]{background:#064e3b !important;border-color:#047857 !important;}
html.dark #rg-result [style*="background:#fffbeb"]{background:#451a03 !important;border-color:#b45309 !important;}
html.dark #rg-result [style*="background:#fef2f2"]{background:#450a0a !important;border-color:#b91c1c !important;}
html.dark #rg-search-result button[style]{background:#1e293b !important;border-color:#0f766e !important;color:#5eead4 !important;}
</style>` : ''}
${jsonLd}
</head>
<body class="bg-slate-50 text-slate-900">
${header}
<main class="max-w-3xl mx-auto px-4 py-8 prose-narrative">
${opts.bodyHtml}
</main>
${footer}
${isReg ? `<script>(function(){var t=document.getElementById('theme-toggle'),ic=document.getElementById('theme-icon');function set(d){document.documentElement.classList.toggle('dark',d);if(ic)ic.className=d?'fa-solid fa-sun':'fa-solid fa-moon';try{localStorage.setItem('theme',d?'dark':'light');}catch(e){}}if(ic)ic.className=document.documentElement.classList.contains('dark')?'fa-solid fa-sun':'fa-solid fa-moon';if(t)t.addEventListener('click',function(){set(!document.documentElement.classList.contains('dark'));});})();</script>` : SUBSCRIBE_FORM_SCRIPT}
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
    ogImage: '/og/mision.png',
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

<p class="text-lg text-slate-600 mt-4">Honestidad antes que números bonitos. Aquí ves exactamente cómo va el mapa por <strong>el lado de oferta</strong> — el subset crítico, el total, los gaps, las acciones de la semana.</p>
<p class="text-sm text-slate-500">Update diario · automático · sin filtros. Si la métrica baja, lo dice. Si subimos, lo dice. Si fallamos, lo dice.</p>
<p class="text-sm text-slate-600 mt-2">¿Buscas el otro lado — <strong>la demanda en vivo</strong> (qué busca la gente hoy, qué falta encontrar)? Mira <a href="/senales-del-pueblo" class="text-teal-600 hover:underline font-semibold">/señales-del-pueblo</a>.</p>
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
    ogImage: '/og/transparencia.png',
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
    ogImage: '/og/equipo.png',
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
    ogImage: '/og/vision.png',
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
    ogImage: '/og/moonshots.png',
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

async function handleMiraLaVuelta(_req: any, res: any) {
  // Live demand data — top searches last 30 days
  let topSearches: any[] = []
  try {
    const { data } = await supabase.from('mv_top_searches_30d').select('*').limit(8)
    topSearches = data || []
  } catch (e) {
    topSearches = []
  }

  const liveBlock = topSearches.length > 0
    ? `
<h2>🔥 Demanda real · últimos 30 días (live)</h2>
<p class="text-sm text-slate-600">Lo que la gente le está texteando al bot *7711 esta semana. Si tu categoría sale aquí, hay demanda real esperando supply.</p>
<table class="text-sm">
<thead><tr><th class="text-right">#</th><th>Categoría buscada</th><th class="text-right">Veces (30d)</th></tr></thead>
<tbody>${topSearches.map((s: any, i: number) => `
<tr>
  <td class="text-right text-slate-400 pr-2">${i + 1}.</td>
  <td class="font-semibold">${escapeHtml(s.q_norm || s.query || s.term || '—')}</td>
  <td class="text-right text-teal-600 font-bold">${s.cnt || s.count || s.searches || '?'}</td>
</tr>`).join('')}</tbody>
</table>
<p class="text-xs text-slate-500 mt-2 italic">Updated diario. Pa' ver matemática completa categoría por categoría → <a href="/pueblo-en-numeros" class="text-teal-600 hover:underline font-semibold">/pueblo-en-numeros</a>. Pa' ver todas las señales → <a href="/senales-del-pueblo" class="text-teal-600 hover:underline font-semibold">/señales-del-pueblo</a>.</p>
`
    : ''

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

${liveBlock}

<h2>Ejemplos editoriales — categorías con demanda crónica</h2>
<p>Categorías que el bot *7711 recibe consistentemente pero el directorio tiene casi nadie listed:</p>
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

<h2>Recibe el Reporte de Oportunidades · mensual</h2>
<p>Compilamos las señales del mes en un correo — top demanda, categorías 🔥, zonas calientes. Sin spam. Pa' emprendedores e inversionistas que prefieren leer antes de moverse.</p>
${subscribeForm('mira-la-vuelta', { audience: 'emprendedor' })}

<!-- §17 share block — comparte el espejo -->
<h2>Comparte el espejo</h2>
<p>Si conoces a alguien que está pensando abrir negocio (o ya abrió y va lento) — mándale este espejo. Si lo lee antes de firmar el préstamo, le ahorra meses de pérdida.</p>
<div class="flex flex-col sm:flex-row gap-2 not-prose">
  <a href="https://wa.me/?text=${encodeURIComponent('Mira la vuelta antes de abrir negocio en Cabo Rojo — el bot *7711 mide qué busca la gente y dónde no hay competencia: https://www.mapadecaborojo.com/mira-la-vuelta')}" target="_blank" rel="noopener" class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold no-underline">
    <i class="fa-brands fa-whatsapp text-lg"></i>
    Compartir por WhatsApp
  </a>
  <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://www.mapadecaborojo.com/mira-la-vuelta')}" target="_blank" rel="noopener" class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold no-underline">
    <i class="fa-brands fa-facebook-f text-lg"></i>
    Compartir en Facebook
  </a>
</div>

<div class="bg-teal-50 border border-teal-200 rounded-lg p-6 mt-8 text-center">
<p class="text-lg font-semibold">Antes de abrir otro negocio igual, mira la vuelta.</p>
<p class="mt-2"><a href="sms:+17874177711?body=VUELTA" class="text-teal-600 font-bold underline">Textea VUELTA + tu categoría al ${PHONE_CTA}</a></p>
<p class="text-sm text-slate-600 mt-2 italic">Te mando la matemática específica de tu categoría + las 3 banderas pa' revisar antes de firmar contrato. Gratis. Sin agendas.</p>
</div>
`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // Shorter cache because live demand data updates daily
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600')
  res.status(200).send(layout({
    title: 'Mira la vuelta · Reporte de Oportunidades Locales',
    description: 'Antes de meter chavos, mira la vuelta. Demanda real, zonas calientes, categorías saturadas. Pa\' emprendedores e inversionistas que leen el mapa antes de firmar.',
    slug: 'mira-la-vuelta',
    ogImage: '/og/mira-la-vuelta.png',
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
    ogImage: '/og/pon-tu-negocio-en-el-mapa.png',
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

// =============== /señales-del-pueblo ===============

async function handleSenalesDelPueblo(_req: any, res: any) {
  // Live data binding — pull demand signals from materialized views
  let topSearches: any[] = []
  let recentVerifs: any[] = []
  let weeklyTrends: any[] = []
  let dataFailed = false
  try {
    const [topRes, verifRes, weeklyRes] = await Promise.all([
      supabase.from('mv_top_searches_30d').select('*').limit(15),
      supabase.from('mv_recent_verifications').select('*').limit(10),
      // Last 12 weeks of demand_weekly — for trend sparklines
      supabase
        .from('demand_weekly')
        .select('category, week_start, total_searches')
        .gte('week_start', new Date(Date.now() - 84 * 86400000).toISOString().slice(0, 10))
        .order('week_start', { ascending: true }),
    ])
    topSearches = topRes.data || []
    recentVerifs = verifRes.data || []
    weeklyTrends = weeklyRes.data || []
    if (topRes.error && verifRes.error) dataFailed = true
  } catch (e) {
    dataFailed = true
  }

  // Aggregate weekly trends by category — get top 8 by total volume + their 12-week series
  type TrendPoint = { week: string; count: number }
  const trendsByCategory: Record<string, TrendPoint[]> = {}
  for (const row of weeklyTrends) {
    const cat = row.category as string
    if (!cat) continue
    if (!trendsByCategory[cat]) trendsByCategory[cat] = []
    trendsByCategory[cat].push({ week: row.week_start, count: row.total_searches })
  }
  const topTrends = Object.entries(trendsByCategory)
    .map(([cat, series]) => ({
      cat,
      series,
      total: series.reduce((s, p) => s + p.count, 0),
    }))
    .filter(t => t.series.length >= 2 && t.total >= 5)  // need at least 2 data points + 5 total
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  // SVG sparkline generator
  const renderSparkline = (series: TrendPoint[], total: number) => {
    if (series.length < 2) return ''
    const W = 160
    const H = 36
    const PAD = 2
    const values = series.map(p => p.count)
    const maxV = Math.max(...values, 1)
    const minV = Math.min(...values, 0)
    const range = maxV - minV || 1
    const stepX = (W - PAD * 2) / (series.length - 1)
    const points = series.map((p, i) => {
      const x = PAD + i * stepX
      const y = H - PAD - ((p.count - minV) / range) * (H - PAD * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
    // Last point dot
    const lastP = series[series.length - 1]
    const lastX = PAD + (series.length - 1) * stepX
    const lastY = H - PAD - ((lastP.count - minV) / range) * (H - PAD * 2)
    // Trend direction: compare last week vs avg of prior
    const lastVal = series[series.length - 1].count
    const priorAvg = series.slice(0, -1).reduce((s, p) => s + p.count, 0) / Math.max(series.length - 1, 1)
    const trend = lastVal > priorAvg * 1.15 ? '↑' : lastVal < priorAvg * 0.85 ? '↓' : '→'
    const trendColor = trend === '↑' ? '#0d9488' : trend === '↓' ? '#dc2626' : '#64748b'
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" aria-label="Tendencia ${series.length} semanas">
  <polyline points="${points}" fill="none" stroke="#0d9488" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="2.5" fill="#0d9488"/>
</svg>
<span style="font-size:13px;font-weight:700;color:${trendColor};margin-left:6px;">${trend}</span>`
  }

  const failBanner = dataFailed
    ? `<div class="bg-amber-50 border-l-4 border-amber-400 p-4 my-4 rounded-r-lg">
  <p class="font-semibold text-amber-900">⚠️ Los números no están actualizando ahora mismo.</p>
  <p class="text-sm text-amber-800 mt-1">El sistema que mide está temporal con problema. Vuelve en 10-15 minutos. Si persiste, textea al <strong>${PHONE_CTA}</strong>.</p>
</div>`
    : ''

  const topSearchesRows = topSearches.length > 0
    ? topSearches.map((s: any, i: number) => `
        <tr>
          <td class="text-right text-slate-400 pr-2">${i + 1}.</td>
          <td class="font-semibold">${escapeHtml(s.q_norm || s.query || s.term || '—')}</td>
          <td class="text-right text-teal-600 font-bold">${s.cnt || s.count || s.searches || '?'}</td>
        </tr>`).join('')
    : `<tr><td colspan="3" class="text-center text-slate-500 italic py-4">Cargando señales en vivo…</td></tr>`

  const recentVerifsRows = recentVerifs.length > 0
    ? recentVerifs.slice(0, 8).map((v: any) => `
        <tr>
          <td class="font-semibold">${escapeHtml(v.name || '—')}</td>
          <td class="text-sm text-slate-500">${escapeHtml(v.category || v.subcategory || '—')}</td>
          <td class="text-xs text-slate-400 text-right">${v.last_verified_at ? new Date(v.last_verified_at).toLocaleDateString('es-PR', { month: 'short', day: 'numeric' }) : '—'}</td>
        </tr>`).join('')
    : `<tr><td colspan="3" class="text-center text-slate-500 italic py-4">Cargando verificaciones recientes…</td></tr>`

  const body = `
<h1>Las señales del pueblo, en vivo.</h1>

<p class="text-lg text-slate-600 mt-4">Cada búsqueda, clic, mensaje y pregunta al bot *7711 deja una pista. <strong>El mapa convierte esas pistas en señales reales de demanda local.</strong> Esta página muestra esas señales actualizadas todos los días — el lado de <em>demanda</em>.</p>
<p class="text-sm text-slate-600">¿Buscas el otro lado — <strong>la oferta</strong> (qué está verificado, qué falta verificar)? Mira <a href="/transparencia" class="text-teal-600 hover:underline font-semibold">/transparencia</a>.</p>
${failBanner}

<!-- WIIFM 3-chip -->
<div class="grid sm:grid-cols-3 gap-3 mt-6 not-prose">
  <div class="bg-teal-50 border border-teal-200 rounded-lg p-4">
    <div class="text-xs font-bold text-teal-700 uppercase tracking-wide mb-2">¿Qué significa?</div>
    <p class="text-sm text-slate-700 leading-snug">Son las búsquedas y preguntas reales que la gente le hace al directorio + al bot *7711. Sin filtros. Sin top picks subjetivos.</p>
  </div>
  <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
    <div class="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">¿Por qué importa?</div>
    <p class="text-sm text-slate-700 leading-snug">Esto te dice qué busca Cabo Rojo HOY — no qué decía la gente hace 5 años, no qué crees que pide la gente, no qué quisieras que pidieran.</p>
  </div>
  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <div class="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">¿Qué hago con esto?</div>
    <p class="text-sm text-slate-700 leading-snug">Si tienes negocio en una de estas categorías — <a href="/pon-tu-negocio-en-el-mapa" class="text-blue-700 underline font-semibold">reclama tu perfil</a>. Si vas a abrir — <a href="/mira-la-vuelta" class="text-blue-700 underline font-semibold">mira la vuelta</a> primero.</p>
  </div>
</div>

${topTrends.length > 0 ? `
<h2>📈 Tendencia por categoría · últimas 12 semanas</h2>
<p class="text-sm text-slate-600">Sparklines de búsquedas semanales del bot por categoría. ↑ subiendo · ↓ bajando · → estable. Compara semana vs promedio.</p>
<div class="grid sm:grid-cols-2 gap-3 not-prose mt-3">
${topTrends.map(t => `
<div class="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
  <div class="flex-1 min-w-0">
    <p class="font-bold text-sm text-slate-900 truncate">${escapeHtml(t.cat)}</p>
    <p class="text-xs text-slate-500">${t.total} búsquedas · ${t.series.length} sem</p>
  </div>
  <div class="flex items-center shrink-0">
    ${renderSparkline(t.series, t.total)}
  </div>
</div>`).join('')}
</div>
<p class="text-xs text-slate-500 mt-3 italic">Tendencia = última semana vs promedio anterior. Updated semanal. Sin spin: si una categoría sube por un evento puntual, la sparkline lo muestra. La data está fría hasta que se acumula.</p>
` : ''}

<h2>🔍 Top 15 búsquedas del bot · últimos 30 días</h2>
<p class="text-sm text-slate-600">Estas son las preguntas reales que la gente le textea al *7711 — qué buscan, qué necesitan resolver. Updated diario.</p>
<table class="text-sm">
<thead><tr><th class="text-right">#</th><th>Búsqueda</th><th class="text-right">Veces</th></tr></thead>
<tbody>${topSearchesRows}</tbody>
</table>

<p class="text-xs text-slate-500 mt-2 italic">Cada fila = una pista de demanda. Si tu categoría aparece arriba, hay gente buscando lo que tú ofreces. Si NO aparece nadie de tu categoría — quizás están buscando con otra palabra. Textea al ${PHONE_CTA} y lo investigamos.</p>

<h2>✅ Verificaciones recientes</h2>
<p class="text-sm text-slate-600">Los últimos negocios que se confirmaron a mano (llamada · visita · email). Esto es la prueba de que el mapa vive.</p>
<table class="text-sm">
<thead><tr><th>Negocio</th><th>Categoría</th><th class="text-right">Verificado</th></tr></thead>
<tbody>${recentVerifsRows}</tbody>
</table>

<h2>💡 Cómo se convierte demanda en oportunidad</h2>
<p>Cada vez que alguien busca algo en el directorio o textea al bot y NO encuentra resultado — eso es <strong>señal pre-supply</strong>. Demanda sin oferta visible.</p>

<p>Si esa categoría se repite (10+ búsquedas / mes con 0-2 negocios listed), aparece con bandera 🔥 en <a href="/pueblo-en-numeros" class="text-teal-600 hover:underline font-semibold">la tabla del pueblo</a>. Eso quiere decir: <strong>el pueblo te necesita.</strong></p>

<p>Ejemplos vivos hoy (mayo 2026):</p>
<ul>
<li>🔥 <strong>Plomero</strong> — decenas de búsquedas, directorio casi vacío. Demanda emergencia (sábado 6pm, fugas, etc.)</li>
<li>🔥 <strong>Aire acondicionado / AC tech</strong> — domingos con 90 grados afuera, demanda emergencia</li>
<li>🔥 <strong>Electricista</strong> — cortes de luz, breakers tripped, demanda emergencia</li>
<li>🔥 <strong>Cardiólogo · ginecólogo · especialistas médicos</strong> — gente viaja a SJ por falta local</li>
<li>🔥 <strong>Repostería con licencia</strong> — economía informal grande, opciones visibles casi cero</li>
</ul>

<p>Si tienes la habilidad y entras al directorio, eres el primero que el bot recomienda. Cero competencia visible.</p>

<h2>🗺️ Qué hace el mapa con estas señales</h2>
<p>Estas señales no se quedan en una pantalla. Se convierten en:</p>
<ol class="list-decimal pl-5">
<li><strong>Acciones de verificación</strong> — si una categoría se busca mucho pero el directorio tiene pocos, esos negocios suben al subset crítico (top 200 que verificamos cada 90 días)</li>
<li><strong>Pitches a sponsors</strong> — el agente <em>Sponsor Pipeline Filler</em> mira estas señales cada lunes y arma propuestas pa' negocios con alta demanda</li>
<li><strong>Insights pa' emprendedores e inversionistas</strong> — base del <a href="/mira-la-vuelta" class="text-teal-600 hover:underline font-semibold">Reporte de Oportunidades Locales</a></li>
<li><strong>Contenido editorial</strong> — la página Facebook publica los hallazgos cuando importan</li>
<li><strong>Nuevos sub-categorías</strong> — si la gente busca "plomero" mucho, agregamos sub-página /categoria/plomero (ya pasó)</li>
</ol>

<h2>📊 Qué NO está aquí (todavía)</h2>
<p>Honestidad sobre los límites:</p>
<ul>
<li><strong>Gráfica de tendencias por semana</strong> — pendiente Phase 2 (charts visuales)</li>
<li><strong>Heat map por barrio</strong> — pendiente Phase 2 (señales geo-localizadas)</li>
<li><strong>Categorías cross-tabuladas con audiencias</strong> — pendiente Phase 3 (turista vs residente)</li>
<li><strong>Conversión búsqueda → contacto</strong> — pendiente Phase 3 (privacy: requiere consentimiento)</li>
</ul>

<p>Pa' ver la matemática completa de oferta + demanda (TAM/SAM/SOM por categoría · densidad per cápita · zonas concentradas), abre <a href="/pueblo-en-numeros" class="text-teal-600 hover:underline font-semibold">/pueblo-en-numeros</a>.</p>

<h2>Recibe estas señales en tu correo · mensual</h2>
<p>Compilamos el espejo del mes — top búsquedas, categorías saturadas, oportunidades pre-supply. Una vez al mes. Sin spam.</p>
${subscribeForm('senales-del-pueblo', { audience: 'general' })}

<h2>Comparte el espejo del pueblo</h2>
<p>Esto es lo que la gente está buscando esta semana. Si conoces a alguien con un negocio que podría servir lo que el pueblo pide — mándaselo. Si conoces alguien pensando en abrir — más todavía.</p>
<div class="flex flex-col sm:flex-row gap-2 not-prose">
  <a href="https://wa.me/?text=${encodeURIComponent('El espejo del pueblo: qué busca Cabo Rojo esta semana, en vivo del bot *7711. Si lo que vendes está aquí — el pueblo te necesita: https://www.mapadecaborojo.com/senales-del-pueblo')}" target="_blank" rel="noopener" class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold no-underline">
    <i class="fa-brands fa-whatsapp text-lg"></i>
    Compartir por WhatsApp
  </a>
  <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://www.mapadecaborojo.com/senales-del-pueblo')}" target="_blank" rel="noopener" class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold no-underline">
    <i class="fa-brands fa-facebook-f text-lg"></i>
    Compartir en Facebook
  </a>
</div>

<div class="bg-teal-50 border border-teal-200 rounded-lg p-6 mt-8 text-center">
<p class="text-lg font-semibold">¿Vas a abrir negocio? ¿Tienes negocio que no aparece aquí?</p>
<p class="mt-2"><a href="sms:+17874177711" class="text-teal-600 font-bold underline">Textea al ${PHONE_CTA}</a></p>
<p class="text-sm text-slate-600 mt-2 italic">Si tu categoría sale arriba en las búsquedas — el pueblo te está pidiendo. Si no sale — quizás están buscando con otra palabra. Lo investigamos juntos.</p>
</div>
`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600') // shorter cache — data updates daily
  res.status(200).send(layout({
    title: 'Señales del pueblo · Demanda local en vivo',
    description: 'Las búsquedas reales del pueblo de Cabo Rojo, en vivo. Top categorías buscadas, verificaciones recientes, demanda pre-supply. Updated diario, sin filtros.',
    slug: 'senales-del-pueblo',
    ogImage: '/og/senales-del-pueblo.png',
    bodyHtml: body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'Señales del pueblo · Demanda local Cabo Rojo',
      description: 'Live demand signals from bot searches + directory queries for Cabo Rojo, PR. Top searches, recent verifications, demand-supply gaps.',
      url: `${SITE_URL}/senales-del-pueblo`,
      keywords: ['cabo rojo', 'demand signals', 'civic-tech', 'local market data'],
      isAccessibleForFree: true,
    },
  }))
}

// =============== /menos-revolu ===============
// Consolidated landing — the package §18 bloque maestro + §20 8-block layout.
// Single-URL pitch. Entry point for "what is this site?" with deep-links out
// to the 8+ dedicated pages.

function handleMenosRevolu(_req: any, res: any) {
  const body = `
<!-- Hero -->
<div class="not-prose -mt-2 mb-8">
  <p class="text-xs font-bold uppercase tracking-widest text-teal-600 mb-3">MapaDeCaboRojo.com</p>
  <h1 class="text-4xl md:text-5xl font-black text-slate-900 leading-tight">El mapa vivo pa' poner orden en el revolú de Cabo Rojo.</h1>
  <p class="text-lg text-slate-600 mt-4 leading-relaxed">Encuentra lugares, negocios, servicios y oportunidades sin perder el día buscando entre screenshots, posts viejos y recomendaciones sueltas.</p>
  <div class="mt-6 flex flex-col sm:flex-row gap-3">
    <a href="/" class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold no-underline">
      Mira el mapa antes de dar vueltas →
    </a>
    <a href="/pon-tu-negocio-en-el-mapa" class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white border-2 border-teal-600 text-teal-700 hover:bg-teal-50 font-bold no-underline">
      Pon tu negocio en el mapa
    </a>
  </div>
</div>

<!-- §5: Por qué existe -->
<h2>¿Por qué existe?</h2>
<p>Cabo Rojo tiene valor, pero mucho está regao:</p>
<ul>
<li>Negocios buenos que no se encuentran.</li>
<li>Turistas preguntando lo mismo todos los meses.</li>
<li>Residentes dando vueltas.</li>
<li>Emprendedores copiando sin mirar demanda.</li>
<li>Información escondida en screenshots, posts viejos, comentarios y recomendaciones sueltas.</li>
<li>Gente tomando decisiones por costumbre, emoción o corazonada.</li>
<li>Oportunidades que existen, pero no se ven con claridad.</li>
</ul>
<p><strong>El enemigo no es la falta de información. Es la información regada.</strong> El revolú local cuesta tiempo, dinero y oportunidades.</p>

<!-- §6: A quién ayuda -->
<h2>¿A quién ayuda?</h2>
<div class="grid sm:grid-cols-2 gap-4 not-prose">
  <a href="/" class="block bg-white border border-slate-200 hover:border-teal-400 rounded-lg p-4 no-underline">
    <div class="text-xs font-bold text-teal-700 uppercase">Al residente</div>
    <p class="text-sm text-slate-700 mt-1">Encuentra lo que necesita sin dar vueltas. Domingo 9pm se rompió algo — el plomero que SÍ contesta.</p>
  </a>
  <a href="/" class="block bg-white border border-slate-200 hover:border-teal-400 rounded-lg p-4 no-underline">
    <div class="text-xs font-bold text-teal-700 uppercase">Al turista</div>
    <p class="text-sm text-slate-700 mt-1">Disfruta Cabo Rojo sin perder medio día buscando. Laundromat · farmacia domingo · plomero pa'l goteo.</p>
  </a>
  <a href="/pon-tu-negocio-en-el-mapa" class="block bg-white border border-slate-200 hover:border-teal-400 rounded-lg p-4 no-underline">
    <div class="text-xs font-bold text-teal-700 uppercase">Al negocio local</div>
    <p class="text-sm text-slate-700 mt-1">Aparece cuando alguien ya está buscando. Badge "verificado" gratis. Vitrina ($799/año) opcional. <span class="text-teal-700 font-semibold">→ Ver oferta</span></p>
  </a>
  <a href="/mira-la-vuelta" class="block bg-white border border-slate-200 hover:border-teal-400 rounded-lg p-4 no-underline">
    <div class="text-xs font-bold text-teal-700 uppercase">Al emprendedor</div>
    <p class="text-sm text-slate-700 mt-1">Mira demanda antes de copiar. Qué se busca, qué falta, qué zona se mueve, qué categoría puede estar saturada. <span class="text-teal-700 font-semibold">→ Mira la vuelta</span></p>
  </a>
  <a href="/mira-la-vuelta" class="block bg-white border border-slate-200 hover:border-teal-400 rounded-lg p-4 no-underline">
    <div class="text-xs font-bold text-teal-700 uppercase">Al inversionista</div>
    <p class="text-sm text-slate-700 mt-1">Ve señales antes de poner dinero. Movimiento real, zonas calientes, demanda local antes de firmar. <span class="text-teal-700 font-semibold">→ Reporte de oportunidades</span></p>
  </a>
  <a href="/senales-del-pueblo" class="block bg-white border border-slate-200 hover:border-teal-400 rounded-lg p-4 no-underline">
    <div class="text-xs font-bold text-teal-700 uppercase">Al pueblo</div>
    <p class="text-sm text-slate-700 mt-1">Convierte información regada en decisiones mejores. Cabo Rojo más fácil de vivir, visitar, apoyar e invertir. <span class="text-teal-700 font-semibold">→ Señales en vivo</span></p>
  </a>
</div>

<!-- §4: Nuestra diferencia -->
<h2>Nuestra diferencia</h2>
<p><strong>Google tiene datos. Facebook tiene ruido. Nosotros tenemos contexto local.</strong></p>
<p>No somos visitantes mirando un mapa. Somos vecinos leyendo la vuelta.</p>
<p>El moat no es la tecnología. Es la confianza local, el contexto, la data propietaria, la relación con la comunidad y la capacidad de leer lo que está pasando en Cabo Rojo mejor que una plataforma genérica. <a href="/equipo" class="text-teal-600 hover:underline">Cómo funciona el equipo →</a></p>

<!-- §19: Mapa público -->
<h2>El mapa público</h2>
<p>Más de 1,134 lugares, negocios, servicios y eventos verificados a mano — un negocio a la vez, llamando al dueño.</p>
<div class="grid sm:grid-cols-3 gap-3 not-prose">
  <a href="/" class="block bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg p-3 text-center no-underline">
    <div class="text-2xl font-black text-teal-700">🗺️</div>
    <div class="text-sm font-semibold text-slate-700 mt-1">Mira el mapa</div>
  </a>
  <a href="/pueblo-en-numeros" class="block bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg p-3 text-center no-underline">
    <div class="text-2xl font-black text-teal-700">📊</div>
    <div class="text-sm font-semibold text-slate-700 mt-1">La matemática</div>
  </a>
  <a href="/transparencia" class="block bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg p-3 text-center no-underline">
    <div class="text-2xl font-black text-teal-700">📋</div>
    <div class="text-sm font-semibold text-slate-700 mt-1">Métricas en vivo</div>
  </a>
</div>

<!-- §13: Pon tu negocio -->
<h2>Pon tu negocio en el mapa</h2>
<p>Si tu negocio no aparece cuando la gente está buscando, estás perdiendo oportunidades.</p>
<blockquote>No es pagar por aparecer. Es pagar por no seguir escondido.</blockquote>
<p>Dos opciones: <strong>Verificado gratis</strong> (badge si confirmamos que estás abierto) · <strong>Vitrina $799/año</strong> (apareces primero en tu categoría + el bot te recomienda + post mensual en FB).</p>
<p><a href="/pon-tu-negocio-en-el-mapa" class="text-teal-600 hover:underline font-semibold">→ Ver detalles + reclamar perfil gratis</a></p>

<!-- §14: Mira la vuelta -->
<h2>Mira la vuelta — pa' emprendedores e inversionistas</h2>
<p>Antes de abrir otro negocio igual o de meter chavos, lee el mapa. Las señales del pueblo te dicen qué se busca y dónde no hay competencia visible.</p>
<blockquote>Cuando alguien busca, pregunta o toca, ahí hay una pista de demanda.</blockquote>
<p><a href="/mira-la-vuelta" class="text-teal-600 hover:underline font-semibold">→ Reporte de Oportunidades Locales</a> · <a href="/senales-del-pueblo" class="text-teal-600 hover:underline font-semibold">→ Señales del pueblo en vivo</a></p>

<!-- §9: Verdad base -->
<h2>La verdad base</h2>
<p>Un pueblo no mejora solo por tener más información. Mejora cuando esa información ayuda a decidir mejor.</p>
<ul>
<li>Lo que está regao, se pierde.</li>
<li>Lo que no se encuentra, no se apoya.</li>
<li>Lo que no se entiende, se decide mal.</li>
<li>No todo progreso empieza con cemento. A veces empieza poniendo orden.</li>
<li>La claridad también es desarrollo económico.</li>
</ul>

<!-- Newsletter capture pre-cierre -->
<h2>Recibe el espejo mensual</h2>
<p>Una vez al mes — qué se busca, qué falta, qué oportunidades aparecen. Sin spam.</p>
${subscribeForm('menos-revolu', { audience: 'general' })}

<!-- §18: Bloque maestro final -->
<div class="bg-slate-900 text-white rounded-2xl p-8 mt-10 not-prose">
  <p class="text-xs font-bold uppercase tracking-widest text-teal-400 mb-3">Resumen</p>
  <h2 class="text-2xl md:text-3xl font-black leading-tight mb-4">Menos revolú. Mejores decisiones. Mejor vida.</h2>
  <p class="text-slate-300 leading-relaxed">MapaDeCaboRojo.com organiza el revolú local para que residentes, turistas, negocios, emprendedores e inversionistas encuentren mejor, decidan mejor y apoyen mejor lo local.</p>
  <div class="mt-6 flex flex-col sm:flex-row gap-3">
    <a href="/" class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-bold no-underline">
      Mira el mapa →
    </a>
    <a href="/pon-tu-negocio-en-el-mapa" class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-transparent border-2 border-teal-400 text-teal-300 hover:bg-teal-900 font-bold no-underline">
      Pon tu negocio
    </a>
  </div>
</div>

<!-- CTA final -->
<div class="bg-teal-50 border border-teal-200 rounded-lg p-6 mt-8 text-center">
<p class="text-lg font-semibold">Antes de dar vueltas, mira el mapa. Antes de meter chavos, mira la vuelta.</p>
<p class="mt-2"><a href="sms:+17874177711" class="text-teal-600 font-bold underline">Textea al ${PHONE_CTA}</a> · El Veci te contesta.</p>
<p class="text-sm text-slate-600 mt-2 italic">Si te sirve, llégate. Si no, sigue tu camino — todos vamos pa' diferentes sitios.</p>
</div>
`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  res.status(200).send(layout({
    title: 'Menos Revolú · El mapa vivo de Cabo Rojo',
    description: 'Menos revolú. Mejores decisiones. Mejor vida. Un mapa vivo pa\' poner orden en el revolú de Cabo Rojo — para residentes, turistas, negocios, emprendedores e inversionistas.',
    slug: 'menos-revolu',
    ogImage: '/og/menos-revolu.png',
    bodyHtml: body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'MapaDeCaboRojo.com',
      alternateName: 'Menos Revolú · Mapa de Cabo Rojo',
      url: SITE_URL,
      description: 'El mapa vivo pa\' poner orden en el revolú de Cabo Rojo. Menos revolú. Mejores decisiones. Mejor vida.',
      inLanguage: 'es-PR',
      audience: [
        { '@type': 'Audience', audienceType: 'Residente' },
        { '@type': 'Audience', audienceType: 'Turista' },
        { '@type': 'Audience', audienceType: 'Negocio local' },
        { '@type': 'Audience', audienceType: 'Emprendedor' },
        { '@type': 'Audience', audienceType: 'Inversionista' },
        { '@type': 'Audience', audienceType: 'Pueblo' },
      ],
    },
  }))
}

// =============== /preguntas ===============
// FAQ page with FAQPage schema.org — drives LLM citability + Google rich
// results. Each Q&A is independently citable and indexable.

const FAQ_ENTRIES: Array<{ q: string; a: string }> = [
  {
    q: '¿Qué es MapaDeCaboRojo.com?',
    a: 'Un mapa vivo pa\' poner orden en el revolú de Cabo Rojo. Es un directorio de los negocios reales del pueblo — verificados a mano, llamando al dueño — más un panel de matemática del pueblo (TAM/SAM/SOM por categoría) y señales de demanda en vivo del bot *7711. No es Google Maps · no es Yelp · no es Facebook. Es lo que el pueblo le falta: un mapa que sí está al día.',
  },
  {
    q: '¿Cuánto cuesta poner mi negocio en el mapa?',
    a: 'Verificado: gratis pa\' siempre. Si alguien (Angel o Noelia) llama a tu número y confirma que sigues abierto, te entra el badge "verificado" sin costo. Vitrina: $799/año (opcional) — apareces primero en tu categoría, El Veci te recomienda en el bot, post mensual en Facebook, perfil destacado. Garantía 60 días. Detalles en /pon-tu-negocio-en-el-mapa.',
  },
  {
    q: '¿Cómo se diferencia de Google Maps o Yelp?',
    a: 'Google tiene datos. Facebook tiene ruido. Nosotros tenemos contexto local. Cada negocio se verifica a mano — alguien llama, confirma que sigue abierto, anota si cambió horario, si se mudó, si cerró. Si la última verificación tiene más de 90 días, no cuenta como verificado. Sin scraping. Sin AI inventando data. Sin "aproximaciones". Esa verificación humana sostenida es el moat.',
  },
  {
    q: '¿Cómo verifican los negocios uno por uno?',
    a: 'Cada lunes el sistema cuenta cuántos del subset crítico (top 200 más buscados) están al día. Marca los 20 más urgentes. Angel y Noelia llaman 4-5 al día durante la semana. Si nadie contesta después de 2 intentos, se marca para visita en persona. Los números viven en /transparencia · updated diario sin filtros.',
  },
  {
    q: '¿Qué es la Vitrina y vale los $799?',
    a: 'Es la opción premium pa\' negocios que quieren más visibilidad. Incluye: aparición #1 en tu categoría, recomendación del bot *7711, post mensual en la página Facebook (~15K alcance/mes), badge especial, garantía 60 días. La frase: "No es pagar por aparecer. Es pagar por no seguir escondido." Si tu negocio depende de que la gente te encuentre primero — sí, vale. Si tu boca-a-boca ya te llena la agenda, gratis verificado es suficiente.',
  },
  {
    q: '¿Qué es el bot *7711 (El Veci)?',
    a: 'El Veci es el asistente de Cabo Rojo via SMS/WhatsApp. Le texteas y te contesta — recomendaciones de negocios, horarios, direcciones, lo que sea sobre el pueblo. Número: 787-417-7711. WhatsApp: wa.me/17874177711. Funciona 24/7. Cada búsqueda alimenta /senales-del-pueblo (la página de demanda en vivo) — por eso es señal valiosa pa\' emprendedores e inversionistas.',
  },
  {
    q: '¿Cómo puedo ayudar al proyecto?',
    a: 'Textea al *7711 con "MEMORIA: [negocio] [info]" pa\' contribuir data verificable. Si conoces a alguien con un negocio en CR que no aparece, recomiéndale reclamar perfil gratis. Comparte páginas como /senales-del-pueblo y /mira-la-vuelta cuando le sirvan a alguien. Si eres dev/periodista/agencia, escribe a angel@angelanderson.com — hay acceso programático via api.vecinoai.com.',
  },
  {
    q: '¿Es gratis usar el mapa?',
    a: 'Sí, gratis pa\' siempre. Buscar negocios · ver listings · usar el bot *7711 · leer /transparencia · /senales-del-pueblo · /pueblo-en-numeros · /mira-la-vuelta · todo gratis. La única cosa de pago es la Vitrina opcional pa\' dueños de negocio que quieran promocionarse ($799/año).',
  },
  {
    q: '¿Cuántos negocios tienen?',
    a: 'Más de 1,134 negocios indexados a fecha actualizada. El subset crítico (top 200 más buscados) target: 80% verificado en los últimos 90 días pa\' junio 23 2026. Métricas en vivo siempre en /transparencia. Cubre: restaurantes, farmacias, médicos, dentistas, hospedaje, servicios (plomero, AC, electricista, mecánico), compras, turismo, deportes, automotriz, marina náutico, educación, gobierno — 24 categorías mayores.',
  },
  {
    q: '¿Quién está detrás del proyecto?',
    a: 'Angel Anderson — vecino de Cabo Rojo. Mi esposa Noelia me ayuda algunos lunes llamando negocios. El resto del trabajo lo hacen 13 empleados invisibles — programas pequeños que corren solos en horarios fijos. Sin empleados humanos. Sin VC. La idea: si funciona con 1 persona + AI en CR (50,000 hab), funciona en cualquier pueblo. Detalles en /equipo.',
  },
  {
    q: '¿Tienen política de privacidad? ¿Qué hacen con los datos del bot?',
    a: 'Las búsquedas del bot se guardan agregadas (qué se busca, cuántas veces) — eso alimenta /senales-del-pueblo. NO compartimos números de teléfono individuales con terceros · NO vendemos datos personales · NO usamos las búsquedas pa\' identificar usuarios. Si quieres que borremos tu historial, textea "BORRAR" al 787-417-7711. Privacy policy formal en construcción.',
  },
  {
    q: '¿Por qué algunas categorías están "saturadas" o "te necesitan"?',
    a: 'La página /pueblo-en-numeros calcula TAM/SAM/SOM por categoría. Si el revenue promedio por negocio es menor que lo mínimo para no quebrar, la categoría se marca ⚪ (saturada). Si nadie tiene supply pero el bot recibe demanda real, se marca 🔥 (te necesitan). Ejemplos crónicos 🔥: plomero, electricista, aire acondicionado, cardiólogo, ginecólogo. Si tienes habilidad en una de esas, abrir paga rápido.',
  },
  {
    q: '¿Puedo replicar este modelo pa\' mi pueblo o municipio?',
    a: 'Sí. El método es open-source. Cada uno de los 13 empleados invisibles es un programa pequeño (~150-400 líneas) que cualquier dev puede clonar. El moat NO es el código — es la verificación humana sostenida. Si eres alcalde, periodista o dev que quiere construir el mapa de tu pueblo, escribe a angel@angelanderson.com.',
  },
]

function handlePreguntas(_req: any, res: any) {
  const faqHtml = FAQ_ENTRIES.map((entry, i) => `
<details class="not-prose bg-white border border-slate-200 rounded-lg p-5 mt-3 group" ${i < 3 ? 'open' : ''}>
  <summary class="font-bold text-slate-900 cursor-pointer flex items-start justify-between gap-3 list-none">
    <span class="flex-1">${escapeHtml(entry.q)}</span>
    <span class="text-teal-600 group-open:rotate-180 transition-transform text-sm">▾</span>
  </summary>
  <p class="mt-3 text-slate-700 leading-relaxed text-sm">${entry.a}</p>
</details>
`).join('')

  const body = `
<h1>Preguntas frecuentes</h1>

<p class="text-lg text-slate-600 mt-4">Las preguntas que más nos hacen sobre MapaDeCaboRojo.com. Si la tuya no está aquí, textea al <strong>${PHONE_CTA}</strong> y la respondemos — y si vale la pena, se agrega a esta lista.</p>

<div class="mt-6">
${faqHtml}
</div>

<h2 class="mt-10">¿No encontraste la tuya?</h2>
<p>Textea <strong>PREGUNTA</strong> + lo que quieres saber al <strong>${PHONE_CTA}</strong>. Si la respuesta interesa a más gente, la agregamos aquí.</p>

<div class="bg-teal-50 border border-teal-200 rounded-lg p-6 mt-8 text-center">
<p class="text-lg font-semibold">¿Listo pa' empezar?</p>
<div class="mt-3 flex flex-col sm:flex-row gap-2 justify-center">
  <a href="/" class="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold no-underline">Mira el mapa</a>
  <a href="/pon-tu-negocio-en-el-mapa" class="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white border-2 border-teal-600 text-teal-700 hover:bg-teal-50 font-bold no-underline">Pon tu negocio</a>
  <a href="/menos-revolu" class="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-100 font-bold no-underline">¿Qué es esto?</a>
</div>
</div>
`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  res.status(200).send(layout({
    title: 'Preguntas frecuentes · MapaDeCaboRojo.com',
    description: 'Respuestas a las preguntas que más nos hacen sobre MapaDeCaboRojo.com: cuánto cuesta poner tu negocio, cómo verificamos, qué es la Vitrina, qué hace el bot *7711, cómo replicar el modelo. Updated continuo.',
    slug: 'preguntas',
    bodyHtml: body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_ENTRIES.map(entry => ({
        '@type': 'Question',
        name: entry.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: entry.a,
        },
      })),
    },
  }))
}

// =============== /historia ===============
// Origin story · how a single vecino + AI ended up building a civic-tech
// substrate. First-person narrative · build-in-public posture · honest about
// what wasn't planned vs what was deliberate.

function handleHistoria(_req: any, res: any) {
  const body = `
<h1>Cómo empezó esto.</h1>

<p class="text-lg text-slate-600 mt-4">No empezó como "voy a construir el mapa civic-tech de Cabo Rojo." Empezó como una pregunta que no podía contestar.</p>

<!-- WIIFM 3-chip -->
<div class="grid sm:grid-cols-3 gap-3 mt-6 not-prose">
  <div class="bg-teal-50 border border-teal-200 rounded-lg p-4">
    <div class="text-xs font-bold text-teal-700 uppercase tracking-wide mb-2">¿Qué significa?</div>
    <p class="text-sm text-slate-700 leading-snug">Esta página es la historia real de cómo un vecino acabó manteniendo un directorio de 3,900 negocios — sin equipo, sin VC.</p>
  </div>
  <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
    <div class="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">¿Por qué importa?</div>
    <p class="text-sm text-slate-700 leading-snug">Porque el método es replicable. Si te enseña algo pa' tu pueblo, llégate. Si no, sigue tu camino.</p>
  </div>
  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <div class="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">¿Qué hago con esto?</div>
    <p class="text-sm text-slate-700 leading-snug">Si eres dev/periodista/alcalde que quiere replicar — escribe a <strong>angel@angelanderson.com</strong>. El código es abierto.</p>
  </div>
</div>

<h2>2024 · La pregunta</h2>
<p>Un domingo se rompió algo en casa. Necesitaba un plomero rápido. Pregunté en Google — me salieron números de gente que cerró en 2019. Pregunté en Facebook — un grupo de WhatsApp me mandó 4 nombres, todos sin teléfono activo. Acabé llamando a familia.</p>
<p>No era el primer domingo así. Pero ese día me senté y dije: <strong>"Esto es ridículo. Mi pueblo tiene como 4,000 negocios. Y nadie sabe cuáles están al día."</strong></p>
<p>Esa fue la pregunta que abrió todo.</p>

<h2>2025 enero-abril · El experimento</h2>
<p>Empecé llamando negocios uno por uno. Llamada · ¿siguen abiertos? · ¿cambió horario? · ¿se mudaron? · ¿quién contesta el teléfono ahora?</p>
<p>Después de 50 llamadas me di cuenta de algo: <strong>no soy escalable solo.</strong> Si quiero mantener un directorio de 3,900 negocios al día, necesito ayuda. Y como no quería empleados ni VC, la ayuda tenía que ser AI.</p>
<p>Empecé a construir programas pequeños que corrieran solos: uno que escanea Google Maps · uno que vigila el sitio · uno que escribe drafts de posts cuando algo cambia · uno que llama mi atención cuando el bot recibe demanda que no podemos servir.</p>
<p>Para abril 2026 tenía 13 programas — los "empleados invisibles" que ahora cuidan el mapa cuando yo no estoy frente a la computadora. Eso es lo que está en <a href="/equipo" class="text-teal-600 hover:underline">/equipo</a>.</p>

<h2>2025 mayo · El bot *7711</h2>
<p>El mapa tenía data, pero la gente no buscaba en una página web. Buscaban en su teléfono — texteando preguntas. Así que monté el bot *7711.</p>
<p>El bot vive en SMS y WhatsApp. Le textea cualquiera: <em>"¿quién tiene farmacia abierta domingo?"</em> y contesta con los negocios verificados más cerca. Funciona 24/7.</p>
<p>Y aquí pasó algo que NO planeé: cada vez que alguien le pregunta al bot algo que no podemos contestar bien, eso es una <strong>señal de demanda</strong>. Si 40 personas en un mes preguntan por plomero y el directorio tiene 2, eso quiere decir que el pueblo necesita plomeros con presencia digital.</p>
<p>Esa señal acabó siendo el activo más valioso. La pagina <a href="/senales-del-pueblo" class="text-teal-600 hover:underline">/señales-del-pueblo</a> publica esto en vivo.</p>

<h2>2025 mayo-julio · El primer Vitrina</h2>
<p>Un día llegó un dueño de negocio (Luis David Refrigeración) y dijo: <em>"Quiero que tu mapa me ayude a aparecer cuando alguien busque AC un domingo a las 9 de la noche."</em></p>
<p>Le dije: <em>"Verificado es gratis. Pero si quieres aparecer #1 en tu categoría + post mensual + recomendación del bot, son $799 al año."</em></p>
<p>Aceptó. Ese fue el primer Vitrina. Eso pagó el costo de mantener todo el resto andando. La hipótesis se confirmó: <strong>servir bien al pueblo crea valor que algunos negocios pagan voluntariamente.</strong> Sin VC. Sin "monetizar la atención."</p>

<h2>2026 abril · La pregunta del alcalde</h2>
<p>Un alcalde de otro municipio me escribió: <em>"¿Cómo replico esto en mi pueblo?"</em></p>
<p>Esa fue la confirmación de que la cosa funcionaba más allá de Cabo Rojo. Lo que empezó como "necesito un plomero un domingo" se había convertido en algo replicable.</p>
<p>Por eso el código es <strong>open-source</strong>. El moat NO es la tecnología — es la verificación humana sostenida. Eso no se copia con código, solo con disciplina.</p>

<h2>2026 mayo · Lo que aprendí</h2>
<p>Cinco cosas:</p>
<ol>
<li><strong>El problema NO era falta de información — era información regada.</strong> Google tenía datos pero estaban desactualizados. Facebook tenía ruido pero sin verificación. La solución era contexto local sostenido, no más data.</li>
<li><strong>Un vecino + AI puede sostener algo que ciudades de millones no logran.</strong> No porque sea más listo. Porque corre el sistema todos los días con disciplina sin tener que coordinar con un equipo.</li>
<li><strong>La demanda emerge — no se inventa.</strong> Vitrina no se vende con cold email. La gente llega porque el bot ya les sirve bien. La pregunta es "¿cómo aparezco yo?" — no "¿por qué pagaría?"</li>
<li><strong>Honestidad pública es ventaja competitiva.</strong> Páginas como <a href="/transparencia" class="text-teal-600 hover:underline">/transparencia</a> y <a href="/vision" class="text-teal-600 hover:underline">/vision</a> (con kill criteria explícitos) construyen credibilidad que el marketing no compra.</li>
<li><strong>El método importa más que el resultado.</strong> Si esto funciona en CR pero el método no es replicable, no importa. Lo que importa es que cualquier pueblo pueda copiarlo.</li>
</ol>

<h2>Lo que NO planeé</h2>
<p>Pa' ser honesto:</p>
<ul>
<li>NO planeé que el bot sería el insight más valioso del sistema</li>
<li>NO planeé construir una "plataforma de inteligencia local"</li>
<li>NO planeé que alcaldes de otros municipios me iban a escribir</li>
<li>NO planeé hacer build-in-public extremo (eso vino después · ahora vive en <a href="/moonshots" class="text-teal-600 hover:underline">/moonshots</a>)</li>
</ul>
<p>Lo que SÍ planeé desde el día uno: el directorio se mantiene con verificación humana sostenida. Ese fue el bet inicial. Todo lo demás emergió.</p>

<h2>Hacia dónde va</h2>
<p>El plan a 12 meses vive en <a href="/vision" class="text-teal-600 hover:underline font-semibold">/vision</a> · con kill criteria explícitos · sin spin.</p>
<p>Si pasa esto, el proyecto muere o pivota:</p>
<ul>
<li>Sem 6 (Jun 23 2026): freshness top 200 < 60% → automation falló</li>
<li>Mes 4: el sistema no se auto-construye → Casa Digital no escala</li>
<li>Mes 8: < $10K ingresos anuales → hobby con dominio bonito</li>
</ul>
<p>Eso es lo que aprendí del experimento: <strong>los proyectos que duran son los que dicen en voz alta cuándo se mueren.</strong></p>

<div class="bg-teal-50 border border-teal-200 rounded-lg p-6 mt-10 text-center">
<p class="text-lg font-semibold">¿Quieres replicar este modelo en tu pueblo?</p>
<p class="mt-2">Escríbeme: <a href="mailto:angel@angelanderson.com" class="text-teal-600 font-bold underline">angel@angelanderson.com</a></p>
<p class="text-sm text-slate-600 mt-2 italic">El código es abierto. El método se enseña. Si te sirve, llégate.</p>
</div>
`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  res.status(200).send(layout({
    title: 'Historia · Cómo empezó MapaDeCaboRojo.com',
    description: 'La historia real de cómo un vecino + AI acabó manteniendo un directorio de 3,900 negocios en Cabo Rojo, PR. Sin equipo · sin VC · open-source. 2024-2026.',
    slug: 'historia',
    ogImage: '/og/historia.png',
    bodyHtml: body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Cómo empezó MapaDeCaboRojo.com',
      author: { '@type': 'Person', name: 'Angel Anderson', url: 'https://www.angelanderson.com' },
      publisher: { '@type': 'Organization', name: 'MapaDeCaboRojo.com', url: SITE_URL },
      datePublished: '2026-05-20',
      url: `${SITE_URL}/historia`,
      description: 'Origin story of MapaDeCaboRojo.com — 2024-2026 build-in-public.',
      inLanguage: 'es-PR',
    },
  }))
}

// =============== subscribe (POST) ===============
// Newsletter capture flow — Supabase newsletter_subscribers + Resend welcome email.
// Routed via /api/subscribe (vercel.json rewrite).

function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  if (email.length < 3 || email.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function hashIp(ip: string | undefined): string | null {
  if (!ip) return null
  return createHash('sha256').update(ip + 'mapadecaborojo-salt').digest('hex').slice(0, 16)
}

async function sendWelcomeEmail(email: string, audience: string | null): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY not configured' }
  const audienceLine = audience
    ? `<p style="color:#475569;font-size:14px;">Te marcamos como <strong>${escapeHtml(audience)}</strong> — eso nos ayuda a mandarte solo lo que te sirve.</p>`
    : ''
  const html = `<!DOCTYPE html>
<html lang="es-PR"><head><meta charset="UTF-8"><title>Bienvenido a MapaDeCaboRojo.com</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
<div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#fff;padding:32px 32px 28px;">
<p style="margin:0 0 8px 0;font-size:12px;font-weight:700;color:#5eead4;letter-spacing:2px;text-transform:uppercase;">📍 MapaDeCaboRojo.com</p>
<h1 style="margin:0;font-size:24px;font-weight:800;line-height:1.25;">Bienvenido al mapa vivo.</h1>
<p style="margin:8px 0 0 0;font-size:14px;color:#cbd5e1;">Menos revolú. Mejores decisiones. Mejor vida.</p>
</div>
<div style="padding:28px 32px;color:#1e293b;line-height:1.6;font-size:15px;">
<p>Gracias por suscribirte.</p>
<p>Esto es lo que vas a recibir:</p>
<ul style="padding-left:20px;margin:12px 0;">
<li>Cambios importantes en el mapa (verificaciones · negocios nuevos · cerrados)</li>
<li>Señales del pueblo — qué busca la gente, qué falta, qué oportunidades aparecen</li>
<li>Updates de transparencia — métricas mensuales sin spin</li>
</ul>
<p>Sin spam · sin trucos · si no te sirve, "Unsubscribe" un click y listo.</p>
${audienceLine}
<p style="margin-top:24px;">— Angel | <a href="https://www.mapadecaborojo.com" style="color:#0d9488;text-decoration:none;">mapadecaborojo.com</a></p>
</div>
<div style="background:#f8fafc;padding:18px 32px;color:#94a3b8;font-size:11px;text-align:center;">
<p style="margin:0;">Recibiste esto porque te suscribiste a updates de MapaDeCaboRojo.com.</p>
<p style="margin:6px 0 0 0;">Si no fuiste tú o quieres salir, responde "BAJA" a este correo.</p>
</div>
</div></body></html>`
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: 'Bienvenido al mapa vivo de Cabo Rojo',
        html,
        reply_to: REPLY_TO,
        tags: [{ name: 'list', value: 'newsletter' }, { name: 'event', value: 'welcome' }],
      }),
    })
    if (!r.ok) {
      const errBody = await r.text()
      return { ok: false, error: `Resend ${r.status}: ${errBody.substring(0, 200)}` }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Resend network error' }
  }
}

async function handleSubscribe(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed — use POST' })
    return
  }

  let body: any = req.body || {}
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch {
      try { body = Object.fromEntries(new URLSearchParams(body)) } catch { body = {} }
    }
  }

  const email = String(body.email || '').trim().toLowerCase()
  const source = String(body.source || 'unknown').slice(0, 64)
  const audience = body.audience ? String(body.audience).slice(0, 32) : null

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: 'Email inválido' })
    return
  }

  // Honeypot — pretend success
  if (body.phone || body.company || body.website) {
    res.status(200).json({ ok: true, message: 'Suscrito' })
    return
  }

  const ip = req.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim()
    || req.headers?.['x-real-ip']?.toString()
    || req.socket?.remoteAddress
  const userAgent = req.headers?.['user-agent']?.toString().slice(0, 256) || null

  try {
    const { data: existing } = await supabase
      .from('newsletter_subscribers')
      .select('id, unsubscribed_at')
      .eq('email', email)
      .limit(1)
      .maybeSingle()

    if (existing && !existing.unsubscribed_at) {
      res.status(200).json({ ok: true, message: 'Ya estás suscrito · gracias por volver' })
      return
    }

    if (existing && existing.unsubscribed_at) {
      const { error: upErr } = await supabase
        .from('newsletter_subscribers')
        .update({
          unsubscribed_at: null,
          source,
          audience_tag: audience,
          ip_hash: hashIp(ip),
          user_agent: userAgent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      if (upErr) throw upErr
    } else {
      const { error: insErr } = await supabase.from('newsletter_subscribers').insert({
        email,
        source,
        audience_tag: audience,
        ip_hash: hashIp(ip),
        user_agent: userAgent,
      })
      if (insErr) throw insErr
    }

    const sendResult = await sendWelcomeEmail(email, audience)
    if (!sendResult.ok) console.error('[subscribe] welcome email failed:', sendResult.error)

    res.status(200).json({ ok: true, message: 'Listo · te enviamos un correo de bienvenida' })
  } catch (e: any) {
    console.error('[subscribe] error:', e)
    res.status(500).json({ ok: false, error: 'Error al guardar — intenta de nuevo o textea al 787-417-7711' })
  }
}

// =============== /playas/defensa-y-limpieza ===============
// Utility guide for Defensa y Limpieza beach cleanup event — May 30, 2026
// 4 beaches × 5 categories (food, gas, farmacia, clinica, notes)
// Data sourced from places table, verified against Supabase 2026-05-22

function handleDefensaYLimpieza(_req: any, res: any) {

  // ─── DATA ────────────────────────────────────────────────────────────────────
  // Each place: { name, slug, phone, address, rating, dist, note? }
  // slug null = no profile page yet; link omitted

  const beaches = [
    {
      id: 'combate',
      name: 'Playa El Combate',
      slug: 'playa-el-combate',
      coords: 'Carr. 3301, Bo. El Combate',
      gmaps: 'https://maps.google.com/?q=17.9766404,-67.2127867',
      color: 'teal',
      food: [
        { name: 'I Love Combate', slug: 'i-love-combate', phone: null, address: 'PR-3301 Km 2.8, El Combate', rating: 4.7, dist: '0.2 km' },
        { name: 'Santos Bar & Restaurant', slug: 'santos-bar-amp-restaurant', phone: '+17878518300', address: 'Calle 2, El Combate', rating: 4.6, dist: '0.3 km' },
      ],
      gas: [
        { name: 'Gulf Pole Ojea', slug: 'gulf-pole-ojea', phone: null, address: 'Pole Ojea, Cabo Rojo', rating: 4.5, dist: '2.9 km' },
      ],
      salud: [
        { name: 'El Combate Drug Store', slug: 'el-combate-drug', phone: '+17878518123', address: 'XQHW+MG4, El Combate', rating: 4.4, dist: '0.4 km', tipo: 'Farmacia' },
      ],
      notas: 'El Combate Drug Store también funciona como punto de referencia si necesitas orientación. No hay CDT en el área — la clínica más cercana es en Boquerón (~7 km por Carr 301).',
    },
    {
      id: 'buye',
      name: 'Playa Buyé',
      slug: 'playa-buy',
      coords: 'Carr. 307, Bo. Guaniquilla',
      gmaps: 'https://maps.google.com/?q=18.0402393,-67.2060134',
      color: 'amber',
      food: [
        { name: 'Criollisimo Coffee Market', slug: 'criollisimo-coffee-market', phone: null, address: 'Carr. 307 km 4.9, Guaniquilla', rating: 4.9, dist: '2.1 km' },
        { name: 'Pizzería Cofresí', slug: 'pizzeria-cofresi', phone: null, address: 'PR-307 km 5.2, Cabo Rojo', rating: 4.4, dist: '2.1 km' },
      ],
      gas: [
        { name: 'Gasolinera Texaco', slug: 'gasolinera-texaco', phone: '+17878515781', address: 'Calle Carbonell 86, Boquerón', rating: 4.4, dist: '6.7 km (camino a Boquerón)' },
      ],
      salud: [
        { name: "Ed's Pharmacy", slug: 'eds-pharmacy', phone: '+17872550485', address: 'PR-307, Cabo Rojo', rating: 4.8, dist: '1.2 km', tipo: 'Farmacia' },
      ],
      notas: "Buyé está entre dos tramos de playa; Criollisimo es una excelente parada para café y comida real. Ed's Pharmacy en la misma Carr. 307 es la opción más próxima pa' primeros auxilios y medicamentos básicos.",
    },
    {
      id: 'tres-tubos',
      name: 'Tres Tubos (Playita Azul, Joyuda)',
      slug: 'playita-azul',
      coords: 'Carr. 102, Bo. Joyuda',
      gmaps: 'https://maps.google.com/?q=18.1353462,-67.1864615',
      color: 'blue',
      food: [
        { name: 'Rest Acosta', slug: 'rest-acosta', phone: null, address: 'PR-102, Joyuda', rating: 4.6, dist: 'sobre la Carr. 102' },
        { name: 'Bamboleio', slug: 'bamboleio', phone: '+17873577250', address: 'Joyuda, Cabo Rojo', rating: 4.5, dist: 'sobre la Carr. 102' },
        { name: "Dongo's", slug: 'dongo-s', phone: null, address: 'Joyuda, Cabo Rojo', rating: 4.5, dist: 'sobre la Carr. 102' },
      ],
      gas: [
        { name: 'Total Energies', slug: 'total', phone: '+17873570052', address: 'Carr. 102 KM 14.1, Cabo Rojo', rating: 4.6, dist: '~2 km' },
      ],
      salud: [
        { name: 'Walgreens', slug: 'walgreens-cabo-rojo', phone: '+17878513363', address: 'Carr 308 #80, Cabo Rojo', rating: 4.3, dist: 'la más cercana a Joyuda', tipo: 'Farmacia' },
      ],
      notas: 'Tres Tubos / Playita Azul está en Joyuda, sobre la Carr. 102 (no en Boquerón). Los restaurantes y la gasolinera quedan a lo largo de la 102. La farmacia más cercana es la Walgreens de Cabo Rojo.',
    },
    {
      id: 'playuela',
      name: 'La Playuela (Playa Sucia)',
      slug: 'playa-playuela-cabo-rojo',
      coords: 'Faro Los Morrillos, Bo. Llanos Costa',
      gmaps: 'https://maps.google.com/?q=17.9360306,-67.1890376',
      color: 'rose',
      food: [],
      gas: [
        { name: 'Gulf Pole Ojea', slug: 'gulf-pole-ojea', phone: null, address: 'Pole Ojea, Cabo Rojo', rating: 4.5, dist: 'la más cercana de regreso (verificar)' },
      ],
      salud: [
        { name: 'El Combate Drug Store', slug: 'el-combate-drug', phone: '+17878518123', address: 'XQHW+MG4, El Combate', rating: 4.4, dist: 'la más cercana (verificar)', tipo: 'Farmacia' },
      ],
      notas: 'La Playuela está al lado del Faro Los Morrillos — la playa más remota de las cuatro. Camino no pavimentado los últimos 3 km y SIN servicios en el área (no hay comida, baños ni food trucks). Lleva todo contigo: agua, comida, sombra y protector. El punto de ayuda más cercano es El Combate (~5 km de regreso).',
    },
  ]

  // ─── HELPERS ─────────────────────────────────────────────────────────────────

  const colorMap: Record<string, { bg: string; border: string; badge: string; heading: string; icon: string }> = {
    teal:  { bg: 'bg-teal-50',  border: 'border-teal-200',  badge: 'bg-teal-600 text-white',  heading: 'text-teal-800',  icon: 'text-teal-600' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-600 text-white',  heading: 'text-amber-800', icon: 'text-amber-600' },
    blue:  { bg: 'bg-blue-50',  border: 'border-blue-200',  badge: 'bg-blue-600 text-white',   heading: 'text-blue-800',  icon: 'text-blue-600' },
    rose:  { bg: 'bg-rose-50',  border: 'border-rose-200',  badge: 'bg-rose-600 text-white',   heading: 'text-rose-800',  icon: 'text-rose-600' },
  }

  function phoneLink(phone: string | null, display?: string): string {
    if (!phone) return ''
    const digits = phone.replace(/\D/g, '')
    const wa = `https://wa.me/1${digits.replace(/^1/, '')}`
    const disp = display || phone.replace(/^\+1/, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
    return `<a href="${wa}" class="text-teal-700 font-semibold hover:underline">${escapeHtml(disp)}</a>`
  }

  function stars(rating: number): string {
    const full = Math.round(rating)
    return `<span class="text-amber-500 text-xs">${'★'.repeat(full)}${'☆'.repeat(5 - full)}</span> <span class="text-slate-500 text-xs">${rating.toFixed(1)}</span>`
  }

  function placeCard(p: { name: string; slug: string | null; phone: string | null; address: string; rating: number; dist: string; tipo?: string }, siteUrl: string): string {
    const nameEl = p.slug
      ? `<a href="${siteUrl}/negocio/${p.slug}" class="font-semibold text-slate-900 hover:text-teal-700">${escapeHtml(p.name)}</a>`
      : `<span class="font-semibold text-slate-900">${escapeHtml(p.name)}</span>`

    const tipoEl = p.tipo ? `<span class="ml-1 text-xs bg-teal-100 text-teal-700 rounded px-1.5 py-0.5 font-medium">${escapeHtml(p.tipo)}</span>` : ''
    const phoneLine = p.phone ? `<div class="mt-1 text-sm">${phoneLink(p.phone)}</div>` : ''
    const addrLine = p.address ? `<div class="text-xs text-slate-500 mt-0.5">${escapeHtml(p.address)}</div>` : ''

    return `<div class="bg-white rounded-lg border border-slate-200 p-3 flex items-start gap-3 shadow-sm">
  <div class="flex-1 min-w-0">
    <div class="flex flex-wrap items-baseline gap-1">${nameEl}${tipoEl}</div>
    ${phoneLine}
    ${addrLine}
    <div class="flex items-center gap-2 mt-1.5 flex-wrap">
      ${stars(p.rating)}
      <span class="text-xs text-slate-400">· ${escapeHtml(p.dist)}</span>
    </div>
  </div>
</div>`
  }

  function beachSection(b: typeof beaches[0]): string {
    const c = colorMap[b.color]
    const emptyMsg = '<div class="text-sm text-slate-400 italic">No hay opciones cercanas verificadas. ¿Conoces una? Textéala al 787-417-7711.</div>'
    const foodCards = b.food.length ? b.food.map(p => placeCard(p, SITE_URL)).join('\n') : emptyMsg
    const gasCards = b.gas.length ? b.gas.map(p => placeCard(p, SITE_URL)).join('\n') : emptyMsg
    const saludCards = b.salud.length ? b.salud.map(p => placeCard(p, SITE_URL)).join('\n') : emptyMsg

    const beachNameEl = b.slug
      ? `<a href="${SITE_URL}/negocio/${b.slug}" class="hover:underline">${escapeHtml(b.name)}</a>`
      : `<span>${escapeHtml(b.name)}</span>`

    return `
<div id="${b.id}" class="not-prose mt-10 ${c.bg} border ${c.border} rounded-xl p-5 scroll-mt-20">
  <!-- beach header -->
  <div class="flex items-start justify-between gap-3 flex-wrap">
    <div>
      <h2 class="text-xl font-bold ${c.heading} leading-tight">${beachNameEl}</h2>
      <p class="text-sm text-slate-600 mt-0.5">${escapeHtml(b.coords)}</p>
    </div>
    <a href="${b.gmaps}" target="_blank" rel="noopener"
       class="${c.badge} text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap">
      <i class="fa-solid fa-diamond-turn-right mr-1"></i>Ver en mapa
    </a>
  </div>

  <!-- grid: food + utilities -->
  <div class="mt-5 grid md:grid-cols-2 gap-5">

    <!-- comida -->
    <div>
      <div class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">🍔 Comida cercana</div>
      <div class="flex flex-col gap-2">
        ${foodCards}
      </div>
    </div>

    <!-- gas + salud -->
    <div class="flex flex-col gap-5">
      <div>
        <div class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">⛽ Gasolinera</div>
        <div class="flex flex-col gap-2">${gasCards}</div>
      </div>
      <div>
        <div class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">🏥 Farmacia / Clínica</div>
        <div class="flex flex-col gap-2">${saludCards}</div>
      </div>
    </div>

  </div>

  <!-- nota -->
  <div class="mt-4 bg-white/70 border border-white rounded-lg p-3 text-sm text-slate-600 leading-relaxed">
    <span class="font-semibold text-slate-700">Nota: </span>${escapeHtml(b.notas)}
  </div>
</div>`
  }

  // ─── JSON-LD ─────────────────────────────────────────────────────────────────

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/playas/defensa-y-limpieza`,
        url: `${SITE_URL}/playas/defensa-y-limpieza`,
        name: 'Defensa y Limpieza — Guía de playas · 30 mayo 2026',
        description: 'Lo que necesitas cerca de cada playa: comida, gas, farmacia y clínica — compilado por caborojo.com pa\' los voluntarios del evento Defensa y Limpieza.',
        inLanguage: 'es-PR',
        publisher: { '@type': 'Organization', name: 'MapaDeCaboRojo.com', url: SITE_URL },
        datePublished: '2026-05-22',
        dateModified: '2026-05-29',
      },
      {
        '@type': 'Event',
        name: 'Defensa y Limpieza — Cabo Rojo (2da Edición)',
        description: 'Limpieza simultánea de 4 playas de Cabo Rojo: El Combate, Buyé, Tres Tubos (Joyuda) y La Playuela (Playa Sucia). Voluntarios recogen basura para proteger las costas.',
        startDate: '2026-05-30T11:00:00-04:00',
        endDate: '2026-05-30T14:00:00-04:00',
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        isAccessibleForFree: true,
        inLanguage: 'es-PR',
        image: [`${SITE_URL}/og/menos-revolu.png`],
        location: {
          '@type': 'Place',
          name: 'Playas de Cabo Rojo — El Combate, Buyé, Tres Tubos (Joyuda), La Playuela',
          address: { '@type': 'PostalAddress', addressLocality: 'Cabo Rojo', addressRegion: 'PR', addressCountry: 'US' },
        },
        organizer: { '@type': 'Organization', name: 'MapaDeCaboRojo.com', url: SITE_URL },
        url: `${SITE_URL}/playas/defensa-y-limpieza`,
      },
      ...beaches.flatMap(b =>
        b.salud.map(p => ({
          '@type': 'LocalBusiness',
          name: p.name,
          address: { '@type': 'PostalAddress', streetAddress: p.address, addressLocality: 'Cabo Rojo', addressRegion: 'PR', addressCountry: 'US' },
          ...(p.phone ? { telephone: p.phone } : {}),
          ...(p.rating ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, bestRating: 5, reviewCount: 1 } } : {}),
          url: p.slug ? `${SITE_URL}/negocio/${p.slug}` : undefined,
        }))
      ),
      ...beaches.flatMap(b =>
        b.food.map(p => ({
          '@type': 'FoodEstablishment',
          name: p.name,
          address: { '@type': 'PostalAddress', streetAddress: p.address, addressLocality: 'Cabo Rojo', addressRegion: 'PR', addressCountry: 'US' },
          ...(p.phone ? { telephone: p.phone } : {}),
          ...(p.rating ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, bestRating: 5, reviewCount: 1 } } : {}),
          url: p.slug ? `${SITE_URL}/negocio/${p.slug}` : undefined,
        }))
      ),
    ],
  }

  // ─── BODY ────────────────────────────────────────────────────────────────────

  // Jump nav
  const jumpNav = beaches.map(b => {
    const c = colorMap[b.color]
    return `<a href="#${b.id}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${c.border} ${c.bg} ${c.heading} hover:opacity-80 transition-opacity">${escapeHtml(b.name.split(' (')[0])}</a>`
  }).join('\n')

  const allSections = beaches.map(beachSection).join('\n')

  const body = `
<div class="not-prose mb-8">
  <div class="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-3 py-1 mb-4">
    <i class="fa-solid fa-water"></i> Defensa y Limpieza · 30 mayo 2026
  </div>
  <div class="inline-flex items-center gap-2 text-sm font-bold text-white bg-coral-600 rounded-full px-4 py-1.5 mb-4" style="background:#e0533d">
    <i class="fa-solid fa-clock"></i> Mañana — sábado 30, de 11am a 2pm
  </div>
  <h1 class="text-3xl font-black text-slate-900 leading-tight mt-2">
    Lo que necesitas cerca de cada playa
  </h1>
  <p class="text-lg text-slate-600 mt-3 leading-relaxed">
    Compilado por <strong>caborojo.com</strong> pa' los voluntarios y visitantes del evento. Si no encuentras algo, escríbele al Veci.
  </p>

  <!-- quick jump nav -->
  <div class="flex flex-wrap gap-2 mt-5">
    ${jumpNav}
  </div>

  <!-- event note -->
  <div class="mt-5 bg-slate-100 border border-slate-200 rounded-xl p-4 flex gap-3 items-start">
    <span class="text-2xl">🧹</span>
    <div class="text-sm text-slate-700 leading-relaxed">
      <strong>Sábado 30 de mayo · 4 playas de Cabo Rojo.</strong>
      Esta guía muestra qué hay disponible cerca de cada punto de limpieza — baños, comida, gasolina, y dónde ir si algo pasa. Los datos vienen del directorio verificado de mapadecaborojo.com. Si algo está desactualizado, textea <strong>787-417-7711</strong>.
      <br><br>
      <strong>Lo que conviene llevar:</strong> agua, protector solar, gorra, y una bolsa o zafacón extra. En cada playa reparten guantes, pero si tienes los tuyos, mejor.
    </div>
  </div>
</div>

${allSections}

<!-- crowdsource -->
<div class="not-prose mt-10 bg-amber-50 border border-amber-200 rounded-xl p-5 flex gap-3 items-start">
  <span class="text-2xl">✍️</span>
  <div>
    <p class="font-bold text-amber-900">¿Falta un negocio o ves un error?</p>
    <p class="text-sm text-slate-700 mt-1 leading-relaxed">Esta guía la mantiene el pueblo. Si conoces un baño, una comida, una gasolinera o una farmacia cerca de alguna playa — o si algo aquí está mal — díselo al Veci y lo arreglamos.</p>
    <a href="https://wa.me/17874177711?text=Defensa%20y%20Limpieza%3A%20" class="inline-flex items-center gap-2 mt-3 bg-amber-600 text-white font-semibold px-4 py-2 rounded-full text-sm hover:bg-amber-700 transition-colors">
      <i class="fa-brands fa-whatsapp"></i>Aportar o corregir · 787-417-7711
    </a>
  </div>
</div>

<!-- footer CTA -->
<div class="not-prose mt-8 bg-teal-700 rounded-2xl p-6 text-center text-white">
  <p class="text-lg font-bold mb-1">¿Necesitas algo en vivo el día del evento?</p>
  <p class="text-sm text-teal-100 mb-4">El Veci contesta sobre Cabo Rojo las 24 horas. Textea al <strong>787-417-7711</strong>:</p>
  <div class="flex flex-wrap gap-3 justify-center">
    <a href="https://wa.me/17874177711?text=EVENTOS"
       class="inline-flex items-center gap-2 bg-white text-teal-800 font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-50 transition-colors">
      <i class="fa-brands fa-whatsapp text-lg"></i>
      EVENTOS — qué hay este fin
    </a>
    <a href="https://wa.me/17874177711?text=PLAYA"
       class="inline-flex items-center gap-2 bg-white text-teal-800 font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-50 transition-colors">
      <i class="fa-brands fa-whatsapp text-lg"></i>
      PLAYA — playas de CR
    </a>
  </div>
  <p class="text-xs text-teal-200 mt-4">— caborojo.com | Menos revolú, más sistema, mejor vida.</p>
</div>
`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300')
  res.status(200).send(layout({
    title: 'Defensa y Limpieza — Guía de playas · 30 mayo 2026',
    description: "Lo que necesitas cerca de cada playa de Cabo Rojo el 30 de mayo: comida, gasolina, farmacia y clínica. Compilado por caborojo.com pa' los voluntarios del evento Defensa y Limpieza.",
    slug: 'playas/defensa-y-limpieza',
    ogImage: '/og/defensa-y-limpieza.png',
    bodyHtml: body,
    jsonLd,
  }))
}

// =============== /acceso ===============
// Health-access "radar": verified provider-density reports per specialty.
// Source reports: Outbox/Salud/<Specialty>-PR/ (NPPES/CMS + U.S. Census 2020).
function handleAcceso(_req: any, res: any) {
  const body = `
<h1>¿Tienes que viajar para ver a tu especialista?</h1>

<p class="text-lg text-slate-600 mt-3">Escoge el especialista y tu pueblo. Te decimos <strong>cuántos hay cerca, si te toca viajar, y qué pedirle a tu médico</strong> — antes de que sea una urgencia.</p>

<div class="not-prose mt-6 bg-white border-2 border-teal-300 rounded-2xl p-6 shadow-sm">
  <div class="grid sm:grid-cols-2 gap-4">
    <label class="block">
      <span class="text-sm font-bold text-slate-700">1. ¿Qué especialista necesitas?</span>
      <select id="ac-spec" class="mt-1 w-full rounded-lg border border-slate-300 p-3 text-base bg-white">
        <option value="">Escoge...</option>
        <option value="fisiatra">Fisiatra — dolor, espalda, rehabilitación</option>
        <option value="cardiologo">Cardiólogo — corazón</option>
        <option value="nefrologo">Nefrólogo — riñón, diálisis</option>
        <option value="endocrinologo">Endocrinólogo — diabetes, tiroides</option>
        <option value="neurologo">Neurólogo — cerebro, nervios, derrame</option>
        <option value="ortopeda">Ortopeda — huesos, fracturas, rodilla</option>
      </select>
    </label>
    <label class="block">
      <span class="text-sm font-bold text-slate-700">2. ¿De qué pueblo eres?</span>
      <select id="ac-town" class="mt-1 w-full rounded-lg border border-slate-300 p-3 text-base bg-white">
        <option value="">Escoge...</option>
        <option>Cabo Rojo</option><option>San Germán</option><option>Mayagüez</option>
        <option>Lajas</option><option>Hormigueros</option><option>Sabana Grande</option>
        <option>Añasco</option><option>Aguadilla</option>
        <option value="oeste-otro">Otro pueblo del oeste</option>
        <option value="metro">Área metro (San Juan y alrededores)</option>
      </select>
    </label>
  </div>
  <div id="ac-result" class="mt-5"></div>
  <p id="ac-hint" class="mt-4 text-sm text-slate-400 text-center">Escoge los dos y te decimos qué hacer.</p>
</div>

<script>
(function(){
  var SPEC={
    fisiatra:{label:'fisiatra',ref:'fisiatría',kw:'FISIATRA',slug:'fisiatra',total:252,towns:{'Cabo Rojo':3,'Mayagüez':11,'San Germán':5,'Añasco':2,'Hormigueros':1}},
    cardiologo:{label:'cardiólogo',ref:'cardiología',kw:'CARDIOLOGO',slug:'cardiologos',total:339,towns:{'Mayagüez':13,'Aguadilla':5,'San Germán':4,'Cabo Rojo':2,'Sabana Grande':1,'Añasco':1}},
    nefrologo:{label:'nefrólogo',ref:'nefrología',kw:'NEFROLOGO',slug:'nefrologo',total:154,towns:{'Mayagüez':19,'Aguadilla':4,'Cabo Rojo':3,'Añasco':1,'San Germán':1}},
    endocrinologo:{label:'endocrinólogo',ref:'endocrinología',kw:'ENDOCRINOLOGO',slug:'endocrinologo',total:158,towns:{'Mayagüez':14,'San Germán':4,'Aguadilla':3,'Cabo Rojo':1}},
    neurologo:{label:'neurólogo',ref:'neurología',kw:'NEUROLOGO',slug:'neurologo',total:166,towns:{'Mayagüez':7,'Aguadilla':4,'San Germán':2}},
    ortopeda:{label:'ortopeda',ref:'ortopedia',kw:'ORTOPEDA',slug:'ortopeda',total:152,towns:{'Mayagüez':8,'Aguadilla':3,'San Germán':3}}
  };
  var DIST={'Cabo Rojo':25,'San Germán':20,'Mayagüez':0,'Lajas':30,'Hormigueros':12,'Sabana Grande':25,'Añasco':18,'Aguadilla':40};
  var sp=document.getElementById('ac-spec'),tw=document.getElementById('ac-town'),out=document.getElementById('ac-result'),hint=document.getElementById('ac-hint');
  function track(ev,spec,town){try{fetch('/api/mapa-pages?page=acceso-log',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({event:ev,specialty:spec,town:town})});}catch(e){}}
  function render(){
    if(!sp.value||!tw.value){out.innerHTML='';hint.style.display='block';return;}
    hint.style.display='none';
    var s=SPEC[sp.value],town=tw.value,hubN=s.towns['Mayagüez']||0,msg='',tone='';
    if(town==='metro'){
      msg='<b>En el área metro hay de sobra.</b> De los '+s.total+' '+s.label+'s de PR, la mayoría están en San Juan y alrededores. No te toca viajar lejos.';tone='ok';
    } else if(town==='Mayagüez'){
      msg='<b>En Mayagüez hay '+hubN+'.</b> Estás en el centro de especialistas del oeste — aquí es donde el resto del oeste viene.';tone='ok';
    } else {
      var name=(town==='oeste-otro')?'tu pueblo':town;
      var here=(town==='oeste-otro')?0:(s.towns[town]||0);
      var dist=(town==='oeste-otro')?30:(DIST[town]!=null?DIST[town]:30);
      if(here>0){msg='<b>En '+name+' hay '+here+'.</b> Son pocos, así que la cita puede tardar. El grupo más grande cerca es <b>Mayagüez ('+hubN+')</b>, a ~'+dist+' min.';tone='warn';}
      else{msg='<b>En '+name+' no hay '+s.label+' en el directorio.</b> El más cercano queda en <b>Mayagüez ('+hubN+')</b>, a ~'+dist+' min. Cuenta con viajar.';tone='bad';}
    }
    var bg=tone==='ok'?'#ecfdf5':tone==='warn'?'#fffbeb':'#fef2f2',bd=tone==='ok'?'#6ee7b7':tone==='warn'?'#fcd34d':'#fca5a5';
    out.innerHTML='<div style="background:'+bg+';border:2px solid '+bd+';border-radius:14px;padding:18px 20px;">'
      +'<p style="font-size:17px;line-height:1.5;color:#0f172a;margin:0 0 14px;">'+msg+'</p>'
      +'<div style="font-size:14px;color:#334155;line-height:1.6;">'
      +'<div style="margin-bottom:8px;"><b>👉 Qué pedir:</b> dile a tu médico primario un <b>"referido a '+s.ref+'"</b>. Y pregunta si está en tu plan médico.</div>'
      +'<div><b>📞 Los teléfonos:</b> <a id="ac-dir" href="/categoria/'+s.slug+'" style="color:#0f766e;font-weight:700;text-decoration:underline;">ver la lista</a> &middot; o escríbele <a id="ac-bot" href="https://wa.me/17874177711?text='+s.kw+'" style="color:#0f766e;font-weight:700;text-decoration:underline;">'+s.kw+' al 787-417-7711</a></div>'
      +'</div></div>';
    var d=document.getElementById('ac-dir');if(d)d.addEventListener('click',function(){track('click_directory',sp.value,tw.value);});
    var b=document.getElementById('ac-bot');if(b)b.addEventListener('click',function(){track('click_bot',sp.value,tw.value);});
    track('lookup',sp.value,tw.value);
  }
  sp.addEventListener('change',render);tw.addEventListener('change',render);
})();
</script>

<div class="not-prose mt-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
  <div class="text-xs font-bold uppercase tracking-widest text-teal-700 mb-4">Por qué existe esta página</div>
  <div class="grid sm:grid-cols-2 gap-x-8 gap-y-5">
    <div>
      <div class="font-bold text-slate-900 mb-1 flex items-center gap-2"><i class="fa-solid fa-triangle-exclamation text-amber-500"></i> El problema</div>
      <p class="text-sm text-slate-600 leading-snug">En Puerto Rico los especialistas se concentran en San Juan. Si vives en el oeste, muchas veces hay uno o ninguno en tu pueblo — y nadie te lo dice hasta que ya estás esperando meses o manejando dos horas.</p>
    </div>
    <div>
      <div class="font-bold text-slate-900 mb-1 flex items-center gap-2"><i class="fa-solid fa-magnifying-glass text-teal-600"></i> Lo que no existía antes</div>
      <p class="text-sm text-slate-600 leading-snug">Esa cuenta existe, pero enterrada en un registro federal en inglés que nadie del pueblo abre. Nunca la habían cruzado con el censo, por especialidad y por pueblo, en español. La hicimos a mano. Es la primera vez que está en un solo sitio, clara.</p>
    </div>
    <div>
      <div class="font-bold text-slate-900 mb-1 flex items-center gap-2"><i class="fa-solid fa-users text-teal-600"></i> Para quién</div>
      <p class="text-sm text-slate-600 leading-snug">El que necesita un especialista. El que cuida a un familiar mayor. Y la diáspora que coordina la salud de sus padres en la isla desde lejos.</p>
    </div>
    <div>
      <div class="font-bold text-slate-900 mb-1 flex items-center gap-2"><i class="fa-solid fa-circle-check text-emerald-600"></i> Qué haces con esto</div>
      <p class="text-sm text-slate-600 leading-snug">Ves cuántos hay y qué tan lejos te queda uno, pides el referido temprano, y sabes desde antes si vas a viajar — en vez de descubrirlo en la urgencia. Cada número tiene fuente; si ves un dato viejo, dínoslo y se corrige.</p>
    </div>
  </div>
</div>

<h2>¿Quieres la data completa? Reportes por especialidad</h2>
<p class="text-slate-600">Cada especialidad, con el número exacto y la fuente. Para el que quiere el detalle (y para periodistas y planes médicos).</p>

<div class="not-prose border border-slate-200 rounded-2xl overflow-hidden mt-4 shadow-sm">
  <div class="bg-gradient-to-br from-teal-600 to-teal-800 text-white p-5">
    <div class="text-xs font-bold uppercase tracking-widest text-teal-100">🩺 Fisiatras · Medicina Física y Rehabilitación</div>
    <div class="text-2xl font-black mt-1 leading-tight">252 en Puerto Rico · 1 por cada 46,665 personas en Cabo Rojo</div>
  </div>
  <div class="p-5 grid sm:grid-cols-3 gap-3 text-center">
    <div><div class="text-3xl font-black text-teal-700">53%</div><div class="text-xs text-slate-600 mt-1">en el metro de San Juan (26% de la población)</div></div>
    <div><div class="text-3xl font-black text-slate-800">2x</div><div class="text-xs text-slate-600 mt-1">más acceso en el metro que en el resto de la isla</div></div>
    <div><div class="text-3xl font-black text-red-600">1 : 46,665</div><div class="text-xs text-slate-600 mt-1">en Cabo Rojo · ~7x menos que el metro</div></div>
  </div>
  <div class="px-5 pb-5 flex flex-wrap gap-2">
    <a href="/categoria/fisiatra" class="inline-flex items-center gap-2 bg-teal-600 text-white font-bold px-4 py-2 rounded-full text-sm hover:bg-teal-700"><i class="fa-solid fa-list"></i> Ver el directorio</a>
    <a href="/reportes/acceso-fisiatras.pdf" class="inline-flex items-center gap-2 bg-slate-100 text-slate-800 font-bold px-4 py-2 rounded-full text-sm hover:bg-slate-200"><i class="fa-solid fa-file-pdf"></i> Bajar el reporte (1 pág)</a>
    <a href="https://caborojo.com/manual-paciente-fisiatra-puerto-rico/" class="inline-flex items-center gap-2 bg-slate-100 text-slate-800 font-bold px-4 py-2 rounded-full text-sm hover:bg-slate-200"><i class="fa-solid fa-book-medical"></i> El manual del paciente</a>
  </div>
</div>

<div class="not-prose border border-slate-200 rounded-2xl overflow-hidden mt-4 shadow-sm">
  <div class="bg-gradient-to-br from-teal-600 to-teal-800 text-white p-5">
    <div class="text-xs font-bold uppercase tracking-widest text-teal-100">&hearts; Cardiólogos</div>
    <div class="text-2xl font-black mt-1 leading-tight">339 en Puerto Rico · 27 en todo el oeste</div>
  </div>
  <div class="p-5 flex flex-wrap gap-2">
    <a href="/categoria/cardiologos" class="inline-flex items-center gap-2 bg-teal-600 text-white font-bold px-4 py-2 rounded-full text-sm hover:bg-teal-700"><i class="fa-solid fa-list"></i> Ver el directorio</a>
  </div>
</div>

<div class="not-prose border border-slate-200 rounded-2xl overflow-hidden mt-4 shadow-sm">
  <div class="bg-gradient-to-br from-teal-600 to-teal-800 text-white p-5">
    <div class="text-xs font-bold uppercase tracking-widest text-teal-100">🩺 Nefrólogos · Riñones y Diálisis</div>
    <div class="text-2xl font-black mt-1 leading-tight">154 en Puerto Rico · 0 en el pueblo de Cabo Rojo</div>
  </div>
  <div class="p-5 grid sm:grid-cols-3 gap-3 text-center">
    <div><div class="text-3xl font-black text-red-600">0</div><div class="text-xs text-slate-600 mt-1">en Cabo Rojo · te toca Mayagüez (15) o San Germán</div></div>
    <div><div class="text-3xl font-black text-emerald-600">1.6x</div><div class="text-xs text-slate-600 mt-1">el oeste sobre el promedio de PR · la diálisis está repartida</div></div>
    <div><div class="text-3xl font-black text-slate-800">1 : 21,336</div><div class="text-xs text-slate-600 mt-1">el promedio de PR · es subespecialidad</div></div>
  </div>
  <div class="px-5 pb-5 flex flex-wrap gap-2">
    <a href="/categoria/nefrologo" class="inline-flex items-center gap-2 bg-teal-600 text-white font-bold px-4 py-2 rounded-full text-sm hover:bg-teal-700"><i class="fa-solid fa-list"></i> Ver el directorio</a>
    <a href="/reportes/acceso-nefrologos.pdf" class="inline-flex items-center gap-2 bg-slate-100 text-slate-800 font-bold px-4 py-2 rounded-full text-sm hover:bg-slate-200"><i class="fa-solid fa-file-pdf"></i> Bajar el reporte (1 pág)</a>
  </div>
</div>

<div class="not-prose border border-slate-200 rounded-2xl overflow-hidden mt-4 shadow-sm">
  <div class="bg-gradient-to-br from-teal-600 to-teal-800 text-white p-5">
    <div class="text-xs font-bold uppercase tracking-widest text-teal-100">🩺 Endocrinólogos · Diabetes y Tiroides</div>
    <div class="text-2xl font-black mt-1 leading-tight">158 en Puerto Rico · el pueblo más diabético de EE.UU.</div>
  </div>
  <div class="p-5 grid sm:grid-cols-3 gap-3 text-center">
    <div><div class="text-3xl font-black text-amber-600">2.2x</div><div class="text-xs text-slate-600 mt-1">más acceso en el metro que en el oeste</div></div>
    <div><div class="text-3xl font-black text-red-600">1 : 46,665</div><div class="text-xs text-slate-600 mt-1">en Cabo Rojo · un solo endocrinólogo</div></div>
    <div><div class="text-3xl font-black text-slate-800">~1 de 6</div><div class="text-xs text-slate-600 mt-1">adultos en PR con diabetes · el que más falta</div></div>
  </div>
  <div class="px-5 pb-5 flex flex-wrap gap-2">
    <a href="/categoria/endocrinologo" class="inline-flex items-center gap-2 bg-teal-600 text-white font-bold px-4 py-2 rounded-full text-sm hover:bg-teal-700"><i class="fa-solid fa-list"></i> Ver el directorio</a>
    <a href="/reportes/acceso-endocrinologos.pdf" class="inline-flex items-center gap-2 bg-slate-100 text-slate-800 font-bold px-4 py-2 rounded-full text-sm hover:bg-slate-200"><i class="fa-solid fa-file-pdf"></i> Bajar el reporte (1 pág)</a>
  </div>
</div>

<div class="not-prose border border-slate-200 rounded-2xl overflow-hidden mt-4 shadow-sm">
  <div class="bg-gradient-to-br from-teal-600 to-teal-800 text-white p-5">
    <div class="text-xs font-bold uppercase tracking-widest text-teal-100">🩺 Neurólogos · Cerebro, Nervios, Derrame</div>
    <div class="text-2xl font-black mt-1 leading-tight">166 en Puerto Rico · 0 en el pueblo de Cabo Rojo</div>
  </div>
  <div class="p-5 grid sm:grid-cols-3 gap-3 text-center">
    <div><div class="text-3xl font-black text-amber-600">2.5x</div><div class="text-xs text-slate-600 mt-1">más acceso en el metro · la disparidad más alta</div></div>
    <div><div class="text-3xl font-black text-red-600">0</div><div class="text-xs text-slate-600 mt-1">en Cabo Rojo · el más cerca en Mayagüez (8)</div></div>
    <div><div class="text-3xl font-black text-slate-800">62%</div><div class="text-xs text-slate-600 mt-1">de los neurólogos de PR están en el metro</div></div>
  </div>
  <div class="px-5 pb-5 flex flex-wrap gap-2">
    <a href="/categoria/neurologo" class="inline-flex items-center gap-2 bg-teal-600 text-white font-bold px-4 py-2 rounded-full text-sm hover:bg-teal-700"><i class="fa-solid fa-list"></i> Ver el directorio</a>
    <a href="/reportes/acceso-neurologos.pdf" class="inline-flex items-center gap-2 bg-slate-100 text-slate-800 font-bold px-4 py-2 rounded-full text-sm hover:bg-slate-200"><i class="fa-solid fa-file-pdf"></i> Bajar el reporte (1 pág)</a>
  </div>
</div>

<div class="not-prose border border-slate-200 rounded-2xl overflow-hidden mt-4 shadow-sm">
  <div class="bg-gradient-to-br from-teal-600 to-teal-800 text-white p-5">
    <div class="text-xs font-bold uppercase tracking-widest text-teal-100">🦴 Ortopedas · Huesos, Fracturas, Rodilla</div>
    <div class="text-2xl font-black mt-1 leading-tight">152 en Puerto Rico · 0 en el pueblo de Cabo Rojo</div>
  </div>
  <div class="p-5 grid sm:grid-cols-3 gap-3 text-center">
    <div><div class="text-3xl font-black text-amber-600">2.3x</div><div class="text-xs text-slate-600 mt-1">más acceso en el metro que en el oeste</div></div>
    <div><div class="text-3xl font-black text-red-600">0</div><div class="text-xs text-slate-600 mt-1">en Cabo Rojo · el más cerca en Mayagüez (8)</div></div>
    <div><div class="text-3xl font-black text-slate-800">61%</div><div class="text-xs text-slate-600 mt-1">de los ortopedas de PR están en el metro</div></div>
  </div>
  <div class="px-5 pb-5 flex flex-wrap gap-2">
    <a href="/categoria/ortopeda" class="inline-flex items-center gap-2 bg-teal-600 text-white font-bold px-4 py-2 rounded-full text-sm hover:bg-teal-700"><i class="fa-solid fa-list"></i> Ver el directorio</a>
    <a href="/reportes/acceso-ortopedas.pdf" class="inline-flex items-center gap-2 bg-slate-100 text-slate-800 font-bold px-4 py-2 rounded-full text-sm hover:bg-slate-200"><i class="fa-solid fa-file-pdf"></i> Bajar el reporte (1 pág)</a>
  </div>
</div>

<div class="not-prose border border-dashed border-slate-300 rounded-2xl p-5 mt-4 bg-slate-50">
  <div class="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Próximamente</div>
  <p class="text-sm text-slate-600">Ginecólogos · Gastroenterólogos · Dermatólogos · Urólogos. Cada uno con su reporte verificado. ¿Cuál te urge? Escríbele <strong>SALUD</strong> al ${PHONE_CTA}.</p>
</div>

<h2>Cómo lo medimos</h2>
<p>Conteo de médicos: registro federal <strong>NPPES / CMS</strong> (board-certificados, por código de taxonomía, individuos con práctica en Puerto Rico, junio 2026). Cada NPI es público y verificable. Población: <strong>Censo Decenal 2020 (U.S. Census Bureau)</strong>. Mantenido a mano, uno por uno. Si encuentras un dato viejo, dínoslo y se corrige.</p>
<p class="text-sm text-slate-600">¿Periodista o plan médico? Esta data es citable. <a href="mailto:angel@angelanderson.com" class="text-teal-600 hover:underline">angel@angelanderson.com</a>.</p>

<div class="not-prose mt-8 bg-teal-700 rounded-2xl p-6 text-center text-white">
  <p class="text-lg font-bold mb-1">¿Buscas un especialista cerca?</p>
  <p class="text-sm text-teal-100 mb-4">El Veci te dice quién resuelve, sin dar vueltas. Textea al <strong>${PHONE_CTA}</strong>:</p>
  <div class="flex flex-wrap gap-3 justify-center">
    <a href="https://wa.me/17874177711?text=FISIATRA" class="inline-flex items-center gap-2 bg-white text-teal-800 font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-50 transition-colors"><i class="fa-brands fa-whatsapp text-lg"></i> FISIATRA</a>
    <a href="https://wa.me/17874177711?text=CARDIOLOGO" class="inline-flex items-center gap-2 bg-white text-teal-800 font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-50 transition-colors"><i class="fa-brands fa-whatsapp text-lg"></i> CARDIOLOGO</a>
  </div>
  <p class="text-xs text-teal-200 mt-4">— Menos revolú, más sistema, mejor vida.</p>
</div>
`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Acceso a Salud en Puerto Rico — Reportes verificados por especialidad',
    description: 'Reportes de densidad de proveedores de salud en Puerto Rico por especialidad, con fuente federal NPPES/CMS y Censo 2020.',
    inLanguage: 'es',
    url: `${SITE_URL}/acceso`,
    isPartOf: { '@type': 'WebSite', name: 'Mapa de Cabo Rojo', url: SITE_URL },
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300')
  res.status(200).send(layout({
    title: 'Acceso a Salud en el Oeste — La data, sin spin',
    description: 'Reportes verificados de acceso a salud en Puerto Rico por especialidad: cuántos especialistas hay, dónde, y qué tan lejos te queda. NPPES/CMS + Censo 2020.',
    slug: 'acceso',
    ogImage: '/og/fisiatras.png',
    bodyHtml: body,
    jsonLd,
  }))
}

// =============== /acceso usage logger (folded in to stay under Vercel's 12-fn limit) ===============
const ACCESO_EVENTS = new Set(['lookup', 'click_directory', 'click_bot'])
async function handleAccesoLog(req: any, res: any) {
  try {
    let body: any = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
    body = body || {}
    const event = String(body.event || '').slice(0, 40)
    if (ACCESO_EVENTS.has(event)) {
      await supabase.from('acceso_events').insert({
        event,
        specialty: body.specialty ? String(body.specialty).slice(0, 40) : null,
        town: body.town ? String(body.town).slice(0, 60) : null,
        ua: String(req.headers['user-agent'] || '').slice(0, 300),
      })
    }
  } catch { /* analytics must never break the page */ }
  res.status(204).end()
}

// =============== /registro — Registro de Especialistas Médicos de PR ===============
// The only plain-Spanish, federally-verified (NPPES/CMS) registry of PR medical
// specialists a normal person can read. Counts embedded (updated at ingest);
// provider lists are LIVE from the DB via ?page=registro-data.
// Matrix order: [total, Oeste, Norte, Centro, Sur, Este, Metro]
const REGISTRY_SPECS: Array<{s:string;l:string;e:string;kw:string;md:boolean;t:number;r:Record<string,number>}> = [
  {s:'cardiólogo',l:'Cardiólogo',e:'❤️',kw:'CARDIOLOGO',md:true,t:339,r:{Oeste:27,Norte:30,Centro:3,Sur:39,Este:46,Metro:180}},
  {s:'psiquiatra',l:'Psiquiatra',e:'🧠',kw:'PSIQUIATRA',md:true,t:474,r:{Oeste:46,Norte:20,Centro:7,Sur:37,Este:61,Metro:303}},
  {s:'fisiatra',l:'Fisiatra',e:'🩺',kw:'FISIATRA',md:true,t:251,r:{Oeste:21,Norte:16,Centro:3,Sur:20,Este:41,Metro:150}},
  {s:'ginecólogo',l:'Ginecólogo / Obstetra',e:'🤰',kw:'GINECOLOGO',md:true,t:110,r:{Oeste:15,Norte:10,Centro:1,Sur:9,Este:11,Metro:64}},
  {s:'pediatra',l:'Pediatra',e:'🧒',kw:'PEDIATRA',md:true,t:76,r:{Oeste:7,Norte:4,Centro:2,Sur:12,Este:11,Metro:40}},
  {s:'dermatólogo',l:'Dermatólogo',e:'🧴',kw:'DERMATOLOGO',md:true,t:123,r:{Oeste:10,Norte:6,Centro:1,Sur:10,Este:12,Metro:84}},
  {s:'gastroenterólogo',l:'Gastroenterólogo',e:'🩺',kw:'GASTRO',md:true,t:203,r:{Oeste:19,Norte:23,Centro:3,Sur:15,Este:22,Metro:121}},
  {s:'oftalmólogo',l:'Oftalmólogo (ojos)',e:'👁️',kw:'OFTALMOLOGO',md:true,t:239,r:{Oeste:27,Norte:18,Centro:2,Sur:18,Este:24,Metro:150}},
  {s:'ortopeda',l:'Ortopeda',e:'🦴',kw:'ORTOPEDA',md:true,t:151,r:{Oeste:14,Norte:9,Centro:2,Sur:11,Este:20,Metro:95}},
  {s:'neurologo',l:'Neurólogo',e:'🧠',kw:'NEUROLOGO',md:true,t:165,r:{Oeste:15,Norte:6,Centro:1,Sur:7,Este:28,Metro:108}},
  {s:'urólogo',l:'Urólogo',e:'🩺',kw:'UROLOGO',md:true,t:120,r:{Oeste:10,Norte:7,Centro:3,Sur:17,Este:18,Metro:65}},
  {s:'endocrinologo',l:'Endocrinólogo (diabetes)',e:'🩺',kw:'ENDOCRINOLOGO',md:true,t:158,r:{Oeste:16,Norte:11,Centro:1,Sur:14,Este:21,Metro:95}},
  {s:'nefrólogo',l:'Nefrólogo (riñón)',e:'🫘',kw:'NEFROLOGO',md:true,t:155,r:{Oeste:24,Norte:14,Centro:2,Sur:24,Este:24,Metro:67}},
  {s:'neumólogo',l:'Neumólogo (pulmones)',e:'🫁',kw:'NEUMOLOGO',md:true,t:146,r:{Oeste:15,Norte:8,Centro:0,Sur:19,Este:20,Metro:84}},
  {s:'oncólogo',l:'Oncólogo / Hematólogo',e:'🎗️',kw:'ONCOLOGO',md:true,t:143,r:{Oeste:12,Norte:7,Centro:1,Sur:14,Este:23,Metro:85}},
  {s:'reumatólogo',l:'Reumatólogo (artritis)',e:'🦴',kw:'REUMATOLOGO',md:true,t:87,r:{Oeste:9,Norte:3,Centro:1,Sur:5,Este:13,Metro:56}},
  {s:'geriatra',l:'Geriatra (adultos mayores)',e:'👵',kw:'GERIATRA',md:true,t:105,r:{Oeste:4,Norte:5,Centro:0,Sur:7,Este:15,Metro:73}},
  {s:'otorrinolaringólogo',l:'Otorrino (oído/nariz/garganta)',e:'👂',kw:'OTORRINO',md:true,t:75,r:{Oeste:7,Norte:6,Centro:0,Sur:7,Este:5,Metro:50}},
  {s:'infectólogo',l:'Infectólogo',e:'🦠',kw:'INFECTOLOGO',md:true,t:122,r:{Oeste:9,Norte:9,Centro:2,Sur:11,Este:14,Metro:77}},
  {s:'alergista',l:'Alergista / Inmunólogo',e:'🤧',kw:'ALERGISTA',md:true,t:28,r:{Oeste:2,Norte:3,Centro:0,Sur:2,Este:1,Metro:20}},
  {s:'medicina de emergencia',l:'Medicina de Emergencia',e:'🚑',kw:'EMERGENCIA',md:true,t:342,r:{Oeste:24,Norte:9,Centro:5,Sur:61,Este:50,Metro:193}},
  {s:'cirujano general',l:'Cirujano General',e:'🔪',kw:'CIRUJANO',md:true,t:334,r:{Oeste:40,Norte:19,Centro:6,Sur:55,Este:31,Metro:182}},
  {s:'anestesiólogo',l:'Anestesiólogo',e:'💉',kw:'ANESTESIOLOGO',md:true,t:226,r:{Oeste:28,Norte:10,Centro:2,Sur:23,Este:23,Metro:140}},
  {s:'radiólogo',l:'Radiólogo (imágenes)',e:'🩻',kw:'RADIOLOGO',md:true,t:255,r:{Oeste:19,Norte:12,Centro:1,Sur:17,Este:30,Metro:176}},
  {s:'neurocirujano',l:'Neurocirujano',e:'🧠',kw:'NEUROCIRUJANO',md:true,t:44,r:{Oeste:1,Norte:4,Centro:0,Sur:2,Este:6,Metro:31}},
  {s:'cirujano plástico',l:'Cirujano Plástico',e:'✨',kw:'PLASTICO',md:true,t:19,r:{Oeste:1,Norte:0,Centro:0,Sur:1,Este:4,Metro:13}},
  {s:'cirujano torácico',l:'Cirujano Torácico',e:'🫁',kw:'TORACICO',md:true,t:15,r:{Oeste:1,Norte:1,Centro:0,Sur:2,Este:1,Metro:10}},
  {s:'coloproctólogo',l:'Coloproctólogo (colon/recto)',e:'🩺',kw:'COLOPROCTOLOGO',md:true,t:4,r:{Oeste:0,Norte:0,Centro:0,Sur:0,Este:0,Metro:4}},
  {s:'manejo de dolor',l:'Manejo de Dolor',e:'💢',kw:'DOLOR',md:true,t:5,r:{Oeste:0,Norte:0,Centro:0,Sur:1,Este:0,Metro:4}},
  {s:'psicólogo',l:'Psicólogo (terapia)',e:'🧠',kw:'PSICOLOGO',md:false,t:1170,r:{Oeste:162,Norte:99,Centro:21,Sur:140,Este:159,Metro:588}},
  {s:'optómetra',l:'Optómetra (examen de vista)',e:'👓',kw:'OPTOMETRA',md:false,t:530,r:{Oeste:76,Norte:41,Centro:10,Sur:59,Este:82,Metro:262}},
  {s:'podiatra',l:'Podiatra (pies)',e:'🦶',kw:'PODIATRA',md:false,t:57,r:{Oeste:6,Norte:2,Centro:1,Sur:6,Este:9,Metro:33}},
]

const REG_PODCAST_URL = 'https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/podcast/especialistas-fantasma-desiertos.m4a'

async function handleRegistro(req: any, res: any) {
  const en = String(req.query.lang || '') === 'en'
  const t = (es: string, env: string) => en ? env : es
  const md = REGISTRY_SPECS.filter(x => x.md)
  const allied = REGISTRY_SPECS.filter(x => !x.md)
  // Live count — accurate + auto-updating (page is cached s-maxage=3600, so ~1 query/hour).
  // Only the 32 verified NPPES specialties count as "registry specialists".
  const { count: npiCount } = await supabase
    .from('places').select('id', { count: 'exact', head: true })
    .not('npi', 'is', null).eq('status', 'open')
    .in('subcategory', REGISTRY_SPECS.map(x => x.s))
  const totalVerified = (npiCount ?? 6247).toLocaleString('en-US')

  const optionsHtml = REGISTRY_SPECS.map(x =>
    `<option value="${escapeHtml(x.s)}">${x.e} ${escapeHtml(en ? (SPEC_LABEL_EN[x.s] || x.l) : x.l)} (${x.t})</option>`).join('')

  function card(x: typeof REGISTRY_SPECS[number]) {
    return `<a href="/registro/${specToUrl(x.s)}${en ? '?lang=en' : ''}" class="reg-card block text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-teal-400 hover:shadow-sm transition">
      <div class="flex items-baseline justify-between gap-2">
        <span class="font-bold text-slate-900 text-sm leading-tight">${x.e} ${escapeHtml(en ? (SPEC_LABEL_EN[x.s] || x.l) : x.l)}</span>
        <span class="text-teal-700 font-black text-lg">${x.t}</span>
      </div>
      <div class="text-xs text-slate-500 mt-1">${t('verificados en PR · toca pa\' ver la lista', 'verified in PR · tap to see the list')}</div>
    </a>`
  }

  const body = `
<h1>${t('Registro de Especialistas Médicos de Puerto Rico', 'Registry of Puerto Rico Medical Specialists')}</h1>

<p class="text-lg text-slate-600 mt-2">${t(`Encuentra tu especialista por especialidad y región. <strong>${totalVerified} verificados</strong> contra el registro federal NPPES. En español, gratis, sin cuenta.`, `Find your specialist by specialty and region. <strong>${totalVerified} verified</strong> against the federal NPPES registry. Free, no account needed.`)}</p>

<div class="not-prose mt-3 flex flex-wrap gap-2 text-xs">
  <span class="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold px-3 py-1 rounded-full"><i class="fa-solid fa-shield-halved"></i> ${t('NPI federal verificado', 'Federal NPI verified')}</span>
  <span class="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 text-teal-800 font-semibold px-3 py-1 rounded-full"><i class="fa-solid fa-list-check"></i> ${REGISTRY_SPECS.length} ${t('especialidades', 'specialties')}</span>
  <span class="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 font-semibold px-3 py-1 rounded-full"><i class="fa-solid fa-calendar-check"></i> ${t('Actualizado junio 2026', 'Updated June 2026')}</span>
</div>

<div id="reg-tool" class="not-prose mt-5 bg-white border-2 border-teal-300 rounded-2xl p-6 shadow-sm scroll-mt-24">
  <label class="block">
    <span class="text-sm font-bold text-slate-700"><i class="fa-solid fa-magnifying-glass text-teal-600"></i> ${t('Busca por nombre o especialidad', 'Search by name or specialty')}</span>
    <input id="rg-search" type="search" autocomplete="off" placeholder="${t('Ej: el nombre de tu médico, o \'cardiólogo\'…', 'e.g. your doctor\'s name, or \'cardiologist\'…')}" class="mt-1 w-full rounded-lg border border-slate-300 p-3 text-base">
  </label>
  <div id="rg-search-result" class="mt-3"></div>
  <div class="flex items-center gap-3 my-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
    <span class="flex-1 h-px bg-slate-200"></span>${t('o escoge especialidad y región', 'or pick specialty and region')}<span class="flex-1 h-px bg-slate-200"></span>
  </div>
  <div class="grid sm:grid-cols-2 gap-4">
    <label class="block">
      <span class="text-sm font-bold text-slate-700">1. ${t('¿Qué especialista buscas?', 'Which specialist?')}</span>
      <select id="rg-spec" class="mt-1 w-full rounded-lg border border-slate-300 p-3 text-base bg-white">
        <option value="">${t('Escoge...', 'Choose...')}</option>
        ${optionsHtml}
      </select>
    </label>
    <label class="block">
      <span class="text-sm font-bold text-slate-700">2. ${t('¿En qué región estás?', 'Which region?')}</span>
      <select id="rg-region" class="mt-1 w-full rounded-lg border border-slate-300 p-3 text-base bg-white">
        <option value="">${t('Escoge...', 'Choose...')}</option>
        <option value="Oeste">${t('Oeste', 'West')} (Mayagüez, Cabo Rojo, Aguadilla...)</option>
        <option value="Metro">${t('Área Metro', 'Metro')} (San Juan...)</option>
        <option value="Norte">${t('Norte', 'North')} (Arecibo, Manatí, Hatillo...)</option>
        <option value="Sur">${t('Sur', 'South')} (Ponce, Yauco, Guayama...)</option>
        <option value="Este">${t('Este', 'East')} (Caguas, Humacao, Fajardo...)</option>
        <option value="Centro">${t('Centro', 'Central')} (Aibonito, Barranquitas...)</option>
      </select>
    </label>
  </div>
  <div id="rg-result" class="mt-5"></div>
  <p id="rg-hint" class="mt-4 text-sm text-slate-400 text-center">${t('Escoge los dos y te decimos cuántos hay cerca, cuáles, y sus teléfonos.', 'Pick both and we\'ll tell you how many are near you, who, and their phone numbers.')}</p>
</div>

<p class="not-prose mt-3 text-sm text-slate-500 text-center">${t('¿Vives lejos del área metro?', 'Live far from the metro area?')} <a href="/registro/desiertos${en ? '?lang=en' : ''}" class="text-teal-700 font-semibold hover:underline">${t('Mira en qué regiones no hay ciertos especialistas →', 'See which regions have no specialists →')}</a></p>

<div class="not-prose mt-8 bg-gradient-to-br from-teal-50 to-white border-2 border-teal-200 rounded-2xl p-6">
  <div class="flex items-start gap-3">
    <div class="text-3xl leading-none">🎙️</div>
    <div class="flex-1 min-w-0">
      <h3 class="text-xl font-black text-slate-900">${t('Escucha: por qué existe este registro', 'Listen: why this registry exists')}</h3>
      <p class="text-slate-600 mt-1 text-[15px] leading-relaxed">${t('En cristiano: en Puerto Rico no es que falten médicos, es que están casi todos en el área metro. Y nadie te contesta lo más importante — si tu especialista coge tu plan. Aquí te lo explico.', 'Plain talk: Puerto Rico\'s problem is not a lack of doctors, it is that nearly all of them are in the metro area. And no one answers the thing that matters most — whether your specialist takes your plan. Here is why.')}</p>
      <audio controls preload="none" class="mt-3 w-full" src="${REG_PODCAST_URL}">
        ${t('Tu navegador no puede reproducir el audio.', 'Your browser cannot play this audio.')} <a href="${REG_PODCAST_URL}" class="text-teal-700 font-semibold">${t('Descárgalo aquí', 'Download it')}</a>.
      </audio>
    </div>
  </div>
</div>
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'AudioObject',
  name: 'Especialistas fantasma y desiertos médicos en Puerto Rico',
  description: 'Por qué en Puerto Rico el problema no es que falten médicos sino que se concentran en el área metro, y por qué nadie contesta si tu especialista acepta tu plan médico. Registro verificado contra el NPPES federal.',
  contentUrl: REG_PODCAST_URL,
  encodingFormat: 'audio/mp4',
  inLanguage: 'es',
  isAccessibleForFree: true,
  publisher: { '@type': 'Organization', name: 'Registro Médico PR', url: 'https://registromedicopr.com' }
})}</script>

<h2>${t(`Las ${REGISTRY_SPECS.length} especialidades del registro`, `The ${REGISTRY_SPECS.length} specialties in the registry`)}</h2>
<p class="text-slate-600 -mt-2">${t('El número es cuántos hay <strong>en toda la isla</strong>, verificados contra el registro federal. Toca cualquiera pa\' ver dónde están y sus teléfonos.', 'The number is how many there are <strong>across the whole island</strong>, verified against the federal registry. Tap any to see where they are and their phone numbers.')}</p>

<div class="not-prose mt-4 text-xs font-bold uppercase tracking-widest text-teal-700 mb-3">${t('Médicos especialistas', 'Medical specialists')}</div>
<div class="not-prose grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
  ${md.map(card).join('')}
</div>

<div class="not-prose mt-8 text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">${t('Otros proveedores de salud licenciados (no son médicos MD)', 'Other licensed health providers (not medical doctors / MDs)')}</div>
<p class="not-prose text-sm text-slate-500 mb-3">${t('Psicólogos, optómetras y podiatras tienen licencia y NPI federal, pero no son médicos. Los separamos pa\' que sepas exactamente a quién vas.', 'Psychologists, optometrists, and podiatrists are licensed and have a federal NPI, but they are not medical doctors. We list them separately so you know exactly who you are seeing.')}</p>
<div class="not-prose grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
  ${allied.map(card).join('')}
</div>

<div class="not-prose mt-10 bg-gradient-to-br from-amber-50 to-white border-2 border-amber-200 rounded-2xl p-6">
  <div class="text-3xl leading-none">🤝</div>
  <h3 class="text-xl font-black text-slate-900 mt-2">${t('¿Buscas esto por un familiar, desde lejos?', 'Doing this for a relative, from far away?')}</h3>
  <p class="text-slate-600 mt-2 text-[15px] leading-relaxed">${t('Yo pasé por esto. Llamé buscando un especialista y me dieron cita para meses. Si estás fuera de Puerto Rico cuidando a tus papás, o aquí sin tiempo pa\' dar vueltas, cuéntame qué necesitas y te escribo yo mismo. Sin compromiso.', 'I have been through this. I called for a specialist and got an appointment months out. If you live outside Puerto Rico caring for your parents, or here with no time to chase calls, tell me what you need and I will write you back myself. No obligation.')}</p>
  <form id="cj-form" class="mt-4 grid gap-3">
    <input id="cj-name" type="text" placeholder="${t('Tu nombre', 'Your name')}" class="w-full rounded-lg border border-slate-300 p-3 text-base">
    <textarea id="cj-need" rows="3" placeholder="${t('¿A quién cuidas y qué especialista necesitas? Ej: mi mamá en Cabo Rojo necesita un neumólogo.', 'Who are you caring for and which specialist? e.g. my mom in Cabo Rojo needs a pulmonologist.')}" class="w-full rounded-lg border border-slate-300 p-3 text-base"></textarea>
    <div class="grid sm:grid-cols-2 gap-3">
      <input id="cj-email" type="email" placeholder="${t('Tu email', 'Your email')}" class="w-full rounded-lg border border-slate-300 p-3 text-base">
      <input id="cj-wa" type="tel" placeholder="${t('WhatsApp (opcional)', 'WhatsApp (optional)')}" class="w-full rounded-lg border border-slate-300 p-3 text-base">
    </div>
    <button id="cj-send" type="submit" class="w-full sm:w-auto justify-self-start bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-3 rounded-full text-base">${t('Cuéntame — te escribo', 'Tell me — I will write you')}</button>
  </form>
  <div id="cj-thanks" hidden class="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-900 text-[15px]">${t('Gracias. Te escribo pronto, yo mismo. — Angel', 'Thank you. I will write you soon, myself. — Angel')}</div>
  <p class="text-xs text-slate-400 mt-3">${t('Te responde Angel directo. No es un formulario que cae en un buzón muerto.', 'Angel replies directly. This is not a form that lands in a dead inbox.')}</p>
</div>

<script>
(function(){
  var f=document.getElementById('cj-form');if(!f)return;
  var btn=document.getElementById('cj-send'),orig=btn.textContent;
  f.addEventListener('submit',function(ev){
    ev.preventDefault();
    var name=(document.getElementById('cj-name').value||'').trim();
    var email=(document.getElementById('cj-email').value||'').trim();
    var wa=(document.getElementById('cj-wa').value||'').trim();
    var need=(document.getElementById('cj-need').value||'').trim();
    if(!email&&!wa){alert("Déjame un email o un WhatsApp para poder escribirte.");return;}
    if(!need&&!name){alert("Cuéntame qué necesitas.");return;}
    btn.disabled=true;btn.textContent="Enviando...";
    try{gtag('event','conserje_intent',{has_email:!!email,has_wa:!!wa})}catch(e){}
    fetch('/api/mapa-pages?page=conserje-intent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,email:email,whatsapp:wa,need:need,lang:(document.documentElement.lang||'es')})})
      .then(function(r){return r.json();})
      .then(function(d){f.style.display='none';document.getElementById('cj-thanks').hidden=false;})
      .catch(function(){btn.disabled=false;btn.textContent=orig;alert("No se pudo enviar. Intenta de nuevo o escribe a angel@angelanderson.com");});
  });
})();
</script>

<script>
(function(){
  var SPECS=${JSON.stringify(REGISTRY_SPECS)};
  var BYID={}; SPECS.forEach(function(x){BYID[x.s]=x;});
  var sp=document.getElementById('rg-spec'),rg=document.getElementById('rg-region'),
      out=document.getElementById('rg-result'),hint=document.getElementById('rg-hint');
  function esc(s){return String(s||'').replace(/[<>&"]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c];});}
  function regionLabel(r){return r==='Metro'?'el área metro':'el '+r;}
  function loadList(spec,region){
    var box=document.getElementById('rg-list');if(!box)return;
    box.innerHTML='<div style="color:#64748b;font-size:14px;padding:8px 0;">Cargando los teléfonos...</div>';
    fetch('/api/mapa-pages?page=registro-data&spec='+encodeURIComponent(spec)+'&region='+encodeURIComponent(region))
      .then(function(r){return r.json();})
      .then(function(d){
        var list=(d&&d.providers)||[];
        if(!list.length){try{gtag('event','search_no_results',{spec:spec,region:region})}catch(e){}box.innerHTML='<div style="color:#64748b;font-size:14px;">No hay teléfonos cargados pa\\'esta combinación todavía. Escríbele al Veci abajo.</div>';return;}
        var rows=list.map(function(p){
          var tel=p.phone?('<a href="tel:'+esc(p.phone.replace(/[^0-9]/g,''))+'" style="color:#0f766e;font-weight:700;white-space:nowrap;">'+esc(p.phone)+'</a>'):'<span style="color:#94a3b8;">sin teléfono</span>';
          var nm=p.slug?('<a href="/especialista/'+encodeURIComponent(p.slug)+'" style="color:#0f172a;font-weight:600;text-decoration:none;border-bottom:1px dotted #94a3b8;">'+esc(p.name)+'</a>'):esc(p.name);
          return '<tr style="border-top:1px solid #e2e8f0;"><td style="padding:7px 8px;font-weight:600;color:#0f172a;">'+nm+'</td><td style="padding:7px 8px;color:#475569;">'+esc(p.municipality||'—')+'</td><td style="padding:7px 8px;text-align:right;">'+tel+'</td></tr>';
        }).join('');
        box.innerHTML='<div style="font-size:12px;color:#64748b;margin:4px 0 6px;">'+list.length+' en '+regionLabel(region)+(d.capped?'+ (mostrando los primeros '+list.length+')':'')+' · fuente NPPES federal</div>'
          +'<div style="max-height:340px;overflow:auto;border:1px solid #e2e8f0;border-radius:10px;"><table style="width:100%;border-collapse:collapse;font-size:14px;"><tbody>'+rows+'</tbody></table></div>';
      })
      .catch(function(){box.innerHTML='<div style="color:#dc2626;font-size:14px;">No se pudo cargar la lista. Intenta de nuevo.</div>';});
  }
  function render(){
    if(!sp.value||!rg.value){out.innerHTML='';hint.style.display='block';return;}
    hint.style.display='none';
    try{gtag('event','search_specialty',{spec:sp.value,region:rg.value})}catch(e){}
    var x=BYID[sp.value],region=rg.value,n=x.r[region]||0,M=x.r.Metro||0,tone,msg;
    if(region==='Metro'){
      msg='<b>En el área metro hay '+M+' '+esc(x.l)+'.</b> Es donde se concentran los especialistas de la isla — aquí no te toca viajar lejos.';tone='ok';
    } else if(n>=5){
      msg='<b>En el '+region+' hay '+n+'.</b> Hay con quién bregar cerca. El concentrado mayor sigue en el área metro ('+M+').';tone='ok';
    } else if(n>0){
      msg='<b>En el '+region+' solo hay '+n+'.</b> Son pocos — la cita puede tardar. El grupo grande está en el área metro ('+M+'). Pide el referido temprano.';tone='warn';
    } else {
      msg='<b>En el '+region+' el registro federal no muestra ninguno.</b> Te va a tocar viajar — el grupo más grande está en el área metro ('+M+').';tone='bad';
    }
    var bg=tone==='ok'?'#ecfdf5':tone==='warn'?'#fffbeb':'#fef2f2',bd=tone==='ok'?'#6ee7b7':tone==='warn'?'#fcd34d':'#fca5a5';
    out.innerHTML='<div style="background:'+bg+';border:2px solid '+bd+';border-radius:14px;padding:18px 20px;">'
      +'<p style="font-size:17px;line-height:1.5;color:#0f172a;margin:0 0 14px;">'+msg+'</p>'
      +'<div style="font-size:14px;color:#334155;line-height:1.6;margin-bottom:12px;">'
      +'<b>👉 Qué hacer:</b> pídele a tu médico primario un <b>referido</b> y pregunta si está en tu plan. ¿Buscas rápido? Escríbele <a href="https://wa.me/17874177711?text='+x.kw+'" style="color:#0f766e;font-weight:700;text-decoration:underline;">'+x.kw+' al 787-417-7711</a>.'
      +'</div>'
      +'<div id="rg-list"></div></div>';
    var lr=(n>0||region==='Metro')?region:'Metro';
    loadList(sp.value,lr);
  }
  sp.addEventListener('change',render);rg.addEventListener('change',render);
  function jumpToSpec(spec){
    sp.value=spec;
    if(!rg.value)rg.value='Oeste';
    document.getElementById('reg-tool').scrollIntoView({behavior:'smooth',block:'start'});
    render();
  }

  // --- Free-text search: specialty chips (instant) + provider names (debounced) ---
  var srch=document.getElementById('rg-search'),srchOut=document.getElementById('rg-search-result');
  function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');}
  function specChips(qn){
    var hits=SPECS.filter(function(x){return norm(x.l).indexOf(qn)>=0||norm(x.s).indexOf(qn)>=0;}).slice(0,8);
    if(!hits.length)return '';
    return '<div style="margin-bottom:10px;"><div style="font-size:12px;color:#64748b;margin-bottom:6px;">Especialidades:</div><div style="display:flex;flex-wrap:wrap;gap:6px;">'
      +hits.map(function(x){return '<button type="button" data-jump="'+esc(x.s)+'" style="background:#f0fdfa;border:1px solid #99f6e4;color:#0f766e;font-weight:700;font-size:13px;padding:5px 11px;border-radius:999px;cursor:pointer;">'+x.e+' '+esc(x.l)+' ('+x.t+')</button>';}).join('')
      +'</div></div>';
  }
  function bindJumps(){
    Array.prototype.forEach.call(srchOut.querySelectorAll('[data-jump]'),function(b){
      b.addEventListener('click',function(){jumpToSpec(b.getAttribute('data-jump'));});
    });
  }
  function renderProviders(list,capped,q){
    if(!list.length)return '<div style="color:#64748b;font-size:14px;padding:6px 0;">No hay nadie con ese nombre en el registro. Prueba con el apellido, o escoge la especialidad abajo.</div>';
    var rows=list.map(function(p){
      var lab=(BYID[p.subcategory]&&BYID[p.subcategory].l)||p.subcategory;
      var tel=p.phone?('<a href="tel:'+esc(p.phone.replace(/[^0-9]/g,''))+'" style="color:#0f766e;font-weight:700;white-space:nowrap;">'+esc(p.phone)+'</a>'):'<span style="color:#94a3b8;">sin teléfono</span>';
      var nm=p.slug?('<a href="/especialista/'+encodeURIComponent(p.slug)+'" style="color:#0f172a;font-weight:600;text-decoration:none;border-bottom:1px dotted #94a3b8;">'+esc(p.name)+'</a>'):esc(p.name);
      return '<tr style="border-top:1px solid #e2e8f0;"><td style="padding:7px 8px;font-weight:600;color:#0f172a;">'+nm+'</td><td style="padding:7px 8px;color:#475569;">'+esc(lab)+'</td><td style="padding:7px 8px;color:#475569;">'+esc(p.municipality||'—')+'</td><td style="padding:7px 8px;text-align:right;">'+tel+'</td></tr>';
    }).join('');
    return '<div style="font-size:12px;color:#64748b;margin:4px 0 6px;">'+list.length+(capped?'+':'')+' con "'+esc(q)+'" en el nombre · fuente NPPES federal</div>'
      +'<div style="max-height:340px;overflow:auto;border:1px solid #e2e8f0;border-radius:10px;"><table style="width:100%;border-collapse:collapse;font-size:14px;"><tbody>'+rows+'</tbody></table></div>';
  }
  var st;
  srch.addEventListener('input',function(){
    var q=srch.value.trim(),qn=norm(q);
    clearTimeout(st);
    if(qn.length<2){srchOut.innerHTML='';return;}
    var chips=specChips(qn);
    srchOut.innerHTML=chips+(q.length>=3?'<div style="color:#64748b;font-size:14px;padding:6px 0;">Buscando "'+esc(q)+'"…</div>':'');
    bindJumps();
    if(q.length<3)return;
    st=setTimeout(function(){
      fetch('/api/mapa-pages?page=registro-search&q='+encodeURIComponent(q))
        .then(function(r){return r.json();})
        .then(function(d){
          if(srch.value.trim()!==q)return; // stale response
          srchOut.innerHTML=specChips(qn)+renderProviders((d&&d.providers)||[],d&&d.capped,q);
          bindJumps();
        })
        .catch(function(){srchOut.innerHTML=specChips(qn)+'<div style="color:#dc2626;font-size:14px;">No se pudo buscar. Intenta de nuevo.</div>';bindJumps();});
    },280);
  });
})();
</script>

<h2 id="como-se-hizo">${t('Cómo se hizo (y por qué puedes confiar)', 'How it was made (and why you can trust it)')}</h2>
<p>${t('Cada persona en este registro existe en el <strong>NPPES</strong> (National Plan and Provider Enumeration System), el registro oficial del gobierno federal de EE.UU. — el mismo que usan Medicare y los planes médicos. Tomamos solo <strong>proveedores individuales con práctica en Puerto Rico</strong>, por código de taxonomía (la especialidad oficial), y lo pusimos en español, por región. El <strong>NPI</strong> de cada uno es un número público que cualquiera puede verificar.', 'Every person in this registry exists in the <strong>NPPES</strong> (National Plan and Provider Enumeration System), the official US federal registry that Medicare and health plans use. We took only <strong>individual providers practicing in Puerto Rico</strong>, by taxonomy code (the official specialty), and organized them by region. Each <strong>NPI</strong> is a public number anyone can verify.')}</p>
<p class="text-sm text-slate-600">${t('Lo que no encontrarás en ningún otro sitio: el gobierno tiene la data, pero enterrada, en inglés, sin organizar por pueblo. La pusimos clara, en un solo sitio, a mano. Si ves un dato viejo o un especialista que ya no ejerce, dínoslo y se corrige — ', 'What you won\'t find anywhere else: the government has the data, but buried, in English, not organized by town. We made it clear, in one place, by hand. See something outdated or a provider who no longer practices here? Tell us and we fix it — ')}<a href="mailto:angel@angelanderson.com" class="text-teal-600 hover:underline">angel@angelanderson.com</a>.</p>
<p class="text-sm text-slate-600"><strong>${t('¿Periodista, plan médico, o investigador?', 'Journalist, health plan, or researcher?')}</strong> ${t('Esta data es citable y hay acceso programático. Escríbenos.', 'This data is citable and programmatic access is available. Reach out.')}</p>

<div class="not-prose mt-8 bg-teal-700 rounded-2xl p-6 text-center text-white">
  <p class="text-lg font-bold mb-1">${t('¿No sabes por dónde empezar?', 'Not sure where to start?')}</p>
  <p class="text-sm text-teal-100 mb-4">${t('Antes de dar vueltas, escríbele al Veci. Te dice quién resuelve, sin enredos. Al', 'Before driving around, text El Veci. He tells you who can help, no hassle. At')} <strong>${PHONE_CTA}</strong>:</p>
  <div class="flex flex-wrap gap-3 justify-center">
    <a href="https://wa.me/17874177711?text=ESPECIALISTA" class="inline-flex items-center gap-2 bg-white text-teal-800 font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-50"><i class="fa-brands fa-whatsapp text-lg"></i> ESPECIALISTA</a>
    <a href="/acceso" class="inline-flex items-center gap-2 bg-teal-800 text-white font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-900"><i class="fa-solid fa-chart-simple"></i> ${t('Ver el reporte de acceso', 'See the access report')}</a>
  </div>
  <p class="text-xs text-teal-200 mt-4">— Menos revolú, más sistema, mejor vida.</p>
</div>
`
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'MedicalWebPage',
      name: 'Registro de Especialistas Médicos de Puerto Rico',
      description: `Registro verificado de ${totalVerified} especialistas y proveedores de salud de Puerto Rico, por especialidad y región, con fuente federal NPPES/CMS. En español.`,
      inLanguage: 'es',
      url: 'https://registromedicopr.com/registro',
      publisher: { '@type': 'Organization', name: 'Registro Médico PR', url: 'https://registromedicopr.com' },
      medicalAudience: 'Patient',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: '¿Cuántos especialistas médicos hay en Puerto Rico?',
          acceptedAnswer: { '@type': 'Answer', text: `En Puerto Rico hay ${totalVerified} especialistas médicos verificados contra el registro federal NPPES/CMS, organizados por ${REGISTRY_SPECS.length} especialidades y por región.` } },
        { '@type': 'Question', name: '¿Cómo se verifica este registro de médicos?',
          acceptedAnswer: { '@type': 'Answer', text: 'Cada proveedor existe en el NPPES (National Plan and Provider Enumeration System), el registro oficial del gobierno federal de EE.UU. que usan Medicare y los planes médicos. Cada NPI es un número público que cualquiera puede verificar.' } },
        { '@type': 'Question', name: '¿Es gratis buscar un especialista aquí?',
          acceptedAnswer: { '@type': 'Answer', text: 'Sí. Buscar es gratis y no requiere cuenta. Puedes buscar por nombre o por especialidad y región, y ver el teléfono de cada especialista.' } },
        { '@type': 'Question', name: '¿En qué regiones de Puerto Rico no hay ciertos especialistas?',
          acceptedAnswer: { '@type': 'Answer', text: 'Hay especialidades sin ningún proveedor en regiones enteras. Por ejemplo, el centro de la isla no tiene neumólogos, geriatras ni otorrinos según el registro federal, mientras el área metro concentra la mayoría. El mapa de acceso por región está en registromedicopr.com/registro/desiertos.' } },
      ],
    },
  ]
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300')
  res.status(200).send(layout({
    title: t('Registro de Especialistas Médicos de Puerto Rico — verificado, en español', 'Puerto Rico Medical Specialist Registry — verified, federal NPPES data'),
    description: t(`${totalVerified} especialistas de PR verificados contra el registro federal NPPES/CMS. Busca por especialidad y región, en español, gratis.`, `${totalVerified} PR specialists verified against the federal NPPES/CMS registry. Search by specialty and region. Free.`),
    slug: 'registro',
    bodyHtml: body,
    jsonLd,
    ogImage: '/og/registro.png',
    host: req.headers?.host,
    canonicalHost: 'https://registromedicopr.com',
    canonicalUrl: 'https://registromedicopr.com',
    lang: en ? 'en' : 'es',
  }))
}

// =============== /registro live provider lookup (folded in, stays under 12-fn limit) ===============
const REGISTRY_SUBS = new Set(REGISTRY_SPECS.map(x => x.s))
async function handleRegistroData(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  try {
    const spec = String(req.query.spec || '')
    const region = String(req.query.region || '')
    if (!REGISTRY_SUBS.has(spec)) { res.status(200).send(JSON.stringify({ providers: [] })); return }
    let q = supabase
      .from('places')
      .select('name,municipality,phone,npi,slug')
      .eq('category', 'HEALTH').eq('subcategory', spec).not('npi', 'is', null)
      .order('municipality', { ascending: true }).limit(120)
    if (region) q = q.eq('region', region)
    const { data } = await q
    const providers = (data || []).map((p: any) => ({ name: p.name, municipality: p.municipality, phone: p.phone, slug: p.slug }))
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300')
    res.status(200).send(JSON.stringify({ providers, capped: providers.length >= 120 }))
  } catch {
    res.status(200).send(JSON.stringify({ providers: [] }))
  }
}

// =============== /registro free-text name search (folded in, stays under 12-fn limit) ===============
async function handleRegistroSearch(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  try {
    const q = String(req.query.q || '').trim()
    if (q.length < 3) { res.status(200).send(JSON.stringify({ providers: [] })); return }
    // strip PostgREST/ilike metacharacters so the pattern stays a literal substring
    const safe = q.replace(/[%,()*]/g, ' ').trim()
    const { data } = await supabase
      .from('places')
      .select('name,subcategory,municipality,phone,region,slug')
      .eq('category', 'HEALTH').not('npi', 'is', null)
      .ilike('name', `%${safe}%`)
      .order('name', { ascending: true }).limit(40)
    const providers = (data || [])
      .filter((p: any) => REGISTRY_SUBS.has(p.subcategory))
      .map((p: any) => ({ name: p.name, subcategory: p.subcategory, municipality: p.municipality, phone: p.phone, region: p.region, slug: p.slug }))
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=300')
    res.status(200).send(JSON.stringify({ providers, capped: providers.length >= 40 }))
  } catch {
    res.status(200).send(JSON.stringify({ providers: [] }))
  }
}

// =============== /especialista/:slug — página por cada especialista (statewide, NPPES) ===============
// THE flag-plant: one page per verified provider in Puerto Rico. Statewide-aware (NOT Cabo Rojo).
const REGISTRY_BYSUB: Record<string, typeof REGISTRY_SPECS[number]> = {}
REGISTRY_SPECS.forEach(x => { REGISTRY_BYSUB[x.s] = x })

const REGION_BLURB: Record<string, string> = {
  Oeste: 'Mayagüez, Cabo Rojo, Aguadilla y el oeste',
  Metro: 'San Juan y el área metropolitana',
  Norte: 'Arecibo, Manatí, Hatillo y el norte',
  Sur: 'Ponce, Yauco, Guayama y el sur',
  Este: 'Caguas, Humacao, Fajardo y el este',
  Centro: 'Aibonito, Barranquitas y la montaña',
  'Diáspora': 'fuera de Puerto Rico',
}

function cleanProviderName(n: string): string {
  return String(n || '').replace(/^Dr\(a\)\.\s*/, '').trim()
}

async function handleEspecialista(req: any, res: any) {
  const slug = String(req.query.slug || '').trim()
  const lang: 'es' | 'en' = String(req.query.lang || '') === 'en' ? 'en' : 'es'
  if (!slug) { res.status(400).send('Slug requerido'); return }

  const { data: place } = await supabase
    .from('places')
    .select('id,name,subcategory,municipality,region,phone,address,npi,lat,lon,slug,last_verified_at,accepted_plans')
    .eq('slug', slug).not('npi', 'is', null).maybeSingle()

  if (!place) {
    res.status(404).send(layout({
      title: 'Especialista no encontrado',
      description: 'Ese perfil no está en el registro. Busca por nombre o especialidad.',
      slug: 'registro',
      bodyHtml: `<h1>No encontramos ese especialista</h1><p class="text-slate-600">Puede que el enlace esté viejo. <a href="/registro" class="text-teal-700 font-semibold">Vuelve al registro y busca por nombre o especialidad →</a></p>`,
      host: req.headers?.host,
      canonicalHost: 'https://registromedicopr.com',
    }))
    return
  }

  // Registry integrity: only the 32 verified NPPES specialties get a specialist page.
  // Non-registry NPI rows (old Cabo Rojo health businesses: farmacia, spa, etc.) → back to /registro.
  if (!REGISTRY_SUBS.has(place.subcategory)) {
    res.statusCode = 302
    res.setHeader('Location', '/registro')
    res.end()
    return
  }

  const spec = REGISTRY_BYSUB[place.subcategory] || null
  const specLabel = spec ? spec.l : (place.subcategory || 'Proveedor de salud')
  const specEmoji = spec ? spec.e : '🩺'
  const isMD = spec ? spec.md : true
  const name = cleanProviderName(place.name)
  const muni = place.municipality || 'Puerto Rico'
  const region = place.region || ''
  const regionLabel = region === 'Metro' ? 'área metro' : region
  const npi = place.npi as string
  const phoneDigits = (place.phone || '').replace(/\D/g, '')
  const telLink = phoneDigits.length >= 7 ? `tel:${phoneDigits}` : null
  const waLink = phoneDigits.length >= 10 ? `https://wa.me/1${phoneDigits.slice(-10)}` : null
  const verifiedDate = place.last_verified_at
    ? new Date(place.last_verified_at).toLocaleDateString('es-PR', { year: 'numeric', month: 'long' })
    : null
  const pageUrl = `https://registromedicopr.com/especialista/${encodeURIComponent(place.slug)}`

  const T = lang === 'en' ? {
    sub: `${specLabel} in ${muni}, Puerto Rico. Verified against the U.S. federal NPPES registry.`,
    verified: 'Verified · federal NPI', call: 'Call', wa: 'WhatsApp', veci: 'Ask El Veci',
    addr: 'Address', regionH: 'Region', specialtyH: 'Specialty', npiH: 'Federal NPI',
    othersH: `Other ${specLabel.toLowerCase()}s in ${regionLabel || 'PR'}`,
    claimH: 'Is this your profile?', notFound: 'Not who you were looking for?',
  } : {
    sub: `${specLabel} en ${muni}, Puerto Rico. Verificado contra el registro federal NPPES de EE.UU.`,
    verified: 'Verificado · NPI federal', call: 'Llamar', wa: 'WhatsApp', veci: 'Pregúntale al Veci',
    addr: 'Dirección', regionH: 'Región', specialtyH: 'Especialidad', npiH: 'NPI federal',
    othersH: `Otros ${specLabel.toLowerCase()} en el ${regionLabel || 'PR'}`,
    claimH: '¿Es tu perfil?', notFound: '¿No es a quien buscabas?',
  }

  // "Otros cerca" — same specialty + region, with a page of their own
  let others: any[] = []
  if (place.subcategory) {
    let q = supabase.from('places')
      .select('name,municipality,slug,phone').eq('subcategory', place.subcategory)
      .not('npi', 'is', null).not('slug', 'is', null).neq('id', place.id)
      .order('municipality', { ascending: true }).limit(8)
    if (region) q = q.eq('region', region)
    const { data } = await q
    others = data || []
  }

  const mapsEmbed = (place.lat && place.lon)
    ? `https://maps.google.com/maps?q=${place.lat},${place.lon}&z=15&output=embed`
    : `https://maps.google.com/maps?q=${encodeURIComponent((place.address || (muni + ', Puerto Rico')))}&z=13&output=embed`

  // Allowlist both values before they touch the inline onclick (HTML+JS context).
  // spec is non-null only when subcategory ∈ REGISTRY_SPECS; region must be a known PR region.
  const REG_REGIONS = new Set(['Oeste', 'Norte', 'Centro', 'Sur', 'Este', 'Metro', 'Diáspora'])
  const safeSpec = spec ? place.subcategory : ''
  const safeRegion = REG_REGIONS.has(region) ? region : ''
  const evtAttr = `specialty:'${safeSpec}',region:'${safeRegion}'`
  const actionBtns = `<div class="not-prose flex flex-wrap gap-3 mt-5">
    ${telLink ? `<a href="${telLink}" onclick="try{gtag('event','click_to_call',{${evtAttr}})}catch(e){}" class="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold px-5 py-3 rounded-xl text-base"><i class="fa-solid fa-phone"></i> ${T.call} ${escapeHtml(place.phone)}</a>` : ''}
    ${waLink ? `<a href="${waLink}" onclick="try{gtag('event','click_whatsapp',{${evtAttr}})}catch(e){}" class="inline-flex items-center gap-2 bg-white border-2 border-teal-600 text-teal-700 font-bold px-5 py-3 rounded-xl text-base hover:bg-teal-50"><i class="fa-brands fa-whatsapp text-lg"></i> ${T.wa}</a>` : ''}
    <a href="https://wa.me/17874177711?text=${spec ? spec.kw : 'ESPECIALISTA'}" class="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-3 rounded-xl text-base"><i class="fa-brands fa-whatsapp"></i> ${T.veci}</a>
  </div>`

  const dataRows = `<div class="not-prose grid sm:grid-cols-2 gap-3 mt-6">
    <div class="bg-white border border-slate-200 rounded-xl p-4"><div class="text-xs uppercase tracking-wide text-slate-400 font-bold">${T.specialtyH}</div><div class="text-slate-900 font-semibold mt-1">${specEmoji} ${escapeHtml(specLabel)}</div></div>
    <div class="bg-white border border-slate-200 rounded-xl p-4"><div class="text-xs uppercase tracking-wide text-slate-400 font-bold">${T.regionH}</div><div class="text-slate-900 font-semibold mt-1">${escapeHtml(muni)}${region ? ` · ${escapeHtml(region)}` : ''}</div>${region && REGION_BLURB[region] ? `<div class="text-xs text-slate-500 mt-0.5">${escapeHtml(REGION_BLURB[region])}</div>` : ''}</div>
    ${place.address ? `<div class="bg-white border border-slate-200 rounded-xl p-4 sm:col-span-2"><div class="text-xs uppercase tracking-wide text-slate-400 font-bold">${T.addr}</div><div class="text-slate-900 mt-1">${escapeHtml(place.address)}</div></div>` : ''}
    <div class="bg-white border border-slate-200 rounded-xl p-4 sm:col-span-2"><div class="text-xs uppercase tracking-wide text-slate-400 font-bold">${T.npiH}</div><div class="text-slate-900 font-mono mt-1">${escapeHtml(npi)} <a href="https://npiregistry.cms.hhs.gov/provider-view/${escapeHtml(npi)}" target="_blank" rel="noopener" class="text-teal-600 text-sm font-sans font-semibold ml-2">verificar en el registro federal →</a></div></div>
  </div>`

  const othersHtml = others.length ? `<h2>${escapeHtml(T.othersH)}</h2>
    <div class="not-prose grid sm:grid-cols-2 gap-2 mt-2">
      ${others.map(o => `<a href="/especialista/${encodeURIComponent(o.slug)}" class="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-4 py-3 hover:border-teal-400 hover:shadow-sm transition">
        <span class="font-semibold text-slate-800 text-sm">${escapeHtml(cleanProviderName(o.name))}</span>
        <span class="text-xs text-slate-500 whitespace-nowrap">${escapeHtml(o.municipality || '')}</span>
      </a>`).join('')}
    </div>
    <p class="text-sm text-slate-500 mt-2"><a href="/registro" class="text-teal-700 font-semibold">Ver los ${spec ? spec.t : ''} ${escapeHtml(specLabel.toLowerCase())} de toda la isla →</a></p>` : ''

  // Claim form (Product 4 — the monetization + data loop)
  const claimForm = `<div class="not-prose mt-8 bg-amber-50 border-2 border-amber-200 rounded-2xl p-5">
    <button type="button" id="claim-toggle" class="w-full flex items-center justify-between text-left">
      <span class="font-bold text-amber-900 text-base"><i class="fa-solid fa-user-check"></i> ${escapeHtml(T.claimH)} Confírmalo y di qué planes médicos aceptas.</span>
      <i class="fa-solid fa-chevron-down text-amber-700" id="claim-chev"></i>
    </button>
    <form id="claim-form" class="hidden mt-4 space-y-3" data-npi="${escapeHtml(npi)}" data-place="${escapeHtml(place.id)}" data-name="${escapeHtml(name)}">
      <p class="text-sm text-amber-800">Lo revisamos y, si cuadra, tu perfil aparece destacado con los planes que aceptas — para que el paciente correcto te encuentre. Gratis confirmar. Sin compromiso.</p>
      <div class="grid sm:grid-cols-2 gap-3">
        <input name="claimant_name" required placeholder="Tu nombre" class="rounded-lg border border-amber-300 p-2.5 text-sm">
        <select name="claimant_role" class="rounded-lg border border-amber-300 p-2.5 text-sm bg-white">
          <option value="el médico">Soy el especialista</option>
          <option value="oficina">Trabajo en la oficina</option>
          <option value="familiar">Soy familiar</option>
          <option value="otro">Otro</option>
        </select>
        <input name="contact_phone" placeholder="Teléfono de contacto" class="rounded-lg border border-amber-300 p-2.5 text-sm">
        <input name="contact_email" type="email" placeholder="Correo (opcional)" class="rounded-lg border border-amber-300 p-2.5 text-sm">
      </div>
      <input name="corrected_phone" placeholder="¿El teléfono de arriba está mal? Pon el correcto aquí" class="w-full rounded-lg border border-amber-300 p-2.5 text-sm">
      <input name="accepted_plans" placeholder="Planes que aceptas (ej: MMM, Triple-S, Plan Medicare, First Medical...)" class="w-full rounded-lg border border-amber-300 p-2.5 text-sm">
      <label class="flex items-center gap-2 text-sm text-amber-900"><input type="checkbox" name="wants_vitrina" class="rounded"> Me interesa que me contacten para mantener mi perfil al día</label>
      <button type="submit" class="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm">Enviar confirmación</button>
      <div id="claim-status" class="text-sm hidden"></div>
    </form>
  </div>
  <script>
  (function(){
    var t=document.getElementById('claim-toggle'),f=document.getElementById('claim-form'),c=document.getElementById('claim-chev');
    if(t)t.addEventListener('click',function(){f.classList.toggle('hidden');c.style.transform=f.classList.contains('hidden')?'':'rotate(180deg)';});
    if(f)f.addEventListener('submit',function(e){
      e.preventDefault();var st=document.getElementById('claim-status');var btn=f.querySelector('button[type=submit]');
      btn.disabled=true;btn.textContent='Enviando…';
      var fd=new FormData(f);var body={npi:f.dataset.npi,place_id:f.dataset.place,provider_name:f.dataset.name};
      fd.forEach(function(v,k){body[k]=v;});body.wants_vitrina=!!fd.get('wants_vitrina');
      fetch('/api/mapa-pages?page=especialista-claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
       .then(function(r){return r.json();}).then(function(d){
         st.classList.remove('hidden');st.className='text-sm text-emerald-700 font-semibold';
         st.textContent='✓ Gracias. Lo revisamos y te confirmamos. — Angel';f.querySelector('button').style.display='none';
       }).catch(function(){st.classList.remove('hidden');st.className='text-sm text-red-600';st.textContent='No se pudo enviar. Escríbele al Veci al 787-417-7711.';btn.disabled=false;btn.textContent='Enviar confirmación';});
    });
  })();
  </script>`

  const body = `
<nav class="not-prose text-sm text-slate-500 mb-3"><a href="/registro" class="hover:text-teal-700">Registro Médico PR</a> <span class="text-slate-300">/</span> <a href="/registro" class="hover:text-teal-700">${escapeHtml(specLabel)}</a> <span class="text-slate-300">/</span> <span class="text-slate-700">${escapeHtml(name)}</span></nav>

<div class="not-prose flex items-start gap-4">
  <div class="text-5xl leading-none">${specEmoji}</div>
  <div>
    <h1 class="text-3xl font-black text-slate-900 leading-tight">${escapeHtml(name)}</h1>
    <p class="text-lg text-slate-600 mt-1">${escapeHtml(specLabel)} · ${escapeHtml(muni)}${region ? ` · ${escapeHtml(region)}` : ''}</p>
    <div class="mt-3 flex flex-wrap gap-2">
      <span class="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold px-3 py-1 rounded-full text-sm"><i class="fa-solid fa-shield-halved"></i> ${T.verified}</span>
      ${isMD ? '' : '<span class="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 text-slate-600 font-semibold px-3 py-1 rounded-full text-sm">Proveedor licenciado (no es médico MD)</span>'}
      ${verifiedDate ? `<span class="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-500 px-3 py-1 rounded-full text-xs">Verificado ${escapeHtml(verifiedDate)}</span>` : ''}
    </div>
  </div>
</div>

${actionBtns}
${dataRows}

<div class="not-prose mt-6 rounded-2xl overflow-hidden border border-slate-200"><iframe src="${mapsEmbed}" width="100%" height="280" style="border:0;" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>

${claimForm}

${othersHtml}

<div class="not-prose mt-8 bg-teal-700 rounded-2xl p-6 text-center text-white">
  <p class="text-lg font-bold mb-1">${escapeHtml(T.notFound)}</p>
  <p class="text-sm text-teal-100 mb-4">Antes de dar vueltas, escríbele al Veci. Te dice quién resuelve, en qué región, sin enredos. Al <strong>${PHONE_CTA}</strong>:</p>
  <div class="flex flex-wrap gap-3 justify-center">
    <a href="https://wa.me/17874177711?text=${spec ? spec.kw : 'ESPECIALISTA'}" class="inline-flex items-center gap-2 bg-white text-teal-800 font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-50"><i class="fa-brands fa-whatsapp text-lg"></i> ${spec ? spec.kw : 'ESPECIALISTA'}</a>
    <a href="/registro" class="inline-flex items-center gap-2 bg-teal-800 text-white font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-900"><i class="fa-solid fa-magnifying-glass"></i> Buscar otro especialista</a>
  </div>
</div>

<p class="text-xs text-slate-500 mt-6">${escapeHtml(name)} aparece en el <strong>NPPES</strong>, el registro oficial del gobierno federal de EE.UU. — el mismo que usan Medicare y los planes médicos. El NPI <strong>${escapeHtml(npi)}</strong> es público y cualquiera puede verificarlo. ¿Dato viejo o ya no ejerce aquí? Dínoslo: <a href="mailto:angel@angelanderson.com" class="text-teal-600">angel@angelanderson.com</a>.</p>
`

  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': isMD ? 'Physician' : 'MedicalBusiness',
    name,
    medicalSpecialty: specLabel,
    telephone: place.phone || undefined,
    url: pageUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: place.address || undefined,
      addressLocality: muni,
      addressRegion: 'Puerto Rico',
      addressCountry: 'US',
    },
    geo: (place.lat && place.lon) ? { '@type': 'GeoCoordinates', latitude: place.lat, longitude: place.lon } : undefined,
    areaServed: { '@type': 'AdministrativeArea', name: region ? `${region}, Puerto Rico` : 'Puerto Rico' },
    identifier: { '@type': 'PropertyValue', name: 'NPI', value: npi },
    isAcceptingNewPatients: undefined,
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: `${name} — ${specLabel} en ${muni}, PR`,
    description: T.sub,
    slug: `especialista/${place.slug}`,
    bodyHtml: body,
    jsonLd,
    ogImage: '/og/registro.png',
    host: req.headers?.host,
    canonicalHost: 'https://registromedicopr.com',
    lang,
  }))
}

async function handleEspecialistaClaim(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  try {
    const b = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}')
    if (!b.npi && !b.place_id) { res.status(400).send(JSON.stringify({ ok: false })); return }
    const plans = String(b.accepted_plans || '').split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean)
    await supabase.from('provider_claims').insert({
      place_id: b.place_id || null,
      npi: String(b.npi || '').slice(0, 20) || null,
      provider_name: String(b.provider_name || '').slice(0, 200) || null,
      claimant_name: String(b.claimant_name || '').slice(0, 120) || null,
      claimant_role: String(b.claimant_role || '').slice(0, 40) || null,
      contact_phone: String(b.contact_phone || '').slice(0, 40) || null,
      contact_email: String(b.contact_email || '').slice(0, 120) || null,
      corrected_phone: String(b.corrected_phone || '').slice(0, 40) || null,
      accepted_plans: plans.length ? plans : null,
      wants_vitrina: !!b.wants_vitrina,
      source: 'especialista_page',
    })
    // Notify Angel (non-blocking)
    if (RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM_EMAIL, to: REPLY_TO, reply_to: b.contact_email || REPLY_TO,
            subject: `🩺 Reclamo de perfil: ${b.provider_name || b.npi}${b.wants_vitrina ? ' · QUIERE VITRINA' : ''}`,
            html: `<p><strong>${escapeHtml(String(b.provider_name || ''))}</strong> (NPI ${escapeHtml(String(b.npi || ''))})</p>
<p>Reclamado por: ${escapeHtml(String(b.claimant_name || ''))} (${escapeHtml(String(b.claimant_role || ''))})<br>
Tel: ${escapeHtml(String(b.contact_phone || '—'))} · Email: ${escapeHtml(String(b.contact_email || '—'))}<br>
Tel corregido: ${escapeHtml(String(b.corrected_phone || '—'))}<br>
Planes: ${escapeHtml(plans.join(', ') || '—')}<br>
${b.wants_vitrina ? '<strong>⭐ Quiere que lo llamen sobre La Vitrina Especialista</strong>' : ''}</p>
<p style="color:#64748b;font-size:12px">provider_claims · registromedicopr.com</p>`,
          }),
        })
      } catch { /* email best-effort */ }
    }
    res.status(200).send(JSON.stringify({ ok: true }))
  } catch {
    res.status(200).send(JSON.stringify({ ok: false }))
  }
}

// =============== Conserje intent capture (diáspora funnel, NO price on site) ===============
// Captura de intención del home de registro. El doc de posicionamiento manda: "confirmar
// realidad + capturar intención", sin precio. Angel hace follow-up por email/texto. 2026-06-30.
async function handleConserjeIntent(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  try {
    const b = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}')
    const name = String(b.name || '').slice(0, 120).trim()
    const email = String(b.email || '').slice(0, 160).trim()
    const whatsapp = String(b.whatsapp || '').slice(0, 40).trim()
    const need = String(b.need || '').slice(0, 1000).trim()
    // Necesita al menos un modo de contacto + algo de contexto
    if ((!email && !whatsapp) || (!need && !name)) { res.status(400).send(JSON.stringify({ ok: false })); return }
    await supabase.from('conserje_intent').insert({
      name: name || null,
      email: email || null,
      whatsapp: whatsapp || null,
      need: need || null,
      specialty: String(b.specialty || '').slice(0, 80) || null,
      region: String(b.region || '').slice(0, 40) || null,
      lang: String(b.lang || 'es').slice(0, 5),
      source: 'registro_home',
    })
    if (RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM_EMAIL, to: REPLY_TO, reply_to: email || REPLY_TO,
            subject: `🤝 Conserje: ${name || email || whatsapp || 'alguien'} necesita ayuda con un especialista`,
            html: `<p><strong>${escapeHtml(name || '—')}</strong></p>
<p>Email: ${escapeHtml(email || '—')}<br>
WhatsApp: ${escapeHtml(whatsapp || '—')}</p>
<p><strong>Lo que necesita:</strong><br>${escapeHtml(need || '—')}</p>
<p style="color:#64748b;font-size:12px">conserje_intent · registromedicopr.com · responde por ${email ? 'email' : 'texto'}</p>`,
          }),
        })
      } catch { /* email best-effort */ }
    }
    res.status(200).send(JSON.stringify({ ok: true }))
  } catch {
    res.status(200).send(JSON.stringify({ ok: false }))
  }
}

// =============== /registro/desiertos — El Observatorio de Desiertos Médicos ===============
// Public, shareable artifact of ABSENCE. The data the government has buried, made plain.
// =============== /observatorio (registromedicopr) — El Observatorio del Acceso Médico de PR ===============
// The citable policy reference: qué pasó / qué tiene que pasar / cómo se arregla. Live deserts + verified analysis.
async function handleObservatorioMedico(req: any, res: any) {
  const REGIONS = ['Oeste', 'Norte', 'Centro', 'Sur', 'Este'] as const
  const score: Record<string, { zero: number; near: number }> = {}
  REGIONS.forEach(r => { score[r] = { zero: 0, near: 0 } })
  REGISTRY_SPECS.forEach(spec => REGIONS.forEach(r => {
    const n = (spec.r as any)[r] || 0
    if (n === 0) score[r].zero++; else if (n <= 2) score[r].near++
  }))
  const cards = REGIONS.map(r => ({ r, ...score[r] })).sort((a, b) => b.zero - a.zero)
    .map(({ r, zero, near }) => `<div class="bg-white border-2 ${zero >= 15 ? 'border-red-300' : zero >= 8 ? 'border-amber-300' : 'border-slate-200'} rounded-xl p-4 text-center">
      <div class="text-4xl font-black ${zero >= 15 ? 'text-red-600' : zero >= 8 ? 'text-amber-600' : 'text-slate-700'}">${zero}</div>
      <div class="text-sm font-bold text-slate-800 mt-1">${escapeHtml(r)}</div>
      <div class="text-xs text-slate-500">de 32 especialidades en <strong>cero</strong></div>
    </div>`).join('')

  const body = `
<p class="not-prose text-xs font-bold uppercase tracking-widest text-teal-700 mb-2">El Observatorio del Acceso Médico de Puerto Rico</p>
<h1>Por qué a Puerto Rico se le van los médicos, y cómo se arregla</h1>
<p class="text-lg text-slate-600 mt-3"><strong>No es que los médicos sean malagradecidos. Es un problema de pago federal que se volvió de fuerza laboral.</strong> Medicare le paga a PR cerca de <strong>40% menos</strong> que al continente por el mismo paciente, así que el médico gana <strong>~$67,000 menos al año</strong>, así que se va. Y un pipeline envejecido no puede rellenar el hueco. Esta es la referencia, con la data verificada y la fuente de cada número.</p>

<div class="not-prose mt-4 flex flex-wrap gap-2 text-xs">
  <span class="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 font-semibold px-3 py-1 rounded-full"><i class="fa-solid fa-calendar-check"></i> Actualizado junio 2026</span>
  <span class="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold px-3 py-1 rounded-full"><i class="fa-solid fa-shield-halved"></i> Data de proveedores verificada contra NPPES federal</span>
  <span class="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 text-teal-800 font-semibold px-3 py-1 rounded-full"><i class="fa-solid fa-quote-right"></i> Citable · cada cifra con su fuente</span>
</div>

<h2>Lo que el registro ve hoy, pueblo por pueblo</h2>
<p class="text-slate-600 -mt-2">De las 32 especialidades, cuántas tienen <strong>cero</strong> proveedores verificados en cada región. El área metro concentra casi todo — es la vara. El Centro de la isla es el desierto crítico.</p>
<div class="not-prose grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">${cards}</div>
<p class="text-sm text-slate-500 mt-3">El Centro (la montaña) tiene <strong>cero neumólogos</strong> (84 en el metro), <strong>cero geriatras</strong> (73), <strong>cero otorrinos</strong> (50) y <strong>cero neurocirujanos</strong> (31). 81 especialistas para toda la montaña. <a href="/registro/desiertos" class="text-teal-700 font-semibold">Ver el detalle por especialidad →</a></p>

<h2>1. Qué pasó (las causas, con números)</h2>
<p><strong>La disparidad de pago es la raíz.</strong> El benchmark de Medicare Advantage de PR está <strong>~38-41% por debajo</strong> del continente (STAT 2024; JAMA Health Forum jun 2025). En 2026 PR recibe un recorte de −1.11% mientras el continente sube +5.06%, ensanchando la brecha (MMAPA). Golpea a casi todos: PR tiene la <strong>penetración MA más alta de la nación, ~90%</strong>. Es "el canario en la mina."</p>
<p>El resultado en salario: el médico en PR gana <strong>~$162,000/año</strong> vs <strong>&gt;$229,000</strong> en el continente. La fuerza médica cayó de <strong>~14,500 (2009) a ~9,800 hoy</strong> para 3.2 millones, y <strong>salen 365-500 al año</strong> (JAMA jun 2025). Lo más golpeado son los especialistas: cardiólogos ~400→150; anestesiólogos ~300→100.</p>
<p>Y la bomba de tiempo: <strong>más del 40% de los especialistas estarán en edad de retiro para 2027</strong>. Sumado: deuda de escuela médica $150k-$250k, malpráctica $100k-$300k/año, el golpe de María (~15% del personal en un año), y un Medicaid de bloque con tope que ahogó las tarifas.</p>

<h2>2. La pelea de "obligarlos a quedarse"</h2>
<p>La evidencia global es clara: <strong>la coerción sin dinero se devuelve como rotación</strong> — la gente sale apenas suena el timbre. La revisión de la OMS de 70+ países lo confirma; el servicio obligatorio retiene solo cuando viene con pago, vivienda y entrenamiento real. PR ya lo vivió: la <strong>Ley #79</strong> de servicio compulsorio llevó a PR de <strong>16 pueblos sin médico a los 78 con al menos uno</strong> (WHO Bulletin). Pero distribuir no es retener. El <strong>P. del S. 973 (2023)</strong> — 5 años de compromiso a cambio de beca — pasó el Senado y fue vetado por falta de fondos.</p>
<p><strong>La conclusión:</strong> obligar a quedarse fracasa a menos que la matemática le gane al continente. Hoy no le gana. El instinto de PR hacia incentivos está mejor respaldado — pero los incentivos solo funcionan después de cerrar la brecha de pago federal.</p>

<h2>3. Qué tiene que pasar (los levers de verdad)</h2>
<ul>
<li><strong>Paridad de Medicare (LA raíz).</strong> El vehículo es <strong>H.R. 6031, el Medicare Advantage Integrity Act of 2025</strong>, radicado nov 2025 por el Comisionado Residente Pablo José Hernández + Reps. María Elvira Salazar y Darren Soto. Pone un piso mínimo de benchmark, proyectado en <strong>$1,000-1,200 millones/año</strong>. Estado: radicado, no avanzado.</li>
<li><strong>Cerrar el "Medicaid cliff."</strong> El FMAP de 76% de PR es estatutario solo hasta FY2027; sin acción revierte a 55%. Los otros 4 territorios ya tienen 83% permanente; PR no.</li>
<li><strong>Crecer las residencias en la isla.</strong> El residente entrenado en PR se queda mucho más. CMS metió a PR en la expansión de plazas (200 en 2023, +200 desde FY2026). El mayor win estructural.</li>
<li><strong>Escalar el repago de préstamos.</strong> Hoy el NHSC en PR es ~$2.1M/42 becados contra 42 HPSAs de cuidado primario — una migaja.</li>
<li><strong>Arreglar el incentivo contributivo.</strong> La Ley 14 (4%) quedó congelada por la Junta en 2020; el P. del S. 15 pendiente la cambiaría a 12% con requisitos de servicio. Ayuda solo una vez que cierre la brecha federal.</li>
</ul>

<h2>4. Quién tiene la autoridad de actuar</h2>
<div class="not-prose overflow-auto border border-slate-200 rounded-xl mt-2">
<table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th class="py-2 px-3">Actor</th><th class="py-2 px-3">El lever que de verdad tiene</th></tr></thead><tbody>
<tr class="border-t border-slate-100"><td class="py-2 px-3 font-semibold">Congreso de EE.UU.</td><td class="py-2 px-3 text-slate-600">El único que puede dar paridad permanente, cerrar el Medicaid cliff, financiar residencias. Pero el voto de PR es el Comisionado Residente: radica, no aprueba.</td></tr>
<tr class="border-t border-slate-100"><td class="py-2 px-3 font-semibold">CMS</td><td class="py-2 px-3 text-slate-600">El lever más rápido. Fija el benchmark de MA de PR cada año y las reglas de adecuación de red. Administrativo, sin voto.</td></tr>
<tr class="border-t border-slate-100"><td class="py-2 px-3 font-semibold">Depto. de Salud / ASES</td><td class="py-2 px-3 text-slate-600">Licencias, data de escasez, contratos de Plan Vital y marco de tarifas. Pero las alzas necesitan visto bueno de la Junta de Supervisión Fiscal.</td></tr>
<tr class="border-t border-slate-100"><td class="py-2 px-3 font-semibold">Legislatura PR</td><td class="py-2 px-3 text-slate-600">Incentivos contributivos, requisitos de servicio, residencias — topado por la Junta en presupuesto.</td></tr>
<tr class="border-t border-slate-100"><td class="py-2 px-3 font-semibold">HRSA</td><td class="py-2 px-3 text-slate-600">Designa los HPSA (la llave de los fondos federales), financia el NHSC, aprueba los waivers J-1.</td></tr>
</tbody></table></div>
<p class="text-sm text-slate-600 mt-3"><strong>La línea decisiva:</strong> el Congreso es dueño del arreglo permanente pero no lo puede pasar fácil; CMS es dueño del lever más rápido y lo puede mover este año; todos los demás operan río abajo, estrangulados por la Junta.</p>

<h2>5. Por qué esta data importa para arreglarlo</h2>
<p>Toda la maquinaria federal de fondos corre sobre un insumo: <strong>conteos de proveedores verificados, actuales, mapeados a la población.</strong> Las designaciones de escasez (HPSA) convierten esa data en dinero — desbloquean repago de préstamos, un bono Medicare de 10%, y elegibilidad de grants. Pero <strong>muchos mapas federales no se revisan desde los años 70-90</strong>, y <strong>PR no tiene ningún dataset público a nivel de sus 78 municipios</strong> (los mapas federales son de resolución de condado, demasiado gruesos para ver un pueblo).</p>
<p>Un vecino que verificó a mano, pueblo por pueblo, quién ejerce y qué especialidades simplemente no existen, tiene el artefacto que la política pública no puede generar sola: <strong>ground-truth.</strong> Eso convierte "sospechamos una escasez" en "aquí está el conteo verificado, por pueblo, hoy" — el insumo exacto que se vuelve un puntaje HPSA, una asignación de fondos, un reto de adecuación de red, o un proyecto de ley. (Precedentes: los "Maternity Care Deserts" de March of Dimes y los "Pharmacy Deserts" de GoodRx — un actor no-gubernamental construye el mapa verificado y se vuelve la referencia citada que dirige política.)</p>

<div class="not-prose mt-8 bg-teal-700 rounded-2xl p-6 text-white">
  <p class="text-lg font-bold mb-1">¿Periodista, legislador, agencia o investigador?</p>
  <p class="text-sm text-teal-100 mb-4">Esta data es citable y hay acceso al dataset por pueblo y región. Si trabajas en una solución al acceso de salud en PR y necesitas el conteo verificado, escríbenos.</p>
  <a href="mailto:angel@angelanderson.com?subject=Observatorio%20del%20Acceso%20Medico%20PR" class="inline-flex items-center gap-2 bg-white text-teal-800 font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-50"><i class="fa-solid fa-envelope"></i> angel@angelanderson.com</a>
</div>

<p class="text-xs text-slate-500 mt-6"><strong>Nota de rigor:</strong> los números de fuerza laboral (~9,800 activos, 365-500 salidas/año) son las cifras netas defendibles; el "8,000 dejaron de ejercer" mezcla emigración, retiro y muerte. La brecha de pago en % (38-41%) está bien corroborada (STAT, JAMA, KFF, MMAPA); los montos en dólares vienen de fuentes de cabildeo. El P. del S. 15 (12%) estaba pendiente, no confirmado aprobado. La ausencia de data municipal pública es inferencia, no cita. <strong>Fuentes:</strong> STAT, JAMA Health Forum, KFF, MMAPA PR, Congress.gov (H.R. 6031), WHO Bulletin, HHS-OIG, HRSA, March of Dimes, Grupo CNE.</p>
`

  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'Report',
      name: 'El Observatorio del Acceso Médico de Puerto Rico',
      headline: 'Por qué a Puerto Rico se le van los médicos, y cómo se arregla',
      description: 'Referencia citable sobre la crisis de acceso médico de PR: la disparidad de pago de Medicare (~40%), el éxodo de médicos, los desiertos por región, los levers de solución (H.R. 6031), y quién tiene la autoridad de actuar.',
      inLanguage: 'es', datePublished: '2026-06-23', dateModified: '2026-06-23',
      author: { '@type': 'Organization', name: 'Registro Médico PR', url: 'https://registromedicopr.com' },
      publisher: { '@type': 'Organization', name: 'Registro Médico PR', url: 'https://registromedicopr.com' },
      url: 'https://registromedicopr.com/observatorio',
      about: { '@type': 'Thing', name: 'Acceso a especialistas médicos en Puerto Rico' },
    },
  ]
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: 'El Observatorio del Acceso Médico de Puerto Rico — qué pasó, qué tiene que pasar, cómo se arregla',
    description: 'Por qué a PR se le van los médicos (la disparidad de pago de Medicare ~40%), los desiertos por región, y cómo se arregla. Referencia citable, cada cifra con su fuente.',
    slug: 'observatorio', bodyHtml: body, jsonLd, ogImage: '/og/desiertos.png',
    host: req.headers?.host, canonicalHost: 'https://registromedicopr.com',
  }))
}

async function handleRegistroDesiertos(req: any, res: any) {
  const REGIONS = ['Oeste', 'Norte', 'Centro', 'Sur', 'Este'] as const // Metro = the hub, shown as reference
  // Build deserts: non-Metro region × specialty where count is 0 (total) or 1-2 (casi)
  type Gap = { spec: typeof REGISTRY_SPECS[number]; region: string; n: number; metro: number }
  const totalDeserts: Gap[] = []
  const nearDeserts: Gap[] = []
  REGISTRY_SPECS.forEach(spec => {
    REGIONS.forEach(region => {
      const n = (spec.r as any)[region] || 0
      const metro = spec.r.Metro || 0
      if (n === 0) totalDeserts.push({ spec, region, n, metro })
      else if (n <= 2) nearDeserts.push({ spec, region, n, metro })
    })
  })
  // Sort total deserts: MDs first, then by how many exist in Metro (bigger gap = more striking)
  totalDeserts.sort((a, b) => (Number(b.spec.md) - Number(a.spec.md)) || (b.metro - a.metro))
  nearDeserts.sort((a, b) => (Number(b.spec.md) - Number(a.spec.md)) || (b.metro - a.metro))

  // Per-region scorecard: how many of the 32 specialties are TOTALLY absent
  const regionScore: Record<string, number> = {}
  REGIONS.forEach(r => { regionScore[r] = totalDeserts.filter(g => g.region === r).length })

  const regionFull: Record<string, string> = {
    Oeste: 'el Oeste (Mayagüez, Cabo Rojo, Aguadilla)',
    Norte: 'el Norte (Arecibo, Manatí, Hatillo)',
    Centro: 'el Centro / la montaña (Aibonito, Barranquitas)',
    Sur: 'el Sur (Ponce, Yauco, Guayama)',
    Este: 'el Este (Caguas, Humacao, Fajardo)',
  }

  const scoreCards = REGIONS
    .map(r => ({ r, z: regionScore[r] }))
    .sort((a, b) => b.z - a.z)
    .map(({ r, z }) => `<div class="bg-white border-2 ${z >= 8 ? 'border-red-300' : z >= 4 ? 'border-amber-300' : 'border-slate-200'} rounded-xl p-4 text-center">
      <div class="text-4xl font-black ${z >= 8 ? 'text-red-600' : z >= 4 ? 'text-amber-600' : 'text-slate-700'}">${z}</div>
      <div class="text-sm font-bold text-slate-800 mt-1">${escapeHtml(r)}</div>
      <div class="text-xs text-slate-500">especialidades con <strong>cero</strong> proveedores</div>
    </div>`).join('')

  const desertRow = (g: Gap) => `<tr class="border-t border-slate-100">
    <td class="py-2 px-3"><span class="font-semibold text-slate-800">${g.spec.e} ${escapeHtml(g.spec.l)}</span></td>
    <td class="py-2 px-3 text-slate-600">${escapeHtml(g.region)}</td>
    <td class="py-2 px-3 text-center"><span class="inline-block bg-red-100 text-red-700 font-black px-2 py-0.5 rounded">0</span></td>
    <td class="py-2 px-3 text-center text-slate-500">${g.metro} en metro</td>
  </tr>`

  const nearRow = (g: Gap) => `<tr class="border-t border-slate-100">
    <td class="py-2 px-3"><span class="font-semibold text-slate-800">${g.spec.e} ${escapeHtml(g.spec.l)}</span></td>
    <td class="py-2 px-3 text-slate-600">${escapeHtml(g.region)}</td>
    <td class="py-2 px-3 text-center"><span class="inline-block bg-amber-100 text-amber-700 font-black px-2 py-0.5 rounded">${g.n}</span></td>
    <td class="py-2 px-3 text-center text-slate-500">${g.metro} en metro</td>
  </tr>`

  const body = `
<h1>Los desiertos médicos de Puerto Rico</h1>
<p class="text-lg text-slate-600 mt-3">Hay especialidades médicas que, según el registro federal, <strong>no tienen ni un solo proveedor</strong> en regiones enteras del país. No es opinión. Es el dato oficial — el mismo que usan Medicare y los planes médicos — puesto claro, por primera vez, región por región.</p>

<div class="not-prose mt-4 flex flex-wrap gap-3 text-sm">
  <span class="inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 font-semibold px-3 py-1.5 rounded-full"><i class="fa-solid fa-triangle-exclamation"></i> ${totalDeserts.length} desiertos totales (cero proveedores)</span>
  <span class="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 font-semibold px-3 py-1.5 rounded-full"><i class="fa-solid fa-circle-exclamation"></i> ${nearDeserts.length} casi-desiertos (1-2)</span>
  <span class="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-full"><i class="fa-solid fa-shield-halved"></i> Fuente federal NPPES/CMS</span>
</div>

<h2>Cuántas especialidades faltan por completo, por región</h2>
<p class="text-slate-600 -mt-2">De las ${REGISTRY_SPECS.length} especialidades del registro, cuántas tienen <strong>cero</strong> proveedores en cada región. El área metro concentra casi todo — por eso no aparece aquí: es la vara contra la que se mide el resto.</p>
<div class="not-prose grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">${scoreCards}</div>

<h2>Los desiertos totales — cero proveedores en toda la región</h2>
<p class="text-slate-600 -mt-2">Si vives aquí y necesitas a uno de estos, el registro federal dice que te toca viajar — casi siempre al área metro.</p>
<div class="not-prose mt-3 overflow-auto border border-slate-200 rounded-xl">
  <table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
    <th class="py-2 px-3">Especialidad</th><th class="py-2 px-3">Región sin cobertura</th><th class="py-2 px-3 text-center">Hay</th><th class="py-2 px-3 text-center">Más cerca</th>
  </tr></thead><tbody>${totalDeserts.map(desertRow).join('')}</tbody></table>
</div>

<h2>Los casi-desiertos — 1 o 2 para una región entera</h2>
<p class="text-slate-600 -mt-2">Existen, pero son tan pocos que la cita puede tardar meses. Pide el referido temprano.</p>
<div class="not-prose mt-3 overflow-auto border border-slate-200 rounded-xl">
  <table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
    <th class="py-2 px-3">Especialidad</th><th class="py-2 px-3">Región</th><th class="py-2 px-3 text-center">Hay</th><th class="py-2 px-3 text-center">En metro</th>
  </tr></thead><tbody>${nearDeserts.map(nearRow).join('')}</tbody></table>
</div>

<h2>Por qué esto importa</h2>
<p>Un desierto médico no es que "haya poco". Es que el sistema te obliga a manejar dos o tres horas — o a no atenderte. Eso pega más fuerte en el adulto mayor, en quien no maneja, y en quien no tiene a alguien que lo lleve. La data existía. El gobierno la tiene. Pero enterrada, en inglés, sin organizar por pueblo. La sacamos a la luz para que se pueda <strong>ver</strong>, <strong>citar</strong>, y <strong>arreglar</strong>.</p>
<p class="text-sm text-slate-600">¿Eres especialista y atiendes en una de estas regiones sin cobertura? El registro no te muestra. <a href="/registro" class="text-teal-700 font-semibold">Reclama tu perfil aquí</a> y aparece donde la gente te busca.</p>
<p class="text-sm text-slate-600"><strong>¿Periodista, agencia de salud, o investigador?</strong> Esta data es citable y hay acceso programático. Escríbenos: <a href="mailto:angel@angelanderson.com" class="text-teal-600">angel@angelanderson.com</a>.</p>

<div class="not-prose mt-8 bg-teal-700 rounded-2xl p-6 text-center text-white">
  <p class="text-lg font-bold mb-1">¿Necesitas un especialista y no sabes a dónde ir?</p>
  <p class="text-sm text-teal-100 mb-4">Escríbele al Veci. Te dice cuántos hay en tu región, cuáles, y sus teléfonos. Al <strong>${PHONE_CTA}</strong>:</p>
  <div class="flex flex-wrap gap-3 justify-center">
    <a href="https://wa.me/17874177711?text=ESPECIALISTA" class="inline-flex items-center gap-2 bg-white text-teal-800 font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-50"><i class="fa-brands fa-whatsapp text-lg"></i> ESPECIALISTA</a>
    <a href="/registro" class="inline-flex items-center gap-2 bg-teal-800 text-white font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-900"><i class="fa-solid fa-magnifying-glass"></i> Ir al registro completo</a>
  </div>
  <p class="text-xs text-teal-200 mt-4">— Menos revolú, más sistema, mejor vida.</p>
</div>
`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Desiertos médicos de Puerto Rico por región',
    description: `${totalDeserts.length} combinaciones de especialidad y región sin ningún proveedor, según el registro federal NPPES/CMS. Datos abiertos de acceso a especialistas en Puerto Rico, en español.`,
    creator: { '@type': 'Organization', name: 'Registro Médico PR', url: 'https://registromedicopr.com' },
    license: 'https://npiregistry.cms.hhs.gov/',
    isAccessibleForFree: true,
    inLanguage: 'es',
    keywords: ['acceso a salud', 'especialistas', 'Puerto Rico', 'desiertos médicos', 'NPPES'],
    url: `https://registromedicopr.com/registro/desiertos`,
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: 'Los desiertos médicos de Puerto Rico — regiones sin especialistas',
    description: `${totalDeserts.length} especialidades sin un solo proveedor en regiones enteras de PR, según el registro federal. La data que el gobierno tiene enterrada, puesta clara.`,
    slug: 'registro/desiertos',
    bodyHtml: body,
    jsonLd,
    ogImage: '/og/desiertos.png',
    host: req.headers?.host,
    canonicalHost: 'https://registromedicopr.com',
  }))
}

// =============== /registro/:spec  +  /registro/:spec/:region — HUB pages (útiles + SEO moat) ===============
// Plain-Spanish, medically-accurate specialty explainers (qué resuelve / cuándo ir / nota).
const SPEC_INFO: Record<string, { treats: string; whenToGo: string; note: string }> = {
  'cardiólogo': { treats: 'El médico del corazón, la presión y la circulación.', whenToGo: 'Cuando tienes presión alta, palpitaciones, dolor en el pecho o falta de aire.', note: '' },
  'psiquiatra': { treats: 'El médico de la mente: depresión, ansiedad, sueño y otras condiciones que afectan el ánimo.', whenToGo: 'Cuando te sientes muy triste, ansioso o no puedes dormir, y crees que necesitas medicamento.', note: 'No es lo mismo que un psicólogo. El psiquiatra es médico y puede recetar.' },
  'fisiatra': { treats: 'El médico que te ayuda a recuperar el movimiento y bajar el dolor sin operación.', whenToGo: 'Cuando tienes dolor de espalda, cuello o una lesión y quieres mejorar con terapia.', note: '' },
  'ginecólogo': { treats: 'El médico de la salud de la mujer y sus partes íntimas.', whenToGo: 'Para tu chequeo anual, problemas de regla, embarazo o molestias femeninas.', note: '' },
  'pediatra': { treats: 'El médico de los niños, desde que nacen hasta jóvenes.', whenToGo: 'Para las vacunas, los chequeos y cuando el nene está enfermo.', note: '' },
  'dermatólogo': { treats: 'El médico de la piel, el pelo y las uñas.', whenToGo: 'Cuando tienes ronchas, un lunar raro, acné fuerte o caída de pelo.', note: '' },
  'gastroenterólogo': { treats: 'El médico del estómago, los intestinos y la digestión.', whenToGo: 'Cuando tienes acidez constante, dolor de barriga, estreñimiento o problemas para ir al baño.', note: '' },
  'oftalmólogo': { treats: 'El médico de los ojos y la vista.', whenToGo: 'Cuando ves borroso, tienes cataratas, glaucoma o necesitas operación de los ojos.', note: 'Es médico de los ojos. El optómetra solo te examina y receta espejuelos.' },
  'ortopeda': { treats: 'El médico de los huesos, las coyunturas y los músculos.', whenToGo: 'Cuando te fracturas, te duele una rodilla o cadera, o necesitas reemplazo de coyuntura.', note: '' },
  'neurologo': { treats: 'El médico del cerebro y los nervios.', whenToGo: 'Cuando tienes dolores de cabeza fuertes, convulsiones, temblor o pérdida de memoria.', note: '' },
  'urólogo': { treats: 'El médico de los riñones, la vejiga y las partes íntimas del hombre.', whenToGo: 'Cuando te arde o cuesta orinar, ves sangre en la orina o tienes problemas de próstata.', note: '' },
  'endocrinologo': { treats: 'El médico de la diabetes, la tiroides y las hormonas.', whenToGo: 'Cuando tienes el azúcar alta, problemas de tiroides o cambios fuertes de peso.', note: '' },
  'nefrólogo': { treats: 'El médico de los riñones.', whenToGo: 'Cuando tus riñones no están trabajando bien o necesitas diálisis.', note: '' },
  'neumólogo': { treats: 'El médico de los pulmones y la respiración.', whenToGo: 'Cuando tienes asma, te falta el aire, toses mucho o usas oxígeno.', note: '' },
  'oncólogo': { treats: 'El médico que trata el cáncer.', whenToGo: 'Cuando te diagnostican cáncer y necesitas tratamiento como quimioterapia.', note: '' },
  'reumatólogo': { treats: 'El médico de la artritis y las coyunturas inflamadas.', whenToGo: 'Cuando tienes las coyunturas hinchadas, tiesas o te duelen por la mañana.', note: '' },
  'geriatra': { treats: 'El médico que cuida la salud de las personas mayores.', whenToGo: 'Cuando eres mayor, tomas muchos medicamentos o necesitas un médico que vea todo en conjunto.', note: '' },
  'otorrinolaringólogo': { treats: 'El médico de los oídos, la nariz y la garganta.', whenToGo: 'Cuando no oyes bien, tienes sinusitis, dolor de garganta seguido o mareos.', note: 'Mucha gente le dice "el médico de oído, nariz y garganta".' },
  'infectólogo': { treats: 'El médico de las infecciones difíciles de tratar.', whenToGo: 'Cuando tienes una infección que no se quita o una condición como VIH.', note: '' },
  'alergista': { treats: 'El médico de las alergias y el asma.', whenToGo: 'Cuando estornudas mucho, te brotan ronchas o ciertas comidas te hacen daño.', note: '' },
  'medicina de emergencia': { treats: 'El médico de la sala de emergencia que atiende lo urgente y grave.', whenToGo: 'Cuando tienes una emergencia: un golpe fuerte, dolor de pecho o algo que no puede esperar.', note: '' },
  'cirujano general': { treats: 'El médico que opera problemas comunes de la barriga y el cuerpo.', whenToGo: 'Cuando necesitas operarte de apendicitis, vesícula o una hernia.', note: '' },
  'anestesiólogo': { treats: 'El médico que te duerme y cuida durante una operación.', whenToGo: 'Lo conoces cuando te van a operar; él controla la anestesia y el dolor.', note: '' },
  'radiólogo': { treats: 'El médico que lee las radiografías, los CT scan y los sonogramas.', whenToGo: 'Trabaja detrás de tus pruebas de imágenes; casi siempre no lo ves en persona.', note: '' },
  'neurocirujano': { treats: 'El médico que opera el cerebro, la columna y los nervios.', whenToGo: 'Cuando tienes un problema serio del cerebro o la columna que necesita operación.', note: '' },
  'cirujano plástico': { treats: 'El médico que reconstruye o arregla partes del cuerpo y la piel.', whenToGo: 'Cuando necesitas reconstrucción después de un accidente, quemadura u operación.', note: '' },
  'cirujano torácico': { treats: 'El médico que opera el pecho: los pulmones y la zona alrededor del corazón.', whenToGo: 'Cuando tienes un problema de los pulmones o el pecho que necesita operación.', note: '' },
  'coloproctólogo': { treats: 'El médico del colon, el recto y el área del ano.', whenToGo: 'Cuando tienes hemorroides, sangrado al ir al baño o te toca la colonoscopía.', note: '' },
  'manejo de dolor': { treats: 'El médico que trata el dolor crónico que no se quita.', whenToGo: 'Cuando llevas mucho tiempo con dolor y nada te lo controla.', note: '' },
  'psicólogo': { treats: 'El profesional que te ayuda con terapia y a hablar de lo que sientes.', whenToGo: 'Cuando quieres apoyo, terapia o herramientas para manejar la ansiedad o el estrés.', note: 'Tiene licencia, pero no es médico (MD) y no receta medicamentos.' },
  'optómetra': { treats: 'El profesional que examina la vista y receta espejuelos o lentes de contacto.', whenToGo: 'Cuando ves borroso o te toca el examen anual de la vista.', note: 'Tiene licencia, pero no es médico (MD). Para operación o enfermedad del ojo, vas al oftalmólogo.' },
  'podiatra': { treats: 'El profesional que cuida los pies y los tobillos.', whenToGo: 'Cuando tienes dolor de pies, uñas enterradas, callos o problemas del pie por diabetes.', note: 'Tiene licencia, pero no es médico (MD); es especialista del pie.' },
}
function specToUrl(sub: string): string {
  return sub.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
// English specialty labels (for ?lang=en on hub pages) — keyed by subcategory slug.
const SPEC_LABEL_EN: Record<string, string> = {
  'cardiólogo':'Cardiologist','psiquiatra':'Psychiatrist','fisiatra':'Physiatrist (Rehab)','ginecólogo':'OB-GYN','pediatra':'Pediatrician','dermatólogo':'Dermatologist','gastroenterólogo':'Gastroenterologist','oftalmólogo':'Ophthalmologist (Eye MD)','ortopeda':'Orthopedic Surgeon','neurologo':'Neurologist','urólogo':'Urologist','endocrinologo':'Endocrinologist (Diabetes)','nefrólogo':'Nephrologist (Kidney)','neumólogo':'Pulmonologist (Lungs)','oncólogo':'Oncologist / Hematologist','reumatólogo':'Rheumatologist (Arthritis)','geriatra':'Geriatrician','otorrinolaringólogo':'ENT (Ear, Nose & Throat)','infectólogo':'Infectious Disease','alergista':'Allergist / Immunologist','medicina de emergencia':'Emergency Medicine','cirujano general':'General Surgeon','anestesiólogo':'Anesthesiologist','radiólogo':'Radiologist','neurocirujano':'Neurosurgeon','cirujano plástico':'Plastic Surgeon','cirujano torácico':'Thoracic Surgeon','coloproctólogo':'Colorectal Surgeon','manejo de dolor':'Pain Management','psicólogo':'Psychologist','optómetra':'Optometrist','podiatra':'Podiatrist',
}
// English specialty explainers (for ?lang=en on hub pages).
const SPEC_INFO_EN: Record<string, { treats: string; whenToGo: string; note: string }> = {
  'cardiólogo':{treats:'The doctor for your heart, blood pressure, and circulation.',whenToGo:'When you have high blood pressure, a racing heartbeat, chest pain, or shortness of breath.',note:''},
  'psiquiatra':{treats:'The doctor for the mind: depression, anxiety, sleep, and other conditions that affect your mood.',whenToGo:'When you feel very sad, anxious, or can\'t sleep, and you think you may need medication.',note:'This is not the same as a psychologist. A psychiatrist is a medical doctor and can prescribe medication.'},
  'fisiatra':{treats:'The doctor who helps you get your movement back and ease pain without surgery.',whenToGo:'When you have back pain, neck pain, or an injury and want to get better through therapy.',note:''},
  'ginecólogo':{treats:'The doctor for women\'s health and the reproductive system.',whenToGo:'For your yearly checkup, period problems, pregnancy, or any women\'s health concerns.',note:''},
  'pediatra':{treats:'The doctor for children, from newborns through the teen years.',whenToGo:'For vaccines, checkups, and when your child is sick.',note:''},
  'dermatólogo':{treats:'The doctor for your skin, hair, and nails.',whenToGo:'When you have a rash, an unusual mole, bad acne, or hair loss.',note:''},
  'gastroenterólogo':{treats:'The doctor for your stomach, intestines, and digestion.',whenToGo:'When you have constant heartburn, stomach pain, constipation, or trouble using the bathroom.',note:''},
  'oftalmólogo':{treats:'The doctor for your eyes and vision.',whenToGo:'When your vision is blurry, or you have cataracts, glaucoma, or need eye surgery.',note:'This is a medical eye doctor. An optometrist only examines your eyes and prescribes glasses.'},
  'ortopeda':{treats:'The doctor for your bones, joints, and muscles.',whenToGo:'When you break a bone, your knee or hip hurts, or you need a joint replacement.',note:''},
  'neurologo':{treats:'The doctor for your brain and nerves.',whenToGo:'When you have severe headaches, seizures, tremors, or memory loss.',note:''},
  'urólogo':{treats:'The doctor for your kidneys, bladder, and men\'s reproductive health.',whenToGo:'When it burns or is hard to urinate, you see blood in your urine, or you have prostate problems.',note:''},
  'endocrinologo':{treats:'The doctor for diabetes, thyroid, and hormones.',whenToGo:'When your blood sugar is high, you have thyroid problems, or major weight changes.',note:''},
  'nefrólogo':{treats:'The doctor for your kidneys.',whenToGo:'When your kidneys aren\'t working well or you need dialysis.',note:''},
  'neumólogo':{treats:'The doctor for your lungs and breathing.',whenToGo:'When you have asthma, shortness of breath, a bad cough, or you use oxygen.',note:''},
  'oncólogo':{treats:'The doctor who treats cancer.',whenToGo:'When you are diagnosed with cancer and need treatment such as chemotherapy.',note:''},
  'reumatólogo':{treats:'The doctor for arthritis and inflamed joints.',whenToGo:'When your joints are swollen, stiff, or hurt in the morning.',note:''},
  'geriatra':{treats:'The doctor who looks after the health of older adults.',whenToGo:'When you are older, take a lot of medications, or need a doctor who looks at everything together.',note:''},
  'otorrinolaringólogo':{treats:'The doctor for your ears, nose, and throat.',whenToGo:'When you can\'t hear well, you have sinus problems, frequent sore throats, or dizziness.',note:'Most people call this the ear, nose, and throat doctor (ENT).'},
  'infectólogo':{treats:'The doctor for infections that are hard to treat.',whenToGo:'When you have an infection that won\'t go away or a condition like HIV.',note:''},
  'alergista':{treats:'The doctor for allergies and asthma.',whenToGo:'When you sneeze a lot, break out in hives, or certain foods make you sick.',note:''},
  'medicina de emergencia':{treats:'The emergency room doctor who handles urgent and serious problems.',whenToGo:'When you have an emergency: a bad fall, chest pain, or something that can\'t wait.',note:''},
  'cirujano general':{treats:'The doctor who operates on common problems of the abdomen and body.',whenToGo:'When you need surgery for appendicitis, your gallbladder, or a hernia.',note:''},
  'anestesiólogo':{treats:'The doctor who puts you to sleep and watches over you during surgery.',whenToGo:'You meet this doctor when you are going to have surgery; they handle the anesthesia and your pain.',note:''},
  'radiólogo':{treats:'The doctor who reads your X-rays, CT scans, and ultrasounds.',whenToGo:'They work behind the scenes on your imaging tests; you usually don\'t see them in person.',note:''},
  'neurocirujano':{treats:'The doctor who operates on the brain, spine, and nerves.',whenToGo:'When you have a serious brain or spine problem that needs surgery.',note:''},
  'cirujano plástico':{treats:'The doctor who reconstructs or repairs parts of the body and skin.',whenToGo:'When you need reconstruction after an accident, a burn, or surgery.',note:''},
  'cirujano torácico':{treats:'The doctor who operates on the chest: the lungs and the area around the heart.',whenToGo:'When you have a lung or chest problem that needs surgery.',note:''},
  'coloproctólogo':{treats:'The doctor for the colon, rectum, and the area around the anus.',whenToGo:'When you have hemorrhoids, bleeding when you use the bathroom, or it is time for your colonoscopy.',note:''},
  'manejo de dolor':{treats:'The doctor who treats chronic pain that won\'t go away.',whenToGo:'When you have had pain for a long time and nothing keeps it under control.',note:''},
  'psicólogo':{treats:'The licensed professional who helps you through therapy and talking about what you feel.',whenToGo:'When you want support, therapy, or tools to manage anxiety or stress.',note:'They are licensed, but they are not a medical doctor (MD) and cannot prescribe medication.'},
  'optómetra':{treats:'The professional who examines your vision and prescribes glasses or contact lenses.',whenToGo:'When your vision is blurry or it is time for your yearly eye exam.',note:'They are licensed, but they are not a medical doctor (MD). For surgery or eye disease, see an ophthalmologist.'},
  'podiatra':{treats:'The professional who cares for your feet and ankles.',whenToGo:'When you have foot pain, ingrown nails, calluses, or foot problems from diabetes.',note:'They are licensed, but they are not a medical doctor (MD); they are a foot specialist.'},
}
const SPEC_BY_URL: Record<string, typeof REGISTRY_SPECS[number]> = {}
REGISTRY_SPECS.forEach(x => { SPEC_BY_URL[specToUrl(x.s)] = x })
const HUB_REGIONS = ['Oeste', 'Norte', 'Centro', 'Sur', 'Este', 'Metro'] as const
const REGION_BY_URL: Record<string, string> = { oeste: 'Oeste', norte: 'Norte', centro: 'Centro', sur: 'Sur', este: 'Este', metro: 'Metro' }
const REGION_FULL: Record<string, string> = {
  Oeste: 'el oeste (Mayagüez, Cabo Rojo, Aguadilla)', Norte: 'el norte (Arecibo, Manatí, Hatillo)',
  Centro: 'el centro y la montaña (Aibonito, Barranquitas)', Sur: 'el sur (Ponce, Yauco, Guayama)',
  Este: 'el este (Caguas, Humacao, Fajardo)', Metro: 'el área metro (San Juan y alrededores)',
}

async function handleRegistroHub(req: any, res: any) {
  const specUrl = String(req.query.spec || '').toLowerCase()
  const regionUrl = String(req.query.region || '').toLowerCase()
  const x = SPEC_BY_URL[specUrl]
  if (!x) { res.statusCode = 302; res.setHeader('Location', '/registro'); res.end(); return }
  const region = regionUrl ? (REGION_BY_URL[regionUrl] || '') : ''
  if (regionUrl && !region) { res.statusCode = 302; res.setHeader('Location', `/registro/${specUrl}`); res.end(); return }

  const en = String(req.query.lang || '') === 'en'
  const t = (es: string, env: string) => en ? env : es
  const lp = en ? '?lang=en' : ''
  const label = en ? (SPEC_LABEL_EN[x.s] || x.l) : x.l
  const labelLow = en ? label : x.l.toLowerCase()
  const info = en ? (SPEC_INFO_EN[x.s] || { treats: '', whenToGo: '', note: '' }) : (SPEC_INFO[x.s] || { treats: '', whenToGo: '', note: '' })
  const REGION_FULL_EN: Record<string, string> = { Oeste: 'the West (Mayagüez, Cabo Rojo, Aguadilla)', Norte: 'the North (Arecibo, Manatí, Hatillo)', Centro: 'the central mountains (Aibonito, Barranquitas)', Sur: 'the South (Ponce, Yauco, Guayama)', Este: 'the East (Caguas, Humacao, Fajardo)', Metro: 'the San Juan metro area' }
  const regionFull = (r: string) => en ? (REGION_FULL_EN[r] || r) : REGION_FULL[r]
  const total = x.t
  const regionCount = region ? ((x.r as any)[region] || 0) : 0
  const metroCount = x.r.Metro || 0
  const isMD = x.md

  // provider list (this specialty, optionally this region)
  let q = supabase.from('places')
    .select('name,municipality,region,slug,phone')
    .eq('subcategory', x.s).not('npi', 'is', null).not('slug', 'is', null).eq('status', 'open')
    .order('municipality', { ascending: true }).limit(200)
  if (region) q = q.eq('region', region)
  const { data: provData } = await q
  const providers = provData || []

  const provRows = providers.map(p => `<tr class="border-t border-slate-100">
    <td class="py-2 px-3"><a href="/especialista/${encodeURIComponent(p.slug)}${lp}" class="font-semibold text-slate-800 hover:text-teal-700 hover:underline">${escapeHtml(cleanProviderName(p.name))}</a></td>
    <td class="py-2 px-3 text-slate-600">${escapeHtml(p.municipality || '—')}</td>
    <td class="py-2 px-3 text-right">${p.phone ? `<a href="tel:${escapeHtml((p.phone || '').replace(/\D/g, ''))}" class="text-teal-700 font-semibold whitespace-nowrap">${escapeHtml(p.phone)}</a>` : `<span class="text-slate-400">${t('sin teléfono', 'no phone')}</span>`}</td>
  </tr>`).join('')
  const thead = `<thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th class="py-2 px-3">${escapeHtml(label)}</th><th class="py-2 px-3">${t('Pueblo', 'Town')}</th><th class="py-2 px-3 text-right">${t('Teléfono', 'Phone')}</th></tr></thead>`

  const noteHtml = info.note ? `<p class="text-sm text-slate-500 mt-1"><i class="fa-solid fa-circle-info text-teal-600"></i> ${escapeHtml(info.note)}</p>` : ''
  const breadcrumb = `<nav class="not-prose text-sm text-slate-500 mb-3"><a href="/registro${lp}" class="hover:text-teal-700">Registro Médico PR</a> <span class="text-slate-300">/</span> <a href="/registro/${specUrl}${lp}" class="hover:text-teal-700">${escapeHtml(label)}</a>${region ? ` <span class="text-slate-300">/</span> <span class="text-slate-700">${escapeHtml(region)}</span>` : ''}</nav>`

  let body: string, title: string, description: string, answerFirst: string
  if (region) {
    answerFirst = regionCount > 0
      ? t(`En ${regionFull(region)} hay <strong>${regionCount} ${escapeHtml(x.l.toLowerCase())}</strong> verificados contra el registro federal NPPES.`, `${regionFull(region)} has <strong>${regionCount} verified ${escapeHtml(labelLow)}${regionCount === 1 ? '' : 's'}</strong> in the federal NPPES registry.`)
      : t(`Según el registro federal, en ${regionFull(region)} no hay ningún ${escapeHtml(x.l.toLowerCase())} verificado. El grupo más grande está en el área metro (${metroCount}).`, `According to the federal registry, ${regionFull(region)} has no verified ${escapeHtml(labelLow)}. The largest group is in the metro area (${metroCount}).`)
    title = t(`${x.l} en ${region}, Puerto Rico — ${regionCount} verificados`, `${label} in ${region}, Puerto Rico — ${regionCount} verified`)
    description = t(`${regionCount} ${x.l.toLowerCase()} en ${region}, PR, verificados contra el registro federal NPPES. Con teléfono, en español.`, `${regionCount} verified ${labelLow} in ${region}, Puerto Rico, from the federal NPPES registry. With phone numbers.`)
    body = `${breadcrumb}
<h1>${x.e} ${escapeHtml(label)} ${t('en', 'in')} ${escapeHtml(region)}, Puerto Rico</h1>
<p class="text-lg text-slate-600 mt-2">${answerFirst}</p>
${info.treats ? `<p class="text-slate-600 mt-1">${escapeHtml(info.treats)} ${escapeHtml(info.whenToGo)}</p>` : ''}
${noteHtml}
${providers.length ? `<div class="not-prose mt-5 overflow-auto border border-slate-200 rounded-xl"><table class="w-full text-sm">${thead}<tbody>${provRows}</tbody></table></div>` : `<div class="not-prose mt-5 bg-amber-50 border border-amber-200 rounded-xl p-5"><p class="text-amber-900 font-semibold">${t(`No hay ${escapeHtml(x.l.toLowerCase())} verificados en ${escapeHtml(region)}.`, `No verified ${escapeHtml(labelLow)} in ${escapeHtml(region)}.`)}</p><p class="text-sm text-amber-800 mt-1">${t('Te va a tocar viajar. Mira los de', 'You will have to travel. See those in')} <a href="/registro/${specUrl}/metro${lp}" class="font-semibold underline">${t('el área metro', 'the metro area')} (${metroCount}) →</a></p></div>`}
<p class="not-prose mt-4 text-sm"><a href="/registro/${specUrl}${lp}" class="text-teal-700 font-semibold">${t(`Ver los ${total} ${escapeHtml(x.l.toLowerCase())} de toda la isla →`, `See all ${total} ${escapeHtml(labelLow)} across the island →`)}</a></p>`
  } else {
    answerFirst = t(`En Puerto Rico hay <strong>${total} ${escapeHtml(x.l.toLowerCase())}</strong> verificados contra el registro federal NPPES, distribuidos por región.`, `Puerto Rico has <strong>${total} verified ${escapeHtml(labelLow)}</strong> in the federal NPPES registry, spread across regions.`)
    title = t(`${x.l} en Puerto Rico — ${total} verificados, por región`, `${label} in Puerto Rico — ${total} verified, by region`)
    description = t(`${total} ${x.l.toLowerCase()} en Puerto Rico verificados contra el registro federal NPPES. ${info.treats} Por región, con teléfono, en español.`, `${total} verified ${labelLow} in Puerto Rico from the federal NPPES registry. ${info.treats} By region, with phone numbers.`)
    const regionCards = HUB_REGIONS.map(r => {
      const n = (x.r as any)[r] || 0
      return `<a href="/registro/${specUrl}/${specToUrl(r)}${lp}" class="flex items-center justify-between bg-white border ${n === 0 ? 'border-red-200' : 'border-slate-200'} rounded-lg px-4 py-3 hover:border-teal-400 hover:shadow-sm transition">
        <span class="font-semibold text-slate-800">${escapeHtml(r)}</span>
        <span class="font-black ${n === 0 ? 'text-red-500' : 'text-teal-700'}">${n}</span>
      </a>`
    }).join('')
    body = `${breadcrumb}
<h1>${x.e} ${escapeHtml(label)} ${t('en', 'in')} Puerto Rico</h1>
<p class="text-lg text-slate-600 mt-2">${answerFirst}</p>
<div class="not-prose mt-4 grid sm:grid-cols-2 gap-3">
  <div class="bg-teal-50 border border-teal-200 rounded-xl p-4"><div class="text-xs font-bold text-teal-700 uppercase tracking-wide mb-1">${t('¿Qué resuelve?', 'What do they handle?')}</div><p class="text-sm text-slate-700">${escapeHtml(info.treats)}</p></div>
  <div class="bg-amber-50 border border-amber-200 rounded-xl p-4"><div class="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">${t('¿Cuándo ir?', 'When to go')}</div><p class="text-sm text-slate-700">${escapeHtml(info.whenToGo)}</p></div>
</div>
${noteHtml}
<h2>${t('Por región', 'By region')}</h2>
<p class="text-slate-600 -mt-2">${t('Cuántos hay en cada región. Toca una para ver la lista con teléfonos.', 'How many in each region. Tap one to see the list with phone numbers.')}</p>
<div class="not-prose mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">${regionCards}</div>
<h2>${t(`Los ${total} ${escapeHtml(x.l.toLowerCase())} de Puerto Rico`, `All ${total} ${escapeHtml(labelLow)} in Puerto Rico`)}</h2>
<div class="not-prose mt-2 overflow-auto border border-slate-200 rounded-xl"><table class="w-full text-sm">${thead}<tbody>${provRows}</tbody></table></div>
${providers.length >= 200 ? `<p class="text-xs text-slate-500 mt-2">${t('Mostrando los primeros 200. Usa las regiones de arriba para ver la lista completa de tu zona.', 'Showing the first 200. Use the regions above to see the full list for your area.')}</p>` : ''}`
  }

  body += `
<div class="not-prose mt-8 bg-teal-700 rounded-2xl p-6 text-center text-white">
  <p class="text-lg font-bold mb-1">${t('¿No sabes a cuál ir?', 'Not sure which one to see?')}</p>
  <p class="text-sm text-teal-100 mb-4">${t('Escríbele al Veci. Te dice quién hay cerca y sus teléfonos. Al', 'Text El Veci. He tells you who is nearby and their phone numbers. At')} <strong>${PHONE_CTA}</strong>:</p>
  <a href="https://wa.me/17874177711?text=${x.kw}" class="inline-flex items-center gap-2 bg-white text-teal-800 font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-50"><i class="fa-brands fa-whatsapp text-lg"></i> ${x.kw}</a>
</div>
<p class="text-xs text-slate-500 mt-6">${t('Datos del <strong>NPPES</strong>, el registro federal de proveedores de EE.UU. (el que usan Medicare y los planes). Cada NPI es público y verificable.', 'Data from the <strong>NPPES</strong>, the US federal provider registry (the same one Medicare and health plans use). Every NPI is public and verifiable.')} <a href="/registro/desiertos${lp}" class="text-teal-600">${t('Mira el acceso por región en toda la isla →', 'See access by region across the island →')}</a></p>`

  const canonicalPath = region ? `registro/${specUrl}/${specToUrl(region).toLowerCase()}` : `registro/${specUrl}`
  const itemList = providers.slice(0, 50).map((p, i) => ({
    '@type': 'ListItem', position: i + 1, name: cleanProviderName(p.name),
    url: `https://registromedicopr.com/especialista/${encodeURIComponent(p.slug)}`,
  }))
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Registro Médico PR', item: 'https://registromedicopr.com' },
      { '@type': 'ListItem', position: 2, name: x.l, item: `https://registromedicopr.com/registro/${specUrl}` },
      ...(region ? [{ '@type': 'ListItem', position: 3, name: region, item: `https://registromedicopr.com/${canonicalPath}` }] : []),
    ] },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
      { '@type': 'Question', name: `¿Qué hace un ${x.l.toLowerCase()}?`, acceptedAnswer: { '@type': 'Answer', text: `${info.treats} ${info.whenToGo}` } },
      { '@type': 'Question', name: region ? `¿Cuántos ${x.l.toLowerCase()} hay en ${region}, Puerto Rico?` : `¿Cuántos ${x.l.toLowerCase()} hay en Puerto Rico?`,
        acceptedAnswer: { '@type': 'Answer', text: region ? `En ${region} hay ${regionCount} ${x.l.toLowerCase()} verificados contra el registro federal NPPES.` : `En Puerto Rico hay ${total} ${x.l.toLowerCase()} verificados contra el registro federal NPPES.` } },
    ] },
    ...(itemList.length ? [{ '@context': 'https://schema.org', '@type': 'ItemList', name: title, numberOfItems: providers.length, itemListElement: itemList }] : []),
  ]

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title, description, slug: canonicalPath, bodyHtml: body, jsonLd,
    ogImage: '/og/registro.png', host: req.headers?.host, canonicalHost: 'https://registromedicopr.com',
    lang: en ? 'en' : 'es',
  }))
}

// =============== CAPA DE DATOS CÍVICA — promesas (drive /observatorio + /promesas + pueblos futuros) ===============
// Editar UN status aquí actualiza ambas páginas. Replicable: otro pueblo = otro array.
// Un updater autónomo puede editar 'status'/'detail' sin tocar HTML.
const CIVIC_STATUS: Record<string, [string, string]> = {
  HECHO:     ['✅ HECHO', '#059669'],
  EMPEZO:    ['🟡 EMPEZÓ', '#d97706'],
  NO:        ['❌ NO', '#e11d48'],
  ESPERANDO: ['⏳ SIN CONTESTAR', '#64748b'],
}
// promesa: { topic, text, quien, fecha, src:[url,label]|null, status, detail, feat? }
type Promesa = { topic: string; text: string; quien: string; src: [string, string] | null; status: string; detail: string; feat?: boolean; deadline?: string }
const PROMESAS_CABOROJO: Promesa[] = [
  // 🗑️ BASURA Y VERTEDERO
  { topic: '🗑️ Basura y vertedero', text: 'Nueva celda del vertedero "con capacidad de diez años". Dijo que ya se celebró la presubasta.', quien: 'Alcalde Morales · mar 2024', src: ['https://youtu.be/-HKfFUfE9nk', 'CaboRojo.com'], status: 'ESPERANDO', detail: '', feat: true },
  { topic: '🗑️ Basura y vertedero', text: 'El vertedero ya no es vertedero: ahora es "centro de transbordo" que lleva la basura a Mayagüez.', quien: 'Alcalde Morales · 2024', src: null, status: 'EMPEZO', detail: '' },
  { topic: '🗑️ Basura y vertedero', text: 'Tres excavadoras, una siempre en el vertedero montando la basura para Mayagüez.', quien: 'Alcalde Morales · 2023', src: null, status: 'ESPERANDO', detail: '' },
  { topic: '🗑️ Basura y vertedero', text: 'querellavirtual del municipio para reportar escombros que no recogieron.', quien: 'Alcalde Morales · 2023', src: null, status: 'ESPERANDO', detail: '' },
  { topic: '🗑️ Basura y vertedero', text: 'Limpieza "2.0": sacaron 4,000 yardas de escombro con 450 voluntarios.', quien: 'Alcalde Morales · 2024', src: null, status: 'ESPERANDO', detail: '' },
  { topic: '🗑️ Basura y vertedero', text: 'Ordenanza de un fee de $250 al año (escombros/manejo).', quien: 'Alcalde Morales · 2024', src: null, status: 'ESPERANDO', detail: '' },
  // 🕳️ HOYOS, ASFALTO Y CARRETERAS
  { topic: '🕳️ Hoyos, asfalto y carreteras', text: '"El 90% de los caminos del pueblo estaban destruidos, ya llevamos un 60% mejorado." La tonelada subió de $99 a $129.', quien: 'Alcalde Morales · mar 2024', src: ['https://youtu.be/-HKfFUfE9nk', 'CaboRojo.com'], status: 'EMPEZO', detail: 'dice 60% · verifícalo en tu calle', feat: true },
  { topic: '🕳️ Hoyos, asfalto y carreteras', text: 'Asfaltaron la carretera 308 (parte) y la de Bajajá (completa).', quien: 'Alcalde Morales · 2024', src: null, status: 'EMPEZO', detail: '' },
  { topic: '🕳️ Hoyos, asfalto y carreteras', text: 'Repavimentar la carretera de Sabana Alta (esperando los fondos).', quien: 'Alcalde Morales · 2024', src: null, status: 'ESPERANDO', detail: '' },
  { topic: '🕳️ Hoyos, asfalto y carreteras', text: 'Próximamente el camino a Masín, en Las Palmas.', quien: 'Alcalde Morales · 2024', src: null, status: 'ESPERANDO', detail: '' },
  { topic: '🕳️ Hoyos, asfalto y carreteras', text: 'Cerca de $9 millones invertidos en caminos + un camión de bacheo.', quien: 'Alcalde Morales · 2024', src: null, status: 'ESPERANDO', detail: '' },
  // 👮 POLICÍA Y SEGURIDAD
  { topic: '👮 Policía y seguridad', text: 'Subir el sueldo de la policía de ~$1,800 a cerca de $2,000, "y el año que viene un poco más".', quien: 'Alcalde Morales · jun 2023', src: ['https://youtu.be/x7LX3y4otNQ', 'CaboRojo.com'], status: 'HECHO', detail: 'presupuesto 2025-26 lo pone en $2,180/mes', feat: true },
  { topic: '👮 Policía y seguridad', text: '"La policía estuvo en 60 y pico, ya está en 20 y pico." Prometió 6 patrullas y chalecos nuevos.', quien: 'Alcalde Morales · 2024', src: null, status: 'ESPERANDO', detail: 'récord del propio alcalde', feat: true },
  { topic: '👮 Policía y seguridad', text: '3 cadetes nuevos listos para marzo, y otra academia de 10 más.', quien: 'Alcalde Morales · 2024', src: null, status: 'ESPERANDO', detail: '' },
  { topic: '👮 Policía y seguridad', text: 'Comprar tasers y cámaras en el pecho (body cams) para los policías.', quien: 'Alcalde Morales · 2024', src: null, status: 'ESPERANDO', detail: '' },
  { topic: '👮 Policía y seguridad', text: 'Cámaras de vigilancia 24 horas en Boquerón y en el sector del vertedero.', quien: 'Alcalde Morales · 2024', src: null, status: 'ESPERANDO', detail: '' },
  { topic: '👮 Policía y seguridad', text: 'Una guagua de rescate (400 galones de agua, 75 de espuma).', quien: 'Alcalde Morales · 2024', src: null, status: 'ESPERANDO', detail: '' },
  // 💧 AGUA
  { topic: '💧 Agua', text: 'Un sistema de bombeo de $8 millones que "va a proteger de por vida la Bahía de Boquerón".', quien: 'Alcalde Morales · mar 2024', src: ['https://youtu.be/-HKfFUfE9nk', 'CaboRojo.com'], status: 'EMPEZO', detail: '$7.8M asignados, ~70% a mar 2026', feat: true },
  { topic: '💧 Agua', text: 'Llevar las aguas a las plantas de Villataína y de ahí a Lajas.', quien: 'Alcalde Morales · 2024', src: null, status: 'ESPERANDO', detail: '' },
  // 🏖️ FARO, PLAYAS Y BALNEARIO
  { topic: '🏖️ Faro, playas y balneario', text: 'Reabrir el Faro Los Morrillos "en unos meses", con fondos de Fiona. Admitió que el municipio dejó vencer el acuerdo de manejo en 2016.', quien: 'Alcalde Morales · 2024', src: ['https://youtu.be/-HKfFUfE9nk', 'CaboRojo.com'], status: 'NO', detail: 'cerrado a 2026', feat: true },
  { topic: '🏖️ Faro, playas y balneario', text: 'Hacer el Balneario de Boquerón "uno de los lugares más icónicos de Puerto Rico".', quien: 'Alcalde Morales · 2024', src: null, status: 'EMPEZO', detail: 'traspaso al municipio en proceso (ordenanza 2024-25)', feat: true },
  { topic: '🏖️ Faro, playas y balneario', text: 'Aduana Federal construye un edificio de $18M en Boquerón (proyecto federal, ya comenzó).', quien: 'Alcalde Morales · 2024', src: null, status: 'HECHO', detail: 'proyecto federal de CBP, no municipal', feat: true },
  { topic: '🏖️ Faro, playas y balneario', text: 'En el Combate: el desvío de Polo Gea, un proyecto de $3-4 millones.', quien: 'Alcalde Morales · 2024', src: null, status: 'ESPERANDO', detail: '' },
  { topic: '🏖️ Faro, playas y balneario', text: 'Cunetones frente a las casas del Camino Hernández.', quien: 'Alcalde Morales · 2024', src: null, status: 'ESPERANDO', detail: '' },
  // 🏀 DEPORTE, ESCUELAS Y PLAZA
  { topic: '🏀 Deporte, escuelas y plaza', text: 'Usar los $5.2M de FEMA del Coliseo Rebekah Colberg antes del 20 de septiembre de 2026.', quien: 'Municipio · límite 20 sept 2026', src: ['https://youtu.be/WpizUMfP3rc', 'alcalde en cámara'], status: 'EMPEZO', detail: 'obras empezaron feb 2026 · reloj corriendo', feat: true , deadline: '2026-09-20' },
  { topic: '🏀 Deporte, escuelas y plaza', text: 'Canchas profesionales en la Rebeca Colberg + 2 bleachers para 400 fanáticos.', quien: 'Alcalde Morales · 2024', src: null, status: 'ESPERANDO', detail: '' },
  { topic: '🏀 Deporte, escuelas y plaza', text: 'Pequeñas ligas: 200+ niños con una inversión de $22,000. Sistema profesional de voleibol ($5,000) "ya llegó".', quien: 'Alcalde Morales · 2024', src: null, status: 'ESPERANDO', detail: '' },
  { topic: '🏀 Deporte, escuelas y plaza', text: '$20 millones para la escuela Inés María Mendoza.', quien: 'Alcalde Morales · 2024', src: null, status: 'ESPERANDO', detail: '' },
  { topic: '🏀 Deporte, escuelas y plaza', text: 'Un mini estadio de fútbol: 300 butacas y camerinos. La plaza "va a quedar preciosa" (faltan permisos).', quien: 'Alcalde Morales · 2024', src: null, status: 'ESPERANDO', detail: '' },
  { topic: '🏀 Deporte, escuelas y plaza', text: 'Damas de llaves (ayuda a personas): de 22 que había, ya cerca de 90.', quien: 'Alcalde Morales · 2024', src: null, status: 'EMPEZO', detail: '' },
  // 💰 DINERO Y PRESUPUESTO
  { topic: '💰 Dinero y presupuesto', text: 'Endoso condicionado a Esencia: la condición es que el proyecto tenga su propia agua.', quien: 'Alcaldía · 2024', src: ['https://youtu.be/85V_v2cBj1s', 'CaboRojo.com'], status: 'ESPERANDO', detail: '', feat: true },
  { topic: '💰 Dinero y presupuesto', text: '~$735K de FEMA para Isla Ratones — proyecto retirado; el cayo se hundió en 2020.', quien: 'DRNA / Municipio · 2025-2026', src: ['https://www.primerahora.com/noticias/puerto-rico/notas/a-la-deriva-isla-ratones-se-ahoga-su-reconstruccion/', 'Primera Hora'], status: 'NO', detail: 'devuelto a FEMA', feat: true },
  { topic: '💰 Dinero y presupuesto', text: '"Cuando saque del medio el pago de esos préstamos, nos va a sobrar mucho más." "En dos años la Junta debe estar diciendo adiós."', quien: 'Alcalde Morales · 2024', src: null, status: 'ESPERANDO', detail: '' },
]

function civicBadge(status: string, detail: string): string {
  const [label, color] = CIVIC_STATUS[status] || CIVIC_STATUS.ESPERANDO
  return `<strong style="color:${color}">${label}</strong>${detail ? ' · ' + detail : ''}`
}
function civicSrcCell(p: Promesa): string {
  if (!p.src) return 'En cámara · CaboRojo.com'
  return `En cámara · <a href="${p.src[0]}" target="_blank" rel="noopener">${p.src[1]}</a>`
}
// Promesómetro (observatorio): solo featured, formato tabla
function renderPromesometroRows(promesas: Promesa[]): string {
  return promesas.filter(p => p.feat).map(p =>
    `<tr><td>${p.text}</td><td>${p.quien}</td><td>${civicSrcCell(p)}</td><td>${civicBadge(p.status, p.detail)}</td></tr>`
  ).join('\n')
}
// /promesas: todas, agrupadas por tema
function renderPromesasByTopic(promesas: Promesa[]): string {
  const topics: string[] = []
  for (const p of promesas) if (!topics.includes(p.topic)) topics.push(p.topic)
  return topics.map(t => {
    const rows = promesas.filter(p => p.topic === t).map(p =>
      `<tr><td>${p.text}</td><td>${civicBadge(p.status, p.detail)}</td></tr>`
    ).join('\n')
    return `<h2>${t}</h2>\n<table><thead><tr><th>Lo que dijo</th><th>¿Y?</th></tr></thead><tbody>\n${rows}\n</tbody></table>`
  }).join('\n\n')
}
function civicCounts(promesas: Promesa[]): Record<string, number> {
  const c: Record<string, number> = { HECHO: 0, EMPEZO: 0, NO: 0, ESPERANDO: 0 }
  for (const p of promesas) c[p.status] = (c[p.status] || 0) + 1
  return c
}

// =============== /civico.json — data cívica machine-readable (updater + bot/Veci + IA) ===============
function handleCivicoJson(_req: any, res: any) {
  const promesas = PROMESAS_CABOROJO
  const out = {
    municipio: 'Cabo Rojo',
    alcalde: 'Jorge A. Morales Wiscovitch',
    fuente: 'https://www.mapadecaborojo.com/observatorio',
    nota: 'Record publico no-partidista. Promesas y declaraciones del alcalde en entrevistas de video (2023-2024).',
    leyenda: { HECHO: 'cumplido', EMPEZO: 'en proceso', NO: 'no cumplido', ESPERANDO: 'sin verificar / falta respuesta del municipio' },
    counts: civicCounts(promesas),
    promesas: promesas.map(p => ({
      tema: p.topic, texto: p.text, quien: p.quien,
      video: p.src ? p.src[0] : null, status: p.status, detalle: p.detail || null,
      deadline: p.deadline || null,
    })),
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, max-age=900, s-maxage=900')
  res.status(200).send(JSON.stringify(out, null, 2))
}

// =============== Observatorio interactivo — submit + moderación de un clic ===============
const CIVIC_KINDS = new Set(['problema', 'me_pasa', 'feedback_promesa', 'promesa_hecha', 'feedback_quien'])
const CIVIC_TOPICS = new Set(['agua', 'basura', 'luz', 'oportunidades', 'otro'])
const CIVIC_TOPIC_LABEL: Record<string, string> = { agua: '💧 Agua', basura: '🗑️ Basura', luz: '💡 Luz', oportunidades: '🌱 Lo que falta', otro: 'Otro' }

// Moderation link signing — server-only secret, HMAC, expiry, constant-time verify.
// Refuses to sign (returns null) when no real secret is set, so we never fall back
// to a public VITE_ key or a literal. SERVICE_ROLE_KEY is set in prod (the RPC client
// uses it), so this resolves to a real server-only secret.
const MOD_SECRET = process.env.MODERATION_SIGNING_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const MOD_TTL_MS = 14 * 24 * 60 * 60 * 1000 // 14 días

function civicModSign(id: string, exp: number): string | null {
  if (!MOD_SECRET || !id) return null
  return createHmac('sha256', MOD_SECRET).update(`${id}:${exp}`).digest('hex').slice(0, 32)
}
function civicModVerify(id: string, exp: number, t: string): boolean {
  if (!MOD_SECRET || !id || !t || !Number.isFinite(exp) || exp <= 0) return false
  if (Date.now() > exp) return false // expirado
  const expected = civicModSign(id, exp)
  if (!expected) return false
  const a = Buffer.from(t)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

async function notifyCivicSubmission(row: any, id: string): Promise<void> {
  if (!RESEND_API_KEY) return
  const exp = Date.now() + MOD_TTL_MS
  const sig = civicModSign(id, exp)
  const base = sig ? `${SITE_URL}/api/mapa-pages?page=civico-moderate&id=${id}&exp=${exp}&t=${sig}` : ''
  const kindLabel: Record<string, string> = {
    problema: '🆕 Problema nuevo', me_pasa: '🙋 "Me pasa a mí"',
    feedback_promesa: '💬 Feedback de promesa', promesa_hecha: '✅ "Esto ya se hizo"',
    feedback_quien: '🏛️ Corregir Quién Responde',
  }
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
    <h2 style="color:#0f766e">${kindLabel[row.kind] || row.kind}</h2>
    <p style="font-size:15px;color:#334155;white-space:pre-wrap;background:#f8fafc;border-left:3px solid #0f766e;padding:12px 16px;border-radius:6px">${escapeHtml(row.body || '')}</p>
    ${row.topic ? `<p style="font-size:13px;color:#64748b">Tema: <strong>${escapeHtml(row.topic)}</strong></p>` : ''}
    ${row.ref ? `<p style="font-size:13px;color:#64748b">Sobre: <strong>${escapeHtml(row.ref)}</strong></p>` : ''}
    ${row.contact ? `<p style="font-size:13px;color:#64748b">Contacto: <strong>${escapeHtml(row.contact)}</strong></p>` : ''}
    ${row.proof_url ? `<p style="font-size:13px"><a href="${escapeHtml(row.proof_url)}">Ver prueba →</a></p>` : ''}
    ${base ? `<div style="margin-top:20px">
      <a href="${base}&action=approve" style="display:inline-block;background:#059669;color:#fff;font-weight:700;padding:12px 22px;border-radius:8px;text-decoration:none;margin-right:8px">✅ Aprobar y publicar</a>
      <a href="${base}&action=reject" style="display:inline-block;background:#e11d48;color:#fff;font-weight:700;padding:12px 22px;border-radius:8px;text-decoration:none">❌ Rechazar</a>
    </div>` : '<p style="color:#b45309;font-size:13px">⚠️ Falta MODERATION_SIGNING_KEY — modera en /admin.</p>'}
    <p style="font-size:12px;color:#94a3b8;margin-top:18px">Nada se publica hasta que aprietes Aprobar. Observatorio Cívico · mapadecaborojo.com/observatorio</p>
  </div>`
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: REPLY_TO, reply_to: REPLY_TO, subject: `Observatorio: ${kindLabel[row.kind] || 'nueva entrada'}`, html }),
    })
  } catch { /* notify es best-effort, nunca rompe el submit */ }
}

async function handleCivicoSubmit(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST only' }); return }
  try {
    let body: any = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
    body = body || {}
    const kind = String(body.kind || '')
    if (!CIVIC_KINDS.has(kind)) { res.status(400).json({ ok: false, error: 'Tipo inválido.' }); return }
    const text = String(body.body || '').trim().slice(0, 1200)
    if (kind !== 'me_pasa' && text.length < 4) { res.status(400).json({ ok: false, error: 'Escribe un poco más para poder entenderlo.' }); return }
    const topic = CIVIC_TOPICS.has(String(body.topic)) ? String(body.topic) : null
    const ref = body.ref ? String(body.ref).slice(0, 120) : null
    const contact = body.contact ? String(body.contact).slice(0, 160) : null
    // Solo aceptar http/https para el link de prueba (bloquea javascript:/data:/etc. antes de guardar).
    const proof = (() => {
      if (!body.proof_url) return null
      try {
        const u = new URL(String(body.proof_url))
        return (u.protocol === 'https:' || u.protocol === 'http:') ? u.toString().slice(0, 400) : null
      } catch { return null }
    })()
    const ipRaw = (String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || (req.socket && req.socket.remoteAddress) || ''
    const row = {
      kind, ref, topic,
      body: text || '(reacción: me pasa a mí)',
      contact, proof_url: proof,
      source: 'web', ip_hash: hashIp(ipRaw), ua: String(req.headers['user-agent'] || '').slice(0, 300),
    }
    const { data, error } = await supabase.from('civic_submissions').insert(row).select('id').single()
    if (error) { res.status(500).json({ ok: false, error: 'No se pudo guardar. Intenta luego.' }); return }
    notifyCivicSubmission(row, data.id).catch(() => {})
    res.status(200).json({ ok: true })
  } catch { res.status(500).json({ ok: false, error: 'Error inesperado.' }) }
}

async function handleCivicoModerate(req: any, res: any) {
  const isPost = req.method === 'POST'
  // GET lee de query (link del email); POST lee del body del form de confirmación.
  const src: any = isPost
    ? (typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : (req.body || {}))
    : req.query
  const id = String(src.id || '')
  const action = String(src.action || '')
  const t = String(src.t || '')
  const exp = Number(src.exp || 0)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Referrer-Policy', 'no-referrer') // el token no se filtra vía Referer

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).send('<body style="font-family:system-ui;padding:48px;text-align:center"><h2>Método no permitido</h2></body>')
    return
  }
  const valid = id && (action === 'approve' || action === 'reject') && civicModVerify(id, exp, t)
  if (!valid) {
    res.status(403).send('<body style="font-family:system-ui;padding:48px;text-align:center"><h2>No autorizado</h2><p>El enlace no es válido o ya expiró.</p></body>')
    return
  }

  // GET = página de confirmación. El cambio de estado SOLO ocurre con el POST del
  // botón, así que un prefetch/escáner de email (que solo hace GET) no puede moderar.
  if (!isPost) {
    const verbo = action === 'approve' ? 'aprobar y publicar' : 'rechazar'
    const color = action === 'approve' ? '#059669' : '#e11d48'
    res.status(200).send(`<body style="font-family:system-ui,sans-serif;padding:48px;text-align:center;color:#0f172a">
      <h2>¿Confirmar ${verbo}?</h2>
      <p style="color:#475569">Entrada ${escapeHtml(id.slice(0, 8))}. Esto no se aplica hasta que confirmes.</p>
      <form method="POST" action="/api/mapa-pages?page=civico-moderate" style="margin-top:24px">
        <input type="hidden" name="id" value="${escapeHtml(id)}">
        <input type="hidden" name="action" value="${escapeHtml(action)}">
        <input type="hidden" name="t" value="${escapeHtml(t)}">
        <input type="hidden" name="exp" value="${escapeHtml(String(exp))}">
        <button type="submit" style="background:${color};color:#fff;font-weight:700;padding:14px 28px;border:0;border-radius:8px;font-size:15px;cursor:pointer">Sí, ${verbo}</button>
      </form>
      <p style="margin-top:18px"><a href="/observatorio" rel="noreferrer" style="color:#64748b">Cancelar</a></p>
    </body>`)
    return
  }

  // POST = aplica. First-write-wins: solo muta si aún no fue revisado (idempotente,
  // un token filtrado/reenviado no puede revertir una decisión previa).
  const status = action === 'approve' ? 'approved' : 'rejected'
  const { data: updated } = await supabase
    .from('civic_submissions')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .is('reviewed_at', null)
    .select('id')
  const yaEstaba = !updated || updated.length === 0
  res.status(200).send(`<body style="font-family:system-ui,sans-serif;padding:48px;text-align:center;color:#0f172a"><h2>${action === 'approve' ? '✅ Aprobado y publicado' : '❌ Rechazado'}${yaEstaba ? ' (ya estaba revisado)' : ''}</h2><p style="color:#475569">Entrada ${escapeHtml(id.slice(0, 8))} marcada como <strong>${escapeHtml(status)}</strong>.</p><a href="/observatorio" rel="noreferrer" style="color:#0f766e;font-weight:700">← Ver el Observatorio</a></body>`)
}

// Formulario de submission reusable. El script cliente se incluye una vez por página vía CIVIC_FORM_SCRIPT.
function civicSubmitForm(opts: { kind: string; ref?: string; showTopic?: boolean; showProof?: boolean; title: string; sub?: string; placeholder: string; cta: string; tone?: string }): string {
  const tone = opts.tone || 'teal'
  const border = tone === 'rose' ? 'border-l-rose-500' : 'border-l-teal-600'
  const btn = tone === 'rose' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-teal-700 hover:bg-teal-800'
  const topicSel = opts.showTopic ? `<select name="topic" class="w-full mt-2 text-sm border border-slate-300 rounded-lg px-3 py-2"><option value="">¿De qué es? (opcional)</option><option value="agua">💧 Agua</option><option value="basura">🗑️ Basura / reciclaje</option><option value="luz">💡 Luz</option><option value="oportunidades">🌱 Algo que falta / oportunidad</option><option value="otro">Otro</option></select>` : ''
  const proof = opts.showProof ? `<input name="proof_url" type="url" placeholder="Link a una foto o documento (opcional)" class="w-full mt-2 text-sm border border-slate-300 rounded-lg px-3 py-2">` : ''
  return `<form class="civic-form not-prose bg-white border border-slate-200 border-l-4 ${border} rounded-lg p-4 mt-4" data-kind="${opts.kind}" data-ref="${opts.ref || ''}" onsubmit="return civicSubmit(this)">
  <p class="font-bold text-slate-900">${opts.title}</p>
  ${opts.sub ? `<p class="text-sm text-slate-600 mt-1">${opts.sub}</p>` : ''}
  <textarea name="body" rows="3" placeholder="${opts.placeholder}" class="w-full mt-2 text-sm border border-slate-300 rounded-lg px-3 py-2"></textarea>
  ${topicSel}
  ${proof}
  <input name="contact" placeholder="Tu WhatsApp o email (opcional, por si hay que confirmar)" class="w-full mt-2 text-sm border border-slate-300 rounded-lg px-3 py-2">
  <button type="submit" class="mt-3 ${btn} text-white font-bold text-sm px-5 py-2.5 rounded-lg">${opts.cta}</button>
  <p class="civic-msg text-sm mt-2"></p>
  <p class="text-xs text-slate-400 mt-2">Un humano lo revisa antes de publicarlo. Aquí no se publica nada automático.</p>
</form>`
}

function mePasaBtn(ref: string): string {
  return `<button type="button" data-ref="${ref}" onclick="return civicMePasa(this)" class="mt-2 text-xs font-semibold text-teal-700 border border-teal-300 rounded-full px-3 py-1 hover:bg-teal-50">🙋 Esto me pasa a mí</button>`
}

// Renderiza lo que el pueblo añadió y Angel aprobó (live desde civic_submissions)
function renderPuebloAdd(rows: Array<{ topic: string | null; body: string; created_at: string }>): string {
  if (!rows.length) {
    return `<p class="text-sm text-slate-500 italic">Todavía nadie ha añadido nada por aquí. Sé el primero: usa el botón de arriba. Lo que pase el filtro de un humano aparece en esta lista, con tu palabra, no la nuestra.</p>`
  }
  const items = rows.map(r => {
    const tag = r.topic && CIVIC_TOPIC_LABEL[r.topic] ? `<span class="inline-block text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded mr-2">${CIVIC_TOPIC_LABEL[r.topic]}</span>` : ''
    return `<li class="bg-white border border-slate-200 rounded-lg p-3 text-sm text-slate-700">${tag}${escapeHtml(r.body)}</li>`
  }).join('\n')
  return `<ul class="not-prose space-y-2 mt-3">${items}</ul>`
}

const CIVIC_FORM_SCRIPT = `<script>
function civicSubmit(f){
  var msg=f.querySelector('.civic-msg'), btn=f.querySelector('button');
  var p={kind:f.dataset.kind, ref:f.dataset.ref||null};
  ['body','topic','contact','proof_url'].forEach(function(n){var el=f.querySelector('[name="'+n+'"]'); if(el&&el.value) p[n]=el.value;});
  if(f.dataset.kind!=='me_pasa' && (!p.body||p.body.trim().length<4)){ msg.style.color='#e11d48'; msg.textContent='Escribe un poco más.'; return false; }
  btn.disabled=true; var o=btn.textContent; btn.textContent='Enviando...';
  fetch('/api/mapa-pages?page=civico-submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)})
   .then(function(r){return r.json()}).then(function(d){
     if(d&&d.ok){ f.reset(); msg.style.color='#059669'; msg.textContent='✅ Recibido. Un humano lo revisa antes de publicarlo. Gracias por construir el pueblo.'; btn.textContent='Enviado ✓'; }
     else { msg.style.color='#e11d48'; msg.textContent=(d&&d.error)||'No se pudo enviar.'; btn.disabled=false; btn.textContent=o; }
   }).catch(function(){ msg.style.color='#e11d48'; msg.textContent='Falló el envío. Intenta luego o textea al 787-417-7711.'; btn.disabled=false; btn.textContent=o; });
  return false;
}
function civicMePasa(b){
  b.disabled=true;
  fetch('/api/mapa-pages?page=civico-submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'me_pasa',ref:b.dataset.ref||''})})
   .then(function(r){return r.json()}).then(function(){ b.textContent='✓ A mí también'; b.classList.add('opacity-60'); }).catch(function(){ b.disabled=false; });
  return false;
}
</script>`

// =============== /promesas — Todo lo que el alcalde dijo en cámara ===============
// Banco completo de promesas extraído de las entrevistas (archivo CaboRojo.com 2023-2024).
// Fuente: El Cerebro pozo 'civico'. Organizado por tema, a lectura de 2do grado.
function handlePromesas(_req: any, res: any) {
  const body = `
<span class="not-prose inline-block bg-teal-100 text-teal-800 text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full">Observatorio Cívico · No-partidista · Cabo Rojo</span>

<h1 class="mt-4">Todo lo que el alcalde dijo en cámara.</h1>

<p class="text-lg text-slate-600 mt-3"><strong>¿Qué es esto?</strong> Es la lista de lo que el alcalde de Cabo Rojo prometió o dijo en sus entrevistas con nosotros (2023-2024). Lo guardamos con su video. Aquí está, una por una. Tú decides cuál se hizo y cuál no.</p>

<div class="not-prose mt-4 bg-white border border-slate-200 border-l-4 border-l-teal-600 rounded-lg p-4">
  <p class="text-sm text-slate-700"><strong class="text-teal-700">Para la alcaldía:</strong> esto no es para pelear. Es una lista de trabajo. Lo que ya esté hecho, dilo con prueba y lo marcamos <strong>HECHO</strong> el mismo día. Lo que falta, dinos cuándo. El pueblo solo quiere saber.</p>
</div>

<p class="text-sm text-slate-600 mt-4">Cómo leer: <span class="font-bold text-emerald-700">✅ HECHO</span> · <span class="font-bold text-amber-600">🟡 EMPEZÓ</span> · <span class="font-bold text-rose-600">❌ NO</span> · <span class="font-bold text-slate-500">⏳ SIN CONTESTAR</span>. La mayoría dice "sin contestar" porque falta que la alcaldía responda con prueba.</p>

<p class="text-sm text-slate-500 mt-2"><a href="/observatorio" class="text-teal-700 font-semibold">← Volver al Observatorio</a> · <a href="/quien-responde" class="text-teal-700 font-semibold">¿Quién responde por esto? →</a> · Cada cosa salió de entrevistas en video de CaboRojo.com con el alcalde.</p>

${renderPromesasByTopic(PROMESAS_CABOROJO)}

<div class="not-prose mt-6 bg-teal-900 text-white rounded-xl p-5">
  <p class="font-bold text-base">¿Falta alguna? ¿Alguna ya está hecha?</p>
  <p class="text-sm text-teal-100 mt-1">Lo puedes decir aquí mismo (abajo), o textea <strong>OBSERVATORIO al ${PHONE_CTA}</strong>. Lo revisa un humano antes de cambiar nada. Esto se mantiene vivo.</p>
</div>

${civicSubmitForm({ kind: 'promesa_hecha', showProof: true, tone: 'teal', title: '✅ "Esto ya se hizo"', sub: 'Si sabes que algo de esta lista ya está cumplido, dilo. Si tienes prueba (una foto, un link, un documento), mejor: lo marcamos HECHO el mismo día.', placeholder: '¿Cuál promesa, y cómo sabes que ya se hizo?', cta: 'Avisar que ya se hizo' })}

${civicSubmitForm({ kind: 'feedback_promesa', tone: 'rose', title: '💬 Falta una, o algo no cuadra', sub: 'Si el alcalde dijo algo en cámara que no está en esta lista, o si crees que un estado está mal, escríbelo.', placeholder: 'Cuéntanos qué falta o qué corregir.', cta: 'Enviar feedback' })}

<blockquote>No escogemos a nadie. Organizamos lo que se dijo y lo ponemos donde todos lo vean. Si esto te ayuda a entender mejor tu pueblo, llégate. Si no, sigue tu camino.</blockquote>

<p class="text-xs text-slate-500 mt-4">Todas estas frases salen de entrevistas públicas en video de CaboRojo.com con el alcalde Jorge Morales (2023-2024), guardadas en el archivo del pueblo. Récord, no acusación. El video completo está en cada caso; se enlaza a medida que se confirma. <a href="/observatorio" class="text-teal-700 font-semibold">Ver el Observatorio →</a></p>
${CIVIC_FORM_SCRIPT}
`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Promesas del alcalde de Cabo Rojo en cámara',
    description: 'Lista de compromisos y declaraciones del alcalde de Cabo Rojo en entrevistas públicas de video (2023-2024), organizada por tema con su estado. No-partidista.',
    creator: { '@type': 'Organization', name: 'mapadecaborojo.com' },
    spatialCoverage: { '@type': 'Place', name: 'Cabo Rojo, Puerto Rico' },
    isAccessibleForFree: true,
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800')
  res.status(200).send(layout({
    title: 'Las promesas del alcalde de Cabo Rojo, en cámara',
    description: 'Todo lo que el alcalde de Cabo Rojo dijo o prometió en sus entrevistas (2023-2024), tema por tema, con su estado. Récord público, no-partidista.',
    slug: 'promesas',
    bodyHtml: body,
    jsonLd,
    ogImage: '/og/observatorio.png',
  }))
}

// =============== /observatorio — Observatorio Cívico de Cabo Rojo ===============
// Lista verificada de problemas reales del pueblo (demanda real *7711 + récord público)
// + el examen que todo aspirante debe contestar + herramientas ciudadanas. No-partidista.
// Reanclado 2026-06-20: arranca por agua/basura/luz/oportunidades. Esencia parqueada (solo por su
// impacto en servicios). Interactivo: el vecino añade y reacciona (moderado, civic_submissions).
async function handleObservatorio(req: any, res: any) {
  // registromedicopr.com/observatorio = El Observatorio del Acceso Médico (statewide, citable).
  if (/registromedicopr\.com/i.test(String(req.headers?.host || ''))) {
    return handleObservatorioMedico(req, res)
  }
  const { data: puebloAddRows } = await supabase
    .from('civic_submissions')
    .select('topic,body,created_at')
    .eq('status', 'approved').eq('kind', 'problema')
    .order('created_at', { ascending: false }).limit(40)
  const body = `
<span class="not-prose inline-block bg-teal-100 text-teal-800 text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full">Observatorio Cívico · No-partidista · Cabo Rojo y el Distrito 20</span>

<h1 class="mt-4">La lista de problemas de Cabo Rojo.</h1>

<p class="text-lg text-slate-600 mt-3"><strong>¿Qué es esto?</strong> Es lo que está pasando en Cabo Rojo, puesto en un solo sitio. Cada cosa trae su número, su fecha y de dónde sale. Tú lo ves. Tú decides. Y si falta algo, lo añades tú.</p>

<p class="text-lg text-slate-600 mt-2"><strong>¿Para qué?</strong> Para que el que manda tenga que contestar. Si algo ya se hizo, que lo diga y lo enseñe. Si no, que diga cuándo. Aquí no escogemos a nadie. Solo ponemos todo donde todos lo vean.</p>

<p class="text-slate-600 italic mt-3">Cabo Rojo no es de ningún partido. Es de la gente que vive aquí. Un pueblo de 50,000 puede tener mejor información que una ciudad de millones, si alguien se sienta a verificarla, una por una.</p>

<div class="not-prose mt-5 bg-white border border-slate-200 border-l-4 border-l-amber-500 rounded-lg p-4">
  <p class="text-sm text-slate-700"><strong class="text-teal-700">Nuestra posición es Suiza.</strong> No somos candidatos, no endosamos a nadie, y ninguna campaña nos paga por cobertura. Mismas preguntas, misma data, mismo trato para todos. Lo que ves aquí ya es público; solo lo pusimos en un solo sitio.</p>
</div>

<div class="not-prose mt-5 bg-teal-900 text-white rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
  <div>
    <p class="font-bold text-base">Este observatorio está vivo. Pregúntale al Veci.</p>
    <p class="text-sm text-teal-100 mt-1">El vecino digital contesta 24/7: quién resuelve qué, qué hay hoy, dónde queda algo. Antes de dar vueltas, escríbele.</p>
  </div>
  <a href="https://wa.me/17874177711?text=CABOROJO" class="shrink-0 bg-coral-500 bg-rose-500 hover:bg-rose-600 text-white font-bold px-5 py-3 rounded-lg text-center">Textea CABOROJO<br><span class="text-xs font-medium opacity-90">al ${PHONE_CTA}</span></a>
</div>

<h2>Lo que de verdad decide cómo se vive aquí: agua, basura, luz, y lo que falta.</h2>
<p>No empezamos por la política ni por los millones. Empezamos por lo que tú vives cada día. Estos cuatro deciden si se vive bien en Cabo Rojo. Lo demás viene después.</p>
<div class="not-prose grid sm:grid-cols-2 gap-3 mt-4">
  <div class="bg-white border border-slate-200 border-l-4 border-l-sky-500 rounded-lg p-4">
    <div class="text-2xl">💧</div>
    <div class="font-bold text-slate-900 mt-1">El agua</div>
    <p class="text-sm text-slate-600 mt-1">El suroeste es la región más seca de PR. El municipio consume 4.4 MGD y nadie ha dicho, por escrito, de dónde sale el agua de Cabo Rojo en los próximos 10 años.</p>
    <p class="text-xs text-teal-700 font-semibold mt-2">¿Se fue el agua? No es el alcalde. Es la AAA: 787-620-2482.</p>
    ${mePasaBtn('agua')}
  </div>
  <div class="bg-white border border-slate-200 border-l-4 border-l-rose-500 rounded-lg p-4">
    <div class="text-2xl">🗑️</div>
    <div class="font-bold text-slate-900 mt-1">La basura</div>
    <p class="text-sm text-slate-600 mt-1">El vertedero tiene los años contados (préstamo de 2020, vida útil de ~10 años). No hay un programa real de reciclaje. La basura se manda a Mayagüez. Hay preguntas de dinero sin contestar (más abajo).</p>
    <p class="text-xs text-teal-700 font-semibold mt-2">Calles, recogido, vertedero: eso sí es la Alcaldía.</p>
    ${mePasaBtn('basura')}
  </div>
  <div class="bg-white border border-slate-200 border-l-4 border-l-amber-500 rounded-lg p-4">
    <div class="text-2xl">💡</div>
    <div class="font-bold text-slate-900 mt-1">La luz</div>
    <p class="text-sm text-slate-600 mt-1">Se va la luz y la gente se molesta con el alcalde. No es él. Es LUMA y el gobierno central. Saber a quién reclamarle es la mitad de resolver.</p>
    <p class="text-xs text-teal-700 font-semibold mt-2">Reporta a LUMA: 1-844-888-5862.</p>
    ${mePasaBtn('luz')}
  </div>
  <div class="bg-white border border-slate-200 border-l-4 border-l-emerald-500 rounded-lg p-4">
    <div class="text-2xl">🌱</div>
    <div class="font-bold text-slate-900 mt-1">Lo que falta</div>
    <p class="text-sm text-slate-600 mt-1">Cosas que el pueblo busca y no encuentra: lavandería, dentista, plomero, grúa. Cada búsqueda sin respuesta es una necesidad real, y muchas veces una oportunidad de negocio que hoy no existe aquí.</p>
    <p class="text-xs text-teal-700 font-semibold mt-2">¿Te falta algo? Dilo aquí abajo.</p>
    ${mePasaBtn('oportunidades')}
  </div>
</div>
${civicSubmitForm({ kind: 'problema', showTopic: true, title: '¿Te falta un problema en esta lista? Añádelo.', sub: 'Tú vives aquí. Si hay algo que duele cada día y no está, escríbelo. Lo revisamos y, si pasa, aparece más abajo con tu palabra.', placeholder: 'Ejemplo: "En mi calle de Joyuda no recogen la basura hace 3 semanas" o "Hace falta una lavandería por el casco".', cta: 'Añadir al observatorio' })}

<h2>Las preguntas del vertedero que nadie ha contestado</h2>
<p>Esto salió en las vistas públicas y sigue sin respuesta. Los números son de récord público.</p>
<div class="not-prose grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
  <div class="bg-slate-100 border border-slate-200 rounded-lg p-3 text-center"><div class="text-xl font-black text-teal-700">$2.2M</div><div class="text-xs text-slate-600 mt-1">préstamo 2020 → ~10 años de vida (vence cerca de 2030)</div></div>
  <div class="bg-rose-50 border border-rose-200 rounded-lg p-3 text-center"><div class="text-xl font-black text-rose-700">-2 años</div><div class="text-xs text-slate-600 mt-1">que el huracán María ya le quitó</div></div>
  <div class="bg-rose-50 border border-rose-200 rounded-lg p-3 text-center"><div class="text-xl font-black text-rose-700">$149K</div><div class="text-xs text-slate-600 mt-1">en un "smart city" abandonado (Contralor OC-24-04)</div></div>
  <div class="bg-rose-50 border border-rose-200 rounded-lg p-3 text-center"><div class="text-xl font-black text-rose-700">12</div><div class="text-xs text-slate-600 mt-1">vertederos que el DRNA cierra en PR (2025-2027)</div></div>
</div>
<div class="not-prose mt-4 bg-white border border-slate-200 border-l-4 border-l-rose-500 rounded-lg p-4">
  <p class="font-bold text-slate-900 mb-2">Las 4 preguntas que el pueblo merece que le contesten, por escrito:</p>
  <ol class="list-decimal pl-5 text-sm text-slate-700 space-y-2">
    <li>Si al vertedero le quedan unos 10 años, <strong>¿cuántos años de vida le quita</strong> la basura nueva que se le sume encima?</li>
    <li>Cuando se llene o lo cierren, <strong>¿quién paga para sacar la basura del pueblo</strong> y cuánto nos cuesta a nosotros?</li>
    <li><strong>¿Ya hay un plan?</strong> ¿Se quema basura, se recicla de verdad (vidrio incluido), o se tapa el hoyo hasta que reviente?</li>
    <li>El agua y la luz tampoco están resueltas (la AAA no confirmó capacidad, la AEE/LUMA no evaluó la demanda). <strong>¿Por qué se aprueba algo cuyos servicios básicos nadie ha garantizado?</strong></li>
  </ol>
</div>

<h3>Tres cosas más del vertedero que casi nadie explica</h3>
<div class="not-prose grid sm:grid-cols-3 gap-3 mt-3">
  <div class="bg-white border border-slate-200 rounded-lg p-4">
    <div class="font-bold text-slate-900">El reciclaje</div>
    <p class="text-sm text-slate-600 mt-1">No hay un programa real. El vidrio, sobre todo, no tiene a dónde ir. La pregunta no es "¿reciclamos?", es "¿dónde está el plan escrito, con fechas?".</p>
  </div>
  <div class="bg-white border border-slate-200 rounded-lg p-4">
    <div class="font-bold text-slate-900">El doble gasto</div>
    <p class="text-sm text-slate-600 mt-1">El municipio tiene sus propias guaguas y excavadoras, Y manda la basura a Mayagüez como "centro de transbordo". ¿Cuánto cuesta cada parte, y por qué se paga dos veces por mover la misma basura? Es récord público. Se pide.</p>
  </div>
  <div class="bg-white border border-slate-200 rounded-lg p-4">
    <div class="font-bold text-slate-900">El patrón</div>
    <p class="text-sm text-slate-600 mt-1">En PR, la basura es donde más fraude ha hallado el Contralor en muchos municipios. En Cabo Rojo, el informe OC-24-04 ya halló el vertedero operando sin plan, sin emergencia y sin seguro; el contrato terminó tras declararse culpable el presidente del operador de delitos federales. Récord, no acusación.</p>
  </div>
</div>
<p class="text-xs text-slate-500 mt-3">Fuentes: El Vocero / Metro (préstamo $2.2M, 2020) · El Diario / DRNA (cierre de 12 vertederos) · Contralor de PR (OC-24-04) · CaboRojo.com y CPI (testimonio en vistas).</p>

<h2>La lista de problemas de Cabo Rojo</h2>
<p><strong>Esto es el cruce de dos fuentes.</strong> A la izquierda, el récord público: fondos, FEMA, infraestructura. A la derecha, lo que la gente le busca de verdad al Veci *7711 (9,016 búsquedas reales, dic 2025 a jun 2026). Un periódico tiene la primera. Casi nadie tiene la segunda. Juntas dan la foto completa: el problema no es que alguien lo diga, es que el pueblo lo busca Y consta en récord.</p>
<div class="not-prose grid md:grid-cols-2 gap-4 mt-4">
  <div class="bg-white border border-slate-200 rounded-lg p-4">
    <div class="text-xs font-bold text-rose-700 uppercase tracking-wide mb-2">Fuente 1 · Récord público (infraestructura y dinero)</div>
    <ul class="text-sm text-slate-700 space-y-2">
      <li><strong>Agua:</strong> el suroeste es la región más seca; el municipio consume 4.4 MGD. <span class="text-rose-600 font-semibold">crítico</span></li>
      <li><strong>Coliseo Rebekah Colberg:</strong> $5.2M de FEMA, límite de uso 20 sept 2026.</li>
      <li><strong>Isla Ratones:</strong> ~$735K de FEMA se devuelven; el cayo se hundió en 2020.</li>
      <li><strong>Faro Los Morrillos:</strong> cerrado "hasta nuevo aviso" por María y Fiona.</li>
      <li><strong>Sargazo</strong> recurrente en Combate, Boquerón y Playa Sucia.</li>
      <li><strong>Recuperación federal:</strong> índice de ejecución sobre 96%.</li>
    </ul>
  </div>
  <div class="bg-white border border-slate-200 rounded-lg p-4">
    <div class="text-xs font-bold text-teal-700 uppercase tracking-wide mb-2">Fuente 2 · Lo que el vecino busca y no encuentra (*7711)</div>
    <ul class="text-sm text-slate-700 space-y-2">
      <li>"¿Quién es el alcalde?" · "número de la policía municipal" <span class="text-rose-600 font-semibold">sin respuesta</span></li>
      <li>"¿Cuándo recogen la basura?" (Joyuda, Las Ramírez, Villa del Carmen)</li>
      <li>"Se fue el agua" · "se fue la luz" · "carretera de Reparto Samán"</li>
      <li>"¿Cómo saco un permiso de construcción?"</li>
      <li>Servicios sin suficiente oferta: lavandería, dentista, plomero, grúa</li>
      <li>Categoría GOBIERNO: <strong>80%</strong> de las búsquedas sin contestar</li>
    </ul>
  </div>
</div>
<blockquote class="text-sm">Nota de integridad: tres búsquedas cívicas aparecían con 89 cada una; al auditar resultaron ser data de prueba (2 usuarios, ventana cerrada). Las excluimos. Si un dato no se puede verificar, no entra.</blockquote>

<h2>Lo que el pueblo añadió</h2>
<p>Esto no lo escribimos nosotros. Lo añadieron vecinos como tú y un humano lo revisó antes de publicarlo. Si lo tuyo no está aquí todavía, súbelo con el botón de más arriba.</p>
${renderPuebloAdd(puebloAddRows || [])}

<h2>¿Quién nos representa? ¿Y qué le toca a cada uno?</h2>
<p class="text-sm text-slate-600">Ficha neutral, récord público. Cada uno tiene su trabajo. Si sabes qué le toca a cada quién, sabes a quién pedirle cuentas. Aún no hay candidatos declarados para 2028: cuando los haya, reciben la misma ficha y el mismo examen.</p>
<div class="not-prose grid sm:grid-cols-3 gap-3 mt-3">
  <div class="bg-white border border-slate-200 rounded-lg p-4">
    <div class="text-xs text-slate-500 uppercase font-bold">Alcalde · Cabo Rojo</div>
    <div class="font-bold text-slate-900 mt-1">Jorge A. Morales Wiscovitch</div>
    <span class="inline-block text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded mt-1">PNP</span>
    <p class="text-xs text-slate-600 mt-2">Desde ene 2021 · 2 términos · hasta ene 2029.</p>
    <div class="mt-2 text-xs bg-slate-50 border border-slate-200 rounded p-2"><strong class="text-teal-700">Qué le toca:</strong> lo de adentro del pueblo. Basura, calles del pueblo, permisos, vertedero, policía municipal y el presupuesto del municipio.</div>
    <a href="https://consultacontratos.ocpr.gov.pr/" target="_blank" rel="noopener" class="text-xs text-teal-700 font-semibold mt-2 inline-block">Ver contratos del municipio →</a>
  </div>
  <div class="bg-white border border-slate-200 rounded-lg p-4">
    <div class="text-xs text-slate-500 uppercase font-bold">Representante · Distrito 20</div>
    <div class="font-bold text-slate-900 mt-1">Emilio Carlo Acosta</div>
    <span class="inline-block text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded mt-1">PNP</span>
    <p class="text-xs text-slate-600 mt-2">Desde ene 2025. Distrito 20 = Cabo Rojo + Hormigueros + San Germán.</p>
    <div class="mt-2 text-xs bg-slate-50 border border-slate-200 rounded p-2"><strong class="text-teal-700">Qué le toca:</strong> hacer leyes y conseguir dinero (asignaciones) para el distrito desde la Cámara, en San Juan. No recoge basura: eso es del alcalde.</div>
    <a href="https://www.camara.pr.gov/team/emilio-carlo/" target="_blank" rel="noopener" class="text-xs text-teal-700 font-semibold mt-2 inline-block">Su página en la Cámara →</a>
  </div>
  <div class="bg-white border border-slate-200 rounded-lg p-4">
    <div class="text-xs text-slate-500 uppercase font-bold">Senadores · Distrito IV</div>
    <div class="font-bold text-slate-900 mt-1">Jeison Rosa Ramos · Karen M. Román Rodríguez</div>
    <span class="inline-block text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded mt-1">PNP</span>
    <p class="text-xs text-slate-600 mt-2">Juramentaron ene 2025 · hasta ene 2029. El distrito cubre 12 pueblos del oeste, incluido Cabo Rojo.</p>
    <div class="mt-2 text-xs bg-slate-50 border border-slate-200 rounded p-2"><strong class="text-teal-700">Qué le toca:</strong> lo mismo que el representante, pero en el Senado: leyes y fondos para los 12 pueblos del oeste.</div>
    <a href="https://senado.pr.gov/index.cfm?module=senadores" target="_blank" rel="noopener" class="text-xs text-teal-700 font-semibold mt-2 inline-block">Directorio del Senado →</a>
  </div>
</div>

<h2>El Promesómetro</h2>
<p><strong>Esto no lo dijo un periódico. Lo dijo el alcalde, él mismo, en cámara.</strong> Lo guardamos con fecha y video. No se borra. Aquí se ve qué prometió y qué pasó.</p>

<div class="not-prose mt-4 bg-white border border-slate-200 border-l-4 border-l-teal-600 rounded-lg p-4">
  <p class="text-sm text-slate-700"><strong class="text-teal-700">¿Alcalde, esto ya está hecho?</strong> Dilo, con prueba, y lo marcamos <strong>HECHO</strong> el mismo día. ¿No se ha hecho? Dinos cuándo. Esto no es para pelear. Es para que el pueblo sepa. La pelota está en tu cancha.</p>
</div>

<p class="text-sm text-slate-600 mt-4">Cómo leer la última columna: <span class="font-bold text-emerald-700">✅ HECHO</span> · <span class="font-bold text-amber-600">🟡 EMPEZÓ</span> · <span class="font-bold text-rose-600">❌ NO</span> · <span class="font-bold text-slate-500">⏳ SIN CONTESTAR</span></p>
<table>
<thead><tr><th>Lo que se prometió o se dijo</th><th>Quién · cuándo</th><th>Míralo tú mismo</th><th>¿Y?</th></tr></thead>
<tbody>
${renderPromesometroRows(PROMESAS_CABOROJO)}
</tbody>
</table>
<p class="text-xs text-slate-500">Las citas en cámara salen de entrevistas públicas de CaboRojo.com con el alcalde (2023-2024). El video y el minuto exacto están en el archivo; se enlazan a medida que se confirman. Récord, no acusación: cada quien puede ver la entrevista completa y juzgar.</p>

<div class="not-prose mt-4">
  <a href="/promesas" class="inline-block bg-teal-700 hover:bg-teal-800 text-white font-bold px-5 py-3 rounded-lg">Ver las 60+ cosas que el alcalde dijo en cámara, tema por tema →</a>
</div>

<h2>Verifícalo tú mismo</h2>
<p>No tienes que creernos a nosotros ni a ningún político. El gobierno ya tiene estas herramientas públicas y gratuitas. Casi nadie sabe que existen.</p>
<div class="not-prose grid md:grid-cols-2 gap-4 mt-3">
  <div class="bg-teal-50 border border-teal-200 rounded-lg p-4">
    <div class="font-bold text-teal-900">¿A quién le paga el municipio?</div>
    <p class="text-sm text-slate-700 mt-1">El Registro de Contratos del Contralor te deja buscar todos los contratos del Municipio de Cabo Rojo: a quién, cuánto, por qué, y si fue a subasta o "de emergencia".</p>
    <a href="https://consultacontratos.ocpr.gov.pr/" target="_blank" rel="noopener" class="inline-block mt-2 bg-teal-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Buscar contratos →</a>
    <p class="text-xs text-slate-500 mt-2">Entra → "Entidad" → "Municipio de Cabo Rojo" → filtra por monto, fecha o método de compra.</p>
  </div>
  <div class="bg-teal-50 border border-teal-200 rounded-lg p-4">
    <div class="font-bold text-teal-900">¿Viste algo que no cuadra?</div>
    <p class="text-sm text-slate-700 mt-1">El sistema "Queréllese" del Contralor recibe querellas sobre mal uso de fondos, compras irregulares o empleados fantasma. Hay protección al que informa.</p>
    <a href="https://querellas.ocpr.gov.pr/" target="_blank" rel="noopener" class="inline-block mt-2 bg-teal-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Presentar querella →</a>
    <p class="text-xs text-slate-500 mt-2">querellas@ocpr.gov.pr · 1-877-771-3133. El Contralor ya auditó a Cabo Rojo (OC-24-04, OC-24-29).</p>
  </div>
</div>
<div class="not-prose mt-4 bg-white border border-slate-200 border-l-4 border-l-rose-500 rounded-lg p-4">
  <div class="text-xs font-bold text-rose-700 uppercase tracking-wide mb-2">Lo que el Contralor ya encontró · récord público</div>
  <ul class="text-sm text-slate-700 space-y-2">
    <li><strong>Vertedero sin plan ni seguro:</strong> el informe <strong>OC-24-04</strong> halló que el vertedero operaba sin plan operacional, sin procedimientos de emergencia y sin seguro de responsabilidad pública. El contrato se terminó luego de que el presidente del operador se declarara culpable de delitos federales.</li>
    <li><strong>$149,431</strong> en un proyecto "smart city" que se abandonó (OC-24-04).</li>
    <li><strong>$17,625</strong> en pago de vacaciones a un exalcalde por días que, por ley, debieron perderse (OC-24-04).</li>
    <li>¿Quieres el detalle completo, incluido lo que el Contralor encontró sobre pagos y demandas? Busca los informes <strong>OC-24-04</strong> y <strong>OC-24-29</strong> en <a href="https://www.ocpr.gov.pr/" target="_blank" rel="noopener">ocpr.gov.pr</a>. Todo es récord público.</li>
  </ul>
</div>
<blockquote class="text-sm">"Opinión cualificada" no es lo peor (eso sería "adversa"): el Contralor encontró incumplimientos importantes pero no generalizados. Récord público, no acusación, con el número de informe para que lo verifiques tú. El nepotismo y la empleomanía política son un patrón de todo Puerto Rico, no de un pueblo ni de una persona.</blockquote>

<h2>Los problemas de todos los días</h2>
<p>No todo es Esencia y millones. Estos son los que tocan al vecino cada día. Cada uno con la verdad de fondo y a quién se le reporta. No es para pelear: es para resolver.</p>
<div class="not-prose grid sm:grid-cols-2 gap-3 mt-4">
  <div class="bg-white border border-slate-200 rounded-lg p-4">
    <div class="text-2xl">🔊</div>
    <div class="font-bold text-slate-900 mt-1">Ruido y música a todo volumen</div>
    <div class="text-sm text-slate-600 mt-1">La paz también es un derecho. Hay ordenanza municipal de ruido.</div>
    <div class="mt-2 text-xs bg-teal-50 border border-teal-200 rounded p-2"><strong>Reporta a:</strong> Policía Municipal · <a href="tel:7878511025">787-851-1025</a></div>
  </div>
  <div class="bg-white border border-slate-200 rounded-lg p-4">
    <div class="text-2xl">🐕</div>
    <div class="font-bold text-slate-900 mt-1">Animales realengos en la calle</div>
    <div class="text-sm text-slate-600 mt-1">No es culpa del perro. Es de quien lo suelta. La solución de fondo es esterilizar.</div>
    <div class="mt-2 text-xs bg-teal-50 border border-teal-200 rounded p-2"><strong>Reporta a:</strong> el municipio · <a href="tel:7878511025">787-851-1025</a> · o pregúntale al Veci quién esteriliza</div>
  </div>
  <div class="bg-white border border-slate-200 rounded-lg p-4">
    <div class="text-2xl">🗑️</div>
    <div class="font-bold text-slate-900 mt-1">Vertederos clandestinos (basura tirada)</div>
    <div class="text-sm text-slate-600 mt-1">El que ensucia y el que limpia viven en el mismo pueblo. Tiene quién lo recoja.</div>
    <div class="mt-2 text-xs bg-teal-50 border border-teal-200 rounded p-2"><strong>Reporta a:</strong> Control Ambiental del municipio (querellavirtual) · daño grande al ambiente: DRNA</div>
  </div>
  <div class="bg-white border border-slate-200 rounded-lg p-4">
    <div class="text-2xl">🕳️</div>
    <div class="font-bold text-slate-900 mt-1">Hoyos y poca luz en las calles</div>
    <div class="text-sm text-slate-600 mt-1">Calles del pueblo: las arregla Obras Públicas. Carreteras grandes (PR-100, 307): el estado.</div>
    <div class="mt-2 text-xs bg-teal-50 border border-teal-200 rounded p-2"><strong>Reporta a:</strong> calle del pueblo → municipio <a href="tel:7878511025">787-851-1025</a> · carretera grande → <a href="tel:311">311</a></div>
  </div>
  <div class="bg-white border border-slate-200 rounded-lg p-4">
    <div class="text-2xl">🚗</div>
    <div class="font-bold text-slate-900 mt-1">Carros abandonados en sitios públicos</div>
    <div class="text-sm text-slate-600 mt-1">Es espacio de todos que se pierde. Se puede remover.</div>
    <div class="mt-2 text-xs bg-teal-50 border border-teal-200 rounded p-2"><strong>Reporta a:</strong> Policía Municipal · <a href="tel:7878511025">787-851-1025</a> (toma foto y anota dónde)</div>
  </div>
  <div class="bg-slate-900 text-white rounded-lg p-4 flex flex-col justify-center">
    <div class="text-sm font-bold">¿No sabes a quién se reporta lo tuyo?</div>
    <div class="text-sm text-slate-300 mt-1">Pregúntale al Veci: textea <strong>CABOROJO al ${PHONE_CTA}</strong> y te dice quién resuelve.</div>
  </div>
</div>
${civicSubmitForm({ kind: 'problema', showTopic: true, title: '¿Hay otro problema de todos los días que falta aquí?', sub: 'Ruido, un poste sin luz, una esquina peligrosa, un servicio que no existe. Dilo en tus palabras.', placeholder: 'Cuéntalo: qué es, dónde, y desde cuándo.', cta: 'Reportarlo' })}

<h2>¿Quién arregla qué? Para que no le grites al que no es.</h2>
<p>Mucha gente se molesta con el alcalde por algo que le toca a LUMA. O con el representante por algo del municipio. Aquí está, fácil, a quién le toca cada cosa.</p>
<p class="text-sm text-slate-600 mt-1">Y debajo de cada uno, <strong>cómo hacerlo</strong>: el número o la página donde se reporta. Guárdalo.</p>
<div class="not-prose grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
  <div class="bg-white border border-slate-200 rounded-lg p-4"><div class="text-2xl">🗑️</div><div class="font-bold text-slate-900 mt-1">Basura, calles del pueblo, permisos, vertedero</div><div class="text-sm text-teal-700 font-semibold mt-1">→ La Alcaldía</div><div class="text-xs text-slate-500 mt-1">El que recoge y arregla dentro del pueblo.</div><div class="mt-2 text-xs bg-teal-50 border border-teal-200 rounded p-2"><strong>Cómo:</strong> querellavirtual en el municipio · o llama al <a href="tel:7878511025">787-851-1025</a></div></div>
  <div class="bg-white border border-slate-200 rounded-lg p-4"><div class="text-2xl">💧</div><div class="font-bold text-slate-900 mt-1">"Se fue el agua", tubería, baja presión</div><div class="text-sm text-teal-700 font-semibold mt-1">→ La AAA</div><div class="text-xs text-slate-500 mt-1">NO es el alcalde. Es la Autoridad de Acueductos.</div><div class="mt-2 text-xs bg-teal-50 border border-teal-200 rounded p-2"><strong>Cómo:</strong> reporta la avería al <a href="tel:7876202482">787-620-2482</a> (6am-11pm) o en <a href="https://www.acueductos.pr.gov" target="_blank" rel="noopener">acueductos.pr.gov</a></div></div>
  <div class="bg-white border border-slate-200 rounded-lg p-4"><div class="text-2xl">💡</div><div class="font-bold text-slate-900 mt-1">"Se fue la luz", postes, alumbrado</div><div class="text-sm text-teal-700 font-semibold mt-1">→ LUMA</div><div class="text-xs text-slate-500 mt-1">NO es el alcalde. Es LUMA y el gobierno central.</div><div class="mt-2 text-xs bg-teal-50 border border-teal-200 rounded p-2"><strong>Cómo:</strong> reporta a LUMA al <a href="tel:18448885862">1-844-888-5862</a></div></div>
  <div class="bg-white border border-slate-200 rounded-lg p-4"><div class="text-2xl">🛣️</div><div class="font-bold text-slate-900 mt-1">Carreteras grandes (PR-100, PR-307)</div><div class="text-sm text-teal-700 font-semibold mt-1">→ DTOP</div><div class="text-xs text-slate-500 mt-1">Las del estado. Las calles chiquitas sí son del pueblo.</div><div class="mt-2 text-xs bg-teal-50 border border-teal-200 rounded p-2"><strong>Cómo:</strong> línea de gobierno <a href="tel:311">311</a> · o pregúntale al Veci cuál carretera es de quién</div></div>
  <div class="bg-white border border-slate-200 rounded-lg p-4"><div class="text-2xl">💵</div><div class="font-bold text-slate-900 mt-1">Fondos y leyes para el distrito</div><div class="text-sm text-teal-700 font-semibold mt-1">→ Representante y Senadores</div><div class="text-xs text-slate-500 mt-1">Los que consiguen dinero en San Juan para acá.</div><div class="mt-2 text-xs bg-teal-50 border border-teal-200 rounded p-2"><strong>Cómo:</strong> <a href="https://www.camara.pr.gov" target="_blank" rel="noopener">camara.pr.gov</a> · <a href="https://senado.pr.gov" target="_blank" rel="noopener">senado.pr.gov</a></div></div>
  <div class="bg-white border border-slate-200 rounded-lg p-4"><div class="text-2xl">🌊</div><div class="font-bold text-slate-900 mt-1">Permisos de ambiente y costa (Esencia)</div><div class="text-sm text-teal-700 font-semibold mt-1">→ OGPe · DRNA · Junta de Planificación</div><div class="text-xs text-slate-500 mt-1">Agencias del estado. El municipio opina, pero no decide solo.</div><div class="mt-2 text-xs bg-teal-50 border border-teal-200 rounded p-2"><strong>Cómo:</strong> mira o comenta el caso en <a href="https://ogpe.pr.gov" target="_blank" rel="noopener">ogpe.pr.gov</a></div></div>
</div>
<p class="mt-4">¿No sabes a quién le toca tu caso? Pregúntale al Veci: textea <strong>CABOROJO al ${PHONE_CTA}</strong> y te dice quién resuelve.</p>

<h2>La pregunta que casi nadie hace: ¿cuánta gente trabaja para el municipio?</h2>
<p>No es chisme. Es la pregunta de dinero más grande de cualquier municipio: la nómina es casi siempre el gasto número uno. Y es récord público.</p>
<div class="not-prose mt-3 bg-white border border-slate-200 border-l-4 border-l-amber-500 rounded-lg p-4">
  <ul class="text-sm text-slate-700 space-y-2">
    <li><strong>El dato que se puede pedir:</strong> cuántos empleados tiene el municipio, cuánto del presupuesto es nómina, y cuántos puestos son de confianza (los que el alcalde nombra) vs de carrera. Eso sale del presupuesto municipal, que es público.</li>
    <li><strong>Lo que el propio alcalde dijo en cámara:</strong> que las "damas de llaves" pasaron de 22 a cerca de 90. Más gente ayudando, sí, pero también más nómina. La pregunta justa: ¿de dónde sale ese dinero todos los años?</li>
    <li><strong>El patrón de PR:</strong> el Contralor llama "empleomanía política" a llenar el municipio de gente por favor político. No es de un pueblo ni de una persona, es de toda la isla. Por eso se mira con número, no con corazonada.</li>
  </ul>
  <p class="text-xs text-slate-500 mt-2">Récord, no acusación. Si el municipio publica su nómina y su presupuesto claritos, esta pregunta se contesta sola.</p>
</div>

<h2>El examen de Cabo Rojo</h2>
<p>Estas preguntas salen de la data, no de un partido. Cualquiera que aspire a la alcaldía o a representarnos en el Distrito 20 las va a tener que contestar, en sus propias palabras. Las mismas para todos. El que conteste, queda en récord. El que no, también.</p>
<ol>
<li>¿De dónde sale el agua para Cabo Rojo en los próximos 10 años?</li>
<li>El vertedero tiene los años contados. ¿Cuál es tu plan de basura, reciclaje y costos, por escrito?</li>
<li>Cuando se va la luz, ¿qué haces tú desde el municipio para que el vecino no quede solo frente a LUMA?</li>
<li>¿Qué oportunidad nueva traes para que la gente joven no tenga que irse del pueblo a buscar trabajo?</li>
<li>¿Cuánta es la nómina del municipio y cómo la haces sostenible sin botar gente?</li>
<li>¿Cómo vas a publicar el presupuesto y los contratos para que cualquier vecino los vea sin pedir permiso?</li>
<li>¿Qué pasa con los $5.2M del Coliseo si no se usan antes del 20 de septiembre de 2026?</li>
<li>¿Apoyas a Esencia como está, lo rechazas, o bajo qué condiciones? Sé específico.</li>
</ol>

<h2>Esencia: por qué sigue en esta página</h2>
<p>No la ponemos como proyecto de playa ni como pelea de ricos contra pobres. La ponemos por una sola razón concreta: <strong>se come el agua y el vertedero que ya están apretados.</strong> Mientras eso no esté resuelto por escrito, es parte de la lista de problemas. Cuando entre en ley con sus condiciones cumplidas, se mira distinto.</p>
<div class="not-prose grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
  <div class="bg-rose-50 border border-rose-200 rounded-lg p-3 text-center"><div class="text-2xl font-black text-rose-700">~3 MGD</div><div class="text-xs text-slate-600 mt-1">de agua: más de 1/3 de lo que consume todo el municipio</div></div>
  <div class="bg-rose-50 border border-rose-200 rounded-lg p-3 text-center"><div class="text-2xl font-black text-rose-700">+30 ton</div><div class="text-xs text-slate-600 mt-1">de basura al día encima del vertedero (testimonio en vistas)</div></div>
  <div class="bg-slate-100 border border-slate-200 rounded-lg p-3 text-center"><div class="text-2xl font-black text-teal-700">Sept 2025</div><div class="text-xs text-slate-600 mt-1">el DRNA rechazó el diseño por daño a especies protegidas</div></div>
  <div class="bg-slate-100 border border-slate-200 rounded-lg p-3 text-center"><div class="text-2xl font-black text-teal-700">24 dic 2025</div><div class="text-xs text-slate-600 mt-1">OGPe aprobó la Declaración de Impacto con 46 condiciones</div></div>
</div>
<div class="not-prose mt-4 bg-slate-900 rounded-lg p-4">
  <div class="text-xs font-bold text-teal-300 uppercase tracking-wide mb-2">🎬 Míralo tú mismo · no nos creas a nosotros</div>
  <div class="flex flex-col gap-2 text-sm">
    <a href="https://youtu.be/Fv8WCuov9lA" target="_blank" rel="noopener" class="text-white hover:text-teal-300">▶ El geólogo que se atrevió a decir la verdad sobre Esencia</a>
    <a href="https://youtu.be/UGyOSEhGRsU" target="_blank" rel="noopener" class="text-white hover:text-teal-300">▶ Proyecto Esencia: ¿Progreso o Peligro para Cabo Rojo?</a>
    <a href="https://youtu.be/NFeo3v07rHA" target="_blank" rel="noopener" class="text-white hover:text-teal-300">▶ Por qué la AAA no contesta sobre el agua de Esencia</a>
  </div>
</div>
<p class="text-sm text-slate-600 mt-3"><strong>Cómo verificarlo tú mismo, sin que nadie te lo señale:</strong> quién es el representante legal de un proyecto es récord público (consta en los documentos del caso). Quién le hace campaña a quién, también. Cruza esos dos datos y los conflictos de interés aparecen solos. No señalamos a nadie: te enseñamos dónde mirar.</p>
<p class="text-xs text-slate-500 mt-2">Fuentes: Centro de Periodismo Investigativo (2025) · El Nuevo Día (dic 2025) · Marea Ecologista (sept 2025) · entrevistas en video de CaboRojo.com.</p>

<blockquote>Yo no escojo. Yo organizo. Le doy a todos el mismo espejo, con número, fecha y fuente. Si esto te ayuda a entender mejor tu pueblo, llégate. Si no, sigue tu camino. Pero que nadie diga que no había dónde mirar.</blockquote>

<h3>Fuentes principales</h3>
<p class="text-xs text-slate-500">
<a href="https://periodismoinvestigativo.com/2025/10/esencia-residential-project-tax-breaks-puerto-rico/" target="_blank" rel="noopener">CPI — créditos contributivos Esencia</a> ·
<a href="https://www.elnuevodia.com/noticias/locales/notas/avanza-esencia-ogpe-aprueba-declaracion-de-impacto-ambiental-del-megaproyecto-en-cabo-rojo/" target="_blank" rel="noopener">El Nuevo Día — OGPe aprueba DIA</a> ·
<a href="https://mareaecologista.com/2025/04/cabo-rojo-el-proyecto-esencia-y-la-crisis-del-agua-en-el-suroeste/" target="_blank" rel="noopener">Marea Ecologista — crisis del agua</a> ·
<a href="https://noticel.com/en/ultima-hora/20260505/fema-aprueba-extension-de-tiempo-para-ejecucion-de-mas-de-570-proyectos/" target="_blank" rel="noopener">NotiCel — Coliseo $5.2M / FEMA</a> ·
<a href="https://www.primerahora.com/noticias/puerto-rico/notas/a-la-deriva-isla-ratones-se-ahoga-su-reconstruccion/" target="_blank" rel="noopener">Primera Hora — Isla Ratones</a> ·
<a href="https://www.camara.pr.gov/representante/" target="_blank" rel="noopener">Cámara — Distrito 20</a> ·
<a href="https://consultacontratos.ocpr.gov.pr/" target="_blank" rel="noopener">Contralor — Registro de Contratos</a>
</p>
${CIVIC_FORM_SCRIPT}
`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Dataset', name: 'Lista de problemas reales de Cabo Rojo', description: 'Demanda ciudadana real (9,016 búsquedas al asistente vecinal *7711) cruzada con el récord público de fondos, recuperación e infraestructura del municipio de Cabo Rojo.', creator: { '@type': 'Organization', name: 'mapadecaborojo.com' }, spatialCoverage: { '@type': 'Place', name: 'Cabo Rojo, Puerto Rico' }, isAccessibleForFree: true },
      { '@type': 'FAQPage', mainEntity: [
        { '@type': 'Question', name: '¿En qué distrito representativo está Cabo Rojo?', acceptedAnswer: { '@type': 'Answer', text: 'Cabo Rojo está en el Distrito Representativo 20, junto a Hormigueros y San Germán. El representante actual es Emilio Carlo Acosta (PNP), desde enero de 2025.' } },
        { '@type': 'Question', name: '¿Quién es el alcalde de Cabo Rojo?', acceptedAnswer: { '@type': 'Answer', text: 'Jorge A. Morales Wiscovitch (PNP), en el cargo desde enero de 2021, con término hasta enero de 2029.' } },
        { '@type': 'Question', name: '¿Qué es el proyecto Esencia en Cabo Rojo?', acceptedAnswer: { '@type': 'Answer', text: 'Un megaproyecto turístico-residencial de unos $2,000 millones en la costa entre Boquerón y Combate, con ~$498 millones en créditos contributivos. El DRNA lo rechazó en septiembre de 2025; OGPe aprobó su Declaración de Impacto Ambiental con 46 condiciones el 24 de diciembre de 2025.' } },
        { '@type': 'Question', name: '¿Cómo puedo ver los contratos del municipio de Cabo Rojo?', acceptedAnswer: { '@type': 'Answer', text: 'En el Registro de Contratos del Contralor de Puerto Rico (consultacontratos.ocpr.gov.pr), gratis y sin cuenta. Busca por la entidad Municipio de Cabo Rojo.' } }
      ] }
    ]
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800')
  res.status(200).send(layout({
    title: 'Observatorio Cívico de Cabo Rojo',
    description: 'La lista verificada de los problemas reales de Cabo Rojo: Esencia, el agua, el vertedero, el Coliseo, el Faro. Con número, fecha y fuente. Para que el que aspire a representarnos conteste lo que el pueblo necesita. No-partidista.',
    slug: 'observatorio',
    bodyHtml: body,
    jsonLd,
    ogImage: '/og/observatorio.png',
  }))
}

// =============== HANDLER ===============

// =============== /quien-responde — El Organigrama Vivo de Cabo Rojo ===============
// La capa de ESTRUCTURA: quién te representa, de qué responde por ley, y cómo lo
// contactas. La rabia se vuelve ruteo. Enlaza a /promesas (el Promesómetro) para
// el scorecard del alcalde. Lee de la RPC get_quien_responde() (candados en RLS).
// No-partidista. Reanclado 2026-06-20.
const NIVEL_GRUPOS: Array<{ nivel: string; titulo: string; sub: string }> = [
  { nivel: 'municipal', titulo: '🏛️ En tu municipio', sub: 'Lo que tocas todos los días.' },
  { nivel: 'estatal', titulo: '🇵🇷 En el gobierno de Puerto Rico', sub: 'Los que votas pero casi no ves.' },
  { nivel: 'no_electo', titulo: '⚡ Los que mandan sin que los votes', sub: 'No los eliges, pero responden por tu agua, tu luz, tu costa. Aquí vive la mayoría de la rabia diaria.' },
  { nivel: 'federal', titulo: '🇺🇸 Federal', sub: 'Lo que mucha gente cree que es del municipio, y no lo es.' },
]
const PESTADO: Record<string, [string, string]> = {
  cumplido:   ['✅ Cumplió', '#059669'],
  en_proceso: ['🟡 En proceso', '#d97706'],
  vencido:    ['❌ No cumplió', '#e11d48'],
  pendiente:  ['⏳ Sin verificar', '#64748b'],
}
function qrYear(desde: string | null): string {
  if (!desde) return ''
  const y = String(desde).slice(0, 4)
  return /^\d{4}$/.test(y) ? `desde ${y}` : ''
}
function qrPromesaRow(p: any): string {
  const [label, color] = PESTADO[p.estado] || PESTADO.pendiente
  return `<div style="padding:0.6rem 0;border-top:1px solid #f1f5f9;">
    <p style="font-size:0.9rem;color:#0f172a;font-weight:600;margin:0 0 2px;">${escapeHtml(p.promesa)}</p>
    <p style="font-size:0.8rem;margin:0 0 4px;"><strong style="color:${color}">${label}</strong>${p.que_paso ? ' · <span style="color:#475569;">' + escapeHtml(p.que_paso) + '</span>' : ''}</p>
    ${p.fuente ? `<p style="font-size:0.72rem;color:#94a3b8;margin:0;">Fuente: <a href="${escapeHtml(p.fuente)}" target="_blank" rel="noopener" style="color:#0d9488;">${escapeHtml(String(p.fuente).replace(/^https?:\/\/(www\.)?/, '').split('/')[0])}</a> · récord en cámara ${p.fecha ? '(' + escapeHtml(String(p.fecha)) + ')' : ''}</p>` : ''}
  </div>`
}
function qrCard(c: any): string {
  const sc = c.scorecard || { total: 0 }
  const scoreBadge = sc.total > 0
    ? `<div style="text-align:right;flex-shrink:0;">
        <div style="font-size:0.72rem;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;font-weight:700;">Promesas verificadas</div>
        <div style="font-size:0.85rem;margin-top:2px;">
          ${sc.cumplido ? `<span style="color:#059669;font-weight:700;">${sc.cumplido} ✅</span> ` : ''}
          ${sc.en_proceso ? `<span style="color:#d97706;font-weight:700;">${sc.en_proceso} 🟡</span> ` : ''}
          ${sc.vencido ? `<span style="color:#e11d48;font-weight:700;">${sc.vencido} ❌</span>` : ''}
        </div>
      </div>`
    : ''
  const promesasHtml = (Array.isArray(c.promesas) && c.promesas.length > 0)
    ? `<div style="margin-top:0.9rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:0.75rem 1rem;">
        <p style="font-size:0.75rem;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.04em;margin:0;">Qué dijo en cámara · qué pasó</p>
        ${c.promesas.map(qrPromesaRow).join('')}
        <a href="/promesas" style="display:inline-block;margin-top:0.6rem;font-size:0.82rem;font-weight:700;color:#0d9488;text-decoration:none;">Ver todo lo que prometió en cámara →</a>
      </div>`
    : ''
  const accionHtml = c.accion_vecino
    ? `<div style="margin-top:0.85rem;background:#ecfeff;border-left:3px solid #14b8a6;border-radius:0 8px 8px 0;padding:0.65rem 0.9rem;">
        <p style="font-size:0.72rem;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 2px;">Una acción</p>
        <p style="font-size:0.88rem;color:#134e4a;margin:0;">${escapeHtml(c.accion_vecino)}</p>
        ${c.contacto_tel ? `<a href="tel:${escapeHtml(c.contacto_tel)}" style="display:inline-block;margin-top:6px;font-size:0.85rem;font-weight:700;color:#0d9488;text-decoration:none;">📞 ${escapeHtml(c.contacto_tel)}</a>` : ''}
        ${c.contacto_web ? `${c.contacto_tel ? ' · ' : ''}<a href="${escapeHtml(c.contacto_web)}" target="_blank" rel="noopener" style="font-size:0.85rem;font-weight:700;color:#0d9488;text-decoration:none;">🌐 sitio oficial</a>` : ''}
      </div>`
    : ''
  const persona = c.nombre
    ? `<p style="font-size:0.85rem;color:#475569;margin:2px 0 0;">${escapeHtml(c.nombre)}${c.partido ? ` · <span style="font-weight:600;">${escapeHtml(c.partido)}</span>` : ''}${qrYear(c.desde) ? ` · ${qrYear(c.desde)}` : ''}</p>`
    : `<p style="font-size:0.82rem;color:#94a3b8;font-style:italic;margin:2px 0 0;">Por confirmar</p>`
  return `<div class="not-prose" style="background:white;border:1px solid #e2e8f0;border-radius:14px;padding:1.25rem 1.4rem;margin-bottom:1rem;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.75rem;">
      <div style="min-width:0;">
        <h3 style="font-size:1.1rem;font-weight:800;color:#0f172a;margin:0;line-height:1.25;">${escapeHtml(c.cargo)}</h3>
        ${persona}
      </div>
      ${scoreBadge}
    </div>
    <div style="margin-top:0.75rem;font-size:0.9rem;line-height:1.55;">
      <p style="margin:0;color:#1e293b;"><span style="font-weight:700;color:#0f766e;">De qué responde:</span> ${escapeHtml(c.responde_de)}</p>
      ${c.no_responde_de ? `<p style="margin:6px 0 0;color:#64748b;"><span style="font-weight:600;">No responde de:</span> ${escapeHtml(c.no_responde_de)}</p>` : ''}
      ${c.fuente_legal ? `<p style="margin:4px 0 0;font-size:0.75rem;color:#94a3b8;">${escapeHtml(c.fuente_legal)}</p>` : ''}
    </div>
    ${promesasHtml}
    ${accionHtml}
  </div>`
}
async function handleQuienResponde(_req: any, res: any) {
  let cargos: any[] = []
  try {
    const { data } = await supabase.rpc('get_quien_responde')
    if (Array.isArray(data)) cargos = data
  } catch (_e) { cargos = [] }

  const gruposHtml = NIVEL_GRUPOS.map(g => {
    const items = cargos.filter(c => c.nivel === g.nivel).sort((a, b) => (a.orden || 0) - (b.orden || 0))
    if (items.length === 0) return ''
    return `<h2>${g.titulo}</h2>
<p class="text-sm text-slate-500 -mt-2 mb-3">${escapeHtml(g.sub)}</p>
${items.map(qrCard).join('\n')}`
  }).filter(Boolean).join('\n\n')

  const body = `
<span class="not-prose inline-block bg-teal-100 text-teal-800 text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full">Quién Responde · No-partidista · Cabo Rojo</span>

<h1 class="mt-4">¿Quién responde por esto?</h1>

<p class="text-lg text-slate-600 mt-3">Cuando se te va el agua sientes rabia, pero a veces no sabes a quién señalar. Aquí está, claro: <strong>quién te representa, de qué responde por ley, y cómo lo contactas.</strong> No para pelear. Para que sepas dónde toca tocar.</p>

<div class="not-prose mt-4 bg-white border border-slate-200 border-l-4 border-l-teal-600 rounded-lg p-4">
  <p class="text-sm text-slate-700">El error más caro del pueblo: pedirle al alcalde cosas que son de la AAA, de LUMA, o de la Legislatura. Cuando sabes <strong>de qué responde cada quién</strong>, dejas de gritarle a la pared equivocada.</p>
</div>

${gruposHtml}

<div class="not-prose mt-6 bg-teal-900 text-white rounded-xl p-5">
  <p class="font-bold text-base">¿Falta alguien? ¿Un dato cambió?</p>
  <p class="text-sm text-teal-100 mt-1">Dilo abajo, o textea <strong>QUIEN al ${PHONE_CTA}</strong>. Lo revisa un humano antes de cambiar nada. Cada nombre y cada número se verifica contra fuente, no contra memoria.</p>
</div>

${civicSubmitForm({ kind: 'feedback_quien', tone: 'teal', title: '🏛️ Corregir o añadir', sub: 'Si un cargo, un nombre o un contacto está mal o falta, escríbelo. Si tienes la fuente oficial, mejor.', placeholder: '¿Qué cargo, y qué hay que corregir o añadir?', cta: 'Enviar' })}

<blockquote>No escogemos a nadie. Organizamos quién responde por qué, y lo ponemos donde todos lo vean. Si esto te ayuda a entender mejor tu pueblo, llégate. Si no, sigue tu camino.</blockquote>

<p class="text-xs text-slate-500 mt-4"><a href="/promesas" class="text-teal-700 font-semibold">Las promesas del alcalde, en cámara →</a> · <a href="/observatorio" class="text-teal-700 font-semibold">El Observatorio del pueblo →</a></p>
${CIVIC_FORM_SCRIPT}
`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Quién Responde — estructura de gobierno de Cabo Rojo',
    description: 'Quién representa a un residente de Cabo Rojo (municipal, estatal, federal y cuerpos no electos), de qué responde cada cargo por ley, y cómo contactarlo. No-partidista.',
    creator: { '@type': 'Organization', name: 'mapadecaborojo.com' },
    spatialCoverage: { '@type': 'Place', name: 'Cabo Rojo, Puerto Rico' },
    isAccessibleForFree: true,
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800')
  res.status(200).send(layout({
    title: 'Quién Responde — el organigrama vivo de Cabo Rojo',
    description: 'Quién te representa en Cabo Rojo, de qué responde por ley, y cómo lo contactas. Municipal, estatal, federal y los que mandan sin que los votes. No-partidista.',
    slug: 'quien-responde',
    bodyHtml: body,
    jsonLd,
    ogImage: '/og/observatorio.png',
  }))
}

// =============== /tienda — La Tienda del Mapa ===============
// The storefront for the ecosystem's real products. Vecino is the hero, the mapa
// is the guide. Only verified products/prices/links (no guessed Stripe links).
//   · La Vitrina (escalera $40 / $150 / $799 / $1,800) → textea (Angel qualifies)
//   · Verificado gratis → textea
//   · Boost 7 días $29 → textea (Stripe link pendiente)
//   · Libro AJORÁO PDF $9.99 → Stripe checkout directo (link verificado en canon)
//   · El Conserje 24/7 (hoteles) → textea (B2B, requiere conversación)
// CTAs log intent to store_clicks via POST /api/mapa-pages?page=tienda-log.
const BOOK_STRIPE_URL = 'https://buy.stripe.com/aFa3cu5VOa0n0EpbAL0co0l'
const WA_BASE = 'https://wa.me/17874177711?text='
const STORE_PRODUCTS = new Set([
  'vitrina_prueba', 'vitrina_mensual', 'vitrina_anual', 'vitrina_veci',
  'boost', 'libro', 'conserje', 'verificado',
])

function handleTienda(_req: any, res: any) {
  const wa = (keyword: string) => `${WA_BASE}${encodeURIComponent(keyword)}`

  const body = `
<h1>La Tienda del Mapa</h1>

<p class="text-lg text-slate-600 mt-4">Todo lo que vendemos cabe en una idea: <strong>menos revolú, más sistema</strong>. Aquí están las herramientas pa' que tu negocio aparezca cuando alguien lo busca, y pa' que tú pongas tu día en orden.</p>

<div class="bg-teal-50 border border-teal-200 rounded-lg p-4 mt-5 not-prose">
  <p class="text-sm text-slate-700 leading-snug"><strong>¿Cómo se compra?</strong> Lo digital (el libro) se paga al instante. Lo del directorio (La Vitrina, El Conserje) lo cuadramos por texto, porque primero te oigo y te digo qué te conviene. Sin llamadas. Todo en blanco y negro.</p>
</div>

<!-- ============ LA VITRINA ============ -->
<h2 id="vitrina">La Vitrina · tu negocio en el mapa</h2>
<p>Cuando alguien busca lo que tú vendes, apareces. No es "estar en un mapa". Es aparecer en el momento correcto, frente a gente con intención de comprar. La escalera empieza con $40 y sin compromiso.</p>

<div class="grid sm:grid-cols-2 gap-4 mt-4 not-prose">

  <div class="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
    <div class="text-xs font-bold text-slate-500 uppercase tracking-wide">Entrada · sin compromiso</div>
    <h3 class="text-xl font-bold mt-1">Prueba</h3>
    <p class="text-2xl font-black text-slate-900 mt-1">$40</p>
    <p class="text-sm text-slate-600 mt-2 flex-1">1 publicación esta semana + tu negocio listado en El Veci. Pa' probar sin amarrarte.</p>
    <a href="${wa('VITRINA PRUEBA')}" data-store="vitrina_prueba" data-action="whatsapp" target="_blank" rel="noopener" class="mt-4 block text-center px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold">Textea VITRINA PRUEBA</a>
  </div>

  <div class="bg-teal-50 border-2 border-teal-400 rounded-xl p-5 flex flex-col relative">
    <div class="absolute -top-3 left-5 bg-teal-500 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded">El que más cuadra</div>
    <div class="text-xs font-bold text-teal-700 uppercase tracking-wide">Mensual</div>
    <h3 class="text-xl font-bold mt-1">Destacado</h3>
    <p class="text-2xl font-black text-slate-900 mt-1">$150<span class="text-sm font-semibold text-slate-500">/mes</span></p>
    <p class="text-sm text-slate-600 mt-2 flex-1">4 publicaciones al mes (una por semana) + prioridad en El Veci + mención en el newsletter + reporte de cómo te fue.</p>
    <a href="${wa('VITRINA MENSUAL')}" data-store="vitrina_mensual" data-action="whatsapp" target="_blank" rel="noopener" class="mt-4 block text-center px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold">Textea VITRINA MENSUAL</a>
  </div>

  <div class="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
    <div class="text-xs font-bold text-slate-500 uppercase tracking-wide">Anual · pago completo</div>
    <h3 class="text-xl font-bold mt-1">Anual</h3>
    <p class="text-2xl font-black text-slate-900 mt-1">$799<span class="text-sm font-semibold text-slate-500">/año</span></p>
    <p class="text-sm text-slate-600 mt-2 flex-1">52 publicaciones (una por semana todo el año) + exclusividad de tu categoría + reporte mensual + trato directo conmigo.</p>
    <a href="${wa('VITRINA ANUAL')}" data-store="vitrina_anual" data-action="whatsapp" target="_blank" rel="noopener" class="mt-4 block text-center px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold">Textea VITRINA ANUAL</a>
  </div>

  <div class="bg-slate-900 text-white rounded-xl p-5 flex flex-col">
    <div class="text-xs font-bold text-teal-300 uppercase tracking-wide">Premium · upfront</div>
    <h3 class="text-xl font-bold mt-1">Vitrina + Veci</h3>
    <p class="text-2xl font-black mt-1">$1,800<span class="text-sm font-semibold text-slate-400">/año</span></p>
    <p class="text-sm text-slate-300 mt-2 flex-1">El Veci recomienda tu negocio activamente cuando alguien busca lo que vendes + reporte mensual + exclusiva por categoría y zona + garantía de 60 días.</p>
    <a href="${wa('VITRINA VECI')}" data-store="vitrina_veci" data-action="whatsapp" target="_blank" rel="noopener" class="mt-4 block text-center px-4 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 text-sm font-bold">Textea VITRINA VECI</a>
  </div>

</div>

<p class="text-sm text-slate-500 mt-3 italic">Antes de cobrarte, te pregunto qué tipo de negocio tienes y qué quieres lograr. Por eso La Vitrina se cuadra por texto, no con un botón.</p>

<!-- ============ VERIFICADO GRATIS ============ -->
<h2 id="verificado">Verificado · gratis pa' siempre</h2>
<div class="bg-white border border-slate-200 rounded-xl p-5 mt-3 not-prose">
  <p class="text-sm text-slate-600">Tu negocio en el directorio, en el mapa, y en las búsquedas de El Veci. Si Angel o Noelia llaman y confirman que sigues abierto, te ponemos el badge "verificado". <strong>No cuesta nada.</strong> No es pagar por aparecer. La Vitrina es opcional, pa' los que quieren más visibilidad.</p>
  <a href="${wa('NEGOCIO')}" data-store="verificado" data-action="whatsapp" target="_blank" rel="noopener" class="mt-4 inline-block px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold">Textea NEGOCIO + tu nombre</a>
</div>

<!-- ============ BOOST ============ -->
<h2 id="boost">Boost 7 días</h2>
<div class="bg-amber-50 border border-amber-200 rounded-xl p-5 mt-3 not-prose">
  <div class="flex items-baseline gap-3">
    <p class="text-2xl font-black text-slate-900">$29</p>
    <p class="text-sm font-semibold text-amber-700">7 días arriba en tu categoría</p>
  </div>
  <p class="text-sm text-slate-600 mt-2">Tu negocio aparece primero en su categoría por una semana. Bueno pa' un fin de semana fuerte, una promoción, o una temporada. Lo cuadramos por texto.</p>
  <a href="${wa('BOOST')}" data-store="boost" data-action="whatsapp" target="_blank" rel="noopener" class="mt-4 inline-block px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold">Textea BOOST</a>
</div>

<!-- ============ EL LIBRO ============ -->
<h2 id="libro">AJORÁO NO ES UN PLAN · el libro</h2>
<div class="bg-white border-2 border-teal-300 rounded-xl p-5 mt-3 not-prose">
  <div class="flex items-baseline gap-3">
    <p class="text-2xl font-black text-slate-900">$9.99</p>
    <p class="text-sm font-semibold text-teal-700">PDF · descarga al instante</p>
  </div>
  <p class="text-sm text-slate-600 mt-2">Vivir corriendo sale caro. Este libro corto te enseña a poner el día en orden sin volverte loco. Lo compras, lo descargas, y empiezas hoy. Pago seguro con Stripe.</p>
  <a href="${BOOK_STRIPE_URL}" data-store="libro" data-action="checkout" target="_blank" rel="noopener" class="mt-4 inline-block px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold">Comprar el PDF · $9.99</a>
</div>

<!-- ============ EL CONSERJE ============ -->
<h2 id="conserje">El Conserje 24/7 · pa' hoteles y paradores</h2>
<div class="bg-slate-50 border border-slate-200 rounded-xl p-5 mt-3 not-prose">
  <p class="text-sm text-slate-600">El Veci, pero pa' tu hotel. Contesta las preguntas de tus huéspedes a cualquier hora (qué hay cerca, dónde comer, qué hacer, cómo llegar) sin que tu recepción tenga que estar pendiente. Es un producto distinto, lo cuadramos según tu propiedad.</p>
  <a href="${wa('CONSERJE')}" data-store="conserje" data-action="whatsapp" target="_blank" rel="noopener" class="mt-4 inline-block px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold">Textea CONSERJE</a>
</div>

<!-- ============ POR QUÉ ============ -->
<h2>Por qué este mapa y no Google</h2>
<p><strong>Google tiene datos. Facebook tiene ruido. Nosotros tenemos contexto local.</strong> No somos visitantes mirando un mapa. Somos vecinos leyendo la vuelta. Cada negocio se verifica a mano, uno por uno. Eso es lo que estás comprando: que alguien se sentó a confirmar que la información sirve.</p>
<p>Lee más: <a href="/pon-tu-negocio-en-el-mapa" class="text-teal-600 hover:underline">cómo poner tu negocio</a> · <a href="/transparencia" class="text-teal-600 hover:underline">los números en vivo</a> · <a href="/mision" class="text-teal-600 hover:underline">por qué existe el mapa</a>.</p>

<div class="bg-teal-50 border border-teal-200 rounded-lg p-6 mt-8 text-center not-prose">
  <p class="text-lg font-semibold">¿No sabes cuál te conviene?</p>
  <p class="text-sm text-slate-600 mt-1">Texteame qué vendes y yo te digo. Sin pitch, sin presión.</p>
  <a href="${wa('TIENDA')}" data-store="verificado" data-action="whatsapp" target="_blank" rel="noopener" class="mt-3 inline-block px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold">Textea al ${PHONE_CTA}</a>
  <p class="text-sm text-slate-600 mt-3 italic">Si te sirve, llégate. Si no, sigue tu camino. El directorio sigue funcionando con o sin ti.</p>
</div>

<script>
(function(){
  function track(product, action){
    try {
      fetch('/api/mapa-pages?page=tienda-log', {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: product, action: action, referrer: document.referrer || '' })
      });
    } catch(e) {}
  }
  document.querySelectorAll('[data-store]').forEach(function(el){
    el.addEventListener('click', function(){
      track(el.getAttribute('data-store'), el.getAttribute('data-action') || '');
    });
  });
})();
</script>
`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: 'La Tienda del Mapa · MapaDeCaboRojo.com',
    description: 'Productos del ecosistema de Cabo Rojo: La Vitrina pa\' negocios, el libro AJORÁO, El Conserje 24/7 pa\' hoteles.',
    url: `${SITE_URL}/tienda`,
    makesOffer: [
      { '@type': 'Offer', name: 'La Vitrina Prueba', price: '40', priceCurrency: 'USD' },
      { '@type': 'Offer', name: 'La Vitrina Mensual', price: '150', priceCurrency: 'USD' },
      { '@type': 'Offer', name: 'La Vitrina Anual', price: '799', priceCurrency: 'USD' },
      { '@type': 'Offer', name: 'La Vitrina + Veci', price: '1800', priceCurrency: 'USD' },
      { '@type': 'Offer', name: 'Boost 7 días', price: '29', priceCurrency: 'USD' },
      { '@type': 'Offer', name: 'Libro AJORÁO NO ES UN PLAN (PDF)', price: '9.99', priceCurrency: 'USD', url: BOOK_STRIPE_URL },
    ],
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800')
  res.status(200).send(layout({
    title: 'La Tienda del Mapa · La Vitrina, el libro AJORÁO, El Conserje',
    description: 'Los productos de Cabo Rojo en un solo sitio. La Vitrina pa\' que tu negocio aparezca ($40 a $1,800). El libro AJORÁO ($9.99 PDF). El Conserje 24/7 pa\' hoteles. Menos revolú, más sistema.',
    slug: 'tienda',
    bodyHtml: body,
    jsonLd,
    ogImage: '/og/menos-revolu.png',
  }))
}

async function handleTiendaLog(req: any, res: any) {
  try {
    let body: any = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
    body = body || {}
    const product = String(body.product || '').slice(0, 40)
    if (STORE_PRODUCTS.has(product)) {
      await supabase.from('store_clicks').insert({
        product,
        action: body.action ? String(body.action).slice(0, 20) : null,
        ua: String(req.headers['user-agent'] || '').slice(0, 300),
        referrer: body.referrer ? String(body.referrer).slice(0, 300) : null,
      })
    }
  } catch { /* analytics must never break the page */ }
  res.status(204).end()
}

export default async function handler(req: any, res: any) {
  const page = String(req.query.page || '')

  switch (page) {
    case 'tienda': return handleTienda(req, res)
    case 'tienda-log': return await handleTiendaLog(req, res)
    case 'quien-responde': return await handleQuienResponde(req, res)
    case 'acceso': return handleAcceso(req, res)
    case 'acceso-log': return await handleAccesoLog(req, res)
    case 'registro': return await handleRegistro(req, res)
    case 'registro-data': return await handleRegistroData(req, res)
    case 'registro-search': return await handleRegistroSearch(req, res)
    case 'especialista': return await handleEspecialista(req, res)
    case 'especialista-claim': return await handleEspecialistaClaim(req, res)
    case 'conserje-intent': return await handleConserjeIntent(req, res)
    case 'registro-desiertos': return await handleRegistroDesiertos(req, res)
    case 'registro-hub': return await handleRegistroHub(req, res)
    case 'observatorio': return await handleObservatorio(req, res)
    case 'promesas': return handlePromesas(req, res)
    case 'civico-json': return handleCivicoJson(req, res)
    case 'civico-submit': return await handleCivicoSubmit(req, res)
    case 'civico-moderate': return await handleCivicoModerate(req, res)
    case 'mision': return handleMision(req, res)
    case 'transparencia': return await handleTransparencia(req, res)
    case 'equipo': return handleEquipo(req, res)
    case 'vision': return handleVision(req, res)
    case 'moonshots': return handleMoonshots(req, res)
    case 'mira-la-vuelta': return await handleMiraLaVuelta(req, res)
    case 'pon-tu-negocio-en-el-mapa': return handlePonTuNegocio(req, res)
    case 'senales-del-pueblo': return await handleSenalesDelPueblo(req, res)
    case 'menos-revolu': return handleMenosRevolu(req, res)
    case 'preguntas': return handlePreguntas(req, res)
    case 'historia': return handleHistoria(req, res)
    case 'subscribe': return await handleSubscribe(req, res)
    case 'defensa-y-limpieza': return handleDefensaYLimpieza(req, res)
    default:
      res.status(404).send('Page not found')
  }
}
