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
      default:
        return res.status(400).json({ error: `Unknown job: ${job}. Use ?job=briefing|maintenance|vibe` });
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
