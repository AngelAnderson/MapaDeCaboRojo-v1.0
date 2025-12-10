import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

// Initialize Clients (Server-Side)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export default async function handler(request: Request) {
  // 1. Fetch Logs & Context
  const { data: logs } = await supabase
    .from('admin_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: places } = await supabase
    .from('places')
    .select('name');

  const logText = logs ? logs.map((l: any) => `${l.action}: ${l.place_name}`).join('\n') : "No data.";
  const placeText = places ? places.map((p: any) => p.name).join(', ') : "";

  // 2. AI Analysis
  const prompt = `
    Actúa como un Analista de Negocios para una App de Turismo en Cabo Rojo.
    Analiza la actividad de ayer:
    ${logText}

    Inventario actual: ${placeText.substring(0, 200)}...

    Genera un "Morning Briefing" corto en HTML simple (sin head/body, solo p, ul, strong).
    Dime tendencias, qué busca la gente que no tenemos, y una acción recomendada.
  `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });
    
    const briefing = response.text || "No analysis generated.";

    // 3. Save to DB as a special Log
    await supabase.from('admin_logs').insert([{
        action: 'AI_BRIEFING',
        place_name: 'Morning Report',
        details: briefing,
        created_at: new Date().toISOString()
    }]);

    return new Response(JSON.stringify({ success: true, briefing }), {
        headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
}