
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

  const logText = logs ? logs.map((l: any) => `${l.action}: ${l.place_name} [${l.details}]`).join('\n') : "No data.";
  const placeText = places ? places.map((p: any) => p.name).join(', ') : "";

  // 2. AI Analysis
  const prompt = `
    Act as a Senior Business Analyst for a Tourism App in Cabo Rojo, Puerto Rico.
    Analyze yesterday's activity logs and the current inventory.

    LOGS:
    ${logText}

    INVENTORY SAMPLE:
    ${placeText.substring(0, 300)}...

    TASK:
    Generate a "Morning Briefing" in a JSON format containing HTML strings for both English and Spanish.
    
    The HTML should be "Dashboard Ready" using Tailwind CSS classes suitable for a Dark Mode UI (text-slate-300, bg-slate-800/50, border-slate-700, text-teal-400 for highlights).
    
    Structure the report with these sections:
    1. 📊 **The Pulse** (General sentiment/activity level)
    2. 🔍 **Search Trends** (What are people looking for? Any gaps?)
    3. 🚨 **Critical Actions** (What needs fixing immediately?)
    4. 💡 **Opportunity** (Marketing or content idea)

    RESPONSE FORMAT (Strict JSON):
    {
      "en": "<div class='space-y-4'>...HTML content...</div>",
      "es": "<div class='space-y-4'>...Contenido HTML...</div>"
    }
  `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    
    // Ensure we store the raw JSON string
    const briefingJson = response.text || "{}";

    // 3. Save to DB as a special Log
    await supabase.from('admin_logs').insert([{
        action: 'AI_BRIEFING',
        place_name: 'Daily Report',
        details: briefingJson, // Storing the JSON string
        created_at: new Date().toISOString()
    }]);

    return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
}
