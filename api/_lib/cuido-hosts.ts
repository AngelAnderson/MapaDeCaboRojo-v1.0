// Directorio "Cuido" (hogares de ancianos licenciados por Familia).
// Hoy vive en registromedicopr.com/cuido. Cuando Angel compre el dominio propio,
// basta con que el host esté en esta lista (o en la env CUIDO_HOSTS, separada por comas)
// y vercel.json lo apunte a este proyecto: la rama `isCuido` ya está lista.
// Dominio NO comprado al 25 oct 2026; el primer valor es el candidato.

const DEFAULT_CUIDO_HOSTS = ['hogaresdeancianospr.com', 'www.hogaresdeancianospr.com']

export const CUIDO_HOSTS: string[] = [
  ...DEFAULT_CUIDO_HOSTS,
  ...String(process.env.CUIDO_HOSTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
]

export const CUIDO_BASE = 'https://' + (CUIDO_HOSTS.find(h => !h.startsWith('www.')) || DEFAULT_CUIDO_HOSTS[0])

export function isCuidoHost(host: string | undefined | null): boolean {
  const h = String(host || '').split(':')[0].toLowerCase()
  return CUIDO_HOSTS.includes(h)
}

export function slugTexto(s: string): string {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// places.slug es NULO para los hogares SULME. El slug se deriva del nombre + los
// primeros 6 caracteres del id (estable y único); la ruta se resuelve comparando
// contra los hogares del pueblo, sin columna nueva.
export function slugHogar(name: string, id: string): string {
  const base = slugTexto(name).slice(0, 60).replace(/-+$/g, '') || 'hogar'
  return `${base}-${String(id).replace(/-/g, '').slice(0, 6)}`
}
