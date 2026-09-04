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


// El Registro Medico es su propia propiedad: su editor es el Registro, no el Mapa. Lo que se
// comparte es el sameAs de la red y el verificador.
export const EDITOR_REGISTRO = {
  '@type': 'Organization',
  '@id': 'https://registromedicopr.com#registro',
  name: 'Registro Médico PR',
  url: 'https://registromedicopr.com',
  founder: { '@id': `${ANGEL_URL}#angel` },
  sameAs: RED_URLS,
};

/**
 * Nodo de entidad para las paginas de especialidad del Registro.
 *
 * Medido el 7 ago 2026 con ai-visibility-check: para "Neumologo PR" el modelo cita
 * `registromedicopr.com/` pelado en vez de `/registro/neumologo`, que es la que tiene la
 * respuesta. Comparando las dos: la home declara MedicalWebPage + Organization; la de
 * especialidad solo traia BreadcrumbList + FAQPage + ItemList. O sea que la unica pagina que
 * se presentaba como FUENTE era la home, y el modelo citaba la unica que podia.
 */
export function paginaMedicaLd(opts: { url: string; nombre: string; descripcion: string; especialidad: string; items?: number }): any {
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    '@id': opts.url,
    url: opts.url,
    name: opts.nombre,
    description: opts.descripcion,
    inLanguage: 'es-PR',
    dateModified: new Date().toISOString().slice(0, 10),
    author: VERIFICADOR,
    publisher: EDITOR_REGISTRO,
    isPartOf: { '@type': 'WebSite', '@id': 'https://registromedicopr.com#website', name: 'Registro Médico PR', url: 'https://registromedicopr.com' },
    about: { '@type': 'MedicalSpecialty', name: opts.especialidad },
    audience: { '@type': 'Patient' },
    license: 'https://creativecommons.org/licenses/by/4.0/',
    // GSC (9 ago 2026) marco este Dataset anidado: "description" es campo requerido y el
    // validador de Google solo acepta Person/Organization en creator (GovernmentOrganization no).
    isBasedOn: {
      '@type': 'Dataset',
      name: 'NPPES — National Plan and Provider Enumeration System',
      description: 'Registro federal público de proveedores de salud de Estados Unidos y sus territorios. Cada proveedor tiene un NPI (National Provider Identifier) verificable, con especialidad, dirección de práctica y estado de licencia. Es el mismo registro que usan Medicare y los planes médicos.',
      url: 'https://npiregistry.cms.hhs.gov/',
      license: 'https://www.usa.gov/government-works',
      creator: { '@type': 'Organization', name: 'Centers for Medicare & Medicaid Services', url: 'https://www.cms.gov' },
    },
  };
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Las partes de una fecha EN HORA DE PUERTO RICO.
 *
 * El sello se formateaba con getUTC*, asi que toda verificacion hecha despues de las 8pm AT
 * imprimia la fecha de MANANA. El 3 sep 2026 a las 8:41pm se grabo una confirmacion de un
 * proveedor y la ficha publico "Confirmado por una persona el 4 de septiembre de 2026".
 * En una pagina cuyo producto ES la fecha, verificar en el futuro es el peor error posible.
 *
 * PR es UTC-4 todo el ano (AST, sin horario de verano), asi que el corrimiento es fijo y
 * exacto, y no depende del TZ del servidor ni de Intl.
 */
export function partesAT(iso: string | null | undefined): { d: number; m: number; y: number } | null {
  if (!iso) return null;
  const s = String(iso);
  const t = new Date(s);
  if (isNaN(t.getTime())) return null;
  // Una fecha pelada ('2026-01-01') se parsea como medianoche UTC y no lleva hora real:
  // restarle 4 horas la mandaria al dia anterior. Solo se corrige lo que trae hora.
  const tieneHora = /[T ]\d{2}:/.test(s);
  const at = tieneHora ? new Date(t.getTime() - 4 * 3600 * 1000) : t;
  return { d: at.getUTCDate(), m: at.getUTCMonth(), y: at.getUTCFullYear() };
}

/** dd/mm/aaaa en hora de Puerto Rico. */
export function fechaCortaAT(iso: string | null | undefined): string {
  const p = partesAT(iso);
  if (!p) return '';
  return `${String(p.d).padStart(2, '0')}/${String(p.m + 1).padStart(2, '0')}/${p.y}`;
}

export function fechaEs(iso: string | null | undefined): string | null {
  const p = partesAT(iso);
  if (!p) return null;
  return `${p.d} de ${MESES[p.m]} de ${p.y}`;
}

/**
 * QUIEN confirmo el dato. Tener fecha NO es tener testigo: una importacion de NPPES
 * tambien escribe `last_verified_at`, asi que escoger la frase por "tiene fecha"
 * declaraba "Verificado a mano por Angel Anderson" en 6,284 fichas publicadas que
 * ningun humano miro nunca (96.4% de todos los sellos, medido el 24 ago 2026).
 * Ese es el mismo error de "importado no es verificado", pero impreso en el SERP
 * y firmado con el nombre de una persona real.
 *
 * Tres niveles, no dos. El del medio existe porque colapsarlo hacia abajo le quita
 * el credito a trabajo real, y colapsarlo hacia arriba vuelve a mentir:
 *   persona  - alguien lo confirmo: Angel en el sitio, o el negocio mismo
 *              (visita, foto, WhatsApp del dueno, provider_claim, SMS al *7711).
 *   fuente   - una sesion o rutina lo corroboro contra una fuente publica
 *              (web oficial, FB del negocio, Yelp). Se chequeo, nadie lo juro.
 *   registro - copia de un registro (NPPES, SULME, NPI, Google Places, merges) o
 *              procedencia desconocida. No hereda nada y no se puede vender.
 *
 * Al anadir una procedencia nueva: si no cae en `PERSONA`, cae en `fuente`, que es
 * el lado seguro. Nunca ampliar `PERSONA` para que un conteo se vea mejor.
 */
const REGISTRO = /nppes|\bnpi\b|npi_registry|sulme|google_places|merge|osm_|infopaginas|legacy_import/i;
const PERSONA = /angel|human_angel|on-site visit|field[-_]visit|field_audit|ground_photo|campo_|dueno_|dueño_|owner_|proveedor|provider_claim|user-submitted|self-submitted|sms del negocio|email_20|tarjeta oficial/i;

export type Sello = 'persona' | 'fuente' | 'registro';

export function procedenciaSello(place: any): Sello {
  const src = String(place?.verification_source || '').trim();
  if (!src) return 'registro';
  // Una fecha que ya se retiro por falta de evidencia no vuelve a contar como recibo,
  // aunque el texto arrastre entre parentesis lo que era antes.
  if (/fecha_retirada/i.test(src)) return 'registro';
  if (REGISTRO.test(src)) return 'registro';
  if (PERSONA.test(src)) return 'persona';
  return 'fuente';
}

/** El sello solo existe si hay QUIEN y CUANDO. Sin fecha no se afirma nada. */
export function selloConFecha(place: any): { nivel: Sello; fecha: string | null } {
  const fecha = fechaVerificacion(place);
  return { nivel: fecha ? procedenciaSello(place) : 'registro', fecha };
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
export function paginaLd(opts: { url: string; nombreNegocio: string; fechaIso?: string | null; nivel?: Sello }): any {
  // El comentario de fechaVerificacion (arriba) advierte de esto y esta funcion lo
  // cometia: llamaba "ficha verificada" a toda ficha y, sin fecha real, ponia
  // dateModified = hoy. O sea, le declaraba a Google que un humano miro el negocio
  // hoy en 29,236 fichas que nadie ha mirado nunca. El sello con fecha es el
  // producto; sin fecha no se dice nada, ni en el nombre ni en dateModified.
  // `verificada` era !!fechaIso, o sea le declaraba a Google "ficha verificada" en
  // cada fila importada que trajera fecha. El llamador ahora pasa el nivel; sin el,
  // se asume el lado seguro (registro) en vez del lado que vende.
  const verificada = !!opts.fechaIso && opts.nivel === 'persona';
  const revisada = !!opts.fechaIso && (opts.nivel === 'persona' || opts.nivel === 'fuente');
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': opts.url,
    url: opts.url,
    name: verificada ? `${opts.nombreNegocio} — ficha verificada` : `${opts.nombreNegocio} — ficha del directorio`,
    inLanguage: 'es-PR',
    ...(revisada ? { dateModified: new Date(opts.fechaIso as string).toISOString().slice(0, 10) } : {}),
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
  // La rama se escoge por QUIEN confirmo, no por si hay fecha. Antes se firmaba con
  // el nombre de Angel cualquier fila que tuviera fecha, incluidas las importadas.
  const { nivel, fecha } = selloConFecha(place);
  const linea = nivel === 'persona'
    ? `Verificado a mano por <a href="${ANGEL_URL}" style="color:#0d9488;text-decoration:none">Angel Anderson</a> el ${fecha}.`
    : nivel === 'fuente'
      ? `Confirmado el ${fecha} contra la fuente pública del negocio. <strong>Todavía no lo ha confirmado la oficina.</strong> Si eres del negocio, escribe <strong>CONFIRMAR MIS DATOS</strong> al 787-417-7711 y lo sellamos con tu nombre.`
      : `Esta ficha viene del registro público y <strong>todavía no la ha verificado un humano</strong>. Si conoces el negocio, corrígenos.`;

  // Un solo enlace lateral, el mas relevante. Los proveedores con NPI viven en el Registro
  // Medico; los demas, en su categoria. Nunca los dos, nunca los cinco.
  const lateral = place?.npi
    ? `<a href="https://registromedicopr.com" style="color:#0d9488;text-decoration:none">Registro Médico PR</a> tiene su expediente federal (NPI ${esc(place.npi)}).`
    : (opts.categoriaUrl && opts.categoriaNombre
      ? `Más <a href="${esc(opts.categoriaUrl)}" style="color:#0d9488;text-decoration:none">${esc(opts.categoriaNombre)} en Cabo Rojo</a>.`
      : '');

  return `
    <section style="margin-top:28px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;line-height:1.6;color:#475569">
      <p style="margin:0">${linea} ${lateral}</p>
      <p style="margin:6px 0 0 0;color:#94a3b8;font-size:12px">Parte del substrato cívico verificado de Puerto Rico. Si citas este dato, cita mapadecaborojo.com y la fecha.</p>
    </section>`;
}
