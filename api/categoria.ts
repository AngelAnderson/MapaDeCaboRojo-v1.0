import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function logApiCall(endpoint: string, method: string | null, query: string | null, userAgent: string | null, ip: string | null, responseCount: number | null) {
  try {
    await supabase.from('api_logs').insert({
      endpoint,
      method,
      query,
      user_agent: (userAgent || '').substring(0, 500),
      ip: (ip || '').substring(0, 45),
      response_count: responseCount
    });
  } catch {} // fire-and-forget, never block the response
}

function esc(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Normalize messy phone formats in `places.phone` ("+1 787-899-1686", "(787) 892-0944",
// "+19393470111") to a single 10-digit string + display form. Returns null if unusable.
function normalizePhone(raw: string | null | undefined): { digits10: string; display: string } | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const last10 = digits.slice(-10);
  return { digits10: last10, display: `${last10.slice(0, 3)}-${last10.slice(3, 6)}-${last10.slice(6)}` };
}

// Maps URL slug / search term → canonical category values in DB + display name
const CATEGORY_MAP: Record<string, { match: string[]; display: string; emoji: string; nameMatch?: boolean }> = {
  restaurante:    { match: ['restaurante', 'restaurant', 'food', 'comida', 'FOOD', 'RESTAURANTE'], display: 'Restaurantes', emoji: '🍽️' },
  restaurantes:   { match: ['restaurante', 'restaurant', 'food', 'comida', 'FOOD', 'RESTAURANTE'], display: 'Restaurantes', emoji: '🍽️' },
  playa:          { match: ['playa', 'beach', 'BEACH', 'PLAYA'], display: 'Playas', emoji: '🏖️' },
  playas:         { match: ['playa', 'beach', 'BEACH', 'PLAYA'], display: 'Playas', emoji: '🏖️' },
  salud:          { match: ['salud', 'health', 'HEALTH', 'SALUD', 'farmacia', 'medico', 'médico', 'dentista', 'laboratorio'], display: 'Salud', emoji: '🏥' },
  farmacia:       { match: ['farmacia', 'pharmacy', 'FARMACIA', 'Farmacia'], display: 'Farmacias en Cabo Rojo', emoji: '💊', nameMatch: true },
  farmacias:      { match: ['farmacia', 'pharmacy', 'FARMACIA', 'Farmacia'], display: 'Farmacias en Cabo Rojo', emoji: '💊', nameMatch: true },
  dentista:       { match: ['dentista', 'dentist', 'dental', 'ortodoncista', 'orthodontist', 'Dentista'], display: 'Dentistas', emoji: '🦷', nameMatch: true },
  dentistas:      { match: ['dentista', 'dentist', 'dental', 'ortodoncista', 'orthodontist', 'Dentista'], display: 'Dentistas', emoji: '🦷', nameMatch: true },
  veterinario:    { match: ['veterinario', 'veterinary', 'vet', 'Veterinario'], display: 'Veterinarios', emoji: '🐾', nameMatch: true },
  veterinarios:   { match: ['veterinario', 'veterinary', 'vet', 'Veterinario'], display: 'Veterinarios', emoji: '🐾', nameMatch: true },
  medico:         { match: ['doctor', 'médico', 'medico', 'physician', 'Medico General', 'Medicina Interna', 'internista'], display: 'Médicos', emoji: '👨‍⚕️', nameMatch: true },
  medicos:        { match: ['doctor', 'médico', 'medico', 'physician', 'Medico General', 'Medicina Interna', 'internista'], display: 'Médicos', emoji: '👨‍⚕️', nameMatch: true },
  hospital:       { match: ['hospital', 'centro medico', 'centro médico', 'emergencia', 'CDT', 'clínica', 'clinica', 'Clínica'], display: 'Hospitales y Clínicas', emoji: '🏥', nameMatch: true },
  hospitales:     { match: ['hospital', 'centro medico', 'centro médico', 'emergencia', 'CDT', 'clínica', 'clinica', 'Clínica'], display: 'Hospitales y Clínicas', emoji: '🏥', nameMatch: true },
  laboratorio:    { match: ['laboratorio', 'laboratory', 'lab', 'Laboratorio Clínico', 'diagnostico', 'Centro de Diagnostico'], display: 'Laboratorios', emoji: '🔬', nameMatch: true },
  laboratorios:   { match: ['laboratorio', 'laboratory', 'lab', 'Laboratorio Clínico', 'diagnostico', 'Centro de Diagnostico'], display: 'Laboratorios', emoji: '🔬', nameMatch: true },
  optica:         { match: ['óptica', 'optica', 'optometry', 'oftalmología', 'oftalmologia', 'optometrista', 'Óptica'], display: 'Ópticas', emoji: '👓', nameMatch: true },
  opticas:        { match: ['óptica', 'optica', 'optometry', 'oftalmología', 'oftalmologia', 'optometrista', 'Óptica'], display: 'Ópticas', emoji: '👓', nameMatch: true },
  'salud-mental': { match: ['salud mental', 'Salud Mental', 'psicólogo', 'psicología', 'psychologist', 'psychiatrist', 'psiquiatra', 'terapeuta'], display: 'Salud Mental', emoji: '🧠', nameMatch: true },
  quiropractico:  { match: ['quiropractico', 'quiropráctico', 'chiropractor', 'chiropractic', 'quiropráctica'], display: 'Quiroprácticos', emoji: '🦴', nameMatch: true },
  gimnasio:       { match: ['fitness', 'gym', 'gimnasio', 'crossfit', 'training', 'ejercicio', 'boxeo', 'boxing', 'yoga', 'pilates', 'cardio', 'pesas', 'zumba', 'spinning', 'runner', 'running'], display: 'Gimnasios & Fitness', emoji: '💪', nameMatch: true },
  gimnasios:      { match: ['fitness', 'gym', 'gimnasio', 'crossfit', 'training', 'ejercicio', 'boxeo', 'boxing', 'yoga', 'pilates', 'cardio', 'pesas', 'zumba', 'spinning', 'runner', 'running'], display: 'Gimnasios & Fitness', emoji: '💪', nameMatch: true },
  hospedaje:      { match: ['hospedaje', 'lodging', 'hotel', 'LODGING', 'HOSPEDAJE', 'alojamiento'], display: 'Hospedaje', emoji: '🏨' },
  hotel:          { match: ['hospedaje', 'lodging', 'hotel', 'LODGING', 'HOSPEDAJE', 'alojamiento'], display: 'Hospedaje', emoji: '🏨' },
  servicio:       { match: ['servicio', 'service', 'SERVICE', 'SERVICIO', 'servicios'], display: 'Servicios', emoji: '🔧' },
  servicios:      { match: ['servicio', 'service', 'SERVICE', 'SERVICIO', 'servicios'], display: 'Servicios', emoji: '🔧' },
  compras:        { match: ['compras', 'shopping', 'SHOPPING', 'COMPRAS', 'tienda'], display: 'Compras', emoji: '🛍️' },
  tienda:         { match: ['compras', 'shopping', 'SHOPPING', 'COMPRAS', 'tienda'], display: 'Compras', emoji: '🛍️' },
  entretenimiento:{ match: ['entretenimiento', 'entertainment', 'ENTERTAINMENT', 'ENTRETENIMIENTO'], display: 'Entretenimiento', emoji: '🎉' },
  turismo:        { match: ['turismo', 'tourism', 'TOURISM', 'TURISMO', 'atraccion', 'atracción'], display: 'Turismo', emoji: '🗺️' },
  deporte:        { match: ['deporte', 'sport', 'SPORT', 'DEPORTE', 'deportes'], display: 'Deportes', emoji: '⚽' },
  deportes:       { match: ['deporte', 'sport', 'SPORT', 'DEPORTE', 'deportes'], display: 'Deportes', emoji: '⚽' },
  educacion:      { match: ['educacion', 'educación', 'education', 'EDUCATION', 'escuela', 'colegio'], display: 'Educación', emoji: '📚' },
  gobierno:       { match: ['gobierno', 'government', 'GOBIERNO', 'GOVERNMENT', 'municipal'], display: 'Gobierno', emoji: '🏛️' },
  belleza:        { match: ['belleza', 'beauty', 'BEAUTY', 'BELLEZA', 'salon', 'salón', 'spa'], display: 'Belleza & Spa', emoji: '💅' },
  spa:            { match: ['belleza', 'beauty', 'BEAUTY', 'BELLEZA', 'salon', 'salón', 'spa'], display: 'Belleza & Spa', emoji: '💅' },
  automotriz:     { match: ['automotriz', 'automotive', 'AUTOMOTIVE', 'AUTOMOTRIZ', 'taller', 'auto'], display: 'Automotriz', emoji: '🚗' },
  marina:         { match: ['marina', 'MARINA', 'naútico', 'nautico', 'boat'], display: 'Marina & Náutico', emoji: '⛵' },
  ropa:           { match: ['ropa', 'clothing', 'moda', 'fashion', 'zapatos', 'thrift_shop'], display: 'Tiendas de Ropa', emoji: '👗' },
  'tiendas-de-ropa': { match: ['ropa', 'clothing', 'moda', 'fashion', 'zapatos', 'thrift_shop'], display: 'Tiendas de Ropa', emoji: '👗' },
};

export default async function handler(req: any, res: any) {
  const cat = (req.query.cat as string || '').toLowerCase().trim();

  if (!cat) {
    res.status(400).send('<h1>400 – Categoría requerida</h1>');
    return;
  }

  const mapping = CATEGORY_MAP[cat];
  const displayName = mapping ? mapping.display : cat.charAt(0).toUpperCase() + cat.slice(1);
  const emoji = mapping ? mapping.emoji : '📍';
  const matchTerms = mapping ? mapping.match : [cat];

  // Build an OR filter to push filtering to Postgres instead of fetching all 3900+ rows
  // Uses ilike for category (enum-like, e.g. SHOPPING), exact match via cs for tags array
  const useNameMatch = mapping?.nameMatch === true;
  const orParts = matchTerms.flatMap(term => [
    `category.ilike.%${term}%`,
    `subcategory.ilike.%${term}%`,
    `tags.cs.{${term}}`,
  ]);
  // For health subcategories, also match by business name (catches HEALTH/null businesses)
  if (useNameMatch) {
    matchTerms.forEach(term => {
      orParts.push(`name.ilike.%${term}%`);
    });
  }
  const orClauses = orParts.join(',');

  const { data: places, error } = await supabase
    .from('places')
    .select('id,name,slug,category,subcategory,image_url,phone,address,google_rating,google_review_count,status,plan,sponsor_weight,tags,services')
    .eq('status', 'open')
    .ilike('address', '%Cabo Rojo%')
    .or(orClauses)
    .order('sponsor_weight', { ascending: false })
    .limit(500);

  if (error) {
    res.status(500).send('<h1>Error cargando negocios</h1>');
    return;
  }

  // Demand signals — what vecinos searched for in this category (last 90 days, test phones excluded)
  // RPC: get_demand_for_keywords (Vecinoai migration 20260430000000_get_demand_for_keywords)
  // Fail-open: never block render if demand fetch errors
  type DemandRow = { query_normalized: string; users: number; queries: number; failed: number };
  let demandRows: DemandRow[] = [];
  try {
    const demandKeywords = matchTerms.map(t => `%${t.toLowerCase()}%`);
    const { data: demandData } = await supabase
      .rpc('get_demand_for_keywords', { p_keywords: demandKeywords, p_days: 90 });
    if (Array.isArray(demandData)) demandRows = demandData as DemandRow[];
  } catch { /* fail open */ }

  // Secondary JS filter to remove false positives from the broad Postgres query
  const filtered = (places || []).filter((p: any) => {
    const pCat = (p.category || '').toLowerCase();
    const pSub = (p.subcategory || '').toLowerCase();
    const pName = (p.name || '').toLowerCase();
    const pTags = Array.isArray(p.tags) ? p.tags.map((t: string) => t.toLowerCase()) : [];
    return matchTerms.some(term => {
      const t = term.toLowerCase();
      // Exact match on subcategory (e.g. "Ropa" = "ropa", not "Naturopatía" containing "ropa")
      if (pSub === t) return true;
      // Exact word match on category
      if (pCat.split(/[\s\/,]+/).includes(t)) return true;
      // Exact match on tags (tag must equal the term, not just contain it as substring)
      if (pTags.includes(t)) return true;
      // For health subcategories, also match by business name
      if (useNameMatch && pName.includes(t)) return true;
      return false;
    });
  });

  // Category-specific SEO content
  const CATEGORY_SEO: Record<string, { title?: string; description: string; intro: string }> = {
    gimnasio: {
      title: 'Gimnasios y Fitness en Cabo Rojo',
      description: `${filtered.length} gimnasios y centros fitness en Cabo Rojo, PR — boxing, CrossFit, yoga, pesas, running y más. Horarios, direcciones y contacto.`,
      intro: `Cabo Rojo tiene ${filtered.length} opciones para ponerte en forma — desde gimnasios tradicionales hasta estudios de boxeo, fitness por cita y clubes de running. Encuentra el que mejor te quede.`,
    },
    gimnasios: {
      title: 'Gimnasios y Fitness en Cabo Rojo',
      description: `${filtered.length} gimnasios y centros fitness en Cabo Rojo, PR — boxing, CrossFit, yoga, pesas, running y más. Horarios, direcciones y contacto.`,
      intro: `Cabo Rojo tiene ${filtered.length} opciones para ponerte en forma — desde gimnasios tradicionales hasta estudios de boxeo, fitness por cita y clubes de running. Encuentra el que mejor te quede.`,
    },
  };
  const catSeo = CATEGORY_SEO[cat];

  const baseUrl = 'https://mapadecaborojo.com';
  const pageUrl = `${baseUrl}/categoria/${esc(cat)}`;
  const alreadyHasCaboRojo = displayName.toLowerCase().includes('cabo rojo');
  const title = catSeo?.title ? `${catSeo.title} | MapaDeCaboRojo.com` : (alreadyHasCaboRojo ? `${displayName} | MapaDeCaboRojo.com` : `${displayName} en Cabo Rojo | MapaDeCaboRojo.com`);
  const description = catSeo?.description || `Descubre los mejores ${displayName.toLowerCase()} en Cabo Rojo, Puerto Rico. ${filtered.length} negocios listados con dirección, teléfono y horarios.`;

  // Route health categories to their dedicated detail pages
  const HEALTH_DETAIL_ROUTES: Record<string, string> = {
    farmacia: 'farmacia', farmacias: 'farmacia',
    dentista: 'dentista', dentistas: 'dentista',
    veterinario: 'veterinario', veterinarios: 'veterinario',
    medico: 'medico', medicos: 'medico',
    hospital: 'hospital', hospitales: 'hospital',
    laboratorio: 'laboratorio', laboratorios: 'laboratorio',
    optica: 'optica', opticas: 'optica',
    'salud-mental': 'salud-mental',
    quiropractico: 'quiropractico',
    gimnasio: 'gimnasio', gimnasios: 'gimnasio',
  };
  const detailRoute = HEALTH_DETAIL_ROUTES[cat] || null;

  // Singular noun + article for the Vitrina CTA ("¿Tienes <article> <noun> en Cabo Rojo?").
  // Replaces the old `'una ' + displayName.toLowerCase().replace(/s$/,'')` which broke for
  // masculine nouns (un veterinario) and compound display names (Hospitales y Clínicas).
  const HEALTH_CTA_NOUN: Record<string, { article: string; noun: string }> = {
    farmacia:       { article: 'una', noun: 'farmacia' },
    farmacias:      { article: 'una', noun: 'farmacia' },
    dentista:       { article: 'un',  noun: 'dentista' },
    dentistas:      { article: 'un',  noun: 'dentista' },
    veterinario:    { article: 'un',  noun: 'veterinario' },
    veterinarios:   { article: 'un',  noun: 'veterinario' },
    medico:         { article: 'un',  noun: 'médico' },
    medicos:        { article: 'un',  noun: 'médico' },
    hospital:       { article: 'un',  noun: 'hospital o clínica' },
    hospitales:     { article: 'un',  noun: 'hospital o clínica' },
    laboratorio:    { article: 'un',  noun: 'laboratorio' },
    laboratorios:   { article: 'un',  noun: 'laboratorio' },
    optica:         { article: 'una', noun: 'óptica' },
    opticas:        { article: 'una', noun: 'óptica' },
    'salud-mental': { article: 'un',  noun: 'centro de salud mental' },
    quiropractico:  { article: 'un',  noun: 'quiropráctico' },
    gimnasio:       { article: 'un',  noun: 'gimnasio' },
    gimnasios:      { article: 'un',  noun: 'gimnasio' },
  };

  const itemListElements = filtered.map((p: any, i: number) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: p.name,
    url: detailRoute ? `${baseUrl}/${detailRoute}/${p.slug || p.id}` : `${baseUrl}/negocio/${p.slug || p.id}`,
  }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${displayName} en Cabo Rojo, Puerto Rico`,
    description,
    numberOfItems: filtered.length,
    itemListElement: itemListElements,
  };

  // FAQ for health categories
  const isHealthCat = !!detailRoute;
  const topRated = filtered.filter((p: any) => p.google_rating).sort((a: any, b: any) => Number(b.google_rating) - Number(a.google_rating))[0];
  const faqItems = isHealthCat ? [
    { q: `¿Cuántos ${displayName.toLowerCase()} hay en Cabo Rojo?`, a: `Actualmente hay ${filtered.length} ${displayName.toLowerCase()} registrados en Cabo Rojo, Puerto Rico en MapaDeCaboRojo.com.` },
    ...(topRated ? [{ q: `¿Cuál es el ${displayName.toLowerCase().replace(/s$/, '')} con mejor rating en Cabo Rojo?`, a: `${topRated.name} tiene la mejor valoración con ${topRated.google_rating}/5 estrellas${topRated.google_review_count ? ` basado en ${topRated.google_review_count} reseñas` : ''}.` }] : []),
    { q: `¿Cómo encuentro ${displayName.toLowerCase()} cerca de mí en Cabo Rojo?`, a: `Puedes explorar todos los ${displayName.toLowerCase()} aquí en MapaDeCaboRojo.com o textear "${displayName}" al 787-417-7711 para que El Veci te recomiende.` },
  ] : [];

  const faqSchema = faqItems.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  } : null;

  // Memoria del Pueblo — verified anecdotes per place, only on health categories
  // (10 health subcats share `farmacia.ts` detail route → detailRoute is the gate).
  // Day 1: zero linked entries → every card shows DATO CTA. Cards swap to blockquote
  // as crowdsourced contributions (DATO Negocio: ...) get verified via MEMORIA admin.
  type MemoriaRow = { place_id: string; answer: string; voice_style: string | null };
  const memoriaByPlace = new Map<string, MemoriaRow>();
  if (detailRoute && filtered.length > 0) {
    try {
      const placeIds = filtered.map((p: any) => p.id).filter(Boolean);
      const { data: memorias } = await supabase
        .from('local_knowledge')
        .select('place_id, answer, voice_style, created_at')
        .in('place_id', placeIds)
        .eq('verified', true)
        .order('created_at', { ascending: false });
      for (const m of (memorias || []) as any[]) {
        if (m.place_id && !memoriaByPlace.has(m.place_id)) {
          memoriaByPlace.set(m.place_id, m as MemoriaRow);
        }
      }
    } catch { /* fail open */ }
  }

  const cardsHtml = filtered.length === 0
    ? `<p style="color:#64748b;text-align:center;padding:2rem;">No encontramos negocios en esta categoría todavía.</p>`
    : filtered.map((p: any) => {
        const slug = p.slug || p.id;
        const stars = p.google_rating ? `⭐ ${p.google_rating}` : '';
        const planBadge = p.plan === 'vip' ? '<span style="background:#f97316;color:white;font-size:0.65rem;padding:0.15rem 0.4rem;border-radius:999px;text-transform:uppercase;margin-left:0.4rem;">VIP</span>' : '';
        const detailPath = detailRoute ? `${baseUrl}/${detailRoute}/${esc(slug)}` : `${baseUrl}/negocio/${esc(slug)}`;
        const phoneInfo = normalizePhone(p.phone);
        const contactBlock = phoneInfo
          ? `<div style="display:flex;gap:0.4rem;padding:0.55rem 1rem 0.65rem;border-top:1px solid #f1f5f9;">
               <a href="tel:+1${phoneInfo.digits10}" style="flex:1;background:#0d9488;color:white;text-decoration:none;padding:0.45rem;border-radius:6px;font-size:0.78rem;text-align:center;font-weight:600;">📞 ${phoneInfo.display}</a>
               <a href="https://wa.me/1${phoneInfo.digits10}" style="flex:1;background:#22c55e;color:white;text-decoration:none;padding:0.45rem;border-radius:6px;font-size:0.78rem;text-align:center;font-weight:600;">💬 WhatsApp</a>
             </div>`
          : '';
        const memoria = memoriaByPlace.get(p.id) || null;
        const memoriaSig = memoria?.voice_style === 'collective' ? 'Dato compartido por vecinos' : 'De la memoria del pueblo';
        const memoriaBlock = memoria
          ? `<div style="border-top:1px solid #f1f5f9;padding:0.65rem 1rem 0.75rem;background:#fefce8;">
               <p style="font-size:0.78rem;color:#713f12;line-height:1.45;margin:0;">
                 <span style="font-size:0.85rem;">📜</span> ${esc(memoria.answer.slice(0, 200))}${memoria.answer.length > 200 ? '…' : ''}
               </p>
               <p style="font-size:0.65rem;color:#a16207;margin:0.3rem 0 0;font-style:italic;">— ${memoriaSig}</p>
             </div>`
          : (detailRoute
            ? `<a href="https://wa.me/17874177711?text=${encodeURIComponent('DATO ' + p.name + ': ')}" style="display:block;border-top:1px solid #f1f5f9;padding:0.55rem 1rem;background:#f8fafc;color:#475569;text-decoration:none;font-size:0.75rem;text-align:center;">
                 ¿Sabes algo de ${esc(p.name)}? Cuéntale a El Veci →
               </a>`
            : '');
        return `
        <div style="background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.07);transition:box-shadow 0.2s;">
          <a href="${detailPath}" style="display:block;text-decoration:none;color:inherit;">
            ${p.image_url
              ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" style="width:100%;height:160px;object-fit:cover;display:block;" loading="lazy">`
              : `<div style="width:100%;height:160px;background:linear-gradient(135deg,#0d9488,#f97316);display:flex;align-items:center;justify-content:center;font-size:2.5rem;">${emoji}</div>`}
            <div style="padding:1rem;">
              <h2 style="font-size:1rem;font-weight:700;color:#0f172a;margin-bottom:0.25rem;">${esc(p.name)}${planBadge}</h2>
              ${stars ? `<div style="color:#f59e0b;font-size:0.85rem;margin-bottom:0.25rem;">${stars}</div>` : ''}
              ${p.address ? `<p style="font-size:0.8rem;color:#64748b;margin-bottom:0.4rem;">📍 ${esc(p.address)}</p>` : ''}
              ${Array.isArray(p.services) && p.services.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:0.25rem;">${p.services.slice(0, 4).map((s: string) => `<span style="font-size:0.65rem;background:#f0fdf4;color:#166534;padding:0.15rem 0.4rem;border-radius:999px;">${esc(s)}</span>`).join('')}${p.services.length > 4 ? `<span style="font-size:0.65rem;color:#94a3b8;">+${p.services.length - 4}</span>` : ''}</div>` : ''}
            </div>
          </a>
          ${contactBlock}
          ${memoriaBlock}
        </div>`;
      }).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${pageUrl}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:site_name" content="MapaDeCaboRojo.com">
  <meta property="og:locale" content="es_PR">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  ${faqSchema ? `<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>` : ''}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; }
    .container { max-width: 960px; margin: 0 auto; padding: 1rem; }
    header { background: linear-gradient(135deg, #0d9488, #0f766e); color: white; padding: 2rem 1rem; text-align: center; margin-bottom: 1.5rem; }
    header h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem; }
    header p { opacity: 0.85; font-size: 0.95rem; }
    .back { display: inline-block; margin-bottom: 1.25rem; color: #0d9488; text-decoration: none; font-size: 0.9rem; }
    .back:hover { text-decoration: underline; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .cta-bar { background: #0d9488; color: white; text-align: center; padding: 1.25rem; border-radius: 10px; margin-bottom: 2rem; }
    .cta-bar p { margin-bottom: 0.5rem; font-size: 0.9rem; opacity: 0.9; }
    .cta-bar a { display: inline-block; background: #f97316; color: white; text-decoration: none; padding: 0.6rem 1.5rem; border-radius: 8px; font-weight: 600; }
    footer { text-align: center; padding: 1.5rem 0; color: #94a3b8; font-size: 0.8rem; }
  </style>
</head>
<body>
  <header>
    <h1>${emoji} ${alreadyHasCaboRojo ? esc(displayName) : `${esc(displayName)} en Cabo Rojo`}</h1>
    <p>${filtered.length} negocio${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''} · Cabo Rojo, Puerto Rico</p>
  </header>

  <div class="container">
    ${catSeo?.intro ? `<p style="font-size:1.05rem;line-height:1.6;color:#475569;margin-bottom:1.5rem;max-width:720px">${esc(catSeo.intro)}</p>` : ''}
    <a class="back" href="${baseUrl}">← Volver al mapa</a>

    <div class="cta-bar">
      <p>¿Buscas algo específico? Pregúntale a El Veci.</p>
      <a href="https://wa.me/17874177711?text=${encodeURIComponent(displayName)}">Textea al 787-417-7711</a>
    </div>

    <div class="grid">
      ${cardsHtml}
    </div>

    ${faqItems.length > 0 ? `
    <div style="background:white;border-radius:12px;padding:1.5rem;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:2rem;">
      <h2 style="font-size:1.15rem;font-weight:700;color:#0f172a;margin-bottom:1rem;">Preguntas frecuentes</h2>
      ${faqItems.map(f => `
        <div style="margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid #f1f5f9;">
          <h3 style="font-size:0.95rem;font-weight:600;color:#1e293b;margin-bottom:0.35rem;">${esc(f.q)}</h3>
          <p style="font-size:0.875rem;color:#475569;margin:0;">${esc(f.a)}</p>
        </div>`).join('')}
    </div>` : ''}

    ${demandRows.length > 0 ? (() => {
      const totalUsers = demandRows.reduce((s, r) => s + r.users, 0);
      const totalFailed = demandRows.reduce((s, r) => s + r.failed, 0);
      const subtitle = `Últimos 90 días en El Veci (*7711) · ${totalUsers} ${totalUsers === 1 ? 'persona' : 'personas'}${totalFailed > 0 ? ` · ${totalFailed} sin resultado` : ''}`;
      const items = demandRows.map(r => {
        const failBadge = r.failed > 0 ? '<span style="font-size:0.7rem;color:#dc2626;background:#fee2e2;padding:0.1rem 0.45rem;border-radius:999px;margin-left:0.5rem;font-weight:600;">sin resultado</span>' : '';
        return `<li style="padding:0.55rem 0;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:0.5rem;font-size:0.9rem;color:#334155;">
          <strong style="color:#0d9488;min-width:2.5rem;font-variant-numeric:tabular-nums;">${r.users}×</strong>
          <span>"${esc(r.query_normalized)}"</span>
          ${failBadge}
        </li>`;
      }).join('');
      return `
    <div style="background:white;border-radius:12px;padding:1.5rem;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:2rem;border-left:4px solid #0d9488;">
      <h2 style="font-size:1.1rem;font-weight:700;color:#0f172a;margin-bottom:0.35rem;">📊 Lo que vecinos están buscando</h2>
      <p style="font-size:0.8rem;color:#64748b;margin-bottom:1rem;">${esc(subtitle)}</p>
      <ul style="list-style:none;padding:0;margin:0;">${items}</ul>
    </div>`;
    })() : ''}

    <div style="background:linear-gradient(135deg,#0d9488 0%,#f97316 100%);border-radius:12px;padding:1.75rem 1.5rem;text-align:center;margin-bottom:2rem;">
      <h2 style="color:white;font-size:1.2rem;font-weight:700;margin-bottom:0.5rem;">¿Tienes ${detailRoute && HEALTH_CTA_NOUN[cat] ? `${HEALTH_CTA_NOUN[cat].article} ${HEALTH_CTA_NOUN[cat].noun}` : 'un negocio'} en Cabo Rojo?</h2>
      <p style="color:rgba(255,255,255,0.9);font-size:0.9rem;margin-bottom:1rem;">${(() => {
        const totalUsers = demandRows.reduce((s, r) => s + r.users, 0);
        const totalFailed = demandRows.reduce((s, r) => s + r.failed, 0);
        if (totalFailed >= 2) return `${totalFailed} vecinos buscaron y NO encontraron resultado este trimestre. Destaca con La Vitrina — apareces primero, servicios y fotos visibles. $799/año.`;
        if (totalUsers >= 3) return `${totalUsers} vecinos buscaron ${displayName.toLowerCase()} en El Veci este trimestre. Destaca con La Vitrina — apareces primero. $799/año.`;
        return `Destaca con La Vitrina — servicios, fotos, reviews, y apareces primero. $799/año.`;
      })()}</p>
      <a href="https://wa.me/17874177711?text=${encodeURIComponent('VITRINA ' + displayName)}" style="display:inline-block;background:white;color:#0d9488;text-decoration:none;padding:0.65rem 1.5rem;border-radius:8px;font-weight:700;font-size:0.95rem;">Textea VITRINA al 787-417-7711</a>
    </div>

    <footer style="margin-top: 48px; padding: 24px 0; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
        Hecho con orgullo en Cabo Rojo, Puerto Rico
      </p>
      <p style="color: #94a3b8; font-size: 11px; margin: 4px 0 0 0;">
        <a href="https://mapadecaborojo.com" style="color: #0d9488; text-decoration: none;">MapaDeCaboRojo.com</a>
        · Un proyecto de <a href="https://angelanderson.com" style="color: #0d9488; text-decoration: none;">Angel Anderson</a>
      </p>
    </footer>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  logApiCall('categoria', null, cat, req.headers['user-agent'] as string, req.headers['x-forwarded-for'] as string, filtered.length);
  return res.status(200).send(html);
}
