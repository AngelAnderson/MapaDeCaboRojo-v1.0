import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

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

export default async function handler(req: any, res: any) {
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
