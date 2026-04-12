import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwcmp0ZXFnbWFubnR2aXNqcnZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NDAwODgsImV4cCI6MjA4MDAxNjA4OH0.JBRyroLWbjh6Ow9un24c77mbr_zl9P7hdd6YUzt8LgY'
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req: any, res: any) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

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

  // Filter by search query (name, category, address)
  if (q) {
    results = results.filter((p: any) =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.subcategory || '').toLowerCase().includes(q) ||
      (p.address || '').toLowerCase().includes(q)
    );
  }

  // Filter by category
  if (categoryFilter) {
    results = results.filter((p: any) =>
      (p.category || '').toLowerCase().includes(categoryFilter) ||
      (p.subcategory || '').toLowerCase().includes(categoryFilter)
    );
  }

  // Apply limit
  const total = results.length;
  results = results.slice(0, limit);

  // Shape response
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
  return res.status(200).json({ total, results: shaped });
}
