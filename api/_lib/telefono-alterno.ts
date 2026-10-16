// "Otro número según Medicare" (decisión de Angel aprobada 10 oct 2026,
// acciones_queue lote decision-telefono-alterno-medicare).
//
// La rutina nocturna `fichas-con-fallo` deja en places.verification_issues (jsonb array)
// una línea de texto cuando el teléfono de la ficha no contestó en 30 días y Medicare (CMS)
// trae otro número para el mismo NPI:
//   "[2026-10-14] fichas-con-fallo: telefono de la ficha (787) 653-0550 no contesta (3 fallos
//    en 30 dias). Medicare trae otro telefono para este NPI: (787) 758-2000."
// Esta función lee la más reciente y decide si se muestra. NUNCA toca places.phone.
//
// Reglas (todas fallan cerradas, ante la duda no se muestra):
//  - solo la línea más reciente de fichas-con-fallo que nombre a Medicare y traiga número;
//  - solo si sigue abierta: si la ficha se verificó DESPUÉS de la fecha de la línea, ya se
//    revisó y la nota se cae (mismo criterio que avisoDatoReportado en api/negocio.ts);
//  - solo si el número es distinto del principal, es marcable (no 787-888-8888 y compañía)
//    y es de Puerto Rico (787/939): Medicare a veces trae la práctica de telemedicina en
//    Florida (239) y eso no es "otro número" de este consultorio.
export type TelefonoAlterno = { digitos: string; fecha: string }

const LINEA = /^\[(\d{4}-\d{2}-\d{2})\]\s*fichas-con-fallo:.*Medicare[^:]*otro telefono[^:]*:\s*\(?(\d{3})\)?[\s-]*(\d{3})-?(\d{4})/i

export function telefonoAlternoMedicare(
  issues: unknown,
  telefonoPrincipal: string | null | undefined,
  ultimaVerificacion: string | null | undefined,
): TelefonoAlterno | null {
  if (!Array.isArray(issues)) return null
  const principal = String(telefonoPrincipal || '').replace(/\D/g, '').slice(-10)
  let mejor: TelefonoAlterno | null = null
  for (const it of issues) {
    if (typeof it !== 'string') continue
    const m = LINEA.exec(it)
    if (!m) continue
    const [, fecha, a, b, c] = m
    const digitos = `${a}${b}${c}`
    if (!mejor || fecha > mejor.fecha) mejor = { digitos, fecha }
  }
  if (!mejor) return null
  const { digitos, fecha } = mejor
  if (!/^(787|939)/.test(digitos)) return null
  if (/^[01]/.test(digitos) || /^(\d)\1{6}$/.test(digitos.slice(3))) return null
  if (digitos === principal) return null
  if (ultimaVerificacion) {
    const v = new Date(ultimaVerificacion).getTime()
    const f = new Date(`${fecha}T00:00:00Z`).getTime()
    if (!isNaN(v) && !isNaN(f) && v > f + 24 * 60 * 60 * 1000) return null
  }
  return mejor
}
