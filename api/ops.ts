
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";

// Initialize Clients
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

// Admin client (service role) — only initialized for user management actions
function getAdminClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

const CORS_HEADERS_OPS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Constants
const BBOX = "17.85,-67.25,18.15,-67.10"; // Cabo Rojo Bounding Box
const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

export default async function handler(req: any, res: any) {
  // CORS preflight
  Object.entries(CORS_HEADERS_OPS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Action can come from query string (user management) or body (ops actions)
  const queryAction = req.query?.action as string | undefined;
  const bodyData = req.body || {};
  const action = queryAction || bodyData.action;
  const payload = queryAction ? bodyData : (() => { const { action: _a, ...rest } = bodyData; return rest; })();

  // ── User management actions (formerly api/admin-users.ts) ──────────────────
  const userActions = new Set(['list', 'create', 'reset-password', 'delete', 'update-profile']);
  if (userActions.has(action)) {
    return await handleUserAction(action, req, res);
  }

  // ── Ops actions (original) ──────────────────────────────────────────────────
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    switch (action) {
      case 'sync-place':
        return await handleSyncPlace(payload, res);
      case 'import-osm':
        return await handleImportOsm(payload, res);
      case 'import-wikidata':
        return await handleImportWikidata(payload, res);
      case 'sync-weather':
        return await handleSyncWeather(payload, res);
      case 'sync-vibe':
        return await handleSyncVibe(payload, res);
      default:
        return res.status(400).json({ error: "Unknown action" });
    }
  } catch (e: any) {
    console.error(`Ops API Error [${action}]:`, e);
    return res.status(500).json({ error: e.message });
  }
}

// ── User management handler (from admin-users.ts) ────────────────────────────

async function handleUserAction(action: string, req: any, res: any) {
  const supabaseAdmin = getAdminClient();

  // Auth check
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    switch (action) {
      case 'list': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
        const { data, error } = await supabaseAdmin.auth.admin.listUsers();
        if (error) throw error;
        const users = data.users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.user_metadata?.name || '',
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
        }));
        return res.status(200).json({ users });
      }

      case 'create': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const { email, password, name } = req.body || {};
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name: name || '' },
        });
        if (error) throw error;
        return res.status(200).json({ user: data.user });
      }

      case 'reset-password': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const { userId, newPassword } = req.body || {};
        if (!userId || !newPassword) return res.status(400).json({ error: 'userId and newPassword required' });
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case 'delete': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const { userId } = req.body || {};
        if (!userId) return res.status(400).json({ error: 'userId required' });
        if (userId === user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case 'update-profile': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const { name } = req.body || {};
        const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          user_metadata: { name: name || '' },
        });
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (err: any) {
    console.error('[ops/user-action]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

// --- HANDLERS ---

async function handleSyncPlace({ placeId, googlePlaceId }: any, res: any) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_PLACES_API_KEY;
  if (!apiKey || !placeId || !googlePlaceId) throw new Error("Missing Config or IDs");

  const fields = 'name,formatted_address,geometry,website,international_phone_number,opening_hours,price_level,rating,photos,business_status';
  const googleUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${googlePlaceId}&fields=${fields}&language=es&key=${apiKey}`;
  
  const gRes = await fetch(googleUrl);
  const gData = await gRes.json();

  if (!gRes.ok || gData.status !== 'OK') throw new Error(gData.error_message || 'Google API Error');

  const details = gData.result;
  const isClosed = details.business_status === 'CLOSED_TEMPORARILY' || details.business_status === 'CLOSED_PERMANENTLY';
  
  const updates: any = {
      rating: details.rating || null,
      price_level: details.price_level ? '$'.repeat(details.price_level) : '$',
      phone: details.international_phone_number || '',
      website: details.website || '',
      address: details.formatted_address || '',
      status: isClosed ? 'closed' : 'open',
      updated_at: new Date().toISOString()
  };

  if (details.geometry?.location) {
      updates.lat = details.geometry.location.lat;
      updates.lon = details.geometry.location.lng;
  }

  await supabase.from('places').update(updates).eq('id', placeId);
  
  await supabase.from('admin_logs').insert([{
      action: 'UPDATE',
      place_name: details.name || 'Unknown',
      details: `Manual Sync. Rating: ${details.rating}`,
      created_at: new Date().toISOString()
  }]);

  return res.status(200).json({ success: true, data: updates });
}

async function handleImportOsm({ categoryKey }: any, res: any) {
  const queries: Record<string, string> = {
    'FOOD': `node["amenity"~"restaurant|cafe|fast_food|ice_cream|bar|pub"](${BBOX});`,
    'NIGHTLIFE': `node["amenity"~"bar|pub|nightclub|biergarten"](${BBOX});`,
    'LODGING': `node["tourism"~"hotel|motel|guest_house|hostel|camp_site"](${BBOX});`,
    'BEACH': `node["natural"="beach"](${BBOX}); node["leisure"="beach_resort"](${BBOX});`,
    'HEALTH': `node["amenity"~"pharmacy|hospital|doctors|clinic"](${BBOX});`,
    'SHOPPING': `node["shop"~"supermarket|convenience|bakery|alcohol|beverages"](${BBOX});`,
    'LOGISTICS': `node["amenity"="fuel"](${BBOX}); node["amenity"="parking"](${BBOX});`,
    'SIGHTS': `node["tourism"~"attraction|viewpoint|museum|artwork"](${BBOX}); node["historic"](${BBOX});`,
    'SERVICE': `node["amenity"~"bank|post_office|police|fire_station"](${BBOX});`
  };

  const selectedQuery = queries[categoryKey];
  if (!selectedQuery) throw new Error("Invalid Category Key");

  const query = `[out:json][timeout:25];(${selectedQuery});out body;>;out skel qt;`;
  const overpassUrl = "https://overpass-api.de/api/interpreter";
  
  const response = await fetch(`${overpassUrl}?data=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error("Overpass API Failed");
  const data = await response.json();

  const mapped = data.elements
    .filter((el: any) => el.tags && el.tags.name)
    .map((el: any) => ({
      name: el.tags.name,
      description: el.tags.description || (el.tags.cuisine ? `${el.tags.cuisine} cuisine.` : `Located in Cabo Rojo.`),
      category: categoryKey || 'SERVICE',
      coords: { lat: el.lat, lng: el.lon },
      address: el.tags['addr:street'] ? `${el.tags['addr:street']} ${el.tags['addr:housenumber'] || ''}` : 'Cabo Rojo, PR',
      phone: el.tags['phone'] || '',
      website: el.tags['website'] || '',
      gmapsUrl: `https://www.google.com/maps/search/?api=1&query=${el.lat},${el.lon}`,
      tags: ['OSM Import', el.tags.cuisine].filter(Boolean),
      status: 'open',
      amenities: { parking: 'FREE' }
    }));

  const { data: existing } = await supabase.from('places').select('name');
  const existingNames = new Set((existing || []).map((p: any) => p.name.toLowerCase().trim()));
  const fresh = mapped.filter((p: any) => !existingNames.has(p.name.toLowerCase().trim()));

  return res.status(200).json({ success: true, count: fresh.length, results: fresh });
}

async function handleImportWikidata(_: any, res: any) {
  const sparql = `
    SELECT DISTINCT ?item ?itemLabel ?itemDescription ?image ?coord WHERE {
      SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
      ?item wdt:P131 wd:Q660233.
      OPTIONAL { ?item wdt:P18 ?image. }
      OPTIONAL { ?item wdt:P625 ?coord. }
      VALUES ?type { wd:Q570116 wd:Q4989906 wd:Q33506 wd:Q40080 wd:Q811979 }
      ?item wdt:P31 ?type.
    } LIMIT 50
  `;
  const fullUrl = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`;
  const wdRes = await fetch(fullUrl, { headers: { 'User-Agent': 'CaboRojoMap/2.0' } });
  if (!wdRes.ok) throw new Error("Wikidata Failed");
  const data = await wdRes.json();

  const mapped = data.results.bindings
    .filter((b: any) => b.itemLabel && b.itemLabel.value && b.coord)
    .map((b: any) => {
      let lat = 0, lng = 0;
      if (b.coord && b.coord.value) {
          const raw = b.coord.value.replace('Point(', '').replace(')', '');
          const [lonStr, latStr] = raw.split(' ');
          lng = parseFloat(lonStr);
          lat = parseFloat(latStr);
      }
      return {
        name: b.itemLabel.value,
        description: b.itemDescription ? b.itemDescription.value : "Sitio histórico.",
        category: 'SIGHTS',
        coords: { lat, lng },
        website: b.item.value,
        gmapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
        imageUrl: b.image ? b.image.value : "",
        tags: ['Wikidata Import'],
        status: 'open'
      };
    });

  const { data: existing } = await supabase.from('places').select('name');
  const existingNames = new Set((existing || []).map((p: any) => p.name.toLowerCase().trim()));
  const fresh = mapped.filter((p: any) => !existingNames.has(p.name.toLowerCase().trim()));

  return res.status(200).json({ success: true, count: fresh.length, results: fresh });
}

async function handleSyncWeather({ placeId, lat, lon }: any, res: any) {
    if (!placeId || !lat || !lon) throw new Error("Missing coordinates");
    
    const weatherUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_direction,wind_wave_height&timezone=America%2FPuerto_Rico`;
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=uv_index,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FPuerto_Rico`;

    const [marineRes, forecastRes] = await Promise.all([fetch(weatherUrl), fetch(forecastUrl)]);
    const marineData = await marineRes.json();
    const forecastData = await forecastRes.json();

    const waveHeightFt = marineData.current?.wave_height ? (marineData.current.wave_height * 3.28084).toFixed(1) : '0';
    let condition = Number(waveHeightFt) > 4 ? "Rough" : "Calm";

    const report = {
        waves: `${waveHeightFt} ft`,
        wind: `${forecastData.current?.wind_speed_10m || 0} mph`,
        uv: forecastData.current?.uv_index || 0,
        condition: condition,
        updated_at: new Date().toISOString()
    };

    const { data: curr } = await supabase.from('places').select('amenities').eq('id', placeId).single();
    await supabase.from('places').update({ amenities: { ...(curr?.amenities||{}), surf_report: report } }).eq('id', placeId);

    return res.status(200).json({ success: true, data: report });
}

async function handleSyncVibe({ placeId, googlePlaceId }: any, res: any) {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_PLACES_API_KEY;
    if (!apiKey) throw new Error("Missing API Key");

    const gUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${googlePlaceId}&fields=name,reviews&language=es&key=${apiKey}`;
    const gRes = await fetch(gUrl);
    const gData = await gRes.json();

    if (gData.status !== 'OK' || !gData.result.reviews) throw new Error('No reviews found');

    const reviewsText = gData.result.reviews.slice(0, 8).map((r: any) => `"${r.text}"`).join('\n');
    const prompt = `Act as "El Veci". Summarize VIBE of "${gData.result.name}": ${reviewsText}. Max 15 words. Puerto Rican Spanish.`;
    
    const aiResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    const vibeSummary = aiResponse.text?.trim() || "Buen ambiente.";

    const { data: curr } = await supabase.from('places').select('amenities').eq('id', placeId).single();
    await supabase.from('places').update({ amenities: { ...(curr?.amenities||{}), vibe_check: { text: vibeSummary, date: new Date().toISOString() } } }).eq('id', placeId);

    return res.status(200).json({ success: true, data: { text: vibeSummary } });
}
