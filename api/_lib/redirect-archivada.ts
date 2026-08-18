/**
 * Una ficha archivada no desaparece de Google: el 17 ago 2026,
 * /gimnasio/dr-luis-pagan-marrero-cardiologia-cabo-rojo llevaba 102 impresiones
 * y 3 clics al mes contra un 404, mientras la ficha viva del mismo cardiólogo
 * (mismo teléfono, misma calle) estaba a un slug de distancia. RLS no deja al
 * anon key ver las archivadas, así que la ruta ni sabía que existía un gemelo.
 *
 * La tabla `place_redirects` solo se llena cuando el gemelo es INEQUÍVOCO: mismo
 * teléfono + municipio, o mismo nombre normalizado + municipio, y exactamente una
 * ficha publicada. Los 48 casos ambiguos (cadenas con varias sucursales) se
 * quedan fuera a propósito: mandar a un vecino a la sucursal equivocada es peor
 * que un 404 honesto.
 */
export async function slugVivoPara(supabase: any, slug: string): Promise<string | null> {
  if (!slug) return null;
  const { data } = await supabase
    .from('place_redirects')
    .select('slug_nuevo')
    .eq('slug_viejo', slug)
    .maybeSingle();
  return data?.slug_nuevo || null;
}
