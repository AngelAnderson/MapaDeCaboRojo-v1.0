/**
 * api/_lib/barrios.ts — Mapa de Barrios de Cabo Rojo
 *
 * Routes (via vercel.json rewrites → api/mapa-pages.ts dispatcher):
 *   /barrios        → ?page=barrios  (índice: los 9 barrios con mapa interactivo a color)
 *   /barrio/:slug   → ?page=barrio&b=:slug  (página por barrio: negocios verificados + mini-mapa)
 *
 * Data: places.barrio (asignado por point-in-polygon contra Census TIGER county subdivisions)
 *       public/barrios-caborojo.geojson (polígonos simplificados, 14 KB)
 */

type Deps = { layout: (opts: any) => string; escapeHtml: (s: string) => string; supabase: any }

export const BARRIOS: Array<{ slug: string; name: string; short: string; tagline: string; emoji: string; color: string; kw: string }> = [
  { slug: 'pueblo', name: 'El Pueblo (Centro)', short: 'El Pueblo', tagline: 'El casco urbano: la plaza, el comercio de siempre y la vida de calle.', emoji: '🏛️', color: '#8b5cf6', kw: 'PUEBLO' },
  { slug: 'boqueron', name: 'Boquerón', short: 'Boquerón', tagline: 'El poblado, la playa y El Combate. Donde el fin de semana vive.', emoji: '🏖️', color: '#e85a3a', kw: 'BOQUERON' },
  { slug: 'miradero', name: 'Miradero', short: 'Miradero', tagline: 'Puerto Real y la pesca. El barrio que mira al mar por oficio.', emoji: '🎣', color: '#f28c3b', kw: 'MIRADERO' },
  { slug: 'guanajibo', name: 'Guanajibo', short: 'Guanajibo', tagline: 'Joyuda y la milla de oro del marisco.', emoji: '🦀', color: '#2a9db5', kw: 'JOYUDA' },
  { slug: 'pedernales', name: 'Pedernales', short: 'Pedernales', tagline: 'El campo entre el pueblo y la costa.', emoji: '🌄', color: '#7fa86f', kw: 'PEDERNALES' },
  { slug: 'bajura', name: 'Bajura', short: 'Bajura', tagline: 'La entrada norte, camino a Mayagüez.', emoji: '🛣️', color: '#f5b82e', kw: 'BAJURA' },
  { slug: 'monte-grande', name: 'Monte Grande', short: 'Monte Grande', tagline: 'Comunidad de monte con vida propia.', emoji: '⛰️', color: '#1d5c7a', kw: 'MONTEGRANDE' },
  { slug: 'llanos-tuna', name: 'Llanos Tuna', short: 'Llanos Tuna', tagline: 'Los llanos del este, tierra adentro.', emoji: '🌾', color: '#d9a05b', kw: 'LLANOSTUNA' },
  { slug: 'llanos-costa', name: 'Llanos Costa', short: 'Llanos Costa', tagline: 'El Faro, Los Morrillos y las salinas. El sur abierto.', emoji: '🗼', color: '#1f4e79', kw: 'ELFARO' },
]

const CAT_EMOJI: Record<string, string> = {
  FOOD: '🍽️', SHOP: '🛍️', SERVICE: '🔧', HEALTH: '🩺', BEACH: '🏖️', SIGHTS: '📍', LODGING: '🛏️', NIGHTLIFE: '🍹',
}
const CAT_LABEL: Record<string, string> = {
  FOOD: 'Pa\' comer', SHOP: 'Tiendas', SERVICE: 'Servicios', HEALTH: 'Salud', BEACH: 'Playas', SIGHTS: 'Lugares', LODGING: 'Hospedaje', NIGHTLIFE: 'Vida nocturna',
}

const LEAFLET_TAGS = `
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H" crossorigin="anonymous">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH" crossorigin="anonymous"></script>
<style>
.brr-label{background:transparent;border:none;box-shadow:none;font-weight:900;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#0f172a;text-shadow:0 1px 3px rgba(255,255,255,.95),0 -1px 3px rgba(255,255,255,.95),1px 0 3px rgba(255,255,255,.95),-1px 0 3px rgba(255,255,255,.95);pointer-events:none}
.brr-pop .leaflet-tooltip{border-radius:12px}
.brr-tip{border-radius:14px!important;border:none!important;box-shadow:0 8px 24px rgba(2,6,23,.18)!important;padding:0!important;overflow:hidden}
.brr-tip .tip-head{padding:8px 12px;color:#fff;font-weight:900;font-size:14px}
.brr-tip .tip-body{padding:8px 12px;font-size:12px;color:#334155;background:#fff}
.brr-marker{display:flex;align-items:center;justify-content:center;font-size:14px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}
.leaflet-container{font-family:inherit}
</style>`

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
  // Per-barrio stats: total + top categories (feeds the rich hover tooltip)
  const stats: Record<string, { total: number; cats: Record<string, number> }> = {}
  for (const r of (countRows || [])) {
    const s = (stats[r.barrio] = stats[r.barrio] || { total: 0, cats: {} })
    s.total++; s.cats[r.category] = (s.cats[r.category] || 0) + 1
  }
  const topCats = (b: string, n = 3) => Object.entries(stats[b]?.cats || {}).sort((x, y) => y[1] - x[1]).slice(0, n)

  // ---------- Índice /barrios ----------
  if (!slug) {
    const clientMeta = BARRIOS.map(b => ({
      slug: b.slug, name: b.name, emoji: b.emoji, color: b.color, tagline: b.tagline, kw: b.kw,
      total: stats[b.slug]?.total || 0,
      tops: topCats(b.slug).map(([c, n]) => `${CAT_EMOJI[c] || '📍'} ${n} ${(CAT_LABEL[c] || c).toLowerCase()}`),
    }))
    const cards = BARRIOS.map(b => {
      const tops = topCats(b.slug).map(([c, n]) => `<span class="inline-block text-xs bg-slate-100 rounded-full px-2 py-0.5 mr-1">${CAT_EMOJI[c] || '📍'} ${n}</span>`).join('')
      return `
<a href="/barrio/${b.slug}" class="barrio-card block bg-white border-2 rounded-2xl p-4 hover:shadow-lg transition" style="border-color:${b.color}22" data-slug="${b.slug}"
   onmouseenter="this.style.borderColor='${b.color}'" onmouseleave="this.style.borderColor='${b.color}22'">
  <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full inline-block" style="background:${b.color}"></span><span class="text-2xl">${b.emoji}</span></div>
  <div class="font-black text-slate-900 mt-1">${escapeHtml(b.name)}</div>
  <div class="text-sm text-slate-500 mt-1">${escapeHtml(b.tagline)}</div>
  <div class="mt-2">${tops}</div>
  <div class="text-xs font-bold mt-2" style="color:${b.color}">${stats[b.slug]?.total || 0} lugares verificados →</div>
</a>`
    }).join('')
    const body = `
<h1>Los barrios de Cabo Rojo</h1>
<p class="text-lg text-slate-600 mt-2">Cabo Rojo no es un solo sitio: son 9 barrios, cada uno con su color y su vuelta. Pasa el mouse pa' ver qué hay; toca el tuyo pa' entrar.</p>
<div class="not-prose mt-5 rounded-2xl overflow-hidden border border-slate-200 shadow-lg relative" style="height:520px">
  <div id="bmap" style="height:100%"></div>
  <div class="absolute bottom-3 left-3 z-[500] bg-white/95 rounded-xl px-3 py-2 shadow text-xs text-slate-600 hidden sm:block">💡 Pasa el mouse por un barrio · toca pa' entrar</div>
</div>
<div class="not-prose mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${cards}</div>
<div class="not-prose mt-8 bg-teal-700 text-white rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
  <div>
    <div class="text-xl font-black">¿No sabes en qué barrio queda lo que buscas?</div>
    <p class="text-teal-100 text-sm mt-1">Escríbele al Veci con lo que necesitas y te contesta con lo verificado, 24/7.</p>
  </div>
  <a href="https://wa.me/17874177711?text=${encodeURIComponent('Busco algo en Cabo Rojo')}" class="shrink-0 bg-white text-teal-800 font-bold px-5 py-2.5 rounded-full text-center">Textea al 787-417-7711</a>
</div>
<p class="not-prose text-xs text-slate-500 mt-4">Límites de barrio: Census Bureau (TIGER/Line). Lugares: verificados a mano por MapaDeCaboRojo.com.</p>
${LEAFLET_TAGS}
<script>
(function(){
  var META=${JSON.stringify(Object.fromEntries(clientMeta.map(m => [m.slug, m])))};
  var map=L.map('bmap',{scrollWheelZoom:false}).setView([18.05,-67.13],11);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',{attribution:'&copy; OpenStreetMap &copy; CARTO'}).addTo(map);
  fetch('/barrios-caborojo.geojson').then(function(r){return r.json()}).then(function(gj){
    var layer=L.geoJSON(gj,{
      style:function(f){var m=META[f.properties.slug]||{};return{color:'#fff',weight:2.5,fillColor:m.color||'#14b8a6',fillOpacity:0.55}},
      onEachFeature:function(f,l){
        var m=META[f.properties.slug]||{};
        var tip='<div class="tip-head" style="background:'+(m.color||'#0f766e')+'">'+(m.emoji||'')+' '+m.name+' · '+(m.total||0)+' lugares</div>'
          +'<div class="tip-body">'+(m.tops||[]).join(' · ')+'<br><span style="color:#94a3b8">'+(m.tagline||'')+'</span><br><b style="color:'+(m.color||'#0f766e')+'">Toca pa\\' entrar →</b></div>';
        l.bindTooltip(tip,{sticky:true,className:'brr-tip',opacity:1});
        l.on('mouseover',function(){l.setStyle({fillOpacity:0.8,weight:3.5});l.bringToFront()});
        l.on('mouseout',function(){l.setStyle({fillOpacity:0.55,weight:2.5})});
        l.on('click',function(){window.location='/barrio/'+f.properties.slug});
        // Label permanente en el centro del barrio
        try{
          var c=l.getBounds().getCenter();
          L.tooltip({permanent:true,direction:'center',className:'brr-label',interactive:false}).setContent(m.name?m.name.replace(' (Centro)',''):f.properties.name).setLatLng(c).addTo(map);
        }catch(e){}
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

  const markers = rows.filter(p => p.lat && p.lon).map(p => `[${p.lat},${p.lon},${JSON.stringify(String(p.name))},${JSON.stringify('/negocio/' + (p.slug || ''))},${JSON.stringify(CAT_EMOJI[p.category] || '📍')}]`).join(',')
  const chips = topCats(slug, 5).map(([c, n]) => `<span class="inline-flex items-center gap-1 bg-white/20 rounded-full px-3 py-1 text-sm font-semibold">${CAT_EMOJI[c] || '📍'} ${n} ${(CAT_LABEL[c] || c).toLowerCase()}</span>`).join(' ')

  const body = `
<p class="not-prose text-sm"><a href="/barrios" class="text-teal-700 font-semibold">← Los 9 barrios</a></p>
<div class="not-prose mt-3 rounded-2xl p-6 text-white" style="background:linear-gradient(135deg,${barrio.color},${barrio.color}cc)">
  <h1 class="text-3xl font-black">${barrio.emoji} ${escapeHtml(barrio.name)}</h1>
  <p class="mt-1 text-white/90">${escapeHtml(barrio.tagline)}</p>
  <div class="mt-3 flex flex-wrap gap-2">${chips}</div>
  <div class="mt-2 text-sm font-bold">${rows.length} lugares verificados a mano</div>
</div>
<div class="not-prose mt-5 rounded-2xl overflow-hidden border border-slate-200 shadow-lg" style="height:380px"><div id="bmap" style="height:100%"></div></div>
${sections}
<div class="not-prose mt-10 text-white rounded-2xl p-6" style="background:${barrio.color}">
  <div class="text-xl font-black">¿Buscas algo en ${escapeHtml(barrio.short)} y no aparece?</div>
  <p class="mt-1 text-white/85 text-sm">Antes de dar vueltas, escríbele al Veci. Contesta 24/7 con lo verificado.</p>
  <a href="https://wa.me/17874177711?text=${encodeURIComponent(barrio.kw)}" class="inline-block mt-3 bg-white font-bold px-5 py-2.5 rounded-full" style="color:${barrio.color}">Escríbele ${escapeHtml(barrio.kw)} al 787-417-7711</a>
</div>
${LEAFLET_TAGS}
<script>
(function(){
  var COLOR=${JSON.stringify(barrio.color)};
  var map=L.map('bmap',{scrollWheelZoom:false}).setView([18.05,-67.13],12);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{attribution:'&copy; OpenStreetMap &copy; CARTO'}).addTo(map);
  var pts=[${markers}];
  fetch('/barrios-caborojo.geojson').then(function(r){return r.json()}).then(function(gj){
    // Los demás barrios en gris suave, el activo a color
    var others=gj.features.filter(function(f){return f.properties.slug!=='${slug}'});
    L.geoJSON({type:'FeatureCollection',features:others},{style:{color:'#cbd5e1',weight:1,fillColor:'#94a3b8',fillOpacity:0.08},interactive:false}).addTo(map);
    var feat=gj.features.filter(function(f){return f.properties.slug==='${slug}'});
    var layer=L.geoJSON({type:'FeatureCollection',features:feat},{style:{color:COLOR,weight:3,fillColor:COLOR,fillOpacity:0.15}}).addTo(map);
    map.fitBounds(layer.getBounds(),{padding:[16,16]});
    pts.forEach(function(p){
      L.marker([p[0],p[1]],{icon:L.divIcon({className:'brr-marker',html:p[4],iconSize:[20,20]})})
        .addTo(map).bindTooltip(p[2]).on('click',function(){window.location=p[3]});
    });
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
