// sponsorTier.ts — visual hierarchy that maps to revenue.
// Vitrina (paid) > Comp boost (recommended by El Veci) > Free.
// If they all look the same, nobody pays.

import { Place } from '../types';

export type SponsorTier = 'vitrina' | 'comp' | 'free';

export interface SponsorTierInfo {
  tier: SponsorTier;
  label: string;
  badgeIcon: string;
  badgeClass: string; // pill background + text
  borderClass: string; // optional border for hero-style cards
}

export function getSponsorTier(place: Place): SponsorTierInfo {
  // Vitrina = paid plan (basic/pro/enterprise)
  if (place.plan && place.plan !== 'free') {
    return {
      tier: 'vitrina',
      label: 'Vitrina',
      badgeIcon: 'crown',
      badgeClass:
        'bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-md shadow-amber-500/30',
      borderClass: 'border-2 border-amber-400 dark:border-amber-500',
    };
  }
  // Comp = is_featured but plan='free' (recomendado por El Veci, perpetual free boost)
  if (place.is_featured) {
    return {
      tier: 'comp',
      label: 'Recomendado por El Veci',
      badgeIcon: 'thumbs-up',
      badgeClass: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
      borderClass: 'border border-teal-200 dark:border-teal-800',
    };
  }
  return {
    tier: 'free',
    label: '',
    badgeIcon: '',
    badgeClass: '',
    borderClass: 'border border-slate-100 dark:border-slate-700/50',
  };
}
