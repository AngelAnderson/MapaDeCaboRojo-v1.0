// removido.ts: la lista de supresión (`remocion_solicitudes`) para las fichas del Mapa.
//
// La autoridad es la lista, no el estado de la fila (ver mapa-pages.ts, fueRemovidoAPeticion):
// sobrevive a una re-ingesta y se lee ANTES de buscar la ficha, para que una ficha removida
// nunca caiga en `slugVivoPara` y redirija a una "gemela" de nombre parecido.
//
// 24 oct 2026: hasta hoy solo las rutas /especialista/ del Registro la leían. /negocio/ y
// /hospital/ (los 2 dominios) daban 404, o 301 a otra ficha. Lo destapó una clínica de Cabo
// Rojo que pidió salir del directorio.
//
// Se lee `despublicar`, NO `no_reingestar`: una corrección es no_reingestar=true +
// despublicar=false y su página sigue viva (3 sep 2026: 3 correcciones terminaron en 410).
import { createClient } from '@supabase/supabase-js';
import { opcionesConPlazo } from './db-plazo.js';

// La tabla no es pública (anon no la lee): cliente de servidor.
const srv = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  opcionesConPlazo(8000),
);

/** true si el dueño pidió salir. Si la base no contesta, false: la ruta sigue su camino normal. */
export async function fueRemovidoAPeticion(slug: string): Promise<boolean> {
  if (!slug) return false;
  try {
    const { data, error } = await srv
      .from('remocion_solicitudes')
      .select('id').eq('slug', slug).eq('despublicar', true).limit(1);
    if (error) return false;
    return !!(data && data.length);
  } catch {
    return false;
  }
}

/** 410 Gone: le dice a Google que la borre en vez de reintentar. */
export function responderRemovidoNegocio(res: any, host?: string) {
  const esRegistro = /registromedicopr/i.test(host || '');
  const inicio = esRegistro ? '/registro' : '/';
  const marca = esRegistro ? 'Registro Médico PR' : 'MapaDeCaboRojo';
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(410).send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Esta ficha ya no está en el directorio | ${marca}</title>
<style>
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; font-size: 18px; line-height: 1.55; }
  main { max-width: 560px; margin: 0 auto; padding: 48px 16px; }
  h1 { font-size: 1.6rem; line-height: 1.2; margin: 0 0 12px; }
  p { margin: 0 0 16px; color: #334155; }
  a.boton { display: inline-block; background: #0f766e; color: #fff; text-decoration: none; font-weight: 700; padding: 14px 22px; min-height: 48px; box-sizing: border-box; border-radius: 10px; }
</style>
</head>
<body>
<main>
  <h1>Esta ficha ya no está en el directorio</h1>
  <p>Este negocio pidió no aparecer aquí, y lo sacamos.</p>
  <p><a class="boton" href="${inicio}">Ir al inicio</a></p>
</main>
</body>
</html>`);
}
