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
import { handleActivos } from './_lib/activos.js'

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
  const isPRSF = /puertoricosinfiltros\.com/i.test(opts.host || '')
  const isEn = opts.lang === 'en'
  const langHref = `/${opts.slug}?lang=${isEn ? 'es' : 'en'}`
  const canonicalBase = opts.canonicalHost || (isPRSF ? 'https://puertoricosinfiltros.com' : isReg ? 'https://registromedicopr.com' : SITE_URL)
  const brandName = isPRSF ? 'Puerto Rico Sin Filtros' : isReg ? 'Registro Médico PR' : 'Mapa de Cabo Rojo'
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
  const prsfHeader = `
<header class="bg-white border-b border-slate-200 sticky top-0 z-10">
<div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
<a href="/" class="flex items-center gap-2 text-slate-900 hover:text-teal-700">
<div class="bg-slate-900 w-8 h-8 rounded-lg flex items-center justify-center text-white">
<i class="fa-solid fa-eye text-sm"></i>
</div>
<span class="font-black tracking-tight">Puerto Rico <span class="text-teal-700">Sin Filtros</span></span>
</a>
<nav class="hidden md:flex gap-5 text-sm text-slate-600">
<a href="/decidir" class="font-bold text-teal-700 hover:text-teal-800">¿Me quedo?</a>
<a href="/#records" class="hover:text-teal-700">Récords</a>
<a href="/#expedientes" class="hover:text-teal-700">Expedientes</a>
<a href="/prediccion" class="hover:text-teal-700">Predicción</a>
<a href="/sigue-el-dinero" class="hover:text-teal-700">Sigue el dinero</a>
<a href="/comparte" class="hover:text-teal-700">Datos citables</a>
</nav>
</div>
</header>`
  const prsfFooter = `
<footer class="border-t border-slate-200 mt-12 py-10 bg-white">
<div class="max-w-4xl mx-auto px-4">
<div class="pb-8 border-b border-slate-100 mb-8">
<p class="text-xs uppercase tracking-widest text-teal-700 font-bold">Si lo que necesitas hoy no es data, es ayuda</p>
<div class="mt-3 grid sm:grid-cols-3 gap-3 text-sm">
<div class="bg-slate-50 border border-slate-200 rounded-xl p-3"><span class="font-bold text-slate-800">🧠 Crisis o ansiedad</span><br>Línea PAS: marca o textea <strong>988</strong> (o 1-800-981-0023). 24/7, gratis, en español.</div>
<div class="bg-slate-50 border border-slate-200 rounded-xl p-3"><span class="font-bold text-slate-800">🩺 Buscar un especialista</span><br><a href="https://registromedicopr.com" class="text-teal-700 font-semibold">registromedicopr.com</a>: verificado, por pueblo y especialidad. Sin cuenta, sin registro.</div>
<div class="bg-slate-50 border border-slate-200 rounded-xl p-3"><span class="font-bold text-slate-800">📋 El dato de tu pueblo</span><br>Agua, salud, dinero: cada récord trae su resumen citable con botón de copiar. Llévatelo.</div>
</div>
<p class="text-sm text-slate-500 mt-3">Y si solo viniste a mirar, está bien. No tienes que resolver a Puerto Rico hoy: el récord se queda aquí, guardado, para cuando te haga falta.</p>
</div>
<p class="text-base font-semibold text-slate-800 text-center">El récord público de Puerto Rico. El dato, con la fuente al lado.</p>
<p class="text-xs text-slate-500 mt-1 text-center">Verificado uno por uno contra registros federales y públicos. Sin spin, sin relleno.</p>
<div class="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-6 text-xs">
<div><div class="font-bold text-slate-700 uppercase tracking-wide mb-2">Salud</div><div class="flex flex-col gap-1.5 text-slate-500"><a href="/registro/estado" class="hover:text-teal-700">Estado de salud PR</a><a href="/registro/mapa" class="hover:text-teal-700">El mapa médico</a><a href="/registro/desiertos" class="hover:text-teal-700">Los desiertos</a><a href="/telemedicina" class="hover:text-teal-700">Telemedicina</a><a href="/diabetes" class="hover:text-teal-700">Diabetes</a><a href="/registro-raras" class="hover:text-teal-700">Enfermedades raras</a></div></div>
<div><div class="font-bold text-slate-700 uppercase tracking-wide mb-2">Dinero</div><div class="flex flex-col gap-1.5 text-slate-500"><a href="/costo-de-vida" class="hover:text-teal-700">Costo de vida</a><a href="/rendimiento" class="hover:text-teal-700">Rendimiento del dólar</a><a href="/cupon" class="hover:text-teal-700">Dinero sin cobrar</a><a href="/trabajo" class="hover:text-teal-700">Trabajo y AI</a><a href="/exposicion-ai" class="hover:text-teal-700">Exposición a la IA</a><a href="/recuperacion" class="hover:text-teal-700">Dinero de María</a><a href="/sigue-el-dinero" class="hover:text-teal-700">Sigue el dinero</a><a href="/investigacion" class="hover:text-teal-700">Dinero de ciencia</a></div></div>
<div><div class="font-bold text-slate-700 uppercase tracking-wide mb-2">Servicios</div><div class="flex flex-col gap-1.5 text-slate-500"><a href="/agua" class="hover:text-teal-700">Agua</a><a href="/luz" class="hover:text-teal-700">Luz</a><a href="/basura" class="hover:text-teal-700">Basura</a></div></div>
<div><div class="font-bold text-slate-700 uppercase tracking-wide mb-2">El pueblo</div><div class="flex flex-col gap-1.5 text-slate-500"><a href="/demanda" class="hover:text-teal-700">Lo que busca PR</a><a href="/historial" class="hover:text-teal-700">Historial de promesas</a><a href="/promesas" class="hover:text-teal-700">Promesómetro</a><a href="/esencia" class="hover:text-teal-700">Proyecto Esencia</a><a href="/activos" class="hover:text-teal-700">Activos dormidos</a><a href="/no-se-mide" class="hover:text-teal-700">Lo que ni se mide</a></div></div>
<div><div class="font-bold text-slate-700 uppercase tracking-wide mb-2">Expedientes</div><div class="flex flex-col gap-1.5 text-slate-500"><a href="/expediente/alcalde-cabo-rojo" class="hover:text-teal-700">Alcalde de Cabo Rojo</a><a href="/expediente/representante-distrito-20" class="hover:text-teal-700">Rep. Distrito 20</a></div></div>
<div><div class="font-bold text-slate-700 uppercase tracking-wide mb-2">Predicción</div><div class="flex flex-col gap-1.5 text-slate-500"><a href="/prediccion" class="hover:text-teal-700">Predicción 2030</a><a href="/sinfiltros/pulso" class="hover:text-teal-700">Pulso</a></div></div>
<div><div class="font-bold text-slate-700 uppercase tracking-wide mb-2">Para IA / datos</div><div class="flex flex-col gap-1.5 text-slate-500"><a href="/comparte" class="hover:text-teal-700">Datos citables</a><a href="/civico.json" class="hover:text-teal-700">API pública</a><a href="/llms.txt" class="hover:text-teal-700">Para IA (llms.txt)</a></div></div>
<div><div class="font-bold text-slate-700 uppercase tracking-wide mb-2">La casa</div><div class="flex flex-col gap-1.5 text-slate-500"><a href="/#mision" class="hover:text-teal-700">La misión</a><a href="/#sugiere" class="hover:text-teal-700">Sugiere un récord</a></div></div>
</div>
<p class="mt-8 text-xs text-slate-400 text-center">Angel Anderson, desde Cabo Rojo. Prensa e investigadores: <a href="mailto:angel@angelanderson.com" class="hover:text-teal-700">angel@angelanderson.com</a></p>
</div>
</footer>`
  const laMaquinaPRSF = `
<section class="max-w-4xl mx-auto px-4 mt-12">
<div class="bg-slate-900 text-white rounded-2xl p-6 sm:p-8">
<p class="text-xs uppercase tracking-widest text-teal-300 font-bold">Pásalo por la máquina</p>
<div class="text-xl sm:text-2xl font-black mt-1 leading-snug">Antes de creer o compartir — a favor o en contra</div>
<p class="text-slate-300 mt-2 text-sm">Esta página es el récord. Un récord solo sirve si lo usas para pensar por tu cuenta. Antes de creer o regar cualquier cosa, pásala por estas seis preguntas:</p>
<div class="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 mt-4">
<div class="flex gap-2.5 items-start"><span class="text-teal-300 font-black">1</span><span class="text-sm text-slate-100">¿De dónde salió esto de verdad?</span></div>
<div class="flex gap-2.5 items-start"><span class="text-teal-300 font-black">2</span><span class="text-sm text-slate-100">¿Es un hecho, una opinión, o un susto?</span></div>
<div class="flex gap-2.5 items-start"><span class="text-teal-300 font-black">3</span><span class="text-sm text-slate-100">¿Lo dice más de uno, por su cuenta?</span></div>
<div class="flex gap-2.5 items-start"><span class="text-teal-300 font-black">4</span><span class="text-sm text-slate-100">¿Quién gana si yo me lo creo?</span></div>
<div class="flex gap-2.5 items-start"><span class="text-teal-300 font-black">5</span><span class="text-sm text-slate-100">¿Qué siento, y por qué me lo hicieron sentir así?</span></div>
<div class="flex gap-2.5 items-start"><span class="text-teal-300 font-black">6</span><span class="text-sm text-slate-100">¿Si lo comparto, ayudo o riego?</span></div>
</div>
<p class="text-slate-300 mt-5 text-sm">Eso es tener el lápiz en la mano. El porqué completo — por qué a un pueblo se le enseñó a consumir el feed en vez de leer el récord — lo cuenta Angel en <a href="https://www.angelanderson.com/te-programaron/" target="_blank" rel="noopener" class="text-teal-300 underline font-semibold">Te programaron</a>.</p>
</div>
</section>`
  const header = isPRSF ? prsfHeader : isReg ? `
<header class="bg-white border-b border-slate-200 sticky top-0 z-10">
<div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
<a href="/registro${isEn ? '?lang=en' : ''}" class="flex items-center gap-2 text-slate-900 hover:text-teal-700">
<div class="bg-teal-700 w-8 h-8 rounded-lg flex items-center justify-center text-white">
<i class="fa-solid fa-user-doctor text-sm"></i>
</div>
<span class="font-black tracking-tight">Registro Médico PR</span>
</a>
<div class="flex items-center gap-3">
<nav class="hidden md:flex items-center gap-6 text-sm text-slate-600">
<a href="/registro${isEn ? '?lang=en' : ''}" class="hover:text-teal-700 font-semibold">${isEn ? 'Find a specialist' : 'Buscar especialista'}</a>
<a href="/pueblo${isEn ? '?lang=en' : ''}" class="hover:text-teal-700 font-semibold">${isEn ? 'Your town' : 'Tu pueblo'}</a>
<a href="/registro/desiertos${isEn ? '?lang=en' : ''}" class="font-bold text-amber-700 hover:text-amber-800">${isEn ? 'Deserts' : 'Desiertos'}</a>
<details id="nav-more" class="relative">
<summary class="list-none cursor-pointer select-none hover:text-teal-700 flex items-center gap-1">${isEn ? 'More' : 'Más'} <i class="fa-solid fa-chevron-down text-[10px] opacity-60"></i></summary>
<div class="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-20">
<a href="/necesito${isEn ? '?lang=en' : ''}" class="block px-4 py-2 hover:bg-slate-50 hover:text-teal-700">🧭 ${isEn ? 'Your situation' : 'Tu situación'}</a>
<a href="/registro/mapa" class="block px-4 py-2 hover:bg-slate-50 hover:text-teal-700">🗺️ ${isEn ? 'The interactive map' : 'El mapa interactivo'}</a>
<a href="/porque" class="block px-4 py-2 hover:bg-slate-50 hover:text-teal-700">✈️ ${isEn ? 'Why doctors leave' : '¿Por qué se van?'}</a>
<a href="/registro/estado" class="block px-4 py-2 hover:bg-slate-50 hover:text-teal-700">🏥 ${isEn ? 'PR health status' : 'Estado de salud'}</a>
<a href="/comparte" class="block px-4 py-2 hover:bg-slate-50 hover:text-teal-700">📋 ${isEn ? 'Citable facts' : 'Datos citables'}</a>
<a href="/registro#como-se-hizo" class="block px-4 py-2 hover:bg-slate-50 hover:text-teal-700">✅ ${isEn ? 'How it is verified' : 'Cómo se verifica'}</a>
</div>
</details>
</nav>
<script>document.addEventListener('click',function(e){var d=document.getElementById('nav-more');if(d&&d.open&&!d.contains(e.target))d.removeAttribute('open');});</script>
<a href="${langHref}" class="text-xs font-bold text-slate-500 hover:text-teal-700 border border-slate-200 rounded-lg px-2.5 py-1.5" aria-label="Language">${isEn ? 'ES' : 'EN'}</a>
<button id="theme-toggle" type="button" aria-label="Theme" class="w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:border-teal-400 flex items-center justify-center"><i class="fa-solid fa-moon" id="theme-icon"></i></button>
<button id="mnav-btn" type="button" aria-label="Menu" aria-expanded="false" class="md:hidden w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:border-teal-400 flex items-center justify-center"><i class="fa-solid fa-bars" id="mnav-icon"></i></button>
</div>
</div>
<nav id="mnav" hidden class="md:hidden border-t border-slate-100 bg-white">
<div class="max-w-4xl mx-auto px-4 py-2 flex flex-col text-[15px] font-semibold text-slate-700">
<a href="/registro${isEn ? '?lang=en' : ''}" class="py-2.5 border-b border-slate-100">🔎 ${isEn ? 'Find a specialist' : 'Buscar especialista'}</a>
<a href="/pueblo${isEn ? '?lang=en' : ''}" class="py-2.5 border-b border-slate-100">🏘️ ${isEn ? 'Your town' : 'Tu pueblo'}</a>
<a href="/registro/desiertos${isEn ? '?lang=en' : ''}" class="py-2.5 border-b border-slate-100 text-amber-700">🏜️ ${isEn ? 'Medical deserts' : 'Desiertos médicos'}</a>
<a href="/necesito${isEn ? '?lang=en' : ''}" class="py-2.5 border-b border-slate-100">🧭 ${isEn ? 'Your situation' : 'Tu situación'}</a>
<a href="/registro/mapa" class="py-2.5 border-b border-slate-100">🗺️ ${isEn ? 'The interactive map' : 'El mapa interactivo'}</a>
<a href="/porque" class="py-2.5 border-b border-slate-100">✈️ ${isEn ? 'Why doctors leave' : '¿Por qué se van?'}</a>
<a href="/comparte" class="py-2.5">📋 ${isEn ? 'Citable facts' : 'Datos citables'}</a>
</div>
</nav>
<script>(function(){var b=document.getElementById('mnav-btn'),n=document.getElementById('mnav'),i=document.getElementById('mnav-icon');if(!b||!n)return;
b.addEventListener('click',function(){var open=n.hidden;n.hidden=!open;b.setAttribute('aria-expanded',String(open));i.className=open?'fa-solid fa-xmark':'fa-solid fa-bars';});
document.addEventListener('click',function(e){if(!n.hidden&&!n.contains(e.target)&&!b.contains(e.target)){n.hidden=true;b.setAttribute('aria-expanded','false');i.className='fa-solid fa-bars';}});})();</script>
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
  const footer = isPRSF ? (laMaquinaPRSF + prsfFooter) : isReg ? `
<footer class="border-t border-slate-200 mt-12 py-10 bg-white">
<div class="max-w-4xl mx-auto px-4">
<p class="text-base font-semibold text-teal-800 text-center">${isEn ? 'The verified registry of Puerto Rico medical specialists.' : 'El registro verificado de especialistas médicos de Puerto Rico.'}</p>
<p class="text-xs text-slate-500 mt-1 text-center">${isEn ? 'Every name verified against the federal NPPES/CMS registry. By specialty, region, and town.' : 'Cada nombre verificado contra el registro federal NPPES/CMS. Por especialidad, región y pueblo.'}</p>
<div class="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-6 text-xs">
<div><div class="font-bold text-slate-700 uppercase tracking-wide mb-2">${isEn ? 'Find' : 'Busca'}</div><div class="flex flex-col gap-1.5 text-slate-500">
<a href="/registro${isEn ? '?lang=en' : ''}" class="hover:text-teal-700">${isEn ? 'Find a specialist' : 'Buscar especialista'}</a>
<a href="/pueblo${isEn ? '?lang=en' : ''}" class="hover:text-teal-700">${isEn ? 'Your town' : 'Tu pueblo'}</a>
<a href="/necesito${isEn ? '?lang=en' : ''}" class="hover:text-teal-700">${isEn ? 'Your situation' : 'Tu situación'}</a>
<a href="/registro/mapa" class="hover:text-teal-700">${isEn ? 'The interactive map' : 'El mapa interactivo'}</a>
</div></div>
<div><div class="font-bold text-slate-700 uppercase tracking-wide mb-2">${isEn ? 'Understand' : 'Entiende'}</div><div class="flex flex-col gap-1.5 text-slate-500">
<a href="/registro/desiertos${isEn ? '?lang=en' : ''}" class="hover:text-teal-700">${isEn ? 'Medical deserts' : 'Desiertos médicos'}</a>
<a href="/registro/estado" class="hover:text-teal-700">${isEn ? 'PR health status' : 'Estado de salud de PR'}</a>
<a href="/raras" class="hover:text-teal-700">${isEn ? 'Rare diseases' : 'Enfermedades raras'}</a>
<a href="/atlas" class="hover:text-teal-700">${isEn ? 'Founder diseases atlas' : 'Atlas de fundadoras'}</a>
<a href="/porque" class="hover:text-teal-700">${isEn ? 'Why doctors leave' : '¿Por qué se van los médicos?'}</a>
<a href="/observatorio" class="hover:text-teal-700">${isEn ? 'Observatory + podcast' : 'Observatorio + podcast'}</a>
</div></div>
<div><div class="font-bold text-slate-700 uppercase tracking-wide mb-2">${isEn ? 'Cite & share' : 'Cita y comparte'}</div><div class="flex flex-col gap-1.5 text-slate-500">
<a href="/comparte" class="hover:text-teal-700">${isEn ? 'Citable facts' : 'Datos citables'}</a>
<a href="/pueblo${isEn ? '?lang=en' : ''}" class="hover:text-teal-700">${isEn ? 'Facts by town' : 'Datos por pueblo'}</a>
</div></div>
<div><div class="font-bold text-slate-700 uppercase tracking-wide mb-2">${isEn ? 'The house' : 'La casa'}</div><div class="flex flex-col gap-1.5 text-slate-500">
<a href="/registro#como-se-hizo" class="hover:text-teal-700">${isEn ? 'How it is verified' : 'Cómo se verifica'}</a>
<a href="mailto:angel@angelanderson.com" class="hover:text-teal-700">${isEn ? 'Report an outdated fact' : 'Reporta un dato viejo'}</a>
<a href="https://wa.me/17874177711?text=ESPECIALISTA" class="hover:text-teal-700">${isEn ? 'Ask El Veci (WhatsApp)' : 'Pregúntale al Veci (WhatsApp)'}</a>
</div></div>
</div>
<p class="mt-8 text-xs text-slate-400 text-center">${isEn ? 'Questions about who to see? Text El Veci:' : '¿Dudas de a quién ir? Escríbele al Veci:'} <strong>${PHONE_CTA}</strong>. ${isEn ? '' : 'Si te sirve, llégate.'}</p>
<p class="mt-3 text-xs text-slate-500 text-center">🧠 ${isEn ? 'If it is an emotional crisis, do not wait for an appointment:' : 'Si es una crisis emocional, no esperes cita:'} <strong>${isEn ? '988 Lifeline' : 'Línea PAS 988'}</strong> (${isEn ? 'or' : 'o'} 1-800-981-0023), 24/7, ${isEn ? 'free' : 'gratis'}.</p>
<p class="mt-2 text-xs text-slate-400 text-center">${isEn ? 'You do not have to memorize anything. The registry stays here for whenever you or yours need it.' : 'No tienes que memorizar nada. El registro se queda aquí, para cuando te haga falta a ti o a los tuyos.'}</p>
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
${isPRSF ? '<meta name="google-site-verification" content="N42qvVBU_PKj99wLrOAEelsysbx3cT_ZtNgD5iFzXQk">' : ''}
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
<script>tailwind.config={theme:{extend:{fontFamily:{display:['Fraunces','Georgia','serif'],sans:['"Source Sans 3"','Inter','-apple-system','sans-serif']},colors:{brand:{50:'#ecfdf5',100:'#d1fae5',200:'#a7f3d0',300:'#6ee7b7',400:'#34d399',500:'#10b981',600:'#059669',700:'#047857',800:'#065f46',900:'#064e3b',950:'#022c22'},coral:{50:'#fff5f1',100:'#ffe4d9',200:'#ffc7b0',300:'#ff9f7d',400:'#fb6d43',500:'#f0491f',600:'#dd3413',700:'#b72713',800:'#932317',900:'#781f16'},sand:{50:'#faf9f7',100:'#f4f2ed',200:'#e8e4db',300:'#d6cfc1',400:'#b3a894',500:'#8f8371',600:'#726758',700:'#5c5347',800:'#3a342c',900:'#241f19'},gold:{50:'#fffbeb',100:'#fef3c7',200:'#fde68a',300:'#fcd34d',400:'#fbbf24',500:'#f59e0b',600:'#d97706',700:'#b45309'}}}}}</script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body { font-family: "Source Sans 3", -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #faf9f7; }
  h1.font-display, h2.font-display, h3.font-display, .font-display { font-family: 'Fraunces', Georgia, serif; }
  .prose-narrative h1, .prose-narrative h2, .prose-narrative h3 { font-family: 'Fraunces', Georgia, serif; letter-spacing: -0.01em; }
  .bg-slate-50 { background-color: #faf9f7; }
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
${isPRSF ? `<script>(function(){function L(ev,rec,t){try{fetch('/api/mapa-pages?page=sinfiltros-log',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({event:ev,record:rec||'',target:t||'',referrer:document.referrer||''})});}catch(e){}}var R=location.pathname.replace(/^\\//,'')||'home';L('page_view','',location.pathname);document.addEventListener('click',function(e){var a=e.target.closest?e.target.closest('a'):null;if(a){var p=a.getAttribute('data-prsf');if(p){L(p+'_click',a.getAttribute('data-rec')||R,a.getAttribute('href')||'');return;}var h=a.getAttribute('href')||'';if(h.indexOf('angelanderson.com/te-programaron')>=0){L('outbound_click',R,'te-programaron');return;}if(/^https?:/.test(h)&&h.indexOf('puertoricosinfiltros.com')<0){L('outbound_click',R,h.slice(0,120));return;}}var b=e.target.closest?e.target.closest('.copy-btn'):null;if(b)L('cite_click',R,'copy');},true);document.addEventListener('play',function(e){if(e.target&&e.target.tagName==='AUDIO')L('audio_play',R,'');},true);})();</script>` : ''}
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
const REG_REPORT_URL = 'https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/reportes/estado-acceso-medico-pr-2026.pdf'
const AGUA_PODCAST_URL = 'https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/podcast/acueductos-olvidados-oeste.m4a'
const OBS_PODCAST_URL = 'https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/podcast/quien-manda-cabo-rojo.m4a'
const AGUA_INFOGRAFIA_URL = 'https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/compartir/semaforo-del-agua-2026.png'

// "Pásalo" — share row (WhatsApp deep-link + copy). Text is OUR constant, never user input.
function shareRow(opts: { text: string; url: string; toWho: string; dark?: boolean }) {
  const full = `${opts.text} ${opts.url}`
  const wa = `https://wa.me/?text=${encodeURIComponent(full)}`
  const tone = opts.dark
    ? { box: 'bg-teal-900 text-white', sub: 'text-teal-100', copyBtn: 'bg-white/15 hover:bg-white/25 text-white' }
    : { box: 'bg-white border border-sand-200', sub: 'text-sand-600', copyBtn: 'bg-sand-100 hover:bg-sand-200 text-sand-800' }
  return `
  <div class="not-prose ${tone.box} rounded-2xl p-5 my-8">
    <p class="font-bold text-base mb-1">📤 Pásalo a quien le toca</p>
    <p class="text-sm ${tone.sub} mb-3">${escapeHtml(opts.toWho)}</p>
    <div class="flex flex-wrap gap-2">
      <a href="${wa}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-full text-sm"><i class="fa-brands fa-whatsapp"></i> Compartir por WhatsApp</a>
      <button type="button" class="share-copy inline-flex items-center gap-2 ${tone.copyBtn} font-bold px-4 py-2.5 rounded-full text-sm" data-copy="${escapeHtml(full)}"><i class="fa-regular fa-copy"></i> Copiar el texto</button>
    </div>
  </div>`
}
const SHARE_COPY_SCRIPT = `<script>document.addEventListener('click',function(e){var b=e.target.closest('.share-copy');if(!b)return;navigator.clipboard.writeText(b.getAttribute('data-copy')||'').then(function(){var o=b.innerHTML;b.innerHTML='✓ Copiado';setTimeout(function(){b.innerHTML=o},1600);});});</script>`

// =============== Registro: helpers compartidos (plan, disclaimer, checklist, WA familia) ===============
// Planes médicos comunes en PR. `v` = token de match: se compara normalizado (sin acentos,
// lowercase) como substring en ambas direcciones contra places.accepted_plans (crowdsourced).
const PR_PLANS: Array<{ v: string; l: string }> = [
  { v: 'vital', l: 'Vital (Plan del Gobierno)' },
  { v: 'mmm', l: 'MMM' },
  { v: 'triple', l: 'Triple-S' },
  { v: 'mcs', l: 'MCS' },
  { v: 'first', l: 'First Medical' },
  { v: 'humana', l: 'Humana' },
  { v: 'medicare', l: 'Medicare Original' },
]

// Mapa síntoma → especialidad (búsqueda en cristiano: "me falta el aire" → neumólogo).
// Keywords normalizados (minúscula, sin acentos). u:1 = puede ser emergencia → warning 911.
// Orientación general, NO diagnóstico — el microcopy lo dice siempre.
const SYMPTOM_MAP: Array<{ k: string[]; s: string[]; u?: number }> = [
  { k: ['pecho', 'corazon', 'palpitacion', 'presion alta', 'hipertension', 'arritmia', 'chest', 'heart'], s: ['cardiólogo'], u: 1 },
  { k: ['aire', 'respirar', 'respiracion', 'asma', 'tos', 'pulmon', 'ahogo', 'apnea', 'breath', 'lungs'], s: ['neumólogo'], u: 1 },
  { k: ['azucar', 'diabetes', 'tiroides', 'hormona', 'insulina'], s: ['endocrinologo'] },
  { k: ['piel', 'acne', 'mancha', 'lunar', 'salpullido', 'sarpullido', 'eczema', 'psoriasis', 'skin', 'rash'], s: ['dermatólogo'] },
  { k: ['estomago', 'reflujo', 'acidez', 'gastritis', 'colon', 'estrenimiento', 'diarrea', 'higado', 'colonoscopia', 'stomach'], s: ['gastroenterólogo'] },
  { k: ['rinon', 'rinones', 'dialisis', 'kidney'], s: ['nefrólogo'] },
  { k: ['orina', 'orinar', 'prostata', 'vejiga', 'piedra en el rinon'], s: ['urólogo'] },
  { k: ['ansiedad', 'depresion', 'panico', 'insomnio', 'no duermo', 'bipolar', 'anxiety', 'depression'], s: ['psiquiatra', 'psicólogo'] },
  { k: ['terapia', 'duelo', 'estres', 'therapy'], s: ['psicólogo'] },
  { k: ['hueso', 'rodilla', 'hombro', 'fractura', 'cadera', 'knee', 'bone'], s: ['ortopeda'] },
  { k: ['espalda', 'ciatica', 'dolor muscular', 'rehabilitacion', 'back pain'], s: ['fisiatra', 'ortopeda'] },
  { k: ['cabeza', 'migrana', 'jaqueca', 'mareo', 'convulsion', 'temblor', 'memoria', 'alzheimer', 'parkinson', 'derrame', 'headache', 'seizure'], s: ['neurologo'], u: 1 },
  { k: ['ojo', 'ojos', 'vision', 'catarata', 'glaucoma', 'eye'], s: ['oftalmólogo'] },
  { k: ['espejuelos', 'vista', 'lentes', 'glasses'], s: ['optómetra'] },
  { k: ['oido', 'garganta', 'sinusitis', 'ronquera', 'vertigo', 'nariz', 'ronquido', 'ear', 'throat'], s: ['otorrinolaringólogo'] },
  { k: ['embarazo', 'embarazada', 'regla', 'menstruacion', 'papanicolau', 'utero', 'ovario', 'menopausia', 'pregnant'], s: ['ginecólogo'] },
  { k: ['nino', 'nina', 'nene', 'nena', 'bebe', 'hijo', 'hija', 'child', 'baby'], s: ['pediatra'] },
  { k: ['envejeciente', 'abuelo', 'abuela', 'adulto mayor', 'anciano', 'elderly'], s: ['geriatra'] },
  { k: ['artritis', 'coyuntura', 'lupus', 'fibromialgia', 'arthritis'], s: ['reumatólogo'] },
  { k: ['alergia', 'rinitis', 'allergy'], s: ['alergista'] },
  { k: ['cancer', 'tumor', 'quimio', 'quimioterapia'], s: ['oncólogo'], u: 1 },
  { k: ['infeccion', 'vih', 'hepatitis', 'hiv'], s: ['infectólogo'] },
  { k: ['pie', 'pies', 'juanete', 'una encarnada', 'callo', 'feet', 'foot'], s: ['podiatra'] },
  { k: ['dolor cronico', 'chronic pain'], s: ['manejo de dolor'] },
  { k: ['hernia', 'vesicula', 'apendice', 'apendicitis'], s: ['cirujano general'], u: 1 },
]

// Disclaimer canon (texto de Angel, verbatim). Claro, pero humano.
function regDisclaimer(en = false): string {
  const t = en
    ? { h: 'One important thing, neighbor to neighbor', body: 'This is not a substitute for medical advice. We verify public data, but phone numbers, health plans, and availability change. Before you go, call and confirm.', tail: 'Spotted outdated info? Tell us and we fix it:' }
    : { h: 'Una cosa importante, de vecino a vecino', body: 'Esto no sustituye consejo médico. Verificamos datos públicos, pero teléfonos, planes médicos y disponibilidad cambian. Antes de ir, llama y confirma.', tail: '¿Viste un dato viejo? Dínoslo y se corrige:' }
  return `
<div class="not-prose mt-8 bg-slate-50 border border-slate-200 rounded-2xl p-5 flex gap-4 items-start">
  <div class="text-2xl leading-none">🤙</div>
  <div>
    <p class="font-bold text-slate-800 text-sm">${t.h}</p>
    <p class="text-sm text-slate-600 mt-1">${t.body}</p>
    <p class="text-xs text-slate-400 mt-2">${t.tail} <a href="mailto:angel@angelanderson.com" class="text-teal-600">angel@angelanderson.com</a></p>
  </div>
</div>`
}

// Checklist "qué hacer antes de llamar". Se usa en /especialista, hubs y páginas de intención.
function antesDeLlamar(opts: { specLabel?: string; en?: boolean } = {}): string {
  const en = !!opts.en
  const spec = opts.specLabel
  const items = en ? [
    ['Have your plan card and ID at hand', 'The first thing they ask. If it is for a relative, also their date of birth and plan number.'],
    ['Ask your primary doctor for the referral first', `Many ${spec ? spec.toLowerCase() + 's' : 'specialists'} will not book you without one. Request it by phone, do not wait for your next visit.`],
    ['Ask these two questions first', '"Do you accept my plan?" and "Are you taking new patients?" That saves you the whole trip.'],
    ['Ask how long the wait is, and to be put on the cancellation list', 'Someone cancels almost every week. Whoever is on the list gets that slot.'],
    ['Write down who you spoke with and the date', 'If anything gets tangled later, that note untangles it.'],
  ] : [
    ['Ten a mano tu tarjeta del plan y tu ID', 'Es lo primero que piden. Si la cita es pa\' un familiar, ten también su fecha de nacimiento y número de plan.'],
    ['Pide el referido a tu médico primario antes', `Muchos ${spec ? spec.toLowerCase() : 'especialistas'} no te dan cita sin referido. Pídelo por teléfono, no esperes a la próxima visita.`],
    ['Pregunta estas dos cosas primero', '"¿Aceptan mi plan?" y "¿Están cogiendo pacientes nuevos?" Eso te ahorra el viaje completo.'],
    ['Pregunta cuánto tarda la cita, y pide la lista de cancelaciones', 'Casi todas las semanas alguien cancela. El que está en la lista, coge ese espacio.'],
    ['Apunta con quién hablaste y la fecha', 'Si después algo se enreda, esa nota lo desenreda.'],
  ]
  return `
<div class="not-prose mt-8 bg-white border-2 border-teal-200 rounded-2xl p-5">
  <p class="font-bold text-slate-900 text-base">📞 ${en ? 'Before you call, have this ready' : 'Antes de llamar, ten esto listo'}</p>
  <p class="text-sm text-slate-500 mt-0.5">${en ? 'Two minutes of prep save you weeks of back and forth.' : 'Dos minutos de preparación te ahorran semanas de vueltas.'}</p>
  <ul class="mt-3 space-y-2.5">
    ${items.map(([h, p]) => `<li class="flex gap-2.5 items-start"><span class="text-teal-600 font-black mt-0.5">✓</span><span class="text-sm text-slate-700"><strong>${h}.</strong> ${p}</span></li>`).join('')}
  </ul>
</div>`
}

// Botón "Enviar por WhatsApp a mami/papi": arma el mensaje completo (nombre, especialidad,
// pueblo, teléfono, aviso de confirmar plan, link) listo pa' reenviar al familiar.
function waFamiliaBlock(opts: { name: string; specLabel: string; muni: string; phone?: string | null; url: string; en?: boolean }): string {
  const en = !!opts.en
  const text = en
    ? `Found this for you: ${opts.name}, ${opts.specLabel} in ${opts.muni}, Puerto Rico.${opts.phone ? ` Phone: ${opts.phone}.` : ''} Verified in the federal registry. Before going, call and confirm they take your plan. Everything here: ${opts.url}`
    : `Mira, te encontré esto: ${opts.name}, ${opts.specLabel} en ${opts.muni}.${opts.phone ? ` Tel: ${opts.phone}.` : ''} Está verificado en el registro federal de médicos. Antes de ir, llama y confirma que acepta tu plan. Aquí está todo: ${opts.url}`
  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`
  return `
<div class="not-prose mt-6 bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5">
  <p class="font-bold text-emerald-900 text-base">${en ? '💚 Is this for your mom or dad?' : '💚 ¿Esto es pa\' tu mamá o tu papá?'}</p>
  <p class="text-sm text-emerald-800 mt-1">${en ? 'Send it ready to go: name, specialty, phone, and the reminder to confirm the plan. One tap.' : 'Mándaselo listo: nombre, especialidad, teléfono y el recordatorio de confirmar el plan. Un solo toque.'}</p>
  <div class="mt-3 flex flex-wrap gap-2">
    <a href="${wa}" target="_blank" rel="noopener" onclick="try{gtag('event','share_familia')}catch(e){}" class="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3 rounded-xl text-base"><i class="fa-brands fa-whatsapp text-lg"></i> ${en ? 'Send by WhatsApp to mom or dad' : 'Enviárselo por WhatsApp a mami o papi'}</a>
    <button type="button" class="share-copy inline-flex items-center gap-2 bg-white border border-emerald-300 text-emerald-800 font-bold px-4 py-3 rounded-xl text-sm" data-copy="${escapeHtml(text)}"><i class="fa-regular fa-copy"></i> ${en ? 'Copy the message' : 'Copiar el mensaje'}</button>
  </div>
</div>`
}

// =============== /necesito/:intent — páginas por intención (no solo por especialidad) ===============
// La gente no busca "neumólogo": busca "necesito cita rápido" o "cuido a mami desde afuera".
// Cada página: nombra el peso, lo quita con pasos concretos, y suelta sin culpa (firma ALIVIO).
type IntentPage = {
  slug: string; e: string; title: string; metaDesc: string; who: string; intro: string;
  steps: Array<{ h: string; p: string }>;
  specs: string[]; // subcategory keys de REGISTRY_SPECS → chips a los hubs
  faq: Array<{ q: string; a: string }>;
}
const INTENT_PAGES: IntentPage[] = [
  {
    slug: 'cita-rapido', e: '⏱️',
    title: 'Necesito cita con un especialista, rápido',
    metaDesc: 'Cómo conseguir cita con un especialista en Puerto Rico más rápido: referido, lista de cancelaciones, horarios pa\' llamar y ampliar la región. Pasos concretos, gratis.',
    who: 'Pa\' cuando te dieron cita pa\' dentro de meses y no puedes esperar tanto.',
    intro: 'Llamaste y te dieron cita pa\' dentro de cuatro meses. Respira: no es que no haya manera, es que nadie te enseñó las vueltas. Ninguna de estas requiere conocer a nadie.',
    steps: [
      { h: 'Pide el referido hoy mismo', p: 'Tu médico primario es la llave. Sin referido, muchas oficinas ni te cogen la llamada. Pídelo por teléfono hoy, no esperes a tu próxima cita.' },
      { h: 'Pide que te pongan en la lista de cancelaciones', p: 'Casi todas las oficinas tienen una y casi nadie la pide. Alguien cancela casi todas las semanas, y ese espacio se lo dan al que está en la lista.' },
      { h: 'Llama entre 8 y 9 de la mañana', p: 'Es cuando las oficinas acomodan el día y sueltan espacios. Después del mediodía casi nunca queda nada.' },
      { h: 'Amplía la región', p: 'El mismo especialista con 4 meses de espera en tu región puede tener espacio en 2 semanas en la de al lado. En el registro ves cuántos hay en cada región, con teléfono.' },
      { h: 'Pregunta por telemedicina', p: 'Pa\' seguimiento y discutir resultados, muchos atienden por video. A veces la primera evaluación también. Preguntar no cuesta.' },
    ],
    specs: ['cardiólogo', 'neurologo', 'gastroenterólogo', 'endocrinologo', 'dermatólogo'],
    faq: [
      { q: '¿Cómo consigo cita más rápido con un especialista en Puerto Rico?', a: 'Pide el referido a tu médico primario por teléfono el mismo día, pide que te incluyan en la lista de cancelaciones de la oficina, llama entre 8 y 9 de la mañana, y considera especialistas de regiones vecinas, donde la espera puede ser semanas en vez de meses.' },
      { q: '¿Qué es la lista de cancelaciones de una oficina médica?', a: 'Es una lista de pacientes dispuestos a tomar espacios que se liberan cuando alguien cancela su cita. Casi todas las oficinas la tienen, pero hay que pedirla. Es una de las formas más efectivas de adelantar una cita.' },
    ],
  },
  {
    slug: 'no-tengo-plan', e: '🪪',
    title: 'No tengo plan médico, ¿a dónde voy?',
    metaDesc: 'Opciones médicas en Puerto Rico si no tienes plan: el Vital, centros de salud comunitarios 330 que cobran según ingreso, y tarifas de oficina en efectivo. En cristiano.',
    who: 'Pa\' cuando no tienes cubierta y llevas tiempo posponiendo ir al médico por eso.',
    intro: 'No tener plan no significa que no haya puerta. Hay opciones que cuestan poco o nada, y ninguna requiere esperar a que la cosa se ponga peor.',
    steps: [
      { h: 'Mira si cualificas pa\'l Vital', p: 'El Plan de Salud del Gobierno cubre a más gente de la que la gente cree, incluyendo adultos que trabajan. Se solicita en la oficina de Medicaid de tu pueblo. Lleva ID, evidencia de ingreso y de dirección.' },
      { h: 'Los centros 330 te atienden con o sin plan', p: 'Son clínicas comunitarias con fondos federales que cobran según lo que ganas. Hay en casi toda la isla, y atienden primaria, dental y salud mental.' },
      { h: 'Pregunta el precio en efectivo', p: 'Muchas oficinas tienen tarifa de "paciente directo" que es menos de lo que imaginas, sobre todo pa\' una consulta. Preguntar no cuesta nada.' },
      { h: 'La sala de emergencias es pa\' emergencias', p: 'Por ley federal te tienen que evaluar aunque no tengas plan. Pero pa\' lo que no es emergencia sales con una factura grande y una espera larga. Mejor resuelve por las otras puertas.' },
    ],
    specs: ['psicólogo', 'optómetra', 'pediatra'],
    faq: [
      { q: '¿A dónde puedo ir al médico en Puerto Rico si no tengo plan médico?', a: 'Tienes tres puertas: solicitar el Vital (Plan de Salud del Gobierno) en la oficina de Medicaid de tu pueblo, ir a un centro de salud comunitario 330 que cobra según tu ingreso, o preguntar la tarifa en efectivo de la oficina, que suele ser menor de lo esperado.' },
      { q: '¿Qué es un centro 330 en Puerto Rico?', a: 'Es una clínica comunitaria con fondos federales (Sección 330) que atiende a todo el mundo, con o sin plan médico, cobrando en escala según ingreso. Ofrecen cuidado primario, dental y de salud mental en casi toda la isla.' },
    ],
  },
  {
    slug: 'cuido-a-mis-padres-desde-afuera', e: '✈️',
    title: 'Cuido a mis padres en Puerto Rico desde afuera',
    metaDesc: 'Cómo ayudar a tus padres en Puerto Rico a conseguir especialista si vives en Estados Unidos: registro verificado federal, envío por WhatsApp y ayuda directa.',
    who: 'Pa\' la hija en Orlando o el hijo en Nueva York que resuelve lo médico de sus papás a control remoto.',
    intro: 'Estás allá y tu mamá está aquí. Cada gestión médica es una cadena de llamadas en un horario que no es el tuyo, con información que nadie te confirma. Este registro se hizo pensando en ti.',
    steps: [
      { h: 'Busca el especialista aquí y mándaselo por WhatsApp', p: 'Cada página de especialista tiene un botón que le envía a tu familiar el nombre, la especialidad y el teléfono, listo pa\' llamar. Tú buscas desde allá, ellos llaman desde acá.' },
      { h: 'Verifica que el médico existe de verdad', p: 'Cada perfil tiene su NPI, el número federal público del registro NPPES, con enlace pa\' verificarlo tú mismo. Nada de nombres regados en Facebook sin fuente.' },
      { h: 'Prepara la llamada antes de que llamen', p: 'Tarjeta del plan a mano, referido del primario, y las dos preguntas de oro: "¿aceptan el plan?" y "¿están cogiendo pacientes nuevos?". La lista completa está en cada página.' },
      { h: 'Si no puedes con las vueltas, cuéntame', p: 'En el registro hay un formulario corto. Me dices a quién cuidas y qué necesita, y te escribo yo mismo. Sin compromiso y sin buzón muerto.' },
    ],
    specs: ['geriatra', 'cardiólogo', 'neumólogo', 'oncólogo', 'nefrólogo'],
    faq: [
      { q: '¿Cómo ayudo a mis padres en Puerto Rico a conseguir un especialista si vivo en Estados Unidos?', a: 'Busca el especialista en el registro verificado (registromedicopr.com), confirma que existe con su NPI federal, y envíale la información completa por WhatsApp con el botón de la página. Prepara a tu familiar con las preguntas clave antes de llamar: si aceptan su plan y si están cogiendo pacientes nuevos.' },
      { q: '¿Cómo verifico que un médico en Puerto Rico es real?', a: 'Todo proveedor legítimo tiene un NPI, un número público del registro federal NPPES que usan Medicare y los planes médicos. En registromedicopr.com cada perfil muestra su NPI con enlace directo al registro federal para verificarlo.' },
    ],
  },
  {
    slug: 'acabo-de-llegar', e: '🧳',
    title: 'Acabo de llegar a Puerto Rico, ¿cómo consigo médico?',
    metaDesc: 'Si te mudaste o regresaste a Puerto Rico: cómo funciona el sistema médico, por qué tu plan de allá puede no servir, y cómo conseguir primario y especialista.',
    who: 'Pa\' quien se mudó o regresó a PR y no sabe por dónde empezar con lo médico.',
    intro: 'Regresar es un revolú de papeles, y la salud es el que más asusta. Vamos por partes, que esto se resuelve en orden.',
    steps: [
      { h: 'Primero un médico primario, después el especialista', p: 'En Puerto Rico casi todo pasa por referido. Sin primario, cada especialista es una puerta cerrada. Consíguelo primero aunque estés sano.' },
      { h: 'Tu plan de allá probablemente no funciona igual aquí', p: 'Medicare Original sí viaja. Los Medicare Advantage y los planes de empleador de allá casi nunca cubren igual acá. Llama a tu plan antes de la primera cita, no después.' },
      { h: 'Cuando escojas plan nuevo, pregunta por la red', p: 'Aquí la mayoría de los planes Medicare son Advantage con redes cerradas. El especialista que quieres puede no estar en la red del plan que te están vendiendo. Verifica antes de firmar.' },
      { h: 'Mira qué especialistas hay en tu región antes de escoger pueblo', p: 'Hay regiones enteras sin ciertos especialistas. Si tienes una condición, revisa el registro y el mapa de desiertos médicos antes de decidir dónde vivir.' },
    ],
    specs: ['cardiólogo', 'endocrinologo', 'psiquiatra', 'reumatólogo'],
    faq: [
      { q: '¿Mi plan médico de Estados Unidos funciona en Puerto Rico?', a: 'Depende. Medicare Original funciona en Puerto Rico porque es parte de Estados Unidos. Los planes Medicare Advantage y la mayoría de los planes de empleador tienen redes locales y casi nunca cubren igual en la isla. Llama a tu plan antes de tu primera cita.' },
      { q: '¿Necesito referido para ver un especialista en Puerto Rico?', a: 'En la mayoría de los casos sí. El sistema en Puerto Rico funciona por referido del médico primario, y muchas oficinas de especialistas no dan cita sin uno. Lo primero al llegar es conseguir médico primario.' },
    ],
  },
  {
    slug: 'no-hay-en-mi-pueblo', e: '🏜️',
    title: 'En mi pueblo no hay el especialista que necesito',
    metaDesc: 'Qué hacer cuando en tu pueblo o región de Puerto Rico no hay el especialista que necesitas: dónde está el más cerca, telemedicina y cómo cuadrar el viaje.',
    who: 'Pa\' quien vive donde el especialista más cerca queda a hora y media.',
    intro: 'No es idea tuya y no es tu culpa: hay 36 pueblos sin psiquiatra y regiones enteras sin geriatra ni neumólogo. Lo documentamos con datos federales pa\' que se vea. Mientras lo grande se arregla, esto es lo que puedes hacer hoy.',
    steps: [
      { h: 'Mira dónde está el más cerca de verdad', p: 'En el registro ves cuántos hay en cada región con nombre y teléfono. A veces el más cerca no está en el área metro sino en la región de al lado.' },
      { h: 'Pide el referido con tiempo y cuadra una sola ida', p: 'Si te toca viajar, trata de cuadrar laboratorios, estudios y la cita el mismo día. Dilo en la oficina cuando llames: ayudan más de lo que crees.' },
      { h: 'Pregunta por telemedicina', p: 'Pa\' seguimiento y resultados, muchos especialistas atienden por video y te ahorras el viaje completo. La primera cita a veces tiene que ser presencial, las demás no siempre.' },
      { h: 'Mira el mapa de los desiertos médicos, y compártelo', p: 'Documentamos qué hay y qué no hay en cada pueblo, con la fuente federal al lado. Esto empieza a cambiar cuando se ve.' },
    ],
    specs: ['psiquiatra', 'geriatra', 'neumólogo', 'neurocirujano', 'otorrinolaringólogo'],
    faq: [
      { q: '¿Qué hago si en mi pueblo no hay el especialista que necesito?', a: 'Busca en el registro verificado dónde está el más cercano por región (a veces la región vecina tiene más disponibilidad que el área metro), pide el referido con tiempo, trata de cuadrar estudios y cita el mismo día si te toca viajar, y pregunta si el seguimiento puede ser por telemedicina.' },
      { q: '¿Qué son los desiertos médicos de Puerto Rico?', a: 'Son pueblos y regiones donde no ejerce ningún especialista de cierto tipo según el registro federal NPPES. Por ejemplo, hay 36 municipios sin psiquiatra, y la región central no tiene neumólogos, geriatras ni otorrinos. El mapa completo está en registromedicopr.com/registro/desiertos.' },
    ],
  },
]

// Versión EN de cada página de intención (la diáspora es la audiencia #1 que paga).
const INTENT_EN: Record<string, { title: string; metaDesc: string; who: string; intro: string; steps: Array<{ h: string; p: string }>; faq: Array<{ q: string; a: string }> }> = {
  'cita-rapido': {
    title: 'I need a specialist appointment, fast',
    metaDesc: 'How to get a specialist appointment in Puerto Rico faster: referral, cancellation lists, when to call, and widening your region. Concrete steps, free.',
    who: 'For when they gave you an appointment months out and you cannot wait that long.',
    intro: 'You called and they gave you an appointment four months out. Breathe: it is not that there is no way, it is that nobody taught you the moves. None of these require knowing anyone.',
    steps: [
      { h: 'Ask for the referral today', p: 'The primary doctor is the key. Without a referral, many offices will not even take your call. Ask for it by phone today, do not wait for your next visit.' },
      { h: 'Ask to be put on the cancellation list', p: 'Almost every office has one and almost nobody asks. Someone cancels nearly every week, and that slot goes to whoever is on the list.' },
      { h: 'Call between 8 and 9 in the morning', p: 'That is when offices set up their day and release slots. After noon there is almost never anything left.' },
      { h: 'Widen the region', p: 'The same specialist with a 4-month wait in your region may have space in 2 weeks in the next one. The registry shows how many there are in each region, with phone numbers.' },
      { h: 'Ask about telemedicine', p: 'For follow-ups and results, many see patients by video. Sometimes the first evaluation too. Asking costs nothing.' },
    ],
    faq: [
      { q: 'How do I get a specialist appointment faster in Puerto Rico?', a: 'Ask your primary doctor for the referral by phone the same day, ask the office to put you on their cancellation list, call between 8 and 9 AM, and consider specialists in neighboring regions, where the wait can be weeks instead of months.' },
      { q: 'What is a medical office cancellation list?', a: 'A list of patients willing to take slots that open when someone cancels. Almost every office has one, but you have to ask. It is one of the most effective ways to move up an appointment.' },
    ],
  },
  'no-tengo-plan': {
    title: 'I have no health insurance, where do I go?',
    metaDesc: 'Medical options in Puerto Rico without insurance: Vital, federally funded 330 community health centers with sliding-scale fees, and cash office rates. In plain language.',
    who: 'For when you have no coverage and keep postponing the doctor because of it.',
    intro: 'Not having a plan does not mean there is no door. There are options that cost little or nothing, and none require waiting for things to get worse.',
    steps: [
      { h: 'Check if you qualify for Vital', p: "The government health plan covers more people than folks think, including working adults. Apply at your town's Medicaid office. Bring ID, proof of income, and proof of address." },
      { h: '330 centers see you with or without insurance', p: 'These are federally funded community clinics that charge based on what you earn. They exist across most of the island, covering primary care, dental, and mental health.' },
      { h: 'Ask for the cash price', p: 'Many offices have a self-pay rate that is lower than you imagine, especially for a consultation. Asking costs nothing.' },
      { h: 'The ER is for emergencies', p: 'Federal law requires them to evaluate you even without insurance. But for non-emergencies you leave with a big bill and a long wait. Use the other doors first.' },
    ],
    faq: [
      { q: 'Where can I see a doctor in Puerto Rico without health insurance?', a: "Three doors: apply for Vital (the government health plan) at your town's Medicaid office, go to a federally funded 330 community health center that charges on a sliding scale, or ask the office for their cash rate, which is usually lower than expected." },
      { q: 'What is a 330 center in Puerto Rico?', a: 'A federally funded community clinic (Section 330) that sees everyone, with or without insurance, charging on a sliding scale by income. They offer primary, dental, and mental health care across most of the island.' },
    ],
  },
  'cuido-a-mis-padres-desde-afuera': {
    title: 'I care for my parents in Puerto Rico from the States',
    metaDesc: 'How to help your parents in Puerto Rico find a specialist when you live in the US: federally verified registry, WhatsApp handoff, and direct help.',
    who: "For the daughter in Orlando or the son in New York managing their parents' care by remote control.",
    intro: 'You are there and your mom is here. Every medical errand is a chain of calls on a schedule that is not yours, with information nobody confirms. This registry was built with you in mind.',
    steps: [
      { h: 'Find the specialist here and send it by WhatsApp', p: 'Every specialist page has a button that sends your relative the name, specialty, and phone number, ready to call. You search from there, they call from here.' },
      { h: 'Verify the doctor actually exists', p: 'Every profile shows its NPI, the public federal number from the NPPES registry, with a link to verify it yourself. No unsourced names floating around Facebook.' },
      { h: 'Prep the call before they call', p: 'Plan card at hand, referral from the primary, and the two golden questions: "do you take the plan?" and "are you taking new patients?". The full checklist is on every page.' },
      { h: 'If the runaround is too much, tell me', p: 'There is a short form in the registry. Tell me who you care for and what they need, and I will write you back myself. No obligation and no dead inbox.' },
    ],
    faq: [
      { q: 'How do I help my parents in Puerto Rico find a specialist if I live in the US?', a: 'Search the verified registry (registromedicopr.com), confirm the provider exists via their federal NPI, and send the full info to your relative by WhatsApp with the page button. Prep them with the key questions before calling: whether the office takes their plan and whether they accept new patients.' },
      { q: 'How do I verify a doctor in Puerto Rico is real?', a: 'Every legitimate provider has an NPI, a public number in the federal NPPES registry used by Medicare and health plans. On registromedicopr.com every profile shows its NPI with a direct link to the federal registry.' },
    ],
  },
  'acabo-de-llegar': {
    title: 'I just moved (back) to Puerto Rico, how do I find a doctor?',
    metaDesc: 'If you moved or returned to Puerto Rico: how the medical system works, why your stateside plan may not travel, and how to get a primary and a specialist.',
    who: 'For anyone who moved or returned to PR and does not know where to start with healthcare.',
    intro: "Moving back is a pile of paperwork, and healthcare is the scariest pile. Let's take it in order, because this gets solved step by step.",
    steps: [
      { h: 'First a primary doctor, then the specialist', p: 'In Puerto Rico almost everything runs on referrals. Without a primary, every specialist is a closed door. Get one first, even while healthy.' },
      { h: 'Your stateside plan probably does not work the same here', p: 'Original Medicare travels. Medicare Advantage and employer plans from the mainland almost never cover the same here. Call your plan before the first appointment, not after.' },
      { h: 'When picking a new plan, ask about the network', p: 'Most Medicare plans here are Advantage plans with closed networks. The specialist you want may not be in the network of the plan being sold to you. Verify before signing.' },
      { h: 'Check what specialists your region has before picking a town', p: 'Entire regions lack certain specialists. If you have a condition, check the registry and the medical deserts map before deciding where to live.' },
    ],
    faq: [
      { q: 'Does my US health insurance work in Puerto Rico?', a: 'It depends. Original Medicare works in Puerto Rico since it is part of the United States. Medicare Advantage plans and most employer plans have local networks and almost never cover the same on the island. Call your plan before your first appointment.' },
      { q: 'Do I need a referral to see a specialist in Puerto Rico?', a: 'In most cases yes. The system in Puerto Rico runs on primary-doctor referrals, and many specialist offices will not book without one. The first step after arriving is getting a primary doctor.' },
    ],
  },
  'no-hay-en-mi-pueblo': {
    title: 'My town does not have the specialist I need',
    metaDesc: 'What to do when your town or region in Puerto Rico lacks the specialist you need: where the nearest one is, telemedicine, and planning the trip.',
    who: 'For anyone whose nearest specialist is an hour and a half away.',
    intro: 'It is not your imagination and it is not your fault: 36 towns have no psychiatrist and entire regions lack geriatricians and pulmonologists. We documented it with federal data so it can be seen. While the big fix happens, here is what you can do today.',
    steps: [
      { h: 'Find where the truly nearest one is', p: 'The registry shows how many there are in each region with names and phone numbers. Sometimes the nearest is not in the metro area but in the region next door.' },
      { h: 'Get the referral early and bundle one trip', p: 'If you have to travel, try to schedule labs, studies, and the appointment on the same day. Say so when you call: offices help more than you would think.' },
      { h: 'Ask about telemedicine', p: 'For follow-ups and results, many specialists see patients by video and you save the whole trip. The first visit sometimes has to be in person; the rest often do not.' },
      { h: 'Look at the medical deserts map, and share it', p: 'We documented what exists and what is missing in every town, with the federal source next to it. This starts to change when it is seen.' },
    ],
    faq: [
      { q: 'What do I do if my town has no specialist I need?', a: 'Check the verified registry for the nearest one by region (sometimes the neighboring region has more availability than the metro area), get the referral early, bundle studies and the appointment into one trip if you must travel, and ask whether follow-ups can be done by telemedicine.' },
      { q: "What are Puerto Rico's medical deserts?", a: 'Towns and regions where no specialist of a given type practices according to the federal NPPES registry. For example, 36 municipalities have no psychiatrist, and the central region has no pulmonologists, geriatricians, or ENTs. The full map is at registromedicopr.com/registro/desiertos.' },
    ],
  },
}

async function handleNecesito(req: any, res: any) {
  const intentSlug = String(req.query.intent || '').toLowerCase().trim()
  const en = String(req.query.lang || '') === 'en'
  const lp = en ? '?lang=en' : ''
  const te = (es: string, env: string) => en ? env : es
  const page = intentSlug ? INTENT_PAGES.find(p => p.slug === intentSlug) : null
  if (intentSlug && !page) { res.statusCode = 302; res.setHeader('Location', '/necesito'); res.end(); return }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300')

  if (!page) {
    // Índice: ¿cuál es tu situación?
    const cards = INTENT_PAGES.map(p => {
      const L = en && INTENT_EN[p.slug] ? INTENT_EN[p.slug] : p
      return `
      <a href="/necesito/${p.slug}${lp}" class="block bg-white border border-slate-200 rounded-2xl p-5 hover:border-teal-400 hover:shadow-sm transition">
        <div class="text-3xl leading-none">${p.e}</div>
        <div class="font-bold text-slate-900 mt-2 leading-snug">${escapeHtml(L.title)}</div>
        <div class="text-sm text-slate-500 mt-1">${escapeHtml(L.who)}</div>
      </a>`
    }).join('')
    const body = `
<h1>${te('¿Cuál es tu situación?', 'What is your situation?')}</h1>
<p class="text-lg text-slate-600 mt-2">${te('La gente no busca "neumólogo". Busca "necesito cita rápido" o "cuido a mami desde afuera". Empieza por la tuya: cada una tiene pasos concretos, sin vueltas.', 'People do not search for "pulmonologist". They search for "I need an appointment fast" or "I care for mom from afar". Start with yours: each one has concrete steps, no runaround.')}</p>
<div class="not-prose mt-5 grid sm:grid-cols-2 gap-3">${cards}</div>
<p class="not-prose mt-6 text-sm text-slate-500">${te('¿Lo tuyo es directo?', 'Know exactly what you need?')} <a href="/registro${lp}" class="text-teal-700 font-semibold">${te('Busca por especialidad y región →', 'Search by specialty and region →')}</a></p>
${regDisclaimer(en)}`
    res.status(200).send(layout({
      title: te("¿Cuál es tu situación? · Guías pa' resolver lo médico en PR", 'What is your situation? · Practical healthcare guides for PR'),
      description: te('Guías por situación real: cita rápido, sin plan médico, cuidando a tus padres desde afuera, recién llegado, o sin especialista en tu pueblo. Pasos concretos, gratis.', 'Guides by real situation: fast appointment, no insurance, caring for your parents from the States, just moved back, or no specialist in your town. Concrete steps, free.'),
      slug: 'necesito', bodyHtml: body,
      jsonLd: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: te('¿Cuál es tu situación? · Registro Médico PR', 'What is your situation? · Registro Médico PR'), url: 'https://registromedicopr.com/necesito', inLanguage: en ? 'en' : 'es' },
      ogImage: '/og/registro.png', host: req.headers?.host, canonicalHost: 'https://registromedicopr.com',
      canonicalUrl: 'https://registromedicopr.com/necesito',
      lang: en ? 'en' : 'es',
    }))
    return
  }

  const L = en && INTENT_EN[page.slug] ? INTENT_EN[page.slug] : page
  const specChips = page.specs.map(s => {
    const x = REGISTRY_SPECS.find(r => r.s === s)
    if (!x) return ''
    const lbl = en ? (SPEC_LABEL_EN[x.s] || x.l) : x.l
    return `<a href="/registro/${specToUrl(x.s)}${lp}" class="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 text-teal-800 font-semibold px-3 py-1.5 rounded-full text-sm hover:bg-teal-100">${x.e} ${escapeHtml(lbl)} (${x.t})</a>`
  }).join(' ')

  const stepsHtml = L.steps.map((s, i) => `
    <div class="flex gap-4 items-start bg-white border border-slate-200 rounded-2xl p-5">
      <div class="w-8 h-8 rounded-full bg-teal-700 text-white font-black flex items-center justify-center shrink-0">${i + 1}</div>
      <div><p class="font-bold text-slate-900">${escapeHtml(s.h)}</p><p class="text-sm text-slate-600 mt-1">${escapeHtml(s.p)}</p></div>
    </div>`).join('')

  const body = `
<nav class="not-prose text-sm text-slate-500 mb-3"><a href="/registro${lp}" class="hover:text-teal-700">Registro Médico PR</a> <span class="text-slate-300">/</span> <a href="/necesito${lp}" class="hover:text-teal-700">${te('¿Cuál es tu situación?', 'Your situation')}</a> <span class="text-slate-300">/</span> <span class="text-slate-700">${escapeHtml(L.title)}</span></nav>
<div class="not-prose flex items-start gap-4">
  <div class="text-5xl leading-none">${page.e}</div>
  <div>
    <h1 class="text-3xl font-black text-slate-900 leading-tight">${escapeHtml(L.title)}</h1>
    <p class="text-slate-500 mt-1">${escapeHtml(L.who)}</p>
  </div>
</div>
<p class="text-lg text-slate-700 mt-4">${escapeHtml(L.intro)}</p>
<div class="not-prose mt-5 space-y-3">${stepsHtml}</div>
${antesDeLlamar({ en })}
${specChips ? `<h2>${te('Especialistas que suelen tocar en esto', 'Specialists usually involved here')}</h2>
<p class="text-slate-600 -mt-2">${te('Cada uno con cuántos hay en la isla, por región y con teléfono, verificados contra el registro federal.', 'Each with how many exist on the island, by region and with phone numbers, verified against the federal registry.')}</p>
<div class="not-prose mt-3 flex flex-wrap gap-2">${specChips}</div>` : ''}
<div class="not-prose mt-8 bg-teal-700 rounded-2xl p-6 text-center text-white">
  <p class="text-lg font-bold mb-1">${te("¿Sigues trancao'?", 'Still stuck?')}</p>
  <p class="text-sm text-teal-100 mb-4">${te('Escríbele al Veci al', 'Text El Veci at')} <strong>${PHONE_CTA}</strong>${te(', o déjale una nota a Angel en el registro y te escribe él mismo.', ', or leave Angel a note in the registry and he will write you back himself.')}</p>
  <div class="flex flex-wrap gap-3 justify-center">
    <a href="https://wa.me/17874177711?text=ESPECIALISTA" class="inline-flex items-center gap-2 bg-white text-teal-800 font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-50"><i class="fa-brands fa-whatsapp text-lg"></i> ESPECIALISTA</a>
    <a href="/registro${lp}" class="inline-flex items-center gap-2 bg-teal-800 text-white font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-900"><i class="fa-solid fa-magnifying-glass"></i> ${te('Buscar en el registro', 'Search the registry')}</a>
  </div>
</div>
${regDisclaimer(en)}
<p class="not-prose mt-5 text-sm text-slate-500"><a href="/necesito${lp}" class="text-teal-700 font-semibold">${te('← Ver las otras situaciones', '← See the other situations')}</a></p>`

  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: L.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'HowTo', name: L.title, description: L.metaDesc, inLanguage: en ? 'en' : 'es',
      step: L.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.h, text: s.p })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Registro Médico PR', item: 'https://registromedicopr.com/registro' },
      { '@type': 'ListItem', position: 2, name: te('¿Cuál es tu situación?', 'Your situation'), item: 'https://registromedicopr.com/necesito' },
      { '@type': 'ListItem', position: 3, name: L.title, item: `https://registromedicopr.com/necesito/${page.slug}` },
    ] },
  ]
  res.status(200).send(layout({
    title: te(`${L.title} · guía práctica PR`, `${L.title} · practical guide, Puerto Rico`),
    description: L.metaDesc,
    slug: `necesito/${page.slug}`, bodyHtml: body, jsonLd,
    ogImage: '/og/registro.png', host: req.headers?.host, canonicalHost: 'https://registromedicopr.com',
    canonicalUrl: `https://registromedicopr.com/necesito/${page.slug}`,
    lang: en ? 'en' : 'es',
  }))
}

// =============== /pueblo/:municipio — el semáforo de acceso médico de cada pueblo (78 páginas) ===============
// La jugada: el registro no solo contesta "busca un médico", contesta "¿cómo está MI pueblo?".
// Data SIEMPRE de las vistas canónicas (v_registro_muni_ratio / v_registro_muni_spec) — nunca
// places.region crudo (lección 2026-07-05: el mapeo municipio→región de places produce artefactos).
const PUEBLO_REGION_CAP: Record<string, string> = { metro: 'Metro', oeste: 'Oeste', norte: 'Norte', sur: 'Sur', este: 'Este', centro: 'Centro' }
const PUEBLO_HIGH_NEED = ['psiquiatra', 'cardiólogo', 'pediatra', 'ginecólogo', 'geriatra', 'neumólogo', 'endocrinologo', 'oncólogo', 'neurologo', 'gastroenterólogo']
const HPSA_DISC_ES: Record<string, string> = { 'Primary Care': 'cuidado primario', 'Dental Health': 'salud dental', 'Mental Health': 'salud mental' }
function puebloSemaforo(por10k: number): { e: string; label: string; bg: string; bd: string } {
  if (por10k >= 15) return { e: '🟢', label: 'acceso alto', bg: '#ecfdf5', bd: '#6ee7b7' }
  if (por10k >= 5) return { e: '🟡', label: 'acceso medio', bg: '#fffbeb', bd: '#fcd34d' }
  return { e: '🔴', label: 'acceso bajo', bg: '#fef2f2', bd: '#fca5a5' }
}

async function handlePueblo(req: any, res: any) {
  const slug = String(req.query.m || '').toLowerCase().trim()
  const en = String(req.query.lang || '') === 'en'
  const lp = en ? '?lang=en' : ''
  const te = (es: string, env: string) => en ? env : es
  const { data: muniData } = await supabase
    .from('v_registro_muni_ratio')
    .select('municipio,region,poblacion,especialistas,psiquiatras,por_10k_hab')
  const all = (muniData || []).map((r: any) => ({
    municipio: r.municipio as string, region: (r.region || '') as string,
    poblacion: Number(r.poblacion) || 0, especialistas: Number(r.especialistas) || 0,
    psiquiatras: Number(r.psiquiatras) || 0, por: Number(r.por_10k_hab) || 0,
  })).sort((a, b) => a.por - b.por)
  if (!all.length) { res.status(503).send('Data no disponible, intenta de nuevo'); return }
  const sorted = all.map(x => x.por).slice().sort((a, b) => a - b)
  const mediana = sorted[Math.floor(sorted.length / 2)]
  const rojos = all.filter(x => x.por < 5).length
  const ceros = all.filter(x => x.especialistas === 0)

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600')

  // ---------- Índice: el ranking de los 78 ----------
  if (!slug) {
    const rows = all.map((x, i) => {
      const sem = puebloSemaforo(x.por)
      return `<tr class="border-t border-slate-100 pueblo-row" data-n="${escapeHtml(specToUrl(x.municipio))}">
        <td class="py-2 px-3 text-slate-400 text-xs">${i + 1}</td>
        <td class="py-2 px-3"><a href="/pueblo/${specToUrl(x.municipio)}${lp}" class="font-semibold text-slate-800 hover:text-teal-700 hover:underline">${sem.e} ${escapeHtml(x.municipio)}</a></td>
        <td class="py-2 px-3 text-slate-500 text-sm">${escapeHtml(PUEBLO_REGION_CAP[x.region] || x.region)}</td>
        <td class="py-2 px-3 text-right font-semibold text-slate-700">${x.especialistas.toLocaleString('en-US')}</td>
        <td class="py-2 px-3 text-right font-black ${x.por < 5 ? 'text-red-600' : x.por < 15 ? 'text-amber-600' : 'text-emerald-700'}">${x.por.toFixed(1)}</td>
      </tr>`
    }).join('')
    const body = `
<h1>${te('¿Cómo está tu pueblo?', 'How is your town doing?')}</h1>
<p class="text-lg text-slate-600 mt-2">${te("Los 78 municipios de Puerto Rico, rankeados por especialistas médicos verificados por cada 10,000 habitantes. Fuente: registro federal NPPES + Censo. Toca tu pueblo pa' ver qué hay, qué falta y dónde queda lo más cerca.", 'All 78 municipalities of Puerto Rico, ranked by verified medical specialists per 10,000 residents. Source: federal NPPES registry + Census. Tap your town to see what it has, what is missing, and where the nearest one is.')}</p>
<div class="not-prose mt-4 grid sm:grid-cols-3 gap-3">
  <div class="bg-red-50 border border-red-200 rounded-xl p-4"><div class="text-3xl font-black text-red-600">${rojos}</div><div class="text-sm text-slate-600 mt-1">${te('pueblos en rojo (menos de 5 por cada 10 mil)', 'towns in red (fewer than 5 per 10,000)')}</div></div>
  <div class="bg-slate-50 border border-slate-200 rounded-xl p-4"><div class="text-3xl font-black text-slate-800">${ceros.length}</div><div class="text-sm text-slate-600 mt-1">${te('pueblos con CERO especialistas', 'towns with ZERO specialists')}${ceros.length ? `: ${escapeHtml(ceros.map(z => z.municipio).join(', '))}` : ''}</div></div>
  <div class="bg-teal-50 border border-teal-200 rounded-xl p-4"><div class="text-3xl font-black text-teal-700">${mediana.toFixed(1)}</div><div class="text-sm text-slate-600 mt-1">${te('la mediana de la isla, por cada 10 mil habitantes', 'the island median, per 10,000 residents')}</div></div>
</div>
<div class="not-prose mt-5">
  <input id="pb-filter" type="search" placeholder="${te('Busca tu pueblo…', 'Find your town…')}" class="w-full rounded-lg border border-slate-300 p-3 text-base" autocomplete="off">
</div>
<div class="not-prose mt-3 overflow-auto border border-slate-200 rounded-xl">
  <table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th class="py-2 px-3">#</th><th class="py-2 px-3">${te('Pueblo', 'Town')}</th><th class="py-2 px-3">${te('Región', 'Region')}</th><th class="py-2 px-3 text-right">${te('Especialistas', 'Specialists')}</th><th class="py-2 px-3 text-right">${te('Por 10 mil', 'Per 10,000')}</th></tr></thead><tbody id="pb-body">${rows}</tbody></table>
</div>
<p class="not-prose text-xs text-slate-500 mt-2">${te('🔴 menos de 5 por 10 mil · 🟡 de 5 a 15 · 🟢 más de 15. El ranking va del más desatendido al mejor servido. Semáforo por cantidad, no por distancia: un pueblo pequeño al lado de Mayagüez puede estar en rojo y aun así tener el especialista a 15 minutos.', '🔴 fewer than 5 per 10,000 · 🟡 5 to 15 · 🟢 more than 15. Ranked from most underserved to best served. The light measures quantity, not distance: a small town next to Mayagüez can be red and still have the specialist 15 minutes away.')}</p>
<script>
(function(){var f=document.getElementById('pb-filter'),b=document.getElementById('pb-body');if(!f)return;
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');}
f.addEventListener('input',function(){var q=norm(f.value.trim());Array.prototype.forEach.call(b.querySelectorAll('.pueblo-row'),function(r){r.style.display=!q||r.getAttribute('data-n').indexOf(q)>=0?'':'none';});});})();
</script>
${shareRow({ text: te(`¿Cuántos médicos especialistas tiene tu pueblo? Los 78 municipios de PR rankeados con data federal. ${rojos} están en rojo y ${ceros.length} tienen CERO.`, `How many medical specialists does your hometown in Puerto Rico have? All 78 municipalities ranked with federal data. ${rojos} are in red and ${ceros.length} have ZERO.`), url: 'https://registromedicopr.com/pueblo', toWho: te('Al grupo de la familia o del pueblo. Cada cual busca el suyo.', 'To the family or hometown group chat. Everyone looks up their own.') })}
${regDisclaimer(en)}
${SHARE_COPY_SCRIPT}`
    const jsonLd = [
      { '@context': 'https://schema.org', '@type': 'Dataset', name: 'Acceso a especialistas médicos por municipio de Puerto Rico',
        description: `Los 78 municipios de Puerto Rico rankeados por especialistas médicos verificados (NPPES) por cada 10,000 habitantes. Mediana de la isla: ${mediana.toFixed(1)}. ${rojos} municipios bajo 5 por 10,000. ${ceros.length} municipios con cero especialistas.`,
        url: 'https://registromedicopr.com/pueblo', inLanguage: 'es', license: 'https://creativecommons.org/licenses/by/4.0/',
        creator: { '@type': 'Organization', name: 'Registro Médico PR', url: 'https://registromedicopr.com' } },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
        { '@type': 'Question', name: '¿Qué municipios de Puerto Rico tienen menos médicos especialistas?',
          acceptedAnswer: { '@type': 'Answer', text: `Según el registro federal NPPES, ${ceros.length ? ceros.map(z => z.municipio).join(', ') + ' no tienen ningún especialista verificado, y ' : ''}${rojos} de los 78 municipios tienen menos de 5 especialistas por cada 10,000 habitantes. El detalle por pueblo está en registromedicopr.com/pueblo.` } },
        { '@type': 'Question', name: '¿Cuál es la mediana de especialistas médicos por municipio en Puerto Rico?',
          acceptedAnswer: { '@type': 'Answer', text: `La mediana es ${mediana.toFixed(1)} especialistas verificados por cada 10,000 habitantes. San Juan concentra el máximo con ${Math.max(...all.map(x => x.por)).toFixed(1)}.` } },
      ] },
    ]
    res.status(200).send(layout({
      title: te('¿Cómo está tu pueblo? Semáforo de acceso médico de los 78 municipios', 'How is your town doing? Medical access across all 78 PR municipalities'),
      description: te(`Los 78 municipios de PR rankeados por especialistas verificados por cada 10,000 habitantes. ${rojos} en rojo, ${ceros.length} con cero. Data federal NPPES, en español.`, `All 78 PR municipalities ranked by verified specialists per 10,000 residents. ${rojos} in red, ${ceros.length} with zero. Federal NPPES data.`),
      slug: 'pueblo', bodyHtml: body, jsonLd, ogImage: '/og/desiertos.png',
      host: req.headers?.host, canonicalHost: 'https://registromedicopr.com',
      canonicalUrl: 'https://registromedicopr.com/pueblo',
      lang: en ? 'en' : 'es',
    }))
    return
  }

  // ---------- Página de un pueblo ----------
  const town = all.find(x => specToUrl(x.municipio) === slug)
  if (!town) { res.statusCode = 302; res.setHeader('Location', '/pueblo'); res.end(); return }
  const rank = all.findIndex(x => x.municipio === town.municipio) + 1
  const sem = puebloSemaforo(town.por)
  const semLabelEn = town.por >= 15 ? 'high access' : town.por >= 5 ? 'medium access' : 'low access'
  const semLabel = en ? semLabelEn : sem.label
  const regionCap = PUEBLO_REGION_CAP[town.region] || town.region
  const pageUrl = `https://registromedicopr.com/pueblo/${slug}`

  const [{ data: specRows }, { data: hpsaRows }] = await Promise.all([
    supabase.from('v_registro_muni_spec').select('subcategory,n').eq('municipio', town.municipio),
    supabase.from('hpsa_designations').select('discipline,score').eq('municipio', town.municipio).order('score', { ascending: false }),
  ])
  const present = (specRows || [])
    .filter((r: any) => REGISTRY_BYSUB[r.subcategory])
    .map((r: any) => ({ sub: r.subcategory as string, n: Number(r.n) || 0 }))
    .filter(r => r.n > 0)
    .sort((a, b) => b.n - a.n)
  const presentSet = new Set(present.map(p => p.sub))
  const missing = PUEBLO_HIGH_NEED.filter(s => !presentSet.has(s)).map(s => REGISTRY_BYSUB[s]).filter(Boolean)

  const specLbl = (x: any) => en ? (SPEC_LABEL_EN[x.s] || x.l) : x.l
  const presentChips = present.map(p => {
    const x = REGISTRY_BYSUB[p.sub]
    return `<a href="/registro/${specToUrl(p.sub)}${lp}" class="inline-flex items-center gap-1.5 bg-white border border-teal-200 text-teal-800 font-semibold px-3 py-1.5 rounded-full text-sm hover:bg-teal-50">${x.e} ${escapeHtml(specLbl(x))} <span class="font-black">${p.n}</span></a>`
  }).join(' ')

  const missingRows = missing.map((x: any) => {
    const regionN = (x.r as any)[regionCap] || 0
    const near = regionN > 0
      ? te(`en el ${regionCap} hay <a href="/registro/${specToUrl(x.s)}/${specToUrl(regionCap)}${lp}" class="text-teal-700 font-semibold hover:underline">${regionN} →</a>`, `the ${regionCap} region has <a href="/registro/${specToUrl(x.s)}/${specToUrl(regionCap)}${lp}" class="text-teal-700 font-semibold hover:underline">${regionN} →</a>`)
      : te(`en el ${regionCap} tampoco: el grupo grande está <a href="/registro/${specToUrl(x.s)}/metro${lp}" class="text-teal-700 font-semibold hover:underline">en el área metro (${x.r.Metro || 0}) →</a>`, `none in the ${regionCap} region either: the largest group is <a href="/registro/${specToUrl(x.s)}/metro${lp}" class="text-teal-700 font-semibold hover:underline">in the metro area (${x.r.Metro || 0}) →</a>`)
    return `<li class="flex gap-2.5 items-start"><span class="text-red-500 font-black mt-0.5">✗</span><span class="text-sm text-slate-700"><strong>${x.e} ${escapeHtml(specLbl(x))}:</strong> ${te('aquí no hay ninguno verificado;', 'none verified here;')} ${near}</span></li>`
  }).join('')

  const hpsaBlock = (hpsaRows && hpsaRows.length) ? `
<div class="not-prose mt-6 bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
  <p class="font-bold text-indigo-900 text-base">🏛️ ${te('El gobierno federal ya reconoció la escasez aquí', 'The federal government already recognized the shortage here')}</p>
  <p class="text-sm text-indigo-800 mt-1">${escapeHtml(town.municipio)} ${te(`tiene ${hpsaRows.length === 1 ? 'una designación federal activa' : hpsaRows.length + ' designaciones federales activas'} de escasez de proveedores (HPSA):`, `has ${hpsaRows.length === 1 ? 'an active federal provider-shortage designation' : hpsaRows.length + ' active federal provider-shortage designations'} (HPSA):`)} ${hpsaRows.map((h: any) => `${escapeHtml(en ? h.discipline : (HPSA_DISC_ES[h.discipline] || h.discipline))} (${te('puntuación', 'score')} ${escapeHtml(String(h.score))}/25)`).join(' · ')}. ${te('Eso no es opinión nuestra: es HRSA, la agencia federal de salud.', 'That is not our opinion: it is HRSA, the federal health agency.')} <a href="/registro/estado" class="font-semibold underline">${te('Lo que eso significa y el dinero que trae →', 'What that means and the money it brings →')}</a></p>
</div>` : ''

  // 📋 Datos citables del pueblo — cada dato con botón Copiar y la fuente pegada (prensa, alcaldías, IA)
  const fuente = te(`Fuente: registro federal NPPES + Censo · registromedicopr.com/pueblo/${slug}`, `Source: federal NPPES registry + Census · registromedicopr.com/pueblo/${slug}`)
  const datos: string[] = []
  datos.push(te(
    `${town.municipio} tiene ${town.especialistas.toLocaleString('en-US')} especialistas médicos verificados para ${town.poblacion.toLocaleString('en-US')} habitantes: ${town.por.toFixed(1)} por cada 10,000. Puesto ${rank} de 78 municipios de Puerto Rico (mediana: ${mediana.toFixed(1)}).`,
    `${town.municipio} has ${town.especialistas.toLocaleString('en-US')} verified medical specialists for ${town.poblacion.toLocaleString('en-US')} residents: ${town.por.toFixed(1)} per 10,000. Rank ${rank} of Puerto Rico's 78 municipalities (median: ${mediana.toFixed(1)}).`))
  datos.push(town.psiquiatras === 0
    ? te(`${town.municipio} no tiene ni un solo psiquiatra verificado. Es uno de 36 municipios de Puerto Rico sin ninguno.`, `${town.municipio} has not a single verified psychiatrist. It is one of 36 Puerto Rico municipalities with none.`)
    : te(`${town.municipio} tiene ${town.psiquiatras} psiquiatra${town.psiquiatras === 1 ? '' : 's'} verificado${town.psiquiatras === 1 ? '' : 's'}. En Puerto Rico, 36 municipios no tienen ninguno.`, `${town.municipio} has ${town.psiquiatras} verified psychiatrist${town.psiquiatras === 1 ? '' : 's'}. In Puerto Rico, 36 municipalities have none.`))
  if (missing.length) datos.push(te(
    `En ${town.municipio} no hay práctica verificada de: ${missing.map((x: any) => x.l).join(', ')}.`,
    `${town.municipio} has no verified practice of: ${missing.map((x: any) => (SPEC_LABEL_EN[x.s] || x.l)).join(', ')}.`))
  if (hpsaRows && hpsaRows.length) datos.push(te(
    `${town.municipio} tiene designación federal de escasez (HPSA) activa de ${hpsaRows.map((h: any) => `${HPSA_DISC_ES[h.discipline] || h.discipline} (puntuación ${h.score}/25)`).join(' y ')}, según HRSA.`,
    `${town.municipio} has an active federal shortage designation (HPSA) for ${hpsaRows.map((h: any) => `${h.discipline} (score ${h.score}/25)`).join(' and ')}, per HRSA.`))
  const datosHtml = datos.map(d => `
    <div class="flex gap-3 items-start bg-white border border-slate-200 rounded-xl p-4">
      <div class="flex-1"><p class="text-sm text-slate-800">${escapeHtml(d)}</p><p class="text-xs text-slate-400 mt-1">${escapeHtml(fuente)}</p></div>
      <button type="button" class="share-copy shrink-0 inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-lg text-xs" data-copy="${escapeHtml(`${d} ${fuente}`)}"><i class="fa-regular fa-copy"></i> ${te('Copiar', 'Copy')}</button>
    </div>`).join('')

  const alertForm = `
<div class="not-prose mt-8 bg-amber-50 border-2 border-amber-200 rounded-2xl p-5">
  <p class="font-bold text-amber-900 text-base">🔔 ${te(`Te aviso cuando llegue uno nuevo a ${escapeHtml(town.municipio)}`, `I will let you know when a new one arrives in ${escapeHtml(town.municipio)}`)}</p>
  <p class="text-sm text-amber-800 mt-1">${te("Cuando un especialista nuevo aparezca verificado en el registro federal pa' este pueblo, te escribo. Nada más. Sin spam, sin lista de mercadeo.", 'When a new specialist shows up verified in the federal registry for this town, I will email you. That is it. No spam, no marketing list.')}</p>
  <form id="al-form" class="mt-3 grid sm:grid-cols-3 gap-3">
    <input id="al-email" type="email" required placeholder="${te('Tu email', 'Your email')}" class="sm:col-span-1 rounded-lg border border-amber-300 p-2.5 text-sm">
    <select id="al-spec" class="rounded-lg border border-amber-300 p-2.5 text-sm bg-white">
      <option value="">${te('Cualquier especialista', 'Any specialist')}</option>
      ${PUEBLO_HIGH_NEED.map(s => { const x = REGISTRY_BYSUB[s]; return x ? `<option value="${escapeHtml(s)}">${x.e} ${escapeHtml(specLbl(x))}</option>` : '' }).join('')}
    </select>
    <button type="submit" class="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm">${te('Avísame', 'Notify me')}</button>
  </form>
  <div id="al-ok" hidden class="mt-2 text-sm text-emerald-700 font-semibold">✓ ${te(`Anotado. Si llega uno nuevo a ${escapeHtml(town.municipio)}, te escribo. — Angel`, `Got it. If a new one arrives in ${escapeHtml(town.municipio)}, I will email you. — Angel`)}</div>
</div>
<script>
(function(){var f=document.getElementById('al-form');if(!f)return;
f.addEventListener('submit',function(ev){ev.preventDefault();
var em=document.getElementById('al-email').value.trim();if(!em)return;
var btn=f.querySelector('button');btn.disabled=true;btn.textContent='${te('Enviando…', 'Sending…')}';
try{gtag('event','alerta_pueblo',{municipio:'${specToUrl(town.municipio)}'})}catch(e){}
fetch('/api/mapa-pages?page=registro-alert',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:em,municipio:'${escapeHtml(town.municipio)}',specialty:document.getElementById('al-spec').value||null})})
.then(function(r){return r.json();}).then(function(){f.style.display='none';document.getElementById('al-ok').hidden=false;})
.catch(function(){btn.disabled=false;btn.textContent='${te('Avísame', 'Notify me')}';alert('${te('No se pudo enviar. Intenta de nuevo.', 'Could not send. Try again.')}');});});})();
</script>`

  const psiqNote = town.psiquiatras === 0
    ? `<p class="text-sm text-slate-600 mt-2">🧠 <strong>${te(`${escapeHtml(town.municipio)} es uno de los municipios sin un solo psiquiatra.`, `${escapeHtml(town.municipio)} is one of the municipalities without a single psychiatrist.`)}</strong> ${te('No es un caso aislado: son 36 en toda la isla.', 'It is not an isolated case: there are 36 across the island.')} <a href="/registro/desiertos${lp}" class="text-teal-700 font-semibold hover:underline">${te('El mapa completo →', 'The full map →')}</a></p>` : ''

  const body = `
<nav class="not-prose text-sm text-slate-500 mb-3"><a href="/registro${lp}" class="hover:text-teal-700">Registro Médico PR</a> <span class="text-slate-300">/</span> <a href="/pueblo${lp}" class="hover:text-teal-700">${te('¿Cómo está tu pueblo?', 'Your town')}</a> <span class="text-slate-300">/</span> <span class="text-slate-700">${escapeHtml(town.municipio)}</span></nav>
<h1>${te(`El acceso médico en ${escapeHtml(town.municipio)}`, `Medical access in ${escapeHtml(town.municipio)}`)}</h1>
<p class="text-lg text-slate-600 mt-2">${te(`${escapeHtml(town.municipio)} tiene <strong>${town.especialistas.toLocaleString('en-US')} especialistas verificados</strong> contra el registro federal pa' ${town.poblacion.toLocaleString('en-US')} habitantes: <strong>${town.por.toFixed(1)} por cada 10,000</strong>. La mediana de la isla es ${mediana.toFixed(1)}.`, `${escapeHtml(town.municipio)} has <strong>${town.especialistas.toLocaleString('en-US')} verified specialists</strong> in the federal registry for ${town.poblacion.toLocaleString('en-US')} residents: <strong>${town.por.toFixed(1)} per 10,000</strong>. The island median is ${mediana.toFixed(1)}.`)}</p>
<div class="not-prose mt-4" style="background:${sem.bg};border:2px solid ${sem.bd};border-radius:16px;padding:18px 20px;">
  <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
    <span class="text-4xl">${sem.e}</span>
    <div>
      <div class="font-black text-slate-900 text-xl leading-tight">${semLabel.toUpperCase()}</div>
      <div class="text-sm text-slate-600">${te(`Puesto ${rank} de 78 municipios · región ${escapeHtml(regionCap)} · fuente NPPES federal + Censo`, `Rank ${rank} of 78 municipalities · ${escapeHtml(regionCap)} region · source: federal NPPES + Census`)}</div>
    </div>
  </div>
  ${psiqNote}
</div>
${hpsaBlock}
${present.length ? `<h2>${te(`Lo que HAY en ${escapeHtml(town.municipio)}`, `What ${escapeHtml(town.municipio)} HAS`)}</h2>
<p class="text-slate-600 -mt-2">${te("Toca cualquiera pa' ver la lista completa con nombres y teléfonos.", 'Tap any to see the full list with names and phone numbers.')}</p>
<div class="not-prose mt-3 flex flex-wrap gap-2">${presentChips}</div>` : `<h2>${te(`En ${escapeHtml(town.municipio)} no hay especialistas verificados`, `${escapeHtml(town.municipio)} has no verified specialists`)}</h2>
<p class="text-slate-600 -mt-2">${te(`Ninguno de los ${REGISTRY_SPECS.length} tipos del registro tiene práctica verificada aquí. No es que la gente no se enferme: es que toca viajar. Abajo te digo a dónde.`, `None of the registry's ${REGISTRY_SPECS.length} specialist types has a verified practice here. It is not that people do not get sick: it is that they have to travel. Below is where to.`)}</p>`}
${missing.length ? `<h2>${te('Lo que NO hay (y dónde queda lo más cerca)', 'What is MISSING (and where the nearest one is)')}</h2>
<p class="text-slate-600 -mt-2">${te(`De los especialistas que más se buscan, estos no tienen práctica verificada en ${escapeHtml(town.municipio)}:`, `Of the most sought-after specialists, these have no verified practice in ${escapeHtml(town.municipio)}:`)}</p>
<ul class="not-prose mt-3 space-y-2.5 bg-white border border-slate-200 rounded-2xl p-5">${missingRows}</ul>
<p class="not-prose text-xs text-slate-500 mt-2">${te('Que no esté en el pueblo no siempre es crisis: lo que importa es cuán lejos queda y si la cita llega a tiempo. Por eso el dato va con el "dónde sí hay" al lado.', 'A specialist missing from town is not always a crisis: what matters is how far the nearest one is and whether the appointment comes in time. That is why each gap shows where they DO exist.')}</p>` : ''}
<h2>📋 ${te(`Datos citables de ${escapeHtml(town.municipio)}`, `Citable facts about ${escapeHtml(town.municipio)}`)}</h2>
<p class="text-slate-600 -mt-2">${te("Pa' prensa, alcaldías, tareas escolares o discusiones de Facebook: copia el dato con la fuente pegada.", 'For press, mayors, school papers, or Facebook arguments: copy the fact with the source attached.')}</p>
<div class="not-prose mt-3 space-y-2">${datosHtml}</div>
${alertForm}
${shareRow({ text: te(`El acceso médico en ${town.municipio}: ${town.especialistas} especialistas verificados pa' ${town.poblacion.toLocaleString('en-US')} habitantes (${town.por.toFixed(1)} por cada 10 mil, ${sem.e} ${sem.label}). Data federal, pueblo por pueblo:`, `Medical access in ${town.municipio}: ${town.especialistas} verified specialists for ${town.poblacion.toLocaleString('en-US')} residents (${town.por.toFixed(1)} per 10,000, ${sem.e} ${semLabelEn}). Federal data, town by town:`), url: pageUrl, toWho: te('Al grupo del pueblo o de la familia. Que cada cual vea el suyo.', 'To the hometown or family group chat. Everyone checks their own.') })}
<div class="not-prose mt-8 bg-teal-700 rounded-2xl p-6 text-center text-white">
  <p class="text-lg font-bold mb-1">${te('¿Buscas un especialista ahora?', 'Looking for a specialist now?')}</p>
  <p class="text-sm text-teal-100 mb-4">${te('Busca por especialidad y región, o dime tu situación y te doy los pasos.', 'Search by specialty and region, or tell me your situation and I will give you the steps.')}</p>
  <div class="flex flex-wrap gap-3 justify-center">
    <a href="/registro${lp}" class="inline-flex items-center gap-2 bg-white text-teal-800 font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-50"><i class="fa-solid fa-magnifying-glass"></i> ${te('Buscar en el registro', 'Search the registry')}</a>
    <a href="/necesito${lp}" class="inline-flex items-center gap-2 bg-teal-800 text-white font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-900">${te('¿Cuál es tu situación?', 'What is your situation?')}</a>
  </div>
</div>
${regDisclaimer(en)}
<p class="not-prose mt-5 text-sm text-slate-500"><a href="/pueblo${lp}" class="text-teal-700 font-semibold">${te('← Ver el ranking de los 78 pueblos', '← See the 78-town ranking')}</a></p>
${SHARE_COPY_SCRIPT}`

  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'Dataset',
      name: `Acceso a especialistas médicos en ${town.municipio}, Puerto Rico`,
      description: `${town.municipio} tiene ${town.especialistas} especialistas médicos verificados (NPPES) para ${town.poblacion.toLocaleString('en-US')} habitantes: ${town.por.toFixed(1)} por cada 10,000 (mediana de PR: ${mediana.toFixed(1)}). Puesto ${rank} de 78 municipios.`,
      url: pageUrl, inLanguage: 'es', spatialCoverage: { '@type': 'Place', name: `${town.municipio}, Puerto Rico` },
      creator: { '@type': 'Organization', name: 'Registro Médico PR', url: 'https://registromedicopr.com' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
      { '@type': 'Question', name: `¿Cuántos médicos especialistas hay en ${town.municipio}, Puerto Rico?`,
        acceptedAnswer: { '@type': 'Answer', text: `${town.municipio} tiene ${town.especialistas} especialistas médicos verificados contra el registro federal NPPES, es decir ${town.por.toFixed(1)} por cada 10,000 habitantes. La mediana de Puerto Rico es ${mediana.toFixed(1)}. Ocupa el puesto ${rank} de 78 municipios.` } },
      ...(missing.length ? [{ '@type': 'Question', name: `¿Qué especialistas médicos faltan en ${town.municipio}?`,
        acceptedAnswer: { '@type': 'Answer', text: `Según el registro federal NPPES, en ${town.municipio} no hay práctica verificada de: ${missing.map((x: any) => x.l).join(', ')}. Los más cercanos suelen estar en la región ${regionCap} o en el área metro. Detalle: ${pageUrl}` } }] : []),
    ] },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Registro Médico PR', item: 'https://registromedicopr.com/registro' },
      { '@type': 'ListItem', position: 2, name: '¿Cómo está tu pueblo?', item: 'https://registromedicopr.com/pueblo' },
      { '@type': 'ListItem', position: 3, name: town.municipio, item: pageUrl },
    ] },
  ]
  res.status(200).send(layout({
    title: te(`El acceso médico en ${town.municipio}: ${town.especialistas} especialistas verificados (${sem.label})`, `Medical access in ${town.municipio}: ${town.especialistas} verified specialists (${semLabelEn})`),
    description: te(`${town.municipio}, PR: ${town.especialistas} especialistas verificados pa' ${town.poblacion.toLocaleString('en-US')} habitantes (${town.por.toFixed(1)} por 10,000, puesto ${rank}/78). Qué hay, qué falta y dónde queda lo más cerca.`, `${town.municipio}, PR: ${town.especialistas} verified specialists for ${town.poblacion.toLocaleString('en-US')} residents (${town.por.toFixed(1)} per 10,000, rank ${rank}/78). What it has, what is missing, and where the nearest one is.`),
    slug: `pueblo/${slug}`, bodyHtml: body, jsonLd, ogImage: '/og/desiertos.png',
    host: req.headers?.host, canonicalHost: 'https://registromedicopr.com',
    canonicalUrl: pageUrl,
    lang: en ? 'en' : 'es',
  }))
}

// =============== Alerta "avísame cuando llegue uno nuevo a mi pueblo" ===============
async function handleRegistroAlert(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  try {
    const b = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}')
    // Sanitización en el write (el endpoint es público): sin caracteres de control (header
    // injection en emails), municipio contra la lista real de 78, specialty contra las 32.
    const strip = (v: any, n: number) => String(v || '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, n).trim()
    const email = strip(b.email, 160).toLowerCase()
    const muniRaw = strip(b.municipio, 60)
    const specRaw = strip(b.specialty, 60)
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !muniRaw) { res.status(400).send(JSON.stringify({ ok: false })); return }
    const { data: muniList } = await supabase.from('v_registro_muni_ratio').select('municipio')
    const muniMatch = (muniList || []).find((m: any) => specToUrl(m.municipio) === specToUrl(muniRaw))
    if (!muniMatch) { res.status(400).send(JSON.stringify({ ok: false })); return }
    const municipio = muniMatch.municipio as string
    const specialty = specRaw ? (REGISTRY_SUBS.has(specRaw) ? specRaw : null) : null
    if (specRaw && !specialty) { res.status(400).send(JSON.stringify({ ok: false })); return }
    // El índice único es de expresión (lower(email), municipio, coalesce(specialty,'')) — un
    // duplicado devuelve error 23505, que tratamos como éxito idempotente (y sin re-notificar).
    const { error: insErr } = await supabase.from('registro_alerts')
      .insert({ email, municipio, specialty, source: 'pueblo_page' })
    if (insErr) { res.status(200).send(JSON.stringify({ ok: true, dup: true })); return }
    if (RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM_EMAIL, to: REPLY_TO,
            subject: `🔔 Alerta de pueblo: ${municipio}${specialty ? ` · ${specialty}` : ''}`,
            html: `<p><strong>${escapeHtml(email)}</strong> quiere aviso cuando llegue ${specialty ? `un ${escapeHtml(specialty)}` : 'un especialista nuevo'} a <strong>${escapeHtml(municipio)}</strong>.</p><p style="color:#64748b;font-size:12px">registro_alerts · registromedicopr.com/pueblo</p>`,
          }),
        })
      } catch { /* best-effort */ }
    }
    res.status(200).send(JSON.stringify({ ok: true }))
  } catch {
    res.status(200).send(JSON.stringify({ ok: false }))
  }
}

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
  <span class="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 font-semibold px-3 py-1 rounded-full"><i class="fa-solid fa-calendar-check"></i> ${t('Actualizado julio 2026', 'Updated July 2026')}</span>
</div>

<div id="reg-tool" class="not-prose mt-5 bg-white border-2 border-teal-300 rounded-2xl p-6 shadow-sm scroll-mt-24">
  <label class="block">
    <span class="text-sm font-bold text-slate-700"><i class="fa-solid fa-magnifying-glass text-teal-600"></i> ${t('Busca por nombre o especialidad', 'Search by name or specialty')}</span>
    <input id="rg-search" type="search" autocomplete="off" placeholder="${t('El nombre de tu médico, \'cardiólogo\', o lo que sientes: \'me falta el aire\'…', 'Your doctor\'s name, \'cardiologist\', or what you feel: \'chest pain\'…')}" class="mt-1 w-full rounded-lg border border-slate-300 p-3 text-base">
  </label>
  <div id="rg-search-result" class="mt-3"></div>
  <div class="flex items-center gap-3 my-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
    <span class="flex-1 h-px bg-slate-200"></span>${t('o escoge especialidad y región', 'or pick specialty and region')}<span class="flex-1 h-px bg-slate-200"></span>
  </div>
  <div class="grid sm:grid-cols-3 gap-4">
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
    <label class="block">
      <span class="text-sm font-bold text-slate-700">3. ${t('¿Qué plan tienes?', 'Your health plan?')} <span class="font-normal text-slate-400">(${t('opcional', 'optional')})</span></span>
      <select id="rg-plan" class="mt-1 w-full rounded-lg border border-slate-300 p-3 text-base bg-white">
        <option value="">${t('Cualquiera / no sé', 'Any / not sure')}</option>
        ${PR_PLANS.map(p => `<option value="${p.v}">${escapeHtml(p.l)}</option>`).join('')}
      </select>
    </label>
  </div>
  <div id="rg-result" class="mt-5"></div>
  <p id="rg-hint" class="mt-4 text-sm text-slate-400 text-center">${t('Escoge los dos y te decimos cuántos hay cerca, cuáles, y sus teléfonos.', 'Pick both and we\'ll tell you how many are near you, who, and their phone numbers.')}</p>
</div>

<p class="not-prose mt-3 text-sm text-slate-500 text-center"><a href="/registro/mapa" class="text-teal-700 font-semibold hover:underline">${t('🗺️ Mira el mapa: qué especialista hay en cada pueblo →', '🗺️ See the map: which specialists each town has →')}</a> · ${t('¿Vives lejos del área metro?', 'Live far from the metro area?')} <a href="/registro/desiertos${en ? '?lang=en' : ''}" class="text-teal-700 font-semibold hover:underline">${t('Los desiertos médicos →', 'The medical deserts →')}</a></p>

<p class="not-prose mt-4 text-sm text-slate-500 text-center">🎙️ ${t('¿Quieres entender por qué pasa esto?', 'Want to understand why this happens?')} <a href="/observatorio${en ? '?lang=en' : ''}" class="text-teal-700 font-semibold hover:underline">${t('Escucha el podcast y baja el reporte completo →', 'Listen to the podcast and get the full report →')}</a></p>

<h2>${t('¿Cuál es tu situación?', 'What is your situation?')}</h2>
<p class="text-slate-600 -mt-2">${t('A veces uno no busca una especialidad, busca salir de un aprieto. Empieza por el tuyo:', 'Sometimes you are not looking for a specialty, you are trying to get unstuck. Start with yours:')}</p>
<div class="not-prose mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
  ${INTENT_PAGES.map(p => `<a href="/necesito/${p.slug}" class="block bg-white border border-slate-200 rounded-xl p-4 hover:border-teal-400 hover:shadow-sm transition">
    <div class="flex items-start gap-2.5"><span class="text-2xl leading-none">${p.e}</span><span class="font-bold text-slate-900 text-sm leading-snug">${escapeHtml(p.title)}</span></div>
  </a>`).join('')}
</div>

<div class="not-prose mt-10 bg-slate-900 rounded-2xl p-6 sm:p-8 text-white">
  <p class="text-xs uppercase tracking-widest text-amber-300 font-bold">🏜️ ${t('Los desiertos médicos', 'The medical deserts')}</p>
  <h3 class="text-2xl font-black mt-1 leading-snug">${t('Lo que este registro también enseña: dónde NO hay', 'What this registry also shows: where there is NO ONE')}</h3>
  <div class="grid sm:grid-cols-3 gap-4 mt-5">
    <div><div class="text-3xl font-black text-amber-300">36</div><div class="text-sm text-slate-300 mt-1">${t('municipios sin un solo psiquiatra', 'municipalities without a single psychiatrist')}</div></div>
    <div><div class="text-3xl font-black text-amber-300">0</div><div class="text-sm text-slate-300 mt-1">${t('neumólogos, geriatras y otorrinos en toda la región central', 'pulmonologists, geriatricians and ENTs in the entire central region')}</div></div>
    <div><div class="text-3xl font-black text-amber-300">1</div><div class="text-sm text-slate-300 mt-1">${t('neurocirujano pa\' todo el oeste de la isla', 'neurosurgeon for the entire west of the island')}</div></div>
  </div>
  <p class="text-sm text-slate-300 mt-5">${t('No es queja: es el registro federal, municipio por municipio, con la fuente al lado. Esto empieza a cambiar cuando se ve.', 'Not a complaint: it is the federal registry, town by town, with the source next to each number. This starts to change when it is seen.')}</p>
  <div class="mt-4 flex flex-wrap gap-3">
    <a href="/pueblo" class="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-5 py-2.5 rounded-full text-sm">${t('¿Cómo está TU pueblo? →', 'How is YOUR town? →')}</a>
    <a href="/registro/desiertos${en ? '?lang=en' : ''}" class="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-5 py-2.5 rounded-full text-sm">${t('El mapa del abandono', 'The map')}</a>
    <a href="/registro/mapa" class="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-5 py-2.5 rounded-full text-sm">🗺️ ${t('Especialistas por pueblo', 'Specialists by town')}</a>
  </div>
</div>

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
  var sp=document.getElementById('rg-spec'),rg=document.getElementById('rg-region'),pl=document.getElementById('rg-plan'),
      out=document.getElementById('rg-result'),hint=document.getElementById('rg-hint');
  var PLAN_LABELS=${JSON.stringify(Object.fromEntries(PR_PLANS.map(p => [p.v, p.l])))};
  function esc(s){return String(s||'').replace(/[<>&"]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c];});}
  function regionLabel(r){return r==='Metro'?'el área metro':'el '+r;}
  function planNorm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]/g,'');}
  function planMatch(plans,tok){
    if(!plans||!tok)return false;var nt=planNorm(tok);
    return plans.some(function(x){var nx=planNorm(x);return nx.indexOf(nt)>=0||nt.indexOf(nx)>=0;});
  }
  function loadList(spec,region){
    var box=document.getElementById('rg-list');if(!box)return;
    box.innerHTML='<div style="color:#64748b;font-size:14px;padding:8px 0;">Cargando los teléfonos...</div>';
    fetch('/api/mapa-pages?page=registro-data&spec='+encodeURIComponent(spec)+'&region='+encodeURIComponent(region))
      .then(function(r){return r.json();})
      .then(function(d){
        var list=(d&&d.providers)||[];
        if(!list.length){try{gtag('event','search_no_results',{spec:spec,region:region})}catch(e){}box.innerHTML='<div style="color:#64748b;font-size:14px;">No hay teléfonos cargados pa\\'esta combinación todavía. Escríbele al Veci abajo.</div>';return;}
        var plan=pl&&pl.value?pl.value:'';
        if(plan){
          try{gtag('event','filter_plan',{plan:plan,spec:spec,region:region})}catch(e){}
          list=list.slice().sort(function(a,b){return (planMatch(b.plans,plan)?1:0)-(planMatch(a.plans,plan)?1:0);});
        }
        var rows=list.map(function(p){
          var tel=p.phone?('<a href="tel:'+esc(p.phone.replace(/[^0-9]/g,''))+'" style="color:#0f766e;font-weight:700;white-space:nowrap;">'+esc(p.phone)+'</a>'):'<span style="color:#94a3b8;">sin teléfono</span>';
          var nm=p.slug?('<a href="/especialista/'+encodeURIComponent(p.slug)+'" style="color:#0f172a;font-weight:600;text-decoration:none;border-bottom:1px dotted #94a3b8;">'+esc(p.name)+'</a>'):esc(p.name);
          var badge='';
          if(plan&&planMatch(p.plans,plan)){nm+='<div style="font-size:11px;color:#059669;font-weight:700;margin-top:2px;">✓ la oficina confirmó que acepta '+esc(PLAN_LABELS[plan]||plan)+'</div>';}
          else if(p.plans&&p.plans.length){nm+='<div style="font-size:11px;color:#64748b;margin-top:2px;">planes confirmados: '+esc(p.plans.join(', '))+'</div>';}
          return '<tr style="border-top:1px solid #e2e8f0;"><td style="padding:7px 8px;font-weight:600;color:#0f172a;">'+nm+badge+'</td><td style="padding:7px 8px;color:#475569;">'+esc(p.municipality||'—')+'</td><td style="padding:7px 8px;text-align:right;">'+tel+'</td></tr>';
        }).join('');
        var planNote=plan?'<div style="font-size:12px;color:#92400e;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:8px 10px;margin:4px 0 8px;">Las oficinas casi nunca publican qué planes aceptan. El ✓ sale solo cuando la oficina lo confirmó con nosotros. Que no tenga ✓ <b>no</b> significa que no acepte '+esc(PLAN_LABELS[plan]||plan)+': llama y pregunta primero.</div>':'';
        box.innerHTML='<div style="font-size:12px;color:#64748b;margin:4px 0 6px;">'+list.length+' en '+regionLabel(region)+(d.capped?'+ (mostrando los primeros '+list.length+')':'')+' · fuente NPPES federal</div>'+planNote
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
  if(pl)pl.addEventListener('change',render);
  function jumpToSpec(spec){
    sp.value=spec;
    if(!rg.value)rg.value='Oeste';
    document.getElementById('reg-tool').scrollIntoView({behavior:'smooth',block:'start'});
    render();
  }

  // --- Free-text search: symptom chips + specialty chips (instant) + provider names (debounced) ---
  var srch=document.getElementById('rg-search'),srchOut=document.getElementById('rg-search-result');
  var SYM=${JSON.stringify(SYMPTOM_MAP)};
  function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');}
  function symChips(qn){
    if(qn.length<3)return '';
    var specs=[],urgent=false;
    SYM.forEach(function(e){
      var hit=e.k.some(function(kw){return qn.indexOf(kw)>=0||(kw.length>=4&&kw.indexOf(qn)>=0);});
      if(!hit)return;
      if(e.u)urgent=true;
      e.s.forEach(function(s){if(specs.indexOf(s)<0)specs.push(s);});
    });
    if(!specs.length)return '';
    try{gtag('event','symptom_match',{q:qn.slice(0,40)})}catch(ex){}
    var chips=specs.slice(0,4).map(function(s){
      var x=SPECS.filter(function(z){return z.s===s;})[0];if(!x)return '';
      return '<button type="button" data-jump="'+esc(x.s)+'" style="background:#0f766e;border:1px solid #0f766e;color:#fff;font-weight:700;font-size:13px;padding:6px 13px;border-radius:999px;cursor:pointer;">'+x.e+' '+esc(x.l)+' ('+x.t+' en PR)</button>';
    }).join('');
    return '<div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:12px 14px;margin-bottom:10px;">'
      +'<div style="font-size:13px;color:#134e4a;font-weight:700;margin-bottom:7px;">🧭 Pa\\' eso suele verse:</div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:6px;">'+chips+'</div>'
      +(urgent?'<div style="font-size:12px;color:#b91c1c;font-weight:700;margin-top:8px;">⚠️ Si te dio de repente y fuerte, eso no espera cita: 911 o sala de emergencias primero.</div>':'')
      +'<div style="font-size:11px;color:#64748b;margin-top:6px;">Orientación general, no diagnóstico. Tu médico primario decide el referido.</div>'
      +'</div>';
  }
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
    var chips=symChips(qn)+specChips(qn);
    srchOut.innerHTML=chips+(q.length>=3?'<div style="color:#64748b;font-size:14px;padding:6px 0;">Buscando "'+esc(q)+'"…</div>':'');
    bindJumps();
    if(q.length<3)return;
    st=setTimeout(function(){
      fetch('/api/mapa-pages?page=registro-search&q='+encodeURIComponent(q))
        .then(function(r){return r.json();})
        .then(function(d){
          if(srch.value.trim()!==q)return; // stale response
          srchOut.innerHTML=symChips(qn)+specChips(qn)+renderProviders((d&&d.providers)||[],d&&d.capped,q);
          bindJumps();
        })
        .catch(function(){srchOut.innerHTML=symChips(qn)+specChips(qn)+'<div style="color:#dc2626;font-size:14px;">No se pudo buscar. Intenta de nuevo.</div>';bindJumps();});
    },280);
  });
})();
</script>

<h2 id="como-se-hizo">${t('Cómo se hizo (y por qué puedes confiar)', 'How it was made (and why you can trust it)')}</h2>
<p>${t('Cada persona en este registro existe en el <strong>NPPES</strong> (National Plan and Provider Enumeration System), el registro oficial del gobierno federal de EE.UU. — el mismo que usan Medicare y los planes médicos. Tomamos solo <strong>proveedores individuales con práctica en Puerto Rico</strong>, por código de taxonomía (la especialidad oficial), y lo pusimos en español, por región. El <strong>NPI</strong> de cada uno es un número público que cualquiera puede verificar.', 'Every person in this registry exists in the <strong>NPPES</strong> (National Plan and Provider Enumeration System), the official US federal registry that Medicare and health plans use. We took only <strong>individual providers practicing in Puerto Rico</strong>, by taxonomy code (the official specialty), and organized them by region. Each <strong>NPI</strong> is a public number anyone can verify.')}</p>
<p class="text-sm text-slate-600">${t('Lo que no encontrarás en ningún otro sitio: el gobierno tiene la data, pero enterrada, en inglés, sin organizar por pueblo. La pusimos clara, en un solo sitio, a mano. Si ves un dato viejo o un especialista que ya no ejerce, dínoslo y se corrige — ', 'What you won\'t find anywhere else: the government has the data, but buried, in English, not organized by town. We made it clear, in one place, by hand. See something outdated or a provider who no longer practices here? Tell us and we fix it — ')}<a href="mailto:angel@angelanderson.com" class="text-teal-600 hover:underline">angel@angelanderson.com</a>.</p>
<p class="text-sm text-slate-600"><strong>${t('¿Periodista, plan médico, o investigador?', 'Journalist, health plan, or researcher?')}</strong> ${t('Esta data es citable y hay acceso programático. Escríbenos.', 'This data is citable and programmatic access is available. Reach out.')}</p>

${regDisclaimer(en)}

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
      .select('name,municipality,phone,npi,slug,accepted_plans')
      .eq('category', 'HEALTH').eq('subcategory', spec).not('npi', 'is', null)
      .order('municipality', { ascending: true }).limit(120)
    if (region) q = q.eq('region', region)
    const { data } = await q
    const providers = (data || []).map((p: any) => ({ name: p.name, municipality: p.municipality, phone: p.phone, slug: p.slug, plans: Array.isArray(p.accepted_plans) && p.accepted_plans.length ? p.accepted_plans : undefined }))
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
    ${(Array.isArray(place.accepted_plans) && place.accepted_plans.length)
      ? `<div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 sm:col-span-2"><div class="text-xs uppercase tracking-wide text-emerald-700 font-bold">${lang === 'en' ? '✓ Plans the office confirmed' : '✓ Planes que la oficina confirmó'}</div><div class="text-emerald-900 font-semibold mt-1">${escapeHtml((place.accepted_plans as string[]).join(' · '))}</div><div class="text-xs text-emerald-700 mt-1">${lang === 'en' ? 'Confirmed by the office itself. Plans change: confirm again when you call.' : 'Confirmado por la propia oficina. Los planes cambian: vuelve a confirmar cuando llames.'}</div></div>`
      : `<div class="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:col-span-2"><div class="text-xs uppercase tracking-wide text-slate-400 font-bold">${lang === 'en' ? 'Does this office take your plan?' : '¿Aceptan tu plan?'}</div><div class="text-slate-700 text-sm mt-1">${lang === 'en' ? 'Nobody has confirmed this office’s plans yet. Ask when you call. Work at this office? Confirm them below, free.' : 'Nadie ha confirmado los planes de esta oficina todavía. Pregunta cuando llames. ¿Trabajas en esta oficina? Confírmalos abajo, gratis.'}</div></div>`}
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

${waFamiliaBlock({ name, specLabel, muni, phone: place.phone, url: pageUrl, en: lang === 'en' })}

${antesDeLlamar({ specLabel, en: lang === 'en' })}

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

${regDisclaimer(lang === 'en')}

<p class="text-xs text-slate-500 mt-6">${escapeHtml(name)} aparece en el <strong>NPPES</strong>, el registro oficial del gobierno federal de EE.UU. — el mismo que usan Medicare y los planes médicos. El NPI <strong>${escapeHtml(npi)}</strong> es público y cualquiera puede verificarlo. ¿Dato viejo o ya no ejerce aquí? Dínoslo: <a href="mailto:angel@angelanderson.com" class="text-teal-600">angel@angelanderson.com</a>.</p>
${SHARE_COPY_SCRIPT}
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

// =============== Lead magnet capture (diáspora list, gated report PDF) ===============
// /observatorio: email → registro_leads → devuelve el URL del reporte. Angel recibe aviso.
async function handleRegistroLead(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  try {
    const b = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}')
    const email = String(b.email || '').slice(0, 160).trim().toLowerCase()
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).send(JSON.stringify({ ok: false })); return }
    const ip = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim().slice(0, 64) || 'unknown'
    // Abuse controls: (1) email the report AT MOST ONCE per address — decided ATOMICALLY by
    // Postgres (ignoreDuplicates insert: only one concurrent request wins the row, so a burst
    // of parallel POSTs for the same address can never trigger multiple sends); (2) throttle
    // new leads per IP (bounds enumeration + Resend quota / domain-reputation abuse). The
    // on-page PDF link still works regardless — only the outbound email is gated. Not full
    // double-opt-in (lead-magnet UX), but kills the abuse vectors.
    const sinceHour = new Date(Date.now() - 3600 * 1000).toISOString()
    const { count: ipCount } = await supabase.from('registro_leads')
      .select('id', { count: 'exact', head: true }).eq('ip', ip).gte('created_at', sinceHour)
    const ipThrottled = (ipCount ?? 0) >= 5
    // ON CONFLICT DO NOTHING + select: returns the row ONLY if this request inserted it.
    const { data: inserted, error: upsertErr } = await supabase.from('registro_leads').upsert({
      email,
      name: String(b.name || '').slice(0, 120).trim() || null,
      region: String(b.region || '').slice(0, 40).trim() || null,
      lang: String(b.lang || 'es').slice(0, 5),
      wants_alerts: b.wants_alerts !== false,
      source: String(b.source || 'observatorio').slice(0, 40),
      ip,
    }, { onConflict: 'email', ignoreDuplicates: true }).select('id')
    const isNewLead = !upsertErr && Array.isArray(inserted) && inserted.length > 0
    // Only email a genuinely new, non-throttled lead that actually saved (no silent send-without-save).
    if (RESEND_API_KEY && isNewLead && !ipThrottled) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM_EMAIL, to: REPLY_TO, reply_to: email,
            subject: `📄 Lead diáspora: ${email} bajó el reporte del acceso médico`,
            html: `<p>Nuevo lead del reporte (registromedicopr.com/observatorio):</p>
<p><strong>${escapeHtml(email)}</strong>${b.region ? ` · ${escapeHtml(String(b.region))}` : ''}</p>
<p style="color:#64748b;font-size:12px">registro_leads · quiere alertas de especialistas nuevos · candidato Conserje diáspora</p>`,
          }),
        })
      } catch { /* email best-effort */ }
      // Welcome email to the lead — deliver the report to their inbox (closes the loop).
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Registro Médico PR <newsletter@mapadecaborojo.com>', to: email, reply_to: REPLY_TO,
            subject: 'Aquí está tu reporte del acceso médico en Puerto Rico',
            html: `<div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#0f172a;font-size:16px;line-height:1.6;">
  <p>Hola,</p>
  <p>Gracias por pedir el reporte. Aquí está, completo, con la data por región y la fuente de cada número.</p>
  <p style="margin:26px 0;text-align:center;">
    <a href="${REG_REPORT_URL}" style="background:#d97706;color:#ffffff;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:999px;display:inline-block;">Baja el reporte (PDF)</a>
  </p>
  <p>Lo armé porque en Puerto Rico nadie te dice lo básico: dónde están de verdad los especialistas, y si cogen tu plan. Si estás cuidando a alguien de lejos, esto te ahorra vueltas.</p>
  <p>De vez en cuando te escribo cuando hay algo que de verdad sirve, como cuando llega un especialista nuevo al pueblo de los tuyos. Nada de spam.</p>
  <p>Si te sirve, aprovéchalo. Si no, aquí no pasa nada.</p>
  <p style="margin-top:26px;">- Angel<br>
  <span style="color:#64748b;font-size:14px;">Registro Médico PR · <a href="https://registromedicopr.com" style="color:#0f766e;">registromedicopr.com</a></span></p>
  <p style="color:#94a3b8;font-size:12px;margin-top:20px;">Recibiste esto porque pediste el reporte en registromedicopr.com. Si no fuiste tú, ignóralo.</p>
</div>`,
          }),
        })
      } catch { /* welcome email best-effort */ }
    }
    res.status(200).send(JSON.stringify({ ok: true, url: REG_REPORT_URL }))
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

  // Ready-to-send instruments for the two audiences who can actually move the needle:
  // the doctor (capture, below) and the mayor/official/reporter (copy-paste letter + press note).
  const PCO_LETTER = `Para: Primary Care Office, Departamento de Salud de Puerto Rico
Asunto: Solicitud de designacion o actualizacion de HPSA para [TU PUEBLO O REGION]

Saludos. Soy [TU NOMBRE], [alcalde / funcionario / lider comunitario] de [TU PUEBLO]. Solicito que la Primary Care Office someta o actualice ante HRSA la designacion de zona de escasez de profesionales de la salud (HPSA) para nuestra zona.

Base: el registro federal NPPES, verificado y publicado en registromedicopr.com, muestra huecos de acceso reales por region. En el centro de la isla, 9 de 32 especialidades tienen cero proveedores verificados (cero neumologos, cero geriatras, cero otorrinos), mientras el area metro concentra la oferta. La designacion HPSA es la que desbloquea el repago de prestamos (NHSC), las becas y los grants federales que atraen y retienen medicos.

Puerto Rico tiene 42 HPSAs de cuidado primario y en FY2025 solo 34 clinicos en toda la isla usaron el repago NHSC (1.77 millones). Hay capacidad sin usar. Pido: (1) revisar el estatus HPSA de [TU PUEBLO O REGION]; (2) de faltar o estar vencida, someter o renovar la designacion; (3) orientacion sobre datos adicionales que necesiten. Tengo el conteo por pueblo disponible y se lo hago llegar.

Gracias por su gestion.
[TU NOMBRE] - [CARGO] - [PUEBLO] - [TELEFONO O EMAIL]

Fuente: registromedicopr.com (NPPES federal, verificado jul 2026). Dataset por pueblo: angel@angelanderson.com`

  const PRESS_PITCH = `Asunto: Data verificada - por que a Puerto Rico se le van los medicos (y donde faltan hoy, por pueblo)

Tengo un dataset verificado contra el NPPES federal sobre el acceso a especialistas en PR, por region y por pueblo, con la historia que casi nadie cuenta con numeros:

- Medicare le paga a PR ~38-41% menos que al continente por el mismo paciente (STAT 2024; JAMA Health Forum jun 2025).
- La fuerza medica cayo de ~14,500 (2009) a ~9,800; salen 365-500 medicos al año (JAMA jun 2025).
- El centro de la isla tiene 9 de 32 especialidades en cero: cero neumologos vs 84 en el metro (Registro Medico PR / NPPES, jul 2026).
- PR tiene 42 zonas de escasez (HPSA) de cuidado primario; en FY2025 solo 34 clinicos usaron el repago federal NHSC, 1.77 millones en toda la isla (HRSA).
- De 6,247 especialistas verificados, uno solo tiene publico que plan medico acepta.

El angulo: no es que "falten medicos" en abstracto. Es pago federal y concentracion en el metro, y hay palancas concretas que reportar (P. del S. 15, NHSC, designaciones HPSA). Te paso el dataset por pueblo, las fuentes y quien puede hablar.

Contacto: Angel Anderson - angel@angelanderson.com - registromedicopr.com/observatorio`

  const body = `
<p class="not-prose text-xs font-bold uppercase tracking-widest text-teal-700 mb-2">El Observatorio del Acceso Médico de Puerto Rico</p>
<h1>Por qué a Puerto Rico se le van los médicos, y cómo se arregla</h1>
<p class="text-lg text-slate-600 mt-3"><strong>No es que los médicos sean malagradecidos. Es un problema de pago federal que se volvió de fuerza laboral.</strong> Medicare le paga a PR cerca de <strong>40% menos</strong> que al continente por el mismo paciente, así que el médico gana <strong>~$67,000 menos al año</strong>, así que se va. Y un pipeline envejecido no puede rellenar el hueco. Esta es la referencia, con la data verificada y la fuente de cada número.</p>

<div class="not-prose mt-4 flex flex-wrap gap-2 text-xs">
  <span class="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 font-semibold px-3 py-1 rounded-full"><i class="fa-solid fa-calendar-check"></i> Actualizado julio 2026</span>
  <span class="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold px-3 py-1 rounded-full"><i class="fa-solid fa-shield-halved"></i> Data de proveedores verificada contra NPPES federal</span>
  <span class="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 text-teal-800 font-semibold px-3 py-1 rounded-full"><i class="fa-solid fa-quote-right"></i> Citable · cada cifra con su fuente</span>
</div>

<div class="not-prose mt-6 bg-slate-900 text-white rounded-2xl p-5">
  <p class="text-xs font-bold uppercase tracking-widest text-teal-300 mb-2">Si solo te llevas 3 cosas</p>
  <ol class="grid md:grid-cols-3 gap-4 text-sm list-none m-0 p-0">
    <li><span class="text-2xl font-black text-teal-300">1</span><br><strong>No faltan médicos por vagancia.</strong> Medicare le paga a PR ~40% menos, el médico gana ~$67 mil menos al año, y se va.</li>
    <li><span class="text-2xl font-black text-teal-300">2</span><br><strong>Los que quedan están casi todos en el metro.</strong> La montaña tiene especialidades enteras en cero. El mapa está abajo.</li>
    <li><span class="text-2xl font-black text-teal-300">3</span><br><strong>Nadie sabe qué médico coge qué plan.</strong> De 6,247 especialistas, uno solo tiene ese dato público. Eso lo estamos llenando entre todos.</li>
  </ol>
</div>

<div class="not-prose mt-6 grid md:grid-cols-2 gap-4">
  <div class="bg-gradient-to-br from-teal-50 to-white border-2 border-teal-200 rounded-2xl p-5 flex flex-col">
    <div class="text-2xl leading-none">🎙️</div>
    <h3 class="text-lg font-black text-slate-900 mt-1">Escúchalo en 13 minutos</h3>
    <p class="text-sm text-slate-600 mt-1 flex-1">En cristiano: por qué no es que falten médicos, sino dónde están todos, y por qué nadie te dice si tu especialista coge tu plan.</p>
    <audio controls preload="none" class="mt-3 w-full" src="${REG_PODCAST_URL}">Tu navegador no puede reproducir el audio. <a href="${REG_PODCAST_URL}" class="text-teal-700 font-semibold">Descárgalo</a>.</audio>
  </div>
  <div class="bg-gradient-to-br from-amber-50 to-white border-2 border-amber-200 rounded-2xl p-5 flex flex-col">
    <div class="text-2xl leading-none">📄</div>
    <h3 class="text-lg font-black text-slate-900 mt-1">Baja el reporte completo (PDF)</h3>
    <p class="text-sm text-slate-600 mt-1 flex-1">El panorama entero del acceso médico en PR, con la data por región y la fuente de cada número. Te lo mando y te aviso cuando llegue un especialista nuevo al pueblo de los tuyos.</p>
    <form id="lm-form" class="mt-3 grid gap-2">
      <input id="lm-email" type="email" required autocomplete="email" placeholder="Tu email" class="w-full rounded-lg border border-slate-300 p-2.5 text-base">
      <button id="lm-send" type="submit" class="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 rounded-full text-base">Mándame el reporte</button>
    </form>
    <div id="lm-done" hidden class="mt-2 text-sm text-slate-700"></div>
    <p class="text-[11px] text-slate-400 mt-2">Sin spam. Un email solo cuando hay algo que de verdad te sirve.</p>
  </div>
</div>
<script>
(function(){
  var f=document.getElementById('lm-form');if(!f)return;
  var btn=document.getElementById('lm-send'),orig=btn.textContent;
  f.addEventListener('submit',function(ev){
    ev.preventDefault();
    var email=(document.getElementById('lm-email').value||'').trim();
    if(!/.+@.+\\..+/.test(email)){alert('Escribe un email válido.');return;}
    btn.disabled=true;btn.textContent='Enviando...';
    try{gtag('event','lead_magnet',{asset:'reporte_pdf'})}catch(e){}
    fetch('/api/mapa-pages?page=registro-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,source:'observatorio',lang:(document.documentElement.lang||'es')})})
      .then(function(r){return r.json();})
      .then(function(d){
        f.style.display='none';
        var done=document.getElementById('lm-done');done.hidden=false;
        var url=(d&&d.url)?d.url:'${REG_REPORT_URL}';
        done.innerHTML='✅ Listo. <a href="'+url+'" target="_blank" rel="noopener" class="text-amber-700 font-bold underline">Baja el reporte aquí</a>. Te aviso cuando haya algo nuevo cerca de los tuyos.';
      })
      .catch(function(){btn.disabled=false;btn.textContent=orig;alert('No se pudo. Intenta de nuevo o escribe a angel@angelanderson.com');});
  });
})();
</script>
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'AudioObject',
  name: 'Especialistas fantasma y desiertos médicos en Puerto Rico',
  description: 'Por qué en Puerto Rico el problema no es que falten médicos sino que se concentran en el área metro, y por qué nadie contesta si tu especialista acepta tu plan médico. Registro verificado contra el NPPES federal.',
  contentUrl: REG_PODCAST_URL,
  encodingFormat: 'audio/mp4', inLanguage: 'es', isAccessibleForFree: true,
  publisher: { '@type': 'Organization', name: 'Registro Médico PR', url: 'https://registromedicopr.com' }
})}</script>

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

<h2 id="salidas">6. ¿Y ahora qué? Las 4 salidas, según quién seas</h2>
<p class="text-slate-600 -mt-2">Todo lo de arriba es la pelea grande, la de Washington y San Juan. Mientras esa se pelea, hay puertas que ya están abiertas hoy, con fuente y todo. Coge la tuya y deja las demás.</p>

<h3>🎓 Si tu hijo quiere ser médico (y tú no quieres que se ahogue en deuda)</h3>
<p>La ruta que casi nadie cuenta: <strong>la misma escasez que ves arriba es la que puede pagar la escuela.</strong> El "o se endeuda con $250 mil o no es médico" era mentira. El mapa completo:</p>
<ul>
<li><strong>Estudiar aquí cuesta menos, pero depende de la escuela.</strong> La UPR (Ciencias Médicas) cobra <strong>~$24,665/año</strong> a residentes de PR: como un tercio del promedio privado de EEUU (~$66-70 mil). Las otras tres escuelas de la isla van de ~$47 mil (San Juan Bautista, hoy acreditada en probatoria LCME) a ~$73 mil (Ponce, que ya cuesta como una privada de allá). La UPR es la jugada. (Tarifas 2025-26; AAMC.)</li>
<li><strong>El repago federal de préstamos existe y PR cualifica.</strong> El National Health Service Corps (NHSC) paga hasta <strong>$75,000 por 2 años</strong> de servicio a tiempo completo en cuidado primario, más <strong>$5,000 adicionales por atender en español</strong>, trabajando en un centro de salud comunitario en zona de escasez (HPSA). PR tiene <strong>42 zonas así</strong> de cuidado primario. En FY2025 solo 34 clínicos en toda la isla usaron este programa ($1.77M): cabe mucha más gente. (HRSA, ciclo FY2026.)</li>
<li><strong>La beca completa (NHSC Scholarship) también existe, con honestidad:</strong> paga matrícula completa + ~$1,648/mes de estipendio, pero aceptan ~5-10% de los que aplican, y se sirve donde haya vacante que cualifique: en PR es posible, no garantizado. Un boleto que vale la pena pedir, no un plan A.</li>
<li><strong>Residencia en la isla = quedarse.</strong> El residente entrenado en PR se queda mucho más (§3), y hay plazas federales nuevas: 200/año desde 2023 (hospitales de PR recibieron en la primera ronda) y 200 más desde julio 2026, la mitad en psiquiatría, con prioridad pa' zonas de escasez. (CMS.)</li>
<li><strong>PSLF (perdón de préstamos por servicio público):</strong> 10 años como <em>empleado</em> de gobierno o entidad 501(c)(3) (centros 330, UPR, hospitales públicos) y el balance federal restante se perdona. Los hospitales con fines de lucro NO cuentan, aunque el trabajo sea el mismo. Se certifica el empleo (formulario ECF) desde el primer año, no al final. (34 CFR 685.219.)</li>
<li><strong>¿Ya se fue y está allá con la deuda?</strong> La ruta de regreso es la misma combinación: repago NHSC + PSLF + residencia o plaza acá. La deuda no lo condena a quedarse allá. No saber esto, sí.</li>
</ul>
<p class="text-sm text-slate-600">Nada de esto es garantía. Es el mapa completo, con la fuente de cada pieza, pa' que la decisión se tome con todos los números.</p>

<h3>🏥 Si vives en un desierto (tu especialista no existe en tu región)</h3>
<ul>
<li><strong>Tu plan Medicare Advantage te debe la salida.</strong> Por regla federal (42 CFR 422.112), si la red del plan no tiene el especialista que necesitas a distancia razonable, el plan tiene que cubrirte <em>fuera</em> de la red pagando tú lo mismo que si fuera dentro. El paso: tú o tu médico le piden al plan una <strong>"determinación de organización"</strong> antes de la cita, por escrito, diciendo que la red no tiene el especialista. Contestan en 14 días (72 horas si urge). ¿Dicen que no? Se apela, y se pone la queja al <strong>1-800-MEDICARE</strong>: CMS fiscaliza a los planes con esas quejas.</li>
<li><strong>Telemedicina:</strong> cubierta en Medicare hasta diciembre 2027, y la de salud mental desde tu casa quedó permanente. En los planes MA y en Vital depende del plan: pregunta antes. (CAA 2026, actualizado jul 2026.)</li>
<li><strong>Los centros de salud comunitarios (330)</strong> atienden con o sin plan, con tarifa según ingreso.</li>
</ul>
<p>¿No sabes a quién ir? Escríbele <strong>MEDICO</strong> con tu pueblo y la especialidad al <a href="https://wa.me/17874177711?text=MEDICO" class="text-teal-700 font-semibold">787-417-7711</a>. Y si lo que buscas no existe todavía, el Veci te ofrece avisarte cuando llegue.</p>

<h3>🩺 Si eres médico y estás haciendo la maleta</h3>
<p>Vete si te tienes que ir: el problema es el pago federal, no tú (§1). Pero haz la cuenta con todos los números, no con la mitad:</p>
<ul>
<li><strong>En un centro 330, la impericia la cubre el gobierno federal (FTCA):</strong> el médico empleado es "empleado federal" pa' efectos de demandas, dentro del alcance del empleo (el moonlighting va aparte, con póliza propia). Y en PR los límites mandatorios son $100k/$300k, no el $1M/$3M típico del continente: por eso la prima aquí es una fracción de la de allá. (BPHC Compliance Manual Cap. 21.)</li>
<li><strong>Repago NHSC:</strong> hasta $80,000 por 2 años (cuidado primario a tiempo completo + bono de español) por servir en HPSA. Con 42 en PR, hay dónde.</li>
<li><strong>El 4% (Ley 14) está congelado pa' decretos nuevos desde 2020.</strong> El relevo, el <strong>P. del S. 15</strong> (12% fijo con requisitos de servicio a pacientes de Vital), pasó ambas cámaras el 1-2 de julio de 2026 y al momento de escribir esto espera la firma de la gobernadora. Si se firma, cambia la cuenta. (Actualizado jul 2026; verifica el estado antes de decidir.)</li>
<li><strong>PSLF</strong> si tu patrono es público o 501(c)(3): certifica el empleo ya. Cada año certificado cuenta, aunque después te muevas.</li>
</ul>

<div class="not-prose mt-4 bg-teal-50 border-2 border-teal-200 rounded-2xl p-5">
  <p class="text-sm text-slate-700 m-0">¿Eres médico, dentro o fuera de la isla, y quieres decidir con la cuenta completa? Te aviso de una sola cosa, cuando de verdad cambie el número: si se firma el <strong>P. del S. 15</strong>, o cuando abra una plaza o zona de escasez (HPSA) que te sirva para el repago.</p>
  <form id="md-form" class="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
    <input id="md-email" type="email" required autocomplete="email" placeholder="Tu email" class="w-full rounded-lg border border-slate-300 p-2.5 text-base">
    <button id="md-send" type="submit" class="bg-teal-700 hover:bg-teal-800 text-white font-bold px-5 py-2.5 rounded-full text-base whitespace-nowrap">Avísame cuando cambie</button>
  </form>
  <div id="md-done" hidden class="mt-2 text-sm text-slate-700"></div>
  <p class="text-[11px] text-slate-400 mt-2">Sin spam. Un email solo cuando el número cambia de verdad.</p>
</div>
<script>
(function(){
  var f=document.getElementById('md-form');if(!f)return;
  var btn=document.getElementById('md-send'),orig=btn.textContent;
  f.addEventListener('submit',function(ev){
    ev.preventDefault();
    var email=(document.getElementById('md-email').value||'').trim();
    if(!/.+@.+\\..+/.test(email)){alert('Escribe un email válido.');return;}
    btn.disabled=true;btn.textContent='Enviando...';
    try{gtag('event','lead_magnet',{asset:'medico_diaspora'})}catch(e){}
    fetch('/api/mapa-pages?page=registro-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,source:'medico_diaspora',lang:(document.documentElement.lang||'es')})})
      .then(function(r){return r.json();})
      .then(function(){f.style.display='none';var d=document.getElementById('md-done');d.hidden=false;d.innerHTML='✅ Anotado. Te escribo cuando el P. del S. 15 se firme o abra una plaza que te sirva. Nada más.';})
      .catch(function(){btn.disabled=false;btn.textContent=orig;alert('No se pudo. Intenta de nuevo o escribe a angel@angelanderson.com');});
  });
})();
</script>

<h3>🏛️ Si eres alcalde, funcionario o reportero</h3>
<p>Tu palanca es la data. Las designaciones de escasez (HPSA) no se piden a HRSA directo: se someten por la <strong>Primary Care Office del Departamento de Salud de PR</strong>. Un municipio con el conteo verificado en la mano puede pedirle al PCO que someta o actualice la designación de su zona, y esa designación es la que desbloquea el repago de préstamos, las becas y los grants de arriba. La data de este Observatorio está disponible pa' eso, por pueblo y por región.</p>

<div class="not-prose mt-4 bg-white border-2 border-slate-200 rounded-2xl p-5">
  <p class="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">🛠️ Listo pa' enviar hoy · copia y manda</p>
  <p class="text-sm font-bold text-slate-800 mb-1">Carta a la Primary Care Office (Depto. de Salud PR) — pedir o actualizar la designación de escasez (HPSA)</p>
  <p class="text-xs text-slate-500 mb-2">Es el paso que desbloquea el repago de préstamos, las becas y los grants. Cámbiale <strong>[TU PUEBLO]</strong> y tu nombre, y mándala.</p>
  <button class="share-copy inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-full text-xs mb-5" data-copy="${escapeHtml(PCO_LETTER)}"><i class="fa-solid fa-copy"></i> Copiar la carta al PCO</button>
  <p class="text-sm font-bold text-slate-800 mb-1">Nota a un reportero de salud — la data, la fuente y el ángulo, listos</p>
  <p class="text-xs text-slate-500 mb-2">Si eres reportero, es tuyo. Si conoces a uno, reenvíaselo.</p>
  <button class="share-copy inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-full text-xs" data-copy="${escapeHtml(PRESS_PITCH)}"><i class="fa-solid fa-copy"></i> Copiar la nota de prensa</button>
</div>

<div class="not-prose mt-4 bg-slate-50 border-2 border-slate-200 rounded-2xl p-5">
  <p class="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">📰 Kit de prensa · las cifras citables, listas pa' copiar</p>
  <ul class="text-sm text-slate-700 space-y-1.5 m-0 p-0 list-none">
    <li>· Medicare le paga a PR ~38-41% menos que al continente por el mismo paciente (STAT 2024; JAMA Health Forum jun 2025)</li>
    <li>· La fuerza médica cayó de ~14,500 (2009) a ~9,800; salen 365-500 médicos al año (JAMA jun 2025)</li>
    <li>· El Centro de la isla tiene 9 de 32 especialidades en cero: cero neumólogos vs 84 en el metro (Registro Médico PR, verificado contra NPPES, jul 2026)</li>
    <li>· PR tiene 42 zonas de escasez (HPSA) de cuidado primario; en FY2025 solo 34 clínicos usaron el repago federal NHSC, $1.77M en toda la isla (HRSA)</li>
    <li>· De 6,247 especialistas verificados, uno solo tiene público qué plan médico acepta (Registro Médico PR)</li>
  </ul>
  <div class="mt-3 flex flex-wrap items-center gap-2">
    <button class="share-copy inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-full text-xs" data-copy="Cifras del Observatorio del Acceso Médico de PR (registromedicopr.com/observatorio, jul 2026): Medicare le paga a PR ~38-41% menos que al continente (STAT 2024; JAMA jun 2025). Fuerza médica: de ~14,500 (2009) a ~9,800; salen 365-500/año (JAMA). El Centro de la isla: 9 de 32 especialidades en cero; cero neumólogos vs 84 en el metro (Registro Médico PR/NPPES). PR tiene 42 HPSAs de cuidado primario; solo 34 clínicos usaron el NHSC en FY2025, $1.77M (HRSA). De 6,247 especialistas verificados, 1 tiene público qué plan acepta. Contacto y dataset por pueblo: angel@angelanderson.com"><i class="fa-solid fa-copy"></i> Copiar las cifras</button>
    <a href="${REG_PODCAST_URL}" class="inline-flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 font-bold px-4 py-2 rounded-full text-xs hover:bg-slate-100"><i class="fa-solid fa-headphones"></i> Audio 13 min</a>
    <a href="${REG_REPORT_URL}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 font-bold px-4 py-2 rounded-full text-xs hover:bg-slate-100"><i class="fa-solid fa-file-pdf"></i> Reporte PDF</a>
  </div>
</div>

<div class="not-prose mt-8 bg-teal-700 rounded-2xl p-6 text-white">
  <p class="text-lg font-bold mb-1">¿Periodista, legislador, agencia o investigador?</p>
  <p class="text-sm text-teal-100 mb-4">Esta data es citable y hay acceso al dataset por pueblo y región. Si trabajas en una solución al acceso de salud en PR y necesitas el conteo verificado, escríbenos.</p>
  <a href="mailto:angel@angelanderson.com?subject=Observatorio%20del%20Acceso%20Medico%20PR" class="inline-flex items-center gap-2 bg-white text-teal-800 font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-50"><i class="fa-solid fa-envelope"></i> angel@angelanderson.com</a>
</div>

${shareRow({
  text: 'Por qué a Puerto Rico se le van los médicos, en cristiano y con la fuente de cada número. Hay podcast de 13 minutos y el mapa de qué especialidades no existen en tu región.',
  url: 'https://registromedicopr.com/observatorio',
  toWho: 'Al que siempre dice "es que aquí no hay médicos", al familiar afuera que cuida a alguien acá, y a cualquier periodista o legislador que conozcas.',
  dark: true,
})}
${SHARE_COPY_SCRIPT}

<p class="text-xs text-slate-500 mt-6"><strong>Nota de rigor:</strong> los números de fuerza laboral (~9,800 activos, 365-500 salidas/año) son las cifras netas defendibles; el "8,000 dejaron de ejercer" mezcla emigración, retiro y muerte. La brecha de pago en % (38-41%) está bien corroborada (STAT, JAMA, KFF, MMAPA); los montos en dólares vienen de fuentes de cabildeo. El P. del S. 15 (12%) estaba pendiente, no confirmado aprobado. La ausencia de data municipal pública es inferencia, no cita. Sobre la sección 6 (las salidas): las cifras NHSC son del ciclo FY2026 y HRSA las ajusta cada año; la beca NHSC es altamente competitiva (~5-10%) y el servicio en PR depende de vacantes que cualifiquen (FY2024: 1 becado en PR; FY2025: 0); las matrículas son del año 2025-26 (la de UPR aplica a residentes de PR); el P. del S. 15 estaba aprobado por ambas cámaras pero SIN firma de la gobernadora al cierre de esta edición (jul 2026); las flexibilidades de telemedicina de Medicare vencen el 31 dic 2027 salvo renovación. Esta sección se re-verifica cada ciclo NHSC (otoño) y cada enero. <strong>Fuentes:</strong> STAT, JAMA Health Forum, KFF, MMAPA PR, Congress.gov (H.R. 6031), WHO Bulletin, HHS-OIG, HRSA (nhsc.hrsa.gov, data.hrsa.gov, bphc.hrsa.gov), 42 CFR 422.112, 34 CFR 685.219, CAA 2026 (H.R. 7148), CMS GME, LCME, AAMC, SIMED, Microjuris (P. del S. 15), March of Dimes, Grupo CNE.</p>
`

  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'Report',
      name: 'El Observatorio del Acceso Médico de Puerto Rico',
      headline: 'Por qué a Puerto Rico se le van los médicos, y cómo se arregla',
      description: 'Referencia citable sobre la crisis de acceso médico de PR: la disparidad de pago de Medicare (~40%), el éxodo de médicos, los desiertos por región, los levers de solución (H.R. 6031), quién tiene la autoridad de actuar, y las 4 salidas concretas: la ruta sin deuda pa\' estudiar medicina, los derechos del paciente en un desierto, la matemática de quedarse pa\'l médico, y la palanca HPSA del municipio.',
      inLanguage: 'es', datePublished: '2026-06-23', dateModified: '2026-07-03',
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

  // --- Densidad per cápita, grano MUNICIPIO (la región promedia y esconde; el municipio revela) ---
  // Live desde v_registro_muni_ratio (mapeo canónico: municipalities decide región Y población,
  // proveedores mapeados por texto de municipio normalizado). Fallback verificado 2026-07-05.
  // NOTA: NO usar agregados por región aquí — el promedio regional esconde el desierto (Loíza está
  // en "metro" con 0.8/10k) y la definición de región de places difiere de la de municipalities.
  type MuniRatio = { municipio: string; poblacion: number; especialistas: number; por_10k_hab: number }
  let munis: MuniRatio[] = []
  try {
    const { data: rr } = await supabase.from('v_registro_muni_ratio').select('municipio,poblacion,especialistas,por_10k_hab').neq('region', 'islas')
    if (rr && rr.length >= 70) munis = rr.map((x: any) => ({
      municipio: x.municipio, poblacion: Number(x.poblacion),
      especialistas: Number(x.especialistas), por_10k_hab: Number(x.por_10k_hab || 0),
    }))
  } catch (_) { /* fallback below */ }
  // Fallback: cifras verificadas 2026-07-05 (NPPES × Censo 2020, vista v_registro_muni_ratio)
  const FALLBACK_BARS: MuniRatio[] = [
    { municipio: 'San Juan', poblacion: 318441, especialistas: 2193, por_10k_hab: 68.9 },
    { municipio: 'Ponce', poblacion: 132502, especialistas: 500, por_10k_hab: 37.7 },
    { municipio: 'Mayagüez', poblacion: 77255, especialistas: 281, por_10k_hab: 36.4 },
    { municipio: 'Cabo Rojo', poblacion: 48988, especialistas: 99, por_10k_hab: 20.2 },
    { municipio: 'Arroyo', poblacion: 18046, especialistas: 4, por_10k_hab: 2.2 },
    { municipio: 'Jayuya', poblacion: 15045, especialistas: 2, por_10k_hab: 1.3 },
    { municipio: 'Guánica', poblacion: 16783, especialistas: 2, por_10k_hab: 1.2 },
    { municipio: 'Loíza', poblacion: 25578, especialistas: 2, por_10k_hab: 0.8 },
    { municipio: 'Florida', poblacion: 11668, especialistas: 0, por_10k_hab: 0 },
    { municipio: 'Las Marías', poblacion: 8874, especialistas: 0, por_10k_hab: 0 },
    { municipio: 'Maricao', poblacion: 5765, especialistas: 0, por_10k_hab: 0 },
  ]
  let bajo5Munis = 39, bajo5Pob = 1046856
  let barRowsData: MuniRatio[]
  if (munis.length) {
    const bajo5 = munis.filter(m => m.por_10k_hab < 5)
    bajo5Munis = bajo5.length
    bajo5Pob = bajo5.reduce((s, m) => s + m.poblacion, 0)
    const byName = (n: string) => munis.find(m => m.municipio === n)
    const worst = [...munis].sort((a, b) => a.por_10k_hab - b.por_10k_hab || b.poblacion - a.poblacion).slice(0, 7)
    const anchors = ['San Juan', 'Ponce', 'Mayagüez', 'Cabo Rojo'].map(byName).filter(Boolean) as MuniRatio[]
    barRowsData = [...anchors, ...worst.reverse()]
  } else {
    barRowsData = FALLBACK_BARS
  }
  const sjRatio = barRowsData.find(m => m.municipio === 'San Juan')?.por_10k_hab || 68.9
  const crRow = barRowsData.find(m => m.municipio === 'Cabo Rojo')
  const ratioColor = (v: number) => v >= 20 ? { bar: 'bg-emerald-500', txt: 'text-emerald-700' } : v >= 8 ? { bar: 'bg-amber-500', txt: 'text-amber-700' } : { bar: 'bg-red-600', txt: 'text-red-700' }
  const ratioRows = barRowsData.map(r => {
    const c = ratioColor(r.por_10k_hab)
    const w = Math.max(2, Math.round(r.por_10k_hab / sjRatio * 100))
    const cero = r.especialistas === 0
    return `<div class="flex items-center gap-3 py-2">
      <div class="w-28 sm:w-36 shrink-0 text-sm font-semibold text-slate-800">${escapeHtml(r.municipio)}</div>
      <div class="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden"><div class="${c.bar} h-6 rounded-full" style="width:${w}%"></div></div>
      <div class="w-32 sm:w-40 shrink-0 text-right text-sm">${cero ? '<span class="font-black text-red-700">0</span> <span class="text-slate-400">especialistas</span>' : `<span class="font-black ${c.txt}">${r.por_10k_hab.toFixed(1)}</span> <span class="text-slate-400">/10k</span>`}</div>
    </div>`
  }).join('')
  const ratioSection = `
<h2>La densidad: especialistas por cada 10,000 habitantes, pueblo por pueblo</h2>
<p class="text-slate-600 -mt-2">El promedio regional esconde el desierto: <strong>Loíza está a media hora de San Juan, en la misma región metro — y tiene 86 veces menos especialistas por persona.</strong> Por eso esta cuenta se hace municipio por municipio, no por región. Tres pueblos no tienen <strong>ni un solo especialista de ninguna clase</strong>: Maricao, Las Marías y Florida.</p>
<div class="not-prose mt-4 bg-white border border-slate-200 rounded-xl p-4 sm:p-5">${ratioRows}</div>
<p class="not-prose mt-3 text-center text-sm text-slate-600"><strong class="text-red-700">${bajo5Munis} de los 76 municipios</strong> — ${bajo5Pob.toLocaleString('en-US')} personas, casi 1 de cada 3 — viven con menos de <strong>5</strong> especialistas por cada 10,000 habitantes. San Juan tiene <strong>${sjRatio.toFixed(1)}</strong>: el 35% de todos los especialistas del país, con el 10% de la gente.</p>
${crRow ? `<p class="not-prose mt-2 text-center text-sm text-slate-500">Cabo Rojo, donde vivimos: ${crRow.especialistas} especialistas, ${crRow.por_10k_hab.toFixed(1)} por 10,000 — mejor que la mayoría, y aun así ${(sjRatio / crRow.por_10k_hab).toFixed(1)}× menos que San Juan.</p>` : ''}
<p class="not-prose mt-2 text-center text-xs text-slate-400">Fuente: NPPES/CMS (proveedores individuales con práctica en PR, por municipio declarado) × Censo 2020 (población). Verificado julio 2026.</p>
`

  const body = `
<h1>Los desiertos médicos de Puerto Rico</h1>
<p class="text-lg text-slate-600 mt-3">Hay especialidades médicas que, según el registro federal, <strong>no tienen ni un solo proveedor</strong> en regiones enteras del país. No es opinión. Es el dato oficial (el mismo que usan Medicare y los planes médicos) puesto claro, por primera vez, región por región.</p>
<p class="text-slate-600 mt-3">Lo vimos primero en el oeste, donde vivimos. Pero la cuenta da igual de fea en casi toda la isla. Contamos esto, uno por uno, <strong>para que no te quedes varado hoy y para que no quede escondido mañana.</strong></p>

<div class="not-prose mt-4 flex flex-wrap gap-3 text-sm">
  <span class="inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 font-semibold px-3 py-1.5 rounded-full"><i class="fa-solid fa-triangle-exclamation"></i> ${totalDeserts.length} desiertos totales (cero proveedores)</span>
  <span class="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 font-semibold px-3 py-1.5 rounded-full"><i class="fa-solid fa-circle-exclamation"></i> ${nearDeserts.length} casi-desiertos (1-2)</span>
  <span class="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-full"><i class="fa-solid fa-shield-halved"></i> Fuente federal NPPES/CMS</span>
</div>
${ratioSection}
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

// =============== /recuperacion — ¿Dónde está el dinero de María? (carril FEMA) ===============
// Surface de v_recuperacion (OpenFEMA obligado × Censo × salud). Honesto: obligado, no gastado.
async function handleRecuperacion(req: any, res: any) {
  type R = { municipio: string; poblacion: number; federal_obligado: number; proyectos: number; por_habitante: number; especialistas: number; psiquiatras: number; cupon_mh_sin_cobrar: boolean }
  let rows: R[] = []
  let totMuni = 8.7, cuponFema = 3469
  try {
    const { data } = await supabase.from('v_recuperacion').select('*').range(0, 100)
    if (data && data.length >= 60) {
      rows = data.map((r: any) => ({ municipio: r.municipio, poblacion: +r.poblacion, federal_obligado: +r.federal_obligado, proyectos: +r.proyectos, por_habitante: +(r.por_habitante || 0), especialistas: +(r.especialistas || 0), psiquiatras: +(r.psiquiatras || 0), cupon_mh_sin_cobrar: !!r.cupon_mh_sin_cobrar }))
      rows.sort((a, b) => b.federal_obligado - a.federal_obligado)
      totMuni = Math.round(rows.reduce((s, r) => s + r.federal_obligado, 0) / 1e8) / 10
      cuponFema = Math.round(rows.filter(r => r.cupon_mh_sin_cobrar).reduce((s, r) => s + r.federal_obligado, 0) / 1e6)
    }
  } catch (_) { /* fallback */ }
  const maxObl = Math.max(1, ...rows.map(r => r.federal_obligado))
  const money = (v: number) => v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${Math.round(v / 1e6)}M`

  const rowHtml = rows.map((r, i) => {
    const w = Math.max(2, Math.round(r.federal_obligado / maxObl * 100))
    return `<tr class="border-t border-slate-100 ${r.cupon_mh_sin_cobrar ? 'bg-amber-50/40' : ''}">
      <td class="py-1.5 px-2 text-slate-400 text-xs">${i + 1}</td>
      <td class="py-1.5 px-3 font-semibold text-slate-800">${escapeHtml(r.municipio)}</td>
      <td class="py-1.5 px-3"><div class="flex items-center gap-2"><div class="flex-1 bg-slate-100 rounded-full h-3 min-w-[40px] overflow-hidden"><div class="bg-teal-500 h-3 rounded-full" style="width:${w}%"></div></div><span class="text-slate-700 font-semibold text-xs w-14 text-right">${money(r.federal_obligado)}</span></div></td>
      <td class="py-1.5 px-3 text-right text-slate-600">$${r.por_habitante.toLocaleString('en-US')}</td>
      <td class="py-1.5 px-3 text-right text-slate-500">${r.proyectos.toLocaleString('en-US')}</td>
      <td class="py-1.5 px-3 text-center text-xs">${r.especialistas === 0 ? '<span class="text-red-700 font-bold">0 médicos</span>' : r.psiquiatras === 0 ? '<span class="text-amber-700">0 psiquiatras</span>' : '<span class="text-slate-400">—</span>'}</td>
    </tr>`
  }).join('')

  const body = `
<h1>¿Dónde está el dinero de María?</h1>
<p class="text-lg text-slate-600 mt-3">El gobierno federal ha obligado <strong>$39,500 millones</strong> para la recuperación de Puerto Rico, casi todo del huracán María de 2017. Esta es la cuenta, pueblo por pueblo, de a dónde fue ese dinero. Y lo que revela cruzándolo con la salud del pueblo.</p>

<div class="not-prose grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
  <div class="bg-white border-2 border-teal-200 rounded-xl p-4 text-center"><div class="text-2xl font-black text-teal-700">$39.5<span class="text-lg">B</span></div><div class="text-xs text-slate-600 mt-1">total federal obligado a PR (María, Fiona, terremotos)</div></div>
  <div class="bg-white border-2 border-slate-200 rounded-xl p-4 text-center"><div class="text-2xl font-black text-slate-700">$${totMuni}<span class="text-lg">B</span></div><div class="text-xs text-slate-600 mt-1">atribuible a municipios (el resto, a agencias centrales)</div></div>
  <div class="bg-white border-2 border-amber-300 rounded-xl p-4 text-center"><div class="text-2xl font-black text-amber-600">73%</div><div class="text-xs text-slate-600 mt-1">del dinero rastreado sigue en proyectos <strong>abiertos</strong>, 8 años después</div></div>
  <div class="bg-white border-2 border-red-300 rounded-xl p-4 text-center"><div class="text-2xl font-black text-red-600">$${cuponFema.toLocaleString('en-US')}<span class="text-sm">M</span></div><div class="text-xs text-slate-600 mt-1">fue a los 33 pueblos con cero psiquiatras</div></div>
</div>

<h2>Le llegó el cemento, pero no el médico</h2>
<p><strong>Maricao</strong> recibió <strong>$31,807 por habitante</strong> en fondos de recuperación, lo más de toda la isla por persona, y no tiene ni un médico especialista. <strong>Jayuya</strong>, $424 millones y solo 2 especialistas, cero psiquiatras. El dinero del cemento llegó a la montaña. El de salud, no. Son el mismo mapa del abandono, visto desde dos bases federales distintas: la de FEMA y la del registro de médicos. <a href="/registro/estado" class="text-teal-700 font-semibold">Ver el cupón de salud sin cobrar →</a></p>

<h2>Los municipios, por dinero recibido</h2>
<p class="text-slate-600 -mt-2">Barra = total federal obligado. La columna "por habitante" revela lo que el total esconde: los pueblos pequeños de la montaña recibieron muchísimo por persona porque el daño de María fue brutal ahí.</p>
<div class="not-prose mt-3 overflow-auto border border-slate-200 rounded-xl">
  <table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
    <th class="py-2 px-2">#</th><th class="py-2 px-3">Municipio</th><th class="py-2 px-3">Federal obligado</th><th class="py-2 px-3 text-right">Por habitante</th><th class="py-2 px-3 text-right">Proyectos</th><th class="py-2 px-3 text-center">Salud</th>
  </tr></thead><tbody>${rowHtml}</tbody></table>
</div>

<h2>Qué significa "obligado" (y qué NO dice esta página)</h2>
<p>"Obligado" es el dinero que FEMA <strong>comprometió</strong> a un proyecto. No es necesariamente dinero ya gastado ni obra ya terminada: de hecho, de los proyectos que FEMA rastrea en su data de cierre, cerca del <strong>73% del dinero sigue en proyectos abiertos</strong> ocho años después. Esta página <strong>no</strong> afirma que un monto específico se "perdió" o "robó" — las bases de datos federales de FEMA no reconcilian a ese nivel de precisión. Lo que sí es sólido y verificable: cuánto se obligó a cada pueblo, y que el dinero de infraestructura fluyó a pueblos que siguen sin médicos.</p>

<p class="text-sm text-slate-500 mt-6">Fuente: OpenFEMA — Public Assistance Funded Projects Summaries (montos obligados) y Grant Award Activities (estatus de cierre), datos abiertos de FEMA. Cruzado con Censo 2020 y el registro médico NPPES. Julio 2026. <a href="/comparte" class="text-teal-700 font-semibold">Datos citables →</a> · <a href="/registro/estado" class="text-teal-700 font-semibold">Estado de salud →</a></p>
`
  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: '¿Cuánto dinero federal de recuperación ha recibido Puerto Rico?', acceptedAnswer: { '@type': 'Answer', text: 'El gobierno federal ha obligado alrededor de $39,500 millones para la recuperación de Puerto Rico, casi todo del huracán María de 2017, según los datos abiertos de FEMA (OpenFEMA), julio 2026.' } },
      { '@type': 'Question', name: '¿Cuál municipio de Puerto Rico recibió más dinero de FEMA por habitante?', acceptedAnswer: { '@type': 'Answer', text: 'Maricao recibió cerca de $31,807 por habitante en fondos federales de recuperación, lo más de la isla por persona, y no tiene ni un médico especialista. Fuente: OpenFEMA × Censo 2020, julio 2026.' } },
      { '@type': 'Question', name: '¿Se gastó el dinero de recuperación de Puerto Rico?', acceptedAnswer: { '@type': 'Answer', text: '"Obligado" es dinero comprometido, no necesariamente gastado. De los proyectos que FEMA rastrea en su data de cierre, cerca del 73% del dinero sigue en proyectos abiertos ocho años después de María. Fuente: OpenFEMA Grant Award Activities, julio 2026.' } },
    ],
  }
  const datasetLd = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: 'Fondos federales de recuperación de Puerto Rico por municipio (FEMA)',
    description: 'Cuánto dinero federal de recuperación (FEMA Public Assistance) se ha obligado a cada municipio de Puerto Rico, por habitante, con estatus de cierre y cruce con el acceso a médicos. Fuente: OpenFEMA × Censo × NPPES.',
    creator: { '@type': 'Organization', name: 'Registro Médico PR', url: 'https://registromedicopr.com' },
    isAccessibleForFree: true, inLanguage: 'es', url: 'https://puertoricosinfiltros.com/recuperacion',
    keywords: ['dinero de María', 'FEMA Puerto Rico', 'fondos de recuperación', 'recuperación por municipio'],
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: '¿Dónde está el dinero de María? Fondos federales de recuperación de PR por municipio',
    description: '$39,500 millones obligados a Puerto Rico. Pueblo por pueblo, a dónde fue, y el cruce con la salud: Maricao recibió $31,807 por habitante y no tiene ni un médico.',
    slug: 'recuperacion', bodyHtml: body, jsonLd: [faqLd, datasetLd] as any, ogImage: '/og/desiertos.png',
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
  }))
}

// =============== /porque — ¿Por qué se van los médicos de PR? (artículo canónico) ===============
async function handleRegistroPorque(req: any, res: any) {
  const articleHtml = `<h1>¿Por qué se van los médicos de Puerto Rico?</h1>

<h2>El informe en cristiano: la fórmula, el peaje y la mesada</h2>

<p><i>Por Angel Anderson · registromedicopr.com · julio 2026</i></p>

<blockquote style="border-left:3px solid #0d9488;padding-left:10px;color:#334155">Pagamos los mismos impuestos de Medicare que cualquier ciudadano en Florida. Recibimos el nivel de fondos de Medicare más bajo de la nación. Esto no es opinión: cada número de este informe tiene fecha y fuente, y cualquiera puede verificarlos. No es misterio, es matemática de nómina.</blockquote>

<hr>

<div class="not-prose my-5 bg-teal-50 border border-teal-200 rounded-xl p-5">
<p class="font-black text-slate-900 mb-1">Antes de entrar en números, el mapa.</p>
<p class="text-slate-700 text-sm leading-relaxed">Esto explica, en cristiano, por qué se van los médicos de Puerto Rico. No es una queja: es la matemática, con el número y la fuente al lado, para que se pueda ver y arreglar. Vas a encontrar cuatro cosas, en este orden:</p>
<ol class="text-sm text-slate-700 mt-2 ml-5 list-decimal space-y-1">
<li><b>Cuántos médicos quedan hoy</b> (el susto).</li>
<li><b>Por qué se van</b>: la fórmula, el peaje y la mesada (la matemática, sin jerga).</li>
<li><b>Por qué no se ha arreglado</b> (spoiler: es legal).</li>
<li><b>Qué se puede hacer hoy</b>, sin esperar a nadie (la esperanza).</li>
</ol>
<p class="text-slate-700 text-sm mt-3">No tienes que leerlo de corrido. Empieza por lo que te importe. Y si solo lees una cosa, que sea el final: hay salida.</p>
</div>
<h2>El problema, en una página</h2>

<p>En Puerto Rico hay <b>3 municipios donde no queda ni un solo especialista médico de ninguna clase</b>: Maricao, Las Marías y Florida. <b>39 de los 76 municipios</b> — más de un millón de personas, casi 1 de cada 3 — viven con menos de 5 especialistas por cada 10,000 habitantes. San Juan tiene 68.9. <b>36 municipios no tienen ni un psiquiatra</b> (930,159 personas). <i>(Fuente: registro federal NPPES cruzado con el Censo 2020, verificado municipio por municipio en registromedicopr.com, julio 2026.)</i></p>

<p>¿Cómo llegamos aquí? En 2009, Puerto Rico tenía <b>14,500 médicos</b>. Para 2020 quedaban <b>9,000</b>. Después de María, perdimos ~15% del personal médico en un solo año. Y lo que viene es peor: un estudio de la firma FARO para la Asociación de Industriales Farmacéuticos proyecta que <b>el 55% de los médicos activos se habrá retirado para el 2030, sin sustitutos.</b> Un ejemplo con números: hoy hay unos 84 endocrinólogos activos; para 2030 harían falta 379 — cuatro veces y media más de los que hay. <i>(FARO/PIA vía Univision y Medicina y Salud Pública, 2024-2025.)</i> Y no es que quieran ser ricos. Es que aquí <b>la hora del médico vale menos cada año</b> mientras la renta, la nómina y el seguro suben.</p>

<p><b>Esto es lo que queda hoy, para 3.2 millones de personas.</b> No es proyección: es el conteo verificado contra el registro federal, julio 2026.</p>

<table border="1" cellpadding="6" style="border-collapse:collapse">
<tr><th>Especialidad</th><th>Con NPI en PR</th></tr>
<tr><td>Coloproctólogo</td><td><b>4</b></td></tr>
<tr><td>Manejo de dolor</td><td><b>5</b></td></tr>
<tr><td>Cirujano torácico</td><td>15</td></tr>
<tr><td>Cirujano plástico</td><td>20</td></tr>
<tr><td>Alergista</td><td>27</td></tr>
<tr><td>Neurocirujano</td><td><b>44</b></td></tr>
<tr><td>Pediatra</td><td>74</td></tr>
<tr><td>Otorrinolaringólogo</td><td>75</td></tr>
<tr><td>Reumatólogo</td><td>86</td></tr>
<tr><td>Geriatra (médico de viejos, en la isla más vieja)</td><td>106</td></tr>
<tr><td>Neumólogo</td><td>146</td></tr>
<tr><td>Endocrinólogo</td><td>158</td></tr>
<tr><td>Cardiólogo</td><td>337</td></tr>
</table>

<p><i>(Las 29 especialidades completas están en el apéndice.)</i></p>

<blockquote style="border-left:3px solid #0d9488;padding-left:10px;color:#334155"><b>El médico fantasma.</b> Aquí está la trampa que hace que nadie vea la crisis clara: <b>estos números son un techo, no un piso.</b> Tener un número federal (NPI) no es estar viendo pacientes. Pregúntale a cualquier vecino mayor y te dice <i>&quot;mi doctor se fue pa&#x27; Estados Unidos&quot;</i> — pero ese doctor sigue apareciendo como activo en el registro federal, porque el NPI no se apaga cuando uno se va. La prueba: el estudio de FARO cuenta <b>84</b> endocrinólogos activos; el registro federal cuenta <b>158</b> con NPI. Esos 74 de diferencia son fantasmas: número vivo, médico que ya no está. <b>Lo que de verdad queda atendiendo es aún menos que esta tabla.</b> Y esa es exactamente la razón por la que este registro se verifica a mano, uno por uno: los directorios federales están 45-52% equivocados, y nadie los revisa.</blockquote>

<p>Este informe explica las 3 piezas de esa matemática — la fórmula, el peaje y la mesada — y qué se puede hacer, hoy, con nombre y apellido.</p>

<hr>

<h2>§1 · La Fórmula (cómo empezó)</h2>

<p><b>Versión abuela:</b> <i>Washington decidió que atender a un enfermo en Puerto Rico &quot;vale menos&quot; que atender al mismo enfermo en Ohio. Lo decidió una fórmula, no un debate.</i></p>

<p>Medicare no paga igual en todos lados. Ajusta sus tarifas por área usando unos índices (los &quot;GPCI&quot;) que miden &quot;lo que cuesta practicar medicina&quot; en cada lugar: salarios, renta, seguros. Suena justo. La trampa: <b>la fórmula usa los salarios locales como termómetro del costo.</b> Como en PR los salarios son bajos, la fórmula concluye &quot;allá es barato practicar&quot; y paga bajo. Y como paga bajo, los salarios se quedan bajos. Un perro mordiéndose la cola, con sello federal. Puerto Rico tuvo los tres índices <b>más bajos de toda la nación</b>.</p>

<p>Y aquí el dato que casi nadie cuenta, porque prueba que esto SÍ se puede pelear: <b>en 2017, tras años de presión, CMS corrigió los índices de PR al promedio nacional (1.0).</b> La pelea de la fórmula se ganó. Pero el daño de décadas ya estaba hecho — y el mecanismo del descuento se mudó de sitio. Hoy vive en el peaje.</p>

<p><i>(Nota de precisión: por eso este informe NO dice que la fórmula GPCI siga siendo el problema de hoy. El descuento de hoy tiene otro nombre. Sigue leyendo.)</i></p>

<h2>§2 · El Peaje (dónde vive el 40% hoy)</h2>

<p><b>Versión abuela:</b> <i>El gobierno federal manda el dinero de tus médicos por correo. El cartero es una aseguradora. El cartero decide cuánto te llega.</i></p>

<p>En Puerto Rico, <b>~94% de los beneficiarios de Medicare están en Medicare Advantage</b> — la penetración más alta de la nación (el promedio nacional es ~55%). ¿Por qué? La aseguradora sale a buscar cabezas. ¿Cómo convence a una población donde el ingreso es bajo? Premium $0 + dental + espejuelos + transporte + la tarjetita de compra. Para alguien con $900 de Seguro Social, eso es irresistible. No es que los boricuas amen los planes: es que Medicare tradicional aquí es impagable (deducibles, sin Medigap barato) y el plan regala cosas visibles.</p>

<p>Ahora los números del peaje:</p>

<li>El gobierno federal le paga a los planes de PR usando &quot;benchmarks&quot; que en 2022 estaban <b>41% por debajo del promedio nacional</b> — porque se calculan sobre el gasto histórico local, que la fórmula vieja mantuvo deprimido por décadas. La circularidad no murió: se mudó. <i>(JAMA Health Forum, 2022.)</i></li>
<li>Y aquí el truco: una vez el plan tiene la cabeza, <b>el plan decide cuánto le paga al médico.</b> Con 3-4 aseguradoras controlando ~90% de los pacientes mayores, el médico no negocia nada: o aceptas la tarifa que te pongo, te pago cuando me dé la gana, y me pides permiso (pre-autorización) pa&#x27; cada cosa — o te quedas sin pacientes. Eso tiene nombre en economía: <b>monopsonio</b>. Un solo comprador que fija el precio de tu trabajo.</li>
<li>¿Y dónde gana el plan? No atendiendo mejor. Gana <b>codificando</b>: mientras más diagnósticos le documenta a cada paciente, más le paga el gobierno federal por esa cabeza. El negocio está en el papeleo, no en pagarle al médico ni en curarte.</li>

<p>El dinero federal SÍ llega a Puerto Rico. Se queda en el peaje.</p>

<h2>§3 · La Mesada (Medicaid / Vital)</h2>

<p><b>Versión abuela:</b> <i>A los estados, Washington les dice: &quot;de cada dólar que gastes curando a tus pobres, yo pongo la mayoría — gastes lo que gastes.&quot; A Puerto Rico le dice: &quot;toma una mesada. Cuando se acabe, se acabó — aunque la gente siga enferma.&quot;</i></p>

<p>Así funciona para un estado: el gobierno federal paga un <b>porcentaje de TODO el gasto de Medicaid, sin tope</b>. El porcentaje depende de cuán pobre es el estado — mientras más pobre, más pone Washington (el máximo por ley es 83%). Misisipi, el estado más pobre, recibe ~77%.</p>

<p>Así funciona para Puerto Rico: <b>dos castigos a la vez.</b></p>

<li><b>El porcentaje está congelado por estatuto en 55%</b> — no se calcula por pobreza. Si a PR se le aplicara la misma fórmula que a los estados, por nuestro nivel de pobreza nos tocaría <b>el máximo: 83%</b>. <i>(MACPAC; Congressional Research Service.)</i></li>
<li><b>Y encima hay un techo de dólares</b> (el &quot;tope de la Sección 1108&quot;): el 55% aplica solo hasta que se acaba la asignación anual. Después de eso, el gobierno federal pone <b>cero</b> y PR paga solo. Los estados no tienen techo. Nosotros sí.</li>

<p>El parcho vigente: el Congreso subió el porcentaje a <b>76% hasta el 30 de septiembre de 2027</b> (Ley de Asignaciones Consolidadas de 2023). Ese día, sin acción del Congreso, <b>cae de cantazo a 55%</b> — el famoso &quot;precipicio de Medicaid&quot;, y ya tiene fecha. Y la mesada tiene números: el techo es <b>$3,645 millones para el año fiscal 2026</b> y $3,825M para el 2027. <i>(KFF; CRS IF11012.)</i> Un sistema de salud no se planifica con parchos que vencen.</p>

<p><b>El resultado en la calle:</b> Vital (La Reforma) les paga a médicos y hospitales tarifas ~<b>un tercio más bajas</b> que lo que pagan los planes Medicaid del continente. <i>(KFF Health News.)</i> En los pueblos pobres — donde Vital es la mayoría de los pacientes — practicar medicina simplemente no da los números. Por eso el desierto empieza en la montaña.</p>

<h2>§4 · La Compresión (por qué se van — y no es avaricia)</h2>

<p><b>Versión abuela:</b> <i>Al médico le llevan 25 años pagándole lo mismo por hora, mientras la luz, la renta y la nómina le suben todos los años. Tú también te irías.</i></p>

<p>No es avaricia, es compresión. La tarifa base de Medicare (el &quot;conversion factor&quot;) lleva más de 20 años prácticamente congelada a nivel nacional. Entre 2001 y 2025, el pago de Medicare al médico quedó plano mientras <b>el costo de operar una práctica subió 59%</b>. Ajustado por inflación, el médico cobra hoy <b>33% MENOS</b> por el mismo procedimiento que en 2001. <i>(AMA, 2025.)</i></p>

<p>Ahora móntale eso encima de una base que ya era la más baja de la nación, y de un mercado donde el 94% de tus pacientes viene por planes que pagan por debajo de Medicare. El médico de PR no se va &quot;por más dinero&quot; — se va porque <b>su hora vale menos cada año</b> mientras todo lo demás sube. En 2016, la hora del médico en PR valía <b>menos de la mitad</b> que en el continente. Cualquier persona con una calculadora se va. Los que se quedan, se quedan por otra cosa que no es la matemática.</p>

<p>Lo local que se ha hecho (Ley 14-2017: contribución fija de 4% pa&#x27; médicos) ayuda al margen, pero no arregla la matemática del que paga.</p>

<h2>§5 · ¿Y esto es legal? Sí. Y por eso no se ha arreglado.</h2>

<p><b>Versión abuela:</b> <i>El que reparte el dinero no nos debe nada en las elecciones. Y el Tribunal Supremo dijo que eso está bien.</i></p>

<p>La pregunta que todo el mundo hace: ¿esto no es discriminación? La respuesta incómoda: <b>es desigualdad legalizada.</b> La Constitución tiene una Cláusula Territorial que le permite al Congreso tratar a los territorios distinto que a los estados, y el Tribunal Supremo lo ha sostenido — la última vez en <i>Estados Unidos v. Vaello Madero</i> (2022).</p>

<p>¿Y por qué el Congreso no lo arregla, si es tan obvio? Porque un congresista de Florida que permita que le bajen Medicare a sus viejos pierde el puesto. <b>Con los viejos de PR, nadie pierde nada. No hay precio político por abandonarnos.</b> PR no tiene senadores ni voto presidencial. La única palanca que nos queda es la vergüenza pública con data indiscutible — y los mecanismos administrativos que no requieren al Congreso (ver §7). La corrección de 2017 se ganó exactamente así.</p>

<h2>§6 · Los malcriaos del plan (la parte que nadie quiere decir)</h2>

<p><b>Versión abuela:</b> <i>Al médico de aquí le enseñaron un solo negocio: facturarle al plan. Cuando el plan paga hambre, no conoce otro camino que el avión.</i></p>

<p>Sí existen otros modelos de negocio para un médico:</p>

<li><b>DPC (Direct Primary Care):</b> el paciente paga $50-80/mes directo al médico, sin plan, citas ilimitadas. Crece brutal en EE.UU.</li>
<li><b>Concierge / cash:</b> los psicólogos privados de PR ya lo hacen — muchos NO aceptan planes y cobran directo. (Por eso hay psicólogos en San Juan, pero el que depende de Vital no consigue.)</li>
<li><b>Telemedicina multi-estado, contratos con patronos, medicina laboral.</b></li>

<p>¿Por qué casi nadie lo hace aquí? Tres razones: <b>(a) nadie les enseña negocio</b> — la escuela de medicina los entrena a facturarle al plan, y facturarle al plan es todo lo que conocen: malcriaos del sistema; <b>(b) la cultura del asegurao</b> — aquí pagar cash por médico se siente raro, aunque la gente pague cash por el mecánico y el barbero sin pestañear; <b>(c) el mercado cash es flaco</b> — concierge funciona en Guaynabo, no en Maricao con 55% de pobreza.</p>

<p>Pero fíjate la combinación que SÍ cuadra en la montaña: <b>DPC barato + telemedicina + designación federal de escasez (HPSA).</b> Si Maricao logra la designación, el gobierno federal le paga los préstamos estudiantiles al clínico que se mude — hasta <b>$75,000 por 2 años</b> en cuidado primario y <b>$50,000</b> en las demás disciplinas, incluyendo salud mental <i>(NHSC, año fiscal 2026)</i> — y le da bono de Medicare. De momento el médico no necesita que el plan le pague bien: la deuda se la paga el gobierno y el piso se lo pone el DPC. <b>Ese es el modelo de negocio que nadie les está enseñando.</b> Y el expediente pa&#x27; pedir esa designación ya está escrito (ver §7).</p>

<h2>§7 · ¿Qué se puede hacer? (con nombre y apellido)</h2>

<p>Si nadie mueve el papeleo, esto empeora, porque cada retiro en la montaña es un médico que no se reemplaza. Lo que puede pasar tiene 3 niveles:</p>

<blockquote style="border-left:3px solid #0d9488;padding-left:10px;color:#334155"><b>La mejor noticia, la que casi nadie cuenta:</b> los médicos jóvenes de PR <i>quieren</i> quedarse. La emigración de graduados bajó de 56% (2022) a 43% (2024), y Puerto Rico tiene la segunda tasa más alta de retención del país: 75.6% se queda a ejercer donde hizo la residencia. El problema no es que se quieran ir. Es que <b>no hay suficientes plazas de residencia para retenerlos</b> — se van porque no hay dónde terminar de formarse aquí. Y eso se arregla en Puerto Rico, sin esperar al Congreso: crear plazas de residencia es la palanca más directa que tenemos. <i>(AAMC; NRMP; Centro de Periodismo Investigativo, 2024.)</i></blockquote>

<p><b>Nivel 1 — Federal (la cura de raíz, la más lenta):</b> paridad en los benchmarks de Medicare Advantage y en Medicaid (quitar el techo, aplicar la fórmula de pobreza real). Requiere al Congreso. Nuestro rol: que cada legislador, periodista y junta que toque este tema cite ESTE número y no un &quot;se dice&quot;. La corrección GPCI de 2017 prueba que la presión con data funciona.</p>

<p><b>Nivel 2 — El dinero que YA existe (alcanzable en ~1 año):</b> las designaciones federales de escasez (HPSA) destraban repago de préstamos (NHSC), bono de 10% de Medicare y elegibilidad de grants — pero requieren data fresca de proveedores por área, y <b>los mapas federales llevan décadas sin actualizarse porque nadie ha hecho el papeleo.</b> Ya empezamos: el expediente de <b>Maricao + Las Marías</b> (2 de los 3 municipios en cero absoluto, salud mental) está escrito y listo para la Oficina de Cuidado Primario del Departamento de Salud, que es quien radica ante el gobierno federal. Cada municipio que cualifique puede tener el suyo — la data ya está municipio por municipio en registromedicopr.com.</p>

<p><b>Nivel 3 — Hoy, sin esperar a nadie:</b></p>

<table border="1" cellpadding="6" style="border-collapse:collapse">
<tr><th>Si eres...</th><th>Haz esto</th></tr>
<tr><td><b>Vecino de un desierto</b></td><td>En registromedicopr.com está el más cercano que SÍ atiende, por especialidad y pueblo. Pa&#x27; salud mental, pregunta por telemedicina — tu plan la cubre más de lo que crees. Y suscríbete a TE AVISO: te avisamos si llega un especialista a tu zona.</td></tr>
<tr><td><b>Médico / psicólogo / residente</b></td><td>En estos pueblos no tienes competencia, y si la designación federal llega, el gobierno te paga los préstamos. Reclama tu ficha en el registro o levanta la mano — te avisamos cuando el expediente de tu zona se mueva.</td></tr>
<tr><td><b>Alcalde / legislador</b></td><td>El expediente de escasez de tu municipio se puede armar con esta data — el de Maricao y Las Marías ya existe como modelo. Pídelo: es papeleo que trae dinero federal, no una denuncia.</td></tr>
<tr><td><b>Diáspora cuidando a los tuyos</b></td><td>El registro te dice, desde allá, qué especialista existe en el pueblo de tu mamá y cuál es el más cercano real.</td></tr>
</table>

<h2>Apéndice · Las 29 especialidades, cuántas quedan hoy</h2>

<p>Conteo de proveedores individuales con NPI y práctica declarada en Puerto Rico (NPPES/CMS, julio 2026). Recuerda: es el techo, no el piso (ver &quot;El médico fantasma&quot; arriba).</p>

<table border="1" cellpadding="6" style="border-collapse:collapse">
<tr><th>Especialidad</th><th>Con NPI en PR</th></tr>
<tr><td>Coloproctólogo</td><td>4</td></tr>
<tr><td>Manejo de dolor</td><td>5</td></tr>
<tr><td>Cirujano torácico</td><td>15</td></tr>
<tr><td>Cirujano plástico</td><td>20</td></tr>
<tr><td>Alergista</td><td>27</td></tr>
<tr><td>Neurocirujano</td><td>44</td></tr>
<tr><td>Pediatra</td><td>74</td></tr>
<tr><td>Otorrinolaringólogo</td><td>75</td></tr>
<tr><td>Reumatólogo</td><td>86</td></tr>
<tr><td>Geriatra</td><td>106</td></tr>
<tr><td>Ginecólogo / Obstetra</td><td>109</td></tr>
<tr><td>Urólogo</td><td>119</td></tr>
<tr><td>Infectólogo</td><td>122</td></tr>
<tr><td>Dermatólogo</td><td>123</td></tr>
<tr><td>Oncólogo / Hematólogo</td><td>143</td></tr>
<tr><td>Neumólogo</td><td>146</td></tr>
<tr><td>Ortopeda</td><td>150</td></tr>
<tr><td>Nefrólogo</td><td>155</td></tr>
<tr><td>Endocrinólogo</td><td>158</td></tr>
<tr><td>Neurólogo</td><td>166</td></tr>
<tr><td>Gastroenterólogo</td><td>202</td></tr>
<tr><td>Anestesiólogo</td><td>225</td></tr>
<tr><td>Oftalmólogo</td><td>238</td></tr>
<tr><td>Fisiatra</td><td>251</td></tr>
<tr><td>Radiólogo</td><td>252</td></tr>
<tr><td>Cirujano general</td><td>332</td></tr>
<tr><td>Cardiólogo</td><td>337</td></tr>
<tr><td>Medicina de emergencia</td><td>342</td></tr>
<tr><td>Psiquiatra</td><td>473</td></tr>
</table>

<p><i>Cada una tiene su lista por región y teléfonos en registromedicopr.com. La cuenta se actualiza contra el registro federal.</i></p>

<h2>§8 · Metodología y fuentes</h2>

<p><b>Regla del informe:</b> cada afirmación con número lleva fecha y fuente pública verificable. Si encuentras un error, escríbenos y se corrige: angel@angelanderson.com.</p>

<li><b>Desiertos por municipio:</b> registro federal NPPES/CMS (proveedores individuales con práctica en PR, por código de taxonomía) × Censo Decenal 2020. Verificado municipio por municipio, julio 2026. Data viva: registromedicopr.com/registro/desiertos.</li>
<li><b>Éxodo 14,500 → 9,000 (2009-2020) y salario por hora &lt;50% del continente (2016):</b> <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC10170400/">On leaving: Coloniality and Physician Migration in Puerto Rico (PMC, 2023)</a> · <a href="https://pasquines.us/2022/08/23/doctor-exodus-threatens-healthcare-in-puerto-rico/">Pasquines (2022)</a> · <a href="https://www.nbcnews.com/news/latino/puerto-rico-s-exodus-doctors-adds-health-care-strain-dire-n783776">NBC News</a></li>
<li><b>GPCI más bajos de la nación + corrección de CMS a 1.0 (2017):</b> <a href="https://www.ama-assn.org/system/files/geographic-practice-cost-indices-gpcis.pdf">AMA — GPCIs</a> · <a href="https://www.govinfo.gov/content/pkg/GAOREPORTS-GAO-05-119/html/GAOREPORTS-GAO-05-119.htm">GAO-05-119</a> · <a href="https://puertoricoreport.com/physician-payments-increase-medicare/">Puerto Rico Report</a></li>
<li><b>Benchmarks MA 41% bajo el promedio nacional (2022):</b> <a href="https://jamanetwork.com/journals/jama-health-forum/fullarticle/2796409">JAMA Health Forum — Medicare Advantage Financing and Quality in Puerto Rico vs the 50 US States</a> · <a href="https://www.statnews.com/2024/02/21/medicare-puerto-rico-disparities-health-reimbursement/">STAT News (2024)</a></li>
<li><b>Penetración MA ~94% (la más alta; nacional ~55%):</b> <a href="https://www.kff.org/medicare/medicare-advantage-in-2026-enrollment-update-and-key-trends/">KFF — Medicare Advantage 2026 Enrollment Update</a> · <a href="https://www.mmapapr.org/post/modern-healthcare-puerto-rico-the-canary-in-the-coal-mine-for-medicare-advantage-growth">Modern Healthcare vía MMAPA</a></li>
<li><b>Medicaid: FMAP estatutario 55% (sería 83% como estado) + tope Sección 1108 + Vital paga ~1/3 menos:</b> <a href="https://www.macpac.gov/wp-content/uploads/2020/08/Medicaid-and-CHIP-in-Puerto-Rico.pdf">MACPAC — Medicaid and CHIP in Puerto Rico</a> · <a href="https://www.congress.gov/crs-product/IF11012">CRS IF11012</a> · <a href="https://www.commonwealthfund.org/publications/issue-briefs/2021/jan/how-states-fare-medicaid-block-grants-per-capita-caps-puerto-rico">Commonwealth Fund (2021)</a> · <a href="https://kffhealthnews.org/news/exodus-by-puerto-rican-medical-students-deepens-islands-doctor-drain/">KFF Health News</a></li>
<li><b>Conversion factor: -33% real 2001-2025, costos de práctica +59%:</b> <a href="https://www.ama-assn.org/practice-management/medicare-medicaid/medicare-physician-pay-has-plummeted-2001-find-out-why">AMA — Medicare physician pay has plummeted since 2001</a> · <a href="https://www.ama-assn.org/system/files/2025-medicare-updates-inflation-chart.pdf">AMA — updates vs inflation chart</a></li>
<li><b>NHSC repago de préstamos hasta $75K/2 años:</b> <a href="https://nhsc.hrsa.gov/loan-repayment/nhsc-loan-repayment-program">NHSC Loan Repayment Program (HRSA)</a></li>
<li><b>Cláusula Territorial / trato desigual sostenido:</b> <i>United States v. Vaello Madero</i>, 596 U.S. ___ (2022).</li>

<li><b>FMAP 76% hasta 2027-09-30 (luego cae a 55%) + techos anuales ($3,645M FY2026):</b> <a href="https://www.kff.org/elections/recent-changes-in-medicaid-financing-in-puerto-rico-and-other-u-s-territories/">KFF — Recent Changes in Medicaid Financing in Puerto Rico</a> · <a href="https://www.congress.gov/crs-product/IF11012">CRS IF11012</a> (Ley de Asignaciones Consolidadas de 2023, P.L. 117-328)</li>
<li><b>Ola de retiro (55% de los activos pa&#x27;l 2030; cirujanos edad promedio &gt;60):</b> <a href="https://www.elvocero.com/actualidad/alertan-sobre-la-falta-de-sucesi-n-de-m-dicos-en-la-isla/article_e796cd58-e59d-11ef-b202-e7fc5a49dad5.html">El Vocero (2025)</a> · <a href="https://medicinaysaludpublica.com/noticias/salud-publica/desafios-y-avances-de-salud-publica-en-puerto-rico-durante-el-2024/25653">Medicina y Salud Pública (2024)</a></li>
<li><b>Estudio FARO/Asociación de Industriales Farmacéuticos (55% retiro 2030; endocrinólogos 84 activos → 379 necesarios):</b> <a href="https://www.univision.com/local/puerto-rico-wlii/puerto-rico-escasez-medicos-especialistas-2030-enfermedades-salud">Univision Puerto Rico</a> · <a href="https://claridadpuertorico.com/puerto-rico-se-queda-sin-medicos-especialistas/">Claridad</a></li>
<li><b>Pipeline / residencias (emigración de graduados 56%→43% 2022-24; retención 75.6%; cuello de botella de plazas):</b> <a href="https://www.aamc.org/news/puerto-rican-medical-students-face-challenges-when-applying-residency">AAMC</a> · <a href="https://www.nrmp.org/wp-content/uploads/2025/02/Puerto-Rico_Revised.pdf">NRMP — Puerto Rico</a> · <a href="https://periodismoinvestigativo.com/2024/12/medical-residencies-increase-health-puerto-rico/">CPI — &quot;Los números de residencias no cuadran&quot; (2024)</a></li>

<p><b>Flags de verificación:</b> los 3 pendientes fueron cerrados 2026-07-05 con las fuentes de arriba. Nota editorial: la cifra de médicos totales más reciente con fuente sólida sigue siendo 9,000 (2020) — no se encontró censo médico posterior confiable; el informe usa 2020 + la proyección de retiro 2030 en su lugar.</p>

<hr>

<p><i>Este informe se publica desde Cabo Rojo, Puerto Rico. Lo vimos primero en el oeste, donde vivimos — pero la cuenta da igual de fea en casi toda la isla. La data completa, municipio por municipio, vive en registromedicopr.com y se actualiza contra el registro federal. Si te sirve, úsala. Es tuya.</i></p>
`
  const body = `<p class="text-xs text-slate-400 mb-4">Artículo · registromedicopr.com · publicado julio 2026 · <a href="/comparte" class="text-teal-600">datos citables</a> · <a href="/registro/estado" class="text-teal-600">estado de salud</a></p>
<div class="not-prose my-5 bg-slate-50 border border-slate-200 rounded-xl p-4">
  <p class="text-sm font-bold text-slate-800 mb-2">🎧 Escúchalo: "La verdad tras los médicos fantasmas" (~18 min)</p>
  <audio controls preload="none" class="w-full"><source src="https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/podcast/porque-medicos-fantasmas.m4a" type="audio/mp4">Tu navegador no soporta audio.</audio>
  <p class="text-xs text-slate-400 mt-1">Un análisis en audio de este artículo. Léelo abajo o escúchalo mientras manejas.</p>
</div>
${articleHtml}
<div class="not-prose mt-8 bg-slate-900 text-white rounded-2xl p-6">
  <p class="text-lg font-bold">📍 ¿Te aviso cuando cambie la salud de tu pueblo?</p>
  <p class="text-sm text-slate-300 mt-1">Deja tu correo. Te aviso si llega un especialista a tu zona o si sale data nueva. Sin spam, sin cuenta.</p>
  <form id="av-form" class="mt-3 flex flex-col sm:flex-row gap-2">
    <input id="av-email" type="email" required placeholder="tu@correo.com" class="flex-1 rounded-lg px-3 py-2 text-slate-900" aria-label="Tu correo" />
    <button type="submit" class="bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold rounded-lg px-5 py-2">Avísame</button>
  </form>
  <p id="av-done" class="text-sm text-teal-300 mt-2 hidden"></p>
  <p class="text-[11px] text-slate-400 mt-2">Un email solo cuando de verdad te sirve.</p>
</div>
<script>
(function(){var f=document.getElementById('av-form');if(!f)return;f.addEventListener('submit',function(e){e.preventDefault();var em=(document.getElementById('av-email').value||'').trim();if(!/.+@.+\\..+/.test(em)){alert('Escribe un email válido.');return;}var b=f.querySelector('button');b.disabled=true;b.textContent='...';fetch('/api/mapa-pages?page=registro-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:em,source:'porque',lang:'es'})}).then(function(r){return r.json()}).then(function(){f.classList.add('hidden');var d=document.getElementById('av-done');d.classList.remove('hidden');d.textContent='✅ Listo. Te aviso cuando haya algo nuevo cerca de los tuyos.';}).catch(function(){b.disabled=false;b.textContent='Avísame';alert('Hubo un error, intenta de nuevo.');});});})();
</script>
<div class="not-prose mt-4 bg-teal-700 rounded-2xl p-6 text-center text-white">
  <p class="text-lg font-bold mb-1">¿Buscas un especialista cerca?</p>
  <p class="text-sm text-teal-100 mb-4">El registro te dice quién hay y dónde, verificado contra el gobierno federal.</p>
  <a href="/registro" class="inline-flex items-center gap-2 bg-white text-teal-800 font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-50">Ir al registro</a>
</div>`
  const articleLd = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: '¿Por qué se van los médicos de Puerto Rico?',
    description: 'La matemática que explica el éxodo médico de PR, en cristiano y con fuente: la fórmula de Medicare, el peaje de Medicare Advantage, y la mesada de Medicaid. Cada número verificado.',
    author: { '@type': 'Person', name: 'Angel Anderson' },
    publisher: { '@type': 'Organization', name: 'Registro Médico PR', url: 'https://registromedicopr.com' },
    datePublished: '2026-07-05', dateModified: '2026-07-05', inLanguage: 'es',
    mainEntityOfPage: 'https://registromedicopr.com/porque',
  }
  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: '¿Por qué se van los médicos de Puerto Rico?', acceptedAnswer: { '@type': 'Answer', text: 'No es avaricia, es matemática. Medicare le paga a los médicos de PR menos que en los estados (los benchmarks de Medicare Advantage están 41% bajo el promedio nacional), Medicaid tiene un techo de dólares que los estados no tienen, y la tarifa base de Medicare ajustada por inflación bajó 33% entre 2001 y 2025. La hora del médico vale menos cada año mientras todo sube.' } },
      { '@type': 'Question', name: '¿Cuántos médicos le quedan a Puerto Rico?', acceptedAnswer: { '@type': 'Answer', text: 'PR pasó de ~14,500 médicos (2009) a ~9,000 (2020). Un estudio de FARO proyecta que el 55% de los activos se habrá retirado para 2030 sin sustitutos. Hoy quedan, por ejemplo, 4 coloproctólogos, 44 neurocirujanos y 106 geriatras para 3.2 millones de personas (registro federal NPPES, julio 2026).' } },
      { '@type': 'Question', name: '¿La desigualdad de fondos de salud de PR es legal?', acceptedAnswer: { '@type': 'Answer', text: 'Sí. La Cláusula Territorial de la Constitución permite al Congreso tratar a los territorios distinto que a los estados, y el Tribunal Supremo lo sostuvo en Estados Unidos v. Vaello Madero (2022). No se arregla porque PR no tiene senadores ni voto presidencial: no hay costo político por no actuar.' } },
      { '@type': 'Question', name: '¿Qué se puede hacer para que vuelvan los médicos?', acceptedAnswer: { '@type': 'Answer', text: 'Tres niveles: paridad federal en Medicare/Medicaid (requiere al Congreso); activar las designaciones federales de escasez (HPSA) que traen repago de préstamos NHSC; y crear plazas de residencia, porque los médicos jóvenes quieren quedarse (la emigración de graduados bajó de 56% a 43%) pero no hay dónde formarse aquí.' } },
    ],
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: '¿Por qué se van los médicos de Puerto Rico? — la matemática, con fuente',
    description: 'El éxodo médico de PR explicado en cristiano y verificado: la fórmula de Medicare, el peaje de Medicare Advantage, la mesada de Medicaid, y qué se puede hacer hoy.',
    slug: 'porque', bodyHtml: body, jsonLd: [articleLd, faqLd, {
      '@context': 'https://schema.org', '@type': 'AudioObject',
      name: 'La verdad tras los médicos fantasmas',
      description: 'Análisis en audio (es-419) sobre por qué se van los médicos de Puerto Rico: la fórmula de Medicare, el peaje de los planes, la mesada de Medicaid y el médico fantasma.',
      contentUrl: 'https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/podcast/porque-medicos-fantasmas.m4a',
      encodingFormat: 'audio/mp4', inLanguage: 'es', uploadDate: '2026-07-05',
    }] as any, ogImage: '/og/desiertos.png',
    host: req.headers?.host, canonicalHost: 'https://registromedicopr.com',
  }))
}

// =============== /comparte — Datos citables (press kit + LLM-quotable + SEO) ===============
// Cada dato = pregunta + respuesta con fuente y fecha. FAQPage schema (lo que los LLM citan) + Dataset.
async function handleComparte(req: any, res: any) {
  let g = { conHpsa: 65, cupon: 33, cuponPob: 792221, bajo5: 39, bajo5Pob: 1046856, sinPsiq: 36, sinPsiqPob: 930159, cero: 3 }
  try {
    const { data } = await supabase.from('v_registro_municipio_intel').select('poblacion,especialistas,psiquiatras,hpsa_primaria,hpsa_salud_mental,cupon_mh_sin_cobrar,por_10k_hab').range(0, 100)
    if (data && data.length >= 70) {
      const cup = data.filter((r: any) => r.cupon_mh_sin_cobrar)
      const b5 = data.filter((r: any) => Number(r.por_10k_hab) < 5)
      const sp = data.filter((r: any) => Number(r.psiquiatras) === 0)
      g = {
        conHpsa: data.filter((r: any) => r.hpsa_primaria > 0 || r.hpsa_salud_mental > 0).length,
        cupon: cup.length, cuponPob: cup.reduce((s: number, r: any) => s + Number(r.poblacion), 0),
        bajo5: b5.length, bajo5Pob: b5.reduce((s: number, r: any) => s + Number(r.poblacion), 0),
        sinPsiq: sp.length, sinPsiqPob: sp.reduce((s: number, r: any) => s + Number(r.poblacion), 0),
        cero: data.filter((r: any) => Number(r.especialistas) === 0).length,
      }
    }
  } catch (_) { /* fallback */ }
  const n = (x: number) => x.toLocaleString('en-US')

  const FACTS: Array<{ q: string; a: string; srcText: string; srcUrl: string; tag?: 'medicos' | 'local' }> = [
    { q: '¿Cuántos municipios de Puerto Rico están declarados en escasez de médicos por el gobierno federal?', a: `${g.conHpsa} de los 76 municipios de Puerto Rico (sin Vieques y Culebra) tienen una designación federal de escasez de profesionales de la salud (HPSA) activa, de cuidado primario o salud mental.`, srcText: 'Archivos oficiales de HRSA (Health Resources & Services Administration), designaciones activas, julio 2026.', srcUrl: 'https://data.hrsa.gov/tools/shortage-area/hpsa-find' },
    { q: '¿Cuánto dinero federal para atraer médicos se está quedando sin reclamar en Puerto Rico?', a: `${g.cupon} municipios de PR tienen una designación federal de salud mental activa (que destraba repago de préstamos del NHSC y bono de Medicare) y a la vez CERO psiquiatras ejerciendo. Son ${n(g.cuponPob)} personas con el dinero aprobado y sin médico que lo cobre.`, srcText: 'Cruce NPPES/CMS × archivos HRSA, verificado municipio por municipio (ver el detalle).', srcUrl: 'https://registromedicopr.com/registro/estado' },
    { q: '¿Cuántos pueblos de Puerto Rico no tienen ni un solo especialista médico?', a: `${g.cero} municipios de PR no tienen ni un especialista médico de ninguna clase con práctica declarada: Maricao, Las Marías y Florida.`, srcText: 'Registro federal NPPES/CMS por municipio (ver el mapa).', srcUrl: 'https://registromedicopr.com/registro/mapa' },
    { q: '¿Le llegó dinero de recuperación a los pueblos que no tienen médicos?', a: 'Sí, pero solo el de cemento. $3,469 millones de fondos federales de recuperación (FEMA) fueron a los 33 municipios de PR que tienen designación de salud mental activa y cero psiquiatras. Se reconstruyeron edificios, carreteras y sistemas de agua. No llegó ni un médico de la mente. Ejemplo: Jayuya recibió $424 millones y tiene 2 especialistas y cero psiquiatras.', srcText: 'OpenFEMA (Public Assistance) × NPPES/CMS × HRSA, julio 2026.', srcUrl: 'https://www.fema.gov/openfema-data-page/public-assistance-funded-projects-summaries-v1' },
    { q: '¿Cómo está Cabo Rojo de médicos comparado con sus vecinos del oeste?', a: 'Cabo Rojo está entre los pueblos mejor servidos del oeste: 99 especialistas y 3 psiquiatras, con el hub de Mayagüez a unos 20 minutos. Pero está rodeado de desiertos: a menos de una hora, en la montaña, Maricao y Las Marías no tienen ni un especialista de ninguna clase.', srcText: 'NPPES/CMS × Censo 2020 (ver el mapa).', srcUrl: 'https://registromedicopr.com/registro/mapa', tag: 'local' },
    { q: '¿Cuántos pueblos del oeste no tienen ni un psiquiatra?', a: 'Seis municipios del oeste no tienen ni un psiquiatra: Maricao, Las Marías, Hormigueros, Añasco, Lajas y Moca. Todo el oeste depende de los 26 psiquiatras de Mayagüez. Y Añasco recibió $316 millones de fondos federales de recuperación sin un solo psiquiatra en el pueblo.', srcText: 'NPPES/CMS × HRSA × OpenFEMA (ver el estado).', srcUrl: 'https://registromedicopr.com/registro/estado', tag: 'local' },
    { q: '¿Cuántos puertorriqueños viven en un municipio sin psiquiatra?', a: `${g.sinPsiq} municipios de PR no tienen ni un psiquiatra con práctica declarada. Son ${n(g.sinPsiqPob)} personas, cerca de 1 de cada 3 puertorriqueños.`, srcText: 'Registro federal NPPES/CMS (ver el estado, pueblo por pueblo).', srcUrl: 'https://registromedicopr.com/registro/estado' },
    { q: '¿Qué tan concentrados están los especialistas médicos en San Juan?', a: 'San Juan concentra alrededor del 35% de todos los especialistas médicos de Puerto Rico con cerca del 10% de la población de la isla.', srcText: 'NPPES/CMS × Censo 2020 (ver el mapa).', srcUrl: 'https://registromedicopr.com/registro/mapa' },
    { q: '¿Cuál es la desigualdad de acceso médico más extrema en Puerto Rico?', a: `${g.bajo5} de los 76 municipios (${n(g.bajo5Pob)} personas, casi 1 de cada 3) viven con menos de 5 especialistas por cada 10,000 habitantes, mientras San Juan tiene cerca de 69. Loíza, a media hora de San Juan, tiene 86 veces menos especialistas por persona.`, srcText: 'NPPES/CMS × Censo 2020, municipio por municipio (ver los desiertos).', srcUrl: 'https://registromedicopr.com/registro/desiertos' },
    { q: '¿En cuántos pueblos un psiquiatra tendría cero competencia y el gobierno le pagaría los préstamos?', a: 'Hay 26 municipios de PR con una designación federal de salud mental de puntaje casi máximo (20 o más de 25) y CERO psiquiatras. Un psiquiatra que ejerza en uno de esos pueblos, en un sitio aprobado por el NHSC, puede recibir hasta $50,000 de repago de préstamos por dos años y no tiene competencia local. Los de puntaje más alto: Peñuelas, Guayanilla, Guánica y Jayuya.', srcText: 'Cruce NPPES/CMS × HRSA × NHSC, verificado (ver el estado).', srcUrl: 'https://registromedicopr.com/registro/estado', tag: 'medicos' },
    { q: '¿En cuántos pueblos un médico primario tendría oportunidad con incentivo federal?', a: 'Hay 10 municipios de PR con una designación federal de cuidado primario activa y 5 o menos especialistas. Un médico primario en un sitio aprobado dentro de esos pueblos puede recibir hasta $75,000 de repago de préstamos por dos años, más bono de Medicare.', srcText: 'Cruce NPPES/CMS × HRSA × NHSC, verificado (ver el estado).', srcUrl: 'https://registromedicopr.com/registro/estado', tag: 'medicos' },
    { q: '¿Cuántos médicos ha perdido Puerto Rico?', a: 'Puerto Rico pasó de unos 14,500 médicos en 2009 a cerca de 9,000 en 2020. Se proyecta que el 55% de los médicos activos se habrá retirado para el 2030, sin sustitutos.', srcText: 'PMC / academia (2023); El Vocero (2025).', srcUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10170400/' },
    { q: '¿Por qué Medicare le paga menos a los médicos en Puerto Rico?', a: 'Los pagos de Medicare Advantage en Puerto Rico están alrededor de 41% por debajo del promedio nacional, porque se calculan sobre el gasto histórico local, deprimido por décadas por índices geográficos que fueron los más bajos de la nación.', srcText: 'JAMA Health Forum (2022).', srcUrl: 'https://jamanetwork.com/journals/jama-health-forum/fullarticle/2796409' },
    { q: '¿Cómo trata Medicaid a Puerto Rico distinto que a un estado?', a: 'El porcentaje de Medicaid que paga el gobierno federal a PR está congelado por estatuto en 55%, cuando por su nivel de pobreza le tocaría 83% como estado. Además tiene un techo de dólares que los estados no tienen. El nivel actual de 76% cae de vuelta a 55% el 30 de septiembre de 2027 sin acción del Congreso.', srcText: 'Congressional Research Service (IF11012); MACPAC.', srcUrl: 'https://www.congress.gov/crs-product/IF11012' },
    { q: '¿Cuánto ha bajado el pago de Medicare a los médicos con el tiempo?', a: 'Ajustado por inflación, el pago de Medicare al médico bajó 33% entre 2001 y 2025, mientras el costo de operar una práctica subió 59%.', srcText: 'American Medical Association (2025).', srcUrl: 'https://www.ama-assn.org/practice-management/medicare-medicaid/medicare-physician-pay-has-plummeted-2001-find-out-why' },
    { q: '¿Qué incentivo federal existe para atraer médicos a los pueblos designados?', a: 'En un municipio con designación HPSA, un clínico en un sitio aprobado por el National Health Service Corps puede recibir repago de préstamos estudiantiles de hasta $75,000 por dos años en cuidado primario y $50,000 en otras disciplinas, más un bono de Medicare.', srcText: 'National Health Service Corps (HRSA), año fiscal 2026.', srcUrl: 'https://nhsc.hrsa.gov/loan-repayment/nhsc-loan-repayment-program' },
    { q: '¿Cuál es el municipio más pobre de Puerto Rico y cómo está de médicos?', a: 'Guánica es el municipio más pobre de PR (63.6% bajo el nivel de pobreza). Tiene una designación federal de salud mental con el puntaje máximo posible y cero psiquiatras.', srcText: 'ACS 5-año (censo) × NPPES/CMS × HRSA (ver el estado).', srcUrl: 'https://registromedicopr.com/registro/estado' },
    { q: '¿El sueldo rinde en Puerto Rico?', a: 'El ingreso mediano de un hogar en PR ronda los $25,000 al año, cerca de un tercio del de EE.UU. (~$81,600), pero la luz cuesta casi el doble (~24.5¢/kWh) y la comida importada corre 15-30% más cara por la Ley Jones. El salario mínimo es $10.50 la hora (~$1,820 al mes), menos que el ingreso mediano de un hogar.', srcText: 'Censo/ACS; EIA; DACO (Orden 2021-012); Depto. del Trabajo de PR (ver el récord).', srcUrl: 'https://puertoricosinfiltros.com/costo-de-vida' },
    { q: '¿Cuánta gente en Puerto Rico está trabajando?', a: 'Solo el 40.7% de la población en edad de trabajar de PR está en la fuerza laboral (2024): menos de la mitad, contra cerca de 63% en EE.UU.', srcText: 'Banco Mundial / BLS (2024) (ver el récord).', srcUrl: 'https://puertoricosinfiltros.com/trabajo' },
    { q: '¿A qué pueblos de PR les pega más la inteligencia artificial?', a: 'Los pueblos con más empleo de pantalla (Guaynabo, San Juan, Bayamón, Carolina) son los más expuestos a la inteligencia artificial; los del campo (Vieques, Maunabo, Salinas, Maricao) los más resilientes. Es el primer ranking de exposición a la inteligencia artificial de los 78 municipios de PR, cruzando la ocupación del Censo con índices de exposición por ocupación.', srcText: 'Censo/ACS (C24010) × Eloundou 2023 / AIOE (ver el ranking).', srcUrl: 'https://puertoricosinfiltros.com/exposicion-ai' },
    { q: '¿Cuánto del dinero de recuperación de PR se fue de la isla?', a: 'De cada dólar de contrato de recuperación de Puerto Rico rastreado, cerca de 87 centavos salieron hacia el mainland, a firmas de consultoría e ingeniería fuera de la isla. Solo el 13% quedó en manos de empresas boricuas.', srcText: 'OpenFEMA / USASpending (ver el récord).', srcUrl: 'https://puertoricosinfiltros.com/sigue-el-dinero' },
    { q: '¿Está limpia el agua en el oeste de Puerto Rico?', a: 'El récord federal de la EPA muestra 13 violaciones de salud del agua activas en el oeste de PR: Cabo Rojo con 3 (trihalometanos) y los acueductos comunitarios de San Germán (Periche, Río Piedras y Méndez) con 8.', srcText: 'EPA (SDWIS), récord federal del agua potable (ver el récord).', srcUrl: 'https://puertoricosinfiltros.com/agua', tag: 'local' },
    { q: '¿Qué le pasa a Puerto Rico para 2030 si no cambia nada?', a: 'Se reconstruye el ladrillo mientras se pierde el recurso humano para servirlo: el Medicaid federal cae de 76% a 55% el 30 de septiembre de 2027, el 55% de los médicos se retira para 2030, y la inteligencia artificial empieza a cortar los trabajos de pantalla que sostienen a las familias que no se fueron de la isla.', srcText: 'Síntesis de récords verificados (ver la predicción).', srcUrl: 'https://puertoricosinfiltros.com/prediccion' },
  ]

  const heroClaim = `El dinero federal para traer médicos a Puerto Rico ya está aprobado y no se cobra. ${g.conHpsa} de 76 municipios tienen designación federal de escasez activa; ${g.cupon} tienen el dinero de salud mental aprobado y cero psiquiatras, para ${n(g.cuponPob)} personas. Verificado pueblo por pueblo contra el registro federal. Fuente: registromedicopr.com/registro/estado`

  const factCards = FACTS.map((f, i) => {
    const isExt = f.srcUrl.startsWith('http') && !/registromedicopr\.com/.test(f.srcUrl)
    const copyText = `${f.a} Fuente: ${f.srcText} Vía registromedicopr.com/comparte`
    const box = f.tag === 'medicos' ? 'border-teal-300 bg-teal-50/40' : f.tag === 'local' ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 bg-white'
    const label = f.tag === 'medicos' ? 'Para médicos' : f.tag === 'local' ? 'Cabo Rojo y el oeste' : 'Dato'
    return `
    <div class="not-prose border ${box} rounded-xl p-4 mt-4">
      <div class="flex items-start justify-between gap-2">
        <p class="text-xs font-bold text-teal-700 uppercase tracking-wide">${label} ${i + 1}</p>
        <button type="button" class="copy-btn shrink-0 text-xs font-semibold text-teal-700 border border-teal-300 rounded-full px-3 py-1 hover:bg-teal-50" data-copy="${escapeHtml(copyText)}">📋 Copiar</button>
      </div>
      <p class="text-sm font-semibold text-slate-500 mt-1">${escapeHtml(f.q)}</p>
      <blockquote class="mt-2 text-slate-900 leading-relaxed border-l-4 border-teal-500 pl-3">${escapeHtml(f.a)}</blockquote>
      <p class="text-xs text-slate-500 mt-2"><strong>Fuente:</strong> <a href="${escapeHtml(f.srcUrl)}"${isExt ? ' target="_blank" rel="noopener"' : ''} class="text-teal-700 underline hover:text-teal-900">${escapeHtml(f.srcText)}</a>${isExt ? ' ↗' : ''}</p>
    </div>`
  }).join('')

  const body = `
<h1>Datos citables de Puerto Rico, verificados uno por uno</h1>
<p class="text-lg text-slate-600 mt-3"><strong>El trabajo pesado ya está hecho.</strong> Cada número de esta página está verificado contra su fuente federal o pública, con fecha. No tienes que buscarlo, ni cruzar bases de datos, ni dudar si está bien: <strong>cópialo y úsalo.</strong> Si eres periodista, legislador, investigador o vecino, esto es para que lo tomes, lo cites, y sigas tu camino. Salud, costo de vida, trabajo, agua, dinero de recuperación — todo con la fuente al lado.</p>

<div class="not-prose mt-4 flex flex-wrap gap-3 text-sm">
  <a href="/registro/estado" class="inline-flex items-center gap-2 bg-teal-700 text-white font-bold px-4 py-2 rounded-full hover:bg-teal-800">Ver el estado de salud, pueblo por pueblo</a>
  <a href="/registro/mapa" class="inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-full hover:border-teal-400">Abrir el mapa interactivo</a>
</div>

<div class="not-prose mt-6 bg-slate-900 text-white rounded-2xl p-5 sm:p-6">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">El titular verificado</p>
  <p class="text-xl sm:text-2xl font-black mt-1 leading-snug">El dinero federal para traer médicos ya está aprobado. Y no se cobra.</p>
  <p class="text-slate-300 mt-2 text-sm leading-relaxed">${g.conHpsa} de 76 municipios de PR con designación federal de escasez activa. ${g.cupon} con el dinero de salud mental aprobado y cero psiquiatras: ${n(g.cuponPob)} personas. Verificado contra el registro federal, pueblo por pueblo.</p>
  <button type="button" class="copy-btn mt-3 text-sm font-bold text-slate-900 bg-white rounded-full px-4 py-2 hover:bg-slate-100" data-copy="${escapeHtml(heroClaim)}">📋 Copiar el titular</button>
</div>

<h2>Los datos (toca "Copiar" en cualquiera)</h2>
${factCards}

<h2>El médico fantasma (por qué el número real es aún más bajo)</h2>
<div class="not-prose border-l-4 border-amber-500 bg-amber-50 rounded-r-xl p-4 mt-2">
<p class="text-slate-700 leading-relaxed">Antes de que alguien diga "tu data está mal porque cuenta médicos que ya se fueron": tiene razón a medias, y eso hace la crisis <strong>peor</strong>, no mejor. Estos conteos vienen del registro federal (NPPES), y <strong>tener un número federal (NPI) no es estar viendo pacientes.</strong> Pregúntale a cualquier vecino mayor y te dice "mi doctor se fue pa' Estados Unidos" — pero ese doctor sigue apareciendo como activo, porque el NPI no se apaga cuando uno se va. La prueba: un estudio de FARO cuenta 84 endocrinólogos activos; el registro federal cuenta 158. Esos 74 de diferencia son fantasmas. <strong>Lo que de verdad queda atendiendo es aún menos que lo que muestran estos números.</strong> Por eso este registro se verifica a mano, uno por uno: los directorios federales están 45-52% equivocados, y nadie los revisa.</p>
</div>

<h2>Cómo citar</h2>
<p>Formato sugerido: <em>"Registro Médico PR (registromedicopr.com), julio 2026, con data del registro federal NPPES/CMS y HRSA."</em> Cada número de esta página se puede respaldar con su fuente primaria pública. Si necesitas la metodología completa o el corte de un municipio específico, escríbenos.</p>

<h2>Descarga y profundiza</h2>
<ul>
  <li><a href="/registro/estado">Estado de Salud de Puerto Rico</a>: los 76 municipios rankeados, el análisis del cupón federal sin cobrar.</li>
  <li><a href="/registro/mapa">El mapa interactivo</a>: escoge la especialidad y mira cada pueblo.</li>
  <li><a href="/registro/desiertos">Los desiertos médicos</a>: las especialidades sin proveedor por región.</li>
  <li><a href="/observatorio">El Observatorio</a>: por qué se van los médicos, quién tiene la autoridad de actuar, podcast y reporte PDF.</li>
</ul>

<h2>Para prensa</h2>
<p>Angel Anderson, registromedicopr.com, desde Cabo Rojo. Contacto: <a href="mailto:angel@angelanderson.com">angel@angelanderson.com</a>. Puedo respaldar cualquier cifra con su fuente, entregar el corte de un municipio, o explicar la metodología. Prefiero texto o correo.</p>

<div class="not-prose bg-teal-50 border border-teal-200 rounded-2xl p-5 mt-8">
  <p class="text-slate-800 leading-relaxed">Ese es el punto de esta página: <strong>que no tengas que hacer el trabajo dos veces.</strong> Alguien ya cruzó las bases de datos, uno por uno, con la fuente al lado. Tómalo, cítalo, y sigue tu camino. Si no te sirve, también está bien.</p>
</div>

<p class="text-sm text-slate-500 mt-6">Metodología: cruce de fuentes federales/públicas a nivel de municipio — NPPES/CMS y HRSA (salud), Censo/ACS y EIA y DACO (costo de vida y trabajo), OpenFEMA/USASpending (recuperación), EPA (agua). Cada número enlaza a su récord con la fuente primaria. Verificado a mano. Última actualización: julio 2026. ¿Ves un error? Escríbenos y se corrige.</p>

<script>
(function(){
  document.querySelectorAll('.copy-btn').forEach(function(b){
    b.addEventListener('click',function(){
      var t=b.getAttribute('data-copy')||'';
      var done=function(){var o=b.textContent;b.textContent='✓ Copiado';b.disabled=true;setTimeout(function(){b.textContent=o;b.disabled=false},1600)};
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(done).catch(function(){})}
      else{var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done()}catch(e){}document.body.removeChild(ta)}
    });
  });
})();
</script>
`
  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FACTS.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: `${f.a} Fuente: ${f.srcText}` } })),
  }
  const datasetLd = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: 'Datos citables de acceso médico en Puerto Rico',
    description: `${g.conHpsa} de 76 municipios de PR con designación federal de escasez activa, ${g.cupon} con el cupón de salud mental sin cobrar (${n(g.cuponPob)} personas), 3 municipios sin ningún especialista. Fuentes: NPPES/CMS, HRSA, Censo.`,
    creator: { '@type': 'Organization', name: 'Registro Médico PR', url: 'https://registromedicopr.com' },
    isAccessibleForFree: true, inLanguage: 'es', url: 'https://registromedicopr.com/comparte',
    keywords: ['acceso médico Puerto Rico', 'escasez de médicos', 'HPSA', 'NPPES', 'desiertos médicos', 'datos citables'],
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: 'Datos citables sobre el acceso médico en Puerto Rico — para prensa y quien quiera compartir',
    description: 'Cada dato con su fuente: 65 de 76 municipios de PR con escasez de médicos declarada por el gobierno federal, 33 con dinero de salud mental sin cobrar. Copia, cita, comparte.',
    slug: 'comparte', bodyHtml: body, jsonLd: [faqLd, datasetLd] as any, ogImage: '/og/desiertos.png',
    host: req.headers?.host, canonicalHost: 'https://registromedicopr.com',
  }))
}

// =============== puertoricosinfiltros.com — la tercera cara del substrato: el récord público de PR ===============
// Puerta de entrada PR-wide al récord verificado. Un dato, su fuente, y la brecha entre lo declarado y lo entregado.
// Reusa los datasets ya vivos (Cupón, mapa médico, desiertos, agua) + la capa citable (/comparte, /civico.json, /llms.txt).
// Sirve en el root de puertoricosinfiltros.com vía middleware; también en /sinfiltros de los otros hosts.
// OG de PRSF — bandera que abre puertas (misión: para escoger, primero hay que ver).
const OG_SINFILTROS = 'https://puertoricosinfiltros.com/api/og?theme=sinfiltros'
  + '&t=' + encodeURIComponent('Puerto Rico,||sin filtros')
  + '&k=' + encodeURIComponent('El récord público verificado')
  + '&sub=' + encodeURIComponent('Los datos que nadie te enseñó. Para escoger el futuro, primero hay que verlo claro.')
  + '&site=puertoricosinfiltros.com'

async function handleSinFiltros(req: any, res: any) {
  // Números en vivo (mismo query + fallback verificado 2026-07-05 que /comparte).
  let g = { conHpsa: 65, cupon: 33, cuponPob: 792221, bajo5: 39, bajo5Pob: 1046856, sinPsiq: 36, sinPsiqPob: 930159, cero: 3 }
  try {
    const { data } = await supabase.from('v_registro_municipio_intel').select('poblacion,especialistas,psiquiatras,hpsa_primaria,hpsa_salud_mental,cupon_mh_sin_cobrar,por_10k_hab').range(0, 100)
    if (data && data.length >= 70) {
      const cup = data.filter((r: any) => r.cupon_mh_sin_cobrar)
      const b5 = data.filter((r: any) => Number(r.por_10k_hab) < 5)
      const sp = data.filter((r: any) => Number(r.psiquiatras) === 0)
      g = {
        conHpsa: data.filter((r: any) => r.hpsa_primaria > 0 || r.hpsa_salud_mental > 0).length,
        cupon: cup.length, cuponPob: cup.reduce((s: number, r: any) => s + Number(r.poblacion), 0),
        bajo5: b5.length, bajo5Pob: b5.reduce((s: number, r: any) => s + Number(r.poblacion), 0),
        sinPsiq: sp.length, sinPsiqPob: sp.reduce((s: number, r: any) => s + Number(r.poblacion), 0),
        cero: data.filter((r: any) => Number(r.especialistas) === 0).length,
      }
    }
  } catch (_) { /* fallback stands */ }
  const n = (x: number) => x.toLocaleString('en-US')

  // Demanda del Veci en vivo — el log ES un récord. Fallback verificado 2026-07-05 (90d).
  let dem = { total90: 228, unmet90: 78 }
  try {
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
    const [tot, unm] = await Promise.all([
      supabase.from('demand_signals_real').select('id', { count: 'exact', head: true }).gte('created_at', since),
      supabase.from('demand_signals_real').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('had_results', false),
    ])
    if (typeof tot.count === 'number' && tot.count > 0) dem = { total90: tot.count, unmet90: unm.count || 0 }
  } catch (_) { /* fallback stands */ }

  type Record = { titulo: string; brecha: string; fuente: string; verUrl: string; verificaUrl: string; verificaText: string; tag: string }
  const records: Record[] = [
    {
      titulo: 'El cupón federal sin cobrar',
      brecha: `El gobierno federal ya declaró en escasez a ${g.conHpsa} de los 76 municipios de PR y ya aprobó el dinero para atraer médicos. ${g.cupon} de ellos tienen el dinero de salud mental aprobado y CERO psiquiatras: ${n(g.cuponPob)} personas con el cupón sin cobrar.`,
      fuente: 'Cruce NPPES/CMS × archivos HRSA × Censo/ACS, verificado municipio por municipio, julio 2026.',
      verUrl: '/registro/estado', verificaUrl: 'https://data.hrsa.gov/tools/shortage-area/hpsa-find', verificaText: 'Archivos oficiales HRSA', tag: 'Salud',
    },
    {
      titulo: 'Los pueblos sin un solo especialista',
      brecha: `${g.cero} municipios de PR no tienen ni un especialista médico de ninguna clase con práctica declarada. Y ${g.sinPsiq} municipios (${n(g.sinPsiqPob)} personas, cerca de 1 de cada 3 boricuas) no tienen ni un psiquiatra.`,
      fuente: 'Registro federal NPPES/CMS por municipio, julio 2026.',
      verUrl: '/registro/mapa', verificaUrl: 'https://npiregistry.cms.hhs.gov/', verificaText: 'Registro federal NPPES', tag: 'Salud',
    },
    {
      titulo: 'El dinero del cemento llegó; el médico no',
      brecha: '$3,469 millones de fondos federales de recuperación (FEMA) fueron a los 33 municipios con salud mental en escasez y cero psiquiatras. Se reconstruyeron edificios, carreteras y agua. No llegó ni un médico de la mente. Jayuya recibió $424 millones y tiene cero psiquiatras.',
      fuente: 'OpenFEMA (Public Assistance) × NPPES/CMS × HRSA, julio 2026.',
      verUrl: '/registro/estado', verificaUrl: 'https://www.fema.gov/openfema-data-page/public-assistance-funded-projects-summaries-v1', verificaText: 'OpenFEMA', tag: 'Salud',
    },
    {
      titulo: 'La desigualdad de acceso más extrema',
      brecha: `${g.bajo5} de los 76 municipios (${n(g.bajo5Pob)} personas) viven con menos de 5 especialistas por cada 10,000 habitantes, mientras San Juan tiene cerca de 69. Loíza, a media hora de San Juan, tiene 86 veces menos especialistas por persona.`,
      fuente: 'NPPES/CMS × Censo 2020, municipio por municipio.',
      verUrl: '/registro/desiertos', verificaUrl: 'https://npiregistry.cms.hhs.gov/', verificaText: 'Registro federal NPPES', tag: 'Salud',
    },
  ]

  const recordCards = records.map((r, i) => {
    const slug = ['cupon', 'sin-especialista', 'ladrillo', 'desigualdad'][i] || `rec${i}`
    return `
    <div class="not-prose border border-slate-200 bg-white rounded-2xl p-5 mt-4">
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-bold text-teal-700 uppercase tracking-wide">${escapeHtml(r.tag)}</span>
      </div>
      <h3 class="text-xl font-black text-slate-900 mt-1" style="font-family:'Fraunces',Georgia,serif">${escapeHtml(r.titulo)}</h3>
      <blockquote class="mt-2 text-slate-800 leading-relaxed border-l-4 border-teal-500 pl-3">${escapeHtml(r.brecha)}</blockquote>
      <p class="text-xs text-slate-500 mt-3"><strong>Fuente:</strong> ${escapeHtml(r.fuente)}</p>
      <div class="mt-3 flex flex-wrap gap-2 text-sm">
        <a href="${escapeHtml(r.verUrl)}" data-prsf="record" data-rec="${slug}" class="inline-flex items-center gap-1 bg-slate-900 text-white font-bold px-4 py-2 rounded-full hover:bg-slate-700">Ver el récord completo</a>
        <a href="${escapeHtml(r.verificaUrl)}" target="_blank" rel="noopener" data-prsf="verify" data-rec="${slug}" class="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-full hover:border-teal-400">Verifícalo tú mismo: ${escapeHtml(r.verificaText)} ↗</a>
      </div>
    </div>`
  }).join('')

  const body = `
<h1>Puerto Rico, sin filtros.</h1>
<p class="text-lg text-slate-600 mt-3">El récord público que Puerto Rico nunca tuvo. Datos verificados que nadie había publicado, cada uno con su fuente al lado y la brecha entre lo que el papel dice y lo que tocó el suelo. Sin spin. Sin relleno. Verificado uno por uno.</p>

<div class="not-prose mt-6 bg-slate-900 text-white rounded-2xl p-5 sm:p-6">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">Qué es esto</p>
  <p class="text-xl sm:text-2xl font-black mt-1 leading-snug">El récord, no el ruido.</p>
  <p class="text-slate-300 mt-2 text-sm leading-relaxed">No es un blog. No es opinión. Es infraestructura: el dato verificado, la fuente primaria pública para que lo confirmes tú mismo, y la brecha que nadie había puesto en una sola tabla. La misma data que corre por debajo del Mapa de Cabo Rojo y del Registro Médico PR, aquí junta, para todo Puerto Rico. Si eres periodista, investigador, legislador o vecino, esto es tuyo.</p>
</div>

<h2 id="mision">La misión</h2>
<p class="text-lg text-slate-700">Un pueblo que no ve su realidad no la escoge: la aguanta. <strong>Puerto Rico Sin Filtros existe para que Puerto Rico se pueda ver claro</strong> — el récord, con la fuente al lado — porque solo lo que se ve se puede decidir. Ver claro es el primer paso para vivir el país que escogemos, no el que nos tocó.</p>

<div class="not-prose bg-white border border-slate-200 rounded-2xl p-5 mt-5">
  <p class="text-xs font-bold text-teal-700 uppercase tracking-wide mb-3">Índice de récords</p>
  <div class="flex flex-wrap gap-2 text-sm">
    <a href="/registro/estado" data-prsf="record" data-rec="idx-salud" class="inline-block bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">Salud</a>
    <a href="/recuperacion" data-prsf="record" data-rec="idx-recuperacion" class="inline-block bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">Recuperación</a>
    <a href="/quien-responde" data-prsf="record" data-rec="idx-promesas" class="inline-block bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">Promesas</a>
    <a href="/historial" data-prsf="record" data-rec="idx-historial" class="inline-block bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">Historial</a>
    <a href="/demanda" data-prsf="record" data-rec="idx-demanda" class="inline-block bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">Demanda</a>
    <a href="/agua" data-prsf="record" data-rec="idx-agua" class="inline-block bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">Agua</a>
    <a href="/acueductos" data-prsf="record" data-rec="idx-acueductos" class="inline-block bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">El recibo del agua</a>
    <a href="/transicion" data-prsf="record" data-rec="idx-transicion" class="inline-block bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">La Transición</a>
    <a href="/luz" data-prsf="record" data-rec="idx-luz" class="inline-block bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">Luz</a>
    <a href="/basura" data-prsf="record" data-rec="idx-basura" class="inline-block bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">Basura</a>
    <a href="/telemedicina" data-prsf="record" data-rec="idx-telemedicina" class="inline-block bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">Telemedicina</a>
    <a href="/diabetes" data-prsf="record" data-rec="idx-diabetes" class="inline-block bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">Diabetes</a>
    <a href="/sigue-el-dinero" data-prsf="record" data-rec="idx-sigue-dinero" class="inline-block bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">Sigue el dinero</a>
    <a href="/esencia" data-prsf="record" data-rec="idx-esencia" class="inline-block bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">Esencia</a>
    <a href="/activos" data-prsf="record" data-rec="idx-activos" class="inline-block bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">Activos dormidos</a>
    <a href="/no-se-mide" data-prsf="record" data-rec="idx-no-se-mide" class="inline-block bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">Lo que ni se mide</a>
  </div>
</div>

<a href="/prediccion" data-prsf="record" data-rec="prediccion" class="not-prose block bg-slate-900 text-white rounded-2xl p-5 mt-5 hover:bg-slate-800 transition-colors no-underline">
  <span class="text-xs uppercase tracking-widest text-teal-300 font-bold">La síntesis</span>
  <p class="text-lg sm:text-xl font-black mt-1 leading-snug">Predicción 2030: lo que dicen todos los récords juntos →</p>
  <p class="text-slate-300 mt-1 text-sm">Si Puerto Rico no hace nada, ¿a dónde llega? La lectura de todos los récords, con la fuente al lado.</p>
</a>

<h2 id="expedientes">Los Expedientes</h2>
<p class="text-slate-600 -mt-1">El récord completo de quien te gobierna: sus promesas y el estado de su gente, en una página, con la fuente al lado. Neutral y citable — para el vecino que decide y el periodista que investiga.</p>
<div class="not-prose grid sm:grid-cols-2 gap-3 mt-3">
  <a href="/expediente/alcalde-cabo-rojo" data-prsf="record" data-rec="expediente-alcalde" class="block border-2 border-teal-300 bg-teal-50 rounded-2xl p-5 hover:bg-teal-100 transition-colors no-underline">
    <span class="text-xs uppercase tracking-widest text-teal-700 font-bold">Alcalde</span>
    <p class="text-lg font-black mt-1 leading-snug text-slate-900" style="font-family:'Fraunces',Georgia,serif">Cabo Rojo →</p>
    <p class="text-slate-600 mt-1 text-sm">Jorge Morales Wiscovitch: promesas con video + estado del pueblo.</p>
  </a>
  <a href="/expediente/representante-distrito-20" data-prsf="record" data-rec="expediente-rep20" class="block border-2 border-teal-300 bg-teal-50 rounded-2xl p-5 hover:bg-teal-100 transition-colors no-underline">
    <span class="text-xs uppercase tracking-widest text-teal-700 font-bold">Representante · Distrito 20</span>
    <p class="text-lg font-black mt-1 leading-snug text-slate-900" style="font-family:'Fraunces',Georgia,serif">Cabo Rojo · San Germán · Hormigueros →</p>
    <p class="text-slate-600 mt-1 text-sm">Emilio Carlo Acosta: medidas + estado del distrito ($140M FEMA, Hormigueros sin psiquiatra).</p>
  </a>
</div>

<h2 id="records">Los récords</h2>
<p class="text-slate-600 -mt-1">Cada uno es un dato verificado contra un registro federal o público. La brecha habla sola.</p>
${recordCards}

<h2 id="mas-records">Más récords del substrato</h2>
<p class="text-slate-600 -mt-1">La misma disciplina, otras esquinas del pueblo. Cada uno vivo y verificado.</p>

<div class="not-prose border border-slate-200 bg-white rounded-2xl p-5 mt-4">
  <span class="text-xs font-bold text-teal-700 uppercase tracking-wide">Recuperación</span>
  <h3 class="text-xl font-black text-slate-900 mt-1" style="font-family:'Fraunces',Georgia,serif">Los fondos de recuperación, pueblo por pueblo</h3>
  <blockquote class="mt-2 text-slate-800 leading-relaxed border-l-4 border-teal-500 pl-3">Casi $8,755 millones de fondos federales de recuperación se obligaron a los 78 municipios de Puerto Rico. Aquí está quién recibió cuánto, municipio por municipio. La pregunta que sigue: ¿en qué se convirtió?</blockquote>
  <p class="text-xs text-slate-500 mt-3"><strong>Fuente:</strong> OpenFEMA (Public Assistance), obligaciones por municipio, julio 2026.</p>
  <div class="mt-3 flex flex-wrap gap-2 text-sm">
    <a href="/recuperacion" data-prsf="record" data-rec="recuperacion" class="inline-flex items-center gap-1 bg-slate-900 text-white font-bold px-4 py-2 rounded-full hover:bg-slate-700">Ver el récord completo</a>
    <a href="https://www.fema.gov/openfema-data-page/public-assistance-funded-projects-summaries-v1" target="_blank" rel="noopener" data-prsf="verify" data-rec="recuperacion" class="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-full hover:border-teal-400">Verifícalo tú mismo: OpenFEMA ↗</a>
  </div>
</div>

<div class="not-prose border border-slate-200 bg-white rounded-2xl p-5 mt-4">
  <span class="text-xs font-bold text-teal-700 uppercase tracking-wide">Promesas</span>
  <h3 class="text-xl font-black text-slate-900 mt-1" style="font-family:'Fraunces',Georgia,serif">Las promesas, con el recibo</h3>
  <blockquote class="mt-2 text-slate-800 leading-relaxed border-l-4 border-teal-500 pl-3">Las promesas públicas del alcalde de Cabo Rojo, rastreadas con la cita textual y el minuto exacto del video donde se hicieron. Cuando una vence sin cumplirse, se anota. Sin memoria selectiva.</blockquote>
  <p class="text-xs text-slate-500 mt-3"><strong>Fuente:</strong> grabaciones públicas del municipio, con timestamp verificado.</p>
  <div class="mt-3 flex flex-wrap gap-2 text-sm">
    <a href="/quien-responde" data-prsf="record" data-rec="promesas" class="inline-flex items-center gap-1 bg-slate-900 text-white font-bold px-4 py-2 rounded-full hover:bg-slate-700">Ver el récord completo</a>
  </div>
</div>

<div class="not-prose border border-teal-200 bg-teal-50/40 rounded-2xl p-5 mt-4">
  <span class="text-xs font-bold text-teal-700 uppercase tracking-wide">Demanda · en vivo</span>
  <h3 class="text-xl font-black text-slate-900 mt-1" style="font-family:'Fraunces',Georgia,serif">Lo que Puerto Rico está preguntando</h3>
  <blockquote class="mt-2 text-slate-800 leading-relaxed border-l-4 border-teal-500 pl-3">${n(dem.total90)} búsquedas reales al vecino digital *7711 en los últimos 90 días. ${n(dem.unmet90)} no encontraron respuesta directa en el directorio. Algunas son huecos reales sin proveedor; otras son negocios que sí existen pero todavía no aparecen bien. Separar una cosa de la otra es parte del trabajo, y por eso este récord importa: el log de lo que el pueblo busca es un dato que nadie más tiene, y se actualiza solo.</blockquote>
  <p class="text-xs text-slate-500 mt-3"><strong>Fuente:</strong> El Veci (*7711), señales de demanda reales, sin números de prueba. En vivo.</p>
  <div class="mt-3 flex flex-wrap gap-2 text-sm">
    <a href="/demanda" data-prsf="record" data-rec="demanda" class="inline-flex items-center gap-1 bg-slate-900 text-white font-bold px-4 py-2 rounded-full hover:bg-slate-700">Ver lo que busca PR</a>
  </div>
</div>

<div class="not-prose border border-slate-200 bg-white rounded-2xl p-5 mt-4">
  <span class="text-xs font-bold text-teal-700 uppercase tracking-wide">Agua</span>
  <h3 class="text-xl font-black text-slate-900 mt-1" style="font-family:'Fraunces',Georgia,serif">El agua de tu pueblo, contra el récord federal</h3>
  <blockquote class="mt-2 text-slate-800 leading-relaxed border-l-4 border-teal-500 pl-3">Los acueductos del oeste con violaciones de salud en el récord federal del agua potable (EPA), separando siempre lo que sigue activo y sin resolver de lo que ya se corrigió. Es un espejo, no una alarma: te dice qué vigilar, qué preguntar, y quién responde por el agua.</blockquote>
  <p class="text-xs text-slate-500 mt-3"><strong>Fuente:</strong> EPA SDWIS (récord federal del agua potable), Cabo Rojo y pueblos aledaños.</p>
  <div class="mt-3 flex flex-wrap gap-2 text-sm">
    <a href="/agua" data-prsf="record" data-rec="agua" class="inline-flex items-center gap-1 bg-slate-900 text-white font-bold px-4 py-2 rounded-full hover:bg-slate-700">Ver el récord completo</a>
    <a href="https://www.epa.gov/ground-water-and-drinking-water" target="_blank" rel="noopener" data-prsf="verify" data-rec="agua" class="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-full hover:border-teal-400">Verifícalo tú mismo: EPA ↗</a>
  </div>
</div>

<div class="not-prose border border-slate-200 bg-white rounded-2xl p-5 mt-4">
  <span class="text-xs font-bold text-teal-700 uppercase tracking-wide">Activos dormidos · Cabo Rojo</span>
  <h3 class="text-xl font-black text-slate-900 mt-1" style="font-family:'Fraunces',Georgia,serif">Lo que cuesta un edificio vacío</h3>
  <blockquote class="mt-2 text-slate-800 leading-relaxed border-l-4 border-teal-500 pl-3">Las propiedades públicas dormidas de Cabo Rojo, en un solo récord: el Coliseo con $5.2M de FEMA obligados y el plazo vencido, 29 cabañas rehabilitadas de 280+, el Faro con el acuerdo de manejo vencido desde 2016, y 3 escuelas vacías con 6 usos ya propuestos por el pueblo. El costo operacional oficial: sin publicar.</blockquote>
  <p class="text-xs text-slate-500 mt-3"><strong>Fuente:</strong> expediente del alcalde (video al minuto + OpenFEMA) + Radar de Cabo Rojo (estimados con metodología abierta).</p>
  <div class="mt-3 flex flex-wrap gap-2 text-sm">
    <a href="/activos" data-prsf="record" data-rec="activos" class="inline-flex items-center gap-1 bg-slate-900 text-white font-bold px-4 py-2 rounded-full hover:bg-slate-700">Ver el récord completo</a>
    <a href="https://www.radardepueblo.com" target="_blank" rel="noopener" data-prsf="verify" data-rec="activos" class="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-full hover:border-teal-400">El contador vivo: Radar ↗</a>
  </div>
</div>

<div class="not-prose border border-slate-200 bg-white rounded-2xl p-5 mt-4">
  <span class="text-xs font-bold text-teal-700 uppercase tracking-wide">El recibo del agua</span>
  <h3 class="text-xl font-black text-slate-900 mt-1" style="font-family:'Fraunces',Georgia,serif">Los aumentos hasta 2039 y el dinero federal sin llegar</h3>
  <blockquote class="mt-2 text-slate-800 leading-relaxed border-l-4 border-teal-500 pl-3">Los aumentos de la AAA están aprobados hasta el 2039 y suman $2,598 millones del bolsillo del cliente. Mientras, de $8,985.7M federales identificados para reconstruir el sistema, habían llegado $773M (8.6%). El reembolso de obra real de FEMA: 1.8%.</blockquote>
  <p class="text-xs text-slate-500 mt-3"><strong>Fuente:</strong> Plan Fiscal Certificado AAA 2025 (Junta de Supervisión Fiscal), corte 31 mar 2025.</p>
  <div class="mt-3 flex flex-wrap gap-2 text-sm">
    <a href="/acueductos" data-prsf="record" data-rec="acueductos" class="inline-flex items-center gap-1 bg-slate-900 text-white font-bold px-4 py-2 rounded-full hover:bg-slate-700">Ver el récord completo</a>
    <a href="https://oversightboard.pr.gov/fiscal-plans/" target="_blank" rel="noopener" data-prsf="verify" data-rec="acueductos" class="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-full hover:border-teal-400">Verifícalo tú mismo: el plan certificado ↗</a>
  </div>
</div>

<div class="not-prose border border-slate-200 bg-white rounded-2xl p-5 mt-4">
  <span class="text-xs font-bold text-teal-700 uppercase tracking-wide">La Transición</span>
  <h3 class="text-xl font-black text-slate-900 mt-1" style="font-family:'Fraunces',Georgia,serif">El gobierno, en su propia voz, al minuto</h3>
  <blockquote class="mt-2 text-slate-800 leading-relaxed border-l-4 border-teal-500 pl-3">En las vistas de transición 2024 el gobierno declaró su propio estado: Educación con 2.3% de desembolso FEMA, la AAA con 13.4%, la AEE con 15%, y el director de la AEE puntuando 3 de 10 su propia red. Más de 50 horas de video que nadie compiló. Cada cita con su minuto.</blockquote>
  <p class="text-xs text-slate-500 mt-3"><strong>Fuente:</strong> vistas públicas de transición (Ley 197-2002) transmitidas por El Nuevo Día, nov-dic 2024, verificadas al minuto.</p>
  <div class="mt-3 flex flex-wrap gap-2 text-sm">
    <a href="/transicion" data-prsf="record" data-rec="transicion" class="inline-flex items-center gap-1 bg-slate-900 text-white font-bold px-4 py-2 rounded-full hover:bg-slate-700">Ver el récord completo</a>
    <a href="https://www.youtube.com/@elnuevodia/streams" target="_blank" rel="noopener" data-prsf="verify" data-rec="transicion" class="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-full hover:border-teal-400">Verifícalo tú mismo: los videos ↗</a>
  </div>
</div>

<div class="not-prose border border-slate-200 bg-white rounded-2xl p-5 mt-4">
  <span class="text-xs font-bold text-teal-700 uppercase tracking-wide">Luz</span>
  <h3 class="text-xl font-black text-slate-900 mt-1" style="font-family:'Fraunces',Georgia,serif">La luz, contra el récord federal</h3>
  <blockquote class="mt-2 text-slate-800 leading-relaxed border-l-4 border-teal-500 pl-3">Puerto Rico paga la luz a ~24.5¢ por kWh (2023): casi el doble del promedio de Estados Unidos (~12.9¢). En residencial, ~45.6% más caro que la nación. El récord federal de energía, en cristiano.</blockquote>
  <p class="text-xs text-slate-500 mt-3"><strong>Fuente:</strong> EIA (US Energy Information Administration), perfil de electricidad de PR, 2023-2025.</p>
  <div class="mt-3 flex flex-wrap gap-2 text-sm">
    <a href="/luz" data-prsf="record" data-rec="luz" class="inline-flex items-center gap-1 bg-slate-900 text-white font-bold px-4 py-2 rounded-full hover:bg-slate-700">Ver el récord completo</a>
    <a href="https://www.eia.gov/electricity/state/puertorico/" target="_blank" rel="noopener" data-prsf="verify" data-rec="luz" class="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-full hover:border-teal-400">Verifícalo tú mismo: EIA ↗</a>
  </div>
</div>

<div class="not-prose border border-slate-200 bg-white rounded-2xl p-5 mt-4">
  <span class="text-xs font-bold text-teal-700 uppercase tracking-wide">Basura</span>
  <h3 class="text-xl font-black text-slate-900 mt-1" style="font-family:'Fraunces',Georgia,serif">Dónde termina lo que botamos</h3>
  <blockquote class="mt-2 text-slate-800 leading-relaxed border-l-4 border-teal-500 pl-3">~29 vertederos operando en Puerto Rico, la mayoría ya sobre su capacidad. La EPA tiene acuerdos legales para cerrar 12, con órdenes de consentimiento en 12 municipios. Desde 2002 interviene directamente.</blockquote>
  <p class="text-xs text-slate-500 mt-3"><strong>Fuente:</strong> EPA — récord federal de vertederos de Puerto Rico y órdenes de consentimiento.</p>
  <div class="mt-3 flex flex-wrap gap-2 text-sm">
    <a href="/basura" data-prsf="record" data-rec="basura" class="inline-flex items-center gap-1 bg-slate-900 text-white font-bold px-4 py-2 rounded-full hover:bg-slate-700">Ver el récord completo</a>
    <a href="https://www.epa.gov/pr/puerto-rico-landfill-consent-orders-and-consent-decrees" target="_blank" rel="noopener" data-prsf="verify" data-rec="basura" class="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-full hover:border-teal-400">Verifícalo tú mismo: EPA ↗</a>
  </div>
</div>

<div class="not-prose border border-slate-200 bg-white rounded-2xl p-5 mt-4">
  <span class="text-xs font-bold text-teal-700 uppercase tracking-wide">Cruce · Telemedicina</span>
  <h3 class="text-xl font-black text-slate-900 mt-1" style="font-family:'Fraunces',Georgia,serif">¿La solución ya está donde no hay médico?</h3>
  <blockquote class="mt-2 text-slate-800 leading-relaxed border-l-4 border-teal-500 pl-3">De los 36 municipios sin un solo psiquiatra, en 17 la banda ancha ya cubre el 80%+ de los hogares: la teleconsulta es viable hoy, falta el servicio no el cable. Solo 3 son desierto doble (Las Marías, Maricao, Guánica): ni médico ni internet.</blockquote>
  <p class="text-xs text-slate-500 mt-3"><strong>Fuente:</strong> Censo ACS (B28002, acceso a internet) × registro federal NPPES (psiquiatras).</p>
  <div class="mt-3 flex flex-wrap gap-2 text-sm">
    <a href="/telemedicina" data-prsf="record" data-rec="telemedicina" class="inline-flex items-center gap-1 bg-slate-900 text-white font-bold px-4 py-2 rounded-full hover:bg-slate-700">Ver el cruce completo</a>
    <a href="https://data.census.gov/table/ACSDT5Y2023.B28002" target="_blank" rel="noopener" data-prsf="verify" data-rec="telemedicina" class="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-full hover:border-teal-400">Verifícalo: Censo ↗</a>
  </div>
</div>

<div class="not-prose border border-slate-200 bg-white rounded-2xl p-5 mt-4">
  <span class="text-xs font-bold text-teal-700 uppercase tracking-wide">Cruce · Salud</span>
  <h3 class="text-xl font-black text-slate-900 mt-1" style="font-family:'Fraunces',Georgia,serif">La diabetes contra el desierto médico</h3>
  <blockquote class="mt-2 text-slate-800 leading-relaxed border-l-4 border-teal-500 pl-3">Lajas es el pueblo con más diabetes de Puerto Rico (18%) y no tiene un solo psiquiatra. Florida, con 15.7%, no tiene ni un especialista de ninguna clase. La enfermedad crónica más común, en los pueblos con menos con quién atenderla.</blockquote>
  <p class="text-xs text-slate-500 mt-3"><strong>Fuente:</strong> estudio CDC 2009 (única data de diabetes por municipio de PR) × NPPES. <em>Ojo: 15 años de antigüedad.</em></p>
  <div class="mt-3 flex flex-wrap gap-2 text-sm">
    <a href="/diabetes" data-prsf="record" data-rec="diabetes" class="inline-flex items-center gap-1 bg-slate-900 text-white font-bold px-4 py-2 rounded-full hover:bg-slate-700">Ver el cruce completo</a>
    <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC4537060/" target="_blank" rel="noopener" data-prsf="verify" data-rec="diabetes" class="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-full hover:border-teal-400">Verifícalo: CDC ↗</a>
  </div>
</div>

<div class="not-prose border border-slate-200 bg-white rounded-2xl p-5 mt-4">
  <span class="text-xs font-bold text-teal-700 uppercase tracking-wide">Sigue el dinero</span>
  <h3 class="text-xl font-black text-slate-900 mt-1" style="font-family:'Fraunces',Georgia,serif">¿Quién se llevó la recuperación?</h3>
  <blockquote class="mt-2 text-slate-800 leading-relaxed border-l-4 border-teal-500 pl-3">De cada dólar de contrato de recuperación que rastreamos, ~87 centavos salieron de Puerto Rico hacia el mainland. CH2M/CDM (Denver) sola se llevó $238M solo en asesorar cómo gastar el dinero de FEMA.</blockquote>
  <p class="text-xs text-slate-500 mt-3"><strong>Fuente:</strong> USASpending.gov (DHS/FEMA) × lugar de ejecución PR.</p>
  <div class="mt-3 flex flex-wrap gap-2 text-sm">
    <a href="/sigue-el-dinero" data-prsf="record" data-rec="sigue-dinero" class="inline-flex items-center gap-1 bg-slate-900 text-white font-bold px-4 py-2 rounded-full hover:bg-slate-700">Ver quién cobró →</a>
    <a href="https://www.usaspending.gov/" target="_blank" rel="noopener" data-prsf="verify" data-rec="sigue-dinero" class="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-full hover:border-teal-400">Verifícalo: USASpending ↗</a>
  </div>
</div>

<p class="not-prose text-sm text-slate-500 mt-5">¿Y lo que todavía no se puede medir? Eso también es un récord: <a href="/no-se-mide" class="text-teal-700 font-semibold">Lo que ni se mide →</a> — los huecos donde Puerto Rico es invisible en su propia data. No se publica nada sin data detrás.</p>

<h2 id="como">Cómo se verifica</h2>
<p>Cada número sale de una fuente federal o pública, cruzada a nivel de municipio, y revisada uno por uno. Sin robots que copian data de Google. Sin AI inventando cifras. Sin "aproximaciones". Cada dato lleva su fecha; si tiene más de lo que debe, se vuelve a correr. <strong>¿Ves un error? Escríbenos y se corrige, en público.</strong> Ese es el trato.</p>

<h2>Para prensa, investigadores y quien construye</h2>
<p>Todo aquí es citable y libre. Cópialo, cítalo, constrúyele encima.</p>
<ul>
  <li><a href="/comparte" data-prsf="cite" data-rec="comparte">Datos citables</a>: cada cifra con su fuente, botón de copiar, formato para citar.</li>
  <li><a href="/civico.json" data-prsf="cite" data-rec="civico-json">API pública (civico.json)</a>: la data cívica en formato máquina-legible.</li>
  <li><a href="/llms.txt" data-prsf="cite" data-rec="llms-txt">Para IA (llms.txt)</a>: para que los modelos de lenguaje citen la fuente, no inventen.</li>
</ul>
<p class="text-sm text-slate-600">¿Necesitas el corte de un municipio, la metodología completa, o una licencia de datos para tu redacción o institución? Angel Anderson, desde Cabo Rojo. Escribe a <a href="mailto:angel@angelanderson.com" class="text-teal-700 font-semibold">angel@angelanderson.com</a>. Prefiero texto o correo.</p>

<h2 id="sugiere">Sugiere un récord</h2>
<p>El récord no está completo, y nunca lo estará por sí solo. ¿Qué dato de Puerto Rico crees que merece verse sin filtro — un número que nadie ha publicado, una promesa sin cumplir, un gasto sin explicar, un servicio que falla? Dínoslo y lo verificamos. Así el récord crece con el pueblo, no con un blog.</p>
<p class="text-sm text-slate-600">Escríbele a Angel: <a href="mailto:angel@angelanderson.com?subject=Sugiero%20un%20r%C3%A9cord%20para%20Puerto%20Rico%20Sin%20Filtros" class="text-teal-700 font-semibold">angel@angelanderson.com</a>, o textéale al vecino digital: <strong>787-417-7711</strong>. Si traes la fuente, mejor. Si no, la buscamos.</p>

<div class="not-prose bg-teal-50 border border-teal-200 rounded-2xl p-6 mt-8 text-center">
  <p class="text-lg font-black text-slate-900" style="font-family:'Fraunces',Georgia,serif">Puerto Rico no necesita más ruido. Necesita mejor récord.</p>
  <p class="mt-2 text-sm text-slate-600 italic">Para escoger nuestro futuro, primero hay que verlo. Si te sirve, úsalo. Si no, sigue tu camino.</p>
</div>

<p class="text-sm text-slate-500 mt-6">Metodología: cruce de fuentes federales y públicas a nivel de municipio — NPPES/CMS (proveedores), archivos HRSA (designaciones de escasez), OpenFEMA (fondos de recuperación), Censo/ACS (población y pobreza). Verificado uno por uno. Última actualización: julio 2026.</p>

<!-- logging PRSF movido al layout (isPRSF): page_view + record/verify/cite + audio_play + outbound_click -->
`
  const datasetLd = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: 'Puerto Rico Sin Filtros — récord público de datos verificados de PR',
    description: `Datos verificados de Puerto Rico con fuente primaria: ${g.conHpsa} de 76 municipios con escasez de médicos declarada por el gobierno federal, ${g.cupon} con el cupón de salud mental sin cobrar (${n(g.cuponPob)} personas), ${g.cero} municipios sin ningún especialista. Fuentes: NPPES/CMS, HRSA, OpenFEMA, Censo.`,
    creator: { '@type': 'Person', name: 'Angel Anderson', url: 'https://angelanderson.com' },
    publisher: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' },
    isAccessibleForFree: true, inLanguage: 'es', url: 'https://puertoricosinfiltros.com/',
    keywords: ['Puerto Rico', 'datos verificados', 'acceso médico', 'HPSA', 'NPPES', 'transparencia', 'récord público'],
  }
  const siteLd = {
    '@context': 'https://schema.org', '@type': 'WebSite',
    name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com',
    description: 'El récord público de Puerto Rico: datos verificados uno por uno contra registros federales y públicos, cada uno con su fuente al lado.',
    inLanguage: 'es', publisher: { '@type': 'Person', name: 'Angel Anderson' },
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: 'Puerto Rico Sin Filtros — el récord público de PR, con la fuente al lado',
    description: 'Datos verificados de Puerto Rico que nadie había publicado, cada uno con su fuente primaria. 65 de 76 municipios con escasez de médicos declarada por el gobierno federal, 33 con el dinero sin cobrar. Sin spin.',
    slug: '', bodyHtml: body, jsonLd: [siteLd, datasetLd] as any, ogImage: OG_SINFILTROS,
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
    canonicalUrl: 'https://puertoricosinfiltros.com/',
  }))
}

// Analytics de PuertoRicoSinFiltros.com — el log ES un récord (qué mira PR).
// Mismo patrón fail-safe que acceso-log: allowlist + insert service-role, nunca rompe la página.
const SINFILTROS_EVENTS = new Set(['page_view', 'record_click', 'verify_click', 'cite_click', 'audio_play', 'outbound_click'])
async function handleSinFiltrosLog(req: any, res: any) {
  try {
    let body: any = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
    body = body || {}
    const event = String(body.event || '').slice(0, 40)
    if (SINFILTROS_EVENTS.has(event)) {
      await supabase.from('prsf_events').insert({
        event,
        record: body.record ? String(body.record).slice(0, 60) : null,
        target: body.target ? String(body.target).slice(0, 200) : null,
        referrer: body.referrer ? String(body.referrer).slice(0, 200) : null,
        ua: String(req.headers['user-agent'] || '').slice(0, 300),
      })
    }
  } catch { /* analytics must never break the page */ }
  res.status(204).end()
}

// Pulso de PuertoRicoSinFiltros.com — qué mira la gente (lee prsf_events). Público, solo agregados.
async function handleSinFiltrosPulso(req: any, res: any) {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  let rows: any[] = []
  try {
    const { data } = await supabase.from('prsf_events').select('event,record,target,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(5000)
    rows = data || []
  } catch (_) { /* empty state */ }
  const count = (ev: string) => rows.filter(r => r.event === ev).length
  const totals = { views: count('page_view'), record: count('record_click'), verify: count('verify_click'), cite: count('cite_click') }
  const tally = (ev: string, key: string) => {
    const m: Record<string, number> = {}
    rows.filter(r => r.event === ev).forEach(r => { const k = r[key] || '(sin etiqueta)'; m[k] = (m[k] || 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10)
  }
  const topRec = tally('record_click', 'record')
  const topVerify = tally('verify_click', 'record')
  const topCite = tally('cite_click', 'record')
  const tile = (num: number, label: string) => `<div class="bg-white border-2 border-slate-200 rounded-xl p-4 text-center"><div class="text-3xl font-black text-slate-900">${num.toLocaleString('en-US')}</div><div class="text-xs text-slate-600 mt-1">${label}</div></div>`
  const list = (title: string, pairs: [string, number][]) => pairs.length
    ? `<h3>${title}</h3><div class="not-prose overflow-auto border border-slate-200 rounded-xl mt-2 mb-4"><table class="w-full text-sm"><tbody>${pairs.map(([k, v]) => `<tr class="border-t border-slate-100"><td class="py-1.5 px-3 font-semibold text-slate-800">${escapeHtml(k)}</td><td class="py-1.5 px-3 text-right text-slate-600">${v}</td></tr>`).join('')}</tbody></table></div>`
    : `<h3>${title}</h3><p class="text-sm text-slate-400 italic">Sin clicks todavía.</p>`
  const empty = rows.length === 0
  const body = `
<h1>Pulso</h1>
<p class="text-lg text-slate-600 mt-2">Lo que la gente hace en Puerto Rico Sin Filtros, últimos 30 días. El log también es un récord: nos dice qué le importa al pueblo.</p>
${empty ? '<div class="not-prose bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4 text-sm text-slate-700">Todavía sin tráfico registrado. Esta página se llena sola a medida que la gente usa el sitio.</div>' : ''}
<div class="not-prose grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
  ${tile(totals.views, 'vistas de página')}
  ${tile(totals.record, 'clicks a un récord')}
  ${tile(totals.verify, 'clicks "verifícalo tú mismo"')}
  ${tile(totals.cite, 'clicks a la capa citable')}
</div>
${list('Récords más mirados', topRec)}
${list('Fuentes que la gente fue a verificar', topVerify)}
${list('Capa citable (API / IA / datos)', topCite)}
<p class="text-sm text-slate-500 mt-6">Instrumentado con la tabla <code>prsf_events</code>. Solo agregados, sin datos personales. Complementa Vercel Analytics + GA.</p>
`
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
  res.status(200).send(layout({
    title: 'Pulso — qué mira Puerto Rico Sin Filtros',
    description: 'Lo que la gente hace en Puerto Rico Sin Filtros: récords más mirados, fuentes verificadas, capa citable. Últimos 30 días.',
    slug: 'sinfiltros/pulso', bodyHtml: body, host: req.headers?.host, ogImage: OG_SINFILTROS,
    canonicalHost: 'https://puertoricosinfiltros.com',
  }))
}

// Récords de dato federal PR: /luz (pr_electricidad, EIA) y /basura (pr_residuos_solidos, EPA).
// Handler genérico: la fila trae metrica/valor/source/verificalo. Data verificada 2026-07-05.
async function handleDatoRecord(req: any, res: any) {
  const page = String(req.query?.page || 'luz')
  const isBasura = page === 'basura'
  const cfg = isBasura
    ? { table: 'pr_residuos_solidos', tag: 'Basura', h1: 'La basura de Puerto Rico, contra el récord federal',
        hero: '~29 vertederos operando, la mayoría ya sobre su capacidad. La EPA tiene acuerdos legales para cerrar 12, y desde 2002 interviene directamente en la isla.',
        intro: 'Lo que el récord federal de la EPA dice sobre dónde termina lo que botamos. Cada dato con su documento oficial al lado.',
        gap: 'Falta ingestar: los años de capacidad restante por vertedero (data de la Autoridad de Desperdicios Sólidos) no está en formato primario descargable, así que aquí va solo lo verificable en el récord federal de la EPA.',
        verify: 'https://www.epa.gov/pr/puerto-rico-landfill-consent-orders-and-consent-decrees', verifyText: 'los documentos de la EPA' }
    : { table: 'pr_electricidad', tag: 'Luz', h1: 'La luz de Puerto Rico, contra el récord federal',
        hero: 'Puerto Rico paga ~24.5¢ por kWh (todos los sectores, 2023), casi el doble del promedio de Estados Unidos (~12.9¢). En residencial, ~45.6% más caro que la nación.',
        intro: 'Lo que el récord federal de energía (EIA) dice sobre el precio y el sistema eléctrico de Puerto Rico. Cada cifra con su fuente al lado.',
        gap: 'Falta ingestar: las métricas de confiabilidad (SAIDI/SAIFI — cuántas horas al año se va la luz) del EIA-861, que requieren una llave de acceso del EIA. Aquí está el precio; la frecuencia de apagones viene después.',
        verify: 'https://www.eia.gov/electricity/state/puertorico/', verifyText: 'el perfil de PR en la EIA' }
  let rows: any[] = []
  try { const { data } = await supabase.from(cfg.table).select('*').order('id'); rows = data || [] } catch (_) { /* empty */ }
  const rowHtml = rows.map((r: any) => {
    const val = isBasura
      ? `<strong class="text-slate-900">${escapeHtml(String(r.valor))}</strong>`
      : `<strong class="text-slate-900">${Number(r.valor).toLocaleString('en-US')}</strong> <span class="text-slate-500 text-xs">${escapeHtml(r.unidad || '')}</span>${r.valor_us ? `<div class="text-xs text-slate-400 mt-0.5">EEUU: ${Number(r.valor_us).toLocaleString('en-US')}</div>` : ''}`
    const detail = isBasura && r.detalle ? `<div class="text-xs text-slate-500 mt-0.5">${escapeHtml(r.detalle)}</div>` : ''
    return `<tr class="border-t border-slate-100">
      <td class="py-2 px-3"><div class="font-semibold text-slate-800">${escapeHtml(r.metrica)}</div>${detail}<div class="text-xs text-slate-400 mt-0.5">${escapeHtml(r.periodo || '')} · <a href="${escapeHtml(r.verificalo)}" target="_blank" rel="noopener" class="text-teal-700 underline">verifícalo ↗</a></div></td>
      <td class="py-2 px-3 text-right align-top whitespace-nowrap">${val}</td>
    </tr>`
  }).join('')
  const body = `
<h1>${cfg.h1}</h1>
<p class="text-lg text-slate-600 mt-2">${cfg.intro}</p>
<div class="not-prose mt-5 bg-slate-900 text-white rounded-2xl p-5">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">El dato</p>
  <p class="text-lg sm:text-xl font-black mt-1 leading-snug">${cfg.hero}</p>
</div>
<div class="not-prose mt-5 overflow-auto border border-slate-200 rounded-xl">
  <table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th class="py-2 px-3">Métrica</th><th class="py-2 px-3 text-right">Valor</th></tr></thead><tbody>${rowHtml || '<tr><td class="py-3 px-3 text-slate-400 italic" colspan="2">Data no disponible ahora.</td></tr>'}</tbody></table>
</div>
<div class="not-prose bg-amber-50 border border-amber-200 rounded-xl p-4 mt-5 text-sm text-slate-700"><strong>Lo que todavía no sabemos:</strong> ${cfg.gap}</div>
<p class="text-sm text-slate-500 mt-5">Verifícalo tú mismo en <a href="${cfg.verify}" target="_blank" rel="noopener" class="text-teal-700 font-semibold">${cfg.verifyText} ↗</a>. Cada fila trae su enlace a la fuente primaria. ¿Ves un error? Escríbenos y se corrige.</p>
`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: cfg.h1, description: cfg.hero,
    creator: { '@type': 'Person', name: 'Angel Anderson' },
    publisher: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' },
    isAccessibleForFree: true, inLanguage: 'es', url: `https://puertoricosinfiltros.com/${page}`,
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: `${cfg.h1}`, description: cfg.hero, slug: page, bodyHtml: body, jsonLd, ogImage: OG_SINFILTROS,
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
  }))
}

// /acueductos — el recibo del agua contra el récord: aumentos de tarifa hasta 2039 + fondos federales
// identificados vs recibidos. Fuente primaria: Plan Fiscal Certificado AAA 2025 (JSF, 27 jun 2025).
// Data verificada página por página contra el PDF certificado el 2026-07-10. Corte del documento: 31 mar 2025.
async function handleAcueductos(req: any, res: any) {
  // Tabla 3-6 del plan (p.74): recaudo del ajuste de tarifa por año fiscal, en $M. FY = jul-jun.
  const aumentos: [string, number][] = [
    ['FY2026', 20.9], ['FY2027', 44.4], ['FY2028', 68.4], ['FY2029', 92.9], ['FY2030', 117.9],
    ['FY2031', 143.3], ['FY2032', 169.1], ['FY2033', 195.3], ['FY2034', 222.0], ['FY2035', 249.1],
    ['FY2036', 276.5], ['FY2037', 304.4], ['FY2038', 332.6], ['FY2039', 361.2],
  ]
  const maxA = 361.2
  const barRows = aumentos.map(([fy, v]) => `
    <div class="flex items-center gap-2 text-xs">
      <span class="w-16 shrink-0 font-semibold text-slate-600">${fy}</span>
      <div class="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden"><div class="bg-teal-600 h-4 rounded-full" style="width:${Math.max(3, Math.round(v / maxA * 100))}%"></div></div>
      <span class="w-16 shrink-0 text-right font-bold text-slate-800">$${v.toFixed(1)}M</span>
    </div>`).join('')

  // Tabla 4-6 del plan (p.84): identificado / obligado / recibido, en $M, al 31 mar 2025.
  const fondos: [string, string, string, string][] = [
    ['Obra permanente · FEMA (PA)', '3,662.7', '3,662.7', '67.1'],
    ['Adelanto de capital de trabajo · FEMA', '·', '·', '452.1'],
    ['Mitigación por desastre · FEMA (406)', '2,738.9', '1,071.0', '0'],
    ['Mitigación HMGP · FEMA (404)', '421.6', '22.6', '10.3'],
    ['CDBG-MIT · HUD', '349.5', '122.6', '0'],
    ['CDBG-DR (pareo local) · HUD', '406.9', '400.0', '13.7'],
    ['Costos administrativos (DAC) · FEMA', '213.6', '213.6', '0'],
    ['SRF-SAHFI (Fiona) · EPA', '555.0', '545.0', '0'],
    ['Desarrollo Rural · USDA (3 programas)', '46.7', '46.7', '46.7'],
    ['CWSRF (regular + BIL) · EPA', '322.3', '282.0', '121.7'],
    ['DWSRF (regular + BIL) · EPA', '268.5', '193.7', '61.4'],
  ]
  const fondosRows = fondos.map(([p, i, o, r]) => `
    <tr class="border-t border-slate-100">
      <td class="py-2 px-3 font-semibold text-slate-800">${p}</td>
      <td class="py-2 px-3 text-right text-slate-600 whitespace-nowrap">${i}</td>
      <td class="py-2 px-3 text-right text-slate-600 whitespace-nowrap">${o}</td>
      <td class="py-2 px-3 text-right font-bold text-slate-900 whitespace-nowrap">${r}</td>
    </tr>`).join('')

  const FP_URL = 'https://oversightboard.pr.gov/fiscal-plans/'
  const citables = [
    `De $8,985.7 millones federales identificados para reconstruir el sistema de agua de PR, la AAA había recibido $773.0 millones (8.6%) al 31 de marzo de 2025. Y de ese dinero recibido, $452.1M fue un adelanto de capital de trabajo, no reembolso de obra: el reembolso de obra permanente de FEMA era $67.1M de $3,662.7M obligados (1.8%). Fuente: Plan Fiscal Certificado AAA 2025 (JSF), Tabla 4-6. puertoricosinfiltros.com/acueductos`,
    `El ajuste de tarifa de la AAA recauda $20.9M en el año fiscal 2026 y sube cada año hasta $361.2M anuales en 2039. El total del período 2025-2039 es $2,598.1 millones. La regla: mínimo 2% y máximo 5% al año, con tope acumulado de 30% desde 2024. Fuente: Plan Fiscal Certificado AAA 2025 (JSF), Tabla 3-6. puertoricosinfiltros.com/acueductos`,
    `Cada factura de agua también paga deuda: la AAA debía $3,840 millones al 31 de marzo de 2025 y su servicio de deuda 2025-2039 suma $3,788.5 millones, más que todos los aumentos de tarifa del mismo período juntos ($2,598.1M). Fuente: Plan Fiscal Certificado AAA 2025 (JSF), Tablas 2-9, 2-10 y 3-6. puertoricosinfiltros.com/acueductos`,
  ]
  const citableCards = citables.map((c) => `
    <div class="flex items-start gap-2 bg-white border border-slate-200 rounded-xl p-3 mt-2">
      <p class="flex-1 text-sm text-slate-700 leading-relaxed">${escapeHtml(c)}</p>
      <button type="button" class="share-copy shrink-0 inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-lg text-xs" data-copy="${escapeHtml(c)}"><i class="fa-regular fa-copy"></i> Copiar</button>
    </div>`).join('')

  const body = `
<h1>El recibo del agua, contra el récord</h1>
<p class="text-lg text-slate-600 mt-2">Los aumentos en la factura de la AAA están aprobados hasta el 2039. Mientras tanto, el 91% del dinero federal identificado para reconstruir el sistema no ha llegado a la caja. Aquí están los dos lados, con el documento certificado al lado.</p>

<div class="not-prose mt-5 bg-slate-900 text-white rounded-2xl p-5 sm:p-6">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">El dato</p>
  <p class="text-xl sm:text-2xl font-black mt-1 leading-snug">$8,985.7 millones federales identificados. $773.0 millones recibidos: 8.6%.</p>
  <p class="text-slate-300 mt-2 text-sm leading-relaxed">Y del lado del bolsillo: el ajuste de tarifa recauda $20.9M este año fiscal y sube cada año hasta $361.2M anuales en 2039. El total del período es $2,598.1 millones, un número que no se dijo en TV.</p>
  <p class="text-xs text-slate-400 mt-3">Plan Fiscal Certificado de la AAA (Junta de Supervisión Fiscal, 27 jun 2025) · corte de fondos federales: 31 mar 2025.</p>
</div>

<div class="not-prose bg-white border border-slate-200 rounded-xl p-4 mt-5 text-sm text-slate-700">
  <strong>De dónde sale esto:</strong> estos números viajaron por TV en julio 2026 (el analista Jorge Colberg, Jugando Pelota Dura). Este récord los verificó uno por uno contra la fuente primaria: el Plan Fiscal Certificado de la AAA. Todo lo que dijo el clip aparece en el documento. Y el documento dice más.
</div>

<h2 id="aumentos">Los aumentos, año por año</h2>
<p>La estructura de tarifa vigente (desde el 1 de julio de 2022) trae ajuste automático: <strong>mínimo 2% al año, máximo 5%</strong>, según la necesidad fiscal, con un <strong>tope acumulado de 30% contando desde 2024</strong>. El más reciente entró el 1 de julio de 2026: 2%. Esto es lo que el ajuste recauda por año fiscal (jul-jun), según el plan certificado:</p>
<div class="not-prose bg-white border border-slate-200 rounded-xl p-4 mt-3 space-y-1.5">${barRows}
  <p class="text-xs text-slate-500 pt-2">En $ millones por año fiscal. Es acumulativo: cada barra incluye los ajustes de los años anteriores. Total del período FY2025-FY2039: <strong>$2,598.1 millones</strong>. Fuente: Tabla 3-6 y Exhibit del capítulo 3 del plan certificado.</p>
</div>

<h2 id="federal">El dinero federal: identificado, obligado, recibido</h2>
<p>Las tres palabras importan. <strong>Identificado</strong> es dinero que existe para la AAA. <strong>Obligado</strong> es dinero ya comprometido por la agencia federal. <strong>Recibido</strong> es lo que llegó a la caja. Al 31 de marzo de 2025:</p>
<div class="not-prose mt-3 overflow-auto border border-slate-200 rounded-xl">
  <table class="w-full text-sm">
    <thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th class="py-2 px-3">Programa</th><th class="py-2 px-3 text-right">Identificado ($M)</th><th class="py-2 px-3 text-right">Obligado ($M)</th><th class="py-2 px-3 text-right">Recibido ($M)</th></tr></thead>
    <tbody>${fondosRows}
      <tr class="border-t-2 border-slate-300 bg-slate-50"><td class="py-2 px-3 font-black text-slate-900">TOTAL</td><td class="py-2 px-3 text-right font-black text-slate-900">8,985.7</td><td class="py-2 px-3 text-right font-black text-slate-900">6,560.0</td><td class="py-2 px-3 text-right font-black text-slate-900">773.0</td></tr>
    </tbody>
  </table>
</div>
<p class="text-sm text-slate-500 mt-2">Fuente: Tabla 4-6 del Plan Fiscal Certificado AAA 2025. El adelanto de capital de trabajo ($452.1M) fue dinero adelantado para operar, no reembolso de obra construida.</p>

<h2 id="no-dijo">Lo que el clip no dijo (y el documento sí)</h2>
<div class="not-prose space-y-3 mt-3">
  <div class="bg-white border border-slate-200 rounded-xl p-4"><p class="text-sm text-slate-800 leading-relaxed"><strong class="text-slate-900">1 · El reembolso de obra real es todavía más bajo.</strong> El "$773M recibido" incluye $452.1M que fue un adelanto de capital de trabajo. El reembolso de obra permanente de FEMA era <strong>$67.1M de $3,662.7M obligados: 1.8%</strong>, cinco años después del anuncio del FAASt ($4.1 mil millones, enero 2021).</p></div>
  <div class="bg-white border border-slate-200 rounded-xl p-4"><p class="text-sm text-slate-800 leading-relaxed"><strong class="text-slate-900">2 · El total de los aumentos es $2.6 mil millones, no $361M.</strong> Los $361.2M son lo que el ajuste recauda por año en 2039. Sumando el período completo 2025-2039, la tarifa recauda <strong>$2,598.1 millones</strong> del bolsillo del cliente.</p></div>
  <div class="bg-white border border-slate-200 rounded-xl p-4"><p class="text-sm text-slate-800 leading-relaxed"><strong class="text-slate-900">3 · Hay un tope que protege al cliente.</strong> El aumento no es infinito: la regla certificada es mínimo 2%, máximo 5% al año, con <strong>tope acumulado de 30%</strong> desde 2024. Con el mínimo de 2% al año, ese tope prácticamente se consume completo para 2039. Ejemplo aritmético: una factura de $60 al mes llega a unos $78 con el tope aplicado.</p></div>
  <div class="bg-white border border-slate-200 rounded-xl p-4"><p class="text-sm text-slate-800 leading-relaxed"><strong class="text-slate-900">4 · "No recibido" no es "perdido", pero el propio plan nombra el riesgo.</strong> El 73% del dinero ya está obligado (comprometido). El cuello es ejecutar la obra y cobrar el reembolso: la AAA paga primero y FEMA reembolsa después. El plan certificado lista como riesgo oficial los <em>"federal fund clawbacks"</em> (que el dinero federal se recorte o se devuelva) y la escasez de contratistas para ejecutar a tiempo.</p></div>
  <div class="bg-white border border-slate-200 rounded-xl p-4"><p class="text-sm text-slate-800 leading-relaxed"><strong class="text-slate-900">5 · Cada factura también paga deuda.</strong> La AAA debía <strong>$3,840 millones</strong> al 31 de marzo de 2025. El servicio de esa deuda en el período 2025-2039 suma <strong>$3,788.5 millones</strong>: más que todos los aumentos de tarifa del mismo período juntos.</p></div>
</div>

<h2 id="preguntas">Las preguntas que solo la AAA y COR3 pueden contestar</h2>
<ul class="text-slate-700">
  <li>¿Cuánto ha subido el "recibido" desde el corte del 31 de marzo de 2025? ¿Cuál es el número hoy?</li>
  <li>¿Cuántos proyectos del FAASt están en construcción activa ahora mismo, y cuántos siguen en formulación?</li>
  <li>De los $555M de SRF-SAHFI (Fiona) con $0 recibido, ¿ya se firmó el acuerdo de asistencia financiera?</li>
  <li>Si hay un recorte federal (clawback), ¿el plan contempla otro aumento de tarifa para cubrir el hueco?</li>
</ul>
<p class="text-sm text-slate-600">Si la AAA o COR3 contestan con el récord, la respuesta se publica aquí textual. Este récord premia el verde igual que anota el rojo: obligar el 73% del dinero es un logro real del proceso, y así se dice.</p>

<h2 id="citables">Citables (copia y pega, con fuente)</h2>
${citableCards}

<h2 id="verifica">Verifícalo tú mismo</h2>
<ul class="text-slate-700">
  <li><a href="${FP_URL}" target="_blank" rel="noopener" data-prsf="verify" data-rec="acueductos" class="text-teal-700 font-semibold">Plan Fiscal Certificado AAA 2025 (PDF, Junta de Supervisión Fiscal) ↗</a> · aumentos: Tabla 3-6 y capítulo 3.1.1 · fondos federales: Tabla 4-6 (p.84) · deuda: Tablas 2-9 y 2-10.</li>
  <li><a href="https://www.acueductos.pr.gov/comunicados/jsf-aprueba-en-consenso-el-presupuesto-2026-y-el-plan-de-control-fiscal-2026-2039" target="_blank" rel="noopener" data-prsf="verify" data-rec="acueductos" class="text-teal-700 font-semibold">Comunicado oficial de la AAA sobre la certificación (27 jun 2025) ↗</a></li>
  <li><a href="https://recovery.pr.gov/es" target="_blank" rel="noopener" data-prsf="verify" data-rec="acueductos" class="text-teal-700 font-semibold">Portal de transparencia de COR3 (recovery.pr.gov) ↗</a> · el estado de los fondos FEMA por agencia.</li>
  <li><a href="https://www.primerahora.com/noticias/gobierno-politica/notas/junta-certifica-presupuesto-de-la-aaa-con-aumento-a-partir-de-julio/" target="_blank" rel="noopener" data-prsf="verify" data-rec="acueductos" class="text-teal-700 font-semibold">Prensa: el aumento de 2% del 1 de julio de 2026 ↗</a></li>
</ul>

<div class="not-prose bg-teal-50 border border-teal-200 rounded-2xl p-5 mt-6">
  <p class="font-black text-slate-900" style="font-family:'Fraunces',Georgia,serif">¿Y tú qué puedes hacer con esto?</p>
  <p class="text-sm text-slate-700 mt-2 leading-relaxed">Nada urgente. Si quieres, una cosa: mira el desglose de tu próxima factura de la AAA (cargo de agua, alcantarillado y cargo fijo) y ya sabes por qué sube y hasta cuándo. Si tu agua no viene de la AAA sino de un acueducto comunal, tu récord es otro: <a href="/agua" class="text-teal-700 font-semibold">el del agua contra el récord federal de la EPA</a>. Y si esto le sirve a alguien que se queja del recibo sin saber de dónde viene, pásaselo. Si no, sigue tu camino.</p>
</div>

<p class="text-sm text-slate-500 mt-6">Este récord se corta al 31 de marzo de 2025 porque ese es el corte del documento certificado, el más reciente disponible. Cuando la AAA o la Junta publiquen un corte más nuevo, este récord se actualiza. ¿Ves un error? Escríbenos y se corrige con el documento en la mano.</p>
${SHARE_COPY_SCRIPT}
`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: 'El recibo del agua de Puerto Rico contra el récord: tarifas AAA 2026-2039 y fondos federales',
    description: 'Aumentos de tarifa de la AAA aprobados hasta 2039 ($2,598.1M en total) contra el uso de fondos federales: $8,985.7M identificados, $6,560.0M obligados, $773.0M recibidos (8.6%) al 31 de marzo de 2025. Fuente: Plan Fiscal Certificado AAA 2025 (Junta de Supervisión Fiscal).',
    creator: { '@type': 'Person', name: 'Angel Anderson', url: 'https://angelanderson.com' },
    publisher: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' },
    isAccessibleForFree: true, inLanguage: 'es', url: 'https://puertoricosinfiltros.com/acueductos',
    keywords: ['AAA', 'PRASA', 'tarifa de agua', 'fondos federales', 'FEMA', 'plan fiscal', 'Puerto Rico'],
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: 'El recibo del agua, contra el récord: tarifas AAA hasta 2039 y el dinero federal sin llegar',
    description: 'Los aumentos de la AAA están aprobados hasta 2039 y suman $2,598 millones. El 91% del dinero federal identificado no ha llegado a la caja. Verificado contra el plan fiscal certificado, con la fuente al lado.',
    slug: 'acueductos', bodyHtml: body, jsonLd, ogImage: OG_SINFILTROS,
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
  }))
}

// /transicion — La Transición 2024-2025: el gobierno, en su propia voz. Vistas públicas (Ley 197-2002)
// transmitidas por El Nuevo Día. 24+ sesiones, 50+ horas. Citas verificadas al minuto contra los videos.
// Fuentes: transcripts de Angel (Google Drive) + auto-captions ES verificados 2026-07-10. 3 días minados, resto pendiente.
async function handleTransicion(req: any, res: any) {
  const V1 = 'RguowcKS7wU', V2 = '3R8jwIec-Yg', V3 = 'jCoz2d5IJJA'
  type Claim = { q: string; c: string; d: string; v?: string; t?: number }
  type Bloque = { id: string; tag: string; titulo: string; nota?: string; claims: Claim[] }
  const bloques: Bloque[] = [
    {
      id: 'cor3', tag: 'Día 1 · 20 nov 2024', titulo: 'COR3: el mapa del dinero federal',
      claims: [
        { q: 'Manuel Laboy Rivera, director ejecutivo de COR3', c: 'FEMA en todos sus programas ha obligado cerca de 50,000 millones, de los cuales han desembolsado el 48% de todos los programas', d: 'FEMA total (incluye emergencia a corto plazo): ~$50,000M obligados, 48% desembolsado. Entre dic 2020 y nov 2024 la obligación y el desembolso casi se duplicaron.', v: V1, t: 2605 },
        { q: 'Intercambio del comité entrante con COR3', c: 'De los 39 [mil millones de asistencia pública y mitigación] hay 35.7 obligado y 10.6 que ya está desembolsado. Es correcto.', d: 'La reconstrucción de verdad (asistencia pública + mitigación): $39,000M asignados, $35,700M obligados, $10,600M desembolsados (27%). El total desembolsado de todo FEMA: $23,578M.', v: V1, t: 3728 },
        { q: 'Miembro del comité entrante, citando los números de COR3', c: 'En el caso de la Autoridad de Energía Eléctrica apenas hay un 15% que se ha desembolsado, en el caso de la autoridad de acueductos solamente un 13.4, en el caso de Educación apenas 2.3% y en el caso de vivienda pública 25.7', d: 'Desembolso por corporación (nov 2024): AEE 15% · AAA 13.4% · Educación 2.3% · vivienda pública 25.7%. Preguntado si a ese paso se salva el dinero, Laboy: "yo creo que sí".', v: V1, t: 4420 },
      ],
    },
    {
      id: 'vivienda', tag: 'Día 2 · 21 nov 2024', titulo: 'Vivienda: $20,000 millones y los toldos azules',
      claims: [
        { q: 'William Rodríguez, secretario de la Vivienda', c: 'Se han comprometido sobre 8.5 billones en fondos DR, un 86% de la asignación total, y se han desembolsado cerca de 3.7 billones, más del 37%', d: 'CDBG-DR: 86% comprometido, 37% desembolsado. Mitigación (CDBG-MIT, $8,000M+): comprometido $4,100M, desembolsado $184M, cerca del 2%.', v: V2, t: 137 },
        { q: 'William Rodríguez, secretario de la Vivienda', c: 'Desembolsado siempre es que se pagó, que hay dinero que salió de las arcas del departamento de la vivienda federal', d: 'Definición en récord: "desembolsado" no significa obra terminada ni llave entregada. El secretario no pudo dar la cifra de proyectos 100% terminados en la vista.', v: V2, t: 1933 },
        { q: 'Interrogatorio al secretario de la Vivienda (toldos azules)', c: 'Son sobre 3,000, alrededor de 3,000... de esas, 1,939 entraron al programa', d: '7 años después de María: ~3,000 unidades con toldo azul identificadas, 1,939 en el programa. Nadie pudo decir cuántas personas, ni cuántos menores, viven bajo toldo azul hoy.', v: V2, t: 1616 },
        { q: 'William Rodríguez, secretario de la Vivienda', c: 'El universo que nosotros podemos asistir... 12,886 que son familias que podemos asistir bajo nuestros programas', d: 'De ~50,000 unidades afectadas por María, el programa R3 solo puede asistir 12,886: ~10,000 terminadas y casi 3,000 pendientes "para el año que viene". El resto quedó fuera.', v: V2, t: 2102 },
        { q: 'Comité entrante, leyendo la propia ponencia de Vivienda', c: 'Vivienda de interés social requeriría aumentar el ritmo de desembolso en 930%... créditos contributivos 572%, incubadoras 452%', d: 'Para gastar el dinero antes de los plazos (DR: sept 2029 · MIT: 2033), 7 programas necesitan acelerar su desembolso anual entre 122% y 930%.', v: V2, t: 1167 },
        { q: 'Comité entrante, con el registro de contratos', c: 'IEM International con 101.7 millones e ICF con 51.5 millones en Vivienda... las mismas dos en COR3: ICF con 736.5, IEM con 69.6 millones', d: 'Las mismas consultoras cobran en Vivienda y en COR3. Laboy aclaró: $1,200M en 5 contratos de consultoría de COR3 es acumulado 2017-2024. Conecta con el récord de /sigue-el-dinero.', v: V2, t: 4276 },
        { q: 'William Rodríguez, secretario de la Vivienda', c: 'Hasta el mes de octubre teníamos una prohibición... se elimina y estamos trabajando con enmienda para darle preferencia a las firmas locales', d: 'Hasta octubre 2024 el reglamento federal prohibía dar preferencia a firmas puertorriqueñas en la contratación de recuperación.', v: V2, t: 4940 },
        { q: 'Presidente del comité entrante + secretario de la Vivienda', c: 'HUD junto con el correo de EE.UU. estima que en Puerto Rico hay aproximadamente 307,500 unidades de vivienda vacías', d: 'HUD/USPS estima 307,500 viviendas vacías en PR; el inventario propio de Vivienda lleva ~42,300 analizadas. Y en Villa Hugo 1 y 2 (Canóvanas), 3,000+ personas siguen sin luz ni agua 35 años después de Hugo.', v: V2, t: 6398 },
      ],
    },
    {
      id: 'energia', tag: 'Día 2 · 21 nov 2024 (tarde)', titulo: 'Energía: un 3 de 10, dicho por el propio director',
      claims: [
        { q: 'Josué Colón, director ejecutivo de la AEE, a pregunta directa', c: '¿En una escala del 1 al 10, dónde usted ve el proceso de la modernización del sistema eléctrico para el cual tenemos 10.5 billones? — Hoy está como en tres', d: 'Con $10,500M disponibles, el propio director de la AEE puntuó la modernización de la red: 3 de 10.', v: V2, t: 23868 },
        { q: 'Panel de la AEE ante el comité', c: 'LUMA en proyectos tiene obligados 2.3 billones, pero en reembolsos ha recibido alrededor de 220 millones... Ese número la verdad que asusta', d: 'LUMA: $2,300M obligados y ~$220M reembolsados. La AEE sola, en proyectos permanentes, había logrado $400M+.', v: V2, t: 24190 },
        { q: 'Intercambio sobre el manejo de vegetación', c: 'LUMA lo ha dicho, puede resolver el 50 o 60% de los apagones... — No existen el 1.2 billones... ellos lo que tienen son 18 millones aprobados solamente', d: 'El proyecto que según LUMA resolvería la mitad de los apagones estaba estimado en $1,200M; FEMA había aprobado $15-18M a nov 2024.', v: V2, t: 26719 },
        { q: 'Manuel Laboy Rivera, director ejecutivo de COR3', c: 'Lo que haga mal LUMA al final es una responsabilidad de PREPA y del gobierno de Puerto Rico... seremos responsables de devolver el dinero', d: 'Riesgo estructural en récord: si el operador privado maneja mal fondos FEMA, el que devuelve el dinero es el pueblo, no el operador.', v: V2, t: 24609 },
        { q: 'Josué Colón, director ejecutivo de la AEE', c: 'Desde que el sistema se quedó sin recursos [se han pagado] 413 millones... el sistema tiene un poco más de 12,000 beneficiarios', d: 'Pensiones de la AEE en default desde 2023: $413M pagados con fondos estatales y un préstamo que vencía el 31 de diciembre de 2024. Nómina de pensiones: ~$24-25M al mes.', v: V2, t: 19152 },
      ],
    },
    {
      id: 'aaa', tag: 'Día 3 · 22 nov 2024', titulo: 'AAA: 1 de cada 2 galones se pierde',
      nota: 'Esta ponencia NO estaba en ningún transcript guardado. Se rescató de los captions del video el 10 de julio de 2026. Conecta directo con el récord del recibo: /acueductos.',
      claims: [
        { q: 'Comité entrante + Doriely Pagán, presidenta ejecutiva de la AAA', c: 'O sea que aproximadamente de cada dos galones uno se pierde en el camino — bueno, estos son la cuantificación que tenemos al momento', d: 'Pérdida física de agua: 53% al cierre del año fiscal 2024 (mejoró de 57% en 2021). Más la pérdida comercial (~10%): agua que llega pero no se factura. La AAA no lo refutó.', v: V3, t: 8835 },
        { q: 'Doriely Pagán, presidenta ejecutiva de la AAA', c: 'Logramos la obligación en enero del 2021 de los 3.7 billones... hemos recibido reembolsos de 450 millones de fondo FEMA', d: 'FEMA/FAASt: $3,700M obligados en enero 2021, $450M de reembolso en 4 años (~12%). El plan fiscal certificado de 2025 lo confirma: $452M fue adelanto de capital de trabajo; la obra permanente reembolsada era $67M.', v: V3, t: 8426 },
        { q: 'Comité entrante, leyendo la tabla de la AAA + Pagán', c: 'Son 7 billones, están en construcción 1.3 y completado 273 millones, lo que dice la tabla — correcto, sí', d: 'De la cartera activa de $7,100M (291 proyectos), había $273M en obra completada: cerca del 4%.', v: V3, t: 13105 },
        { q: 'Vicepresidente de la AAA, bajo presión del comité (contadores inteligentes)', c: 'Significa que nuestra facturación ya no va a ser estimada, va a ser basada en el consumo', d: 'Admitido en récord: con los contadores nuevos las facturas van a subir al pasar de estimado a consumo real. La AAA rehusó revelar el costo unitario del contador en vista pública.', v: V3, t: 11265 },
        { q: 'Comité entrante (fondos ARPA) + Pagán', c: '¿Ustedes firmaron qué cantidad? — 280 millones... como 280... 214. — Si no está el contrato cabe la posibilidad que el tesoro se lleve el dinero', d: '$214M de ARPA asignados a la AAA con deadline de contratos al 31 de diciembre de 2024; la presidenta no pudo confirmar en la vista que todo estuviera obligado.', v: V3, t: 12876 },
        { q: 'Doriely Pagán, presidenta ejecutiva de la AAA', c: 'Hay operadores ahora mismo que pueden tener su licencia vencida, sin embargo estamos cobijados en que el supervisor tiene la licencia', d: 'La presidenta no supo decir cuántos de los ~700 operadores de planta tienen certificación vigente. En la represa La Plata funcionaban 4 de 7 bombas; cada bomba nueva cuesta $10-20M.', v: V3, t: 10265 },
        { q: 'Doriely Pagán, presidenta ejecutiva de la AAA', c: 'Dentro del plan fiscal que ya está proyectado, sí, ahí contempla un ajuste de 2%', d: 'El aumento de tarifa venía anunciado desde esta vista. Se materializó: 2% el 1 de julio de 2026, con aumentos aprobados hasta 2039. El récord completo del recibo: /acueductos.', v: V3, t: 8723 },
        { q: 'Doriely Pagán, presidenta ejecutiva de la AAA', c: 'En el 2016 la autoridad se quedó sin fuentes de financiamiento... hasta prácticamente el 2020 sin poder hacer una inversión sustancial', d: 'Admitido: 4 años sin inversión sustancial (2016-2020) y mantenimiento preventivo "cada 3 o 4 años, o por emergencia". El verde también se anota: refinanciamiento con ~$1,000M en ahorros y pérdida física bajando de 57% a 53%.', v: V3, t: 10080 },
      ],
    },
    {
      id: 'afi', tag: 'Día 3 · 22 nov 2024', titulo: 'AFI: las escuelas, los permisos y el 22%',
      claims: [
        { q: 'Eduardo Rivera Cruz, director ejecutivo de AFI', c: 'Se le entregaron ya 80 escuelas y a finales de diciembre se estarán entregando 55 adicionales para un total de 570... faltando 27 para el primer trimestre del año que viene', d: 'Columnas cortas ($484M): 570 escuelas entregadas a dic 2024, 27 pendientes con plazo Q1 2025.', v: V3, t: 1846 },
        { q: 'Lcdo. Marcos Rodríguez Ema, comité entrante', c: '¿Alguna razón en particular que el 22% [de las subastas] se cancelen?', d: 'AFI: 601 subastas en 4 años, 384 adjudicadas ($903M) y 22% canceladas. La agencia lo atribuyó a subastas desiertas, escasez de materiales y de mano de obra.', v: V3, t: 2944 },
        { q: 'Eduardo Rivera Cruz, director ejecutivo de AFI', c: 'A veces están dentro de los 30 días y otras sobrepasan, dos y tres meses, han habido algunos que duran años', d: 'Los endosos de agencias que la ley fija en 30 días tardan meses y hasta años. El permiso del muelle de Punta Santiago tardó más de 2 años.', v: V3, t: 3896 },
        { q: 'Eduardo Rivera Cruz, director ejecutivo de AFI', c: 'Esta es una comunidad que llevaba más de 20 años sin agua potable... a 71 familias con una inversión de 2.6 millones', d: 'Sector Pajita Falcón (Aguas Buenas): 20+ años sin agua potable, resuelto con $2.6M. El dato duro no es el proyecto: es cuánto tardó en llegar.', v: V3, t: 1990 },
      ],
    },
    {
      id: 'dtop', tag: 'Día 3 · 22-23 nov 2024', titulo: 'Transportación: el ciberataque y el mismo operador',
      nota: 'Estas citas salen de un fragmento del Q&amp;A de la tarde cuyo video exacto está pendiente de anclar al minuto. El dato es del récord; el link fino viene en la próxima pasada.',
      claims: [
        { q: 'Perito en ciberseguridad del comité entrante', c: 'El ataque cibernético que sufrió AutoExpreso en abril de 2022, más de dos semanas sin servicio... no entiendo cómo tenemos el mismo operador a este punto', d: 'El comité dejó en récord que tras el ciberataque de 2022 el operador de AutoExpreso seguía siendo el mismo, y rechazó "se robusteció" como respuesta sin certificación.' },
        { q: 'Edwin González Montalvo, director ejecutivo de la ACT', c: 'Ya tenemos 13 de 22 pórticos completamente nuevos', d: 'AutoExpreso: 13 de 22 pórticos reconstruidos a nov 2024. Sin brigadas regulares de semáforos los fines de semana (solo emergencias): buscaban contrato privado 24/7.' },
      ],
    },
  ]

  const ytLink = (v?: string, t?: number) => v ? `https://www.youtube.com/watch?v=${v}${t ? `&t=${t}s` : ''}` : ''
  const fmtT = (t?: number) => {
    if (!t) return ''
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
    return (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(s).padStart(2, '0')
  }
  const bloquesHtml = bloques.map(b => `
<h2 id="${b.id}">${escapeHtml(b.titulo)}</h2>
<p class="not-prose"><span class="inline-block text-xs font-bold text-teal-700 uppercase tracking-wide bg-teal-50 border border-teal-200 rounded-full px-3 py-1">${b.tag}</span></p>
${b.nota ? `<div class="not-prose bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3 text-sm text-slate-700">${b.nota.replace('/acueductos', '<a href="/acueductos" class="text-teal-700 font-semibold">/acueductos</a>')}</div>` : ''}
<div class="not-prose space-y-3 mt-3">
${b.claims.map(cl => `
  <div class="bg-white border border-slate-200 rounded-xl p-4">
    <blockquote class="text-slate-800 leading-relaxed border-l-4 border-teal-500 pl-3 italic">"${escapeHtml(cl.c)}"</blockquote>
    <p class="text-xs text-slate-500 mt-2">${escapeHtml(cl.q)}</p>
    <p class="text-sm text-slate-800 mt-2 leading-relaxed">${cl.d.replace('/acueductos', '<a href="/acueductos" class="text-teal-700 font-semibold">/acueductos</a>').replace('/sigue-el-dinero', '<a href="/sigue-el-dinero" class="text-teal-700 font-semibold">/sigue-el-dinero</a>')}</p>
    ${cl.v ? `<a href="${ytLink(cl.v, cl.t)}" target="_blank" rel="noopener" data-prsf="verify" data-rec="transicion" class="inline-flex items-center gap-1 mt-2 text-sm font-bold text-teal-700 hover:underline">Óyelo tú mismo, minuto ${fmtT(cl.t)} ↗</a>` : ''}
  </div>`).join('')}
</div>`).join('')

  // Las vistas completas — índice verificado contra el canal de El Nuevo Día (2026-07-10).
  const videos: [string, string, number, string][] = [
    ['20 nov 2024', V1, 15400, 'minada'], ['21 nov 2024', V2, 28407, 'minada'], ['22 nov 2024', V3, 14255, 'minada'],
    ['22-23 nov 2024', 'XZGTyMNcr0o', 4541, ''], ['23 nov 2024', 'xhr3SrEjR7k', 10717, ''], ['23 nov 2024', 'ZvZmiREinbU', 1412, ''],
    ['26 nov 2024', 'uUWb85Doki0', 16128, ''], ['3 dic 2024', 'EZvFDSu0sxU', 14412, ''], ['3 dic 2024', 'dCVlOodXNPw', 12158, ''],
    ['3 dic 2024', 'On2Zg9QdWOo', 7479, ''], ['3 dic 2024', 'az9UhZBvLqs', 2672, ''], ['4 dic 2024', 'BJFs3kJgteM', 18688, ''],
    ['4 dic 2024', 'bO6iQecGyjg', 22858, ''], ['5 dic 2024', 'XlnW6cFlJLM', 13501, ''],
  ]
  const dur = (s: number) => `${Math.floor(s / 3600)}h ${String(Math.round((s % 3600) / 60)).padStart(2, '0')}m`
  const videoRows = videos.map(([f, id, s, st]) => `
    <tr class="border-t border-slate-100">
      <td class="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap">${f}</td>
      <td class="py-2 px-3 text-slate-600 whitespace-nowrap">${dur(s)}</td>
      <td class="py-2 px-3">${st ? '<span class="text-teal-700 font-bold">✓ en el récord</span>' : '<span class="text-slate-400">pendiente de minar</span>'}</td>
      <td class="py-2 px-3"><a href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener" data-prsf="verify" data-rec="transicion" class="text-teal-700 font-semibold hover:underline">ver ↗</a></td>
    </tr>`).join('')

  const citables = [
    `En las vistas de transición 2024, la AAA aceptó en récord que de cada 2 galones de agua que produce, 1 se pierde en el camino (53% de pérdida física + ~10% comercial, FY2024). Video al minuto: youtube.com/watch?v=${V3}&t=8835s. Compilado en puertoricosinfiltros.com/transicion`,
    `Desembolso de fondos FEMA por corporación, dicho en las vistas de transición (nov 2024): Educación 2.3%, AAA 13.4%, AEE 15%, vivienda pública 25.7%. Video al minuto: youtube.com/watch?v=${V1}&t=4420s. Compilado en puertoricosinfiltros.com/transicion`,
    `El director de la AEE puntuó 3 de 10 la modernización de la red eléctrica, con $10,500M disponibles, en las vistas de transición (nov 2024). Video al minuto: youtube.com/watch?v=${V2}&t=23868s. Compilado en puertoricosinfiltros.com/transicion`,
  ]
  const citableCards = citables.map((c) => `
    <div class="flex items-start gap-2 bg-white border border-slate-200 rounded-xl p-3 mt-2">
      <p class="flex-1 text-sm text-slate-700 leading-relaxed">${escapeHtml(c)}</p>
      <button type="button" class="share-copy shrink-0 inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-lg text-xs" data-copy="${escapeHtml(c)}"><i class="fa-regular fa-copy"></i> Copiar</button>
    </div>`).join('')

  const body = `
<h1>La Transición 2024-2025: el gobierno, en su propia voz</h1>
<p class="text-lg text-slate-600 mt-2">En noviembre y diciembre de 2024, la ley obligó al gobierno saliente de Puerto Rico a sentarse y declarar, en vistas públicas transmitidas en vivo, el estado real de cada agencia. Más de 50 horas de testimonio. Nadie compiló ese récord. Aquí está, cita por cita, con el minuto del video al lado.</p>

<div class="not-prose mt-5 bg-slate-900 text-white rounded-2xl p-5 sm:p-6">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">El dato</p>
  <p class="text-xl sm:text-2xl font-black mt-1 leading-snug">Educación 2.3%. Acueductos 13.4%. Energía 15%.</p>
  <p class="text-slate-300 mt-2 text-sm leading-relaxed">Ese era el desembolso de los fondos FEMA por corporación en noviembre de 2024, dicho ante el comité de transición con los números de COR3. Y el director de la AEE, con $10,500 millones disponibles, puntuó su propia modernización: 3 de 10. Todo está en video. Todo tiene minuto.</p>
</div>

<div class="not-prose bg-white border border-slate-200 rounded-xl p-4 mt-5 text-sm text-slate-700">
  <strong>Qué es esto:</strong> la Ley 197 del 2002 obliga a cada transición de gobierno a rendir cuentas en vistas públicas. El Nuevo Día las transmitió completas en su canal de YouTube: 24 sesiones. Este récord las está minando una por una: la cita textual, quién la dijo, y el link al minuto exacto pa' que la oigas tú mismo. No es opinión: es lo que ellos mismos dijeron.
</div>

${bloquesHtml}

<h2 id="relojes">Los relojes que arrancaron en esas vistas</h2>
<p>Promesas con fecha, hechas en récord. El tiempo ya pasó pa' varias. Estado al 10 de julio de 2026:</p>
<div class="not-prose mt-3 overflow-auto border border-slate-200 rounded-xl">
  <table class="w-full text-sm">
    <thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th class="py-2 px-3">Lo prometido en la vista</th><th class="py-2 px-3">Plazo</th><th class="py-2 px-3">Estado</th></tr></thead>
    <tbody>
      <tr class="border-t border-slate-100"><td class="py-2 px-3">AAA: ajuste de tarifa de 2% "ya en el plan fiscal"</td><td class="py-2 px-3 whitespace-nowrap">2025-2026</td><td class="py-2 px-3"><span class="text-teal-700 font-bold">✓ Cumplido</span>: 2% el 1 jul 2026, y aumentos aprobados hasta 2039 (<a href="/acueductos" class="text-teal-700 font-semibold">/acueductos</a>)</td></tr>
      <tr class="border-t border-slate-100"><td class="py-2 px-3">AFI: las últimas 27 escuelas de columnas cortas</td><td class="py-2 px-3 whitespace-nowrap">Q1 2025</td><td class="py-2 px-3 text-slate-500">Por verificar</td></tr>
      <tr class="border-t border-slate-100"><td class="py-2 px-3">Vivienda: ~3,000 familias R3 restantes</td><td class="py-2 px-3 whitespace-nowrap">2025</td><td class="py-2 px-3 text-slate-500">Por verificar</td></tr>
      <tr class="border-t border-slate-100"><td class="py-2 px-3">AFI: CDT Susana Centeno (Vieques), fases 2 y 3</td><td class="py-2 px-3 whitespace-nowrap">jun y dic 2025</td><td class="py-2 px-3 text-slate-500">Por verificar</td></tr>
      <tr class="border-t border-slate-100"><td class="py-2 px-3">AAA: contratos ARPA ($214M) firmados a tiempo</td><td class="py-2 px-3 whitespace-nowrap">31 dic 2024</td><td class="py-2 px-3 text-slate-500">Por verificar</td></tr>
      <tr class="border-t border-slate-100"><td class="py-2 px-3">Vivienda: cierre de fondos CDBG-DR</td><td class="py-2 px-3 whitespace-nowrap">sept 2029</td><td class="py-2 px-3 text-slate-500">Corriendo</td></tr>
    </tbody>
  </table>
</div>
<p class="text-sm text-slate-500 mt-2">Cada "por verificar" es trabajo pendiente de este récord, no una acusación. Cuando se verifique, se anota en verde o en rojo, igual que todo lo demás.</p>

<h2 id="vistas">Las vistas completas (lo que falta por minar)</h2>
<p>24 sesiones en el canal de El Nuevo Día. Tres están en este récord; el resto sigue ahí, público, esperando. Las sesiones de diciembre incluyen salud, educación, hacienda y seguridad.</p>
<div class="not-prose mt-3 overflow-auto border border-slate-200 rounded-xl">
  <table class="w-full text-sm">
    <thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th class="py-2 px-3">Fecha</th><th class="py-2 px-3">Duración</th><th class="py-2 px-3">Estado</th><th class="py-2 px-3">Video</th></tr></thead>
    <tbody>${videoRows}</tbody>
  </table>
</div>
<p class="text-sm text-slate-500 mt-2">Más ~10 clips cortos del mismo canal. Índice verificado contra YouTube el 10 de julio de 2026.</p>

<h2 id="local">El mismo ejercicio, a nivel de pueblo</h2>
<p>Esta disciplina (la cita, el video, el minuto) ya corre pa' Cabo Rojo con las grabaciones públicas del municipio: <a href="/historial" class="text-teal-700 font-semibold">el historial de promesas del alcalde</a> y <a href="/expediente/alcalde-cabo-rojo" class="text-teal-700 font-semibold">el expediente completo</a>. La historia que cuentan las vistas estatales se repite en los pueblos.</p>

<h2 id="citables">Citables (copia y pega, con fuente)</h2>
${citableCards}

<h2 id="metodo">Método y límites</h2>
<ul class="text-slate-700">
  <li>Las citas salen de transcripciones automáticas de los streams (limpiadas de ruido, sin cambiar números ni palabras clave) y cada una lleva su link al minuto pa' que la verifiques con tus oídos.</li>
  <li>Los nombres de los miembros del comité se identifican por el audio; donde hay duda, se dice "miembro del comité" en vez de adivinar.</li>
  <li>Tres de 24 sesiones están minadas. Esto es un récord vivo: crece sesión por sesión.</li>
  <li>¿Ves un error en una cita o un número? Escríbenos y se corrige con el video en la mano: <a href="mailto:angel@angelanderson.com" class="text-teal-700 font-semibold">angel@angelanderson.com</a>.</li>
</ul>

<div class="not-prose bg-teal-50 border border-teal-200 rounded-2xl p-5 mt-6">
  <p class="font-black text-slate-900" style="font-family:'Fraunces',Georgia,serif">¿Y tú qué haces con esto?</p>
  <p class="text-sm text-slate-700 mt-2 leading-relaxed">Nada que te quite el día. Esto existe pa' que cuando alguien te diga "eso nadie lo sabe", tú tengas el minuto exacto donde lo dijeron ellos mismos. Si eres periodista o investigador, los citables de arriba son tuyos. Y si hoy no es el día de meterte 50 horas de vistas, tranquilo: pa' eso está este récord.</p>
</div>
${SHARE_COPY_SCRIPT}
`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: 'La Transición Gubernamental 2024-2025 de Puerto Rico: el récord de las vistas públicas, cita por cita',
    description: 'Compilación verificada de las vistas públicas de transición (Ley 197-2002) transmitidas por El Nuevo Día: declaraciones de COR3, Vivienda, AEE, AAA, AFI y DTOP con cita textual y minuto del video. Desembolso FEMA nov 2024: Educación 2.3%, AAA 13.4%, AEE 15%.',
    creator: { '@type': 'Person', name: 'Angel Anderson', url: 'https://angelanderson.com' },
    publisher: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' },
    isAccessibleForFree: true, inLanguage: 'es', url: 'https://puertoricosinfiltros.com/transicion',
    keywords: ['transición gubernamental', 'Puerto Rico', 'Ley 197', 'FEMA', 'COR3', 'AAA', 'AEE', 'vistas públicas', '2024'],
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: 'La Transición 2024-2025: el gobierno, en su propia voz, cita por cita y al minuto',
    description: 'Las vistas públicas de la transición de gobierno de PR (nov-dic 2024), compiladas y verificadas: Educación 2.3% de desembolso FEMA, AAA 13.4%, AEE 15%, y el director de la AEE puntuando 3/10 su propia red. Cada cita con el minuto del video.',
    slug: 'transicion', bodyHtml: body, jsonLd, ogImage: OG_SINFILTROS,
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
  }))
}

// /expediente/:slug — el dossier público de un funcionario: sus promesas + el estado de su pueblo, todo citable.
// v1: alcalde de Cabo Rojo (plantilla replicable a cualquier funcionario/distrito).
// /esencia — la línea de tiempo pública del proyecto Esencia en Cabo Rojo. Neutral, solo hechos con fuente.
async function handleEsencia(req: any, res: any) {
  let rows: any[] = []
  try {
    const { data } = await supabase.from('esencia_timeline').select('event_date,title,description,category,source_name,source_url').order('event_date', { ascending: false })
    rows = data || []
  } catch (_) { /* empty */ }
  const catCls: Record<string, string> = {
    financial: 'bg-amber-100 text-amber-800 border-amber-200',
    legal: 'bg-slate-100 text-slate-700 border-slate-200',
    social: 'bg-red-100 text-red-800 border-red-200',
    environmental: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  }
  const catLabel: Record<string, string> = { financial: 'Dinero', legal: 'Legal', social: 'Protesta', environmental: 'Ambiente' }
  const items = rows.map((r: any) => {
    const cls = catCls[r.category] || catCls.legal
    const okSrc = /^https?:\/\//i.test(String(r.source_url || ''))
    return `<div class="not-prose border border-slate-200 bg-white rounded-2xl p-4 mt-3">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div class="text-xs text-slate-400 font-semibold">${escapeHtml(String(r.event_date || ''))}</div>
        <span class="text-xs font-bold rounded-full px-2.5 py-0.5 border ${cls}">${catLabel[r.category] || 'Dato'}</span>
      </div>
      <p class="font-bold text-slate-800 mt-1">${escapeHtml(r.title)}</p>
      ${r.description ? `<p class="text-sm text-slate-600 mt-1">${escapeHtml(r.description)}</p>` : ''}
      <p class="text-xs text-slate-400 mt-1">Fuente: ${okSrc ? `<a href="${escapeHtml(r.source_url)}" target="_blank" rel="noopener" class="text-teal-700 underline">${escapeHtml(r.source_name || 'ver')} ↗</a>` : escapeHtml(r.source_name || '—')}</p>
    </div>`
  }).join('')
  const body = `
<h1>El proyecto Esencia, sin filtros</h1>
<p class="text-lg text-slate-600 mt-2">Esencia es el mega-desarrollo turístico-residencial propuesto para Cabo Rojo que ha generado investigaciones periodísticas, medidas del Senado y protestas de San Juan a Nueva York. Esta página <strong>organiza el récord público con la fuente al lado de cada dato</strong>. Sin opinión: tú decides qué pensar.</p>

<div class="not-prose mt-5 bg-slate-900 text-white rounded-2xl p-5">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">El proyecto en una línea</p>
  <p class="text-lg sm:text-xl font-black mt-1 leading-snug">Unas 1,549 cuerdas entre Boquerón y Combate · ~1,132 residencias + 520 unidades de hotel · ~$2,000 millones de inversión privada · ~$498 millones en créditos contributivos aprobados.</p>
  <p class="text-slate-300 mt-2 text-sm">Presentado como turístico; reportado como ~70% residencial. Controlado desde Londres. El DRNA lo rechazó; OGPe aprobó su Declaración de Impacto Ambiental con 46 condiciones.</p>
</div>

<div class="not-prose mt-5 bg-white border border-slate-200 rounded-2xl p-4">
  <p class="text-sm font-bold text-slate-700 mb-2">🎧 Escúchalo: "Lujo sin agua" — el expediente de Esencia en audio (dos voces, 15 min)</p>
  <audio controls preload="none" class="w-full" src="https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/podcast/esencia-lujo-sin-agua.m4a">Tu navegador no puede reproducir el audio. <a href="https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/podcast/esencia-lujo-sin-agua.m4a" class="text-teal-700 font-semibold">Descárgalo</a>.</audio>
  <p class="text-xs text-slate-400 mt-1">Generado con IA sobre las fuentes primarias de este récord (DIA, carta de la AAA, CPI, vistas públicas). Los números son los de esta página.</p>
</div>

<div class="not-prose mt-4 flex flex-wrap gap-2 text-xs">
  <a href="#numeros" class="bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">Los números</a>
  <a href="#proscons" class="bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">Lo mejor de cada lado</a>
  <a href="#termometro" class="bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">El termómetro (196 voces)</a>
  <a href="#cuenta" class="bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">La cuenta + calculadora</a>
  <a href="#agua" class="bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">El agua</a>
  <a href="#dueno" class="bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">El dueño</a>
  <a href="#escenarios" class="bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">Los escenarios</a>
  <a href="#timeline" class="bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">Línea de tiempo</a>
  <a href="#video" class="bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">El panel en video</a>
  <a href="#lados" class="bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300">Los dos lados</a>
</div>

<h2 id="numeros">Qué es, en números</h2>
<div class="not-prose grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
  <div class="bg-white border border-slate-200 rounded-xl p-4 text-center"><div class="text-2xl font-black text-slate-900">1,549</div><div class="text-xs text-slate-500 mt-1">cuerdas de terreno</div></div>
  <div class="bg-white border border-slate-200 rounded-xl p-4 text-center"><div class="text-2xl font-black text-slate-900">~1,652</div><div class="text-xs text-slate-500 mt-1">unidades (1,132 casas + 520 hotel)</div></div>
  <div class="bg-white border border-slate-200 rounded-xl p-4 text-center"><div class="text-2xl font-black text-slate-900">~$2,000M</div><div class="text-xs text-slate-500 mt-1">inversión anunciada</div></div>
  <div class="bg-white border border-amber-300 rounded-xl p-4 text-center"><div class="text-2xl font-black text-amber-600">$498M</div><div class="text-xs text-slate-500 mt-1">en créditos contributivos</div></div>
</div>
<p class="text-xs text-slate-400 mt-2">Fuentes: Centro de Periodismo Investigativo (CPI), The Real Deal, registros públicos. La cifra de cuerdas y unidades proviene de la documentación del proyecto reseñada por el CPI.</p>

<h2 id="proscons">Lo mejor que dice cada lado</h2>
<p>Ningún bando es bobo. Estos son los argumentos más fuertes de cada lado, tratados con respeto, y con lo que el récord dice de cada uno:</p>
<div class="not-prose grid sm:grid-cols-2 gap-3 mt-3">
  <div class="border-t-4 border-emerald-400 bg-white border border-slate-200 rounded-b-xl p-4">
    <div class="text-xs font-black text-emerald-700 uppercase tracking-wide mb-2">A favor</div>
    <ul class="text-sm text-slate-700 space-y-2">
      <li><strong>Inversión y empleos.</strong> ~$2,000M privados y 2,000+ empleos prometidos, en una región donde la necesidad económica es real, no abstracta.</li>
      <li><strong>Actividad todo el año.</strong> Flujo constante para los comercios de Boquerón y El Combate, no solo en temporada.</li>
      <li><strong>Ingresos municipales.</strong> El alcalde citó en ponencia "más de $20 millones en CRIM y arbitrios en 10 años" para las arcas del pueblo.</li>
      <li><strong>Promesas de acceso y conservación.</strong> Los proponentes prometen acceso público a la playa y desarrollo "ecoamigable" (conocelaverdad.com).</li>
    </ul>
  </div>
  <div class="border-t-4 border-red-400 bg-white border border-slate-200 rounded-b-xl p-4">
    <div class="text-xs font-black text-red-700 uppercase tracking-wide mb-2">En contra</div>
    <ul class="text-sm text-slate-700 space-y-2">
      <li><strong>El agua.</strong> La propia AAA, por escrito (26 sep 2024): el sistema no puede suplir los 1.2M de galones diarios (~28% del suministro del pueblo).</li>
      <li><strong>El subsidio.</strong> ~$567M de dinero público (~$343,000 por unidad de lujo), sin cláusula de devolución si los empleos no llegan.</li>
      <li><strong>La basura.</strong> +30 toneladas/día a un vertedero que se llena ~2030: le quita 2 a 4 años al pueblo.</li>
      <li><strong>El historial.</strong> Daño documentado por el CPI en 7 países (Hawái, Los Cabos, Ibiza...).</li>
      <li><strong>La costa.</strong> Deslinde cuestionado; el Tribunal llamó la notificación del DRNA "defectuosa e inadecuada".</li>
    </ul>
  </div>
</div>
<p class="text-sm text-slate-600 mt-3"><strong>La diferencia honesta entre las dos columnas:</strong> los argumentos a favor descansan mayormente en <em>promesas</em> del proyecto; los de en contra, en el <em>expediente</em>. Eso no hace a unos falsos ni a otros ciertos: significa que unos se verifican después, y los otros ya se pueden verificar hoy. Las palancas de la <a href="#cuenta" class="text-teal-700 font-semibold">calculadora</a> son justo lo que convertiría las promesas en garantías.</p>



<h2 id="termometro">El termómetro del pueblo: las 196 voces</h2>
<p>Nadie ha medido qué piensa la gente sobre Esencia — no hay encuesta pública. Esto es lo más cercano que existe: en abril de 2026, un post sobre el proyecto se hizo viral en Facebook (2,300 reacciones, 1,100 compartidos, 542 comentarios en 21 horas). Leímos y clasificamos, uno por uno, a los <strong>196 comentaristas únicos</strong>. Este es el único sentimiento medido publicado sobre el proyecto:</p>

<div class="not-prose grid grid-cols-3 gap-3 mt-4">
  <div class="bg-white border-2 border-red-300 rounded-xl p-4 text-center"><div class="text-3xl font-black text-red-600">59%</div><div class="text-xs text-slate-600 mt-1">en contra (116 personas)</div></div>
  <div class="bg-white border-2 border-emerald-300 rounded-xl p-4 text-center"><div class="text-3xl font-black text-emerald-600">11%</div><div class="text-xs text-slate-600 mt-1">a favor (22 personas)</div></div>
  <div class="bg-white border-2 border-amber-300 rounded-xl p-4 text-center"><div class="text-3xl font-black text-amber-600">30%</div><div class="text-xs text-slate-600 mt-1">con matices, sin bando (58 personas)</div></div>
</div>
<p class="text-sm text-slate-700 mt-3"><strong>El dato más importante no es el 59.</strong> Es el 30: casi 1 de cada 3 personas no está en ningún bando — tiene dudas, preguntas o condiciones. Esa es exactamente la gente para la que existe esta página.</p>

<h3 class="mt-5">De qué habla la gente cuando habla de Esencia (los 9 temas, medidos)</h3>
<div class="not-prose mt-3 space-y-1.5">
  <div class="flex items-center gap-2"><div class="w-40 text-xs font-semibold text-slate-700 text-right">Ambiental</div><div class="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden"><div class="bg-emerald-500 h-4 rounded-full" style="width:100%"></div></div><div class="text-xs text-slate-500 w-8">49</div></div>
  <div class="flex items-center gap-2"><div class="w-40 text-xs font-semibold text-slate-700 text-right">El agua</div><div class="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden"><div class="bg-sky-500 h-4 rounded-full" style="width:88%"></div></div><div class="text-xs text-slate-500 w-8">43</div></div>
  <div class="flex items-center gap-2"><div class="w-40 text-xs font-semibold text-slate-700 text-right">Derecho a protestar</div><div class="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden"><div class="bg-slate-400 h-4 rounded-full" style="width:71%"></div></div><div class="text-xs text-slate-500 w-8">35</div></div>
  <div class="flex items-center gap-2"><div class="w-40 text-xs font-semibold text-slate-700 text-right">Corrupción (percepción)</div><div class="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden"><div class="bg-slate-400 h-4 rounded-full" style="width:59%"></div></div><div class="text-xs text-slate-500 w-8">29</div></div>
  <div class="flex items-center gap-2"><div class="w-40 text-xs font-semibold text-slate-700 text-right">Político/partidista</div><div class="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden"><div class="bg-slate-400 h-4 rounded-full" style="width:59%"></div></div><div class="text-xs text-slate-500 w-8">29</div></div>
  <div class="flex items-center gap-2"><div class="w-40 text-xs font-semibold text-slate-700 text-right">Empleo</div><div class="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden"><div class="bg-emerald-400 h-4 rounded-full" style="width:43%"></div></div><div class="text-xs text-slate-500 w-8">21</div></div>
  <div class="flex items-center gap-2"><div class="w-40 text-xs font-semibold text-slate-700 text-right">Precedentes (Dorado, Vieques)</div><div class="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden"><div class="bg-slate-300 h-4 rounded-full" style="width:27%"></div></div><div class="text-xs text-slate-500 w-8">13</div></div>
  <div class="flex items-center gap-2"><div class="w-40 text-xs font-semibold text-slate-700 text-right">Rumor de bancarrota</div><div class="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden"><div class="bg-slate-300 h-4 rounded-full" style="width:24%"></div></div><div class="text-xs text-slate-500 w-8">12</div></div>
  <div class="flex items-center gap-2"><div class="w-40 text-xs font-semibold text-slate-700 text-right">Gentrificación</div><div class="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden"><div class="bg-slate-300 h-4 rounded-full" style="width:20%"></div></div><div class="text-xs text-slate-500 w-8">12</div></div>
</div>
<p class="text-sm text-slate-700 mt-3">Fíjate en el orden: <strong>lo ambiental y el agua dominan</strong> — no la política. El empleo (el argumento pro más fuerte) aparece en sexto lugar. Y el "rumor de bancarrota" que 12 personas repitieron, lo buscamos en PACER y <strong>no encontramos filing público</strong>: rumor sin verificar, no récord.</p>
<p class="text-sm text-slate-600 mt-2">Un contraste que solo nosotros podemos medir: en el canal de utilidad del pueblo (el Veci, 787-417-7711, donde la gente busca plomeros, médicos y horarios), las menciones de Esencia son <strong>cero</strong>. El debate vive en el feed, no en la búsqueda: Esencia es, hasta ahora, un tema de identidad y no de necesidad diaria.</p>
<div class="not-prose bg-slate-50 border border-slate-200 rounded-xl p-3 mt-3 text-xs text-slate-500"><strong>Método y límites (léelos):</strong> esto NO es una encuesta científica. Son los comentarios públicos de UN post viral (abril 2026), clasificados a mano uno por uno. La audiencia de Facebook no representa a todo el mundo, y quien comenta suele sentir más fuerte que quien calla. Lo publicamos porque es lo único medido que existe — si alguien hace una encuesta seria, la enlazamos aquí con gusto.</div>

<h2 id="dueno">Quién es el dueño (registros públicos)</h2>
<p>Esto no es teoría: es lo que dicen los registros corporativos de Puerto Rico y del Reino Unido.</p>
<div class="not-prose bg-slate-50 border border-slate-200 rounded-2xl p-4 mt-3 font-mono text-xs sm:text-sm text-slate-700 leading-relaxed overflow-auto">
Reuben Brothers <span class="text-slate-400">(Londres, UK · David &amp; Simon Reuben)</span>
&nbsp;&nbsp;└─ Motcomb Estates Ltd <span class="text-slate-400">(UK Companies House #02373675)</span>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ <strong class="text-slate-900">Cabo Rojo Land Acquisition LLC</strong> <span class="text-slate-400">(PR #424893-1511 · formada 25 mar 2019)</span>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Presidente: Stephane Nahum — Millbank Tower, Londres
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Tesorera: Eileen Sawyer — Millbank Tower, Londres
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Agente registrado: CT Corporation System, San Juan
</div>
<p class="text-sm text-slate-600 mt-2">El socio operacional citado, <strong>Three Rules Capital</strong> (Will Bennett y Roberto Ruiz Vargas), no aparece incorporado en los registros públicos de Florida, Delaware ni Nueva York que se revisaron. Una compañía registrada en Puerto Rico, controlada por ejecutivos en Londres.</p>
<p class="text-xs text-slate-400 mt-1">Fuentes: <a href="https://rcp.estado.pr.gov/en/entity-information?c=424893-1511" target="_blank" rel="noopener" class="text-teal-700 underline">Registro del Depto. de Estado de PR ↗</a> · UK Companies House #02373675 · <a href="https://therealdeal.com/magazine/april-2025/meet-the-little-known-developer-behind-a-2b-reuben-brother-development/" target="_blank" rel="noopener" class="text-teal-700 underline">The Real Deal ↗</a></p>

<h2>El paquete fiscal: $498 millones</h2>
<p>Los créditos no salen del aire: salen de impuestos que paga el contribuyente. Para tener una vara de medir, <strong>$498M son unos 26 años del presupuesto completo del municipio de Cabo Rojo</strong> ($19.2M/año). Costo aproximado por contribuyente: <strong>~$413</strong>.</p>
<div class="not-prose mt-3 overflow-auto border border-slate-200 rounded-xl">
  <table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th class="py-2 px-3">Incentivo</th><th class="py-2 px-3">Beneficio</th><th class="py-2 px-3">Duración</th></tr></thead><tbody>
    <tr class="border-t border-slate-100"><td class="py-1.5 px-3">Créditos contributivos turísticos</td><td class="py-1.5 px-3 font-semibold">$498M (~40% de $1.244B elegible)</td><td class="py-1.5 px-3">—</td></tr>
    <tr class="border-t border-slate-100"><td class="py-1.5 px-3">Exención sobre ingresos</td><td class="py-1.5 px-3 font-semibold">90%</td><td class="py-1.5 px-3">10 años</td></tr>
    <tr class="border-t border-slate-100"><td class="py-1.5 px-3">Exención CRIM (propiedad)</td><td class="py-1.5 px-3 font-semibold">90%</td><td class="py-1.5 px-3">10 años</td></tr>
    <tr class="border-t border-slate-100"><td class="py-1.5 px-3">Exención patentes municipales</td><td class="py-1.5 px-3 font-semibold">90%</td><td class="py-1.5 px-3">10 años</td></tr>
    <tr class="border-t border-slate-100"><td class="py-1.5 px-3">Impuesto de construcción / IVU municipal</td><td class="py-1.5 px-3 font-semibold">Exento</td><td class="py-1.5 px-3">Construcción / operaciones</td></tr>
  </tbody></table>
</div>
<div class="not-prose grid grid-cols-2 gap-3 mt-3">
  <div class="bg-white border-2 border-amber-300 rounded-xl p-4 text-center"><div class="text-2xl font-black text-amber-600">~$69M</div><div class="text-xs text-slate-600 mt-1">que Cabo Rojo deja de cobrar en 10 años (~$6.9M/año)</div></div>
  <div class="bg-white border-2 border-slate-200 rounded-xl p-4 text-center"><div class="text-2xl font-black text-slate-900">~$1M</div><div class="text-xs text-slate-600 mt-1">costo por habitación vs. ~$273K promedio histórico en PR</div></div>
</div>
<p class="text-sm text-slate-700 mt-2">El decreto original es de diciembre de 2020 (Gov. Wanda Vázquez), enmendado en 2024 (Gov. Pierluisi), bajo la Ley 74 de 2010. Según el análisis del decreto, <strong>no hay cláusula de devolución</strong> si no se cumplen las metas de empleo.</p>
<p class="text-xs text-slate-400 mt-1">Fuente: <a href="https://periodismoinvestigativo.com/2025/10/esencia-proyecto-residencial-privilegios-contributivos-turisticos/" target="_blank" rel="noopener" class="text-teal-700 underline">CPI, octubre 2025 ↗</a></p>

<h2>Los empleos: la pregunta que falta</h2>
<p>El argumento más fuerte a favor es el empleo, y Cabo Rojo necesita trabajo — hay que tratarlo con respeto y con números. El proyecto promete <strong>2,000+ empleos</strong>. Dos preguntas sin contestar:</p>
<div class="not-prose grid sm:grid-cols-2 gap-3 mt-3">
  <div class="border border-slate-200 bg-white rounded-xl p-4"><div class="text-xs font-bold text-slate-700 uppercase">¿Cuánto pagan?</div><p class="text-sm text-slate-700 mt-1">En un resort de lujo comparable (Dorado Beach, Ritz-Carlton) un mesero gana <strong>$15.37/hora</strong> — ~$2,000 netos al mes. El costo de vida en Cabo Rojo ronda <strong>$1,574/mes</strong>. Sobran ~$416 para carro, ahorro y emergencias.</p></div>
  <div class="border border-slate-200 bg-white rounded-xl p-4"><div class="text-xs font-bold text-slate-700 uppercase">¿Y si no se crean?</div><p class="text-sm text-slate-700 mt-1">Según el análisis del decreto, <strong>no hay cláusula de cumplimiento de empleo</strong>. Si no se generan los 2,000 empleos, no se devuelven los créditos. La promesa y el incentivo no están amarrados.</p></div>
</div>
<p class="text-xs text-slate-400 mt-1">Fuentes: <a href="https://www.bls.gov/regions/northeast/news-release/occupationalemploymentandwages_sanjuan.htm" target="_blank" rel="noopener" class="text-teal-700 underline">BLS OEWS PR ↗</a> · Glassdoor Ritz-Carlton Dorado · CPI.</p>

<h2 id="agua">El agua</h2>
<p>El sistema PRASA del suroeste (Planta de Filtros Betances) sirve a <strong>~20,749 personas</strong> y arrastra <strong>3 violaciones activas</strong> en el récord federal de agua. Ese es el mismo sistema del que dependería Esencia, que necesitaría <strong>1.2 millones de galones diarios</strong> (según la página 89 de su propia Declaración de Impacto Ambiental). Según la denuncia llevada ante la ONU, ese consumo equivaldría a cerca del <strong>28% del suministro diario de agua de Cabo Rojo</strong>. Y la propia AAA le informó al expediente, el <strong>26 de septiembre de 2024</strong>, que la infraestructura actual de la Planta de Filtros Betances <strong>no puede suplir esa demanda</strong> y que harían falta mejoras significativas. Mientras tanto, vecinos del sector Las Palmas reportaron estar días sin agua.</p>
<p class="text-xs text-slate-400 mt-1">Fuentes: EPA (récord federal de agua) · reportes de prensa y de vecinos · <a href="https://news.un.org/es/story/2026/06/1541586" target="_blank" rel="noopener" class="text-teal-700 underline">Noticias ONU ↗</a> · <a href="https://mareaecologista.com/2025/04/cabo-rojo-el-proyecto-esencia-y-la-crisis-del-agua-en-el-suroeste/" target="_blank" rel="noopener" class="text-teal-700 underline">Marea Ecologista ↗</a>. Ver también <a href="/agua" class="text-teal-700 underline">el récord del agua en PRSF</a>.</p>

<h2>El historial de los desarrolladores</h2>
<p>El CPI documentó el rastro global de las empresas y personas vinculadas al proyecto en siete países. Esto es contexto verificable, no una acusación sobre Esencia:</p>
<div class="not-prose mt-3 overflow-auto border border-slate-200 rounded-xl">
  <table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th class="py-2 px-3">Lugar</th><th class="py-2 px-3">Vinculado a</th><th class="py-2 px-3">Documentado</th></tr></thead><tbody>
    <tr class="border-t border-slate-100"><td class="py-1.5 px-3">Waikiki, Hawái</td><td class="py-1.5 px-3">Bennett / PACREP LLC</td><td class="py-1.5 px-3">Edificio excedió zonificación; $100K+ en donaciones políticas</td></tr>
    <tr class="border-t border-slate-100"><td class="py-1.5 px-3">Los Cabos, México</td><td class="py-1.5 px-3">Bennett + Ruiz Vargas</td><td class="py-1.5 px-3">Daño a arrecifes de coral, alteración de playas</td></tr>
    <tr class="border-t border-slate-100"><td class="py-1.5 px-3">Ibiza, España</td><td class="py-1.5 px-3">Reuben Brothers</td><td class="py-1.5 px-3">5,000 residentes firmaron petición en contra</td></tr>
    <tr class="border-t border-slate-100"><td class="py-1.5 px-3">Mallorca, España</td><td class="py-1.5 px-3">Reuben Brothers</td><td class="py-1.5 px-3">Adquisición de ~20 km de costa</td></tr>
  </tbody></table>
</div>
<p class="text-xs text-slate-400 mt-1">Fuente: <a href="https://periodismoinvestigativo.com/2025/06/esencia-project-puerto-rico-environmental-damage/" target="_blank" rel="noopener" class="text-teal-700 underline">CPI, junio 2025 ↗</a> · <a href="https://ejatlas.org/conflict/esencia-project" target="_blank" rel="noopener" class="text-teal-700 underline">EJ Atlas ↗</a></p>

<h2>Las donaciones (registro del Contralor Electoral)</h2>
<p>Donar a campañas es legal. Se pone aquí porque es información pública y porque cualquiera tiene derecho a saber quién le dio a quién mientras se aprobaba un proyecto de este tamaño.</p>
<ul class="text-sm text-slate-700">
  <li><strong>Will Bennett</strong> donó $3,100 a: Thomas Rivera Schatz, Tatiana Pérez Ramírez, Ángel Matos, Jesús Manuel Ortiz.</li>
  <li><strong>Roberto Ruiz Vargas</strong> donó $3,100 a: Miguel Romero Lugo, Rivera Schatz, Tatiana Pérez, Ángel Matos, y al ex alcalde de Cabo Rojo Roberto Ramírez Kurtz.</li>
</ul>
<p class="text-sm text-slate-600 mt-1">El alcalde actual, Jorge Morales Wiscovitch, le dijo al CPI que <strong>no fue incluido</strong> en las negociaciones del decreto.</p>
<p class="text-xs text-slate-400 mt-1">Fuente: Oficina del Contralor Electoral (OCE), vía <a href="https://periodismoinvestigativo.com/2025/10/esencia-proyecto-residencial-privilegios-contributivos-turisticos/" target="_blank" rel="noopener" class="text-teal-700 underline">CPI ↗</a></p>

<h2 id="timeline">La línea de tiempo</h2>
<div class="not-prose flex flex-wrap gap-2 mb-1 text-xs">
  <span class="rounded-full px-2.5 py-0.5 border bg-amber-100 text-amber-800 border-amber-200 font-bold">Dinero</span>
  <span class="rounded-full px-2.5 py-0.5 border bg-slate-100 text-slate-700 border-slate-200 font-bold">Legal</span>
  <span class="rounded-full px-2.5 py-0.5 border bg-red-100 text-red-800 border-red-200 font-bold">Protesta</span>
  <span class="rounded-full px-2.5 py-0.5 border bg-emerald-100 text-emerald-800 border-emerald-200 font-bold">Ambiente</span>
</div>
${items || '<p class="text-sm text-slate-400 italic">Data no disponible ahora.</p>'}

<h2 id="video">En video: el panel</h2>
<p>Expertos y voces del país explicando el proyecto, cara a cara. Publicados en el canal de Cabo Rojo:</p>
<div class="not-prose flex flex-col gap-2 mt-3">
  <a href="https://youtu.be/Ahta7PZ4YNo" target="_blank" rel="noopener" class="block border border-slate-200 bg-white rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-teal-50 hover:border-teal-300 no-underline">▶ Senador E. Molina: falla geológica y riesgos del proyecto</a>
  <a href="https://youtu.be/NFeo3v07rHA" target="_blank" rel="noopener" class="block border border-slate-200 bg-white rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-teal-50 hover:border-teal-300 no-underline">▶ Luis García Pelatti: por qué la AAA y la AEE no contestan sobre agua y luz</a>
  <a href="https://youtu.be/6jlNJt87rDM" target="_blank" rel="noopener" class="block border border-slate-200 bg-white rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-teal-50 hover:border-teal-300 no-underline">▶ Dra. Dimaris Acosta Mercado: análisis científico del peligro ambiental</a>
  <a href="https://youtu.be/OoRZA-pWciU" target="_blank" rel="noopener" class="block border border-slate-200 bg-white rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-teal-50 hover:border-teal-300 no-underline">▶ Javier O. Torres: por qué la agricultura del suroeste está en riesgo</a>
  <a href="https://youtu.be/g0Aw5aD_rf4" target="_blank" rel="noopener" class="block border border-slate-200 bg-white rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-teal-50 hover:border-teal-300 no-underline">▶ Reniel Rodríguez Ramos: la amenaza a sitios arqueológicos</a>
</div>

<h2>Lo que falta — y lo que se pide por escrito</h2>
<p>Hay cosas que todavía no se saben. En vez de adivinar, se piden por escrito al amparo de la Ley 141-2019 de transparencia:</p>
<ul class="text-sm text-slate-700">
  <li><strong>DRNA:</strong> la Declaración de Impacto Ambiental completa y el estado del permiso de pozos privados.</li>
  <li><strong>AAA:</strong> la determinación oficial de capacidad de agua.</li>
  <li><strong>Compañía de Turismo:</strong> el decreto de exención, el análisis costo-beneficio y las cláusulas de cumplimiento.</li>
  <li><strong>Contralor Electoral:</strong> el registro completo de donaciones relacionadas.</li>
  <li><strong>Senado:</strong> las dos investigaciones aprobadas el 31 de marzo de 2026.</li>
</ul>
<p class="text-sm text-slate-600 mt-1">Cuando respondan, se publica lo que digan — diga lo que diga.</p>

<h2 id="cuenta">La cuenta completa: lo que el pueblo pone y lo que recibe</h2>
<p>Nadie ha puesto en una sola cuenta lo que Cabo Rojo entrega y lo que recibe si Esencia va como está. Y no solo en dinero. En las tres cosas que no se reponen: <strong>dinero, agua y basura</strong>. Aquí está, con la fuente al lado. No dice sí ni no. Dice cuánto está en juego.</p>

<div class="not-prose mt-4 space-y-3">
  <div class="border border-slate-200 rounded-2xl overflow-hidden">
    <div class="bg-slate-900 text-white px-4 py-2 text-sm font-black uppercase tracking-wide">💰 Dinero · a 10 años</div>
    <div class="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
      <div class="p-4">
        <div class="text-xs font-bold text-red-700 uppercase">El pueblo pone</div>
        <ul class="text-sm text-slate-700 mt-1 space-y-1">
          <li>$498M en créditos contributivos del estado</li>
          <li>$69M que el municipio deja de cobrar (CRIM y patentes, 90% por 10 años)</li>
          <li class="font-bold text-slate-900">= ~$567 millones de subsidio público</li>
        </ul>
      </div>
      <div class="p-4">
        <div class="text-xs font-bold text-emerald-700 uppercase">El pueblo recibe (si todo sale como se promete)</div>
        <ul class="text-sm text-slate-700 mt-1 space-y-1">
          <li>2,000 empleos prometidos, sin cláusula: si no se crean, no se devuelve nada</li>
          <li>A $15.37/hora, sobran ~$416 al mes por empleado</li>
        </ul>
      </div>
    </div>
    <div class="bg-amber-50 border-t border-amber-200 px-4 py-2 text-sm text-slate-700"><strong>El número que nadie ha mostrado:</strong> repartido entre las ~1,652 unidades, cada casa o cuarto de lujo lleva <strong>~$343,000 de subsidio público</strong> (solo contando créditos estatales y exenciones municipales). Un planificador, en vista pública, lo estimó en más de $1 millón por unidad, y señaló que el subsidio supera la inversión que los propios desarrolladores dicen que harán.</div>
  </div>


  <div class="border-2 border-teal-300 rounded-2xl overflow-hidden">
    <div class="bg-teal-700 text-white px-4 py-2 text-sm font-black uppercase tracking-wide">👛 ¿Y esto qué significa pa' TU bolsillo?</div>
    <div class="p-4 text-sm text-slate-700 space-y-2">
      <p>Los millones no se sienten. Vamos a bajarlos a tu escala:</p>
      <ul class="space-y-2">
        <li><strong>$413 por contribuyente.</strong> Los $498M en créditos salen de impuestos que pagamos todos: tocan a ~$413 por cada persona que radica planilla en PR (cálculo CPI).</li>
        <li><strong>$146 al año por cada caborrojeño, por 10 años.</strong> Los $69M que el municipio deja de cobrar, repartidos entre los 47,158 residentes. No es que te lo cobren a ti directo: es lo que deja de entrar a la caja que paga lo tuyo.</li>
        <li><strong>De cada $3 del presupuesto del pueblo, $1.</strong> La exención equivale al 36% del presupuesto anual de Cabo Rojo ($19.2M). El CRIM y las patentes pagan el recogido de basura, las calles, el alumbrado y la policía municipal: los servicios que TÚ usas correrán 10 años sin ese tercio que el proyecto habría aportado.</li>
        <li><strong>Qué compraban esos $69M:</strong> ~35 años de policía municipal, o la reconstrucción total de las calles, o una década completa de recogido de basura (análisis sobre cifras CPI).</li>
        <li><strong>Y la vuelta que nadie te explicó:</strong> si el proyecto sube el valor de las propiedades de la zona, el CRIM puede retasar la TUYA. O sea: el proyecto paga 90% menos por 10 años, y el vecino de toda la vida puede terminar pagando MÁS. (Punto levantado en vista pública; el fact-check formal está pedido por escrito.)</li>
      </ul>
      <p class="text-slate-600">Esto no dice "no al proyecto". Dice: sin cláusulas amarradas, la certeza se la lleva el proyecto y el riesgo lo carga el residente. Por eso importan las <a href="#cuenta" class="text-teal-700 font-semibold">palancas de la calculadora</a>.</p>
    </div>
  </div>

  <div class="border border-slate-200 rounded-2xl overflow-hidden">
    <div class="bg-slate-900 text-white px-4 py-2 text-sm font-black uppercase tracking-wide">💧 Agua</div>
    <div class="p-4 text-sm text-slate-700 space-y-1">
      <p>El proyecto pide <strong>1.2 millones de galones al día</strong> (página 89 de su propia Declaración de Impacto Ambiental), cerca del <strong>28% del suministro diario</strong> de Cabo Rojo (denuncia ante la ONU).</p>
      <p>La propia AAA le informó al expediente, el <strong>26 de septiembre de 2024</strong>, que la infraestructura actual de la Planta de Filtros Betances <strong>no puede suplir esa demanda</strong>. El mismo sistema ya arrastra 3 violaciones federales activas y vecinos que pasan días sin agua.</p>
    </div>
    <div class="bg-amber-50 border-t border-amber-200 px-4 py-2 text-sm text-slate-700"><strong>El desperdicio:</strong> agua que, según la agencia, hoy no alcanza, comprometida a un uso privado antes de resolver la del vecino de toda la vida.</div>
  </div>

  <div class="border border-slate-200 rounded-2xl overflow-hidden">
    <div class="bg-slate-900 text-white px-4 py-2 text-sm font-black uppercase tracking-wide">🗑️ Basura</div>
    <div class="p-4 text-sm text-slate-700 space-y-1">
      <p>El desarrollo (1,132 residencias + 520 unidades de hotel) le sumaría, según estimado en vista pública, <strong>más de 30 toneladas de basura al día</strong> a la celda del vertedero municipal.</p>
      <p>Esa celda (construida en 2020 con un préstamo de $2.2M, vida útil de ~10 años) se llena cerca de <strong>2030</strong>. La basura extra le quita entre <strong>2 y 4 años</strong> de vida. Y Puerto Rico está cerrando 7 vertederos, redirigiendo basura al sur.</p>
    </div>
    <div class="bg-amber-50 border-t border-amber-200 px-4 py-2 text-sm text-slate-700"><strong>El desperdicio:</strong> años de vertedero público, que paga el vecino, consumidos por un desarrollo que no paga por la capacidad que usa. Sin plan B después de 2030.</div>
  </div>
</div>

<h3 class="mt-6">La calculadora de palancas</h3>
<p>El proyecto como está deja casi todo en la columna roja. Prende cada palanca y mira cuánto del desperdicio se recupera. Nada de esto mata el proyecto: lo hace pagar por lo que usa. (Cada palanca mueve un número verificado, no un supuesto.)</p>

<div class="not-prose mt-3" id="cuenta-calc">
  <div class="grid grid-cols-3 gap-2 mb-3">
    <div class="bg-slate-900 rounded-xl p-3 text-center">
      <div class="text-[10px] uppercase tracking-wide text-teal-300 font-bold">Dinero público protegido</div>
      <div class="text-lg sm:text-2xl font-black text-white" data-meter="dinero">$0M</div>
      <div class="text-[10px] text-slate-400">de $567M</div>
    </div>
    <div class="bg-slate-900 rounded-xl p-3 text-center">
      <div class="text-[10px] uppercase tracking-wide text-teal-300 font-bold">Agua del pueblo</div>
      <div class="text-base sm:text-xl font-black text-white" data-meter="agua">Comprometida</div>
      <div class="text-[10px] text-slate-400">1.2M gal/día</div>
    </div>
    <div class="bg-slate-900 rounded-xl p-3 text-center">
      <div class="text-[10px] uppercase tracking-wide text-teal-300 font-bold">Vertedero</div>
      <div class="text-base sm:text-xl font-black text-white" data-meter="basura">-2 a 4 años</div>
      <div class="text-[10px] text-slate-400">se llena ~2030</div>
    </div>
  </div>

  <div class="space-y-2">
    <button type="button" data-lever="empleo" aria-pressed="false" class="lever w-full text-left border border-slate-200 rounded-xl p-3 hover:border-teal-300 flex items-start gap-3 bg-white">
      <span class="dot text-lg leading-none text-slate-300 mt-0.5">○</span>
      <span><span class="font-bold text-sm text-slate-800">Cláusula de empleo amarrada</span><span class="block text-xs text-slate-500">Si no crea los empleos prometidos, devuelve los créditos. Protege hasta <strong>$498M</strong>.</span></span>
    </button>
    <button type="button" data-lever="municipal" aria-pressed="false" class="lever w-full text-left border border-slate-200 rounded-xl p-3 hover:border-teal-300 flex items-start gap-3 bg-white">
      <span class="dot text-lg leading-none text-slate-300 mt-0.5">○</span>
      <span><span class="font-bold text-sm text-slate-800">Participación municipal en los ingresos</span><span class="block text-xs text-slate-500">Que Cabo Rojo cobre una parte, no solo mire. Recupera hasta <strong>$69M</strong> en 10 años.</span></span>
    </button>
    <button type="button" data-lever="agua" aria-pressed="false" class="lever w-full text-left border border-slate-200 rounded-xl p-3 hover:border-teal-300 flex items-start gap-3 bg-white">
      <span class="dot text-lg leading-none text-slate-300 mt-0.5">○</span>
      <span><span class="font-bold text-sm text-slate-800">Que pague su propia agua</span><span class="block text-xs text-slate-500">Fuente propia y probada, para no quitarle <strong>1.2M galones/día</strong> al sistema del pueblo.</span></span>
    </button>
    <button type="button" data-lever="basura" aria-pressed="false" class="lever w-full text-left border border-slate-200 rounded-xl p-3 hover:border-teal-300 flex items-start gap-3 bg-white">
      <span class="dot text-lg leading-none text-slate-300 mt-0.5">○</span>
      <span><span class="font-bold text-sm text-slate-800">Que pague su propia basura</span><span class="block text-xs text-slate-500">Disposición propia, para salvar los <strong>2 a 4 años</strong> de vertedero que hoy le quita al pueblo.</span></span>
    </button>
  </div>

  <p class="text-sm text-slate-700 mt-3 font-semibold" data-summary>Proyecto como está: $0 protegido, el agua comprometida, y 2 a 4 años menos de vertedero. Prende las palancas.</p>
  <p class="text-xs text-slate-400 mt-1">Además, un piso de contratación y compra local (por ejemplo 30%) mantendría más del dinero en el pueblo. No lo calculamos aquí porque el monto total de inversión no es público.</p>
</div>
<script>
(function(){
  var root=document.getElementById('cuenta-calc');
  if(!root)return;
  var state={empleo:false,municipal:false,agua:false,basura:false};
  function render(){
    var dinero=(state.empleo?498:0)+(state.municipal?69:0);
    var mD=root.querySelector('[data-meter="dinero"]');
    var mA=root.querySelector('[data-meter="agua"]');
    var mB=root.querySelector('[data-meter="basura"]');
    mD.textContent='$'+dinero+'M';
    mD.classList.toggle('text-emerald-300',dinero>0);
    mD.classList.toggle('text-white',dinero===0);
    mA.textContent=state.agua?'Protegida':'Comprometida';
    mA.classList.toggle('text-emerald-300',state.agua);
    mA.classList.toggle('text-white',!state.agua);
    mB.textContent=state.basura?'+2 a 4 años':'-2 a 4 años';
    mB.classList.toggle('text-emerald-300',state.basura);
    mB.classList.toggle('text-white',!state.basura);
    var count=0;
    root.querySelectorAll('[data-lever]').forEach(function(b){
      var on=state[b.getAttribute('data-lever')];
      if(on)count++;
      b.setAttribute('aria-pressed',on?'true':'false');
      b.classList.toggle('border-teal-400',on);
      b.classList.toggle('bg-teal-50',on);
      b.classList.toggle('bg-white',!on);
      var dot=b.querySelector('.dot');
      dot.textContent=on?'●':'○';
      dot.classList.toggle('text-teal-600',on);
      dot.classList.toggle('text-slate-300',!on);
    });
    var sum=root.querySelector('[data-summary]');
    if(count===0){sum.textContent='Proyecto como está: $0 protegido, el agua comprometida, y 2 a 4 años menos de vertedero. Prende las palancas.';}
    else if(count===4){sum.textContent='Con las 4 palancas: hasta $567M dejan de ser regalo, el agua del pueblo queda protegida, y el vertedero a salvo. El proyecto sigue. Solo paga por lo que usa.';}
    else{sum.textContent='Vas '+count+' de 4. Préndelas todas para ver la cuenta completa voltearse.';}
  }
  root.querySelectorAll('[data-lever]').forEach(function(b){
    b.addEventListener('click',function(){var k=b.getAttribute('data-lever');state[k]=!state[k];render();});
  });
  render();
})();
</script>
<p class="text-xs text-slate-400 mt-2">Cálculo de PuertoRicoSinFiltros.com sobre datos verificados: créditos y presupuesto (CPI), agua (DIA p.89 y carta de la AAA del 26 sept 2024 en el expediente), basura (testimonio en vista pública y registros del préstamo del vertedero). La cifra de subsidio por unidad es una división simple del subsidio público conocido entre las unidades propuestas; el estimado de más de $1M por unidad es del deponente en vista pública. Los escenarios de empleo asumen que las promesas se cumplen.</p>


<h2>Qué protege cada quien</h2>
<p>Nadie es el villano de su propia historia. Antes de decidir qué piensas, ayuda ver qué protege cada parte. Todos defienden algo legítimo. Aquí no decimos quién tiene la razón: mostramos qué está en juego para cada quien, para que te ubiques tú y entiendas al que piensa distinto.</p>
<div class="not-prose mt-3 overflow-auto border border-slate-200 rounded-xl">
  <table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th class="py-2 px-3">Quién</th><th class="py-2 px-3">Qué protege</th><th class="py-2 px-3">Su verdad legítima</th></tr></thead><tbody>
    <tr class="border-t border-slate-100"><td class="py-1.5 px-3 font-semibold text-slate-800">Los desarrolladores</td><td class="py-1.5 px-3">El retorno de una apuesta de ~$2,000M, los créditos y el permiso</td><td class="py-1.5 px-3 text-slate-600">Pusieron capital que ningún local puso</td></tr>
    <tr class="border-t border-slate-100"><td class="py-1.5 px-3 font-semibold text-slate-800">El gobierno estatal</td><td class="py-1.5 px-3">La narrativa de inversión y empleos, y el marco de incentivos</td><td class="py-1.5 px-3 text-slate-600">El país necesita actividad económica y base contributiva</td></tr>
    <tr class="border-t border-slate-100"><td class="py-1.5 px-3 font-semibold text-slate-800">El municipio</td><td class="py-1.5 px-3">El agua, la posición fiscal del pueblo</td><td class="py-1.5 px-3 text-slate-600">Quiere los empleos y el CRIM, pero no lo sentaron a negociar</td></tr>
    <tr class="border-t border-slate-100"><td class="py-1.5 px-3 font-semibold text-slate-800">Los vecinos que se oponen</td><td class="py-1.5 px-3">El acuífero, la costa, el carácter del pueblo, contra el desplazamiento</td><td class="py-1.5 px-3 text-slate-600">No quieren pagar en agua, taxes y acceso por créditos que van a Londres</td></tr>
    <tr class="border-t border-slate-100"><td class="py-1.5 px-3 font-semibold text-slate-800">Los vecinos que lo apoyan</td><td class="py-1.5 px-3">La oportunidad de un trabajo digno, ahora</td><td class="py-1.5 px-3 text-slate-600">La precariedad económica es real, no abstracta</td></tr>
    <tr class="border-t border-slate-100"><td class="py-1.5 px-3 font-semibold text-slate-800">La diáspora</td><td class="py-1.5 px-3">El pueblo que todavía llaman casa, la memoria</td><td class="py-1.5 px-3 text-slate-600">No quieren que se venda lo que dejaron</td></tr>
    <tr class="border-t border-slate-100"><td class="py-1.5 px-3 font-semibold text-slate-800">Los financiadores</td><td class="py-1.5 px-3">Reputación y retorno</td><td class="py-1.5 px-3 text-slate-600">Financiar algo rentable sin volverse el malo</td></tr>
  </tbody></table>
</div>

<h2 id="escenarios">Los caminos posibles</h2>
<p>Nadie sabe cómo termina. Pero el récord sí marca por dónde puede ir. Y el punto que lo decide casi todo no son las marchas: <strong>es el agua.</strong> El endoso del alcalde ya está condicionado a que el proyecto tenga su propia agua, la AAA no ha certificado capacidad, y el sistema del suroeste ya sirve a ~20,749 personas con 3 violaciones activas.</p>
<div class="not-prose grid gap-3 mt-4">
  <div class="border-l-4 border-emerald-400 bg-emerald-50/40 rounded-r-xl p-4">
    <div class="text-xs font-bold text-emerald-700 uppercase tracking-wide">🟢 El proyecto se dobla</div>
    <p class="text-sm text-slate-700 mt-1">Las 46 condiciones de la DIA, el muro del agua y la presión reputacional sobre los financiadores obligan a un proyecto más pequeño o reestructurado: fuente de agua propia <em>probada</em> (no promesa), acceso público a la costa garantizado, piso salarial y contratación local real, y participación municipal negociada. La oposición amarra condiciones en vez de quedarse en un sí o un no.</p>
  </div>
  <div class="border-l-4 border-red-400 bg-red-50/40 rounded-r-xl p-4">
    <div class="text-xs font-bold text-red-700 uppercase tracking-wide">🔴 Se construye casi como está</div>
    <p class="text-sm text-slate-700 mt-1">El proyecto avanza sobre la DIA aprobada y el decreto ya firmado. Las condiciones se cumplen en papel (el municipio fiscaliza, pero no tiene ni el estudio ni la capacidad). El agua sale de pozos privados que le compiten al acuífero del pueblo. Los ~$69M municipales no entran, los 2,000 empleos van sin cláusula, y el CRIM retasa a los vecinos de al lado.</p>
  </div>
  <div class="border-l-4 border-amber-400 bg-amber-50 rounded-r-xl p-4">
    <div class="flex items-center justify-between gap-2 flex-wrap"><div class="text-xs font-bold text-amber-700 uppercase tracking-wide">🟡 Limbo largo</div><span class="text-[10px] font-black uppercase tracking-wider bg-amber-600 text-white rounded-full px-2 py-0.5">El más probable hoy</span></div>
    <p class="text-sm text-slate-700 mt-1">Los pleitos (deslinde, la notificación defectuosa del DRNA), las dos investigaciones del Senado y las apelaciones de permisos lo estiran por años. Ni muere ni se construye pronto. El capital espera. El desenlace lo deciden dos cosas concretas: si la AAA y el DRNA certifican el agua, y si la oposición se mueve de la plaza a la vista de permiso.</p>
  </div>
</div>
<p class="text-sm text-slate-600 mt-3"><strong>Por qué el amarillo es el más probable hoy:</strong> la DIA ya está aprobada, el capital no tiene prisa, y el agua sigue sin resolverse en el récord. El limbo favorece a quien puede esperar. Se mueve hacia el verde solo cuando el récord del agua se pone tan claro que la vista de permiso no lo puede ignorar. Ese récord es lo que esta página organiza.</p>
<p class="text-xs text-slate-400 mt-1">Estos escenarios son lectura del récord público, no predicción ni recomendación. La data que los sostiene está arriba, con la fuente al lado.</p>

<h2 id="lados">Escucha a los dos lados, directo</h2>
<p>Este récord organiza los hechos con su fuente. Pero cada bando también habla por su cuenta, y tienes derecho a oírlos sin intermediario. Antes de formar opinión, léelos a los dos en sus propias palabras, no en las nuestras:</p>
<div class="not-prose grid sm:grid-cols-2 gap-3 mt-3">
  <div class="border-l-4 border-emerald-400 bg-white rounded-r-xl p-4">
    <div class="text-xs font-bold text-emerald-700 uppercase tracking-wide">A favor del proyecto</div>
    <p class="text-sm text-slate-700 mt-1"><strong>Conoce la Verdad</strong> es la campaña que defiende a Esencia como un "desarrollo responsable y ecoamigable", con acceso público a la playa y motor económico para el pueblo.</p>
    <a href="https://www.conocelaverdad.com" target="_blank" rel="noopener" class="inline-block mt-2 text-teal-700 text-sm underline font-semibold">conocelaverdad.com ↗</a>
  </div>
  <div class="border-l-4 border-red-400 bg-white rounded-r-xl p-4">
    <div class="text-xs font-bold text-red-700 uppercase tracking-wide">En contra del proyecto</div>
    <p class="text-sm text-slate-700 mt-1"><strong>Defiende a Cabo Rojo</strong> es la coalición de decenas de organizaciones que rechaza el proyecto por el agua, la costa y el impacto ambiental.</p>
    <a href="https://defiendeacaborojo.org" target="_blank" rel="noopener" class="inline-block mt-2 text-teal-700 text-sm underline font-semibold">defiendeacaborojo.org ↗</a>
  </div>
</div>
<p class="text-xs text-slate-400 mt-2">PuertoRicoSinFiltros.com no está afiliado a ninguno de los dos. Los ponemos lado a lado para que compares tú, no para empujarte a un lado.</p>

<h2>El expediente es público</h2>
<p>Casi todo el papeleo de Esencia está disponible para quien lo quiera leer. Si alguien te dice algo, puedes ir a la fuente y verificarlo tú mismo:</p>
<ul class="text-sm text-slate-700">
  <li>La <strong>Declaración de Impacto Ambiental</strong> aprobada por OGPe (16 tomos) y el informe de su vista pública.</li>
  <li>Los <strong>comentarios y recomendaciones del DRNA</strong> sobre la DIA.</li>
  <li>Las <strong>resoluciones de investigación del Senado</strong> sobre el proyecto.</li>
  <li>La respuesta del <strong>Servicio Federal de Pesca y Vida Silvestre (USFWS)</strong> a la solicitud de designación de proyecto estratégico.</li>
</ul>
<p class="text-xs text-slate-400 mt-1">El expediente ambiental del gobierno vive en <a href="https://docs.pr.gov" target="_blank" rel="noopener" class="text-teal-700 underline">docs.pr.gov</a>. La coalición Defiende a Cabo Rojo también mantiene un repositorio público de estos documentos en <a href="https://defiendeacaborojo.org" target="_blank" rel="noopener" class="text-teal-700 underline">defiendeacaborojo.org</a>.</p>

<div class="not-prose bg-amber-50 border border-amber-200 rounded-xl p-4 mt-6 text-sm text-slate-700"><strong>Nota:</strong> cada punto de esta página viene de una fuente pública citada (Centro de Periodismo Investigativo, prensa, BLS, EPA, UK Companies House, registros del DRNA, de la OCE y del Departamento de Estado). PuertoRicoSinFiltros.com no toma posición sobre el proyecto: organiza el récord para que cualquiera — vecino, periodista, funcionario — pueda verlo completo y en orden.</div>

<div class="not-prose border-2 border-slate-800 rounded-2xl p-5 sm:p-6 mt-6 bg-white">
<div class="text-xs uppercase tracking-widest text-slate-500 font-bold">Una nota del editor · sin filtro</div>
<p class="text-sm text-slate-500 mt-1">Hasta aquí, el récord: dato con fuente, sin posición. Lo que sigue es distinto. Es lo que yo quiero para Cabo Rojo. No es dato, es opinión. La marco para que la separes.</p>
<div class="mt-3 text-slate-800 leading-relaxed space-y-3">
<p>El Cabo Rojo que quiero no es uno sin desarrollo. Es uno donde el desarrollo no me cueste el agua, la costa, ni al vecino de toda la vida.</p>
<p>Donde si alguien apuesta $2,000 millones, el pueblo también gane, no solo mire de lejos. Donde en el 2045 pueda caminar con mi hijo hasta el Faro y que el agua salga de la pluma.</p>
<p>No estoy en contra de que Cabo Rojo crezca. Estoy en contra de que crezca para otro y le pase la cuenta a los míos.</p>
<p class="text-slate-600">Y si tú lo ves distinto, está bien. Este pueblo es de todos, y por eso pongo el récord: para que decidas tú, no yo.</p>
</div>
<p class="text-sm font-semibold text-slate-800 mt-4">- Angel, desde Cabo Rojo</p>
</div>


<p class="text-sm text-slate-500 mt-5">Fuentes primarias: <a href="https://periodismoinvestigativo.com/2025/10/esencia-proyecto-residencial-privilegios-contributivos-turisticos/" target="_blank" rel="noopener" class="text-teal-700">CPI — créditos contributivos</a> · <a href="https://periodismoinvestigativo.com/2025/06/esencia-project-puerto-rico-environmental-damage/" target="_blank" rel="noopener" class="text-teal-700">CPI — historial global</a> · <a href="https://periodismoinvestigativo.com/2025/03/esencia-project-cabo-rojo-hearings/" target="_blank" rel="noopener" class="text-teal-700">CPI — inversionistas</a> · <a href="https://www.metro.pr/noticias/2026/03/28/miles-protestan-en-el-viejo-san-juan-contra-proyecto-esencia-en-cabo-rojo/" target="_blank" rel="noopener" class="text-teal-700">Metro PR</a> · <a href="https://therealdeal.com/magazine/april-2025/meet-the-little-known-developer-behind-a-2b-reuben-brother-development/" target="_blank" rel="noopener" class="text-teal-700">The Real Deal</a>. ¿Ves un error o falta un hito? <a href="mailto:angel@angelanderson.com" class="text-teal-700">escríbenos</a>. Actualizado julio 2026.</p>
`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: 'Línea de tiempo del proyecto Esencia en Cabo Rojo',
    description: 'Cronología pública y con fuente del proyecto de desarrollo Esencia en Cabo Rojo: decretos contributivos, investigaciones del CPI, medidas del Senado y protestas.',
    creator: { '@type': 'Person', name: 'Angel Anderson' },
    publisher: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' },
    isAccessibleForFree: true, inLanguage: 'es', url: 'https://puertoricosinfiltros.com/esencia',
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: 'El proyecto Esencia en Cabo Rojo — la línea de tiempo pública, con fuente',
    description: 'La cronología pública del proyecto Esencia en Cabo Rojo: $498M en créditos contributivos, investigaciones del CPI, medidas del Senado, protestas. Sin opinión, con la fuente al lado.',
    slug: 'esencia', bodyHtml: body, jsonLd, ogImage: 'https://puertoricosinfiltros.com/api/og?theme=sinfiltros&t=El%20proyecto%20Esencia%2C%20sin%20filtros&k=EL%20R%C3%89CORD%20COMPLETO&sub=%24498M%20en%20cr%C3%A9ditos%20%C2%B7%20la%20AAA%20dice%20que%20el%20agua%20no%20da%20%C2%B7%20la%20cuenta%20completa%2C%20con%20calculadora',
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
  }))
}

// /sigue-el-dinero — quién recibió los fondos de recuperación de PR (USASpending × FEMA). El moat: seguir la plata.
async function handleSigueElDinero(req: any, res: any) {
  let rows: any[] = []
  try {
    const { data } = await supabase.from('pr_contratos_federales').select('recipient,monto_total,origen,municipio_hq,verificalo').ilike('categoria', '%contratista%').order('monto_total', { ascending: false }).limit(25)
    rows = data || []
  } catch (_) { /* empty */ }
  const esPR = (o: string) => /^PR/i.test(String(o || ''))
  const totalC = rows.reduce((a: number, r: any) => a + Number(r.monto_total || 0), 0)
  const totalPR = rows.filter((r: any) => esPR(r.origen)).reduce((a: number, r: any) => a + Number(r.monto_total || 0), 0)
  const pctFuera = totalC ? Math.round(((totalC - totalPR) / totalC) * 100) : 0
  const money = (x: number) => '$' + Number(x || 0).toLocaleString('en-US')
  const mill = (x: number) => '$' + (Number(x || 0) / 1e6).toFixed(0) + 'M'
  const rowHtml = rows.map((r: any) => `<tr class="border-t border-slate-100 ${esPR(r.origen) ? 'bg-teal-50/40' : ''}">
      <td class="py-1.5 px-3 font-semibold text-slate-800">${escapeHtml(r.recipient)}${r.verificalo ? ` <a href="${escapeHtml(r.verificalo)}" target="_blank" rel="noopener" class="text-teal-700 text-xs underline">↗</a>` : ''}</td>
      <td class="py-1.5 px-3 text-right font-bold text-slate-900">${mill(r.monto_total)}</td>
      <td class="py-1.5 px-3 text-xs ${esPR(r.origen) ? 'text-teal-700 font-semibold' : 'text-slate-500'}">${escapeHtml(r.municipio_hq || r.origen || '')}</td>
    </tr>`).join('')
  const body = `
<h1>Sigue el dinero: ¿quién se llevó la recuperación?</h1>
<p class="text-lg text-slate-600 mt-2">Puerto Rico recibió miles de millones para reconstruirse tras los huracanes. La pregunta que casi nadie hace con nombres: <strong>¿a quién se los pagaron?</strong> Rastreamos los contratos federales de recuperación por recipiente.</p>

<div class="not-prose mt-5 bg-white border border-slate-200 rounded-2xl p-4">
  <div class="flex items-start gap-3">
    <div class="text-2xl leading-none">🎧</div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-bold text-slate-800 m-0">Escúchalo en vez de leerlo</p>
      <p class="text-xs text-slate-500 mt-0.5 mb-2">Análisis en audio (es-419). Ponlo mientras guías.</p>
      <audio controls preload="none" class="w-full" src="https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/podcast/prsf/sigue-el-dinero.m4a">Tu navegador no puede reproducir el audio. <a href="https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/podcast/prsf/sigue-el-dinero.m4a" class="text-teal-700 font-semibold">Descárgalo</a>.</audio>
    </div>
  </div>
</div>

<div class="not-prose mt-5 bg-slate-900 text-white rounded-2xl p-5">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">El hallazgo</p>
  <p class="text-xl sm:text-2xl font-black mt-1 leading-snug">De cada dólar de contrato de recuperación que rastreamos, unos ${pctFuera} centavos salieron de Puerto Rico hacia el mainland.</p>
  <p class="text-slate-300 mt-2 text-sm">Los contratos grandes de "recovery services" — asesorar, inspeccionar, gestionar cómo gastar el dinero de FEMA — se los llevaron firmas de Colorado, California, Virginia y Maryland. Solo una fracción quedó con empresas boricuas.</p>
</div>

<div class="not-prose grid grid-cols-2 gap-3 mt-5">
  <div class="bg-white border-2 border-red-300 rounded-xl p-4 text-center"><div class="text-3xl font-black text-red-600">${pctFuera}%</div><div class="text-xs text-slate-600 mt-1">de los contratos rastreados fue a firmas de afuera de PR</div></div>
  <div class="bg-white border-2 border-teal-200 rounded-xl p-4 text-center"><div class="text-3xl font-black text-teal-700">${100 - pctFuera}%</div><div class="text-xs text-slate-600 mt-1">quedó con empresas boricuas</div></div>
</div>
<p class="text-xs text-slate-500 mt-2">*Esto es solo el flujo de contratos de emergencia de FEMA. La vivienda va por otra tubería (abajo).</p>

<h2>Dos flujos, dos historias</h2>
<p>El dinero de recuperación de PR corre por dos tuberías muy distintas — y confundirlas engaña:</p>
<div class="not-prose grid sm:grid-cols-2 gap-3 mt-3">
  <div class="border-2 border-red-200 bg-red-50/40 rounded-xl p-4">
    <div class="text-xs font-bold text-red-700 uppercase">Flujo 1 · Emergencia (FEMA)</div>
    <p class="text-sm text-slate-700 mt-1">Los contratos de gestión e ingeniería de la respuesta al desastre. Mercado especializado donde ~${pctFuera}% fue a firmas del mainland (la tabla de abajo).</p>
  </div>
  <div class="border-2 border-teal-200 bg-teal-50/40 rounded-xl p-4">
    <div class="text-xs font-bold text-teal-700 uppercase">Flujo 2 · Vivienda (HUD CDBG-DR)</div>
    <p class="text-sm text-slate-700 mt-1"><strong>~$20.8 mil millones</strong> los administra el propio gobierno de PR (Depto. de la Vivienda) como grantee. 100% boricua en el papel. Aquí la pregunta no es de dónde es la empresa, sino <strong>cuánto llegó de verdad a las familias</strong>: el CDBG-DR es famoso por lo lento que baja.</p>
  </div>
</div>
<p class="text-sm text-slate-600 mt-2">La ejecución real (lo gastado, no solo lo asignado) vive en <a href="https://cdbg-dr.pr.gov" target="_blank" rel="noopener" class="text-teal-700 font-semibold">cdbg-dr.pr.gov ↗</a> y el sistema DRGR de HUD. USASpending muestra lo asignado, no lo desembolsado.</p>

<h2>El caso más crudo</h2>
<p><strong>CH2M Hill – CDM</strong> (Denver, Colorado) se llevó sola <strong>$238 millones</strong> en servicios "PA-TAC" — es decir, en <em>asesorar</em> sobre cómo gastar el dinero de FEMA. Sumando las firmas de ingeniería y consultoría de afuera (CDM, AECOM, WSP, Fluor), más de <strong>$700 millones</strong> se fueron en gestión y consultoría, no en obra física.</p>

<h2>La calculadora: ¿cuánto se hubiera quedado?</h2>
<p>Esos $700 millones se fueron en gestión y consultoría a firmas de afuera. Mueve la barra y mira cuánto se hubiera quedado en Puerto Rico con un piso de subcontratación local en esos contratos.</p>
<div class="not-prose mt-3" id="fuga-calc">
  <div class="bg-slate-900 rounded-2xl p-5 text-center">
    <div class="text-xs uppercase tracking-widest text-teal-300 font-bold">Se queda en Puerto Rico</div>
    <div class="text-3xl sm:text-4xl font-black text-white" data-out>$0</div>
    <div class="text-xs text-slate-400 mt-1" data-outsub>de los $700M que se fueron · piso de subcontratación local: 0%</div>
  </div>
  <input type="range" min="0" max="50" value="0" step="5" data-slider aria-label="Piso de subcontratación local" class="w-full mt-4 accent-teal-600">
  <div class="flex justify-between text-xs text-slate-400 px-1"><span>0%</span><span>25%</span><span>50%</span></div>
  <p class="text-sm text-slate-600 mt-3" data-msg>Como pasó: casi todo se fue. Mueve la barra para ver cuánto se pudo quedar.</p>
</div>
<p class="text-sm text-slate-700 mt-3"><strong>Y esta palanca está viva:</strong> el HUD CDBG-DR (~$20.8 mil millones) todavía está bajando. Exigir ese piso de subcontratación local en lo que falta por gastar es donde de verdad se decide. No pide fondos nuevos. Pide una condición.</p>
<p class="text-xs text-slate-400 mt-1">Cálculo de PuertoRicoSinFiltros.com sobre la cifra verificada de más de $700M en gestión y consultoría que salieron de la isla (USASpending × FEMA). Es una regla de tres simple sobre ese pote, para dimensionar la palanca, no una proyección de contratos futuros.</p>
<script>
(function(){
  var root=document.getElementById('fuga-calc');
  if(!root)return;
  var slider=root.querySelector('[data-slider]');
  var out=root.querySelector('[data-out]');
  var sub=root.querySelector('[data-outsub]');
  var msg=root.querySelector('[data-msg]');
  function render(){
    var pct=parseInt(slider.value,10)||0;
    var stay=Math.round(700*pct/100);
    out.textContent='$'+stay+'M';
    out.classList.toggle('text-emerald-300',stay>0);
    out.classList.toggle('text-white',stay===0);
    sub.textContent='de los $700M que se fueron · piso de subcontratación local: '+pct+'%';
    if(pct===0){msg.textContent='Como pasó: casi todo se fue. Mueve la barra para ver cuánto se pudo quedar.';}
    else{msg.textContent='Con un piso de '+pct+'% de subcontratación local, cerca de $'+stay+'M de esa consultoría se hubiera quedado en Puerto Rico: en nóminas, ingenieros y suplidores boricuas.';}
  }
  slider.addEventListener('input',render);
  render();
})();
</script>

<h2>Los contratistas de la recuperación (fila teal = boricua)</h2>
<div class="not-prose mt-3 overflow-auto border border-slate-200 rounded-xl">
  <table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th class="py-2 px-3">Recipiente</th><th class="py-2 px-3 text-right">Monto</th><th class="py-2 px-3">Sede</th></tr></thead><tbody>${rowHtml || '<tr><td colspan="3" class="py-3 px-3 text-slate-400 italic">Data no disponible ahora.</td></tr>'}</tbody></table>
</div>

<h2>¿Por qué pasó, y qué se hace?</h2>
<p>No es que "las de afuera sean malas": los contratos grandes de gestión de emergencia y de ingeniería son un mercado especializado donde EE.UU. tiene firmas gigantes, y Puerto Rico tenía pocas a esa escala tras el desastre. <strong>Ese es justo el punto:</strong> la recuperación reconstruyó edificios, pero no construyó la capacidad local para que la próxima vez el dinero se quede aquí. Es un dato para exigir mejor, no para señalar a una empresa.</p>
<p class="text-sm text-slate-700"><strong>La jugada (para quien la ejecute):</strong> exigir requisitos de contratación y <em>subcontratación</em> local en los fondos que aún no se han gastado — sobre todo el HUD CDBG-DR — para que reconstruir a PR también levante su economía y su fuerza laboral. <a href="/expediente/representante-distrito-20#agenda" class="text-teal-700 font-semibold">Ver la agenda completa →</a></p>

<div class="not-prose bg-amber-50 border border-amber-200 rounded-xl p-4 mt-5 text-sm text-slate-700"><strong>Método y límites:</strong> contratos federales de la agencia DHS/FEMA con lugar de ejecución en PR (2017–2025), vía USASpending.gov. Excluye el passthrough del Gobierno de PR (que sub-otorga a los municipios — esos son los fondos de <a href="/recuperacion" class="text-teal-700 font-semibold">/recuperacion</a>). <strong>Falta HUD CDBG-DR</strong> (~$20B más) — segunda pasada pendiente. Los montos son a nivel transacción (las modificaciones se suman), así que léelos como orden de magnitud, no centavo exacto.</div>

<p class="text-sm text-slate-500 mt-5">Fuente: USASpending.gov (Departamento de Seguridad Nacional / FEMA), lugar de ejecución Puerto Rico. Cada recipiente tiene su enlace de verificación (↗) en la tabla. Julio 2026.</p>
`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: 'Sigue el dinero: recipientes de la recuperación federal de Puerto Rico',
    description: `De los contratos federales de recuperación de PR rastreados, ~${pctFuera}% fue a firmas de afuera de la isla. CH2M/CDM (Denver) sola recibió $238M en asesoría. Fuente: USASpending × FEMA.`,
    creator: { '@type': 'Person', name: 'Angel Anderson' },
    publisher: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' },
    isAccessibleForFree: true, inLanguage: 'es', url: 'https://puertoricosinfiltros.com/sigue-el-dinero',
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: 'Sigue el dinero: quién se llevó la recuperación de Puerto Rico',
    description: 'De cada dólar de contrato de recuperación de PR, ~87 centavos salieron al mainland. Los contratistas de la reconstrucción, con nombre y monto. Con la fuente al lado.',
    slug: 'sigue-el-dinero', bodyHtml: body, jsonLd, ogImage: OG_SINFILTROS,
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
  }))
}

const FUNCIONARIOS: Record<string, any> = {
  'alcalde-cabo-rojo': { nombre: 'Jorge Morales Wiscovitch', cargo: 'Alcalde de Cabo Rojo', tipo: 'alcalde', cargo_id: 'fd65244c-9ba5-4f31-bf72-c4dbde040912', promesasPublicas: true, ambito: 'Cabo Rojo', municipios: [{ nombre: 'Cabo Rojo', key: 'cabo rojo' }], firmaDistrito: 'cabo-rojo', expedientePublicado: '2026-07-05', notificado: '2026-07-09', termino: '2025–2028 · 2do término', eleccion: '2028-11-07' },
  'representante-distrito-20': { nombre: 'Emilio Carlo Acosta', cargo: 'Representante · Cámara de PR · Distrito 20', tipo: 'representante', partido: 'PNP', cargo_id: 'b7c3ac60-5f99-4326-8a4d-e9eb8fd80c08', promesasPublicas: true, ambito: 'el Distrito 20 (Cabo Rojo, San Germán y Hormigueros)', municipios: [{ nombre: 'Cabo Rojo', key: 'cabo rojo' }, { nombre: 'San Germán', key: 'germ' }, { nombre: 'Hormigueros', key: 'hormigueros' }], firmaDistrito: 'distrito-20', expedientePublicado: '2026-07-05', notificado: '2026-07-09', termino: '2025–2028', terminoInicio: '2025-01-02', eleccion: '2028-11-07', sutraPerfil: 'https://sutra.oslpr.org/legisladores/M-953-AL' },
}
// Etiquetas cortas de medidas trackeadas (presentación; el texto completo vive en la DB, verificado contra SUTRA)
const MEDIDA_LABEL: Record<string, string> = { RC0211: 'La luz en la PR-2', RC0210: 'Los solares abandonados', RCC0076: 'La escuela vocacional' }
async function handleExpediente(req: any, res: any) {
  const f = String(req.query?.f || 'alcalde-cabo-rojo')
  const cfg = FUNCIONARIOS[f] || FUNCIONARIOS['alcalde-cabo-rojo']
  const money = (x: number) => '$' + Number(x || 0).toLocaleString('en-US')
  let promesas: any[] = []
  let respuestas: any[] = []
  let firmas: any[] = []
  let demanda90: any[] = []
  const grabMap: Record<string, any> = {}
  const munis: any[] = []
  try {
    let pq: any = supabase.from('quien_responde_promesas').select('estado,promesa,cita,minuto,grabacion_id,fecha_grabacion,que_paso,fuente_que_paso,numero_medida,sutra_url,fecha_radicacion,tramite_estado,tramite_fecha,tramite_detalle,verificado_sutra,plazo_autoimpuesto,plazo_texto').eq('cargo_id', cfg.cargo_id)
    if (cfg.promesasPublicas) pq = pq.eq('publicable', true)
    const [pp, rr, ffirmas, gg, dd90] = await Promise.all([
      pq,
      supabase.from('funcionario_respuestas').select('respuesta,respondio_nombre,respondio_cargo,canal,evidencia_url,fecha_respuesta').eq('funcionario_slug', f).eq('publicable', true).eq('verificado', true).order('fecha_respuesta', { ascending: false }),
      cfg.firmaDistrito ? supabase.from('agenda_firmas').select('firmante_nombre,firmante_cargo,partido,fecha_firma,evidencia_url,compromiso_version').eq('distrito', cfg.firmaDistrito).eq('publicable', true).eq('verificado', true).order('fecha_firma', { ascending: true }) : Promise.resolve({ data: [] } as any),
      cfg.tipo === 'alcalde' ? supabase.from('grabaciones').select('grabacion_id,video_url,clip_url') : Promise.resolve({ data: [] } as any),
      cfg.tipo === 'alcalde' ? supabase.from('demand_signals_real').select('category,user_hash').gt('created_at', new Date(Date.now() - 90 * 86400000).toISOString()) : Promise.resolve({ data: [] } as any),
    ])
    promesas = pp.data || []
    respuestas = rr.data || []
    firmas = ffirmas.data || []
    for (const g of (gg.data || [])) grabMap[g.grabacion_id] = g
    demanda90 = dd90.data || []
    for (const m of cfg.municipios) {
      const [mm, ff, bb, dd] = await Promise.all([
        supabase.from('v_registro_municipio_intel').select('especialistas,psiquiatras,poblacion,poverty_pct,por_10k_hab,hpsa_salud_mental').ilike('municipio', `%${m.key}%`).maybeSingle(),
        supabase.from('fema_recovery_by_municipio').select('federal_obligado,proyectos').ilike('municipio_raw', `%${m.key}%`).maybeSingle(),
        supabase.from('pr_broadband').select('pct_broadband,pct_sin_internet').ilike('municipio', `%${m.key}%`).maybeSingle(),
        supabase.from('v_salud_cruce').select('diabetes_pct').ilike('municipio', `%${m.key}%`).maybeSingle(),
      ])
      munis.push({ nombre: m.nombre, med: mm.data || {}, fema: ff.data || {}, bb: bb.data || {}, diabetes: dd.data?.diabetes_pct })
    }
  } catch (_) { /* fallbacks */ }
  const T = munis.reduce((a: any, x: any) => ({ esp: a.esp + (+x.med.especialistas || 0), psq: a.psq + (+x.med.psiquiatras || 0), pob: a.pob + (+x.med.poblacion || 0), fema: a.fema + (+x.fema.federal_obligado || 0), proy: a.proy + (+x.fema.proyectos || 0) }), { esp: 0, psq: 0, pob: 0, fema: 0, proy: 0 })
  const nP = promesas.length
  const cnt = (s: string) => promesas.filter((p: any) => p.estado === s).length
  const tile = (num: string, label: string) => `<div class="bg-white border-2 border-slate-200 rounded-xl p-4 text-center"><div class="text-2xl font-black text-slate-900">${num}</div><div class="text-xs text-slate-600 mt-1">${label}</div></div>`

  // ===== El Marcador del Término (T3): contador vivo por medida, verificado contra SUTRA =====
  const DAY = 86400000
  const hoy = new Date()
  const dias = (from: string, to?: string) => Math.max(0, Math.floor(((to ? new Date(to + 'T12:00:00') : hoy).getTime() - new Date(from + 'T12:00:00').getTime()) / DAY))
  const fmtF = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-PR', { day: 'numeric', month: 'short', year: 'numeric' })
  const aprobadas = promesas.filter((p: any) => p.tramite_estado === 'aprobada_camara').length
  const resultados = cnt('cumplido')
  const verifDates = promesas.map((p: any) => p.verificado_sutra).filter(Boolean).sort()
  const verifSutra = verifDates.length ? verifDates[verifDates.length - 1] : ''

  const marcadorCards = promesas.slice().sort((a: any, b: any) => String(a.numero_medida || '').localeCompare(String(b.numero_medida || ''))).map((p: any) => {
    const label = MEDIDA_LABEL[p.numero_medida] || String(p.promesa || '').slice(0, 70)
    const rad = p.fecha_radicacion
    const aprobada = p.tramite_estado === 'aprobada_camara'
    const chip = aprobada
      ? `<span class="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-full px-3 py-1">✓ Aprobada en Cámara · unanimidad</span>`
      : `<span class="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1">⏳ ${rad ? dias(p.tramite_fecha || rad) : '—'} días sin un trámite</span>`
    const reloj = aprobada
      ? `Radicada el ${fmtF(rad)} · aprobada a los <strong>${dias(rad, p.tramite_fecha)} días</strong> (${fmtF(p.tramite_fecha)}) · la investigación lleva <strong>${dias(p.tramite_fecha)} días</strong> en comisión sin informe rendido.`
      : `Radicada el ${fmtF(rad)} · referida a comisión el ${fmtF(p.tramite_fecha)} · desde entonces: <strong>${dias(p.tramite_fecha)} días sin un solo trámite</strong> en el récord.`
    const paso = (done: boolean, txt: string, fecha?: string) => `<div class="flex items-center gap-1.5 ${done ? 'text-emerald-700' : 'text-slate-400'}"><span class="font-black">${done ? '✓' : '○'}</span><span>${txt}${fecha ? ` <span class="text-slate-400">(${fmtF(fecha)})</span>` : ''}</span></div>`
    return `
<div class="not-prose border-2 ${aprobada ? 'border-emerald-200' : 'border-red-200'} bg-white rounded-2xl p-5 mt-4">
  <div class="flex items-start justify-between gap-3 flex-wrap">
    <div>
      <span class="text-xs font-bold text-slate-400 uppercase tracking-wide">${escapeHtml(p.numero_medida || 'Medida')}</span>
      <h3 class="text-lg font-black text-slate-900 mt-0.5" style="font-family:'Fraunces',Georgia,serif">${escapeHtml(label)}</h3>
    </div>
    ${chip}
  </div>
  <p class="text-sm text-slate-600 mt-2">${escapeHtml(String(p.promesa || ''))}</p>
  <div class="flex flex-wrap gap-x-5 gap-y-1 text-xs mt-3">
    ${paso(true, 'Radicada', rad)}
    ${paso(aprobada, 'Aprobada en Cámara', aprobada ? p.tramite_fecha : undefined)}
    ${paso(false, 'Resultado en la calle')}
  </div>
  <p class="text-sm text-slate-700 mt-3">${reloj}</p>
  ${p.tramite_detalle ? `<p class="text-xs text-slate-500 mt-1.5">${escapeHtml(p.tramite_detalle)}</p>` : ''}
  ${p.sutra_url ? `<p class="text-xs mt-2"><a href="${escapeHtml(p.sutra_url)}" target="_blank" rel="noopener" class="text-teal-700 font-semibold">Verifícalo en SUTRA ↗</a></p>` : ''}
</div>`
  }).join('')

  const diasEleccion = cfg.eleccion ? dias(new Date().toISOString().slice(0, 10), cfg.eleccion) : 0

  // ===== Marcador del Cuatrienio (alcalde): los relojes los puso él, en video =====
  const tsLink = (url: string, minuto: string) => {
    const m = parseInt(String(minuto || '').replace(/[^0-9]/g, ''), 10)
    if (!url) return ''
    if (isNaN(m)) return url
    const secs = m * 60
    const sep = url.includes('?') ? '&' : '?'
    return /youtu\.?be|youtube/.test(url) ? `${url}${sep}t=${secs}s` : `${url}${sep}t=${secs}`
  }
  const relojes = promesas.filter((p: any) => p.plazo_autoimpuesto || p.estado === 'vencido')
    .sort((a: any, b: any) => String(a.plazo_autoimpuesto || a.fecha_grabacion || '').localeCompare(String(b.plazo_autoimpuesto || b.fecha_grabacion || '')))
  const cumplidas = promesas.filter((p: any) => p.estado === 'cumplido')
  const masVieja = promesas.filter((p: any) => p.estado === 'en_proceso').sort((a: any, b: any) => String(a.fecha_grabacion || '').localeCompare(String(b.fecha_grabacion || '')))[0]
  const relojCards = relojes.map((p: any) => {
    const g = grabMap[p.grabacion_id] || {}
    const vlink = g.video_url ? tsLink(g.video_url, p.minuto) : ''
    const plazoVencido = p.plazo_autoimpuesto && p.plazo_autoimpuesto < hoy.toISOString().slice(0, 10)
    const rojo = p.estado === 'vencido' || plazoVencido
    const chip = p.estado === 'vencido'
      ? `<span class="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1">Vencida</span>`
      : plazoVencido
        ? `<span class="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1">⏰ ${dias(p.plazo_autoimpuesto).toLocaleString('en-US')} días pasado su propio plazo</span>`
        : `<span class="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded-full px-3 py-1">Su plazo corre: ${fmtF(p.plazo_autoimpuesto)}</span>`
    return `
<div class="not-prose border-2 ${rojo ? 'border-red-200' : 'border-amber-200'} bg-white rounded-2xl p-5 mt-4">
  <div class="flex items-start justify-between gap-3 flex-wrap">
    <h3 class="text-lg font-black text-slate-900 max-w-xl" style="font-family:'Fraunces',Georgia,serif">${escapeHtml(p.promesa)}</h3>
    ${chip}
  </div>
  ${p.cita ? `<blockquote class="text-sm text-slate-600 italic border-l-4 border-slate-300 pl-4 mt-2">"${escapeHtml(p.cita)}"</blockquote>` : ''}
  <p class="text-xs text-slate-500 mt-2">Dicho en video el ${fmtF(p.fecha_grabacion)}${vlink ? ` · <a href="${escapeHtml(vlink)}" target="_blank" rel="noopener" class="text-teal-700 font-semibold underline">véalo decirlo (minuto ${escapeHtml(p.minuto || '')}) ↗</a>` : p.minuto ? ` · minuto ${escapeHtml(p.minuto)} del video` : ''}</p>
  ${p.plazo_texto ? `<p class="text-sm text-slate-800 mt-2"><strong>El plazo lo puso él:</strong> ${escapeHtml(p.plazo_texto)}.</p>` : ''}
  ${p.que_paso ? `<p class="text-sm text-slate-700 mt-2"><strong>Qué pasó:</strong> ${escapeHtml(p.que_paso)}</p>` : ''}
  ${/^https?:\/\//i.test(String(p.fuente_que_paso || '')) ? `<p class="text-xs mt-2"><a href="${escapeHtml(p.fuente_que_paso)}" target="_blank" rel="noopener" class="text-teal-700 font-semibold">Fuente de qué pasó ↗</a></p>` : ''}
</div>`
  }).join('')
  const cumplidasHtml = cumplidas.map((p: any) => {
    const g = grabMap[p.grabacion_id] || {}
    const vlink = g.video_url ? tsLink(g.video_url, p.minuto) : ''
    return `<li><strong>✓ ${escapeHtml(p.promesa)}</strong> (${fmtF(p.fecha_grabacion)}${vlink ? ` · <a href="${escapeHtml(vlink)}" target="_blank" rel="noopener" class="text-teal-700 underline">video ↗</a>` : ''})${p.que_paso ? ` — ${escapeHtml(p.que_paso)}` : ''}</li>`
  }).join('')

  const promesasHtml = cfg.tipo === 'alcalde'
    ? `
<div class="not-prose bg-slate-900 text-white rounded-2xl p-5 sm:p-6 mt-3">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">El Marcador del Cuatrienio · ${escapeHtml(cfg.termino || '')}</p>
  <div class="flex flex-wrap items-baseline gap-x-6 gap-y-2 mt-2">
    <div><span class="text-4xl font-black text-emerald-300" style="font-family:'Fraunces',Georgia,serif">${cnt('cumplido')}</span><span class="text-slate-300 text-sm ml-2">cumplidas</span></div>
    <div><span class="text-4xl font-black" style="font-family:'Fraunces',Georgia,serif">${cnt('en_proceso')}</span><span class="text-slate-300 text-sm ml-2">en proceso</span></div>
    <div><span class="text-4xl font-black text-red-400" style="font-family:'Fraunces',Georgia,serif">${cnt('vencido')}</span><span class="text-slate-300 text-sm ml-2">vencidas</span></div>
  </div>
  <p class="text-slate-300 text-sm mt-3"><strong class="text-white">Los relojes de este marcador no los pusimos nosotros — los puso él, en video.</strong> Cada promesa tiene la cita textual, el minuto exacto, y el plazo que él mismo dijo. Las promesas no expiran con la elección: lo dicho en 2021–2024 se le sigue el rastro en este término. Quedan <strong class="text-white">${diasEleccion.toLocaleString('en-US')} días</strong> para noviembre 2028.</p>
</div>
<p class="mt-4">Dos vistas del récord completo: <a href="/promesas" class="text-teal-700 font-semibold">el promesómetro</a> (todas por tema) y <a href="/historial" class="text-teal-700 font-semibold">el historial</a> (${nP} promesas con video al minuto). Abajo, <strong>los relojes que él mismo puso</strong>:</p>
${relojCards}
${masVieja ? `<p class="text-sm text-slate-600 mt-4">La promesa más vieja del récord aún en proceso: <strong>${escapeHtml(masVieja.promesa)}</strong> — dicha en video hace <strong>${dias(masVieja.fecha_grabacion).toLocaleString('en-US')} días</strong> (${fmtF(masVieja.fecha_grabacion)}).</p>` : ''}
${cumplidas.length ? `<div class="not-prose border-2 border-emerald-200 bg-emerald-50/60 rounded-2xl p-5 mt-4"><p class="text-xs uppercase tracking-widest text-emerald-700 font-bold">El verde también se registra</p><ul class="text-sm text-slate-700 mt-2 space-y-2">${cumplidasHtml}</ul></div>` : ''}
<div class="not-prose border-2 border-emerald-300 bg-emerald-50 rounded-2xl p-5 mt-4">
  <p class="text-xs uppercase tracking-widest text-emerald-700 font-bold">La regla del verde</p>
  <p class="text-slate-800 mt-1 text-sm"><strong>Este marcador premia igual que cobra.</strong> El día que el Coliseo reabra, que las cabañas pasen de 29, o que el Faro tenga acuerdo de manejo — se registra en verde, con fecha y fuente, para siempre. El camino más corto a un titular positivo en este récord es entregar la obra.</p>
</div>`
    : `
<div class="not-prose bg-slate-900 text-white rounded-2xl p-5 sm:p-6 mt-3">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">El Marcador del Término · ${escapeHtml(cfg.termino || '')}</p>
  <div class="flex flex-wrap items-baseline gap-x-6 gap-y-2 mt-2">
    <div><span class="text-4xl font-black" style="font-family:'Fraunces',Georgia,serif">${aprobadas} de ${nP}</span><span class="text-slate-300 text-sm ml-2">medidas del distrito aprobadas en Cámara</span></div>
    <div><span class="text-4xl font-black ${resultados === 0 ? 'text-amber-300' : 'text-emerald-300'}" style="font-family:'Fraunces',Georgia,serif">${resultados}</span><span class="text-slate-300 text-sm ml-2">resultado${resultados === 1 ? '' : 's'} en la calle</span></div>
  </div>
  <p class="text-slate-300 text-sm mt-3">Estas fechas corren bajo su reloj: quedan <strong class="text-white">${diasEleccion.toLocaleString('en-US')} días</strong> para las elecciones de noviembre 2028. Este marcador no opina — se actualiza con el récord de SUTRA, y registra el verde igual que el rojo.</p>
</div>
<p class="mt-4">Las <strong>${nP} medidas dirigidas al Distrito 20</strong> que forman su récord de promesas, cada una con su reloj${cfg.sutraPerfil ? ` (su <a href="${escapeHtml(cfg.sutraPerfil)}" target="_blank" rel="noopener" class="text-teal-700 font-semibold">perfil completo en SUTRA ↗</a> registra 70+ medidas en las que figura como autor o coautor)` : ''}:</p>
${marcadorCards}
<div class="not-prose border-2 border-emerald-300 bg-emerald-50 rounded-2xl p-5 mt-5">
  <p class="text-xs uppercase tracking-widest text-emerald-700 font-bold">La regla del verde</p>
  <p class="text-slate-800 mt-1 text-sm"><strong>Este marcador premia igual que cobra.</strong> El día que el informe de RC0210 o RC0211 se rinda, que la escuela vocacional se mueva, o que se radique medida sobre el precipicio de Medicaid (30 sep 2027) — este expediente lo registra en verde, con fecha, para siempre. El camino más corto a un titular positivo en este récord es ejecutar. Aplica para él y para cualquiera que aspire al escaño.</p>
</div>
${verifSutra ? `<p class="text-xs text-slate-400 mt-3">Trámites verificados contra SUTRA (Sistema Único de Trámite Legislativo) el ${fmtF(verifSutra)}. ¿Se movió algo después? <a href="mailto:angel@angelanderson.com?subject=${encodeURIComponent('Expediente D20: hay trámite nuevo')}" class="text-teal-700">Avísanos</a> y se actualiza.</p>` : ''}`

  let estadoHtml = ''
  if (cfg.tipo === 'representante') {
    const rows = munis.map((m: any) => `<tr class="border-t border-slate-100 ${(+m.med.psiquiatras || 0) === 0 ? 'bg-red-50/40' : ''}">
      <td class="py-1.5 px-3 font-semibold text-slate-800">${escapeHtml(m.nombre)}</td>
      <td class="py-1.5 px-3 text-right text-slate-600">${(+m.med.poblacion || 0).toLocaleString('en-US')}</td>
      <td class="py-1.5 px-3 text-right">${m.med.especialistas ?? '—'}</td>
      <td class="py-1.5 px-3 text-right ${(+m.med.psiquiatras || 0) === 0 ? 'text-red-700 font-bold' : 'text-slate-600'}">${m.med.psiquiatras ?? '—'}</td>
      <td class="py-1.5 px-3 text-right text-slate-600">${money(m.fema.federal_obligado)}</td>
    </tr>`).join('')
    estadoHtml = `
<div class="not-prose grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
  ${tile(T.pob.toLocaleString('en-US'), 'habitantes en el distrito')}
  ${tile(String(T.esp), 'especialistas médicos')}
  ${tile(String(T.psq), 'psiquiatras en 3 municipios')}
  ${tile(money(T.fema), `de FEMA (${T.proy} proyectos)`)}
</div>
<div class="not-prose mt-3 overflow-auto border border-slate-200 rounded-xl">
  <table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th class="py-2 px-3">Municipio</th><th class="py-2 px-3 text-right">Población</th><th class="py-2 px-3 text-right">Especialistas</th><th class="py-2 px-3 text-right">Psiquiatras</th><th class="py-2 px-3 text-right">FEMA obligado</th></tr></thead><tbody>${rows}</tbody></table>
</div>
<p class="text-sm text-slate-700 mt-3"><strong>Lo que salta:</strong> Hormigueros, con 16,614 habitantes, tiene <strong>0 psiquiatras</strong> y solo 9 especialistas; los tres municipios cargan designación federal de escasez de salud mental. San Germán concentra el 65% de la recuperación federal del distrito. <a href="/telemedicina" class="text-teal-700 font-semibold">Ver el cruce de acceso →</a></p>`
  } else {
    const m = munis[0] || {}
    const med = m.med || {}, fema = m.fema || {}, bb = m.bb || {}
    estadoHtml = `
<div class="not-prose grid sm:grid-cols-2 gap-3 mt-3">
  <a href="/registro/estado" class="block border border-slate-200 bg-white rounded-xl p-4 hover:border-teal-300 no-underline">
    <div class="text-xs font-bold text-teal-700 uppercase">Salud</div>
    <div class="text-sm text-slate-700 mt-1">${med.especialistas ?? 99} especialistas · ${med.psiquiatras ?? 3} psiquiatras (${Number(med.por_10k_hab || 20.2).toFixed(1)}/10k). <strong>Designación federal de escasez de salud mental activa</strong> (score ${med.hpsa_salud_mental ?? 22}) pese a tener psiquiatras. Diabetes ${m.diabetes || '15.2'}% (est. 2009).</div>
  </a>
  <a href="/recuperacion" class="block border border-slate-200 bg-white rounded-xl p-4 hover:border-teal-300 no-underline">
    <div class="text-xs font-bold text-teal-700 uppercase">Recuperación federal</div>
    <div class="text-sm text-slate-700 mt-1">${money(fema.federal_obligado ?? 34315703)} de fondos FEMA obligados en ${fema.proyectos ?? 119} proyectos. ¿En qué se convirtieron?</div>
  </a>
  <a href="/agua" class="block border border-slate-200 bg-white rounded-xl p-4 hover:border-teal-300 no-underline">
    <div class="text-xs font-bold text-teal-700 uppercase">Agua</div>
    <div class="text-sm text-slate-700 mt-1">3 violaciones de salud activas (trihalometanos) en el récord federal del agua potable de Cabo Rojo.</div>
  </a>
  <a href="/telemedicina" class="block border border-slate-200 bg-white rounded-xl p-4 hover:border-teal-300 no-underline">
    <div class="text-xs font-bold text-teal-700 uppercase">Internet</div>
    <div class="text-sm text-slate-700 mt-1">${Number(bb.pct_broadband || 75.7).toFixed(1)}% de los hogares con banda ancha; ${Number(bb.pct_sin_internet || 18.8).toFixed(1)}% sin ningún internet. Pobreza ${Number(med.poverty_pct || 38.4).toFixed(0)}%.</div>
  </a>
</div>`
  }

  // ===== El termómetro del pueblo (alcalde): demanda real del *7711, en vivo — data que ningún informe municipal tiene =====
  const dTotal = demanda90.length
  const dUsers = new Set(demanda90.map((x: any) => x.user_hash)).size
  const catCount: Record<string, number> = {}
  for (const x of demanda90) if (x.category) catCount[x.category] = (catCount[x.category] || 0) + 1
  const topCats = Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const termometroHtml = cfg.tipo === 'alcalde' && dTotal ? `
<h2>El termómetro del pueblo, en vivo</h2>
<p class="text-slate-600 -mt-2">Ningún informe municipal tiene esta data: lo que los vecinos de verdad piden, con fecha, por el número del pueblo (787-417-7711). Se actualiza sola — la demanda no espera al próximo informe.</p>
<div class="not-prose bg-slate-900 text-white rounded-2xl p-5 mt-3">
  <div class="flex flex-wrap items-baseline gap-x-6 gap-y-2">
    <div><span class="text-4xl font-black" style="font-family:'Fraunces',Georgia,serif">${dTotal.toLocaleString('en-US')}</span><span class="text-slate-300 text-sm ml-2">señales de demanda en 90 días</span></div>
    <div><span class="text-4xl font-black" style="font-family:'Fraunces',Georgia,serif">${dUsers.toLocaleString('en-US')}</span><span class="text-slate-300 text-sm ml-2">vecinos distintos</span></div>
  </div>
  <div class="flex flex-wrap gap-2 mt-3">${topCats.map(([c, n]) => `<span class="text-xs font-bold bg-slate-800 border border-slate-700 text-teal-300 rounded-full px-3 py-1">${escapeHtml(c)} · ${n}</span>`).join('')}</div>
</div>
<p class="text-sm text-slate-700 mt-3">El pueblo también pide lo que el municipio no tiene: especialistas médicos (neumólogos y urólogos: <strong>cero en Cabo Rojo</strong> según el registro federal) mientras el sector de restaurantes está sobreofertado (1 por cada 242 residentes). Esa brecha es la que una política de patentes informada por data puede cerrar. <a href="/demanda" class="text-teal-700 font-semibold">Ver el récord de demanda →</a></p>` : ''

  // Las preguntas que solo la alcaldía puede contestar (alcalde) — cada una se responde con el reclamo de arriba
  const preguntasHtml = cfg.tipo === 'alcalde' ? `
<div class="not-prose border border-slate-200 bg-white rounded-2xl p-5 mt-4">
  <p class="text-xs uppercase tracking-widest text-slate-500 font-bold">Las preguntas que solo la alcaldía puede contestar</p>
  <ol class="text-sm text-slate-700 mt-2 space-y-2 list-decimal pl-5">
    <li><strong>FEMA:</strong> de los ${T.proy} proyectos con ${money(T.fema)} obligados, ¿cuántos están terminados y entregados? El récord federal muestra el dinero, no las obras.</li>
    <li><strong>Agua:</strong> ¿cuál es el plan — y la fecha — para cerrar las 3 violaciones de salud activas (trihalometanos) que la EPA registra en Cabo Rojo?</li>
    <li><strong>ARPA:</strong> de los $30 millones anunciados en video (jul 2021), el récord público confirma ~$2.5M transferidos a la AAA para El Combate. ¿Dónde está el desglose del resto?</li>
  </ol>
  <p class="text-xs text-slate-500 mt-3">Cualquiera de estas respuestas se publica arriba, verbatim, con fecha. El récord federal no las puede contestar — la alcaldía sí.</p>
</div>` : ''

  // ===== T5: La respuesta del funcionario (Reclama tu expediente) =====
  const diasSinReclamar = cfg.expedientePublicado ? dias(cfg.expedientePublicado) : 0
  const claimMail = `mailto:angel@angelanderson.com?subject=${encodeURIComponent(`Reclamo el expediente: ${cfg.cargo}`)}&body=${encodeURIComponent(`Soy / represento la oficina de ${cfg.nombre}.\n\nRespondo al expediente publicado en puertoricosinfiltros.com/expediente/${f}.\n\nMi respuesta (se publica verbatim, con fecha y canal):\n\n`)}`
  const respuestaHtml = respuestas.length
    ? respuestas.map((r: any) => `
<div class="not-prose border-2 border-teal-300 bg-teal-50 rounded-2xl p-5 mt-4">
  <div class="flex items-start justify-between gap-3 flex-wrap">
    <span class="text-xs font-bold text-teal-700 uppercase tracking-wide">Respuesta on-record${r.canal ? ` · ${escapeHtml(r.canal)}` : ''}</span>
    ${r.fecha_respuesta ? `<span class="text-xs text-slate-500">${fmtF(r.fecha_respuesta)}</span>` : ''}
  </div>
  <blockquote class="text-slate-800 mt-2 italic border-l-4 border-teal-400 pl-4">${escapeHtml(r.respuesta)}</blockquote>
  <p class="text-xs text-slate-500 mt-2">— ${escapeHtml(r.respondio_nombre || cfg.nombre)}${r.respondio_cargo ? `, ${escapeHtml(r.respondio_cargo)}` : ''}. Publicada verbatim, sin editar.${r.evidencia_url ? ` <a href="${escapeHtml(r.evidencia_url)}" target="_blank" rel="noopener" class="text-teal-700 font-semibold">Evidencia ↗</a>` : ''}</p>
</div>`).join('')
    : `
<div class="not-prose border-2 border-dashed border-slate-300 bg-slate-50 rounded-2xl p-5 mt-4">
  <div class="flex items-start justify-between gap-3 flex-wrap">
    <span class="text-xs font-bold text-slate-500 uppercase tracking-wide">Sin reclamar</span>
    <span class="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1">${diasSinReclamar} días publicado · sin respuesta del funcionario</span>
  </div>
  <p class="text-sm text-slate-700 mt-2">Este expediente puede ser reclamado por ${escapeHtml(cfg.nombre)} o su oficina. Su respuesta a cualquier punto — corrección, contexto, o lo que quiera que el distrito sepa — <strong>se publica aquí verbatim, con fecha, sin editar</strong>, al lado del dato. La regla es simétrica: registramos su versión con el mismo rigor que el récord.</p>
  <p class="text-sm mt-3"><a href="${claimMail}" class="inline-flex items-center gap-1 bg-slate-900 text-white font-bold px-4 py-2 rounded-full hover:bg-slate-700 no-underline">Reclamar este expediente →</a></p>
  <p class="text-xs text-slate-400 mt-2">Verificamos que la respuesta venga de la oficina (email oficial o declaración pública citable) antes de publicarla. Este contador corre solo.${cfg.notificado ? ` <strong>Notificado a su oficina por correo el ${fmtF(cfg.notificado)}.</strong>` : ''}</p>
</div>`

  // ===== T10: La Firma (la agenda se vuelve compromiso público firmable) =====
  const firmaHtml = cfg.firmaDistrito ? `
<h2 id="firma">La Firma: la agenda se puede firmar</h2>
<p class="text-slate-600 -mt-2">La agenda de arriba no es de ningún partido — sale de la data. Por eso <strong>cualquier funcionario o aspirante a servirle a ${escapeHtml(cfg.ambito)}</strong> puede comprometerse públicamente con ella. La firma se registra aquí con fecha y evidencia, y el marcador le da seguimiento contra cada fecha — el verde y el rojo por igual.</p>
${firmas.length
    ? `<div class="not-prose mt-3 overflow-auto border border-slate-200 rounded-xl"><table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th class="py-2 px-3">Firmante</th><th class="py-2 px-3">Cargo</th><th class="py-2 px-3">Fecha</th><th class="py-2 px-3">Evidencia</th></tr></thead><tbody>${firmas.map((s: any) => `<tr class="border-t border-slate-100"><td class="py-1.5 px-3 font-semibold text-slate-800">${escapeHtml(s.firmante_nombre)}${s.partido ? ` <span class="text-xs text-slate-400">(${escapeHtml(s.partido)})</span>` : ''}</td><td class="py-1.5 px-3 text-slate-600">${escapeHtml(s.firmante_cargo || '')}</td><td class="py-1.5 px-3 text-slate-600">${s.fecha_firma ? fmtF(s.fecha_firma) : ''}</td><td class="py-1.5 px-3">${s.evidencia_url ? `<a href="${escapeHtml(s.evidencia_url)}" target="_blank" rel="noopener" class="text-teal-700 font-semibold">ver ↗</a>` : '—'}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="not-prose border border-slate-200 bg-white rounded-2xl p-5 mt-3"><p class="text-sm text-slate-700"><strong>Nadie la ha firmado todavía.</strong> El primero que firme — del partido que sea — queda en el récord como el primero. Eso no se borra.</p></div>`}
<p class="text-sm mt-3"><a href="mailto:angel@angelanderson.com?subject=${encodeURIComponent(`Firmo la Agenda (${cfg.firmaDistrito})`)}&body=${encodeURIComponent('Nombre completo:\nCargo o aspiración:\nPartido (opcional):\nEvidencia pública de la firma (post, carta, o declaración):\n\nMe comprometo públicamente con la agenda que sale de la data, versión v1-2026-07, y acepto que este récord le dé seguimiento con fechas.')}" class="inline-flex items-center gap-1 bg-emerald-700 text-white font-bold px-4 py-2 rounded-full hover:bg-emerald-800 no-underline">Firmar la Agenda →</a></p>
<p class="text-xs text-slate-400 mt-2">Registrar una firma no es un endoso: este récord no apoya candidatos, les da seguimiento. La firma se verifica con evidencia pública antes de publicarse (versión del compromiso: v1-2026-07).</p>` : ''

  const body = `
<div class="not-prose bg-slate-900 text-white rounded-2xl p-5 sm:p-6">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">El Expediente</p>
  <h1 class="text-2xl sm:text-3xl font-black mt-1 leading-tight" style="font-family:'Fraunces',Georgia,serif">${escapeHtml(cfg.cargo)}</h1>
  <p class="text-slate-300 mt-1">${escapeHtml(cfg.nombre)}${cfg.partido ? ' · ' + escapeHtml(cfg.partido) : ''}</p>
</div>

<p class="text-lg text-slate-600 mt-4">Todo lo que el récord público dice sobre su gestión y el estado de ${escapeHtml(cfg.ambito)}, en un solo lugar y con la fuente al lado. Para el vecino que decide, el periodista que investiga, y cualquiera que quiera servir mejor.</p>

<h2>Las promesas${cfg.tipo === 'representante' ? ': el marcador del término' : ': el marcador del cuatrienio'}</h2>
${promesasHtml}

<h2>La respuesta del funcionario</h2>
<p class="text-slate-600 -mt-2">El expediente tiene dos lados. Este es el suyo.</p>
${respuestaHtml}
${preguntasHtml}

<h2>El estado ${cfg.tipo === 'representante' ? 'del distrito' : 'de Cabo Rojo'}, en números</h2>
<p class="text-slate-600 -mt-2">Lo que hereda, administra y le entrega a la gente. Cada número con su récord.</p>
${estadoHtml}
${termometroHtml}

<a href="/esencia" class="not-prose block border-2 border-amber-300 bg-amber-50 rounded-2xl p-5 mt-4 hover:bg-amber-100 transition-colors no-underline">
  <span class="text-xs uppercase tracking-widest text-amber-700 font-bold">El caso que define a Cabo Rojo</span>
  <p class="text-lg font-black mt-1 leading-snug text-slate-900" style="font-family:'Fraunces',Georgia,serif">El proyecto Esencia: la línea de tiempo pública →</p>
  <p class="text-slate-600 mt-1 text-sm">$498M en créditos contributivos, investigaciones del CPI, medidas del Senado y protestas. Con fuente en cada punto. Sin opinión.</p>
</a>

<h2>¿Qué viene?</h2>
<p class="text-slate-600 -mt-2">La gestión no se mide solo por lo que pasó, sino por lo que viene. Estas fechas afectan a ${escapeHtml(cfg.ambito)} como a todo Puerto Rico — y hay algo que hacer hoy. <a href="/prediccion" class="text-teal-700 font-semibold">Ver la predicción completa →</a></p>
${renderAlertas()}

${renderAgenda()}

${firmaHtml}

<div class="not-prose bg-teal-50 border border-teal-200 rounded-2xl p-6 mt-8 text-center">
  <p class="text-lg font-black text-slate-900" style="font-family:'Fraunces',Georgia,serif">Un expediente público, para que nadie decida a ciegas.</p>
  <p class="mt-2 text-sm text-slate-600 italic">Todo con fuente. Se actualiza con el récord. ¿Ves un error? Escríbenos.</p>
</div>

<p class="text-sm text-slate-500 mt-6">Fuentes: NPPES/CMS (médicos) · HRSA (escasez) · OpenFEMA (recuperación) · EPA SDWIS (agua) · Censo ACS (internet, pobreza) · CDC (diabetes, est. 2009) · Cámara de PR / grabaciones públicas (promesas). Este expediente es neutral y no partidista: es el récord, no una opinión. Julio 2026.</p>
`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'ProfilePage',
    about: { '@type': 'Person', name: cfg.nombre, jobTitle: cfg.cargo },
    publisher: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' },
    inLanguage: 'es', url: `https://puertoricosinfiltros.com/expediente/${f}`,
  }
  // OG card con el score vivo (motor /api/og, theme sinfiltros) — el screenshot de 2028 se sirve solo
  const relojesVencidos = relojes.filter((p: any) => p.estado === 'vencido' || (p.plazo_autoimpuesto && p.plazo_autoimpuesto < hoy.toISOString().slice(0, 10))).length
  const ogExpediente = cfg.tipo === 'representante' && nP
    ? `https://puertoricosinfiltros.com/api/og?theme=sinfiltros&k=${encodeURIComponent(`El Expediente · Rep. Distrito 20${cfg.partido ? ' · ' + cfg.partido : ''}`)}&t=${encodeURIComponent(`${cfg.nombre}||el marcador del término`)}&sub=${encodeURIComponent(`${aprobadas} de ${nP} medidas del distrito aprobadas en Cámara · ${resultados} resultado${resultados === 1 ? '' : 's'} en la calle · quedan ${diasEleccion.toLocaleString('en-US')} días para nov 2028`)}&badge=${encodeURIComponent('Verificado contra SUTRA')}`
    : cfg.tipo === 'alcalde' && nP
      ? `https://puertoricosinfiltros.com/api/og?theme=sinfiltros&k=${encodeURIComponent('El Expediente · Alcalde de Cabo Rojo')}&t=${encodeURIComponent(`${cfg.nombre}||el marcador del cuatrienio`)}&sub=${encodeURIComponent(`${cnt('cumplido')} cumplidas · ${cnt('en_proceso')} en proceso · ${cnt('vencido')} vencidas — ${relojesVencidos} relojes que él mismo puso, ya pasados${dTotal ? ` · ${dTotal} señales del pueblo en 90 días` : ''}`)}&badge=${encodeURIComponent('Récord en video, al minuto')}`
      : OG_SINFILTROS
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: `El Expediente: ${cfg.cargo} — promesas y estado, con la fuente al lado`,
    description: cfg.tipo === 'representante' && nP
      ? `El marcador del término de ${cfg.nombre}: ${aprobadas} de ${nP} medidas del distrito aprobadas en Cámara, ${resultados} resultados en la calle. Verificado contra SUTRA. Con la respuesta del funcionario y la agenda firmable.`
      : cfg.tipo === 'alcalde' && nP
        ? `El marcador del cuatrienio de ${cfg.nombre}: ${cnt('cumplido')} cumplidas, ${cnt('en_proceso')} en proceso, ${cnt('vencido')} vencidas — con los plazos que él mismo puso en video, al minuto. Más el termómetro de demanda del pueblo, en vivo.`
        : `Todo el récord público de ${cfg.nombre} (${cfg.cargo}) y el estado de ${cfg.ambito}: promesas, recuperación federal, salud, agua, internet. Neutral y citable.`,
    slug: `expediente/${f}`, bodyHtml: body, jsonLd, ogImage: ogExpediente,
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
  }))
}

// /diabetes — cruce enfermedad × desierto médico (v_salud_cruce). Data CDC 2009 (única por municipio para PR) — caveat grande.
async function handleDiabetes(req: any, res: any) {
  let rows: any[] = []
  try {
    const { data } = await supabase.from('v_salud_cruce').select('municipio,diabetes_pct,especialistas,psiquiatras,por_10k_hab,poverty_pct').not('diabetes_pct', 'is', null).order('diabetes_pct', { ascending: false, nullsFirst: false })
    rows = data || []
  } catch (_) { /* empty */ }
  const rowHtml = rows.map((r: any) => `<tr class="border-t border-slate-100 ${Number(r.psiquiatras) === 0 ? 'bg-red-50/30' : ''}">
      <td class="py-1.5 px-3 font-semibold text-slate-800">${escapeHtml(r.municipio)}</td>
      <td class="py-1.5 px-3 text-right font-bold text-slate-900">${Number(r.diabetes_pct).toFixed(1)}%</td>
      <td class="py-1.5 px-3 text-right text-slate-600">${Number(r.por_10k_hab).toFixed(1)}</td>
      <td class="py-1.5 px-3 text-right ${Number(r.psiquiatras) === 0 ? 'text-red-700 font-bold' : 'text-slate-600'}">${r.psiquiatras}</td>
      <td class="py-1.5 px-3 text-right text-slate-500">${r.poverty_pct ? Number(r.poverty_pct).toFixed(0) + '%' : ''}</td>
    </tr>`).join('')
  const body = `
<h1>La diabetes contra el desierto médico</h1>
<p class="text-lg text-slate-600 mt-2">La diabetes es una enfermedad crónica: necesita médico de seguimiento, y viene de la mano con la depresión. La pregunta del cruce: <strong>¿dónde hay más diabetes y menos quién la atienda?</strong></p>

<div class="not-prose mt-5 bg-slate-900 text-white rounded-2xl p-5">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">El titular</p>
  <p class="text-xl sm:text-2xl font-black mt-1 leading-snug">Lajas es el pueblo con más diabetes de Puerto Rico (18%). No tiene un solo psiquiatra.</p>
  <p class="text-slate-300 mt-2 text-sm">Y Florida, con 15.7% de diabetes, no tiene ni un especialista médico de ninguna clase. La enfermedad crónica más común del archipiélago, en los pueblos con menos con quién atenderla.</p>
</div>

<div class="not-prose bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mt-5 text-sm text-slate-800"><strong>⚠️ Ojo con la fecha:</strong> esta es la <strong>única</strong> data de diabetes por municipio que existe para Puerto Rico, y es de un estudio del CDC de <strong>2009</strong>. El Diabetes Atlas moderno del CDC <strong>no incluye a PR a nivel de pueblo</strong> (lo verificamos hasta su API). Que el dato más reciente tenga 15 años es, en sí, parte del problema — lo contamos en <a href="/no-se-mide" class="text-teal-700 font-semibold underline">Lo que ni se mide</a>. Léelo como el mapa histórico de la carga, no como la foto de hoy.</div>

<h2>Los pueblos, por diabetes vs. acceso médico</h2>
<p class="text-slate-600 -mt-2">Fila roja = cero psiquiatras. La diabetes descontrolada y la depresión caminan juntas; muchos de estos pueblos no tienen ninguno de los dos.</p>
<div class="not-prose mt-3 overflow-auto border border-slate-200 rounded-xl">
  <table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th class="py-2 px-3">Municipio</th><th class="py-2 px-3 text-right">Diabetes</th><th class="py-2 px-3 text-right">Espec./10k</th><th class="py-2 px-3 text-right">Psiquiatras</th><th class="py-2 px-3 text-right">Pobreza</th></tr></thead><tbody>${rowHtml || '<tr><td colspan="5" class="py-3 px-3 text-slate-400 italic">Data no disponible ahora.</td></tr>'}</tbody></table>
</div>

<p class="text-sm text-slate-500 mt-5">Fuente: "Small-Area Variation in Diabetes Prevalence in Puerto Rico", CDC <em>Preventing Chronic Disease</em> (2009, modelo bayesiano sobre BRFSS, los 78 municipios) × registro federal NPPES (especialistas y psiquiatras). Verifícalo tú mismo en <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC4537060/" target="_blank" rel="noopener" class="text-teal-700 font-semibold">el estudio del CDC ↗</a>. ¿Ves un error? <a href="mailto:angel@angelanderson.com" class="text-teal-700">escríbenos</a>.</p>
`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: 'Diabetes por municipio vs. acceso médico en Puerto Rico',
    description: 'Prevalencia de diabetes por municipio de PR (estimado CDC 2009) cruzada con especialistas y psiquiatras (NPPES). Lajas 18% con 0 psiquiatras; Florida 15.7% con 0 especialistas.',
    creator: { '@type': 'Person', name: 'Angel Anderson' },
    publisher: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' },
    isAccessibleForFree: true, inLanguage: 'es', url: 'https://puertoricosinfiltros.com/diabetes',
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: 'La diabetes contra el desierto médico de Puerto Rico',
    description: 'Lajas, el pueblo con más diabetes de PR (18%), no tiene un solo psiquiatra. El cruce enfermedad × acceso médico, con la fuente al lado (estimado CDC 2009).',
    slug: 'diabetes', bodyHtml: body, jsonLd, ogImage: OG_SINFILTROS,
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
  }))
}

// /no-se-mide — el meta-récord: los huecos donde PR es invisible en su propia data. Nombrar el hueco es el récord.
function handleNoSeMide(req: any, res: any) {
  const huecos: Array<{ tag: string; titulo: string; falta: string; importa: string; estado: string; verificalo?: string }> = [
    { tag: 'Salud', titulo: 'La enfermedad por pueblo', falta: 'El CDC modela diabetes, depresión, asma y presión alta a nivel de sector censal para los 50 estados y DC — y excluye a Puerto Rico. La única enfermedad con dato por municipio para PR es la diabetes, y de un estudio del CDC de 2009; el Diabetes Atlas moderno tampoco incluye a PR a nivel de pueblo.', importa: 'No se puede cruzar "dónde más se enferman" contra "dónde no hay médicos" si la enfermedad no se mide. La diabetes sí se puede (aunque con data de hace 15 años); asma, presión alta y salud mental no. PR aparece casi en blanco en el mapa nacional de salud por pueblo.', estado: 'Confirmado: PLACES y el Atlas no tienen PR por municipio. Diabetes 2009 sí — ver el cruce en /diabetes.', verificalo: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4537060/' },
    { tag: 'Salud mental', titulo: 'Depresión y salud mental por municipio', falta: 'No hay una fuente pública que mida prevalencia de depresión o angustia mental por municipio en PR. El BRFSS encuesta a nivel de toda la isla, no de pueblo.', importa: '36 municipios no tienen ni un psiquiatra. Sin medir la demanda de salud mental por pueblo, la escasez se ve solo por el lado de la oferta.', estado: 'Sin fuente municipio-nivel.' },
    { tag: 'Luz', titulo: 'Cuántas horas se va la luz, por pueblo', falta: 'No hay data pública a nivel de municipio de la frecuencia y duración de los apagones (las métricas SAIDI/SAIFI de LUMA por pueblo).', importa: 'Sabemos que PR paga la luz casi al doble que EEUU, pero no cuánto la recibe cada pueblo. La confiabilidad se siente; no se publica.', estado: 'Requiere data del EIA-861 / LUMA por municipio.' },
    { tag: 'Basura', titulo: 'Cuántos años le quedan a cada vertedero', falta: 'La capacidad restante por vertedero (data de la Autoridad de Desperdicios Sólidos) no está en formato primario descargable. Solo el "beyond capacity" cualitativo de la EPA.', importa: 'La mayoría de los ~29 vertederos ya está sobre capacidad. Sin los años restantes por sitio, no se puede planificar el cierre ni el reemplazo.', estado: 'Requiere data primaria de la ADS.' },
    { tag: 'Economía', titulo: 'La economía informal', falta: 'La magnitud de la economía de "cuenta propia" — construcción, repostería casera, servicios sin factura — es invisible al sistema contributivo y no se mide por municipio.', importa: 'Sostiene el consumo local pero no aparece en ningún número oficial. Se le apostó y a la vez se ignora.', estado: 'Sin fuente directa.' },
    { tag: 'Movimiento', titulo: 'El gasto y el movimiento real', falta: 'No hay data pública de movimiento inter-municipal ni de gasto real por municipio. Cabo Rojo tiene 47,158 residentes pero un "pull" regional de ~75,000 personas que consumen en su territorio.', importa: 'La planificación municipal se hace a ciegas, con benchmarks de EE.UU. ($75k de ingreso) en vez del real ($26,408). Las inversiones fallan por falta de contexto local.', estado: 'Requiere data de movilidad / gasto agregado.' },
  ]
  const cards = huecos.map(h => `
    <div class="not-prose border border-slate-200 bg-white rounded-2xl p-5 mt-4">
      <span class="text-xs font-bold text-teal-700 uppercase tracking-wide">${escapeHtml(h.tag)}</span>
      <h3 class="text-xl font-black text-slate-900 mt-1" style="font-family:'Fraunces',Georgia,serif">${escapeHtml(h.titulo)}</h3>
      <p class="text-sm text-slate-700 mt-2"><strong>Qué falta:</strong> ${escapeHtml(h.falta)}</p>
      <p class="text-sm text-slate-600 mt-2"><strong>Por qué importa:</strong> ${escapeHtml(h.importa)}</p>
      <p class="text-xs text-slate-400 mt-2">${escapeHtml(h.estado)}${h.verificalo ? ` · <a href="${escapeHtml(h.verificalo)}" target="_blank" rel="noopener" class="text-teal-700 underline">verifícalo ↗</a>` : ''}</p>
    </div>`).join('')
  const body = `
<h1>Lo que ni se mide</h1>
<p class="text-lg text-slate-600 mt-2">Todos los récords de este sitio nacen de un dato. Esta página es lo contrario: los <strong>huecos</strong> donde Puerto Rico es invisible en su propia data — no porque el problema no exista, sino porque nadie lo cuenta. <strong>Lo que ni se mide no se puede arreglar.</strong> Nombrar el hueco es el primer paso.</p>
${cards}
<div class="not-prose bg-teal-50 border border-teal-200 rounded-2xl p-6 mt-8 text-center">
  <p class="text-lg font-black text-slate-900" style="font-family:'Fraunces',Georgia,serif">Un pueblo que no se mide no se puede defender.</p>
  <p class="mt-2 text-sm text-slate-600 italic">¿Conoces una fuente que llene uno de estos huecos? Escríbenos y la verificamos.</p>
</div>
<p class="text-sm text-slate-500 mt-6">Cada hueco se cierra en cuanto aparezca una fuente primaria verificable por municipio. Algunos ya tienen la tubería montada esperando la data. Julio 2026.</p>
`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: 'Lo que ni se mide — los huecos donde Puerto Rico es invisible en su propia data',
    author: { '@type': 'Person', name: 'Angel Anderson' },
    publisher: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' },
    inLanguage: 'es', url: 'https://puertoricosinfiltros.com/no-se-mide',
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: 'Lo que ni se mide — los huecos donde Puerto Rico es invisible',
    description: 'Los huecos donde PR es invisible en su propia data: la enfermedad por pueblo, los apagones, la economía informal. Lo que ni se mide no se puede arreglar.',
    slug: 'no-se-mide', bodyHtml: body, jsonLd, ogImage: OG_SINFILTROS,
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
  }))
}

// /telemedicina — cruce broadband (ACS B28002) × desierto médico. ¿La solución técnica ya existe donde no hay médico?
async function handleTelemedicina(req: any, res: any) {
  let rows: any[] = []
  try {
    const { data } = await supabase.from('v_broadband_cruce').select('municipio,especialistas,psiquiatras,pct_broadband,pct_sin_internet,diagnostico_telemedicina').eq('psiquiatras', 0).order('pct_broadband', { ascending: false, nullsFirst: false })
    rows = data || []
  } catch (_) { /* empty */ }
  const count = (d: string) => rows.filter((r: any) => r.diagnostico_telemedicina === d).length
  const viable = count('telemedicina_viable'), marginal = count('telemedicina_marginal'), doble = count('desierto_doble')
  const dx: Record<string, { label: string; cls: string }> = {
    telemedicina_viable: { label: 'Viable ya', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    telemedicina_marginal: { label: 'Marginal', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
    desierto_doble: { label: 'Desierto doble', cls: 'bg-red-100 text-red-800 border-red-200' },
  }
  const rowHtml = rows.map((r: any) => {
    const d = dx[r.diagnostico_telemedicina] || dx.telemedicina_marginal
    return `<tr class="border-t border-slate-100 ${r.diagnostico_telemedicina === 'desierto_doble' ? 'bg-red-50/40' : ''}">
      <td class="py-1.5 px-3 font-semibold text-slate-800">${escapeHtml(r.municipio)}</td>
      <td class="py-1.5 px-3 text-right text-slate-600">${r.especialistas}</td>
      <td class="py-1.5 px-3 text-right ${Number(r.pct_broadband) < 65 ? 'text-red-700 font-bold' : 'text-slate-700'}">${Number(r.pct_broadband).toFixed(1)}%</td>
      <td class="py-1.5 px-3 text-right text-slate-500">${Number(r.pct_sin_internet).toFixed(1)}%</td>
      <td class="py-1.5 px-3 text-center"><span class="text-xs font-bold rounded-full px-2 py-0.5 border ${d.cls}">${d.label}</span></td>
    </tr>`
  }).join('')
  const body = `
<h1>¿Telemedicina posible? El internet contra el desierto médico</h1>
<p class="text-lg text-slate-600 mt-2">36 municipios de Puerto Rico no tienen ni un psiquiatra. La pregunta que nadie había hecho con data: <strong>¿tienen al menos el internet para verlo por pantalla?</strong> Cruzamos el récord de médicos con el acceso a banda ancha, municipio por municipio.</p>

<div class="not-prose mt-5 bg-slate-900 text-white rounded-2xl p-5">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">El hallazgo</p>
  <p class="text-xl sm:text-2xl font-black mt-1 leading-snug">En la mayoría de los pueblos sin psiquiatra, el cable ya está. Falta el servicio, no la conexión.</p>
</div>

<div class="not-prose grid grid-cols-3 gap-3 mt-5">
  <div class="bg-white border-2 border-emerald-200 rounded-xl p-4 text-center"><div class="text-3xl font-black text-emerald-700">${viable}</div><div class="text-xs text-slate-600 mt-1">telemedicina <strong>viable ya</strong> (0 psiquiatras, banda ancha ≥80%)</div></div>
  <div class="bg-white border-2 border-amber-200 rounded-xl p-4 text-center"><div class="text-3xl font-black text-amber-600">${marginal}</div><div class="text-xs text-slate-600 mt-1">marginal (65–80%)</div></div>
  <div class="bg-white border-2 border-red-300 rounded-xl p-4 text-center"><div class="text-3xl font-black text-red-600">${doble}</div><div class="text-xs text-slate-600 mt-1"><strong>desierto doble</strong>: ni médico ni internet</div></div>
</div>

<h2>El desierto doble: donde ni la pantalla llega</h2>
<p>Tres pueblos no tienen psiquiatra <strong>y</strong> tampoco tienen internet: <strong>Las Marías</strong> (38.3% banda ancha, 58.8% de hogares sin internet), <strong>Maricao</strong> (39.0%, 60.5% sin internet) y <strong>Guánica</strong> (58.5%). Los tres tienen además el cupón federal de salud mental sin cobrar. Aquí la telemedicina todavía no es la salida: primero hay que llevar el cable.</p>

<h2>La oportunidad: la solución ya está montada</h2>
<p>En cambio, en ${viable} municipios sin un solo psiquiatra la banda ancha ya cubre el 80% o más de los hogares — Las Piedras (89.7%), Juncos (88.9%), Trujillo Alto (88.1%), Loíza (86.4%)… <strong>La infraestructura para la teleconsulta existe hoy. Lo que falta no es el cable: es el servicio.</strong></p>
<p>Y el dato que lo sella: los 33 municipios del cupón sin cobrar tienen banda ancha promedio de <strong>76.5%</strong>, apenas 3.3 puntos por debajo del resto de la isla (79.8%). Donde el dinero federal para médicos se queda sin reclamar, el internet en su mayoría <strong>sí existe</strong>. El cuello de botella es el acceso al servicio, no la conectividad.</p>

<h2>Los 36 pueblos sin psiquiatra, por acceso a internet</h2>
<div class="not-prose mt-3 overflow-auto border border-slate-200 rounded-xl">
  <table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th class="py-2 px-3">Municipio</th><th class="py-2 px-3 text-right">Especialistas</th><th class="py-2 px-3 text-right">Banda ancha</th><th class="py-2 px-3 text-right">Sin internet</th><th class="py-2 px-3 text-center">Diagnóstico</th></tr></thead><tbody>${rowHtml || '<tr><td colspan="5" class="py-3 px-3 text-slate-400 italic">Data no disponible ahora.</td></tr>'}</tbody></table>
</div>

<div class="not-prose bg-amber-50 border border-amber-200 rounded-xl p-4 mt-5 text-sm text-slate-700"><strong>Método y límites:</strong> "banda ancha" = hogares con suscripción de banda ancha de cualquier tipo (incluye plan de datos celular), medida estándar del Censo (tabla ACS B28002, estimados 2020–2024). No es lo mismo que cobertura de fibra fija. Los 0 psiquiatras salen del registro federal NPPES. Es un mapa de posibilidad, no una promesa de que la teleconsulta ya esté pasando.</div>

<p class="text-sm text-slate-500 mt-5">Fuente: U.S. Census Bureau, ACS 5-año (B28002) × registro federal NPPES/CMS. Verifícalo tú mismo en <a href="https://data.census.gov/table/ACSDT5Y2023.B28002?g=040XX00US72\$0500000" target="_blank" rel="noopener" class="text-teal-700 font-semibold">data.census.gov ↗</a>. ¿Ves un error? <a href="mailto:angel@angelanderson.com" class="text-teal-700">escríbenos</a>. Julio 2026.</p>
`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: 'Telemedicina posible vs desierto médico en Puerto Rico',
    description: `De los 36 municipios de PR sin psiquiatra, ${viable} ya tienen banda ancha ≥80% (telemedicina viable), ${doble} son desierto doble (ni médico ni internet). Fuentes: ACS B28002 × NPPES.`,
    creator: { '@type': 'Person', name: 'Angel Anderson' },
    publisher: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' },
    isAccessibleForFree: true, inLanguage: 'es', url: 'https://puertoricosinfiltros.com/telemedicina',
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: '¿Telemedicina posible? El internet contra el desierto médico de PR',
    description: 'De los 36 municipios de PR sin psiquiatra, en la mayoría el internet ya está: falta el servicio, no el cable. 3 son desierto doble. Con la fuente al lado.',
    slug: 'telemedicina', bodyHtml: body, jsonLd, ogImage: OG_SINFILTROS,
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
  }))
}

// /historial — la línea de tiempo de rendición de cuentas: promesa pública → qué pasó, con el minuto del video.
// Solo publicable=true (Angel vetea). Balanceado: muestra vencidos, en proceso Y cumplidos.
async function handleHistorial(req: any, res: any) {
  let rows: any[] = []
  const grab: Record<string, any> = {}
  try {
    const { data } = await supabase.from('quien_responde_promesas').select('promesa,minuto,fecha_grabacion,estado,que_paso,fuente_que_paso,cita,grabacion_id').eq('publicable', true).eq('cargo_id', 'fd65244c-9ba5-4f31-bf72-c4dbde040912').order('fecha_grabacion', { ascending: false })
    rows = data || []
    const { data: gd } = await supabase.from('grabaciones').select('grabacion_id,video_url,clip_url,plataforma')
    for (const g of (gd || [])) grab[g.grabacion_id] = g
  } catch (_) { /* empty state */ }
  const est: Record<string, { label: string; cls: string }> = {
    cumplido: { label: 'Cumplido', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    en_proceso: { label: 'En proceso', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
    vencido: { label: 'Vencido sin cumplir', cls: 'bg-red-100 text-red-800 border-red-200' },
    pendiente: { label: 'Pendiente', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  }
  const tsLink = (url: string, minuto: string) => {
    const m = parseInt(String(minuto || '').replace(/[^0-9]/g, ''), 10)
    const secs = isFinite(m) ? m * 60 : 0
    const sep = url.includes('?') ? '&' : '?'
    return /youtu\.?be|youtube/.test(url) ? `${url}${sep}t=${secs}s` : `${url}${sep}t=${secs}`
  }
  const items = rows.map((r: any) => {
    const e = est[r.estado] || est.pendiente
    const g = grab[r.grabacion_id]
    const okUrl = (u: string) => /^https?:\/\//i.test(String(u || ''))
    const minutoHtml = r.minuto
      ? (g && okUrl(g.video_url)
        ? ` · <a href="${escapeHtml(tsLink(g.video_url, r.minuto))}" target="_blank" rel="noopener" class="text-teal-700 underline font-semibold">minuto ${escapeHtml(r.minuto)} del video ↗</a>`
        : ` · minuto ${escapeHtml(r.minuto)} del video`)
      : ''
    const clipHtml = g && okUrl(g.clip_url)
      ? `<div class="mt-2"><a href="${escapeHtml(g.clip_url)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs font-bold text-white bg-red-600 rounded-full px-3 py-1 hover:bg-red-700">▶ Ver el clip</a></div>`
      : ''
    const citaHtml = r.cita ? `<blockquote class="mt-2 text-slate-800 leading-relaxed border-l-4 border-teal-500 pl-3 text-sm italic">"${escapeHtml(r.cita)}"</blockquote>` : ''
    const fuenteHtml = r.fuente_que_paso
      ? (/^https?:\/\//.test(r.fuente_que_paso)
        ? `<p class="text-xs text-slate-400 mt-2">Fuente: <a href="${escapeHtml(r.fuente_que_paso)}" target="_blank" rel="noopener" class="text-teal-700 underline">${escapeHtml(r.fuente_que_paso.replace(/^https?:\/\/(www\.)?/, '').split('/')[0])} ↗</a></p>`
        : `<p class="text-xs text-slate-400 mt-2">Fuente: ${escapeHtml(r.fuente_que_paso)}</p>`)
      : ''
    return `<div class="not-prose border border-slate-200 bg-white rounded-2xl p-5 mt-4">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div class="text-xs text-slate-400 font-semibold">${escapeHtml(r.fecha_grabacion || '')}${minutoHtml}</div>
        <span class="text-xs font-bold rounded-full px-3 py-1 border ${e.cls}">${e.label}</span>
      </div>
      <p class="text-lg font-black text-slate-900 mt-1" style="font-family:'Fraunces',Georgia,serif">${escapeHtml(r.promesa)}</p>
      ${citaHtml}
      ${clipHtml}
      ${r.que_paso ? `<p class="text-sm font-semibold text-slate-500 mt-3 mb-1">Qué pasó:</p><blockquote class="text-slate-700 leading-relaxed border-l-4 border-slate-300 pl-3 text-sm">${escapeHtml(r.que_paso)}</blockquote>` : ''}
      ${fuenteHtml}
    </div>`
  }).join('')
  const body = `
<h1>El historial: promesas con recibo</h1>
<p class="text-lg text-slate-600 mt-2">Cada promesa aquí se dijo en un video público, con el minuto exacto anotado. Cuando una vence sin cumplirse, se anota. Cuando se cumple, también. <strong>No es cacería: es memoria.</strong> El pueblo tiene derecho a recordar lo que se le dijo.</p>
${rows.length ? items : '<div class="not-prose bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4 text-sm text-slate-700">Verificando el próximo lote de promesas. Vuelve pronto.</div>'}
<div class="not-prose bg-teal-50 border border-teal-200 rounded-2xl p-6 mt-8 text-center">
  <p class="text-lg font-black text-slate-900" style="font-family:'Fraunces',Georgia,serif">Recordar lo que se prometió no es pelea. Es orden.</p>
  <p class="mt-2 text-sm text-slate-600 italic">¿Sabes de una promesa pública que falta o ya se cumplió? Escríbenos.</p>
</div>
<p class="text-sm text-slate-500 mt-6">Solo se publica lo verificado contra la grabación pública y el estado real del proyecto. Faltan promesas por revisar antes de entrar. ¿Ves un error? <a href="mailto:angel@angelanderson.com" class="text-teal-700">escríbenos</a> y se corrige. Julio 2026.</p>
`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: 'Historial de promesas públicas de Cabo Rojo — con timestamp de video',
    description: 'Promesas públicas rastreadas con la cita y el minuto exacto del video donde se hicieron, y qué pasó con cada una.',
    creator: { '@type': 'Person', name: 'Angel Anderson' },
    publisher: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' },
    isAccessibleForFree: true, inLanguage: 'es', url: 'https://puertoricosinfiltros.com/historial',
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: 'El historial: promesas públicas con recibo — Puerto Rico Sin Filtros',
    description: 'Las promesas públicas rastreadas con el minuto del video donde se hicieron y qué pasó con cada una. No es cacería: es memoria.',
    slug: 'historial', bodyHtml: body, jsonLd, ogImage: OG_SINFILTROS,
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
  }))
}

// Alertas accionables — la predicción con fecha + qué hacer AHORA + fuente + recuérdame. Reusable en /prediccion y expedientes.
const ALERTAS = [
  {
    titulo: 'El precipicio de Medicaid',
    fecha: '30 de septiembre de 2027',
    cuando: 'Faltan ~14 meses',
    que: 'El financiamiento federal de Medicaid a Puerto Rico cae de 76% a 55% si el Congreso no actúa antes de esa fecha. Afecta la cobertura de salud de casi la mitad de los boricuas.',
    hacer: [
      'Si dependes de Medicaid o del Plan de Salud del Gobierno: agenda tus citas, estudios y renovaciones de recetas mientras la cobertura está fuerte.',
      'Confirma tu elegibilidad y tus datos ahora, no en 2027.',
      'Exígele acción a tu comisionado residente y legisladores — la fecha es dura.',
    ],
    fuente: { texto: 'Congressional Research Service (IF11012)', url: 'https://www.congress.gov/crs-product/IF11012' },
    cal: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Precipicio+Medicaid+PR+%28cae+76%25%E2%86%9255%25%29&dates=20270901T120000Z/20270901T130000Z&details=El+financiamiento+federal+de+Medicaid+de+PR+cae+el+30+sep+2027+si+el+Congreso+no+actua.+Fuente%3A+CRS+IF11012',
  },
  {
    titulo: 'El éxodo de médicos',
    fecha: '2030',
    cuando: 'Se acerca',
    que: 'Se proyecta que el 55% de los médicos activos de PR se habrá retirado para 2030 sin sustitutos, mientras Medicare Advantage paga en la isla ~41% menos que en los estados. En los pueblos sin especialista, esperar a necesitarlo es el riesgo.',
    hacer: [
      'Establece tu médico primario AHORA, aunque estés sano — no esperes a la emergencia.',
      'Si tu pueblo no tiene especialista, pregunta por telemedicina (mira dónde ya es viable).',
      'Guarda copia de tus récords médicos y recetas; si tu médico se va, no empiezas de cero.',
    ],
    fuente: { texto: 'PMC / academia (2023); JAMA Health Forum (2022)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10170400/' },
    cal: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Revisar+mi+medico+primario+%28exodo+medico+PR+2030%29&dates=20260901T120000Z/20260901T130000Z&details=El+55%25+de+los+medicos+de+PR+se+retira+para+2030.+Establece+tu+medico+primario+ahora.',
  },
  {
    titulo: 'El corte de los trabajos de pantalla',
    fecha: '2027-2030',
    cuando: 'Ya empezó',
    que: 'La AI no reemplaza al que arregla tu nevera ni a la enfermera — reemplaza primero los trabajos de pantalla: servicio al cliente remoto, data entry, oficina, contenido, traducción. En PR esos son los empleos de exportación (Ley 20, BPO) que traen dólares a familias que no se fueron de la isla. El FMI proyecta que ~60% de los empleos en economías avanzadas están expuestos a la AI, y cerca de la mitad de los expuestos con riesgo de salario más bajo o menos contratación. Encima del éxodo médico y el precipicio de Medicaid, es un segundo golpe al poder adquisitivo — y el menos medido. (No existe un censo de exposición AI específico de PR: esto aplica los índices globales del FMI a la composición del empleo de la isla.)',
    hacer: [
      'Si tu ingreso es de pantalla o remoto: usa la AI para ser dueño de algo tuyo (un servicio, una lista de clientes), no solo para hacer tu tarea actual más rápido — eso acelera tu reemplazo.',
      'Si tienes un oficio de manos (plomería, refrigeración, cuido, mecánica): ese trabajo la AI no lo toca. Hazte encontrable (directorio local, 787-417-7711) para que la demanda te llegue.',
      'Si eres dueño de negocio local: la AI baja tu costo de operar. El que la adopte primero compite con firmas grandes desde el pueblo.',
    ],
    fuente: { texto: 'FMI — El FMI y el futuro del trabajo (2024)', url: 'https://www.imf.org/en/blogs/articles/2024/01/14/ai-will-transform-the-global-economy-lets-make-sure-it-benefits-humanity' },
    cal: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Revisar+como+la+AI+afecta+mi+ingreso+%28ser+dueno%2C+no+solo+empleado%29&dates=20270102T120000Z/20270102T130000Z&details=El+FMI+proyecta+~60%25+de+empleos+en+economias+avanzadas+expuestos+a+la+AI.+Usa+la+AI+para+ser+dueno+de+algo%2C+no+solo+para+hacer+tu+tarea+mas+rapido.',
  },
]
function renderAlertas() {
  return `<h2 id="alertas">⏰ Las fechas que te van a cobrar (y qué hacer)</h2>
<p class="text-slate-600 -mt-2">Una predicción no sirve si no te dice qué hacer hoy. Estas son las fechas reales, con acción concreta.</p>
${ALERTAS.map(a => `
<div class="not-prose border-2 border-amber-300 bg-amber-50 rounded-2xl p-5 mt-4">
  <div class="flex items-start justify-between gap-3 flex-wrap">
    <div><span class="text-xs font-bold text-amber-700 uppercase tracking-wide">Alerta</span><h3 class="text-xl font-black text-slate-900 mt-0.5" style="font-family:'Fraunces',Georgia,serif">${escapeHtml(a.titulo)}</h3></div>
    <div class="text-right"><div class="text-lg font-black text-red-700">${escapeHtml(a.fecha)}</div><div class="text-xs text-slate-500">${escapeHtml(a.cuando)}</div></div>
  </div>
  <p class="text-sm text-slate-700 mt-2">${escapeHtml(a.que)}</p>
  <p class="text-sm font-bold text-slate-800 mt-3 mb-1">Qué puedes hacer ahora:</p>
  <ul class="text-sm text-slate-700 list-disc pl-5 space-y-1">${a.hacer.map(h => `<li>${escapeHtml(h)}</li>`).join('')}</ul>
  <div class="mt-3 flex flex-wrap gap-2 text-sm">
    <a href="${a.cal}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 bg-slate-900 text-white font-bold px-4 py-2 rounded-full hover:bg-slate-700">🔔 Recuérdame</a>
    <a href="${escapeHtml(a.fuente.url)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-full hover:border-teal-400">Fuente: ${escapeHtml(a.fuente.texto)} ↗</a>
  </div>
</div>`).join('')}`
}

// La Agenda — lo que la data PIDE, masticado: problema + acción ambiciosa + fecha. Neutral. "El que lo ejecute, gana."
const AGENDA = [
  { area: 'Médicos y salud mental', problema: '36 municipios de PR no tienen un solo psiquiatra; Hormigueros tiene 0 para 16,614 personas. Y el 55% de los médicos se retira para 2030.', accion: 'Inscribir los centros 330/FQHC del área como sitios aprobados por el NHSC: destraba hasta $75,000 de repago de préstamos por médico, sin pedir un solo dólar nuevo. Y activar telemedicina en los pueblos donde el internet ya cubre el 80%+.', fecha: 'Antes de 2030', ref: '/telemedicina' },
  { area: 'Medicaid', problema: 'El financiamiento federal de Medicaid de PR cae de 76% a 55% si el Congreso no actúa: golpe directo a la salud de casi la mitad de los boricuas.', accion: 'Gestión congresional coordinada + un plan de contingencia municipal para la red de salud local antes de la fecha.', fecha: '30 sep 2027', ref: '/prediccion' },
  { area: 'Luz', problema: 'Puerto Rico paga la luz a ~24.5¢/kWh: casi el doble del promedio de EE.UU.', accion: 'Acelerar solar comunitario y microrredes en edificios públicos (escuelas, centros de gobierno) + exigir que se publiquen las métricas de confiabilidad por pueblo.', fecha: '', ref: '/luz' },
  { area: 'Basura', problema: 'La mayoría de los ~29 vertederos de PR ya está sobre capacidad; la EPA tiene acuerdos para cerrar 12.', accion: 'Plan regional de transbordo + reciclaje serio con metas medibles, no solo mover la basura de un pueblo a otro.', fecha: '', ref: '/basura' },
  { area: 'Agua', problema: 'El récord federal de la EPA muestra violaciones de salud activas en los acueductos comunitarios del oeste.', accion: 'Canalizar el Fondo Rotatorio de Agua Potable (DWSRF) + la asistencia técnica gratis (RCAP) a esos acueductos para cerrar las violaciones.', fecha: '', ref: '/agua' },
  { area: 'La recuperación', problema: 'De cada dólar de contrato de recuperación rastreado, ~87 centavos salieron de PR hacia el mainland.', accion: 'Exigir requisitos de contratación y subcontratación local en los fondos que aún no se han gastado (HUD CDBG-DR): que el dinero de reconstruir PR construya también su economía.', fecha: '', ref: '/sigue-el-dinero' },
]
function renderAgenda() {
  return `<h2 id="agenda">La agenda que sale de la data</h2>
<p class="text-slate-600 -mt-2">Esto no es opinión partidista: es lo que la data pide, masticado. El problema, la acción concreta, y cuándo. <strong>Cualquiera que se atreva a ejecutarlo — el que sea — gana.</strong></p>
${AGENDA.map((a, i) => `
<div class="not-prose border border-slate-200 bg-white rounded-2xl p-5 mt-4">
  <div class="flex items-baseline justify-between gap-3 flex-wrap">
    <h3 class="text-lg font-black text-slate-900" style="font-family:'Fraunces',Georgia,serif">${i + 1}. ${escapeHtml(a.area)}</h3>
    ${a.fecha ? `<span class="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1">${escapeHtml(a.fecha)}</span>` : ''}
  </div>
  <p class="text-sm text-slate-600 mt-2"><strong>El problema:</strong> ${escapeHtml(a.problema)}</p>
  <p class="text-sm text-slate-800 mt-2"><strong>La jugada:</strong> ${escapeHtml(a.accion)}</p>
  <p class="text-xs text-slate-400 mt-2"><a href="${a.ref}" class="text-teal-700 underline">Ver la data →</a></p>
</div>`).join('')}`
}

// /prediccion — la síntesis: qué dicen todos los récords juntos si no hacemos nada.
// Números verificados (con enlace a su récord); las conexiones/proyecciones son análisis, no profecía.
function handlePrediccion(req: any, res: any) {
  const body = `
<h1>Predicción 2030: lo que dicen todos los récords juntos</h1>
<p class="text-lg text-slate-600 mt-2">Cada récord de este sitio cuenta una parte. Esta página los junta y pregunta: <strong>si Puerto Rico no hace nada, ¿a dónde llega en 2030?</strong> Los números salen de las fuentes federales (cada uno con su récord enlazado). Las conexiones y las proyecciones son lectura, no profecía. Si un número está mal, se corrige.</p>

<div class="not-prose mt-5 bg-slate-900 text-white rounded-2xl p-5">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">El titular</p>
  <p class="text-xl sm:text-2xl font-black mt-1 leading-snug">Estamos reconstruyendo edificios para una población que se queda sin quien la atienda.</p>
</div>

<div class="not-prose mt-5 bg-white border border-slate-200 rounded-2xl p-4">
  <p class="text-sm font-bold text-slate-700 mb-2">🎧 Escúchalo: la predicción en audio</p>
  <audio controls preload="none" class="w-full" src="https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/podcast/prediccion-2030-pr.m4a">Tu navegador no puede reproducir el audio. <a href="https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/podcast/prediccion-2030-pr.m4a" class="text-teal-700 font-semibold">Descárgalo</a>.</audio>
</div>

${renderAlertas()}

<h2>1. El cuadro: lo inerte se reconstruye, lo vivo se erosiona</h2>
<p>Los fondos federales fluyen hacia lo físico mientras el capital humano de salud desaparece en silencio. La brecha, en cifras:</p>
<div class="not-prose overflow-auto border border-slate-200 rounded-xl mt-3 mb-4">
  <table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th class="py-2 px-3">Municipio</th><th class="py-2 px-3 text-right">Fondos FEMA</th><th class="py-2 px-3">Realidad médica</th></tr></thead><tbody>
  <tr class="border-t border-slate-100"><td class="py-2 px-3 font-semibold">Total PR (78 municipios)</td><td class="py-2 px-3 text-right">~$8,755 millones</td><td class="py-2 px-3">3 municipios con 0 especialistas; 36 con 0 psiquiatras</td></tr>
  <tr class="border-t border-slate-100"><td class="py-2 px-3 font-semibold">Jayuya</td><td class="py-2 px-3 text-right">$424 millones</td><td class="py-2 px-3">2 especialistas / 0 psiquiatras</td></tr>
  <tr class="border-t border-slate-100"><td class="py-2 px-3 font-semibold">Maricao</td><td class="py-2 px-3 text-right">$183 millones ($31,807/hab, el más alto de la isla)</td><td class="py-2 px-3">0 especialistas / 0 psiquiatras</td></tr>
  <tr class="border-t border-slate-100"><td class="py-2 px-3 font-semibold">Añasco</td><td class="py-2 px-3 text-right">$316 millones</td><td class="py-2 px-3">13 especialistas / 0 psiquiatras</td></tr>
  </tbody></table>
</div>
<p><strong>El cupón sin cobrar:</strong> 65 de 76 municipios tienen designación federal de escasez activa; 33 (792,221 personas) tienen el dinero de salud mental aprobado y cero psiquiatras. El incentivo (repago de préstamos hasta $75,000) existe, pero falta el "sitio aprobado" donde el médico se pare a cobrarlo. <a href="/registro/estado" class="text-teal-700 font-semibold">Ver el récord →</a></p>
<p><strong>La tormenta que se junta:</strong> se proyecta que el 55% de los médicos activos se retire para 2030; el financiamiento federal de Medicaid cae de 76% a 55% el 30 de septiembre de 2027; y Medicare Advantage paga en PR ~41% menos que en los estados. Tres presiones, una misma dirección.</p>
<p><strong>El agua debajo de todo:</strong> el récord federal de la EPA muestra 13 violaciones de salud activas en el oeste — Cabo Rojo con 3 (trihalometanos) y Periche (San Germán) con 4. <a href="/agua" class="text-teal-700 font-semibold">Ver el récord →</a></p>
<p><strong>La presión que decide todo lo demás:</strong> ninguna de esas crisis se enfrenta sin gente que la trabaje, la cobre y la exija. En 2024 la tasa de participación laboral de PR fue <b>40.7%</b> — menos de la mitad de la población en edad de trabajar está activa, contra ~63% en EE.UU. <i>(Banco Mundial/BLS, 2024.)</i> No es pereza: por décadas, en una economía armada así, depender de fondos externos fue la apuesta segura y subir de valor no tenía herramienta. <i>(NBER, 2005.)</i> La AI es la primera grieta en esa pared — sube tu propio valor sin capital, sin permiso y sin irte de la isla. Pero solo sirve si se agarra; y en un pueblo donde todavía le preguntan «¿qué es eso?», esa es la presión de fondo que decide si las otras se enfrentan o se heredan. <a href="/prediccion#alertas" class="text-teal-700 font-semibold">Ver la alerta →</a></p>

<h2>2. Puerto Rico 2030 bajo la inercia</h2>
<p>De seguir así, municipios como <strong>Maricao, Las Marías y Jayuya</strong> serán monumentos a la ineficiencia: clínicas nuevas, reconstruidas con la inversión más alta por habitante de la isla, sin un solo médico dentro. Es pérdida del 100% de utilidad de esa inversión federal.</p>
<p>La crisis de salud mental se agudiza en los 33 municipios del cupón sin cobrar. <strong>Guánica</strong> es el caso: el municipio más pobre de PR (63.6% de pobreza), puntuación máxima de necesidad, cero psiquiatras.</p>
<p>Y en el oeste, la data de densidad predice "muerte por inanición" en sectores sobreofertados: Cabo Rojo tiene ~195 restaurantes (1 por cada 242 residentes, frente a 1 por 1,500 en el resto de PR) mientras la gente le pide al *7711, sin encontrar, electricistas, plomeros y especialistas (neumólogos, urólogos: cero en el municipio). <a href="/demanda" class="text-teal-700 font-semibold">Ver la demanda →</a></p>

<h2>3. Qué debemos hacer (de más palanca al menos)</h2>
<ul>
  <li><strong>Activar sitios NHSC (casi gratis).</strong> No pedir fondos nuevos: gestionar los existentes. Los centros 330/FQHC ya establecidos inscriben sus instalaciones como "sitios aprobados", y eso destraba el repago de hasta $75,000 por médico. Conecta el incentivo con el pueblo sin legislación nueva.</li>
  <li><strong>Patentes municipales informadas por data.</strong> Con 1 restaurante por cada 242 residentes, el municipio puede orientar a los emprendedores lejos de sectores saturados y hacia la demanda real insatisfecha (técnicos HVAC, electricistas, especialistas).</li>
  <li><strong>Agua: canalizar el Fondo Rotatorio (DWSRF) + asistencia técnica gratis (RCAP)</strong> a los acueductos comunitarios como Periche para cerrar las violaciones activas.</li>
</ul>

<h2>4. Lo que todavía no sabemos</h2>
<p>La ausencia de estos datos es en sí un fallo de gobernanza. Para predecir mejor faltan: la estabilidad real de la red de <strong>LUMA</strong> (frecuencia de apagones) y la capacidad restante de los <strong>vertederos</strong>; la magnitud de la <strong>economía informal</strong> (construcción, repostería casera) invisible al sistema contributivo; y los datos de <strong>movimiento y gasto real</strong> (Cabo Rojo tiene 47,158 residentes pero un "pull" regional de ~75,000, con ingreso real de $26,408 muy por debajo de los benchmarks de EE.UU.). <a href="/costo-de-vida" class="text-teal-700 font-semibold">¿El sueldo rinde en PR? →</a> <a href="/luz" class="text-teal-700 font-semibold">/luz</a> · <a href="/basura" class="text-teal-700 font-semibold">/basura</a> ya arrancaron esa ingesta.</p>

<div class="not-prose bg-teal-50 border border-teal-200 rounded-2xl p-6 mt-8 text-center">
  <p class="text-lg font-black text-slate-900" style="font-family:'Fraunces',Georgia,serif">La predicción no es destino. Es lo que pasa si no escogemos otra cosa.</p>
  <p class="mt-2 text-sm text-slate-600 italic">Para escoger, primero hay que ver. Si te sirve, úsalo.</p>
</div>

<div class="not-prose border-l-4 border-slate-300 bg-slate-50 rounded-r-xl p-5 mt-8">
  <p class="text-xs uppercase tracking-widest text-slate-400 font-bold">El porqué, más hondo · esto ya no es récord, es reflexión</p>
  <p class="text-slate-700 mt-2">Estos récords hacen una cosa importante: quitan la culpa. Si el sistema reconstruye edificios pero pierde al médico, y el sueldo rinde un tercio, la gente no se quedó atrás por falta de ganas. La escalera no estaba.</p>
  <p class="text-slate-700 mt-2">Pero hay una idea más vieja que cualquiera de estos números, y es la que de verdad pesa: <em>"aquí no se puede."</em> Esa también se instaló — y también se reescribe.</p>
  <p class="mt-3"><a href="https://www.angelanderson.com/te-programaron" class="text-teal-700 font-semibold">Te programaron a creer que no puedes. Empieza por ahí. →</a></p>
  <p class="text-xs text-slate-400 italic mt-2">Si no te sirve, sigue tu camino.</p>
</div>

<p class="text-sm text-slate-500 mt-6">Cómo se hizo: síntesis de los récords verificados de este sitio (NPPES/CMS, HRSA, OpenFEMA, EPA, Censo/ACS, El Veci *7711), asistida por IA sobre esas fuentes primarias. Los números son verificables en cada récord enlazado; las conexiones y proyecciones son análisis. ¿Ves un error? <a href="mailto:angel@angelanderson.com" class="text-teal-700">escríbenos</a> y se corrige. Julio 2026.</p>
`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Report',
    name: 'Predicción 2030: El estado de situación de Puerto Rico',
    about: 'Síntesis de los récords verificados de PR (salud, recuperación federal, agua, demanda) proyectada a 2030.',
    author: { '@type': 'Person', name: 'Angel Anderson' },
    publisher: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' },
    inLanguage: 'es', datePublished: '2026-07-05', url: 'https://puertoricosinfiltros.com/prediccion',
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: 'Predicción 2030 — lo que dicen todos los récords de Puerto Rico juntos',
    description: 'Si Puerto Rico no hace nada, ¿a dónde llega en 2030? La síntesis de los récords verificados: reconstruimos edificios para una población que se queda sin médicos. Con la fuente al lado.',
    slug: 'prediccion', bodyHtml: body, jsonLd, ogImage: OG_SINFILTROS,
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
  }))
}

// /costo-de-vida — factor de decisión: ¿el sueldo rinde en PR? Ingreso vs costo real.
// Números verificados (Censo/ACS, EIA). Premio sin reclamar + gap honesto declarado.
async function handleCostoDeVida(req: any, res: any) {
  // Panel oficial en vivo — lee de pr_cost_indicators (curado, citable, 1 SQL/mes).
  // Fuente única de verdad: la misma tabla alimenta este panel y el bot (COSTO).
  let costoPanel = ''
  try {
    const { data: ind } = await supabase.from('pr_cost_indicators')
      .select('slug,label,value_display,period,yoy_change,mom_change,category,is_official,source_name,source_url,as_of_date,published_date,note,sort_order')
      .order('sort_order', { ascending: true })
    if (ind && ind.length) {
      const bySlug: Record<string, any> = {}; ind.forEach((r: any) => { bySlug[r.slug] = r })
      const dolar = bySlug['dolar_valor']; const ipc = bySlug['ipc_general']; const canasta = bySlug['canasta_basica']
      const period = ipc?.period || dolar?.period || ''
      const pub = ipc?.published_date ? new Date(ipc.published_date + 'T00:00:00').toLocaleDateString('es-PR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
      // Valida el protocolo del href (escapeHtml NO neutraliza javascript:) — defensa en profundidad
      let srcHref = '#'
      try { const u = new URL(String(ipc?.source_url || '')); if (u.protocol === 'https:' || u.protocol === 'http:') srcHref = escapeHtml(u.toString()) } catch { srcHref = '#' }
      // Grupos con alza interanual (excluye los hero y la canasta), ordenados por golpe
      const groups = ind.filter((r: any) => r.yoy_change != null && !['dolar_valor', 'ipc_general'].includes(r.slug) && r.slug !== 'canasta_basica')
        .sort((a: any, b: any) => (b.yoy_change || 0) - (a.yoy_change || 0))
      const grpCells = groups.map((g: any) => {
        const hot = (g.yoy_change || 0) >= 5
        return `<div class="rounded-xl border ${hot ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'} p-3">
          <div class="text-2xl font-black ${hot ? 'text-red-600' : 'text-slate-800'}">+${(g.yoy_change).toFixed(1)}%</div>
          <div class="text-xs font-semibold text-slate-700 mt-0.5">${escapeHtml(g.label)}</div>
          <div class="text-[11px] text-slate-400">en 12 meses</div>
        </div>`
      }).join('')
      costoPanel = `
<div class="not-prose mt-6 bg-white border-2 border-slate-900 rounded-2xl overflow-hidden">
  <div class="bg-slate-900 text-white px-5 py-3">
    <p class="text-[11px] uppercase tracking-widest text-teal-300 font-bold m-0">Pulso oficial · ${escapeHtml(period)}</p>
    <p class="text-sm text-slate-300 mt-0.5 mb-0">Lo que de verdad pasó con tu dinero, con el número del gobierno al lado.</p>
  </div>
  <div class="p-5">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div class="rounded-xl bg-slate-900 text-white p-4">
        <div class="text-4xl font-black text-teal-300">${escapeHtml(dolar?.value_display || '—')}</div>
        <div class="text-sm font-semibold mt-1">es lo que compra hoy tu dólar</div>
        <div class="text-xs text-slate-300 mt-1">${escapeHtml(dolar?.note || '')}</div>
      </div>
      <div class="rounded-xl bg-red-50 border border-red-200 p-4">
        <div class="text-4xl font-black text-red-600">+${ipc?.yoy_change != null ? Number(ipc.yoy_change).toFixed(1) : '—'}%</div>
        <div class="text-sm font-semibold text-slate-800 mt-1">subió todo, junto, en un año</div>
        <div class="text-xs text-slate-500 mt-1">${escapeHtml(ipc?.note || '')}</div>
      </div>
    </div>
    <p class="text-xs uppercase tracking-widest text-slate-400 font-bold mt-5 mb-2">Dónde pegó más fuerte (últimos 12 meses)</p>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">${grpCells}</div>
    ${canasta ? `<div class="mt-5 rounded-xl border-l-4 border-amber-400 bg-amber-50 p-4">
      <p class="text-sm font-bold text-slate-900 m-0">Y la comida del día a día: <span class="text-amber-700">${escapeHtml(canasta.value_display)}</span></p>
      <p class="text-xs text-slate-600 mt-1 mb-0">${escapeHtml(canasta.note || '')}</p>
    </div>` : ''}
    <div class="mt-5 rounded-xl bg-teal-50 border border-teal-200 p-4">
      <p class="text-sm font-bold text-teal-900 m-0">Qué hacer con esto hoy (no es tu culpa, pero sí tu jugada)</p>
      <ul class="text-sm text-slate-700 mt-2 mb-0 space-y-1 list-disc pl-5">
        <li>Transportación es el golpe #1. Antes de echar gasolina, pregúntale a <strong>El Veci</strong> quién la tiene más barata: textea <strong>GASOLINA</strong> al <a href="https://wa.me/17874177711?text=gasolina" class="text-teal-700 font-semibold">787-417-7711</a>.</li>
        <li>La luz al doble es la otra sangría fija. <a href="/luz" class="text-teal-700 font-semibold">Ve el récord y baja lo que puedas →</a></li>
        <li>El sueldo tiene techo; lo tuyo no. La parte de tu ingreso que crece sin techo es la que tú controlas. <a href="/trabajo" class="text-teal-700 font-semibold">Cómo se voltea →</a></li>
        <li>Si tienes hijos: hay dinero federal que quizás no estás cobrando (hasta $1,700 por hijo). <a href="/cupon" class="text-teal-700 font-semibold">Ve cuánto y cómo se reclama →</a></li>
      </ul>
    </div>
    <p class="text-[11px] text-slate-400 mt-4 mb-0">Fuente: <a href="${srcHref}" class="text-slate-500 underline" rel="nofollow">${escapeHtml(ipc?.source_name || 'DTRH')}</a>${pub ? `, publicado ${escapeHtml(pub)}` : ''}. Base dic-2006=100. Canasta: ${escapeHtml(canasta?.source_name || 'DACO')}. Actualizamos cuando el gobierno publica.</p>
  </div>
</div>`
    }
  } catch (e) { console.error('costo panel:', e); costoPanel = '' }

  const body = `
<h1>¿El sueldo rinde en Puerto Rico?</h1>
<p class="text-lg text-slate-600 mt-2">Antes de decidir si te quedas, te vas o te mudas, hay un número que casi nadie te pone claro: <strong>lo que ganas contra lo que cuesta vivir aquí.</strong> Esta página lo junta, con la fuente al lado. Para escoger la vida que quieres, primero hay que ver el número sin filtro.</p>

<div class="not-prose mt-5 bg-slate-900 text-white rounded-2xl p-5">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">El titular</p>
  <p class="text-xl sm:text-2xl font-black mt-1 leading-snug">Ganas cerca de un tercio, pero pagas como si ganaras el doble.</p>
</div>

<div class="not-prose mt-5 bg-white border border-slate-200 rounded-2xl p-4">
  <div class="flex items-start gap-3">
    <div class="text-2xl leading-none">🎧</div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-bold text-slate-800 m-0">Escúchalo en vez de leerlo</p>
      <p class="text-xs text-slate-500 mt-0.5 mb-2">Análisis en audio (es-419). Ponlo mientras guías.</p>
      <audio controls preload="none" class="w-full" src="https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/podcast/prsf/costo-de-vida.m4a">Tu navegador no puede reproducir el audio. <a href="https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/podcast/prsf/costo-de-vida.m4a" class="text-teal-700 font-semibold">Descárgalo</a>.</audio>
    </div>
  </div>
</div>
${costoPanel}
<h2>1. Lo que ganas</h2>
<p>El ingreso mediano de un hogar en Puerto Rico ronda los <b>$25,000</b> al año; en Estados Unidos es <b>~$81,600</b>. Es <strong>cerca de un tercio.</strong> Y cerca del <b>40%</b> de la población vive bajo el nivel de pobreza federal — más del triple que el estado más pobre del continente. <i>(Censo / Encuesta sobre la Comunidad de PR, ACS 2019-2023 y 2024.)</i></p>

<h2>2. Pero vivir aquí no es barato</h2>
<p>La trampa es que el ingreso bajo no viene con un costo bajo. Al revés:</p>
<ul>
  <li><strong>La luz al doble.</strong> PR paga ~<b>24.5¢/kWh</b>, casi el doble del promedio de EE.UU. <a href="/luz" class="text-teal-700 font-semibold">Ver el récord →</a></li>
  <li><strong>La comida importada, más cara.</strong> Los comestibles corren estimados <b>15-30% por encima</b> del mainland — no por gusto, sino por el costo de envío bajo la <strong>Ley Jones</strong> (Jones Act), que obliga a que la carga entre en barcos de EE.UU. Un galón de leche: $4-6. <i>(Estimados de mercado; el mecanismo — la Ley Jones — es la parte verificable.)</i></li>
  <li><strong>La canasta, con número del gobierno.</strong> DACO publica una <strong>Canasta Básica de Emergencias</strong> (Orden 2021-012): <b>$256.57 al mes para 4 personas</b> ($324.58 para 6, $419.53 para 8), más un Historial de Precios Mayoristas. <i>(DACO, Orden 2021-012.)</i></li>
</ul>
<p><strong>El resultado en la calle:</strong> el dólar rinde menos aquí que en casi cualquier estado. No es percepción — es un ingreso de estado pobre con precios de isla importadora.</p>

<h2>3. La matemática que no te enseñaron</h2>
<p>Esto no te lo enseñaron en la escuela — ni aquí ni en casi ningún sitio. Por eso lo ponemos con número.</p>
<p>El salario mínimo de PR es <b>$10.50 la hora</b> (desde julio de 2024). <i>(Departamento del Trabajo de PR, Ley 47-2022.)</i> A tiempo completo son ~<b>$1,820 al mes</b> antes de impuestos (~$21,840 al año). Eso es <strong>menos</strong> que el ingreso mediano de un hogar ($25,000): con un solo sueldo mínimo, un hogar ni llega a la mitad de la isla. Y ese piso choca con lo de arriba — la luz al doble, la comida 15-30% más. A una persona la cubre a duras penas; a una familia no le da.</p>
<p><strong>La regla que nadie te dice:</strong> el salario mínimo es un <strong>piso, no una meta.</strong> Un ingreso sano <strong>crece cada año</strong>, por encima de lo que sube la vida. Si el tuyo lleva años pegado al mínimo, no es que valgas el mínimo — es que un sueldo tiene techo (lo fija otro) y nadie te enseñó a construir lo que no lo tiene.</p>
<p><strong>Y aquí está la parte que sí es tuya:</strong> el pedazo de tu ingreso que crece sin techo es el que <strong>tú controlas</strong> — un servicio propio, un oficio que cobras directo, algo que sigue produciendo aunque no estés vendiendo tu hora. El sueldo lo topa tu jefe; lo tuyo lo topas tú. La meta no es un mejor mínimo: es que una parte de lo que ganas deje de depender de la hora que vendes.</p>

<h2>4. Por qué esto empuja a irse — y la jugada que lo voltea</h2>
<p>Esta es la matemática que se lleva a la gente pa'l avión: si ganas lo mismo aquí que allá pero el dólar rinde más allá, mudarse es racional. Por décadas esa fue la única salida.</p>
<p>Pero la ecuación acaba de cambiar. <strong>La primera vez en la historia, una persona puede ganar en dólares del mundo entero sin salir de la isla</strong> — trabajo remoto, servicio propio, valor que sube con AI — y vivir donde el costo es menor. Eso voltea la trampa: en vez de mudarte a donde pagan más, subes tu valor donde ya estás. Pero solo sirve si se agarra la herramienta. <a href="/prediccion#alertas" class="text-teal-700 font-semibold">Ver cómo la AI corta y a la vez abre →</a></p>

<h2>5. El premio sin reclamar</h2>
<p>Hoy nadie publica <strong>la canasta real por pueblo.</strong> Todo son promedios de isla, y un promedio esconde que en un pueblo el dólar rinde y en otro no. El municipio (o el vecino con data) que publique el costo real de vivir en SU pueblo — renta, luz, canasta, transporte — <strong>le da munición al que evalúa mudarse allí y al que quiere abrir negocio donde hay gente que puede pagar.</strong> El primero que lo haga, marca el estándar. El que se atreva, gana.</p>
<p><strong>Ya arrancamos por el pedazo más pesado y más variable: la vivienda.</strong> Cuánto del ingreso local se come el techo, pueblo por pueblo, con el número del Censo al lado. <a href="/rendimiento" class="text-teal-700 font-semibold">Ve dónde rinde más tu dólar en PR →</a></p>

<h2>6. El número que el gobierno no tiene — y nosotros sí podemos armar</h2>
<p>Aquí está el hueco de verdad, y no es nuestro: <strong>el propio gobierno admitió en 2025 que no tiene un número claro de lo que cuesta la canasta básica del día a día en Puerto Rico.</strong> <i>(DACO, secretaria Natalia Catoni, vía El Vocero, 2025.)</i> DACO publica una canasta de emergencias y un historial de precios mayoristas, pero no un índice del costo real de vivir, pueblo por pueblo.</p>
<p>Eso no es un "no se puede medir" — es un "nadie lo ha armado." Y entre los precios que DACO sí publica y lo que este substrato ya tiene — la luz de la EIA en <a href="/luz" class="text-teal-700 font-semibold">/luz</a>, el ingreso del Censo, la demanda real del 787-417-7711, los negocios verificados del mapa — <strong>la canasta por pueblo se puede construir, con histórico, hasta proyectar hacia dónde va.</strong> Ese es el próximo récord, no un callejón sin salida.</p>

<div class="not-prose bg-teal-50 border border-teal-200 rounded-2xl p-6 mt-8 text-center">
  <p class="text-lg font-black text-slate-900" style="font-family:'Fraunces',Georgia,serif">Puerto Rico podría ser donde una familia vive con dignidad con menos — si se ve claro dónde.</p>
  <p class="mt-2 text-sm text-slate-600 italic">Para escoger, primero hay que ver el número. Si te sirve, úsalo.</p>
</div>

<div class="not-prose border-l-4 border-slate-300 bg-slate-50 rounded-r-xl p-5 mt-8">
  <p class="text-xs uppercase tracking-widest text-slate-400 font-bold">El porqué, más hondo · esto ya no es récord, es reflexión</p>
  <p class="text-slate-700 mt-2">El número hace una cosa importante: te quita la culpa. Si el sueldo rinde un tercio y el costo es el doble, no te quedaste atrás por falta de ganas. La escalera no estaba.</p>
  <p class="text-slate-700 mt-2">Pero hay una idea más vieja que el bolsillo, y es la que de verdad pesa: <em>"aquí no se puede."</em> Esa también se instaló — y también se reescribe.</p>
  <p class="mt-3"><a href="https://www.angelanderson.com/te-programaron" class="text-teal-700 font-semibold">Te programaron a creer que no puedes. Empieza por ahí. →</a></p>
  <p class="text-xs text-slate-400 italic mt-2">Si no te sirve, sigue tu camino.</p>
</div>

<p class="text-sm text-slate-500 mt-6">Cómo se hizo: ingreso y pobreza del Censo/ACS (Encuesta sobre la Comunidad de PR); precios de la canasta de DACO (Orden 2021-012); tarifa de luz de la EIA vía el récord <a href="/luz" class="text-teal-700">/luz</a>; el sobrecosto de comestibles se atribuye al costo de envío bajo la Ley Jones (mecanismo verificable; los porcentajes exactos son estimados de mercado). Las conexiones son análisis. ¿Ves un error? <a href="mailto:angel@angelanderson.com" class="text-teal-700">escríbenos</a> y se corrige. Julio 2026.</p>
`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Report',
    name: '¿El sueldo rinde en Puerto Rico? Ingreso contra costo de vida',
    about: 'El ingreso mediano de PR (~$25,000) contra el costo real de vivir en la isla (luz al doble, comida importada 15-30% más cara), como factor de la decisión de quedarse, irse o mudarse.',
    author: { '@type': 'Person', name: 'Angel Anderson' },
    publisher: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' },
    inLanguage: 'es', datePublished: '2026-07-06', url: 'https://puertoricosinfiltros.com/costo-de-vida',
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: '¿El sueldo rinde en Puerto Rico? Ingreso contra costo de vida',
    description: 'Ganas cerca de un tercio del ingreso de EE.UU., pero pagas la luz al doble y la comida importada 15-30% más cara. El número que pesa en la decisión de quedarte, irte o mudarte — con la fuente al lado.',
    slug: 'costo-de-vida', bodyHtml: body, jsonLd, ogImage: OG_SINFILTROS,
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
  }))
}

// /trabajo — factor de decisión: ¿hay futuro de trabajo en PR? Lo que se cae, lo que abre.
// Números verificados (Censo/BLS, FMI, DOL/corte). Premio sin reclamar + puente a te-programaron.
function handleTrabajo(req: any, res: any) {
  const body = `
<h1>¿Hay futuro de trabajo en Puerto Rico?</h1>
<p class="text-lg text-slate-600 mt-2">Antes de decidir si te quedas, te vas o te mudas, hay una pregunta que pesa más que el sueldo de hoy: <strong>¿de qué se va a vivir aquí en 5 años?</strong> Esta página junta lo que se está cayendo, lo que la AI no puede tocar, y la jugada que voltea la trampa. Con la fuente al lado.</p>

<div class="not-prose mt-5 bg-slate-900 text-white rounded-2xl p-5">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">El titular</p>
  <p class="text-xl sm:text-2xl font-black mt-1 leading-snug">El trabajo que se cae primero es el de pantalla. El que queda, la AI no lo toca — pero hay que agarrar la herramienta.</p>
</div>

<div class="not-prose mt-5 bg-white border border-slate-200 rounded-2xl p-4">
  <div class="flex items-start gap-3">
    <div class="text-2xl leading-none">🎧</div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-bold text-slate-800 m-0">Escúchalo en vez de leerlo</p>
      <p class="text-xs text-slate-500 mt-0.5 mb-2">Análisis en audio (es-419). Ponlo mientras guías.</p>
      <audio controls preload="none" class="w-full" src="https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/podcast/prsf/trabajo.m4a">Tu navegador no puede reproducir el audio. <a href="https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/podcast/prsf/trabajo.m4a" class="text-teal-700 font-semibold">Descárgalo</a>.</audio>
    </div>
  </div>
</div>

<h2>1. El número que casi nadie mira</h2>
<p>En 2024, la tasa de participación laboral de Puerto Rico fue <b>40.7%</b> — menos de la mitad de la población en edad de trabajar está en la fuerza laboral, contra ~63% en Estados Unidos. <i>(Banco Mundial / BLS, 2024.)</i> No es pereza: por décadas, en una economía armada así, depender de fondos externos fue la apuesta segura y subir de valor no tenía camino. <i>(NBER, 2005.)</i></p>

<h2>2. Lo que se cae primero</h2>
<p>La AI no reemplaza al que arregla tu nevera. Reemplaza primero los <strong>trabajos de pantalla</strong>: servicio al cliente remoto, data entry, oficina, contenido, traducción. El FMI proyecta que ~<b>60%</b> de los empleos en economías avanzadas están expuestos a la AI, y cerca de la mitad con riesgo de salario más bajo o menos contratación. <i>(FMI, 2024.)</i> <strong>En PR esos son los empleos de exportación</strong> (Ley 20, BPO) que traen dólares a familias que no se fueron de la isla. <a href="/prediccion#alertas" class="text-teal-700 font-semibold">Ver la alerta →</a></p>
<p><strong>Y una puerta que casi se cierra:</strong> en 2025 el gobierno federal trató de cerrar los 99 centros de <strong>Job Corps</strong> operados por contrato — 2 de ellos en Puerto Rico. Una corte federal lo frenó como ilegal, y por ahora siguen abiertos, pero su futuro quedó en manos del Congreso. <i>(DOL, orden del 29 de mayo de 2025; inyunción preliminar, 25 de junio de 2025.)</i> Se cierran las entradas al trabajo justo cuando más faltan.</p>

<h2>3. Lo que la AI NO toca</h2>
<p>Aquí está el giro que casi nadie dice: la AI hace <strong>más</strong> valioso el trabajo de manos y de cuido. El plomero, la enfermera, el mecánico, el que instala el solar, la que cuida — eso no sube por una pantalla. Topado por cuerpos, no por AI. Y cuando el directorio y el <strong>787-417-7711</strong> le mandan clientes al que resuelve, la herramienta lo <strong>amplifica</strong> en vez de reemplazarlo. La economía de manos es el lado firme del piso.</p>

<h2>4. La jugada que voltea la trampa</h2>
<p>Por décadas, la única salida era el avión: mudarse a donde el trabajo de pantalla pagaba más. La AI acaba de cambiar la ecuación. <strong>Por primera vez, una persona puede subir su propio valor sin capital, sin permiso y sin salir de la isla</strong> — un servicio propio, una lista de clientes, valor que la AI multiplica en vez de borrar. El cruce no es "usa la AI para hacer tu trabajo más rápido" (eso acelera tu reemplazo). Es <strong>empleado → operador</strong>: el que manda la herramienta en vez de competir contra ella. <a href="/costo-de-vida" class="text-teal-700 font-semibold">Y ganar en dólares donde el costo rinde →</a></p>

<h2>5. El premio sin reclamar</h2>
<p>Job Corps enseñaba a ser <strong>empleado</strong>. El hueco que dejó al tambalearse se llena con algo mejor: <strong>la escuela, la ONG o el pueblo que monte formación de operador-AI</strong> — no de empleado — le da a la próxima generación una herramienta que sí sube el valor, y que no depende de que un contrato federal sobreviva en una corte. El primero que lo haga, se gana esa generación. El que se atreva, gana.</p>

<div class="not-prose bg-teal-50 border border-teal-200 rounded-2xl p-6 mt-8 text-center">
  <p class="text-lg font-black text-slate-900" style="font-family:'Fraunces',Georgia,serif">Puerto Rico podría formar gente que compite con el mundo entero desde el pueblo — en vez de exportarla. La AI lo hace posible por primera vez.</p>
  <p class="mt-2 text-sm text-slate-600 italic">Para escoger, primero hay que ver el camino. Si te sirve, úsalo.</p>
</div>

<div class="not-prose border-l-4 border-slate-300 bg-slate-50 rounded-r-xl p-5 mt-8">
  <p class="text-xs uppercase tracking-widest text-slate-400 font-bold">El porqué, más hondo · esto ya no es récord, es reflexión</p>
  <p class="text-slate-700 mt-2">El número hace una cosa importante: te quita la culpa. Si la mitad del país no está en la fuerza laboral, no es que medio país sea vago — es que la escalera para subir de valor no estaba. Ahora sí lo tiene.</p>
  <p class="text-slate-700 mt-2">Pero hay una idea más vieja que cualquier estadística, y es la que de verdad pesa: <em>"aquí no se puede."</em> Esa también se instaló — y también se reescribe.</p>
  <p class="mt-3"><a href="https://www.angelanderson.com/te-programaron" class="text-teal-700 font-semibold">Te programaron a creer que no puedes. Empieza por ahí. →</a></p>
  <p class="text-xs text-slate-400 italic mt-2">Si no te sirve, sigue tu camino.</p>
</div>

<p class="text-sm text-slate-500 mt-6">Cómo se hizo: participación laboral del Banco Mundial/BLS; exposición a la AI del FMI (2024); estado de Job Corps de las órdenes del Departamento del Trabajo federal (DOL) y la inyunción de la corte federal (SDNY, junio 2025). Las conexiones son análisis. ¿Ves un error? <a href="mailto:angel@angelanderson.com" class="text-teal-700">escríbenos</a> y se corrige. Julio 2026.</p>
`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Report',
    name: '¿Hay futuro de trabajo en Puerto Rico? Lo que se cae y lo que abre',
    about: 'La participación laboral de PR (40.7%), los trabajos de pantalla que la AI corta primero, el cierre intentado de Job Corps, y el cruce de empleado a operador — como factor de la decisión de quedarse, irse o mudarse.',
    author: { '@type': 'Person', name: 'Angel Anderson' },
    publisher: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' },
    inLanguage: 'es', datePublished: '2026-07-06', url: 'https://puertoricosinfiltros.com/trabajo',
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: '¿Hay futuro de trabajo en Puerto Rico? Lo que se cae y lo que abre',
    description: 'Participación laboral 40.7%, la AI corta los trabajos de pantalla, Job Corps casi cierra — pero la economía de manos aguanta y el cruce a operador abre. El factor trabajo en la decisión de quedarte, irte o mudarte.',
    slug: 'trabajo', bodyHtml: body, jsonLd, ogImage: OG_SINFILTROS,
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
  }))
}

// /exposicion-ai — Índice de Exposición a la AI por municipio. Data nueva: Census (ocupación) × exposición por ocupación (literatura). Ranking robusto (Spearman 0.98-1.0 a distintos pesos).
function handleExposicionAi(req: any, res: any) {
  const EXP = [
{n:"Guaynabo",s:57.0,t:"alto",e:38337},{n:"Trujillo Alto",s:54.9,t:"alto",e:29359},{n:"Hormigueros",s:53.7,t:"alto",e:5389},{n:"Bayamón",s:52.7,t:"alto",e:69669},{n:"Dorado",s:52.6,t:"alto",e:13226},{n:"San Juan",s:51.7,t:"alto",e:133578},{n:"Carolina",s:51.1,t:"alto",e:63071},{n:"Toa Baja",s:50.9,t:"alto",e:31409},{n:"Cataño",s:49.8,t:"alto",e:7707},{n:"Gurabo",s:49.4,t:"alto",e:17399},{n:"Toa Alta",s:49.2,t:"alto",e:28425},{n:"Caguas",s:48.4,t:"alto",e:49666},{n:"Canóvanas",s:48.0,t:"alto",e:16631},{n:"Ponce",s:47.9,t:"alto",e:39132},{n:"Hatillo",s:47.4,t:"alto",e:13829},{n:"Juana Díaz",s:47.2,t:"alto",e:15190},{n:"Cayey",s:47.1,t:"alto",e:15042},{n:"Vega Alta",s:46.9,t:"alto",e:11980},{n:"Juncos",s:46.6,t:"alto",e:14666},{n:"Yauco",s:46.6,t:"alto",e:10883},{n:"Manatí",s:46.6,t:"alto",e:12374},{n:"Río Grande",s:46.5,t:"alto",e:17786},{n:"Aguadilla",s:46.0,t:"alto",e:16365},{n:"Cabo Rojo",s:45.9,t:"alto",e:16821},{n:"Cidra",s:45.9,t:"alto",e:13747},{n:"Vega Baja",s:45.9,t:"alto",e:18003},{n:"Moca",s:45.8,t:"medio",e:12239},{n:"Barceloneta",s:45.8,t:"medio",e:8232},{n:"Sabana Grande",s:45.5,t:"medio",e:6662},{n:"Mayagüez",s:45.4,t:"medio",e:20523},{n:"Rincón",s:45.4,t:"medio",e:5086},{n:"Isabela",s:45.3,t:"medio",e:13414},{n:"Arecibo",s:45.3,t:"medio",e:27409},{n:"Las Piedras",s:45.2,t:"medio",e:12377},{n:"Humacao",s:44.8,t:"medio",e:16125},{n:"Aguada",s:44.6,t:"medio",e:12166},{n:"San Lorenzo",s:44.6,t:"medio",e:13071},{n:"Utuado",s:44.5,t:"medio",e:7951},{n:"Camuy",s:44.3,t:"medio",e:12333},{n:"San Germán",s:44.3,t:"medio",e:8615},{n:"San Sebastián",s:44.1,t:"medio",e:11216},{n:"Arroyo",s:43.7,t:"medio",e:4727},{n:"Aguas Buenas",s:43.5,t:"medio",e:8631},{n:"Morovis",s:43.2,t:"medio",e:10150},{n:"Guayama",s:43.1,t:"medio",e:10928},{n:"Añasco",s:43.0,t:"medio",e:9584},{n:"Luquillo",s:42.3,t:"medio",e:6233},{n:"Florida",s:42.3,t:"medio",e:3752},{n:"Santa Isabel",s:42.0,t:"medio",e:7707},{n:"Adjuntas",s:41.8,t:"medio",e:4946},{n:"Patillas",s:41.8,t:"medio",e:4551},{n:"Barranquitas",s:41.7,t:"medio",e:9443},{n:"Guayanilla",s:41.7,t:"bajo",e:4816},{n:"Comerío",s:41.6,t:"bajo",e:5526},{n:"Fajardo",s:41.6,t:"bajo",e:11306},{n:"Loíza",s:41.5,t:"bajo",e:7295},{n:"Aibonito",s:41.2,t:"bajo",e:7589},{n:"Ceiba",s:41.1,t:"bajo",e:3646},{n:"Jayuya",s:40.8,t:"bajo",e:4407},{n:"Corozal",s:40.6,t:"bajo",e:11484},{n:"Peñuelas",s:40.1,t:"bajo",e:6373},{n:"Villalba",s:40.0,t:"bajo",e:6743},{n:"Lajas",s:40.0,t:"bajo",e:7209},{n:"Yabucoa",s:39.7,t:"bajo",e:8431},{n:"Lares",s:39.4,t:"bajo",e:9014},{n:"Coamo",s:38.9,t:"bajo",e:11485},{n:"Guánica",s:38.7,t:"bajo",e:3552},{n:"Naranjito",s:38.6,t:"bajo",e:9511},{n:"Quebradillas",s:38.5,t:"bajo",e:7359},{n:"Naguabo",s:38.4,t:"bajo",e:7835},{n:"Culebra",s:38.3,t:"bajo",e:710},{n:"Las Marías",s:38.2,t:"bajo",e:2518},{n:"Ciales",s:38.0,t:"bajo",e:4466},{n:"Maricao",s:37.7,t:"bajo",e:1434},{n:"Orocovis",s:37.5,t:"bajo",e:6260},{n:"Salinas",s:36.6,t:"bajo",e:8381},{n:"Maunabo",s:34.7,t:"bajo",e:2858},{n:"Vieques",s:34.6,t:"bajo",e:2868}
  ]
  const col = (t: string) => t === 'alto' ? '#dc2626' : t === 'medio' ? '#d97706' : '#059669'
  const badge = (t: string) => t === 'alto' ? 'más expuesto' : t === 'medio' ? 'intermedio' : 'más resiliente'
  const rowsHtml = EXP.map((m, i) => {
    const w = Math.max(4, Math.min(100, (m.s - 33) / (58 - 33) * 100))
    return `<tr class="border-t border-slate-100">
      <td class="py-1.5 px-2 text-slate-400 text-xs text-right">${i + 1}</td>
      <td class="py-1.5 px-3 font-semibold text-slate-800">${escapeHtml(m.n)}</td>
      <td class="py-1.5 px-2"><div class="flex items-center gap-2"><div class="h-2 rounded-full" style="width:${w.toFixed(0)}%;background:${col(m.t)}"></div><span class="text-xs text-slate-500">${m.s.toFixed(0)}</span></div></td>
      <td class="py-1.5 px-3 text-right text-xs" style="color:${col(m.t)};font-weight:600">${badge(m.t)}</td>
    </tr>`
  }).join('')

  const body = `
<h1>¿Qué pueblos de Puerto Rico están más expuestos a la inteligencia artificial?</h1>
<p class="text-lg text-slate-600 mt-2">"Expuesto" quiere decir una cosa concreta: <strong>cuántos de los empleos del pueblo son del tipo que la inteligencia artificial puede hacer.</strong> Nadie lo había publicado. Cruzamos la composición real de empleos de cada municipio (Censo) con cuánto expone la inteligencia artificial a cada ocupación (literatura académica) y sacamos, por primera vez, un <strong>orden de los 78 municipios de Puerto Rico, del más expuesto al más resiliente.</strong></p>

<div class="not-prose mt-5 bg-slate-900 text-white rounded-2xl p-5">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">El titular (y voltea la narrativa)</p>
  <p class="text-xl sm:text-2xl font-black mt-1 leading-snug">El metro "moderno" es el MÁS expuesto a la inteligencia artificial. El campo, el más resiliente.</p>
</div>

<p>La inteligencia artificial corta primero el trabajo de <strong>pantalla</strong> (oficina, ventas, administración, cómputo). Corta menos el de <strong>manos</strong> (construcción, agricultura, cuido, transporte). Así que los pueblos con más empleo corporativo salen arriba: <strong>Guaynabo, Trujillo Alto, Bayamón, San Juan, Carolina.</strong> Y los del campo salen abajo, los más a salvo: <strong>Maunabo, Vieques, Salinas, Orocovis, Maricao.</strong> Lo que suena "atrasado" es, frente a la inteligencia artificial, lo más resistente. <a href="/trabajo" class="text-teal-700 font-semibold">Por qué, y la salida (el cruce a operador) →</a></p>

<h2>Los 78 municipios, de más expuesto a más resiliente</h2>
<p class="text-slate-600 -mt-1 text-sm">Índice relativo (comparativo, 0-100). Lo que importa es el <strong>orden</strong>, no el número exacto.</p>
<div class="not-prose overflow-auto border border-slate-200 rounded-xl mt-3 mb-2" style="max-height:520px">
  <table class="w-full text-sm"><thead class="sticky top-0 bg-slate-50"><tr class="text-left text-xs uppercase tracking-wide text-slate-500"><th class="py-2 px-2 text-right">#</th><th class="py-2 px-3">Municipio</th><th class="py-2 px-2">Exposición</th><th class="py-2 px-3 text-right">Tier</th></tr></thead><tbody>${rowsHtml}</tbody></table>
</div>
<div class="not-prose flex gap-4 text-xs text-slate-500 mb-6"><span>🔴 más expuesto</span><span>🟠 intermedio</span><span>🟢 más resiliente</span></div>

<h2>Cómo se hizo (y por qué es real, no inventado)</h2>
<p>El principio: no inventar un número. <strong>Unir dos datos públicos que nadie había cruzado.</strong> La novedad es la relación, no el dato.</p>
<ul>
  <li><strong>Fuente 1 — la mezcla de empleos por pueblo:</strong> Censo / ACS 5 años, tabla de ocupación C24010, los 78 municipios. Público.</li>
  <li><strong>Fuente 2 — cuánto expone la inteligencia artificial a cada ocupación:</strong> literatura publicada (Eloundou et al. 2023, "GPTs are GPTs"; índice AIOE de Felten, Raj y Seamans).</li>
  <li><strong>La cuenta:</strong> por cada pueblo, la proporción de sus empleos en cada ocupación, pesada por la exposición de esa ocupación. Un promedio ponderado.</li>
  <li><strong>Lo probamos:</strong> recalculamos el ranking con tres esquemas de pesos distintos y da casi idéntico (correlación de Spearman 0.98 a 1.00). O sea, <strong>el orden lo manda la composición real de empleos, no nuestros pesos.</strong></li>
</ul>

<h2>Lo que este número NO dice (para que nadie lo maluse)</h2>
<ul>
  <li>Es un <strong>ranking relativo</strong>, no una predicción de despidos. Di "más/menos expuesto", no "exactamente 57".</li>
  <li>El Censo no capta la <strong>economía informal</strong> (grande en PR): el trabajo de manos real es aún mayor, así que el campo es probablemente todavía más resiliente de lo que muestra.</li>
  <li>Los índices de exposición son de <strong>EE.UU.</strong> aplicados a PR (asume contenido de tarea similar por ocupación).</li>
  <li><strong>Exposición ≠ reemplazo.</strong> La mitad de lo expuesto se puede <em>aumentar</em> con inteligencia artificial, no borrar (FMI). La salida es volverse el que la maneja. <a href="/trabajo" class="text-teal-700 font-semibold">→ el cruce a operador</a></li>
</ul>

<div class="not-prose bg-teal-50 border border-teal-200 rounded-2xl p-6 mt-8 text-center">
  <p class="text-lg font-black text-slate-900" style="font-family:'Fraunces',Georgia,serif">Saber a qué te expone la inteligencia artificial es el primer paso para ponerte del lado que la maneja.</p>
  <p class="mt-2 text-sm text-slate-600 italic">Para escoger, primero hay que ver. Si te sirve, úsalo.</p>
</div>

<p class="text-sm text-slate-500 mt-6">Cómo se hizo: ocupación por municipio del Censo/ACS (tabla C24010, vía Census Reporter); exposición por ocupación de la literatura publicada (Eloundou et al. 2023; AIOE de Felten/Raj/Seamans). Modelo direccional, transparente y reproducible: cualquiera con las dos fuentes lo recalcula. ¿Ves un error? <a href="mailto:angel@angelanderson.com" class="text-teal-700">escríbenos</a> y se corrige. Julio 2026.</p>
`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: 'Índice de Exposición a la Inteligencia Artificial por municipio de Puerto Rico',
    description: 'Ranking de los 78 municipios de PR por exposición de sus empleos a la inteligencia artificial, cruzando la composición ocupacional del Censo (ACS C24010) con índices de exposición por ocupación (Eloundou 2023; AIOE).',
    creator: { '@type': 'Person', name: 'Angel Anderson' },
    publisher: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' },
    inLanguage: 'es', url: 'https://puertoricosinfiltros.com/exposicion-ai',
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: '¿Qué pueblos de Puerto Rico están más expuestos a la inteligencia artificial? Ranking de los 78 municipios',
    description: 'Data nunca publicada: el ranking de exposición a la inteligencia artificial de los 78 municipios de Puerto Rico. El metro corporativo es el más expuesto; el campo, el más resiliente. Con metodología y fuente.',
    slug: 'exposicion-ai', bodyHtml: body, jsonLd, ogImage: OG_SINFILTROS,
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
  }))
}

// /demanda-real — CONSOLIDADO 2026-07: la demanda (mejorada + triangulada) vive ahora en el radar
// unificado de MapaDeCaboRojo.com/demanda. Redirect 301 para no fragmentar ni dejar página muerta.
function handleDemandaReal(req: any, res: any) {
  res.setHeader('Location', 'https://www.mapadecaborojo.com/demanda')
  res.setHeader('Cache-Control', 'public, s-maxage=86400')
  return res.status(301).end()
}

// /cupon — el dinero federal que PR deja sin cobrar. Fórmula: potencial − reclamado.
// Flagship: Crédito por Hijos (CTC). Números reales: IDJ (elegibles/potencial) + IRS/Tesoro (reclamado).
function handleCupon(req: any, res: any) {
  const body = `
<h1>¿Cuánto dinero federal está dejando Puerto Rico sin cobrar?</h1>
<p class="text-lg text-slate-600 mt-2">Hay dinero federal que es <strong>tuyo si cualificas</strong> — no préstamo, no ayuda, no lista de espera. Solo hay que reclamarlo. Y cada año, decenas de miles de familias en Puerto Rico <strong>no lo cobran</strong>, casi siempre porque nadie se los explicó. El más grande se llama <strong>Crédito por Hijos</strong>. Aquí está el número sin filtro: cuánto se queda sin reclamar, por qué, y cómo se cobra.</p>

<div class="not-prose mt-5 bg-slate-900 text-white rounded-2xl p-5">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">El titular</p>
  <p class="text-xl sm:text-2xl font-black mt-1 leading-snug">Unas 81,000 familias dejan sin cobrar cerca de $310 millones al año. Dinero elegible. Sin reclamar.</p>
</div>

<h2>1. La cuenta, sin filtro</h2>
<div class="not-prose grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
  <div class="rounded-xl bg-white border border-slate-200 p-4">
    <div class="text-3xl font-black text-slate-900">$1,760M</div>
    <div class="text-sm font-semibold text-slate-700 mt-1">podría llegar a PR al año</div>
    <div class="text-xs text-slate-500 mt-1">si el 100% de las familias elegibles lo reclamara (304,000 familias · 565,000 niños). <i>Estimado IDJ.</i></div>
  </div>
  <div class="rounded-xl bg-white border border-slate-200 p-4">
    <div class="text-3xl font-black text-slate-900">$1,450M</div>
    <div class="text-sm font-semibold text-slate-700 mt-1">llegó de verdad (2024)</div>
    <div class="text-xs text-slate-500 mt-1">223,000 familias lo reclamaron. <i>Departamento del Tesoro federal.</i></div>
  </div>
  <div class="rounded-xl bg-red-50 border border-red-200 p-4">
    <div class="text-3xl font-black text-red-600">~$310M</div>
    <div class="text-sm font-semibold text-slate-800 mt-1">se quedó sin cobrar</div>
    <div class="text-xs text-slate-600 mt-1">la diferencia. Unas <strong>81,000 familias</strong> elegibles que no lo reclamaron.</div>
  </div>
</div>
<p class="text-sm text-slate-500 mt-2">La fórmula es simple y honesta: <strong>lo que podría llegar (potencial, IDJ) menos lo que llegó (reclamado, Tesoro).</strong> Son estimados de fuentes y años distintos, así que el ~$310M es direccional, no un decimal exacto — pero el hueco es real y grande: uno de cada cuatro dólares elegibles no se cobra.</p>

<h2>2. Qué es tuyo, en números que se sienten</h2>
<p>El Crédito por Hijos (Child Tax Credit) da <strong>hasta $1,700 reembolsable por cada hijo menor de 17</strong> — "reembolsable" quiere decir que te llega en cheque <strong>aunque no debas impuestos ni tengas ingresos.</strong></p>
<ul>
  <li>Una familia con <strong>1 hijo</strong>: hasta <strong>$1,700</strong> al año.</li>
  <li>Con <strong>2 hijos</strong>: hasta <strong>$3,400.</strong></li>
  <li>Con <strong>3 hijos</strong>: hasta <strong>$5,100.</strong></li>
</ul>
<p>Ese dinero no es un favor. Es lo mismo que reciben las familias en cualquier estado. Y contra el costo de vida de aquí — <a href="/costo-de-vida" class="text-teal-700 font-semibold">la luz al doble, la comida 15-30% más</a> — $3,400 al año no es poco: es varios meses de compra.</p>

<h2>3. Por qué tanta gente no lo cobra (y por qué no es tu culpa)</h2>
<p>Aquí está el alivio que hay que decir claro: <strong>si no lo cobraste, casi seguro no fue por tu culpa.</strong></p>
<ul>
  <li><strong>Antes de 2021 no cualificabas.</strong> Por décadas, en PR solo las familias con <strong>3 o más hijos</strong> podían pedirlo. El Plan de Rescate de 2021 lo abrió a <strong>toda familia con 1 hijo o más</strong> — por primera vez en la historia. Mucha gente todavía cree que "eso no es para mí."</li>
  <li><strong>Hay que radicar planilla federal</strong> (la 1040-SS), y en PR la mayoría no radica federal porque el ingreso local no paga impuesto federal. Entonces el crédito pasa por debajo del radar.</li>
  <li><strong>Nadie te avisó cuando cambió la regla.</strong> No hubo carta a tu casa. El sistema no está hecho para recordártelo.</li>
</ul>

<h2>4. Cómo se cobra (esta es la parte que resuelve)</h2>
<p>Se reclama radicando una planilla federal — <strong>gratis, aunque no tengas ingresos, aunque nunca hayas radicado federal.</strong></p>
<ul>
  <li><strong>Formulario:</strong> planilla federal <strong>1040-SS</strong> (o 1040-PR), ante el IRS. Es aparte de tu planilla de Hacienda de PR.</li>
  <li><strong>Requisitos del hijo:</strong> menor de 17 al cierre del año, con número de Seguro Social, que viva contigo. Uno o más hijos.</li>
  <li><strong>Ayuda gratis:</strong> los centros <strong>VITA</strong> (Volunteer Income Tax Assistance) del IRS te lo llenan sin cobrar. El <strong>Instituto del Desarrollo de la Juventud</strong> (juventudpr.org) tiene guía en español y localizador de ayuda.</li>
  <li><strong>Lo más importante:</strong> puedes reclamar <strong>años atrás</strong> (hasta 3 años de planillas). Si no lo cobraste en 2022, 2023 o 2024, todavía puede que estés a tiempo. Eso puede ser <strong>miles de dólares acumulados.</strong></li>
</ul>

<div class="not-prose bg-teal-50 border border-teal-200 rounded-2xl p-5 mt-6">
  <p class="text-sm font-bold text-teal-900 m-0">Un solo paso hoy</p>
  <p class="text-sm text-slate-700 mt-1 mb-0">Si tienes un hijo menor de 17 y nunca has radicado la planilla federal por el crédito, esa es tu jugada. Busca "VITA Puerto Rico" o entra a <a href="https://www.juventudpr.org/childtaxcredit" class="text-teal-700 font-semibold" rel="nofollow">juventudpr.org/childtaxcredit</a>. Aunque ganes poco o nada, el cheque puede llegarte igual.</p>
  <p class="text-sm text-slate-700 mt-2 mb-0">¿Se lo quieres pasar a alguien o guardarlo pa' después? Textea <strong>CUPON</strong> al <a href="https://wa.me/17874177711?text=CUPON" class="text-teal-700 font-semibold">787-417-7711</a> y El Veci te manda el resumen con el link.</p>
</div>

<h2>5. Funciona — no es teoría</h2>
<p>Cuando las familias sí lo cobran, mueve la aguja de verdad: el Crédito por Hijos <strong>bajó la pobreza infantil en Puerto Rico de 55% a 39%</strong> en los años que llegó completo. <i>(Instituto del Desarrollo de la Juventud.)</i> Cada familia que lo reclama es un pedazo de esa caída.</p>

<h2>6. Y no es el único cupón sin cobrar</h2>
<p>El Crédito por Hijos es el más grande, pero es <strong>un patrón, no un caso aislado</strong>: dinero federal elegible que se queda en la mesa porque nadie arma el número y lo pone claro.</p>
<ul>
  <li><strong>Crédito por Trabajo (EITC):</strong> el primo del CTC, para quien trabaja. Otro chorro de millones con reclamo incompleto.</li>
  <li><strong>El cupón de salud:</strong> hasta <strong>$75,000 federales</strong> para el médico que abra donde falta (áreas de escasez designadas). <a href="/registro/estado" class="text-teal-700 font-semibold">Ver el récord de salud →</a></li>
</ul>
<p>El estándar es el mismo: <strong>encontrar el dinero elegible, contar lo que no se cobra, y decir cómo se cobra.</strong> Ese es el récord que otros pueden copiar — municipio por municipio, programa por programa.</p>

<div class="not-prose bg-teal-50 border border-teal-200 rounded-2xl p-6 mt-8 text-center">
  <p class="text-lg font-black text-slate-900" style="font-family:'Fraunces',Georgia,serif">Hay dinero tuyo esperando. Verlo claro es el primer paso para cobrarlo.</p>
  <p class="mt-2 text-sm text-slate-600 italic">Si tienes hijos y no lo has reclamado, empieza por ahí. Si no te aplica, pásaselo a quien sí.</p>
</div>

<div class="not-prose border-l-4 border-slate-300 bg-slate-50 rounded-r-xl p-5 mt-8">
  <p class="text-xs uppercase tracking-widest text-slate-400 font-bold">El porqué, más hondo</p>
  <p class="text-slate-700 mt-2">Hay una idea vieja que cuesta dinero de verdad: <em>"esas cosas no son para uno."</em> Se instaló de tanto que el sistema no te incluyó. Pero la regla cambió — y el dinero es igual de tuyo que el de cualquiera. No cobrarlo por costumbre es la programación cobrando intereses.</p>
  <p class="mt-3"><a href="https://www.angelanderson.com/te-programaron" class="text-teal-700 font-semibold">Te programaron a creer que no era para ti. Empieza por ahí. →</a></p>
  <p class="text-xs text-slate-400 italic mt-2">Si no te sirve, sigue tu camino.</p>
</div>

<p class="text-sm text-slate-500 mt-6">Cómo se hizo: familias elegibles y potencial ($1,760M · 304,000 familias · 565,000 niños) del Instituto del Desarrollo de la Juventud (economista María Enchautegui). Reclamado real ($1,450M · 223,000 familias, 2024) del Departamento del Tesoro federal / IRS. Monto por hijo y reglas del IRS (CTC/ACTC, planilla 1040-SS). Caída de pobreza infantil 55%→39% del IDJ. El "sin cobrar" (~$310M · ~81,000 familias) es la resta potencial−reclamado: fuentes y años distintos, cifra direccional. ¿Ves un error? <a href="mailto:angel@angelanderson.com" class="text-teal-700">escríbenos</a> y se corrige. Julio 2026.</p>
`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Report',
    name: 'El dinero federal que Puerto Rico deja sin cobrar: el Crédito por Hijos',
    about: 'Unas 81,000 familias de PR dejan sin reclamar cerca de $310 millones al año del Crédito por Hijos federal (CTC). Cuánto es, por qué pasa, y cómo se cobra.',
    author: { '@type': 'Person', name: 'Angel Anderson' },
    publisher: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' },
    inLanguage: 'es', datePublished: '2026-07-07', url: 'https://puertoricosinfiltros.com/cupon',
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: 'Crédito por Hijos en Puerto Rico: los $310 millones que las familias dejan sin cobrar',
    description: 'Unas 81,000 familias en PR no reclaman el Crédito por Hijos federal — cerca de $310 millones al año. Hasta $1,700 por hijo, aunque no tengas ingresos. Cuánto es, por qué, y cómo se cobra gratis.',
    slug: 'cupon', bodyHtml: body, jsonLd, ogImage: OG_SINFILTROS,
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
  }))
}

// /rendimiento — ¿dónde rinde más tu dólar en PR? Ingreso local vs renta local, por municipio.
// Data real nunca publicada así: ACS 2024 5yr (B19013 ingreso + B25064 renta) → carga de vivienda por pueblo.
function handleRendimiento(req: any, res: any) {
  // [pueblo, ingreso mediano hogar, renta mediana/mes, % del ingreso al techo] — ordenado mejor→peor
  const STRETCH: [string, number, number, number][] = [["Gurabo",42216,678,19.3],["Trujillo Alto",40055,694,20.8],["Culebra",29630,528,21.4],["Cayey",30129,540,21.5],["Carolina",36958,677,22.0],["Santa Isabel",25795,489,22.7],["Guayanilla",23915,454,22.8],["Ciales",22586,431,22.9],["Loíza",24272,464,22.9],["Canóvanas",29642,568,23.0],["Guaynabo",46731,901,23.1],["Juncos",29863,577,23.2],["Maricao",21302,413,23.3],["Toa Alta",35241,690,23.5],["Dorado",36391,715,23.6],["Villalba",26286,517,23.6],["Cidra",29246,577,23.7],["Guánica",17633,349,23.8],["Aguas Buenas",23072,468,24.3],["Río Grande",28943,585,24.3],["Hormigueros",26828,559,25.0],["Luquillo",24225,504,25.0],["Corozal",23797,497,25.1],["Jayuya",21796,456,25.1],["Caguas",31379,659,25.2],["Humacao",27038,568,25.2],["Sabana Grande",22065,463,25.2],["Ceiba",25454,538,25.4],["Hatillo",28146,595,25.4],["Quebradillas",24640,521,25.4],["Guayama",20402,436,25.6],["Yabucoa",22944,489,25.6],["Barranquitas",23407,505,25.9],["Peñuelas",22697,489,25.9],["Moca",23586,512,26.0],["Adjuntas",19549,425,26.1],["Vieques",19803,430,26.1],["San Juan",27992,611,26.2],["Naranjito",22156,488,26.4],["Aguada",21501,475,26.5],["Aibonito",21744,481,26.5],["Cataño",25508,564,26.5],["Arroyo",21186,472,26.7],["Camuy",27411,611,26.7],["Patillas",24396,543,26.7],["Toa Baja",32017,713,26.7],["Cabo Rojo",26408,590,26.8],["Bayamón",31354,703,26.9],["Las Piedras",25232,565,26.9],["Arecibo",23635,531,27.0],["Juana Díaz",24852,559,27.0],["Naguabo",23395,528,27.1],["Yauco",24255,551,27.3],["Utuado",20800,476,27.5],["Añasco",24436,576,28.3],["Aguadilla",21540,509,28.4],["Coamo",22045,521,28.4],["Barceloneta",24508,582,28.5],["Manatí",22683,538,28.5],["Salinas",21901,530,29.0],["Lajas",19695,479,29.2],["Fajardo",25563,625,29.3],["Orocovis",20302,499,29.5],["Rincón",24447,604,29.6],["Morovis",25003,618,29.7],["Isabela",23266,582,30.0],["Las Marías",16314,412,30.3],["San Lorenzo",22847,579,30.4],["San Sebastián",19920,508,30.6],["Vega Alta",25538,667,31.3],["San Germán",18317,481,31.5],["Mayagüez",18295,484,31.7],["Lares",18917,505,32.0],["Vega Baja",24244,650,32.2],["Ponce",19877,536,32.4],["Comerío",17134,512,35.9],["Maunabo",18045,549,36.5],["Florida",22332,688,37.0]]
  const over30 = STRETCH.filter(r => r[3] >= 30).length
  const col = (b: number) => b < 25 ? '#059669' : b < 30 ? '#d97706' : '#dc2626'
  const tag = (b: number) => b < 25 ? 'rinde' : b < 30 ? 'ajustado' : 'apretado'
  const rowsHtml = STRETCH.map((r, i) => {
    const [n, inc, rent, b] = r
    const isCR = n === 'Cabo Rojo'
    const w = Math.max(6, Math.min(100, (b - 18) / (38 - 18) * 100))
    return `<tr class="border-t border-slate-100 ${isCR ? 'bg-teal-50' : ''}">
      <td class="py-1.5 px-2 text-slate-400 text-xs text-right">${i + 1}</td>
      <td class="py-1.5 px-3 font-semibold text-slate-800">${escapeHtml(n)}${isCR ? ' <span class="text-[10px] text-teal-700 font-bold">◄ tú</span>' : ''}</td>
      <td class="py-1.5 px-2 text-right text-xs text-slate-500 tabular-nums">$${inc.toLocaleString()}</td>
      <td class="py-1.5 px-2 text-right text-xs text-slate-500 tabular-nums">$${rent}</td>
      <td class="py-1.5 px-2"><div class="flex items-center gap-2"><div class="h-2 rounded-full" style="width:${w.toFixed(0)}%;background:${col(b)}"></div><span class="text-xs font-semibold" style="color:${col(b)}">${b.toFixed(1)}%</span></div></td>
    </tr>`
  }).join('')

  const body = `
<h1>¿Dónde rinde más tu dólar en Puerto Rico?</h1>
<p class="text-lg text-slate-600 mt-2">Antes de decidir si te quedas, te mudas de pueblo o abres negocio, hay un número que nadie te pone en fila: <strong>cuánto de lo que ganas se te va en el techo, pueblo por pueblo.</strong> La luz y la comida importada son casi parejas en toda la isla. Lo que de verdad cambia de un pueblo a otro es la <strong>vivienda</strong>. Así que el rendimiento de tu dólar lo decide, sobre todo, la renta contra el ingreso local. Aquí están los 78, en orden.</p>

<div class="not-prose mt-5 bg-slate-900 text-white rounded-2xl p-5">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">El titular</p>
  <p class="text-xl sm:text-2xl font-black mt-1 leading-snug">En 13 pueblos, el techo se come más de un tercio del ingreso local. En otros, menos de la quinta parte.</p>
</div>

<p class="mt-4">La regla federal dice que la vivienda no debería pasar del <strong>30% de tu ingreso.</strong> Pasado eso, oficialmente estás <em>"cargado por el costo de vivienda"</em> — te queda muy poco para todo lo demás. En Puerto Rico, <strong>${over30} de los 78 municipios</strong> cruzan esa línea con el ingreso y la renta medianos del propio pueblo. No es percepción: es el número.</p>

<h2>Los 78 municipios, de donde más rinde a donde menos</h2>
<p class="text-slate-600 -mt-1 text-sm">"% al techo" = renta mediana anual ÷ ingreso mediano del hogar. Más bajo = tu dólar cubre el techo con más de sobra.</p>
<div class="not-prose overflow-auto border border-slate-200 rounded-xl mt-3 mb-2" style="max-height:520px">
  <table class="w-full text-sm"><thead class="sticky top-0 bg-slate-50"><tr class="text-left text-xs uppercase tracking-wide text-slate-500"><th class="py-2 px-2 text-right">#</th><th class="py-2 px-3">Municipio</th><th class="py-2 px-2 text-right">Ingreso</th><th class="py-2 px-2 text-right">Renta/mes</th><th class="py-2 px-2">% al techo</th></tr></thead><tbody>${rowsHtml}</tbody></table>
</div>
<div class="not-prose flex flex-wrap gap-4 text-xs text-slate-500 mb-6"><span>🟢 rinde (&lt;25%)</span><span>🟠 ajustado (25-30%)</span><span>🔴 apretado (≥30%)</span></div>

<h2>Léelo bien: "arriba" no quiere decir "barato"</h2>
<p>Esta es la trampa que hay que evitar. Los pueblos que rinden arriba — <strong>Gurabo, Trujillo Alto, Carolina, Caguas</strong> — no es que la renta esté barata. Es que <strong>el ingreso es más alto</strong>, así que aguanta mejor el techo. Y abajo, en los apretados — <strong>Florida, Maunabo, Comerío, Ponce, Mayagüez</strong> — el problema no es lujo: es ingreso bajo con renta que no bajó igual. <strong>El rendimiento no lo decide el precio solo. Lo decide el precio contra lo que ganas ahí.</strong> Por eso "múdate al pueblo más barato" es mal consejo: te puede rendir menos si allá ganas menos todavía.</p>

<h2>Qué hacer con esto (no es tu culpa, pero sí tu jugada)</h2>
<ul>
  <li><strong>Si tu pueblo está en rojo:</strong> el techo te salió comiendo un tercio del ingreso local antes de que empezaras. No es que no sepas administrar — el número estaba en tu contra. Verlo claro es el primer paso para moverte con estrategia, no con culpa.</li>
  <li><strong>Si evalúas mudarte dentro de PR:</strong> no persigas la renta más baja; persigue el mejor <em>ingreso menos techo</em>. Un pueblo donde ganas $8,000 más al año aguanta $100 más de renta sin problema. <a href="/decidir" class="text-teal-700 font-semibold">Pásalo por la decisión completa →</a></li>
  <li><strong>Si abres negocio:</strong> los pueblos verdes tienen gente con <strong>más margen después del techo</strong> — dólares que no están todos comprometidos con la renta. Ahí es donde hay bolsillo para gastar.</li>
</ul>

<h2>Cómo se hizo (y por qué es real, no inventado)</h2>
<p>El principio de siempre: no inventar un número. <strong>Poner en fila dos datos públicos que nadie había cruzado así, pueblo por pueblo.</strong></p>
<ul>
  <li><strong>Ingreso:</strong> ingreso mediano del hogar por municipio, Censo/ACS 2024 (5 años), tabla B19013. Público.</li>
  <li><strong>Renta:</strong> renta bruta mediana mensual por municipio, misma fuente, tabla B25064. Público.</li>
  <li><strong>La cuenta:</strong> (renta mensual × 12) ÷ ingreso del hogar = el porcentaje del ingreso que se va en vivienda. La misma vara del gobierno federal para "carga de vivienda". Cualquiera lo recalcula.</li>
</ul>

<h2>Lo que este número NO dice (para que nadie lo maluse)</h2>
<ul>
  <li>Es la <strong>renta</strong> (el que alquila). El que ya es dueño de su casa vive otra ecuación — pero el que <em>evalúa mudarse</em> alquila primero, y para él este es el número.</li>
  <li>Son <strong>medianas</strong>: la mitad del pueblo está por encima y la mitad por debajo. Tu caso puede variar.</li>
  <li>No mete luz ni comida <strong>a propósito</strong>: esos son casi parejos en la isla, así que meterlos taparía lo único que de verdad cambia por pueblo. La luz va aparte en <a href="/luz" class="text-teal-700 font-semibold">/luz</a>.</li>
  <li>Renta e ingreso son de años distintos dentro del mismo ACS 5-años; es un retrato, no un tick en vivo.</li>
</ul>

<div class="not-prose bg-teal-50 border border-teal-200 rounded-2xl p-6 mt-8 text-center">
  <p class="text-lg font-black text-slate-900" style="font-family:'Fraunces',Georgia,serif">Tu dólar no rinde igual en todos los pueblos. Ahora sabes en cuáles rinde — y por qué.</p>
  <p class="mt-2 text-sm text-slate-600 italic">Para escoger la vida que quieres, primero hay que ver el número. Si te sirve, úsalo.</p>
</div>

<div class="not-prose border-l-4 border-slate-300 bg-slate-50 rounded-r-xl p-5 mt-8">
  <p class="text-xs uppercase tracking-widest text-slate-400 font-bold">El porqué, más hondo</p>
  <p class="text-slate-700 mt-2">El número te quita una culpa: si el techo se come un tercio de lo que ganas en tu pueblo, no te quedaste atrás por falta de ganas. La cuenta estaba cuesta arriba desde el arranque.</p>
  <p class="mt-3"><a href="https://www.angelanderson.com/te-programaron" class="text-teal-700 font-semibold">Te programaron a creer que era falta tuya. Empieza por ahí. →</a></p>
  <p class="text-xs text-slate-400 italic mt-2">Si no te sirve, sigue tu camino.</p>
</div>

<p class="text-sm text-slate-500 mt-6">Cómo se hizo: ingreso mediano del hogar (B19013) y renta bruta mediana (B25064) por municipio, Censo/ACS 2024 5-años, vía Census Reporter. La carga de vivienda (renta×12÷ingreso) es la métrica estándar federal. Modelo transparente y reproducible. ¿Ves un error? <a href="mailto:angel@angelanderson.com" class="text-teal-700">escríbenos</a> y se corrige. Julio 2026.</p>
`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: 'Rendimiento del dólar por municipio de Puerto Rico (carga de vivienda)',
    description: 'Ranking de los 78 municipios de PR por cuánto del ingreso mediano local se va en renta (renta bruta mediana × 12 ÷ ingreso mediano del hogar), Censo/ACS 2024 5-años (B19013 + B25064).',
    creator: { '@type': 'Person', name: 'Angel Anderson' },
    publisher: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' },
    inLanguage: 'es', url: 'https://puertoricosinfiltros.com/rendimiento',
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: '¿Dónde rinde más tu dólar en Puerto Rico? Los 78 municipios por carga de vivienda',
    description: 'Data nunca publicada así: cuánto del ingreso local se come la renta, pueblo por pueblo. 13 de 78 municipios cruzan la línea federal del 30%. Con ingreso, renta y metodología.',
    slug: 'rendimiento', bodyHtml: body, jsonLd, ogImage: OG_SINFILTROS,
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
  }))
}

// /decidir — la espina: ¿me quedo, me voy, me mudo? Organiza los factores + auto-veredicto por perfil.
function handleDecidir(req: any, res: any) {
  const card = (id: string, titulo: string, badge: string, badgeClass: string, texto: string, href: string, linkTxt: string) => `
  <div data-card="${id}" class="bg-white border border-slate-200 rounded-2xl p-5 transition-all">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-lg font-black text-slate-900 m-0" style="font-family:'Fraunces',Georgia,serif">${titulo}</h3>
      <span class="text-xs font-bold rounded-full px-2.5 py-1 whitespace-nowrap ${badgeClass}">${badge}</span>
    </div>
    <p class="text-sm text-slate-600 mt-2">${texto}</p>
    <a href="${href}" class="text-teal-700 font-semibold text-sm mt-2 inline-block">${linkTxt} →</a>
  </div>`

  const body = `
<h1>¿Me quedo, me voy, me mudo?</h1>
<p class="text-lg text-slate-600 mt-2">La decisión más grande no se toma con un sentimiento — se toma con los números claros. Esta página junta todo lo que pesa esa decisión en Puerto Rico, con la fuente al lado. <strong>Para vivir la vida que eliges, no la que te tocó.</strong></p>

<div class="not-prose mt-5 bg-slate-900 text-white rounded-2xl p-5">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">La regla</p>
  <p class="text-xl sm:text-2xl font-black mt-1 leading-snug">Una predicción no es destino. Es lo que pasa si no escoges otra cosa. Primero, hay que ver.</p>
</div>

<div class="not-prose mt-5 bg-white border border-slate-200 rounded-2xl p-4">
  <div class="flex items-start gap-3">
    <div class="text-2xl leading-none">🎧</div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-bold text-slate-800 m-0">Escúchalo en vez de leerlo</p>
      <p class="text-xs text-slate-500 mt-0.5 mb-2">Resumen en audio (es-419). Ponlo mientras guías.</p>
      <audio controls preload="none" class="w-full" src="https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/podcast/prsf/decidir.m4a">Tu navegador no puede reproducir el audio. <a href="https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/podcast/prsf/decidir.m4a" class="text-teal-700 font-semibold">Descárgalo</a>.</audio>
    </div>
  </div>
</div>

<div class="not-prose mt-6 bg-white border-2 border-teal-200 rounded-2xl p-5">
  <p class="text-sm font-bold text-slate-800 mb-3">Dime quién eres y te resalto lo que más te pesa:</p>
  <p class="text-xs uppercase tracking-wide text-slate-400 font-bold mb-2">¿Cómo es tu trabajo?</p>
  <div class="flex flex-wrap gap-2 mb-4" data-group="trabajo">
    <button type="button" class="prsf-chip" data-val="pantalla">Pantalla / remoto</button>
    <button type="button" class="prsf-chip" data-val="manos">Oficio de manos</button>
    <button type="button" class="prsf-chip" data-val="dueno">Dueño de negocio</button>
  </div>
  <p class="text-xs uppercase tracking-wide text-slate-400 font-bold mb-2">¿Dónde estás?</p>
  <div class="flex flex-wrap gap-2" data-group="situacion">
    <button type="button" class="prsf-chip" data-val="residente">Vivo aquí</button>
    <button type="button" class="prsf-chip" data-val="diaspora">Diáspora, evalúo volver</button>
    <button type="button" class="prsf-chip" data-val="mudarme">Pienso mudarme a PR</button>
  </div>
  <p id="prsf-jugada" class="text-sm text-teal-900 bg-teal-50 border border-teal-200 rounded-xl p-3 mt-4 hidden"></p>
</div>

<div class="not-prose grid sm:grid-cols-2 gap-4 mt-6">
  ${card('costo', 'Costo de vida', '🔴 pesa fuerte', 'text-red-700 bg-red-50 border border-red-200', 'Ganas cerca de 1/3 del ingreso de EE.UU., pero pagas la luz al doble y la comida 15-30% más. El dólar rinde menos.', '/costo-de-vida', 'Ver el récord')}
  ${card('trabajo', 'Trabajo y AI', '🔴 pesa fuerte', 'text-red-700 bg-red-50 border border-red-200', 'Solo 40.7% de la gente en edad de trabajar está activa. La AI corta lo de pantalla; las manos aguantan; el cruce a operador abre.', '/trabajo', 'Ver el récord')}
  ${card('salud', 'Salud', '🟡 con fecha', 'text-amber-800 bg-amber-50 border border-amber-200', 'Se proyecta que el 55% de los médicos se retire para 2030, y el Medicaid federal cae de 76% a 55% el 30 de septiembre de 2027.', '/prediccion', 'Ver la predicción')}
  ${card('servicios', 'Servicios: agua y luz', '🟡 verifica el tuyo', 'text-amber-800 bg-amber-50 border border-amber-200', 'La luz a 24.5¢/kWh (el doble de EE.UU.) y violaciones de agua activas en varios pueblos del oeste. Depende de tu sistema.', '/agua', 'Ver el récord')}
</div>

<p class="text-sm text-slate-500 mt-4 italic">Próximamente: seguridad y educación por pueblo. <a href="/prediccion" class="text-teal-700 font-semibold">Y la síntesis completa: Predicción 2030 →</a></p>

<div class="not-prose border-l-4 border-slate-300 bg-slate-50 rounded-r-xl p-5 mt-8">
  <p class="text-xs uppercase tracking-widest text-slate-400 font-bold">El porqué, más hondo · esto ya no es récord, es reflexión</p>
  <p class="text-slate-700 mt-2">Estos números te quitan la culpa: si la decisión de quedarte o irte se siente imposible, no es que estés perdido — es que nadie te puso los datos claros al lado. Ahora los tienes.</p>
  <p class="text-slate-700 mt-2">Pero hay una idea más vieja que cualquiera de estas cifras, y es la que de verdad decide: <em>"aquí no se puede."</em> Esa también se instaló — y también se reescribe.</p>
  <p class="mt-3"><a href="https://www.angelanderson.com/te-programaron" class="text-teal-700 font-semibold">Te programaron a creer que no puedes. Empieza por ahí. →</a></p>
  <p class="text-xs text-slate-400 italic mt-2">Si no te sirve, sigue tu camino.</p>
</div>

<p class="text-sm text-slate-500 mt-6">Cómo se hizo: cada tarjeta resume un récord verificado de este sitio, con su fuente en la página enlazada (Censo/ACS, EIA, EPA, FMI, NPPES/CMS, DACO). El resaltado por perfil es una ayuda de lectura, no un consejo. ¿Ves un error? <a href="mailto:angel@angelanderson.com" class="text-teal-700">escríbenos</a> y se corrige. Julio 2026.</p>

<style>
.prsf-chip{border:1px solid #cbd5e1;border-radius:9999px;padding:6px 14px;font-size:14px;font-weight:600;color:#334155;background:#fff;cursor:pointer;transition:all .15s}
.prsf-chip:hover{border-color:#14b8a6}
.prsf-on{background:#0f766e;color:#fff;border-color:#0f766e}
.prsf-hi{outline:3px solid #14b8a6;outline-offset:2px;box-shadow:0 4px 14px rgba(20,184,166,.18)}
[data-card]{scroll-margin-top:80px}
</style>
<script>
(function(){
  var rel={pantalla:['trabajo','costo'],manos:['trabajo','costo'],dueno:['trabajo','costo'],residente:['salud','costo','servicios'],diaspora:['costo','salud','trabajo'],mudarme:['costo','servicios','salud']};
  var jug={pantalla:'Tu jugada: cruza de empleado a operador. Alquila inteligencia con AI, apúntala, y sube tu valor sin salir de la isla.',manos:'Tu jugada: la AI no toca tu oficio. Hazte encontrable (directorio, 787-417-7711) y deja que la demanda te llegue.',dueno:'Tu jugada: adopta la AI primero. Baja tu costo de operar y compite con firmas grandes desde el pueblo.'};
  var sel={trabajo:null,situacion:null};
  function apply(){
    var ids={};
    if(sel.trabajo)rel[sel.trabajo].forEach(function(x){ids[x]=1});
    if(sel.situacion)rel[sel.situacion].forEach(function(x){ids[x]=1});
    document.querySelectorAll('[data-card]').forEach(function(c){c.classList.toggle('prsf-hi',!!ids[c.getAttribute('data-card')])});
    var j=document.getElementById('prsf-jugada'),t='';
    if(sel.trabajo)t=jug[sel.trabajo];
    if(sel.situacion==='diaspora')t+=' Y como estás en la diáspora: ganas en dólares donde el costo rinde más.';
    if(sel.situacion==='mudarme')t+=' Antes de mudarte, mira el costo de vida y los servicios de tu pueblo.';
    if(t){j.textContent=t;j.classList.remove('hidden')}else{j.classList.add('hidden')}
  }
  document.querySelectorAll('[data-group]').forEach(function(g){
    var grp=g.getAttribute('data-group');
    g.querySelectorAll('.prsf-chip').forEach(function(b){
      b.addEventListener('click',function(){
        g.querySelectorAll('.prsf-chip').forEach(function(x){x.classList.remove('prsf-on')});
        b.classList.add('prsf-on');sel[grp]=b.getAttribute('data-val');apply();
      });
    });
  });
})();
</script>
`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'WebPage',
    name: '¿Me quedo, me voy, me mudo? La decisión con los números de Puerto Rico',
    description: 'Todo lo que pesa la decisión de vivir en Puerto Rico — costo de vida, trabajo, salud, servicios — con la fuente al lado, y un veredicto según tu perfil.',
    publisher: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' },
    inLanguage: 'es', url: 'https://puertoricosinfiltros.com/decidir',
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: '¿Me quedo, me voy, me mudo? La decisión con los números claros',
    description: 'La decisión de quedarte, irte o mudarte a Puerto Rico — costo de vida, trabajo, salud, servicios — con la fuente al lado y un veredicto según tu perfil. Para vivir la vida que eliges.',
    slug: 'decidir', bodyHtml: body, jsonLd, ogImage: OG_SINFILTROS,
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
  }))
}

// =============== /registro/estado — Estado de Salud PR: el cupón federal sin cobrar ===============
// Surface de v_registro_municipio_intel: ranking por necesidad×oportunidad + análisis "cupón sin cobrar"
// (designación HPSA activa + cero psiquiatras). Data live con fallback verificado 2026-07-05.
async function handleRegistroEstado(req: any, res: any) {
  type Row = { municipio: string; poblacion: number; especialistas: number; psiquiatras: number; poverty_pct: number; hpsa_primaria: number; hpsa_salud_mental: number; cupon_mh_sin_cobrar: boolean; prioridad: number }
  let rows: Row[] = []
  let agg = { conHpsa: 65, cupon: 33, cuponPob: 792221, tier1: 21, sinPsiq: 36, sinPsiqPob: 930159 }
  try {
    const { data } = await supabase.from('v_registro_municipio_intel').select('municipio,poblacion,especialistas,psiquiatras,poverty_pct,hpsa_primaria,hpsa_salud_mental,cupon_mh_sin_cobrar,prioridad').range(0, 100)
    if (data && data.length >= 70) {
      rows = data.map((r: any) => ({ municipio: r.municipio, poblacion: +r.poblacion, especialistas: +r.especialistas, psiquiatras: +r.psiquiatras, poverty_pct: +(r.poverty_pct || 0), hpsa_primaria: +r.hpsa_primaria, hpsa_salud_mental: +r.hpsa_salud_mental, cupon_mh_sin_cobrar: !!r.cupon_mh_sin_cobrar, prioridad: +r.prioridad }))
      rows.sort((a, b) => b.prioridad - a.prioridad)
      const cup = rows.filter(r => r.cupon_mh_sin_cobrar)
      const sp = rows.filter(r => r.psiquiatras === 0)
      agg = { conHpsa: rows.filter(r => r.hpsa_primaria > 0 || r.hpsa_salud_mental > 0).length, cupon: cup.length, cuponPob: cup.reduce((s, r) => s + r.poblacion, 0), tier1: rows.filter(r => r.prioridad >= 75).length, sinPsiq: sp.length, sinPsiqPob: sp.reduce((s, r) => s + r.poblacion, 0) }
    }
  } catch (_) { /* fallback numbers stand */ }

  // Cruce FEMA: cuánto dinero de recuperación fue a los pueblos con el cupón sin cobrar ("cemento no médico")
  let femaCuponM = 3470
  try {
    const { data: fd } = await supabase.from('fema_recovery_by_municipio').select('municipio_raw,federal_obligado').range(0, 100)
    if (fd && fd.length && rows.length) {
      const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
      const fmap: Record<string, number> = {}
      for (const f of fd) fmap[norm(f.municipio_raw)] = Number(f.federal_obligado)
      const sum = rows.filter(r => r.cupon_mh_sin_cobrar).reduce((s, r) => s + (fmap[norm(r.municipio)] || 0), 0)
      if (sum > 0) femaCuponM = Math.round(sum / 1e6)
    }
  } catch (_) { /* fallback */ }

  const rowHtml = rows.map((r, i) => {
    const pr = r.prioridad
    const prColor = pr >= 80 ? 'bg-red-100 text-red-800' : pr >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
    return `<tr class="border-t border-slate-100 ${r.cupon_mh_sin_cobrar ? 'bg-amber-50/40' : ''}">
      <td class="py-1.5 px-2 text-slate-400 text-xs">${i + 1}</td>
      <td class="py-1.5 px-3 font-semibold text-slate-800">${escapeHtml(r.municipio)}</td>
      <td class="py-1.5 px-3 text-right text-slate-600">${r.poblacion.toLocaleString('en-US')}</td>
      <td class="py-1.5 px-3 text-right">${r.especialistas === 0 ? '<span class="text-red-700 font-bold">0</span>' : r.especialistas}</td>
      <td class="py-1.5 px-3 text-right ${r.psiquiatras === 0 ? 'text-red-700 font-bold' : 'text-slate-600'}">${r.psiquiatras}</td>
      <td class="py-1.5 px-3 text-right text-slate-600">${r.poverty_pct.toFixed(0)}%</td>
      <td class="py-1.5 px-3 text-center text-xs">${r.hpsa_salud_mental ? `<span class="text-teal-700 font-semibold">SM ${r.hpsa_salud_mental}</span>` : ''}${r.hpsa_primaria ? ` <span class="text-slate-500">PC ${r.hpsa_primaria}</span>` : ''}</td>
      <td class="py-1.5 px-3 text-center">${r.cupon_mh_sin_cobrar ? '💰' : ''}</td>
      <td class="py-1.5 px-2 text-right"><span class="inline-block ${prColor} font-bold px-2 py-0.5 rounded text-xs">${pr.toFixed(0)}</span></td>
    </tr>`
  }).join('')

  const body = `
<h1>Estado de Salud de Puerto Rico</h1>
<p class="text-lg text-slate-600 mt-3">El dinero federal para traer médicos <strong>ya está aprobado</strong> en casi todos nuestros pueblos. Y se está quedando sin reclamar. Esta es la primera cuenta, municipio por municipio, de dónde está el <strong>cupón sin cobrar</strong>.</p>
<div class="not-prose mt-4 border-2 border-teal-300 bg-teal-50 rounded-2xl p-4 flex items-start gap-3">
  <div class="text-2xl">🪜</div>
  <div>
    <p class="font-black text-slate-900">Antes de asustarte: esto tiene arreglo, y el primer paso es casi gratis.</p>
    <p class="text-sm text-slate-700 mt-0.5">Los números de abajo son duros, pero cada uno tiene su palanca. <a href="#escalera" class="text-teal-700 font-bold underline">Ve directo a la escalera del arreglo →</a></p>
  </div>
</div>

<div class="not-prose mt-5 bg-white border border-slate-200 rounded-2xl p-4">
  <div class="flex items-start gap-3">
    <div class="text-2xl leading-none">🎧</div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-bold text-slate-800 m-0">Escúchalo en vez de leerlo</p>
      <p class="text-xs text-slate-500 mt-0.5 mb-2">Análisis en audio (es-419). Ponlo mientras guías.</p>
      <audio controls preload="none" class="w-full" src="https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/podcast/prsf/estado-salud.m4a">Tu navegador no puede reproducir el audio. <a href="https://vprjteqgmanntvisjrvp.supabase.co/storage/v1/object/public/registro-media/podcast/prsf/estado-salud.m4a" class="text-teal-700 font-semibold">Descárgalo</a>.</audio>
    </div>
  </div>
</div>

<div class="not-prose grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
  <div class="bg-white border-2 border-teal-200 rounded-xl p-4 text-center"><div class="text-3xl font-black text-teal-700">${agg.conHpsa}<span class="text-lg text-slate-400">/76</span></div><div class="text-xs text-slate-600 mt-1">municipios con designación federal de escasez <strong>activa</strong></div></div>
  <div class="bg-white border-2 border-amber-300 rounded-xl p-4 text-center"><div class="text-3xl font-black text-amber-600">${agg.cupon}</div><div class="text-xs text-slate-600 mt-1">con el <strong>cupón de salud mental sin cobrar</strong> (designado + cero psiquiatras)</div></div>
  <div class="bg-white border-2 border-red-300 rounded-xl p-4 text-center"><div class="text-3xl font-black text-red-600">${agg.cuponPob.toLocaleString('en-US')}</div><div class="text-xs text-slate-600 mt-1">personas viven en esos municipios</div></div>
  <div class="bg-white border-2 border-slate-200 rounded-xl p-4 text-center"><div class="text-3xl font-black text-slate-700">3</div><div class="text-xs text-slate-600 mt-1">pueblos con <strong>cero</strong> especialistas de toda clase</div></div>
</div>

<h2>Qué es el "cupón sin cobrar"</h2>
<p>Una designación federal de escasez (HPSA) es un cupón: le dice a un médico o psicólogo "múdate a este pueblo y el gobierno federal te paga los préstamos estudiantiles — hasta $75,000 en cuidado primario, $50,000 en salud mental — más un bono de Medicare". Pero para cobrarlo, el clínico tiene que trabajar en un <strong>sitio aprobado por el NHSC dentro del pueblo</strong>. En los pueblos más necesitados no hay ese sitio. La designación existe en un archivo federal; la clínica donde pararse, no. <strong>Ese es el eslabón roto.</strong> Puerto Rico ya tiene la red de centros 330 que puede hospedarlo — falta conectarla.</p>

<div class="not-prose mt-6 border-l-4 border-amber-500 bg-amber-50 rounded-r-xl p-4">
  <p class="font-black text-slate-900">Le llegó el cemento, pero no el médico</p>
  <p class="text-sm text-slate-700 mt-1 leading-relaxed">$${femaCuponM.toLocaleString('en-US')} millones de fondos federales de recuperación (FEMA, casi todo del huracán María de 2017) fueron a los ${agg.cupon} pueblos que tienen el cupón de salud mental sin cobrar. Se reconstruyeron edificios, carreteras y sistemas de agua. No llegó ni un psiquiatra. Jayuya recibió $424 millones y tiene 2 especialistas y cero psiquiatras; Maricao, $183 millones, y cero médicos de ninguna clase.</p>
  <p class="text-xs text-slate-500 mt-2">Fuente: OpenFEMA (Public Assistance, monto obligado) × este registro, julio 2026. El dinero de FEMA es de infraestructura, no de salud; se muestra para dimensionar que el dinero de ladrillo sí fluyó a estos pueblos.</p>
</div>

<h2 id="citables">Datos citables: copia y pega</h2>
<p class="text-slate-600 -mt-2">El trabajo pesado ya está hecho. Cada dato de abajo está verificado contra su fuente federal y lleva el link. Toca <strong>Copiar</strong> y pégalo donde te sirva: una noticia, un post, un mensaje al grupo de la familia. No tienes que buscar nada más.</p>
${[
    { label: 'El titular', txt: `${agg.conHpsa} de 76 municipios de Puerto Rico tienen designación federal de escasez de médicos activa. ${agg.cupon} tienen el dinero de salud mental aprobado y cero psiquiatras: ${agg.cuponPob.toLocaleString('en-US')} personas. Verificado pueblo por pueblo contra el registro federal.` },
    { label: '1 de cada 3', txt: `${agg.sinPsiq} municipios de Puerto Rico no tienen ni un psiquiatra con práctica declarada. Son ${agg.sinPsiqPob.toLocaleString('en-US')} personas, cerca de 1 de cada 3 boricuas.` },
    { label: 'El cemento sin médico', txt: `$${femaCuponM.toLocaleString('en-US')} millones de fondos de recuperación (FEMA) llegaron a los ${agg.cupon} pueblos de PR que no tienen ni un psiquiatra. Le llegó el cemento, pero no el médico. Jayuya: $424 millones, 2 especialistas, cero psiquiatras.` },
    { label: 'El oeste', txt: `6 pueblos del oeste de Puerto Rico no tienen ni un psiquiatra: Maricao, Las Marías, Hormigueros, Añasco, Lajas y Moca. Todo el oeste depende de los 26 psiquiatras de Mayagüez.`, tag: 'local' as const },
    { label: 'Cero de todo', txt: `3 pueblos de Puerto Rico no tienen ni un especialista médico de ninguna clase: Maricao, Las Marías y Florida.` },
    { label: 'El más pobre', txt: `Guánica es el municipio más pobre de Puerto Rico (63.6% bajo el nivel de pobreza). Tiene la designación federal de salud mental con el puntaje máximo posible y cero psiquiatras.` },
    { label: 'Para médicos y psicólogos', txt: `Si eres psiquiatra, psicólogo o médico primario: el gobierno federal repaga tus préstamos estudiantiles (hasta $75,000 en primaria, $50,000 en salud mental) por ejercer donde hace falta. En 26 pueblos de PR no tendrías competencia local. El dinero ya está aprobado.`, tag: 'medicos' as const },
    { label: 'El programa sin operar', txt: `Puerto Rico usa el programa federal que trae médicos (NHSC) a la tasa más baja de cualquier jurisdicción comparable: 2.5 clínicos por 100,000 habitantes contra 15.3 en West Virginia, que tiene la mitad de nuestra población. Solo 6 médicos de cuidado primario NHSC en toda la isla. Y tres programas hermanos en cero: becas, Students-to-Service y el programa estatal de repago con pareo federal que 40+ estados sí tienen. Fuente: HRSA FY2025, en puertoricosinfiltros.com/registro/estado`, tag: 'medicos' as const },
    { label: 'La salida', txt: `Esto tiene arreglo sin dinero nuevo. Verificado contra HRSA (julio 2026): PR tiene 123 sitios NHSC activos donde un médico puede cobrar el repago de préstamos. De los 33 pueblos del cupón sin cobrar, 28 YA tienen sitio aprobado y aun así cero psiquiatras: lo que falta es el médico que reclame la oferta. Solo en 5 falta el papel: Añasco, Guánica, Guayanilla, Hormigueros y Loíza.`, tag: 'medicos' as const },
  ].map((f, i) => {
    const copyText = `${f.txt} Fuente: puertoricosinfiltros.com/registro/estado`
    const box = (f as any).tag === 'medicos' ? 'border-teal-300 bg-teal-50/40' : (f as any).tag === 'local' ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 bg-white'
    return `<div class="not-prose border ${box} rounded-xl p-4 mt-3">
      <div class="flex items-start justify-between gap-2">
        <p class="text-xs font-bold text-teal-700 uppercase tracking-wide m-0">${f.label}</p>
        <button type="button" class="copy-btn shrink-0 text-xs font-semibold text-teal-700 border border-teal-300 rounded-full px-3 py-1 hover:bg-teal-50" data-copy="${escapeHtml(copyText)}">📋 Copiar</button>
      </div>
      <blockquote class="mt-2 text-slate-900 leading-relaxed border-l-4 border-teal-500 pl-3">${escapeHtml(f.txt)}</blockquote>
      <p class="text-xs text-slate-500 mt-2">Fuente al copiar: puertoricosinfiltros.com/registro/estado</p>
    </div>`
  }).join('')}
<p class="text-sm text-slate-500 mt-3">¿Necesitas más datos con fuente (costo de vida, trabajo, agua, recuperación)? <a href="/comparte" class="text-teal-700 font-semibold">Todos los datos citables →</a></p>

<h2>Los 76 municipios, rankeados por dónde el cupón vale más</h2>
<p class="text-slate-600 -mt-2">Prioridad = necesidad (pobreza + envejecimiento + escasez de médicos) × oportunidad (designación activa sin cobrar). 💰 = tiene designación de salud mental activa y cero psiquiatras.</p>
<div class="not-prose mt-3 overflow-auto border border-slate-200 rounded-xl">
  <table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
    <th class="py-2 px-2">#</th><th class="py-2 px-3">Municipio</th><th class="py-2 px-3 text-right">Pob.</th><th class="py-2 px-3 text-right">Espec.</th><th class="py-2 px-3 text-right">Psiq.</th><th class="py-2 px-3 text-right">Pobreza</th><th class="py-2 px-3 text-center">HPSA (score)</th><th class="py-2 px-3 text-center">Cupón</th><th class="py-2 px-2 text-right">Prioridad</th>
  </tr></thead><tbody>${rowHtml}</tbody></table>
</div>

<h2>"¿Y si el pueblo de al lado sí tiene?"</h2>
<p>Es la pregunta correcta, y tiene cuatro respuestas con número:</p>
<div class="not-prose grid sm:grid-cols-2 gap-3 mt-3">
  <div class="border border-slate-200 bg-white rounded-xl p-4">
    <div class="text-xs font-bold text-teal-700 uppercase">1 · El gobierno federal ya hizo esa pregunta</div>
    <p class="text-sm text-slate-700 mt-1">La designación HPSA no se otorga mirando un pueblo aislado: HRSA <strong>cuenta los proveedores de las áreas vecinas y el tiempo de viaje</strong> antes de declarar la escasez. Si el psiquiatra del pueblo de al lado bastara, la designación no existiría. <strong>65 de 76 municipios la tienen activa.</strong> Esa es la respuesta federal, no la nuestra.</p>
  </div>
  <div class="border border-slate-200 bg-white rounded-xl p-4">
    <div class="text-xs font-bold text-teal-700 uppercase">2 · La salud mental es tratamiento, no un viaje</div>
    <p class="text-sm text-slate-700 mt-1">Una cita de psiquiatría no es una visita única: es seguimiento cada 2-4 semanas por meses o años. A mayor distancia, más citas perdidas y más tratamientos abandonados. Y una crisis no espera el viaje a Mayagüez.</p>
  </div>
  <div class="border border-slate-200 bg-white rounded-xl p-4">
    <div class="text-xs font-bold text-teal-700 uppercase">3 · "Cerca" sin carro no es cerca</div>
    <p class="text-sm text-slate-700 mt-1">En los pueblos del cupón sin cobrar la pobreza corre de <strong>43% a 64%</strong> (Guánica: 63.6%), con población mayor y sin transporte público real. El paciente que más necesita el servicio es el que menos puede ir a buscarlo lejos.</p>
  </div>
  <div class="border border-slate-200 bg-white rounded-xl p-4">
    <div class="text-xs font-bold text-teal-700 uppercase">4 · Todo el oeste cuelga de un solo punto</div>
    <p class="text-sm text-slate-700 mt-1">6 pueblos del oeste no tienen ni un psiquiatra (Maricao, Las Marías, Hormigueros, Añasco, Lajas y Moca). Toda la región depende de los <strong>26 psiquiatras de Mayagüez</strong>. Eso no es acceso: es un punto único de fallo para cientos de miles de personas.</p>
  </div>
</div>
<p class="text-xs text-slate-400 mt-2">Fuentes: criterios de designación de HRSA (proveedores del área contigua + distancia/tiempo de viaje) · NPPES/CMS · Censo/ACS. La designación federal activa es, en sí misma, la certificación de que el pueblo de al lado no resuelve.</p>

<h2 id="acto4">Por qué no llega el médico: lo que dice la data federal</h2>
<p>El dinero está aprobado, la designación existe y 28 de los 33 pueblos del cupón ya tienen sitio. Entonces, ¿por qué no llega el médico? Bajamos el expediente oficial del NHSC (fuerza de servicio FY2025, HRSA) y la respuesta tiene números:</p>

<div class="not-prose mt-4 bg-slate-900 text-white rounded-2xl p-5">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">El hallazgo</p>
  <p class="text-lg sm:text-xl font-black mt-1 leading-snug">Puerto Rico usa el programa federal de médicos a la tasa más baja de cualquier jurisdicción comparable: 2.5 clínicos NHSC por cada 100,000 habitantes. West Virginia, con la mitad de nuestra población, tiene 15.3 — seis veces más.</p>
</div>

<div class="not-prose grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
  <div class="bg-white border border-slate-200 rounded-xl p-4 text-center"><div class="text-2xl font-black text-slate-900">79</div><div class="text-xs text-slate-500 mt-1">clínicos NHSC en servicio en todo PR (FY2025)</div></div>
  <div class="bg-white border-2 border-red-300 rounded-xl p-4 text-center"><div class="text-2xl font-black text-red-600">6</div><div class="text-xs text-slate-500 mt-1">médicos de cuidado primario NHSC en toda la isla</div></div>
  <div class="bg-white border border-slate-200 rounded-xl p-4 text-center"><div class="text-2xl font-black text-slate-900">5</div><div class="text-xs text-slate-500 mt-1">psiquiatras NHSC (de 62 en "salud mental")</div></div>
  <div class="bg-white border-2 border-amber-300 rounded-xl p-4 text-center"><div class="text-2xl font-black text-amber-600">6 de 79</div><div class="text-xs text-slate-500 mt-1">en sitios rurales: el cupón está en la montaña, el NHSC vive en el llano</div></div>
</div>

<h3 class="mt-6">Los tres ceros que nadie había contado</h3>
<p>El repago de préstamos es solo UNO de los programas de la familia NHSC. Los otros tres, en Puerto Rico, están en cero absoluto (FY2025):</p>
<div class="not-prose grid sm:grid-cols-3 gap-3 mt-3">
  <div class="border border-slate-200 bg-white rounded-xl p-4"><div class="text-2xl font-black text-red-600">0</div><div class="text-sm font-bold text-slate-800 mt-1">Becas NHSC</div><p class="text-xs text-slate-600 mt-1">Cero estudiantes de medicina boricuas becados a cambio de servir en zonas designadas.</p></div>
  <div class="border border-slate-200 bg-white rounded-xl p-4"><div class="text-2xl font-black text-red-600">0</div><div class="text-sm font-bold text-slate-800 mt-1">Students-to-Service</div><p class="text-xs text-slate-600 mt-1">Cero residentes en el programa que paga hasta $120,000 por comprometerse con un pueblo designado.</p></div>
  <div class="border-2 border-amber-300 bg-amber-50/50 rounded-xl p-4"><div class="text-2xl font-black text-red-600">0</div><div class="text-sm font-bold text-slate-800 mt-1">SLRP: el programa estatal</div><p class="text-xs text-slate-600 mt-1">Más de 40 estados corren su propio programa de repago con <strong>pareo federal 1:1</strong>. Puerto Rico no lo tiene. Es dinero federal sin solicitar; la decisión es del Departamento de Salud, no del Congreso.</p></div>
</div>

<h3 class="mt-6">La prueba de que sí se puede está adentro</h3>
<p>Donde el centro de salud lo trabaja, el programa funciona: <strong>Salud Integral en la Montaña</strong> (Aibonito 11, Naranjito 7, Morovis 5, Orocovis 2 participantes) y el corredor de <strong>Lares</strong> (Castañer + CISS, 9) concentran cerca de un tercio de todos los NHSC de la isla. Mientras tanto, <strong>21 de los 33 pueblos del cupón no tienen ni un participante</strong>. No es que el programa no funcione en Puerto Rico: es que la mayoría no lo está operando.</p>

<p class="text-sm text-slate-700 mt-3"><strong>El análisis (y lo marcamos como análisis):</strong> el NHSC paga el préstamo, pero el sueldo lo pone el centro de salud — y con los planes pagando ~41% menos que en los estados, ese sueldo no compite. El repago cubre la diferencia un par de años; el resto de la carrera la pierde el médico. El incentivo federal asume un mercado de sueldos que en Puerto Rico no existe, y la mitad estatal de la maquinaria (SLRP, becas, dirección hacia lo rural) nunca se construyó. Le hicimos esta pregunta directamente a los centros que sí reclutan; publicaremos lo que respondan.</p>

<p class="text-xs text-slate-400 mt-2">Fuentes: HRSA — NHSC Field Strength FY2025 (corte 30 sept 2025, archivo oficial) · HRSA BHW, mapa de sitios y participantes (julio 2026) · nhsc.hrsa.gov (SLRP). Comparativas calculadas por población del Censo. Un cabo pendiente, pedido por escrito: cuántos de los 30 waivers Conrad 30 (visas J-1 para médicos en zonas designadas) usa PR cada año.</p>

<h2 id="escalera">Esto tiene arreglo: la escalera</h2>
<p>Este récord no es para asustarte. Es para que se vea dónde está la palanca. No hay UNA solución mágica: hay una escalera, y lo potente es que <strong>los primeros escalones son casi gratis.</strong> De más barato a más caro:</p>
<div class="not-prose mt-4 space-y-3">
  <div class="border-l-4 border-teal-500 bg-white border border-slate-200 rounded-r-2xl p-4">
    <div class="flex items-center gap-2 flex-wrap"><span class="text-xs font-black uppercase tracking-wider bg-teal-600 text-white rounded-full px-2.5 py-0.5">Escalón 1 · semanas · ~$0</span></div>
    <p class="font-bold text-slate-900 mt-2">El papel y el médico (verificado contra la lista federal de sitios)</p>
    <p class="text-sm text-slate-700 mt-1">El repago de préstamos (hasta $75,000 primaria / $50,000 salud mental) <strong>ya está aprobado</strong>. Y bajamos la lista federal de sitios donde un médico puede cobrarlo: <strong>PR tiene 123 sitios NHSC activos en 66 municipios</strong> (HRSA, julio 2026). El hallazgo que cambia el cuento: de los 33 pueblos del cupón, <strong>28 ya tienen sitio aprobado</strong> — Maricao y Las Marías incluidos (clínicas del Migrant Health Center; el Hospital de Castañer está activo en Lares y Jayuya) — <strong>y aun así, cero psiquiatras</strong>. Solo en <strong>5 pueblos falta el papel</strong>: Añasco, Guánica, Guayanilla, Hormigueros y Loíza. En esos 5, el paso es que su centro 330 regional inscriba un sitio (papeleo ante HRSA, no ley; la Oficina de Cuidado Primario del Departamento de Salud es quien radica). En los otros 28, el cuello de botella no es el formulario: <strong>es que ningún médico ha reclamado la oferta</strong>. Difundirla cuesta casi nada, y ahí entran los escalones 2 y 5.</p>
  </div>
  <div class="border-l-4 border-teal-400 bg-white border border-slate-200 rounded-r-2xl p-4">
    <div class="flex items-center gap-2 flex-wrap"><span class="text-xs font-black uppercase tracking-wider bg-teal-500 text-white rounded-full px-2.5 py-0.5">Escalón 2 · meses · costo bajo</span></div>
    <p class="font-bold text-slate-900 mt-2">El médico sin mudanza</p>
    <p class="text-sm text-slate-700 mt-1">No hace falta que el especialista viva en la montaña. Tres vías que ya existen: <strong>clínica itinerante</strong> (1-2 días/semana desde Castañer o Mayagüez), <strong>telemedicina desde la clínica</strong> (el paciente va al centro del pueblo y el médico está en pantalla; no hace falta internet en cada casa, hace falta en UN edificio), y <strong>visas J-1 (Conrad 30)</strong>: médicos extranjeros ganan su visa ejerciendo justo en zonas designadas como estas.</p>
  </div>
  <div class="border-l-4 border-slate-400 bg-white border border-slate-200 rounded-r-2xl p-4">
    <div class="flex items-center gap-2 flex-wrap"><span class="text-xs font-black uppercase tracking-wider bg-slate-500 text-white rounded-full px-2.5 py-0.5">Escalón 3 · años · la tubería</span></div>
    <p class="font-bold text-slate-900 mt-2">Formar a los que se quieren quedar</p>
    <p class="text-sm text-slate-700 mt-1">La emigración de médicos recién graduados <strong>bajó de 56% a 43%</strong>: quieren quedarse, falta dónde formarse. Plazas de residencia (sobre todo psiquiatría) y rotaciones rurales: el residente que rota en la montaña es el que después se queda en la montaña.</p>
  </div>
  <div class="border-l-4 border-amber-400 bg-white border border-slate-200 rounded-r-2xl p-4">
    <div class="flex items-center gap-2 flex-wrap"><span class="text-xs font-black uppercase tracking-wider bg-amber-500 text-white rounded-full px-2.5 py-0.5">Escalón 4 · Congreso · el de fondo</span></div>
    <p class="font-bold text-slate-900 mt-2">Arreglar la tubería del dinero</p>
    <p class="text-sm text-slate-700 mt-1">El 30 de septiembre de 2027 el pareo federal de Medicaid cae de 76% a 55%, y Medicare Advantage paga ~41% menos en PR que en los estados. Mientras eso siga, cada arreglo local pelea contra la corriente. Es el escalón más importante y el más lento; por eso no se empieza por aquí, se empieza por el formulario mientras se pelea esto.</p>
  </div>
  <div class="border-l-4 border-teal-600 bg-teal-50/60 border border-teal-200 rounded-r-2xl p-4">
    <div class="flex items-center gap-2 flex-wrap"><span class="text-xs font-black uppercase tracking-wider bg-teal-700 text-white rounded-full px-2.5 py-0.5">Escalón 5 · tú · hoy</span></div>
    <p class="font-bold text-slate-900 mt-2">Lo que puede hacer cualquier vecino</p>
    <p class="text-sm text-slate-700 mt-1">UNA pregunta al centro de salud de tu pueblo: <strong>"¿ustedes son sitio aprobado del NHSC?"</strong> Esa pregunta, repetida, sube el escalón 1. Hazle la misma a tu alcalde y a tu representante, con el dato en mano. En crisis: <strong>Línea PAS / 988</strong>, 24/7. Y comparte el récord, no el rumor.</p>
  </div>
</div>
<p class="text-sm text-slate-700 mt-4"><strong>La síntesis:</strong> un formulario esta semana, telemedicina y clínica itinerante este año, residencias esta década, y paridad en el Congreso. Lo trágico no es que sea difícil: es que el primer escalón es casi gratis y nadie lo ha subido.</p>
<p class="text-sm text-slate-600">¿Eres médico, psicólogo o residente? En estos pueblos no tienes competencia y el gobierno te paga los préstamos. ¿Alcalde, legislador o centro 330? El expediente de tu pueblo se arma con esta data. Escríbenos: <a href="mailto:angel@angelanderson.com" class="text-teal-600">angel@angelanderson.com</a>.</p>

<div class="mt-8 bg-slate-900 text-white rounded-2xl p-6">
  <p class="text-lg font-bold">📍 ¿Te aviso cuando cambie la salud de tu pueblo?</p>
  <p class="text-sm text-slate-300 mt-1">Deja tu correo. Te aviso si llega un especialista a tu zona o si sale data nueva. Sin spam, sin cuenta.</p>
  <form id="av-form" class="mt-3 flex flex-col sm:flex-row gap-2">
    <input id="av-email" type="email" required placeholder="tu@correo.com" class="flex-1 rounded-lg px-3 py-2 text-slate-900" aria-label="Tu correo" />
    <button type="submit" class="bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold rounded-lg px-5 py-2">Avísame</button>
  </form>
  <p id="av-done" class="text-sm text-teal-300 mt-2 hidden"></p>
  <p class="text-[11px] text-slate-400 mt-2">Un email solo cuando de verdad te sirve.</p>
</div>
<script>
(function(){var f=document.getElementById('av-form');if(!f)return;f.addEventListener('submit',function(e){e.preventDefault();var em=(document.getElementById('av-email').value||'').trim();if(!/.+@.+\\..+/.test(em)){alert('Escribe un email válido.');return;}var b=f.querySelector('button');b.disabled=true;b.textContent='...';fetch('/api/mapa-pages?page=registro-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:em,source:'estado',lang:'es'})}).then(function(r){return r.json()}).then(function(){f.classList.add('hidden');var d=document.getElementById('av-done');d.classList.remove('hidden');d.textContent='✅ Listo. Te aviso cuando haya algo nuevo cerca de los tuyos.';}).catch(function(){b.disabled=false;b.textContent='Avísame';alert('Hubo un error, intenta de nuevo.');});});})();
(function(){
  document.querySelectorAll('.copy-btn').forEach(function(b){
    b.addEventListener('click',function(){
      var t=b.getAttribute('data-copy')||'';
      var done=function(){var o=b.textContent;b.textContent='✓ Copiado';b.disabled=true;setTimeout(function(){b.textContent=o;b.disabled=false},1600)};
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(done).catch(function(){var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done()}catch(e){}document.body.removeChild(ta)})}
      else{var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done()}catch(e){}document.body.removeChild(ta)}
    });
  });
})();
</script>
<p class="text-sm text-slate-500 mt-6">Fuente: NPPES/CMS (proveedores) × archivos HRSA (designaciones HPSA) × Censo/ACS (pobreza, edad), cruzados municipio por municipio, julio 2026. <a href="/registro/mapa" class="text-teal-700 font-semibold">Ver el mapa →</a> · <a href="/registro/desiertos" class="text-teal-700 font-semibold">Los desiertos →</a></p>
`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: 'Estado de Salud de Puerto Rico — designaciones de escasez sin redimir por municipio',
    description: `${agg.conHpsa} de 76 municipios de PR tienen designación federal de escasez activa; ${agg.cupon} tienen el cupón de salud mental sin cobrar (${agg.cuponPob.toLocaleString('en-US')} personas). Cruce NPPES × HRSA × Censo, municipio por municipio.`,
    creator: { '@type': 'Organization', name: 'Registro Médico PR', url: 'https://registromedicopr.com' },
    isAccessibleForFree: true, inLanguage: 'es', url: 'https://registromedicopr.com/registro/estado',
    keywords: ['acceso a salud Puerto Rico', 'HPSA', 'desiertos médicos', 'NHSC', 'escasez de médicos'],
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: 'Estado de Salud de Puerto Rico — el cupón federal sin cobrar',
    description: 'El dinero federal para traer médicos ya está aprobado en 65 de 76 municipios de PR y se queda sin reclamar. La primera cuenta, municipio por municipio.',
    slug: 'registro/estado', bodyHtml: body, jsonLd, ogImage: '/og/desiertos.png',
    host: req.headers?.host, canonicalHost: 'https://registromedicopr.com',
  }))
}

// =============== /registro/mapa — Mapa interactivo de médicos por municipio ===============
// Grano MUNICIPIO (la región promedia y esconde). Data live: v_registro_muni_ratio (totales) +
// municipalities (coords) + v_registro_muni_spec (matriz especialidad) + hpsa_designations (cupón federal).
// Sin pines por doctor a propósito: solo 390/6,330 NPI tienen coords — precisión falsa. El municipio es honesto.
async function handleRegistroMapa(req: any, res: any) {
  const norm = (s: string) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  let munis: any[] = []
  let matrix: Record<string, Record<string, number>> = {}
  const hpsa: Record<string, { pc?: number; mh?: number }> = {}
  try {
    const [mr, mm, mx, hp] = await Promise.all([
      supabase.from('v_registro_muni_ratio').select('*').neq('region', 'islas').range(0, 200),
      supabase.from('municipalities').select('name,lat,lon').range(0, 200),
      supabase.from('v_registro_muni_spec').select('*').range(0, 2999),
      supabase.from('hpsa_designations').select('municipio,discipline,score').range(0, 499),
    ])
    const coords: Record<string, { lat: number; lon: number }> = {}
    for (const m of (mm.data || [])) coords[norm(m.name)] = { lat: Number(m.lat), lon: Number(m.lon) }
    for (const h of (hp.data || [])) {
      const k = norm(h.municipio)
      hpsa[k] = hpsa[k] || {}
      const key = h.discipline === 'primaria' ? 'pc' : h.discipline === 'salud_mental' ? 'mh' : null
      if (key) (hpsa[k] as any)[key] = Math.max((hpsa[k] as any)[key] || 0, Number(h.score) || 0)
    }
    for (const r of (mx.data || [])) {
      matrix[r.municipio] = matrix[r.municipio] || {}
      matrix[r.municipio][r.subcategory] = Number(r.n)
    }
    munis = (mr.data || []).map((r: any) => {
      const c = coords[norm(r.municipio)] || {}
      const h = hpsa[norm(r.municipio)] || {}
      return {
        m: r.municipio, lat: c.lat, lon: c.lon, pob: Number(r.poblacion),
        n: Number(r.especialistas), sm: Number(r.salud_mental), psq: Number(r.psiquiatras),
        r10k: Number(r.por_10k_hab || 0), pc: h.pc || 0, mh: h.mh || 0,
      }
    }).filter((x: any) => x.lat && x.lon)
  } catch (_) { /* page renders with empty-data note */ }

  const kwBySpec: Record<string, string> = {}
  REGISTRY_SPECS.forEach(s => { kwBySpec[s.s] = s.kw })
  const dataJson = JSON.stringify({ munis, matrix, kw: kwBySpec }).replace(/</g, '\\u003c')

  // SEO/no-JS fallback: full table of the 76 municipios
  const seoRows = [...munis].sort((a, b) => b.r10k - a.r10k).map(x =>
    `<tr class="border-t border-slate-100"><td class="py-1.5 px-3 font-semibold text-slate-800">${escapeHtml(x.m)}</td><td class="py-1.5 px-3 text-right">${x.n}</td><td class="py-1.5 px-3 text-right">${x.r10k.toFixed(1)}</td><td class="py-1.5 px-3 text-center">${x.mh ? `SM ${x.mh}` : ''}${x.pc ? ` · PC ${x.pc}` : ''}</td></tr>`).join('')

  const body = `
<h1>El mapa de los médicos de Puerto Rico</h1>
<p class="text-lg text-slate-600 mt-3">Cada círculo es un municipio. <strong>Escoge el especialista que buscas</strong> y el mapa te dice dónde hay, cuántos, y dónde no hay ninguno. Todo verificado contra el registro federal NPPES — pueblo por pueblo, no por promedio.</p>

<div class="not-prose mt-4 flex flex-wrap items-center gap-3">
  <label class="text-sm font-bold text-slate-700" for="spec-sel">¿Qué buscas?</label>
  <select id="spec-sel" class="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-w-[220px]"><option value="">Todos los especialistas</option></select>
  <span class="text-xs text-slate-500 hidden sm:inline">Toca un pueblo pa'l detalle</span>
</div>

<div class="not-prose relative mt-3">
  <div id="reg-map" style="height:520px" class="rounded-2xl border border-slate-200 z-0"></div>
  <div id="muni-panel" class="hidden absolute top-3 right-3 z-[500] w-[300px] max-w-[85vw] bg-white rounded-xl border border-slate-200 shadow-lg p-4 max-h-[480px] overflow-auto"></div>
</div>
<div class="not-prose mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
  <span><i class="fa-solid fa-circle" style="color:#10b981"></i> 20+ por 10,000 hab</span>
  <span><i class="fa-solid fa-circle" style="color:#f59e0b"></i> 8–20</span>
  <span><i class="fa-solid fa-circle" style="color:#dc2626"></i> menos de 8</span>
  <span><i class="fa-regular fa-circle" style="color:#7f1d1d"></i> cero</span>
  <span>💰 = designación federal de escasez activa (HRSA)</span>
</div>

<details class="mt-6"><summary class="cursor-pointer text-sm font-semibold text-slate-600">Ver la tabla completa (los 76 municipios)</summary>
<div class="not-prose mt-2 overflow-auto border border-slate-200 rounded-xl"><table class="w-full text-sm"><thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th class="py-2 px-3">Municipio</th><th class="py-2 px-3 text-right">Especialistas</th><th class="py-2 px-3 text-right">Por 10k hab</th><th class="py-2 px-3 text-center">💰 HPSA (score)</th></tr></thead><tbody>${seoRows}</tbody></table></div></details>

<p class="text-sm text-slate-500 mt-4">Fuente: NPPES/CMS (proveedores individuales con práctica en PR, por municipio declarado) × Censo 2020 × designaciones HRSA (julio 2026). Los puntos marcan el municipio, no la oficina exacta. <a href="/registro" class="text-teal-700 font-semibold">Buscar teléfonos y perfiles →</a> · <a href="/registro/desiertos" class="text-teal-700 font-semibold">Los desiertos médicos →</a></p>

<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="anonymous"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="anonymous"></script>
<script>
(function(){
  var D=${dataJson};
  function esc(t){return String(t).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  if(!D.munis.length){document.getElementById('reg-map').innerHTML='<p style="padding:2rem;text-align:center;color:#64748b">La data del mapa no está disponible ahora — intenta en un rato.</p>';return}
  var map=L.map('reg-map',{scrollWheelZoom:false}).setView([18.20,-66.42],9);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{attribution:'&copy; OpenStreetMap &copy; CARTO',maxZoom:12,minZoom:8}).addTo(map);
  // specialty dropdown from matrix
  var specs={};Object.values(D.matrix).forEach(function(o){Object.keys(o).forEach(function(s){specs[s]=(specs[s]||0)+o[s]})});
  var sel=document.getElementById('spec-sel');
  Object.keys(specs).sort().forEach(function(s){var o=document.createElement('option');o.value=s;o.textContent=s+' ('+specs[s]+')';sel.appendChild(o)});
  var markers=[];var cur='';
  function colorFor(x){
    if(cur){var n=(D.matrix[x.m]||{})[cur]||0;return n===0?{c:'#7f1d1d',f:0.15}:n>=10?{c:'#10b981',f:0.75}:n>=3?{c:'#f59e0b',f:0.75}:{c:'#dc2626',f:0.75}}
    return x.n===0?{c:'#7f1d1d',f:0.15}:x.r10k>=20?{c:'#10b981',f:0.7}:x.r10k>=8?{c:'#f59e0b',f:0.7}:{c:'#dc2626',f:0.7}
  }
  function radiusFor(x){
    if(cur){var n=(D.matrix[x.m]||{})[cur]||0;return Math.max(6,Math.min(24,5+Math.sqrt(n)*2.4))}
    return Math.max(6,Math.min(26,4+Math.sqrt(x.n)*0.55))
  }
  function panel(x){
    var el=document.getElementById('muni-panel');
    var mx=D.matrix[x.m]||{};
    var top=Object.keys(mx).sort(function(a,b){return mx[b]-mx[a]}).slice(0,10);
    var kw=cur?(D.kw[cur]||cur.toUpperCase().split(' ')[0]):'ESPECIALISTA';
    var curLine=cur?('<div class="mt-1 text-sm">'+(mx[cur]?('<b>'+mx[cur]+'</b> '+esc(cur)+(mx[cur]>1?'s':'')+' aquí'):'<b style="color:#b91c1c">0 '+esc(cur)+'s aquí</b>')+'</div>'):'';
    var badges='';
    if(x.mh||x.pc){badges='<div class="mt-2 text-xs bg-amber-50 border border-amber-200 rounded-lg p-2">💰 <b>Designación federal de escasez activa</b> — '+(x.pc?('primaria score '+x.pc):'')+(x.pc&&x.mh?' · ':'')+(x.mh?('salud mental score '+x.mh):'')+'. Un médico que practique aquí puede cualificar pa\\' repago federal de préstamos (NHSC).</div>'}
    el.innerHTML='<div class="flex items-start justify-between"><h3 class="font-black text-slate-900">'+esc(x.m)+'</h3><button onclick="document.getElementById(\\'muni-panel\\').classList.add(\\'hidden\\')" class="text-slate-400 hover:text-slate-700 text-lg leading-none">&times;</button></div>'
      +'<div class="text-xs text-slate-500">'+x.pob.toLocaleString('en-US')+' habitantes</div>'
      +'<div class="mt-2 text-sm"><b>'+x.n+'</b> especialistas · <b>'+x.r10k.toFixed(1)+'</b> por 10,000</div>'
      +'<div class="text-sm text-slate-600">Salud mental: '+x.sm+' ('+x.psq+' psiquiatra'+(x.psq===1?'':'s')+')</div>'
      +curLine+badges
      +(top.length?'<div class="mt-2 text-xs text-slate-500 font-bold uppercase tracking-wide">Lo que hay</div><ul class="text-sm text-slate-700">'+top.map(function(s){return '<li>'+esc(s)+' · <b>'+mx[s]+'</b></li>'}).join('')+'</ul>':'<div class="mt-2 text-sm text-red-700 font-semibold">Ni un especialista con práctica declarada en este municipio.</div>')
      +'<div class="mt-3 flex flex-col gap-1.5">'
      +'<a class="text-sm font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-full px-3 py-1.5 text-center" href="https://wa.me/17874177711?text='+encodeURIComponent(kw)+'">Escríbele '+kw+' al Veci</a>'
      +(cur?'<a class="text-sm font-semibold text-teal-700 text-center hover:underline" href="/registro/'+encodeURIComponent(cur.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-'))+'">Ver todos los '+esc(cur)+'s de PR →</a>':'<a class="text-sm font-semibold text-teal-700 text-center hover:underline" href="/registro">Buscar en el registro →</a>')
      +'</div>';
    el.classList.remove('hidden');
  }
  function draw(){
    markers.forEach(function(m){map.removeLayer(m)});markers=[];
    D.munis.forEach(function(x){
      var s=colorFor(x);
      var m=L.circleMarker([x.lat,x.lon],{radius:radiusFor(x),color:s.c,weight:2,fillColor:s.c,fillOpacity:s.f});
      m.bindTooltip(esc(x.m)+(cur?(' · '+(((D.matrix[x.m]||{})[cur])||0)):(' · '+x.n)),{direction:'top',offset:[0,-6]});
      m.on('click',function(){panel(x)});
      m.addTo(map);markers.push(m);
    });
  }
  sel.addEventListener('change',function(){cur=sel.value;draw()});
  draw();
})();
</script>
`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: 'Mapa de médicos especialistas de Puerto Rico por municipio',
    description: 'Mapa interactivo: cuántos especialistas médicos verificados (NPPES/CMS) hay en cada municipio de Puerto Rico, densidad por 10,000 habitantes, y designaciones federales de escasez (HRSA) activas.',
    creator: { '@type': 'Organization', name: 'Registro Médico PR', url: 'https://registromedicopr.com' },
    isAccessibleForFree: true, inLanguage: 'es',
    keywords: ['médicos Puerto Rico', 'especialistas por municipio', 'desiertos médicos', 'HPSA', 'NPPES'],
    url: 'https://registromedicopr.com/registro/mapa',
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: 'El mapa de los médicos de Puerto Rico — especialistas por municipio',
    description: 'Escoge el especialista que buscas y mira dónde hay, cuántos, y dónde no hay ninguno. Verificado contra el registro federal NPPES, municipio por municipio.',
    slug: 'registro/mapa', bodyHtml: body, jsonLd, ogImage: '/og/registro.png',
    host: req.headers?.host, canonicalHost: 'https://registromedicopr.com',
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
${antesDeLlamar({ specLabel: x.l, en })}
<div class="not-prose mt-8 bg-teal-700 rounded-2xl p-6 text-center text-white">
  <p class="text-lg font-bold mb-1">${t('¿No sabes a cuál ir?', 'Not sure which one to see?')}</p>
  <p class="text-sm text-teal-100 mb-4">${t('Escríbele al Veci. Te dice quién hay cerca y sus teléfonos. Al', 'Text El Veci. He tells you who is nearby and their phone numbers. At')} <strong>${PHONE_CTA}</strong>:</p>
  <a href="https://wa.me/17874177711?text=${x.kw}" class="inline-flex items-center gap-2 bg-white text-teal-800 font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-50"><i class="fa-brands fa-whatsapp text-lg"></i> ${x.kw}</a>
</div>
${regDisclaimer(en)}
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
  { topic: '🗑️ Basura y vertedero', text: '3 excavadoras, 1 siempre en el vertedero montando la basura para Mayagüez.', quien: 'Alcalde Morales · 2023', src: null, status: 'ESPERANDO', detail: '' },
  { topic: '🗑️ Basura y vertedero', text: 'Querella Virtual del municipio para reportar escombros que no recogieron.', quien: 'Alcalde Morales · 2023', src: null, status: 'EMPEZO', detail: 'el portal existe (ciudadcaborojo.com) · falta ver si contestan — test ciudadano en curso jul 2026' },
  { topic: '🗑️ Basura y vertedero', text: 'Canon de $200/año a los alquileres a corto plazo (~1,000 unidades en 2023) para cubrir el recogido de basura que dejan los turistas.', quien: 'Ex-legislador municipal · 2024', src: null, status: 'ESPERANDO', detail: 'si se cobra completo son ~$200,000/año · ¿se está cobrando y a dónde va?' },
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
  { topic: '🏖️ Faro, playas y balneario', text: 'Hacer el Balneario de Boquerón "uno de los lugares más icónicos de Puerto Rico".', quien: 'Alcalde Morales · 2024', src: null, status: 'EMPEZO', detail: 'traspaso al municipio en proceso (ordenanza 2024-25) · baños accesibles ya instalados (verificado jul 2026)', feat: true },
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
  // 🏚️ ESTORBOS PÚBLICOS Y CASCO URBANO (entrevista propiedades abandonadas, CaboRojo.com)
  { topic: '🏚️ Estorbos públicos y casco urbano', text: 'Estacionamiento para los placeros: demoler "prontito" el edificio a punto de caerse al lado de la Plaza del Mercado. "Uno de nuestros compromisos de campaña."', quien: 'Alcalde Morales · 2024', src: null, status: 'ESPERANDO', detail: 'compromiso de campaña, en cámara', feat: true },
  { topic: '🏚️ Estorbos públicos y casco urbano', text: 'Revocación de usufructos en el casco urbano: "más de 100 unidades" trabajadas, y con las ventas "podemos comenzar a tumbar de inmediato casi 100 propiedades".', quien: 'Alcalde Morales · 2024', src: null, status: 'EMPEZO', detail: '' },
  { topic: '🏚️ Estorbos públicos y casco urbano', text: '16 solares a subasta (sobres cerrados): solo 2 se vendieron. Prometió que los demás vuelven a subasta, con regla de construir en 1 año o se devuelve el dinero.', quien: 'Alcalde Morales · 2024', src: null, status: 'ESPERANDO', detail: '¿cuándo es la próxima subasta?' },
  // 💰 DINERO Y PRESUPUESTO
  { topic: '💰 Dinero y presupuesto', text: 'Endoso condicionado a Esencia: la condición es que el proyecto tenga su propia agua.', quien: 'Alcaldía · 2024', src: ['https://youtu.be/85V_v2cBj1s', 'CaboRojo.com'], status: 'ESPERANDO', detail: '', feat: true },
  { topic: '💰 Dinero y presupuesto', text: 'Esencia pagará CRIM y arbitrios: "más de $20 millones en 10 años para las arcas municipales". Y: "el municipio lo va a fiscalizar".', quien: 'Alcalde Morales · ponencia vistas Esencia', src: null, status: 'ESPERANDO', detail: 'número verificable año a año si el proyecto va', feat: true },
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
// /promesas: todas, agrupadas por tema. Cada fila lleva QUIÉN lo dijo, CUÁNDO y la FUENTE
// (feedback Angel jul 2026: sin el quién/cuándo la gente no entiende por qué es una promesa,
// y sin fuente los politiqueros lo pintan de chisme).
function renderPromesasByTopic(promesas: Promesa[]): string {
  const topics: string[] = []
  for (const p of promesas) if (!topics.includes(p.topic)) topics.push(p.topic)
  return topics.map(t => {
    const rows = promesas.filter(p => p.topic === t).map(p =>
      `<tr><td>${p.text}</td><td><span style="font-size:13px">${p.quien}</span><br><span style="font-size:12px;color:#64748b">${civicSrcCell(p)}</span></td><td>${civicBadge(p.status, p.detail)}</td></tr>`
    ).join('\n')
    return `<h2>${t}</h2>\n<table><thead><tr><th>Lo que dijo</th><th>Quién y cuándo</th><th>¿Y?</th></tr></thead><tbody>\n${rows}\n</tbody></table>`
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
  const cc = civicCounts(PROMESAS_CABOROJO)
  const body = `
<span class="not-prose inline-block bg-teal-100 text-teal-800 text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full">Observatorio Cívico · No-partidista · Cabo Rojo</span>

<h1 class="mt-4">Todo lo que el alcalde dijo en cámara.</h1>

<p class="text-lg text-slate-600 mt-3"><strong>¿Qué es esto?</strong> Es la lista de lo que el alcalde de Cabo Rojo prometió o dijo en sus entrevistas con nosotros (2023-2024). Lo guardamos con su video. Aquí está, una por una. Tú decides cuál se hizo y cuál no.</p>

<div class="not-prose mt-5 grid grid-cols-4 gap-2 text-center">
  <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3"><div class="text-2xl font-black text-emerald-700">${cc.HECHO}</div><div class="text-xs font-bold text-emerald-800">✅ HECHO</div></div>
  <div class="bg-amber-50 border border-amber-200 rounded-xl p-3"><div class="text-2xl font-black text-amber-600">${cc.EMPEZO}</div><div class="text-xs font-bold text-amber-800">🟡 EMPEZÓ</div></div>
  <div class="bg-rose-50 border border-rose-200 rounded-xl p-3"><div class="text-2xl font-black text-rose-600">${cc.NO}</div><div class="text-xs font-bold text-rose-800">❌ NO</div></div>
  <div class="bg-slate-50 border border-slate-200 rounded-xl p-3"><div class="text-2xl font-black text-slate-500">${cc.ESPERANDO}</div><div class="text-xs font-bold text-slate-600">⏳ SIN CONTESTAR</div></div>
</div>
<p class="not-prose text-xs text-slate-500 mt-2 text-center">El marcador se mueve con prueba, en cualquier dirección. Lo HECHO se celebra igual de rápido que lo que falta.</p>

<div class="not-prose mt-4 bg-white border border-slate-200 border-l-4 border-l-teal-600 rounded-lg p-4">
  <p class="text-sm text-slate-700"><strong class="text-teal-700">Para la alcaldía:</strong> esto no es para pelear. Es una lista de trabajo. Lo que ya esté hecho, dilo con prueba y lo marcamos <strong>HECHO</strong> el mismo día, con el crédito público que le toca. Lo que falta, dinos cuándo. Canal directo: <a href="mailto:angel@caborojo.com?subject=Promesas%20—%20respuesta%20de%20la%20alcald%C3%ADa" class="text-teal-700 font-semibold">angel@caborojo.com</a> o el formulario de abajo. El pueblo solo quiere saber.</p>
</div>

<div class="not-prose mt-3 bg-gold-50 border border-gold-200 border-l-4 border-l-gold-500 rounded-lg p-4">
  <p class="text-sm text-slate-700"><strong>¿De quién es el dinero?</strong> Un detalle para leer esta lista completa: mucho de lo que se inaugura se paga con <strong>fondos federales</strong> (FEMA, ARPA, CDBG) o con lo que ya pagaste tú — no con dinero nuevo del municipio. Saber quién paga no le quita mérito a quien ejecuta: solo pone el crédito donde va. Donde lo sabemos, lo anotamos en la fila.</p>
</div>

<p class="text-sm text-slate-600 mt-4">Cómo leer: <span class="font-bold text-emerald-700">✅ HECHO</span> · <span class="font-bold text-amber-600">🟡 EMPEZÓ</span> · <span class="font-bold text-rose-600">❌ NO</span> · <span class="font-bold text-slate-500">⏳ SIN CONTESTAR</span>. La mayoría dice "sin contestar" porque falta que la alcaldía responda con prueba. Cada fila dice <strong>quién lo dijo, cuándo, y dónde está el video</strong> — por eso es una promesa y no un chisme.</p>

<p class="text-sm text-slate-500 mt-2"><a href="/observatorio" class="text-teal-700 font-semibold">← Volver al Observatorio</a> · <a href="/quien-responde" class="text-teal-700 font-semibold">¿Quién responde por esto? →</a> · Cada cosa salió de entrevistas en video de CaboRojo.com con el alcalde.</p>

${renderPromesasByTopic(PROMESAS_CABOROJO)}

<div class="not-prose mt-6 bg-teal-900 text-white rounded-xl p-5">
  <p class="font-bold text-base">¿Falta alguna? ¿Alguna ya está hecha?</p>
  <p class="text-sm text-teal-100 mt-1">Lo puedes decir aquí mismo (abajo), o textea <strong>OBSERVATORIO al ${PHONE_CTA}</strong>. Lo revisa un humano antes de cambiar nada. Esto se mantiene vivo.</p>
</div>

${shareRow({
  text: 'Todo lo que el alcalde de Cabo Rojo dijo o prometió en cámara (2023-2024), una por una, con su estado. Récord público, no acusación. Tú decides cuál se hizo.',
  url: 'https://www.mapadecaborojo.com/promesas',
  toWho: 'Al chat de la familia, al vecino que dice "aquí nunca se sabe nada", y a quien vaya a votar en Cabo Rojo.',
  dark: true,
})}
${SHARE_COPY_SCRIPT}

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
    host: _req.headers?.host,
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
  const ccObs = civicCounts(PROMESAS_CABOROJO)
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

<div class="not-prose mt-5 bg-gradient-to-br from-teal-50 to-white border-2 border-teal-200 rounded-2xl p-5">
  <div class="flex items-start gap-3">
    <div class="text-3xl leading-none">🎙️</div>
    <div class="flex-1 min-w-0">
      <h3 class="text-lg font-black text-slate-900 m-0">Escúchalo en 15 minutos: quién manda de verdad en Cabo Rojo</h3>
      <p class="text-sm text-slate-600 mt-1 mb-0">Toda esta página en cristiano: los 4 problemas que deciden cómo se vive, a quién le toca cada cosa, el vertedero, lo que encontró el Contralor y el Promesómetro. Ponlo mientras guías.</p>
      <audio controls preload="none" class="mt-3 w-full" src="${OBS_PODCAST_URL}">Tu navegador no puede reproducir el audio. <a href="${OBS_PODCAST_URL}" class="text-teal-700 font-semibold">Descárgalo</a>.</audio>
    </div>
  </div>
</div>
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'AudioObject',
  name: 'Quién manda de verdad en Cabo Rojo',
  description: 'El Observatorio Cívico de Cabo Rojo en 15 minutos: agua, basura, luz, el vertedero, lo que encontró el Contralor de PR, el Promesómetro del alcalde, y a quién le toca resolver cada cosa. Récord público, no-partidista.',
  contentUrl: OBS_PODCAST_URL, encodingFormat: 'audio/mp4', inLanguage: 'es', isAccessibleForFree: true,
  publisher: { '@type': 'Organization', name: 'Mapa de Cabo Rojo', url: 'https://www.mapadecaborojo.com' },
})}</script>

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
    <p class="text-xs mt-1"><a href="/agua" class="text-teal-700 font-semibold hover:underline">Mira el récord federal del agua de tu pueblo (EPA) →</a></p>
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

<div class="not-prose mt-4 grid grid-cols-4 gap-2 text-center">
  <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3"><div class="text-2xl font-black text-emerald-700">${ccObs.HECHO}</div><div class="text-xs font-bold text-emerald-800">✅ HECHO</div></div>
  <div class="bg-amber-50 border border-amber-200 rounded-xl p-3"><div class="text-2xl font-black text-amber-600">${ccObs.EMPEZO}</div><div class="text-xs font-bold text-amber-800">🟡 EMPEZÓ</div></div>
  <div class="bg-rose-50 border border-rose-200 rounded-xl p-3"><div class="text-2xl font-black text-rose-600">${ccObs.NO}</div><div class="text-xs font-bold text-rose-800">❌ NO</div></div>
  <div class="bg-slate-50 border border-slate-200 rounded-xl p-3"><div class="text-2xl font-black text-slate-500">${ccObs.ESPERANDO}</div><div class="text-xs font-bold text-slate-600">⏳ SIN CONTESTAR</div></div>
</div>
<p class="not-prose text-xs text-slate-500 mt-2 text-center">El marcador se mueve con prueba, en cualquier dirección. Lo HECHO se celebra igual de rápido que lo que falta.</p>

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
  <a href="/promesas" class="inline-block bg-teal-700 hover:bg-teal-800 text-white font-bold px-5 py-3 rounded-lg">Ver las ${PROMESAS_CABOROJO.length} cosas que el alcalde dijo en cámara, tema por tema →</a>
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

${shareRow({
  text: 'La lista de problemas de Cabo Rojo en un solo sitio: agua, basura, luz, el vertedero, lo que encontró el Contralor, y todo lo que el alcalde dijo en cámara con su video. Récord público, no chisme. Tú lo ves, tú decides.',
  url: 'https://www.mapadecaborojo.com/observatorio',
  toWho: 'Al chat de la familia, al vecino que dice "aquí nadie hace nada", y al que vaya a votar en Cabo Rojo. Un pueblo informado reclama mejor.',
  dark: true,
})}
${SHARE_COPY_SCRIPT}

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

// --- /agua — el récord federal del agua potable, por pueblo (EPA SDWIS, pull 2026-07-01) ---
// Substrato cívico Tier 3: dato público federal, verificado, traducido, citable. Framing = accountability, no alarmismo.
type AguaSys = { name: string; pop: number; source: 'SW' | 'GW'; total: number; activas: number; reciente: string | null; nota: string }
type AguaMuni = { name: string; systems: AguaSys[] }

// Cabo Rojo + pueblos aledaños. Data cruda verificada en Outbox/Salud/Agua-Oeste-PR/agua-oeste-verificado.json
const AGUA_DATA: AguaMuni[] = [
  { name: 'Cabo Rojo', systems: [
    { name: 'Sistema PRASA de Cabo Rojo', pop: 20749, source: 'SW', total: 48, activas: 3, reciente: '2023', nota: 'Casi todo por trihalometanos, un subproducto de la desinfección. 45 de 48 ya resueltas.' },
  ]},
  { name: 'Lajas', systems: [
    { name: 'Sistema PRASA de Lajas', pop: 47531, source: 'SW', total: 26, activas: 0, reciente: '2020', nota: 'Mismo perfil de trihalometanos, todas resueltas.' },
  ]},
  { name: 'San Germán', systems: [
    { name: 'Periche', pop: 1100, source: 'SW', total: 6, activas: 4, reciente: '2025', nota: 'Acueducto comunal. Bacterias y tratamiento. El récord activo más reciente del área.' },
    { name: 'Com. Río Piedras', pop: 220, source: 'SW', total: 3, activas: 2, reciente: '2024', nota: 'Acueducto comunal. Coliformes / agua subterránea.' },
    { name: 'Comunidad Méndez', pop: 60, source: 'SW', total: 3, activas: 2, reciente: '2024', nota: 'Acueducto comunal. Tratamiento / agua subterránea.' },
    { name: 'El Japonés', pop: 1303, source: 'GW', total: 2, activas: 0, reciente: '2015', nota: 'Coliformes, ya resueltas.' },
    { name: 'Capriles · Pedregal', pop: 1704, source: 'GW', total: 0, activas: 0, reciente: null, nota: 'Sin violaciones de salud en récord.' },
  ]},
  { name: 'Sabana Grande', systems: [
    { name: 'Sistema PRASA de Sabana Grande', pop: 25229, source: 'SW', total: 39, activas: 2, reciente: '2022', nota: 'Trihalometanos. 37 de 39 ya resueltas.' },
    { name: 'Rayo', pop: 3855, source: 'GW', total: 0, activas: 0, reciente: null, nota: 'Sin violaciones de salud en récord.' },
  ]},
  { name: 'Mayagüez', systems: [
    { name: 'Ponce de León · Consumo', pop: 11321, source: 'SW', total: 0, activas: 0, reciente: null, nota: 'Sin violaciones de salud en récord.' },
  ]},
  { name: 'Hormigueros', systems: [
    { name: 'Sistema de Hormigueros', pop: 10541, source: 'GW', total: 0, activas: 0, reciente: null, nota: 'Sin violaciones de salud en récord.' },
  ]},
  { name: 'Guánica', systems: [
    { name: 'Guánica Urbano', pop: 6838, source: 'GW', total: 2, activas: 0, reciente: '2019', nota: 'Coliformes, ya resueltas.' },
    { name: 'Ensenada', pop: 6122, source: 'GW', total: 0, activas: 0, reciente: null, nota: 'Sin violaciones de salud en récord.' },
  ]},
]

function handleAgua(req: any, res: any) {
  const fmt = (n: number) => n.toLocaleString('en-US')
  let sysTotal = 0, activasTotal = 0, popActivas = 0, limpios = 0
  for (const m of AGUA_DATA) for (const s of m.systems) {
    sysTotal++; activasTotal += s.activas
    if (s.activas > 0) popActivas += s.pop
    if (s.total === 0) limpios++
  }

  const badge = (s: AguaSys) => {
    if (s.activas > 0) return `<span class="shrink-0 text-xs font-bold rounded-full px-2.5 py-1 leading-tight text-center bg-red-50 text-red-700 border border-red-200">${s.activas} activa${s.activas > 1 ? 's' : ''}<br>últ. ${s.reciente}</span>`
    if (s.total > 0) return `<span class="shrink-0 text-xs font-bold rounded-full px-2.5 py-1 leading-tight text-center bg-amber-50 text-amber-800 border border-amber-200">0 activas<br>resuelto</span>`
    return `<span class="shrink-0 text-xs font-bold rounded-full px-2.5 py-1 leading-tight text-center bg-emerald-50 text-emerald-800 border border-emerald-200">limpio ✓</span>`
  }

  const slugify = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')

  // Por cada sistema en rojo: la pregunta exacta (guión listo) + botón de pasar el recibo por WhatsApp.
  const actionRow = (s: AguaSys, muni: string) => {
    if (s.activas === 0) return ''
    const esPrasa = /PRASA/i.test(s.name)
    const guion = esPrasa
      ? `El récord federal de la EPA muestra ${s.activas} violación${s.activas > 1 ? 'es' : ''} de salud activa${s.activas > 1 ? 's' : ''} del sistema de ${muni} (la más reciente de ${s.reciente}). ¿Cuál es el estado y el plan de corrección?`
      : `Vi en el récord federal de la EPA que ${s.name} tiene ${s.activas} violación${s.activas > 1 ? 'es' : ''} de salud sin fecha de corrección (la más reciente de ${s.reciente}). ¿Cuál es el plan pa' corregirla${s.activas > 1 ? 's' : ''} y pa' cuándo? ¿Nos conviene pedir la ayuda técnica gratis que existe pa' acueductos comunitarios?`
    const aQuien = esPrasa
      ? `Llama a la AAA (<a href="tel:7876202482" class="text-brand-700 font-semibold">787-620-2482</a>) o pregúntalo en tu oficina regional.`
      : `Llévala a la próxima reunión de la junta, o mándala al chat de la comunidad. No es pa' pelear: es pa' que haya plan.`
    const share = encodeURIComponent(`${s.name} (${muni}) tiene ${s.activas} violación${s.activas > 1 ? 'es' : ''} de salud sin resolver en el récord federal del agua potable (EPA), la más reciente de ${s.reciente}. Míralo tú mismo: https://www.mapadecaborojo.com/agua#${slugify(muni)}`)
    return `
      <details class="mt-2 mb-1 bg-red-50/50 border border-red-100 rounded-xl">
        <summary class="cursor-pointer select-none px-3 py-2 text-sm font-bold text-red-800">¿Qué hago? La pregunta exacta →</summary>
        <div class="px-3 pb-3">
          <p class="text-sm text-sand-800 bg-white border border-sand-200 rounded-lg p-3 my-2">“${escapeHtml(guion)}”</p>
          <p class="text-xs text-sand-600 mb-2">${aQuien}</p>
          <a href="https://wa.me/?text=${share}" target="_blank" rel="noopener" class="inline-block text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg px-3 py-2">📲 Pásale este recibo a alguien que viva allí</a>
        </div>
      </details>`
  }

  const cards = AGUA_DATA.map(m => {
    const pop = m.systems.reduce((a, s) => a + s.pop, 0)
    const rows = m.systems.map(s => `
      <div class="py-3 border-t border-sand-100 first:border-t-0">
        <div class="flex justify-between items-start gap-3">
          <div>
            <div class="font-semibold text-sand-900">${escapeHtml(s.name)}${/PRASA/i.test(s.name) ? ' <span class="text-xs font-normal text-sand-500">(la AAA — Acueductos)</span>' : ''}</div>
            <div class="text-sm text-sand-500 mt-0.5">${fmt(s.pop)} personas · ${s.source === 'SW' ? 'agua superficial' : 'agua subterránea'} · ${escapeHtml(s.nota)}</div>
          </div>
          ${badge(s)}
        </div>
        ${actionRow(s, m.name)}
      </div>`).join('')
    return `
    <section id="${slugify(m.name)}" class="bg-white border border-sand-200 rounded-2xl p-5 mb-4 shadow-sm scroll-mt-20">
      <div class="flex justify-between items-baseline gap-3 mb-1">
        <h2 class="font-display text-xl font-bold text-sand-900 m-0">${escapeHtml(m.name)}</h2>
        <span class="text-xs text-sand-500 whitespace-nowrap">${m.systems.length} sistema${m.systems.length > 1 ? 's' : ''} · ${fmt(pop)} pers.</span>
      </div>
      ${rows}
    </section>`
  }).join('')

  const tile = (num: string, label: string, color: string) => `
    <div class="bg-white border border-sand-200 rounded-xl p-4 text-center">
      <div class="font-display text-3xl font-bold ${color}">${num}</div>
      <div class="text-xs text-sand-500 mt-1 leading-tight">${label}</div>
    </div>`

  const body = `
  <div class="max-w-3xl mx-auto px-4 py-8">
    <p class="text-brand-700 font-bold uppercase tracking-wide text-xs mb-1">Dato verificado · EPA federal</p>
    <h1 class="font-display text-3xl md:text-4xl font-extrabold text-sand-900 leading-tight mb-3">El agua de tu pueblo, contra el récord federal</h1>
    <p class="text-lg text-sand-700 leading-relaxed">Cabo Rojo y los pueblos de al lado, contra la base de datos de la EPA (el gobierno federal). En 60 segundos sabes <strong>si te toca hacer algo, qué exacto, y a quién preguntarle</strong>. Verificado el 1 de julio de 2026.</p>

    <div class="bg-white border-2 border-brand-200 rounded-2xl p-5 my-6">
      <p class="text-brand-700 font-bold uppercase tracking-wide text-xs mb-3">Empieza aquí · ¿cuál eres tú?</p>
      <div class="grid md:grid-cols-3 gap-3 text-sm">
        <div class="bg-sand-50 rounded-xl p-4">
          <p class="font-bold text-sand-900 mb-1">💧 Mi agua viene de la AAA</p>
          <p class="text-sand-600 m-0">La mayoría. Los sistemas PRASA de esta zona tienen el récord casi al día. <strong>Tu única acción:</strong> mira la tarjeta de tu pueblo abajo — si sale en rojo, ahí mismo está la pregunta exacta pa' la AAA.</p>
        </div>
        <div class="bg-sand-50 rounded-xl p-4">
          <p class="font-bold text-sand-900 mb-1">🏘️ Mi comunidad tiene su propio acueducto</p>
          <p class="text-sand-600 m-0">Búscala abajo por nombre. Si sale en rojo, hay un <strong>guión listo pa' la próxima reunión de la junta</strong> — y ayuda técnica gratis pa' resolver. No es pa' pelear: es pa' que haya plan.</p>
        </div>
        <div class="bg-sand-50 rounded-xl p-4">
          <p class="font-bold text-sand-900 mb-1">🌎 Yo no vivo allá, pero mi gente sí</p>
          <p class="text-sand-600 m-0">Cada sistema en rojo tiene un botón pa' <strong>mandarle el recibo por WhatsApp</strong> a quien vive allí, con el dato exacto y el link. Eso es todo lo que te toca.</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-3 my-6">
      ${tile(String(AGUA_DATA.length), 'pueblos', 'text-brand-700')}
      ${tile(String(activasTotal), 'violaciones de salud activas', 'text-coral-600')}
      ${tile(fmt(popActivas), 'personas en un sistema con récord activo', 'text-sand-800')}
    </div>

    <div class="bg-gold-50 border border-gold-200 border-l-4 border-l-gold-500 rounded-xl p-4 text-sm text-sand-800 mb-8">
      <strong>Esto NO es un aviso de emergencia.</strong> Los avisos de hervir el agua los emite la AAA o Salud en el momento — esta página es el <strong>récord</strong>: te dice qué vigilar y qué preguntar. Una “violación de salud” va desde una falla de monitoreo hasta un problema real; por eso separamos siempre lo <strong>activo</strong> (sin resolver) de lo <strong>ya resuelto</strong>, y le damos crédito al que está limpio. Es un espejo, no una alarma.
    </div>

    <div class="bg-gradient-to-br from-brand-50 to-white border-2 border-brand-200 rounded-2xl p-5 mb-8">
      <div class="flex items-start gap-3">
        <div class="text-3xl leading-none">🎙️</div>
        <div class="flex-1 min-w-0">
          <h2 class="font-display text-xl font-bold text-sand-900 m-0">Escúchalo en 15 minutos</h2>
          <p class="text-sm text-sand-600 mt-1 mb-0">La historia completa en cristiano: los acueductos comunales que nadie mira, qué dice el récord federal de esta zona, y qué te toca a ti. Ponlo mientras guías.</p>
          <audio controls preload="none" class="mt-3 w-full" src="${AGUA_PODCAST_URL}">Tu navegador no puede reproducir el audio. <a href="${AGUA_PODCAST_URL}" class="text-brand-700 font-semibold">Descárgalo</a>.</audio>
        </div>
      </div>
    </div>
    <script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'AudioObject',
      name: 'Los acueductos olvidados del oeste de Puerto Rico',
      description: 'El récord federal del agua potable (EPA SDWIS) de Cabo Rojo y los pueblos aledaños, en cristiano: acueductos comunales con violaciones activas, quién responde por el agua, y qué puede hacer el vecino.',
      contentUrl: AGUA_PODCAST_URL, encodingFormat: 'audio/mp4', inLanguage: 'es', isAccessibleForFree: true,
      publisher: { '@type': 'Organization', name: 'Mapa de Cabo Rojo', url: 'https://www.mapadecaborojo.com' },
    })}</script>

    <div class="bg-white border border-sand-200 rounded-2xl p-5 mb-6">
      <h2 class="font-display text-xl font-bold text-sand-900 m-0 mb-1">Cómo leer estas tarjetas, en cristiano</h2>
      <p class="text-sm text-sand-600 mt-0 mb-4">El récord federal usa palabras que nadie usa en la fila de la panadería. Traducción:</p>
      <dl class="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm m-0">
        <div><dt class="font-bold text-sand-900">“PRASA”</dt><dd class="text-sand-600 m-0 mt-0.5">Es <strong>la AAA</strong> — Acueductos, el sistema del gobierno. PRASA es su nombre en inglés y así la nombra el récord federal. Si tu agua “viene de Acueductos”, este es tu sistema.</dd></div>
        <div><dt class="font-bold text-sand-900">“20,749 personas”</dt><dd class="text-sand-600 m-0 mt-0.5">A cuántas personas les sirve agua ese sistema, según la EPA. Los sistemas grandes cruzan de un pueblo a otro, así que el número puede ser más grande que tu pueblo.</dd></div>
        <div><dt class="font-bold text-sand-900">“Agua superficial” vs “subterránea”</dt><dd class="text-sand-600 m-0 mt-0.5">Superficial = viene de un río, lago o embalse, y necesita más tratamiento. Subterránea = viene de pozo. Ninguna es “mala” — solo se vigilan distinto.</dd></div>
        <div><dt class="font-bold text-sand-900">“Trihalometanos”</dt><dd class="text-sand-600 m-0 mt-0.5">Se forman cuando el <strong>cloro que desinfecta el agua</strong> se mezcla con materia orgánica (hojas, tierra). No es que el agua te enferme hoy: es un riesgo de exposición <strong>por años</strong>, y por eso la EPA lo mide y lo anota. Lo serio es dejarlo sin corregir.</dd></div>
        <div><dt class="font-bold text-sand-900">“Coliformes”</dt><dd class="text-sand-600 m-0 mt-0.5">Bacterias que sirven de <strong>señal de alerta</strong>: si aparecen, algo pudo entrar al agua y hay que investigar. Es lo típico que se vigila en pozos y acueductos pequeños.</dd></div>
        <div><dt class="font-bold text-sand-900">“45 de 48 ya resueltas”</dt><dd class="text-sand-600 m-0 mt-0.5">Ese sistema ha tenido 48 anotaciones en toda su historia y 45 ya se corrigieron. <strong>Lo que importa es lo ACTIVO</strong> (el badge rojo): lo que sigue sin resolver hoy.</dd></div>
      </dl>
    </div>

    ${cards}

    <div class="bg-emerald-50 border border-emerald-200 border-l-4 border-l-emerald-500 rounded-2xl p-5 my-8">
      <p class="text-emerald-800 font-bold uppercase tracking-wide text-xs mb-1">Si eres de la junta de un acueducto comunal</p>
      <h3 class="font-display text-xl font-bold text-sand-900 mb-2">Esto no es una acusación. Es el mapa pa' salir del récord.</h3>
      <p class="text-sand-700 text-sm mb-2">Administrar el agua de 300 casas es trabajo duro y casi siempre voluntario. La violación no se borra escondiéndola — se borra con un plan. Y no estás solo:</p>
      <ul class="text-sand-700 text-sm space-y-1 mb-2 list-disc pl-5">
        <li><strong>Ayuda técnica gratuita:</strong> existen programas de asistencia pa' sistemas rurales y comunitarios en PR (la red RCAP trabaja con acueductos como el tuyo sin costo).</li>
        <li><strong>Fondos federales:</strong> el fondo rotatorio de agua potable (DWSRF) financia mejoras de sistemas pequeños — se canaliza por el Departamento de Salud, que es tu regulador primario.</li>
        <li><strong>El primer paso es gratis:</strong> saber exactamente qué dice tu récord. Escríbele al Veci (${PHONE_CTA}) con el nombre de tu acueducto y te pasamos el detalle federal de tu sistema, sin vueltas.</li>
      </ul>
      <p class="text-sand-600 text-xs m-0">Pedir ayuda no es fallar. Fallar es dejar el récord quieto otro año más.</p>
    </div>

    <div class="bg-white border border-sand-200 rounded-2xl p-5 my-8">
      <p class="text-brand-700 font-bold uppercase tracking-wide text-xs mb-1">¿A quién le reclamas?</p>
      <h3 class="font-display text-xl font-bold text-sand-900 mb-2">El error más caro del pueblo: gritarle a la pared equivocada</h3>
      <p class="text-sand-700 text-sm mb-4">El agua potable <strong>no es del alcalde</strong>. Cuando sabes de qué responde cada quién, dejas de perder tiempo y le reclamas al que sí puede arreglarlo.</p>
      <div class="overflow-auto border border-sand-200 rounded-xl">
        <table class="w-full text-sm">
          <thead><tr class="bg-sand-50 text-left text-xs uppercase tracking-wide text-sand-500"><th class="py-2 px-3">Quién</th><th class="py-2 px-3">De qué responde</th><th class="py-2 px-3">Cómo llegarle</th></tr></thead>
          <tbody>
            <tr class="border-t border-sand-100"><td class="py-2 px-3 font-semibold text-sand-900">AAA / PRASA</td><td class="py-2 px-3 text-sand-600">El que <strong>opera tu agua</strong>: avería, presión, calidad. El responsable real.</td><td class="py-2 px-3"><a href="tel:7876202482" class="text-brand-700 font-semibold">787-620-2482</a> · <a href="https://www.acueductos.pr.gov" target="_blank" rel="noopener" class="text-brand-700">acueductos.pr.gov</a></td></tr>
            <tr class="border-t border-sand-100"><td class="py-2 px-3 font-semibold text-sand-900">Acueducto comunal</td><td class="py-2 px-3 text-sand-600">Si tu comunidad tiene su propio sistema (mira la lista arriba), responde su junta + Salud.</td><td class="py-2 px-3 text-sand-500">Junta comunitaria local</td></tr>
            <tr class="border-t border-sand-100"><td class="py-2 px-3 font-semibold text-sand-900">Depto. de Salud / JCA</td><td class="py-2 px-3 text-sand-600">Muestreo, primacía estatal, avisos de hervir el agua.</td><td class="py-2 px-3 text-sand-500">salud.pr.gov</td></tr>
            <tr class="border-t border-sand-100"><td class="py-2 px-3 font-semibold text-sand-900">EPA (federal)</td><td class="py-2 px-3 text-sand-600">Fiscaliza y publica el récord (esta data). Obliga a cumplir.</td><td class="py-2 px-3 text-sand-500">epa.gov</td></tr>
            <tr class="border-t border-sand-100"><td class="py-2 px-3 font-semibold text-sand-900">Municipio / Alcalde</td><td class="py-2 px-3 text-sand-600">Presiona a la AAA y gestiona fondos. <strong>No controla el agua potable.</strong></td><td class="py-2 px-3 text-sand-500">—</td></tr>
            <tr class="border-t border-sand-100"><td class="py-2 px-3 font-semibold text-sand-900">Tú, vecino</td><td class="py-2 px-3 text-sand-600">Reportar la avería, exigir el reporte anual de calidad (CCR) que la AAA está obligada a publicar, y pasar el dato.</td><td class="py-2 px-3 text-sand-500">Escríbele al Veci: ${PHONE_CTA}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="bg-sand-50 border border-sand-200 border-l-4 border-l-brand-500 rounded-2xl p-5 my-8">
      <p class="text-brand-700 font-bold uppercase tracking-wide text-xs mb-1">La radiografía completa</p>
      <h3 class="font-display text-xl font-bold text-sand-900 mb-2">El récord no vive solo: el mismo sistema y un megaproyecto</h3>
      <p class="text-sand-700 text-sm mb-3">El Sistema PRASA de Cabo Rojo sirve a <strong>${fmt(20749)} personas</strong> desde la red del suroeste (Planta de Filtros Betances), con 3 violaciones activas en el récord federal. Ese mismo sistema es del que dependería <strong>Esencia</strong>, un desarrollo propuesto de más de 1,600 unidades residenciales y hoteleras.</p>
      <p class="text-sand-700 text-sm mb-3">La pregunta de interés público que sigue sin contestarse en público: <strong>¿determinó la AAA que la Planta Betances tiene capacidad para esa demanda nueva</strong>, sin afectar el servicio a los pueblos que ya abastece ni la sostenibilidad del acuífero del suroeste? Son datos que la Ley 141-2019 obliga a entregar cuando se piden.</p>
      <p class="text-sand-600 text-sm mb-0">Fuente sobre el proyecto: <a href="https://periodismoinvestigativo.com/2025/10/esencia-residential-project-tax-breaks-puerto-rico/" target="_blank" rel="noopener" class="text-brand-700 font-semibold hover:underline">investigación del Centro de Periodismo Investigativo →</a></p>
    </div>

    ${shareRow({
      text: 'El récord federal del agua de Cabo Rojo y los pueblos de al lado, en cristiano: quién está limpio, quién tiene algo activo sin resolver, y a quién reclamarle (pista: no es el alcalde).',
      url: 'https://www.mapadecaborojo.com/agua',
      toWho: 'Al chat del barrio, a la junta de tu acueducto comunal, y a ese familiar que vive en un sistema con récord activo. Un mensaje ahorra tres llamadas.',
    })}
    <p class="not-prose -mt-5 mb-8 text-sm text-sand-600 text-center">¿Prefieres una imagen? <a href="${AGUA_INFOGRAFIA_URL}" target="_blank" rel="noopener" class="text-brand-700 font-semibold hover:underline">Baja el semáforo del agua (imagen pa' compartir) →</a></p>

    <div class="bg-white border border-sand-200 rounded-2xl p-5 my-8">
      <h3 class="font-display text-lg font-bold text-sand-900 mb-2">¿Y el tuyo? Búscalo tú mismo</h3>
      <p class="text-sand-700 text-sm m-0">El récord de cualquier sistema de agua de Puerto Rico es público y gratis en el buscador de agua potable de la EPA (Safe Drinking Water). Si tu comunidad tiene su propio acueducto, búscalo por nombre; si te llega por PRASA, busca el de tu pueblo.</p>
      <p class="text-sand-800 text-sm font-semibold mt-3 mb-0">Si conoces a alguien en una comunidad con récord activo, pásale este dato. Lo que no se mira, no se arregla.</p>
    </div>

    <div class="text-center bg-brand-50 border border-brand-200 rounded-2xl p-5 mb-8">
      <p class="text-sand-700 text-sm m-0">¿Dudas de dónde queda algo o quién resuelve en tu pueblo? Escríbele al Veci: <strong>${PHONE_CTA}</strong>. Si te sirve, llégate.</p>
    </div>

    <div class="text-xs text-sand-500 border-t border-sand-200 pt-4">
      <strong>Metodología:</strong> EPA Envirofacts SDWIS (data.epa.gov). Sistemas comunitarios activos mapeados por área de servicio. “Activa” = sin fecha de retorno al cumplimiento. Tipo por regla federal (<code>rule_family_code</code>). Cobertura: sistemas comunitarios de Cabo Rojo y pueblos aledaños; no incluye pozos privados ni sistemas de escuelas/negocios. La población servida es la del <em>sistema</em> según EPA y puede cruzar límites municipales (los sistemas PRASA grandes sirven a más de un pueblo). Pull 2026-07-01. Extensión a los 15 municipios del oeste en camino.
    </div>
  </div>
  ${SHARE_COPY_SCRIPT}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Calidad del agua potable — Cabo Rojo y pueblos aledaños (récord EPA)',
    description: 'Violaciones de salud del agua potable por sistema comunitario en Cabo Rojo y pueblos del oeste de Puerto Rico, verificadas contra la base de datos federal EPA SDWIS. Separa violaciones activas de resueltas.',
    creator: { '@type': 'Organization', name: 'Mapa de Cabo Rojo' },
    isBasedOn: 'https://www.epa.gov/ground-water-and-drinking-water',
    spatialCoverage: 'Cabo Rojo, Puerto Rico',
    dateModified: '2026-07-01',
    variableMeasured: ['violaciones de salud del agua', 'trihalometanos', 'coliformes', 'población servida'],
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800')
  res.status(200).send(layout({
    title: 'El agua de tu pueblo · récord federal de la EPA',
    description: 'El récord federal del agua de Cabo Rojo y los pueblos de al lado, con lo que importa: si te toca hacer algo, la pregunta exacta pa\' la AAA o tu junta comunal, y a quién le corresponde arreglarlo.',
    slug: 'agua',
    host: req.headers?.host,
    bodyHtml: body,
    jsonLd,
    ogImage: '/og/menos-revolu.png',
  }))
}

// ====================== /raras — Enfermedades raras: quién las diagnostica en PR ======================
// Récord canónico. Cruza la noticia (PR #1 de EE.UU. en enfermedades raras, Ley 9-2025/OER) con la
// oferta real de genética clínica verificada contra NPPES (federal) + neurología por región (DB propia).
// Data verificada esta sesión (jul 2026). Cero data inventada. Amplifica a TBCK Foundation, no la reemplaza.
async function handleRaras(req: any, res: any) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300')

  // --- Oferta de genética clínica en PR (NPPES, jul 2026) ---
  // Solo direcciones de práctica EN PR. Excluidos PhD de laboratorio (170100000X, ~24) del conteo de
  // "quién diagnostica pacientes" porque son investigación/lab, no clínica de rara-enfermedad.
  const geneticistas = [
    { n: 'Dr. Alberto Santiago Cornier', tax: 'Genética Clínica (M.D.)', mun: 'Santurce, San Juan', tel: '787-728-8316', npi: '1285763144' },
    { n: 'Dra. Cristel Chapel Crespo', tax: 'Genética Clínica (M.D.)', mun: 'Manatí', tel: '787-621-3270', npi: '1275821555' },
    { n: 'Dr. Simón E. Carlo', tax: 'Genética Molecular Clínica', mun: 'Santurce, San Juan', tel: '787-728-8316', npi: '1023139896' },
    { n: 'Dra. Frances P. Vélez-Bartolomei', tax: 'Genética Bioquímica Clínica', mun: 'San Juan', tel: '787-728-8316', npi: '1083099220' },
    { n: 'Yoliann Mojica Algarín, M.S.', tax: 'Consejería Genética', mun: 'San Juan', tel: '787-728-8316', npi: '1669353322' },
    { n: 'Recinto de Ciencias Médicas (UPR)', tax: 'Programa de Genética Médica', mun: 'Río Piedras, San Juan', tel: '787-754-9165', npi: '1710275144' },
  ]
  const gRows = geneticistas.map(g => `
    <tr class="border-b border-slate-100">
      <td class="py-3 pr-3"><span class="font-semibold text-slate-800">${g.n}</span><br><span class="text-xs text-slate-500">${g.tax}</span></td>
      <td class="py-3 pr-3 text-slate-600 whitespace-nowrap">${g.mun}</td>
      <td class="py-3 pr-3 whitespace-nowrap"><a href="tel:${g.tel}" class="text-teal-700 font-semibold">${g.tel}</a></td>
      <td class="py-3 text-right"><a href="https://npiregistry.cms.hhs.gov/provider-view/${g.npi}" target="_blank" rel="noopener" class="text-xs text-slate-400 hover:text-teal-700">NPI ${g.npi} ↗</a></td>
    </tr>`).join('')

  // --- Neurología por región (DB propia, NPI-verificada) ---
  const neuroRegiones = [
    { r: 'Metro (San Juan y alrededores)', neu: 108, ncir: 31, ped: 39 },
    { r: 'Este', neu: 28, ncir: 6, ped: 10 },
    { r: 'Oeste', neu: 16, ncir: 1, ped: 7 },
    { r: 'Sur', neu: 7, ncir: 2, ped: 12 },
    { r: 'Norte', neu: 6, ncir: 4, ped: 4 },
    { r: 'Centro (la montaña)', neu: 1, ncir: 0, ped: 2 },
  ]
  const nRows = neuroRegiones.map(x => {
    const alarma = x.r.startsWith('Centro')
    return `
    <tr class="border-b border-slate-100 ${alarma ? 'bg-red-50' : ''}">
      <td class="py-2.5 pr-3 ${alarma ? 'font-bold text-red-800' : 'text-slate-700'}">${x.r}</td>
      <td class="py-2.5 pr-3 text-center ${alarma ? 'font-black text-red-700' : 'text-slate-800'}">${x.neu}</td>
      <td class="py-2.5 pr-3 text-center text-slate-600">${x.ncir}</td>
      <td class="py-2.5 text-center text-slate-600">${x.ped}</td>
    </tr>`
  }).join('')

  // --- Datos citables (botón Copiar por dato) ---
  const citas = [
    { t: 'Puerto Rico es la jurisdicción de EE.UU. con más enfermedades raras, por el efecto fundador de la mezcla taína, española y africana. No es una maldición del país: es la razón por la que la ciencia del mundo estudia el ADN boricua. (El Vocero, 10 jul 2026; Ley 9-2025)' },
    { t: 'El registro oficial de enfermedades raras (Ley 9-2025, $450,000) todavía está "en desarrollo" y aún no dice cuántas personas las padecen ni en qué pueblos viven. Mientras tanto, el mapa de quién puede diagnosticarlas ya existe, gratis, en registromedicopr.com/raras. No hay que esperar hasta el 2030. (El Vocero, 10 jul 2026)' },
    { t: 'Puerto Rico tiene 2 genetistas clínicos (M.D.) que diagnostican pacientes, 4 contando las subespecialidades, casi todos en el área metro. Están con nombre y teléfono en registromedicopr.com/raras: si crees que lo de un familiar es genético, esa lista es el primer paso concreto. (Registro federal NPPES, jul 2026)' },
    { t: 'La región central montañosa, donde se concentran mutaciones fundadoras como el albinismo y el síndrome HPS-3, tiene 1 neurólogo y 0 genetistas. Si vives en la montaña, no tienes que adivinar a quién ir: registromedicopr.com/pueblo te dice quién hay y dónde queda lo más cerca. (Registro federal NPPES, jul 2026)' },
    { t: 'Diagnosticar una enfermedad rara en Puerto Rico toma entre 2 y 10 años. A Melissmar López Pimentel le tomó 11 hasta llegar al síndrome TBCK, el "Síndrome Boricua". Si tu familia está en esa espera, la TBCK Foundation de PR acompaña a quienes ya la vivieron. No se atraviesa solo. (El Vocero, 10 jul 2026)' },
  ]
  const citasHtml = citas.map((c) => `
    <div class="not-prose flex gap-3 items-start bg-white border border-slate-200 rounded-xl p-4 mb-2.5">
      <div class="text-sm text-slate-700 flex-1">${escapeHtml(c.t)}</div>
      <button type="button" class="share-copy shrink-0 inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-lg text-xs" data-copy="${escapeHtml(c.t)}"><i class="fa-regular fa-copy"></i> Copiar</button>
    </div>`).join('')

  const body = `
<nav class="not-prose text-sm text-slate-500 mb-3"><a href="/registro" class="hover:text-teal-700">Registro Médico PR</a> <span class="text-slate-300">/</span> <span class="text-slate-700">Enfermedades raras</span></nav>

<h1 class="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">Puerto Rico, líder en enfermedades raras.<br><span class="text-teal-700">¿Y quién las diagnostica?</span></h1>
<p class="text-lg text-slate-600 mt-3">El gobierno anunció que Puerto Rico es la jurisdicción de Estados Unidos con más enfermedades raras, y que va a construir un registro oficial de quién las padece. Este récord mira el otro lado del problema: la capacidad de diagnosticarlas que ya existe hoy, contada con data federal. Porque una enfermedad que nadie puede identificar es tan grave como una que no existe.</p>

<div class="not-prose grid grid-cols-2 sm:grid-cols-4 gap-3 my-8">
  <div class="bg-slate-900 text-white rounded-2xl p-4"><div class="text-3xl font-black">#1</div><div class="text-xs text-slate-300 mt-1">jurisdicción de EE.UU. en enfermedades raras</div></div>
  <div class="bg-white border border-slate-200 rounded-2xl p-4"><div class="text-3xl font-black text-slate-900">42</div><div class="text-xs text-slate-500 mt-1">enfermedades catalogadas hasta hoy (de 7,000 en el mundo)</div></div>
  <div class="bg-white border border-slate-200 rounded-2xl p-4"><div class="text-3xl font-black text-red-700">2</div><div class="text-xs text-slate-500 mt-1">genetistas clínicos (M.D.) que diagnostican, ambos en el metro</div></div>
  <div class="bg-white border border-slate-200 rounded-2xl p-4"><div class="text-3xl font-black text-slate-900">2 a 10</div><div class="text-xs text-slate-500 mt-1">años que toma llegar a un diagnóstico ("odisea diagnóstica")</div></div>
</div>

<h2>Lo que dice la noticia</h2>
<p>El 11 de abril de 2025 se firmó la <strong>Ley 9-2025</strong>, que creó la <strong>Oficina de Enlace para el Apoyo y Registro de Personas con Enfermedades Raras (OER)</strong>, adscrita al Departamento de Salud, con un presupuesto de <strong>$450,000</strong>. Su director, el Dr. Fernando Ocasio, explicó a El Vocero que la oficina "está desarrollando la interfase de lo que va a ser el registro" y que hasta el momento han identificado <strong>42 enfermedades raras</strong> en la isla, de las cerca de 7,000 catalogadas en el mundo.</p>
<p>Una enfermedad se considera "rara" cuando afecta a menos de 2 de cada 10,000 personas. El presidente del Colegio de Médicos-Cirujanos, el Dr. Carlos Díaz, señaló que "el sistema no es ágil, no es rápido", y que las aseguradoras cuestionan y deniegan los estudios especializados que hacen falta para llegar al diagnóstico.</p>

<h2>Por qué a los boricuas les toca más</h2>
<p>La razón tiene nombre: el <strong>efecto fundador</strong>. La población de Puerto Rico viene de una mezcla de tres raíces (taína, española y africana) y de grupos que se quedaron aislados por generaciones. Cuando una mutación entra en un grupo pequeño y ese grupo crece más o menos entre sí, la mutación se vuelve mucho más común que en el resto del mundo.</p>
<p>Eso hace que ciertas enfermedades genéticas raras sean, aquí, menos raras. El albinismo, por ejemplo, aparece en cerca de 1 de cada 20,000 personas en Puerto Rico, y el síndrome HPS-3 (un tipo de albinismo con problemas de sangrado) se concentra en pueblos específicos de la montaña: <strong>Comerío, Naranjito y Barranquitas</strong>. La genética boricua no es un dato de trivia. Dibuja un mapa.</p>

<h2 id="quien-diagnostica" class="scroll-mt-20">El cuello de botella que nadie contó: quién puede diagnosticar</h2>
<p>Para diagnosticar una enfermedad rara casi siempre hace falta un genetista clínico: un médico entrenado en leer el ADN y ponerle nombre a lo que otros especialistas no encuentran. Buscamos en el registro federal NPPES cuántos hay en Puerto Rico. Este es el conteo, verificado uno por uno (julio 2026):</p>

<div class="not-prose overflow-x-auto my-5">
<table class="w-full text-sm min-w-[520px]">
  <thead><tr class="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-200"><th class="pb-2 pr-3 font-semibold">Quién</th><th class="pb-2 pr-3 font-semibold">Dónde</th><th class="pb-2 pr-3 font-semibold">Teléfono</th><th class="pb-2 font-semibold text-right">Verificar</th></tr></thead>
  <tbody>${gRows}</tbody>
</table>
</div>
<p class="text-sm text-slate-500 -mt-1">Los <strong>2</strong> genetistas clínicos (M.D.) que diagnostican pacientes están en Santurce y Manatí. Contando las subespecialidades de genética clínica (molecular y bioquímica), son 4, y <strong>cuatro de ellos comparten un mismo edificio en la Calle San Jorge de Santurce</strong>. Es decir: la genética clínica de todo Puerto Rico corre, en la práctica, desde un puñado de oficinas en el área metro. Fuente: registro federal NPPES (taxonomías 207SG0201X, 207SG0202X, 207SG0203X, 170300000X).</p>

<h2>Y las mutaciones se concentran donde no hay nadie</h2>
<p>Aquí es donde los dos mapas se cruzan. Las mutaciones fundadoras se concentran en la montaña y en pueblos específicos. Los especialistas que las diagnostican y las manejan (genetistas, neurólogos, pediatras) se concentran en el metro. <a href="/atlas" class="text-teal-700 font-semibold">Mira el Atlas de las enfermedades fundadoras boricuas, una por una y con su pueblo →</a></p>
<p>Miramos nuestra base de datos, verificada contra NPPES, para la región central montañosa:</p>

<div class="not-prose overflow-x-auto my-5">
<table class="w-full text-sm min-w-[480px]">
  <thead><tr class="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-200"><th class="pb-2 pr-3 font-semibold">Región</th><th class="pb-2 pr-3 font-semibold text-center">Neurólogos</th><th class="pb-2 pr-3 font-semibold text-center">Neurocirujanos</th><th class="pb-2 font-semibold text-center">Pediatras</th></tr></thead>
  <tbody>${nRows}</tbody>
</table>
</div>
<p class="text-slate-700"><strong>La región central montañosa (la misma donde se concentran las mutaciones fundadoras) tiene 1 neurólogo, 0 neurocirujanos y 0 genetistas para toda la región.</strong> Una familia de Comerío o Barranquitas con un hijo que necesita un genetista maneja dos horas o más para llegar a Santurce. Eso, cuando ya saben que necesitan un genetista. La mayoría no lo sabe todavía. Ese es el verdadero significado de la "odisea diagnóstica": no es solo que la ciencia sea difícil, es que no se sabe a quién ver ni dónde está.</p>

<h2>La odisea, en una familia con nombre</h2>
<p>Melissmar López Pimentel nació en 2007. Sus padres pasaron <strong>11 años</strong> buscando respuestas antes de que, en 2018, le diagnosticaran el <strong>síndrome TBCK</strong>, una enfermedad neurogenética con una variante fundadora identificada en Puerto Rico. Por eso se le conoce como el <strong>"Síndrome Boricua"</strong> (la mutación p.R126X). En el mundo hay cerca de 100 casos diagnosticados; la fundación que crearon sus padres ha identificado alrededor de 21 familias solo en Puerto Rico.</p>
<div class="not-prose bg-teal-50 border border-teal-200 rounded-2xl p-5 my-5">
  <p class="font-bold text-teal-900">Si esto es tu familia, no estás solo</p>
  <p class="text-sm text-teal-800 mt-1">Los padres de Melissmar fundaron la <strong>TBCK Foundation of PR</strong>, que acompaña a familias que enfrentan la incertidumbre después de un diagnóstico raro. Su trabajo es real y llegó antes que cualquier oficina del gobierno.</p>
  <a href="https://www.tbckfoundation.org/es" target="_blank" rel="noopener" class="inline-flex items-center gap-2 mt-3 bg-teal-700 hover:bg-teal-800 text-white font-bold px-4 py-2 rounded-full text-sm"><i class="fa-solid fa-heart"></i> Conoce la TBCK Foundation</a>
</div>

<h2>Lo declarado vs. lo entregado</h2>
<p>El gobierno se puso metas: infraestructura de datos interoperable y cubrir <strong>75% de los casos identificables para el 2030</strong>. Es una promesa buena. También es una promesa a cinco años, con $450,000, empezando desde 42 enfermedades catalogadas y sin saber todavía cuántas personas las padecen ni en qué pueblos viven. Vamos a seguirle el paso a esa promesa, año por año, en <a href="https://puertoricosinfiltros.com" class="text-teal-700 font-semibold">Puerto Rico Sin Filtros</a>. Este récord se queda con el otro lado: quién puede diagnosticar hoy, y dónde.</p>

<h2>Datos citables</h2>
<p class="text-slate-600 -mt-2">Cada dato con su fuente. Cópialo y úsalo (prensa, escuela, un mensaje a la familia). Si citas la parte de genetistas, el enlace es registromedicopr.com/raras.</p>
${citasHtml}

<div class="not-prose mt-8 bg-slate-900 rounded-2xl p-6 text-center text-white">
  <p class="text-lg font-bold mb-1">¿Necesitas encontrar un especialista hoy?</p>
  <p class="text-sm text-slate-300 mb-4">El registro te dice quién existe, en qué pueblo y con qué teléfono, verificado contra el gobierno federal. Sin cuenta, sin registro, gratis.</p>
  <div class="flex flex-wrap gap-3 justify-center">
    <a href="/registro" class="inline-flex items-center gap-2 bg-white text-slate-900 font-bold px-5 py-2.5 rounded-full text-sm hover:bg-slate-100"><i class="fa-solid fa-magnifying-glass"></i> Buscar en el registro</a>
    <a href="/pueblo" class="inline-flex items-center gap-2 bg-teal-700 text-white font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-800"><i class="fa-solid fa-location-dot"></i> El semáforo de tu pueblo</a>
  </div>
</div>

${shareRow({ text: 'Puerto Rico es #1 en EE.UU. en enfermedades raras. Tiene 2 genetistas clínicos que diagnostican, ambos en el metro, y la región de la montaña (donde se concentran las mutaciones boricuas) tiene 0. La data federal, con la fuente al lado:', url: 'https://registromedicopr.com/raras', toWho: 'A quien tenga un caso raro en la familia, a un maestro, a un periodista de salud. Cada dato trae su fuente.' })}

${regDisclaimer(false)}
${SHARE_COPY_SCRIPT}`

  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'MedicalWebPage', name: 'Enfermedades raras en Puerto Rico: quién las diagnostica', url: 'https://registromedicopr.com/raras', inLanguage: 'es',
      about: { '@type': 'MedicalCondition', name: 'Rare diseases / Enfermedades raras' },
      publisher: { '@type': 'Organization', name: 'Registro Médico PR', url: 'https://registromedicopr.com' } },
    { '@context': 'https://schema.org', '@type': 'Dataset', name: 'Genetistas clínicos y neurología por región en Puerto Rico',
      description: 'Conteo verificado contra el registro federal NPPES de genetistas clínicos y neurólogos por región en Puerto Rico, en el contexto del liderato de la isla en enfermedades raras.',
      url: 'https://registromedicopr.com/raras', inLanguage: 'es', license: 'https://creativecommons.org/licenses/by/4.0/',
      creator: { '@type': 'Organization', name: 'Registro Médico PR', url: 'https://registromedicopr.com' },
      isBasedOn: 'https://npiregistry.cms.hhs.gov' },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
      { '@type': 'Question', name: '¿Cuántos genetistas clínicos hay en Puerto Rico?', acceptedAnswer: { '@type': 'Answer', text: 'Según el registro federal NPPES (julio 2026), Puerto Rico tiene 2 genetistas clínicos (M.D.) con dirección de práctica en la isla que diagnostican pacientes, ambos en el corredor San Juan-Manatí. Contando subespecialidades de genética clínica (molecular y bioquímica), son 4, todos en el área metro y Manatí. Hay además 1 consejera genética en San Juan.' } },
      { '@type': 'Question', name: '¿Por qué Puerto Rico tiene tantas enfermedades raras?', acceptedAnswer: { '@type': 'Answer', text: 'Por el efecto fundador: la mezcla taína, española y africana y el aislamiento de ciertos grupos hicieron que algunas mutaciones genéticas sean mucho más comunes en Puerto Rico que en el resto del mundo. Varias se concentran en pueblos específicos de la montaña, como el albinismo y el síndrome HPS-3 en Comerío, Naranjito y Barranquitas.' } },
      { '@type': 'Question', name: '¿Qué es el Síndrome Boricua?', acceptedAnswer: { '@type': 'Answer', text: 'Es el síndrome TBCK, una enfermedad neurogenética rara con una variante fundadora (la mutación p.R126X) identificada en Puerto Rico. La TBCK Foundation of PR ha identificado alrededor de 21 familias en la isla.' } },
    ] },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Registro Médico PR', item: 'https://registromedicopr.com/registro' },
      { '@type': 'ListItem', position: 2, name: 'Enfermedades raras', item: 'https://registromedicopr.com/raras' },
    ] },
  ]

  res.status(200).send(layout({
    title: 'Enfermedades raras en Puerto Rico: quién las diagnostica',
    description: 'Puerto Rico es #1 en EE.UU. en enfermedades raras por el efecto fundador. Pero tiene solo 2 genetistas clínicos que diagnostican, ambos en el metro, y la región montañosa donde se concentran las mutaciones no tiene ninguno. Data federal NPPES, con la fuente al lado.',
    slug: 'raras', bodyHtml: body, jsonLd,
    ogImage: `https://registromedicopr.com/api/og?theme=medico&k=${encodeURIComponent('Enfermedades raras · Puerto Rico')}&t=${encodeURIComponent('PR es #1 en enfermedades raras||¿y quién las diagnostica?')}&sub=${encodeURIComponent('2 genetistas clínicos que diagnostican, ambos en el metro. La montaña, donde se concentran las mutaciones fundadoras: cero.')}&badge=${encodeURIComponent('Data federal NPPES')}`, host: req.headers?.host, canonicalHost: 'https://registromedicopr.com',
    canonicalUrl: 'https://registromedicopr.com/raras',
    lang: 'es',
  }))
}

// ====================== /atlas — Atlas de las Enfermedades Fundadoras Boricuas ======================
// Primer mapa consolidado, en español y por pueblo, de las enfermedades genéticas con variante
// fundadora propia de PR. Cada condición verificada contra literatura científica primaria (jul 2026).
// Firma ALIVIO: no es maldición (es por qué la ciencia mira aquí) + cada tarjeta aterriza en "quién
// la diagnostica / a dónde ir". Cero data inventada.
async function handleAtlas(req: any, res: any) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300')

  const condiciones = [
    {
      slug: 'hps1', emoji: '🧬',
      nombre: 'Síndrome de Hermansky-Pudlak tipo 1',
      comun: 'Un tipo de albinismo con problemas de sangrado',
      gen: 'gen HPS1',
      region: 'Noroeste (Aguadilla, Isabela, Quebradillas y alrededores)',
      comunAqui: '1 de cada 1,800 personas en el noroeste. 1 de cada 21 bebés del noroeste es portador.',
      senal: 'Piel y pelo muy claros, problemas de visión, moretones o sangrados fáciles. En la adultez puede afectar los pulmones.',
      apoyoN: 'HPS Network', apoyoUrl: 'https://www.hpsnetwork.org',
      fuente: 'Journal of the American Academy of Dermatology (2019); Nature Genetics',
      fuenteUrl: 'https://www.jaad.org/article/S0190-9622(19)31801-8/abstract',
    },
    {
      slug: 'hps3', emoji: '🏔️',
      nombre: 'Síndrome de Hermansky-Pudlak tipo 3',
      comun: 'Una forma más leve del mismo albinismo con sangrado',
      gen: 'gen HPS3',
      region: 'Centro montañoso (un aislado genético del centro de la isla: Comerío, Naranjito, Barranquitas)',
      comunAqui: '1 de cada 32 bebés del centro de la isla es portador.',
      senal: 'Parecido al tipo 1 pero por lo general más leve.',
      apoyoN: 'HPS Network', apoyoUrl: 'https://www.hpsnetwork.org',
      fuente: 'Nature Genetics (2001): "mutación de un gen nuevo en un aislado genético del centro de PR"; OMIM 614072',
      fuenteUrl: 'https://www.nature.com/articles/ng576',
    },
    {
      slug: 'tbck', emoji: '👶',
      nombre: 'Síndrome TBCK ("Síndrome Boricua")',
      comun: 'Una enfermedad neurogenética de la niñez',
      gen: 'gen TBCK, variante p.R126X',
      region: 'Toda la isla; la variante fundadora fue identificada en Puerto Rico',
      comunAqui: 'Cerca de 21 familias identificadas en PR, de unos 100 casos en todo el mundo.',
      senal: 'Bebé con tono muscular muy bajo ("flojito"), epilepsia, retraso en el desarrollo, dificultad para hablar y para tragar.',
      apoyoN: 'TBCK Foundation of PR', apoyoUrl: 'https://www.tbckfoundation.org/es',
      fuente: 'El Vocero (2026); TBCK Foundation of PR',
      fuenteUrl: 'https://www.tbckfoundation.org/es/sindrome-tbck',
    },
    {
      slug: 'rsph4a', emoji: '🫁',
      nombre: 'Disquinesia ciliar primaria (variante RSPH4A)',
      comun: 'Una enfermedad respiratoria crónica desde el nacimiento',
      gen: 'gen RSPH4A, variante c.921+3_6delAAGT',
      region: 'Más frecuente en el oeste. Mayagüez concentra cerca del 30% de los casos.',
      comunAqui: 'La variante boricua explica 2 de cada 3 casos de esta enfermedad en PR. Se estima cerca de 1,624 personas afectadas.',
      senal: 'Congestión, infecciones de oído y sinusitis desde bebé, tos crónica. Se confunde con asma o alergias por años.',
      apoyoN: '', apoyoUrl: '',
      fuente: 'Diagnostics (MDPI, 2021-2022); PMC / NIH',
      fuenteUrl: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8415044/',
    },
    {
      slug: 'lgmd2c', emoji: '💪',
      nombre: 'Distrofia muscular de cinturas tipo 2C',
      comun: 'Una debilidad muscular que progresa despacio',
      gen: 'gen SGCG, variante p.E263K',
      region: 'Documentada como variante fundadora en la población puertorriqueña',
      comunAqui: 'Variante fundadora en hispanos de Puerto Rico. Es una de las que la noticia describe como "parecida a la distrofia muscular".',
      senal: 'Debilidad que avanza despacio en caderas y hombros: cuesta correr, subir escaleras o levantarse del piso.',
      apoyoN: '', apoyoUrl: '',
      fuente: 'PMC / NIH (2015): forma lentamente progresiva de LGMD2C por variante fundadora en SGCG',
      fuenteUrl: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4367081/',
    },
    {
      slug: 'brca2', emoji: '🎗️',
      nombre: 'Cáncer hereditario de seno y ovario (BRCA2 E1308X)',
      comun: 'Un riesgo genético de cáncer que se hereda en la familia',
      gen: 'gen BRCA2, variante E1308X',
      region: 'Toda la isla; explica la mayoría de los casos hereditarios en PR',
      comunAqui: 'Una sola variante fundadora explica la mayoría del cáncer hereditario de seno y ovario en Puerto Rico.',
      senal: 'Varios casos de cáncer de seno u ovario en la misma familia, o a edad joven. Esta SÍ se puede accionar: hay pruebas genéticas y prevención.',
      apoyoN: '', apoyoUrl: '',
      fuente: 'PMC / NIH (2018): "A Recurrent BRCA2 Mutation Explains the Majority of Hereditary Breast and Ovarian Cancer in Puerto Rico"',
      fuenteUrl: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6266560/',
    },
  ]

  const cards = condiciones.map(c => `
    <div id="${c.slug}" class="not-prose bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 scroll-mt-20">
      <div class="flex items-start gap-4">
        <div class="text-4xl leading-none">${c.emoji}</div>
        <div class="flex-1">
          <h3 class="text-xl font-black text-slate-900 leading-tight">${c.nombre}</h3>
          <p class="text-slate-500 mt-0.5">${c.comun} · <span class="text-slate-400">${c.gen}</span></p>
        </div>
      </div>
      <div class="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div><span class="font-bold text-slate-700">Dónde se concentra</span><br><span class="text-slate-600">${c.region}</span></div>
        <div><span class="font-bold text-slate-700">Qué tan común aquí</span><br><span class="text-slate-600">${c.comunAqui}</span></div>
        <div class="sm:col-span-2"><span class="font-bold text-slate-700">Señales</span><br><span class="text-slate-600">${c.senal}</span></div>
      </div>
      <div class="mt-4 flex flex-wrap items-center gap-2">
        <a href="/raras#quien-diagnostica" class="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 text-teal-800 font-semibold px-3 py-1.5 rounded-full text-xs hover:bg-teal-100"><i class="fa-solid fa-user-doctor"></i> Quién la diagnostica</a>
        <a href="/pueblo" class="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-full text-xs hover:bg-slate-100"><i class="fa-solid fa-location-dot"></i> Especialistas en tu pueblo</a>
        ${c.apoyoN ? `<a href="${c.apoyoUrl}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 font-semibold px-3 py-1.5 rounded-full text-xs hover:bg-rose-100"><i class="fa-solid fa-heart"></i> Apoyo: ${escapeHtml(c.apoyoN)}</a>` : ''}
        <button type="button" class="share-copy inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-full text-xs" data-copy="${escapeHtml(`${c.nombre} (${c.gen}): ${c.comun}. En PR: ${c.comunAqui} Se concentra en: ${c.region}. Fuente: ${c.fuente}. Más en registromedicopr.com/atlas`)}"><i class="fa-regular fa-copy"></i> Copiar el dato</button>
      </div>
      <p class="text-xs text-slate-400 mt-3">Fuente: <a href="${c.fuenteUrl}" target="_blank" rel="noopener" class="hover:text-teal-700 underline">${escapeHtml(c.fuente)}</a></p>
    </div>`).join('')

  const indice = condiciones.map(c => `<a href="#${c.slug}" class="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-full text-sm hover:border-teal-400">${c.emoji} ${escapeHtml(c.nombre.split('(')[0].trim())}</a>`).join(' ')

  const citas = [
    { t: 'El efecto fundador de Puerto Rico ha producido al menos 6 enfermedades genéticas con variante propia boricua documentada en la literatura científica: Hermansky-Pudlak tipo 1 y tipo 3, síndrome TBCK, disquinesia ciliar RSPH4A, distrofia de cinturas SGCG y cáncer hereditario BRCA2. El mapa consolidado, en español y por pueblo, está en registromedicopr.com/atlas.' },
    { t: 'El síndrome de Hermansky-Pudlak (un albinismo con problemas de sangrado) aparece en 1 de cada 1,800 personas en el noroeste de Puerto Rico por efecto fundador. 1 de cada 21 bebés del noroeste es portador. (Journal of the American Academy of Dermatology, 2019; Nature Genetics)' },
    { t: 'Una sola variante fundadora en el gen RSPH4A explica 2 de cada 3 casos de disquinesia ciliar primaria en Puerto Rico, con cerca de 1,624 personas afectadas y mayor concentración en Mayagüez. Se confunde con asma por años. (Diagnostics, MDPI)' },
    { t: 'Una sola variante fundadora en el gen BRCA2 (E1308X) explica la mayoría del cáncer hereditario de seno y ovario en Puerto Rico. A diferencia de otras enfermedades raras, esta sí se puede accionar con pruebas genéticas y prevención. Si hay varios casos en tu familia, se puede hacer algo hoy. (PMC/NIH, 2018)' },
  ]
  const citasHtml = citas.map(c => `
    <div class="not-prose flex gap-3 items-start bg-white border border-slate-200 rounded-xl p-4 mb-2.5">
      <div class="text-sm text-slate-700 flex-1">${escapeHtml(c.t)}</div>
      <button type="button" class="share-copy shrink-0 inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-lg text-xs" data-copy="${escapeHtml(c.t)}"><i class="fa-regular fa-copy"></i> Copiar</button>
    </div>`).join('')

  const body = `
<nav class="not-prose text-sm text-slate-500 mb-3"><a href="/registro" class="hover:text-teal-700">Registro Médico PR</a> <span class="text-slate-300">/</span> <a href="/raras" class="hover:text-teal-700">Enfermedades raras</a> <span class="text-slate-300">/</span> <span class="text-slate-700">Atlas</span></nav>

<h1 class="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">El Atlas de las enfermedades<br><span class="text-teal-700">fundadoras boricuas</span></h1>
<p class="text-lg text-slate-600 mt-3">Un diagnóstico raro asusta, y muchas veces llega con la sensación de estar solo y de que nadie entiende. Este Atlas existe para lo contrario: para que veas que ya tiene nombre, ya tiene pueblo, y ya alguien sabe qué es. No es una maldición de Puerto Rico. Es la razón por la que la ciencia del mundo estudia el ADN boricua, y aquí lo tienes en cristiano, condición por condición, con su fuente al lado.</p>

<div class="not-prose bg-slate-50 border border-slate-200 rounded-2xl p-5 my-6">
  <p class="font-bold text-slate-800">¿Qué es una "enfermedad fundadora"?</p>
  <p class="text-sm text-slate-600 mt-1">Cuando una mutación entra en un grupo pequeño de personas y ese grupo crece más o menos entre sí por generaciones, la mutación se vuelve mucho más común ahí que en el resto del mundo. Eso es el efecto fundador. En Puerto Rico dibujó un mapa: ciertas enfermedades raras se concentran en pueblos específicos. Aquí están las que la ciencia ya documentó.</p>
</div>

<div class="not-prose flex flex-wrap gap-2 my-6">${indice}</div>

<div class="not-prose space-y-4">${cards}</div>

<div class="not-prose bg-amber-50 border border-amber-200 rounded-2xl p-5 sm:p-6 my-8">
  <p class="font-black text-amber-900 text-lg">Señales de alerta desde la infancia</p>
  <p class="text-sm text-amber-800 mt-1">La detección temprana es lo que acorta la odisea. Si un bebé o un niño muestra varias de estas señales, no es para asustarse, es para preguntar temprano:</p>
  <ul class="text-sm text-amber-900 mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 list-disc pl-5">
    <li>Retraso en alcanzar hitos (sentarse, caminar, hablar)</li>
    <li>Dificultad para alimentarse o para tragar</li>
    <li>Convulsiones o movimientos involuntarios</li>
    <li>Crecimiento deficiente o pérdida de peso inesperada</li>
    <li>Infecciones frecuentes o severas</li>
    <li>Varios casos parecidos en la familia</li>
  </ul>
  <p class="text-sm text-amber-800 mt-3">Ninguna señal sola significa una enfermedad rara. Pero si vienen varias juntas, mencionárselo al pediatra temprano puede ahorrar años. Fuente: El Vocero (2026), Oficina de Enfermedades Raras.</p>
</div>

<div class="not-prose mt-8 bg-teal-700 rounded-2xl p-6 text-center text-white">
  <p class="text-lg font-bold mb-1">Si algo de esto te suena a tu familia</p>
  <p class="text-sm text-teal-100 mb-4">No tienes que resolverlo hoy ni entenderlo todo. Un primer paso concreto: ver quién puede diagnosticar y dónde queda lo más cerca de ti.</p>
  <div class="flex flex-wrap gap-3 justify-center">
    <a href="/raras#quien-diagnostica" class="inline-flex items-center gap-2 bg-white text-teal-800 font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-50"><i class="fa-solid fa-user-doctor"></i> Quién diagnostica en PR</a>
    <a href="/pueblo" class="inline-flex items-center gap-2 bg-teal-800 text-white font-bold px-5 py-2.5 rounded-full text-sm hover:bg-teal-900"><i class="fa-solid fa-location-dot"></i> El semáforo de tu pueblo</a>
  </div>
</div>

<h2>Datos citables</h2>
<p class="text-slate-600 -mt-2">Cada dato con su fuente y con algo que hacer. Cópialo y úsalo: un mensaje a la familia, una nota de prensa, una pregunta al médico.</p>
${citasHtml}

${shareRow({ text: 'El Atlas de las enfermedades fundadoras boricuas: 6 condiciones genéticas con variante propia de Puerto Rico, cada una con su pueblo, sus señales y quién la diagnostica. En cristiano y con la fuente al lado:', url: 'https://registromedicopr.com/atlas', toWho: 'A quien tenga un caso raro en la familia, a un pediatra, a un maestro. Puede ahorrarle a alguien años de no saber.' })}

${regDisclaimer(false)}
${SHARE_COPY_SCRIPT}`

  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'MedicalWebPage', name: 'Atlas de las enfermedades fundadoras boricuas', url: 'https://registromedicopr.com/atlas', inLanguage: 'es',
      publisher: { '@type': 'Organization', name: 'Registro Médico PR', url: 'https://registromedicopr.com' },
      about: condiciones.map(c => ({ '@type': 'MedicalCondition', name: c.nombre, associatedAnatomy: undefined })) },
    { '@context': 'https://schema.org', '@type': 'Dataset', name: 'Enfermedades genéticas con variante fundadora en Puerto Rico',
      description: 'Mapa consolidado de enfermedades con mutación fundadora documentada en Puerto Rico (HPS-1, HPS-3, TBCK, RSPH4A, LGMD2C/SGCG, BRCA2), con región de concentración, prevalencia y fuente científica primaria.',
      url: 'https://registromedicopr.com/atlas', inLanguage: 'es', license: 'https://creativecommons.org/licenses/by/4.0/',
      creator: { '@type': 'Organization', name: 'Registro Médico PR', url: 'https://registromedicopr.com' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
      { '@type': 'Question', name: '¿Cuáles son las enfermedades fundadoras de Puerto Rico?', acceptedAnswer: { '@type': 'Answer', text: 'Entre las enfermedades con variante fundadora documentada en Puerto Rico están el síndrome de Hermansky-Pudlak tipo 1 (noroeste) y tipo 3 (centro montañoso), el síndrome TBCK o "Síndrome Boricua", la disquinesia ciliar primaria por RSPH4A (más frecuente en el oeste), la distrofia muscular de cinturas tipo 2C (SGCG) y el cáncer hereditario de seno y ovario por la variante BRCA2 E1308X.' } },
      { '@type': 'Question', name: '¿Qué es una enfermedad fundadora?', acceptedAnswer: { '@type': 'Answer', text: 'Es una enfermedad genética cuya mutación se volvió mucho más común en un grupo por el efecto fundador: cuando una mutación entra en una población pequeña que crece relativamente aislada, se concentra. En Puerto Rico varias enfermedades raras se concentran en pueblos específicos.' } },
      { '@type': 'Question', name: '¿El síndrome de Hermansky-Pudlak es común en Puerto Rico?', acceptedAnswer: { '@type': 'Answer', text: 'Sí. Por efecto fundador aparece en cerca de 1 de cada 1,800 personas en el noroeste de Puerto Rico, y 1 de cada 21 bebés del noroeste es portador del tipo 1. El tipo 3 se concentra en el centro montañoso.' } },
    ] },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Registro Médico PR', item: 'https://registromedicopr.com/registro' },
      { '@type': 'ListItem', position: 2, name: 'Enfermedades raras', item: 'https://registromedicopr.com/raras' },
      { '@type': 'ListItem', position: 3, name: 'Atlas de enfermedades fundadoras', item: 'https://registromedicopr.com/atlas' },
    ] },
  ]

  res.status(200).send(layout({
    title: 'Atlas de las enfermedades fundadoras boricuas',
    description: 'El primer mapa consolidado, en español y por pueblo, de las enfermedades genéticas con variante fundadora propia de Puerto Rico: Hermansky-Pudlak, TBCK, disquinesia ciliar RSPH4A, distrofia SGCG, cáncer hereditario BRCA2. Con señales, quién diagnostica y fuente científica.',
    slug: 'atlas', bodyHtml: body, jsonLd,
    ogImage: `https://registromedicopr.com/api/og?theme=medico&k=${encodeURIComponent('Registro Médico PR')}&t=${encodeURIComponent('El Atlas de las enfermedades||fundadoras boricuas')}&sub=${encodeURIComponent('6 condiciones con variante propia de Puerto Rico, por pueblo, con quién las diagnostica.')}&badge=${encodeURIComponent('Verificado con ciencia primaria')}`, host: req.headers?.host, canonicalHost: 'https://registromedicopr.com',
    canonicalUrl: 'https://registromedicopr.com/atlas',
    lang: 'es',
  }))
}

// ====================== /registro-raras — El Expediente: el registro de raras que prometió el gobierno (PRSF) ======================
// Marcador de la promesa: Ley 9-2025 / OER. Declarado vs entregado. La cara PRSF del eje diagnóstico;
// la cara supply-side vive en registromedicopr.com/raras + /atlas. Reloj vivo. Cero data inventada.
async function handleOER(req: any, res: any) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=3600')

  const hoy = new Date()
  const leyFirmada = new Date('2025-04-11T00:00:00Z')
  const meta2030 = new Date('2030-01-01T00:00:00Z')
  const dias = (a: Date, b: Date) => Math.round(Math.abs(a.getTime() - b.getTime()) / 86400000)
  const diasDesdeLey = dias(hoy, leyFirmada)
  const diasHasta2030 = dias(meta2030, hoy)

  const marcador = [
    { it: 'Ley 9-2025 firmada', est: 'cumplido', det: 'Firmada el 11 de abril de 2025. Crea el Registro Oficial de Personas con Enfermedades Raras.' },
    { it: 'Oficina OER establecida', est: 'cumplido', det: 'Adscrita al Departamento de Salud, como entidad rectora.' },
    { it: 'Director nombrado', est: 'cumplido', det: 'Dr. Fernando Ocasio.' },
    { it: 'Presupuesto asignado', est: 'cumplido', det: '$450,000.' },
    { it: 'Interface del registro', est: 'proceso', det: '"Está desarrollando la interfase de lo que va a ser el registro", según su director (jul 2026).' },
    { it: 'Enfermedades catalogadas', est: 'proceso', det: '42 identificadas, de cerca de 7,000 en el mundo (0.6%).' },
    { it: 'Cuántas personas las padecen', est: 'pendiente', det: 'Todavía no hay una cifra de cuántas personas están afectadas en la isla.' },
    { it: 'En qué pueblos viven', est: 'pendiente', det: 'Todavía no hay geografía: dónde se concentran los casos.' },
    { it: 'Infraestructura de datos interoperable', est: 'proceso', det: 'Meta establecida para 2026-2030.' },
    { it: 'Cubrir 75% de los casos identificables', est: 'pendiente', det: 'Meta para el año 2030.' },
  ]
  const badge = (est: string) => est === 'cumplido'
    ? '<span class="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">✓ hecho</span>'
    : est === 'proceso'
      ? '<span class="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">⏳ en desarrollo</span>'
      : '<span class="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">✗ todavía no</span>'
  const nHecho = marcador.filter(m => m.est === 'cumplido').length
  const nProceso = marcador.filter(m => m.est === 'proceso').length
  const nPend = marcador.filter(m => m.est === 'pendiente').length
  const marcadorHtml = marcador.map(m => `
    <div class="flex items-start justify-between gap-3 py-3 border-b border-slate-100">
      <div class="flex-1"><span class="font-semibold text-slate-800">${m.it}</span><br><span class="text-sm text-slate-500">${m.det}</span></div>
      <div class="shrink-0 pt-0.5">${badge(m.est)}</div>
    </div>`).join('')

  const citas = [
    { t: `La Ley 9-2025 creó el registro oficial de enfermedades raras de Puerto Rico hace ${diasDesdeLey} días. Sigue "en desarrollo": 42 enfermedades catalogadas, sin conteo de cuántas personas las padecen ni en qué pueblos viven. Mientras tanto, el mapa de quién puede diagnosticarlas ya existe, gratis: registromedicopr.com/raras. (Puerto Rico Sin Filtros)` },
    { t: `La meta oficial del gobierno es cubrir 75% de los casos identificables de enfermedades raras para el 2030. Faltan ${diasHasta2030.toLocaleString('en-US')} días. El reloj corre en puertoricosinfiltros.com/registro-raras.` },
    { t: `Puerto Rico es la jurisdicción #1 de EE.UU. en enfermedades raras por el efecto fundador, y ya hay 6 con variante propia boricua documentada en la ciencia. El registro oficial que las contará todavía no existe; el mapa de las que ya se conocen, sí: registromedicopr.com/atlas. (Puerto Rico Sin Filtros)` },
  ]
  const citasHtml = citas.map(c => `
    <div class="not-prose flex gap-3 items-start bg-white border border-slate-200 rounded-xl p-4 mb-2.5">
      <div class="text-sm text-slate-700 flex-1">${escapeHtml(c.t)}</div>
      <button type="button" class="share-copy shrink-0 inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-lg text-xs" data-copy="${escapeHtml(c.t)}"><i class="fa-regular fa-copy"></i> Copiar</button>
    </div>`).join('')

  const body = `
<div class="not-prose bg-slate-900 text-white rounded-2xl p-5 sm:p-6">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">El Expediente</p>
  <h1 class="text-2xl sm:text-3xl font-black mt-1 leading-tight" style="font-family:'Fraunces',Georgia,serif">El registro de enfermedades raras que prometió el gobierno</h1>
  <p class="text-slate-300 mt-1">Ley 9-2025 · Oficina OER · Depto. de Salud · $450,000</p>
</div>

<p class="text-lg text-slate-600 mt-4">El gobierno anunció que Puerto Rico es la jurisdicción de EE.UU. con más enfermedades raras, y creó por ley una oficina para registrarlas. Es una buena noticia. Este expediente le sigue el paso, con la fuente al lado: lo que se prometió, lo que ya está hecho, y lo que todavía no. No para atacar, para que no se pierda.</p>

<div class="not-prose grid grid-cols-3 gap-3 my-6">
  <div class="bg-white border border-slate-200 rounded-2xl p-4 text-center"><div class="text-3xl font-black text-emerald-700">${nHecho}</div><div class="text-xs text-slate-500 mt-1">pasos hechos</div></div>
  <div class="bg-white border border-slate-200 rounded-2xl p-4 text-center"><div class="text-3xl font-black text-amber-600">${nProceso}</div><div class="text-xs text-slate-500 mt-1">en desarrollo</div></div>
  <div class="bg-white border border-slate-200 rounded-2xl p-4 text-center"><div class="text-3xl font-black text-red-700">${nPend}</div><div class="text-xs text-slate-500 mt-1">todavía no</div></div>
</div>

<h2>El marcador de la promesa</h2>
<p class="text-slate-600 -mt-2">Lo que dice la Ley 9-2025 y lo que dijo su director a la prensa (El Vocero, 10 jul 2026), punto por punto.</p>
<div class="not-prose bg-white border border-slate-200 rounded-2xl p-5 mt-3">${marcadorHtml}</div>

<div class="not-prose grid sm:grid-cols-2 gap-3 my-6">
  <div class="bg-slate-50 border border-slate-200 rounded-2xl p-5"><div class="text-3xl font-black text-slate-900">${diasDesdeLey}</div><div class="text-sm text-slate-500 mt-1">días desde que se firmó la ley (11 abr 2025) y el registro sigue en desarrollo</div></div>
  <div class="bg-slate-50 border border-slate-200 rounded-2xl p-5"><div class="text-3xl font-black text-slate-900">${diasHasta2030.toLocaleString('en-US')}</div><div class="text-sm text-slate-500 mt-1">días para la meta de cubrir 75% de los casos (2030)</div></div>
</div>

<div class="not-prose bg-teal-50 border border-teal-200 rounded-2xl p-5 sm:p-6 my-6">
  <p class="font-black text-teal-900 text-lg">La otra mitad de la moneda ya existe</p>
  <p class="text-sm text-teal-800 mt-1">El gobierno está construyendo "quién TIENE la enfermedad". La otra mitad, "quién la DIAGNOSTICA y dónde", no hay que esperarla hasta el 2030: ya está viva, verificada contra el registro federal, gratis.</p>
  <div class="flex flex-wrap gap-3 mt-3">
    <a href="https://registromedicopr.com/raras" class="inline-flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white font-bold px-4 py-2 rounded-full text-sm"><i class="fa-solid fa-user-doctor"></i> Quién diagnostica en PR</a>
    <a href="https://registromedicopr.com/atlas" class="inline-flex items-center gap-2 bg-white border border-teal-300 text-teal-800 font-bold px-4 py-2 rounded-full text-sm"><i class="fa-solid fa-dna"></i> El Atlas de las fundadoras boricuas</a>
  </div>
</div>

<h2>Preguntas que solo la OER puede contestar</h2>
<p class="text-slate-600 -mt-2">Cuando el registro avance, estas se podrán llenar. Las dejamos anotadas para medir el progreso.</p>
<ul class="text-slate-700">
  <li>¿Cuántas personas con enfermedades raras hay identificadas hasta hoy?</li>
  <li>¿En qué municipios se concentran los casos?</li>
  <li>¿Cuándo estará disponible la interface pública del registro?</li>
  <li>¿Cuánto de los $450,000 se ha usado, y en qué?</li>
</ul>

<h2>Datos citables</h2>
<p class="text-slate-600 -mt-2">Cada dato con su fuente y con algo que hacer. Cópialo y úsalo.</p>
${citasHtml}

${shareRow({ text: `El registro oficial de enfermedades raras de PR (Ley 9-2025, $450K) lleva ${diasDesdeLey} días y sigue "en desarrollo". Le seguimos el paso, con la fuente al lado, y el mapa de quién sí puede diagnosticarlas ya existe:`, url: 'https://puertoricosinfiltros.com/registro-raras', toWho: 'A quien le toque una enfermedad rara en la familia, a un periodista de salud, a un legislador.' })}

<div class="not-prose bg-teal-50 border border-teal-200 rounded-2xl p-6 mt-8 text-center">
  <p class="text-lg font-black text-slate-900" style="font-family:'Fraunces',Georgia,serif">Una promesa buena no se pierde si alguien le sigue el paso.</p>
  <p class="mt-2 text-sm text-slate-600 italic">Todo con fuente. Se actualiza con el récord. Neutral, no partidista.</p>
</div>

<p class="text-sm text-slate-500 mt-6">Fuentes: Ley 9-2025 (LexJuris) · El Vocero (10 jul 2026) · registro federal NPPES (capacidad de diagnóstico). Este expediente es el récord, no una opinión. Julio 2026.</p>
${SHARE_COPY_SCRIPT}`

  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: 'El Expediente: el registro de enfermedades raras que prometió el gobierno', url: 'https://puertoricosinfiltros.com/registro-raras', inLanguage: 'es',
      publisher: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
      { '@type': 'Question', name: '¿Qué es la Ley 9-2025 de enfermedades raras de Puerto Rico?', acceptedAnswer: { '@type': 'Answer', text: 'La Ley 9-2025, firmada el 11 de abril de 2025, creó la Oficina de Enlace para el Apoyo y Registro de Personas con Enfermedades Raras (OER), adscrita al Departamento de Salud, con un presupuesto de $450,000, para mantener un registro oficial de las personas con enfermedades raras en la isla.' } },
      { '@type': 'Question', name: '¿En qué va el registro oficial de enfermedades raras de PR?', acceptedAnswer: { '@type': 'Answer', text: 'Según su director (julio 2026), la interface del registro está "en desarrollo". Se han catalogado 42 enfermedades de cerca de 7,000 en el mundo, pero todavía no hay una cifra de cuántas personas las padecen ni en qué municipios viven. La meta oficial es cubrir 75% de los casos identificables para 2030.' } },
    ] },
  ]

  const og = `https://puertoricosinfiltros.com/api/og?theme=sinfiltros&k=${encodeURIComponent('El Expediente · Enfermedades raras')}&t=${encodeURIComponent('El registro que prometió el gobierno||el marcador de la promesa')}&sub=${encodeURIComponent(`${nHecho} pasos hechos · ${nProceso} en desarrollo · ${nPend} todavía no · ${diasDesdeLey} días desde la ley`)}&badge=${encodeURIComponent('Ley 9-2025 · $450K')}`

  res.status(200).send(layout({
    title: 'El Expediente: el registro de enfermedades raras que prometió el gobierno',
    description: `Ley 9-2025 creó el registro oficial de enfermedades raras de PR con $450,000. ${diasDesdeLey} días después sigue "en desarrollo": 42 catalogadas, sin conteo de personas ni geografía. Le seguimos el paso, con la fuente al lado.`,
    slug: 'registro-raras', bodyHtml: body, jsonLd, ogImage: og,
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
    canonicalUrl: 'https://puertoricosinfiltros.com/registro-raras',
  }))
}

// ====================== /investigacion — El ADN más valioso de EE.UU. y el dinero que no llega (PRSF) ======================
// Récord "sigue el dinero": financiamiento NIH FY2024 verificado contra NIH RePORTER (jul 2026), per cápita
// vs estados de población similar. Cruza al eje raras/founder-effect. Cero data inventada.
async function handleInvestigacion(req: any, res: any) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=3600')

  // NIH RePORTER, año fiscal 2024 (verificado esta sesión). Poblaciones: est. Censo 2024.
  const filas = [
    { st: 'Connecticut', pop: '3.6M', total: 861415834, pc: 239 },
    { st: 'Iowa', pop: '3.2M', total: 248950413, pc: 78, twin: true },
    { st: 'Arkansas', pop: '3.0M', total: 135004024, pc: 45 },
    { st: 'Mississippi', pop: '2.9M', total: 91324345, pc: 31, pobre: true },
    { st: 'Puerto Rico', pop: '3.2M', total: 89658072, pc: 28, self: true },
  ]
  const prPc = 28
  const rowsHtml = filas.map(f => `
    <tr class="border-t border-slate-100 ${f.self ? 'bg-red-50' : ''}">
      <td class="py-2 px-3 ${f.self ? 'font-black text-red-800' : 'font-semibold text-slate-800'}">${f.st}${f.twin ? ' <span class="text-xs font-normal text-slate-400">(misma población que PR)</span>' : ''}${f.pobre ? ' <span class="text-xs font-normal text-slate-400">(el estado más pobre)</span>' : ''}</td>
      <td class="py-2 px-3 text-right text-slate-600">${f.pop}</td>
      <td class="py-2 px-3 text-right ${f.self ? 'font-bold text-red-700' : 'text-slate-700'}">$${(f.total/1e6).toFixed(0)}M</td>
      <td class="py-2 px-3 text-right ${f.self ? 'font-black text-red-700' : 'font-semibold text-slate-800'}">$${f.pc}</td>
      <td class="py-2 px-3 text-right text-slate-500">${f.self ? '—' : (f.pc/prPc).toFixed(1) + '×'}</td>
    </tr>`).join('')

  const iowaGap = 248950413 - 89658072

  const citas = [
    { t: 'Puerto Rico e Iowa tienen la misma población (3.2 millones). En el año fiscal 2024, los Institutos Nacionales de Salud (NIH) invirtieron $249 millones en Iowa y $90 millones en Puerto Rico. La misma gente, un tercio del dinero. (NIH RePORTER, FY2024)' },
    { t: 'Puerto Rico recibe menos financiamiento de investigación de salud por persona ($28) que Mississippi, el estado más pobre de Estados Unidos ($31). Y eso que el ADN boricua, por el efecto fundador, es de los más valiosos del mundo para entender enfermedades genéticas. (NIH RePORTER, FY2024)' },
    { t: 'La diferencia entre lo que NIH invirtió en Iowa y en Puerto Rico en un solo año (2024) fue de $159 millones. Puerto Rico, con la población founder-effect más estudiada de la nación, recibió $28 por persona. (NIH RePORTER, FY2024; registromedicopr.com/atlas)' },
  ]
  const citasHtml = citas.map(c => `
    <div class="not-prose flex gap-3 items-start bg-white border border-slate-200 rounded-xl p-4 mb-2.5">
      <div class="text-sm text-slate-700 flex-1">${escapeHtml(c.t)}</div>
      <button type="button" class="share-copy shrink-0 inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-lg text-xs" data-copy="${escapeHtml(c.t)}"><i class="fa-regular fa-copy"></i> Copiar</button>
    </div>`).join('')

  const body = `
<div class="not-prose bg-slate-900 text-white rounded-2xl p-5 sm:p-6">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">Sigue el dinero</p>
  <h1 class="text-2xl sm:text-3xl font-black mt-1 leading-tight" style="font-family:'Fraunces',Georgia,serif">El ADN más valioso de Estados Unidos, y el dinero de ciencia que no llega</h1>
  <p class="text-slate-300 mt-1">Financiamiento de los Institutos Nacionales de Salud (NIH) · año fiscal 2024</p>
</div>

<p class="text-lg text-slate-600 mt-4">Puerto Rico es la jurisdicción de EE.UU. con más enfermedades raras, por el efecto fundador. Eso hace que el ADN boricua sea de los más estudiados del mundo para entender enfermedades genéticas. La pregunta natural: ¿cuánto invierte el gobierno federal en investigar esa salud? Fuimos a los números.</p>

<div class="not-prose mt-5 bg-slate-900 text-white rounded-2xl p-5">
  <p class="text-xs uppercase tracking-widest text-teal-300 font-bold">El titular</p>
  <p class="text-xl sm:text-2xl font-black mt-1 leading-snug">Puerto Rico e Iowa tienen la misma población. En 2024, el NIH invirtió $249 millones en Iowa y $90 millones en Puerto Rico.</p>
  <p class="text-slate-300 mt-2 text-sm">La misma cantidad de gente. Un tercio del dinero. Una diferencia de $159 millones en un solo año.</p>
</div>

<h2>Lo que recibió cada estado de población parecida (NIH, 2024)</h2>
<p class="text-slate-600 -mt-2">Por persona, con la fuente al lado. La última columna es cuántas veces más por persona que Puerto Rico.</p>
<div class="not-prose mt-3 overflow-x-auto border border-slate-200 rounded-xl">
  <table class="w-full text-sm min-w-[520px]">
    <thead><tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th class="py-2 px-3">Lugar</th><th class="py-2 px-3 text-right">Población</th><th class="py-2 px-3 text-right">NIH 2024</th><th class="py-2 px-3 text-right">Por persona</th><th class="py-2 px-3 text-right">vs PR</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</div>
<p class="text-sm text-slate-500 mt-2">Puerto Rico recibió <strong>$28 por persona</strong>: menos que Mississippi, el estado más pobre de la nación. Fuente: NIH RePORTER (año fiscal 2024, sumado proyecto por proyecto). Poblaciones: estimados del Censo.</p>

<div class="not-prose bg-amber-50 border border-amber-200 rounded-2xl p-5 sm:p-6 my-6">
  <p class="font-black text-amber-900 text-lg">Por qué esto duele doble</p>
  <p class="text-sm text-amber-800 mt-1">El efecto fundador hace que en Puerto Rico ciertas enfermedades genéticas sean mucho más comunes y más "limpias" de estudiar que en cualquier otro lado. Es, literalmente, un laboratorio natural que el mundo necesita. Recibir el financiamiento más bajo por persona no es solo injusto para los boricuas: es una oportunidad científica que Estados Unidos está dejando sobre la mesa.</p>
</div>

<div class="not-prose bg-teal-50 border border-teal-200 rounded-2xl p-5 sm:p-6 my-6">
  <p class="font-black text-teal-900 text-lg">El eje completo</p>
  <p class="text-sm text-teal-800 mt-1">Tres récords, una misma historia: la enfermedad, la promesa y el dinero.</p>
  <div class="flex flex-wrap gap-3 mt-3">
    <a href="https://registromedicopr.com/atlas" class="inline-flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white font-bold px-4 py-2 rounded-full text-sm"><i class="fa-solid fa-dna"></i> El Atlas de las fundadoras</a>
    <a href="/registro-raras" class="inline-flex items-center gap-2 bg-white border border-teal-300 text-teal-800 font-bold px-4 py-2 rounded-full text-sm"><i class="fa-solid fa-clipboard-check"></i> El registro que prometió el gobierno</a>
    <a href="https://registromedicopr.com/raras" class="inline-flex items-center gap-2 bg-white border border-teal-300 text-teal-800 font-bold px-4 py-2 rounded-full text-sm"><i class="fa-solid fa-user-doctor"></i> Quién diagnostica</a>
  </div>
</div>

<h2>Datos citables</h2>
<p class="text-slate-600 -mt-2">Cada dato con su fuente. Cópialo y úsalo: prensa, un legislador, un investigador que busque a dónde llevar su próximo estudio.</p>
${citasHtml}

${shareRow({ text: 'Puerto Rico e Iowa tienen la misma población. En 2024 el NIH invirtió $249M en Iowa y $90M en PR. PR recibe menos por persona que el estado más pobre de EE.UU., y tiene el ADN founder-effect más valioso de la nación. Los números, con la fuente al lado:', url: 'https://puertoricosinfiltros.com/investigacion', toWho: 'A un periodista, a un legislador, a un investigador. Es dinero federal de ciencia que no está llegando.' })}

<div class="not-prose bg-teal-50 border border-teal-200 rounded-2xl p-6 mt-8 text-center">
  <p class="text-lg font-black text-slate-900" style="font-family:'Fraunces',Georgia,serif">El valor está aquí. Que la inversión lo alcance.</p>
  <p class="mt-2 text-sm text-slate-600 italic">Todo con fuente. Neutral, no partidista. Se actualiza con el récord.</p>
</div>

<p class="text-sm text-slate-500 mt-6">Fuente: NIH RePORTER (reporter.nih.gov), año fiscal 2024, sumado proyecto por proyecto por estado el 10 de julio de 2026. Poblaciones: estimados del Censo de EE.UU. Este récord es neutral y no partidista. Julio 2026.</p>
${SHARE_COPY_SCRIPT}`

  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: 'El ADN más valioso de EE.UU. y el dinero de ciencia que no llega a Puerto Rico', url: 'https://puertoricosinfiltros.com/investigacion', inLanguage: 'es',
      publisher: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' } },
    { '@context': 'https://schema.org', '@type': 'Dataset', name: 'Financiamiento NIH por estado de población similar, año fiscal 2024',
      description: 'Financiamiento de los Institutos Nacionales de Salud (NIH) para Puerto Rico frente a estados de EE.UU. de población similar, en total y por persona, año fiscal 2024.',
      url: 'https://puertoricosinfiltros.com/investigacion', inLanguage: 'es', license: 'https://creativecommons.org/licenses/by/4.0/',
      creator: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' },
      isBasedOn: 'https://reporter.nih.gov' },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
      { '@type': 'Question', name: '¿Cuánto financiamiento de investigación de salud recibe Puerto Rico?', acceptedAnswer: { '@type': 'Answer', text: 'En el año fiscal 2024, los Institutos Nacionales de Salud (NIH) invirtieron cerca de $89.7 millones en 143 proyectos en Puerto Rico, unos $28 por persona: el más bajo entre jurisdicciones de población similar, por debajo de Mississippi, el estado más pobre de EE.UU. Iowa, con la misma población que PR, recibió $249 millones. Fuente: NIH RePORTER.' } },
    ] },
  ]

  const og = `https://puertoricosinfiltros.com/api/og?theme=sinfiltros&k=${encodeURIComponent('Sigue el dinero · Ciencia')}&t=${encodeURIComponent('El ADN más valioso de EE.UU.||y el dinero que no llega')}&sub=${encodeURIComponent('PR e Iowa: misma población. NIH 2024: $249M a Iowa, $90M a PR. PR recibe menos por persona que Mississippi.')}&badge=${encodeURIComponent('NIH RePORTER · FY2024')}`

  res.status(200).send(layout({
    title: 'El ADN más valioso de EE.UU. y el dinero de ciencia que no llega a Puerto Rico',
    description: 'Puerto Rico e Iowa tienen la misma población. En 2024 el NIH invirtió $249M en Iowa y $90M en PR. PR recibe menos por persona ($28) que Mississippi, el estado más pobre, pese a tener el ADN founder-effect más valioso de la nación. Datos NIH RePORTER, con la fuente al lado.',
    slug: 'investigacion', bodyHtml: body, jsonLd, ogImage: og,
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
    canonicalUrl: 'https://puertoricosinfiltros.com/investigacion',
  }))
}

export default async function handler(req: any, res: any) {
  const page = String(req.query.page || '')

  switch (page) {
    case 'agua': return handleAgua(req, res)
    case 'tienda': return handleTienda(req, res)
    case 'tienda-log': return await handleTiendaLog(req, res)
    case 'quien-responde': return await handleQuienResponde(req, res)
    case 'acceso': return handleAcceso(req, res)
    case 'acceso-log': return await handleAccesoLog(req, res)
    case 'registro': return await handleRegistro(req, res)
    case 'necesito': return await handleNecesito(req, res)
    case 'pueblo': return await handlePueblo(req, res)
    case 'registro-alert': return await handleRegistroAlert(req, res)
    case 'registro-data': return await handleRegistroData(req, res)
    case 'registro-search': return await handleRegistroSearch(req, res)
    case 'especialista': return await handleEspecialista(req, res)
    case 'especialista-claim': return await handleEspecialistaClaim(req, res)
    case 'conserje-intent': return await handleConserjeIntent(req, res)
    case 'registro-lead': return await handleRegistroLead(req, res)
    case 'registro-desiertos': return await handleRegistroDesiertos(req, res)
    case 'registro-mapa': return await handleRegistroMapa(req, res)
    case 'registro-estado': return await handleRegistroEstado(req, res)
    case 'raras': return await handleRaras(req, res)
    case 'atlas': return await handleAtlas(req, res)
    case 'oer': return await handleOER(req, res)
    case 'investigacion': return await handleInvestigacion(req, res)
    case 'comparte': return await handleComparte(req, res)
    case 'porque': return await handleRegistroPorque(req, res)
    case 'recuperacion': return await handleRecuperacion(req, res)
    case 'sinfiltros': return await handleSinFiltros(req, res)
    case 'sinfiltros-log': return await handleSinFiltrosLog(req, res)
    case 'sinfiltros-pulso': return await handleSinFiltrosPulso(req, res)
    case 'luz': return await handleDatoRecord(req, res)
    case 'basura': return await handleDatoRecord(req, res)
    case 'acueductos': return await handleAcueductos(req, res)
    case 'transicion': return await handleTransicion(req, res)
    case 'prediccion': return handlePrediccion(req, res)
    case 'costo-de-vida': return await handleCostoDeVida(req, res)
    case 'trabajo': return handleTrabajo(req, res)
    case 'decidir': return handleDecidir(req, res)
    case 'exposicion-ai': return handleExposicionAi(req, res)
    case 'rendimiento': return handleRendimiento(req, res)
    case 'cupon': return handleCupon(req, res)
    case 'demanda-real': return await handleDemandaReal(req, res)
    case 'historial': return await handleHistorial(req, res)
    case 'telemedicina': return await handleTelemedicina(req, res)
    case 'no-se-mide': return handleNoSeMide(req, res)
    case 'diabetes': return await handleDiabetes(req, res)
    case 'expediente': return await handleExpediente(req, res)
    case 'sigue-el-dinero': return await handleSigueElDinero(req, res)
    case 'esencia': return await handleEsencia(req, res)
    case 'activos': return handleActivos(req, res, { layout, escapeHtml })
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
