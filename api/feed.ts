/**
 * RSS Feed — Latest businesses on MapaDeCaboRojo
 *
 * GET /api/feed → RSS 2.0 XML
 * Serves the 50 most recently updated businesses.
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
      .select('name, slug, id, description, category, address, updated_at')
      .eq('status', 'open')
      .eq('visibility', 'published')
      .order('updated_at', { ascending: false })
      .limit(50);

    const baseUrl = 'https://www.mapadecaborojo.com';
    const now = new Date().toUTCString();

    const items = (places || []).map((p: any) => {
      const slug = p.slug || p.id;
      const pubDate = p.updated_at ? new Date(p.updated_at).toUTCString() : now;
      const desc = p.description
        ? `<![CDATA[${p.description.slice(0, 500)}]]>`
        : `Negocio en ${p.category || 'Cabo Rojo'}`;
      return `    <item>
      <title>${escapeXml(p.name)}</title>
      <link>${baseUrl}/negocio/${slug}</link>
      <guid isPermaLink="true">${baseUrl}/negocio/${slug}</guid>
      <description>${desc}</description>
      <category>${escapeXml(p.category || 'General')}</category>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Mapa de Cabo Rojo — Directorio de Negocios</title>
    <link>${baseUrl}</link>
    <description>Los negocios de Cabo Rojo, Puerto Rico. Actualizado diariamente.</description>
    <language>es</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${baseUrl}/api/feed" rel="self" type="application/rss+xml" />
${items.join('\n')}
  </channel>
</rss>`;

    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).send(xml);
  } catch (e) {
    console.error('RSS feed error:', e);
    return res.status(500).json({ error: 'Error generating feed' });
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
