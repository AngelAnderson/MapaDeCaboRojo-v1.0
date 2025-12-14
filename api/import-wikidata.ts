
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // SPARQL Query for Cabo Rojo (Q660233)
  // We want items located in Cabo Rojo that are landmarks, history, or geography
  const sparql = `
    SELECT DISTINCT ?item ?itemLabel ?itemDescription ?image ?coord ?typeLabel WHERE {
      SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
      
      # Item located in administrative territorial entity -> Cabo Rojo (Q660233)
      ?item wdt:P131 wd:Q660233.
      
      # Optional: Image
      OPTIONAL { ?item wdt:P18 ?image. }
      
      # Optional: Coordinate location
      OPTIONAL { ?item wdt:P625 ?coord. }
      
      # Filter for relevant instance types (Historic, Monument, Beach, Protected Area, Museum)
      VALUES ?type { 
        wd:Q570116   # Tourist attraction
        wd:Q4989906  # Monument
        wd:Q33506    # Museum
        wd:Q40080    # Beach
        wd:Q811979   # Architectural structure
        wd:Q2065736  # Cultural property
        wd:Q108325   # Historic house
      }
      ?item wdt:P31 ?type.
    }
    LIMIT 50
  `;

  try {
    const fullUrl = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`;
    
    const wdRes = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'CaboRojoMap/2.0 (angel@caborojo.com) mapadecaborojo.com' // Wikidata requires User-Agent
      }
    });

    if (!wdRes.ok) throw new Error(`Wikidata Error: ${wdRes.statusText}`);
    const data = await wdRes.json();

    // Map to App Schema
    const mapped = data.results.bindings
      .filter((b: any) => b.itemLabel && b.itemLabel.value && b.coord) // Must have name & coords
      .map((b: any) => {
        // Extract Coords "Point(-67.1932 17.9377)"
        let lat = 0, lng = 0;
        if (b.coord && b.coord.value) {
            const raw = b.coord.value.replace('Point(', '').replace(')', '');
            const [lonStr, latStr] = raw.split(' ');
            lng = parseFloat(lonStr);
            lat = parseFloat(latStr);
        }

        // Determine Category
        let category = 'SIGHTS';
        const label = b.itemLabel.value.toLowerCase();
        if (label.includes('playa') || label.includes('beach') || label.includes('balneario')) category = 'BEACH';
        if (label.includes('museo') || label.includes('museum')) category = 'CULTURE';
        if (label.includes('monumento') || label.includes('statue')) category = 'HISTORY';

        return {
          name: b.itemLabel.value,
          description: b.itemDescription ? b.itemDescription.value : "Sitio histórico en Cabo Rojo.",
          category: category,
          coords: { lat, lng },
          address: "Cabo Rojo, Puerto Rico",
          phone: "",
          website: b.item.value, // Link to Wikidata
          gmapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
          imageUrl: b.image ? b.image.value : "",
          tags: ['Wikidata Import', 'History', 'Culture'],
          status: 'open',
          amenities: {
             parking: 'FREE',
             hasRestroom: false,
             isPetFriendly: true
          }
        };
      });

    // Deduplication (Simple name check against DB)
    const { data: existing } = await supabase.from('places').select('name');
    const existingNames = new Set((existing || []).map((p: any) => p.name.toLowerCase().trim()));
    const fresh = mapped.filter((p: any) => !existingNames.has(p.name.toLowerCase().trim()));

    return res.status(200).json({ 
      success: true, 
      count: fresh.length, 
      totalFound: mapped.length, 
      results: fresh 
    });

  } catch (e: any) {
    console.error("Wikidata Import Error:", e);
    return res.status(500).json({ error: e.message });
  }
}
