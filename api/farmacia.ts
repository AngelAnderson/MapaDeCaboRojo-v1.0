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

function esc(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatHours(opening_hours: any): string {
  if (!opening_hours) return 'No disponible';
  if (opening_hours.note) return esc(opening_hours.note);
  if (opening_hours.type === 'always_open') return 'Abierto 24 horas';
  if (opening_hours.structured) {
    const days: string[] = [];
    for (const [day, hours] of Object.entries(opening_hours.structured)) {
      if (hours && typeof hours === 'object' && (hours as any).open) {
        days.push(`${day}: ${(hours as any).open} – ${(hours as any).close}`);
      }
    }
    return days.length > 0 ? days.join(', ') : 'No disponible';
  }
  return 'No disponible';
}

function jsonLdOpeningHours(opening_hours: any): string[] {
  if (!opening_hours || !opening_hours.structured) return [];
  const dayMap: Record<string, string> = {
    lunes: 'Mo', martes: 'Tu', miercoles: 'We', jueves: 'Th',
    viernes: 'Fr', sabado: 'Sa', domingo: 'Su',
    monday: 'Mo', tuesday: 'Tu', wednesday: 'We', thursday: 'Th',
    friday: 'Fr', saturday: 'Sa', sunday: 'Su',
  };
  const specs: string[] = [];
  for (const [day, hours] of Object.entries(opening_hours.structured)) {
    if (hours && typeof hours === 'object' && (hours as any).open) {
      const abbr = dayMap[day.toLowerCase()] || day;
      specs.push(`${abbr} ${(hours as any).open}-${(hours as any).close}`);
    }
  }
  return specs;
}

export default async function handler(req: any, res: any) {
  const slug = req.query.slug as string;

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
<head><meta charset="UTF-8"><title>Farmacia no encontrada | MapaDeCaboRojo.com</title></head>
<body>
  <h1>404 – Farmacia no encontrada</h1>
  <p><a href="https://mapadecaborojo.com/categoria/farmacia">Ver todas las farmacias</a></p>
</body>
</html>`);
    return;
  }

  const baseUrl     = 'https://mapadecaborojo.com';
  const pageUrl     = `${baseUrl}/farmacia/${esc(place.slug || place.id)}`;
  const placeName   = esc(place.name);
  const title       = `Farmacia ${placeName} — Cabo Rojo | MapaDeCaboRojo`;
  const description = place.description
    ? esc(place.description).slice(0, 160)
    : `Farmacia ${placeName} en Cabo Rojo, Puerto Rico. Horarios, dirección, teléfono y más.`;
  const image       = place.image_url || 'https://mapadecaborojo.com/og-default.png';
  const hoursText   = formatHours(place.opening_hours);
  const isOpen      = place.status === 'open';
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
    const dateStr = lastVerifiedAt ? lastVerifiedAt.slice(0, 10) : '';
    qualityBadge = `<span class="badge" style="background:#10b981;" title="Verificado contra Google Places el ${dateStr}">&#10003; Verificado ${dateStr}</span>`;
  } else if (qualityScore !== null && qualityScore >= 50) {
    qualityBadge = `<span class="badge" style="background:#f59e0b;" title="Datos posiblemente desactualizados: ${esc(verificationIssues.join(', '))}">&#9888; Posiblemente desactualizado</span>`;
  }

  // Google Maps embed — uses coordinates if available, falls back to address search
  const mapsEmbedSrc = (place.lat && place.lon)
    ? `https://maps.google.com/maps?q=${place.lat},${place.lon}&z=16&output=embed`
    : `https://maps.google.com/maps?q=${encodeURIComponent((place.address || place.name) + ', Cabo Rojo, PR')}&z=15&output=embed`;

  // JSON-LD — Pharmacy type (more specific than LocalBusiness)
  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'Pharmacy',
    name: place.name,
    description: place.description || undefined,
    image: place.image_url || undefined,
    telephone: displayPhone || undefined,
    url: place.website || pageUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: place.address || undefined,
      addressLocality: 'Cabo Rojo',
      addressRegion: 'Puerto Rico',
      addressCountry: 'PR',
    },
    geo: (place.lat && place.lon) ? {
      '@type': 'GeoCoordinates',
      latitude: place.lat,
      longitude: place.lon,
    } : undefined,
    openingHours: ldHours.length > 0 ? ldHours : undefined,
    aggregateRating: place.google_rating ? {
      '@type': 'AggregateRating',
      ratingValue: place.google_rating,
      bestRating: 5,
      worstRating: 1,
      ratingCount: 1,
    } : undefined,
    hasMap: place.gmaps_url || undefined,
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
    .hero-img { width: 100%; height: 220px; object-fit: cover; display: block; }
    .hero-img-placeholder { width: 100%; height: 220px; background: linear-gradient(135deg, ${MEDICAL_GREEN} 0%, ${MEDICAL_DARK} 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 3.5rem; }
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
    @media (max-width: 480px) { h1 { font-size: 1.4rem; } .hero-img, .hero-img-placeholder { height: 160px; } .map-embed { height: 180px; } }
  </style>
</head>
<body>
  <div class="container">
    <a class="back" href="${baseUrl}/categoria/farmacia">← Farmacias en Cabo Rojo</a>

    <div class="hero">
      ${place.image_url
        ? `<img class="hero-img" src="${esc(place.image_url)}" alt="${placeName}" loading="lazy">`
        : `<div class="hero-img-placeholder">💊</div>`}
      <div class="hero-body">
        <div>
          <span class="badge">Farmacia</span>
          <span class="badge ${isOpen ? 'badge-open' : 'badge-closed'}">${isOpen ? 'Abierta' : 'Cerrada'}</span>
          ${npi ? `<span class="badge badge-npi" title="Número NPI: ${esc(npi)}">&#10003; NPPES</span>` : ''}
          ${qualityBadge}
        </div>
        <h1>${placeName}</h1>
        ${place.google_rating ? `<div class="rating">&#11088; ${place.google_rating}/5</div>` : ''}
        ${place.description ? `<p class="description">${esc(place.description)}</p>` : ''}
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
      <p>&#128140; ¿Tienes preguntas sobre ${placeName}? Textea a El Veci.</p>
      <a href="sms:+17874177711?body=${smsBody}">Textea ${placeName} al 787-417-7711</a>
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
      <h2>¿Es tu farmacia?</h2>
      <p>Verifica tu información, actualiza horarios y aparece primero en búsquedas de salud.</p>
      <a class="reclaim-btn" href="sms:+17874177711?body=RECLAMAR%20${encodeURIComponent(place.name)}">Reclamar este perfil</a>
      <br><br>
      <a href="${baseUrl}/?page=contact" style="color:rgba(255,255,255,0.85);font-size:0.875rem;text-decoration:underline;">¿Quieres aparecer primero? Conoce La Vitrina &rarr;</a>
    </div>

    <div style="text-align:center;margin-bottom:1.5rem;">
      <a href="${baseUrl}/?place=${esc(place.slug || place.id)}" style="color:${MEDICAL_GREEN};text-decoration:none;font-size:0.9rem;">Ver ${placeName} en el mapa interactivo &rarr;</a>
    </div>

    <footer>
      <p>Hecho con orgullo en Cabo Rojo, Puerto Rico</p>
      <p style="margin-top:4px;"><a href="${baseUrl}">MapaDeCaboRojo.com</a> &middot; Un proyecto de <a href="https://angelanderson.com">Angel Anderson</a></p>
      <p style="margin-top:0.5rem;"><a href="sms:+17874177711?body=ERROR%20${encodeURIComponent(place.name)}%3A%20" style="color:#94a3b8;font-size:0.75rem;text-decoration:none;">Reportar error en esta página</a></p>
    </footer>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  return res.status(200).send(html);
}
