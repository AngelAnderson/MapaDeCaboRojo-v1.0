/**
 * JSON Feed — Latest businesses on MapaDeCaboRojo
 *
 * GET /api/feed.json → JSON Feed 1.1
 * Modern alternative to RSS for aggregators and AI crawlers.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

export default async function handler(req: any, res: any) {
  try {
    const { data: places } = await supabase
      .from('places')
      .select('name, slug, id, description, category, address, phone, website, updated_at, image_url')
      .eq('status', 'open')
      .eq('visibility', 'published')
      .order('updated_at', { ascending: false })
      .limit(50);

    const baseUrl = 'https://www.mapadecaborojo.com';

    const items = (places || []).map((p: any) => {
      const slug = p.slug || p.id;
      return {
        id: `${baseUrl}/negocio/${slug}`,
        url: `${baseUrl}/negocio/${slug}`,
        title: p.name,
        content_text: p.description || `Negocio en ${p.category || 'Cabo Rojo'}`,
        date_modified: p.updated_at || new Date().toISOString(),
        tags: [p.category].filter(Boolean),
        ...(p.image_url ? { image: p.image_url } : {}),
        _directory: {
          address: p.address,
          phone: p.phone,
          website: p.website,
          category: p.category,
        },
      };
    });

    const feed = {
      version: 'https://jsonfeed.org/version/1.1',
      title: 'Mapa de Cabo Rojo — Directorio de Negocios',
      home_page_url: baseUrl,
      feed_url: `${baseUrl}/api/feed.json`,
      description: 'Los negocios de Cabo Rojo, Puerto Rico. Actualizado diariamente.',
      language: 'es',
      items,
    };

    res.setHeader('Content-Type', 'application/feed+json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).send(JSON.stringify(feed, null, 2));
  } catch (e) {
    console.error('JSON feed error:', e);
    return res.status(500).json({ error: 'Error generating feed' });
  }
}
