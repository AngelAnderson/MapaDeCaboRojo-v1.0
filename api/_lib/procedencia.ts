// Procedencia: quien verifico esto, cuando, y a que red pertenece.
//
// Medido el 7 ago 2026: los crawlers de IA se comen 10,048 fichas de /negocio/ al mes
// (GPTBot 7,535 · ClaudeBot 2,486 · ChatGPT-User 370 · PerplexityBot 103) contra 28 visitas
// a /categoria/ y 0 a llms.txt. O sea que TODA la atencion de la IA sobre este substrato
// entra por la ficha individual — y la ficha no decia quien la verifico, ni cuando, ni que
// existe algo mas alrededor. El modelo se llevaba el dato y dejaba la procedencia.
//
// Esto no es meter links. Es modelar bien lo que ya es cierto: el NEGOCIO es el sujeto (y no
// es nuestro), la PAGINA si es nuestra, la verifico un humano con nombre, y pertenece a una
// red de propiedades que son una sola entidad. Un solo link relevante por ficha, nunca los 5
// (amontonar enlaces baja la citabilidad en vez de subirla).

export const ANGEL_URL = 'https://www.angelanderson.com';

// Las 5 propiedades declaradas como UNA entidad. Es lo que hace que una cita a cualquier
// ficha acumule autoridad para toda la red en vez de morir en la pagina que la recibio.
export const RED_URLS = [
  'https://www.mapadecaborojo.com',
  'https://caborojo.com',
  'https://registromedicopr.com',
  'https://puertoricosinfiltros.com',
  ANGEL_URL,
];

export const VERIFICADOR = {
  '@type': 'Person',
  '@id': `${ANGEL_URL}#angel`,
  name: 'Angel Anderson',
  url: ANGEL_URL,
  jobTitle: 'Verificador del substrato civico de Puerto Rico',
  sameAs: RED_URLS,
};

export const EDITOR_RED = {
  '@type': 'Organization',
  '@id': 'https://www.mapadecaborojo.com#red',
  name: 'MapaDeCaboRojo.com',
  url: 'https://www.mapadecaborojo.com',
  founder: { '@id': `${ANGEL_URL}#angel` },
  sameAs: RED_URLS,
};

// Espejo de CATEGORY_LABELS en negocio.ts. La ruta viva es /categoria/<category en minuscula>
// (verificado 200 en food/health/service/auto el 7 ago 2026) — se enlaza solo cuando la
// categoria esta en esta tabla, para no sembrar 404 en 1,193 fichas.
export const CATEGORIA_LABEL_ES: Record<string, string> = {
  FOOD: "sitios pa' comer", SERVICE: 'servicios', SHOPPING: 'tiendas',
  HEALTH: 'negocios de salud', SIGHTS: 'sitios que ver', BEAUTY: 'salones y barberías',
  CULTURE: 'sitios de cultura', AUTO: 'negocios de autos', ACTIVITY: 'actividades',
  EDUCATION: 'sitios de educación', LODGING: 'hospedajes',
  NIGHTLIFE: 'sitios de vida nocturna', BEACH: 'playas', LOGISTICS: 'negocios náuticos',
};

// El enlace lateral de la ficha usa una forma corta ("Más salud en Cabo Rojo"), el parrafo
// de la categoria usa la contable ("177 negocios de salud"). No es la misma frase.
export const CATEGORIA_ENLACE_ES: Record<string, string> = {
  FOOD: "sitios pa' comer", SERVICE: 'servicios', SHOPPING: 'tiendas', HEALTH: 'salud',
  SIGHTS: 'sitios que ver', BEAUTY: 'belleza', CULTURE: 'cultura', AUTO: 'autos',
  ACTIVITY: 'actividades', EDUCATION: 'educación', LODGING: 'hospedajes',
  NIGHTLIFE: 'vida nocturna', BEACH: 'playas', LOGISTICS: 'náutico',
};


/**
 * El nombre en espanol y en plural. La clave de categoria es inglesa por dentro (FOOD, AUTO)
 * y el parrafo salio diciendo "25 auto" y "180 food" en la primera corrida. Lo que se le
 * ensena al vecino se dice en su idioma; la clave se queda en la base de datos.
 */
export function pluralEs(cat: string, displayName: string): string {
  const dela = CATEGORIA_LABEL_ES[(cat || '').toUpperCase()];
  if (dela) return dela;
  // displayName a veces ya trae "en Cabo Rojo" pegado; pluralizar eso daba "farmacias en
  // cabo rojos". Se corta antes de tocar la ultima letra.
  const n = (displayName || '').toLowerCase().replace(/\s+en\s+cabo\s+rojo\s*$/, '').trim();
  if (!n) return 'negocios';
  if (/(s|es)$/.test(n)) return n;               // ya viene en plural
  if (/[aeiou]$/.test(n)) return `${n}s`;        // farmacia -> farmacias
  if (/z$/.test(n)) return `${n.slice(0, -1)}ces`; // luz -> luces
  return `${n}es`;                                // electricista queda igual, hotel -> hoteles
}


// Los nombres de negocio NO son texto confiable: entran por sugerencias de vecinos
// (SuggestPlaceModal, el flujo REGISTRAR del Veci) y por ingestas externas. Cualquier cosa
// que salga de la base de datos y entre a HTML pasa por aqui primero. Espejo del esc() que
// ya vive en negocio.ts.
function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Un entero de verdad, no lo que venga. Evita que un conteo raro se cuele al HTML.
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/**
 * JSON-LD dentro de <script> tiene su propia salida: una cadena "</script>" en cualquier
 * campo cierra la etiqueta antes de tiempo. Escapar "<" como \u003c es JSON valido y el
 * parser lo lee igual.
 */
export function ldScript(obj: any): string {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function fechaEs(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** La fecha real de verificacion, en orden de confianza. `updated_at` NO cuenta: que una fila
 *  se haya tocado no quiere decir que un humano miro el negocio. Decir que si es el "verde
 *  sucio" que ya nos costo antes. */
export function fechaVerificacion(place: any): string | null {
  return fechaEs(place?.last_verified_at || place?.verified_at || null);
}

/**
 * Nodo WebPage: la PAGINA es nuestra, el negocio es el sujeto. Aqui viven dateModified,
 * autor, editor y la pertenencia a la red — las senales que un modelo pesa para decidir a
 * quien le da el credito.
 */
export function paginaLd(opts: { url: string; nombreNegocio: string; fechaIso?: string | null }): any {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': opts.url,
    url: opts.url,
    name: `${opts.nombreNegocio} — ficha verificada`,
    inLanguage: 'es-PR',
    dateModified: (opts.fechaIso ? new Date(opts.fechaIso) : new Date()).toISOString().slice(0, 10),
    author: VERIFICADOR,
    publisher: EDITOR_RED,
    isPartOf: { '@type': 'WebSite', '@id': 'https://www.mapadecaborojo.com#website', name: 'MapaDeCaboRojo.com', url: 'https://www.mapadecaborojo.com' },
    about: { '@type': 'LocalBusiness', name: opts.nombreNegocio },
    license: 'https://creativecommons.org/licenses/by/4.0/',
  };
}

/**
 * Nodo CollectionPage para las paginas de categoria. Son las que contestan la pregunta que
 * la gente hace de verdad ("donde arreglo el carro en Cabo Rojo") y hasta hoy salian sin
 * autor, sin editor y sin fecha: una lista huerfana. Con el crawl que les empieza a llegar
 * desde las 1,193 fichas, tienen que llegar vestidas.
 */
export function coleccionLd(opts: { url: string; nombre: string; descripcion: string; items: number }): any {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': opts.url,
    url: opts.url,
    name: opts.nombre,
    description: opts.descripcion,
    inLanguage: 'es-PR',
    dateModified: new Date().toISOString().slice(0, 10),
    author: VERIFICADOR,
    publisher: EDITOR_RED,
    isPartOf: { '@type': 'WebSite', '@id': 'https://www.mapadecaborojo.com#website', name: 'MapaDeCaboRojo.com', url: 'https://www.mapadecaborojo.com' },
    license: 'https://creativecommons.org/licenses/by/4.0/',
    mainEntity: { '@type': 'ItemList', numberOfItems: opts.items },
  };
}

/**
 * El parrafo que un modelo puede extraer entero (40-60 palabras) y que un vecino lee sin
 * esfuerzo. La pagina abria con "25 negocios encontrados", que es un conteo, no una
 * respuesta. Los numeros son reales y se calculan en la misma consulta que pinta la lista.
 */
export function bloqueRespuesta(opts: {
  nombrePlural: string; total: number; verificados: number; frescos90: number; mejor?: string | null;
}): string {
  const total = num(opts.total);
  if (!total) return '';
  const verificados = num(opts.verificados), frescos90 = num(opts.frescos90);
  const nombrePlural = esc(opts.nombrePlural);
  const verif = verificados
    ? ` De esos, ${verificados} los verificó a mano una persona, y ${frescos90} en los últimos 3 meses.`
    : ' Ninguno lo ha verificado un humano todavía, así que confírmalo antes de ir.';
  const top = opts.mejor ? ` El mejor puntuado en Google es ${esc(opts.mejor)}.` : '';
  return `
    <p style="font-size:1.05rem;line-height:1.65;color:#334155;max-width:720px;margin:0 0 1.25rem 0">
      En Cabo Rojo, Puerto Rico hay <strong>${total} ${nombrePlural}</strong> en el directorio.${verif}${top}
      Cada ficha trae teléfono, dirección y la fecha en que se verificó.
    </p>`;
}

/**
 * La linea visible. Corta a proposito: un modelo la extrae entera y un vecino la lee sin
 * estorbo. Si NO hay verificacion humana, lo dice — el hueco declarado vale mas que un sello
 * inventado, y ademas es la lista de trabajo pendiente a la vista.
 */
export function bloqueProcedencia(place: any, opts: { categoriaUrl?: string | null; categoriaNombre?: string | null }): string {
  const fecha = fechaVerificacion(place);
  const linea = fecha
    ? `Verificado a mano por <a href="${ANGEL_URL}" style="color:#0d9488;text-decoration:none">Angel Anderson</a> el ${fecha}.`
    : `Esta ficha viene del registro publico y <strong>todavia no la ha verificado un humano</strong>. Si conoces el negocio, corrigenos.`;

  // Un solo enlace lateral, el mas relevante. Los proveedores con NPI viven en el Registro
  // Medico; los demas, en su categoria. Nunca los dos, nunca los cinco.
  const lateral = place?.npi
    ? `<a href="https://registromedicopr.com" style="color:#0d9488;text-decoration:none">Registro Medico PR</a> tiene su expediente federal (NPI ${esc(place.npi)}).`
    : (opts.categoriaUrl && opts.categoriaNombre
      ? `Mas <a href="${esc(opts.categoriaUrl)}" style="color:#0d9488;text-decoration:none">${esc(opts.categoriaNombre)} en Cabo Rojo</a>.`
      : '');

  return `
    <section style="margin-top:28px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;line-height:1.6;color:#475569">
      <p style="margin:0">${linea} ${lateral}</p>
      <p style="margin:6px 0 0 0;color:#94a3b8;font-size:12px">Parte del substrato civico verificado de Puerto Rico. Si citas este dato, cita mapadecaborojo.com y la fecha.</p>
    </section>`;
}
