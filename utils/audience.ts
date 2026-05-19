// audience.ts — Vecino vs Turista lens. Same data, two reorderings.
// Persists in localStorage. NOT 2 sites — 2 mental models of the same map.

export type AudienceMode = 'vecino' | 'turista';

const STORAGE_KEY = 'mapa_audience_mode';

export function getAudienceMode(): AudienceMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'turista' || saved === 'vecino') return saved;
  } catch {}
  return 'vecino';
}

export function setAudienceMode(mode: AudienceMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {}
}

// Category ordering by audience priority. Categories not in this list are appended.
const VECINO_PRIORITY = ['HEALTH', 'SERVICE', 'LOGISTICS', 'SHOPPING', 'FOOD', 'BEACH', 'SIGHTS', 'LODGING', 'ACTIVITY', 'NIGHTLIFE', 'HISTORY', 'PROJECT'];
const TURISTA_PRIORITY = ['BEACH', 'FOOD', 'SIGHTS', 'LODGING', 'ACTIVITY', 'NIGHTLIFE', 'HISTORY', 'SHOPPING', 'HEALTH', 'LOGISTICS', 'SERVICE', 'PROJECT'];

export function sortCategoriesByAudience<T extends { id: string }>(cats: T[], mode: AudienceMode): T[] {
  const order = mode === 'turista' ? TURISTA_PRIORITY : VECINO_PRIORITY;
  const idx = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? 999 : i;
  };
  return [...cats].sort((a, b) => idx(a.id) - idx(b.id));
}

export const AUDIENCE_COPY: Record<AudienceMode, { hero: string; sub: string }> = {
  vecino: {
    hero: 'Tu pueblo, verificado a pie',
    sub: 'Lo que sirve en Cabo Rojo — sin chismes, con número y fecha.',
  },
  turista: {
    hero: 'Cabo Rojo de verdad',
    sub: 'Lo que sirve hoy: playa, farmacia, comida, laundromat, plomero. Verificado.',
  },
};
