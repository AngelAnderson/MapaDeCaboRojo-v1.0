import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwcmp0ZXFnbWFubnR2aXNqcnZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NDAwODgsImV4cCI6MjA4MDAxNjA4OH0.JBRyroLWbjh6Ow9un24c77mbr_zl9P7hdd6YUzt8LgY'
);

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

export default async function handler(req: any, res: any) {
  const { data: places, error } = await supabase
    .from('places')
    .select('id,name,slug,category,subcategory,description,address,phone,website,opening_hours,amenities,status,google_rating')
    .order('category', { ascending: true });

  if (error) {
    res.status(500).send('# Error loading directory');
    return;
  }

  const lines: string[] = [
    '# MapaDeCaboRojo.com — Directorio Completo de Cabo Rojo, Puerto Rico',
    `# Generado: ${new Date().toISOString()}`,
    `# Total de negocios: ${(places || []).length}`,
    '# Formato: texto plano para LLMs y sistemas de búsqueda',
    '# Fuente: https://mapadecaborojo.com',
    '# API JSON: https://mapadecaborojo.com/api/places',
    '# WhatsApp / SMS: +1-787-417-7711',
    '',
    '---',
    '',
  ];

  for (const p of (places || [])) {
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
  return res.status(200).send(lines.join('\n'));
}
