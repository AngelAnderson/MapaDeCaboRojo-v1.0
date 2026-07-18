import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

export default async function handler(req: any, res: any) {
  const authHeader = req.headers.authorization;
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const job = (req.query.job as string) || '';

  try {
    switch (job) {
      case 'briefing':
        return await runBriefing(res);
      case 'maintenance':
        return await runMaintenance(res);
      case 'vibe':
        return await runVibe(res);
      case 'alertas':
        return await runAlertas(res);
      case 'dato':
        return await runDatoDelDia(res);
      case 'hpsa-refresh':
        return await runHpsaRefresh(res);
      case 'registro-qc':
        return await runRegistroQc(res);
      case 'salud-atencion':
        return await runSaludAtencion(res);
      default:
        return res.status(400).json({ error: `Unknown job: ${job}. Use ?job=briefing|maintenance|vibe|alertas|dato|hpsa-refresh|registro-qc|salud-atencion` });
    }
  } catch (error: any) {
    console.error(`Cron ${job} failed:`, error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// --- Briefing ---
async function runBriefing(res: any) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const { data: logs } = await supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(50);
  const { data: places } = await supabase.from('places').select('name');

  const logText = logs ? logs.map((l: any) => `${l.action}: ${l.place_name} [${l.details}]`).join('\n') : "No data.";
  const placeText = places ? places.map((p: any) => p.name).join(', ') : "";

  const prompt = `Act as Business Analyst for Cabo Rojo Tourism App. Analyze logs: ${logText}. Inventory: ${placeText.substring(0,300)}. Generate Morning Briefing JSON { "en": "html", "es": "html" } with sections: Pulse, Trends, Actions, Opportunity.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });

  await supabase.from('admin_logs').insert([{
    action: 'AI_BRIEFING',
    place_name: 'Daily Report',
    details: response.text || "{}",
    created_at: new Date().toISOString()
  }]);

  return res.status(200).json({ success: true });
}

// --- Maintenance ---
async function runMaintenance(res: any) {
  const logResult = [];

  // 1. Archive Past Events
  const now = new Date().toISOString();
  const { data: pastEvents } = await supabase
    .from('events')
    .select('id, title')
    .lt('end_time', now)
    .neq('status', 'archived');

  if (pastEvents && pastEvents.length > 0) {
    const ids = pastEvents.map((e: any) => e.id);
    const { error: updateError } = await supabase
      .from('events')
      .update({ status: 'archived' })
      .in('id', ids);
    if (updateError) throw updateError;

    logResult.push(`Archived ${ids.length} past events: ${pastEvents.map((e: any) => e.title).join(', ')}`);

    await supabase.from('admin_logs').insert([{
      action: 'UPDATE_EVENT',
      place_name: 'System Maintenance',
      details: `Auto-archived ${ids.length} events.`,
      created_at: new Date().toISOString()
    }]);
  } else {
    logResult.push("No events to archive.");
  }

  // 2. Prune Old Logs (older than 60 days)
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const { error: deleteError } = await supabase
    .from('admin_logs')
    .delete()
    .lt('created_at', sixtyDaysAgo.toISOString());
  if (!deleteError) {
    logResult.push("Pruned logs older than 60 days.");
  }

  return res.status(200).json({ success: true, report: logResult });
}

// --- Alertas de pueblo (registromedicopr.com/pueblo) ---
// Cierra el loop "🔔 te aviso cuando llegue uno nuevo": cruza especialistas verificados
// NUEVOS (places.created_at > suscripción) contra registro_alerts pendientes, le escribe
// al vecino UNA vez (one-shot, como TE AVISO del bot) y marca notified_at.
const ALERT_REGISTRY_SUBS = ['cardiólogo','psiquiatra','fisiatra','ginecólogo','pediatra','dermatólogo','gastroenterólogo','oftalmólogo','ortopeda','neurologo','urólogo','endocrinologo','nefrólogo','neumólogo','oncólogo','reumatólogo','geriatra','otorrinolaringólogo','infectólogo','alergista','medicina de emergencia','cirujano general','anestesiólogo','radiólogo','neurocirujano','cirujano plástico','cirujano torácico','coloproctólogo','manejo de dolor','psicólogo','optómetra','podiatra'];
function cleanLine(s: any): string {
  return String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200);
}
function maskEmail(e: string): string {
  const [u, d] = String(e || '').split('@');
  return `${(u || '').slice(0, 2)}***@${d || ''}`;
}
function escH(s: any): string {
  return String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string));
}
async function runAlertas(res: any) {
  const svc = createClient(
    process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  const RESEND = process.env.RESEND_API_KEY || '';
  if (!RESEND) return res.status(200).json({ success: false, error: 'RESEND_API_KEY missing' });

  const { data: alerts } = await svc
    .from('registro_alerts')
    .select('id,email,municipio,specialty,created_at')
    .is('notified_at', null)
    .limit(200);
  if (!alerts || alerts.length === 0) return res.status(200).json({ success: true, notified: 0 });

  let notified = 0;
  const report: string[] = [];
  for (const a of alerts) {
    const subs = a.specialty ? [a.specialty] : ALERT_REGISTRY_SUBS;
    const { data: matches } = await svc
      .from('places')
      .select('name,subcategory,municipality,phone,slug,created_at')
      .eq('category', 'HEALTH').eq('status', 'open')
      .not('npi', 'is', null).not('slug', 'is', null)
      .eq('municipality', a.municipio)
      .gt('created_at', a.created_at)
      .in('subcategory', subs)
      .limit(10);
    if (!matches || matches.length === 0) continue;

    // Claim ANTES de enviar (fail-closed): si Resend falla, el vecino pierde UN email (Angel lo
    // ve en el resumen y puede re-nullear notified_at), pero nunca recibe duplicados.
    const { error: claimErr } = await svc.from('registro_alerts')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', a.id).is('notified_at', null);
    if (claimErr) { report.push(`FAIL claim ${a.id}: ${claimErr.message}`); continue; }

    const items = matches.map((m: any) =>
      `<li style="margin:6px 0"><strong>${escH(String(m.name).replace(/^Dr\(a\)\.\s*/, ''))}</strong> · ${escH(m.subcategory)}${m.phone ? ` · ${escH(m.phone)}` : ''}<br><a href="https://registromedicopr.com/especialista/${encodeURIComponent(m.slug)}" style="color:#0f766e">Ver el perfil verificado →</a></li>`
    ).join('');
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json', 'Idempotency-Key': `alerta-pueblo-${a.id}` },
        body: JSON.stringify({
          from: 'Registro Médico PR <newsletter@mapadecaborojo.com>',
          to: cleanLine(a.email),
          reply_to: 'angel@angelanderson.com',
          subject: `Llegó ${matches.length === 1 ? 'un especialista nuevo' : `${matches.length} especialistas nuevos`} a ${cleanLine(a.municipio)}`,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
<p>Me pediste que te avisara cuando apareciera ${a.specialty ? `un <strong>${escH(a.specialty)}</strong>` : 'un especialista nuevo'} verificado en <strong>${escH(a.municipio)}</strong>. Llegó:</p>
<ul style="padding-left:18px">${items}</ul>
<p style="font-size:14px;color:#475569">Antes de ir, llama y confirma que acepta tu plan y que está cogiendo pacientes nuevos. Los teléfonos y planes cambian.</p>
<p style="font-size:14px">Tu pueblo completo: <a href="https://registromedicopr.com/pueblo" style="color:#0f766e">registromedicopr.com/pueblo</a></p>
<p style="font-size:13px;color:#64748b">Esta alerta era de una sola vez: no te vuelvo a escribir a menos que la pidas de nuevo. Si quieres otra, actívala en la página de tu pueblo.<br>- Angel | Menos revolú, más sistema, mejor vida.</p>
</div>`,
        }),
      });
      if (!r.ok) { report.push(`FAIL alerta ${a.id} (${a.municipio}): HTTP ${r.status} — email NO salió, re-nullea notified_at pa' reintentar`); continue; }
    } catch (e: any) {
      report.push(`FAIL alerta ${a.id} (${a.municipio}): ${e?.message || 'fetch error'} — email NO salió, re-nullea notified_at pa' reintentar`);
      continue;
    }
    notified++;
    report.push(`OK ${maskEmail(a.email)} [${a.id}] → ${a.municipio}${a.specialty ? ` (${a.specialty})` : ''}: ${matches.length} match(es)`);
  }

  // Resumen a Angel (solo si pasó algo)
  if (report.length) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Registro Médico PR <newsletter@mapadecaborojo.com>',
          to: 'angel@angelanderson.com',
          subject: `🔔 Alertas de pueblo: ${notified} vecino(s) notificado(s)`,
          html: `<p>${report.map(escH).join('<br>')}</p><p style="color:#64748b;font-size:12px">cron alertas · registro_alerts</p>`,
        }),
      });
    } catch { /* best-effort */ }
  }
  // Sin PII en el response HTTP (queda en logs de Vercel) — el detalle enmascarado va en el email a Angel.
  return res.status(200).json({ success: true, notified, failures: report.filter(r => r.startsWith('FAIL')).length });
}

// --- Vibe ---
async function runVibe(res: any) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("Google API Key missing");

  const { data: places } = await supabase
    .from('places')
    .select('id, name, gmaps_url')
    .eq('status', 'open')
    .not('gmaps_url', 'is', null)
    .limit(50);

  if (!places || places.length === 0) return res.status(200).json({ msg: "No places found" });

  const shuffled = places.sort(() => 0.5 - Math.random()).slice(0, 3);
  const updates = [];

  for (const place of shuffled) {
    let gId = '';
    if (place.gmaps_url && place.gmaps_url.includes('place_id:')) {
      gId = place.gmaps_url.split('place_id:')[1].split('&')[0];
    }

    if (gId) {
      const gUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${gId}&fields=name,reviews&language=es&key=${apiKey}`;
      const gRes = await fetch(gUrl);
      const gData = await gRes.json();

      if (gData.status === 'OK' && gData.result.reviews) {
        const reviewsText = gData.result.reviews.slice(0, 5).map((r: any) => `"${r.text}"`).join('\n');
        const prompt = `Act as "El Veci". Summarize the VIBE of "${place.name}" based on reviews: ${reviewsText}. Max 15 words. Puerto Rican Spanish. Be honest.`;

        const aiResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        const vibeSummary = aiResponse.text?.trim() || "Buen ambiente.";

        const { data: curr } = await supabase.from('places').select('amenities').eq('id', place.id).single();
        const newAmenities = { ...(curr?.amenities || {}), vibe_check: { text: vibeSummary, date: new Date().toISOString() } };

        await supabase.from('places').update({ amenities: newAmenities }).eq('id', place.id);
        updates.push(`${place.name}: ${vibeSummary}`);
      }
    }
  }

  await supabase.from('admin_logs').insert([{
    action: 'UPDATE',
    place_name: 'Vibe Cron',
    details: `Updated ${updates.length} places: ${updates.join(' | ')}`,
    created_at: new Date().toISOString()
  }]);

  return res.status(200).json({ success: true, updates });
}


// --- Dato del Día: rota un dato citable verificado a nightly_receipts (el Morning Dispatch lo lee) ---
// Distribución gratis / growth loop: cada día un récord distinto queda copy-paste-ready para FB, con backlink.
// Determinista por día del año (estable dentro del día, rota diario). Idempotente por run_date.
const DATOS_DEL_DIA: Array<{ t: string; u: string }> = [
  { t: 'El efecto fundador de Puerto Rico ha producido al menos 6 enfermedades genéticas con variante propia boricua documentada en la ciencia: Hermansky-Pudlak tipo 1 y tipo 3, síndrome TBCK, disquinesia ciliar RSPH4A, distrofia de cinturas SGCG y cáncer hereditario BRCA2. El mapa consolidado, en español y por pueblo:', u: 'https://registromedicopr.com/atlas' },
  { t: 'Puerto Rico es #1 de EE.UU. en enfermedades raras, pero tiene 2 genetistas clínicos (M.D.) que diagnostican, casi todos en el metro. La región de la montaña, donde se concentran las mutaciones fundadoras, tiene 0. La lista de quién existe, con teléfono:', u: 'https://registromedicopr.com/raras' },
  { t: 'Puerto Rico e Iowa tienen la misma población (3.2 millones). En 2024 el NIH invirtió $249 millones en Iowa y $90 millones en Puerto Rico. La misma gente, un tercio del dinero, pese al ADN founder-effect más valioso de la nación:', u: 'https://puertoricosinfiltros.com/investigacion' },
  { t: 'El síndrome de Hermansky-Pudlak (un albinismo con problemas de sangrado) aparece en 1 de cada 1,800 personas en el noroeste de Puerto Rico. 1 de cada 21 bebés del noroeste es portador. No es trivia: dibuja un mapa por pueblo:', u: 'https://registromedicopr.com/atlas' },
  { t: 'Una sola variante fundadora en el gen BRCA2 explica la mayoría del cáncer hereditario de seno y ovario en Puerto Rico. A diferencia de otras raras, esta SÍ se puede accionar: hay pruebas y prevención. Si hay varios casos en tu familia, se puede hacer algo hoy:', u: 'https://registromedicopr.com/atlas' },
  { t: 'Diagnosticar una enfermedad rara en Puerto Rico toma de 2 a 10 años. A Melissmar López Pimentel le tomó 11 hasta llegar al síndrome TBCK, el "Síndrome Boricua". Si tu familia está en esa espera, la TBCK Foundation de PR acompaña. No se atraviesa solo:', u: 'https://registromedicopr.com/raras' },
  { t: 'El registro oficial de enfermedades raras de PR (Ley 9-2025, $450K) sigue "en desarrollo": 42 enfermedades catalogadas, sin saber cuántas personas ni en qué pueblos. Mientras tanto, el mapa de quién puede diagnosticarlas ya existe, gratis. No hay que esperar al 2030:', u: 'https://puertoricosinfiltros.com/registro-raras' },
  { t: 'Una sola variante fundadora en el gen RSPH4A explica 2 de cada 3 casos de disquinesia ciliar primaria en Puerto Rico, con cerca de 1,624 personas afectadas y mayor concentración en Mayagüez. Se confunde con asma por años:', u: 'https://registromedicopr.com/atlas' },
  { t: 'Puerto Rico recibe menos financiamiento de investigación de salud por persona ($28) que Mississippi, el estado más pobre de EE.UU. ($31), pese a tener el ADN más valioso del país para entender enfermedades genéticas:', u: 'https://puertoricosinfiltros.com/investigacion' },
];

// --- Salud Atención: email semanal (lunes) con lo que necesita revisión en la data HPSA (Tier 2) ---
// El admin /admin/salud te muestra esto cuando entras; este cron te lo LLEVA sin que tengas que entrar.
// Cruce completo contra el registro (psiquiatra + dentista) para cazar discrepancias solo.
async function runSaludAtencion(res: any) {
  const svc = createClient(
    process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  const RESEND = process.env.RESEND_API_KEY || '';
  const yearOf = (s: string) => parseInt(String(s || '').slice(0, 4), 10) || 0;
  const norm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

  const { data: rows } = await svc.from('pr_hpsa_designations').select('discipline,municipio,score,fte,shortage,last_update,manual_status').limit(400);
  const all = rows || [];
  const { data: log } = await svc.from('nightly_receipts').select('run_date,summary_md').eq('routine', 'hpsa-refresh').eq('reviewed_by_angel', false).order('run_date', { ascending: false }).limit(10);

  // Cruce completo: por disciplina, pueblos que HPSA marca 0 pero el registro SÍ tiene proveedor
  const DISC_SUBS: Record<string, string[]> = { mental: ['psiquiatra', 'psicólogo'], dental: ['dentista'] };
  const discrepancias: string[] = [];
  for (const [disc, subs] of Object.entries(DISC_SUBS)) {
    const { data: provs } = await svc.from('places').select('municipality').eq('category', 'HEALTH').in('subcategory', subs).not('npi', 'is', null);
    const towns = new Set((provs || []).map((p: any) => norm(p.municipality)));
    for (const r of all.filter((x: any) => x.discipline === disc && Number(x.fte) === 0 && x.manual_status !== 'ok')) {
      if (towns.has(norm(r.municipio))) discrepancias.push(`${r.municipio} (${disc}): HRSA dice 0, el registro tiene proveedor listado`);
    }
  }
  const stale = all.filter((r: any) => (2026 - yearOf(r.last_update)) >= 3 && r.manual_status !== 'ok');
  const pending = all.filter((r: any) => r.manual_status === 'verificar');
  const unreviewed = (log || []).length;

  const items: string[] = [];
  if (unreviewed) items.push(`🆕 <b>${unreviewed}</b> cambio(s) de HRSA sin revisar.`);
  if (discrepancias.length) items.push(`🔀 <b>${discrepancias.length}</b> discrepancia(s) HPSA vs registro:<br><small>${discrepancias.slice(0, 10).map(escH).join('<br>')}</small>`);
  if (pending.length) items.push(`⏳ <b>${pending.length}</b> fila(s) marcada(s) "verificar" pendientes: ${pending.slice(0, 8).map((r: any) => escH(r.municipio)).join(', ')}.`);
  if (stale.length) items.push(`🕰️ <b>${stale.length}</b> designación(es) sin actualizar en HRSA hace 3+ años.`);

  const runDate = new Date().toISOString().slice(0, 10);
  const bodyHtml = items.length
    ? `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
<p style="font-size:13px;color:#64748b">Salud que falta · revisión semanal · ${runDate}</p>
<h2 style="margin:6px 0">⚡ ${items.length} cosa(s) que necesitan tu atención</h2>
<ul style="padding-left:18px;line-height:1.8">${items.map(i => `<li>${i}</li>`).join('')}</ul>
<p style="margin-top:16px"><a href="https://puertoricosinfiltros.com/admin/salud" style="background:#0d9488;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Abrir el panel →</a></p>
<p style="font-size:12px;color:#94a3b8;margin-top:14px">La data se refresca sola cada trimestre. Este email te avisa entre refrescos si algo pide tu ojo. - Angel</p></div>`
    : `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
<p style="font-size:13px;color:#64748b">Salud que falta · revisión semanal · ${runDate}</p>
<h2 style="margin:6px 0;color:#166534">✅ Todo al día</h2>
<p>Sin cambios de HRSA sin revisar, sin discrepancias con el registro, sin pendientes. La data pública está sólida.</p>
<p style="font-size:12px;color:#94a3b8">- Angel | Menos revolú, más sistema, mejor vida.</p></div>`;

  if (RESEND) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Puerto Rico Sin Filtros <newsletter@mapadecaborojo.com>',
          to: 'angel@angelanderson.com',
          subject: items.length ? `⚡ Salud que falta: ${items.length} para revisar` : `✅ Salud que falta: todo al día`,
          html: bodyHtml,
        }),
      });
    } catch (e: any) { return res.status(200).json({ success: false, error: e?.message }); }
  }
  return res.status(200).json({ success: true, items: items.length, discrepancias: discrepancias.length, stale: stale.length, pending: pending.length, unreviewed });
}

// --- HPSA Refresh: re-verifica el barrido de designaciones de escasez de PR contra HRSA (trimestral) ---
// Las designaciones HPSA se revisan cada pocos años; sin esto, pr_hpsa_designations (y /salud-que-falta) se
// quedan viejas sin avisar. Este job re-jala el barrido, hace upsert, y si algo CAMBIÓ (score/FTE/nuevo/removido)
// escribe un nightly_receipt para que Angel lo revise. No publica nada solo.
async function runHpsaRefresh(res: any) {
  const svc = createClient(
    process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  const BASE = 'https://gisportal.hrsa.gov/server/rest/services/Shortage/HealthProfessionalShortageAreas_FS/MapServer';
  const FIELDS = 'HPSA_NM,HPSA_SCORE,HPSA_FTE,HPSA_SHORTAGE,HPSA_FORMAL_RATIO,HPSA_DESIGNATION_POP,HPSA_DESIG_LAST_UPD_DT_TXT';
  const LAYERS: Array<[string, number]> = [['dental', 2], ['mental', 6], ['primary', 10]];
  const cleanMuni = (nm: string) => String(nm || '').replace(/^(LI|MUA|MUP|GEO)\s*-\s*/, '').replace(/\s+Municipio.*$/, '').trim();

  const fresh: any[] = [];
  for (const [disc, layer] of LAYERS) {
    const url = `${BASE}/${layer}/query?where=${encodeURIComponent("PRIMARY_STATE_NM='Puerto Rico'")}&outFields=${encodeURIComponent(FIELDS)}&returnGeometry=false&f=json&resultRecordCount=3000`;
    const r = await fetch(url);
    if (!r.ok) return res.status(200).json({ success: false, error: `HRSA ${disc} HTTP ${r.status}` });
    const d: any = await r.json();
    for (const f of (d.features || [])) {
      const a = f.attributes;
      fresh.push({
        discipline: disc, hpsa_name: a.HPSA_NM, municipio: cleanMuni(a.HPSA_NM),
        score: a.HPSA_SCORE, fte: a.HPSA_FTE, shortage: a.HPSA_SHORTAGE,
        ratio: a.HPSA_FORMAL_RATIO, pop: a.HPSA_DESIGNATION_POP, last_update: a.HPSA_DESIG_LAST_UPD_DT_TXT,
        refreshed_at: new Date().toISOString(),
      });
    }
  }
  if (fresh.length < 50) return res.status(200).json({ success: false, error: `barrido sospechosamente corto: ${fresh.length}` });

  // snapshot previo para detectar cambios
  const { data: prev } = await svc.from('pr_hpsa_designations').select('discipline,hpsa_name,score,fte');
  const prevMap: Record<string, any> = {};
  for (const p of (prev || [])) prevMap[`${p.discipline}|${p.hpsa_name}`] = p;
  const freshKeys = new Set(fresh.map(f => `${f.discipline}|${f.hpsa_name}`));

  const changes: string[] = [];
  for (const f of fresh) {
    const key = `${f.discipline}|${f.hpsa_name}`;
    const p = prevMap[key];
    if (!p) { changes.push(`🆕 NUEVA designación ${f.discipline}: ${f.municipio} (score ${f.score})`); continue; }
    if (p.score !== f.score) changes.push(`📊 ${f.municipio} ${f.discipline}: score ${p.score} → ${f.score}`);
    else if (Math.abs(Number(p.fte) - Number(f.fte)) > 0.01) changes.push(`👥 ${f.municipio} ${f.discipline}: proveedores ${Number(p.fte).toFixed(2)} → ${Number(f.fte).toFixed(2)}`);
  }
  for (const p of (prev || [])) {
    if (!freshKeys.has(`${p.discipline}|${p.hpsa_name}`)) changes.push(`❌ REMOVIDA designación ${p.discipline}: ${cleanMuni(p.hpsa_name)} (ya no certificada — verificar antes de citar)`);
  }

  // upsert el barrido fresco
  const { error: upErr } = await svc.from('pr_hpsa_designations')
    .upsert(fresh, { onConflict: 'discipline,hpsa_name' });
  if (upErr) return res.status(200).json({ success: false, error: `upsert: ${upErr.message}` });

  // solo escribe recibo si algo cambió (silencio = todo igual, no molesta a Angel)
  if (changes.length) {
    const runDate = new Date().toISOString().slice(0, 10);
    const summary = `🩺 **HPSA Refresh** (${runDate}) — el barrido federal de escasez médica de PR cambió en ${changes.length} punto(s). Revisar antes de que /salud-que-falta o el artículo del huracán citen números viejos:\n\n${changes.map(c => `- ${c}`).join('\n')}\n\nData ya actualizada en \`pr_hpsa_designations\`. Fuente: HRSA HPSA Find.`;
    await svc.from('nightly_receipts').insert({
      routine: 'hpsa-refresh', run_date: runDate, summary_md: summary,
      verify_sql: "SELECT discipline, count(*) FILTER (WHERE fte=0) AS en_cero, count(*) AS total FROM pr_hpsa_designations GROUP BY discipline;",
      reviewed_by_angel: false,
    });
  }
  return res.status(200).json({ success: true, refreshed: fresh.length, changes: changes.length, detail: changes.slice(0, 20) });
}

// --- Registro QC mensual: monitor de frescura (read-only) → recibo en nightly_receipts ---
// Corre el 1ro de cada mes. NO muta data (ingesta de proveedores nuevos = skill /registro-sync manual).
// Vigila: duplicados, regiones nulas, backlog de embeddings, y que la disparidad siga intacta.
const REGISTRO_SUBS_QC = ['cardiólogo','psiquiatra','fisiatra','ginecólogo','pediatra','dermatólogo','gastroenterólogo','oftalmólogo','ortopeda','neurologo','urólogo','endocrinologo','nefrólogo','neumólogo','oncólogo','reumatólogo','geriatra','otorrinolaringólogo','infectólogo','alergista','medicina de emergencia','cirujano general','anestesiólogo','radiólogo','neurocirujano','cirujano plástico','cirujano torácico','coloproctólogo','manejo de dolor','psicólogo','optómetra','podiatra','dentista','internista','medicina de familia','terapeuta del habla','terapista físico','terapista ocupacional','quiropractico','consejero','trabajador social','terapeuta de familia','nutricionista','physician assistant','enfermera practicante','audiólogo','partera','farmacéutico','hospital','cuidado en el hogar','hospicio','hogar de envejecientes','centro de diálisis','urgent care','clínica comunitaria','laboratorio clínico','radiología','ambulancia'];

// Refresca estrellas CMS Care Compare (SNF + home health). Additivo/seguro. Devuelve # actualizados.
function cmsToks(s: string): Set<string> {
  const n = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\b(inc|llc|corp|psc|the|de|del|la|los|las|y|and|of|pr|puerto|rico|home|care|health|services?|servicios?|salud|hogar|centro|program|programa)\b/g, ' ')
  return new Set(n.replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length > 2))
}
async function refreshCmsRatings(svc: any): Promise<{ updated: number; error?: string }> {
  try {
    const pull = async (ds: string, rf: string): Promise<Array<{ toks: Set<string>; val: number }>> => {
      const u = `https://data.cms.gov/provider-data/api/1/datastore/query/${ds}/0?conditions[0][property]=state&conditions[0][value]=PR&conditions[0][operator]==&limit=500`
      const d = await (await fetch(u)).json()
      const out: Array<{ toks: Set<string>; val: number }> = []
      for (const r of (d.results || [])) { const v = parseFloat(r[rf]); if (!isNaN(v)) out.push({ toks: cmsToks(r.provider_name), val: v }) }
      return out
    }
    const [snf, hh] = await Promise.all([pull('4pq5-n9py', 'overall_rating'), pull('6jpm-sxkc', 'quality_of_patient_care_star_rating')])
    let updated = 0
    for (const [sub, list, rtype] of [['hogar de envejecientes', snf, 'overall'], ['cuidado en el hogar', hh, 'quality_of_care']] as const) {
      const { data: ours } = await svc.from('places').select('id,name,cms_rating').eq('subcategory', sub).not('npi', 'is', null).eq('status', 'open').limit(500)
      for (const o of (ours || [])) {
        const ot = Array.from(cmsToks(o.name)); let best: number | null = null, bestSc = 0
        for (const c of list) { let sc = 0; for (const t of ot) if (c.toks.has(t)) sc++; if (sc > bestSc) { bestSc = sc; best = c.val } }
        if (best != null && bestSc >= 2 && Number(o.cms_rating) !== best) {
          await svc.from('places').update({ cms_rating: best, cms_rating_type: rtype, cms_rating_date: runMonth() }).eq('id', o.id); updated++
        }
      }
    }
    return { updated }
  } catch (e: any) { return { updated: 0, error: e.message } }
}
function runMonth(): string { return new Date().toISOString().slice(0, 7) }

async function runRegistroQc(res: any) {
  const svc = createClient(
    process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  const runDate = new Date().toISOString().slice(0, 10);
  const { data: existing } = await svc.from('nightly_receipts')
    .select('id').eq('routine', 'registro-qc').eq('run_date', runDate).limit(1);
  if (existing && existing.length) return res.status(200).json({ success: true, skipped: 'already ' + runDate });

  // Conteo total scoped + integridad + disparidad ancla. Consultas simples via PostgREST (sin RPC nueva).
  const [{ count: total }, { count: nullRegion }, { count: nullEmbed }, { count: nullSlug }] = await Promise.all([
    svc.from('places').select('id', { count: 'exact', head: true }).not('npi', 'is', null).eq('status', 'open').in('subcategory', REGISTRO_SUBS_QC),
    svc.from('places').select('id', { count: 'exact', head: true }).not('npi', 'is', null).is('region', null),
    svc.from('places').select('id', { count: 'exact', head: true }).not('npi', 'is', null).is('embedding', null).in('subcategory', REGISTRO_SUBS_QC),
    svc.from('places').select('id', { count: 'exact', head: true }).not('npi', 'is', null).is('slug', null).in('subcategory', REGISTRO_SUBS_QC),
  ]);
  // Disparidad ancla (la vista pinned a 32): Loíza debe seguir ~0.8, San Juan ~68.9
  const { data: anchor } = await svc.from('v_registro_muni_ratio')
    .select('municipio,especialistas,por_10k_hab').in('municipio', ['Loíza', 'San Juan', 'Cabo Rojo']);
  const loiza = (anchor || []).find((a: any) => a.municipio === 'Loíza');
  const sj = (anchor || []).find((a: any) => a.municipio === 'San Juan');
  const disparidadOk = loiza && sj && Number(loiza.por_10k_hab) < 2 && Number(sj.por_10k_hab) > 50;

  // Auto-mantenimiento seguro: dedup (conservador, reversible) + refresh de estrellas CMS (additivo).
  let deduped = 0, dedupErr = '';
  try { const { data } = await svc.rpc('registro_dedup'); deduped = Number(data) || 0; } catch (e: any) { dedupErr = e.message; }
  const cms = await refreshCmsRatings(svc);
  const { count: cmsRated } = await svc.from('places').select('id', { count: 'exact', head: true }).not('cms_rating', 'is', null);

  const flags: string[] = [];
  if ((nullSlug || 0) > 0) flags.push(`🔴 ${nullSlug} proveedores sin slug (no tienen página)`);
  if ((nullRegion || 0) > 15) flags.push(`🟡 ${nullRegion} filas sin región (>15, revisar backfill)`);
  if ((nullEmbed || 0) > 1000) flags.push(`🟡 ${nullEmbed} sin embedding — corre \`gh workflow run regen-embeddings.yml -R AngelAnderson/Vecinoai\``);
  if (!disparidadOk) flags.push(`🔴 DISPARIDAD ROTA: la vista v_registro_muni_ratio ya no da los números ancla (Loíza<2, SJ>50). Revisar que sigue pinned a las 32.`);
  if (dedupErr) flags.push(`🟡 dedup falló: ${dedupErr}`);
  if (cms.error) flags.push(`🟡 refresh CMS falló: ${cms.error}`);

  const summary = `🩺 **Registro Médico PR — QC mensual** (${runDate})\n\n` +
    `- Total verificado (65 categorías): **${(total || 0).toLocaleString('en-US')}**\n` +
    `- Disparidad ancla: Loíza ${loiza?.por_10k_hab ?? '?'}/10k · San Juan ${sj?.por_10k_hab ?? '?'}/10k → ${disparidadOk ? '✅ intacta' : '🔴 ROTA'}\n` +
    `- Dedup: ${deduped} nuevo(s) duplicado(s) marcado(s) este mes · Estrellas CMS: ${cms.updated} actualizada(s), ${cmsRated || 0} facilidades calificadas\n` +
    `- Sin slug: ${nullSlug || 0} · sin región: ${nullRegion || 0} · sin embedding: ${nullEmbed || 0}\n\n` +
    (flags.length ? `**Acciones:**\n${flags.map(f => `- ${f}`).join('\n')}` : `✅ Todo verde. Pa' añadir proveedores nuevos de NPPES: corre el skill \`/registro-sync\`.`);

  const { error } = await svc.from('nightly_receipts').insert({
    routine: 'registro-qc', run_date: runDate, summary_md: summary,
    actions: flags, reviewed_by_angel: false,
  });
  if (error) return res.status(200).json({ success: false, error: error.message });
  return res.status(200).json({ success: true, run_date: runDate, total, flags: flags.length });
}

async function runDatoDelDia(res: any) {
  const svc = createClient(
    process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  const now = new Date();
  const runDate = now.toISOString().slice(0, 10);
  // Idempotente: si ya hay Dato del Día de hoy, no dupliques.
  const { data: existing } = await svc.from('nightly_receipts')
    .select('id').eq('routine', 'dato-del-dia').eq('run_date', runDate).limit(1);
  if (existing && existing.length) return res.status(200).json({ success: true, skipped: 'already exists for ' + runDate });

  const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - startOfYear) / 86400000);
  const pick = DATOS_DEL_DIA[dayOfYear % DATOS_DEL_DIA.length];
  const post = `${pick.t}\n\n🔗 ${pick.u}\n\n— Angel | Menos revolú, más sistema, mejor vida.`;

  const summary = `📲 **Dato del Día** (${runDate}) — copia y pega en FB/IG/WhatsApp. Cada dato con su fuente y su backlink al récord.\n\n> ${pick.t}\n> 🔗 ${pick.u}`;

  const { error } = await svc.from('nightly_receipts').insert({
    routine: 'dato-del-dia',
    run_date: runDate,
    summary_md: summary,
    drafts: [{ platform: 'facebook', text: post }],
    reviewed_by_angel: false,
  });
  if (error) return res.status(200).json({ success: false, error: error.message });
  return res.status(200).json({ success: true, run_date: runDate, dato_index: dayOfYear % DATOS_DEL_DIA.length, url: pick.u });
}
