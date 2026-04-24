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

  const baseUrl     = 'https://mapadecaborojo.com';
  const pageUrl     = `${baseUrl}/${type}/${esc(place.slug || place.id)}`;
  const placeName   = esc(place.name);
  const nameAlreadyHasLabel = place.name.toLowerCase().includes(config.label.toLowerCase());
  const title       = nameAlreadyHasLabel ? `${placeName} — Cabo Rojo | MapaDeCaboRojo` : `${placeName} — ${config.label} en Cabo Rojo | MapaDeCaboRojo`;
  const description = place.description
    ? esc(place.description).slice(0, 160)
    : `${placeName} — ${config.label} en Cabo Rojo, Puerto Rico. Horarios, dirección, teléfono y más.`;
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

  // WhatsApp direct link for the business (if phone available)
  const waPhone = (displayPhone || '').replace(/\D/g, '');
  const waLink = waPhone.length >= 10 ? `https://wa.me/1${waPhone.slice(-10)}` : null;

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
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${pageUrl}">

  <!-- Open Graph -->
  <meta property="og:type" content="business.business">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:site_name" content="MapaDeCaboRojo.com">
  <meta property="og:locale" content="es_PR">

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
          <span class="badge ${isOpen ? 'badge-open' : 'badge-closed'}">${isOpen ? 'Abierta ahora' : 'Cerrada ahora'}</span>
          ${npi && isFarmaciaType ? `<span class="badge badge-npi" title="Número NPI: ${esc(npi)}">&#10003; NPPES</span>` : ''}
          ${qualityBadge}
        </div>
        <h1>${placeName}</h1>
        ${place.google_rating ? `<div class="rating">&#11088; ${place.google_rating}/5</div>` : ''}
        ${place.description ? `<p class="description">${esc(place.description)}</p>` : ''}
        ${services.length > 0 ? `<div class="services">${services.map(s => `<span class="service-badge">${s.icon} ${s.label}</span>`).join('')}</div>` : ''}
      </div>
    </div>

    <div class="info-card">
      <h2>Información</h2>
      ${place.address ? `<div class="info-row"><span class="info-label">&#128205; Dirección</span><span class="info-value">${esc(place.address)}, Cabo Rojo, PR</span></div>` : ''}
      ${displayPhone ? `<div class="info-row"><span class="info-label">&#128222; Teléfono</span><span class="info-value"><a href="tel:${esc(displayPhone)}">${esc(displayPhone)}</a>${phoneCorrected ? ` <small style="color:#92400e;">(corregido vs NPPES: ${esc(place.phone)})</small>` : ''}</span></div>` : ''}
      <div class="info-row"><span class="info-label">&#128336; Horario</span><span class="info-value">${hoursText}</span></div>
      ${place.website ? `<div class="info-row"><span class="info-label">&#127758; Web</span><span class="info-value"><a href="${esc(place.website)}" target="_blank" rel="noopener">${esc(place.website)}</a></span></div>` : ''}
      ${place.gmaps_url ? `<div class="info-row"><span class="info-label">&#128507; Google Maps</span><span class="info-value"><a href="${esc(place.gmaps_url)}" target="_blank" rel="noopener">Ver en Maps</a></span></div>` : ''}
      ${npi ? `<div class="info-row"><span class="info-label">&#10003; NPI</span><span class="info-value">${esc(npi)} &mdash; Registro NPPES verificado</span></div>` : ''}
      ${lastVerifiedAt ? `<div class="info-row"><span class="info-label">&#128260; Verificado</span><span class="info-value">${formatDateES(lastVerifiedAt)} — datos confirmados contra Google</span></div>` : ''}
    </div>

    <!-- Google Maps Embed -->
    <iframe
      class="map-embed"
      src="${mapsEmbedSrc}"
      allowfullscreen=""
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
      title="Mapa de ${placeName}"
    ></iframe>

    <div class="cta">
      <p>&#128140; ¿Necesitas algo de ${placeName}?</p>
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

    <div class="reclaim-card">
      <h2>¿Es tu negocio?</h2>
      <p>Destaca tu ${config.label.toLowerCase()} con La Vitrina — fotos, servicios, horarios verificados, y apareces primero cuando busquen ${config.labelPlural.toLowerCase()} en Cabo Rojo. $799/año.</p>
      <a class="reclaim-btn" href="https://wa.me/17874177711?text=VITRINA%20${encodeURIComponent(place.name)}">Conoce La Vitrina</a>
      <a href="https://wa.me/17874177711?text=RECLAMAR%20${encodeURIComponent(place.name)}" style="display:inline-block;background:transparent;color:white;text-decoration:underline;padding:0.4rem 1rem;font-size:0.85rem;margin-top:0.5rem;">Solo verificar mi info (gratis)</a>
      <p style="color:rgba(255,255,255,0.75);font-size:0.8rem;margin-top:0.75rem;">Textea al 787-417-7711 y El Veci te guía paso a paso.</p>
    </div>

    <div style="background:white;border-radius:12px;padding:1.25rem 1.5rem;box-shadow:0 2px 8px rgba(0,0,0,0.08);margin-bottom:1rem;">
      <h2 style="font-size:1rem;font-weight:600;color:${MEDICAL_GREEN};margin-bottom:0.5rem;">&#129302; Pregúntale a El Veci sobre ${placeName}</h2>
      <p style="font-size:0.875rem;color:#475569;margin-bottom:0.75rem;">El Veci es tu vecino digital. Pregúntale lo que quieras — horarios, servicios, cómo llegar, o qué ${config.labelPlural.toLowerCase()} están disponibles ahora.</p>
      <a href="https://wa.me/17874177711?text=${encodeURIComponent(`¿Está abierta ${place.name}?`)}" style="display:inline-block;background:${MEDICAL_GREEN};color:white;text-decoration:none;padding:0.6rem 1.25rem;border-radius:8px;font-weight:600;font-size:0.9rem;">Textea a El Veci</a>
    </div>

    <div style="text-align:center;margin-bottom:1.5rem;">
      <a href="${baseUrl}/?place=${esc(place.slug || place.id)}" style="color:${MEDICAL_GREEN};text-decoration:none;font-size:0.9rem;">Ver ${placeName} en el mapa interactivo &rarr;</a>
    </div>

    <footer>
      <p>Hecho con orgullo en Cabo Rojo, Puerto Rico</p>
      <p style="margin-top:4px;"><a href="${baseUrl}">MapaDeCaboRojo.com</a> &middot; Un proyecto de <a href="https://angelanderson.com">Angel Anderson</a></p>
      <p style="margin-top:0.5rem;"><a href="https://wa.me/17874177711?text=ERROR%20${encodeURIComponent(place.name)}%3A%20" style="color:#94a3b8;font-size:0.75rem;text-decoration:none;">Reportar error en esta página</a></p>
    </footer>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
  return res.status(200).send(html);
}
