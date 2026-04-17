import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwcmp0ZXFnbWFubnR2aXNqcnZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NDAwODgsImV4cCI6MjA4MDAxNjA4OH0.JBRyroLWbjh6Ow9un24c77mbr_zl9P7hdd6YUzt8LgY'
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

export default async function handler(req: any, res: any) {
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
