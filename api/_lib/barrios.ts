/**
 * api/_lib/barrios.ts — Mapa de Barrios de Cabo Rojo
 *
 * Routes (via vercel.json rewrites → api/mapa-pages.ts dispatcher):
 *   /barrios        → ?page=barrios  (índice: los 9 barrios con mapa interactivo)
 *   /barrio/:slug   → ?page=barrio&b=:slug  (página por barrio: negocios verificados + mini-mapa)
 *
 * Data: places.barrio (asignado por point-in-polygon contra Census TIGER county subdivisions)
 *       public/barrios-caborojo.geojson (polígonos simplificados, 14 KB)
 */

type Deps = { layout: (opts: any) => string; escapeHtml: (s: string) => string; supabase: any }

export const BARRIOS: Array<{ slug: string; name: string; tagline: string; emoji: string }> = [
  { slug: 'pueblo', name: 'El Pueblo (Centro)', tagline: 'El casco urbano: la plaza, el comercio de siempre y la vida de calle.', emoji: '🏛️' },
  { slug: 'boqueron', name: 'Boquerón', tagline: 'El poblado, la playa y El Combate. Donde el fin de semana vive.', emoji: '🏖️' },
  { slug: 'miradero', name: 'Miradero', tagline: 'Puerto Real y la pesca. El barrio que mira al mar por oficio.', emoji: '🎣' },
  { slug: 'guanajibo', name: 'Guanajibo', tagline: 'Joyuda y la milla de oro del marisco.', emoji: '🦀' },
  { slug: 'pedernales', name: 'Pedernales', tagline: 'El campo entre el pueblo y la costa.', emoji: '🌄' },
  { slug: 'bajura', name: 'Bajura', tagline: 'La entrada norte, camino a Mayagüez.', emoji: '🛣️' },
  { slug: 'monte-grande', name: 'Monte Grande', tagline: 'Comunidad de monte con vida propia.', emoji: '⛰️' },
  { slug: 'llanos-tuna', name: 'Llanos Tuna', tagline: 'Los llanos del este, tierra adentro.', emoji: '🌾' },
  { slug: 'llanos-costa', name: 'Llanos Costa', tagline: 'El Faro, Los Morrillos y las salinas. El sur abierto.', emoji: '🗼' },
]

const CAT_EMOJI: Record<string, string> = {
  FOOD: '🍽️', SHOP: '🛍️', SERVICE: '🔧', HEALTH: '🩺', BEACH: '🏖️', SIGHTS: '📍', LODGING: '🛏️', NIGHTLIFE: '🍹',
}
const CAT_LABEL: Record<string, string> = {
  FOOD: 'Pa\' comer', SHOP: 'Tiendas', SERVICE: 'Servicios', HEALTH: 'Salud', BEACH: 'Playas', SIGHTS: 'Lugares', LODGING: 'Hospedaje', NIGHTLIFE: 'Vida nocturna',
}

export async function handleBarrios(req: any, res: any, deps: Deps) {
  const { layout, escapeHtml, supabase } = deps
  const slug = String(req.query.b || '').toLowerCase().trim()
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600')

  const { data: countRows } = await supabase
    .from('places')
    .select('barrio,category')
    .not('barrio', 'is', null)
    .eq('status', 'open')
    .eq('visibility', 'published')
    .limit(3000)
  const counts: Record<string, number> = {}
  for (const r of (countRows || [])) counts[r.barrio] = (counts[r.barrio] || 0) + 1

  // ---------- Índice /barrios ----------
  if (!slug) {
    const cards = BARRIOS.map(b => `
<a href="/barrio/${b.slug}" class="barrio-card block bg-white border border-slate-200 rounded-2xl p-4 hover:border-teal-400 hover:shadow-md transition" data-slug="${b.slug}">
  <div class="text-2xl">${b.emoji}</div>
  <div class="font-black text-slate-900 mt-1">${escapeHtml(b.name)}</div>
  <div class="text-sm text-slate-500 mt-1">${escapeHtml(b.tagline)}</div>
  <div class="text-xs font-bold text-teal-700 mt-2">${counts[b.slug] || 0} lugares verificados →</div>
</a>`).join('')
    const body = `
<h1>Los barrios de Cabo Rojo</h1>
<p class="text-lg text-slate-600 mt-2">Cabo Rojo no es un solo sitio: son 9 barrios, cada uno con su vuelta. Toca el tuyo en el mapa y mira qué hay, verificado uno por uno.</p>
<div class="not-prose mt-5 rounded-2xl overflow-hidden border border-slate-200" style="height:420px"><div id="bmap" style="height:100%"></div></div>
<div class="not-prose mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${cards}</div>
<p class="not-prose text-xs text-slate-500 mt-4">Límites de barrio: Census Bureau (TIGER/Line). Lugares: verificados a mano por MapaDeCaboRojo.com. ¿Falta algo en tu barrio? Escríbele al Veci: <a href="https://wa.me/17874177711" class="text-teal-700 font-semibold">787-417-7711</a>.</p>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H" crossorigin="anonymous">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH" crossorigin="anonymous"></script>
<script>
(function(){
  var map=L.map('bmap',{scrollWheelZoom:false}).setView([18.05,-67.13],11);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{attribution:'&copy; OpenStreetMap &copy; CARTO'}).addTo(map);
  fetch('/barrios-caborojo.geojson').then(function(r){return r.json()}).then(function(gj){
    var layer=L.geoJSON(gj,{style:function(){return{color:'#0f766e',weight:2,fillColor:'#14b8a6',fillOpacity:0.15}},
      onEachFeature:function(f,l){
        l.bindTooltip(f.properties.name,{sticky:true});
        l.on('mouseover',function(){l.setStyle({fillOpacity:0.35})});
        l.on('mouseout',function(){l.setStyle({fillOpacity:0.15})});
        l.on('click',function(){window.location='/barrio/'+f.properties.slug});
      }}).addTo(map);
    map.fitBounds(layer.getBounds(),{padding:[10,10]});
  });
})();
</script>`
    const jsonLd = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Los barrios de Cabo Rojo', url: 'https://mapadecaborojo.com/barrios', description: 'Los 9 barrios de Cabo Rojo con sus negocios y lugares verificados: Boquerón, Miradero, Guanajibo, Pedernales, Bajura, Monte Grande, Llanos Tuna, Llanos Costa y el Pueblo.' }
    res.status(200).send(layout({
      title: 'Los 9 barrios de Cabo Rojo — mapa interactivo con lugares verificados',
      description: 'Toca tu barrio y mira qué hay: negocios, playas y servicios verificados a mano. Boquerón, Joyuda, Puerto Real, El Combate y más.',
      slug: 'barrios', bodyHtml: body, jsonLd, host: req.headers?.host,
    }))
    return
  }

  // ---------- Página de un barrio /barrio/:slug ----------
  const barrio = BARRIOS.find(b => b.slug === slug)
  if (!barrio) { res.statusCode = 302; res.setHeader('Location', '/barrios'); res.end(); return }

  const { data: places } = await supabase
    .from('places')
    .select('name,slug,category,subcategory,phone,google_rating,google_review_count,lat,lon,one_liner,plan,is_featured')
    .eq('barrio', slug)
    .eq('status', 'open')
    .eq('visibility', 'published')
    .order('google_rating', { ascending: false, nullsFirst: false })
    .limit(400)
  const rows = (places || []) as any[]

  const byCat: Record<string, any[]> = {}
  for (const p of rows) (byCat[p.category] = byCat[p.category] || []).push(p)
  const catOrder = Object.keys(byCat).sort((a, b) => byCat[b].length - byCat[a].length)

  const sections = catOrder.map(cat => {
    const items = byCat[cat].slice(0, 30).map(p => `
<a href="/negocio/${escapeHtml(p.slug || '')}" class="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-teal-400">
  <div><div class="font-semibold text-slate-800">${escapeHtml(p.name)}</div>${p.one_liner ? `<div class="text-xs text-slate-500">${escapeHtml(p.one_liner)}</div>` : ''}</div>
  ${p.google_rating ? `<div class="text-sm font-bold text-amber-600 whitespace-nowrap">★ ${Number(p.google_rating).toFixed(1)}</div>` : ''}
</a>`).join('')
    return `<h2 class="mt-8">${CAT_EMOJI[cat] || '📍'} ${CAT_LABEL[cat] || escapeHtml(cat)} <span class="text-slate-400 text-base font-normal">(${byCat[cat].length})</span></h2><div class="not-prose mt-3 grid sm:grid-cols-2 gap-2">${items}</div>`
  }).join('')

  const markers = rows.filter(p => p.lat && p.lon).map(p => `[${p.lat},${p.lon},${JSON.stringify(String(p.name))},${JSON.stringify('/negocio/' + (p.slug || ''))}]`).join(',')

  const body = `
<p class="not-prose text-sm"><a href="/barrios" class="text-teal-700 font-semibold">← Los 9 barrios</a></p>
<h1>${barrio.emoji} ${escapeHtml(barrio.name)}, Cabo Rojo</h1>
<p class="text-lg text-slate-600 mt-2">${escapeHtml(barrio.tagline)} Aquí hay <strong>${rows.length} lugares verificados</strong> a mano.</p>
<div class="not-prose mt-5 rounded-2xl overflow-hidden border border-slate-200" style="height:340px"><div id="bmap" style="height:100%"></div></div>
${sections}
<div class="not-prose mt-10 bg-teal-700 text-white rounded-2xl p-6">
  <div class="text-xl font-black">¿Buscas algo en ${escapeHtml(barrio.name)} y no aparece?</div>
  <p class="mt-1 text-teal-100 text-sm">Antes de dar vueltas, escríbele al Veci. Contesta 24/7 con lo verificado.</p>
  <a href="https://wa.me/17874177711?text=${encodeURIComponent('Busco algo en ' + barrio.name)}" class="inline-block mt-3 bg-white text-teal-800 font-bold px-5 py-2.5 rounded-full">Textea al 787-417-7711</a>
</div>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H" crossorigin="anonymous">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH" crossorigin="anonymous"></script>
<script>
(function(){
  var map=L.map('bmap',{scrollWheelZoom:false}).setView([18.05,-67.13],12);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{attribution:'&copy; OpenStreetMap &copy; CARTO'}).addTo(map);
  var pts=[${markers}];
  fetch('/barrios-caborojo.geojson').then(function(r){return r.json()}).then(function(gj){
    var feat=gj.features.filter(function(f){return f.properties.slug==='${slug}'});
    var layer=L.geoJSON({type:'FeatureCollection',features:feat},{style:{color:'#0f766e',weight:2.5,fillColor:'#14b8a6',fillOpacity:0.12}}).addTo(map);
    map.fitBounds(layer.getBounds(),{padding:[14,14]});
    pts.forEach(function(p){L.circleMarker([p[0],p[1]],{radius:5,color:'#0f766e',fillColor:'#14b8a6',fillOpacity:0.9,weight:1.5})
      .addTo(map).bindTooltip(p[2]).on('click',function(){window.location=p[3]});});
  });
})();
</script>`

  const jsonLd = { '@context': 'https://schema.org', '@type': 'Place', name: `${barrio.name}, Cabo Rojo, Puerto Rico`, url: `https://mapadecaborojo.com/barrio/${slug}`, description: `${barrio.tagline} ${rows.length} negocios y lugares verificados.`, containedInPlace: { '@type': 'City', name: 'Cabo Rojo', address: { '@type': 'PostalAddress', addressRegion: 'PR', addressCountry: 'US' } } }
  res.status(200).send(layout({
    title: `${barrio.name}, Cabo Rojo — ${rows.length} lugares verificados en el barrio`,
    description: `${barrio.tagline} Negocios, playas y servicios de ${barrio.name} verificados a mano, con mapa. Si falta algo, textea al 787-417-7711.`,
    slug: `barrio/${slug}`, bodyHtml: body, jsonLd, host: req.headers?.host,
  }))
}
