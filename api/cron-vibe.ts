
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export default async function handler(req: any, res: any) {
  // Security Check (Vercel Cron)
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Get 3 random open places that have a Google Place ID
    // Note: Supabase random selection via SQL function is ideal, but here we'll fetch a batch and pick in JS for simplicity
    const { data: places } = await supabase
      .from('places')
      .select('id, name, gmaps_url')
      .eq('status', 'open')
      .not('gmaps_url', 'is', null)
      .limit(50); // Fetch a pool to pick from

    if (!places || places.length === 0) return res.status(200).json({ msg: "No places found" });

    // Shuffle and pick 3
    const shuffled = places.sort(() => 0.5 - Math.random()).slice(0, 3);
    const updates = [];

    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_PLACES_API_KEY;
    if (!apiKey) throw new Error("Google API Key missing");

    for (const place of shuffled) {
       // Extract Google Place ID
       let gId = '';
       if (place.gmaps_url && place.gmaps_url.includes('place_id:')) {
           gId = place.gmaps_url.split('place_id:')[1].split('&')[0];
       }

       if (gId) {
           // Fetch reviews
           const gUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${gId}&fields=name,reviews&language=es&key=${apiKey}`;
           const gRes = await fetch(gUrl);
           const gData = await gRes.json();

           if (gData.status === 'OK' && gData.result.reviews) {
               // AI Analysis
               const reviewsText = gData.result.reviews.slice(0, 5).map((r: any) => `"${r.text}"`).join('\n');
               const prompt = `Act as "El Veci". Summarize the VIBE of "${place.name}" based on reviews: ${reviewsText}. Max 15 words. Puerto Rican Spanish. Be honest.`;
               
               const aiResponse = await ai.models.generateContent({
                   model: 'gemini-2.5-flash',
                   contents: prompt,
               });
               
               const vibeSummary = aiResponse.text?.trim() || "Buen ambiente.";

               // Save to DB
               // Fetch current amenities first to merge
               const { data: curr } = await supabase.from('places').select('amenities').eq('id', place.id).single();
               const newAmenities = { ...(curr?.amenities || {}), vibe_check: { text: vibeSummary, date: new Date().toISOString() } };

               await supabase.from('places').update({ amenities: newAmenities }).eq('id', place.id);
               updates.push(`${place.name}: ${vibeSummary}`);
           }
       }
    }

    // Log the cron run
    await supabase.from('admin_logs').insert([{
        action: 'UPDATE',
        place_name: 'Vibe Cron',
        details: `Updated ${updates.length} places: ${updates.join(' | ')}`,
        created_at: new Date().toISOString()
    }]);

    return res.status(200).json({ success: true, updates });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
