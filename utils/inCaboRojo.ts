// inCaboRojo.ts — geographic predicate for the municipality.
// The DB carries places from across PR; for Cabo-Rojo-specific stats we filter here.
//
// Two checks (place passes if EITHER matches):
//   1. Address string mentions Cabo Rojo or one of the 7 known barrios
//   2. Coords fall inside the municipality bounding box (conservative)
//
// Aligned with ExplorerSheet's NEIGHBORHOODS list so the UI and counts agree.

import { Place } from '../types';

const BARRIOS = ['cabo rojo', 'joyuda', 'boquerón', 'boqueron', 'puerto real', 'combate', 'corozo', 'miradero', 'llanos costa', 'monte grande', 'bajura', 'betances', 'guanajibo'];

// Cabo Rojo municipality bbox (conservative — covers all barrios from
// north of Joyuda to Cabo Rojo Lighthouse south)
const BBOX = { latMin: 17.88, latMax: 18.10, lngMin: -67.27, lngMax: -67.07 };

export function isInCaboRojo(p: Place): boolean {
  // Coords first — most reliable when present
  if (p.coords && typeof p.coords.lat === 'number' && typeof p.coords.lng === 'number') {
    const { lat, lng } = p.coords;
    if (lat >= BBOX.latMin && lat <= BBOX.latMax && lng >= BBOX.lngMin && lng <= BBOX.lngMax) {
      return true;
    }
    // Coords exist but fall outside bbox — definitive: NOT in CR
    return false;
  }
  // No coords — fall back to address substring
  const addr = (p.address || '').toLowerCase();
  if (!addr) return false;
  return BARRIOS.some((b) => addr.includes(b));
}

export function filterToCaboRojo<T extends Place>(places: T[]): T[] {
  return places.filter(isInCaboRojo);
}
