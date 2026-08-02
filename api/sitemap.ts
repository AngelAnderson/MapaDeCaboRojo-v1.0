
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

// Host-aware robots.txt — served via rewrite /robots.txt → /api/sitemap?robots=1
// (the static public/robots.txt was removed: it advertised only mapa+registro
// sitemaps on all three domains, leaving puertoricosinfiltros.com undiscoverable).
const AI_CRAWLERS = ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web', 'anthropic-ai', 'Google-Extended', 'PerplexityBot', 'cohere-ai', 'Applebot-Extended'];

// Las 56 categorías del registro (Fase 2, jul 2026): 32 especialistas + dentista + primaria
// + aliados + facilidades NPI-2. Un proveedor con NPI y una de estas subcategorías es del
// Registro Médico PR: su URL canónica vive en registromedicopr.com/especialista/[slug] y NO
// se anuncia en el sitemap de mapadecaborojo.com (si no, el mismo médico sale dos veces, en
// dos dominios, cada copia auto-canónica — eso es lo que Search Console reporta como
// "Duplicada: Google eligió una versión canónica diferente").
const SPECIALIST_SUBS = ['cardiólogo','psiquiatra','fisiatra','ginecólogo','pediatra','dermatólogo','gastroenterólogo','oftalmólogo','ortopeda','neurólogo','urólogo','endocrinólogo','nefrólogo','neumólogo','oncólogo','reumatólogo','geriatra','otorrinolaringólogo','infectólogo','alergista','medicina de emergencia','cirujano general','anestesiólogo','radiólogo','neurocirujano','cirujano plástico','cirujano torácico','coloproctólogo','manejo de dolor','psicólogo','optómetra','podiatra','dentista','internista','medicina de familia','generalista','va','terapeuta del habla','terapista físico','terapista ocupacional','quiropráctico','consejero','trabajador social','terapeuta de familia','nutricionista','physician assistant','enfermera practicante','audiólogo','partera','farmacéutico','hospital','cuidado en el hogar','hospicio','hogar de envejecientes','centro de diálisis','urgent care','clínica comunitaria','laboratorio clínico','radiología','ambulancia','dentista pediátrico','ortodoncista','cirujano oral','naturópata','acupunturista','neonatólogo','cirujano vascular','patólogo','medicina ocupacional','hospitalista','medicina nuclear','genetista'];

// Espejo EXACTO de api/negocio.ts: un place HEALTH con una de estas subcategorías no se
// sirve en /negocio/[slug], se redirige 301 a /[ruta]/[slug]. El sitemap anuncia el destino,
// nunca la redirección.
const HEALTH_ROUTES: Record<string, string> = {
  farmacia: 'farmacia', dentista: 'dentista', veterinario: 'veterinario',
  medico: 'medico', hospital: 'hospital', laboratorio: 'laboratorio',
  optica: 'optica', 'salud-mental': 'salud-mental', quiropractico: 'quiropractico',
  gimnasio: 'gimnasio',
};

// Espejo EXACTO de api/farmacia.ts: en estas rutas, un proveedor con NPI canonicaliza a
// registromedicopr.com. Anunciarlo en el sitemap de mapa sería pedirle a Google que indexe
// una página que dice "la buena está en el otro dominio".
const REG_ESPECIALISTA_TYPES = new Set(['medico', 'dentista', 'salud-mental', 'quiropractico', 'fisiatra', 'optica']);

function robotsFor(host: string): string {
  const isPRSF = /puertoricosinfiltros\.com/i.test(host);
  const isReg = /registromedicopr\.com/i.test(host);
  const base = isPRSF
    ? 'https://puertoricosinfiltros.com'
    : isReg
      ? 'https://registromedicopr.com'
      : 'https://www.mapadecaborojo.com';
  const lines = [
    '# Crawl-welcome: substrato civic data público de Puerto Rico.',
    '',
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /api/admin/',
    '',
    ...AI_CRAWLERS.flatMap((ua) => [`User-agent: ${ua}`, 'Allow: /', '']),
    `Sitemap: ${base}/sitemap.xml`,
  ];
  if (!isPRSF && !isReg) {
    lines.push('', '# Para LLMs:', `# ${base}/llms.txt`, `# ${base}/llms-full.txt`);
  }
  return lines.join('\n') + '\n';
}

export default async function handler(req: any, res: any) {
  try {
    if (req.query?.robots) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
      return res.status(200).send(robotsFor(String(req.headers?.host || '')));
    }
    // 1. Fetch Data — el directorio de mapadecaborojo.com, SIN los proveedores del registro.
    // Antes esto era un `.eq('status','open')` pelado cortado en 10 páginas: de 29,513 places
    // abiertos, las primeras 10,000 filas eran casi todas médicos del NPPES de todo PR. El
    // sitemap de mapa anunciaba 10,000 URLs /negocio/[slug] que o redirigen a /dentista/[slug]
    // o canonicalizan a registromedicopr.com — y los negocios reales de Cabo Rojo se quedaban
    // fuera por el corte. Ahora se piden solo los que mapa sí es dueño de indexar.
    const SUBS_IN = `(${SPECIALIST_SUBS.map((s) => `"${s}"`).join(',')})`;
    const COLS = 'slug, id, verified_at, category, subcategory, npi';
    const fetchAll = async (build: () => any): Promise<any[]> => {
      const out: any[] = [];
      for (let page = 0; page < 12; page++) {
        const { data } = await build().range(page * 1000, (page + 1) * 1000 - 1);
        if (!data || data.length === 0) break;
        out.push(...data);
        if (data.length < 1000) break;
      }
      return out;
    };
    const places = [
      // (a) directorio puro — sin NPI, nunca fue del registro
      ...(await fetchAll(() => supabase.from('places').select(COLS).eq('status', 'open').is('npi', null))),
      // (b) con NPI pero fuera de las 56 categorías del registro (farmacias, equipo médico…)
      ...(await fetchAll(() => supabase.from('places').select(COLS).eq('status', 'open').not('npi', 'is', null).not('subcategory', 'in', SUBS_IN))),
      // (c) con NPI y sin subcategoría — `NOT IN` los deja fuera porque NULL no compara
      ...(await fetchAll(() => supabase.from('places').select(COLS).eq('status', 'open').not('npi', 'is', null).is('subcategory', null))),
    ];

    const { data: events } = await supabase
      .from('events')
      .select('id, slug, start_time')
      .eq('status', 'published')
      .gte('start_time', new Date().toISOString());

    // 2. Base URLs — registry pages live on their own domain (matches canonical)
    const baseUrl = 'https://www.mapadecaborojo.com';
    const REG_BASE = 'https://registromedicopr.com';
    
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
    // Feed URLs
    urls.push(`
      <url>
        <loc>${baseUrl}/api/feed</loc>
        <changefreq>daily</changefreq>
        <priority>0.4</priority>
      </url>
    `);
    urls.push(`
      <url>
        <loc>${baseUrl}/api/feed.json</loc>
        <changefreq>daily</changefreq>
        <priority>0.4</priority>
      </url>
    `);

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
    // Narrative public pages (SSR · positioning + sales + transparency)
    // Priority order matches conversion path: entry → sales → trust → data
    // ⚠️ Solo rutas que devuelven 200. Un slug con redirect 301 en vercel.json NO va
    // aquí: Google lo sigue rastreando como "enviada", lo mantiene indexado y sigue
    // reportando sus errores (así seguía vivo el aviso de Dataset de /transparencia
    // y /senales-del-pueblo tres días después de la poda del 27 jul 2026).
    const narrativePages: Array<{ slug: string; priority: number; changefreq: string }> = [
      { slug: 'tienda', priority: 0.9, changefreq: 'weekly' },                 // storefront · La Vitrina + libro + Conserje
      { slug: 'pon-tu-negocio-en-el-mapa', priority: 0.9, changefreq: 'weekly' }, // §13 revenue CTA
      { slug: 'observatorio', priority: 0.9, changefreq: 'weekly' },           // civic accountability · Esencia/vertedero · FAQPage schema
      { slug: 'promesas', priority: 0.8, changefreq: 'weekly' },               // promesas del alcalde en cámara · banco completo
      { slug: 'mision', priority: 0.7, changefreq: 'weekly' },
      { slug: 'equipo', priority: 0.6, changefreq: 'weekly' },
      { slug: 'historia', priority: 0.6, changefreq: 'monthly' },              // Origin story · build-in-public
      { slug: 'barrios', priority: 0.9, changefreq: 'weekly' },                // mapa interactivo de los 9 barrios
      { slug: 'barrio/pueblo', priority: 0.8, changefreq: 'weekly' },
      { slug: 'barrio/boqueron', priority: 0.8, changefreq: 'weekly' },
      { slug: 'barrio/miradero', priority: 0.8, changefreq: 'weekly' },
      { slug: 'barrio/guanajibo', priority: 0.8, changefreq: 'weekly' },
      { slug: 'barrio/pedernales', priority: 0.8, changefreq: 'weekly' },
      { slug: 'barrio/bajura', priority: 0.8, changefreq: 'weekly' },
      { slug: 'barrio/monte-grande', priority: 0.8, changefreq: 'weekly' },
      { slug: 'barrio/llanos-tuna', priority: 0.8, changefreq: 'weekly' },
      { slug: 'barrio/llanos-costa', priority: 0.8, changefreq: 'weekly' },
    ]
    narrativePages.forEach(({ slug, priority, changefreq }) => {
      urls.push(`
        <url>
          <loc>${baseUrl}/${slug}</loc>
          <changefreq>${changefreq}</changefreq>
          <priority>${priority}</priority>
        </url>
      `)
    })

    // Registro Médico PR — index pages
    ;[
      { slug: '', priority: 1.0, changefreq: 'weekly' },
      // /registro NO va: es copia byte por byte de la raíz y su canonical apunta a la raíz.
      // Anunciar una URL que canoniza a otra es pedirle a Google que reporte
      // "Alternate page with proper canonical tag" — que fue justo el aviso del 28 jul.
      { slug: 'pueblo', priority: 0.9, changefreq: 'weekly' },
      { slug: 'necesito', priority: 0.85, changefreq: 'monthly' },
      { slug: 'necesito/cita-rapido', priority: 0.8, changefreq: 'monthly' },
      { slug: 'necesito/no-tengo-plan', priority: 0.8, changefreq: 'monthly' },
      { slug: 'necesito/cuido-a-mis-padres-desde-afuera', priority: 0.8, changefreq: 'monthly' },
      { slug: 'necesito/acabo-de-llegar', priority: 0.8, changefreq: 'monthly' },
      { slug: 'necesito/no-hay-en-mi-pueblo', priority: 0.8, changefreq: 'monthly' },
      // /observatorio es de mapadecaborojo.com y /agua de puertoricosinfiltros.com:
      // el guard de host las redirige, así que anunciarlas aquí sería anunciar un 301.
      { slug: 'registro/desiertos', priority: 0.8, changefreq: 'monthly' },
      { slug: 'marcador', priority: 0.9, changefreq: 'weekly' },
      { slug: 'kit', priority: 0.7, changefreq: 'weekly' },
      { slug: 'registro/estado', priority: 0.9, changefreq: 'weekly' },
      { slug: 'registro/mapa', priority: 0.85, changefreq: 'weekly' },
      { slug: 'cambios', priority: 0.8, changefreq: 'weekly' },
      { slug: 'comparte', priority: 0.85, changefreq: 'monthly' },
      { slug: 'porque', priority: 0.9, changefreq: 'monthly' },
    ].forEach(({ slug, priority, changefreq }) => {
      urls.push(`
        <url>
          <loc>${REG_BASE}${slug ? '/' + slug : ''}</loc>
          <changefreq>${changefreq}</changefreq>
          <priority>${priority}</priority>
        </url>
      `);
    });

    // Registro Médico PR — one page per verified specialist (NPPES). Paginate past the 1000-row cap.
    const specialists: any[] = [];
    // 25 pages × 1000 = 25,000 capacity (registry = ~20,600 providers; sitemap protocol cap is 50k/file).
    for (let page = 0; page < 25; page++) {
      const { data } = await supabase
        .from('places')
        .select('slug')
        .not('npi', 'is', null).not('slug', 'is', null).eq('status', 'open')
        .in('subcategory', SPECIALIST_SUBS)
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (!data || data.length === 0) break;
      specialists.push(...data);
      if (data.length < 1000) break;
    }
    specialists.forEach((p: any) => {
      urls.push(`
        <url>
          <loc>${REG_BASE}/especialista/${encodeURIComponent(p.slug)}</loc>
          <changefreq>monthly</changefreq>
          <priority>0.6</priority>
        </url>
      `);
    });

    // Registro Médico PR — /pueblo/:municipio (78 semáforos de acceso por pueblo)
    const { data: puebloMunis } = await supabase
      .from('v_registro_muni_ratio')
      .select('municipio');
    (puebloMunis || []).forEach((m: any) => {
      const slug = String(m.municipio || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!slug) return;
      urls.push(`
        <url>
          <loc>${REG_BASE}/pueblo/${slug}</loc>
          <changefreq>weekly</changefreq>
          <priority>0.75</priority>
        </url>
      `);
    });

    // Registro Médico PR — specialty + specialty×region HUB pages (224 list pages, strong SEO)
    // Derivado de SPECIALIST_SUBS (single source) — mata el drift de listas hardcoded.
    const SPEC_URLS = SPECIALIST_SUBS.map((x) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    const HUB_REGION_SLUGS = ['oeste','norte','centro','sur','este','metro'];
    SPEC_URLS.forEach((s) => {
      urls.push(`
        <url>
          <loc>${REG_BASE}/registro/${s}</loc>
          <changefreq>weekly</changefreq>
          <priority>0.7</priority>
        </url>
      `);
      HUB_REGION_SLUGS.forEach((r) => {
        urls.push(`
        <url>
          <loc>${REG_BASE}/registro/${s}/${r}</loc>
          <changefreq>monthly</changefreq>
          <priority>0.5</priority>
        </url>
      `);
      });
    });

    // Registro Médico PR — specialty × TOWN pages: capturan la demanda "[especialidad] [pueblo]"
    // (ej. "neurologo cabo rojo"). Pueblos de mayor demanda/población × especialidades.
    const REG_TOWN_SLUGS = ['san-juan','bayamon','carolina','caguas','ponce','mayaguez','arecibo','guaynabo','cabo-rojo','san-german','aguadilla','humacao','fajardo','manati','hormigueros','lajas','sabana-grande','yauco','cayey','vega-baja','san-sebastian','cataño'].map((t) => t.normalize('NFD').replace(/[̀-ͯ]/g, ''));
    SPEC_URLS.forEach((s) => {
      REG_TOWN_SLUGS.forEach((town) => {
        urls.push(`
        <url>
          <loc>${REG_BASE}/registro/${s}/${town}</loc>
          <changefreq>monthly</changefreq>
          <priority>0.5</priority>
        </url>
      `);
      });
    });

    // Category pages
    const categories = ['restaurantes', 'playas', 'salud', 'farmacia', 'dentista', 'veterinario', 'medico', 'hospital', 'laboratorio', 'optica', 'salud-mental', 'quiropractico', 'gimnasio', 'fisiatra', 'hospedaje', 'servicios', 'compras', 'entretenimiento', 'turismo', 'deportes', 'belleza', 'automotriz', 'marina', 'educacion', 'gobierno', 'helados', 'panaderia', 'pizza', 'mariscos', 'lavanderia', 'cafe', 'barberia', 'peluqueria', 'imprenta'];
    categories.forEach((cat) => {
      urls.push(`
        <url>
          <loc>${baseUrl}/categoria/${cat}</loc>
          <changefreq>weekly</changefreq>
          <priority>0.7</priority>
        </url>
      `);
    });

    // Dynamic Places — una URL por negocio, la que de verdad responde 200 y se auto-canoniza.
    // La versión vieja anunciaba SIEMPRE /negocio/[slug] y además adivinaba una ruta de salud
    // con el nombre del negocio. Dos bugs: (a) /negocio/[slug] de un place HEALTH devuelve 301,
    // así que el sitemap anunciaba la redirección y no el destino; (b) la adivinanza usaba
    // p.name y p.subcategory, columnas que el SELECT ni pedía, así que nunca emitió una sola
    // URL de salud. Ahora la ruta se calcula igual que en api/negocio.ts y se anuncia el destino.
    if (places) {
      places.forEach((p: any) => {
        const lastMod = p.verified_at ? p.verified_at.split('T')[0] : new Date().toISOString().split('T')[0];
        const slug = p.slug || p.id;
        const sub = (p.subcategory || '').toLowerCase();
        const cat = (p.category || '').toUpperCase();
        const healthRoute = cat === 'HEALTH' ? HEALTH_ROUTES[sub] || null : null;

        // Con NPI en ruta de especialista, la página canoniza a registromedicopr.com:
        // esa URL es del registro, no de mapa. Ya sale como /especialista/[slug] arriba.
        if (healthRoute && p.npi && REG_ESPECIALISTA_TYPES.has(healthRoute)) return;

        urls.push(`
          <url>
            <loc>${baseUrl}/${healthRoute ? `${healthRoute}/${slug}` : `negocio/${slug}`}</loc>
            <lastmod>${lastMod}</lastmod>
            <changefreq>weekly</changefreq>
            <priority>${healthRoute ? '0.9' : '0.8'}</priority>
          </url>
        `);
      });
    }

    // Dynamic Events — canonical detail pages at /evento/[slug]
    // (Only events with a slug get an indexable page; skip the rest.)
    if (events) {
      events.forEach((e: any) => {
        if (!e.slug) return;
        urls.push(`
          <url>
            <loc>${baseUrl}/evento/${e.slug}</loc>
            <lastmod>${e.start_time.split('T')[0]}</lastmod>
            <changefreq>daily</changefreq>
            <priority>0.7</priority>
          </url>
        `);
      });
    }

    // Host-aware: registromedicopr.com/sitemap.xml lists only registry URLs
    // (no cross-domain entries → clean in Search Console).
    const isReg = /registromedicopr\.com/i.test(String(req.headers?.host || ''));
    const isPRSF = /puertoricosinfiltros\.com/i.test(String(req.headers?.host || ''));
    let outUrls: string[];
    if (isPRSF) {
      // Host-aware: puertoricosinfiltros.com lista solo sus récords propios (limpio en GSC).
      const B = 'https://puertoricosinfiltros.com';
      const paths = ['/', '/ultima-cifra', '/numero-mas-nuevo', '/prediccion', '/costo-de-vida', '/rendimiento', '/cupon', '/trabajo', '/decidir', '/exposicion-ai', '/sigue-el-dinero', '/recuperacion', '/agua', '/activos', '/luz', '/basura', '/historial', '/no-se-mide', '/esencia', '/sinfiltros/pulso', '/expediente/alcalde-cabo-rojo', '/expediente/representante-distrito-20'];
      outUrls = paths.map((p) => `<url><loc>${B}${p}</loc><changefreq>weekly</changefreq><priority>${p === '/' ? '1.0' : '0.8'}</priority></url>`);
    } else if (isReg) {
      outUrls = urls.filter((u) => u.includes('registromedicopr.com'));
    } else {
      // Mapa: solo lo suyo. Este era el único host que devolvía la lista entera, así que
      // mapadecaborojo.com/sitemap.xml le enviaba a Google 24,327 URLs de registromedicopr.com
      // — el sitemap de un dominio pidiendo que se indexe otro.
      outUrls = urls.filter((u) => u.includes('www.mapadecaborojo.com'));
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${outUrls.join('')}
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
