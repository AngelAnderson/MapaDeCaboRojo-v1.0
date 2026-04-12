import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwcmp0ZXFnbWFubnR2aXNqcnZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NDAwODgsImV4cCI6MjA4MDAxNjA4OH0.JBRyroLWbjh6Ow9un24c77mbr_zl9P7hdd6YUzt8LgY'
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 's-maxage=60',
};

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sendError(res: any, message: string, status = 400) {
  return res.status(status).json({ error: message });
}

// ── Method handlers ────────────────────────────────────────────────────────

async function searchBusinesses(params: {
  query: string;
  category?: string;
  limit?: number;
}) {
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

async function getBusiness(params: { slug: string }) {
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

async function getCategories() {
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

async function getOpenNow(params: { category?: string }) {
  const { category } = params;

  // Get businesses with 24/7 hours or no hours restriction (best-effort without full schedule parsing)
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
  const dayOfWeek = now.getDay(); // 0=Sun … 6=Sat
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const results: any[] = [];

  for (const b of data || []) {
    const hours = b.opening_hours;

    // No hours info → include (we can't rule them out)
    if (!hours) {
      results.push(b);
      continue;
    }

    // 24/7 explicit
    if (hours.type === '24_7' || hours.always_open === true) {
      results.push(b);
      continue;
    }

    // Structured schedule: { schedule: { mon: [{open:"08:00", close:"20:00"}], ... } }
    if (hours.schedule) {
      const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const todayKey = dayKeys[dayOfWeek];
      const todaySlots = hours.schedule[todayKey];
      if (Array.isArray(todaySlots)) {
        for (const slot of todaySlots) {
          const [oh, om] = (slot.open || '00:00').split(':').map(Number);
          const [ch, cm] = (slot.close || '23:59').split(':').map(Number);
          const openMin = oh * 60 + om;
          const closeMin = ch * 60 + cm;
          if (currentMinutes >= openMin && currentMinutes <= closeMin) {
            results.push(b);
            break;
          }
        }
      }
      continue;
    }

    // Fallback: include if we can't parse
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

// ── Main handler ────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  // CORS preflight
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return sendError(res, 'Only POST requests are accepted', 405);
  }

  let body: { method?: string; params?: any } = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    return sendError(res, 'Invalid JSON body');
  }

  const { method, params = {} } = body;
  if (!method) return sendError(res, 'Missing required field: method');

  try {
    let result: any;

    switch (method) {
      case 'search_businesses':
        result = await searchBusinesses(params);
        break;
      case 'get_business':
        result = await getBusiness(params);
        break;
      case 'get_categories':
        result = await getCategories();
        break;
      case 'get_open_now':
        result = await getOpenNow(params);
        break;
      default:
        return sendError(res, `Unknown method: ${method}. Available: search_businesses, get_business, get_categories, get_open_now`);
    }

    return res.status(200).json({ result });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
