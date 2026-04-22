
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
    const baseUrl = 'https://www.mapadecaborojo.com';
    
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
    const categories = ['restaurantes', 'playas', 'salud', 'farmacia', 'dentista', 'veterinario', 'medico', 'hospital', 'laboratorio', 'optica', 'salud-mental', 'quiropractico', 'gimnasio', 'hospedaje', 'servicios', 'compras', 'entretenimiento', 'turismo', 'deportes', 'belleza', 'automotriz', 'marina', 'educacion', 'gobierno'];
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
    // Pharmacy places also get dedicated /farmacia/[slug] pages (Salud layer)
    if (places) {
      places.forEach((p: any) => {
        const lastMod = p.verified_at ? p.verified_at.split('T')[0] : new Date().toISOString().split('T')[0];
        const slug = p.slug || p.id;

        // All businesses get the canonical /negocio/ page
        urls.push(`
          <url>
            <loc>${baseUrl}/negocio/${slug}</loc>
            <lastmod>${lastMod}</lastmod>
            <changefreq>weekly</changefreq>
            <priority>0.8</priority>
          </url>
        `);

        // Health detail pages — route based on category/subcategory
        const catLower = (p.category || '').toLowerCase();
        const subcatLower = (p.subcategory || '').toLowerCase();
        const nameLower = (p.name || '').toLowerCase();

        // Determine health detail route
        let healthRoute: string | null = null;
        if (catLower === 'farmacia' || subcatLower.includes('pharmacy') || subcatLower.includes('farmacia') || nameLower.includes('farmacia') || nameLower.includes('pharmacy')) {
          healthRoute = 'farmacia';
        } else if (subcatLower.includes('dentist') || subcatLower.includes('dentista') || nameLower.includes('dental') || nameLower.includes('dentist')) {
          healthRoute = 'dentista';
        } else if (subcatLower.includes('veterinar') || nameLower.includes('veterinar')) {
          healthRoute = 'veterinario';
        } else if (subcatLower.includes('hospital') || nameLower.includes('hospital') || nameLower.includes('clínica') || nameLower.includes('clinica') || nameLower.includes('cdt')) {
          healthRoute = 'hospital';
        } else if (subcatLower.includes('optom') || subcatLower.includes('óptica') || nameLower.includes('óptica') || nameLower.includes('optica') || nameLower.includes('vision')) {
          healthRoute = 'optica';
        } else if (subcatLower.includes('laboratorio') || nameLower.includes('laboratorio')) {
          healthRoute = 'laboratorio';
        } else if (subcatLower.includes('salud mental') || subcatLower.includes('psicólog') || nameLower.includes('psicólog') || nameLower.includes('psiquiatr')) {
          healthRoute = 'salud-mental';
        } else if (subcatLower.includes('chiropract') || nameLower.includes('quiropract')) {
          healthRoute = 'quiropractico';
        } else if (nameLower.includes('fitness') || nameLower.includes('gym') || nameLower.includes('crossfit')) {
          healthRoute = 'gimnasio';
        } else if (subcatLower.includes('doctor') || nameLower.includes('dr.') || nameLower.includes('dra.')) {
          healthRoute = 'medico';
        }

        if (healthRoute) {
          urls.push(`
            <url>
              <loc>${baseUrl}/${healthRoute}/${slug}</loc>
              <lastmod>${lastMod}</lastmod>
              <changefreq>weekly</changefreq>
              <priority>0.9</priority>
            </url>
          `);
        }
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
