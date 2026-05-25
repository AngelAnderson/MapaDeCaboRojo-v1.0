/**
 * /api/farmacia.ts
 * Dedicated SSR page for pharmacy listings in MapaDeCaboRojo.com
 * Route: /farmacia/[slug] (via vercel.json rewrite)
 *
 * Features:
 * - Schema.org @type: Pharmacy (not generic LocalBusiness)
 * - "Verificado NPPES" badge when npi field is present
 * - clickable tel: phone links
 * - Google Maps embed
 * - RECLAMAR CTA → bot flow
 * - SEO title: "Farmacia [Nombre] — Cabo Rojo | MapaDeCaboRojo"
 *
 * PHASE 2 PREP:
 * - To extend for médicos: create /api/medico.ts with @type: Physician, taxonomy 207Q00000X
 * - To extend for dentistas: create /api/dentista.ts with @type: Dentist, taxonomy 1223G0001X
 * - To extend for labs: create /api/laboratorio.ts with @type: MedicalLaboratory, taxonomy 291U00000X
 * - NPPES query for each: GET https://npiregistry.cms.hhs.gov/api/?taxonomy_description=[term]&state=PR&limit=200
 * - See scripts/nppes-import-phase2.ts stub at bottom of this repo
 */

import { createClient } from '@supabase/supabase-js';
import { correctButtonHtml } from './lib/correct-button.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

// Medical green — matches HEALTH marker color override in constants.ts
const MEDICAL_GREEN = '#10b981';
const MEDICAL_DARK  = '#059669';

// Multi-type health detail config — farmacia.ts handles ALL health subcategories
const HEALTH_CONFIG: Record<string, { schemaType: string; label: string; labelPlural: string; emoji: string; color: string; colorDark: string }> = {
  farmacia:       { schemaType: 'Pharmacy',            label: 'Farmacia',           labelPlural: 'Farmacias',             emoji: '💊', color: MEDICAL_GREEN, colorDark: MEDICAL_DARK },
  dentista:       { schemaType: 'Dentist',             label: 'Dentista',           labelPlural: 'Dentistas',             emoji: '🦷', color: '#0ea5e9', colorDark: '#0284c7' },
  veterinario:    { schemaType: 'VeterinaryCare',      label: 'Veterinario',        labelPlural: 'Veterinarios',          emoji: '🐾', color: '#8b5cf6', colorDark: '#7c3aed' },
  medico:         { schemaType: 'Physician',           label: 'Médico',             labelPlural: 'Médicos',               emoji: '👨‍⚕️', color: MEDICAL_GREEN, colorDark: MEDICAL_DARK },
  hospital:       { schemaType: 'Hospital',            label: 'Hospital / Clínica', labelPlural: 'Hospitales y Clínicas', emoji: '🏥', color: '#ef4444', colorDark: '#dc2626' },
  laboratorio:    { schemaType: 'MedicalClinic',       label: 'Laboratorio',        labelPlural: 'Laboratorios',          emoji: '🔬', color: '#f59e0b', colorDark: '#d97706' },
  optica:         { schemaType: 'Optician',            label: 'Óptica',             labelPlural: 'Ópticas',               emoji: '👓', color: '#6366f1', colorDark: '#4f46e5' },
  'salud-mental': { schemaType: 'Physician',           label: 'Salud Mental',       labelPlural: 'Salud Mental',          emoji: '🧠', color: '#ec4899', colorDark: '#db2777' },
  quiropractico:  { schemaType: 'Physician',           label: 'Quiropráctico',      labelPlural: 'Quiroprácticos',        emoji: '🦴', color: '#14b8a6', colorDark: '#0d9488' },
  gimnasio:       { schemaType: 'ExerciseGym',         label: 'Gimnasio',           labelPlural: 'Gimnasios & Fitness',   emoji: '💪', color: '#f97316', colorDark: '#ea580c' },
  fisiatra:       { schemaType: 'Physician',           label: 'Fisiatra',           labelPlural: 'Fisiatras',             emoji: '🩺', color: '#0891b2', colorDark: '#0e7490' },
};

function esc(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const DAY_NAMES_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function formatHours(opening_hours: any): string {
  if (!opening_hours) return 'No disponible';
  if (opening_hours.note) return esc(opening_hours.note);
  if (opening_hours.type === 'always_open') return 'Abierto 24 horas';
  if (opening_hours.formatted && typeof opening_hours.formatted === 'string') return esc(opening_hours.formatted);
  if (Array.isArray(opening_hours.structured)) {
    const lines: string[] = [];
    for (const entry of opening_hours.structured) {
      const dayName = DAY_NAMES_ES[entry.day] || `Día ${entry.day}`;
      if (entry.isClosed) {
        lines.push(`${dayName}: Cerrado`);
      } else if (entry.open) {
        lines.push(`${dayName}: ${entry.open} – ${entry.close}`);
      }
    }
    return lines.length > 0 ? lines.join(' · ') : 'No disponible';
  }
  return 'No disponible';
}

/** Check if the business is currently open based on structured hours */
function isCurrentlyOpen(opening_hours: any): boolean | null {
  if (!opening_hours || !Array.isArray(opening_hours.structured)) return null;
  const now = new Date();
  // Puerto Rico is UTC-4 (AST, no daylight saving)
  const prOffset = -4 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const prNow = new Date(utcMs + prOffset * 60000);
  const dayOfWeek = prNow.getDay(); // 0=Sun
  const currentTime = `${String(prNow.getHours()).padStart(2, '0')}:${String(prNow.getMinutes()).padStart(2, '0')}`;
  const todayEntry = opening_hours.structured.find((e: any) => e.day === dayOfWeek);
  if (!todayEntry) return null;
  if (todayEntry.isClosed) return false;
  if (!todayEntry.open || !todayEntry.close) return null;
  return currentTime >= todayEntry.open && currentTime <= todayEntry.close;
}

/** Format date to human-readable Spanish */
function formatDateES(dateStr: string): string {
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function jsonLdOpeningHours(opening_hours: any): string[] {
  if (!opening_hours || !Array.isArray(opening_hours.structured)) return [];
  const dayAbbr = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const specs: string[] = [];
  for (const entry of opening_hours.structured) {
    if (!entry.isClosed && entry.open && entry.close) {
      const abbr = dayAbbr[entry.day] || `D${entry.day}`;
      specs.push(`${abbr} ${entry.open}-${entry.close}`);
    }
  }
  return specs;
}

export default async function handler(req: any, res: any) {
  const slug = req.query.slug as string;
  const type = (req.query.type as string || 'farmacia').toLowerCase();
  const config = HEALTH_CONFIG[type] || HEALTH_CONFIG['farmacia'];
  const isFarmaciaType = type === 'farmacia';

  if (!slug) {
    res.status(400).send('<h1>400 – Slug requerido</h1>');
    return;
  }

  let place: any = null;

  // Try by slug first, then by id
  const { data: bySlug } = await supabase
    .from('places')
    .select('*')
    .eq('slug', slug)
    .single();

  if (bySlug) {
    place = bySlug;
  } else {
    const { data: byId } = await supabase
      .from('places')
      .select('*')
      .eq('id', slug)
      .single();
    if (byId) place = byId;
  }

  // #7 Fetch native reviews (approved only) + stats
  let reviews: any[] = [];
  let reviewStats: { count: number; avg_rating: number | null; recommend_pct: number | null } = { count: 0, avg_rating: null, recommend_pct: null };
  if (place) {
    const [{ data: revData }, { data: statsData }] = await Promise.all([
      supabase.from('place_reviews_approved').select('*').eq('place_id', place.id).order('created_at', { ascending: false }).limit(3),
      supabase.rpc('place_review_stats', { p_place_id: place.id }),
    ]);
    if (revData) reviews = revData;
    if (statsData && statsData[0]) reviewStats = statsData[0];
  }

  if (!place) {
    res.status(404).send(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>${config.label} no encontrado | MapaDeCaboRojo.com</title></head>
<body>
  <h1>404 – ${config.label} no encontrado</h1>
  <p><a href="https://mapadecaborojo.com/categoria/${type}">Ver todos</a></p>
</body>
</html>`);
    return;
  }

  // #6 EN/ES toggle — ?lang=en triggers English variant for diáspora audience
  const lang: 'es' | 'en' = (req.query.lang as string) === 'en' ? 'en' : 'es';
  const T = lang === 'en' ? {
    labelEn: { farmacia:'Pharmacy', dentista:'Dentist', veterinario:'Veterinarian', medico:'Physician', hospital:'Hospital/Clinic', laboratorio:'Lab', optica:'Optician', 'salud-mental':'Mental Health', quiropractico:'Chiropractor', gimnasio:'Gym', fisiatra:'Physiatrist' } as Record<string,string>,
    labelPluralEn: { farmacia:'Pharmacies', dentista:'Dentists', veterinario:'Veterinarians', medico:'Physicians', hospital:'Hospitals & Clinics', laboratorio:'Labs', optica:'Opticians', 'salud-mental':'Mental Health', quiropractico:'Chiropractors', gimnasio:'Gyms & Fitness', fisiatra:'Physiatrists' } as Record<string,string>,
    inCaboRojo: 'in Cabo Rojo', address: 'Address', phone: 'Phone', hours: 'Hours', website: 'Website',
    info: 'Information', faq: 'Frequently asked questions',
    openNow: 'Open now', closedNow: 'Closed now', open24h: 'Open 24 hours',
    callNow: 'Call now', waDirect: 'WhatsApp directly', textVeci: 'Text El Veci',
    needSomething: 'Need something from', verified: 'Verified',
    relatedSearches: 'Related searches in Cabo Rojo',
    viewOnMap: (n: string) => `See ${n} on the interactive map`,
    isYourBusiness: 'Is this your business?',
    standOut: (l: string) => `Feature your ${l.toLowerCase()} with La Vitrina — photos, services, verified hours, and rank first when people search ${l.toLowerCase()}s in Cabo Rojo. $799/year.`,
    learnVitrina: 'Learn about La Vitrina',
    waPreText: (n: string) => `Hello, I found ${n} on MapaDeCaboRojo.com — I'd like to make an appointment / ask a question.`,
    ctaSubtitle: (n: string) => `Need something from ${n}?`,
    locale: 'en_US',
    titleSuffix: (l: string) => `${l} in Cabo Rojo | MapaDeCaboRojo`,
    descFallback: (n: string, l: string) => `${n} — ${l} in Cabo Rojo, Puerto Rico. Hours, address, phone and more.`,
  } : {
    inCaboRojo: 'en Cabo Rojo', address: 'Dirección', phone: 'Teléfono', hours: 'Horario', website: 'Web',
    info: 'Información', faq: 'Preguntas frecuentes',
    openNow: 'Abierta ahora', closedNow: 'Cerrada ahora', open24h: 'Abierto 24 horas',
    callNow: 'Llamar ahora', waDirect: 'WhatsApp directo', textVeci: 'Textea a El Veci',
    needSomething: '¿Necesitas algo de', verified: 'Verificado',
    relatedSearches: 'Búsquedas relacionadas en Cabo Rojo',
    viewOnMap: (n: string) => `Ver ${n} en el mapa interactivo`,
    isYourBusiness: '¿Es tu negocio?',
    standOut: (l: string) => `Destaca tu ${l.toLowerCase()} con La Vitrina — fotos, servicios, horarios verificados, y apareces primero cuando busquen ${l.toLowerCase()}s en Cabo Rojo. $799/año.`,
    learnVitrina: 'Conoce La Vitrina',
    waPreText: (n: string) => `Hola, encontré ${n} en MapaDeCaboRojo.com — quisiera agendar cita / hacer una pregunta.`,
    ctaSubtitle: (n: string) => `¿Necesitas algo de ${n}?`,
    locale: 'es_PR',
    titleSuffix: (l: string) => `${l} en Cabo Rojo | MapaDeCaboRojo`,
    descFallback: (n: string, l: string) => `${n} — ${l} en Cabo Rojo, Puerto Rico. Horarios, dirección, teléfono y más.`,
    labelEn: undefined as any, labelPluralEn: undefined as any,
  };
  const baseUrl     = 'https://mapadecaborojo.com';
  const pageUrl     = `${baseUrl}/${type}/${esc(place.slug || place.id)}`;
  const pageUrlEs   = pageUrl;
  const pageUrlEn   = `${pageUrl}?lang=en`;
  const placeName   = esc(place.name);
  const localizedLabel       = (lang === 'en' && T.labelEn?.[type]) ? T.labelEn[type] : config.label;
  const localizedLabelPlural = (lang === 'en' && T.labelPluralEn?.[type]) ? T.labelPluralEn[type] : config.labelPlural;
  const nameAlreadyHasLabel = place.name.toLowerCase().includes(localizedLabel.toLowerCase());
  const title       = nameAlreadyHasLabel ? `${placeName} — Cabo Rojo | MapaDeCaboRojo` : `${placeName} — ${T.titleSuffix(localizedLabel)}`;
  const description = place.description
    ? esc(place.description).slice(0, 160)
    : T.descFallback(placeName, localizedLabel);
  const image       = place.image_url || 'https://mapadecaborojo.com/og-default.png';
  const hoursText   = formatHours(place.opening_hours);
  const openNow     = isCurrentlyOpen(place.opening_hours);
  // If we can determine real-time status, use it; otherwise fall back to DB status
  const isOpen      = openNow !== null ? openNow : place.status === 'open';
  const ldHours     = jsonLdOpeningHours(place.opening_hours);
  const smsBody     = encodeURIComponent(place.name);

  // NPI / NPPES verification badge
  // The npi field may be stored in amenities.npi or as a top-level column depending on import
  const npi: string | null =
    place.npi ||
    (place.amenities && place.amenities.npi) ||
    null;

  // Data quality (cross-referenced against Google Places)
  // See scripts/verify-pharmacies.mjs and Outbox/PharmaAPI/nppes-quality-audit.md
  const qualityScore: number | null = place.data_quality_score ?? null;
  const businessStatus: string | null = place.business_status ?? null;
  const verifiedPhone: string | null = place.verified_phone ?? null;
  const lastVerifiedAt: string | null = place.last_verified_at ?? null;
  const verificationIssues: string[] = Array.isArray(place.verification_issues)
    ? place.verification_issues
    : [];

  // Display phone: prefer Google-verified phone if present, fall back to NPPES phone.
  const displayPhone = verifiedPhone || place.phone || null;
  const phoneCorrected = !!(
    verifiedPhone &&
    place.phone &&
    verifiedPhone.replace(/\D/g, '').slice(-10) !== place.phone.replace(/\D/g, '').slice(-10)
  );

  let qualityBadge = '';
  if (businessStatus === 'CLOSED_PERMANENTLY') {
    qualityBadge = `<span class="badge" style="background:#ef4444;" title="Google reporta esta farmacia como cerrada permanentemente">Cerrado según Google</span>`;
  } else if (qualityScore !== null && qualityScore >= 90) {
    const dateStr = lastVerifiedAt ? formatDateES(lastVerifiedAt) : '';
    qualityBadge = `<span class="badge" style="background:#10b981;" title="Verificado contra Google Places el ${dateStr}">&#10003; Verificado ${dateStr}</span>`;
  } else if (qualityScore !== null && qualityScore >= 50) {
    qualityBadge = `<span class="badge" style="background:#f59e0b;" title="Datos posiblemente desactualizados: ${esc(verificationIssues.join(', '))}">&#9888; Posiblemente desactualizado</span>`;
  }

  // Service badges — from DB `services` column first, then fallback to description parsing
  const dbServices: string[] = Array.isArray(place.services) ? place.services : [];
  const services: { icon: string; label: string }[] = [];

  if (dbServices.length > 0) {
    // Use DB services directly
    dbServices.forEach(s => services.push({ icon: '✓', label: s }));
  } else {
    // Fallback: parse from description/tags
    const descLower = (place.description || '').toLowerCase();
    const tagsLower = (Array.isArray(place.tags) ? place.tags : []).map((t: string) => t.toLowerCase());
    const allText = descLower + ' ' + tagsLower.join(' ');
    if (allText.includes('delivery') || allText.includes('entrega')) services.push({ icon: '🚗', label: 'Delivery gratis' });
    if (allText.includes('scriptalk') || allText.includes('no videntes') || allText.includes('accesib')) services.push({ icon: '♿', label: 'ScripTalk / Accesible' });
    if (allText.includes('vacuna') || allText.includes('vaccine')) services.push({ icon: '💉', label: 'Vacunas' });
    if (allText.includes('24 hora') || allText.includes('24/7') || allText.includes('always_open')) services.push({ icon: '🌙', label: 'Abierta 24 horas' });
    if (allText.includes('drive') || allText.includes('farmacia express')) services.push({ icon: '🚘', label: 'Drive-thru' });
    if (allText.includes('laboratorio') || allText.includes('lab')) services.push({ icon: '🔬', label: 'Laboratorio' });
    if (allText.includes('naturista') || allText.includes('natural')) services.push({ icon: '🌿', label: 'Productos naturales' });
  }

  // WhatsApp direct link for the business (if phone available) — pre-filled w/ context (lang-aware)
  const waPhone = (displayPhone || '').replace(/\D/g, '');
  const waPreText = encodeURIComponent(T.waPreText(place.name));
  const waLink = waPhone.length >= 10 ? `https://wa.me/1${waPhone.slice(-10)}?text=${waPreText}` : null;
  const telLink = displayPhone ? `tel:${esc(displayPhone)}` : null;
  // gtag tracking — fires events when vecino clicks call/WA. Pitch ammo for Vitrina.
  const trackCall = `onclick="try{gtag('event','click_call_practice',{place:'${esc(place.slug || place.id)}',type:'${type}'})}catch(e){}"`;
  const trackWa   = `onclick="try{gtag('event','click_whatsapp_practice',{place:'${esc(place.slug || place.id)}',type:'${type}'})}catch(e){}"`;

  // Street View fallback when no image
  const streetViewSrc = (place.lat && place.lon)
    ? `https://maps.googleapis.com/maps/api/streetview?size=720x300&location=${place.lat},${place.lon}&fov=90&key=${process.env.VITE_GOOGLE_API_KEY || ''}`
    : null;

  // Google Maps embed — uses coordinates if available, falls back to address search
  const mapsEmbedSrc = (place.lat && place.lon)
    ? `https://maps.google.com/maps?q=${place.lat},${place.lon}&z=16&output=embed`
    : `https://maps.google.com/maps?q=${encodeURIComponent((place.address || place.name) + ', Cabo Rojo, PR')}&z=15&output=embed`;

  // JSON-LD — Pharmacy type (more specific than LocalBusiness)
  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': config.schemaType,
    name: place.name,
    description: place.description || undefined,
    image: place.image_url || undefined,
    telephone: displayPhone || undefined,
    url: pageUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: place.address || undefined,
      addressLocality: 'Cabo Rojo',
      addressRegion: 'Puerto Rico',
      postalCode: (place.address || '').match(/\b006\d{2}\b/)?.[0] || '00623',
      addressCountry: 'PR',
    },
    geo: (place.lat && place.lon) ? {
      '@type': 'GeoCoordinates',
      latitude: place.lat,
      longitude: place.lon,
    } : undefined,
    areaServed: { '@type': 'City', name: 'Cabo Rojo' },
    openingHours: ldHours.length > 0 ? ldHours : undefined,
    aggregateRating: (place.google_rating && place.google_review_count > 1) ? {
      '@type': 'AggregateRating',
      ratingValue: place.google_rating,
      bestRating: 5,
      worstRating: 1,
      ratingCount: place.google_review_count,
    } : undefined,
    hasMap: place.gmaps_url || undefined,
    sameAs: [place.website, place.gmaps_url].filter(Boolean),
    // NPPES identifier when available
    ...(npi ? { identifier: { '@type': 'PropertyValue', name: 'NPI', value: npi } } : {}),
  };

  const cleanJsonLd = JSON.parse(JSON.stringify(jsonLd));

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${pageUrl}">
  <link rel="alternate" hreflang="es-PR" href="${pageUrlEs}">
  <link rel="alternate" hreflang="en-US" href="${pageUrlEn}">
  <link rel="alternate" hreflang="x-default" href="${pageUrlEs}">

  <!-- Open Graph -->
  <meta property="og:type" content="business.business">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:site_name" content="MapaDeCaboRojo.com">
  <meta property="og:locale" content="${T.locale}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${esc(image)}">

  <!-- JSON-LD: Pharmacy schema -->
  <script type="application/ld+json">${JSON.stringify(cleanJsonLd)}</script>

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0fdf4; color: #1e293b; line-height: 1.6; }
    .container { max-width: 720px; margin: 0 auto; padding: 1rem; }
    .back { display: inline-block; margin-bottom: 1rem; color: ${MEDICAL_GREEN}; text-decoration: none; font-size: 0.9rem; }
    .back:hover { text-decoration: underline; }
    .hero { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 1.5rem; }
    .hero-img { width: 100%; aspect-ratio: 16/9; object-fit: cover; object-position: center 30%; display: block; }
    .hero-img-placeholder { width: 100%; aspect-ratio: 16/9; background: linear-gradient(135deg, ${MEDICAL_GREEN} 0%, ${MEDICAL_DARK} 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 3.5rem; }
    .hero-body { padding: 1.5rem; }
    .badge { display: inline-block; background: ${MEDICAL_GREEN}; color: white; font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; margin-right: 0.4rem; }
    .badge-npi { background: #1d4ed8; }
    .badge-open { background: #10b981; }
    .badge-closed { background: #ef4444; }
    h1 { font-size: 1.75rem; font-weight: 700; color: #0f172a; margin-bottom: 0.5rem; margin-top: 0.5rem; }
    .rating { color: #f59e0b; font-size: 1rem; margin-bottom: 0.75rem; }
    .description { color: #475569; font-size: 0.95rem; }
    .info-card { background: white; border-radius: 12px; padding: 1.25rem 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 1rem; }
    .info-card h2 { font-size: 1rem; font-weight: 600; color: ${MEDICAL_GREEN}; margin-bottom: 0.75rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; }
    .info-row { display: flex; gap: 0.5rem; padding: 0.4rem 0; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748b; min-width: 120px; font-weight: 500; }
    .info-value { color: #1e293b; }
    .info-value a { color: ${MEDICAL_GREEN}; text-decoration: none; }
    .info-value a:hover { text-decoration: underline; }
    .map-embed { width: 100%; height: 220px; border: 0; border-radius: 12px; display: block; margin-bottom: 1rem; }
    .cta { background: linear-gradient(135deg, ${MEDICAL_GREEN}, ${MEDICAL_DARK}); border-radius: 12px; padding: 1.5rem; text-align: center; margin-bottom: 1rem; }
    .cta p { color: rgba(255,255,255,0.85); margin-bottom: 0.75rem; font-size: 0.95rem; }
    .cta a { display: inline-block; background: #f97316; color: white; text-decoration: none; padding: 0.75rem 1.75rem; border-radius: 8px; font-weight: 600; font-size: 1rem; }
    .faq { background: white; border-radius: 12px; padding: 1.25rem 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 1rem; }
    .faq h2 { font-size: 1rem; font-weight: 600; color: ${MEDICAL_GREEN}; margin-bottom: 0.75rem; }
    .faq-item { margin-bottom: 1rem; }
    .faq-item h3 { font-size: 0.9rem; font-weight: 600; color: #0f172a; margin-bottom: 0.25rem; }
    .faq-item p { font-size: 0.875rem; color: #475569; }
    .reclaim-card { background: linear-gradient(135deg, ${MEDICAL_GREEN} 0%, ${MEDICAL_DARK} 100%); border-radius: 12px; padding: 1.75rem 1.5rem; text-align: center; margin-bottom: 1rem; }
    .reclaim-card h2 { color: white; font-size: 1.3rem; font-weight: 700; margin-bottom: 0.5rem; }
    .reclaim-card p { color: rgba(255,255,255,0.9); font-size: 0.9rem; margin-bottom: 1.25rem; }
    .reclaim-btn { display: inline-block; background: white; color: ${MEDICAL_DARK}; text-decoration: none; padding: 0.75rem 1.75rem; border-radius: 8px; font-weight: 700; font-size: 1rem; }
    footer { text-align: center; padding: 1.5rem 0 2rem; color: #94a3b8; font-size: 0.8rem; border-top: 1px solid #e2e8f0; margin-top: 2rem; }
    footer a { color: ${MEDICAL_GREEN}; text-decoration: none; }
    .services { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
    .service-badge { display: inline-flex; align-items: center; gap: 0.3rem; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; font-size: 0.8rem; padding: 0.3rem 0.7rem; border-radius: 999px; font-weight: 500; }
    .wa-btn { display: inline-flex; align-items: center; gap: 0.5rem; background: #25D366; color: white; text-decoration: none; padding: 0.65rem 1.5rem; border-radius: 8px; font-weight: 600; font-size: 0.95rem; margin-right: 0.5rem; }
    .wa-btn:hover { background: #1da851; }
    .btn-row { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; margin-bottom: 0.75rem; }
    @media (max-width: 480px) { h1 { font-size: 1.4rem; } .map-embed { height: 180px; } }
  </style>
</head>
<body>
  <div class="container">
    <a class="back" href="${baseUrl}/categoria/${type}">&larr; ${config.labelPlural} en Cabo Rojo</a>

    <div class="hero">
      ${place.image_url
        ? `<img class="hero-img" src="${esc(place.image_url)}" alt="${placeName}" loading="lazy">`
        : (streetViewSrc
          ? `<img class="hero-img" src="${esc(streetViewSrc)}" alt="Vista exterior de ${placeName}" loading="lazy" onerror="this.outerHTML='<div class=\\'hero-img-placeholder\\'>💊</div>'">`
          : `<div class="hero-img-placeholder">💊</div>`)}
      <div class="hero-body">
        <div>
          <span class="badge">${config.label}</span>
          <span class="badge ${isOpen ? 'badge-open' : 'badge-closed'}">${isOpen ? T.openNow : T.closedNow}</span>
          ${npi && isFarmaciaType ? `<span class="badge badge-npi" title="Número NPI: ${esc(npi)}">&#10003; NPPES</span>` : ''}
          ${qualityBadge}
        </div>
        <h1>${placeName}</h1>
        ${place.google_rating ? `<div class="rating">&#11088; ${place.google_rating}/5</div>` : ''}
        ${place.description ? `<p class="description">${esc(place.description)}</p>` : ''}
        ${services.length > 0 ? `<div class="services">${services.map(s => `<span class="service-badge">${s.icon} ${s.label}</span>`).join('')}</div>` : ''}
      </div>
    </div>

    <!-- #6 Language toggle -->
    <div style="text-align:right;margin-bottom:8px;font-size:0.85rem;">
      ${lang === 'es'
        ? `<a href="${pageUrlEn}" style="color:${config.color};text-decoration:none;">🇺🇸 English version</a>`
        : `<a href="${pageUrlEs}" style="color:${config.color};text-decoration:none;">🇵🇷 Versión en español</a>`}
    </div>

    <div class="info-card">
      <h2>${T.info}</h2>
      ${place.address ? `<div class="info-row"><span class="info-label">&#128205; ${T.address}</span><span class="info-value">${esc(place.address)}, Cabo Rojo, PR</span></div>` : ''}
      ${displayPhone ? `<div class="info-row"><span class="info-label">&#128222; ${T.phone}</span><span class="info-value"><a href="tel:${esc(displayPhone)}">${esc(displayPhone)}</a>${phoneCorrected ? ` <small style="color:#92400e;">(corregido vs NPPES: ${esc(place.phone)})</small>` : ''}</span></div>` : ''}
      <div class="info-row"><span class="info-label">&#128336; ${T.hours}</span><span class="info-value">${hoursText}</span></div>
      ${place.website ? `<div class="info-row"><span class="info-label">&#127758; ${T.website}</span><span class="info-value"><a href="${esc(place.website)}" target="_blank" rel="noopener">${esc(place.website)}</a></span></div>` : ''}
      ${place.gmaps_url ? `<div class="info-row"><span class="info-label">&#128507; Google Maps</span><span class="info-value"><a href="${esc(place.gmaps_url)}" target="_blank" rel="noopener">Ver en Maps</a></span></div>` : ''}
      ${npi ? `<div class="info-row"><span class="info-label">&#10003; NPI</span><span class="info-value">${esc(npi)} &mdash; Registro NPPES verificado</span></div>` : ''}
      ${lastVerifiedAt ? `<div class="info-row"><span class="info-label">&#128260; Verificado</span><span class="info-value">${formatDateES(lastVerifiedAt)} — datos confirmados contra Google</span></div>` : ''}
    </div>

    ${telLink || waLink ? `
    <!-- Primary CTA: direct contact (gtag tracked — pitch ammo for Vitrina) -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 20px;">
      ${telLink ? `<a href="${telLink}" ${trackCall} style="flex:1 1 200px;display:inline-flex;align-items:center;justify-content:center;gap:8px;background:${config.color};color:white;text-decoration:none;padding:14px 20px;border-radius:10px;font-weight:700;font-size:1rem;box-shadow:0 2px 8px rgba(0,0,0,0.12);">&#128222; ${T.callNow}</a>` : ''}
      ${waLink ? `<a href="${waLink}" target="_blank" rel="noopener" ${trackWa} style="flex:1 1 200px;display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#25D366;color:white;text-decoration:none;padding:14px 20px;border-radius:10px;font-weight:700;font-size:1rem;box-shadow:0 2px 8px rgba(0,0,0,0.12);">&#128241; ${T.waDirect}</a>` : ''}
    </div>
    ` : ''}

    <!-- Google Maps Embed -->
    <iframe
      class="map-embed"
      src="${mapsEmbedSrc}"
      allowfullscreen=""
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
      title="Mapa de ${placeName}"
    ></iframe>

    ${(() => {
      // #3 Plan médico coverage table — show only on health categories (not gyms/spa)
      if (!['fisiatra','medico','dentista','laboratorio','optica','salud-mental','quiropractico','hospital'].includes(type)) return '';
      const plans = place.accepted_plans as Record<string, any> | null;
      const PLAN_LABELS: Array<{key:string;es:string;en:string}> = [
        {key:'mmm',                es:'MMM',                en:'MMM'},
        {key:'triple_s',           es:'Triple-S',           en:'Triple-S'},
        {key:'first_medical',      es:'First Medical',      en:'First Medical'},
        {key:'humana',             es:'Humana',             en:'Humana'},
        {key:'medicare',           es:'Medicare',           en:'Medicare'},
        {key:'medicare_advantage', es:'Medicare Advantage', en:'Medicare Advantage'},
        {key:'mcs',                es:'MCS',                en:'MCS'},
        {key:'plan_vital',         es:'Plan Vital',         en:'Plan Vital'},
        {key:'reforma',            es:'Reforma',            en:'Reforma'},
        {key:'private_pay',        es:'Pago privado',       en:'Private pay'},
      ];
      const hasData = plans && PLAN_LABELS.some(p => plans[p.key] === true || plans[p.key] === false);
      const headerEs = '💳 Planes médicos aceptados';
      const headerEn = '💳 Insurance plans accepted';
      const updatedEs = plans?.updated_at ? `<p style="font-size:0.75rem;color:#94a3b8;margin-top:0.5rem;">Actualizado: ${esc(String(plans.updated_at))} · siempre confirma con tu plan antes de la cita.</p>` : '';
      const updatedEn = plans?.updated_at ? `<p style="font-size:0.75rem;color:#94a3b8;margin-top:0.5rem;">Updated: ${esc(String(plans.updated_at))} · always confirm with your insurance before your appointment.</p>` : '';
      const noteEs = '<p style="font-size:0.8rem;color:#64748b;margin-top:0.75rem;">Los datos vienen de la práctica. Si ves algo desactualizado, textea <strong>PLANES ' + esc(place.name) + '</strong> al 787-417-7711.</p>';
      const noteEn = '<p style="font-size:0.8rem;color:#64748b;margin-top:0.75rem;">Data provided by the practice. See something outdated? Text <strong>PLANES ' + esc(place.name) + '</strong> to 787-417-7711.</p>';
      const emptyEs = `
        <p style="color:#475569;font-size:0.9rem;margin-bottom:0.75rem;">Aún no tenemos los planes médicos confirmados de ${placeName}.</p>
        <div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:0.75rem 1rem;border-radius:6px;font-size:0.85rem;color:#78350f;">
          <strong>¿Eres dueño o trabajas aquí?</strong> Textea <strong>PLANES ${esc(place.name)}</strong> al 787-417-7711 con los planes que aceptan — actualizamos esto en 24h. Pacientes con tu plan te encuentran primero.
        </div>`;
      const emptyEn = `
        <p style="color:#475569;font-size:0.9rem;margin-bottom:0.75rem;">We don't yet have confirmed insurance data for ${placeName}.</p>
        <div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:0.75rem 1rem;border-radius:6px;font-size:0.85rem;color:#78350f;">
          <strong>Are you the owner or staff?</strong> Text <strong>PLANES ${esc(place.name)}</strong> to 787-417-7711 with the plans you accept — we update within 24h. Patients with your insurance find you first.
        </div>`;
      const table = hasData ? `
        <table style="width:100%;border-collapse:collapse;margin-top:0.5rem;">
          <thead><tr style="background:#f8fafc;text-align:left;">
            <th style="padding:8px 12px;font-size:0.85rem;color:#334155;font-weight:600;">${lang==='en'?'Plan':'Plan médico'}</th>
            <th style="padding:8px 12px;font-size:0.85rem;color:#334155;font-weight:600;text-align:center;">${lang==='en'?'Accepted':'Acepta'}</th>
          </tr></thead>
          <tbody>
          ${PLAN_LABELS.map(p => {
            const v = plans![p.key];
            const cell = v === true ? '<span style="color:#16a34a;font-weight:700;font-size:1.1rem;">✓</span>' : v === false ? '<span style="color:#dc2626;font-weight:700;font-size:1.1rem;">✗</span>' : '<span style="color:#94a3b8;font-size:1.1rem;">—</span>';
            return `<tr style="border-top:1px solid #f1f5f9;"><td style="padding:8px 12px;font-size:0.9rem;color:#1e293b;">${lang==='en'?p.en:p.es}</td><td style="padding:8px 12px;text-align:center;">${cell}</td></tr>`;
          }).join('')}
          </tbody>
        </table>
        ${lang === 'en' ? updatedEn : updatedEs}
        ${lang === 'en' ? noteEn : noteEs}` : (lang === 'en' ? emptyEn : emptyEs);
      return `
    <div style="background:white;border-radius:12px;padding:1.25rem 1.5rem;margin-bottom:1.25rem;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <h2 style="font-size:1.05rem;font-weight:700;color:${config.color};margin-bottom:0.5rem;">${lang==='en'?headerEn:headerEs}</h2>
      ${table}
    </div>`;
    })()}

    ${(() => {
      // #7 Native reviews section — moderated, plan-specific, via bot *7711
      if (!['fisiatra','medico','dentista','laboratorio','optica','salud-mental','quiropractico','hospital','farmacia'].includes(type)) return '';
      const heading = lang === 'en' ? '⭐ What vecinos say' : '⭐ Lo que dicen los vecinos';
      const empty = lang === 'en'
        ? `<p style="color:#475569;font-size:0.9rem;margin-bottom:0.75rem;">No reviews yet for ${placeName}.</p>
           <div style="background:#dbeafe;border-left:3px solid #3b82f6;padding:0.75rem 1rem;border-radius:6px;font-size:0.85rem;color:#1e3a8a;">
             <strong>Been here? Help other vecinos.</strong> Text <strong>REVIEW ${esc(place.name)} [1-5] [your experience]</strong> to 787-417-7711. Approved within 24h. Plan-specific reviews = trust signal for diáspora.
           </div>`
        : `<p style="color:#475569;font-size:0.9rem;margin-bottom:0.75rem;">Aún no hay reseñas de vecinos para ${placeName}.</p>
           <div style="background:#dbeafe;border-left:3px solid #3b82f6;padding:0.75rem 1rem;border-radius:6px;font-size:0.85rem;color:#1e3a8a;">
             <strong>¿Has ido? Ayuda a otros vecinos.</strong> Textea <strong>REVIEW ${esc(place.name)} [1-5] [tu experiencia]</strong> al 787-417-7711. Aprobamos en 24h. Reseñas con tu plan médico = señal de confianza pa' diáspora.
           </div>`;
      const renderReview = (r: any) => {
        const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
        const planChip = r.plan_medico ? `<span style="background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:10px;font-size:0.7rem;margin-left:6px;">${esc(r.plan_medico)}</span>` : '';
        const recBadge = r.recommends ? (lang === 'en' ? '👍 Recommends' : '👍 Recomienda') : '';
        const dateStr = new Date(r.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-PR', { year: 'numeric', month: 'short' });
        return `
          <div style="padding:0.9rem 0;border-bottom:1px solid #f1f5f9;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <span style="color:#f59e0b;font-size:0.95rem;">${stars}</span>
              ${planChip}
              <span style="margin-left:auto;font-size:0.75rem;color:#94a3b8;">${esc(r.phone_last4)} · ${dateStr}</span>
            </div>
            <p style="font-size:0.9rem;color:#1e293b;line-height:1.55;margin-bottom:6px;">${esc(r.body)}</p>
            ${recBadge ? `<p style="font-size:0.75rem;color:#16a34a;font-weight:600;">${recBadge}${r.condition_treated ? ` · ${esc(r.condition_treated)}` : ''}</p>` : ''}
          </div>`;
      };
      const statsHtml = reviewStats.count > 0 && reviewStats.avg_rating
        ? `<div style="display:flex;align-items:center;gap:12px;margin-bottom:1rem;padding-bottom:0.75rem;border-bottom:1px solid #e2e8f0;">
            <div style="display:flex;align-items:baseline;gap:6px;">
              <span style="font-size:1.6rem;font-weight:800;color:${config.color};">${reviewStats.avg_rating}</span>
              <span style="font-size:0.85rem;color:#64748b;">/5</span>
            </div>
            <div style="font-size:0.8rem;color:#64748b;">
              ${reviewStats.count} ${lang === 'en' ? (reviewStats.count === 1 ? 'review' : 'reviews') : 'reseña' + (reviewStats.count === 1 ? '' : 's')}
              ${reviewStats.recommend_pct !== null ? ` · ${reviewStats.recommend_pct}% ${lang === 'en' ? 'recommend' : 'recomienda'}` : ''}
            </div>
          </div>`
        : '';
      const list = reviews.length > 0 ? reviews.map(renderReview).join('') : empty;
      return `
    <div style="background:white;border-radius:12px;padding:1.25rem 1.5rem;margin-bottom:1.25rem;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <h2 style="font-size:1.05rem;font-weight:700;color:${config.color};margin-bottom:0.75rem;">${heading}</h2>
      ${statsHtml}
      ${list}
    </div>`;
    })()}

    <div class="cta">
      <p>&#128140; ${T.ctaSubtitle(placeName)}</p>
      <div class="btn-row">
        ${waLink ? `<a class="wa-btn" href="${waLink}" target="_blank" rel="noopener">WhatsApp directo</a>` : ''}
        <a href="https://wa.me/17874177711?text=${smsBody}" style="display:inline-flex;align-items:center;gap:0.5rem;background:#f97316;color:white;text-decoration:none;padding:0.65rem 1.5rem;border-radius:8px;font-weight:600;font-size:0.95rem;">Textea a El Veci</a>
      </div>
      ${displayPhone ? `<p style="margin-top:0.5rem;font-size:0.85rem;"><a href="tel:${esc(displayPhone)}" style="color:rgba(255,255,255,0.9);">&#128222; Llamar al ${esc(displayPhone)}</a></p>` : ''}
    </div>

    <div class="faq">
      <h2>Preguntas frecuentes</h2>
      <div class="faq-item">
        <h3>¿Dónde queda ${placeName}?</h3>
        <p>${place.address
          ? `${placeName} está en ${esc(place.address)}, Cabo Rojo, Puerto Rico.`
          : `${placeName} está ubicada en Cabo Rojo, Puerto Rico.`}
        ${place.gmaps_url ? ` <a href="${esc(place.gmaps_url)}" target="_blank" rel="noopener">Ver en Google Maps</a>.` : ''}</p>
      </div>
      <div class="faq-item">
        <h3>¿Está abierta ${placeName} hoy?</h3>
        <p>${isOpen
          ? `${placeName} aparece como abierta. Horario: ${hoursText}. Verifica directamente antes de visitar.`
          : `${placeName} aparece como cerrada. Llama al ${place.phone || '787-417-7711'} para confirmar.`}</p>
      </div>
      <div class="faq-item">
        <h3>¿Cuál es el teléfono de ${placeName}?</h3>
        <p>${place.phone
          ? `El teléfono de ${placeName} es <a href="tel:${esc(place.phone)}">${esc(place.phone)}</a>. También puedes textear el nombre al 787-417-7711 para más info.`
          : `Textea "${esc(place.name)}" al 787-417-7711 y El Veci te ayuda.`}</p>
      </div>
    </div>

    ${(place.plan && place.plan !== 'free')
      ? `<div class="reclaim-card">
      <h2>★ Eres parte de La Vitrina</h2>
      <p>Para actualizar tu información, fotos u horarios, textea al 787-417-7711.</p>
      <a class="reclaim-btn" href="https://wa.me/17874177711?text=ACTUALIZAR%20${encodeURIComponent(place.name)}">Actualizar mi información</a>
    </div>`
      : `<div class="reclaim-card">
      <h2>${T.isYourBusiness}</h2>
      <p>${T.standOut(localizedLabel)}</p>
      <a class="reclaim-btn" href="https://wa.me/17874177711?text=VITRINA%20${encodeURIComponent(place.name)}">${T.learnVitrina}</a>
      <a href="https://wa.me/17874177711?text=RECLAMAR%20${encodeURIComponent(place.name)}" style="display:inline-block;background:transparent;color:white;text-decoration:underline;padding:0.4rem 1rem;font-size:0.85rem;margin-top:0.5rem;">Solo verificar mi info (gratis)</a>
      <p style="color:rgba(255,255,255,0.75);font-size:0.8rem;margin-top:0.75rem;">Textea al 787-417-7711 y El Veci te guía paso a paso.</p>
    </div>`}

    <div style="background:white;border-radius:12px;padding:1.25rem 1.5rem;box-shadow:0 2px 8px rgba(0,0,0,0.08);margin-bottom:1rem;">
      <h2 style="font-size:1rem;font-weight:600;color:${MEDICAL_GREEN};margin-bottom:0.5rem;">&#129302; Pregúntale a El Veci sobre ${placeName}</h2>
      <p style="font-size:0.875rem;color:#475569;margin-bottom:0.75rem;">El Veci es tu vecino digital. Pregúntale lo que quieras — horarios, servicios, cómo llegar, o qué ${config.labelPlural.toLowerCase()} están disponibles ahora.</p>
      <a href="https://wa.me/17874177711?text=${encodeURIComponent(`¿Está abierta ${place.name}?`)}" style="display:inline-block;background:${MEDICAL_GREEN};color:white;text-decoration:none;padding:0.6rem 1.25rem;border-radius:8px;font-weight:600;font-size:0.9rem;">Textea a El Veci</a>
    </div>

    ${(() => {
      // #9 Cross-link health verticals — surface complementary categories per type
      const related: Record<string, Array<{slug:string;label:string;emoji:string}>> = {
        fisiatra:      [{slug:'farmacia',label:'farmacias',emoji:'💊'},{slug:'medico',label:'médicos',emoji:'👨‍⚕️'},{slug:'quiropractico',label:'quiroprácticos',emoji:'🦴'}],
        medico:        [{slug:'farmacia',label:'farmacias',emoji:'💊'},{slug:'laboratorio',label:'laboratorios',emoji:'🔬'},{slug:'fisiatra',label:'fisiatras',emoji:'🩺'}],
        farmacia:      [{slug:'medico',label:'médicos',emoji:'👨‍⚕️'},{slug:'laboratorio',label:'laboratorios',emoji:'🔬'},{slug:'hospital',label:'hospitales',emoji:'🏥'}],
        dentista:      [{slug:'farmacia',label:'farmacias',emoji:'💊'},{slug:'medico',label:'médicos',emoji:'👨‍⚕️'}],
        hospital:      [{slug:'farmacia',label:'farmacias',emoji:'💊'},{slug:'laboratorio',label:'laboratorios',emoji:'🔬'},{slug:'medico',label:'médicos',emoji:'👨‍⚕️'}],
        laboratorio:   [{slug:'farmacia',label:'farmacias',emoji:'💊'},{slug:'medico',label:'médicos',emoji:'👨‍⚕️'}],
        optica:        [{slug:'medico',label:'médicos',emoji:'👨‍⚕️'},{slug:'farmacia',label:'farmacias',emoji:'💊'}],
        'salud-mental':[{slug:'medico',label:'médicos',emoji:'👨‍⚕️'},{slug:'farmacia',label:'farmacias',emoji:'💊'}],
        quiropractico: [{slug:'fisiatra',label:'fisiatras',emoji:'🩺'},{slug:'farmacia',label:'farmacias',emoji:'💊'}],
        veterinario:   [{slug:'farmacia',label:'farmacias',emoji:'💊'}],
        gimnasio:      [{slug:'fisiatra',label:'fisiatras',emoji:'🩺'},{slug:'quiropractico',label:'quiroprácticos',emoji:'🦴'}],
      };
      const links = related[type] || [];
      if (!links.length) return '';
      const labelsEn: Record<string,string> = { farmacias:'pharmacies', médicos:'physicians', quiroprácticos:'chiropractors', laboratorios:'labs', hospitales:'hospitals', fisiatras:'physiatrists' };
      return `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:1rem 1.25rem;margin-bottom:1.25rem;">
      <p style="font-size:0.85rem;color:#64748b;margin:0 0 0.5rem;font-weight:600;">${T.relatedSearches}:</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${links.map(l => `<a href="${baseUrl}/categoria/${l.slug}${lang==='en'?'?lang=en':''}" style="display:inline-flex;align-items:center;gap:6px;background:white;border:1px solid #cbd5e1;border-radius:20px;padding:6px 14px;font-size:0.85rem;color:#334155;text-decoration:none;">${l.emoji} ${lang==='en' && labelsEn[l.label] ? labelsEn[l.label] : l.label}</a>`).join('')}
      </div>
    </div>`;
    })()}

    <div style="text-align:center;margin-bottom:1.5rem;">
      <a href="${baseUrl}/?place=${esc(place.slug || place.id)}" style="color:${MEDICAL_GREEN};text-decoration:none;font-size:0.9rem;">${T.viewOnMap(placeName)} &rarr;</a>
    </div>

    <footer>
      <p>Hecho con orgullo en Cabo Rojo, Puerto Rico</p>
      <p style="margin-top:4px;"><a href="${baseUrl}">MapaDeCaboRojo.com</a> &middot; Un proyecto de <a href="https://angelanderson.com">Angel Anderson</a></p>
    </footer>
  </div>
  ${correctButtonHtml({ pageType: 'farmacia', placeId: place.id })}
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
  return res.status(200).send(html);
}
