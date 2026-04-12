import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export default async function handler(req: any, res: any) {
  // Security: Vercel Cron requests include this header
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: logs } = await supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(50);
  const { data: places } = await supabase.from('places').select('name');

  const logText = logs ? logs.map((l: any) => `${l.action}: ${l.place_name} [${l.details}]`).join('\n') : "No data.";
  const placeText = places ? places.map((p: any) => p.name).join(', ') : "";

  const prompt = `Act as Business Analyst for Cabo Rojo Tourism App. Analyze logs: ${logText}. Inventory: ${placeText.substring(0,300)}. Generate Morning Briefing JSON { "en": "html", "es": "html" } with sections: Pulse, Trends, Actions, Opportunity.`;

  try {
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
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
}