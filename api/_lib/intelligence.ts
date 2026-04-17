import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

const SUPABASE_SERVICE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

function periodToDays(period: string): number {
  if (period === '30d') return 30;
  if (period === '90d') return 90;
  return 7;
}

function trendLabel(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

async function checkApiKey(key: string | null): Promise<boolean> {
  if (!key) return false;
  const supa = createClient(SUPABASE_SERVICE_URL, SUPABASE_SERVICE_KEY);
  const { data } = await supa
    .from('api_keys')
    .select('id, active')
    .eq('key', key)
    .eq('active', true)
    .single();
  return !!data;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const apiKey = (req.query.key as string) || (req.headers['x-api-key'] as string) || null;
  const period = (req.query.period as string) || '7d';
  const format = (req.query.format as string) || 'json';
  const days = periodToDays(period);

  // Auth check
  const validKey = await checkApiKey(apiKey);
  if (!validKey) {
    return res.status(401).json({
      error: 'API key requerida. Obtén acceso gratuito en mapadecaborojo.com/turismo',
      docs: 'https://mapadecaborojo.com/turismo'
    });
  }

  const supa = createClient(SUPABASE_SERVICE_URL, SUPABASE_SERVICE_KEY);

  const nowISO = new Date().toISOString();
  const startCurrent = new Date(Date.now() - days * 86400000).toISOString();
  const startPrevious = new Date(Date.now() - days * 2 * 86400000).toISOString();

  // Parallel queries
  const [currentData, previousData] = await Promise.all([
    supa
      .from('demand_signals')
      .select('query_text, query_normalized, category, user_hash, had_results, results_count, created_at')
      .gte('created_at', startCurrent),
    supa
      .from('demand_signals')
      .select('query_text, query_normalized, results_count, had_results, created_at')
      .gte('created_at', startPrevious)
      .lt('created_at', startCurrent)
  ]);

  const rows = currentData.data || [];
  const prevRows = previousData.data || [];

  // Total searches
  const totalSearches = rows.length;
  const uniqueUsers = new Set(rows.map((r: any) => r.user_hash).filter(Boolean)).size;

  // Top terms (current period)
  const termCount: Record<string, number> = {};
  for (const r of rows) {
    const t = (r.query_normalized || r.query_text || '').toLowerCase().trim();
    if (t) termCount[t] = (termCount[t] || 0) + 1;
  }

  // Previous period term counts
  const prevTermCount: Record<string, number> = {};
  for (const r of prevRows) {
    const t = (r.query_text || '').toLowerCase().trim();
    if (t) prevTermCount[t] = (prevTermCount[t] || 0) + 1;
  }

  const topTerms = Object.entries(termCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term, count]) => ({
      term,
      count,
      trend: trendLabel(count, prevTermCount[term] || 0)
    }));

  // Categories demand
  const catCount: Record<string, number> = {};
  for (const r of rows) {
    const c = r.category || 'OTHER';
    catCount[c] = (catCount[c] || 0) + 1;
  }
  const categoriesDemand = Object.entries(catCount)
    .sort((a, b) => b[1] - a[1])
    .map(([category, searches]) => ({ category, searches }));

  // Hourly distribution
  const hourCount: Record<number, number> = {};
  for (let h = 0; h < 24; h++) hourCount[h] = 0;
  for (const r of rows) {
    const h = new Date(r.created_at).getUTCHours();
    hourCount[h] = (hourCount[h] || 0) + 1;
  }
  const hourlyDistribution = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: hourCount[h] || 0
  }));

  // Gaps: queries with no results (had_results = false or results_count = 0)
  const gapCount: Record<string, number> = {};
  for (const r of rows) {
    const noResults = r.had_results === false || r.results_count === 0;
    if (noResults) {
      const t = (r.query_normalized || r.query_text || '').toLowerCase().trim();
      if (t && t.length > 2) gapCount[t] = (gapCount[t] || 0) + 1;
    }
  }
  const gaps = Object.entries(gapCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([term]) => term);

  const payload = {
    period,
    generated_at: nowISO,
    total_searches: totalSearches,
    unique_users: uniqueUsers,
    top_terms: topTerms,
    categories_demand: categoriesDemand,
    hourly_distribution: hourlyDistribution,
    gaps
  };

  if (format === 'csv') {
    const lines = ['term,count,trend'];
    for (const t of topTerms) lines.push(`"${t.term}",${t.count},"${t.trend}"`);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tourism-intelligence-${period}.csv"`);
    return res.status(200).send(lines.join('\n'));
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.status(200).json(payload);
}
