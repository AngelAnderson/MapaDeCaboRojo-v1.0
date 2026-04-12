import { createClient } from '@supabase/supabase-js';

// ── Shared anon client ────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwcmp0ZXFnbWFubnR2aXNqcnZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NDAwODgsImV4cCI6MjA4MDAxNjA4OH0.JBRyroLWbjh6Ow9un24c77mbr_zl9P7hdd6YUzt8LgY'
);

async function logApiCall(endpoint: string, method: string | null, query: string | null, userAgent: string | null, ip: string | null, responseCount: number | null) {
  try {
    await supabase.from('api_logs').insert({
      endpoint,
      method,
      query,
      user_agent: (userAgent || '').substring(0, 500),
      ip: (ip || '').substring(0, 45),
      response_count: responseCount
    });
  } catch {} // fire-and-forget, never block the response
}

const CORS_HEADERS_PUBLIC = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION: places  (formerly api/places.ts)
// ═══════════════════════════════════════════════════════════════════════════════

async function handlePlaces(req: any, res: any) {
  const q = (req.query.q as string || '').toLowerCase().trim();
  const categoryFilter = (req.query.category as string || '').toLowerCase().trim();
  const openOnly = req.query.open === 'true';
  const rawLimit = parseInt(req.query.limit as string || '100', 10);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 100 : rawLimit), 500);

  let query = supabase
    .from('places')
    .select('id,name,slug,category,subcategory,lat,lon,image_url,phone,address,status,plan,google_rating,sponsor_weight')
    .order('sponsor_weight', { ascending: false });

  if (openOnly) {
    query = query.eq('status', 'open');
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ error: 'Error fetching places' });
  }

  let results = data || [];

  if (q) {
    results = results.filter((p: any) =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.subcategory || '').toLowerCase().includes(q) ||
      (p.address || '').toLowerCase().includes(q)
    );
  }

  if (categoryFilter) {
    results = results.filter((p: any) =>
      (p.category || '').toLowerCase().includes(categoryFilter) ||
      (p.subcategory || '').toLowerCase().includes(categoryFilter)
    );
  }

  const total = results.length;
  results = results.slice(0, limit);

  const baseUrl = 'https://mapadecaborojo.com';
  const shaped = results.map((p: any) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    category: p.category,
    subcategory: p.subcategory,
    lat: p.lat,
    lon: p.lon,
    image_url: p.image_url || null,
    phone: p.phone || null,
    address: p.address || null,
    status: p.status,
    plan: p.plan,
    google_rating: p.google_rating || null,
    url: `${baseUrl}/negocio/${p.slug || p.id}`,
  }));

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
  logApiCall('places', null, q, req.headers['user-agent'] as string, req.headers['x-forwarded-for'] as string, shaped.length);
  return res.status(200).json({
    total,
    results: shaped,
    powered_by: 'MapaDeCaboRojo.com — Un proyecto de Angel Anderson, Cabo Rojo PR',
    api_docs: 'https://mapadecaborojo.com/.well-known/mcp.json',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION: llms-full  (formerly api/llms-full.ts)
// ═══════════════════════════════════════════════════════════════════════════════

function formatHours(opening_hours: any): string {
  if (!opening_hours) return 'No disponible';
  if (opening_hours.note) return opening_hours.note;
  if (opening_hours.type === 'always_open') return 'Abierto 24 horas';
  if (opening_hours.structured) {
    const parts: string[] = [];
    for (const [day, hours] of Object.entries(opening_hours.structured)) {
      if (hours && typeof hours === 'object' && (hours as any).open) {
        parts.push(`${day}: ${(hours as any).open}–${(hours as any).close}`);
      }
    }
    return parts.length > 0 ? parts.join(', ') : 'No disponible';
  }
  return 'No disponible';
}

function getAmenity(amenities: any, key: string): string {
  if (!amenities || typeof amenities !== 'object') return 'No especificado';
  const val = amenities[key];
  if (val === true || val === 'yes' || val === 'Sí' || val === 'si') return 'Sí';
  if (val === false || val === 'no' || val === 'No') return 'No';
  if (typeof val === 'string') return val;
  return 'No especificado';
}

async function handleLlmsFull(req: any, res: any) {
  const allPlaces: any[] = [];
  for (let page = 0; page < 10; page++) {
    const { data, error } = await supabase
      .from('places')
      .select('id,name,slug,category,subcategory,description,address,phone,website,opening_hours,amenities,status,google_rating')
      .order('category', { ascending: true })
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) { res.status(500).send('# Error loading directory'); return; }
    if (!data || data.length === 0) break;
    allPlaces.push(...data);
    if (data.length < 1000) break;
  }

  const lines: string[] = [
    '# MapaDeCaboRojo.com — Directorio Completo de Cabo Rojo, Puerto Rico',
    `# Generado: ${new Date().toISOString()}`,
    `# Total de negocios: ${allPlaces.length}`,
    '# Formato: texto plano para LLMs y sistemas de búsqueda',
    '# Fuente: https://mapadecaborojo.com',
    '# API JSON: https://mapadecaborojo.com/api/public',
    '# WhatsApp / SMS: +1-787-417-7711',
    '',
    '---',
    '',
  ];

  for (const p of allPlaces) {
    const slug = p.slug || p.id;
    const hours = formatHours(p.opening_hours);
    const parking = getAmenity(p.amenities, 'parking');
    const petFriendly = getAmenity(p.amenities, 'pet_friendly');

    lines.push(`## ${p.name}`);
    lines.push(`- Categoría: ${p.category || 'Sin categoría'}${p.subcategory ? ' / ' + p.subcategory : ''}`);
    if (p.description) lines.push(`- Descripción: ${p.description}`);
    lines.push(`- Dirección: ${p.address || 'No disponible'}`);
    lines.push(`- Teléfono: ${p.phone || 'No disponible'}`);
    lines.push(`- Horario: ${hours}`);
    lines.push(`- Status: ${p.status === 'open' ? 'Abierto' : 'Cerrado'}`);
    if (p.google_rating) lines.push(`- Google Rating: ${p.google_rating}/5`);
    lines.push(`- Estacionamiento: ${parking}`);
    lines.push(`- Pet-friendly: ${petFriendly}`);
    if (p.website) lines.push(`- Web: ${p.website}`);
    lines.push(`- Más info: https://mapadecaborojo.com/negocio/${slug}`);
    lines.push(`- Pregunta a El Veci: sms:+17874177711?body=${encodeURIComponent(p.name)}`);
    lines.push('');
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  logApiCall('llms-full', null, null, req.headers['user-agent'] as string, req.headers['x-forwarded-for'] as string, allPlaces.length);
  return res.status(200).send(lines.join('\n'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION: mcp  (formerly api/mcp.ts)
// ═══════════════════════════════════════════════════════════════════════════════

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function mcpSearchBusinesses(params: { query: string; category?: string; limit?: number }) {
  const { query = '', category, limit = 20 } = params;
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const q = query.toLowerCase().trim();

  let dbQuery = supabase
    .from('places')
    .select('name, slug, category, address, phone, website, status')
    .eq('status', 'open')
    .eq('visibility', 'published')
    .limit(safeLimit);

  if (category) {
    dbQuery = dbQuery.ilike('category', `%${category}%`);
  }
  if (q) {
    dbQuery = dbQuery.or(`name.ilike.%${q}%,tags.cs.{${q}},category.ilike.%${q}%`);
  } else {
    dbQuery = dbQuery.order('name');
  }

  const { data, error } = await dbQuery;
  if (error) throw new Error(error.message);

  return (data || []).map((b: any) => ({
    name: escapeHtml(b.name),
    slug: b.slug,
    category: escapeHtml(b.category),
    address: escapeHtml(b.address),
    phone: escapeHtml(b.phone),
    url: b.website ? escapeHtml(b.website) : `https://mapadecaborojo.com/negocio/${b.slug}`,
  }));
}

async function mcpGetBusiness(params: { slug: string }) {
  const { slug } = params;
  if (!slug) throw new Error('slug is required');

  const { data, error } = await supabase
    .from('places')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Business not found');

  return {
    name: escapeHtml(data.name),
    slug: data.slug,
    category: escapeHtml(data.category),
    address: escapeHtml(data.address),
    phone: escapeHtml(data.phone),
    website: escapeHtml(data.website),
    description: escapeHtml(data.description),
    lat: data.lat,
    lon: data.lon,
    google_rating: data.google_rating,
    status: data.status,
    plan: data.plan,
    opening_hours: data.opening_hours || null,
    amenities: data.amenities || null,
    tips: escapeHtml(data.tips),
    tags: data.tags || [],
    url: `https://mapadecaborojo.com/negocio/${data.slug}`,
  };
}

async function mcpGetCategories() {
  const { data, error } = await supabase
    .from('places')
    .select('category')
    .eq('status', 'open')
    .eq('visibility', 'published')
    .not('category', 'is', null);

  if (error) throw new Error(error.message);

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const cat = row.category?.trim();
    if (cat) counts[cat] = (counts[cat] || 0) + 1;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({ category: escapeHtml(category), count }));
}

async function mcpGetOpenNow(params: { category?: string }) {
  const { category } = params;

  let dbQuery = supabase
    .from('places')
    .select('name, slug, category, address, phone, website, opening_hours')
    .eq('status', 'open')
    .eq('visibility', 'published')
    .limit(50);

  if (category) {
    dbQuery = dbQuery.ilike('category', `%${category}%`);
  }

  const { data, error } = await dbQuery;
  if (error) throw new Error(error.message);

  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const results: any[] = [];

  for (const b of data || []) {
    const hours = b.opening_hours;
    if (!hours) { results.push(b); continue; }
    if (hours.type === '24_7' || hours.always_open === true) { results.push(b); continue; }
    if (hours.schedule) {
      const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const todayKey = dayKeys[dayOfWeek];
      const todaySlots = hours.schedule[todayKey];
      if (Array.isArray(todaySlots)) {
        for (const slot of todaySlots) {
          const [oh, om] = (slot.open || '00:00').split(':').map(Number);
          const [ch, cm] = (slot.close || '23:59').split(':').map(Number);
          if (currentMinutes >= oh * 60 + om && currentMinutes <= ch * 60 + cm) {
            results.push(b);
            break;
          }
        }
      }
      continue;
    }
    results.push(b);
  }

  return results.map((b: any) => ({
    name: escapeHtml(b.name),
    slug: b.slug,
    category: escapeHtml(b.category),
    address: escapeHtml(b.address),
    phone: escapeHtml(b.phone),
    url: b.website ? escapeHtml(b.website) : `https://mapadecaborojo.com/negocio/${b.slug}`,
  }));
}

async function handleMcp(req: any, res: any) {
  // Override CORS for MCP — POST only
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=60');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are accepted' });
  }

  let body: { method?: string; params?: any } = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { method, params = {} } = body;
  if (!method) return res.status(400).json({ error: 'Missing required field: method' });

  try {
    let result: any;
    switch (method) {
      case 'search_businesses':
        result = await mcpSearchBusinesses(params);
        break;
      case 'get_business':
        result = await mcpGetBusiness(params);
        break;
      case 'get_categories':
        result = await mcpGetCategories();
        break;
      case 'get_open_now':
        result = await mcpGetOpenNow(params);
        break;
      default:
        return res.status(400).json({ error: `Unknown method: ${method}. Available: search_businesses, get_business, get_categories, get_open_now` });
    }
    const resultCount = Array.isArray(result) ? result.length : (result ? 1 : 0);
    logApiCall('mcp', method, JSON.stringify(params), req.headers['user-agent'] as string, req.headers['x-forwarded-for'] as string, resultCount);
    return res.status(200).json({ result });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main handler — route by ?action=
// ═══════════════════════════════════════════════════════════════════════════════

export default async function handler(req: any, res: any) {
  // CORS preflight
  Object.entries(CORS_HEADERS_PUBLIC).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = (req.query.action as string || 'places').toLowerCase();

  switch (action) {
    case 'llms-full':
      return handleLlmsFull(req, res);
    case 'mcp':
      return handleMcp(req, res);
    case 'places':
    default:
      return handlePlaces(req, res);
  }
}
