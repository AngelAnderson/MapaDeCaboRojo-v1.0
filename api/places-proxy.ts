
import { Buffer } from 'buffer';

export default async function handler(req: any, res: any) {
  // Allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Cost guard (CSO 2026-06-02): only serve requests originating from our own site.
  // This is a billed Google Places proxy — without this anyone can run up the bill.
  // Partial mitigation (headers are forgeable); pair with a Vercel Firewall rate-limit rule.
  const ALLOWED_HOSTS = ['mapadecaborojo.com', 'www.mapadecaborojo.com', 'localhost:3000', 'localhost:5173'];
  const ref = (req.headers.referer || req.headers.origin || '') as string;
  let refHost = '';
  try { refHost = ref ? new URL(ref).host : ''; } catch { refHost = ''; }
  if (!ALLOWED_HOSTS.includes(refHost)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Handle query params from req.query (Standard Node/Vercel)
  const { action, query, place_id, reference, session_token, q } = req.query;
  
  // 28 oct 2026: coordenadas sin Google. Los formularios públicos (sugerir / añadir negocio)
  // llegan aquí; antes gastaban Autocomplete + Details solo para sacar lat/lng.
  if (action === 'geocode') {
    try {
      const r = await geocodeGratis(String(q || query || ''));
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).json(r ? { ok: true, ...r } : { ok: false });
    } catch (e) {
      console.error('geocode error', e);
      return res.status(200).json({ ok: false });
    }
  }

  // Solo las acciones de Google (uso de admin) necesitan llave de servidor. Sin fallback a VITE_* (regla del 18 abr 2026).
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error: API key missing.' });
  }

  try {
    let googlePlacesUrl = '';

    if (action === 'autocomplete' && query) {
      googlePlacesUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query as string)}&components=country:pr&language=es&key=${apiKey}`;
      if (session_token) googlePlacesUrl += `&sessiontoken=${encodeURIComponent(session_token as string)}`;
    } 
    else if (action === 'details' && place_id) {
      // Added 'reviews' to fields
      googlePlacesUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place_id as string)}&fields=name,formatted_address,geometry,website,international_phone_number,opening_hours,price_level,rating,photos,editorial_summary,reviews&language=es&key=${apiKey}`;
      if (session_token) googlePlacesUrl += `&sessiontoken=${encodeURIComponent(session_token as string)}`;
    } 
    else if (action === 'photo' && reference) {
      // 1. Construct the Google Photo URL
      googlePlacesUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${reference}&key=${apiKey}`;
      
      // 2. Fetch the image
      const imageResponse = await fetch(googlePlacesUrl);
      
      if (!imageResponse.ok) {
          return res.status(imageResponse.status).send("Failed to fetch image from Google");
      }

      // 3. Forward the image headers and binary data
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await imageResponse.arrayBuffer();
      // Fix: Explicitly use imported Buffer to convert ArrayBuffer
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24h
      return res.send(buffer);
    } 
    else {
      return res.status(400).json({ error: 'Invalid action or missing parameters' });
    }

    // Handle JSON endpoints (autocomplete, details)
    const googleApiResponse = await fetch(googlePlacesUrl);
    const googleApiData = await googleApiResponse.json();

    if (!googleApiResponse.ok) {
      return res.status(googleApiResponse.status).json({ error: googleApiData.error_message || 'Google Places API request failed' });
    }

    return res.status(200).json(googleApiData);

  } catch (error) {
    console.error('places-proxy encountered an error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// Geocodificación gratis (sin Google): 1) coordenadas dentro del link de Google Maps,
// 2) si es link corto (maps.app.goo.gl) se sigue la redirección y se vuelve a leer,
// 3) si no hay coordenadas, Nominatim (OpenStreetMap) con el nombre, limitado a PR.
// Política de Nominatim: User-Agent identificable y ≤1 req/s; este formulario lo cumple de sobra.
// ---------------------------------------------------------------------------
const PR_BBOX = { minLat: 17.80, maxLat: 18.60, minLng: -67.40, maxLng: -65.10 };
const CABO_ROJO_VIEWBOX = '-67.25,18.15,-67.05,17.90'; // lon1,lat1,lon2,lat2
const UA = 'MapaDeCaboRojo/1.0 (+https://mapadecaborojo.com)';

function enPR(lat: number, lng: number) {
  return lat >= PR_BBOX.minLat && lat <= PR_BBOX.maxLat && lng >= PR_BBOX.minLng && lng <= PR_BBOX.maxLng;
}

export function coordsDeTexto(text: string): { lat: number; lng: number } | null {
  let t = String(text || '');
  try { t = decodeURIComponent(t); } catch {}
  const pats = [
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,              // ficha: !3dLAT!4dLNG (la más exacta)
    /[?&](?:q|query|ll|destination|center)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,                  // vista: @LAT,LNG,17z
    /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/,     // "18.08, -67.15" pegado a mano
  ];
  for (const re of pats) {
    const m = t.match(re);
    if (m) {
      const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
      if (enPR(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

function nombreDeUrl(text: string): string {
  try {
    const u = new URL(text);
    const m = u.pathname.match(/\/place\/([^/]+)/);
    if (m) return decodeURIComponent(m[1]).replace(/\+/g, ' ');
    const q = u.searchParams.get('q') || u.searchParams.get('query');
    if (q) return q;
  } catch {}
  return '';
}

async function resolverLinkCorto(url: string): Promise<string> {
  // maps.app.goo.gl / goo.gl/maps contestan 302 con el link largo.
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': UA } });
    const loc = r.headers.get('location');
    if (loc) return loc;
  } catch {}
  return url;
}

type Geo = { lat: number; lng: number; fuente: string; nombre?: string };

// Compuerta de nombre: un geocodificador por nombre se va al vecino con facilidad
// ("Farmacia Encarnación" -> Farmacia El Combate, probado 28 oct 2026). Una coordenada
// equivocada es peor que ninguna: cada palabra útil del pedido tiene que estar en el nombre
// devuelto; si no, se descarta y la ficha queda sin coordenadas (admin las pone, como antes).
const RELLENO = new Set(['de', 'la', 'el', 'los', 'las', 'del', 'y', 'en', 'cabo', 'rojo', 'puerto', 'rico', 'pr', 'inc', 'llc', 'corp']);
function normaliza(t: string): string {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ');
}
export function nombreCoincide(pedido: string, devuelto: string): boolean {
  const toks = normaliza(pedido).split(/\s+/).filter(w => w.length >= 3 && !RELLENO.has(w));
  if (!toks.length) return true; // "Cabo Rojo" a secas: cualquier resultado dentro de PR sirve
  const hay = normaliza(devuelto);
  return toks.every(w => hay.includes(w.length > 5 ? w.slice(0, w.length - 1) : w)); // plural/singular
}

// Photon (Komoot, datos OSM): entiende nombres de negocios y acepta sesgo por coordenadas.
// Probado 28 oct 2026: "Boquerón Cabo Rojo" resuelve; Nominatim con countrycodes=pr devolvía [].
async function photon(qtext: string): Promise<Geo | null> {
  const u = `https://photon.komoot.io/api/?limit=5&lat=18.08&lon=-67.15&q=${encodeURIComponent(qtext)}`;
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!r.ok) return null;
  const j = await r.json();
  for (const f of (j?.features || [])) {
    const c = f?.geometry?.coordinates;
    if (!Array.isArray(c) || c.length < 2) continue;
    const lng = Number(c[0]), lat = Number(c[1]);
    if (!enPR(lat, lng)) continue;
    const pr = f.properties || {};
    const nombre = pr.name || pr.locality || pr.city || '';
    if (!nombreCoincide(qtext, nombre)) continue;
    return { lat, lng, fuente: 'photon', nombre: [pr.name, pr.street, pr.locality || pr.city].filter(Boolean).join(', ') };
  }
  return null;
}

async function nominatim(qtext: string): Promise<Geo | null> {
  const q = /puerto rico|, pr\b/i.test(qtext) ? qtext : `${qtext}, Puerto Rico`;
  const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&viewbox=${CABO_ROJO_VIEWBOX}&q=${encodeURIComponent(q)}`;
  const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'es' } });
  if (!r.ok) return null;
  const arr = await r.json();
  for (const hit of (Array.isArray(arr) ? arr : [])) {
    const lat = parseFloat(hit.lat), lng = parseFloat(hit.lon);
    if (!enPR(lat, lng)) continue;
    const nombre = String(hit.name || hit.display_name || '').split(',')[0];
    if (!nombreCoincide(qtext, nombre)) continue;
    return { lat, lng, fuente: 'nominatim', nombre: hit.display_name };
  }
  return null;
}

async function geocodeNombre(qtext: string): Promise<Geo | null> {
  const clean = qtext.trim();
  if (!clean) return null;
  try { const p = await photon(clean); if (p) return p; } catch (e) { console.error('photon', e); }
  try { return await nominatim(clean); } catch (e) { console.error('nominatim', e); return null; }
}

export async function geocodeGratis(input: string): Promise<Geo | null> {
  let text = String(input || '').trim().slice(0, 500);
  if (!text) return null;
  let c = coordsDeTexto(text);
  if (c) return { ...c, fuente: 'link' };
  if (/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl|g\.co)\//i.test(text)) {
    text = await resolverLinkCorto(text);
    c = coordsDeTexto(text);
    if (c) return { ...c, fuente: 'link-corto' };
  }
  const nombre = /^https?:\/\//i.test(text) ? nombreDeUrl(text) : text;
  if (!nombre) return null;
  return geocodeNombre(nombre);
}
