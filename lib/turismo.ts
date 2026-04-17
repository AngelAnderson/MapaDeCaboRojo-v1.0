import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export default async function handler(req: any, res: any) {
  const supa = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Pull last 7 days of demand signals for live stats
  const since7d = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: rows } = await supa
    .from('demand_signals')
    .select('query_text, query_normalized, category, had_results, results_count')
    .gte('created_at', since7d);

  const allRows = rows || [];
  const totalSearches = allRows.length;

  // Top 5 terms
  const termCount: Record<string, number> = {};
  for (const r of allRows) {
    const t = (r.query_normalized || r.query_text || '').toLowerCase().trim();
    if (t) termCount[t] = (termCount[t] || 0) + 1;
  }
  const topTerms = Object.entries(termCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([term, count]) => ({ term, count }));

  // Top categories
  const catCount: Record<string, number> = {};
  for (const r of allRows) {
    const c = r.category || 'OTHER';
    catCount[c] = (catCount[c] || 0) + 1;
  }
  const topCats = Object.entries(catCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([cat, count]) => ({ cat, count }));

  // Gaps
  const gapCount: Record<string, number> = {};
  for (const r of allRows) {
    if (r.had_results === false || r.results_count === 0) {
      const t = (r.query_normalized || r.query_text || '').toLowerCase().trim();
      if (t && t.length > 2) gapCount[t] = (gapCount[t] || 0) + 1;
    }
  }
  const topGaps = Object.entries(gapCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([term]) => term);

  const baseUrl = 'https://mapadecaborojo.com';
  const pageTitle = 'Tourism Intelligence API — Cabo Rojo | MapaDeCaboRojo.com';
  const desc = 'Sabe qué buscan los turistas en Cabo Rojo en tiempo real. Datos de demanda local para hoteles, restaurantes, tours y negocios.';

  const topTermsHTML = topTerms.length > 0
    ? topTerms.map(({ term, count }) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-transform:capitalize;font-weight:500;">${term}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:#0d9488;font-weight:700;">${count}</td></tr>`
      ).join('')
    : `<tr><td colspan="2" style="padding:16px;color:#94a3b8;text-align:center;">Cargando datos...</td></tr>`;

  const topCatsHTML = topCats.length > 0
    ? topCats.map(({ cat, count }) => {
        const pct = totalSearches > 0 ? Math.round((count / totalSearches) * 100) : 0;
        return `<div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;font-size:0.875rem;margin-bottom:4px;">
            <span style="font-weight:500;color:#1e293b;">${cat}</span>
            <span style="color:#64748b;">${count} búsquedas (${pct}%)</span>
          </div>
          <div style="background:#e2e8f0;border-radius:4px;height:8px;overflow:hidden;">
            <div style="background:linear-gradient(90deg,#0d9488,#f97316);height:100%;width:${pct}%;border-radius:4px;"></div>
          </div>
        </div>`;
      }).join('')
    : `<p style="color:#94a3b8;">Datos próximamente</p>`;

  const gapsHTML = topGaps.length > 0
    ? topGaps.map(g => `<span style="display:inline-block;background:#fef3c7;color:#92400e;padding:4px 10px;border-radius:999px;font-size:0.8rem;margin:3px;border:1px solid #fde68a;">${g}</span>`).join('')
    : `<span style="color:#94a3b8;font-size:0.875rem;">No hay gaps detectados en este período</span>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${baseUrl}/turismo">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${pageTitle}">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="${baseUrl}/og-default.png">
  <meta property="og:url" content="${baseUrl}/turismo">
  <meta property="og:site_name" content="MapaDeCaboRojo.com">
  <meta property="og:locale" content="es_PR">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${pageTitle}">
  <meta name="twitter:description" content="${desc}">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Tourism Intelligence API — Cabo Rojo",
    "description": desc,
    "url": `${baseUrl}/turismo`,
    "provider": {
      "@type": "Organization",
      "name": "MapaDeCaboRojo.com",
      "url": baseUrl
    }
  })}</script>
</head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b;line-height:1.6;">

  <!-- HERO -->
  <div style="background:linear-gradient(135deg,#0d9488 0%,#0f766e 50%,#134e4a 100%);color:white;padding:64px 24px;text-align:center;">
    <div style="max-width:760px;margin:0 auto;">
      <div style="font-size:3rem;margin-bottom:16px;">📊</div>
      <h1 style="font-size:2.4rem;font-weight:800;margin:0 0 16px;line-height:1.2;">Tourism Intelligence API<br><span style="color:#5eead4;">Cabo Rojo</span></h1>
      <p style="font-size:1.2rem;color:rgba(255,255,255,0.85);margin:0 0 32px;max-width:560px;margin-left:auto;margin-right:auto;">Sabe qué buscan los turistas en Cabo Rojo — en tiempo real. Datos reales del bot El Veci, sin encuestas, sin suposiciones.</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        <a href="sms:7874177711?body=TURISMO" style="background:#f97316;color:white;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:1rem;">Comienza gratis →</a>
        <a href="#pricing" style="background:rgba(255,255,255,0.15);color:white;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:1rem;border:1px solid rgba(255,255,255,0.3);">Ver precios</a>
      </div>
    </div>
  </div>

  <!-- LIVE STATS BAR -->
  <div style="background:#0f172a;color:white;padding:20px 24px;">
    <div style="max-width:900px;margin:0 auto;display:flex;gap:32px;justify-content:center;flex-wrap:wrap;text-align:center;">
      <div>
        <div style="font-size:2rem;font-weight:800;color:#5eead4;">${totalSearches.toLocaleString()}</div>
        <div style="font-size:0.8rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Búsquedas últimos 7 días</div>
      </div>
      <div>
        <div style="font-size:2rem;font-weight:800;color:#fdba74;">${topTerms[0]?.term || '—'}</div>
        <div style="font-size:0.8rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Término #1 esta semana</div>
      </div>
      <div>
        <div style="font-size:2rem;font-weight:800;color:#86efac;">${topGaps.length > 0 ? topGaps[0] : '—'}</div>
        <div style="font-size:0.8rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Mayor gap de mercado</div>
      </div>
    </div>
  </div>

  <div style="max-width:900px;margin:0 auto;padding:48px 24px;">

    <!-- WHY SECTION -->
    <h2 style="font-size:1.75rem;font-weight:700;text-align:center;margin-bottom:12px;">¿Para qué sirve esto?</h2>
    <p style="text-align:center;color:#64748b;margin-bottom:40px;max-width:600px;margin-left:auto;margin-right:auto;">Miles de personas textean "playa", "pizza", "tour" al bot de Cabo Rojo todos los días. Esos datos son oro para planificar tu negocio o destino.</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:48px;">
      <tr>
        <td style="width:33%;padding:24px;vertical-align:top;background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin:8px;">
          <div style="font-size:2rem;margin-bottom:12px;">🏨</div>
          <h3 style="font-size:1rem;font-weight:700;margin:0 0 8px;">Hoteles & Hospedaje</h3>
          <p style="font-size:0.875rem;color:#64748b;margin:0;">Sé qué buscan tus huéspedes antes de llegar. Ajusta amenidades y paquetes según demanda real.</p>
        </td>
        <td style="width:33%;padding:24px;vertical-align:top;background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin:8px;">
          <div style="font-size:2rem;margin-bottom:12px;">🍽️</div>
          <h3 style="font-size:1rem;font-weight:700;margin:0 0 8px;">Restaurantes & Food</h3>
          <p style="font-size:0.875rem;color:#64748b;margin:0;">Descubre qué categorías de comida tienen más demanda y cuáles son brechas sin cubrir en el pueblo.</p>
        </td>
        <td style="width:33%;padding:24px;vertical-align:top;background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin:8px;">
          <div style="font-size:2rem;margin-bottom:12px;">🏛️</div>
          <h3 style="font-size:1rem;font-weight:700;margin:0 0 8px;">Municipio & PRPB</h3>
          <p style="font-size:0.875rem;color:#64748b;margin:0;">Datos de demanda turística para informar inversiones en infraestructura, eventos y desarrollo económico.</p>
        </td>
      </tr>
    </table>

    <!-- LIVE DATA SECTION -->
    <h2 style="font-size:1.5rem;font-weight:700;margin-bottom:24px;">📈 Datos en vivo — últimos 7 días</h2>

    <table style="width:100%;border-collapse:collapse;margin-bottom:40px;">
      <tr style="vertical-align:top;">
        <td style="width:50%;padding-right:16px;">
          <div style="background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);overflow:hidden;">
            <div style="padding:16px 16px 12px;border-bottom:1px solid #e2e8f0;">
              <h3 style="font-size:0.95rem;font-weight:700;margin:0;color:#0d9488;">Top búsquedas</h3>
            </div>
            <table style="width:100%;border-collapse:collapse;">
              ${topTermsHTML}
            </table>
          </div>
        </td>
        <td style="width:50%;padding-left:16px;">
          <div style="background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);padding:16px;">
            <h3 style="font-size:0.95rem;font-weight:700;margin:0 0 16px;color:#0d9488;">Por categoría</h3>
            ${topCatsHTML}
          </div>
        </td>
      </tr>
    </table>

    <!-- GAPS SECTION -->
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:24px;margin-bottom:48px;">
      <h3 style="font-size:1rem;font-weight:700;margin:0 0 8px;color:#92400e;">⚠️ Gaps de mercado detectados</h3>
      <p style="font-size:0.875rem;color:#78350f;margin:0 0 16px;">Búsquedas frecuentes que el bot no pudo satisfacer — oportunidades de negocio sin cubrir:</p>
      <div>${gapsHTML}</div>
    </div>

    <!-- API REFERENCE -->
    <h2 style="font-size:1.5rem;font-weight:700;margin-bottom:16px;">🔌 API Reference</h2>
    <div style="background:#0f172a;border-radius:12px;padding:24px;margin-bottom:48px;overflow:auto;">
      <pre style="color:#e2e8f0;font-size:0.85rem;margin:0;white-space:pre-wrap;"><code>GET https://mapadecaborojo.com/api/intelligence

Parámetros:
  ?key=TU_API_KEY        (requerido)
  ?period=7d             (7d | 30d | 90d)
  ?format=json           (json | csv)

Ejemplo de respuesta:
{
  "period": "7d",
  "generated_at": "2026-04-17T...",
  "total_searches": 1234,
  "unique_users": 456,
  "top_terms": [
    {"term": "pizza", "count": 89, "trend": "+23%"}
  ],
  "categories_demand": [
    {"category": "FOOD", "searches": 340}
  ],
  "hourly_distribution": [
    {"hour": 0, "count": 5}, ...
  ],
  "gaps": ["sushi", "yoga", "coworking"]
}</code></pre>
    </div>

    <!-- PRICING -->
    <h2 id="pricing" style="font-size:1.5rem;font-weight:700;text-align:center;margin-bottom:32px;">Planes</h2>

    <table style="width:100%;border-collapse:collapse;margin-bottom:48px;">
      <tr style="vertical-align:top;">
        <td style="width:33%;padding:8px;">
          <div style="background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);padding:28px 24px;text-align:center;height:100%;">
            <div style="font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Free</div>
            <div style="font-size:2.5rem;font-weight:800;color:#0f172a;margin-bottom:4px;">$0</div>
            <div style="font-size:0.875rem;color:#64748b;margin-bottom:24px;">Para siempre</div>
            <ul style="list-style:none;padding:0;margin:0 0 24px;text-align:left;font-size:0.875rem;color:#475569;">
              <li style="padding:6px 0;border-bottom:1px solid #f1f5f9;">✅ 100 llamadas/día</li>
              <li style="padding:6px 0;border-bottom:1px solid #f1f5f9;">✅ Período: 7 días</li>
              <li style="padding:6px 0;border-bottom:1px solid #f1f5f9;">✅ JSON + CSV</li>
              <li style="padding:6px 0;">✅ Top 20 términos</li>
            </ul>
            <a href="sms:7874177711?body=TURISMO" style="display:block;background:#0d9488;color:white;text-decoration:none;padding:12px;border-radius:8px;font-weight:600;font-size:0.9rem;">Comienza gratis</a>
          </div>
        </td>
        <td style="width:33%;padding:8px;">
          <div style="background:linear-gradient(135deg,#0d9488,#0f766e);border-radius:12px;box-shadow:0 4px 20px rgba(13,148,136,0.3);padding:28px 24px;text-align:center;height:100%;position:relative;">
            <div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#f97316;color:white;font-size:0.7rem;font-weight:700;padding:4px 12px;border-radius:999px;text-transform:uppercase;letter-spacing:0.08em;">Popular</div>
            <div style="font-size:0.75rem;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Pro</div>
            <div style="font-size:2.5rem;font-weight:800;color:white;margin-bottom:4px;">$99</div>
            <div style="font-size:0.875rem;color:rgba(255,255,255,0.7);margin-bottom:24px;">por mes</div>
            <ul style="list-style:none;padding:0;margin:0 0 24px;text-align:left;font-size:0.875rem;color:rgba(255,255,255,0.9);">
              <li style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.15);">✅ Llamadas ilimitadas</li>
              <li style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.15);">✅ Períodos: 7d / 30d / 90d</li>
              <li style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.15);">✅ Distribución por hora</li>
              <li style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.15);">✅ Gaps de mercado</li>
              <li style="padding:6px 0;">✅ Soporte prioritario</li>
            </ul>
            <a href="sms:7874177711?body=TURISMO PRO" style="display:block;background:white;color:#0d9488;text-decoration:none;padding:12px;border-radius:8px;font-weight:700;font-size:0.9rem;">Textea TURISMO PRO</a>
          </div>
        </td>
        <td style="width:33%;padding:8px;">
          <div style="background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);padding:28px 24px;text-align:center;height:100%;">
            <div style="font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Enterprise</div>
            <div style="font-size:2.5rem;font-weight:800;color:#0f172a;margin-bottom:4px;">$499</div>
            <div style="font-size:0.875rem;color:#64748b;margin-bottom:24px;">por mes</div>
            <ul style="list-style:none;padding:0;margin:0 0 24px;text-align:left;font-size:0.875rem;color:#475569;">
              <li style="padding:6px 0;border-bottom:1px solid #f1f5f9;">✅ Todo en Pro</li>
              <li style="padding:6px 0;border-bottom:1px solid #f1f5f9;">✅ Datos crudos (raw export)</li>
              <li style="padding:6px 0;border-bottom:1px solid #f1f5f9;">✅ Consultoría mensual</li>
              <li style="padding:6px 0;border-bottom:1px solid #f1f5f9;">✅ Dashboard privado</li>
              <li style="padding:6px 0;">✅ SLA + factura</li>
            </ul>
            <a href="sms:7874177711?body=TURISMO ENTERPRISE" style="display:block;background:#0f172a;color:white;text-decoration:none;padding:12px;border-radius:8px;font-weight:600;font-size:0.9rem;">Contactar</a>
          </div>
        </td>
      </tr>
    </table>

    <!-- CTA FINAL -->
    <div style="background:linear-gradient(135deg,#f97316,#ea580c);border-radius:12px;padding:40px 32px;text-align:center;margin-bottom:48px;">
      <h2 style="color:white;font-size:1.5rem;font-weight:700;margin:0 0 12px;">¿Listo para saber qué buscan los turistas?</h2>
      <p style="color:rgba(255,255,255,0.85);margin:0 0 24px;font-size:1rem;">Textea TURISMO al 787-417-7711 y tu API key llega en minutos.</p>
      <a href="sms:7874177711?body=TURISMO" style="background:white;color:#ea580c;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:1rem;display:inline-block;">Textea TURISMO al 787-417-7711</a>
    </div>

    <footer style="border-top:1px solid #e2e8f0;padding:24px 0;text-align:center;">
      <p style="color:#94a3b8;font-size:0.8rem;margin:0;">Powered by <a href="${baseUrl}" style="color:#0d9488;text-decoration:none;">MapaDeCaboRojo.com</a> · Un proyecto de <a href="https://angelanderson.com" style="color:#0d9488;text-decoration:none;">Angel Anderson</a></p>
      <p style="color:#94a3b8;font-size:0.75rem;margin:4px 0 0;">Datos basados en búsquedas reales del bot El Veci (*7711) en Cabo Rojo, Puerto Rico.</p>
    </footer>
  </div>

</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.status(200).send(html);
}
