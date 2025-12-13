
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

export default async function handler(req: any, res: any) {
  // 1. Method & Auth Check
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  // Basic security: Check for a simple secret or just rely on obfuscation for now (since it's a demo)
  // Ideally, validate session token passed in headers here.

  const { placeId, googlePlaceId } = req.body;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_PLACES_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'Server Config Error: Missing Google API Key' });
  if (!placeId || !googlePlaceId) return res.status(400).json({ error: 'Missing Place ID or Google Place ID' });

  try {
    // 2. Fetch from Google
    // We request specific fields to manage cost
    const fields = 'name,formatted_address,geometry,website,international_phone_number,opening_hours,price_level,rating,photos,business_status';
    const googleUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${googlePlaceId}&fields=${fields}&language=es&key=${apiKey}`;
    
    const gRes = await fetch(googleUrl);
    const gData = await gRes.json();

    if (!gRes.ok || gData.status !== 'OK') {
        throw new Error(gData.error_message || 'Google API Error');
    }

    const details = gData.result;

    // 3. Map Google Data to Supabase Schema
    // We only update fields that are usually dynamic. We leave Descriptions and Tags alone as those are curated.
    
    // Process Hours
    let dbHours = { type: 'fixed', note: '', structured: [] };
    if (details.opening_hours) {
        dbHours.note = details.opening_hours.weekday_text?.join(', ') || '';
        // Note: Full structured parsing would go here, but for now we store the text note
        // to avoid overwriting complex manual schedules with bad parsing.
    }

    // Process Status
    const isClosed = details.business_status === 'CLOSED_TEMPORARILY' || details.business_status === 'CLOSED_PERMANENTLY';
    
    const updates: any = {
        rating: details.rating || null,
        price_level: details.price_level ? '$'.repeat(details.price_level) : '$',
        phone: details.international_phone_number || '',
        website: details.website || '',
        address: details.formatted_address || '',
        status: isClosed ? 'closed' : 'open',
        // Update amenities/meta
        updated_at: new Date().toISOString() // Assuming you add this column later, otherwise ignored
    };

    // Only update lat/lng if they moved significantly (or were missing)
    if (details.geometry?.location) {
        updates.lat = details.geometry.location.lat;
        updates.lon = details.geometry.location.lng;
    }

    // 4. Update Supabase
    const { error } = await supabase
        .from('places')
        .update(updates)
        .eq('id', placeId);

    if (error) throw error;

    // 5. Log Action
    await supabase.from('admin_logs').insert([{
        action: 'UPDATE',
        place_name: details.name || 'Unknown',
        details: `Manual Sync with Google. Rating: ${details.rating}, Status: ${details.business_status}`,
        created_at: new Date().toISOString()
    }]);

    return res.status(200).json({ success: true, data: updates });

  } catch (e: any) {
    console.error("Sync Error:", e);
    return res.status(500).json({ error: e.message });
  }
}
