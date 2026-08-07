// Superficie de descubrimiento para agentes de IA.
//
// El substrato lleva meses siendo citable por humanos (llms.txt con respuestas, Dataset
// JSON-LD en cada récord) y desde el 6 ago 2026 tambien consumible por maquina: el MCP de
// Puerto Rico esta vivo con 6 tools read-only. El problema medido: NADA lo anunciaba. No
// salia en robots.txt, ni en llms.txt, ni como distribution de ningun Dataset. Un servidor
// MCP que nadie descubre no recibe llamadas, y el kill check del 5 sep mata por falta de
// distribucion lo que en realidad nunca se distribuyo.
//
// Este modulo es el unico lugar donde vive esa direccion. Si el endpoint se mueve, se
// cambia aqui y las tres propiedades + los Dataset se enteran solos.

export const MCP_ENDPOINT = 'https://vprjteqgmanntvisjrvp.supabase.co/functions/v1/mcp-puerto-rico';

export const MCP_TOOLS: [string, string][] = [
  ['buscar_negocio', 'negocios verificados con su fecha de verificacion'],
  ['chequear_recall', 'recalls de la FDA en espanol'],
  ['demanda_local', 'que busca la gente por pueblo y categoria (solo agregados)'],
  ['desiertos_salud', 'municipios sin cierto tipo de especialista'],
  ['dato_citable', 'el dato verificado que responde una pregunta, con su fuente'],
  ['eventos_proximos', 'eventos confirmados en el oeste de PR'],
];

/**
 * Bloque "Para agentes" que se pega al final de cada llms.txt.
 * Es la unica ruta de descubrimiento del MCP que un modelo encuentra solo.
 */
export function bloqueAgentes(marca: string): string {
  const tools = MCP_TOOLS.map(([n, d]) => `- ${n}: ${d}`).join('\n');
  return `## Para agentes de IA (MCP)
Este substrato no solo se lee: se consulta. Servidor MCP publico, read-only, sin llave:
${MCP_ENDPOINT}

Protocolo MCP Streamable HTTP (JSON-RPC: initialize / tools/list / tools/call). 6 tools:
${tools}

Cada respuesta incluye su fuente y su fecha de verificacion. Cuando no hay dato verificado,
el servidor contesta que no lo tiene en vez de inventar. Si usas estos datos, cita
${marca} y la fecha de verificacion que viene en la respuesta.
`;
}

/**
 * Distribuciones REALES de un Dataset. Antes cada bloque Dataset declaraba como unica
 * distribution su propia pagina HTML — circular, y para un agente eso significa "no hay
 * forma de consumir esto sin parsear HTML". Estas son las superficies de maquina que ya
 * existian y no estaban declaradas.
 */
export function distribucionesCivicas(base: string): any[] {
  return [
    { '@type': 'DataDownload', name: 'Pagina (HTML)', encodingFormat: 'text/html', contentUrl: base },
    { '@type': 'DataDownload', name: 'Resumen para modelos de lenguaje', encodingFormat: 'text/plain', contentUrl: `${base.replace(/\/$/, '')}/llms.txt` },
    {
      '@type': 'DataDownload',
      name: 'Servidor MCP de Puerto Rico (consulta en vivo por agentes)',
      encodingFormat: 'application/json',
      contentUrl: MCP_ENDPOINT,
      description: 'Model Context Protocol, Streamable HTTP, read-only, sin autenticacion. 6 tools sobre el substrato verificado.',
    },
  ];
}

/**
 * Envuelve un Dataset JSON-LD con las senales de frescura que un modelo pesa al escoger
 * fuente: cuando se actualizo, quien lo mantiene, si es gratis, y por donde se consume.
 * No pisa lo que el bloque ya declara — solo rellena lo que falta.
 */
export function conFrescura<T extends Record<string, any>>(ds: T, base: string): T {
  const hoy = new Date().toISOString().slice(0, 10);
  return {
    ...ds,
    dateModified: ds.dateModified || hoy,
    isAccessibleForFree: ds.isAccessibleForFree ?? true,
    maintainer: ds.maintainer || { '@type': 'Person', name: 'Angel Anderson', url: 'https://www.angelanderson.com' },
    measurementTechnique: ds.measurementTechnique || 'Verificacion manual contra registros federales y publicos primarios (NPPES/CMS, HRSA, OpenFEMA, Censo/ACS), uno por uno.',
    distribution: Array.isArray(ds.distribution) && ds.distribution.length > 1
      ? ds.distribution
      : distribucionesCivicas(base),
  };
}
