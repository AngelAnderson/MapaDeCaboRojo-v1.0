
import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

  const { reportText } = req.body; // Admin pastes raw text from PDF/Site

  if (!reportText) return res.status(400).json({ error: "No text provided" });

  try {
    // 1. AI Analysis
    const prompt = `
      Act as a Data Analyst for the Puerto Rico Environmental Quality Board (JCA).
      Analyze this Water Quality Report text:
      "${reportText.substring(0, 5000)}"

      Task: Identify the status of beaches in CABO ROJO (specifically: Buyé, Boquerón, Combate, La Playuela/Sucia).
      
      Output ONLY a JSON Array of objects:
      [
        { "name": "Name of Beach", "status": "SAFE" (Green Flag) or "UNSAFE" (Red/Yellow Flag/Enterococci), "details": "Bacteria levels or specific warning" }
      ]
      
      If a beach is not mentioned, do not include it.
    `;

    const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });

    const parsedResults = JSON.parse(aiResponse.text || "[]");
    const updates = [];

    // 2. Update Database
    for (const result of parsedResults) {
        // Fuzzy match beach name in DB
        const { data: places } = await supabase
            .from('places')
            .select('id, name, amenities')
            .ilike('name', `%${result.name.split(' ')[0]}%`) // Simple first word match usually works for "Buyé", "Combate"
            .eq('category', 'BEACH')
            .limit(1);

        if (places && places.length > 0) {
            const place = places[0];
            const newAmenities = {
                ...(place.amenities || {}),
                water_quality: {
                    status: result.status,
                    date: new Date().toISOString(),
                    details: result.details,
                    source: "JCA Report (AI Parsed)"
                }
            };

            await supabase.from('places').update({ amenities: newAmenities }).eq('id', place.id);
            updates.push(`${place.name}: ${result.status}`);
        }
    }

    // Log
    if (updates.length > 0) {
        await supabase.from('admin_logs').insert([{
            action: 'UPDATE',
            place_name: 'JCA Sync',
            details: `Updated ${updates.length} beaches: ${updates.join(', ')}`,
            created_at: new Date().toISOString()
        }]);
    }

    return res.status(200).json({ success: true, updates });

  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
