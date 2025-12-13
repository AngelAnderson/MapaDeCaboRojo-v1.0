
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { placeId, lat, lon } = req.body;

  if (!placeId || !lat || !lon) {
    return res.status(400).json({ error: 'Missing Place ID or Coordinates' });
  }

  try {
    // 1. Fetch Marine Weather from Open-Meteo (Free, No Key)
    const weatherUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_direction,wind_wave_height&timezone=America%2FPuerto_Rico`;
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=uv_index,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FPuerto_Rico`;

    const [marineRes, forecastRes] = await Promise.all([
        fetch(weatherUrl),
        fetch(forecastUrl)
    ]);

    const marineData = await marineRes.json();
    const forecastData = await forecastRes.json();

    // 2. Format Data
    // Wave height is in meters, convert to feet roughly (x 3.28)
    const waveHeightFt = marineData.current?.wave_height ? (marineData.current.wave_height * 3.28084).toFixed(1) : '0';
    const windSpeed = forecastData.current?.wind_speed_10m || 0;
    const uvIndex = forecastData.current?.uv_index || 0;

    let condition = "Calm";
    if (Number(waveHeightFt) > 4) condition = "Rough";
    if (Number(waveHeightFt) > 6) condition = "High Surf Advisory";
    if (Number(waveHeightFt) < 2) condition = "Flat";

    const report = {
        waves: `${waveHeightFt} ft`,
        wind: `${windSpeed} mph`,
        uv: uvIndex,
        condition: condition,
        updated_at: new Date().toISOString()
    };

    // 3. Update Supabase
    // First fetch current amenities to avoid overwriting other data
    const { data: currentPlace } = await supabase.from('places').select('amenities').eq('id', placeId).single();
    
    const existingAmenities = currentPlace?.amenities || {};
    const updatedAmenities = {
        ...existingAmenities,
        surf_report: report
    };

    const { error } = await supabase
        .from('places')
        .update({ amenities: updatedAmenities })
        .eq('id', placeId);

    if (error) throw error;

    // 4. Log
    await supabase.from('admin_logs').insert([{
        action: 'UPDATE',
        place_name: `Weather Sync: ${placeId}`,
        details: `Updated surf report: ${condition}, ${waveHeightFt}ft`,
        created_at: new Date().toISOString()
    }]);

    return res.status(200).json({ success: true, data: report });

  } catch (e: any) {
    console.error("Weather Sync Error:", e);
    return res.status(500).json({ error: e.message });
  }
}
