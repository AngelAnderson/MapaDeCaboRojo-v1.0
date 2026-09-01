// rutas-salud.ts — un récord, una ruta. La ÚNICA copia del mapa.
//
// POR QUÉ EXISTE (2026-09-01): este mapa vivía copiado en 3 archivos
// (api/farmacia.ts, api/negocio.ts, api/sitemap.ts). Los comentarios de cada
// copia decían "espejo EXACTO" de las otras. No lo eran:
//
//   · farmacia.ts servía 11 rutas. negocio.ts y sitemap.ts conocían 10.
//     La que faltaba, `fisiatra`, quedó con dos casas: 200 en /fisiatra/ y
//     200 en /negocio/, cada una con su propia canónica.
//   · Ninguna de las 3 normalizaba acentos, y en `places` hay 621
//     'quiropráctico' y 11 'óptica' CON tilde. Para las 3 copias esas
//     subcategorías simplemente no existían.
//
// Ese segundo detalle no era cosmético: desarmaba una guardia que YA estaba
// escrita. api/sitemap.ts se salta a propósito los proveedores con NPI en ruta
// de especialista, porque su canónica vive en registromedicopr.com y anunciarlos
// aquí es pedirle a Google que indexe una página que dice "la buena está en el
// otro dominio". Como la ruta salía `undefined` por el acento, la guardia nunca
// disparaba y 874 proveedores con NPI se anunciaban igual bajo /negocio/. O sea
// exactamente la duplicación entre dominios que la guardia existía para evitar.
//
// Regla: si tocas este mapa, lo tocas AQUÍ. No lo vuelvas a copiar.
// Verificado contra `places` el 1 sep 2026.

// Las 11 rutas de salud que api/farmacia.ts sabe renderizar. La llave es la
// subcategoría YA normalizada (minúscula, sin tilde); el valor es el prefijo.
export const RUTAS_SALUD: Record<string, string> = {
  farmacia: 'farmacia',
  dentista: 'dentista',
  veterinario: 'veterinario',
  medico: 'medico',
  hospital: 'hospital',
  laboratorio: 'laboratorio',
  optica: 'optica',
  'salud-mental': 'salud-mental',
  quiropractico: 'quiropractico',
  gimnasio: 'gimnasio',
  fisiatra: 'fisiatra',
};

// En estas rutas, un proveedor CON NPI canonicaliza a registromedicopr.com
// ("un récord, un dominio", LOCKED 30 jul 2026). Sin NPI se queda en el Mapa.
export const REG_ESPECIALISTA_TYPES = new Set([
  'medico', 'dentista', 'salud-mental', 'quiropractico', 'fisiatra', 'optica',
]);

/** minúscula + sin tilde. 'Quiropráctico' -> 'quiropractico'. */
export function sinTilde(s: unknown): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * La ruta canónica de un récord. Devuelve 'negocio' cuando no le toca ninguna
 * ruta de salud — nunca null, para que quien llame no tenga que decidir nada.
 */
export function rutaDeRecord(category: unknown, subcategory: unknown): string {
  if (String(category ?? '').toUpperCase() !== 'HEALTH') return 'negocio';
  return RUTAS_SALUD[sinTilde(subcategory)] || 'negocio';
}

/**
 * true si la canónica de este récord vive en registromedicopr.com, o sea si el
 * Mapa NO debe anunciarlo ni reclamarlo. Requiere NPI: sin NPI es del Mapa.
 */
export function esDelRegistro(ruta: string, npi: unknown): boolean {
  return Boolean(npi) && REG_ESPECIALISTA_TYPES.has(ruta);
}
