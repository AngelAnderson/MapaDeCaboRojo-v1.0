// freshness.ts — verification freshness tier helper
// The moat is "verified a pie" — this turns the invisible column into a visible pill.

export type FreshnessTier = 'fresh' | 'aging' | 'stale' | 'unverified';

export interface FreshnessInfo {
  tier: FreshnessTier;
  daysAgo: number | null;
  label: string;
  shortLabel: string;
  colorClass: string;
  ringClass: string;
}

const FRESH_DAYS = 90;
const AGING_DAYS = 180;

export function getFreshnessTier(verified_at?: string | null, isVerified?: boolean): FreshnessInfo {
  if (!verified_at) {
    return {
      tier: 'unverified',
      daysAgo: null,
      label: isVerified ? 'Verificado' : 'Sin verificar',
      shortLabel: isVerified ? 'Verif.' : '—',
      colorClass: isVerified
        ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
        : 'bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
      ringClass: 'ring-slate-300',
    };
  }
  const verifiedDate = new Date(verified_at);
  const now = new Date();
  const daysAgo = Math.floor((now.getTime() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysAgo <= FRESH_DAYS) {
    return {
      tier: 'fresh',
      daysAgo,
      label: `Verificado hace ${daysAgo}d`,
      shortLabel: `${daysAgo}d`,
      colorClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      ringClass: 'ring-emerald-400',
    };
  }
  if (daysAgo <= AGING_DAYS) {
    return {
      tier: 'aging',
      daysAgo,
      label: `Verificado hace ${daysAgo}d`,
      shortLabel: `${daysAgo}d`,
      colorClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      ringClass: 'ring-amber-400',
    };
  }
  return {
    tier: 'stale',
    daysAgo,
    label: `Verificado hace ${daysAgo}d — necesita revisita`,
    shortLabel: `${daysAgo}d`,
    colorClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    ringClass: 'ring-red-400',
  };
}

export function isFresh(verified_at?: string | null): boolean {
  return getFreshnessTier(verified_at).tier === 'fresh';
}
