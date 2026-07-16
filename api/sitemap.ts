
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
    urls.push(`
      <url>
        <loc>${baseUrl}/playas/defensa-y-limpieza</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
      </url>
    `);

    // Narrative public pages (SSR · positioning + sales + transparency)
    // Priority order matches conversion path: entry → sales → trust → data
    const narrativePages: Array<{ slug: string; priority: number; changefreq: string }> = [
      { slug: 'tienda', priority: 0.9, changefreq: 'weekly' },                 // storefront · La Vitrina + libro + Conserje
      { slug: 'menos-revolu', priority: 0.9, changefreq: 'weekly' },           // §20 consolidated landing
      { slug: 'pon-tu-negocio-en-el-mapa', priority: 0.9, changefreq: 'weekly' }, // §13 revenue CTA
      { slug: 'mira-la-vuelta', priority: 0.9, changefreq: 'daily' },          // §14 with live demand data
      { slug: 'senales-del-pueblo', priority: 0.8, changefreq: 'daily' },      // live demand signals
      { slug: 'observatorio', priority: 0.9, changefreq: 'weekly' },           // civic accountability · Esencia/vertedero · FAQPage schema
      { slug: 'promesas', priority: 0.8, changefreq: 'weekly' },               // promesas del alcalde en cámara · banco completo
      { slug: 'pueblo-en-numeros', priority: 0.8, changefreq: 'daily' },       // math anchor (TAM/SAM/SOM)
      { slug: 'transparencia', priority: 0.7, changefreq: 'daily' },           // live supply metrics
      { slug: 'mision', priority: 0.7, changefreq: 'weekly' },
      { slug: 'vision', priority: 0.6, changefreq: 'weekly' },
      { slug: 'equipo', priority: 0.6, changefreq: 'weekly' },
      { slug: 'moonshots', priority: 0.5, changefreq: 'weekly' },
      { slug: 'preguntas', priority: 0.7, changefreq: 'monthly' },             // FAQPage schema · LLM citability
      { slug: 'historia', priority: 0.6, changefreq: 'monthly' },              // Origin story · build-in-public
      { slug: 'me-conviene', priority: 0.7, changefreq: 'monthly' },
      { slug: 'municipio', priority: 0.6, changefreq: 'weekly' },
      { slug: 'cultura', priority: 0.8, changefreq: 'monthly' },               // curated cultural directory · 30 verified places
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
      { slug: 'registro', priority: 0.9, changefreq: 'weekly' },
      { slug: 'pueblo', priority: 0.9, changefreq: 'weekly' },
      { slug: 'necesito', priority: 0.85, changefreq: 'monthly' },
      { slug: 'necesito/cita-rapido', priority: 0.8, changefreq: 'monthly' },
      { slug: 'necesito/no-tengo-plan', priority: 0.8, changefreq: 'monthly' },
      { slug: 'necesito/cuido-a-mis-padres-desde-afuera', priority: 0.8, changefreq: 'monthly' },
      { slug: 'necesito/acabo-de-llegar', priority: 0.8, changefreq: 'monthly' },
      { slug: 'necesito/no-hay-en-mi-pueblo', priority: 0.8, changefreq: 'monthly' },
      { slug: 'observatorio', priority: 0.9, changefreq: 'weekly' },
      { slug: 'registro/desiertos', priority: 0.8, changefreq: 'monthly' },
      { slug: 'registro/estado', priority: 0.9, changefreq: 'weekly' },
      { slug: 'registro/mapa', priority: 0.85, changefreq: 'weekly' },
      { slug: 'cambios', priority: 0.8, changefreq: 'weekly' },
      { slug: 'comparte', priority: 0.85, changefreq: 'monthly' },
      { slug: 'porque', priority: 0.9, changefreq: 'monthly' },
      { slug: 'agua', priority: 0.7, changefreq: 'monthly' },
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
    // Las 56 categorías del registro (Fase 2, jul 2026): 32 especialistas + dentista + primaria
    // + aliados + facilidades NPI-2. Excluye viejos negocios de salud de CR con NPI que no son del registro.
    const SPECIALIST_SUBS = ['cardiólogo','psiquiatra','fisiatra','ginecólogo','pediatra','dermatólogo','gastroenterólogo','oftalmólogo','ortopeda','neurologo','urólogo','endocrinologo','nefrólogo','neumólogo','oncólogo','reumatólogo','geriatra','otorrinolaringólogo','infectólogo','alergista','medicina de emergencia','cirujano general','anestesiólogo','radiólogo','neurocirujano','cirujano plástico','cirujano torácico','coloproctólogo','manejo de dolor','psicólogo','optómetra','podiatra','dentista','internista','medicina de familia','terapeuta del habla','terapista físico','terapista ocupacional','quiropractico','consejero','trabajador social','terapeuta de familia','nutricionista','physician assistant','enfermera practicante','audiólogo','partera','farmacéutico','hospital','cuidado en el hogar','hospicio','hogar de envejecientes','centro de diálisis','urgent care','clínica comunitaria','dentista pediátrico','ortodoncista','cirujano oral','naturópata','acupunturista','neonatólogo','cirujano vascular'];
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
        } else if (subcatLower === 'fisiatra' || subcatLower.includes('fisiatr') || nameLower.includes('fisiatr')) {
          healthRoute = 'fisiatra';
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
      const paths = ['', '/prediccion', '/costo-de-vida', '/rendimiento', '/cupon', '/trabajo', '/decidir', '/exposicion-ai', '/sigue-el-dinero', '/recuperacion', '/agua', '/activos', '/luz', '/basura', '/diabetes', '/telemedicina', '/historial', '/no-se-mide', '/esencia', '/registro/estado', '/comparte', '/sinfiltros/pulso', '/expediente/alcalde-cabo-rojo', '/expediente/representante-distrito-20'];
      outUrls = paths.map((p) => `<url><loc>${B}${p}</loc><changefreq>weekly</changefreq><priority>${p === '' ? '1.0' : '0.8'}</priority></url>`);
    } else if (isReg) {
      outUrls = urls.filter((u) => u.includes('registromedicopr.com'));
    } else {
      outUrls = urls;
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
