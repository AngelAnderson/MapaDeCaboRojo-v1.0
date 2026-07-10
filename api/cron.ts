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
      default:
        return res.status(400).json({ error: `Unknown job: ${job}. Use ?job=briefing|maintenance|vibe|alertas|dato` });
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
