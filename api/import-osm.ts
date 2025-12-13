
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

// Bounding Box for Cabo Rojo (South, West, North, East)
// Covering from Boquerón/Combate up to Miradero/Joyuda
const BBOX = "17.85,-67.25,18.15,-67.10";

export default async function handler(req: any, res: any) {
  // Method Check
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { categoryKey } = req.body;

  // Map App Categories to Overpass QL filters
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

  if (!selectedQuery) {
    return res.status(400).json({ error: "Invalid Category Key" });
  }

  const overpassUrl = "https://overpass-api.de/api/interpreter";
  // Query construction: Output JSON, timeout 25s, find nodes, output body + recursive down, output skeleton
  const query = `
    [out:json][timeout:25];
    (
      ${selectedQuery}
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const response = await fetch(`${overpassUrl}?data=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error("Overpass API Connection Failed");
    const data = await response.json();

    // Transform OSM Data to App Interface
    const mapped = data.elements
      .filter((el: any) => el.tags && el.tags.name) // Must have a name
      .map((el: any) => {
        const tags = el.tags;
        
        // Determine exact category mapping
        let subcat = categoryKey || 'SERVICE';
        
        // Extract contact info
        const phone = tags['phone'] || tags['contact:phone'] || '';
        const website = tags['website'] || tags['contact:website'] || tags['facebook'] || '';
        const street = tags['addr:street'] || '';
        const number = tags['addr:housenumber'] || '';
        const address = street ? `${street} ${number}, Cabo Rojo, PR` : 'Cabo Rojo, PR';

        // Basic Opening Hours parsing (raw string)
        const hoursRaw = tags['opening_hours'];

        return {
          name: tags.name,
          description: tags.description || (tags.cuisine ? `${tags.cuisine} cuisine.` : `Located in Cabo Rojo.`),
          category: subcat,
          coords: { lat: el.lat, lng: el.lon },
          address: address,
          phone: phone,
          website: website,
          gmapsUrl: `https://www.google.com/maps/search/?api=1&query=${el.lat},${el.lon}`,
          tags: ['OSM Import', tags.cuisine, tags.amenity].filter(Boolean),
          opening_hours: { 
              type: hoursRaw ? 'fixed' : undefined,
              note: hoursRaw || '' 
          },
          status: 'open',
          amenities: {
             parking: 'FREE', // Default assumption
             hasRestroom: false,
             isPetFriendly: false
          }
        };
      });

    // Deduplication Logic
    // 1. Fetch all existing place names from DB
    const { data: existing } = await supabase.from('places').select('name');
    const existingNames = new Set((existing || []).map((p: any) => p.name.toLowerCase().trim()));

    // 2. Filter out names that exist
    const fresh = mapped.filter((p: any) => !existingNames.has(p.name.toLowerCase().trim()));

    return res.status(200).json({ 
      success: true, 
      count: fresh.length, 
      totalFound: mapped.length, 
      results: fresh 
    });

  } catch (e: any) {
    console.error("OSM Import Error:", e);
    return res.status(500).json({ error: e.message });
  }
}
