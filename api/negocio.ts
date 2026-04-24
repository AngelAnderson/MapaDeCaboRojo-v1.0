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

function formatHours(opening_hours: any): string {
  if (!opening_hours) return 'No disponible';
  if (opening_hours.note) return esc(opening_hours.note);
  if (opening_hours.type === 'always_open') return 'Abierto 24 horas';
  if (opening_hours.structured) {
    const days: string[] = [];
    const structured = opening_hours.structured;
    for (const [day, hours] of Object.entries(structured)) {
      if (hours && typeof hours === 'object' && (hours as any).open) {
        days.push(`${day}: ${(hours as any).open} – ${(hours as any).close}`);
      }
    }
    return days.length > 0 ? days.join(', ') : 'No disponible';
  }
  return 'No disponible';
}

function formatAmenity(amenities: any, key: string): string {
  if (!amenities || typeof amenities !== 'object') return 'No especificado';
  const val = amenities[key];
  if (val === true || val === 'yes' || val === 'Sí' || val === 'si') return 'Sí';
  if (val === false || val === 'no' || val === 'No') return 'No';
  if (typeof val === 'string') return esc(val);
  return 'No especificado';
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

  // Try by slug first
  const { data: bySlug } = await supabase
    .from('places')
    .select('*')
    .eq('slug', slug)
    .single();

  if (bySlug) {
    place = bySlug;
  } else {
    // Try by id
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
<head><meta charset="UTF-8"><title>Negocio no encontrado | MapaDeCaboRojo.com</title></head>
<body><h1>404 – Negocio no encontrado</h1><p><a href="https://mapadecaborojo.com">Ver todos los negocios</a></p></body>
</html>`);
    return;
  }

  // Redirect HEALTH businesses to their enriched route (schema Dentist, Pharmacy, etc.)
  const HEALTH_ROUTES: Record<string, string> = {
    farmacia: 'farmacia', dentista: 'dentista', veterinario: 'veterinario',
    medico: 'medico', hospital: 'hospital', laboratorio: 'laboratorio',
    optica: 'optica', 'salud-mental': 'salud-mental', quiropractico: 'quiropractico',
    gimnasio: 'gimnasio',
  };
  const sub = (place.subcategory || '').toLowerCase();
  const cat = (place.category || '').toUpperCase();
  if (cat === 'HEALTH' && HEALTH_ROUTES[sub]) {
    const healthSlug = place.slug || place.id;
    res.writeHead(301, { Location: `https://mapadecaborojo.com/${HEALTH_ROUTES[sub]}/${healthSlug}` });
    return res.end();
  }

  const baseUrl = 'https://mapadecaborojo.com';
  const pageUrl = `${baseUrl}/negocio/${esc(place.slug || place.id)}`;
  const title = `${esc(place.name)} | Cabo Rojo, Puerto Rico`;
  const description = place.description
    ? esc(place.description).slice(0, 160)
    : `Descubre ${esc(place.name)} en Cabo Rojo, Puerto Rico. Horarios, dirección, teléfono y más.`;
  const image = place.image_url || 'https://mapadecaborojo.com/og-default.png';
  const hoursText = formatHours(place.opening_hours);
  const isOpen = place.status === 'open';
  const parking = formatAmenity(place.amenities, 'parking');
  const petFriendly = formatAmenity(place.amenities, 'pet_friendly');
  const wifi = formatAmenity(place.amenities, 'wifi');
  const smsBody = encodeURIComponent(place.name);
  const ldHours = jsonLdOpeningHours(place.opening_hours);

  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: place.name,
    description: place.description || undefined,
    image: place.image_url || undefined,
    telephone: place.phone || undefined,
    url: place.website || pageUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: place.address || undefined,
      addressLocality: 'Cabo Rojo',
      addressRegion: 'Puerto Rico',
      addressCountry: 'PR',
    },
    geo: place.lat && place.lon ? {
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
  };

  // Remove undefined keys
  const cleanJsonLd = JSON.parse(JSON.stringify(jsonLd));

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${pageUrl}">

  <!-- Open Graph -->
  <meta property="og:type" content="business.business">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:site_name" content="MapaDeCaboRojo.com">
  <meta property="og:locale" content="es_PR">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${esc(image)}">

  <!-- JSON-LD -->
  <script type="application/ld+json">${JSON.stringify(cleanJsonLd)}</script>

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.6; }
    .container { max-width: 720px; margin: 0 auto; padding: 1rem; }
    .back { display: inline-block; margin-bottom: 1rem; color: #0d9488; text-decoration: none; font-size: 0.9rem; }
    .back:hover { text-decoration: underline; }
    .hero { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 1.5rem; }
    .hero-img { width: 100%; height: 220px; object-fit: cover; background: linear-gradient(135deg, #0d9488 0%, #f97316 100%); display: block; }
    .hero-img-placeholder { width: 100%; height: 220px; background: linear-gradient(135deg, #0d9488 0%, #f97316 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 3rem; }
    .hero-body { padding: 1.5rem; }
    .badge { display: inline-block; background: #0d9488; color: white; font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem; }
    .status-open { background: #10b981; }
    .status-closed { background: #ef4444; }
    h1 { font-size: 1.75rem; font-weight: 700; color: #0f172a; margin-bottom: 0.5rem; }
    .rating { color: #f59e0b; font-size: 1rem; margin-bottom: 0.75rem; }
    .description { color: #475569; font-size: 0.95rem; }
    .info-card { background: white; border-radius: 12px; padding: 1.25rem 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 1rem; }
    .info-card h2 { font-size: 1rem; font-weight: 600; color: #0d9488; margin-bottom: 0.75rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; }
    .info-row { display: flex; gap: 0.5rem; padding: 0.4rem 0; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748b; min-width: 110px; font-weight: 500; }
    .info-value { color: #1e293b; }
    .info-value a { color: #0d9488; text-decoration: none; }
    .info-value a:hover { text-decoration: underline; }
    .cta { background: linear-gradient(135deg, #0d9488, #0f766e); border-radius: 12px; padding: 1.5rem; text-align: center; margin-bottom: 1rem; }
    .cta p { color: rgba(255,255,255,0.85); margin-bottom: 0.75rem; font-size: 0.95rem; }
    .cta a { display: inline-block; background: #f97316; color: white; text-decoration: none; padding: 0.75rem 1.75rem; border-radius: 8px; font-weight: 600; font-size: 1rem; }
    .cta a:hover { background: #ea6c10; }
    .faq { background: white; border-radius: 12px; padding: 1.25rem 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 1rem; }
    .faq h2 { font-size: 1rem; font-weight: 600; color: #0d9488; margin-bottom: 0.75rem; }
    .faq-item { margin-bottom: 1rem; }
    .faq-item h3 { font-size: 0.9rem; font-weight: 600; color: #0f172a; margin-bottom: 0.25rem; }
    .faq-item p { font-size: 0.875rem; color: #475569; }
    .map-link { text-align: center; padding: 0.75rem; }
    .map-link a { color: #0d9488; text-decoration: none; font-size: 0.9rem; }
    .map-link a:hover { text-decoration: underline; }
    footer { text-align: center; padding: 1.5rem 0; color: #94a3b8; font-size: 0.8rem; }
    @media (max-width: 480px) { h1 { font-size: 1.4rem; } .hero-img, .hero-img-placeholder { height: 160px; } }
  </style>
</head>
<body>
  <div class="container">
    <a class="back" href="${baseUrl}">← Volver al mapa</a>

    <div class="hero">
      ${place.image_url
        ? `<img class="hero-img" src="${esc(place.image_url)}" alt="${esc(place.name)}" loading="lazy">`
        : `<div class="hero-img-placeholder">📍</div>`}
      <div class="hero-body">
        <div>
          <span class="badge">${esc(place.category || 'Negocio')}</span>
          <span class="badge ${isOpen ? 'status-open' : 'status-closed'}">${isOpen ? 'Abierto' : 'Cerrado'}</span>
        </div>
        <h1>${esc(place.name)}</h1>
        ${place.google_rating ? `<div class="rating">⭐ ${place.google_rating}/5</div>` : ''}
        ${place.description ? `<p class="description">${esc(place.description)}</p>` : ''}
      </div>
    </div>

    <div class="info-card">
      <h2>Información</h2>
      ${place.address ? `<div class="info-row"><span class="info-label">📍 Dirección</span><span class="info-value">${esc(place.address)}</span></div>` : ''}
      ${place.phone ? `<div class="info-row"><span class="info-label">📞 Teléfono</span><span class="info-value"><a href="tel:${esc(place.phone)}">${esc(place.phone)}</a></span></div>` : ''}
      <div class="info-row"><span class="info-label">🕐 Horario</span><span class="info-value">${hoursText}</span></div>
      ${place.website ? `<div class="info-row"><span class="info-label">🌐 Web</span><span class="info-value"><a href="${esc(place.website)}" target="_blank" rel="noopener">${esc(place.website)}</a></span></div>` : ''}
      ${place.gmaps_url ? `<div class="info-row"><span class="info-label">🗺️ Google Maps</span><span class="info-value"><a href="${esc(place.gmaps_url)}" target="_blank" rel="noopener">Ver en Maps</a></span></div>` : ''}
    </div>

    ${(parking !== 'No especificado' || petFriendly !== 'No especificado' || wifi !== 'No especificado') ? `<div class="info-card">
      <h2>Amenidades</h2>
      ${parking !== 'No especificado' ? `<div class="info-row"><span class="info-label">🅿️ Estacionamiento</span><span class="info-value">${parking}</span></div>` : ''}
      ${petFriendly !== 'No especificado' ? `<div class="info-row"><span class="info-label">🐾 Pet-friendly</span><span class="info-value">${petFriendly}</span></div>` : ''}
      ${wifi !== 'No especificado' ? `<div class="info-row"><span class="info-label">📶 WiFi</span><span class="info-value">${wifi}</span></div>` : ''}
    </div>` : ''}

    <div class="cta">
      <p>¿Tienes preguntas sobre ${esc(place.name)}? Textea a El Veci y te ayudamos.</p>
      <a href="https://wa.me/17874177711?text=${smsBody}">Textea ${esc(place.name)} al 787-417-7711</a>
    </div>

    <div class="faq">
      <h2>Preguntas frecuentes</h2>
      <div class="faq-item">
        <h3>¿Dónde queda ${esc(place.name)}?</h3>
        <p>${place.address ? `${esc(place.name)} está ubicado en ${esc(place.address)}, Cabo Rojo, Puerto Rico.` : `${esc(place.name)} está ubicado en Cabo Rojo, Puerto Rico.`}${place.gmaps_url ? ` <a href="${esc(place.gmaps_url)}" target="_blank" rel="noopener">Ver en Google Maps</a>.` : ''}</p>
      </div>
      <div class="faq-item">
        <h3>¿Está abierto ${esc(place.name)} hoy?</h3>
        <p>${isOpen ? `${esc(place.name)} aparece como abierto. Horario: ${hoursText}. Verifica directamente antes de visitar.` : `${esc(place.name)} aparece como cerrado actualmente. Comunícate al ${place.phone || '787-417-7711'} para confirmar.`}</p>
      </div>
      <div class="faq-item">
        <h3>¿Tiene estacionamiento ${esc(place.name)}?</h3>
        <p>Estacionamiento: ${parking}. Para más detalles, textea <strong>${esc(place.name)}</strong> al 787-417-7711.</p>
      </div>
    </div>

    <div class="map-link">
      <a href="${baseUrl}/?place=${esc(place.slug || place.id)}">Ver ${esc(place.name)} en el mapa interactivo →</a>
    </div>

    <div style="background: linear-gradient(135deg, #0d9488 0%, #f97316 100%); border-radius: 12px; padding: 1.75rem 1.5rem; text-align: center; margin-bottom: 1rem;">
      <h2 style="color: white; font-size: 1.4rem; font-weight: 700; margin-bottom: 0.5rem;">¿Es tu negocio?</h2>
      <p style="color: rgba(255,255,255,0.9); font-size: 0.95rem; margin-bottom: 1.25rem;">Verifica tu información, actualiza horarios, y aparece primero cuando busquen tu categoría.</p>
      <a href="https://wa.me/17874177711?text=RECLAMAR%20${encodeURIComponent(place.name)}" style="display: inline-block; background: white; color: #0d9488; text-decoration: none; padding: 0.75rem 1.75rem; border-radius: 8px; font-weight: 700; font-size: 1rem; margin-bottom: 1rem;">Verificar mi información</a>
      <br>
      <a href="https://wa.me/17874177711?text=VITRINA%20${encodeURIComponent(place.name)}" style="color: rgba(255,255,255,0.9); font-size: 0.875rem; text-decoration: underline;">Destaca tu negocio con La Vitrina — $799/año →</a>
      <p style="color: rgba(255,255,255,0.75); font-size: 0.8rem; margin-top: 0.75rem; margin-bottom: 0;">Textea al 787-417-7711 y El Veci te guía paso a paso.</p>
    </div>

    <footer style="margin-top: 48px; padding: 24px 0; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
        Hecho con orgullo en Cabo Rojo, Puerto Rico
      </p>
      <p style="color: #94a3b8; font-size: 11px; margin: 4px 0 0 0;">
        <a href="https://mapadecaborojo.com" style="color: #0d9488; text-decoration: none;">MapaDeCaboRojo.com</a>
        · Un proyecto de <a href="https://angelanderson.com" style="color: #0d9488; text-decoration: none;">Angel Anderson</a>
      </p>
      <p style="margin-top: 0.5rem;"><a href="https://wa.me/17874177711?text=ERROR%20${encodeURIComponent(place.name)}%3A%20" style="color:#94a3b8; font-size:0.75rem; text-decoration:none;">Reportar error en esta página</a></p>
    </footer>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  logApiCall('negocio', null, slug, req.headers['user-agent'] as string, req.headers['x-forwarded-for'] as string, 1);
  return res.status(200).send(html);
}
