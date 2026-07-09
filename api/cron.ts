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
      default:
        return res.status(400).json({ error: `Unknown job: ${job}. Use ?job=briefing|maintenance|vibe|alertas` });
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

    const items = matches.map((m: any) =>
      `<li style="margin:6px 0"><strong>${escH(String(m.name).replace(/^Dr\(a\)\.\s*/, ''))}</strong> · ${escH(m.subcategory)}${m.phone ? ` · ${escH(m.phone)}` : ''}<br><a href="https://registromedicopr.com/especialista/${encodeURIComponent(m.slug)}" style="color:#0f766e">Ver el perfil verificado →</a></li>`
    ).join('');
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Registro Médico PR <newsletter@mapadecaborojo.com>',
          to: a.email,
          reply_to: 'angel@angelanderson.com',
          subject: `Llegó ${matches.length === 1 ? 'un especialista nuevo' : `${matches.length} especialistas nuevos`} a ${a.municipio}`,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
<p>Me pediste que te avisara cuando apareciera ${a.specialty ? `un <strong>${escH(a.specialty)}</strong>` : 'un especialista nuevo'} verificado en <strong>${escH(a.municipio)}</strong>. Llegó:</p>
<ul style="padding-left:18px">${items}</ul>
<p style="font-size:14px;color:#475569">Antes de ir, llama y confirma que acepta tu plan y que está cogiendo pacientes nuevos. Los teléfonos y planes cambian.</p>
<p style="font-size:14px">Tu pueblo completo: <a href="https://registromedicopr.com/pueblo" style="color:#0f766e">registromedicopr.com/pueblo</a></p>
<p style="font-size:13px;color:#64748b">Esta alerta era de una sola vez: no te vuelvo a escribir a menos que la pidas de nuevo. Si quieres otra, actívala en la página de tu pueblo.<br>- Angel | Menos revolú, más sistema, mejor vida.</p>
</div>`,
        }),
      });
      if (!r.ok) { report.push(`FAIL ${a.email} (${a.municipio}): HTTP ${r.status}`); continue; }
    } catch (e: any) {
      report.push(`FAIL ${a.email} (${a.municipio}): ${e?.message || 'fetch error'}`);
      continue;
    }
    await svc.from('registro_alerts').update({ notified_at: new Date().toISOString() }).eq('id', a.id);
    notified++;
    report.push(`OK ${a.email} → ${a.municipio}${a.specialty ? ` (${a.specialty})` : ''}: ${matches.length} match(es)`);
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
  return res.status(200).json({ success: true, notified, report });
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
