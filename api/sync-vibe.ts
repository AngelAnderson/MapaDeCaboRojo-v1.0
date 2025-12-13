
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { placeId, googlePlaceId } = req.body;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_PLACES_API_KEY;

  if (!placeId || !googlePlaceId || !apiKey) {
    return res.status(400).json({ error: 'Missing Place ID, Google ID or API Key' });
  }

  try {
    // 1. Fetch Reviews from Google
    // We reuse the logic from the proxy conceptually, but fetch directly here for speed/server-side context
    const fields = 'name,reviews';
    const googleUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${googlePlaceId}&fields=${fields}&language=es&key=${apiKey}`;
    
    const gRes = await fetch(googleUrl);
    const gData = await gRes.json();

    if (!gRes.ok || gData.status !== 'OK' || !gData.result.reviews) {
        throw new Error('No reviews found or API error');
    }

    const reviews = gData.result.reviews.slice(0, 8); // Take top 8
    const reviewsText = reviews.map((r: any) => `"${r.text}" (Rating: ${r.rating})`).join('\n');

    // 2. Analyze with Gemini
    const prompt = `
        Act as "El Veci", a local guide in Puerto Rico.
        Analyze these recent reviews for "${gData.result.name}".
        
        Reviews:
        ${reviewsText}

        Task: Write a "Vibe Check" summary in Spanish (Puerto Rican style, casual but useful).
        - Max 15 words.
        - Focus on the *current* atmosphere (e.g., service speed, crowd, music, food quality).
        - Be honest based on the reviews. If they complain about waiting, mention it politely (e.g. "Se llena full, ve con paciencia").
        
        Output ONLY the summary text.
    `;

    const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });

    const vibeSummary = aiResponse.text?.trim() || "Buen ambiente.";

    // 3. Update Supabase
    const { data: currentPlace } = await supabase.from('places').select('amenities').eq('id', placeId).single();
    
    const existingAmenities = currentPlace?.amenities || {};
    const updatedAmenities = {
        ...existingAmenities,
        vibe_check: {
            text: vibeSummary,
            date: new Date().toISOString()
        }
    };

    const { error } = await supabase
        .from('places')
        .update({ amenities: updatedAmenities })
        .eq('id', placeId);

    if (error) throw error;

    // 4. Log
    await supabase.from('admin_logs').insert([{
        action: 'UPDATE',
        place_name: `Vibe Sync: ${gData.result.name}`,
        details: vibeSummary,
        created_at: new Date().toISOString()
    }]);

    return res.status(200).json({ success: true, data: updatedAmenities.vibe_check });

  } catch (e: any) {
    console.error("Vibe Sync Error:", e);
    return res.status(500).json({ error: e.message });
  }
}
