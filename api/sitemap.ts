
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

export default async function handler(req: any, res: any) {
  try {
    // 1. Fetch Data — paginate to bypass PostgREST 1000-row cap
    const allPlaces: any[] = [];
    for (let page = 0; page < 10; page++) {
      const { data } = await supabase
        .from('places')
        .select('slug, id, verified_at, category')
        .eq('status', 'open')
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (!data || data.length === 0) break;
      allPlaces.push(...data);
      if (data.length < 1000) break;
    }
    const places = allPlaces;

    const { data: events } = await supabase
      .from('events')
      .select('id, start_time')
      .gte('start_time', new Date().toISOString());

    // 2. Base URL
    const baseUrl = 'https://mapadecaborojo.com';
    
    // 3. Build XML
    const urls = [];

    // Static Pages
    urls.push(`
      <url>
        <loc>${baseUrl}/</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
      </url>
    `);

    // LLM discovery files
    urls.push(`
      <url>
        <loc>${baseUrl}/llms.txt</loc>
        <changefreq>weekly</changefreq>
        <priority>0.5</priority>
      </url>
    `);
    urls.push(`
      <url>
        <loc>${baseUrl}/llms-full.txt</loc>
        <changefreq>daily</changefreq>
        <priority>0.5</priority>
      </url>
    `);

    // Category pages
    const categories = ['restaurantes', 'playas', 'salud', 'hospedaje', 'servicios', 'compras', 'entretenimiento', 'turismo', 'deportes', 'belleza', 'automotriz', 'marina', 'educacion', 'gobierno'];
    categories.forEach((cat) => {
      urls.push(`
        <url>
          <loc>${baseUrl}/categoria/${cat}</loc>
          <changefreq>weekly</changefreq>
          <priority>0.7</priority>
        </url>
      `);
    });

    // Dynamic Places — SEO pages at /negocio/[slug]
    if (places) {
      places.forEach((p: any) => {
        const lastMod = p.verified_at ? p.verified_at.split('T')[0] : new Date().toISOString().split('T')[0];
        const slug = p.slug || p.id;
        urls.push(`
          <url>
            <loc>${baseUrl}/negocio/${slug}</loc>
            <lastmod>${lastMod}</lastmod>
            <changefreq>weekly</changefreq>
            <priority>0.8</priority>
          </url>
        `);
      });
    }

    // Dynamic Events
    if (events) {
      events.forEach((e: any) => {
        urls.push(`
          <url>
            <loc>${baseUrl}/?event=${e.id}</loc>
            <lastmod>${e.start_time.split('T')[0]}</lastmod>
            <changefreq>daily</changefreq>
            <priority>0.7</priority>
          </url>
        `);
      });
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${urls.join('')}
    </urlset>`;

    // 4. Return XML
    res.setHeader('Content-Type', 'text/xml');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); // Cache for 1 hour
    return res.status(200).send(xml);

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error generating sitemap' });
  }
}
