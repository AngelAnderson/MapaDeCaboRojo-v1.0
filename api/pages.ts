import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

// ============ municipio ============

function esc(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-PR', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function handle_municipio(req: any, res: any) {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString();
    const monthStart    = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [
      censusResult,
      topSearchesResult,
      dailyActivityResult,
      gapsResult,
      eventsResult,
      healthCountResult,
      categoryBreakdownResult,
    ] = await Promise.all([
      // 1. Business census
      supabase.from('places').select('status, created_at').then(({ data }) => {
        const rows = data || [];
        return {
          total: rows.length,
          open: rows.filter(r => r.status === 'open').length,
          closed: rows.filter(r => r.status === 'closed').length,
          newThisMonth: rows.filter(r => r.created_at >= monthStart).length,
        };
      }),

      // 2. Top 15 search terms — 30 days
      supabase
        .from('demand_signals')
        .select('query_text')
        .gte('created_at', thirtyDaysAgo)
        .not('query_text', 'is', null)
        .then(({ data }) => {
          const counts: Record<string, number> = {};
          for (const row of data || []) {
            const q = (row.query_text || '').trim();
            if (q.length < 3 || q.length > 80) continue;
            counts[q] = (counts[q] || 0) + 1;
          }
          return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([query_text, cnt]) => ({ query_text, cnt }));
        }),

      // 3. Daily activity — 7 days
      supabase
        .from('demand_signals')
        .select('created_at')
        .gte('created_at', sevenDaysAgo)
        .then(({ data }) => {
          const days: Record<string, number> = {};
          for (let i = 6; i >= 0; i--) {
            const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            days[d.toISOString().slice(0, 10)] = 0;
          }
          for (const row of data || []) {
            const day = row.created_at.slice(0, 10);
            if (day in days) days[day]++;
          }
          return Object.entries(days).map(([day, count]) => ({ day, count }));
        }),

      // 4. Gaps — queries with no results, 30 days
      supabase
        .from('demand_signals')
        .select('query_text, had_results')
        .gte('created_at', thirtyDaysAgo)
        .eq('had_results', false)
        .not('query_text', 'is', null)
        .then(({ data }) => {
          const counts: Record<string, number> = {};
          for (const row of data || []) {
            const q = (row.query_text || '').trim();
            if (q.length < 3 || q.length > 80) continue;
            counts[q] = (counts[q] || 0) + 1;
          }
          return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([query_text, cnt]) => ({ query_text, cnt }));
        }),

      // 5. Upcoming events
      supabase
        .from('events')
        .select('title, start_time, location_name')
        .eq('status', 'active')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(5)
        .then(({ data }) => data || []),

      // 6. Health/pharmacy count
      supabase
        .from('places')
        .select('id')
        .eq('status', 'open')
        .in('category', ['HEALTH', 'Salud', 'salud'])
        .then(({ count, data }) => (data || []).length),

      // 7. Category breakdown (top 8)
      supabase.from('places').select('category, status').eq('status', 'open').then(({ data }) => {
        const counts: Record<string, number> = {};
        for (const row of data || []) {
          const cat = row.category || 'Otro';
          counts[cat] = (counts[cat] || 0) + 1;
        }
        return Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([category, count]) => ({ category, count }));
      }),
    ]);

    const totalSearches30d = topSearchesResult.reduce((s, r) => s + r.cnt, 0);
    const maxSearchCount = topSearchesResult[0]?.cnt || 1;
    const maxDayCount = Math.max(...dailyActivityResult.map(d => d.count), 1);
    const maxGapCount = gapsResult[0]?.cnt || 1;

    const CATEGORY_LABELS: Record<string, string> = {
      HEALTH: 'Salud', FOOD: 'Comida', SERVICE: 'Servicios', SHOPPING: 'Compras',
      BEAUTY: 'Belleza', CULTURE: 'Cultura', AUTO: 'Automotriz', EDUCATION: 'Educación',
      LODGING: 'Hospedaje', ACTIVITY: 'Actividades', SIGHTS: 'Atracciones', LOGISTICS: 'Logística',
      Restaurantes: 'Restaurantes', Tiendas: 'Tiendas', Servicios: 'Servicios',
      Salud: 'Salud', Automotriz: 'Automotriz', Aventura: 'Aventura', Playa: 'Playas',
    };

    const generatedAt = new Date().toLocaleString('es-PR', { timeZone: 'America/Puerto_Rico' });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cabo Rojo OS — Panel Municipal</title>
<meta name="description" content="Panel de operaciones municipales de Cabo Rojo con datos en tiempo real: negocios, búsquedas ciudadanas, eventos y cobertura de servicios.">
<meta name="robots" content="noindex">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;color:#1e293b}a{color:inherit}</style>
</head>
<body style="background:#f1f5f9;">

<!-- HEADER -->
<div style="background:#1e293b;color:#fff;padding:24px 32px;">
  <div style="max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
    <div>
      <div style="font-size:13px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">🏛️ Sistema Operativo Municipal</div>
      <h1 style="font-size:28px;font-weight:700;letter-spacing:-0.5px;">Cabo Rojo OS</h1>
      <div style="font-size:14px;color:#64748b;margin-top:4px;">Panel Municipal — Datos en tiempo real</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:12px;color:#64748b;">Actualizado</div>
      <div style="font-size:14px;font-weight:600;color:#94a3b8;">${esc(generatedAt)}</div>
      <div style="margin-top:8px;">
        <a href="https://mapadecaborojo.com" style="background:#0d9488;color:#fff;padding:6px 14px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">Ver directorio →</a>
      </div>
    </div>
  </div>
</div>

<!-- STAT CARDS -->
<div style="max-width:1100px;margin:32px auto;padding:0 16px;">

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:32px;">

    ${[
      { label: 'Total Negocios', value: censusResult.total.toLocaleString('es-PR'), icon: '🏢', color: '#0d9488' },
      { label: 'Abiertos', value: censusResult.open.toLocaleString('es-PR'), icon: '✅', color: '#16a34a' },
      { label: 'Cerrados', value: censusResult.closed.toLocaleString('es-PR'), icon: '🔴', color: '#dc2626' },
      { label: 'Nuevos este mes', value: censusResult.newThisMonth.toLocaleString('es-PR'), icon: '🆕', color: '#7c3aed' },
      { label: 'Búsquedas (30d)', value: totalSearches30d.toLocaleString('es-PR'), icon: '🔍', color: '#0369a1' },
      { label: 'Eventos activos', value: eventsResult.length.toString(), icon: '📅', color: '#ea580c' },
    ].map(c => `
    <div style="background:#fff;border-radius:12px;padding:20px 16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-top:3px solid ${c.color};">
      <div style="font-size:24px;margin-bottom:8px;">${c.icon}</div>
      <div style="font-size:26px;font-weight:700;color:#1e293b;">${c.value}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px;font-weight:500;">${c.label}</div>
    </div>`).join('')}

  </div>

  <!-- ROW: Searches + Activity -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">

    <!-- DEMANDA CIUDADANA -->
    <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin-bottom:4px;">🔍 Demanda Ciudadana</h2>
      <p style="font-size:12px;color:#64748b;margin-bottom:20px;">Top búsquedas — últimos 30 días</p>
      <table style="width:100%;border-collapse:collapse;">
        ${topSearchesResult.map((row, i) => {
          const pct = Math.round((row.cnt / maxSearchCount) * 100);
          return `<tr>
            <td style="padding:6px 0;font-size:13px;color:#374151;width:50%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">${esc(row.query_text)}</td>
            <td style="padding:6px 0 6px 12px;width:50%;">
              <div style="background:#f1f5f9;border-radius:4px;height:16px;position:relative;">
                <div style="background:#0d9488;height:100%;border-radius:4px;width:${pct}%;"></div>
              </div>
            </td>
            <td style="padding:6px 0 6px 8px;font-size:12px;color:#64748b;font-weight:600;white-space:nowrap;">${row.cnt}</td>
          </tr>`;
        }).join('')}
      </table>
    </div>

    <!-- ACTIVIDAD ECONOMICA -->
    <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin-bottom:4px;">📈 Actividad Económica</h2>
      <p style="font-size:12px;color:#64748b;margin-bottom:20px;">Búsquedas por día — últimos 7 días</p>
      <div style="display:flex;align-items:flex-end;gap:8px;height:120px;padding-bottom:24px;position:relative;">
        ${dailyActivityResult.map(d => {
          const h = Math.max(Math.round((d.count / maxDayCount) * 100), 4);
          const dayLabel = new Date(d.day + 'T12:00:00').toLocaleDateString('es-PR', { weekday: 'short' });
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
            <div style="font-size:11px;color:#0d9488;font-weight:700;">${d.count > 0 ? d.count : ''}</div>
            <div style="background:#0d9488;width:100%;border-radius:4px 4px 0 0;height:${h}px;min-height:4px;"></div>
            <div style="font-size:10px;color:#94a3b8;white-space:nowrap;">${dayLabel}</div>
          </div>`;
        }).join('')}
      </div>
      <div style="border-top:1px solid #f1f5f9;padding-top:12px;margin-top:4px;">
        <div style="font-size:12px;color:#64748b;">Total 7 días: <strong style="color:#1e293b;">${dailyActivityResult.reduce((s,d)=>s+d.count,0).toLocaleString('es-PR')} búsquedas</strong></div>
      </div>
    </div>
  </div>

  <!-- ROW: Gaps + Events -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">

    <!-- BRECHAS DE SERVICIO -->
    <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-left:4px solid #dc2626;">
      <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin-bottom:4px;">⚠️ Brechas de Servicio</h2>
      <p style="font-size:12px;color:#64748b;margin-bottom:20px;">Búsquedas sin resultados — oportunidades de negocio</p>
      <table style="width:100%;border-collapse:collapse;">
        ${gapsResult.length === 0
          ? `<tr><td style="color:#64748b;font-size:13px;">Sin brechas detectadas este mes 🎉</td></tr>`
          : gapsResult.map(row => {
              const pct = Math.round((row.cnt / maxGapCount) * 100);
              return `<tr>
                <td style="padding:6px 0;font-size:13px;color:#374151;width:50%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;" title="${esc(row.query_text)}">${esc(row.query_text)}</td>
                <td style="padding:6px 0 6px 12px;width:50%;">
                  <div style="background:#fee2e2;border-radius:4px;height:16px;position:relative;">
                    <div style="background:#dc2626;height:100%;border-radius:4px;width:${pct}%;"></div>
                  </div>
                </td>
                <td style="padding:6px 0 6px 8px;font-size:12px;color:#dc2626;font-weight:600;">${row.cnt}</td>
              </tr>`;
            }).join('')}
      </table>
    </div>

    <!-- EVENTOS -->
    <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin-bottom:4px;">📅 Próximos Eventos</h2>
      <p style="font-size:12px;color:#64748b;margin-bottom:16px;">Eventos activos en el directorio</p>
      ${eventsResult.length === 0
        ? `<p style="color:#64748b;font-size:13px;">No hay eventos próximos registrados.</p>`
        : eventsResult.map(ev => `
          <div style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
            <div style="font-size:13px;font-weight:600;color:#1e293b;">${esc(ev.title)}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">📍 ${esc(ev.location_name || 'Cabo Rojo')} · ${formatDate(ev.start_time)}</div>
          </div>`).join('')}
    </div>
  </div>

  <!-- ROW: Health Coverage + Category Breakdown -->
  <div style="display:grid;grid-template-columns:1fr 2fr;gap:20px;margin-bottom:24px;">

    <!-- COBERTURA DE SALUD -->
    <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-left:4px solid #0369a1;">
      <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin-bottom:4px;">🏥 Cobertura de Salud</h2>
      <p style="font-size:12px;color:#64748b;margin-bottom:20px;">Establecimientos de salud en el directorio</p>
      <div style="text-align:center;padding:16px 0;">
        <div style="font-size:56px;font-weight:800;color:#0369a1;">${healthCountResult}</div>
        <div style="font-size:14px;color:#64748b;margin-top:4px;">establecimientos de salud</div>
        <div style="margin-top:20px;">
          <a href="https://mapadecaborojo.com/categoria/farmacia" style="background:#0369a1;color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">Ver en el mapa →</a>
        </div>
      </div>
    </div>

    <!-- CATEGORY BREAKDOWN -->
    <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin-bottom:4px;">🗂️ Directorio por Categoría</h2>
      <p style="font-size:12px;color:#64748b;margin-bottom:20px;">Negocios abiertos por sector</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        ${categoryBreakdownResult.map(cat => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#f8fafc;border-radius:8px;">
            <span style="font-size:13px;color:#374151;">${esc(CATEGORY_LABELS[cat.category] || cat.category)}</span>
            <span style="font-size:14px;font-weight:700;color:#0d9488;">${cat.count.toLocaleString('es-PR')}</span>
          </div>`).join('')}
      </div>
    </div>
  </div>

  <!-- CTA PITCH -->
  <div style="background:#1e293b;border-radius:12px;padding:32px;color:#fff;text-align:center;margin-bottom:32px;">
    <div style="font-size:20px;font-weight:700;margin-bottom:8px;">¿Quieres este panel integrado en tu municipio?</div>
    <div style="font-size:14px;color:#94a3b8;margin-bottom:20px;max-width:500px;margin-left:auto;margin-right:auto;">
      Cabo Rojo OS conecta datos ciudadanos reales con la gestión municipal. Licencias disponibles para municipios de Puerto Rico.
    </div>
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
      <a href="sms:7874177711?body=Quiero info sobre Cabo Rojo OS" style="background:#0d9488;color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Textea al 787-417-7711</a>
      <a href="https://mapadecaborojo.com" style="background:#334155;color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Ver directorio completo</a>
    </div>
  </div>

</div>

<!-- FOOTER -->
<div style="background:#0f172a;color:#64748b;padding:20px 32px;text-align:center;font-size:12px;">
  <div>Generado por <a href="https://mapadecaborojo.com" style="color:#0d9488;text-decoration:none;">MapaDeCaboRojo.com</a> — Datos en tiempo real · ${esc(generatedAt)}</div>
  <div style="margin-top:4px;">© ${new Date().getFullYear()} MapaDeCaboRojo.com — Cabo Rojo, Puerto Rico</div>
</div>

</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).send(html);

  } catch (err: any) {
    res.status(500).send(`<html><body><h1>Error</h1><pre>${esc(err?.message || 'Unknown error')}</pre></body></html>`);
  }
}

// ============ turismo ============


async function handle_turismo(req: any, res: any) {
  const supa = supabase;

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

// ============ demanda ============

// esc already defined above

interface SurgeRow {
  term: string;
  this_week: number;
  last_week: number;
  surge_pct: number;
}

function getSurgeColor(pct: number, lastWeek: number): string {
  if (lastWeek === 0) return '#8b5cf6'; // purple = new term
  if (pct >= 50) return '#ef4444';      // red = hot surge
  if (pct > 0) return '#10b981';        // green = growing
  if (pct === 0) return '#64748b';      // gray = flat
  return '#f97316';                      // orange = declining
}

function getSurgeBadge(pct: number, lastWeek: number): string {
  if (lastWeek === 0) return '<span style="background:#8b5cf6;color:white;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600;">NUEVO</span>';
  if (pct >= 100) return '<span style="background:#ef4444;color:white;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600;">🔥 +' + pct + '%</span>';
  if (pct >= 50) return '<span style="background:#f97316;color:white;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600;">↑ +' + pct + '%</span>';
  if (pct > 0) return '<span style="background:#10b981;color:white;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600;">+' + pct + '%</span>';
  if (pct === 0) return '<span style="background:#e2e8f0;color:#64748b;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600;">→ sin cambio</span>';
  return '<span style="background:#cbd5e1;color:#475569;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600;">' + pct + '%</span>';
}

async function handle_demanda(req: any, res: any) {
  // Handle subscribe POST
  if (req.method === 'POST') {
    try {
      const { business_name, phone, keywords } = req.body || {};
      if (!business_name || !phone || !keywords) {
        res.status(400).json({ error: 'Faltan campos requeridos' });
        return;
      }
      const keywordArr = typeof keywords === 'string'
        ? keywords.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean)
        : keywords;
      const { error } = await supabase.from('demand_alerts').insert({
        business_name: String(business_name).substring(0, 200),
        phone: String(phone).replace(/\D/g, '').substring(0, 15),
        keywords: keywordArr,
      });
      if (error) throw error;
      res.status(200).json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Error al guardar' });
    }
    return;
  }

  // Fetch surge data
  const { data: surges, error } = await supabase.rpc('get_demand_surges');
  const surgeList: SurgeRow[] = Array.isArray(surges) ? surges : [];

  // Stats
  const totalSearches = surgeList.reduce((s, r) => s + (r.this_week || 0), 0);
  const totalLastWeek = surgeList.reduce((s, r) => s + (r.last_week || 0), 0);
  const overallPct = totalLastWeek > 0
    ? Math.round(((totalSearches - totalLastWeek) / totalLastWeek) * 100)
    : 0;

  // Opportunities: terms with no matched businesses (had_results = false) — use high-demand new terms
  const opportunities = surgeList.filter(r => r.last_week === 0 && r.this_week >= 3).slice(0, 5);

  const tableRows = surgeList.map(row => {
    const color = getSurgeColor(row.surge_pct, row.last_week);
    const badge = getSurgeBadge(row.surge_pct, row.last_week);
    return `<tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:10px 12px;font-weight:600;color:#0f172a;text-transform:capitalize;">${esc(row.term)}</td>
      <td style="padding:10px 12px;text-align:center;font-weight:700;color:${color};">${row.this_week}</td>
      <td style="padding:10px 12px;text-align:center;color:#94a3b8;">${row.last_week}</td>
      <td style="padding:10px 12px;text-align:center;">${badge}</td>
    </tr>`;
  }).join('');

  const opportunityCards = opportunities.length > 0
    ? opportunities.map(row => `
      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:8px;">
        <span style="font-weight:700;color:#92400e;text-transform:capitalize;">${esc(row.term)}</span>
        <span style="color:#78350f;font-size:13px;margin-left:8px;">${row.this_week} búsquedas esta semana — sin negocio asociado</span>
      </div>`).join('')
    : '<p style="color:#64748b;font-size:14px;">No hay términos sin cobertura esta semana.</p>';

  const baseUrl = 'https://mapadecaborojo.com';
  const waLink = `https://wa.me/17874177711?text=${encodeURIComponent('Hola, quiero suscribirme a las alertas de demanda para mi negocio')}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Radar de Demanda — Cabo Rojo | MapaDeCaboRojo.com</title>
  <meta name="description" content="Descubre qué buscan los residentes y visitantes de Cabo Rojo en tiempo real. Análisis semanal de demanda local para negocios.">
  <link rel="canonical" href="${baseUrl}/demanda">
  <meta property="og:title" content="Radar de Demanda — Cabo Rojo">
  <meta property="og:description" content="Lo que Cabo Rojo está buscando esta semana.">
  <meta property="og:url" content="${baseUrl}/demanda">
  <meta property="og:site_name" content="MapaDeCaboRojo.com">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Radar de Demanda — Cabo Rojo","url":"${baseUrl}/demanda","description":"Análisis de demanda local semanal para negocios en Cabo Rojo, Puerto Rico."}</script>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b;line-height:1.6;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0d9488 0%,#0f766e 50%,#1d4ed8 100%);padding:48px 24px 56px;text-align:center;">
    <a href="${baseUrl}" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:13px;display:inline-block;margin-bottom:16px;">← MapaDeCaboRojo.com</a>
    <div style="font-size:40px;margin-bottom:8px;">📈</div>
    <h1 style="color:white;font-size:28px;font-weight:800;margin:0 0 8px 0;">Radar de Demanda</h1>
    <p style="color:rgba(255,255,255,0.85);font-size:16px;margin:0;">Lo que Cabo Rojo está buscando esta semana</p>
  </div>

  <div style="max-width:720px;margin:-24px auto 0;padding:0 16px 48px;">

    <!-- Hero stat -->
    <div style="background:white;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.1);padding:28px 32px;margin-bottom:24px;display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
      <div style="flex:1;min-width:180px;">
        <div style="font-size:48px;font-weight:800;color:#0d9488;line-height:1;">${totalSearches}</div>
        <div style="color:#64748b;font-size:15px;margin-top:4px;">búsquedas esta semana</div>
      </div>
      <div style="flex:1;min-width:180px;border-left:2px solid #e2e8f0;padding-left:24px;">
        <div style="font-size:36px;font-weight:800;line-height:1;color:${overallPct >= 0 ? '#10b981' : '#ef4444'};">
          ${overallPct >= 0 ? '+' : ''}${overallPct}%
        </div>
        <div style="color:#64748b;font-size:15px;margin-top:4px;">vs semana pasada</div>
      </div>
      <div style="flex:1;min-width:180px;border-left:2px solid #e2e8f0;padding-left:24px;">
        <div style="font-size:36px;font-weight:800;line-height:1;color:#8b5cf6;">${surgeList.filter(r => r.last_week === 0).length}</div>
        <div style="color:#64748b;font-size:15px;margin-top:4px;">términos nuevos</div>
      </div>
    </div>

    <!-- Surge Table -->
    <div style="background:white;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08);margin-bottom:24px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:2px solid #e2e8f0;">
        <h2 style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">Tendencias de búsqueda</h2>
        <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Últimos 7 días vs semana anterior · Mínimo 3 búsquedas</p>
      </div>
      ${surgeList.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Término</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Esta semana</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Sem. anterior</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Cambio</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>` : `
      <div style="padding:40px;text-align:center;color:#94a3b8;">
        <div style="font-size:32px;margin-bottom:8px;">📊</div>
        <p>Aún no hay suficientes datos esta semana. Vuelve en unos días.</p>
      </div>`}
    </div>

    <!-- Opportunities -->
    <div style="background:white;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:24px;margin-bottom:24px;">
      <h2 style="margin:0 0 6px;font-size:18px;font-weight:700;color:#0f172a;">⚡ Oportunidades sin cubrir</h2>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;">Términos con demanda activa pero sin negocio que los satisfaga directamente.</p>
      ${opportunityCards}
    </div>

    <!-- CTA Banner -->
    <div style="background:linear-gradient(135deg,#0d9488,#0f766e);border-radius:16px;padding:32px 28px;text-align:center;margin-bottom:24px;">
      <h2 style="color:white;font-size:22px;font-weight:800;margin:0 0 8px;">Suscríbete a alertas de demanda</h2>
      <p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0 0 20px;">Recibe un aviso cuando alguien busque algo relacionado con tu negocio. Sé el primero en responder.</p>
      <div style="background:rgba(255,255,255,0.15);border-radius:12px;padding:16px;margin-bottom:20px;text-align:left;">
        <div style="color:rgba(255,255,255,0.9);font-size:14px;margin-bottom:8px;">✓ Alertas semanales por WhatsApp</div>
        <div style="color:rgba(255,255,255,0.9);font-size:14px;margin-bottom:8px;">✓ Términos personalizados para tu negocio</div>
        <div style="color:rgba(255,255,255,0.9);font-size:14px;">✓ Datos exclusivos de Cabo Rojo</div>
      </div>
      <div style="font-size:28px;font-weight:800;color:#fcd34d;margin-bottom:16px;">$49/mes</div>
      <a href="${waLink}" style="display:inline-block;background:#f97316;color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:16px;">Textea al 787-417-7711</a>
      <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:12px 0 0;">O escríbenos por WhatsApp — respondemos en minutos</p>
    </div>

    <!-- Subscribe Form -->
    <div style="background:white;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:28px 24px;margin-bottom:24px;">
      <h2 style="margin:0 0 6px;font-size:18px;font-weight:700;color:#0f172a;">Registra tu negocio</h2>
      <p style="margin:0 0 20px;color:#64748b;font-size:14px;">Dinos qué términos quieres monitorear y te avisamos cuando suban.</p>
      <form id="alertForm" onsubmit="handleSubmit(event)">
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Nombre del negocio *</label>
          <input id="business_name" type="text" required placeholder="Ej: Farmacia Encarnación" style="width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:15px;box-sizing:border-box;outline:none;">
        </div>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Teléfono (WhatsApp) *</label>
          <input id="phone" type="tel" required placeholder="787-000-0000" style="width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:15px;box-sizing:border-box;outline:none;">
        </div>
        <div style="margin-bottom:20px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Palabras clave a monitorear *</label>
          <input id="keywords" type="text" required placeholder="Ej: farmacia, medicamentos, pastillas" style="width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:15px;box-sizing:border-box;outline:none;">
          <div style="color:#94a3b8;font-size:12px;margin-top:4px;">Separadas por coma</div>
        </div>
        <button type="submit" style="width:100%;background:#0d9488;color:white;border:none;padding:14px;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;">Registrarme — $49/mes</button>
        <div id="formMsg" style="margin-top:12px;text-align:center;font-size:14px;display:none;"></div>
      </form>
    </div>

    <footer style="text-align:center;padding:16px 0;border-top:1px solid #e2e8f0;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">Hecho con orgullo en Cabo Rojo, Puerto Rico</p>
      <p style="color:#94a3b8;font-size:11px;margin:4px 0 0;">
        <a href="${baseUrl}" style="color:#0d9488;text-decoration:none;">MapaDeCaboRojo.com</a>
        · Un proyecto de <a href="https://angelanderson.com" style="color:#0d9488;text-decoration:none;">Angel Anderson</a>
      </p>
    </footer>
  </div>

  <script>
    async function handleSubmit(e) {
      e.preventDefault();
      const msg = document.getElementById('formMsg');
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Enviando...';
      try {
        const res = await fetch('/api/demanda', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_name: document.getElementById('business_name').value,
            phone: document.getElementById('phone').value,
            keywords: document.getElementById('keywords').value,
          })
        });
        const json = await res.json();
        if (json.success) {
          msg.style.display = 'block';
          msg.style.color = '#10b981';
          msg.textContent = '¡Listo! Te contactaremos para activar tu suscripción.';
          e.target.reset();
        } else {
          throw new Error(json.error || 'Error desconocido');
        }
      } catch(err) {
        msg.style.display = 'block';
        msg.style.color = '#ef4444';
        msg.textContent = 'Error al enviar. Escríbenos al 787-417-7711.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Registrarme — $49/mes';
      }
    }
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(html);
}

// ============ intelligence ============



function periodToDays(period: string): number {
  if (period === '30d') return 30;
  if (period === '90d') return 90;
  return 7;
}

function trendLabel(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

async function checkApiKey(key: string | null): Promise<boolean> {
  if (!key) return false;
  const supa = supabase;
  const { data } = await supa
    .from('api_keys')
    .select('id, active')
    .eq('key', key)
    .eq('active', true)
    .single();
  return !!data;
}

async function handle_intelligence(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const apiKey = (req.query.key as string) || (req.headers['x-api-key'] as string) || null;
  const period = (req.query.period as string) || '7d';
  const format = (req.query.format as string) || 'json';
  const days = periodToDays(period);

  // Auth check
  const validKey = await checkApiKey(apiKey);
  if (!validKey) {
    return res.status(401).json({
      error: 'API key requerida. Obtén acceso gratuito en mapadecaborojo.com/turismo',
      docs: 'https://mapadecaborojo.com/turismo'
    });
  }

  const supa = supabase;

  const nowISO = new Date().toISOString();
  const startCurrent = new Date(Date.now() - days * 86400000).toISOString();
  const startPrevious = new Date(Date.now() - days * 2 * 86400000).toISOString();

  // Parallel queries
  const [currentData, previousData] = await Promise.all([
    supa
      .from('demand_signals')
      .select('query_text, query_normalized, category, user_hash, had_results, results_count, created_at')
      .gte('created_at', startCurrent),
    supa
      .from('demand_signals')
      .select('query_text, query_normalized, results_count, had_results, created_at')
      .gte('created_at', startPrevious)
      .lt('created_at', startCurrent)
  ]);

  const rows = currentData.data || [];
  const prevRows = previousData.data || [];

  // Total searches
  const totalSearches = rows.length;
  const uniqueUsers = new Set(rows.map((r: any) => r.user_hash).filter(Boolean)).size;

  // Top terms (current period)
  const termCount: Record<string, number> = {};
  for (const r of rows) {
    const t = (r.query_normalized || r.query_text || '').toLowerCase().trim();
    if (t) termCount[t] = (termCount[t] || 0) + 1;
  }

  // Previous period term counts
  const prevTermCount: Record<string, number> = {};
  for (const r of prevRows) {
    const t = (r.query_text || '').toLowerCase().trim();
    if (t) prevTermCount[t] = (prevTermCount[t] || 0) + 1;
  }

  const topTerms = Object.entries(termCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term, count]) => ({
      term,
      count,
      trend: trendLabel(count, prevTermCount[term] || 0)
    }));

  // Categories demand
  const catCount: Record<string, number> = {};
  for (const r of rows) {
    const c = r.category || 'OTHER';
    catCount[c] = (catCount[c] || 0) + 1;
  }
  const categoriesDemand = Object.entries(catCount)
    .sort((a, b) => b[1] - a[1])
    .map(([category, searches]) => ({ category, searches }));

  // Hourly distribution
  const hourCount: Record<number, number> = {};
  for (let h = 0; h < 24; h++) hourCount[h] = 0;
  for (const r of rows) {
    const h = new Date(r.created_at).getUTCHours();
    hourCount[h] = (hourCount[h] || 0) + 1;
  }
  const hourlyDistribution = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: hourCount[h] || 0
  }));

  // Gaps: queries with no results (had_results = false or results_count = 0)
  const gapCount: Record<string, number> = {};
  for (const r of rows) {
    const noResults = r.had_results === false || r.results_count === 0;
    if (noResults) {
      const t = (r.query_normalized || r.query_text || '').toLowerCase().trim();
      if (t && t.length > 2) gapCount[t] = (gapCount[t] || 0) + 1;
    }
  }
  const gaps = Object.entries(gapCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([term]) => term);

  const payload = {
    period,
    generated_at: nowISO,
    total_searches: totalSearches,
    unique_users: uniqueUsers,
    top_terms: topTerms,
    categories_demand: categoriesDemand,
    hourly_distribution: hourlyDistribution,
    gaps
  };

  if (format === 'csv') {
    const lines = ['term,count,trend'];
    for (const t of topTerms) lines.push(`"${t.term}",${t.count},"${t.trend}"`);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tourism-intelligence-${period}.csv"`);
    return res.status(200).send(lines.join('\n'));
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.status(200).json(payload);
}


// ============ ROUTER ============
export default async function handler(req: any, res: any) {
  const page = req.query?.page || '';
  switch (page) {
    case 'municipio': return handle_municipio(req, res);
    case 'turismo': return handle_turismo(req, res);
    case 'demanda': return handle_demanda(req, res);
    case 'intelligence': return handle_intelligence(req, res);
    default: return res.status(404).json({ error: 'Page not found' });
  }
}
