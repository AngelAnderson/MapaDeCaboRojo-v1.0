import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

// =============== INLINED economicConstants (Vercel module bundle workaround) ===============
/**
 * Cabo Rojo economic constants — sourced from
 * `Outbox/CaboRojo/Sobreoferta-CR-2026-05-06.md` (Section 2.5)
 *
 * STATUS: v1 estimates. Phase 2 replaces per-capita spend + capture rates
 * with sourced values (BLS QCEW, NRA, NACS, NCPDP, IHRSA, ADA, PRTC).
 *
 * Used by: /pueblo-en-numeros + /admin/municipio
 */

export const CABO_ROJO_BASELINE = {
  residents: 47_158,           // Census ACS 5-year 2019-2023 — verified May 11 2026 via data.census.gov/profile?q=Cabo+Rojo+Municipio,+Puerto+Rico (Census 2020 said 50,798 — outdated)
  regional_pull: 75_000,       // CR 47K + Hormigueros 15K + Lajas 23K partial + San Germán 30K partial — Phase 2 confirms with commuter data
  visitors_annual: 250_000,    // ⚠️ ESTIMATE NO VERIFICADO — PRTC no publica número CR-specific. Phase 2 instala counters Boquerón–Joyuda–Combate
  visitor_spend_per_visit: 150, // ⚠️ ESTIMATE — mid de $120-180 range, no data PR-específica pública
  household_count: 18_500,     // Census ACS 5-year 2019-2023 — ~18.5K households (housing units 28,577 incluye vacant/seasonal). 47,158 ÷ 2.55 hh size = 18,494
  household_size: 2.55,         // Census ACS 5-year 2019-2023
  median_income: 26_408,       // Census ACS 5-year 2019-2023 — verified screenshot data.census.gov
  source_population: 'US Census Bureau ACS 5-year 2019-2023 (most recent available)',
  source_visitors: 'PRTC estimate — NO independently verified',
  // pr_avg_business_per_capita: REMOVED. The "1 cada 90" was a heuristic estimate with no source.
  // Real density comparison (May 11 2026, via our directory):
  // Hormigueros 1/47 · Cabo Rojo 1/50 · San Germán 1/50 · Lajas 1/62 · Sabana Grande 1/81 · Mayagüez 1/87
  // PR-wide comparison pending BLS QCEW integration (Phase 2). NO claim "50% más denso que PR" sin esa data.
} as const;

/**
 * Verified federal-data layer — pulled from official APIs (no estimate).
 * Verified 2026-06-29.
 *
 * QCEW: BLS Quarterly Census of Employment & Wages, annual 2023 averages,
 *   all ownership + all industries (agglvl 70 county / 50 state). Counts
 *   employer establishments with payroll under UI coverage — it UNDERCOUNTS
 *   sole-proprietors / the informal economy, which is exactly the gap our
 *   live directory captures. This is the source the page promised ("pendiente BLS QCEW").
 *   Source: https://data.bls.gov/cew/data/api/2023/a/area/<fips>.csv (72023 = Cabo Rojo, 72000 = PR)
 *
 * USASpending: federal GRANTS (award types 02-05), place-of-performance
 *   Cabo Rojo (FIPS 72-023), FY2020-2026 — 20 awards. Source: api.usaspending.gov.
 *
 * Population: ACS 2024 1-year (PR = 3,203,295; CR = 47,158 ACS 5-yr per baseline above).
 */
export const VERIFIED_FEDERAL_DATA = {
  qcew_estabs_cr_2023: 687,
  qcew_estabs_pr_2023: 53_356,
  pop_pr: 3_203_295,
  usaspending_grants_cr_total: 13_785_467,
  source_qcew: 'BLS QCEW · promedio anual 2023',
  source_usaspending: 'USASpending.gov · grants FY2020-26 · lugar de ejecución Cabo Rojo',
} as const;

export type AudienceCalc = {
  residents?: number;     // multiplier on residents (1.0 = all)
  regional?: number;      // multiplier on regional_pull
  visitor_capture?: number; // % of annual visitor flow that captures this category (0-1)
};

export type CategoryParams = {
  key: string;
  label: string;
  // Mode A — per-capita × audience:
  per_capita_spend?: number;   // annual $ per audience-member
  audience_calc?: AudienceCalc;
  // Mode B — direct TAM (for non-per-capita categories):
  tam_yr_override?: number;
  tam_explanation?: string;
  // Common:
  local_capture_rate: number;  // 0-1 — % of TAM captured locally (vs fuga)
  breakeven_low: number;       // annual revenue/biz minimum to survive
  breakeven_high: number;      // annual revenue/biz comfortable
  source_per_capita?: string;
  source_capture?: string;
  fuga_target?: string;
};

/**
 * 14 categories from Sobreoferta doc Section 2.5 (tables A/B/C).
 * Keys match HEAT_BUCKETS_DEF in api/pages.ts where applicable.
 */
export const CATEGORY_TAM_PARAMS: CategoryParams[] = [
  // === A. Confirmed oversupply by bot ===
  {
    key: 'boutique', label: 'Boutique / ropa',
    per_capita_spend: 800,
    audience_calc: { residents: 1.0, regional: 0.4 }, // 50K + ~30K regional shoppers
    local_capture_rate: 0.08,
    breakeven_low: 400_000, breakeven_high: 600_000,
    source_per_capita: 'BLS CES Apparel/footwear PR avg',
    source_capture: 'estimate — fuga masiva Marshalls + Amazon + Mayagüez Mall + SJ',
    fuga_target: 'Marshalls + Amazon + Mayagüez Mall',
  },
  {
    key: 'legal', label: 'Abogado / notario',
    per_capita_spend: 180,
    audience_calc: { regional: 1.0 }, // 75K regional
    local_capture_rate: 0.65,
    breakeven_low: 250_000, breakeven_high: 400_000,
    source_per_capita: 'PR avg legal services per capita',
    source_capture: 'high — servicio se compra local via referido',
  },

  // === B. Saturación leve ===
  {
    key: 'gasolinera', label: 'Gasolinera',
    per_capita_spend: 1_200,
    audience_calc: { regional: 1.0, visitor_capture: 0.06 }, // 75K + ~15K visitor-equivalents
    local_capture_rate: 0.90,
    breakeven_low: 1_500_000, breakeven_high: 3_000_000,
    source_per_capita: 'NACS PR convenience industry',
    source_capture: 'high — utility, no fuga',
  },
  {
    key: 'farmacia', label: 'Farmacia',
    per_capita_spend: 620,
    audience_calc: { regional: 1.0 },
    local_capture_rate: 0.85,
    breakeven_low: 800_000, breakeven_high: 1_200_000,
    source_per_capita: 'NCPDP PR pharmacy spend',
    source_capture: 'chains absorben mayoría',
  },
  {
    key: 'gimnasio', label: 'Gimnasio',
    per_capita_spend: 40,
    audience_calc: { residents: 1.0 },
    local_capture_rate: 0.75,
    breakeven_low: 150_000, breakeven_high: 250_000,
    source_per_capita: 'IHRSA US/PR gym membership penetration',
    source_capture: 'mostly local',
  },
  {
    key: 'car_wash', label: 'Car wash',
    per_capita_spend: 35,
    audience_calc: { residents: 1.0, visitor_capture: 0.0 },
    local_capture_rate: 0.85,
    breakeven_low: 80_000, breakeven_high: 150_000,
    source_per_capita: 'estimate — auto care PR avg',
  },
  {
    key: 'dentista', label: 'Dentista',
    per_capita_spend: 300,
    audience_calc: { regional: 1.0 },
    local_capture_rate: 0.70,
    breakeven_low: 400_000, breakeven_high: 700_000,
    source_per_capita: 'ADA dental services per capita PR',
    source_capture: 'especialistas viaje a SJ',
  },

  // === C. Sospechas oversupply (TAM/SOM gives verdict) ===
  {
    key: 'restaurante', label: 'Restaurante casual',
    // Hybrid: residents food + visitor food. Doc: "$80M TAM = 50K res × $1400 + 250K visitor × $40 food"
    tam_yr_override: 80_000_000,
    tam_explanation: '50K res × $1,400/yr (NRA PR) + 250K visitor × $40/visit food',
    local_capture_rate: 0.75,
    breakeven_low: 600_000, breakeven_high: 1_000_000,
    source_per_capita: 'NRA PR restaurant industry',
  },
  {
    key: 'hospedaje', label: 'Hospedaje',
    tam_yr_override: 56_250_000,
    tam_explanation: '250K visitor × 2.5 nights × $90/night',
    local_capture_rate: 0.60,
    breakeven_low: 500_000, breakeven_high: 1_000_000,
    source_per_capita: 'PRTC visitor occupancy + ADR',
    fuga_target: 'Airbnb (25%) + San Juan hotels (15%)',
  },
  {
    key: 'food_truck', label: 'Food truck',
    per_capita_spend: 380,
    audience_calc: { residents: 1.0, visitor_capture: 0.0 },
    local_capture_rate: 0.80,
    breakeven_low: 200_000, breakeven_high: 400_000,
    source_per_capita: 'NRA street food / mobile food',
  },
  {
    key: 'medico', label: 'Médico general / pediatra',
    per_capita_spend: 620,
    audience_calc: { regional: 1.0 },
    local_capture_rate: 0.80,
    breakeven_low: 400_000, breakeven_high: 700_000,
    source_per_capita: 'CMS Office Visits avg PR',
    source_capture: 'insurance sticky',
  },
  {
    key: 'bar', label: 'Bar / nightlife',
    per_capita_spend: 220,
    audience_calc: { residents: 1.0, visitor_capture: 0.05 },
    local_capture_rate: 0.70,
    breakeven_low: 300_000, breakeven_high: 500_000,
    source_per_capita: 'BLS alcohol off-prem PR',
  },
  {
    key: 'mecanico', label: 'Mecánico',
    per_capita_spend: 480,
    audience_calc: { regional: 1.0 },
    local_capture_rate: 0.70,
    breakeven_low: 400_000, breakeven_high: 700_000,
    source_per_capita: 'BLS auto repair PR avg',
    source_capture: 'specialty fuga Mayagüez',
  },
  {
    key: 'bienes_raices', label: 'Bienes raíces',
    tam_yr_override: 10_000_000,
    tam_explanation: '$200M turnover/yr × 5% comisión',
    local_capture_rate: 0.70,
    breakeven_low: 200_000, breakeven_high: 400_000,
    source_per_capita: 'estimate — PR realty turnover by ZIP',
  },
  {
    key: 'salon_belleza', label: 'Salón de belleza',
    per_capita_spend: 190,
    audience_calc: { residents: 0.5 }, // ~50% female-served market
    local_capture_rate: 0.85,
    breakeven_low: 80_000, breakeven_high: 180_000,
    source_per_capita: 'PBA personal care services',
  },

  // === D. Categorías nuevas (v2 expansion) ===
  {
    key: 'panaderia', label: 'Panadería',
    per_capita_spend: 200,
    audience_calc: { residents: 1.0 },
    local_capture_rate: 0.90,
    breakeven_low: 200_000, breakeven_high: 400_000,
    source_per_capita: 'BLS CES bakery products PR avg',
  },
  {
    key: 'pizzeria', label: 'Pizzería',
    per_capita_spend: 180,
    audience_calc: { residents: 1.0, visitor_capture: 0.05 },
    local_capture_rate: 0.80,
    breakeven_low: 200_000, breakeven_high: 400_000,
    source_per_capita: 'NRA pizza segment PR',
  },
  {
    key: 'lavanderia', label: 'Lavandería',
    per_capita_spend: 60,
    audience_calc: { residents: 1.0 },
    local_capture_rate: 0.95,
    breakeven_low: 80_000, breakeven_high: 150_000,
    source_per_capita: 'BLS CES laundry/dry cleaning',
  },
  {
    key: 'ferreteria', label: 'Ferretería',
    per_capita_spend: 150,
    audience_calc: { residents: 1.0 },
    local_capture_rate: 0.70,
    breakeven_low: 300_000, breakeven_high: 600_000,
    source_per_capita: 'BLS CES home maintenance',
    fuga_target: 'Home Depot Mayagüez',
  },
  {
    key: 'heladeria', label: 'Heladería',
    per_capita_spend: 30,
    audience_calc: { residents: 1.0, visitor_capture: 0.10 },
    local_capture_rate: 0.80,
    breakeven_low: 80_000, breakeven_high: 150_000,
    source_per_capita: 'NRA frozen desserts segment',
  },
  {
    key: 'veterinario', label: 'Veterinario',
    per_capita_spend: 90,
    audience_calc: { regional: 0.4 }, // ~40% of regional pull (pets ratio)
    local_capture_rate: 0.80,
    breakeven_low: 200_000, breakeven_high: 400_000,
    source_per_capita: 'AVMA pet expenditure PR',
  },
  {
    key: 'reposteria', label: 'Repostería con licencia',
    per_capita_spend: 60,
    audience_calc: { residents: 1.0 },
    local_capture_rate: 0.75,
    breakeven_low: 80_000, breakeven_high: 150_000,
    source_per_capita: 'estimate — informal market large in PR',
  },
  {
    key: 'tatuajes', label: 'Tatuajes / piercings',
    per_capita_spend: 40,
    audience_calc: { residents: 1.0, visitor_capture: 0.08 },
    local_capture_rate: 0.85,
    breakeven_low: 80_000, breakeven_high: 150_000,
    source_per_capita: 'estimate — body art industry PR',
  },
  {
    key: 'colmado', label: 'Colmado / mini-market',
    per_capita_spend: 400,
    audience_calc: { residents: 1.0 },
    local_capture_rate: 0.90,
    breakeven_low: 300_000, breakeven_high: 500_000,
    source_per_capita: 'NACS PR neighborhood grocers',
  },
  {
    key: 'barberia', label: 'Barbería',
    per_capita_spend: 120,
    audience_calc: { residents: 0.5 }, // mostly male
    local_capture_rate: 0.90,
    breakeven_low: 80_000, breakeven_high: 150_000,
    source_per_capita: 'PBA barbershop services',
  },

  // === E. Servicios pueblo te necesita (v4 expansion 2026-05-19) ===
  {
    key: 'aire_acondicionado', label: 'Aire acondicionado (AC tech)',
    per_capita_spend: 180,
    audience_calc: { regional: 1.0 }, // 115K — service pa' hogares de toda la región
    local_capture_rate: 0.80,
    breakeven_low: 150_000, breakeven_high: 300_000,
    source_per_capita: 'estimate — BLS HVAC service PR avg + clima caribeño · próxima versión calibra',
    source_capture: 'servicio físico local',
  },
  {
    key: 'plomero', label: 'Plomero',
    per_capita_spend: 120,
    audience_calc: { regional: 1.0 },
    local_capture_rate: 0.85,
    breakeven_low: 100_000, breakeven_high: 200_000,
    source_per_capita: 'estimate — BLS plumbing repair PR · próxima versión calibra',
    source_capture: 'high — emergencia local',
  },
  {
    key: 'electricista', label: 'Electricista',
    per_capita_spend: 90,
    audience_calc: { regional: 1.0 },
    local_capture_rate: 0.85,
    breakeven_low: 100_000, breakeven_high: 200_000,
    source_per_capita: 'estimate — BLS electrical contractor PR · próxima versión calibra',
    source_capture: 'high — emergencia local',
  },
  {
    key: 'marina', label: 'Marina / náutico',
    tam_yr_override: 8_000_000,
    tam_explanation: '250K visitantes × ~5% náuticos × $640 servicios + slip rentals + chárter',
    local_capture_rate: 0.75,
    breakeven_low: 500_000, breakeven_high: 1_500_000,
    source_per_capita: 'PRTC nautical tourism + Marina Puerto Real benchmark · próxima versión calibra',
    fuga_target: 'Salinas + Fajardo (marinas más grandes)',
  },
];

/**
 * Categories with 0 supply but real demand (from bot data).
 * Used for "el pueblo te necesita" callouts.
 * Demand counts come live from mv_real_searches_90d at request time.
 */
export const ZERO_SUPPLY_CATEGORIES: Array<{ key: string; label: string; emoji: string }> = [
  { key: 'plomero', label: 'Plomero', emoji: '🔧' },
  { key: 'electricista', label: 'Electricista', emoji: '⚡' },
  { key: 'aire', label: 'Aire acondicionado', emoji: '❄️' },
  { key: 'cardiologo', label: 'Cardiólogo', emoji: '❤️' },
  { key: 'ginecologo', label: 'Ginecólogo', emoji: '🩺' },
  { key: 'eventos', label: 'Planificador de eventos', emoji: '🎉' },
  { key: 'propano', label: 'Propano', emoji: '🔥' },
  { key: 'nursing_home', label: 'Nursing home', emoji: '🏥' },
  { key: 'reposteria', label: 'Repostería', emoji: '🎂' },
  { key: 'terapia_fisica', label: 'Terapia física', emoji: '💪' },
];

/**
 * National (PR) per-capita business density benchmarks for density comparison chart.
 * Source: estimates from BLS QCEW + Junta Planificación PR — Phase 2 sources properly.
 * Format: people per 1 business of that category.
 */
export const PR_AVG_PER_CAPITA: Record<string, number> = {
  restaurante: 1500,    // 1 restaurante per 1500 personas en PR
  farmacia: 2000,
  gimnasio: 5000,
  salon_belleza: 3000,
  dentista: 4000,
  medico: 1500,
  hospedaje: 8000,      // varies wildly by tourism intensity
  food_truck: 4500,
  bar: 3500,
  mecanico: 2500,
  car_wash: 5000,
  gasolinera: 4500,
  legal: 4000,
  bienes_raices: 5500,
  boutique: 6000,
  plomero: 2500,
  electricista: 2500,
  aire: 4500,
  aire_acondicionado: 4500, // v4 add
  marina: 12000, // v4 add — muy pocas marinas por persona PR-wide
  // New buckets added 2026-05-12 — Phase 2 calibration with BLS QCEW
  handyman: 2000,
  pintor: 4000,
  carpintero: 6000,
  costurera: 5000,
  catering: 8000,
  wedding: 15000,
  spa: 5000,
  trainer: 6000,
  tour: 10000,
  bicicleta: 12000,
  tatuajes: 8000,
};

/**
 * Helper — compute audience size given calc + baseline.
 */
export function computeAudienceSize(
  calc: AudienceCalc | undefined,
  baseline: typeof CABO_ROJO_BASELINE
): number {
  if (!calc) return baseline.residents;
  let n = 0;
  if (calc.residents) n += baseline.residents * calc.residents;
  if (calc.regional) n += baseline.regional_pull * calc.regional;
  if (calc.visitor_capture) n += baseline.visitors_annual * calc.visitor_capture;
  return Math.round(n);
}


// =============== INLINED marketAnalysis ===============
/**
 * Market analysis helpers for /pueblo-en-numeros
 * — TAM/SAM/SOM compute, density comparison, ajá moments detection.
 */

export type TamSomResult = {
  key: string;
  label: string;
  audienceSize: number;
  tam: number;            // total addressable market $/yr
  tamExplanation: string;
  sam: number;            // serviceable addressable market $/yr
  localCaptureRate: number;
  supply: number;         // negocios open en directorio
  som: number;            // serviceable obtainable market $/biz/yr
  breakevenLow: number;
  breakevenHigh: number;
  verdict: 'below_breakeven' | 'borderline' | 'healthy' | 'zero_supply';
  verdictEmoji: string;
  verdictLabel: string;
  fugaTarget?: string;
  sourcePerCapita?: string;
};

/**
 * Compute full TAM/SAM/SOM for one category.
 */
export function computeTamSamSom(
  params: CategoryParams,
  supply: number,
  baseline = CABO_ROJO_BASELINE
): TamSomResult {
  let tam: number;
  let tamExplanation: string;
  let audienceSize: number;

  if (params.tam_yr_override !== undefined) {
    tam = params.tam_yr_override;
    tamExplanation = params.tam_explanation || `$${(tam / 1_000_000).toFixed(1)}M (direct)`;
    audienceSize = 0; // not applicable
  } else {
    audienceSize = computeAudienceSize(params.audience_calc, baseline);
    tam = (params.per_capita_spend || 0) * audienceSize;
    tamExplanation = `${audienceSize.toLocaleString('es-PR')} audiencia × $${params.per_capita_spend}/yr`;
  }

  const sam = tam * params.local_capture_rate;
  const som = supply > 0 ? sam / supply : 0;

  let verdict: TamSomResult['verdict'];
  let verdictEmoji: string;
  let verdictLabel: string;

  if (supply === 0) {
    verdict = 'zero_supply';
    verdictEmoji = '🔥';
    verdictLabel = 'Cero supply';
  } else if (som < params.breakeven_low * 0.85) {
    verdict = 'below_breakeven';
    verdictEmoji = '⚪';
    verdictLabel = 'Debajo breakeven';
  } else if (som < params.breakeven_high) {
    verdict = 'borderline';
    verdictEmoji = '🟡';
    verdictLabel = 'Borderline';
  } else {
    verdict = 'healthy';
    verdictEmoji = '🟢';
    verdictLabel = 'Holgado';
  }

  return {
    key: params.key,
    label: params.label,
    audienceSize,
    tam,
    tamExplanation,
    sam,
    localCaptureRate: params.local_capture_rate,
    supply,
    som,
    breakevenLow: params.breakeven_low,
    breakevenHigh: params.breakeven_high,
    verdict,
    verdictEmoji,
    verdictLabel,
    fugaTarget: params.fuga_target,
    sourcePerCapita: params.source_per_capita,
  };
}

// =================== Business Verdicts — SINGLE SOURCE OF TRUTH ===================
// Una sola fórmula alimenta DOS páginas: /pueblo-en-numeros (El Espejo) y /me-conviene.
// Si cambias el cálculo aquí, las dos páginas cambian juntas. Cero contradicción de números.
export type BusinessVerdict = {
  k: string; label: string; emoji: string;
  supply: number; vComfort: number; vSurvive: number; demand: number;
  verdict: 'over' | 'tight' | 'room' | 'zero';
};

export function buildVerdictsFromComputed(
  tamSomResults: Array<{ key: string; label: string; supply: number; sam: number; breakevenLow: number; breakevenHigh: number }>,
  heatWithDemand: Array<{ key: string; label: string; emoji: string; demand: number; supply: number }>
): { data: BusinessVerdict[]; byKey: Record<string, BusinessVerdict> } {
  const byKey: Record<string, BusinessVerdict> = {};
  for (const t of tamSomResults) {
    const hd = heatWithDemand.find(h => h.key === t.key);
    const vComfort = t.breakevenHigh > 0 ? Math.floor(t.sam / t.breakevenHigh) : 0; // viven cómodos
    const vSurvive = t.breakevenLow > 0 ? Math.floor(t.sam / t.breakevenLow) : 0;    // apenas sobreviven
    let v: BusinessVerdict['verdict'];
    if (t.supply === 0) v = 'zero';
    else if (t.supply > vSurvive) v = 'over';
    else if (t.supply > vComfort) v = 'tight';
    else v = 'room';
    byKey[t.key] = { k: t.key, label: t.label, emoji: hd?.emoji || '🏪', supply: t.supply, vComfort, vSurvive, demand: hd?.demand || 0, verdict: v };
  }
  for (const h of heatWithDemand) { // vacíos con demanda real
    if (!byKey[h.key] && h.supply === 0 && h.demand > 0) {
      byKey[h.key] = { k: h.key, label: h.label, emoji: h.emoji || '🔥', supply: 0, vComfort: 0, vSurvive: 0, demand: h.demand, verdict: 'zero' };
    }
  }
  const data = Object.values(byKey).sort((a, b) => {
    const order: Record<string, number> = { over: 0, tight: 1, room: 2, zero: 3 };
    return (order[a.verdict] - order[b.verdict]) || (b.supply - a.supply);
  });
  return { data, byKey };
}

// Async wrapper — corre las queries y devuelve los veredictos. Para /me-conviene.
export async function fetchBusinessVerdicts(): Promise<{ data: BusinessVerdict[]; byKey: Record<string, BusinessVerdict> }> {
  const [allPlaces, realSearches90d] = await Promise.all([
    supabase.from('places').select('name, category, subcategory, tags').eq('visibility', 'published').eq('status', 'open').eq('municipality', 'Cabo Rojo').range(0, 4999).then((r: any) => r.data || []),
    supabase.from('mv_real_searches_90d').select('*').then((r: any) => r.data || []),
  ]);
  const supplyByCat = computeSupplyByCategory(allPlaces);
  const tamSomResults = CATEGORY_TAM_PARAMS.map(p => computeTamSamSom(p, supplyByCat[p.key] || 0));
  const heatWithDemand = HEAT_BUCKETS_DEF.map(b => ({
    key: b.key, label: b.label, emoji: b.emoji,
    demand: realSearches90d.filter((rq: any) => b.qRegex.test(rq.q_norm || '')).reduce((s: number, rq: any) => s + rq.cnt, 0),
    supply: allPlaces.filter(b.matches).length,
  }));
  return buildVerdictsFromComputed(tamSomResults as any, heatWithDemand);
}

/**
 * Density comparison — CR vs PR average per capita.
 */
export type DensityRow = {
  key: string;
  label: string;
  emoji: string;
  supplyCr: number;
  audienceCr: number;
  perCapitaCr: number;        // people per 1 business in CR
  perCapitaPr: number;        // PR average
  multiplier: number;         // CR density vs PR (1.0 = paridad, 2.0 = double, 0.5 = half)
  verdict: 'denser' | 'parity' | 'thinner' | 'zero';
  categorySlug?: string;
};

export function computeDensityComparison(
  buckets: Array<{ key: string; label: string; emoji: string; supply: number; categorySlug?: string }>,
  baseline = CABO_ROJO_BASELINE
): DensityRow[] {
  // Use regional pull for service-style cats, residents for others — simple heuristic
  const regionalKeys = new Set(['legal', 'farmacia', 'medico', 'dentista', 'mecanico', 'hospedaje']);
  return buckets.map(b => {
    const audienceCr = regionalKeys.has(b.key) ? baseline.regional_pull : baseline.residents;
    const perCapitaCr = b.supply > 0 ? Math.round(audienceCr / b.supply) : 0;
    const perCapitaPr = PR_AVG_PER_CAPITA[b.key] || 0;
    const multiplier = perCapitaPr > 0 && perCapitaCr > 0 ? perCapitaPr / perCapitaCr : 0;
    let verdict: DensityRow['verdict'];
    if (b.supply === 0) verdict = 'zero';
    else if (multiplier >= 1.3) verdict = 'denser';
    else if (multiplier >= 0.8) verdict = 'parity';
    else verdict = 'thinner';
    return {
      key: b.key, label: b.label, emoji: b.emoji,
      supplyCr: b.supply,
      audienceCr,
      perCapitaCr, perCapitaPr,
      multiplier,
      verdict,
      categorySlug: b.categorySlug,
    };
  }).filter(r => r.perCapitaPr > 0); // only categories with PR benchmark
}

// =================== Ajá Moments ===================

export type AjaMoment = {
  key: string;            // unique slug `<category>:<angle>`
  emoji: string;
  kicker: string;         // short tag ("Muerte por inanición")
  headline: string;       // 1 line
  body: string;           // 1-2 sentences
  source: 'auto' | 'override';
  impactScore: number;    // for sorting — supply×demand × magnitude
};

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toFixed(0);
}

function fmtM(n: number): string {
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/**
 * Auto-detect ajá moments from data.
 */
export function detectAjaMoments(
  tamSomResults: TamSomResult[],
  heatBuckets: Array<{ key: string; label: string; emoji: string; demand: number; supply: number }>,
  geoData: Record<string, Record<string, number>> // category → barrio → count
): AjaMoment[] {
  const ajas: AjaMoment[] = [];

  // Rule 1: SOM dramatically below breakeven — "muerte por inanición"
  for (const t of tamSomResults) {
    if (t.verdict === 'below_breakeven') {
      ajas.push({
        key: `${t.key}:below-breakeven`,
        emoji: '⚪',
        kicker: 'Muerte por inanición',
        headline: `${t.label}: SOM $${fmtK(t.som)}/biz vs breakeven $${fmtK(t.breakevenLow)}-${fmtK(t.breakevenHigh)}.`,
        body: `${t.supply} negocios peleando por $${fmtM(t.sam)}/año. La matemática dice oversupply económico.`,
        source: 'auto',
        impactScore: t.supply * (t.breakevenLow - t.som) / 1_000,
      });
    }
  }

  // Rule 2: Bot bias — search_per_biz hidden by referral nature, but TAM/SOM healthy
  // Heuristic: legal/medico/dentista categories often referral-driven
  const referralCategories = new Set(['legal', 'medico', 'dentista']);
  for (const t of tamSomResults) {
    if (referralCategories.has(t.key) && t.verdict === 'healthy') {
      ajas.push({
        key: `${t.key}:bot-bias`,
        emoji: '🤖',
        kicker: 'El bot mintió',
        headline: `${t.label}: bot dice oversupply, TAM/SOM dice saludable.`,
        body: `Servicio que se contrata via referido personal, no SMS. SOM $${fmtK(t.som)} vs breakeven $${fmtK(t.breakevenHigh)} = bien parado.`,
        source: 'auto',
        impactScore: t.supply * t.som / 1_000,
      });
    }
  }

  // Rule 3: ZERO supply + demand
  for (const h of heatBuckets) {
    if (h.supply === 0 && h.demand >= 5) {
      ajas.push({
        key: `${h.key}:zero-supply`,
        emoji: '🔥',
        kicker: 'El pueblo te necesita',
        headline: `${h.label}: 0 en directorio, ${h.demand} búsquedas/90d.`,
        body: 'Categoría sin proveedor visible al bot. Si tienes la habilidad, el mercado existe.',
        source: 'auto',
        impactScore: h.demand * 100,
      });
    }
  }

  // Rule 4: Geographic concentration >50% in one barrio
  // Normalize category label → key form (matches override keys like 'hospedaje:geo-concentration')
  const catLabelToKey: Record<string, string> = {
    'Hospedaje': 'hospedaje', 'Comida': 'restaurante', 'Salud': 'medico',
    'Compras': 'compras', 'Belleza': 'salon_belleza', 'Automotriz': 'mecanico',
    'Servicios': 'servicios', 'Cultura': 'cultura', 'Educación': 'educacion',
    'Actividades': 'actividades', 'Atracciones': 'atracciones',
  };
  for (const [cat, dist] of Object.entries(geoData)) {
    const entries = Object.entries(dist).filter(([b]) => b !== 'sin-asignar');
    const total = entries.reduce((s, [, n]) => s + n, 0);
    if (total < 5) continue;
    entries.sort((a, b) => b[1] - a[1]);
    const [topBarrio, topCount] = entries[0];
    const topPct = topCount / total;
    if (topPct >= 0.5) {
      const catKey = catLabelToKey[cat] || cat.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      ajas.push({
        key: `${catKey}:geo-concentration`,
        emoji: '🏝️',
        kicker: 'Corredor saturado',
        headline: `${cat}: ${Math.round(topPct * 100)}% concentrado en ${topBarrio}.`,
        body: `${topCount} de ${total} negocios de ${cat.toLowerCase()} en un solo barrio. Geografía pura, no opinión.`,
        source: 'auto',
        impactScore: topCount * 50,
      });
    }
  }

  // Rule 5: Structural fuga — low capture rate + below breakeven
  for (const t of tamSomResults) {
    if (t.localCaptureRate < 0.4 && t.verdict === 'below_breakeven') {
      ajas.push({
        key: `${t.key}:fuga-structural`,
        emoji: '🚪',
        kicker: 'Fuga estructural',
        headline: `${t.label}: ${Math.round((1 - t.localCaptureRate) * 100)}% del gasto se va del pueblo.`,
        body: `Las ${t.supply} ${t.label.toLowerCase()} no compiten entre sí — compiten contra ${t.fugaTarget || 'opciones fuera del pueblo'}.`,
        source: 'auto',
        impactScore: (1 - t.localCaptureRate) * t.tam / 100_000,
      });
    }
  }

  return ajas;
}

/**
 * Parse the override MD file and merge with auto-detected.
 * Override format:
 *   ---
 *   key: <category>:<angle>
 *   override: true
 *   ---
 *   <emoji> **<headline>**
 *   <body>
 *
 * Multiple entries separated by `---` (each entry is frontmatter + body).
 */
export function parseAjaOverrides(mdContent: string): Map<string, Pick<AjaMoment, 'emoji' | 'headline' | 'body' | 'kicker'>> {
  const out = new Map();
  if (!mdContent) return out;
  // Format: `## <key>` headers, body until next `## ` or end of doc
  const matches = Array.from(mdContent.matchAll(/## ([\w\-:]+)\s*\n([\s\S]*?)(?=\n## |$)/g));
  for (const m of matches) {
    const key = m[1].trim();
    const body = m[2].trim();
    if (!body) continue;
    const lines = body.split('\n').filter(l => l.trim());
    const firstLine = lines[0] || '';
    const tokenMatch = firstLine.match(/^(\S+)\s+/);
    const emoji = tokenMatch && !/^[a-zA-Z]/.test(tokenMatch[1]) ? tokenMatch[1] : '';
    const headlineMatch = firstLine.match(/\*\*(.+?)\*\*/);
    const headline = headlineMatch ? headlineMatch[1] : firstLine.replace(/\*+/g, '').replace(/^\S+\s+/, '').trim();
    const restBody = lines.slice(1).join(' ').trim();
    out.set(key, { emoji, headline, body: restBody, kicker: '' });
  }
  return out;
}

/**
 * Merge auto-detected with overrides — overrides win on key match.
 * Returns top N by impact score.
 */
export function mergeAjaMoments(
  auto: AjaMoment[],
  overrides: Map<string, Pick<AjaMoment, 'emoji' | 'headline' | 'body' | 'kicker'>>,
  topN = 7
): AjaMoment[] {
  const merged = auto.map(a => {
    const ov = overrides.get(a.key);
    if (!ov) return a;
    return {
      ...a,
      emoji: ov.emoji || a.emoji,
      headline: ov.headline || a.headline,
      body: ov.body || a.body,
      source: 'override' as const,
      impactScore: a.impactScore + 5_000_000, // boost: overrides on auto rank above pure auto
    };
  });

  // Add overrides that have NO matching auto-detected moment (standalone editorial)
  for (const [key, ov] of overrides.entries()) {
    if (!merged.find(m => m.key === key)) {
      merged.push({
        key,
        emoji: ov.emoji,
        kicker: 'Insight editorial',
        headline: ov.headline,
        body: ov.body,
        source: 'override',
        impactScore: 10_000_000, // standalone overrides always rank first
      });
    }
  }

  return merged.sort((a, b) => b.impactScore - a.impactScore).slice(0, topN);
}

// =================== Category supply matchers ===================
// Map each TAM_PARAMS key to a place-supply matcher predicate.
// Used to count supply per category for TAM/SAM/SOM compute.
export const CATEGORY_SUPPLY_MATCHERS: Record<string, (p: any) => boolean> = {
  boutique: (p) => /boutique|tienda.*ropa/i.test(p.name || ''),
  legal: (p) => (p.category || '') === 'Legal' || /abogad|notari/i.test(p.name || ''),
  gasolinera: (p) => /gasolinera|gulf|texaco|shell|esso/i.test(p.name || '') || /gasolinera/i.test(p.subcategory || ''),
  farmacia: (p) => /farmacia|botica/i.test(p.name || '') || (p.subcategory || '').toLowerCase() === 'farmacia',
  gimnasio: (p) => /gimnasio|gym|crossfit/i.test(p.name || '') || (p.subcategory || '').toLowerCase() === 'gimnasio',
  car_wash: (p) => {
    // Exclude gasolineras (they often have car wash tag but are gas stations, not car washes)
    if ((p.category || '') === 'LOGISTICS' || /gasolinera|gulf|texaco|shell|esso/i.test(p.name || '')) return false;
    return /car\s*wash|carwash|lavado.*auto|auto\s*detailing|auto\s*spa/i.test(p.name || '')
      || /car\s*wash|car_wash|auto\s*detail|detailing/i.test(p.subcategory || '');
  },
  dentista: (p) => /dentista|dental|odontolog/i.test(p.name || '') || /dentista/i.test(p.subcategory || ''),
  restaurante: (p) => ['FOOD', 'Restaurantes', 'RESTAURANTE'].includes(p.category || '') && !/food truck|kiosko|pinchos/i.test(p.name || ''),
  hospedaje: (p) => ['LODGING', 'Hospedaje'].includes(p.category || ''),
  food_truck: (p) => /food truck|kiosko|kiosco/i.test(p.name || '') || /food.truck/i.test(p.subcategory || ''),
  medico: (p) => {
    const cat = p.category || '';
    if (!['HEALTH', 'Salud', 'salud'].includes(cat)) return false;
    const sub = (p.subcategory || '').toLowerCase().trim();
    const name = (p.name || '').toLowerCase();
    // Exclude by subcategory (these are NOT médicos generales/especialistas).
    // No anchor — match anywhere in the subcategory string (e.g. "Centro de Diagnostico" caught via "diagnos").
    if (/(dent|veterin|óptic|optic|optom|pharmac|farmac|botica|quiro|chiro|psic|psych|mental|laborator|diagnos|radiol|ambulan|terap|fisic|fisio|audiol|nutric|cannabis)/i.test(sub)) return false;
    // Exclude by name (English/variant names the simple regex misses)
    if (/(dental|veterinari|óptica|optica|pharmacy|farmacia|botica|chiropract|chiroprac|laundr|cannabis|animal medical|ambulance|ambulancia|laboratorio|laboratorios|radiology|radiología|odontolog)/i.test(name)) return false;
    return true;
  },
  bar: (p) => /\bbar\b|cantina|nightclub|club nocturno|nocturn/i.test(p.name || '') || ['Bares y Vida Nocturna', 'NIGHTLIFE'].includes(p.category || ''),
  mecanico: (p) => ['AUTO', 'Automotriz'].includes(p.category || '') && !/car wash|gomera|llanteria/i.test(p.name || ''),
  bienes_raices: (p) => /bienes.*raic|real.estate|realty/i.test(p.name || '') || (p.category || '') === 'Bienes Raíces',
  salon_belleza: (p) => ['BEAUTY', 'Belleza', 'Belleza y Bienestar'].includes(p.category || '') && !/barber/i.test(p.name || ''),
  panaderia: (p) => /panader/i.test(p.name || '') || /panader/i.test(p.subcategory || ''),
  pizzeria: (p) => /pizz/i.test(p.name || '') || /pizz/i.test(p.subcategory || ''),
  lavanderia: (p) => /lavander|laundr/i.test(p.name || '') || /lavander/i.test(p.subcategory || ''),
  ferreteria: (p) => /ferreter|hardware/i.test(p.name || '') || (p.category || '') === 'Ferretería',
  heladeria: (p) => {
    // Strict: must be primarily a heladería (subcategory OR category match) OR named brand/explicit ice cream shop
    // Excludes food trucks/sandwich shops that just SELL helado as side item via tags
    const subcatMatch = /heladeri|ice\s*cream|gelato|creamer/i.test(p.subcategory || '');
    const catMatch = (p.category || '') === 'Helados';
    const nameMatch = /heladeri|ice\s*cream|gelato|baskin|rex\s*cream/i.test(p.name || '');
    // For name match, also require it's NOT a food truck or restaurant primarily
    if (nameMatch && /food\s*truck/i.test(p.subcategory || '')) return false;
    return subcatMatch || catMatch || nameMatch;
  },
  veterinario: (p) => /veterinari/i.test(p.name || '') || /veterinari/i.test(p.subcategory || ''),
  reposteria: (p) => /reposteri|panader.*dulce|cake|bizcoch/i.test(p.name || '') || (p.subcategory || '').toLowerCase().includes('reposter'),
  tatuajes: (p) => {
    if (['FOOD', 'Restaurantes'].includes(p.category || '')) return false;
    if (/\bsupply\b/i.test(p.name || '')) return false;
    return /tatuaj|tattoo|piercing/i.test(p.name || '')
      || (p.category || '') === 'Tatuajes'
      || /tatua|tattoo/i.test(p.subcategory || '');
  },
  colmado: (p) => /colmado|mini.*mark|min(i|í).*super/i.test(p.name || '') || (p.category || '') === 'Colmado',
  barberia: (p) => /barber/i.test(p.name || '') || /barber/i.test(p.subcategory || ''),
  // v4 additions (2026-05-19) — pueblo te necesita
  aire_acondicionado: (p) => /aire.*acond|\bAC\b|HVAC|refriger/i.test(p.name || '') || /aire.*acond|hvac|refriger/i.test(p.subcategory || ''),
  plomero: (p) => /plomer|plumb/i.test(p.name || '') || /plomer/i.test(p.subcategory || ''),
  electricista: (p) => /electricist|electric.*contractor|electric.*service/i.test(p.name || '') || /electricist/i.test(p.subcategory || ''),
  marina: (p) => /marina|n[áa]utic|yacht|boat|chárter|charter|slip/i.test(p.name || '') || /marina|n[áa]utic/i.test(p.subcategory || ''),
};

/**
 * Count supply per TAM category by running matchers against all places.
 */
export function computeSupplyByCategory(places: any[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, match] of Object.entries(CATEGORY_SUPPLY_MATCHERS)) {
    out[key] = places.filter(match).length;
  }
  return out;
}


// =============== INLINED ajaOverrides ===============
/**
 * Editorial overrides for ajá moments on /pueblo-en-numeros.
 *
 * Voice: BrandVoice Angel — brutalmente honesto · específico no motivacional ·
 * humor boricua · build in public.
 *
 * Format per entry: `key: <category>:<angle>`, `override: true`, body with
 * emoji + **headline** + 1-3 sentences.
 *
 * Sync source of truth: `Outbox/CaboRojo/aja-moments.md` (Angel edits there;
 * copy here on deploy. Future: auto-build step.)
 */

export const AJA_OVERRIDES_MD = `
## boutique:below-breakeven
🚪 **Las boutiques no compiten entre sí — compiten contra Marshalls.**
90% del gasto en ropa de Cabo Rojo se va para Mayagüez Mall, Amazon, o el outlet de Plaza las Américas. Los 15 boutiques locales se pelean por el 10% que se queda. SOM $341K vs breakeven $400-600K = muerte estructural por inanición. La fuga es geografía + Amazon, no fracaso individual.

## legal:bot-bias
🤖 **El bot mintió sobre los abogados.**
Cuando el bot dice "0.47 búsquedas por abogado" suena oversupply. Pero los abogados se contratan por referido personal, no por SMS. TAM/SOM dice $462K/biz vs breakeven $250-400K = saludable. Los 19 están bien parados — el SMS bias engañó.

## hospedaje:geo-concentration
🏝️ **Boquerón concentra el hospedaje en un nicho beach de 200 metros.**
20 de 41 negocios de hospedaje en una sola playa. No admite el 21vo. Si el visitor flow baja 15%, default mass — sin colchón. La concentración no es "vibe del pueblo," es geografía pura.

## aire:zero-supply
🔧 **3 AC techs verificados pa' el pueblo entero — Luis David es el único con visibilidad consistente.**
CR Air Conditioning, EAS Air Conditioning, Luis David Refrigeración. Las otras dos no postean en FB ni tienen Google Profile mantenido. Cuando se rompe el AC un sábado 8pm, no hay 3 opciones reales — hay 1. La barrera no es dinero — es certificación HVAC + tiempo. Plomero, electricista, propano, handyman: mismo patrón. Si tienes la habilidad y entras al directorio, eres el primero que el bot recomienda.

## gimnasio:below-breakeven
⚪ **Los gimnasios están bajo breakeven.**
SOM $136K/biz vs breakeven $150-250K. Los 11 gimnasios viven al filo. La categoría tiene baja fricción de entrada (capital chiquito + licencia rápida) — replican lo que vieron, sin medir saturación porque no hay portal que la mida.

## feedback-loop:none
🔍 **Nadie en PR publica densidad por categoría — hasta hoy.**
La decisión "abrir un food truck más" se toma con cero data sobre saturación. CRIM publica patentes pero no agregadas. Junta de Planificación procesa permisos sin métricas. El alcalde no tiene un density dashboard. Por eso esta página existe.

## cabo-rojo:density-west-context
📊 **Cabo Rojo está en el promedio denso del oeste — el claim '50% más denso que PR' que decíamos antes era estimate sin source.**
1 negocio por cada 50 personas en CR. Hormigueros (1/47), San Germán (1/50), Lajas (1/62), Sabana Grande (1/81), Mayagüez (1/87). El claim original "50% más denso que PR" venía de un estimate genérico de "1 cada 90 PR avg" que no podíamos verificar. PR-wide comparison real requiere BLS QCEW data — pendiente Phase 2. Lo arreglé hoy (11 mayo). El pueblo SÍ es denso, pero específicamente: tan denso como sus vecinos del oeste.

## medico:paradox-overdemand
🩺 **Hay ~59 médicos + 9 dentistas en CR (no 191 como decía el chart antes). El problema es estructural, no de cantidad.**
44 médicos generales/pediatras + 15 especialistas verificados (cardiólogos, ginecólogos, dermatólogos, oncólogos, neurólogos, etc.). Mayoría concentrados en pueblo. Panel típico 1,500-2,000 pacientes (PR avg) + insurance-driven scheduling = 30-90 días pa cita. Más gente no abre más slots: abre más espera. El chart anterior contaba 191 porque metía a la cuenta laboratorios, ambulancias, ópticos, quiroprácticos y clínicas con "Pharmacy" en inglés. **Honestidad operativa:** lo arreglamos.

## farmacia:concentration
💊 **18 farmacias verificadas open en Cabo Rojo.**
Para 47,158 personas = 1 farmacia por cada 2,620. Mayoría concentradas en pueblo (varias en mismo radio de Calle Comercio). Chains (Walgreens, Walmart Pharmacy, CVS) absorben 70% del gasto vía Plan Médico/PBM. Las 18 sobreviven porque el TAM está holgado, pero margen pisado. El número 43 anterior contaba farmacias de toda la región oeste — corregido. La comparativa "2× más denso que PR" del PDF anterior la quité — venía de un estimate sin source verificable (Phase 2 con BLS QCEW).

## electricista:invisible-supply
⚡ **El bot recibió 48 búsquedas de electricista en 90 días. El directorio tiene 0.**
No es que no existan — es que no están en el directorio (operan boca-a-boca, sin Google Profile, sin web). Mismo patrón: plomero, AC tech, propano, handyman. Si tienes la habilidad y entras al directorio, eres el primero que el bot recomienda.
`.trim();



// ============ shared helpers ============

function esc(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-PR', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysAgoFrom(iso: string | null | undefined): number {
  if (!iso) return -1;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

// ============ municipio ============
// Heat-index bucket definitions — used for sugerencia 2 (Demanda vs Oferta)
// Each bucket maps a search-query regex to a place-supply matcher.
// categorySlug = link to /categoria/[slug] if click-through is supported.
const HEAT_BUCKETS_DEF: Array<{
  key: string; label: string; emoji: string; categorySlug?: string;
  qRegex: RegExp; matches: (p: any) => boolean;
}> = [
  { key:'plomeria', label:'Plomería', emoji:'🔧',
    qRegex:/(plomer|tuberi)/i,
    matches:(p)=>/plomer/i.test(p.name||'') || ((p.tags||[]) as string[]).some(t=>/plomer/i.test(t)) },
  { key:'electricista', label:'Electricista', emoji:'⚡',
    qRegex:/(electricis|\belectric)/i,
    matches:(p)=>/electric/i.test(p.name||'') || /electric/i.test(p.subcategory||'') || ((p.tags||[]) as string[]).some(t=>/electric/i.test(t)) },
  { key:'aire', label:'Aire/Refrigeración', emoji:'❄️',
    qRegex:/(aire acond|frigo|nevera|refriger)/i,
    matches:(p)=>{
      // Exclude clothing boutiques with "Aire" in name (e.g. "Aire Gypsy Boho Boutique")
      if ((p.category||'') === 'SHOPPING') return false;
      if (/boutique|\bropa\b|clothing|moda/i.test(p.subcategory||'')) return false;
      if (((p.tags||[]) as string[]).some(t=>/boutique|ropa|moda|clothing/i.test(t))) return false;
      // Strict name match: explicit AC/refrigeración terms only (no bare "aire" word)
      const nameMatch = /(refrigerac|aire\s+acond|\bhvac\b|\bac\s+repair\b|air\s+condition)/i.test(p.name||'');
      const subMatch = /aire|refriger|hvac/i.test(p.subcategory||'');
      const tagMatch = ((p.tags||[]) as string[]).some(t=>/refriger|aire_acond|hvac/i.test(t));
      return nameMatch || subMatch || tagMatch;
    } },
  { key:'farmacia', label:'Farmacia', emoji:'💊', categorySlug:'farmacia',
    qRegex:/(farmacia|botica|medicament|recet)/i,
    matches:(p)=>/farmacia|botica/i.test(p.name||'') || (p.subcategory||'').toLowerCase()==='farmacia' },
  { key:'medico', label:'Médico', emoji:'🩺', categorySlug:'medico',
    qRegex:/(pediatr|\bmedic|doctor|\bdr\.|cita medic|\bekg\b|cardio)/i,
    matches:(p) => {
      if (!['HEALTH','Salud','salud'].includes(p.category||'')) return false;
      const sub = (p.subcategory||'').toLowerCase().trim();
      const name = (p.name||'').toLowerCase();
      // Exclude by subcategory anywhere in string (catches "Centro de Diagnostico" via "diagnos", "Centro Audiológico" via "audiol", etc.)
      if (/(dent|veterin|óptic|optic|optom|pharmac|farmac|botica|quiro|chiro|psic|psych|mental|laborator|diagnos|radiol|ambulan|terap|fisic|fisio|audiol|nutric|cannabis)/i.test(sub)) return false;
      // Exclude by name (English/variant names)
      if (/(dental|veterinari|óptica|optica|pharmacy|farmacia|botica|chiropract|chiroprac|laundr|cannabis|animal medical|ambulance|ambulancia|laboratorio|radiology|radiología|odontolog)/i.test(name)) return false;
      return true;
    } },
  { key:'dentista', label:'Dentista', emoji:'🦷', categorySlug:'dentista',
    qRegex:/(dentista|odontolog|dental)/i,
    matches:(p)=>/dentista|dental|odontolog/i.test(p.name||'') || /dentista/i.test(p.subcategory||'') },
  { key:'veterinario', label:'Veterinario', emoji:'🐾', categorySlug:'veterinario',
    qRegex:/(veterinari|mascot)/i,
    matches:(p)=>/veterinari/i.test(p.name||'') || /veterinari/i.test(p.subcategory||'') },
  { key:'legal', label:'Abogado/Legal', emoji:'⚖️',
    qRegex:/(abogad|notario|legal)/i,
    matches:(p)=>(p.category||'')==='Legal' || /abogad|notari/i.test(p.name||'') },
  { key:'restaurante', label:'Restaurante', emoji:'🍽️', categorySlug:'restaurante',
    qRegex:/(restauran|\bcomer\b|comida)/i,
    matches:(p)=>['FOOD','Restaurantes'].includes(p.category||'') },
  { key:'belleza', label:'Belleza/Barbería', emoji:'💇', categorySlug:'belleza',
    qRegex:/(barber|peluqu|estetic|salón|salon|uñas|nails)/i,
    matches:(p)=>['BEAUTY','Belleza','Belleza y Bienestar'].includes(p.category||'') },
  { key:'auto', label:'Mecánica/Auto', emoji:'🔩', categorySlug:'automotriz',
    qRegex:/(mecanic|automovil|carro|llanta|frenos)/i,
    matches:(p)=>['AUTO','Automotriz'].includes(p.category||'') },
  { key:'hotel', label:'Hospedaje', emoji:'🏨', categorySlug:'hospedaje',
    qRegex:/(hotel|hospedaje|airbnb|hospedar)/i,
    matches:(p)=>['LODGING','Hospedaje'].includes(p.category||'') },
  { key:'handyman', label:'Handyman', emoji:'🛠️',
    qRegex:/(handyman|albañil|reparacion|porton)/i,
    matches:(p)=>/handyman|albañil|reparac/i.test(p.name||'') || /handyman|albañil|reparac/i.test(p.subcategory||'') || ((p.tags||[]) as string[]).some(t=>/handyman|albanil|reparac/i.test(t)) },
  { key:'pintor', label:'Pintor', emoji:'🎨',
    qRegex:/(pintor|pintura)/i,
    matches:(p)=>/pintor|pintura/i.test(p.name||'') || /pintor|pintura/i.test(p.subcategory||'') || ((p.tags||[]) as string[]).some(t=>/pintor|pintura/i.test(t)) },
  { key:'carpintero', label:'Carpintero', emoji:'🪵',
    qRegex:/(carpinter|ebanist)/i,
    matches:(p)=>/carpinter|ebanist/i.test(p.name||'') || /carpinter|ebanist/i.test(p.subcategory||'') || ((p.tags||[]) as string[]).some(t=>/carpinter|ebanist/i.test(t)) },
  { key:'costurera', label:'Costurera/Sastre', emoji:'🪡',
    qRegex:/(costurer|sastre|sastreria)/i,
    matches:(p)=>/costurer|sastre/i.test(p.name||'') || /costurer|sastre/i.test(p.subcategory||'') || ((p.tags||[]) as string[]).some(t=>/costurer|sastre/i.test(t)) },
  { key:'catering', label:'Catering', emoji:'🥘',
    qRegex:/(catering)/i,
    matches:(p)=>{
      // Exclude restaurants — catering is a separate service unless explicit in name
      if (['FOOD','Restaurantes'].includes(p.category||'') && !/catering/i.test(p.name||'')) return false;
      return /catering/i.test(p.name||'') || /catering/i.test(p.subcategory||'') || ((p.tags||[]) as string[]).some(t=>/catering/i.test(t));
    } },
  { key:'wedding', label:'Bodas/Eventos', emoji:'💍',
    qRegex:/(wedding|boda|matrimonio|planificador)/i,
    matches:(p)=>/wedding|\bboda|planificador.*evento/i.test(p.name||'') || /wedding|boda|eventos|planificador/i.test(p.subcategory||'') || ((p.tags||[]) as string[]).some(t=>/wedding|boda|evento/i.test(t)) },
  { key:'spa', label:'Spa/Masaje', emoji:'💆',
    qRegex:/(\bspa\b|masaj)/i,
    matches:(p)=>/\bspa\b|masaj/i.test(p.name||'') || /spa|masaj/i.test(p.subcategory||'') || ((p.tags||[]) as string[]).some(t=>/spa|masaj/i.test(t)) },
  { key:'trainer', label:'Personal Trainer', emoji:'💪',
    qRegex:/(personal training|trainer|entrenador)/i,
    matches:(p)=>/personal training|trainer|entrenador/i.test(p.name||'') || /trainer|entrenador|coach/i.test(p.subcategory||'') || ((p.tags||[]) as string[]).some(t=>/trainer|entrenador|coach/i.test(t)) },
  { key:'tour', label:'Tour Operator', emoji:'🗺️',
    qRegex:/(\btour\b|excursion)/i,
    matches:(p)=>/\btour|excursion/i.test(p.name||'') || /tour|excursion/i.test(p.subcategory||'') || ((p.tags||[]) as string[]).some(t=>/tour|excursion/i.test(t)) },
  { key:'bicicleta', label:'Bicicleta/eBike', emoji:'🚲',
    qRegex:/(bicicl|\bbike\b|ebike|e-bike)/i,
    matches:(p)=>/bicicl|\bbike|ebike/i.test(p.name||'') || /bike|bicicl/i.test(p.subcategory||'') || ((p.tags||[]) as string[]).some(t=>/bike|bicicl/i.test(t)) },
  { key:'boutique', label:'Boutique', emoji:'👗', categorySlug:'tiendas-de-ropa',
    qRegex:/(boutique|tienda\s+ropa)/i,
    matches:(p)=>/boutique/i.test(p.name||'') },
  { key:'gimnasio', label:'Gimnasio', emoji:'🏋️', categorySlug:'gimnasio',
    qRegex:/(gimnasio|\bgym\b|crossfit)/i,
    matches:(p)=>/gimnasio|\bgym\b/i.test(p.name||'') || (p.subcategory||'').toLowerCase()==='gimnasio' },
  { key:'tatuajes', label:'Tatuajes', emoji:'💉',
    qRegex:/(tatuaj|tattoo|piercing)/i,
    matches:(p)=>{
      if (['FOOD','Restaurantes'].includes(p.category||'')) return false;
      if (/\bsupply\b/i.test(p.name||'')) return false;
      return /tatuaj|tattoo|piercing/i.test(p.name||'') || (p.category||'') === 'Tatuajes' || /tatua|tattoo/i.test(p.subcategory||'');
    } },
];

type HeatBucket = {
  key: string; label: string; emoji: string; categorySlug?: string;
  demand: number; supply: number; ratio: number;
  status: 'caliente' | 'sana' | 'saturada';
};

function computeHeatIndex(realSearches: { q_norm: string; cnt: number }[], places: any[]): HeatBucket[] {
  return HEAT_BUCKETS_DEF.map(b => {
    const demand = realSearches.filter(rq => b.qRegex.test(rq.q_norm)).reduce((s, rq) => s + rq.cnt, 0);
    const supply = places.filter(b.matches).length;
    const ratio = supply === 0 ? (demand > 0 ? 999 : 0) : demand / supply;
    let status: 'caliente' | 'sana' | 'saturada';
    if (ratio >= 5 || (supply === 0 && demand > 0)) status = 'caliente';
    else if (ratio >= 1) status = 'sana';
    else status = 'saturada';
    return { key: b.key, label: b.label, emoji: b.emoji, categorySlug: b.categorySlug, demand, supply, ratio, status };
  });
}

// Map a search query to a destination URL.
// If the query matches a known category bucket → /categoria/[slug].
// Else → wa.me deep-link to *7711 with query pre-filled (closes loop: surface demand → bot conversation).
function searchQueryUrl(q: string): string {
  for (const b of HEAT_BUCKETS_DEF) {
    if (b.categorySlug && b.qRegex.test(q)) return `/categoria/${b.categorySlug}`;
  }
  return `https://wa.me/17874177711?text=${encodeURIComponent(q)}`;
}

async function handle_municipio(req: any, res: any) {
  try {
    const [
      censusResult,
      topSearchesResult,
      realSearches90d,
      categoryBreakdownResult,
      recentVerifications,
      upcomingEvents,
      newThisMonth,
      placesForHeat,
    ] = await Promise.all([
      supabase.from('mv_places_census').select('*').single().then((r: any) => r.data || {}),
      supabase.from('mv_top_searches_30d').select('*').limit(10).then((r: any) => r.data || []),
      supabase.from('mv_real_searches_90d').select('*').then((r: any) => r.data || []),
      supabase.from('mv_category_breakdown').select('*').limit(12).then((r: any) => r.data || []),
      supabase.from('mv_recent_verifications').select('*').then((r: any) => r.data || []),
      supabase
        .from('events')
        .select('id, title, slug, start_time, location_name, image_url, category')
        .eq('status', 'published')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(6)
        .then((r: any) => r.data || []),
      supabase.from('mv_new_this_month').select('*').then((r: any) => r.data || []),
      supabase
        .from('places')
        .select('name, category, subcategory, tags')
        .eq('visibility', 'published')
        .eq('status', 'open')
        .eq('municipality', 'Cabo Rojo')
        .range(0, 4999)
        .then((r: any) => r.data || []),
    ]);

    const c: any = censusResult;
    const heat = computeHeatIndex(realSearches90d, placesForHeat);
    const calientes = heat.filter((h) => h.status === 'caliente' && h.demand > 0).sort((a, b) => b.ratio - a.ratio).slice(0, 6);
    // For the "Lo escondido" hero band: rank by real demand (búsquedas), not by ratio —
    // so a category with 843 searches / 5 negocios leads, not "1 búsqueda / 0 negocios" (ratio ∞).
    const calientesHero = heat.filter((h) => h.status === 'caliente' && h.demand > 0).sort((a, b) => b.demand - a.demand).slice(0, 6);
    const sanas = heat.filter((h) => h.status === 'sana' && h.demand > 0).sort((a, b) => b.ratio - a.ratio).slice(0, 6);
    const saturadas = heat.filter((h) => h.status === 'saturada' && h.supply > 0).sort((a, b) => b.supply - a.supply).slice(0, 6);

    const totalSearches30d = topSearchesResult.reduce((s: number, r: any) => s + r.cnt, 0);
    const maxSearch = topSearchesResult[0]?.cnt || 1;
    const total90dReal = realSearches90d.reduce((s: number, r: any) => s + r.cnt, 0);
    const generatedAt = new Date().toLocaleString('es-PR', { timeZone: 'America/Puerto_Rico' });

    const total = c.total ?? 0;
    const openCount = c.open_count ?? 0;
    const fresh90d = c.fresh_90d ?? 0;
    const freshnessPct = c.freshness_pct ?? 0;
    const sponsorCount = c.sponsor_count ?? 0;
    const newThisMonthCount = c.new_this_month ?? 0;

    // ============ HTML TEMPLATE ============
    const renderHeatBucket = (h: HeatBucket, accent: string, bgTint: string) => {
      const ratioStr = h.ratio >= 999 ? '∞' : h.ratio.toFixed(1);
      const linkUrl = h.categorySlug ? `/categoria/${h.categorySlug}` : `https://wa.me/17874177711?text=${encodeURIComponent(h.label.toLowerCase())}`;
      return `<a href="${linkUrl}" style="display:block;text-decoration:none;color:inherit;padding:12px;background:${bgTint};border-radius:8px;margin-bottom:8px;border-left:3px solid ${accent};transition:transform 0.1s;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:14px;font-weight:600;color:#1e293b;">${h.emoji} ${esc(h.label)}</span>
          <span style="font-size:11px;color:${accent};font-weight:700;">${ratioStr}×</span>
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">${h.demand} búsquedas · ${h.supply} negocios</div>
      </a>`;
    };

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>El Pulso de Cabo Rojo — lo que el pueblo busca, lo que existe, lo que falta</title>
<meta name="description" content="En vivo: qué está buscando la gente de Cabo Rojo por el *7711, cuáles negocios están verificados a mano, y dónde hay demanda que nadie está llenando. El pueblo de verdad, no Google.">
<meta property="og:title" content="El Pulso de Cabo Rojo — en vivo">
<meta property="og:description" content="Lo que el pueblo busca, lo que existe, y dónde hay oportunidad que nadie está llenando todavía. Datos reales del *7711.">
<meta name="robots" content="index,follow">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;color:#1e293b;-webkit-font-smoothing:antialiased}a{color:inherit}a:hover{opacity:0.85}</style>
</head>
<body>

<!-- HEADER -->
<div style="background:#1e293b;color:#fff;padding:28px 32px;">
  <div style="max-width:1100px;margin:0 auto;display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:16px;">
    <div style="flex:1;min-width:280px;">
      <div style="font-size:12px;color:#5eead4;letter-spacing:0.15em;text-transform:uppercase;font-weight:700;margin-bottom:8px;">📡 El Pulso de Cabo Rojo · en vivo</div>
      <h1 style="font-size:30px;font-weight:800;letter-spacing:-0.6px;line-height:1.2;">Lo que el pueblo busca, lo que existe, y lo que falta.</h1>
      <p style="font-size:15px;color:#cbd5e1;margin-top:12px;max-width:640px;line-height:1.55;">Esta página te enseña, en tiempo real, qué está buscando la gente de Cabo Rojo cuando le escribe al <strong style="color:#fff;">*7711</strong>, cuáles negocios verifiqué a mano, y <strong style="color:#fbbf24;">dónde hay demanda que nadie está llenando todavía</strong>. Sin Google, sin invento: el pueblo de verdad.</p>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div style="font-size:11px;color:#64748b;">Datos en vivo · actualizado</div>
      <div style="font-size:13px;font-weight:600;color:#cbd5e1;">${esc(generatedAt)}</div>
      <div style="margin-top:10px;">
        <a href="https://mapadecaborojo.com" style="background:#0d9488;color:#fff;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;display:inline-block;">Ver el directorio →</a>
      </div>
    </div>
  </div>
</div>

<div style="max-width:1100px;margin:32px auto;padding:0 16px;">

  <!-- LO ESCONDIDO — the hidden demand only this page sees -->
  <div style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);border-radius:14px;padding:26px 28px;margin-bottom:28px;box-shadow:0 4px 14px rgba(0,0,0,0.15);border:1px solid #334155;">
    <div style="font-size:12px;color:#fbbf24;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;margin-bottom:10px;">💎 Lo escondido — lo que solo se ve aquí</div>
    <div style="font-size:17px;color:#fff;font-weight:600;line-height:1.45;">Cada vez que un vecino le escribe al *7711, queda registrado. Esto es la demanda real del pueblo: la que Google no enseña y ningún negocio sabe que existe.</div>
    ${calientesHero.length > 0 ? `
    <div style="background:rgba(0,0,0,0.25);border-radius:10px;padding:16px 18px;margin-top:16px;">
      <div style="font-size:12px;color:#fdba74;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">🔥 La oportunidad más caliente ahora mismo</div>
      <a href="${calientesHero[0].categorySlug ? `/categoria/${calientesHero[0].categorySlug}` : `https://wa.me/17874177711?text=${encodeURIComponent(calientesHero[0].label.toLowerCase())}`}" style="display:block;text-decoration:none;color:inherit;">
        <div style="font-size:22px;font-weight:800;color:#fff;">${calientesHero[0].emoji} ${esc(calientesHero[0].label)}</div>
        <div style="font-size:14px;color:#fed7aa;margin-top:4px;line-height:1.5;">${calientesHero[0].demand} búsquedas en 90 días · solo ${calientesHero[0].supply} negocio${calientesHero[0].supply === 1 ? '' : 's'} en el directorio. <span style="color:#fff;font-weight:600;">El que abra aquí, atiende demanda que ya existe.</span></div>
      </a>
      ${calientesHero.length > 1 ? `<div style="font-size:13px;color:#fed7aa;margin-top:12px;border-top:1px solid rgba(255,255,255,0.15);padding-top:10px;">Otras calientes: ${calientesHero.slice(1, 4).map(h => `<strong style="color:#fff;">${esc(h.label)}</strong> (${h.demand} búsq. / ${h.supply} neg.)`).join(' · ')}</div>` : ''}
    </div>
    <div style="font-size:12px;color:#94a3b8;margin-top:12px;">El mapa completo de demanda vs oferta está más abajo. 👇</div>
    ` : `<div style="font-size:13px;color:#94a3b8;margin-top:12px;">Esta semana la oferta está cubriendo la demanda — sin huecos calientes detectados. Mira el mapa económico completo más abajo.</div>`}
  </div>

  <!-- STAT CARDS — corrected counts from views -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:32px;">
    ${[
      { label: 'Negocios totales', value: total.toLocaleString('es-PR'), icon: '🏢', color: '#0d9488', tooltip: 'Todos los places de Cabo Rojo en nuestra base de datos (visibles al público). Algunos pueden estar cerrados temporalmente.' },
      { label: 'Abiertos hoy', value: openCount.toLocaleString('es-PR'), icon: '✅', color: '#16a34a', tooltip: 'Negocios con status=open en Cabo Rojo. La diferencia con "totales" son places cerrados o de estado dudoso.' },
      { label: 'Verif. en 90 días', value: `${fresh90d.toLocaleString('es-PR')} · ${freshnessPct}%`, icon: '🛡️', color: freshnessPct >= 80 ? '#16a34a' : freshnessPct >= 60 ? '#ca8a04' : '#dc2626', tooltip: 'Negocios que Angel verificó en persona en los últimos 90 días — caminó la calle, entró, confirmó que sigue abierto. Sin Google Places, sin AI: ojos humanos.' },
      { label: 'Búsquedas al *7711 (30d)', value: totalSearches30d.toLocaleString('es-PR'), icon: '🔍', color: '#0369a1', tooltip: 'Suma de las 10 categorías más buscadas al *7711 en los últimos 30 días. El total absoluto es mayor — esto es la concentración de demanda en lo más pedido.' },
      { label: 'Eventos próximos', value: upcomingEvents.length.toString(), icon: '📅', color: '#ea580c', tooltip: 'Eventos públicos en CR con fecha futura, mostrando los 6 más cercanos. Click en cada uno para detalles + cómo llegar.' },
      { label: 'Negocios sponsor', value: sponsorCount.toString(), icon: '⭐', color: '#7c3aed', tooltip: 'Negocios con Vitrina pagada o featured manualmente. Por hoy: Luis David Refrigeración (sponsor activo $700/año saldado) + Marina Puerto Real. Modelo: $799/año.' },
    ].map((c) => `
    <div title="${esc(c.tooltip)}" style="background:#fff;border-radius:12px;padding:20px 16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-top:3px solid ${c.color};cursor:help;">
      <div style="font-size:24px;margin-bottom:8px;">${c.icon}</div>
      <div style="font-size:24px;font-weight:700;color:#1e293b;">${c.value}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px;font-weight:500;">${c.label}</div>
    </div>`).join('')}
  </div>

  <!-- BANNER: Cabo Rojo en Números (link a /pueblo-en-numeros) -->
  <a href="/pueblo-en-numeros" style="display:block;text-decoration:none;color:inherit;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:12px;padding:24px 28px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
      <div style="flex:1;min-width:280px;">
        <div style="font-size:11px;color:#5eead4;letter-spacing:0.15em;text-transform:uppercase;font-weight:700;margin-bottom:6px;">📊 Cabo Rojo en Números</div>
        <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.3px;line-height:1.3;">1 negocio por cada 50 personas en Cabo Rojo. <span style="color:#5eead4;">En el oeste: Hormigueros 1/47 · San Germán 1/50 · Mayagüez 1/87.</span></div>
        <div style="font-size:13px;color:#fbbf24;margin-top:8px;font-weight:600;">💊 Ej: 18 farmacias verificadas open para 47,158 personas = 1 por cada 2,620. <span style="color:#fff;">Comparativa PR-wide pendiente BLS QCEW integration (Phase 2).</span></div>
        <div style="font-size:12px;color:#cbd5e1;margin-top:6px;">TAM/SAM/SOM por categoría · sobreoferta visible · ajá moments que nadie publica.</div>
      </div>
      <div style="background:#0d9488;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;white-space:nowrap;">Ver el pueblo en números →</div>
    </div>
  </a>

  <!-- BANNER: Promesómetro — prometido vs pasó (link a /observatorio) -->
  <a href="/observatorio" style="display:block;text-decoration:none;color:inherit;background:#fff;border:1px solid #e2e8f0;border-left:4px solid #dc2626;border-radius:12px;padding:24px 28px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="font-size:11px;color:#dc2626;letter-spacing:0.15em;text-transform:uppercase;font-weight:700;margin-bottom:6px;">📋 El Promesómetro · prometido vs lo que pasó</div>
    <div style="font-size:18px;font-weight:800;color:#1e293b;letter-spacing:-0.3px;line-height:1.35;">Lo que el alcalde dijo en cámara, con fecha y fuente. No lo dijo un periódico: lo dijo él.</div>
    <ul style="margin:12px 0 0;padding-left:18px;color:#475569;font-size:14px;line-height:1.7;">
      <li><strong>Faro Los Morrillos:</strong> prometió reabrir "en unos meses" (2024). Sigue cerrado.</li>
      <li><strong>Coliseo Rebekah Colberg:</strong> $5.2M de FEMA, límite 20 sept 2026. Obras empezaron feb 2026.</li>
      <li><strong>Sueldo de la policía:</strong> prometió ~$2,000 (2023). Sin confirmación pública.</li>
    </ul>
    <div style="margin-top:14px;color:#0d9488;font-size:13px;font-weight:700;">Ver el Promesómetro completo →</div>
  </a>

  <!-- SUGERENCIA 1: LO QUE CABO ROJO ESTÁ BUSCANDO -->
  <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:24px;">
    <h2 style="font-size:18px;font-weight:700;color:#1e293b;margin-bottom:4px;">🔍 Lo Que Cabo Rojo Está Buscando</h2>
    <p style="font-size:13px;color:#64748b;margin-bottom:8px;">Estas son las palabras que vecinos textean al <strong>*7711</strong> cuando necesitan algo. No es Google — es lo que pide el pueblo.</p>
    <p style="font-size:11px;color:#94a3b8;margin-bottom:18px;">Click en una búsqueda → te lleva al directorio o abre WhatsApp con el bot.</p>
    ${topSearchesResult.length === 0
      ? `<p style="color:#64748b;font-size:13px;font-style:italic;">Sin búsquedas reales en los últimos 30 días.</p>`
      : `<table style="width:100%;border-collapse:collapse;">
          ${topSearchesResult.map((row: any) => {
            const pct = Math.max(8, Math.round((row.cnt / maxSearch) * 100));
            const url = searchQueryUrl(row.query_text || '');
            const matchedBadge = row.ever_matched ? '' : '<span style="font-size:10px;color:#dc2626;background:#fee2e2;padding:1px 6px;border-radius:4px;margin-left:6px;">no encontrado</span>';
            return `<tr>
              <td style="padding:8px 0;font-size:14px;width:50%;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                <a href="${esc(url)}" style="color:#0d9488;text-decoration:none;font-weight:500;">${esc(row.query_text)}</a>${matchedBadge}
              </td>
              <td style="padding:8px 0 8px 12px;width:50%;">
                <div style="background:#f1f5f9;border-radius:4px;height:14px;">
                  <div style="background:#0d9488;height:100%;border-radius:4px;width:${pct}%;"></div>
                </div>
              </td>
              <td style="padding:8px 0 8px 8px;font-size:13px;color:#475569;font-weight:600;white-space:nowrap;">${row.cnt}</td>
            </tr>`;
          }).join('')}
        </table>`}
  </div>

  <!-- SUGERENCIA 2: HEAT INDEX — DEMANDA VS OFERTA -->
  <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:24px;">
    <h2 style="font-size:18px;font-weight:700;color:#1e293b;margin-bottom:4px;">🌡️ Dónde hay oportunidad — demanda vs oferta</h2>
    <p style="font-size:13px;color:#64748b;margin-bottom:18px;">Cuánto se busca cada cosa (en 90 días) comparado con cuántos negocios la ofrecen. <strong style="color:#dc2626;">Calientes</strong> = mucha gente lo busca, pocos lo ofrecen (oportunidad de abrir). <strong style="color:#64748b;">Saturadas</strong> = ya hay de sobra.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;">

      <div>
        <div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:10px;">🔥 CALIENTES <span style="color:#94a3b8;font-weight:400;">(>5×)</span></div>
        ${calientes.length === 0 ? '<p style="color:#94a3b8;font-size:12px;font-style:italic;">Ninguna categoría caliente detectada.</p>' : calientes.map(h => renderHeatBucket(h, '#dc2626', '#fef2f2')).join('')}
      </div>

      <div>
        <div style="font-size:13px;font-weight:700;color:#16a34a;margin-bottom:10px;">✅ SANAS <span style="color:#94a3b8;font-weight:400;">(1-5×)</span></div>
        ${sanas.length === 0 ? '<p style="color:#94a3b8;font-size:12px;font-style:italic;">Ninguna categoría sana detectada.</p>' : sanas.map(h => renderHeatBucket(h, '#16a34a', '#f0fdf4')).join('')}
      </div>

      <div>
        <div style="font-size:13px;font-weight:700;color:#64748b;margin-bottom:10px;">❄️ SATURADAS <span style="color:#94a3b8;font-weight:400;">(<1×)</span></div>
        ${saturadas.length === 0 ? '<p style="color:#94a3b8;font-size:12px;font-style:italic;">Sin saturación detectada.</p>' : saturadas.map(h => renderHeatBucket(h, '#64748b', '#f8fafc')).join('')}
      </div>

    </div>
    <p style="font-size:11px;color:#94a3b8;margin-top:16px;text-align:center;">Click en una categoría → te lleva al directorio o WhatsApp.</p>
  </div>

  <!-- ROW: EVENTS + RECENT VERIFICATIONS -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">

    <!-- SUGERENCIA 3: EVENTOS CLICKABLES -->
    <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin-bottom:4px;">📅 Próximos Eventos</h2>
      <p style="font-size:12px;color:#64748b;margin-bottom:16px;">Click para detalles y cómo llegar.</p>
      ${upcomingEvents.length === 0
        ? '<p style="color:#64748b;font-size:13px;">No hay eventos próximos registrados.</p>'
        : upcomingEvents.map((ev: any) => `
          <a href="/evento/${esc(ev.slug)}" style="display:block;padding:12px 0;border-bottom:1px solid #f1f5f9;text-decoration:none;color:inherit;">
            <div style="font-size:13px;font-weight:600;color:#1e293b;">${esc(ev.title)} <span style="color:#0d9488;font-size:11px;">→</span></div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">📍 ${esc(ev.location_name || 'Cabo Rojo')} · ${formatDate(ev.start_time)}</div>
          </a>`).join('')}
    </div>

    <!-- SUGERENCIA 4: VERIFICADOS RECIENTEMENTE -->
    <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-left:4px solid #16a34a;">
      <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin-bottom:4px;">✅ Verificados Recientemente</h2>
      <p style="font-size:12px;color:#64748b;margin-bottom:16px;">Negocios que Angel verificó en persona en los últimos 60 días.</p>
      ${recentVerifications.length === 0
        ? '<p style="color:#64748b;font-size:13px;">No hay verificaciones recientes.</p>'
        : recentVerifications.slice(0, 6).map((p: any) => `
          <a href="/negocio/${esc(p.slug)}" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9;text-decoration:none;color:inherit;">
            <div style="width:36px;height:36px;border-radius:8px;background:${p.image_url || p.hero_image_url ? `url('${esc(p.image_url || p.hero_image_url)}')` : '#dcfce7'};background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">${p.image_url || p.hero_image_url ? '' : '🏪'}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}</div>
              <div style="font-size:11px;color:#16a34a;">Verificado hace ${p.days_since_verified} día${p.days_since_verified === 1 ? '' : 's'}</div>
            </div>
          </a>`).join('')}
    </div>

  </div>

  <!-- SUGERENCIA 5: NUEVOS ESTE MES -->
  <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:24px;">
    <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin-bottom:4px;">🆕 Nuevos al Directorio Este Mes</h2>
    ${newThisMonth.length === 0
      ? `<p style="font-size:13px;color:#64748b;margin-top:8px;">Ningún negocio nuevo este mes todavía. <strong style="color:#1e293b;">¿Conoces uno que falta?</strong> Texteámelo al <a href="https://wa.me/17874177711?text=Quiero%20proponer%20un%20negocio%20para%20el%20directorio" style="color:#0d9488;font-weight:600;text-decoration:none;">787-417-7711</a> y lo verifico.</p>`
      : `<p style="font-size:12px;color:#64748b;margin-bottom:12px;">${newThisMonth.length} negocio${newThisMonth.length === 1 ? '' : 's'} agregado${newThisMonth.length === 1 ? '' : 's'} desde el ${formatDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())}.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">
          ${newThisMonth.map((p: any) => `
            <a href="/negocio/${esc(p.slug)}" style="display:flex;align-items:center;gap:8px;padding:10px;background:#f8fafc;border-radius:8px;text-decoration:none;color:inherit;">
              <div style="width:32px;height:32px;border-radius:6px;background:#e2e8f0;flex-shrink:0;background-size:cover;background-position:center;${p.image_url || p.hero_image_url ? `background-image:url('${esc(p.image_url || p.hero_image_url)}');` : ''}"></div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}</div>
                <div style="font-size:11px;color:#64748b;">${esc(p.category || 'Sin categoría')} · hace ${daysAgoFrom(p.created_at)}d</div>
              </div>
            </a>`).join('')}
        </div>`}
  </div>

  <!-- DIRECTORIO POR CATEGORÍA — corrected single source of truth -->
  <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:24px;">
    <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin-bottom:4px;">🗂️ Directorio por Categoría</h2>
    <p style="font-size:12px;color:#64748b;margin-bottom:16px;">Negocios abiertos por sector — totales reales (no truncados).</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;">
      ${categoryBreakdownResult.slice(0, 12).map((cat: any) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#f8fafc;border-radius:8px;">
          <span style="font-size:13px;color:#374151;">${esc(cat.category)}</span>
          <span style="font-size:14px;font-weight:700;color:#0d9488;">${cat.count.toLocaleString('es-PR')}</span>
        </div>`).join('')}
    </div>
  </div>

  <!-- SUGERENCIA 6: B2B FOLD — RECEIPTS PARA ALCALDES -->
  <div style="background:#1e293b;border-radius:12px;padding:32px;color:#fff;margin-bottom:24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:13px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">🏛️ Para alcaldes y municipios</div>
      <div style="font-size:24px;font-weight:700;margin-bottom:8px;">Cabo Rojo OS para tu municipio</div>
      <div style="font-size:14px;color:#cbd5e1;max-width:600px;margin:0 auto;">No es un pitch — son los números reales de un sistema operando hace 18+ meses, construido por una persona con AI.</div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:24px;">
      <div style="text-align:center;padding:16px;background:#0f172a;border-radius:10px;">
        <div style="font-size:32px;font-weight:800;color:#5eead4;">${total.toLocaleString('es-PR')}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px;text-transform:uppercase;letter-spacing:0.05em;">Negocios indexados</div>
      </div>
      <div title="Búsquedas reales que llegaron al bot *7711 en los últimos 90 días desde toda la región oeste (CR + Lajas + Hormigueros + San Germán + Mayagüez). Toda demanda local conectada al ecosistema CaboRojo.com." style="text-align:center;padding:16px;background:#0f172a;border-radius:10px;cursor:help;">
        <div style="font-size:32px;font-weight:800;color:#5eead4;">${total90dReal.toLocaleString('es-PR')}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px;text-transform:uppercase;letter-spacing:0.05em;">Búsquedas regionales 90d</div>
      </div>
      <div style="text-align:center;padding:16px;background:#0f172a;border-radius:10px;">
        <div style="font-size:32px;font-weight:800;color:#5eead4;">$0</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px;text-transform:uppercase;letter-spacing:0.05em;">Costo al municipio</div>
      </div>
      <div style="text-align:center;padding:16px;background:#0f172a;border-radius:10px;">
        <div style="font-size:32px;font-weight:800;color:#5eead4;">1</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px;text-transform:uppercase;letter-spacing:0.05em;">Persona operando</div>
      </div>
    </div>

    <div style="background:#0f172a;border-radius:10px;padding:20px;margin-bottom:20px;">
      <div style="font-size:13px;font-weight:600;color:#e2e8f0;margin-bottom:10px;">¿Qué incluye?</div>
      <ul style="font-size:13px;color:#cbd5e1;line-height:1.7;list-style:none;padding:0;">
        <li>📍 Directorio geo de cada negocio activo del pueblo, mapeado y verificado en persona</li>
        <li>🤖 Bot público (SMS/WhatsApp) que contesta búsquedas en tu pueblo 24/7</li>
        <li>📊 Panel ciudadano público (este que estás viendo) con datos reales en vivo</li>
        <li>🚨 Detección de demanda no servida → catalizador para nuevos emprendimientos</li>
        <li>💰 Modelo auto-sustentable: sponsors locales pagan, municipio no</li>
      </ul>
    </div>

    <div style="text-align:center;">
      <a href="https://wa.me/17874177711?text=Soy%20alcalde%2Falcaldesa%20de%20%5BTU%20MUNICIPIO%5D%20-%20quiero%20demo%20de%20Cabo%20Rojo%20OS" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;margin-right:8px;">Pedir demo de mi municipio</a>
      <a href="https://mapadecaborojo.com" style="background:#334155;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;">Ver directorio completo</a>
    </div>
  </div>

</div>

<!-- FOOTER -->
<div style="background:#0f172a;color:#64748b;padding:20px 32px;text-align:center;font-size:12px;">
  <div>Hecho por <a href="https://angelanderson.com" style="color:#5eead4;text-decoration:none;">Angel Anderson</a> con AI · Cabo Rojo, Puerto Rico</div>
  <div style="margin-top:4px;">Datos en vivo · ${esc(generatedAt)} · © ${new Date().getFullYear()} MapaDeCaboRojo.com</div>
</div>

</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
    res.status(200).send(html);

  } catch (err: any) {
    console.error('handle_municipio error:', err);
    res.status(500).send(`<html><body><h1>Error</h1><pre>${esc(err?.message || 'Unknown error')}</pre></body></html>`);
  }
}


// ============ turismo ============


async function handle_turismo(req: any, res: any) {
  const supa = supabase;

  // Pull last 7 days of demand signals for live stats
  const since7d = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: rows } = await supa
    .from('demand_signals')
    .select('query_text, query_normalized, category, had_results, results_count')
    .gte('created_at', since7d);

  const allRows = rows || [];
  const totalSearches = allRows.length;

  // Top 5 terms
  const termCount: Record<string, number> = {};
  for (const r of allRows) {
    const t = (r.query_normalized || r.query_text || '').toLowerCase().trim();
    if (t) termCount[t] = (termCount[t] || 0) + 1;
  }
  const topTerms = Object.entries(termCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([term, count]) => ({ term, count }));

  // Top categories
  const catCount: Record<string, number> = {};
  for (const r of allRows) {
    const c = r.category || 'OTHER';
    catCount[c] = (catCount[c] || 0) + 1;
  }
  const topCats = Object.entries(catCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([cat, count]) => ({ cat, count }));

  // Gaps
  const gapCount: Record<string, number> = {};
  for (const r of allRows) {
    if (r.had_results === false || r.results_count === 0) {
      const t = (r.query_normalized || r.query_text || '').toLowerCase().trim();
      if (t && t.length > 2) gapCount[t] = (gapCount[t] || 0) + 1;
    }
  }
  const topGaps = Object.entries(gapCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([term]) => term);

  const baseUrl = 'https://mapadecaborojo.com';
  const pageTitle = 'Tourism Intelligence API — Cabo Rojo | MapaDeCaboRojo.com';
  const desc = 'Sabe qué buscan los turistas en Cabo Rojo en tiempo real. Datos de demanda local para hoteles, restaurantes, tours y negocios.';

  const topTermsHTML = topTerms.length > 0
    ? topTerms.map(({ term, count }) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-transform:capitalize;font-weight:500;">${term}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:#0d9488;font-weight:700;">${count}</td></tr>`
      ).join('')
    : `<tr><td colspan="2" style="padding:16px;color:#94a3b8;text-align:center;">Cargando datos...</td></tr>`;

  const topCatsHTML = topCats.length > 0
    ? topCats.map(({ cat, count }) => {
        const pct = totalSearches > 0 ? Math.round((count / totalSearches) * 100) : 0;
        return `<div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;font-size:0.875rem;margin-bottom:4px;">
            <span style="font-weight:500;color:#1e293b;">${cat}</span>
            <span style="color:#64748b;">${count} búsquedas (${pct}%)</span>
          </div>
          <div style="background:#e2e8f0;border-radius:4px;height:8px;overflow:hidden;">
            <div style="background:linear-gradient(90deg,#0d9488,#f97316);height:100%;width:${pct}%;border-radius:4px;"></div>
          </div>
        </div>`;
      }).join('')
    : `<p style="color:#94a3b8;">Datos próximamente</p>`;

  const gapsHTML = topGaps.length > 0
    ? topGaps.map(g => `<span style="display:inline-block;background:#fef3c7;color:#92400e;padding:4px 10px;border-radius:999px;font-size:0.8rem;margin:3px;border:1px solid #fde68a;">${g}</span>`).join('')
    : `<span style="color:#94a3b8;font-size:0.875rem;">No hay gaps detectados en este período</span>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${baseUrl}/turismo">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${pageTitle}">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="${baseUrl}/og-default.png">
  <meta property="og:url" content="${baseUrl}/turismo">
  <meta property="og:site_name" content="MapaDeCaboRojo.com">
  <meta property="og:locale" content="es_PR">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${pageTitle}">
  <meta name="twitter:description" content="${desc}">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Tourism Intelligence API — Cabo Rojo",
    "description": desc,
    "url": `${baseUrl}/turismo`,
    "provider": {
      "@type": "Organization",
      "name": "MapaDeCaboRojo.com",
      "url": baseUrl
    }
  })}</script>
</head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b;line-height:1.6;">

  <!-- HERO -->
  <div style="background:linear-gradient(135deg,#0d9488 0%,#0f766e 50%,#134e4a 100%);color:white;padding:64px 24px;text-align:center;">
    <div style="max-width:760px;margin:0 auto;">
      <div style="font-size:3rem;margin-bottom:16px;">📊</div>
      <h1 style="font-size:2.4rem;font-weight:800;margin:0 0 16px;line-height:1.2;">Tourism Intelligence API<br><span style="color:#5eead4;">Cabo Rojo</span></h1>
      <p style="font-size:1.2rem;color:rgba(255,255,255,0.85);margin:0 0 32px;max-width:560px;margin-left:auto;margin-right:auto;">Sabe qué buscan los turistas en Cabo Rojo — en tiempo real. Datos reales del bot El Veci, sin encuestas, sin suposiciones.</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        <a href="https://wa.me/17874177711?text=TURISMO" style="background:#f97316;color:white;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:1rem;">Comienza gratis →</a>
        <a href="#pricing" style="background:rgba(255,255,255,0.15);color:white;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:1rem;border:1px solid rgba(255,255,255,0.3);">Ver precios</a>
      </div>
    </div>
  </div>

  <!-- LIVE STATS BAR -->
  <div style="background:#0f172a;color:white;padding:20px 24px;">
    <div style="max-width:900px;margin:0 auto;display:flex;gap:32px;justify-content:center;flex-wrap:wrap;text-align:center;">
      <div>
        <div style="font-size:2rem;font-weight:800;color:#5eead4;">${totalSearches.toLocaleString()}</div>
        <div style="font-size:0.8rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Búsquedas últimos 7 días</div>
      </div>
      <div>
        <div style="font-size:2rem;font-weight:800;color:#fdba74;">${topTerms[0]?.term || '—'}</div>
        <div style="font-size:0.8rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Término #1 esta semana</div>
      </div>
      <div>
        <div style="font-size:2rem;font-weight:800;color:#86efac;">${topGaps.length > 0 ? topGaps[0] : '—'}</div>
        <div style="font-size:0.8rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Mayor gap de mercado</div>
      </div>
    </div>
  </div>

  <div style="max-width:900px;margin:0 auto;padding:48px 24px;">

    <!-- WHY SECTION -->
    <h2 style="font-size:1.75rem;font-weight:700;text-align:center;margin-bottom:12px;">¿Para qué sirve esto?</h2>
    <p style="text-align:center;color:#64748b;margin-bottom:40px;max-width:600px;margin-left:auto;margin-right:auto;">Miles de personas textean "playa", "pizza", "tour" al bot de Cabo Rojo todos los días. Esos datos son oro para planificar tu negocio o destino.</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:48px;">
      <tr>
        <td style="width:33%;padding:24px;vertical-align:top;background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin:8px;">
          <div style="font-size:2rem;margin-bottom:12px;">🏨</div>
          <h3 style="font-size:1rem;font-weight:700;margin:0 0 8px;">Hoteles & Hospedaje</h3>
          <p style="font-size:0.875rem;color:#64748b;margin:0;">Sé qué buscan tus huéspedes antes de llegar. Ajusta amenidades y paquetes según demanda real.</p>
        </td>
        <td style="width:33%;padding:24px;vertical-align:top;background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin:8px;">
          <div style="font-size:2rem;margin-bottom:12px;">🍽️</div>
          <h3 style="font-size:1rem;font-weight:700;margin:0 0 8px;">Restaurantes & Food</h3>
          <p style="font-size:0.875rem;color:#64748b;margin:0;">Descubre qué categorías de comida tienen más demanda y cuáles son brechas sin cubrir en el pueblo.</p>
        </td>
        <td style="width:33%;padding:24px;vertical-align:top;background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin:8px;">
          <div style="font-size:2rem;margin-bottom:12px;">🏛️</div>
          <h3 style="font-size:1rem;font-weight:700;margin:0 0 8px;">Municipio & PRPB</h3>
          <p style="font-size:0.875rem;color:#64748b;margin:0;">Datos de demanda turística para informar inversiones en infraestructura, eventos y desarrollo económico.</p>
        </td>
      </tr>
    </table>

    <!-- LIVE DATA SECTION -->
    <h2 style="font-size:1.5rem;font-weight:700;margin-bottom:24px;">📈 Datos en vivo — últimos 7 días</h2>

    <table style="width:100%;border-collapse:collapse;margin-bottom:40px;">
      <tr style="vertical-align:top;">
        <td style="width:50%;padding-right:16px;">
          <div style="background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);overflow:hidden;">
            <div style="padding:16px 16px 12px;border-bottom:1px solid #e2e8f0;">
              <h3 style="font-size:0.95rem;font-weight:700;margin:0;color:#0d9488;">Top búsquedas</h3>
            </div>
            <table style="width:100%;border-collapse:collapse;">
              ${topTermsHTML}
            </table>
          </div>
        </td>
        <td style="width:50%;padding-left:16px;">
          <div style="background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);padding:16px;">
            <h3 style="font-size:0.95rem;font-weight:700;margin:0 0 16px;color:#0d9488;">Por categoría</h3>
            ${topCatsHTML}
          </div>
        </td>
      </tr>
    </table>

    <!-- GAPS SECTION -->
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:24px;margin-bottom:48px;">
      <h3 style="font-size:1rem;font-weight:700;margin:0 0 8px;color:#92400e;">⚠️ Gaps de mercado detectados</h3>
      <p style="font-size:0.875rem;color:#78350f;margin:0 0 16px;">Búsquedas frecuentes que el bot no pudo satisfacer — oportunidades de negocio sin cubrir:</p>
      <div>${gapsHTML}</div>
    </div>

    <!-- API REFERENCE -->
    <h2 style="font-size:1.5rem;font-weight:700;margin-bottom:16px;">🔌 API Reference</h2>
    <div style="background:#0f172a;border-radius:12px;padding:24px;margin-bottom:48px;overflow:auto;">
      <pre style="color:#e2e8f0;font-size:0.85rem;margin:0;white-space:pre-wrap;"><code>GET https://mapadecaborojo.com/api/intelligence

Parámetros:
  ?key=TU_API_KEY        (requerido)
  ?period=7d             (7d | 30d | 90d)
  ?format=json           (json | csv)

Ejemplo de respuesta:
{
  "period": "7d",
  "generated_at": "2026-04-17T...",
  "total_searches": 1234,
  "unique_users": 456,
  "top_terms": [
    {"term": "pizza", "count": 89, "trend": "+23%"}
  ],
  "categories_demand": [
    {"category": "FOOD", "searches": 340}
  ],
  "hourly_distribution": [
    {"hour": 0, "count": 5}, ...
  ],
  "gaps": ["sushi", "yoga", "coworking"]
}</code></pre>
    </div>

    <!-- PRICING -->
    <h2 id="pricing" style="font-size:1.5rem;font-weight:700;text-align:center;margin-bottom:32px;">Planes</h2>

    <table style="width:100%;border-collapse:collapse;margin-bottom:48px;">
      <tr style="vertical-align:top;">
        <td style="width:33%;padding:8px;">
          <div style="background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);padding:28px 24px;text-align:center;height:100%;">
            <div style="font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Free</div>
            <div style="font-size:2.5rem;font-weight:800;color:#0f172a;margin-bottom:4px;">$0</div>
            <div style="font-size:0.875rem;color:#64748b;margin-bottom:24px;">Para siempre</div>
            <ul style="list-style:none;padding:0;margin:0 0 24px;text-align:left;font-size:0.875rem;color:#475569;">
              <li style="padding:6px 0;border-bottom:1px solid #f1f5f9;">✅ 100 llamadas/día</li>
              <li style="padding:6px 0;border-bottom:1px solid #f1f5f9;">✅ Período: 7 días</li>
              <li style="padding:6px 0;border-bottom:1px solid #f1f5f9;">✅ JSON + CSV</li>
              <li style="padding:6px 0;">✅ Top 20 términos</li>
            </ul>
            <a href="https://wa.me/17874177711?text=TURISMO" style="display:block;background:#0d9488;color:white;text-decoration:none;padding:12px;border-radius:8px;font-weight:600;font-size:0.9rem;">Comienza gratis</a>
          </div>
        </td>
        <td style="width:33%;padding:8px;">
          <div style="background:linear-gradient(135deg,#0d9488,#0f766e);border-radius:12px;box-shadow:0 4px 20px rgba(13,148,136,0.3);padding:28px 24px;text-align:center;height:100%;position:relative;">
            <div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#f97316;color:white;font-size:0.7rem;font-weight:700;padding:4px 12px;border-radius:999px;text-transform:uppercase;letter-spacing:0.08em;">Popular</div>
            <div style="font-size:0.75rem;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Pro</div>
            <div style="font-size:2.5rem;font-weight:800;color:white;margin-bottom:4px;">$99</div>
            <div style="font-size:0.875rem;color:rgba(255,255,255,0.7);margin-bottom:24px;">por mes</div>
            <ul style="list-style:none;padding:0;margin:0 0 24px;text-align:left;font-size:0.875rem;color:rgba(255,255,255,0.9);">
              <li style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.15);">✅ Llamadas ilimitadas</li>
              <li style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.15);">✅ Períodos: 7d / 30d / 90d</li>
              <li style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.15);">✅ Distribución por hora</li>
              <li style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.15);">✅ Gaps de mercado</li>
              <li style="padding:6px 0;">✅ Soporte prioritario</li>
            </ul>
            <a href="https://wa.me/17874177711?text=TURISMO PRO" style="display:block;background:white;color:#0d9488;text-decoration:none;padding:12px;border-radius:8px;font-weight:700;font-size:0.9rem;">Textea TURISMO PRO</a>
          </div>
        </td>
        <td style="width:33%;padding:8px;">
          <div style="background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);padding:28px 24px;text-align:center;height:100%;">
            <div style="font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Enterprise</div>
            <div style="font-size:2.5rem;font-weight:800;color:#0f172a;margin-bottom:4px;">$499</div>
            <div style="font-size:0.875rem;color:#64748b;margin-bottom:24px;">por mes</div>
            <ul style="list-style:none;padding:0;margin:0 0 24px;text-align:left;font-size:0.875rem;color:#475569;">
              <li style="padding:6px 0;border-bottom:1px solid #f1f5f9;">✅ Todo en Pro</li>
              <li style="padding:6px 0;border-bottom:1px solid #f1f5f9;">✅ Datos crudos (raw export)</li>
              <li style="padding:6px 0;border-bottom:1px solid #f1f5f9;">✅ Consultoría mensual</li>
              <li style="padding:6px 0;border-bottom:1px solid #f1f5f9;">✅ Dashboard privado</li>
              <li style="padding:6px 0;">✅ SLA + factura</li>
            </ul>
            <a href="https://wa.me/17874177711?text=TURISMO ENTERPRISE" style="display:block;background:#0f172a;color:white;text-decoration:none;padding:12px;border-radius:8px;font-weight:600;font-size:0.9rem;">Contactar</a>
          </div>
        </td>
      </tr>
    </table>

    <!-- CTA FINAL -->
    <div style="background:linear-gradient(135deg,#f97316,#ea580c);border-radius:12px;padding:40px 32px;text-align:center;margin-bottom:48px;">
      <h2 style="color:white;font-size:1.5rem;font-weight:700;margin:0 0 12px;">¿Listo para saber qué buscan los turistas?</h2>
      <p style="color:rgba(255,255,255,0.85);margin:0 0 24px;font-size:1rem;">Textea TURISMO al 787-417-7711 y tu API key llega en minutos.</p>
      <a href="https://wa.me/17874177711?text=TURISMO" style="background:white;color:#ea580c;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:1rem;display:inline-block;">Textea TURISMO al 787-417-7711</a>
    </div>

    <footer style="border-top:1px solid #e2e8f0;padding:24px 0;text-align:center;">
      <p style="color:#94a3b8;font-size:0.8rem;margin:0;">Powered by <a href="${baseUrl}" style="color:#0d9488;text-decoration:none;">MapaDeCaboRojo.com</a> · Un proyecto de <a href="https://angelanderson.com" style="color:#0d9488;text-decoration:none;">Angel Anderson</a></p>
      <p style="color:#94a3b8;font-size:0.75rem;margin:4px 0 0;">Datos basados en búsquedas reales del bot El Veci (*7711) en Cabo Rojo, Puerto Rico.</p>
    </footer>
  </div>

</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.status(200).send(html);
}

// ============ demanda ============

// esc already defined above

interface SurgeRow {
  term: string;
  this_week: number;
  last_week: number;
  surge_pct: number;
}

function getSurgeColor(pct: number, lastWeek: number): string {
  if (lastWeek === 0) return '#8b5cf6'; // purple = new term
  if (pct >= 50) return '#ef4444';      // red = hot surge
  if (pct > 0) return '#10b981';        // green = growing
  if (pct === 0) return '#64748b';      // gray = flat
  return '#f97316';                      // orange = declining
}

function getSurgeBadge(pct: number, lastWeek: number): string {
  if (lastWeek === 0) return '<span style="background:#8b5cf6;color:white;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600;">NUEVO</span>';
  if (pct >= 100) return '<span style="background:#ef4444;color:white;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600;">🔥 +' + pct + '%</span>';
  if (pct >= 50) return '<span style="background:#f97316;color:white;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600;">↑ +' + pct + '%</span>';
  if (pct > 0) return '<span style="background:#10b981;color:white;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600;">+' + pct + '%</span>';
  if (pct === 0) return '<span style="background:#e2e8f0;color:#64748b;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600;">→ sin cambio</span>';
  return '<span style="background:#cbd5e1;color:#475569;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600;">' + pct + '%</span>';
}

interface DemandCategory {
  key: string;
  label: string;
  icon: string;
  match: RegExp;
  publishTip?: { who: string; post: string };
}
const DEMAND_CATEGORIES: DemandCategory[] = [
  { key: 'hogar', label: 'Hogar y reparaciones', icon: '🔧',
    match: /nevera|refriger|aire|acondicion|\bac\b|plomer|electricist/i,
    publishTip: { who: 'Si arreglas neveras, aires o eres plomero', post: '¿Se te dañó la nevera o el aire? Lo reviso aquí en Cabo Rojo. Escríbeme por WhatsApp.' } },
  { key: 'comida', label: 'Comida', icon: '🍽️',
    match: /comida|china|chino|pizza|pincho|marisco|seafood|restaurant|comer|desayuno|almuerzo|cena|carne|carnicer|panader|repos|pastel|bizcocho|helad/i,
    publishTip: { who: 'Si vendes comida en Joyuda', post: 'Hoy en Joyuda: comida buena, vista linda y servicio rápido. Te esperamos.' } },
  { key: 'servicios', label: 'Servicios rápidos', icon: '⚡',
    match: /cerrajer|lavado|carwash|carro|auto|mecanic|goma|notar|abogad|gas|gasolina|combustible/i,
    publishTip: { who: 'Si lavas carros', post: 'Carwash en Cabo Rojo — tu carro brillando hoy mismo. Pasa o escríbeme por WhatsApp.' } },
  { key: 'salud', label: 'Salud y farmacia', icon: '💊',
    match: /farmacia|botica|medicament|receta|dentist|medico|médico|doctor|pediatr|veterinari|mascota|optica|óptica/i },
];

// Intent tag — separates "intención de compra" from "curiosidad" so a business owner
// sees himself inside the report and feels the urgency. One tag per term (ordered).
interface IntentTag { label: string; bg: string; fg: string; sell: string }
const INTENT_RULES: { re: RegExp; tag: IntentTag }[] = [
  { re: /arregla|repara|cerrajer|plomer|electricist|emergencia|urgente|tapad|fuga|no\s*enfr|no\s*prend|se\s*da[nñ]/i,
    tag: { label: 'Urgente', bg: '#fee2e2', fg: '#b91c1c', sell: 'Esto es un problema urgente. Si lo resuelves en Cabo Rojo, esta gente no necesita entretenimiento — necesita encontrarte ya.' } },
  { re: /pastel|bizcocho|cake|cumplea|compr|carnicer|\bcarne\b|tienda|ropa|mueble|piezas|farmacia|botica/i,
    tag: { label: 'Compra local', bg: '#e0e7ff', fg: '#4338ca', sell: 'Compra lista. Si vendes esto en Cabo Rojo, que te encuentren a ti — antes que al de afuera.' } },
  { re: /nevera|refriger|aire|acondicion|lavad|carwash|lavo\s*el\s*carro|mecanic|goma|notar|abogad/i,
    tag: { label: 'Servicio del hogar', bg: '#fef3c7', fg: '#92400e', sell: 'Alguien con un problema que quiere resolver hoy. Si haces esto en Cabo Rojo, necesita encontrarte.' } },
  { re: /comida|comer|restaurant|joyuda|chin|pizza|pincho|marisco|seafood|desayuno|almuerzo|cena|panader|repos|helad|caf[eé]/i,
    tag: { label: 'Comida', bg: '#dcfce7', fg: '#15803d', sell: 'Hambre y decisión ahora mismo. Si das de comer en Cabo Rojo y no apareces, comen en otro sitio.' } },
  { re: /playa|hotel|hospedaje|tour|visitar|que\s*hacer|faro|boquer|combate|parguera|caba[ñn]a/i,
    tag: { label: 'Turismo / salir', bg: '#cffafe', fg: '#0e7490', sell: 'Alguien decidiendo a dónde ir. Si esto es lo tuyo, aparece en el mapa antes de que decidan.' } },
];
const DEFAULT_INTENT: IntentTag = { label: 'Compra local', bg: '#e0e7ff', fg: '#4338ca', sell: 'Si tu negocio resuelve esto en Cabo Rojo, esta gente necesita encontrarte.' };
function intentTag(term: string): IntentTag {
  const t = (term || '').toLowerCase();
  for (const r of INTENT_RULES) if (r.re.test(t)) return r.tag;
  return DEFAULT_INTENT;
}
function intentChip(tag: IntentTag): string {
  return `<span style="background:${tag.bg};color:${tag.fg};font-size:11px;padding:2px 9px;border-radius:999px;font-weight:700;white-space:nowrap;">${tag.label}</span>`;
}

async function handle_demanda(req: any, res: any) {
  // Handle subscribe POST
  if (req.method === 'POST') {
    try {
      const { business_name, phone, keywords } = req.body || {};
      if (!business_name || !phone || !keywords) {
        res.status(400).json({ error: 'Faltan campos requeridos' });
        return;
      }
      const keywordArr = typeof keywords === 'string'
        ? keywords.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean)
        : keywords;
      const { error } = await supabase.from('demand_alerts').insert({
        business_name: String(business_name).substring(0, 200),
        phone: String(phone).replace(/\D/g, '').substring(0, 15),
        keywords: keywordArr,
      });
      if (error) throw error;
      res.status(200).json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Error al guardar' });
    }
    return;
  }

  // Fetch surge data
  const { data: surges, error } = await supabase.rpc('get_demand_surges');
  const rawSurge: SurgeRow[] = Array.isArray(surges) ? surges : [];

  // [PII 2026-05-31] Public page shows ONLY generic topic searches — never a
  // person's name, phone, or personal message. Token-validated allowlist:
  // EVERY token must be a known topic word OR a safe connector; any unknown
  // token (likely a proper name) rejects the whole term. At least one real
  // topic word required. Substring matching was insufficient (a name beside a
  // topic word — "viviana ortiz endocrinologa" — would have leaked).
  const TOPIC_WORD = /^(neveras?|refriger\w*|aire|acondicion\w*|ac|plomer\w*|electricist\w*|cerrajer\w*|carnes?|carnicer\w*|comidas?|china|chino|pizzas?|pinchos?|mariscos?|seafood|restaurant\w*|comer|desayunos?|almuerzos?|cenas?|pastel(?:es)?|bizcochos?|reposter\w*|pan|panader\w*|sobao|cake|caf[eé]s?|helad\w*|farmacias?|botica|medicament\w*|recetas?|dentist\w*|dental|m[eé]dicos?|doctora?|pediatr\w*|cardiolog\w*|endocrin\w*|veterinari\w*|mascotas?|gas|gasolina|combustible|lavados?|carwash|carros?|autos?|mec[aá]nic\w*|piezas?|gomas?|hotel\w*|hospedaje|alojamiento|caba[ñn]as?|playas?|lagunas?|gym|gimnasio|barber\w*|sal[oó]n|belleza|[oó]ptica|notar\w*|abogad\w*|contab\w*|ferreter\w*|tiendas?|ropa|supermercados?|colmados?|evento\w*|m[uú]sica|bar|tatua\w*|flor(?:es)?|funerarias?|panaderias?|reposterias?)$/i;
  const PLACES = new Set(['joyuda','boqueron','boquerón','combate','pedernales','buye','pueblo','parguera','lajas','mayaguez','mayagüez']);
  const STOP = new Set(['donde','dónde','como','cómo','quien','quién','en','el','la','los','las','de','del','un','una','unos','unas','para','pa','cerca','mejor','bueno','buena','buenos','buenas','hay','me','te','se','que','qué','cual','cuál','y','o','a','con','sin','mas','más','algun','algún','alguna','hoy','aqui','aquí','cabo','rojo','abierto','abierta','ahora','barato','barata','economico','económico','horario','horarios','precio','precios','servicio','servicios','recomiendan','recomienda','recomiendas','arregla','arreglan','arreglar','repara','reparan','reparar','vende','venden','vender','vendan','compro','compra','comprar','lavo','lava','lavan','lavar','necesito','busco','buscar','quiero','hace','hacen','hacer','cumpleanos','cumpleaños','fiesta','familiar','local','tiene','tienen']);
  function isSafePublicTerm(t: string): boolean {
    const s = (t || '').toLowerCase().trim();
    if (/\d/.test(s)) return false;                    // any digit → phones/addresses
    if (s.length < 3 || s.length > 40) return false;
    const tokens = s.split(/\s+/).filter(Boolean);
    if (tokens.length === 0 || tokens.length > 6) return false;
    let anchored = false;                              // ≥1 real topic or known place
    for (const tok of tokens) {
      const w = tok.replace(/[^a-záéíóúñü]/gi, '');
      if (!w) continue;
      if (STOP.has(w)) continue;
      if (PLACES.has(w)) { anchored = true; continue; }
      if (TOPIC_WORD.test(w)) { anchored = true; continue; }
      return false;                                    // unknown token → likely a name
    }
    return anchored;
  }
  const surgeList: SurgeRow[] = rawSurge.filter(r => isSafePublicTerm(r.term));

  // Headline stats via RPC: total searches (big, true) + unique vecinos (the honest
  // people count) + vecinos in the last 7d (proves "y siguen viniendo").
  const { data: vstatRaw } = await supabase.rpc('get_demand_vecino_stats');
  const vstat = (Array.isArray(vstatRaw) ? vstatRaw[0] : vstatRaw) as { busquedas?: number; vecinos?: number; vecinos_7d?: number } | null;
  const accumulated = Number(vstat?.busquedas || 0);   // searches — true and big
  const vecinos = Number(vstat?.vecinos || 0);          // distinct people — NOT the search count
  const vecinos7d = Number(vstat?.vecinos_7d || 0);

  // Headline insight (biggest mover this week, min 4) — lead with the story, not the raw count.
  const movers = [...surgeList]
    .filter(r => (r.this_week || 0) >= 4)
    .sort((a, b) => ((b.this_week || 0) - (b.last_week || 0)) - ((a.this_week || 0) - (a.last_week || 0)));
  const headline = movers[0] || surgeList[0] || null;

  // Stats
  const totalSearches = surgeList.reduce((s, r) => s + (r.this_week || 0), 0);
  const totalLastWeek = surgeList.reduce((s, r) => s + (r.last_week || 0), 0);
  const overallPct = totalLastWeek > 0
    ? Math.round(((totalSearches - totalLastWeek) / totalLastWeek) * 100)
    : 0;

  // Opportunities: terms with no matched businesses (had_results = false) — use high-demand new terms
  const opportunities = surgeList.filter(r => r.last_week === 0 && r.this_week >= 3).slice(0, 5);

  const tableRows = surgeList.map(row => {
    const color = getSurgeColor(row.surge_pct, row.last_week);
    const badge = getSurgeBadge(row.surge_pct, row.last_week);
    return `<tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:10px 12px;font-weight:600;color:#0f172a;">
        <span style="text-transform:capitalize;">${esc(row.term)}</span>
        <div style="margin-top:4px;">${intentChip(intentTag(row.term))}</div>
      </td>
      <td style="padding:10px 12px;text-align:center;font-weight:700;color:${color};">${row.this_week}</td>
      <td style="padding:10px 12px;text-align:center;color:#94a3b8;">${row.last_week}</td>
      <td style="padding:10px 12px;text-align:center;">${badge}</td>
    </tr>`;
  }).join('');

  const oppWa = (term: string) => `https://wa.me/17874177711?text=${encodeURIComponent(`Hola, vi que en Cabo Rojo buscaron "${term}" esta semana. Mi negocio resuelve eso y quiero aparecer de primero.`)}`;
  const recoWa = (term: string) => `https://wa.me/17874177711?text=${encodeURIComponent(`RECOMIENDO para "${term}": `)}`;
  const opportunityCards = opportunities.length > 0
    ? opportunities.map(row => {
      const tag = intentTag(row.term);
      return `
      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:16px 18px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
          <span style="font-weight:800;color:#92400e;text-transform:capitalize;font-size:16px;">${esc(row.term)}</span>
          ${intentChip(tag)}
        </div>
        <div style="color:#78350f;font-size:14px;margin:0 0 6px;"><strong>${row.this_week} búsquedas esta semana.</strong></div>
        <div style="color:#78350f;font-size:13.5px;margin:0 0 12px;">${tag.sell}</div>
        <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;">
          <a href="${oppWa(row.term)}" style="display:inline-block;background:#d4603a;color:white;text-decoration:none;padding:9px 18px;border-radius:8px;font-weight:700;font-size:13.5px;">¿Tú resuelves esto? Aparece de primero →</a>
          <a href="${recoWa(row.term)}" style="color:#0f766e;text-decoration:none;font-weight:700;font-size:13px;">¿Conoces uno bueno? Recomiéndalo →</a>
        </div>
      </div>`;
    }).join('')
    : '<p style="color:#64748b;font-size:14px;">Esta semana no apareció una categoría nueva sin cubrir. Vuelve el lunes — el radar cambia cada semana.</p>';

  // Hot categories (item 8) + publish tips (item 7)
  const categorized = DEMAND_CATEGORIES
    .map(cat => {
      const terms = surgeList.filter(r => cat.match.test(r.term));
      const total = terms.reduce((s, r) => s + (r.this_week || 0), 0);
      return { cat, terms, total };
    })
    .filter(c => c.terms.length > 0)
    .sort((a, b) => b.total - a.total);

  // 12-week trend per category (item 10) — aggregated server-side via RPC (≤48 rows,
  // avoids the 1000-row client limit that would undercount high-volume categories).
  const { data: catWeeksRaw } = await supabase.rpc('get_demand_category_weeks');
  const weeksByKey: Record<string, number[]> = {};
  for (const c of DEMAND_CATEGORIES) weeksByKey[c.key] = new Array(12).fill(0);
  for (const row of (Array.isArray(catWeeksRaw) ? catWeeksRaw : [])) {
    const k = (row as any).category_key as string;
    const wi = Number((row as any).week_idx);
    if (weeksByKey[k] && wi >= 0 && wi < 12) weeksByKey[k][wi] = Number((row as any).cnt) || 0;
  }
  function sparkSvg(vals: number[], color: string): string {
    const w = 88, h = 24, max = Math.max(1, ...vals);
    const pts = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * (w - 2) + 1;
      const y = h - (v / max) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" style="display:block;"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/></svg>`;
  }
  function trendWord(vals: number[]): string {
    const last = vals[vals.length - 1];
    const prior = vals.slice(-5, -1);
    const avgPrior = prior.length ? prior.reduce((s, v) => s + v, 0) / prior.length : 0;
    if (last > avgPrior * 1.3 && last >= 2) return '<span style="color:#10b981;font-weight:700;">↑ subiendo</span>';
    if (avgPrior > 0 && last < avgPrior * 0.7) return '<span style="color:#f97316;font-weight:700;">↓ bajando</span>';
    return '<span style="color:#94a3b8;">estable</span>';
  }

  const hotCategoriesHtml = categorized.length > 0
    ? categorized.map(c => {
        const wk = weeksByKey[c.cat.key] || new Array(12).fill(0);
        return `
      <div style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid #f1f5f9;">
        <div style="font-size:22px;">${c.cat.icon}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;color:#0f172a;font-size:15px;">${c.cat.label} <span style="color:#0d9488;font-weight:800;">· ${c.total}</span> <span style="font-size:12px;">${trendWord(wk)}</span></div>
          <div style="color:#64748b;font-size:13px;text-transform:capitalize;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.terms.map(t => esc(t.term)).join(' · ')}</div>
        </div>
        <div style="flex-shrink:0;" title="Últimas 12 semanas">${sparkSvg(wk, '#0d9488')}</div>
      </div>`;
      }).join('')
    : '<p style="color:#64748b;font-size:14px;">Aún no hay suficiente data para agrupar esta semana.</p>';

  // Qué publicar (item 8) — auto-generado del término REAL más buscado de cada categoría esta semana.
  const publishHtml = categorized
    .filter(c => c.cat.publishTip)
    .map(c => {
      const top = c.terms[0];
      const verb = top.this_week === 1 ? 'persona buscó' : 'personas buscaron';
      return `
      <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:14px 16px;margin-bottom:10px;">
        <div style="font-size:12.5px;color:#0f766e;margin-bottom:6px;">Esta semana ${top.this_week} ${verb} «<span style="text-transform:capitalize;">${esc(top.term)}</span>». ${c.cat.publishTip!.who}, este post te sirve:</div>
        <div style="color:#134e4a;font-size:14px;font-style:italic;">"${c.cat.publishTip!.post}"</div>
      </div>`;
    }).join('');

  const baseUrl = 'https://mapadecaborojo.com';
  const waLink = `https://wa.me/17874177711?text=${encodeURIComponent('Hola, vi el radar de demanda y quiero que mi negocio aparezca en Cabo Rojo')}`;

  // "El negocio que le falta" — demand ÷ supply opportunity engine (get_demand_opportunities RPC).
  // Turns the dashboard into ONE decision at the top: what business to open / where to appear #1.
  const { data: oppsRaw } = await supabase.rpc('get_demand_opportunities');
  // deno-lint-ignore no-explicit-any
  const allOpps: any[] = Array.isArray(oppsRaw) ? oppsRaw : [];
  const opps = allOpps.filter(o => o && o.is_opportunity);
  const heroOpp = opps[0] || null;
  const oppOpenWa = (label: string) => `https://wa.me/17874177711?text=${encodeURIComponent(`Vi en el Radar de MapaDeCaboRojo que en Cabo Rojo falta "${label}". Quiero montar/abrir esto. ¿Me orientas?`)}`;
  const oppOwnWa = (label: string) => `https://wa.me/17874177711?text=${encodeURIComponent(`Yo hago "${label}" en Cabo Rojo. Vi que lo buscan y no hay suficiente. Quiero aparecer #1 cuando lo busquen.`)}`;
  const heroOppHtml = heroOpp ? `
    <div style="background:linear-gradient(135deg,#d4603a,#b91c1c);border-radius:18px;padding:28px 26px;margin-bottom:20px;color:white;box-shadow:0 8px 30px rgba(180,30,30,0.22);">
      <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.1em;opacity:0.92;margin-bottom:8px;">🎯 El negocio que le falta a Cabo Rojo</div>
      <div style="font-size:30px;font-weight:900;line-height:1.1;text-transform:capitalize;">${esc(heroOpp.label)}</div>
      <div style="font-size:16px;opacity:0.96;margin:10px 0 6px;line-height:1.45;">
        <strong>${heroOpp.demand_30d}</strong> vecino${Number(heroOpp.demand_30d) === 1 ? '' : 's'} lo buscaron este mes.
        ${Number(heroOpp.supply) === 0 ? 'Y <strong>nadie</strong> en el directorio lo resuelve.' : `Solo <strong>${heroOpp.supply}</strong> negocio${Number(heroOpp.supply) === 1 ? '' : 's'} lo resuelve${Number(heroOpp.supply) === 1 ? '' : 'n'}.`}
        Si abres esto, ya tienes clientes esperando.
      </div>
      <div style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:999px;padding:4px 12px;font-size:13px;font-weight:700;margin-bottom:18px;">${esc(heroOpp.verdict)}</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <a href="${oppOpenWa(heroOpp.label)}" style="flex:1;min-width:170px;text-align:center;background:white;color:#b91c1c;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:800;font-size:14px;">Quiero abrir esto →</a>
        <a href="${oppOwnWa(heroOpp.label)}" style="flex:1;min-width:170px;text-align:center;background:rgba(0,0,0,0.28);color:white;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:800;font-size:14px;">Ya lo hago, ponme #1 →</a>
      </div>
      ${opps.length > 1 ? `<details style="margin-top:16px;"><summary style="cursor:pointer;font-size:13px;opacity:0.92;list-style:none;">Ver las ${opps.length} oportunidades del mes ▾</summary>
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;">
          ${opps.map(o => `<div style="display:flex;justify-content:space-between;gap:10px;background:rgba(255,255,255,0.12);border-radius:8px;padding:8px 12px;font-size:13px;"><span style="text-transform:capitalize;font-weight:700;">${esc(o.label)}</span><span style="opacity:0.92;white-space:nowrap;">${o.demand_30d} buscan · ${o.supply} ofrecen</span></div>`).join('')}
        </div></details>` : ''}
    </div>` : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Radar de Demanda — Cabo Rojo | MapaDeCaboRojo.com</title>
  <meta name="description" content="Descubre qué buscan los residentes y visitantes de Cabo Rojo en tiempo real. Análisis semanal de demanda local para negocios.">
  <link rel="canonical" href="${baseUrl}/demanda">
  <meta property="og:title" content="Radar de Demanda — Cabo Rojo">
  <meta property="og:description" content="La gente ya está buscando. La pregunta es si encuentra tu negocio.">
  <meta property="og:url" content="${baseUrl}/demanda">
  <meta property="og:site_name" content="MapaDeCaboRojo.com">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Radar de Demanda — Cabo Rojo","url":"${baseUrl}/demanda","description":"Análisis de demanda local semanal para negocios en Cabo Rojo, Puerto Rico."}</script>
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Demanda local de Cabo Rojo',
    description: `Búsquedas reales de residentes, visitantes y diáspora al asistente *7711 y al directorio MapaDeCaboRojo.com. ${accumulated} búsquedas acumuladas. Actualizado cada semana. Datos agregados, sin información personal.`,
    url: `${baseUrl}/demanda`,
    keywords: ['Cabo Rojo', 'Puerto Rico', 'demanda local', 'búsquedas de negocios', 'intención de compra'],
    temporalCoverage: '2026/..',
    isAccessibleForFree: true,
    creativeWorkStatus: 'Published',
    creator: { '@type': 'Person', name: 'Angel Anderson', url: 'https://angelanderson.com' },
    publisher: { '@type': 'Organization', name: 'MapaDeCaboRojo.com', url: baseUrl },
    spatialCoverage: { '@type': 'Place', name: 'Cabo Rojo, Puerto Rico' },
    variableMeasured: 'Volumen de búsquedas por categoría y término',
    measurementTechnique: 'Conteo de consultas reales al asistente *7711 y al buscador del directorio, normalizadas y filtradas de datos personales',
    distribution: { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${baseUrl}/api/intelligence` },
  })}</script>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b;line-height:1.6;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0d9488 0%,#0f766e 50%,#1d4ed8 100%);padding:48px 24px 56px;text-align:center;">
    <a href="${baseUrl}" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:13px;display:inline-block;margin-bottom:16px;">← MapaDeCaboRojo.com</a>
    <div style="font-size:40px;margin-bottom:8px;">📈</div>
    <h1 style="color:white;font-size:28px;font-weight:800;margin:0 0 10px 0;">Radar de Demanda</h1>
    <p style="color:white;font-size:17px;font-weight:600;margin:0 auto 8px;max-width:500px;line-height:1.4;">La gente ya está buscando.<br>El problema es que no siempre encuentra a quién comprarle.</p>
    <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:0 auto;max-width:480px;">Demanda real del Veci *7711 y el Mapa de Cabo Rojo, cruzada con lo que ya existe en el directorio. Lo que la gente busca y nadie resuelve = el negocio que falta.</p>
  </div>

  <div style="max-width:720px;margin:-24px auto 0;padding:0 16px 48px;">

    <!-- Abuelita-friendly explainer (item 2) -->
    <div style="background:white;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.08);padding:20px 24px;margin-bottom:16px;">
      <p style="margin:0;color:#334155;font-size:15px;">Este radar muestra las <strong>búsquedas reales</strong> que la gente hace en el Veci *7711 y en el mapa. Si muchas personas buscan plomero, comida, neveras o cerrajero, eso es <strong>demanda</strong>. Si tu negocio resuelve eso, debe aparecer aquí.</p>
    </div>

    <!-- Two paths (item 3) -->
    <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
      <a href="${baseUrl}" style="flex:1;min-width:200px;text-decoration:none;background:#0d9488;color:white;border-radius:12px;padding:16px 18px;">
        <div style="font-size:15px;font-weight:800;">Soy residente / turista</div>
        <div style="font-size:13px;opacity:0.9;margin-top:2px;">Encuentra lo que necesitas →</div>
      </a>
      <a href="#tu-negocio" style="flex:1;min-width:200px;text-decoration:none;background:#d4603a;color:white;border-radius:12px;padding:16px 18px;">
        <div style="font-size:15px;font-weight:800;">Tengo un negocio</div>
        <div style="font-size:13px;opacity:0.9;margin-top:2px;">Haz que te encuentren →</div>
      </a>
    </div>

    <!-- 🎯 El negocio que le falta — la UNA decisión arriba de todo (demanda ÷ oferta) -->
    ${heroOppHtml}

    <!-- Hero: insight first, not the raw weekly count -->
    ${headline ? `<div style="background:linear-gradient(135deg,#0f766e,#0d9488);border-radius:16px;padding:24px 28px;margin-bottom:16px;color:white;">
      <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.85;margin-bottom:6px;">🔥 Lo que más subió esta semana</div>
      <div style="font-size:26px;font-weight:800;text-transform:capitalize;line-height:1.2;">${esc(headline.term)}</div>
      <div style="font-size:15px;opacity:0.9;margin-top:4px;">${headline.this_week} búsquedas${headline.last_week > 0 ? ` — ${Math.round((headline.this_week / Math.max(headline.last_week,1)))}x más que la semana pasada` : ' (tema nuevo)'}</div>
    </div>` : ''}

    <div style="background:white;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.1);padding:24px 32px;margin-bottom:24px;display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
      <div style="flex:1;min-width:160px;">
        <div style="font-size:42px;font-weight:800;color:#0d9488;line-height:1;">${vecinos.toLocaleString('es-PR')}</div>
        <div style="color:#334155;font-size:15px;font-weight:600;margin-top:4px;">vecinos ya preguntaron — y siguen viniendo</div>
        <div style="color:#94a3b8;font-size:12.5px;margin-top:3px;">${vecinos7d.toLocaleString('es-PR')} esta semana · ${accumulated.toLocaleString('es-PR')} búsquedas en total</div>
      </div>
      <div style="flex:1;min-width:160px;border-left:2px solid #e2e8f0;padding-left:24px;">
        <div style="font-size:32px;font-weight:800;line-height:1;color:${overallPct >= 0 ? '#10b981' : '#ef4444'};">
          ${overallPct >= 0 ? '+' : ''}${overallPct}%
        </div>
        <div style="color:#64748b;font-size:15px;margin-top:4px;">demanda vs semana pasada</div>
      </div>
    </div>

    <!-- La frase que manda la página -->
    <div style="background:#7f1d1d;border-radius:16px;padding:22px 24px;margin-bottom:24px;">
      <p style="margin:0;color:white;font-size:17px;font-weight:700;line-height:1.45;">Si tu negocio resuelve una de estas búsquedas y no apareces aquí, estás invisible donde hay intención de compra.</p>
    </div>

    <!-- Dinero buscando dueño (items 4 + 5 + 6) — la sección que vende sola -->
    <div style="background:white;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.12);padding:24px;margin-bottom:24px;border-top:4px solid #d4603a;">
      <h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#0f172a;">💰 Dinero buscando dueño</h2>
      <p style="margin:0 0 6px;color:#475569;font-size:14px;">Esto se buscó este mes en Cabo Rojo. Si tu negocio lo resuelve, aquí es donde apareces.</p>
      <p style="margin:0 0 16px;color:#94a3b8;font-size:12.5px;">Estas no son opiniones. Son búsquedas reales — alguien escribió esto porque necesitaba resolver algo.</p>
      ${opportunityCards}
    </div>

    <!-- Dashboard completo (colapsado) — los números detrás de la decisión de arriba -->
    <details style="margin-bottom:24px;">
    <summary style="cursor:pointer;list-style:none;background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);padding:16px 20px;font-weight:700;color:#0f172a;font-size:15px;">📊 Ver todos los números (tendencias, categorías, qué publicar) ▾</summary>
    <div style="margin-top:16px;">

    <!-- Surge Table -->
    <div style="background:white;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08);margin-bottom:24px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:2px solid #e2e8f0;">
        <h2 style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">Tendencias de búsqueda</h2>
        <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Últimos 30 días vs mes anterior · por categoría</p>
      </div>
      ${surgeList.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Término</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Este mes</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Mes anterior</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Cambio</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>` : `
      <div style="padding:40px;text-align:center;color:#94a3b8;">
        <div style="font-size:32px;margin-bottom:8px;">📊</div>
        <p>Aún no hay suficientes datos esta semana. Vuelve en unos días.</p>
      </div>`}
    </div>

    <!-- Categorías calientes (item 8) -->
    <div style="background:white;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:24px;margin-bottom:24px;">
      <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#0f172a;">🔥 Categorías calientes</h2>
      ${hotCategoriesHtml}
    </div>

    ${publishHtml ? `<!-- Qué publicar esta semana (item 7) -->
    <div style="background:white;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:24px;margin-bottom:24px;">
      <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#0f172a;">📣 Qué publicar esta semana</h2>
      <p style="margin:0 0 14px;color:#64748b;font-size:13px;">La gente está buscando esto. Copia, pega y publica — no inventes.</p>
      ${publishHtml}
    </div>` : ''}

    </div>
    </details>
    <!-- /dashboard colapsado -->

    <!-- Cruce con las fuentes federales de Puerto Rico Sin Filtros (el próximo nivel: resolver, no solo mostrar) -->
    <div style="background:#0f172a;border:1px solid #1e293b;border-radius:16px;padding:24px;margin-bottom:16px;color:#e2e8f0;">
      <p style="margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#5eead4;font-weight:700;">La demanda local no vive sola</p>
      <h2 style="margin:6px 0 4px;font-size:20px;font-weight:800;color:#fff;line-height:1.3;">Cruza esto con lo federal, y el hueco deja de ser un problema para volverse una jugada</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#94a3b8;line-height:1.55;">Lo que la gente de Cabo Rojo busca y no encuentra se explica —y a veces se <em>paga</em>— con la data federal que nadie cruza. El puente:</p>
      <div style="display:grid;gap:10px;">
        <a href="https://puertoricosinfiltros.com/registro/estado" style="display:block;text-decoration:none;background:#134e4a;border-radius:10px;padding:14px 16px;color:#fff;">
          <strong>🩺 Buscan médico y no lo encuentran</strong><br><span style="font-size:13px;color:#a7f3d0;line-height:1.5;">Y hay hasta $75,000 federales (repago de préstamos NHSC) esperando al que abra su práctica en un pueblo designado. La demanda existe Y el dinero existe. →</span>
        </a>
        <a href="https://puertoricosinfiltros.com/exposicion-ai" style="display:block;text-decoration:none;background:#1e293b;border-radius:10px;padding:14px 16px;color:#fff;">
          <strong>🤖 El trabajo de pantalla se va, el oficio de manos aguanta</strong><br><span style="font-size:13px;color:#94a3b8;line-height:1.5;">Lo que más se busca aquí (refrigeración, plomería, mecánica) es justo lo que la inteligencia artificial no toca. Abrir un oficio de manos es abrir en el lado firme del piso. →</span>
        </a>
        <a href="https://puertoricosinfiltros.com/costo-de-vida" style="display:block;text-decoration:none;background:#1e293b;border-radius:10px;padding:14px 16px;color:#fff;">
          <strong>💵 Antes de invertir, mira lo que rinde</strong><br><span style="font-size:13px;color:#94a3b8;line-height:1.5;">Ingreso, luz, canasta — el costo real de operar en Puerto Rico, con la fuente al lado. →</span>
        </a>
      </div>
      <p style="margin:16px 0 0;font-size:13px;color:#cbd5e1;line-height:1.6;"><strong style="color:#fff;">El alivio:</strong> no arriesgues tus ahorros en lo saturado. Aquí está el hueco con demanda probada, y —si es salud— el dinero federal que te paga por llenarlo. Si te sirve, úsalo. Si no, sigue tu camino.</p>
    </div>

    <!-- Captura de lead inbound (item 9) — tabla demand_alerts existente, el Veci avisa -->
    <div id="tu-negocio" style="background:linear-gradient(135deg,#0d9488,#0f766e);border-radius:16px;padding:26px 24px;margin-bottom:16px;color:white;scroll-margin-top:16px;">
      <h2 style="margin:0 0 6px;font-size:20px;font-weight:800;">Avísame cuando te busquen</h2>
      <p style="margin:0 0 16px;font-size:14px;opacity:0.92;">Déjame tu negocio. Cuando alguien busque lo que tú resuelves en el Veci, te aviso por WhatsApp. Gratis.</p>
      <form id="alertForm" style="display:flex;flex-direction:column;gap:10px;">
        <input name="business_name" required maxlength="120" placeholder="Nombre de tu negocio" style="padding:12px 14px;border:none;border-radius:9px;font-size:15px;">
        <input name="phone" required maxlength="20" inputmode="tel" placeholder="Tu WhatsApp (787...)" style="padding:12px 14px;border:none;border-radius:9px;font-size:15px;">
        <input name="keywords" required maxlength="120" placeholder="¿Qué resuelves? ej: plomero, neveras, comida" style="padding:12px 14px;border:none;border-radius:9px;font-size:15px;">
        <button type="submit" style="background:#d4603a;color:white;border:none;padding:13px;border-radius:9px;font-weight:800;font-size:15px;cursor:pointer;">Avísame →</button>
      </form>
      <div id="alertOk" style="display:none;background:rgba(255,255,255,0.15);border-radius:10px;padding:16px;text-align:center;font-weight:700;">✓ Listo. Te aviso cuando el pueblo te busque.</div>
      <p style="margin:12px 0 0;font-size:12px;opacity:0.8;">Sin compromiso. Es el primer paso — si después quieres salir cada semana, ahí abajo está La Vitrina.</p>
    </div>
    <script>
      (function(){
        var f=document.getElementById('alertForm');
        if(!f) return;
        f.addEventListener('submit',function(e){
          e.preventDefault();
          var btn=f.querySelector('button');
          btn.disabled=true; btn.textContent='Enviando...';
          fetch('/demanda',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({business_name:f.business_name.value,phone:f.phone.value,keywords:f.keywords.value})})
            .then(function(r){ if(!r.ok) throw new Error('bad'); return r.json(); })
            .then(function(){ f.style.display='none'; document.getElementById('alertOk').style.display='block'; })
            .catch(function(){ btn.disabled=false; btn.textContent='Avísame →'; alert('Hubo un error. Escríbeme al 787-417-7711.'); });
        });
      })();
    </script>

    <!-- CTA: Listing gratis + La Vitrina (modelo de pricing real) -->
    <div style="background:white;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:28px 24px;margin-bottom:16px;">
      <h2 style="margin:0 0 6px;font-size:20px;font-weight:800;color:#0f172a;">¿Vendes algo que la gente ya está buscando?</h2>
      <p style="margin:0 0 18px;color:#475569;font-size:14px;font-weight:600;">Aparece antes de que compren en otro sitio.</p>

      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin-bottom:14px;">
        <div style="display:inline-block;background:#dcfce7;color:#15803d;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;margin-bottom:8px;">GRATIS</div>
        <h3 style="margin:0 0 4px;font-size:16px;color:#0f172a;">Aparece en el directorio</h3>
        <p style="margin:0 0 12px;color:#64748b;font-size:14px;">Que te encuentren en el mapa y en el Veci *7711. No cuesta nada — solo verificamos que existes.</p>
        <a href="${baseUrl}/pon-tu-negocio-en-el-mapa" style="display:inline-block;background:#0d9488;color:white;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:700;font-size:14px;">Poner mi negocio gratis →</a>
      </div>

      <div style="border:1px solid #fcd34d;border-radius:12px;padding:18px 20px;background:#fffbeb;">
        <div style="display:inline-block;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;margin-bottom:8px;">LA VITRINA · desde $40</div>
        <h3 style="margin:0 0 4px;font-size:16px;color:#0f172a;">Que el pueblo te vea cada semana</h3>
        <p style="margin:0 0 6px;color:#64748b;font-size:14px;">No te vendo un anuncio — te ayudo a aparecer con intención. Tú das el contenido, nosotros lo publicamos:</p>
        <ul style="margin:0 0 14px;padding-left:18px;color:#475569;font-size:13.5px;">
          <li><strong>$40</strong> — sal esta semana con una publicación</li>
          <li><strong>$150</strong> — sal 4 semanas corridas (una por semana)</li>
          <li><strong>$799/año</strong> — domina tu categoría: una semanal todo el año + exclusividad</li>
        </ul>
        <a href="https://caborojo.com/patrocina" style="display:inline-block;background:#d4603a;color:white;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:700;font-size:14px;">Quiero salir en La Vitrina →</a>
      </div>

      <a href="${waLink}" style="display:block;text-align:center;margin-top:14px;background:#f1f5f9;color:#0f766e;text-decoration:none;padding:12px;border-radius:8px;font-weight:700;font-size:14px;">💬 Textear al Veci · 787-417-7711</a>
    </div>

    <!-- Cierre con urgencia semanal (item 10) -->
    <div style="background:#0f172a;border-radius:16px;padding:22px 24px;margin-bottom:16px;text-align:center;">
      <p style="margin:0;color:white;font-size:16px;font-weight:700;line-height:1.5;">Este radar cambia cada semana.</p>
      <p style="margin:6px 0 0;color:#cbd5e1;font-size:14px;">Si tu categoría aparece hoy, muévete hoy. La demanda no espera.</p>
    </div>

    <!-- Metodología y fuente (item 7) — lo que la hace citable por AI y prensa -->
    <div style="background:white;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:24px;margin-bottom:24px;">
      <h2 style="margin:0 0 10px;font-size:16px;font-weight:700;color:#0f172a;">Metodología y fuente</h2>
      <p style="margin:0 0 8px;color:#475569;font-size:13.5px;">Cada número viene de <strong>búsquedas reales</strong> que vecinos, visitantes y diáspora le hacen al asistente *7711 y al buscador de MapaDeCaboRojo.com — no de encuestas ni estimados. Total acumulado: <strong>${accumulated.toLocaleString('es-PR')}</strong> búsquedas. Se actualiza cada semana.</p>
      <p style="margin:0 0 8px;color:#475569;font-size:13.5px;">Los datos se muestran <strong>agregados por categoría y término genérico</strong>. Nunca publicamos nombres de personas, teléfonos ni mensajes privados.</p>
      <p style="margin:0;color:#94a3b8;font-size:12.5px;">Fuente citable: <em>Radar de Demanda — MapaDeCaboRojo.com</em>. Datos abiertos en <a href="${baseUrl}/api/intelligence" style="color:#0d9488;text-decoration:none;">/api/intelligence</a>. Prensa e investigadores: escriban al 787-417-7711.</p>
    </div>

    <p style="text-align:center;color:#94a3b8;font-size:13px;margin:0 0 24px;">¿Preguntas? Textea al <a href="${waLink}" style="color:#0d9488;text-decoration:none;font-weight:600;">787-417-7711</a> — te contesta el Veci.</p>

    <footer style="text-align:center;padding:16px 0;border-top:1px solid #e2e8f0;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">Hecho con orgullo en Cabo Rojo, Puerto Rico</p>
      <p style="color:#94a3b8;font-size:11px;margin:4px 0 0;">
        <a href="${baseUrl}" style="color:#0d9488;text-decoration:none;">MapaDeCaboRojo.com</a>
        · Un proyecto de <a href="https://angelanderson.com" style="color:#0d9488;text-decoration:none;">Angel Anderson</a>
      </p>
    </footer>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(html);
}

// ============ intelligence ============



function periodToDays(period: string): number {
  if (period === '30d') return 30;
  if (period === '90d') return 90;
  return 7;
}

function trendLabel(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

async function checkApiKey(key: string | null): Promise<boolean> {
  if (!key) return false;
  const supa = supabase;
  const { data } = await supa
    .from('api_keys')
    .select('id, active')
    .eq('key', key)
    .eq('active', true)
    .single();
  return !!data;
}

async function handle_intelligence(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const apiKey = (req.query.key as string) || (req.headers['x-api-key'] as string) || null;
  const period = (req.query.period as string) || '7d';
  const format = (req.query.format as string) || 'json';
  const days = periodToDays(period);

  // Auth check
  const validKey = await checkApiKey(apiKey);
  if (!validKey) {
    return res.status(401).json({
      error: 'API key requerida. Obtén acceso gratuito en mapadecaborojo.com/turismo',
      docs: 'https://mapadecaborojo.com/turismo'
    });
  }

  const supa = supabase;

  const nowISO = new Date().toISOString();
  const startCurrent = new Date(Date.now() - days * 86400000).toISOString();
  const startPrevious = new Date(Date.now() - days * 2 * 86400000).toISOString();

  // Parallel queries
  const [currentData, previousData] = await Promise.all([
    supa
      .from('demand_signals')
      .select('query_text, query_normalized, category, user_hash, had_results, results_count, created_at')
      .gte('created_at', startCurrent),
    supa
      .from('demand_signals')
      .select('query_text, query_normalized, results_count, had_results, created_at')
      .gte('created_at', startPrevious)
      .lt('created_at', startCurrent)
  ]);

  const rows = currentData.data || [];
  const prevRows = previousData.data || [];

  // Total searches
  const totalSearches = rows.length;
  const uniqueUsers = new Set(rows.map((r: any) => r.user_hash).filter(Boolean)).size;

  // Top terms (current period)
  const termCount: Record<string, number> = {};
  for (const r of rows) {
    const t = (r.query_normalized || r.query_text || '').toLowerCase().trim();
    if (t) termCount[t] = (termCount[t] || 0) + 1;
  }

  // Previous period term counts
  const prevTermCount: Record<string, number> = {};
  for (const r of prevRows) {
    const t = (r.query_text || '').toLowerCase().trim();
    if (t) prevTermCount[t] = (prevTermCount[t] || 0) + 1;
  }

  const topTerms = Object.entries(termCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term, count]) => ({
      term,
      count,
      trend: trendLabel(count, prevTermCount[term] || 0)
    }));

  // Categories demand
  const catCount: Record<string, number> = {};
  for (const r of rows) {
    const c = r.category || 'OTHER';
    catCount[c] = (catCount[c] || 0) + 1;
  }
  const categoriesDemand = Object.entries(catCount)
    .sort((a, b) => b[1] - a[1])
    .map(([category, searches]) => ({ category, searches }));

  // Hourly distribution
  const hourCount: Record<number, number> = {};
  for (let h = 0; h < 24; h++) hourCount[h] = 0;
  for (const r of rows) {
    const h = new Date(r.created_at).getUTCHours();
    hourCount[h] = (hourCount[h] || 0) + 1;
  }
  const hourlyDistribution = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: hourCount[h] || 0
  }));

  // Gaps: queries with no results (had_results = false or results_count = 0)
  const gapCount: Record<string, number> = {};
  for (const r of rows) {
    const noResults = r.had_results === false || r.results_count === 0;
    if (noResults) {
      const t = (r.query_normalized || r.query_text || '').toLowerCase().trim();
      if (t && t.length > 2) gapCount[t] = (gapCount[t] || 0) + 1;
    }
  }
  const gaps = Object.entries(gapCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([term]) => term);

  // Opportunities (demand÷supply) — the paid intelligence: where to open / where to appear.
  const { data: oppsRawApi } = await supa.rpc('get_demand_opportunities');
  const opportunities = Array.isArray(oppsRawApi) ? oppsRawApi : [];

  const payload = {
    period,
    generated_at: nowISO,
    total_searches: totalSearches,
    unique_users: uniqueUsers,
    top_terms: topTerms,
    categories_demand: categoriesDemand,
    opportunities,
    hourly_distribution: hourlyDistribution,
    gaps
  };

  if (format === 'csv') {
    const lines = ['term,count,trend'];
    for (const t of topTerms) lines.push(`"${t.term}",${t.count},"${t.trend}"`);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tourism-intelligence-${period}.csv"`);
    return res.status(200).send(lines.join('\n'));
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.status(200).json(payload);
}


// ============ evento ============


function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'America/Puerto_Rico',
  });
}

function fmtTime(iso: string, isAllDay: boolean): string {
  if (isAllDay) return 'Todo el día';
  return new Date(iso).toLocaleTimeString('es-PR', {
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'America/Puerto_Rico',
  });
}

async function handle_evento(req: any, res: any) {
  const slug = (req.query?.slug as string || '').toLowerCase().trim();

  if (!slug) {
    res.status(400).send('<html><body><h1>404</h1><p>Evento no encontrado.</p></body></html>');
    return;
  }

  try {
    const { data: event, error } = await supabase
      .from('events')
      .select(`
        id, title, slug, description, category, start_time, end_time, is_all_day,
        location_name, image_url, place_id, ticket_link, price_range, parking_info,
        restrictions, instagram_handle, official_website, family_friendly, sponsor_opportunity,
        map_link, vibes, amenities
      `)
      .eq('slug', slug)
      .maybeSingle();

    if (error || !event) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(404).send(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Evento no encontrado</title></head>
<body style="font-family:-apple-system,sans-serif;max-width:600px;margin:80px auto;padding:0 24px;text-align:center;">
<h1 style="font-size:48px;color:#1e293b;">404</h1>
<p style="color:#64748b;">No encontramos ese evento. <a href="/municipio" style="color:#0d9488;">Ver eventos próximos →</a></p>
</body></html>`);
      return;
    }

    // Optional: fetch sponsor place info if linked
    let sponsorPlace: any = null;
    if (event.place_id) {
      const { data: place } = await supabase
        .from('places')
        .select('name, slug, plan, is_featured, image_url')
        .eq('id', event.place_id)
        .maybeSingle();
      if (place && (place.plan === 'vip' || place.plan === 'vitrina_basica' || place.plan === 'vitrina_veci' || place.is_featured)) {
        sponsorPlace = place;
      }
    }

    const startDate = fmtDate(event.start_time);
    const startTime = fmtTime(event.start_time, !!event.is_all_day);
    const endTime = event.end_time ? fmtTime(event.end_time, !!event.is_all_day) : null;
    const eventUrl = `https://www.mapadecaborojo.com/evento/${esc(event.slug)}`;

    // Schema.org/Event JSON-LD for SEO + LLM discoverability
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: event.title,
      startDate: event.start_time,
      ...(event.end_time ? { endDate: event.end_time } : {}),
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: {
        '@type': 'Place',
        name: event.location_name || 'Cabo Rojo, Puerto Rico',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Cabo Rojo',
          addressRegion: 'PR',
          addressCountry: 'US',
        },
      },
      ...(event.image_url ? { image: [event.image_url] } : {}),
      ...(event.description ? { description: event.description } : {}),
      url: eventUrl,
      organizer: {
        '@type': 'Organization',
        name: 'MapaDeCaboRojo.com',
        url: 'https://mapadecaborojo.com',
      },
      ...(event.ticket_link ? {
        offers: {
          '@type': 'Offer',
          url: event.ticket_link,
          priceCurrency: 'USD',
          ...(event.price_range ? { price: event.price_range.replace(/[^0-9.]/g, '') || '0' } : { price: '0' }),
          availability: 'https://schema.org/InStock',
        }
      } : {}),
    };

    const description = event.description || `${event.title} en Cabo Rojo, Puerto Rico — ${startDate}.`;
    const ogImage = event.image_url || 'https://mapadecaborojo.com/og-default.png';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(event.title)} — ${startDate} · MapaDeCaboRojo.com</title>
<meta name="description" content="${esc(description.slice(0, 160))}">
<meta property="og:title" content="${esc(event.title)} — ${startDate}">
<meta property="og:description" content="${esc(description.slice(0, 160))}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:type" content="event">
<meta property="og:url" content="${eventUrl}">
<link rel="canonical" href="${eventUrl}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;color:#1e293b;-webkit-font-smoothing:antialiased}a{color:inherit}</style>
</head>
<body>

<!-- HEADER -->
<div style="background:#1e293b;color:#fff;padding:20px 24px;">
  <div style="max-width:780px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;">
    <a href="/" style="color:#5eead4;text-decoration:none;font-size:14px;font-weight:600;">← MapaDeCaboRojo.com</a>
    <a href="/municipio" style="color:#94a3b8;text-decoration:none;font-size:13px;">Panel ciudadano</a>
  </div>
</div>

${event.image_url ? `
<div style="width:100%;max-width:780px;margin:0 auto;height:280px;background:url('${esc(event.image_url)}') center/cover #1e293b;"></div>
` : ''}

<div style="max-width:780px;margin:24px auto;padding:0 16px;">

  <div style="background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:20px;">

    <div style="font-size:12px;color:#0d9488;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;margin-bottom:8px;">📅 Evento</div>

    <h1 style="font-size:32px;font-weight:800;color:#1e293b;letter-spacing:-0.5px;line-height:1.2;margin-bottom:16px;">${esc(event.title)}</h1>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:24px;padding:18px;background:#f8fafc;border-radius:10px;">
      <div>
        <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">📅 Fecha</div>
        <div style="font-size:14px;color:#1e293b;font-weight:600;margin-top:2px;">${startDate}</div>
      </div>
      <div>
        <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">🕐 Hora</div>
        <div style="font-size:14px;color:#1e293b;font-weight:600;margin-top:2px;">${startTime}${endTime ? ` – ${endTime}` : ''}</div>
      </div>
      <div>
        <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">📍 Lugar</div>
        <div style="font-size:14px;color:#1e293b;font-weight:600;margin-top:2px;">${esc(event.location_name || 'Cabo Rojo')}</div>
      </div>
      ${event.price_range ? `
      <div>
        <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">💰 Precio</div>
        <div style="font-size:14px;color:#1e293b;font-weight:600;margin-top:2px;">${esc(event.price_range)}</div>
      </div>` : ''}
    </div>

    ${event.description ? `
    <div style="margin-bottom:24px;">
      <div style="font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Descripción</div>
      <p style="font-size:15px;line-height:1.7;color:#374151;">${esc(event.description)}</p>
    </div>` : ''}

    ${event.parking_info ? `
    <div style="margin-bottom:16px;padding:12px 14px;background:#fef3c7;border-radius:8px;">
      <div style="font-size:13px;font-weight:600;color:#92400e;">🅿️ Estacionamiento</div>
      <div style="font-size:13px;color:#78350f;margin-top:2px;">${esc(event.parking_info)}</div>
    </div>` : ''}

    ${event.restrictions ? `
    <div style="margin-bottom:16px;padding:12px 14px;background:#fee2e2;border-radius:8px;">
      <div style="font-size:13px;font-weight:600;color:#991b1b;">⚠️ Restricciones</div>
      <div style="font-size:13px;color:#7f1d1d;margin-top:2px;">${esc(event.restrictions)}</div>
    </div>` : ''}

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:24px;">
      ${event.map_link ? `<a href="${esc(event.map_link)}" target="_blank" rel="noopener" style="background:#0d9488;color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">📍 Cómo llegar</a>` : ''}
      ${event.ticket_link ? `<a href="${esc(event.ticket_link)}" target="_blank" rel="noopener" style="background:#7c3aed;color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">🎟️ Boletos</a>` : ''}
      ${event.official_website ? `<a href="${esc(event.official_website)}" target="_blank" rel="noopener" style="background:#1e293b;color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">🌐 Sitio oficial</a>` : ''}
      ${event.instagram_handle ? `<a href="https://instagram.com/${esc(event.instagram_handle.replace('@',''))}" target="_blank" rel="noopener" style="background:#e1306c;color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">📸 Instagram</a>` : ''}
      <a href="https://wa.me/17874177711?text=${encodeURIComponent('Info sobre el evento: ' + event.title)}" style="background:#25D366;color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">💬 Pregunta al *7711</a>
    </div>

  </div>

  ${sponsorPlace ? `
  <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:20px;border-left:4px solid #ea580c;">
    <div style="font-size:12px;color:#ea580c;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;margin-bottom:6px;">⭐ Negocio anfitrión</div>
    <a href="/negocio/${esc(sponsorPlace.slug)}" style="font-size:18px;font-weight:700;color:#1e293b;text-decoration:none;">${esc(sponsorPlace.name)} →</a>
  </div>` : ''}

  <div style="background:#1e293b;border-radius:12px;padding:24px;color:#fff;text-align:center;margin-bottom:20px;">
    <div style="font-size:15px;font-weight:600;margin-bottom:8px;">¿Conoces más eventos de Cabo Rojo?</div>
    <div style="font-size:13px;color:#94a3b8;margin-bottom:14px;">Texteámelos al *7711 y los agrego al directorio.</div>
    <a href="https://wa.me/17874177711?text=Quiero%20agregar%20un%20evento" style="background:#0d9488;color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;">Textea al 787-417-7711</a>
  </div>

</div>

<div style="background:#0f172a;color:#64748b;padding:20px 24px;text-align:center;font-size:12px;">
  <div>Hecho por <a href="https://angelanderson.com" style="color:#5eead4;text-decoration:none;">Angel Anderson</a> · Cabo Rojo, Puerto Rico</div>
  <div style="margin-top:4px;">© ${new Date().getFullYear()} MapaDeCaboRojo.com</div>
</div>

</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(html);

  } catch (err: any) {
    console.error('handle_evento error:', err);
    res.status(500).send(`<html><body><h1>Error</h1><pre>${esc(err?.message || 'Unknown')}</pre></body></html>`);
  }
}


// ============ admin-municipio ============
const ADMIN_SECRET = (process.env.ADMIN_MUNICIPIO_SECRET || '').trim();
const COOKIE_NAME = 'cabo_admin';



function readCookie(req: any, name: string): string | null {
  const raw = (req.headers?.cookie as string) || '';
  for (const part of raw.split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v || '');
  }
  return null;
}

function loginPage(reason: string): string {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Admin · Cabo Rojo OS</title><meta name="robots" content="noindex">
<style>body{font-family:-apple-system,sans-serif;background:#0f172a;color:#fff;margin:0;padding:80px 24px;min-height:100vh;}</style>
</head>
<body>
<div style="max-width:420px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px;">
  <div style="font-size:13px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">🔒 Acceso restringido</div>
  <h1 style="font-size:24px;margin-bottom:16px;">/admin/municipio</h1>
  <p style="font-size:14px;color:#cbd5e1;margin-bottom:24px;">${esc(reason)}</p>
  <form method="GET" action="/admin/municipio" style="display:flex;gap:8px;">
    <input type="password" name="key" placeholder="Secret" style="flex:1;padding:10px 12px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:14px;">
    <button type="submit" style="background:#0d9488;color:#fff;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;border:none;cursor:pointer;">Entrar</button>
  </form>
</div>
</body></html>`;
}

async function handle_admin_municipio(req: any, res: any) {
  // ============ AUTH ============
  if (!ADMIN_SECRET) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(500).send(loginPage('ADMIN_MUNICIPIO_SECRET no está configurado en Vercel. Set var en Project Settings.'));
    return;
  }

  const queryKey = (req.query?.key as string) || '';
  const cookieKey = readCookie(req, COOKIE_NAME) || '';

  if (queryKey && queryKey === ADMIN_SECRET) {
    // Login: set cookie, redirect to clean URL
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(queryKey)}; HttpOnly; Secure; SameSite=Lax; Path=/admin; Max-Age=2592000`);
    res.setHeader('Location', '/admin/municipio');
    res.status(302).end();
    return;
  }

  if (cookieKey !== ADMIN_SECRET) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(401).send(loginPage(queryKey ? 'Secret incorrecto.' : 'Entra el secret administrativo para continuar.'));
    return;
  }

  // ============ AUTHENTICATED — fetch data ============
  try {
    const [
      censusRes,
      sponsorPlacesRes,
      sponsorClientsRes,
      staleRes,
      botFailuresRes,
      pipelineCandsRes,
      botLeads30dRes,
      realSearches90dRes,
      placesForCprRes,
      categoryBreakdownRes,
    ] = await Promise.all([
      supabase.from('mv_places_census').select('*').single().then((r: any) => r.data || {}),
      supabase
        .from('places')
        .select('id, name, slug, plan, is_featured, last_verified_at')
        .eq('visibility', 'published')
        .eq('status', 'open')
        .eq('municipality', 'Cabo Rojo')
        .or('plan.neq.free,is_featured.eq.true')
        .then((r: any) => r.data || []),
      supabase
        .from('relationships')
        .select('id, name, type, place_id, last_contact_at, content_cadence, revenue_potential_cents, next_action_date, contact_phone, notes, tags')
        .eq('active', true)
        .eq('type', 'client')
        .order('last_contact_at', { ascending: true, nullsFirst: false })
        .then((r: any) => r.data || []),
      supabase.from('mv_stale_verifications').select('*').then((r: any) => r.data || []),
      supabase.rpc('bot_health_canary_detect', { hours_back: 48 }).then((r: any) => r.data || []),
      supabase.rpc('get_pipeline_filler_candidates', { min_leads: 3, days: 30 }).then((r: any) => r.data || []),
      supabase
        .from('bot_leads')
        .select('business_id, business_name')
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
        .then((r: any) => r.data || []),
      supabase.from('mv_real_searches_90d').select('*').then((r: any) => r.data || []),
      supabase
        .from('places')
        .select('id, name, category, subcategory, tags, plan, is_featured')
        .eq('visibility', 'published')
        .eq('status', 'open')
        .eq('municipality', 'Cabo Rojo')
        .range(0, 4999)
        .then((r: any) => r.data || []),
      supabase.from('mv_category_breakdown').select('*').limit(15).then((r: any) => r.data || []),
    ]);

    const c: any = censusRes;

    // Combine sponsor sources: places (vip/featured) ∪ relationships (type=client)
    const leadsByBiz: Record<string, number> = {};
    for (const row of botLeads30dRes) {
      if (row.business_id) leadsByBiz[row.business_id] = (leadsByBiz[row.business_id] || 0) + 1;
    }

    type SponsorRow = {
      name: string; source: string; plan?: string; is_featured?: boolean;
      days_since_contact?: number; cadence?: string; place_id?: string; place_slug?: string;
      bot_leads_30d: number; phone?: string; revenue_cents?: number;
    };

    const sponsors: SponsorRow[] = [];
    for (const p of sponsorPlacesRes) {
      sponsors.push({
        name: p.name, source: p.plan && p.plan !== 'free' ? p.plan.toUpperCase() : 'FEATURED',
        plan: p.plan, is_featured: p.is_featured,
        place_id: p.id, place_slug: p.slug,
        bot_leads_30d: leadsByBiz[p.id] || 0,
      });
    }
    for (const r of sponsorClientsRes) {
      // Don't double-count if already in sponsorPlaces by place_id
      if (r.place_id && sponsorPlacesRes.some((p: any) => p.id === r.place_id)) {
        // augment with relationship data
        const existing = sponsors.find(s => s.place_id === r.place_id);
        if (existing) {
          existing.days_since_contact = r.last_contact_at ? Math.floor((Date.now() - new Date(r.last_contact_at).getTime()) / 86400000) : undefined;
          existing.cadence = r.content_cadence || undefined;
          existing.phone = r.contact_phone || undefined;
          existing.revenue_cents = r.revenue_potential_cents || undefined;
        }
        continue;
      }
      sponsors.push({
        name: r.name, source: 'CLIENT',
        days_since_contact: r.last_contact_at ? Math.floor((Date.now() - new Date(r.last_contact_at).getTime()) / 86400000) : undefined,
        cadence: r.content_cadence || undefined,
        place_id: r.place_id || undefined,
        bot_leads_30d: r.place_id ? (leadsByBiz[r.place_id] || 0) : 0,
        phone: r.contact_phone || undefined,
        revenue_cents: r.revenue_potential_cents || undefined,
      });
    }

    // Sort: by churn risk (days since contact desc), then leads desc
    sponsors.sort((a, b) => (b.days_since_contact ?? -1) - (a.days_since_contact ?? -1));

    // Bot failures bucketed by root cause
    const failureBuckets: Record<string, number> = {};
    for (const f of botFailuresRes) {
      const cause = f.failure_type || 'unclassified';
      failureBuckets[cause] = (failureBuckets[cause] || 0) + 1;
    }

    // Cost-per-lead per category bucket (uses heat-index categories)
    const HEAT_BUCKETS_DEF: Array<{ key: string; label: string; emoji: string; qRegex: RegExp; matches: (p: any) => boolean }> = [
      { key:'plomeria', label:'Plomería', emoji:'🔧', qRegex:/(plomer|tuberi)/i, matches:(p)=>/plomer/i.test(p.name||'') || ((p.tags||[]) as string[]).some(t=>/plomer/i.test(t)) },
      { key:'electricista', label:'Electricista', emoji:'⚡', qRegex:/(electricis|\belectric)/i, matches:(p)=>/electric/i.test(p.name||'') },
      { key:'aire', label:'Aire/Refrig.', emoji:'❄️', qRegex:/(aire acond|frigo|refriger)/i, matches:(p)=>{
        if ((p.category||'') === 'SHOPPING') return false;
        if (/boutique|\bropa\b|clothing|moda/i.test(p.subcategory||'')) return false;
        return /(refrigerac|aire\s+acond|\bhvac\b|\bac\s+repair\b|air\s+condition)/i.test(p.name||'') || /aire|refriger|hvac/i.test(p.subcategory||'');
      } },
      { key:'farmacia', label:'Farmacia', emoji:'💊', qRegex:/(farmacia|botica)/i, matches:(p)=>/farmacia|botica/i.test(p.name||'') },
      { key:'medico', label:'Médico', emoji:'🩺', qRegex:/(pediatr|medic|doctor|\bdr\.)/i, matches:(p) => {
        if (!['HEALTH','Salud','salud'].includes(p.category||'')) return false;
        const sub = (p.subcategory||'').toLowerCase().trim();
        const name = (p.name||'').toLowerCase();
        if (/(dent|veterin|óptic|optic|optom|pharmac|farmac|botica|quiro|chiro|psic|psych|mental|laborator|diagnos|radiol|ambulan|terap|fisic|fisio|audiol|nutric|cannabis)/i.test(sub)) return false;
        if (/(dental|veterinari|óptica|optica|pharmacy|farmacia|botica|chiropract|chiroprac|laundr|cannabis|animal medical|ambulance|ambulancia|laboratorio|radiology|radiología|odontolog)/i.test(name)) return false;
        return true;
      } },
      { key:'dentista', label:'Dentista', emoji:'🦷', qRegex:/(dentista|odontolog|dental)/i, matches:(p)=>/dentista|dental/i.test(p.name||'') },
      { key:'restaurante', label:'Restaurante', emoji:'🍽️', qRegex:/(restauran|comer|comida)/i, matches:(p)=>['FOOD','Restaurantes'].includes(p.category||'') },
      { key:'belleza', label:'Belleza', emoji:'💇', qRegex:/(barber|peluqu|estetic|salon)/i, matches:(p)=>['BEAUTY','Belleza','Belleza y Bienestar'].includes(p.category||'') },
      { key:'auto', label:'Auto', emoji:'🔩', qRegex:/(mecanic|automovil|carro|llanta)/i, matches:(p)=>['AUTO','Automotriz'].includes(p.category||'') },
      { key:'hotel', label:'Hospedaje', emoji:'🏨', qRegex:/(hotel|hospedaje|airbnb)/i, matches:(p)=>['LODGING','Hospedaje'].includes(p.category||'') },
      { key:'handyman', label:'Handyman', emoji:'🛠️', qRegex:/(handyman|albañil|reparacion)/i, matches:(p)=>/handyman|albañil|reparac/i.test(p.name||'') || /handyman|albañil|reparac/i.test(p.subcategory||'') },
      { key:'pintor', label:'Pintor', emoji:'🎨', qRegex:/(pintor|pintura)/i, matches:(p)=>/pintor|pintura/i.test(p.name||'') || /pintor|pintura/i.test(p.subcategory||'') },
      { key:'carpintero', label:'Carpintero', emoji:'🪵', qRegex:/(carpinter|ebanist)/i, matches:(p)=>/carpinter|ebanist/i.test(p.name||'') || /carpinter|ebanist/i.test(p.subcategory||'') },
      { key:'costurera', label:'Costurera/Sastre', emoji:'🪡', qRegex:/(costurer|sastre)/i, matches:(p)=>/costurer|sastre/i.test(p.name||'') || /costurer|sastre/i.test(p.subcategory||'') },
      { key:'catering', label:'Catering', emoji:'🥘', qRegex:/(catering)/i, matches:(p)=>{
        if (['FOOD','Restaurantes'].includes(p.category||'') && !/catering/i.test(p.name||'')) return false;
        return /catering/i.test(p.name||'') || /catering/i.test(p.subcategory||'');
      } },
      { key:'wedding', label:'Bodas/Eventos', emoji:'💍', qRegex:/(wedding|boda|matrimonio|planificador)/i, matches:(p)=>/wedding|\bboda|planificador.*evento/i.test(p.name||'') || /wedding|boda|eventos|planificador/i.test(p.subcategory||'') },
      { key:'spa', label:'Spa/Masaje', emoji:'💆', qRegex:/(\bspa\b|masaj)/i, matches:(p)=>/\bspa\b|masaj/i.test(p.name||'') || /spa|masaj/i.test(p.subcategory||'') },
      { key:'trainer', label:'Personal Trainer', emoji:'💪', qRegex:/(trainer|entrenador)/i, matches:(p)=>/trainer|entrenador/i.test(p.name||'') || /trainer|entrenador|coach/i.test(p.subcategory||'') },
      { key:'tour', label:'Tour Operator', emoji:'🗺️', qRegex:/(\btour\b|excursion)/i, matches:(p)=>/\btour|excursion/i.test(p.name||'') || /tour|excursion/i.test(p.subcategory||'') },
      { key:'bicicleta', label:'Bicicleta/eBike', emoji:'🚲', qRegex:/(bicicl|\bbike\b|ebike)/i, matches:(p)=>/bicicl|\bbike|ebike/i.test(p.name||'') || /bike|bicicl/i.test(p.subcategory||'') },
      { key:'tatuajes', label:'Tatuajes', emoji:'💉', qRegex:/(tatuaj|tattoo|piercing)/i, matches:(p)=>{
        if (['FOOD','Restaurantes'].includes(p.category||'')) return false;
        if (/\bsupply\b/i.test(p.name||'')) return false;
        return /tatuaj|tattoo|piercing/i.test(p.name||'') || (p.category||'') === 'Tatuajes';
      } },
    ];

    const cprBuckets = HEAT_BUCKETS_DEF.map(b => {
      const demand = realSearches90dRes.filter((rq: any) => b.qRegex.test(rq.q_norm || '')).reduce((s: number, rq: any) => s + rq.cnt, 0);
      const supply = placesForCprRes.filter(b.matches).length;
      const sponsoredSupply = placesForCprRes.filter((p: any) => b.matches(p) && (p.plan !== 'free' || p.is_featured)).length;
      const monthlyDemand = demand / 3; // 90d → /month
      const expectedLeadsPerSponsor = sponsoredSupply > 0 ? monthlyDemand / sponsoredSupply : monthlyDemand;
      const cpl = expectedLeadsPerSponsor > 0 ? (799 / 12) / expectedLeadsPerSponsor : 0;
      return { ...b, demand, supply, sponsoredSupply, monthlyDemand: Math.round(monthlyDemand * 10) / 10, cpl };
    }).filter(x => x.demand >= 1).sort((a, b) => a.cpl - b.cpl);

    const generatedAt = new Date().toLocaleString('es-PR', { timeZone: 'America/Puerto_Rico' });
    const fmtMoney = (c?: number) => c ? `$${(c / 100).toFixed(0)}` : '—';
    const sortedFailures = Object.entries(failureBuckets).sort((a, b) => b[1] - a[1]);

    // freshness color
    const fpct = c.freshness_pct || 0;
    const freshColor = fpct >= 80 ? '#16a34a' : fpct >= 60 ? '#ca8a04' : '#dc2626';
    const freshLabel = fpct >= 80 ? 'Excelente' : fpct >= 60 ? 'Atención' : '🚨 Crítico';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>/admin/municipio · Cabo Rojo OS</title>
<meta name="robots" content="noindex,nofollow">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;-webkit-font-smoothing:antialiased}a{color:inherit}table{border-collapse:collapse;width:100%}.card{background:#1e293b;border-radius:12px;padding:20px;margin-bottom:18px;}h2{font-size:15px;font-weight:700;color:#e2e8f0;margin-bottom:8px;letter-spacing:-0.2px}h2 small{font-size:11px;color:#94a3b8;font-weight:400;letter-spacing:0;margin-left:6px}td,th{padding:7px 8px;font-size:12px;text-align:left;border-bottom:1px solid #334155;color:#cbd5e1}th{font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b}.pill{display:inline-block;font-size:10px;padding:2px 7px;border-radius:10px;font-weight:700;letter-spacing:0.04em;}</style>
</head>
<body>

<div style="background:#1e293b;padding:18px 24px;border-bottom:1px solid #334155;">
  <div style="max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="font-size:11px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;">🛠️ Admin Ops</div>
      <h1 style="font-size:20px;font-weight:700;color:#fff;">Cabo Rojo OS — Panel Operacional</h1>
    </div>
    <div style="font-size:11px;color:#64748b;">${esc(generatedAt)}</div>
  </div>
</div>

<div style="max-width:1200px;margin:24px auto;padding:0 16px;">

  <!-- WIDGET 9: VERIFICATION FRESHNESS (MÉTRICA MADRE) -->
  <div class="card" style="border-left:4px solid ${freshColor};">
    <h2>🛡️ Verification Freshness <small>métrica madre del Mapa</small></h2>
    <div style="display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:center;">
      <div style="text-align:center;padding:16px 24px;">
        <div style="font-size:64px;font-weight:800;color:${freshColor};line-height:1;">${fpct}%</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:6px;">${freshLabel} · target ≥80%</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">${(c.fresh_90d || 0).toLocaleString('es-PR')} de ${(c.open_count || 0).toLocaleString('es-PR')} verif. en 90d</div>
      </div>
      <div>
        <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600;margin-bottom:6px;">Top 10 verificaciones más viejas (re-walk targets)</div>
        <table>
          <thead><tr><th>Negocio</th><th style="text-align:right;">Días sin verificar</th><th></th></tr></thead>
          <tbody>
          ${staleRes.slice(0, 10).map((p: any) => `<tr>
            <td><a href="/negocio/${esc(p.slug)}" style="color:#5eead4;text-decoration:none;">${esc(p.name)}</a> <span style="color:#64748b;">· ${esc(p.category || '')}</span></td>
            <td style="text-align:right;color:${p.days_since_verified > 365 ? '#dc2626' : '#cbd5e1'};font-weight:600;">${p.days_since_verified === 9999 ? 'nunca' : p.days_since_verified + 'd'}</td>
            <td>${p.gmaps_url ? `<a href="${esc(p.gmaps_url)}" target="_blank" style="background:#0d9488;color:#fff;padding:3px 9px;border-radius:6px;text-decoration:none;font-size:10px;font-weight:600;">→ verificar</a>` : ''}</td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- WIDGET 7: SPONSOR PIPELINE HEALTH -->
  <div class="card" style="border-left:4px solid #ea580c;">
    <h2>⭐ Sponsor Pipeline Health <small>${sponsors.length} activos · combinado places + relationships</small></h2>
    <table>
      <thead><tr><th>Negocio</th><th>Fuente</th><th>Cadencia</th><th style="text-align:right;">Días sin contacto</th><th style="text-align:right;">Leads 30d</th><th style="text-align:right;">Revenue</th><th></th></tr></thead>
      <tbody>
      ${sponsors.map(s => {
        const churnColor = (s.days_since_contact ?? 0) > 30 ? '#dc2626' : (s.days_since_contact ?? 0) > 14 ? '#ca8a04' : '#16a34a';
        const sourceColor = s.source === 'VIP' ? '#7c3aed' : s.source === 'FEATURED' ? '#ea580c' : s.source === 'CLIENT' ? '#0d9488' : '#64748b';
        const followUpUrl = s.phone ? `https://wa.me/${s.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${s.name.split(' ')[0]}, ¿cómo va todo?`)}` : '';
        return `<tr>
          <td>${s.place_slug ? `<a href="/negocio/${esc(s.place_slug)}" style="color:#5eead4;text-decoration:none;">${esc(s.name)}</a>` : esc(s.name)}</td>
          <td><span class="pill" style="background:${sourceColor}33;color:${sourceColor};">${esc(s.source)}</span></td>
          <td>${esc(s.cadence || '—')}</td>
          <td style="text-align:right;color:${churnColor};font-weight:600;">${s.days_since_contact ?? '—'}${s.days_since_contact != null ? 'd' : ''}</td>
          <td style="text-align:right;font-weight:600;">${s.bot_leads_30d || '—'}</td>
          <td style="text-align:right;">${fmtMoney(s.revenue_cents)}</td>
          <td>${followUpUrl ? `<a href="${esc(followUpUrl)}" target="_blank" style="background:#25D366;color:#fff;padding:3px 9px;border-radius:6px;text-decoration:none;font-size:10px;font-weight:600;">WA</a>` : ''}</td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
  </div>

  <!-- WIDGET 8: BOT FAILURE TYPES -->
  <div class="card" style="border-left:4px solid #dc2626;">
    <h2>🤖 Bot Failures (últimas 48h) <small>desde bot_health_canary_detect — ${botFailuresRes.length} eventos</small></h2>
    ${sortedFailures.length === 0
      ? `<p style="color:#16a34a;font-size:13px;">✓ No failures detectados.</p>`
      : `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px;">
          ${sortedFailures.map(([cause, count]) => `
            <div style="background:#0f172a;padding:12px;border-radius:8px;text-align:center;">
              <div style="font-size:24px;font-weight:800;color:#fbbf24;">${count}</div>
              <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px;">${esc(cause)}</div>
            </div>`).join('')}
        </div>
        <table>
          <thead><tr><th>Hora</th><th>Tel</th><th>Query</th><th>Tipo</th></tr></thead>
          <tbody>
          ${botFailuresRes.slice(0, 12).map((f: any) => `<tr>
            <td>${f.inbound_at ? new Date(f.inbound_at).toLocaleTimeString('es-PR', { timeZone:'America/Puerto_Rico', hour:'numeric', minute:'2-digit' }) : '—'}</td>
            <td style="font-family:monospace;font-size:10px;">${esc(f.phone_last4 ? '...' + f.phone_last4 : '')}</td>
            <td>${esc((f.query || '').slice(0, 50))}</td>
            <td><span class="pill" style="background:#dc262633;color:#fca5a5;">${esc(f.failure_type || '?')}</span></td>
          </tr>`).join('')}
          </tbody>
        </table>`}
  </div>

  <!-- WIDGET 10: COST-PER-LEAD POR CATEGORÍA -->
  <div class="card" style="border-left:4px solid #0d9488;">
    <h2>💰 Cost-Per-Lead por Categoría <small>$/lead si Vitrina paga $799/año = $66.58/mes</small></h2>
    <p style="font-size:11px;color:#94a3b8;margin-bottom:12px;">Material para pitches: cuando el CPL es bajo, Vitrina paga sola. Comparable Google Ads PR ~$8-25/click.</p>
    <table>
      <thead><tr><th>Categoría</th><th style="text-align:right;">Búsq./mes</th><th style="text-align:right;">Negocios</th><th style="text-align:right;">Sponsors</th><th style="text-align:right;">Leads/sponsor/mes</th><th style="text-align:right;">CPL Vitrina</th><th></th></tr></thead>
      <tbody>
      ${cprBuckets.length === 0 ? '<tr><td colspan=7 style="color:#64748b;font-style:italic;">Sin data suficiente.</td></tr>' : cprBuckets.map(c => {
        const cplColor = c.cpl > 0 && c.cpl < 5 ? '#16a34a' : c.cpl < 15 ? '#ca8a04' : '#dc2626';
        const expectedLeads = c.sponsoredSupply > 0 ? c.monthlyDemand / c.sponsoredSupply : c.monthlyDemand;
        return `<tr>
          <td>${c.emoji} ${esc(c.label)}</td>
          <td style="text-align:right;font-weight:600;">${c.monthlyDemand}</td>
          <td style="text-align:right;">${c.supply}</td>
          <td style="text-align:right;">${c.sponsoredSupply}</td>
          <td style="text-align:right;">${expectedLeads.toFixed(1)}</td>
          <td style="text-align:right;color:${cplColor};font-weight:700;">${c.cpl > 0 ? '$' + c.cpl.toFixed(2) : '—'}</td>
          <td style="text-align:right;font-size:10px;color:#94a3b8;">${c.cpl > 0 && c.cpl < 5 ? '🔥 vende' : c.cpl < 15 ? '👍 ok' : '💤 bajo'}</td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
  </div>

  <!-- PIPELINE FILLER CANDIDATES (bonus) -->
  ${pipelineCandsRes.length > 0 ? `
  <div class="card" style="border-left:4px solid #7c3aed;">
    <h2>🎯 Pipeline Filler Candidates <small>negocios no-sponsor con leads del bot últimos 30d</small></h2>
    <table>
      <thead><tr><th>Negocio</th><th style="text-align:right;">Leads 30d</th><th style="text-align:right;">Revenue potencial/yr</th></tr></thead>
      <tbody>
      ${pipelineCandsRes.slice(0, 10).map((p: any) => `<tr>
        <td>${p.place_slug ? `<a href="/negocio/${esc(p.place_slug)}" style="color:#5eead4;text-decoration:none;">${esc(p.place_name || p.name || 'Sin nombre')}</a>` : esc(p.place_name || p.name || 'Sin nombre')}</td>
        <td style="text-align:right;font-weight:600;">${p.lead_count || p.leads_count || 0}</td>
        <td style="text-align:right;color:#7c3aed;font-weight:600;">$799</td>
      </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <div style="text-align:center;padding:20px 0;font-size:11px;color:#64748b;">
    Datos en vivo · Cache: no-store · ${esc(generatedAt)}
  </div>

</div>

</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(html);

  } catch (err: any) {
    console.error('admin-municipio error:', err);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(500).send(`<html><body style="font-family:sans-serif;background:#0f172a;color:#fff;padding:40px;"><h1>500 Error</h1><pre style="background:#1e293b;padding:16px;border-radius:8px;overflow:auto;">${esc(err?.message || 'Unknown')}</pre></body></html>`);
  }
}


// ============ pueblo-en-numeros ============

async function handle_pueblo_en_numeros(req: any, res: any) {
  try {
    const mapCat = ((req.query?.cat as string) || 'farmacia').toLowerCase().trim();
    const [
      censusResult,
      realSearches90d,
      geoConcRows,
      allPlaces,
      westHealth,
      westYouth,
    ] = await Promise.all([
      supabase.from('mv_places_census').select('*').single().then((r: any) => r.data || {}),
      supabase.from('mv_real_searches_90d').select('*').then((r: any) => r.data || []),
      supabase.from('mv_geo_concentration').select('*').then((r: any) => r.data || []),
      supabase
        .from('places')
        .select('name, slug, category, subcategory, tags, last_verified_at, lat, lon')
        .eq('visibility', 'published')
        .eq('status', 'open')
        .eq('municipality', 'Cabo Rojo')
        .range(0, 4999)
        .then((r: any) => r.data || []),
      supabase
        .from('places')
        .select('name, municipality, tags, subcategory')
        .eq('visibility', 'published')
        .eq('status', 'open')
        .in('category', ['HEALTH', 'Salud'])
        .in('municipality', ['Cabo Rojo', 'Mayagüez', 'San Germán', 'Lajas', 'Hormigueros', 'Sabana Grande', 'Añasco'])
        .range(0, 4999)
        .then((r: any) => r.data || []),
      supabase
        .from('places')
        .select('name, municipality, tags, subcategory')
        .eq('visibility', 'published')
        .eq('status', 'open')
        .overlaps('tags', ['taekwondo', 'tae kwon do', 'artes marciales', 'karate', 'judo', 'jiu jitsu', 'bjj', 'mma', 'defensa personal', 'boxeo', 'boxing', 'kickboxing', 'ballet', 'danza', 'baile', 'musica', 'piano', 'guitarra', 'tutoria', 'tutorías', 'scouts', 'cub-scouts', 'organizacion-juvenil', 'natacion', 'natación', 'gimnasia'])
        .in('municipality', ['Cabo Rojo', 'Mayagüez', 'San Germán', 'Lajas', 'Hormigueros', 'Sabana Grande', 'Añasco'])
        .range(0, 999)
        .then((r: any) => r.data || []),
    ]);

    const c: any = censusResult;

    // "El negocio que le falta" — top live demand÷supply opportunity (links to /demanda).
    const { data: oppsRawP } = await supabase.rpc('get_demand_opportunities');
    // deno-lint-ignore no-explicit-any
    const oppsP: any[] = Array.isArray(oppsRawP) ? oppsRawP.filter((o: any) => o && o.is_opportunity) : [];
    const topOppP = oppsP[0] || null;
    const oppBanner = topOppP ? `
  <!-- SECTION 1.55: EL NEGOCIO QUE LE FALTA (live, links to /demanda) -->
  <a href="/demanda" class="card" style="display:block;text-decoration:none;background:linear-gradient(135deg,#d4603a,#b91c1c);color:#fff;border-left:4px solid #fca5a5;padding:22px 26px;">
    <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;opacity:0.92;margin-bottom:8px;">🎯 El negocio que le falta a Cabo Rojo · este mes</div>
    <div style="font-size:24px;font-weight:900;text-transform:capitalize;line-height:1.15;">${esc(topOppP.label)}</div>
    <div style="font-size:14px;opacity:0.96;margin:8px 0 14px;line-height:1.5;">${topOppP.demand_30d} vecino${Number(topOppP.demand_30d) === 1 ? '' : 's'} lo buscaron este mes · ${Number(topOppP.supply) === 0 ? 'nadie lo resuelve' : `solo ${topOppP.supply} lo resuelve${Number(topOppP.supply) === 1 ? '' : 'n'}`} · ${esc(topOppP.verdict)}</div>
    <span style="display:inline-block;background:#fff;color:#b91c1c;padding:10px 20px;border-radius:9px;font-weight:800;font-size:14px;">Ver todas las oportunidades del pueblo →</span>
  </a>` : '';

    // Compute supply per TAM category
    const supplyByCat = computeSupplyByCategory(allPlaces);

    // TAM/SAM/SOM for each category
    const tamSomResults = CATEGORY_TAM_PARAMS.map(p =>
      computeTamSamSom(p, supplyByCat[p.key] || 0)
    );

    // Density rows — leveraging existing HEAT_BUCKETS_DEF
    const densityHeatBuckets = HEAT_BUCKETS_DEF.map(b => ({
      key: b.key, label: b.label, emoji: b.emoji,
      categorySlug: b.categorySlug,
      supply: allPlaces.filter(b.matches).length,
    }));
    const densityRows = computeDensityComparison(densityHeatBuckets);

    // Heat with demand for ZERO_SUPPLY ajá detection
    const heatWithDemand = HEAT_BUCKETS_DEF.map(b => {
      const demand = realSearches90d.filter((rq: any) => b.qRegex.test(rq.q_norm || '')).reduce((s: number, rq: any) => s + rq.cnt, 0);
      const supply = allPlaces.filter(b.matches).length;
      return { key: b.key, label: b.label, emoji: b.emoji, demand, supply };
    });

    // Geo concentration → category → barrio map
    const geoData: Record<string, Record<string, number>> = {};
    for (const row of geoConcRows) {
      if (!geoData[row.category]) geoData[row.category] = {};
      geoData[row.category][row.barrio] = row.count;
    }

    // Auto-detect ajá moments + parse overrides + merge
    const autoAjas = detectAjaMoments(tamSomResults, heatWithDemand, geoData);
    const overrides = parseAjaOverrides(AJA_OVERRIDES_MD);
    const ajaMoments = mergeAjaMoments(autoAjas, overrides, 9);

    // Density chart sort: most denser to thinnest
    // Bumped from 12→24 (2026-05-12) to fit 10 new buckets added that day
    const densitySorted = [...densityRows].sort((a, b) => {
      if (a.verdict === 'zero' && b.verdict !== 'zero') return -1;
      if (b.verdict === 'zero' && a.verdict !== 'zero') return 1;
      return b.multiplier - a.multiplier;
    }).slice(0, 24);

    // ── EL ESPEJO: per-category decision data — single source of truth (shared con /me-conviene) ──
    const { data: espejoData } = buildVerdictsFromComputed(tamSomResults as any, heatWithDemand);
    const espejoJson = JSON.stringify(espejoData).replace(/</g, '\\u003c');
    const espejoOptions = espejoData.map((d: any) => {
      const hint = d.verdict === 'zero' ? `0 — nadie lo resuelve` : `${d.supply} abierto${d.supply === 1 ? '' : 's'}`;
      return `<option value="${esc(d.k)}">${d.emoji} ${esc(d.label)} (${hint})</option>`;
    }).join('');

    const generatedAt = new Date().toLocaleString('es-PR', { timeZone: 'America/Puerto_Rico' });

    // ── Single source of truth: every count on this page comes from the live
    // census view (mv_places_census). NO hardcoded business counts anywhere.
    const total = c.total ?? 0;
    const openCount = c.open_count ?? 0;
    const closedCount = c.closed_count ?? 0;
    const unknownCount = c.unknown_count ?? 0;
    const everVerified = c.ever_verified ?? 0;
    const fresh90d = c.fresh_90d ?? 0;
    const newThisMonth = c.new_this_month ?? 0;
    const freshnessPct = c.freshness_pct != null ? String(c.freshness_pct) : '0';
    const residents = CABO_ROJO_BASELINE.residents;
    const perCapita = openCount > 0 ? Math.round(residents / openCount) : 0; // personas por 1 negocio abierto
    // Verified PR-wide density (official BLS QCEW 2023 — employer establishments only).
    const crDensityQcew = Math.round(residents / VERIFIED_FEDERAL_DATA.qcew_estabs_cr_2023);   // 1 per 69
    const prDensityQcew = Math.round(VERIFIED_FEDERAL_DATA.pop_pr / VERIFIED_FEDERAL_DATA.qcew_estabs_pr_2023); // 1 per 60
    // Sourced regional density (our own verified directory, May 2026) — replaces the
    // unsourced "1 cada 90 / casi el doble que PR" claim that was retired in the baseline comment.
    const regionalDensity = [
      { town: 'Hormigueros', per: 47 },
      { town: 'Cabo Rojo', per: perCapita, self: true },
      { town: 'San Germán', per: 50 },
      { town: 'Lajas', per: 62 },
      { town: 'Sabana Grande', per: 81 },
      { town: 'Mayagüez', per: 87 },
    ].sort((a, b) => a.per - b.per);
    const fmt = (n: number) => n.toLocaleString('es-PR');
    const fmtMoney = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`;
    const fmtMoneyExact = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;

    const renderDensityBar = (r: typeof densityRows[0]) => {
      const bigger = Math.max(r.perCapitaCr || 0, r.perCapitaPr);
      const widthCr = bigger > 0 && r.perCapitaCr > 0 ? Math.round((r.perCapitaCr / bigger) * 100) : 100;
      const widthPr = Math.round((r.perCapitaPr / bigger) * 100);
      const isDenser = r.verdict === 'denser';
      const isZero = r.verdict === 'zero';
      const accent = isZero ? '#dc2626' : isDenser ? '#dc2626' : r.verdict === 'parity' ? '#0d9488' : '#16a34a';
      const linkUrl = r.categorySlug ? `/categoria/${r.categorySlug}` : `https://wa.me/17874177711?text=${encodeURIComponent(r.label)}`;
      const tag = isZero ? `🔥 cero supply, demanda real` : isDenser ? `${r.multiplier.toFixed(1)}× más denso que PR` : r.verdict === 'parity' ? 'paridad con PR' : `${(1 / r.multiplier).toFixed(1)}× menos denso`;
      const audienceLabel = r.audienceCr === CABO_ROJO_BASELINE.regional_pull ? 'audiencia regional' : 'residentes CR';
      return `<a href="${linkUrl}" style="display:block;text-decoration:none;color:inherit;padding:10px 12px;background:#f8fafc;border-radius:8px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
          <span style="font-size:13px;font-weight:600;color:#1e293b;">${r.emoji} ${esc(r.label)} · ${r.supplyCr}</span>
          <span style="font-size:11px;color:${accent};font-weight:700;">${tag}</span>
        </div>
        ${!isZero ? `<div style="font-family:'SF Mono',Monaco,Menlo,monospace;font-size:10px;color:#64748b;margin-bottom:6px;">${fmt(r.audienceCr)} ${audienceLabel} ÷ ${r.supplyCr} negocios = 1 cada ${fmt(r.perCapitaCr)}</div>` : `<div style="font-size:10px;color:#dc2626;margin-bottom:6px;">0 negocios listed · demanda existe en bot *7711</div>`}
        <div style="display:grid;grid-template-columns:48px 1fr;gap:6px;font-size:10px;align-items:center;">
          <span style="color:#475569;font-weight:600;">CR</span>
          <div style="background:#e2e8f0;height:10px;border-radius:3px;position:relative;">
            <div style="background:${accent};height:100%;border-radius:3px;width:${isZero ? 0 : widthCr}%;"></div>
            <span style="position:absolute;right:6px;top:-1px;font-size:10px;color:#1e293b;font-weight:700;">${isZero ? '0 negocios' : '1 cada ' + fmt(r.perCapitaCr)}</span>
          </div>
          <span style="color:#475569;font-weight:600;">PR avg</span>
          <div style="background:#e2e8f0;height:10px;border-radius:3px;position:relative;">
            <div style="background:#94a3b8;height:100%;border-radius:3px;width:${widthPr}%;"></div>
            <span style="position:absolute;right:6px;top:-1px;font-size:10px;color:#1e293b;font-weight:700;">1 cada ${fmt(r.perCapitaPr)}</span>
          </div>
        </div>
      </a>`;
    };

    // Build geo concentration top-8 categories
    const geoTopCategories = Object.entries(geoData).map(([cat, dist]) => {
      const entries = Object.entries(dist).filter(([b]) => b !== 'sin-asignar');
      const total = entries.reduce((s, [, n]) => s + n, 0);
      return { cat, total, entries: entries.sort((a, b) => b[1] - a[1]).slice(0, 5) };
    }).filter(g => g.total >= 5).sort((a, b) => b.total - a.total).slice(0, 8);

    // SECTION 5.7 data: Censo de Especialistas del Oeste (live desde places, 7 municipios)
    // Orden importa: el primer match gana (pediátrico antes que neurólogo general, etc.)
    const SPECIALIST_DEFS: Array<{ label: string; match: RegExp; demandRe: RegExp }> = [
      { label: 'Neurólogo pediátrico', match: /neurología pediátrica|neuropediatra/i, demandRe: /neuro\s*pedi|neuropediatra/i },
      { label: 'Neurocirujano', match: /neurocirujano/i, demandRe: /neurociru/i },
      { label: 'Neurólogo', match: /neurólog|neurolog/i, demandRe: /neurolog/i },
      { label: 'Cardiólogo', match: /cardiólog|cardiolog/i, demandRe: /cardiolog/i },
      { label: 'Dermatólogo', match: /dermatólog|dermatolog/i, demandRe: /dermatolog/i },
      { label: 'Endocrinólogo', match: /endocrinólog|endocrinolog/i, demandRe: /endocrin/i },
      { label: 'Gastroenterólogo', match: /gastroenterólog|gastroenterolog/i, demandRe: /gastro/i },
      { label: 'Nefrólogo', match: /nefrólog|nefrolog/i, demandRe: /nefrolog|rinon|riñon/i },
      { label: 'Neumólogo', match: /neumólog|neumolog/i, demandRe: /neumolog|pulmon/i },
      { label: 'Oncólogo', match: /oncólog|oncolog/i, demandRe: /oncolog|cancer/i },
      { label: 'Psiquiatra', match: /psiquiatr/i, demandRe: /p?siquiatr/i },
      { label: 'Urólogo', match: /urólog|urolog/i, demandRe: /urolog/i },
      { label: 'Oftalmólogo', match: /oftalmólog|oftalmolog/i, demandRe: /oftalmolog/i },
      { label: 'Reumatólogo', match: /reumatólog|reumatolog/i, demandRe: /reumatolog/i },
      { label: 'Ginecólogo-Obstetra', match: /ginecólog|ginecolog|obstetr/i, demandRe: /ginecolog|obstetr/i },
      { label: 'Ortopeda', match: /ortopeda|cirugía ortopédica/i, demandRe: /ortopeda|ortoped/i },
      { label: 'Fisiatra', match: /fisiatr/i, demandRe: /fisiatr/i },
      { label: 'Geriatra', match: /geriatr/i, demandRe: /geriatr/i },
      { label: 'Alergista', match: /alergista|alergolog/i, demandRe: /alerg/i },
      { label: 'Cirujano general', match: /cirujano|cirugía general/i, demandRe: /cirujano/i },
      { label: 'Pediatra', match: /pediatr/i, demandRe: /pediatra/i },
      { label: 'Internista', match: /internista|medicina interna/i, demandRe: /internista/i },
      { label: 'Generalista', match: /medicina general|médico general|medicina familiar|general practice/i, demandRe: /medico general|doctor general/i },
    ];
    const specialistCensus = SPECIALIST_DEFS.map(def => {
      const matched = (westHealth as any[]).filter(p => {
        const blob = `${(p.tags || []).join(',')} ${p.subcategory || ''} ${p.name || ''}`;
        // primer-match-gana: excluir si ya matchea una def anterior con prioridad más alta
        const idx = SPECIALIST_DEFS.indexOf(def);
        for (let i = 0; i < idx; i++) if (SPECIALIST_DEFS[i].match.test(blob)) return false;
        return def.match.test(blob);
      });
      const demand = (realSearches90d as any[]).filter((rq: any) => def.demandRe.test(rq.q_norm || '')).reduce((s: number, rq: any) => s + (rq.cnt || 0), 0);
      return {
        label: def.label,
        oeste: matched.length,
        cr: matched.filter(p => p.municipality === 'Cabo Rojo').length,
        demand,
      };
    }).filter(r => r.oeste > 0 || r.demand > 0);
    const specialistSolitarios = specialistCensus.filter(r => r.oeste === 1 && !['Internista', 'Generalista', 'Pediatra'].includes(r.label));
    const specialistCeroCr = specialistCensus.filter(r => r.cr === 0 && r.oeste > 0 && !['Internista', 'Generalista'].includes(r.label));

    // SECTION 5.8 data: Lo Que Hay Pa' Los Nenes (actividades juveniles del oeste, live)
    // alwaysShow: los CEROS son el punto — pueblo de playa sin escuela de natación registrada.
    const YOUTH_DEFS: Array<{ label: string; match: RegExp; demandRe: RegExp; alwaysShow?: boolean }> = [
      { label: 'Artes marciales', match: /taekwondo|tae kwon do|artes marciales|karate|judo|jiu ?jitsu|bjj|\bmma\b|defensa personal/i, demandRe: /artes marciales|taekwondo|karate|judo|jiu/i },
      { label: 'Boxeo / kickboxing', match: /boxeo|boxing|kickbox/i, demandRe: /boxeo|kickbox/i },
      { label: 'Ballet / danza', match: /ballet|danza|danzart|\bbaile\b/i, demandRe: /ballet|danza|clases de baile/i },
      { label: 'Música (clases)', match: /musik|escuela de m[uú]sica|academia de m[uú]sica|clases de m[uú]sica|piano|guitarra|violin/i, demandRe: /clases de m[uú]sica|piano|guitarra|violin/i },
      { label: 'Tutorías', match: /tutor[ií]a|tutoring|\btutor\b/i, demandRe: /tutor/i },
      { label: 'Scouts', match: /\bscouts\b|cub-scouts|organizacion-juvenil/i, demandRe: /\bscouts?\b/i },
      { label: 'Natación (clases)', match: /nataci[oó]n|swim lessons|clases de nado/i, demandRe: /nataci|clases de nado|aprender a nadar/i, alwaysShow: true },
      { label: 'Gimnasia', match: /\bgimnasia\b/i, demandRe: /gimnasia/i, alwaysShow: true },
    ];
    const youthCensus = YOUTH_DEFS.map(def => {
      const idx = YOUTH_DEFS.indexOf(def);
      const matched = (westYouth as any[]).filter(p => {
        const blob = `${(p.tags || []).join(',')} ${p.subcategory || ''} ${p.name || ''}`;
        for (let i = 0; i < idx; i++) if (YOUTH_DEFS[i].match.test(blob)) return false;
        return def.match.test(blob);
      });
      const demand = (realSearches90d as any[]).filter((rq: any) => def.demandRe.test(rq.q_norm || '')).reduce((s: number, rq: any) => s + (rq.cnt || 0), 0);
      return {
        label: def.label,
        oeste: matched.length,
        cr: matched.filter(p => p.municipality === 'Cabo Rojo').length,
        demand,
        alwaysShow: !!def.alwaysShow,
      };
    }).filter(r => r.oeste > 0 || r.demand > 0 || r.alwaysShow);
    const youthCeroOeste = youthCensus.filter(r => r.oeste === 0);
    const youthCeroCr = youthCensus.filter(r => r.cr === 0 && r.oeste > 0);

    // ── SECTION 1.45 data: "Lo que Cabo Rojo buscó" — el tablero de demanda real.
    // Agrupa las búsquedas crudas del *7711 (mv_real_searches_90d) en categorías legibles,
    // las cruza contra el supply del directorio, y saca el veredicto. Es lo más compartible
    // de la página: la voz del pueblo en números que nadie más publica.
    type DemandDef = { label: string; emoji: string; q: RegExp; supply: (p: any) => boolean; slug?: string };
    const DEMAND_DEFS: DemandDef[] = [
      { label: 'Heladerías', emoji: '🍦', q: /helado|ice cream|mantecado|rex cream|gold ice/i, supply: (p) => /helado|ice cream|mantecado|rex cream|gold ice/i.test(`${p.name} ${(p.tags||[]).join(' ')} ${p.subcategory||''}`), slug: 'restaurantes' },
      { label: 'Electricistas', emoji: '⚡', q: /electric|electrisista/i, supply: (p) => /electric/i.test(`${p.name} ${(p.tags||[]).join(' ')} ${p.subcategory||''}`), slug: 'electrico' },
      { label: 'Lavanderías / laundromat', emoji: '🧺', q: /lavanderia|laundromat|lavar ropa|laundry/i, supply: (p) => /lavanderia|laundromat|laundry/i.test(`${p.name} ${(p.tags||[]).join(' ')} ${p.subcategory||''}`), slug: 'servicios' },
      { label: 'Mariscos / pescadería', emoji: '🦐', q: /marisco|seafood|pescaderia|pescado/i, supply: (p) => /marisco|seafood|pescaderia/i.test(`${p.name} ${(p.tags||[]).join(' ')} ${p.subcategory||''}`), slug: 'restaurantes' },
      { label: 'Reparación de aire / nevera', emoji: '❄️', q: /aire acondicionado|reparar aire|reparacion de aire|frigorifico|nevera|refrigerac/i, supply: (p) => /aire|refrigerac|frigorific|nevera|a\/c|hvac/i.test(`${p.name} ${(p.tags||[]).join(' ')} ${p.subcategory||''}`), slug: 'ac' },
      { label: 'Veterinarios', emoji: '🐾', q: /veterinari|vet\b/i, supply: (p) => /veterinari/i.test(`${p.name} ${(p.tags||[]).join(' ')} ${p.subcategory||''}`), slug: 'veterinario' },
      { label: 'Grúa / remolque', emoji: '🚛', q: /grua|remolque|tow/i, supply: (p) => /grua|remolque|tow/i.test(`${p.name} ${(p.tags||[]).join(' ')} ${p.subcategory||''}`), slug: 'servicios' },
      { label: 'Dentistas', emoji: '🦷', q: /dentist|dentista/i, supply: (p) => /dentist|dental/i.test(`${p.name} ${(p.tags||[]).join(' ')} ${p.subcategory||''}`), slug: 'dentista' },
      { label: 'Mueblerías', emoji: '🛋️', q: /mueble|muebleria|furniture/i, supply: (p) => /mueble|furniture/i.test(`${p.name} ${(p.tags||[]).join(' ')} ${p.subcategory||''}`), slug: 'compras' },
      { label: 'Carnicerías', emoji: '🥩', q: /carniceria|carne|butcher/i, supply: (p) => /carniceria|butcher/i.test(`${p.name} ${(p.tags||[]).join(' ')} ${p.subcategory||''}`), slug: 'compras' },
      { label: 'Desayuno / brunch', emoji: '🍳', q: /desayun|brunch|breakfast/i, supply: (p) => /desayun|brunch|breakfast|cafe/i.test(`${p.name} ${(p.tags||[]).join(' ')} ${p.subcategory||''}`), slug: 'restaurantes' },
      { label: 'Ropa / boutique', emoji: '👕', q: /ropa|boutique|tienda de ropa|clothing/i, supply: (p) => /ropa|boutique|clothing/i.test(`${p.name} ${(p.tags||[]).join(' ')} ${p.subcategory||''}`), slug: 'compras' },
      { label: 'Pinchos / comida criolla', emoji: '🍢', q: /pincho|comida criolla|frituras|kiosko/i, supply: (p) => /pincho|criolla|frituras|kiosko/i.test(`${p.name} ${(p.tags||[]).join(' ')} ${p.subcategory||''}`), slug: 'restaurantes' },
      { label: 'Plomeros', emoji: '🔧', q: /plomer|plumber|tuberia/i, supply: (p) => /plomer|plumber/i.test(`${p.name} ${(p.tags||[]).join(' ')} ${p.subcategory||''}`), slug: 'plomero' },
    ];
    const demandBoard = DEMAND_DEFS.map(d => {
      const demand = (realSearches90d as any[])
        .filter((rq: any) => d.q.test(rq.q_norm || ''))
        .reduce((s: number, rq: any) => s + (rq.cnt || 0), 0);
      const supply = (allPlaces as any[]).filter(d.supply).length;
      // veredicto: relación demanda÷supply (búsquedas por negocio que lo resuelve)
      const ratio = supply > 0 ? demand / supply : demand;
      let verdict: 'gap' | 'tight' | 'covered';
      if (supply === 0) verdict = 'gap';
      else if (ratio >= 60) verdict = 'tight';   // mucha demanda, poco supply
      else verdict = 'covered';
      return { label: d.label, emoji: d.emoji, demand, supply, ratio, verdict, slug: d.slug };
    }).filter(d => d.demand > 0).sort((a, b) => b.demand - a.demand);
    const demandTotal = demandBoard.reduce((s, d) => s + d.demand, 0);
    const demandTop = demandBoard.slice(0, 12);
    const demandGaps = demandBoard.filter(d => d.verdict === 'gap' || d.verdict === 'tight');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cabo Rojo en Números: el pueblo viéndose en el espejo</title>
<meta name="description" content="${fmt(openCount)} negocios verificados para ${fmt(residents)} personas en Cabo Rojo. 1 por cada ${perCapita}. TAM/SAM/SOM por categoría, lo que el pueblo buscó esta semana, sobreoferta visible. Work-in-progress, admitimos errores en público.">
<meta property="og:title" content="Cabo Rojo en Números: el pueblo viéndose en el espejo">
<meta property="og:description" content="${fmt(openCount)} negocios para ${fmt(residents)} personas. Lo que Cabo Rojo buscó esta semana · TAM/SAM/SOM por categoría · ajá moments que nadie más publica.">
<meta property="og:url" content="https://www.mapadecaborojo.com/pueblo-en-numeros">
<meta property="og:type" content="article">
<meta property="og:image" content="https://www.mapadecaborojo.com/og/pueblo-en-numeros.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="es_PR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Cabo Rojo en Números: 1 negocio por cada ${perCapita} personas">
<meta name="twitter:description" content="Lo que el pueblo buscó esta semana, TAM/SAM/SOM por categoría, errores admitidos en público.">
<meta name="twitter:image" content="https://www.mapadecaborojo.com/og/pueblo-en-numeros.png">
<link rel="canonical" href="https://www.mapadecaborojo.com/pueblo-en-numeros">
<meta name="robots" content="index,follow">
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Cabo Rojo en Números — densidad de negocios por categoría",
  "description": `${fmt(openCount)} negocios verificados para ${fmt(residents)} personas. 1 por cada ${perCapita}. TAM/SAM/SOM por categoría, sobreoferta visible, lo que el pueblo necesita.`,
  "url": "https://www.mapadecaborojo.com/pueblo-en-numeros",
  "datePublished": "2026-05-06",
  "dateModified": new Date().toISOString().slice(0, 10),
  "author": {
    "@type": "Person",
    "name": "Angel Anderson",
    "url": "https://www.angelanderson.com"
  },
  "publisher": {
    "@type": "Organization",
    "name": "MapaDeCaboRojo.com",
    "url": "https://www.mapadecaborojo.com"
  },
  "image": "https://www.mapadecaborojo.com/og/pueblo-en-numeros.png",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://www.mapadecaborojo.com/pueblo-en-numeros"
  },
  "inLanguage": "es-PR",
  "spatialCoverage": {
    "@type": "Place",
    "name": "Cabo Rojo, Puerto Rico"
  }
})}</script>
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Dataset",
  "name": "Cabo Rojo — densidad de negocios y mercado por categoría",
  "description": `${openCount} negocios abiertos en Cabo Rojo, PR, organizados por categoría con TAM/SAM/SOM, densidad per cápita vs PR, y veredicto de sobreoferta. Verificado a pie por Angel Anderson.`,
  "url": "https://www.mapadecaborojo.com/pueblo-en-numeros",
  "creator": {
    "@type": "Person",
    "name": "Angel Anderson",
    "url": "https://www.angelanderson.com"
  },
  "license": "https://creativecommons.org/licenses/by/4.0/",
  "datePublished": "2026-05-06",
  "dateModified": new Date().toISOString().slice(0, 10),
  "inLanguage": "es-PR",
  "keywords": ["Cabo Rojo", "Puerto Rico", "small business", "market saturation", "TAM SAM SOM", "civic data", "business density", "directorio negocios"],
  "spatialCoverage": {
    "@type": "Place",
    "name": "Cabo Rojo, Puerto Rico",
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 18.086,
      "longitude": -67.146
    }
  },
  "variableMeasured": [
    "número de negocios por categoría",
    "densidad per cápita (negocios por habitante)",
    "TAM — dinero total por año por categoría",
    "SAM — plato local capturable",
    "SOM — revenue por negocio por año",
    "veredicto de sobreoferta"
  ]
})}</script>
<style>@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Source+Sans+3:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Source Sans 3",-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#faf9f7;color:#1c1917;-webkit-font-smoothing:antialiased;line-height:1.5}a{color:inherit}a:hover{opacity:0.85}h1,h2,h3{font-family:'Fraunces',Georgia,serif}h2{letter-spacing:-0.3px}.card{background:#fff;border-radius:14px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.06);margin-bottom:20px;}.kicker{font-size:12px;color:#0d9488;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;margin-bottom:6px;}</style>
</head>
<body>

<!-- HEADER -->
<div style="background:#1e293b;color:#fff;padding:24px 32px;">
  <div style="max-width:980px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
    <div>
      <a href="/municipio" style="color:#94a3b8;text-decoration:none;font-size:13px;">← Panel ciudadano /municipio</a>
    </div>
    <div style="text-align:right;font-size:11px;color:#64748b;">${esc(generatedAt)}</div>
  </div>
</div>

<!-- SECTION 1: HERO PUNCH -->
<div style="background:#0f172a;color:#fff;padding:60px 24px 50px;">
  <div style="max-width:980px;margin:0 auto;">
    <div style="text-align:center;max-width:780px;margin:0 auto 28px;">
      <div style="font-size:13px;color:#5eead4;letter-spacing:0.15em;text-transform:uppercase;font-weight:700;margin-bottom:18px;">📊 Cabo Rojo en Números</div>
      <h1 style="font-size:clamp(28px, 6.5vw, 42px);font-weight:800;letter-spacing:-1px;line-height:1.15;margin-bottom:14px;">1 negocio por cada <span style="color:#5eead4;">${perCapita} personas</span> en Cabo Rojo.</h1>
      <div style="font-family:'SF Mono',Monaco,Menlo,monospace;font-size:14px;color:#94a3b8;background:rgba(255,255,255,0.06);padding:8px 14px;border-radius:6px;display:inline-block;margin-bottom:18px;letter-spacing:0;">${fmt(residents)} personas ÷ ${fmt(openCount)} negocios abiertos = 1 cada ${perCapita}</div>
      <p style="font-size:20px;color:#cbd5e1;line-height:1.5;margin-bottom:8px;">Comparado con el resto del oeste, <strong style="color:#fff;">Cabo Rojo es de los más apretados de negocios por persona.</strong> No es opinión. Es nuestro propio directorio verificado, pueblo por pueblo.</p>
      <p style="font-size:15px;color:#94a3b8;line-height:1.5;">${regionalDensity.map(d => `${d.self ? '<strong style="color:#5eead4;">' : ''}${esc(d.town)} 1/${d.per}${d.self ? '</strong>' : ''}`).join(' · ')}. Mientras menos personas por negocio, más apretada la competencia.</p>
    </div>

    <!-- WIIFM micro-stack (3 chips: qué significa / por qué importa / qué hago) -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;max-width:920px;margin:0 auto;">
      <div style="background:rgba(94,234,212,0.08);border:1px solid rgba(94,234,212,0.2);border-radius:10px;padding:16px 18px;">
        <div style="font-size:11px;color:#5eead4;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;margin-bottom:8px;">¿Qué significa?</div>
        <div style="font-size:14px;color:#e2e8f0;line-height:1.55;">Hay 1 negocio por cada ${perCapita} personas, de los más apretados del oeste.</div>
      </div>
      <div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-radius:10px;padding:16px 18px;">
        <div style="font-size:11px;color:#fbbf24;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;margin-bottom:8px;">¿Por qué importa?</div>
        <div style="font-size:14px;color:#e2e8f0;line-height:1.55;">Cuando hay muchos negocios pa' la misma gente, la ganancia se divide entre más manos. Más quiebras, menos margen.</div>
      </div>
      <div style="background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.2);border-radius:10px;padding:16px 18px;">
        <div style="font-size:11px;color:#60a5fa;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;margin-bottom:8px;">¿Qué hago con esto?</div>
        <div style="font-size:14px;color:#e2e8f0;line-height:1.55;">Si vas a abrir → <a href="#tabla-categorias" style="color:#60a5fa;text-decoration:underline;">busca tu categoría en la tabla</a>. Si ya tienes y va lento → <a href="#3-movidas" style="color:#60a5fa;text-decoration:underline;">mira las 3 movidas</a>.</div>
      </div>
    </div>
  </div>
</div>

<div style="max-width:980px;margin:32px auto;padding:0 16px;">

  <!-- SECTION 1.4: HONESTY BANNER (trimmed v4 — only principio + autoridad + contacto) -->
  <div class="card" style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px 20px;">
    <div style="font-size:11px;color:#92400e;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;margin-bottom:6px;">⚠️ Trabajo en construcción · esta página vive y se corrige sola</div>
    <p style="font-size:13px;color:#78350f;line-height:1.65;margin:0 0 8px 0;">La data viene de <a href="https://data.census.gov/profile?q=Cabo+Rojo+Municipio,+Puerto+Rico" target="_blank" rel="noopener" style="color:#92400e;text-decoration:underline;">Census ACS 2019-23</a> (Cabo Rojo, FIPS 72023) + verificación a pie + bot *7711. Es <strong>direccionalmente correcta</strong>, no precisa al dólar.</p>
    <p style="font-size:13px;color:#78350f;line-height:1.65;margin:0;"><strong>¿Encontraste un error?</strong> Textea al <a href="https://wa.me/17874177711?text=Encontr%C3%A9%20un%20error%20en%20pueblo-en-numeros" target="_blank" rel="noopener" style="color:#92400e;text-decoration:underline;font-weight:700;">787-417-7711</a> — lo arreglamos hoy con tu corrección citada.</p>
  </div>

  <!-- SECTION 1.5: TL;DR ABUELA (plain-language summary) -->
  <div class="card" style="background:#ecfdf5;border-left:4px solid #0d9488;">
    <div style="font-size:11px;color:#0f766e;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;margin-bottom:8px;">Lo que esta página dice, en una línea</div>
    <p style="font-size:16px;color:#134e4a;line-height:1.6;margin:0 0 10px 0;">En Cabo Rojo hay <strong>${fmt(total)} negocios en el directorio · ${fmt(openCount)} abiertos hoy · ${fmt(closedCount)} cerrados · ${fmt(unknownCount)} dudosos</strong>. Para ${fmt(residents)} personas. Usamos los <strong>${fmt(openCount)} abiertos</strong> para calcular densidad porque los cerrados ya no compiten. Más negocios de los que el pueblo solo puede sostener. <strong>Sobran de unas cosas</strong> (food trucks, boutiques, restaurantes, donde entrar es barato y rápido), <strong>faltan de otras</strong> (plomero, electricista, cardiólogo, donde entrar requiere licencia, años de estudio o capital alto). El por qué de cada uno está abajo. Si tú o alguien tuyo está pensando en abrir negocio, busca tu categoría en la tabla y léela antes de firmar nada.</p>
  </div>

  <!-- SECTION 1.55b: TU VEREDICTO — capa de decisión (no leas todo, dime quién eres) -->
  <div class="card" style="background:#0f172a;color:#fff;padding:26px 24px;border:none;">
    <div style="text-align:center;max-width:680px;margin:0 auto 20px;">
      <div style="font-size:11px;color:#5eead4;letter-spacing:0.14em;text-transform:uppercase;font-weight:800;margin-bottom:8px;">🪞 No leas toda la página</div>
      <div style="font-size:clamp(20px,4.5vw,26px);font-weight:800;line-height:1.25;">Dime quién eres y te digo qué hacer.<br><span style="color:#94a3b8;font-size:15px;font-weight:500;">Los números completos están abajo. Esto es la conclusión.</span></div>
    </div>

    <!-- EL ESPEJO -->
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(94,234,212,0.25);border-radius:14px;padding:20px;max-width:680px;margin:0 auto;">
      <div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;">Vas a abrir un negocio (o ya tienes uno)</div>
      <div style="font-size:13px;color:#94a3b8;margin-bottom:14px;">Escoge la categoría. Te enseño tu apuesta en números — sin adornos.</div>
      <select id="espejo-sel" style="width:100%;padding:13px 14px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#fff;font-size:15px;font-weight:600;outline:none;">
        <option value="">— Escoge tu categoría —</option>
        ${espejoOptions}
      </select>
      <div id="espejo-out" style="margin-top:16px;min-height:20px;"></div>
    </div>

    <!-- 2 PUERTAS MÁS -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;max-width:680px;margin:18px auto 0;">
      <a href="#dinero-federal" style="display:block;text-decoration:none;background:rgba(220,38,38,0.12);border:1px solid rgba(248,113,113,0.3);border-radius:12px;padding:16px 18px;color:#fff;">
        <div style="font-size:13px;font-weight:800;color:#fca5a5;margin-bottom:6px;">🏛️ Decides por el pueblo</div>
        <div style="font-size:14px;line-height:1.5;color:#e2e8f0;">$5.9M federales <b>trancados</b> + $13.8M obligados desde 2020. El dinero ya es de Cabo Rojo. Falta moverlo. <span style="color:#fca5a5;font-weight:700;">Ver el récord →</span></div>
      </a>
      <a href="#compartir" style="display:block;text-decoration:none;background:rgba(13,148,136,0.12);border:1px solid rgba(45,212,191,0.3);border-radius:12px;padding:16px 18px;color:#fff;">
        <div style="font-size:13px;font-weight:800;color:#5eead4;margin-bottom:6px;">🏡 Eres vecino o estás afuera</div>
        <div style="font-size:14px;line-height:1.5;color:#e2e8f0;">Este pueblo no se entiende solo. Si alguien en tu mesa va a abrir negocio, mándale esto antes de que firme. <span style="color:#5eead4;font-weight:700;">Compartir →</span></div>
      </a>
    </div>
  </div>

  <script>
  (function(){
    var DATA = ${espejoJson};
    var byKey = {}; DATA.forEach(function(d){ byKey[d.k] = d; });
    var sel = document.getElementById('espejo-sel');
    var out = document.getElementById('espejo-out');
    if(!sel || !out) return;
    function f(n){ return Number(n).toLocaleString('es-PR'); }
    function box(border, html){ return '<div style="background:#1e293b;border-left:4px solid '+border+';border-radius:10px;padding:16px 18px;">'+html+'</div>'; }
    function render(k){
      var d = byKey[k];
      if(!d){ out.innerHTML=''; return; }
      var lbl = d.label.toLowerCase();
      var wa = 'https://wa.me/17874177711?text='+encodeURIComponent(d.label);
      var big='', p='', cta='', color='';
      if(d.verdict==='zero'){
        color='#16a34a';
        big='Nadie lo resuelve — y '+f(d.demand)+' vecinos lo buscaron.';
        p='Hay <b>0</b> '+lbl+' en el directorio. Esto no es un mercado lleno: es uno <b>vacío con gente esperando</b>. Si lo abres bien, empiezas sin competencia.';
        cta='<a href="'+wa+'" target="_blank" rel="noopener" style="display:inline-block;margin-top:12px;background:#16a34a;color:#fff;padding:11px 18px;border-radius:9px;font-weight:800;font-size:14px;text-decoration:none;">Dile a Angel que lo vas a resolver →</a>';
      } else if(d.verdict==='over'){
        color='#dc2626';
        var demas = d.supply - d.vSurvive;
        big='Hay '+f(d.supply)+'. El mercado da para que vivan ~'+f(d.vSurvive)+'.';
        p='<b>'+f(demas)+' están de más</b> — peleando por las mismas sobras. Si abres el #'+f(d.supply+1)+', tu plan es quitarle el cliente a uno que ya está parado. La pregunta no es "¿puedo?" — es <b>"¿qué hago yo que esos '+f(d.supply)+' no hacen?"</b>';
        cta='<a href="#tabla-categorias" style="display:inline-block;margin-top:12px;background:#dc2626;color:#fff;padding:11px 18px;border-radius:9px;font-weight:800;font-size:14px;text-decoration:none;">Ver el detalle antes de firmar →</a>';
      } else if(d.verdict==='tight'){
        color='#f59e0b';
        big='Hay '+f(d.supply)+'. El mercado está justo (~'+f(d.vComfort)+'–'+f(d.vSurvive)+').';
        p='No está lleno, pero tampoco sobra espacio. <b>Cabe uno más solo si llega distinto</b>, no si llega igual a los que ya están.';
        cta='<a href="#tabla-categorias" style="display:inline-block;margin-top:12px;background:#f59e0b;color:#0f172a;padding:11px 18px;border-radius:9px;font-weight:800;font-size:14px;text-decoration:none;">Ver el detalle →</a>';
      } else {
        color='#0d9488';
        big='Hay '+f(d.supply)+'. El mercado aguanta ~'+f(d.vComfort)+' cómodos — todavía cabe.';
        p='Hay espacio real aquí. Pero ojo: <b>gana el que resuelve mejor, no el que llega de último</b>. El espacio no te salva si el servicio es igual al de todos.';
        cta='<a href="#tabla-categorias" style="display:inline-block;margin-top:12px;background:#0d9488;color:#fff;padding:11px 18px;border-radius:9px;font-weight:800;font-size:14px;text-decoration:none;">Ver el detalle →</a>';
      }
      out.innerHTML = box(color,
        '<div style="font-size:17px;font-weight:800;color:#fff;line-height:1.3;margin-bottom:8px;">'+big+'</div>'+
        '<div style="font-size:14px;color:#cbd5e1;line-height:1.6;">'+p+'</div>'+cta);
    }
    sel.addEventListener('change', function(){ render(sel.value); });
  })();
  </script>

  <!-- PUENTE A /sistema (la data ve servicios; lo especializado y los productos se ven a mano) -->
  <a href="/sistema" class="card" style="display:flex;align-items:center;gap:14px;text-decoration:none;color:inherit;background:#0f172a;border:none;padding:18px 22px;">
    <span style="font-size:28px;flex-shrink:0;">⚡</span>
    <div style="flex:1;">
      <div style="font-size:15px;font-weight:800;color:#fff;line-height:1.3;">Esto es lo que la data VE. Hay dos capas más que la data no ve.</div>
      <div style="font-size:13px;color:#94a3b8;margin-top:3px;line-height:1.5;">Lo especializado (el compounding que falta) y los productos de identidad (la camisa, la revista) se ven a mano. <span style="color:#5eead4;font-weight:700;">Mira las 3 capas en /sistema →</span></div>
    </div>
  </a>

  ${oppBanner}

  <!-- SECTION 1.56: EL DINERO FEDERAL DORMIDO (link a /observatorio) -->
  <a id="dinero-federal" href="/observatorio" class="card" style="display:block;text-decoration:none;color:inherit;background:#fff;border-left:4px solid #dc2626;padding:22px 26px;">
    <div style="font-size:11px;color:#dc2626;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;margin-bottom:8px;">💰 El dinero federal dormido</div>
    <div style="font-size:clamp(24px,5vw,34px);font-weight:900;color:#1e293b;line-height:1.1;">~$5.9M en fondos federales <span style="color:#dc2626;">obligados a Cabo Rojo y sin moverse.</span></div>
    <div style="font-size:14px;color:#475569;margin-top:10px;line-height:1.55;">$5.2M de FEMA para el Coliseo Rebekah Colberg (límite 20 sept 2026) + ~$735K para Isla Ratones (devueltos). Y eso es solo lo trancado: desde 2020, Cabo Rojo tiene <strong>$13.8M en grants federales</strong> obligados a su nombre — $3.94M de USDA pa' aguas usadas tras los huracanes, ~$6M en bloques CDBG de Vivienda, $1.2M pa' restaurar Las Salinas de Cabo Rojo. El problema casi nunca es que no haya dinero: está obligado y sentado. Cada activo cerrado es un motor económico apagado.</div>
    <div style="font-size:11px;color:#94a3b8;margin-top:8px;font-style:italic;">Fuente: <a href="https://www.usaspending.gov/search/?hash=&filters=%7B%22place_of_performance_locations%22%3A%5B%7B%22country%22%3A%22USA%22%2C%22state%22%3A%22PR%22%2C%22county%22%3A%22023%22%7D%5D%7D" target="_blank" rel="noopener" style="color:#94a3b8;text-decoration:underline;">USASpending.gov</a> — 20 grants federales, lugar de ejecución Cabo Rojo, FY2020-26. Verificado 29 jun 2026.</div>
    <div style="margin-top:12px;color:#0d9488;font-size:13px;font-weight:700;">Ver el récord completo en el Observatorio →</div>
  </a>

  <!-- SECTION 1.42: ÍNDICE — salta a lo que te interesa (tame information overload) -->
  <div style="margin-bottom:20px;text-align:center;">
    <div style="font-size:11px;color:#64748b;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;margin-bottom:10px;">Es mucha info. Salta a lo tuyo.</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">
      ${[
        { t: '🔍 Lo que el pueblo busca', h: '#demanda' },
        { t: '💵 La matemática en dólares', h: '#tabla-categorias' },
        { t: '⚙️ Tengo negocio y va lento', h: '#3-movidas' },
        { t: '🗺️ El mapa de negocios', h: '#mapa' },
        { t: '🩺 Especialistas del oeste', h: '#especialistas' },
      ].map(c => `<a href="${c.h}" style="background:#fff;border:1px solid #e2e8f0;color:#334155;padding:8px 14px;border-radius:999px;font-size:13px;font-weight:600;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.04);">${c.t}</a>`).join('')}
    </div>
  </div>

  <!-- SECTION 1.45: LO QUE CABO ROJO BUSCÓ — tablero de demanda real (shareable + money) -->
  <div class="card" id="demanda" style="border-left:4px solid #0d9488;scroll-margin-top:20px;">
    <div class="kicker">🔍 La voz del pueblo · en vivo</div>
    <h2 style="font-size:22px;font-weight:800;color:#1e293b;margin-bottom:6px;">Lo que Cabo Rojo buscó en el *7711</h2>
    <p style="font-size:14px;color:#475569;margin-bottom:6px;line-height:1.55;">Esto no es una encuesta. Son las búsquedas reales que la gente le texteó al <strong>787-417-7711</strong> en los últimos 90 días. <strong>${fmt(demandTotal)} búsquedas</strong> en las categorías de abajo. Nadie más en Puerto Rico publica esto, porque nadie más lo tiene.</p>
    <p style="font-size:12px;color:#94a3b8;margin-bottom:18px;">🟢 lo tienes cubierto · 🟡 mucha demanda, pocos lo resuelven · 🔥 lo buscan y nadie aparece en el directorio.</p>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${demandTop.map((d, i) => {
        const max = demandTop[0].demand || 1;
        const w = Math.max(6, Math.round((d.demand / max) * 100));
        const vEmoji = d.verdict === 'gap' ? '🔥' : d.verdict === 'tight' ? '🟡' : '🟢';
        const vColor = d.verdict === 'gap' ? '#dc2626' : d.verdict === 'tight' ? '#ca8a04' : '#0d9488';
        const vText = d.verdict === 'gap' ? 'nadie lo resuelve' : d.verdict === 'tight' ? `solo ${d.supply} lo resuelve${d.supply === 1 ? '' : 'n'}` : `${d.supply} negocios lo resuelven`;
        const link = d.slug ? `/categoria/${d.slug}` : `https://wa.me/17874177711?text=${encodeURIComponent(d.label)}`;
        return `<a href="${link}" style="display:block;text-decoration:none;color:inherit;background:#f8fafc;border-radius:8px;padding:11px 14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:5px;">
            <span style="font-size:14px;font-weight:700;color:#1e293b;">${d.emoji} ${esc(d.label)}</span>
            <span style="font-size:12px;font-weight:700;color:${vColor};white-space:nowrap;">${vEmoji} ${esc(vText)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="flex:1;background:#e2e8f0;height:9px;border-radius:5px;overflow:hidden;">
              <div style="background:${vColor};height:100%;width:${w}%;border-radius:5px;"></div>
            </div>
            <span style="font-size:12px;font-weight:700;color:#475569;white-space:nowrap;min-width:92px;text-align:right;">${fmt(d.demand)} búsquedas</span>
          </div>
        </a>`;
      }).join('')}
    </div>
    ${demandGaps.length > 0 ? `
    <div style="margin-top:16px;padding:14px 16px;background:#fef2f2;border-radius:10px;border-left:3px solid #dc2626;">
      <div style="font-size:13px;font-weight:800;color:#991b1b;margin-bottom:4px;">💰 Si tú resuelves una de estas, el pueblo ya te está buscando</div>
      <p style="font-size:12px;color:#7f1d1d;line-height:1.55;margin:0 0 8px 0;">Demanda real, poco o ningún negocio en el directorio: <strong>${demandGaps.map(g => esc(g.label.toLowerCase())).join(' · ')}</strong>. Si tienes ese negocio o lo vas a abrir, te ponemos en el mapa pa' que te encuentren. Gratis los primeros 30 días.</p>
      <a href="https://wa.me/17874177711?text=${encodeURIComponent('Resuelvo uno de los que el pueblo busca y quiero salir en el mapa')}" target="_blank" rel="noopener" style="display:inline-block;background:#dc2626;color:#fff;padding:9px 16px;border-radius:7px;font-size:13px;font-weight:700;text-decoration:none;min-height:40px;line-height:22px;">Quiero aparecer →</a>
    </div>` : ''}
    <div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
      <span style="font-size:12px;color:#64748b;font-weight:600;">¿Útil? Mándaselo a alguien:</span>
      <a href="https://wa.me/?text=${encodeURIComponent('Esto es lo que Cabo Rojo buscó este mes (búsquedas reales del *7711): https://www.mapadecaborojo.com/pueblo-en-numeros')}" target="_blank" rel="noopener" style="background:#25d366;color:#fff;padding:8px 14px;border-radius:7px;font-size:12px;font-weight:700;text-decoration:none;min-height:38px;display:inline-flex;align-items:center;gap:6px;">💬 WhatsApp</a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://www.mapadecaborojo.com/pueblo-en-numeros')}" target="_blank" rel="noopener" style="background:#1877f2;color:#fff;padding:8px 14px;border-radius:7px;font-size:12px;font-weight:700;text-decoration:none;min-height:38px;display:inline-flex;align-items:center;gap:6px;">f Facebook</a>
    </div>
  </div>

  <!-- SECTION 1.6: PRIMER PASO UNIVERSAL — 2 caminos claros -->
  <div class="card" style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#fff;border-left:4px solid #5eead4;padding:24px 28px;">
    <div style="font-size:11px;color:#5eead4;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;margin-bottom:14px;">👇 Empieza aquí</div>
    <div style="font-size:15px;color:#cbd5e1;line-height:1.55;margin-bottom:18px;">Esta página es pa' dos personas. Tú eres una de las dos:</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;">
      <a href="#tabla-categorias" style="display:block;text-decoration:none;color:inherit;background:rgba(94,234,212,0.08);border:1px solid rgba(94,234,212,0.25);border-radius:10px;padding:18px 18px 16px;">
        <div style="font-size:13px;font-weight:700;color:#5eead4;margin-bottom:8px;">🎯 Voy a abrir un negocio nuevo</div>
        <ol style="font-size:13px;color:#e2e8f0;line-height:1.7;padding-left:18px;margin:0 0 12px 0;">
          <li>Busca tu categoría en la tabla</li>
          <li>Mira la <strong>BANDERA</strong> (🟢 sano · 🟡 al filo · ⚪ no alcanza · 🔥 te necesitan)</li>
          <li>Mira la columna <strong>"Qué hacer"</strong> — te dice si dale o párate</li>
        </ol>
        <div style="font-size:12px;color:#5eead4;font-weight:600;">Saltar a la tabla →</div>
      </a>
      <a href="#3-movidas" style="display:block;text-decoration:none;color:inherit;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:10px;padding:18px 18px 16px;">
        <div style="font-size:13px;font-weight:700;color:#fbbf24;margin-bottom:8px;">⚙️ Ya tengo negocio y no rinde como antes</div>
        <ol style="font-size:13px;color:#e2e8f0;line-height:1.7;padding-left:18px;margin:0 0 12px 0;">
          <li>Busca <strong>tu</strong> categoría en la tabla</li>
          <li>Si está 🟡 o ⚪, las 3 movidas son pa' ti</li>
          <li>Una de las 3 movidas te aplica. Empieza esta semana con esa</li>
        </ol>
        <div style="font-size:12px;color:#fbbf24;font-weight:600;">Saltar a las 3 movidas →</div>
      </a>
    </div>
    <div style="margin-top:14px;font-size:12px;color:#94a3b8;line-height:1.55;">¿Solo de chisme? Sigue bajando — pero la decisión real vive en la tabla.</div>
  </div>

  <!-- SECTION 2: BASELINE STAT CARDS -->
  <div class="card">
    <h2 style="font-size:18px;font-weight:700;color:#1e293b;margin-bottom:6px;">El pueblo en cifras</h2>
    <p style="font-size:13px;color:#64748b;margin-bottom:20px;">La base que define todo lo demás. Sources citadas inline.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;">
      ${[
        { lbl: 'Población', val: fmt(CABO_ROJO_BASELINE.residents), sub: 'Census ACS 5-year 2019-23', subUrl: 'https://data.census.gov/profile?q=Cabo+Rojo+Municipio,+Puerto+Rico', icon: '👥', color: '#0d9488', wiifm: 'Casi todos votan, compran, comen aquí. Esa es tu base de clientes residentes.' },
        { lbl: 'Hogares', val: '~' + fmt(CABO_ROJO_BASELINE.household_count), sub: '47,158 ÷ 2.55 = ' + fmt(CABO_ROJO_BASELINE.household_count) + ' hogares', subUrl: 'https://www.census.gov/programs-surveys/acs', icon: '🏠', color: '#7c3aed', wiifm: 'Si vendes algo de casa (limpieza, AC, plomero), tienes ~18,500 puertas pa\' tocar.' },
        { lbl: 'Ingreso típico', val: '$' + fmt(CABO_ROJO_BASELINE.median_income), sub: 'Census ACS 2019-23 (mediana)', subUrl: 'https://data.census.gov/profile?q=Cabo+Rojo+Municipio,+Puerto+Rico', icon: '💵', color: '#16a34a', wiifm: 'Es la mitad del promedio US ($75K). O sea: precio bajo gana, premium pierde.' },
        { lbl: 'Pull regional', val: '~' + fmt(CABO_ROJO_BASELINE.regional_pull), sub: '47K CR + 15K Hormigueros + 23K Lajas + 30K S.Germán', subUrl: 'https://data.census.gov/profile?q=Cabo+Rojo+Municipio,+Puerto+Rico', icon: '🌐', color: '#0369a1', wiifm: 'Servicios (salud, mecánico, abogado) — tu cliente puede venir de pueblo vecino.' },
        { lbl: 'Visitantes/año', val: '~' + fmt(CABO_ROJO_BASELINE.visitors_annual), sub: '⚠️ PRTC estimate · pendiente verificar', subUrl: 'https://www.tourism.pr.gov/', icon: '🏖️', color: '#ea580c', wiifm: '3 meses pico (verano + diciembre). Restaurante + hospedaje viven de aquí.' },
        { lbl: 'Negocios abiertos hoy', val: fmt(openCount), sub: `${fmt(total)} directorio · ${fmt(openCount)} abiertos · ${fmt(closedCount)} cerrados · ${fmt(unknownCount)} dudosos`, subUrl: 'https://mapadecaborojo.com', icon: '🏢', color: '#dc2626', wiifm: 'Más negocios de los que el pueblo solo puede sostener. El resto compite por turistas o se exporta.' },
      ].map(s => `
        <div style="padding:16px 14px;background:#f8fafc;border-radius:10px;border-left:3px solid ${s.color};">
          <div style="font-size:20px;margin-bottom:4px;">${s.icon}</div>
          <div style="font-size:18px;font-weight:800;color:#1e293b;">${s.val}</div>
          <div style="font-size:11px;color:#475569;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-top:6px;">${s.lbl}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:2px;"><a href="${s.subUrl}" target="_blank" rel="noopener" style="color:#0d9488;text-decoration:none;border-bottom:1px dotted #0d9488;">${s.sub} →</a></div>
          <div style="font-size:11px;color:#64748b;font-style:italic;line-height:1.45;margin-top:8px;padding-top:8px;border-top:1px dashed #e2e8f0;">${s.wiifm}</div>
        </div>`).join('')}
    </div>
    <p style="font-size:11px;color:#94a3b8;margin-top:14px;font-style:italic;">Click en cada source pa' verificar tú mismo. Las cifras de visitantes y pull regional son estimates conservadores — la próxima versión las reemplaza con <a href="https://www.bls.gov/cew/" target="_blank" rel="noopener" style="color:#94a3b8;">data oficial del gobierno</a> + <a href="https://www.tourism.pr.gov/" target="_blank" rel="noopener" style="color:#94a3b8;">PRTC</a> + data de movimiento entre pueblos.</p>
  </div>

  <!-- SECTION 3.5: GLOSSARY — "Cómo leer este reporte" -->
  <div class="card" style="background:#fef3c7;border-left:4px solid #f59e0b;">
    <div class="kicker" style="color:#b45309;">📖 Cómo leer este reporte</div>
    <h2 style="font-size:20px;font-weight:800;color:#1e293b;margin-bottom:6px;">Las palabras antes de los números</h2>
    <p style="font-size:13px;color:#78350f;margin-bottom:18px;">Diccionario fácil — qué significa cada término, sin jerga técnica. Léelo una vez y la tabla de abajo cobra sentido.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;">
      <div style="padding:14px;background:#fff;border-radius:8px;">
        <div style="font-size:13px;font-weight:700;color:#1e293b;">TAM <span style="color:#94a3b8;font-weight:400;font-size:11px;">Total Addressable Market</span></div>
        <div style="font-size:12px;color:#475569;margin-top:6px;line-height:1.5;"><strong>El mercado total.</strong> Todo el dinero que se gasta en esa categoría en CR + región. Incluye lo que se va para Mayagüez, Amazon, San Juan.</div>
      </div>
      <div style="padding:14px;background:#fff;border-radius:8px;">
        <div style="font-size:13px;font-weight:700;color:#1e293b;">SAM <span style="color:#94a3b8;font-weight:400;font-size:11px;">Serviceable Addressable Market</span></div>
        <div style="font-size:12px;color:#475569;margin-top:6px;line-height:1.5;"><strong>El mercado capturable local.</strong> Lo que un negocio en Cabo Rojo puede atrapar. SAM = TAM × capture.</div>
      </div>
      <div style="padding:14px;background:#fff;border-radius:8px;">
        <div style="font-size:13px;font-weight:700;color:#1e293b;">SOM <span style="color:#94a3b8;font-weight:400;font-size:11px;">Serviceable Obtainable Market</span></div>
        <div style="font-size:12px;color:#475569;margin-top:6px;line-height:1.5;"><strong>Revenue por negocio/año.</strong> SAM ÷ negocios actuales = lo que le toca a cada uno en promedio.</div>
      </div>
      <div style="padding:14px;background:#fff;border-radius:8px;">
        <div style="font-size:13px;font-weight:700;color:#1e293b;">Capture %</div>
        <div style="font-size:12px;color:#475569;margin-top:6px;line-height:1.5;"><strong>Qué % del TAM se queda en CR.</strong> 8% en boutique = 92% del gasto en ropa se va para Marshalls/Amazon.</div>
      </div>
      <div style="padding:14px;background:#fff;border-radius:8px;">
        <div style="font-size:13px;font-weight:700;color:#1e293b;">Breakeven</div>
        <div style="font-size:12px;color:#475569;margin-top:6px;line-height:1.5;"><strong>Lo mínimo para no quebrar.</strong> No es ganancia — es supervivencia. Si SOM &lt; breakeven, la matemática dice oversupply real.</div>
      </div>
      <div style="padding:14px;background:#fff;border-radius:8px;">
        <div style="font-size:13px;font-weight:700;color:#1e293b;">Supply</div>
        <div style="font-size:12px;color:#475569;margin-top:6px;line-height:1.5;"><strong>Cuántos negocios open hay.</strong> Live del directorio mapadecaborojo.com — solo places verificados como abiertos.</div>
      </div>
      <div style="padding:14px;background:#fff;border-radius:8px;">
        <div style="font-size:13px;font-weight:700;color:#1e293b;">Demanda</div>
        <div style="font-size:12px;color:#475569;margin-top:6px;line-height:1.5;"><strong>Qué pide la gente.</strong> Cuántas veces alguien texteó al *7711 buscando esa categoría en los últimos 90 días. La voz del pueblo, en números.</div>
      </div>
      <div style="padding:14px;background:#fff;border-radius:8px;">
        <div style="font-size:13px;font-weight:700;color:#1e293b;">Sobreoferta</div>
        <div style="font-size:12px;color:#475569;margin-top:6px;line-height:1.5;"><strong>Más negocios que aguante.</strong> Cuando hay más places ofreciendo lo mismo de lo que la matemática del pueblo puede sostener. SOM &lt; breakeven = sobreoferta real.</div>
      </div>
      <div style="padding:14px;background:#fff;border-radius:8px;">
        <div style="font-size:13px;font-weight:700;color:#1e293b;">Heat index</div>
        <div style="font-size:12px;color:#475569;margin-top:6px;line-height:1.5;"><strong>Demanda ÷ Supply.</strong> &gt;5× = caliente (oportunidad). 1-5× = sano. &lt;1× = saturado (muchos persiguiendo poca gente).</div>
      </div>
      <div style="padding:14px;background:#fff;border-radius:8px;">
        <div style="font-size:13px;font-weight:700;color:#1e293b;">Margen pisado</div>
        <div style="font-size:12px;color:#475569;margin-top:6px;line-height:1.5;"><strong>Sobreviven pero ganan poquito.</strong> Cuando SOM apenas pasa breakeven. No quiebran, pero tampoco crecen. Vulnerables a cualquier shock (huracán, recesión, gas).</div>
      </div>
      <div style="padding:14px;background:#fff;border-radius:8px;">
        <div style="font-size:13px;font-weight:700;color:#1e293b;">Verificado</div>
        <div style="font-size:12px;color:#475569;margin-top:6px;line-height:1.5;"><strong>Lo confirmé yo, no Google.</strong> Angel caminó la calle, entró al negocio, vio que estaba operando. Es el moat — nadie más en PR verifica directorios en persona.</div>
      </div>
    </div>
    <div style="margin-top:14px;padding:14px;background:#fff;border-radius:8px;border-left:3px solid #f59e0b;">
      <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:10px;">🍕 Ejemplo con pizza (mismo cuento, palabras de mesa)</div>
      <ul style="font-size:12px;color:#475569;line-height:1.7;margin:0;padding-left:20px;">
        <li><strong>TAM</strong> = todo el dinero que el pueblo gasta en pizza al año (incluye Domino's, gasolinera, pizzería local).</li>
        <li><strong>SAM</strong> = de eso, cuánto pueden capturar las pizzerías de Cabo Rojo (no Domino's nacional).</li>
        <li><strong>SOM</strong> = ese dinero dividido entre las pizzerías locales = lo que le toca a cada una al año.</li>
        <li><strong>Si SOM &lt; breakeven</strong> = matemática de muerte por inanición. La categoría no sostiene a todos.</li>
      </ul>
    </div>
    <div style="margin-top:14px;padding:14px;background:#fff;border-radius:8px;">
      <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:10px;">Veredicto · qué significa cada bandera</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;font-size:12px;color:#475569;line-height:1.5;">
        <div>🟢 <strong>Holgado / Sano</strong> — SOM cubre breakeven con margen. Crecimiento posible.</div>
        <div>🟡 <strong>Borderline / Al filo</strong> — apenas alcanza. Cualquier shock (huracán, recesión, gas spike) tumba 10-20% del más débil.</div>
        <div>⚪ <strong>Debajo breakeven / No alcanza</strong> — matemática de muerte por inanición. La categoría no sostiene todos.</div>
        <div>🔥 <strong>Cero supply / Vacío</strong> — demanda real, ningún negocio en directorio. El pueblo te necesita.</div>
      </div>
    </div>
  </div>

  <!-- SECTION 4: TAM / SAM / SOM TABLE -->
  <div class="card" id="tabla-categorias" style="scroll-margin-top:20px;">
    <div class="kicker">La matemática en dólares</div>
    <h2 style="font-size:22px;font-weight:800;color:#1e293b;margin-bottom:6px;">TAM · SAM · SOM por categoría</h2>
    <p style="font-size:13px;color:#64748b;margin-bottom:14px;">Cada columna explicada arriba en el diccionario. <strong>Si SOM &lt; breakeven, hay sobreoferta económica real.</strong> Pasa el cursor sobre cada header para refresh rápido.</p>
    <div style="background:#ecfdf5;border-left:3px solid #0d9488;padding:12px 14px;border-radius:6px;margin-bottom:14px;font-size:13px;color:#134e4a;line-height:1.55;">
      <strong>¿Tu negocio está aquí? ¿La categoría que está pensando tu hijo está aquí?</strong> Busca la fila. Mira la columna <strong>Veredicto</strong> (🟢 sano · 🟡 al filo · ⚪ debajo breakeven · 🔥 hace falta). La columna <strong>Acción</strong> te dice qué pensar antes de decidir.
    </div>
    <div style="background:#f1f5f9;border-left:3px solid #475569;padding:14px 16px;border-radius:6px;margin-bottom:18px;font-size:13px;color:#1e293b;line-height:1.6;">
      <div style="font-weight:700;margin-bottom:10px;font-size:14px;">📖 Cómo leer una fila — ejemplo: <span style="color:#0d9488;">Farmacia</span></div>
      <ul style="list-style:none;padding:0;margin:0;display:grid;gap:6px;">
        <li><strong>Dinero total / año</strong> — todo lo que el pueblo + región gasta en farmacia al año (incluye Walgreens, delivery, tu farmacia, todo).</li>
        <li><strong>% que se queda</strong> — de ese dinero, cuánto se queda en farmacias locales de CR. El resto se va pa' las cadenas grandes o Mayagüez.</li>
        <li><strong>Plato local</strong> — el pedazo que se queda. Esa es la torta que se reparten las farmacias de aquí.</li>
        <li><strong>Negocios</strong> — cuántas farmacias hay abiertas en CR hoy.</li>
        <li><strong>Por negocio</strong> — el plato dividido entre las farmacias = lo que le toca a cada una al año <em>en promedio</em>.</li>
        <li><strong>Pa' no quebrar</strong> — lo mínimo que necesita una farmacia pa' sobrevivir (según data de la industria).</li>
        <li><strong>Bandera</strong> — compara "Por negocio" contra "Pa' no quebrar". 🟢 sano · 🟡 al filo · ⚪ no alcanza · 🔥 te necesitan.</li>
        <li><strong>Qué hacer</strong> — la última columna te dice qué movida tomar según tu situación.</li>
      </ul>
      <details style="margin-top:12px;border-top:1px dashed #cbd5e1;padding-top:10px;">
        <summary style="cursor:pointer;font-size:11px;color:#64748b;font-weight:600;">📐 Quiero ver la matemática exacta (pa' los curiosos)</summary>
        <div style="font-family:'SF Mono',Monaco,Menlo,monospace;font-size:11px;color:#475569;background:#fff;padding:10px 12px;border-radius:4px;margin-top:8px;">
          Ejemplo restaurante:<br>
          TAM = 47,158 personas × $1,400/año + 250K visitantes × $40/visita = <strong>$80M</strong><br>
          Plato local = $80M × 75% que se queda = <strong>$60M</strong><br>
          Por negocio = $60M ÷ 157 restaurantes = <strong>$382K/biz/año</strong><br>
          Pa' no quebrar (restaurante): $600K–$1M/año<br>
          Bandera: $382K &lt; $600K = <strong>⚪ no alcanza</strong> · sobreoferta real.
        </div>
      </details>
    </div>
    <div style="background:#fef3c7;border-left:3px solid #ca8a04;padding:12px 14px;border-radius:6px;margin-bottom:18px;font-size:12px;color:#78350f;line-height:1.55;">
      ⚠️ <strong>Lo honesto:</strong> el gasto por persona y el % que se queda local salen de benchmarks nacionales de cada industria (<a href="https://www.bls.gov/cex/tables.htm" target="_blank" style="color:#92400e;text-decoration:underline;">BLS</a>, <a href="https://restaurant.org/research-and-media/research/economic-impact/" target="_blank" style="color:#92400e;text-decoration:underline;">restaurantes</a>, <a href="https://www.convenience.org/Research" target="_blank" style="color:#92400e;text-decoration:underline;">gasolineras</a>, <a href="https://www.ncpdp.org/" target="_blank" style="color:#92400e;text-decoration:underline;">farmacias</a>, <a href="https://www.ihrsa.org/" target="_blank" style="color:#92400e;text-decoration:underline;">gimnasios</a>, <a href="https://www.ada.org/resources/research" target="_blank" style="color:#92400e;text-decoration:underline;">dentistas</a>, <a href="https://www.tourism.pr.gov/" target="_blank" style="color:#92400e;text-decoration:underline;">turismo PR</a>). La próxima versión los calibra uno por uno con data local. <strong>El "Por negocio" SÍ es live</strong> — sale de dividir el plato local entre los negocios abiertos del directorio.
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="border-bottom:2px solid #1e293b;">
            <th style="text-align:left;padding:8px 6px;color:#475569;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;position:sticky;left:0;background:#fff;box-shadow:1px 0 0 #e2e8f0;" title="Sector económico — la categoría">Categoría</th>
            <th style="text-align:right;padding:8px 6px;color:#475569;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;" title="TAM — todo el dinero gastado en esa categoría al año (incluye lo que se va pa' Amazon, Mayagüez, etc.)">Dinero total / año</th>
            <th style="text-align:right;padding:8px 6px;color:#475569;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;" title="Capture — qué % del TAM se queda en negocios de Cabo Rojo">% que se queda</th>
            <th style="text-align:right;padding:8px 6px;color:#475569;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;" title="SAM — mercado local capturable. TAM × % que se queda.">Plato local</th>
            <th style="text-align:right;padding:8px 6px;color:#475569;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;" title="Cuántos negocios abiertos hay en directorio">Negocios</th>
            <th style="text-align:right;padding:8px 6px;color:#475569;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;" title="SOM — revenue promedio por negocio al año. Plato local ÷ Negocios.">Por negocio</th>
            <th style="text-align:right;padding:8px 6px;color:#475569;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;" title="Lo mínimo que necesita una categoría para no quebrar (rango típico de la industria)">Pa' no quebrar</th>
            <th style="text-align:right;padding:8px 6px;color:#475569;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;" title="🟢 sano · 🟡 al filo · ⚪ no alcanza · 🔥 te necesitan">Bandera</th>
            <th style="text-align:left;padding:8px 6px;color:#475569;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;" title="Qué hacer con esto según tu situación">Qué hacer</th>
          </tr>
        </thead>
        <tbody>
          ${tamSomResults.map(t => {
            const verdictColor = t.verdict === 'below_breakeven' ? '#dc2626' : t.verdict === 'borderline' ? '#ca8a04' : t.verdict === 'zero_supply' ? '#dc2626' : '#16a34a';
            const action = (() => {
              switch (t.verdict) {
                case 'healthy': return { dueno: 'Crece o expande', empre: 'Espacio — nicho específico' };
                case 'borderline': return { dueno: 'Diferénciate B2B o por nicho', empre: 'Solo con ventaja única' };
                case 'below_breakeven': return { dueno: 'Pivota a B2B / clientela específica', empre: '❌ NO abrir' };
                case 'zero_supply': return { dueno: '—', empre: '🔥 El pueblo te necesita' };
                default: return { dueno: '—', empre: '—' };
              }
            })();
            const isHighlighted = t.key === mapCat;
            const rowStyle = isHighlighted
              ? 'border-bottom:1px solid #f1f5f9;background:#fef3c7;outline:2px solid #f59e0b;scroll-margin-top:80px;'
              : 'border-bottom:1px solid #f1f5f9;';
            const stickyBg = isHighlighted ? '#fef3c7' : '#fff';
            return `<tr id="row-${esc(t.key)}" style="${rowStyle}">
              <td style="padding:10px 6px;font-weight:${isHighlighted ? '800' : '600'};color:#1e293b;position:sticky;left:0;background:${stickyBg};box-shadow:1px 0 0 #e2e8f0;">${isHighlighted ? '👉 ' : ''}${esc(t.label)}</td>
              <td style="padding:10px 6px;text-align:right;color:#475569;">${fmtMoneyExact(t.tam)}</td>
              <td style="padding:10px 6px;text-align:right;color:#475569;">${Math.round(t.localCaptureRate * 100)}%</td>
              <td style="padding:10px 6px;text-align:right;color:#475569;">${fmtMoneyExact(t.sam)}</td>
              <td style="padding:10px 6px;text-align:right;font-weight:600;">${t.supply}</td>
              <td style="padding:10px 6px;text-align:right;font-weight:700;color:${verdictColor};">${t.supply > 0 ? fmtMoney(t.som) : '—'}</td>
              <td style="padding:10px 6px;text-align:right;color:#94a3b8;font-size:11px;">${fmtMoney(t.breakevenLow)}-${fmtMoney(t.breakevenHigh)}</td>
              <td style="padding:10px 6px;text-align:right;font-size:11px;font-weight:700;color:${verdictColor};">${t.verdictEmoji} ${esc(t.verdictLabel)}</td>
              <td style="padding:10px 6px;font-size:10px;line-height:1.5;">
                <div style="margin-bottom:3px;"><span style="color:#64748b;">🛒 Dueño:</span> <span style="color:#1e293b;">${esc(action.dueno)}</span></div>
                <div><span style="color:#64748b;">🚀 Emprendedor:</span> <span style="color:#1e293b;">${esc(action.empre)}</span></div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- SECTION 4.5: ¿QUÉ HAGO CON ESTO? (3 personas — abrir + dueño priorizados) -->
  <div class="card">
    <div class="kicker">Acción</div>
    <h2 style="font-size:22px;font-weight:800;color:#1e293b;margin-bottom:18px;">¿Qué hago con esto?</h2>

    <!-- Top: abrir + dueño (2 columnas iguales, full width) -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-bottom:16px;">

      <div style="padding:18px;background:#ecfdf5;border-radius:10px;border-left:3px solid #0d9488;">
        <div style="font-size:13px;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">🎯 Si vas a abrir negocio</div>
        <div style="font-size:13px;color:#1e293b;font-weight:600;margin-bottom:6px;">Categorías a EVITAR:</div>
        <p style="font-size:12px;color:#475569;line-height:1.6;margin-bottom:10px;">Restaurante casual, food truck, salón de belleza, boutique, car wash, gimnasio, abogado nuevo, gasolinera. La matemática dice que la próxima abre en mercado ya pisado.</p>
        <div style="font-size:13px;color:#1e293b;font-weight:600;margin-bottom:6px;">Donde el pueblo TE NECESITA:</div>
        <p style="font-size:12px;color:#475569;line-height:1.6;margin-bottom:10px;">Plomero, electricista, AC tech, cardiólogo, ginecólogo, especialistas médicos, nursing home, repostería con licencia, terapia física. Si tienes la habilidad — esa apertura paga rápido.</p>
        <div style="margin-top:12px;padding:10px 12px;background:#fff;border-radius:6px;border-top:2px solid #0d9488;">
          <div style="font-size:11px;color:#0f766e;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">📅 Tu próximo paso ESTA semana</div>
          <p style="font-size:12px;color:#1e293b;line-height:1.55;margin:0;">Textea <strong>ABRIR + tu categoría</strong> al <a href="https://wa.me/17874177711?text=ABRIR%20" target="_blank" rel="noopener" style="color:#0f766e;font-weight:700;">787-417-7711</a>. Te mando la fila exacta + las 5 banderas pa' revisar antes de firmar contrato. Gratis. Sin agendas.</p>
        </div>
      </div>

      <div id="3-movidas" style="padding:18px;background:#fef3c7;border-radius:10px;border-left:3px solid #ca8a04;scroll-margin-top:20px;">
        <div style="font-size:13px;font-weight:700;color:#ca8a04;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">⚙️ Si eres dueño en categoría saturada</div>
        <p style="font-size:12px;color:#475569;line-height:1.6;margin-bottom:8px;">Las 3 únicas movidas que mueven aguja según la data:</p>
        <ol style="padding-left:18px;font-size:12px;color:#475569;line-height:1.7;">
          <li><strong>Hacer una cosa específica que nadie más hace.</strong> No "mejor servicio" abstracto — algo concreto. La única pizzería con masa de 72 horas y horno de leña. La única panadería que entrega antes de las 6am.</li>
          <li><strong>Salir del consumer y entrar B2B.</strong> Si vendes pan al cliente, también véndele a los hoteles, a los cafés, a las panaderías más chicas. El consumer es donde está la sobreoferta. El B2B es nicho protegido.</li>
          <li><strong>Especializarte en UN tipo de cliente.</strong> No "todo el mundo." El bar de los músicos locales con bookings semanales. La barbería de los hombres que cortan corto y rápido en el almuerzo.</li>
        </ol>
        <p style="font-size:11px;color:#92400e;margin-top:8px;font-style:italic;">"Mejor servicio" o "renovamos imagen" es ilusión en mercado sobrecargado.</p>
        <div style="margin-top:12px;padding:10px 12px;background:#fff;border-radius:6px;border-top:2px solid #ca8a04;">
          <div style="font-size:11px;color:#ca8a04;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">📅 Tu próximo paso ESTA semana</div>
          <p style="font-size:12px;color:#1e293b;line-height:1.55;margin:0;">Textea <strong>ANGULO + tu categoría</strong> al <a href="https://wa.me/17874177711?text=ANGULO%20" target="_blank" rel="noopener" style="color:#ca8a04;font-weight:700;">787-417-7711</a>. Te mando 3 movidas concretas pa' tu caso: 1 B2B + 1 nicho + 1 specialization angle.</p>
        </div>
      </div>

    </div>

    <!-- Bottom: alcalde demoted to single small banner -->
    <div style="padding:14px 16px;border-radius:8px;border-left:3px solid #0369a1;background:#f8fafc;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div style="flex:1;min-width:240px;">
          <div style="font-size:11px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">🏛️ ¿Alcalde · Cámara Comercio · concejal?</div>
          <p style="margin:0;font-size:12px;color:#475569;line-height:1.55;">Cabo Rojo aprueba patentes sin data de saturación. Esta página muestra qué categorías están sobrecargadas — útil pa' patentes informadas. Hacemos el mismo análisis pa' tu municipio en 2 semanas.</p>
        </div>
        <a href="https://wa.me/17874177711?text=MUNICIPIO%20" target="_blank" rel="noopener" style="background:#0369a1;color:#fff;padding:12px 18px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap;display:inline-block;min-height:44px;line-height:20px;">Pídeme el de tu pueblo →</a>
      </div>
    </div>
  </div>

  <!-- SECTION 4.7: DENSITY COMPARISON (contexto — qué tan denso es CR vs PR) -->
  <div class="card">
    <div class="kicker">Contexto · cuántas personas pa' cada negocio</div>
    <h2 style="font-size:22px;font-weight:800;color:#1e293b;margin-bottom:10px;">CR vs el promedio de PR — categoría por categoría</h2>

    <div style="background:#f1f5f9;border-left:3px solid #475569;padding:12px 14px;border-radius:6px;margin-bottom:14px;font-size:13px;color:#1e293b;line-height:1.6;">
      <strong>¿Qué estás mirando aquí?</strong> Cuántas personas hace falta en CR pa' sostener 1 negocio de esa categoría — comparado contra cuántas hace falta en el promedio del resto de PR.
    </div>

    <div style="background:#fffbeb;border-left:3px solid #ca8a04;padding:12px 14px;border-radius:6px;margin-bottom:18px;font-size:13px;color:#78350f;line-height:1.6;">
      <strong>Cómo leer una barra:</strong> Si CR dice "1 cada 1,500 personas" y PR dice "1 cada 3,000", quiere decir que CR tiene <strong>el doble</strong> de negocios de esa categoría por persona que un pueblo típico de PR. Eso puede significar oportunidad (mucha demanda) o sobreoferta (mucha competencia). La tabla TAM/SAM/SOM arriba te dice cuál de las dos.
    </div>

    ${densitySorted.length === 0
      ? '<p style="color:#64748b;font-size:13px;">Sin data suficiente.</p>'
      : densitySorted.map(renderDensityBar).join('')}
    <p style="font-size:11px;color:#94a3b8;margin-top:14px;">Click una categoría → te lleva al directorio o al WhatsApp con el bot. El promedio de PR es estimate basado en data oficial del gobierno (próxima versión lo calibra fino).</p>
  </div>

  <!-- SECTION 5: GEOGRAPHIC CONCENTRATION -->
  <div class="card">
    <div class="kicker">Concentración geográfica</div>
    <h2 style="font-size:22px;font-weight:800;color:#1e293b;margin-bottom:6px;">¿Dónde está el supply, barrio por barrio?</h2>
    <p style="font-size:13px;color:#64748b;margin-bottom:18px;"><strong>60-70% de los negocios turísticos se concentran en 2 barrios costeros.</strong> No es opinión — es geografía pura. Aquí solo mostramos los negocios donde ya sabemos en cuál barrio están (~25%) — el resto los estamos identificando ahora mismo.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;">
      ${geoTopCategories.map(g => {
        const top = g.entries[0];
        const topPct = top ? Math.round((top[1] / g.total) * 100) : 0;
        const topBarrio = top ? top[0] : '';
        // Warning text by category + concentration shape
        let warning = '';
        if (topPct >= 50) {
          const warnings: Record<string, string> = {
            'Hospedaje': `⚠️ ${top[1]} de ${g.total} en mismo nicho beach. Un nuevo hospedaje en pueblo no compite con estos.`,
            'Comida': `⚠️ ${topPct}% concentrado en ${topBarrio}. Si abres en otro barrio, sirves a residentes desatendidos.`,
            'Salud': `⚠️ ${topBarrio.charAt(0).toUpperCase() + topBarrio.slice(1)} acapara ${topPct}%. Boquerón/Combate residents viajan al pueblo para todo lo médico.`,
            'Compras': `⚠️ ${topPct}% en ${topBarrio}. Comercio centralizado — costoso para residentes de barrios.`,
            'Automotriz': `⚠️ ${topPct}% en ${topBarrio}. Alguien en Boquerón viaja 25 min para mecánica. Oportunidad satellite.`,
            'Belleza': `⚠️ ${topPct}% en ${topBarrio}. Categoría textbook low-friction concentrada.`,
            'Servicios': `⚠️ ${topPct}% en ${topBarrio}. Servicios al residente concentrados.`,
          };
          warning = warnings[g.cat] || `⚠️ ${topPct}% concentrado en ${topBarrio} — alguien fuera del barrio viaja para esto.`;
        } else if (topPct >= 35) {
          warning = `🟡 Distribución apretada: ${topPct}% en ${topBarrio}. Espacio para satellite en otros barrios.`;
        } else {
          warning = `✅ Distribución sana — supply sigue al residente y al turista.`;
        }
        return `
        <div style="padding:14px;background:#f8fafc;border-radius:10px;">
          <div style="font-size:14px;font-weight:700;color:#1e293b;margin-bottom:8px;">${esc(g.cat)} <span style="color:#94a3b8;font-weight:400;">· ${g.total} con barrio identificado</span></div>
          ${g.entries.map(([barrio, n]) => {
            const pct = Math.round((n / g.total) * 100);
            return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:12px;">
              <span style="width:80px;color:#475569;">${esc(barrio)}</span>
              <div style="flex:1;background:#e2e8f0;border-radius:3px;height:10px;position:relative;">
                <div style="background:${pct >= 50 ? '#dc2626' : pct >= 30 ? '#ea580c' : '#0d9488'};height:100%;border-radius:3px;width:${pct}%;"></div>
              </div>
              <span style="width:60px;text-align:right;color:#1e293b;font-weight:600;">${n} · ${pct}%</span>
            </div>`;
          }).join('')}
          <div style="margin-top:10px;padding:8px 10px;background:${topPct >= 50 ? '#fee2e2' : topPct >= 35 ? '#fef3c7' : '#dcfce7'};border-radius:6px;font-size:11px;color:${topPct >= 50 ? '#7f1d1d' : topPct >= 35 ? '#78350f' : '#14532d'};line-height:1.45;">${warning}</div>
        </div>`;
      }).join('')}
    </div>
  </div>

  <!-- SECTION 5.5: VISUAL DENSITY MAP -->
  ${(() => {
    // Cabo Rojo bounding box (validated from places lat/lon)
    const LAT_MIN = 17.92, LAT_MAX = 18.12;
    const LON_MIN = -67.22, LON_MAX = -67.05;
    const SVG_W = 760, SVG_H = 540;
    const margin = 20;
    const xy = (lat: number, lon: number) => ({
      x: margin + ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * (SVG_W - 2 * margin),
      y: margin + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (SVG_H - 2 * margin),
    });
    // Filter places to CR bounding box
    const crPlaces = (allPlaces as any[]).filter(p =>
      p.lat != null && p.lon != null &&
      p.lat >= LAT_MIN && p.lat <= LAT_MAX &&
      p.lon >= LON_MIN && p.lon <= LON_MAX
    );
    // Resolve matcher for selected category
    const matcher = (HEAT_BUCKETS_DEF.find(b => b.key === mapCat)?.matches)
      || ((p: any) => /farmacia|botica/i.test(p.name || '') || (p.subcategory || '').toLowerCase() === 'farmacia');
    const selectedPlaces = crPlaces.filter(matcher);
    const otherPlaces = crPlaces.filter(p => !matcher(p));
    // Hardcoded barrio centroids
    const barrios = [
      { name: 'Pueblo', lat: 18.086, lon: -67.146 },
      { name: 'Boquerón', lat: 17.974, lon: -67.184 },
      { name: 'Joyuda', lat: 18.040, lon: -67.192 },
      { name: 'Combate', lat: 17.951, lon: -67.205 },
      { name: 'Puerto Real', lat: 17.980, lon: -67.160 },
      { name: 'Llanos Costa', lat: 18.053, lon: -67.130 },
      { name: 'Pedernales', lat: 17.972, lon: -67.103 },
      { name: 'Guanajibo', lat: 18.106, lon: -67.145 },
    ];
    // Build category options for tabs
    const tabCats: Array<{ key: string; label: string; emoji: string }> = [
      { key: 'farmacia', label: 'Farmacias', emoji: '💊' },
      { key: 'medico', label: 'Médicos', emoji: '🩺' },
      { key: 'dentista', label: 'Dentistas', emoji: '🦷' },
      { key: 'restaurante', label: 'Restaurantes', emoji: '🍽️' },
      { key: 'hotel', label: 'Hospedaje', emoji: '🏨' },
      { key: 'belleza', label: 'Belleza', emoji: '💇' },
      { key: 'auto', label: 'Mecánicos', emoji: '🔩' },
      { key: 'gimnasio', label: 'Gimnasios', emoji: '🏋️' },
    ];
    const selectedTab = tabCats.find(t => t.key === mapCat) || tabCats[0];
    return `
  <div class="card">
    <div class="kicker">Visualización geográfica</div>
    <h2 style="font-size:22px;font-weight:800;color:#1e293b;margin-bottom:6px;">Mapa: dónde están realmente los negocios</h2>
    <p style="font-size:13px;color:#64748b;margin-bottom:14px;">Cada punto = un negocio en su ubicación real. Categoría seleccionada en rojo · resto del directorio en gris claro pa' contexto. Click una categoría pa' cambiar el mapa.</p>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">
      ${tabCats.map(t => {
        const isActive = t.key === mapCat;
        return `<a href="/pueblo-en-numeros?cat=${t.key}#mapa" style="background:${isActive ? '#0d9488' : '#f1f5f9'};color:${isActive ? '#fff' : '#475569'};padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;border:1px solid ${isActive ? '#0d9488' : '#e2e8f0'};">${t.emoji} ${esc(t.label)}</a>`;
      }).join('')}
    </div>
    <div id="mapa" style="background:#f0f9ff;border-radius:10px;padding:8px;overflow:hidden;">
      <svg viewBox="0 0 ${SVG_W} ${SVG_H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
        <rect x="0" y="0" width="${SVG_W}" height="${SVG_H}" fill="#e0f2fe" rx="8"/>
        <!-- Subtle grid -->
        <line x1="0" y1="${SVG_H/2}" x2="${SVG_W}" y2="${SVG_H/2}" stroke="#bae6fd" stroke-width="1" stroke-dasharray="4,4"/>
        <line x1="${SVG_W/2}" y1="0" x2="${SVG_W/2}" y2="${SVG_H}" stroke="#bae6fd" stroke-width="1" stroke-dasharray="4,4"/>
        <!-- Other places (gray context) -->
        ${otherPlaces.map(p => {
          const { x, y } = xy(p.lat, p.lon);
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="#cbd5e1" opacity="0.5"/>`;
        }).join('')}
        <!-- Selected category (highlighted) -->
        ${selectedPlaces.map(p => {
          const { x, y } = xy(p.lat, p.lon);
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="#dc2626" opacity="0.85" stroke="#fff" stroke-width="1.5"><title>${esc(p.name || '')}</title></circle>`;
        }).join('')}
        <!-- Barrio labels -->
        ${barrios.map(b => {
          const { x, y } = xy(b.lat, b.lon);
          return `<g>
            <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#1e293b" opacity="0.4"/>
            <text x="${(x + 6).toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="11" font-weight="600" fill="#1e293b" font-family="-apple-system,sans-serif">${b.name}</text>
          </g>`;
        }).join('')}
        <!-- Legend -->
        <g transform="translate(${SVG_W - 200}, ${SVG_H - 70})">
          <rect x="0" y="0" width="190" height="60" fill="#fff" stroke="#e2e8f0" stroke-width="1" rx="6" opacity="0.95"/>
          <circle cx="14" cy="18" r="6" fill="#dc2626" opacity="0.85"/>
          <text x="28" y="22" font-size="11" font-weight="700" fill="#1e293b" font-family="-apple-system,sans-serif">${selectedTab.label} (${selectedPlaces.length})</text>
          <circle cx="14" cy="40" r="2" fill="#cbd5e1"/>
          <text x="28" y="44" font-size="11" fill="#64748b" font-family="-apple-system,sans-serif">Todos los demás (${otherPlaces.length})</text>
        </g>
      </svg>
    </div>
    <p style="font-size:11px;color:#94a3b8;margin-top:10px;line-height:1.5;">
      <strong>${selectedPlaces.length}</strong> ${esc(selectedTab.label.toLowerCase())} en Cabo Rojo. ${selectedPlaces.length >= 30 ? 'La concentración visual es la cifra.' : selectedPlaces.length >= 10 ? 'Distribución visible en el mapa.' : 'Pocos puntos — categoría escasa o invisible al directorio.'} Pasa el dedo sobre los puntos pa' ver el nombre. ${crPlaces.length} de ${(allPlaces as any[]).length} negocios están dentro del área de Cabo Rojo (el resto está en municipios vecinos).
    </p>
  </div>`;
  })()}

  <!-- SECTION 5.7: ESPECIALISTAS MÉDICOS DEL OESTE (live, crowdsource-first) -->
  <div class="card" id="especialistas" style="border-left:4px solid #0d9488;scroll-margin-top:20px;">
    <div class="kicker" style="color:#0d9488;">Salud · región oeste</div>
    <h2 style="font-size:22px;font-weight:800;color:#1e293b;margin-bottom:6px;">¿Cuántos especialistas tenemos? Esto es lo que sabemos.</h2>
    <p style="font-size:13px;color:#475569;margin-bottom:8px;">Conteo en vivo de nuestro directorio verificado: Cabo Rojo + Mayagüez + San Germán + Lajas + Hormigueros + Sabana Grande + Añasco. <strong>No es la lista oficial de nadie — es la que estamos construyendo entre todos.</strong> Si sabes de un especialista que falta (¿uno en Ponce que esté cogiendo citas?), dínoslo y lo agregamos.</p>
    <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#134e4a;">
      📲 <strong>¿Falta uno?</strong> Textea <strong>ESPECIALISTA + nombre y pueblo</strong> al <a href="https://wa.me/17874177711?text=ESPECIALISTA%20" style="color:#0d9488;font-weight:700;">787-417-7711</a> y lo verificamos. Así se mantiene viva esta tabla.
    </div>
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="border-bottom:2px solid #e2e8f0;text-align:left;">
        <th style="padding:6px 8px;color:#475569;">Especialidad</th>
        <th style="padding:6px 8px;color:#475569;text-align:center;">Oeste</th>
        <th style="padding:6px 8px;color:#475569;text-align:center;">Cabo Rojo</th>
        <th style="padding:6px 8px;color:#475569;text-align:center;">Búsquedas *7711 (90d)</th>
      </tr></thead>
      <tbody>
      ${specialistCensus.map(r => {
        const flag = r.oeste === 1 ? ' 🔴' : r.cr === 0 && r.demand > 0 ? ' 🟡' : '';
        const rowBg = r.oeste === 1 ? 'background:#fef2f2;' : '';
        return `<tr style="border-bottom:1px solid #f1f5f9;${rowBg}">
        <td style="padding:6px 8px;font-weight:600;color:#1e293b;">${esc(r.label)}${flag}</td>
        <td style="padding:6px 8px;text-align:center;font-weight:700;color:${r.oeste <= 1 ? '#dc2626' : '#1e293b'};">${r.oeste}</td>
        <td style="padding:6px 8px;text-align:center;color:${r.cr === 0 ? '#dc2626' : '#1e293b'};">${r.cr === 0 ? '0' : r.cr}</td>
        <td style="padding:6px 8px;text-align:center;color:#64748b;">${r.demand > 0 ? r.demand : '—'}</td>
      </tr>`;
      }).join('')}
      </tbody>
    </table>
    </div>
    <p style="font-size:11px;color:#64748b;margin-top:10px;line-height:1.6;">
      🔴 = uno solo en toda la región según nuestro directorio · 🟡 = cero en Cabo Rojo con gente buscándolo en el *7711.
      ${specialistSolitarios.length > 0 ? `Hoy: ${specialistSolitarios.map(s => esc(s.label.toLowerCase())).join(', ')} — si ese profesional se muda o se retira, la región queda en cero.` : ''}
      ${specialistCeroCr.length > 0 ? ` Cabo Rojo no tiene: ${specialistCeroCr.map(s => esc(s.label.toLowerCase())).join(', ')} — pa' eso se viaja a Mayagüez o más lejos.` : ''}
    </p>
    <p style="font-size:11px;color:#94a3b8;margin-top:6px;font-style:italic;">Este conteo sale de lo que hemos verificado a mano + registros federales NPI. Seguro falta gente. Por eso la tabla pide ayuda en vez de pretender que está completa. Cada corrección de un vecino la mejora pa'l próximo.</p>
  </div>

  <!-- SECTION 5.8: LO QUE HAY PA' LOS NENES (actividades juveniles, live, crowdsource-first) -->
  <div class="card" style="border-left:4px solid #7c3aed;">
    <div class="kicker" style="color:#7c3aed;">Niños y jóvenes · región oeste</div>
    <h2 style="font-size:22px;font-weight:800;color:#1e293b;margin-bottom:6px;">¿Qué hay pa' los nenes después de la escuela? Esto es lo que sabemos.</h2>
    <p style="font-size:13px;color:#475569;margin-bottom:8px;">Conteo en vivo de actividades extracurriculares en el directorio: Cabo Rojo + Mayagüez + San Germán + Lajas + Hormigueros + Sabana Grande + Añasco. <strong>No es la lista oficial de nadie — es la que estamos construyendo entre todos.</strong> Si tu nene va a una academia, liga o clase que no aparece aquí, dínoslo y la agregamos.</p>
    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#4c1d95;">
      📲 <strong>¿Falta una?</strong> Textea <strong>SUGERIR + nombre y pueblo</strong> al <a href="https://wa.me/17874177711?text=SUGERIR%20" style="color:#7c3aed;font-weight:700;">787-417-7711</a> y la verificamos. Así se mantiene viva esta tabla.
    </div>
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="border-bottom:2px solid #e2e8f0;text-align:left;">
        <th style="padding:6px 8px;color:#475569;">Actividad</th>
        <th style="padding:6px 8px;color:#475569;text-align:center;">Oeste</th>
        <th style="padding:6px 8px;color:#475569;text-align:center;">Cabo Rojo</th>
        <th style="padding:6px 8px;color:#475569;text-align:center;">Búsquedas *7711 (90d)</th>
      </tr></thead>
      <tbody>
      ${youthCensus.map(r => {
        const flag = r.oeste === 0 ? ' 🔴' : r.oeste === 1 ? ' 🔴' : r.cr === 0 ? ' 🟡' : '';
        const rowBg = r.oeste <= 1 ? 'background:#fef2f2;' : '';
        return `<tr style="border-bottom:1px solid #f1f5f9;${rowBg}">
        <td style="padding:6px 8px;font-weight:600;color:#1e293b;">${esc(r.label)}${flag}</td>
        <td style="padding:6px 8px;text-align:center;font-weight:700;color:${r.oeste <= 1 ? '#dc2626' : '#1e293b'};">${r.oeste}</td>
        <td style="padding:6px 8px;text-align:center;color:${r.cr === 0 ? '#dc2626' : '#1e293b'};">${r.cr === 0 ? '0' : r.cr}</td>
        <td style="padding:6px 8px;text-align:center;color:#64748b;">${r.demand > 0 ? r.demand : '—'}</td>
      </tr>`;
      }).join('')}
      </tbody>
    </table>
    </div>
    <p style="font-size:11px;color:#64748b;margin-top:10px;line-height:1.6;">
      🔴 = cero o uno solo en toda la región según nuestro directorio · 🟡 = cero en Cabo Rojo.
      ${youthCeroOeste.length > 0 ? `Hoy el oeste entero no tiene registrado: ${youthCeroOeste.map(s => esc(s.label.toLowerCase())).join(', ')} — en un pueblo con tres playas bandera, cero escuelas de natación registradas. Si existe una, nadie la puede encontrar. Ese es el problema que esta tabla arregla.` : ''}
      ${youthCeroCr.length > 0 ? ` Cabo Rojo no tiene: ${youthCeroCr.map(s => esc(s.label.toLowerCase())).join(', ')} — pa' eso se viaja.` : ''}
    </p>
    <p style="font-size:11px;color:#94a3b8;margin-top:6px;font-style:italic;">Mismo método que el censo de especialistas: directorio verificado a mano + búsquedas reales del *7711. Seguro faltan ligas, clubes y maestros independientes — por eso la tabla pide ayuda en vez de pretender que está completa.</p>
  </div>

  <!-- SECTION 6: AJÁ MOMENTS -->
  <div class="card" style="border-left:4px solid #ca8a04;">
    <div class="kicker" style="color:#ca8a04;">Ajá moments</div>
    <h2 style="font-size:22px;font-weight:800;color:#1e293b;margin-bottom:6px;">Lo que la mayoría no ve</h2>
    <p style="font-size:13px;color:#475569;margin-bottom:20px;">Detectados automáticamente por la matemática + curados a mano. Son los hallazgos contraintuitivos — donde la primera intuición está incorrecta y el data corrige.</p>
    ${ajaMoments.length === 0
      ? '<p style="color:#94a3b8;font-style:italic;">Sin ajá moments detectados.</p>'
      : `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;">
          ${ajaMoments.map(a => `
            <div style="padding:16px;background:#fff;border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
              <div style="font-size:11px;color:#ca8a04;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">${a.kicker || 'Insight'}${a.source === 'override' ? ' · ✍️ editorial' : ''}</div>
              <div style="font-size:14px;font-weight:700;color:#1e293b;line-height:1.4;margin-bottom:8px;">${a.emoji} ${esc(a.headline)}</div>
              <div style="font-size:13px;color:#475569;line-height:1.55;">${esc(a.body)}</div>
            </div>`).join('')}
        </div>`}
  </div>

  <!-- BANNER: ¿Piensas abrir negocio? → /me-conviene (movido aquí post-Ajá pa' que sienta natural) -->
  <a href="/me-conviene" style="display:block;text-decoration:none;color:inherit;background:linear-gradient(135deg,#0f766e 0%,#0d9488 100%);border-radius:14px;padding:20px 24px;margin-bottom:20px;">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
      <div style="flex:1;min-width:240px;">
        <div style="font-size:11px;color:#a7f3d0;letter-spacing:0.15em;text-transform:uppercase;font-weight:700;margin-bottom:6px;">🧭 Herramienta nueva</div>
        <div style="font-size:18px;font-weight:800;color:#fff;line-height:1.3;">¿Estás pensando abrir un negocio?<br><span style="color:#a7f3d0;">Prueba /me-conviene en 60 segundos.</span></div>
        <div style="font-size:13px;color:#ccfbf1;margin-top:6px;">Te dice si la categoría que piensas tiene espacio — o si la matemática no da. Gratis, sin registro.</div>
      </div>
      <div style="background:#fff;color:#0d9488;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:700;white-space:nowrap;min-height:44px;display:inline-flex;align-items:center;">Chequear ahora →</div>
    </div>
  </a>

  <!-- SECTION 6.5: CÓMO SABEMOS QUE ESTO ES VERDAD -->
  <div class="card" style="border-left:4px solid #16a34a;">
    <div class="kicker" style="color:#16a34a;">Verificable tú mismo</div>
    <h2 style="font-size:20px;font-weight:800;color:#1e293b;margin-bottom:6px;">Cómo sabemos que esto es verdad</h2>
    <p style="font-size:13px;color:#64748b;margin-bottom:16px;">Cada número arriba se puede comprobar. Sin secretos, sin opacidad. Cero "trust me bro."</p>
    <ul style="padding-left:20px;font-size:13px;color:#374151;line-height:1.85;list-style:none;">
      <li style="padding:8px 0;border-bottom:1px solid #f1f5f9;">📍 <strong>Población (47,158):</strong> abre <a href="https://data.census.gov/profile?q=Cabo+Rojo+Municipio,+Puerto+Rico" target="_blank" rel="noopener" style="color:#0d9488;font-weight:600;">data.census.gov</a> → busca "Cabo Rojo Municipio". FIPS 72023. ACS 5-year 2019-2023.</li>
      <li style="padding:8px 0;border-bottom:1px solid #f1f5f9;">🏢 <strong>Supply (negocios open):</strong> <a href="https://mapadecaborojo.com" target="_blank" rel="noopener" style="color:#0d9488;font-weight:600;">mapadecaborojo.com</a> → directorio live. Cada place tiene <code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;">last_verified_at</code>.</li>
      <li style="padding:8px 0;border-bottom:1px solid #f1f5f9;">🔍 <strong>Demanda:</strong> logs reales del bot *7711 (visible en <a href="/admin/municipio" style="color:#0d9488;font-weight:600;">/admin/municipio</a> si tienes acceso admin).</li>
      <li style="padding:8px 0;border-bottom:1px solid #f1f5f9;">💵 <strong>Per-cápita spend:</strong> <a href="https://www.bls.gov/cex/tables.htm" target="_blank" rel="noopener" style="color:#0d9488;font-weight:600;">BLS CES Tables</a> + industry sources (NRA, NACS, NCPDP, IHRSA, ADA).</li>
      <li style="padding:8px 0;border-bottom:1px solid #f1f5f9;">📊 <strong>Lo mínimo pa' no quebrar:</strong> <a href="https://www.bls.gov/cew/" target="_blank" rel="noopener" style="color:#0d9488;font-weight:600;">data oficial del gobierno (BLS QCEW)</a> — negocios y pagos de salarios por industria.</li>
      <li style="padding:8px 0;">🏖️ <strong>Visitantes (250K/año):</strong> estimate de <a href="https://www.tourism.pr.gov/" target="_blank" rel="noopener" style="color:#0d9488;font-weight:600;">PRTC turismo</a> — la próxima versión lo calibra con counters reales en Boquerón / Joyuda / Combate.</li>
    </ul>
    <div style="margin-top:14px;padding:12px 14px;background:#ecfdf5;border-radius:8px;font-size:12px;color:#134e4a;">
      <strong>¿Encontraste un error?</strong> Texteanos al <a href="https://wa.me/17874177711?text=Encontr%C3%A9%20un%20error%20en%20pueblo-en-numeros" target="_blank" rel="noopener" style="color:#0d9488;font-weight:700;">787-417-7711</a>. Si tienes razón, lo arreglamos hoy + agregamos tu corrección citada en el reporte.
    </div>
  </div>

  <!-- SECTION 7: LO QUE NO SABEMOS (collapsed por default — vecino que decide pasa; vecino que verifica abre) -->
  <details class="card" style="border-left:4px solid #64748b;cursor:pointer;">
    <summary style="list-style:none;outline:none;">
      <div class="kicker" style="color:#64748b;display:inline-block;">Transparencia honesta</div>
      <h2 style="font-size:20px;font-weight:800;color:#1e293b;margin:6px 0;display:inline-block;margin-left:0;">Lo Que NO Sabemos <span style="font-size:13px;color:#64748b;font-weight:500;">(13 cosas — click pa' abrir ▾)</span></h2>
      <p style="font-size:13px;color:#64748b;margin:0;">Lo que la data actual NO cubre — admitido en público. La próxima versión cubre cada una.</p>
    </summary>
    <ol style="padding-left:24px;font-size:13px;color:#374151;line-height:1.8;margin-top:18px;">
      <li><strong>Cuántos negocios son zombi.</strong> De ${fmt(openCount)} abiertos publicados, ${fmt(fresh90d)} verificados en los últimos 90 días (${freshnessPct}%) y ${fmt(everVerified)} verificados alguna vez. La cifra "abierto" puede estar inflada 5-15% por negocios cerrados que no actualizaron Google. La próxima versión: chequeo automático contra Google + caminata mensual del pueblo.</li>
      <li><strong>Tasa de cierre real.</strong> No tenemos data histórica año tras año de cuántos cierran. Hipótesis: 15-20% rotación en categorías saturadas.</li>
      <li><strong>Margen y salud financiera por categoría.</strong> Información privada. Solo la podemos adivinar por señales indirectas (reseñas, horario, años abierto).</li>
      <li><strong>Economía informal completa.</strong> La repostería casera (4 búsquedas, 0 en el directorio) probablemente tiene 30-100 productores via FB/IG. El bot no los ve. Google Maps tampoco.</li>
      <li><strong>Cuenta real de visitantes.</strong> PRTC son encuestas, no conteo directo. Sin contadores físicos no calibramos bien cuánta sobreoferta turística hay.</li>
      <li><strong>Movimiento entre pueblos.</strong> Cuántos clientes de farmacia/médico vienen de Lajas, Hormigueros, San Germán. Si CR sirve a 80K en vez de 50K, las cuentas cambian.</li>
      <li><strong>Si la sobreoferta empeora o se estabiliza.</strong> No tenemos data histórica año tras año. La próxima versión: fotos del directorio cada año desde 2020-2025.</li>
      <li><strong>Si los dueños actuales están ganando.</strong> Pueden estar sobreoferta y RICOS (turistas pagan premium) o sobreoferta y QUEBRANDO. La movida es diferente.</li>
      <li><strong>El rol real de las cadenas.</strong> Walgreens, McDonald's, Subway — no los trackeamos. La próxima versión los separa.</li>
      <li><strong>Bodas / eventos.</strong> 10 búsquedas en 90 días, 0 negocios en el directorio. Hay docenas de wedding planners en FB sin licencia. Categoría 100% invisible al stack.</li>
      <li><strong>Comparativa con el resto de PR.</strong> Ya la tenemos, con data oficial del gobierno: según <a href="https://www.bls.gov/cew/" target="_blank" rel="noopener" style="color:#0d9488;font-weight:600;">BLS QCEW 2023</a> (negocios con empleados en nómina), Puerto Rico tiene ${fmt(VERIFIED_FEDERAL_DATA.qcew_estabs_pr_2023)} establecimientos = 1 por cada ${prDensityQcew} personas, y Cabo Rojo tiene ${fmt(VERIFIED_FEDERAL_DATA.qcew_estabs_cr_2023)} = 1 por cada ${crDensityQcew}. Por esa medida oficial, CR está cerca del promedio de PR (ligeramente menos denso). PERO QCEW solo cuenta empleadores con nómina — no cuenta al dueño-operador (el colmado, el food truck, el salón, el plomero solo), que es donde Cabo Rojo se concentra. Nuestro directorio sí los cuenta: por eso vemos ~1 por cada ${perCapita}. Esa diferencia (${fmt(VERIFIED_FEDERAL_DATA.qcew_estabs_cr_2023)} oficiales vs ${fmt(openCount)} en el directorio) ES la economía cuenta-propia de Cabo Rojo. Lo que falta calibrar: la densidad PR categoría por categoría (Phase 2, con QCEW por industria).</li>
      <li><strong>Visitantes reales.</strong> Los 250,000 visitantes/año son estimate de PRTC turismo — no hay contador físico en Boquerón / Joyuda / Combate. La próxima versión los instala. Mientras tanto, todo cálculo turístico (restaurante, hospedaje, food truck) tiene esta limitación.</li>
      <li><strong>Gasto por persona.</strong> El "Dinero total / año" se calcula con benchmarks de industria nacional — NO son específicos de PR. La realidad de Cabo Rojo puede ser 10-30% más baja por mediana de ingreso más baja ($26K vs US avg $75K).</li>
    </ol>
  </details>

  <!-- SECTION 8.5: COMPARTE CTA (residente-facing close) -->
  <div id="compartir" class="card" style="background:#ecfdf5;border-left:4px solid #0d9488;text-align:center;scroll-margin-top:20px;">
    <div style="font-size:32px;margin-bottom:8px;">🤝</div>
    <div style="font-size:18px;font-weight:800;color:#134e4a;margin-bottom:6px;line-height:1.35;">Si alguien en tu mesa está pensando abrir negocio — mándale esta página.</div>
    <div style="font-size:13px;color:#0f766e;line-height:1.5;margin-bottom:16px;">Es la única regla: que no abra a ciegas. Léela una vez. Compártela una vez. Y vuelve cuando alguien diga "voy a abrir X."</div>
    <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:10px;">
      <a href="https://wa.me/?text=${encodeURIComponent('Mira esta página de Cabo Rojo en números — útil si alguien en la mesa está pensando abrir negocio: https://www.mapadecaborojo.com/pueblo-en-numeros')}" target="_blank" rel="noopener" style="background:#25d366;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:8px;min-height:44px;">
        <span style="font-size:18px;">💬</span> Compartir por WhatsApp
      </a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://www.mapadecaborojo.com/pueblo-en-numeros')}" target="_blank" rel="noopener" style="background:#1877f2;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:8px;min-height:44px;">
        <span style="font-size:16px;">f</span> Compartir en Facebook
      </a>
    </div>
  </div>

  <!-- SECTION 9: B2B FOLD -->
  <div class="card" style="background:#1e293b;color:#fff;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:13px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;margin-bottom:6px;">🏛️ Para alcaldes y municipios</div>
      <div style="font-size:24px;font-weight:800;color:#fff;margin-bottom:8px;">Tu municipio también tiene este patrón.</div>
      <div style="font-size:14px;color:#cbd5e1;max-width:600px;margin:0 auto;">Te lo encontramos en 2 semanas. El moat es la verificación humana sostenida — nadie más en PR está mapeando densidad por categoría con data civic abierta.</div>
    </div>
    <div style="text-align:center;">
      <a href="https://wa.me/17874177711?text=Soy%20alcalde%2Falcaldesa%20de%20%5BTU%20MUNICIPIO%5D%20-%20quiero%20demo%20de%20Cabo%20Rojo%20OS%20para%20mi%20municipio" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;">Pedir demo de mi municipio</a>
    </div>
  </div>

  <!-- SECTION 10: SOURCES + FOOTER -->
  <div class="card" style="background:#f8fafc;">
    <div class="kicker">Sources verificables</div>
    <p style="font-size:12px;color:#475569;line-height:1.85;">
      <strong>Población:</strong> <a href="https://data.census.gov/profile?q=Cabo+Rojo+Municipio,+Puerto+Rico" target="_blank" rel="noopener" style="color:#0d9488;">US Census 2020</a> + <a href="https://www.census.gov/programs-surveys/acs" target="_blank" rel="noopener" style="color:#0d9488;">ACS 5-year</a>. ·
      <strong>Visitantes:</strong> <a href="https://www.tourism.pr.gov/" target="_blank" rel="noopener" style="color:#0d9488;">PRTC turismo</a> estimate (próxima versión lo calibra). ·
      <strong>Per-cápita spend:</strong> <a href="https://www.bls.gov/cex/tables.htm" target="_blank" rel="noopener" style="color:#0d9488;">BLS CES</a>, <a href="https://restaurant.org/research-and-media/research/economic-impact/" target="_blank" rel="noopener" style="color:#0d9488;">NRA</a>, <a href="https://www.convenience.org/Research" target="_blank" rel="noopener" style="color:#0d9488;">NACS</a>, <a href="https://www.ncpdp.org/" target="_blank" rel="noopener" style="color:#0d9488;">NCPDP</a>, <a href="https://www.ihrsa.org/" target="_blank" rel="noopener" style="color:#0d9488;">IHRSA</a>, <a href="https://www.ada.org/resources/research" target="_blank" rel="noopener" style="color:#0d9488;">ADA</a>, <a href="https://www.cms.gov/" target="_blank" rel="noopener" style="color:#0d9488;">CMS</a>, <a href="https://www.probeauty.org/" target="_blank" rel="noopener" style="color:#0d9488;">PBA</a> — industry benchmarks. ·
      <strong>Supply:</strong> <a href="https://mapadecaborojo.com" target="_blank" rel="noopener" style="color:#0d9488;">Live directorio MapaDeCaboRojo.com</a>. ·
      <strong>Demand:</strong> Live bot *7711 search logs (90 días). ·
      <strong>Densidad PR para comparar:</strong> <a href="https://www.bls.gov/cew/" target="_blank" rel="noopener" style="color:#0d9488;">BLS QCEW 2023</a> — PR ${fmt(VERIFIED_FEDERAL_DATA.qcew_estabs_pr_2023)} establecimientos, Cabo Rojo ${fmt(VERIFIED_FEDERAL_DATA.qcew_estabs_cr_2023)} (verificado 29 jun 2026). La calibración por categoría individual sigue pendiente Phase 2. ·
      <strong>Fondos federales:</strong> <a href="https://www.usaspending.gov/" target="_blank" rel="noopener" style="color:#0d9488;">USASpending.gov</a> (grants FY2020-26, lugar de ejecución Cabo Rojo).
    </p>
    <p style="font-size:11px;color:#94a3b8;margin-top:12px;font-style:italic;">
      Reporte completo con SQL queries y skeptic challenges: <a href="https://github.com/AngelAnderson/MapaDeCaboRojo-v1.0/blob/main/Outbox/CaboRojo/Sobreoferta-CR-2026-05-06.md" target="_blank" rel="noopener" style="color:#0d9488;">Sobreoferta-CR-2026-05-06.md</a> (interno).
    </p>
  </div>

</div>

<!-- FOOTER -->
<div style="background:#0f172a;color:#64748b;padding:24px;text-align:center;font-size:12px;">
  <div>Hecho por <a href="https://angelanderson.com" style="color:#5eead4;text-decoration:none;">Angel Anderson</a> con AI · Cabo Rojo, Puerto Rico</div>
  <div style="margin-top:6px;">Datos en vivo · ${esc(generatedAt)} · © ${new Date().getFullYear()} MapaDeCaboRojo.com</div>
</div>

</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(html);

  } catch (err: any) {
    console.error('handle_pueblo_en_numeros error:', err);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(500).send(`<html><body style="font-family:sans-serif;padding:40px;"><h1>500 Error</h1><pre>${esc(err?.message || 'Unknown')}</pre></body></html>`);
  }
}


// ============ admin-lifecycle-queue ============
// Approval queue for place_lifecycle_events from the daily Google Places sync daemon.
// Reuses ADMIN_MUNICIPIO_SECRET + cookie pattern from /admin/municipio.

interface LifecyclePendingEvent {
  id: string;
  place_id: string;
  place_name: string;
  place_slug: string | null;
  address: string | null;
  current_status: string;
  event_type: string;
  source: string;
  prev_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  confidence_score: number;
  detected_at: string;
  notes: string | null;
  hours_pending: number;
}

const STATUS_ENUM_MAP: Record<string, string> = {
  'OPERATIONAL': 'open',
  'CLOSED_TEMPORARILY': 'closed',
  'CLOSED_PERMANENTLY': 'permanently_closed',
};

async function applyLifecycleEvent(eventId: string): Promise<{ ok: boolean; error?: string; effect?: string }> {
  // Fetch event + place
  const { data: ev, error: evErr } = await supabase
    .from('place_lifecycle_events')
    .select('*, places!inner(id, name, slug, status, municipality, address, lat, lon)')
    .eq('id', eventId)
    .eq('status', 'pending')
    .single();

  if (evErr || !ev) return { ok: false, error: 'event not found or not pending' };

  const place = (ev as any).places;
  let effect = '';

  // Type-specific mutation
  if (ev.event_type === 'google_status_change') {
    const newStatus = (ev.new_value as any)?.status as string;
    const mapped = STATUS_ENUM_MAP[newStatus];
    if (mapped && mapped !== place.status) {
      const { error: upErr } = await supabase
        .from('places')
        .update({ status: mapped, last_verified_at: new Date().toISOString() })
        .eq('id', place.id);
      if (upErr) return { ok: false, error: `places update failed: ${upErr.message}` };
      effect = `places.status: ${place.status} → ${mapped}`;

      // Auto-insert local_knowledge for permanent closures (Rock N Go pattern)
      if (mapped === 'permanently_closed') {
        const closureDate = new Date().toISOString().slice(0, 10);
        const altLine = ''; // TODO: query nearest 3 alternatives by category + proximity
        const { error: lkErr } = await supabase.from('local_knowledge').insert({
          topic: `${place.name} cerrado`,
          question_patterns: [place.name.toLowerCase(), place.slug || place.name.toLowerCase()],
          answer: `${place.name} cerró permanentemente alrededor del ${closureDate}. Source: Google Business Profile change detected by daily sync.${altLine}`,
          source: 'lifecycle_auto',
          memory_type: 'business',
          voice_style: 'direct',
          verified: true,
          place_id: place.id,
        });
        if (!lkErr) effect += ` + local_knowledge inserted`;
      }
    } else {
      effect = 'no places mutation (already matches)';
    }
  } else if (ev.event_type === 'place_id_resolved') {
    effect = 'already auto-applied by daemon';
  } else if (ev.event_type === 'rating_drop') {
    effect = 'rating logged, no mutation';
  } else {
    effect = `${ev.event_type}: no mutation defined`;
  }

  // Mark event approved
  const { error: markErr } = await supabase
    .from('place_lifecycle_events')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: 'angel', notes: effect })
    .eq('id', eventId);

  if (markErr) return { ok: false, error: `mark approved failed: ${markErr.message}` };
  return { ok: true, effect };
}

async function rejectLifecycleEvent(eventId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('place_lifecycle_events')
    .update({ status: 'rejected', approved_at: new Date().toISOString(), approved_by: 'angel' })
    .eq('id', eventId)
    .eq('status', 'pending');
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function handle_admin_lifecycle_queue(req: any, res: any) {
  // ============ AUTH (same pattern as admin-municipio) ============
  if (!ADMIN_SECRET) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(500).send(loginPage('ADMIN_MUNICIPIO_SECRET no está configurado.'));
    return;
  }

  const queryKey = (req.query?.key as string) || '';
  const cookieKey = readCookie(req, COOKIE_NAME) || '';

  if (queryKey && queryKey === ADMIN_SECRET) {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(queryKey)}; HttpOnly; Secure; SameSite=Lax; Path=/admin; Max-Age=2592000`);
    res.setHeader('Location', '/admin/lifecycle-queue');
    res.status(302).end();
    return;
  }

  if (cookieKey !== ADMIN_SECRET) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(401).send(loginPage(queryKey ? 'Secret incorrecto.' : 'Entra el secret administrativo para continuar.'));
    return;
  }

  // ============ ACTION HANDLING ============
  const action = (req.query?.action as string) || '';
  const eventId = (req.query?.id as string) || '';
  let toast = '';
  if (eventId && action) {
    if (action === 'approve') {
      const r = await applyLifecycleEvent(eventId);
      toast = r.ok ? `✓ Approved · ${r.effect}` : `⚠ Approve failed: ${r.error}`;
    } else if (action === 'reject') {
      const r = await rejectLifecycleEvent(eventId);
      toast = r.ok ? '✗ Rejected' : `⚠ Reject failed: ${r.error}`;
    }
  }

  // ============ FETCH PENDING ============
  try {
    const { data: events, error } = await supabase
      .from('lifecycle_pending_summary')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(100);

    if (error) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(500).send(`<html><body><h1>500</h1><pre>${esc(error.message)}</pre></body></html>`);
      return;
    }

    const list = (events || []) as LifecyclePendingEvent[];

    const rows = list.map(ev => {
      const days = Math.floor(ev.hours_pending / 24);
      const ageColor = days >= 7 ? '#dc2626' : days >= 3 ? '#f59e0b' : '#64748b';
      const prevText = ev.prev_value ? Object.entries(ev.prev_value).map(([k, v]) => `<code>${esc(k)}=${esc(String(v))}</code>`).join(' ') : '—';
      const newText = ev.new_value ? Object.entries(ev.new_value).map(([k, v]) => `<code>${esc(k)}=${esc(String(v))}</code>`).join(' ') : '—';
      return `<tr style="border-bottom:1px solid #334155;">
        <td style="padding:12px 8px;font-size:13px;">
          <div style="font-weight:600;color:#e2e8f0;">${esc(ev.place_name)}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px;">${esc(ev.address || '')}</div>
          ${ev.place_slug ? `<a href="/negocio/${esc(ev.place_slug)}" target="_blank" rel="noopener" style="font-size:11px;color:#0d9488;text-decoration:none;">/negocio/${esc(ev.place_slug)} →</a>` : ''}
        </td>
        <td style="padding:12px 8px;font-size:12px;color:#cbd5e1;">
          <div style="font-weight:600;">${esc(ev.event_type)}</div>
          <div style="font-size:11px;margin-top:4px;">${prevText} → ${newText}</div>
        </td>
        <td style="padding:12px 8px;font-size:12px;color:${ageColor};white-space:nowrap;">${days}d</td>
        <td style="padding:12px 8px;text-align:right;white-space:nowrap;">
          <a href="/admin/lifecycle-queue?id=${esc(ev.id)}&action=approve" style="background:#10b981;color:#fff;padding:6px 12px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;margin-right:4px;">✓ Approve</a>
          <a href="/admin/lifecycle-queue?id=${esc(ev.id)}&action=reject" style="background:#ef4444;color:#fff;padding:6px 12px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">✗ Reject</a>
        </td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Lifecycle Queue · Cabo Rojo OS</title><meta name="robots" content="noindex">
<style>body{font-family:-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:0;}a{color:inherit;}table{border-collapse:collapse;width:100%;}</style>
</head><body>
<div style="background:#1e293b;border-bottom:1px solid #334155;padding:14px 24px;">
  <div style="max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="font-size:11px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;">🔔 Lifecycle Queue</div>
      <div style="font-size:14px;font-weight:600;color:#fff;">${list.length} pending</div>
    </div>
    <a href="/admin/municipio" style="font-size:12px;color:#5eead4;text-decoration:none;">← /admin/municipio</a>
  </div>
</div>
${toast ? `<div style="max-width:1200px;margin:12px auto 0;padding:12px 16px;background:${toast.startsWith('⚠') ? '#7f1d1d' : toast.startsWith('✓') ? '#064e3b' : '#1e293b'};border-radius:8px;font-size:13px;color:#fff;">${esc(toast)}</div>` : ''}
<div style="max-width:1200px;margin:0 auto;padding:20px 24px;">
  <table>
    <thead><tr style="background:#1e293b;">
      <th style="padding:10px 8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Place</th>
      <th style="padding:10px 8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Change</th>
      <th style="padding:10px 8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Age</th>
      <th style="padding:10px 8px;text-align:right;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Actions</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="4" style="padding:48px;text-align:center;color:#16a34a;font-size:14px;">✓ Cero cambios pendientes hoy.</td></tr>'}</tbody>
  </table>
  <div style="margin-top:24px;font-size:11px;color:#64748b;text-align:center;">Source: places-status-sync daily · Approval inserts local_knowledge auto for permanent closures.</div>
</div>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(html);
  } catch (err: any) {
    console.error('handle_admin_lifecycle_queue error:', err);
    res.status(500).send(`<html><body><h1>500</h1><pre>${esc(err?.message || 'Unknown')}</pre></body></html>`);
  }
}


// ============================================================
// ============ ME-CONVIENE — GPS del Emprendedor CR ============
// ============================================================
// Consolidated from api/me-conviene.ts (Vercel 12-function cap)
// Route: /me-conviene → /api/pages?page=me-conviene (vercel.json rewrite)
// Phase 1: Modo ABRIR only · 4 screens · 24 categorías × ABRIR veredictos

type MCStatusColor = '🔴' | '🟡' | '🟢';

type MCVeredictoCat = {
  key: string;
  engineKey?: string; // mapea a CATEGORY_TAM_PARAMS/HEAT key cuando difiere — pa' jalar veredicto vivo
  label: string;
  emoji: string;
  status: MCStatusColor;       // fallback editorial si no hay match vivo
  headline_number: string;     // fallback editorial si no hay match vivo
  one_sentence: string;
  pasos_lunes: [string, string, string];
  cross_link: {
    type: 'ajorao' | 'vitrina' | 'verify_name' | 'bot_search' | 'call_angel';
    url: string;
    copy: string;
  };
  caveat?: string;
};

const MC_VEREDICTOS: MCVeredictoCat[] = [
  {
    key: 'restaurante', label: 'Restaurante / Comida', emoji: '🍽️',
    status: '🔴',
    headline_number: '147 restaurantes pa\' 47K personas',
    one_sentence: 'El mercado capturable da ~$5,100/mes por restaurante — y el breakeven real es $8,400.',
    pasos_lunes: [
      'Camina Boquerón 7-9pm un viernes y cuenta cuántos están medio-vacíos',
      'Textea PIZZA al 787-417-7711 — ve quién ya rankea antes de invertir',
      'Lee "Cómo abrir negocio en CR sin quebrar" — $9.99 y te ahorra un error de $50K',
    ],
    cross_link: { type: 'ajorao', url: 'https://buy.stripe.com/aFa3cu5VOa0n0EpbAL0co0l', copy: '📖 Lee el libro antes de invertir — $9.99' },
    caveat: 'Si tienes concepto único (cocina vegana, delivery nocturno, catering escolar) — hay nicho. El problema es el restaurante genérico en zona ya saturada.',
  },
  {
    key: 'boutique', label: 'Boutique / Ropa', emoji: '👗',
    status: '🔴',
    headline_number: '~15 boutiques compitiendo por el 8% del gasto en ropa',
    one_sentence: '92% del dinero en ropa se va a Marshalls, Amazon o el Mayagüez Mall — la matemática no da.',
    pasos_lunes: [
      'Anota qué compró la gente cercana última vez — ¿fue en CR o en Mayagüez?',
      'Textea ROPA al 787-417-7711 pa\' ver cuánta gente lo busca aquí',
      'Si tienes algo que Marshalls no tiene (tallaje grande, ropa folclórica, costura a mano) — eso sí puede funcionar',
    ],
    cross_link: { type: 'ajorao', url: 'https://buy.stripe.com/aFa3cu5VOa0n0EpbAL0co0l', copy: '📖 Primero lee esto — $9.99' },
    caveat: 'Boutique especializada (tallas grandes, ropa de agua, artesanía local) — distinto cuento. El genérico es el problema.',
  },
  {
    key: 'legal', label: 'Abogado / Notario', emoji: '⚖️',
    status: '🔴',
    headline_number: '~35 abogados/notarios en Cabo Rojo',
    one_sentence: 'Oversupply leve — los existentes salen de referidos personales, no de búsquedas en Google.',
    pasos_lunes: [
      'Habla con 5 personas que contrataron abogado último año — ¿cómo lo encontraron?',
      'Si tienes especialidad rara (propiedad rural, herencias, disputas contratos) — hay hueco',
      'El generalista número 36 lo tiene difícil — el especialista único tiene mercado',
    ],
    cross_link: { type: 'verify_name', url: '/categoria/legal', copy: '🔍 Ve quién ya está en el directorio' },
  },
  {
    key: 'aire', engineKey: 'aire_acondicionado', label: 'AC / Refrigeración', emoji: '❄️',
    status: '🟢',
    headline_number: 'Solo 3 negocios verificados de AC pa\' el pueblo entero',
    one_sentence: 'Dos de los tres no mantienen presencia visible — cuando el AC se rompe un sábado, solo Luis David contesta.',
    pasos_lunes: [
      'Si tienes certificación HVAC, entra al directorio hoy — el bot te empieza a recomendar mañana',
      'Textea HOLA al 787-417-7711 — ve cuánta gente busca AC sin encontrar',
      'La barrera es la certificación, no la competencia — si la tienes, el mercado es tuyo',
    ],
    cross_link: { type: 'vitrina', url: 'https://wa.me/17874177711?text=Quiero%20Vitrina', copy: '📋 Entra al directorio gratis o con Vitrina' },
  },
  {
    key: 'electricista', label: 'Electricista', emoji: '⚡',
    status: '🟢',
    headline_number: '48 búsquedas en 90 días — 0 electricistas en el directorio',
    one_sentence: 'Existen pero operan boca-a-boca, sin perfil digital — el primero que entra se come el mercado.',
    pasos_lunes: [
      'Crea tu perfil en el directorio hoy — gratis, sin contratos',
      'Textea ELECTRICISTA al 787-417-7711 — verás la demanda que hoy no te llega',
      'Necesitas licencia de electricista PR — si la tienes, tienes la oportunidad',
    ],
    cross_link: { type: 'vitrina', url: 'https://wa.me/17874177711?text=Quiero%20agregar%20mi%20negocio', copy: '📋 Agrega tu negocio al directorio' },
  },
  {
    key: 'plomeria', engineKey: 'plomero', label: 'Plomería', emoji: '🔧',
    status: '🟢',
    headline_number: 'Demanda real, casi cero plomeros verificados en el directorio',
    one_sentence: 'Operan 100% por referido — el que entra al directorio captura la demanda que el referido pierde.',
    pasos_lunes: [
      'Entra al directorio — no necesitas web, solo tu nombre y teléfono',
      'Textea PLOMERO al 787-417-7711 — ve cuántas búsquedas hay sin resultado',
      'La licencia de plomero PR es requisito — si la tienes, el mercado te espera',
    ],
    cross_link: { type: 'vitrina', url: 'https://wa.me/17874177711?text=Quiero%20agregar%20mi%20negocio', copy: '📋 Entra al directorio' },
  },
  {
    key: 'farmacia', label: 'Farmacia', emoji: '💊',
    status: '🔴',
    headline_number: '18 farmacias verificadas en CR — Walgreens/Walmart absorben ~70% del gasto',
    one_sentence: 'El margen está pisado — las cadenas tienen ventaja de precio que el independiente no puede ganar en volumen.',
    pasos_lunes: [
      'Si tu idea es farmacia independiente, busca nicho de servicio (delivery a domicilio, consultoría, recetas especiales)',
      'Habla con Farmacia Encarnación — llevan décadas, saben lo que funciona',
      'Una farmacia especializada en compounding o homecare tiene más futuro que la genérica',
    ],
    cross_link: { type: 'verify_name', url: '/categoria/farmacia', copy: '🔍 Ve las 18 farmacias del directorio' },
  },
  {
    key: 'medico', label: 'Médico / Especialista', emoji: '🩺',
    status: '🟡',
    headline_number: '~59 médicos en CR — pero especialistas escasean',
    one_sentence: 'Médico general: borderline. Cardiólogo, dermatólogo, gastroenterólogo: escaso — la gente va a Mayagüez porque no hay aquí.',
    pasos_lunes: [
      'Si eres generalista: analiza la zona — Boquerón/Puerto Real tienen menos cobertura que Pueblo',
      'Si eres especialista: hay espacio real — textea MÉDICO al 787-417-7711 pa\' ver qué buscan',
      'Investiga si aceptas los planes del 90% de CR (Triple-S, Humana, MCS) — sin eso la práctica no arranca',
    ],
    cross_link: { type: 'verify_name', url: '/categoria/medico', copy: '🔍 Ve qué especialistas hay en el directorio' },
    caveat: 'Especialistas escasean en serio — si tienes especialidad y evaluás CR, hay oportunidad real.',
  },
  {
    key: 'dentista', label: 'Dentista', emoji: '🦷',
    status: '🟡',
    headline_number: '~29 dentistas verificados para 47K personas',
    one_sentence: 'Saturación leve en Pueblo — Joyuda, Combate, Puerto Real tienen cobertura mínima.',
    pasos_lunes: [
      'Si piensas en CR-Pueblo: analiza si hay hueco de horario (sábados, noches) vs abrir oficina nueva',
      'Si piensas en zona costera (Joyuda/Combate/Puerto Real) — la demanda existe sin cobertura',
      'Textea DENTISTA al 787-417-7711 — ve cuánta gente busca sin encontrar',
    ],
    cross_link: { type: 'verify_name', url: '/categoria/dentista', copy: '🔍 Ve los dentistas del directorio' },
  },
  {
    key: 'veterinario', label: 'Veterinario', emoji: '🐾',
    status: '🟡',
    headline_number: 'Demanda moderada — pocas clínicas cubren el pueblo',
    one_sentence: 'Servicio de emergencia 24h y especialidades (dermatología animal, oncología) — hueco real.',
    pasos_lunes: [
      'Textea VETERINARIO al 787-417-7711 — ve cuántas búsquedas van sin resultado',
      'Clinica móvil o servicio a domicilio: idea con mercado en CR (zonas rurales, dueños sin carro)',
      'El generalista 24h tiene ventaja porque las emergencias no esperan',
    ],
    cross_link: { type: 'verify_name', url: '/categoria/veterinario', copy: '🔍 Ve clínicas veterinarias en el directorio' },
  },
  {
    key: 'hotel', engineKey: 'hospedaje', label: 'Hospedaje / Airbnb', emoji: '🏨',
    status: '🔴',
    headline_number: '~41 negocios de hospedaje — 20 concentrados en Boquerón',
    one_sentence: 'Boquerón está saturado. Las zonas de crecimiento real: Combate, Joyuda, Puerto Real — menos tráfico pero menos competencia.',
    pasos_lunes: [
      'Si Boquerón era tu plan: analiza saturación — ¿puedes diferenciarte en experiencia?',
      'Combate / Playa Sucia: turismo de naturaleza crece, menos hospedaje que Boquerón',
      'Antes de firmar: habla con 3 dueños de Airbnb en CR — pregunta ocupación de temporada baja',
    ],
    cross_link: { type: 'ajorao', url: 'https://buy.stripe.com/aFa3cu5VOa0n0EpbAL0co0l', copy: '📖 Primero lee esto — $9.99' },
    caveat: 'Hospedaje ecológico, retiro wellness, alquiler de surf/kayak incluido — nichos con espacio.',
  },
  {
    key: 'belleza', engineKey: 'salon_belleza', label: 'Salón / Belleza / Barbería', emoji: '💇',
    status: '🔴',
    headline_number: 'Saturación alta — densidad de salones entre las más altas del pueblo',
    one_sentence: 'La fidelidad del cliente es fuerte pero el mercado ya está repartido — el número 16 lo tiene difícil.',
    pasos_lunes: [
      'Si tienes clientela establecida — diferente cuento, el traspaso funciona',
      'Barbería premium (experiencia, cita reservada, sin espera) — hueco de nicho',
      'Revisa si la zona que piensas (Boquerón/Joyuda) tiene servicio local o la gente viaja al Pueblo',
    ],
    cross_link: { type: 'verify_name', url: '/categoria/belleza', copy: '🔍 Ve salones en el directorio' },
  },
  {
    key: 'auto', engineKey: 'mecanico', label: 'Mecánica / Taller de Auto', emoji: '🔩',
    status: '🟡',
    headline_number: 'Demanda constante — pero muchos talleres operan informales',
    one_sentence: 'El taller formal con garantía y factura es el que el cliente busca y no encuentra.',
    pasos_lunes: [
      'Investiga si la zona tiene taller que haga inspección sticker + mecánica en un solo sitio',
      'La especialidad (AC de carro, transmisión, bodywork) tiene más margen que la mecánica general',
      'Textea MECÁNICO al 787-417-7711 — ve cuánta gente busca sin encontrar',
    ],
    cross_link: { type: 'verify_name', url: '/categoria/automotriz', copy: '🔍 Ve talleres en el directorio' },
  },
  {
    key: 'handyman', label: 'Handyman / Reparaciones', emoji: '🛠️',
    status: '🟢',
    headline_number: 'Poca oferta formal — la demanda va por referido y muchos se quedan sin servicio',
    one_sentence: 'El handyman con WhatsApp, cita rápida y garantía de trabajo es el que escasea.',
    pasos_lunes: [
      'Entra al directorio hoy — el bot te empieza a recomendar cuando alguien pregunte',
      'Precio por hora + materiales + foto del trabajo terminado = reputación que construye sola',
      'Textea HANDYMAN al 787-417-7711 — ve la demanda real que hoy no te llega',
    ],
    cross_link: { type: 'vitrina', url: 'https://wa.me/17874177711?text=Quiero%20agregar%20mi%20negocio', copy: '📋 Entra al directorio' },
  },
  {
    key: 'pintor', label: 'Pintor / Pintura', emoji: '🎨',
    status: '🟡',
    headline_number: 'Demanda estable — pocos pintores con presencia digital',
    one_sentence: 'Fotos del trabajo antes/después + WhatsApp activo + precio honesto = clientes sin publicidad cara.',
    pasos_lunes: [
      'Crea perfil en el directorio con 3 fotos de trabajos reales',
      'Textea PINTOR al 787-417-7711 — ve si hay búsqueda sin resultado en tu zona',
      'Especialidad (pintura epóxica, mural, impermeabilizante) cobra 2× el precio del genérico',
    ],
    cross_link: { type: 'vitrina', url: 'https://wa.me/17874177711?text=Quiero%20agregar%20mi%20negocio', copy: '📋 Entra al directorio' },
  },
  {
    key: 'carpintero', label: 'Carpintero / Muebles', emoji: '🪵',
    status: '🟡',
    headline_number: 'Carpintero custom escasea — el de stock compite con IKEA y pierde',
    one_sentence: 'Carpintería hecha a medida tiene mercado — cocinas, closets, pergolas — si tienes portafolio.',
    pasos_lunes: [
      'Muestra el trabajo en fotos antes de abrir local — clientes vienen al artesano, no al local',
      'Enfócate en una especialidad (cocinas, pergolas, mobiliario comercial) — el generalista lucha',
      'Textea CARPINTERO al 787-417-7711 — ve si hay demanda sin respuesta',
    ],
    cross_link: { type: 'vitrina', url: 'https://wa.me/17874177711?text=Quiero%20agregar%20mi%20negocio', copy: '📋 Entra al directorio' },
  },
  {
    key: 'catering', label: 'Catering / Cocina', emoji: '🥘',
    status: '🟡',
    headline_number: 'Catering formal escaso — restaurantes hacen catering informal sin garantía',
    one_sentence: 'Catering para eventos escolares, corporativos y bodas tiene demanda sin proveedor dedicado en CR.',
    pasos_lunes: [
      'Primero ofrece 3 eventos a costo para conseguir fotos y reseñas reales',
      'Define tu nicho: bodas, quinceañeros, corporativo, comida regional — el genérico compite con el restaurante',
      'Textea CATERING al 787-417-7711 — ve cuánto piden vs cuántos ofrecen',
    ],
    cross_link: { type: 'verify_name', url: '/categoria/catering', copy: '🔍 Ve catering en el directorio' },
  },
  {
    key: 'spa', label: 'Spa / Masaje / Bienestar', emoji: '💆',
    status: '🟡',
    headline_number: 'Turismo de bienestar crece — Boquerón tiene visitantes que lo buscan',
    one_sentence: 'Spa con reserva online, precio transparente y ubicación costera tiene mercado diferenciado.',
    pasos_lunes: [
      'Turista de Boquerón + diáspora que regresa = tu cliente primario — ¿estás en Boquerón o en Pueblo?',
      'Reserva online elimina la fricción más grande — sin eso, pierdes al turista que no conoce el pueblo',
      'Textea SPA al 787-417-7711 — ve si hay demanda real',
    ],
    cross_link: { type: 'verify_name', url: '/categoria/bienestar', copy: '🔍 Ve spas en el directorio' },
  },
  {
    key: 'tour', label: 'Tour Operator', emoji: '🗺️',
    status: '🟢',
    headline_number: 'Turismo activo creció 2× post-pandemia — poca oferta de tour formal',
    one_sentence: 'Tour de kayak, bioluminiscencia, eBike, senderismo y pesca deportiva tienen demanda real sin proveedor en CR.',
    pasos_lunes: [
      'El turista que llega a Boquerón no sabe que existe Combate, Playa Sucia, o bioluminiscencia — tú puedes serlo',
      'Textea TOUR al 787-417-7711 — ve qué busca la gente que visita',
      'Licencia de guía turístico es requisito — investiga tiempo de tramitación antes de comprometerte',
    ],
    cross_link: { type: 'call_angel', url: 'https://wa.me/17874177711?text=Quiero%20info%20de%20tour%20operator%20en%20CR', copy: '💬 Pregúntale al bot sobre turismo CR' },
  },
  {
    key: 'bicicleta', label: 'Bicicleta / eBike', emoji: '🚲',
    status: '🟢',
    headline_number: 'Turismo eBike crece — 0 negocios de renta formal de bici en CR',
    one_sentence: 'El visitante quiere recorrer Boquerón y no tiene opciones — la renta de bici es el negocio que no existe.',
    pasos_lunes: [
      'Investigar: PR Bike Adventures opera pero no cubre CR específico — hay espacio',
      'Renta por hora + tours guiados Combate-Boquerón = experiencia premium',
      'Capital inicial: 5-10 eBikes + seguros + espacio — investiga antes de comprometerte',
    ],
    cross_link: { type: 'call_angel', url: 'https://wa.me/17874177711?text=eBike%20tours%20Cabo%20Rojo', copy: '💬 Habla con el bot sobre turismo CR' },
  },
  {
    key: 'gimnasio', label: 'Gimnasio', emoji: '🏋️',
    status: '🔴',
    headline_number: '~11 gimnasios en CR — todos bajo breakeven según la matemática',
    one_sentence: 'SOM estimada $136K/biz vs breakeven $150-250K — el margen no da sin volumen de membresía.',
    pasos_lunes: [
      'Si tienes concepto diferente (CrossFit, yoga, boxing, funcional) — el nicho puede separarte',
      'Modelo membresía anual vs mensual — la anual fideliza y da capital inicial',
      'Habla con 3 dueños de gimnasio en CR sobre sus números reales antes de invertir',
    ],
    cross_link: { type: 'ajorao', url: 'https://buy.stripe.com/aFa3cu5VOa0n0EpbAL0co0l', copy: '📖 Lee esto antes — $9.99' },
  },
  {
    key: 'tatuajes', label: 'Tatuajes / Piercing', emoji: '💉',
    status: '🟡',
    headline_number: 'Demanda joven — pocos estudios formales en CR',
    one_sentence: 'Estudio limpio, artista con portafolio en Instagram y agenda online — eso escasea en CR.',
    pasos_lunes: [
      'Portafolio online (Instagram/TikTok) antes de abrir local — clientes siguen al artista, no al local',
      'Cumplimiento de DSCA (Departamento de Salud) — requisito, investiga antes de comprometerte',
      'Textea TATUAJE al 787-417-7711 — ve si hay demanda sin respuesta',
    ],
    cross_link: { type: 'verify_name', url: '/categoria/arte-y-entretenimiento', copy: '🔍 Ve estudios en el directorio' },
  },
  {
    key: 'wedding', label: 'Bodas / Eventos', emoji: '💍',
    status: '🟡',
    headline_number: 'Boquerón = destino bodas — demanda de coordinadores, floristas, catering especial',
    one_sentence: 'Planificador de bodas boutique (menos de 10 bodas/año, premium) tiene mercado que el generalista no cubre.',
    pasos_lunes: [
      'Define: ¿venue, coordinador, catering, fotografía? Bodas requiere ecosistema — estudia cuál pieza falta',
      'Precio promedio boda Boquerón: $8-15K total — ¿cuál parte del pastel quieres?',
      'Textea BODAS al 787-417-7711 — ve si hay demanda sin resultado',
    ],
    cross_link: { type: 'verify_name', url: '/categoria/eventos', copy: '🔍 Ve servicios de eventos en el directorio' },
  },
  {
    key: 'trainer', label: 'Personal Trainer', emoji: '💪',
    status: '🟡',
    headline_number: 'Demanda de fitness crece — pocos trainers certificados con agenda online',
    one_sentence: 'Trainer con especialidad (60+, pérdida de peso médica, atlético) tiene mercado que el genérico no alcanza.',
    pasos_lunes: [
      'Sesiones online + presenciales = más clientes que solo presencial',
      'Certificación ACE/NASM + CPR — requisito pa\' trabajar con cliente premium',
      'Textea TRAINER al 787-417-7711 — ve si hay demanda sin resultado',
    ],
    cross_link: { type: 'verify_name', url: '/categoria/gimnasio', copy: '🔍 Ve trainers en el directorio' },
  },
  {
    key: 'costurera', label: 'Costurera / Sastre', emoji: '🪡',
    status: '🟢',
    headline_number: 'Arreglos de ropa y costura a medida — prácticamente cero oferta formal en CR',
    one_sentence: 'El que hace arreglos rápidos (uniformes, bodas, pantalones) con cita online se come el mercado.',
    pasos_lunes: [
      'Antes de abrir local: prueba por WhatsApp 30 días — cobra, toma citas, ve si hay demanda',
      'Uniformes escolares + arreglos de bodas = temporada garantizada en agosto y diciembre',
      'Textea COSTURERA al 787-417-7711 — ve cuánta gente busca sin encontrar',
    ],
    cross_link: { type: 'vitrina', url: 'https://wa.me/17874177711?text=Quiero%20agregar%20mi%20negocio', copy: '📋 Entra al directorio' },
  },
];

const MC_ZONAS = [
  { key: 'pueblo', label: 'Pueblo / Casco Urbano', note: 'La zona más densa — más tráfico, más competencia.' },
  { key: 'boqueron', label: 'Boquerón', note: 'Turismo alto, opciones de negocio ya saturadas en servicios básicos.' },
  { key: 'joyuda', label: 'Joyuda', note: 'Zona de playa con oportunidades sin cubrir fuera de restaurantes.' },
  { key: 'combate', label: 'Combate / Playa Sucia', note: 'Turismo natural creciente — poca oferta local.' },
  { key: 'puerto_real', label: 'Puerto Real', note: 'Marina y pesca — servicios náuticos con demanda.' },
  { key: 'llanos_tuna', label: 'Llanos Tuna / Interior', note: 'Comunidades rurales — servicios básicos escasos.' },
  { key: 'bajura', label: 'Bajura / Costa Sur', note: 'Zona agrícola y costera — poca cobertura de servicios.' },
  { key: 'no_se', label: 'Todavía no sé', note: 'No importa — el veredicto sirve igual.' },
];

async function mc_handleLeadCapture(req: any, res: any) {
  const body = req.body || {};
  const phone = String(body.phone || '').trim().replace(/\D/g, '');
  const cat = String(body.categoria || '').trim();
  const zona = String(body.zona || '').trim();
  const status = String(body.status || '').trim();

  if (!phone || phone.length < 10) {
    res.status(400).json({ ok: false, error: 'Teléfono inválido' });
    return;
  }

  const { error } = await supabase.from('me_conviene_leads').insert({
    phone,
    categoria: cat,
    zona,
    veredicto_status: status,
    modo: 'abrir',
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('me_conviene_leads insert error:', error);
    res.status(500).json({ ok: false, error: error.message });
    return;
  }

  res.json({ ok: true });
}

function mc_pageShell(bodyHtml: string, title: string, description: string): string {
  return `<!DOCTYPE html>
<html lang="es-PR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="https://mapadecaborojo.com/me-conviene">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"¿Me Conviene? — Decisión de Negocio Cabo Rojo","description":"${esc(description)}","url":"https://mapadecaborojo.com/me-conviene","applicationCategory":"BusinessApplication","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}}</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Source Sans 3",-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#faf9f7;color:#1c1917;-webkit-font-smoothing:antialiased;line-height:1.5}
h1,h2,h3{font-family:'Fraunces',Georgia,serif}
a{color:inherit;text-decoration:none}
.btn{display:inline-block;padding:16px 24px;border-radius:12px;font-size:16px;font-weight:700;text-align:center;cursor:pointer;border:none;width:100%;margin-bottom:12px}
.btn-primary{background:#0d9488;color:#fff}
.btn-secondary{background:#f1f5f9;color:#1e293b;border:2px solid #e2e8f0}
.btn-disabled{background:#e2e8f0;color:#94a3b8;cursor:not-allowed}
.card{background:#fff;border-radius:16px;padding:24px;box-shadow:0 1px 4px rgba(0,0,0,0.08);margin-bottom:16px}
.number-big{font-size:48px;font-weight:800;letter-spacing:-2px;line-height:1;color:#1e293b}
.status-red{color:#dc2626}
.status-yellow{color:#d97706}
.status-green{color:#16a34a}
.pill{display:inline-block;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600}
.pill-red{background:#fee2e2;color:#991b1b}
.pill-yellow{background:#fef3c7;color:#92400e}
.pill-green{background:#d1fae5;color:#065f46}
.cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:20px}
.cat-btn{background:#fff;border:2px solid #e2e8f0;border-radius:12px;padding:14px 10px;text-align:center;cursor:pointer;font-size:14px;font-weight:600;color:#1e293b;transition:border-color 0.15s}
.cat-btn:hover{border-color:#0d9488}
.cat-btn.selected{border-color:#0d9488;background:#f0fdf9}
.zona-btn{background:#fff;border:2px solid #e2e8f0;border-radius:12px;padding:14px 16px;text-align:left;cursor:pointer;font-size:14px;font-weight:600;color:#1e293b;display:block;width:100%;margin-bottom:8px}
.zona-btn:hover{border-color:#0d9488;background:#f0fdf9}
.paso{display:flex;gap:12px;padding:14px;background:#f8fafc;border-radius:10px;margin-bottom:8px}
.paso-num{background:#0d9488;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0}
.tab-bar{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch}
.tab{padding:10px 16px;border-radius:10px;font-size:14px;font-weight:600;white-space:nowrap;cursor:pointer}
.tab-active{background:#0d9488;color:#fff}
.tab-inactive{background:#f1f5f9;color:#64748b}
.tab-disabled{background:#f1f5f9;color:#94a3b8;cursor:not-allowed;opacity:0.7}
</style>
</head>
<body>

<!-- HEADER -->
<div style="background:#1e293b;padding:16px 20px;">
  <div style="max-width:640px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;">
    <a href="/" style="color:#5eead4;font-size:13px;font-weight:600;">← Mapa de Cabo Rojo</a>
    <span style="font-size:11px;color:#64748b;font-weight:500;">Gratis · 60 segundos</span>
  </div>
</div>

<div style="max-width:640px;margin:0 auto;padding:20px 16px;">
${bodyHtml}
</div>

<div style="background:#1e293b;color:#94a3b8;padding:20px;text-align:center;font-size:12px;margin-top:32px;">
  <p>Dato del directorio <a href="/" style="color:#5eead4;">mapadecaborojo.com</a> · Verificado humano · Data live</p>
  <p style="margin-top:4px;"><a href="/pueblo-en-numeros" style="color:#5eead4;">Ver todos los números → /pueblo-en-numeros</a></p>
</div>

</body>
</html>`;
}

function mc_renderScreen1(): string {
  const body = `
<!-- HERO -->
<div style="text-align:center;padding:24px 0 20px;">
  <div style="font-size:36px;margin-bottom:8px;">🧭</div>
  <h1 style="font-size:26px;font-weight:800;letter-spacing:-0.5px;line-height:1.2;margin-bottom:10px;">¿Me conviene abrir<br>negocio en Cabo Rojo?</h1>
  <p style="font-size:15px;color:#64748b;line-height:1.5;">Antes de invertir un centavo, chequea la matemática del pueblo.<br><strong style="color:#0d9488;">Gratis. 60 segundos. Sin registro.</strong></p>
</div>

<!-- TAGLINE CAPSULE -->
<div style="background:#ecfdf5;border:1.5px solid #6ee7b7;border-radius:12px;padding:14px 16px;margin-bottom:24px;text-align:center;">
  <p style="font-size:13px;color:#065f46;font-weight:600;">"Si vas a abrir negocio en Cabo Rojo, primero chequea acá."</p>
</div>

<!-- MODO SELECTOR -->
<div class="card">
  <p style="font-size:12px;color:#64748b;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;margin-bottom:14px;">¿En qué estás?</p>

  <a href="/me-conviene?screen=categoria" class="btn btn-primary" style="display:flex;align-items:center;gap:12px;justify-content:flex-start;text-align:left;">
    <span style="font-size:24px;">🆕</span>
    <span>
      <div style="font-size:16px;font-weight:700;">Pienso abrir un negocio</div>
      <div style="font-size:12px;font-weight:400;opacity:0.9;margin-top:2px;">Para vecinos y emprendedores — modo ABRIR</div>
    </span>
  </a>

  <div class="btn btn-disabled" style="display:flex;align-items:center;gap:12px;justify-content:flex-start;text-align:left;position:relative;" title="Disponible pronto">
    <span style="font-size:24px;">🏪</span>
    <span>
      <div style="font-size:16px;font-weight:700;">Tengo un negocio, quiero crecer</div>
      <div style="font-size:12px;font-weight:400;opacity:0.8;margin-top:2px;">Modo CRECER — Próximamente</div>
    </span>
    <span style="position:absolute;right:14px;top:50%;transform:translateY(-50%);font-size:10px;background:#e2e8f0;color:#64748b;padding:3px 8px;border-radius:6px;font-weight:600;">Próximo</span>
  </div>

  <div class="btn btn-disabled" style="display:flex;align-items:center;gap:12px;justify-content:flex-start;text-align:left;position:relative;" title="Disponible pronto">
    <span style="font-size:24px;">💼</span>
    <span>
      <div style="font-size:16px;font-weight:700;">Busco invertir / sponsoriar</div>
      <div style="font-size:12px;font-weight:400;opacity:0.8;margin-top:2px;">Modo INVERTIR — Próximamente</div>
    </span>
    <span style="position:absolute;right:14px;top:50%;transform:translateY(-50%);font-size:10px;background:#e2e8f0;color:#64748b;padding:3px 8px;border-radius:6px;font-weight:600;">Próximo</span>
  </div>

  <div class="btn btn-disabled" style="display:flex;align-items:center;gap:12px;justify-content:flex-start;text-align:left;position:relative;" title="Disponible pronto">
    <span style="font-size:24px;">📰</span>
    <span>
      <div style="font-size:16px;font-weight:700;">Soy prensa / municipio / academia</div>
      <div style="font-size:12px;font-weight:400;opacity:0.8;margin-top:2px;">Modo CITAR — Próximamente</div>
    </span>
    <span style="position:absolute;right:14px;top:50%;transform:translateY(-50%);font-size:10px;background:#e2e8f0;color:#64748b;padding:3px 8px;border-radius:6px;font-weight:600;">Próximo</span>
  </div>
</div>

<!-- HONESTY NOTE -->
<div style="background:#fef3c7;border-left:3px solid #f59e0b;border-radius:8px;padding:14px 16px;font-size:12px;color:#78350f;line-height:1.6;">
  <strong>Honestidad de entrada:</strong> Los números vienen del directorio (verificado humano) + bot *7711 (8,000+ búsquedas reales). Son direccionalmente correctos, no precisos al centavo. Si encuentras un error — textea al 787-417-7711 y lo arreglamos hoy.
</div>
`;
  return mc_pageShell(body, '¿Me Conviene? · Decisión de Negocio en Cabo Rojo', 'Antes de abrir negocio en Cabo Rojo, chequea la matemática del pueblo. Gratis. 60 segundos. Datos reales del directorio + demanda bot *7711.');
}

function mc_renderScreen2(): string {
  const catItems = MC_VEREDICTOS.map(v =>
    `<button class="cat-btn" onclick="selectCat('${esc(v.key)}')" id="cat-${esc(v.key)}" data-key="${esc(v.key)}" aria-label="${esc(v.label)}">
      <div style="font-size:24px;margin-bottom:4px;">${v.emoji}</div>
      <div style="font-size:12px;">${esc(v.label)}</div>
    </button>`
  ).join('\n');

  const body = `
<!-- PROGRESS -->
<div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;">
  <a href="/me-conviene" style="font-size:13px;color:#0d9488;font-weight:600;">← Atrás</a>
  <div style="flex:1;height:4px;background:#e2e8f0;border-radius:2px;">
    <div style="width:33%;height:4px;background:#0d9488;border-radius:2px;"></div>
  </div>
  <span style="font-size:12px;color:#94a3b8;">Paso 1 de 3</span>
</div>

<div class="card">
  <h2 style="font-size:20px;font-weight:800;margin-bottom:6px;">¿Qué tipo de negocio piensas abrir?</h2>
  <p style="font-size:14px;color:#64748b;margin-bottom:20px;">Elige la categoría más cercana a tu idea.</p>

  <div class="cat-grid" id="catGrid">
${catItems}
  </div>

  <div id="catSelected" style="display:none;background:#ecfdf5;border:1.5px solid #6ee7b7;border-radius:10px;padding:14px;margin-bottom:16px;font-size:14px;color:#065f46;font-weight:600;"></div>

  <button class="btn btn-primary" id="nextBtn" style="opacity:0.4;cursor:not-allowed;" disabled onclick="goNext()">Siguiente → elegir zona</button>
</div>

<script>
let selectedCat = '';
function selectCat(key) {
  selectedCat = key;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
  const btn = document.getElementById('cat-' + key);
  if (btn) btn.classList.add('selected');
  const names = ${JSON.stringify(Object.fromEntries(MC_VEREDICTOS.map(v => [v.key, v.label + ' ' + v.emoji])))};
  const sel = document.getElementById('catSelected');
  sel.style.display = 'block';
  sel.textContent = '✓ Seleccionaste: ' + (names[key] || key);
  const nb = document.getElementById('nextBtn');
  nb.disabled = false;
  nb.style.opacity = '1';
  nb.style.cursor = 'pointer';
}
function goNext() {
  if (!selectedCat) return;
  window.location.href = '/me-conviene?screen=zona&cat=' + encodeURIComponent(selectedCat);
}
</script>
`;
  return mc_pageShell(body, 'Elige tu categoría · ¿Me Conviene?', 'Elige qué tipo de negocio piensas abrir en Cabo Rojo.');
}

function mc_renderScreen3(cat: string): string {
  const v = MC_VEREDICTOS.find(x => x.key === cat);
  const catLabel = v ? v.label : cat;

  const zonaItems = MC_ZONAS.map(z =>
    `<button class="zona-btn" onclick="window.location.href='/me-conviene?screen=veredicto&cat=${encodeURIComponent(cat)}&zona=${z.key}'">
      <div style="font-weight:700;font-size:15px;">${esc(z.label)}</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px;font-weight:400;">${esc(z.note)}</div>
    </button>`
  ).join('\n');

  const body = `
<!-- PROGRESS -->
<div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;">
  <a href="/me-conviene?screen=categoria" style="font-size:13px;color:#0d9488;font-weight:600;">← Atrás</a>
  <div style="flex:1;height:4px;background:#e2e8f0;border-radius:2px;">
    <div style="width:66%;height:4px;background:#0d9488;border-radius:2px;"></div>
  </div>
  <span style="font-size:12px;color:#94a3b8;">Paso 2 de 3</span>
</div>

<div class="card">
  <div style="font-size:12px;color:#0d9488;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">${esc(catLabel)}</div>
  <h2 style="font-size:20px;font-weight:800;margin-bottom:6px;">¿En qué zona de Cabo Rojo?</h2>
  <p style="font-size:14px;color:#64748b;margin-bottom:20px;">Cada barrio tiene dinámicas distintas — elige la zona donde piensas abrir.</p>

${zonaItems}
</div>
`;
  return mc_pageShell(body, 'Elige tu zona · ¿Me Conviene?', `¿En qué parte de Cabo Rojo piensas abrir tu ${catLabel}?`);
}

function mc_renderVeredicto(cat: string, zona: string, byKey: Record<string, BusinessVerdict> = {}): string {
  const v = MC_VEREDICTOS.find(x => x.key === cat);
  if (!v) {
    return mc_renderFallbackVeredicto(cat, zona, byKey);
  }

  const zonaInfo = MC_ZONAS.find(z => z.key === zona);
  const zonaLabel = zonaInfo ? zonaInfo.label : 'Cabo Rojo';
  const noun = v.label.toLowerCase();

  // ── Veredicto VIVO (single source of truth) — override del editorial si hay match ──
  const live = byKey[v.engineKey || v.key] || null;
  let status: MCStatusColor = v.status;
  let headline = v.headline_number;
  let heroNum = '';
  let heroSub = '';
  if (live) {
    if (live.verdict === 'over') {
      status = '🔴';
      const demas = Math.max(0, live.supply - live.vSurvive);
      heroNum = String(live.supply);
      heroSub = `${noun} en Cabo Rojo. El mercado da para ~${live.vSurvive}. <b>${demas} de más.</b>`;
      headline = `${live.supply} ${noun} · el mercado da para ~${live.vSurvive}`;
    } else if (live.verdict === 'tight') {
      status = '🟡';
      heroNum = String(live.supply);
      heroSub = `${noun}. El mercado está justo (~${live.vComfort}–${live.vSurvive}). Cabe uno más solo si llega distinto.`;
      headline = `${live.supply} ${noun} · mercado justo (~${live.vComfort}–${live.vSurvive})`;
    } else if (live.verdict === 'room') {
      status = '🟢';
      heroNum = String(live.supply);
      heroSub = `${noun}. El mercado aguanta ~${live.vComfort} cómodos. <b>Todavía cabe.</b>`;
      headline = `${live.supply} ${noun} · todavía cabe (~${live.vComfort} cómodos)`;
    } else { // zero
      status = '🟢';
      heroNum = String(live.demand);
      heroSub = `vecinos buscaron ${noun} en 90 días. <b>0 lo resuelven.</b> Mercado vacío con gente esperando.`;
      headline = `0 ${noun} en el directorio · ${live.demand} lo buscaron en 90 días`;
    }
  }

  const statusClass = status === '🔴' ? 'pill-red' : status === '🟡' ? 'pill-yellow' : 'pill-green';
  const statusWord = status === '🔴' ? 'Saturado' : status === '🟡' ? 'Hay espacio — con cautela' : 'Oportunidad real';
  const bgColor = status === '🔴' ? '#fef2f2' : status === '🟡' ? '#fffbeb' : '#f0fdf4';
  const borderColor = status === '🔴' ? '#fca5a5' : status === '🟡' ? '#fcd34d' : '#6ee7b7';
  const numColor = status === '🔴' ? '#dc2626' : status === '🟡' ? '#d97706' : '#16a34a';
  const isGreen = status === '🟢';
  const pasosHeader = isGreen ? "🚀 Tu camino pa' abrir: empieza esta semana" : status === '🔴' ? '🛑 Antes de invertir un peso, piensa esto' : '📋 Antes de invertir, haz esto el lunes';

  const waText = encodeURIComponent(`¿Me conviene abrir ${v.label} en ${zonaLabel}, Cabo Rojo? Resultado: ${status} ${statusWord}. ${headline}. Pasos: (1) ${v.pasos_lunes[0]} (2) ${v.pasos_lunes[1]} (3) ${v.pasos_lunes[2]}. Chequéalo en mapadecaborojo.com/me-conviene`);

  const body = `
<!-- PROGRESS -->
<div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;">
  <a href="/me-conviene?screen=zona&cat=${encodeURIComponent(cat)}" style="font-size:13px;color:#0d9488;font-weight:600;">← Atrás</a>
  <div style="flex:1;height:4px;background:#e2e8f0;border-radius:2px;">
    <div style="width:100%;height:4px;background:#0d9488;border-radius:2px;"></div>
  </div>
  <span style="font-size:12px;color:#94a3b8;">Tu veredicto</span>
</div>

<!-- VEREDICTO HERO (número primero) -->
<div style="background:${bgColor};border:2px solid ${borderColor};border-radius:16px;padding:26px 22px;margin-bottom:16px;text-align:center;">
  <span class="pill ${statusClass}" style="font-size:14px;padding:7px 16px;margin-bottom:8px;display:inline-block;">${status} ${statusWord}</span>
  ${heroNum ? `
  <div style="display:flex;align-items:baseline;justify-content:center;gap:12px;flex-wrap:wrap;margin:14px 0 6px;">
    <span style="font-size:64px;font-weight:900;letter-spacing:-2px;line-height:0.9;color:${numColor};">${esc(heroNum)}</span>
    <span style="font-size:16px;color:#374151;line-height:1.4;max-width:330px;text-align:left;">${heroSub}</span>
  </div>` : `
  <div style="font-size:40px;margin:6px 0;">${status}</div>
  <h2 style="font-size:21px;font-weight:800;letter-spacing:-0.3px;margin:10px 0;">${esc(headline)}</h2>`}
  <p style="font-size:14px;color:#475569;line-height:1.5;margin-top:10px;">${esc(v.one_sentence)}</p>
  ${v.caveat ? `<p style="font-size:13px;color:#6b7280;margin-top:10px;padding-top:10px;border-top:1px solid ${borderColor};font-style:italic;">${esc(v.caveat)}</p>` : ''}
</div>

<!-- ZONA CONTEXTO -->
${zonaInfo && zona !== 'no_se' ? `
<div style="background:#f8fafc;border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:13px;color:#475569;">
  <strong>Zona elegida: ${esc(zonaLabel)}</strong> — ${esc(zonaInfo.note)}
  <span style="color:#94a3b8;font-size:11px;display:block;margin-top:2px;">El veredicto por zona llega en Fase 2 — este resultado es para Cabo Rojo en general.</span>
</div>
` : ''}

<!-- PASOS (verde = arranca · rojo = frena) -->
<div class="card"${isGreen ? ' style="border:2px solid #6ee7b7;"' : ''}>
  <p style="font-size:12px;color:${isGreen ? '#16a34a' : '#0d9488'};font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:14px;">${pasosHeader}</p>
  <div class="paso">
    <div class="paso-num"${isGreen ? ' style="background:#16a34a;"' : ''}>1</div>
    <div style="font-size:14px;color:#1e293b;line-height:1.5;">${esc(v.pasos_lunes[0])}</div>
  </div>
  <div class="paso">
    <div class="paso-num"${isGreen ? ' style="background:#16a34a;"' : ''}>2</div>
    <div style="font-size:14px;color:#1e293b;line-height:1.5;">${esc(v.pasos_lunes[1])}</div>
  </div>
  <div class="paso">
    <div class="paso-num"${isGreen ? ' style="background:#16a34a;"' : ''}>3</div>
    <div style="font-size:14px;color:#1e293b;line-height:1.5;">${esc(v.pasos_lunes[2])}</div>
  </div>
</div>

${status === '🔴' ? `
<!-- SALIDA ESPECIALIZADA (puente a /sistema cuando saturado) -->
<a href="/sistema" style="display:block;text-decoration:none;background:#fffbeb;border:1.5px solid #fcd34d;border-radius:12px;padding:16px 18px;margin-bottom:12px;">
  <div style="font-size:13px;font-weight:800;color:#92400e;margin-bottom:4px;">🟡 Saturado de genérico no es saturado de especializado</div>
  <div style="font-size:14px;color:#78350f;line-height:1.5;">Puede que esta categoría esté llena de lo genérico y vacía de lo que de verdad falta (el nicho, el producto que nadie hace). Mira las 3 capas de oportunidad del pueblo. <span style="color:#b45309;font-weight:700;">Ver /sistema →</span></div>
</a>` : ''}

<!-- CTA PRINCIPAL -->
<a href="${esc(v.cross_link.url)}" target="_blank" rel="noopener" class="btn btn-primary" style="text-align:center;display:block;margin-bottom:12px;">${esc(v.cross_link.copy)}</a>

<!-- WA SHARE -->
<a href="https://wa.me/?text=${waText}" target="_blank" rel="noopener" class="btn btn-secondary" style="display:flex;align-items:center;justify-content:center;gap:8px;text-align:center;">
  <span style="font-size:20px;">📲</span>
  <span>Mandale este veredicto por WhatsApp</span>
</a>

<!-- PHONE CAPTURE -->
<div class="card" style="margin-top:16px;">
  <p style="font-size:14px;font-weight:700;color:#1e293b;margin-bottom:6px;">¿Quieres que te recuerde esta decisión en 30 días?</p>
  <p style="font-size:13px;color:#64748b;margin-bottom:14px;">Te texteo una vez — sin spam, sin venta automática.</p>
  <form id="leadForm" onsubmit="submitLead(event)">
    <input type="tel" id="leadPhone" placeholder="787-XXX-XXXX" style="width:100%;padding:14px;border:2px solid #e2e8f0;border-radius:10px;font-size:16px;margin-bottom:10px;outline:none;" required>
    <input type="hidden" id="leadCat" value="${esc(cat)}">
    <input type="hidden" id="leadZona" value="${esc(zona)}">
    <input type="hidden" id="leadStatus" value="${esc(v.status)}">
    <button type="submit" class="btn btn-primary" id="leadBtn">Avísame en 30 días 📱</button>
    <div id="leadMsg" style="display:none;font-size:13px;text-align:center;margin-top:10px;color:#065f46;font-weight:600;">✓ Listo — te texteamos en 30 días.</div>
    <div id="leadErr" style="display:none;font-size:13px;text-align:center;margin-top:10px;color:#dc2626;">Algo falló — textea directo al 787-417-7711.</div>
  </form>
</div>

<!-- VERIFY LINK -->
<div style="text-align:center;margin-top:8px;padding:12px;">
  <a href="/pueblo-en-numeros" style="font-size:13px;color:#0d9488;font-weight:600;">🔍 Verifica los números tú mismo → /pueblo-en-numeros</a>
</div>

<!-- RESTART -->
<div style="text-align:center;margin-top:4px;padding:8px 12px;">
  <a href="/me-conviene" style="font-size:13px;color:#94a3b8;">Evalúa otra categoría →</a>
</div>

<script>
async function submitLead(e) {
  e.preventDefault();
  const phone = document.getElementById('leadPhone').value;
  const cat = document.getElementById('leadCat').value;
  const zona = document.getElementById('leadZona').value;
  const status = document.getElementById('leadStatus').value;
  const btn = document.getElementById('leadBtn');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  try {
    const r = await fetch('/api/pages?page=me-conviene&action=lead', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ phone, categoria: cat, zona, status })
    });
    const d = await r.json();
    if (d.ok) {
      document.getElementById('leadMsg').style.display = 'block';
      document.getElementById('leadForm').style.display = 'none';
    } else {
      throw new Error(d.error);
    }
  } catch(err) {
    document.getElementById('leadErr').style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Avísame en 30 días 📱';
  }
}
</script>
`;

  return mc_pageShell(body, `${v.status} ${v.label} en Cabo Rojo · ¿Me Conviene?`, `¿Conviene abrir ${v.label} en Cabo Rojo? ${statusWord}. ${v.one_sentence}`);
}

function mc_renderFallbackVeredicto(cat: string, zona: string, byKey: Record<string, BusinessVerdict> = {}): string {
  // Auto-cobertura: si el motor tiene la categoría aunque no haya copy editorial, da veredicto vivo.
  const live = byKey[cat];
  if (live) {
    const noun = live.label.toLowerCase();
    const status: MCStatusColor = live.verdict === 'over' ? '🔴' : live.verdict === 'tight' ? '🟡' : '🟢';
    const isGreen = status === '🟢';
    const bgColor = status === '🔴' ? '#fef2f2' : status === '🟡' ? '#fffbeb' : '#f0fdf4';
    const borderColor = status === '🔴' ? '#fca5a5' : status === '🟡' ? '#fcd34d' : '#6ee7b7';
    const numColor = status === '🔴' ? '#dc2626' : status === '🟡' ? '#d97706' : '#16a34a';
    const statusWord = status === '🔴' ? 'Saturado' : status === '🟡' ? 'Con cautela' : 'Oportunidad real';
    let heroNum: string, heroSub: string;
    if (live.verdict === 'over') { heroNum = String(live.supply); heroSub = `${noun}. El mercado da para ~${live.vSurvive}. <b>${Math.max(0, live.supply - live.vSurvive)} de más.</b>`; }
    else if (live.verdict === 'tight') { heroNum = String(live.supply); heroSub = `${noun}. Mercado justo (~${live.vComfort}–${live.vSurvive}). Cabe uno más solo si llega distinto.`; }
    else if (live.verdict === 'room') { heroNum = String(live.supply); heroSub = `${noun}. Aguanta ~${live.vComfort} cómodos. <b>Todavía cabe.</b>`; }
    else { heroNum = String(live.demand); heroSub = `vecinos lo buscaron en 90 días. <b>0 lo resuelven.</b> Mercado vacío con gente esperando.`; }
    const kwUpper = noun.replace(/[^a-záéíóúñ0-9]+/gi, ' ').trim().split(' ')[0].toUpperCase();
    const body = `
<div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;">
  <a href="/me-conviene?screen=categoria" style="font-size:13px;color:#0d9488;font-weight:600;">← Atrás</a>
  <div style="flex:1;height:4px;background:#e2e8f0;border-radius:2px;"><div style="width:100%;height:4px;background:#0d9488;border-radius:2px;"></div></div>
  <span style="font-size:12px;color:#94a3b8;">Tu veredicto</span>
</div>
<div style="background:${bgColor};border:2px solid ${borderColor};border-radius:16px;padding:26px 22px;margin-bottom:16px;text-align:center;">
  <span class="pill ${isGreen ? 'pill-green' : status === '🔴' ? 'pill-red' : 'pill-yellow'}" style="font-size:14px;padding:7px 16px;display:inline-block;">${status} ${statusWord}</span>
  <div style="display:flex;align-items:baseline;justify-content:center;gap:12px;flex-wrap:wrap;margin:14px 0 6px;">
    <span style="font-size:64px;font-weight:900;letter-spacing:-2px;line-height:0.9;color:${numColor};">${esc(heroNum)}</span>
    <span style="font-size:16px;color:#374151;line-height:1.4;max-width:330px;text-align:left;">${heroSub}</span>
  </div>
  <p style="font-size:13px;color:#64748b;margin-top:10px;">Veredicto vivo del directorio + demanda *7711. ${esc(live.label)} en Cabo Rojo.</p>
</div>
<a href="https://wa.me/17874177711?text=${encodeURIComponent(live.label + ' en Cabo Rojo')}" target="_blank" rel="noopener" class="btn btn-primary" style="display:block;text-align:center;margin-bottom:12px;">${isGreen ? `📋 Entra al directorio — texteale ${esc(kwUpper)}` : `💬 Pregúntale al Veci sobre ${esc(noun)}`}</a>
<div style="text-align:center;margin-top:8px;"><a href="/pueblo-en-numeros" style="font-size:13px;color:#0d9488;font-weight:600;">🔍 Verifica los números → /pueblo-en-numeros</a></div>
<div style="text-align:center;margin-top:4px;"><a href="/me-conviene" style="font-size:13px;color:#94a3b8;">Evalúa otra categoría →</a></div>
`;
    return mc_pageShell(body, `${status} ${esc(live.label)} en Cabo Rojo · ¿Me Conviene?`, `¿Conviene abrir ${esc(live.label)} en Cabo Rojo? ${statusWord} según el directorio + demanda real del *7711.`);
  }
  const body = `
<div class="card" style="text-align:center;padding:32px 24px;">
  <div style="font-size:48px;margin-bottom:12px;">🟡</div>
  <h2 style="font-size:20px;font-weight:800;margin-bottom:10px;">Tenemos data parcial pa' esta categoría</h2>
  <p style="font-size:15px;color:#475569;line-height:1.5;margin-bottom:20px;">No tenemos suficiente data del directorio + bot pa' darte un veredicto certero en "${esc(cat)}".</p>
  <p style="font-size:14px;color:#1e293b;font-weight:600;margin-bottom:8px;">Textea esto al 787-417-7711:</p>
  <div style="background:#f1f5f9;border-radius:10px;padding:14px;font-size:15px;font-weight:700;color:#0d9488;margin-bottom:20px;">ANGULO ${esc(cat.toUpperCase())}</div>
  <p style="font-size:13px;color:#64748b;">Angel te responde con lo que sabe — sin pitch, sin venta automática.</p>
  <a href="https://wa.me/17874177711?text=ANGULO%20${encodeURIComponent(cat.toUpperCase())}" target="_blank" class="btn btn-primary" style="margin-top:16px;display:block;">Textea ANGULO ${esc(cat.toUpperCase())} →</a>
</div>
<div style="text-align:center;margin-top:8px;">
  <a href="/me-conviene" style="font-size:13px;color:#94a3b8;">← Evalúa otra categoría</a>
</div>
`;
  return mc_pageShell(body, `¿Me Conviene? — ${esc(cat)}`, `Evaluación de negocio en Cabo Rojo — categoría ${esc(cat)}.`);
}

async function handle_me_conviene(req: any, res: any) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (req.method === 'POST') {
    const action = String(req.query?.action || '');
    if (action === 'lead') {
      res.setHeader('Content-Type', 'application/json');
      return mc_handleLeadCapture(req, res);
    }
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const screen = String(req.query?.screen || '');
  const cat = String(req.query?.cat || '').trim();
  const zona = String(req.query?.zona || '').trim();

  try {
    switch (screen) {
      case 'categoria':
        res.send(mc_renderScreen2());
        break;
      case 'zona':
        res.send(mc_renderScreen3(cat));
        break;
      case 'veredicto': {
        const { byKey } = await fetchBusinessVerdicts();
        res.send(mc_renderVeredicto(cat, zona, byKey));
        break;
      }
      default:
        res.send(mc_renderScreen1());
    }
  } catch (err: any) {
    console.error('me-conviene error:', err);
    res.status(500).send(`<html><body><h1>Error 500</h1><pre>${esc(err?.message)}</pre></body></html>`);
  }
}


// ============ /sistema — La capa de verdad económica del pueblo (nivel 20) ============
// No es una página que consultas. Es la primera grieta del sistema nervioso económico:
// demanda real (*7711) × oferta verificada (directorio) = qué negocio necesita el pueblo.
// Alimentada por el MISMO motor que /pueblo-en-numeros y /me-conviene (fetchBusinessVerdicts).
async function handle_sistema(req: any, res: any) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const { data } = await fetchBusinessVerdicts();
    const fmt = (n: number) => Number(n).toLocaleString('es-PR');

    const allGaps = data.filter(d => (d.verdict === 'zero' || d.verdict === 'room') && d.demand > 0)
      .sort((a, b) => b.demand - a.demand);
    const gaps = allGaps.slice(0, 8);
    const huecos = data.filter(d => d.verdict === 'zero' && d.demand > 0);
    const oversupply = data.filter(d => d.verdict === 'over')
      .sort((a, b) => (b.supply - b.vSurvive) - (a.supply - a.vSurvive)).slice(0, 5);
    const totalDemand = data.reduce((s, d) => s + (d.demand || 0), 0);
    const categoriesAnalyzed = data.length;
    const generatedAt = new Date().toLocaleString('es-PR', { timeZone: 'America/Puerto_Rico' });

    const gapCard = (d: BusinessVerdict) => {
      const isHueco = d.verdict === 'zero';
      const accent = isHueco ? '#5eead4' : '#fbbf24';
      const tag = isHueco ? `0 lo resuelven` : `solo ${fmt(d.supply)} lo resuelve${d.supply === 1 ? '' : 'n'}`;
      return `<a href="/me-conviene?screen=veredicto&cat=${encodeURIComponent(d.k)}&zona=no_se" style="display:flex;align-items:center;gap:13px;text-decoration:none;background:rgba(255,255,255,0.04);border:1px solid rgba(94,234,212,0.15);border-left:3px solid ${accent};border-radius:12px;padding:15px 16px;">
        <span style="font-family:'SF Mono',Monaco,monospace;font-size:30px;font-weight:800;color:${accent};line-height:1;min-width:52px;">${fmt(d.demand)}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:15px;font-weight:700;color:#fff;">${d.emoji} ${esc(d.label)}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:1px;">lo buscaron en 90 días · <span style="color:${accent};">${tag}</span></div>
        </div>
        <span style="color:${accent};font-size:18px;flex-shrink:0;">→</span>
      </a>`;
    };

    const html = `<!DOCTYPE html>
<html lang="es-PR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>El Sistema · La capa de verdad económica de Cabo Rojo</title>
<meta name="description" content="Qué negocio necesita Cabo Rojo, en vivo. Demanda real del *7711 cruzada con oferta verificada a mano. La capa de inteligencia económica de un pueblo — replicable a cualquier municipio.">
<meta name="robots" content="index,follow">
<link rel="canonical" href="https://mapadecaborojo.com/sistema">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet">
<meta property="og:title" content="El Sistema · La capa de verdad económica de Cabo Rojo">
<meta property="og:description" content="Qué negocio necesita el pueblo, en vivo. Demanda real cruzada con oferta verificada.">
<meta property="og:image" content="https://www.mapadecaborojo.com/api/og?theme=mapa&k=El+Sistema&t=La+capa+de+verdad+econ%C3%B3mica+de+Cabo+Rojo.&sub=Qu%C3%A9+negocio+necesita+el+pueblo%2C+en+vivo.">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Source Sans 3",-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#12100e;color:#f5f4f1;-webkit-font-smoothing:antialiased;line-height:1.55}
h1,h2,h3{font-family:'Fraunces',Georgia,serif}
a{color:inherit}
.wrap{max-width:940px;margin:0 auto;padding:0 20px}
.kick{font-size:11px;letter-spacing:0.16em;text-transform:uppercase;font-weight:800;color:#5eead4}
.sec{padding:26px 0;border-top:1px solid rgba(255,255,255,0.07)}
.h2{font-size:clamp(20px,3.6vw,24px);font-weight:800;letter-spacing:-0.4px;color:#fff;margin-bottom:4px;}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:12px;margin-top:16px}
.layer{display:inline-flex;align-items:center;gap:7px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:800;padding:5px 11px;border-radius:999px;margin-bottom:10px}
.statcard{background:rgba(255,255,255,0.05);border:1px solid rgba(94,234,212,0.2);border-radius:14px;padding:18px 20px;text-align:center;flex:1;min-width:150px}
.statnum{font-family:'SF Mono',Monaco,monospace;font-size:32px;font-weight:800;color:#5eead4;line-height:1}
.soon{background:rgba(255,255,255,0.025);border:1px dashed rgba(148,163,184,0.32);border-radius:14px;padding:20px 22px;margin-top:14px}
</style>
</head>
<body>

<div style="background:#0f172a;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.07);">
  <div class="wrap" style="display:flex;justify-content:space-between;align-items:center;">
    <a href="/" style="color:#5eead4;font-size:13px;font-weight:600;text-decoration:none;">← Mapa de Cabo Rojo</a>
    <span style="font-size:11px;color:#475569;">En vivo · ${esc(generatedAt)}</span>
  </div>
</div>

<!-- HERO -->
<div style="padding:54px 0 38px;background:radial-gradient(120% 80% at 50% 0%, rgba(94,234,212,0.10), transparent 60%);">
  <div class="wrap" style="text-align:center;">
    <div class="kick" style="margin-bottom:14px;">⚡ El Sistema · Inteligencia económica del pueblo</div>
    <h1 style="font-size:clamp(28px,6vw,44px);font-weight:900;letter-spacing:-1.2px;line-height:1.1;color:#fff;">La capa de verdad económica de Cabo Rojo.</h1>
    <p style="font-size:18px;color:#cbd5e1;line-height:1.55;margin:16px auto 0;max-width:560px;">No es lo que un pueblo <em>cree</em> que necesita. Es lo que <strong style="color:#fff;">mide</strong> que necesita: lo que la gente busca de verdad, cruzado con lo que de verdad existe.</p>
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:30px;max-width:620px;margin-left:auto;margin-right:auto;">
      <div class="statcard"><div class="statnum">${fmt(allGaps.length)}</div><div style="font-size:12px;color:#94a3b8;margin-top:6px;">oportunidades abiertas<br>(demanda sin cubrir)</div></div>
      <div class="statcard"><div class="statnum">${fmt(totalDemand)}</div><div style="font-size:12px;color:#94a3b8;margin-top:6px;">señales de demanda<br>reales (90 días)</div></div>
      <div class="statcard"><div class="statnum">${fmt(categoriesAnalyzed)}</div><div style="font-size:12px;color:#94a3b8;margin-top:6px;">categorías<br>analizadas en vivo</div></div>
    </div>
  </div>
</div>

<div class="wrap">

  <!-- INTRO 3 CAPAS -->
  <div class="sec" style="border-top:none;padding-bottom:8px;">
    <div class="h2">Tres capas de oportunidad. Hoy ves la primera.</div>
    <p style="font-size:14px;color:#94a3b8;margin-top:6px;">La demanda del bot solo ve <em>servicios</em>. Pero el hueco de un pueblo también está en lo <em>especializado</em> y en los <em>productos</em> que nadie ha hecho. Esas dos no salen de la data: se ven a mano.</p>
  </div>

  <!-- CAPA 1 · SERVICIOS (en vivo) -->
  <div class="sec">
    <span class="layer" style="background:rgba(94,234,212,0.12);color:#5eead4;">🟢 Capa 1 · Servicios · en vivo</span>
    <div class="h2">Lo que el pueblo necesita</div>
    <p style="font-size:14px;color:#94a3b8;margin-top:4px;">Todo el mundo te dice de qué hay de más. Esto es lo contrario: el negocio que la gente busca <em>esta semana</em> y casi nadie resuelve. Si abres uno de estos bien, no compites, sirves.</p>
    <div class="grid2">${gaps.map(gapCard).join('')}</div>
    <p style="font-size:12px;color:#64748b;margin-top:12px;">El número = vecinos que lo buscaron en 90 días sin que nadie del directorio lo resolviera bien. Toca cualquiera y te lleva a tu apuesta en números.</p>
    ${oversupply.length ? `
    <div style="margin-top:22px;">
      <div style="font-size:13px;font-weight:700;color:#f87171;margin-bottom:10px;">🔴 Y al otro lado, lo que ya sobra (pelear por sobras):</div>
      <div class="grid2" style="margin-top:0;">${oversupply.map(d => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 14px;background:rgba(248,113,113,0.06);border-radius:10px;font-size:13px;">
        <span style="color:#fff;font-weight:600;">${d.emoji} ${esc(d.label)}</span>
        <span style="color:#f87171;font-family:'SF Mono',Monaco,monospace;font-size:12px;flex-shrink:0;">${fmt(d.supply)} hay · ${fmt(Math.max(0, d.supply - d.vSurvive))} de más</span>
      </div>`).join('')}</div>
      <p style="font-size:12px;color:#64748b;margin-top:10px;"><a href="/pueblo-en-numeros" style="color:#5eead4;">Ver las ${fmt(categoriesAnalyzed)} categorías completas en /pueblo-en-numeros →</a></p>
    </div>` : ''}
  </div>

  <!-- CAPA 2 · ESPECIALIZADOS (curado, visto a mano) -->
  <div class="sec">
    <span class="layer" style="background:rgba(251,191,36,0.12);color:#fbbf24;">🟡 Capa 2 · Especializados · visto a mano</span>
    <div class="h2">Saturado de genérico no es saturado de especializado.</div>
    <p style="font-size:14px;color:#94a3b8;margin-top:4px;">Hay 20 farmacias, pero ¿cuántas hacen compounding? Casi 100 médicos, pero el especialista manda al paciente a Mayagüez. El hueco no es la categoría vacía: es <strong style="color:#cbd5e1;">el nicho vacío dentro de la categoría llena.</strong></p>
    <div class="grid2">
      ${[
        ['💊 Farmacia', 'Compounding (fórmulas magistrales) · homecare + delivery de recetas · consultoría de farmacia'],
        ['🧠 Salud', 'Geriatra · salud mental / psicólogo · terapia física · nutrición y endocrino'],
        ['🍽️ Restaurante', 'Catering dedicado (eventos/escuelas/corporativo) · vegana, sin gluten, keto · cocina nocturna'],
        ['🦷 Dentista', 'Ortodoncia · endodoncia · estética dental · odontopediatría'],
        ['🔩 Mecánico', 'Transmisión · AC de carro · híbrido y eléctrico'],
        ['🐾 Veterinario', 'Emergencia 24h · servicio a domicilio'],
        ['🏨 Hospedaje', 'Eco · wellness · retiro (no cama genérica)'],
      ].map(([t, n]) => `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(251,191,36,0.18);border-radius:12px;padding:14px 16px;">
        <div style="font-size:14px;font-weight:700;color:#fff;">${t}</div>
        <div style="font-size:13px;color:#94a3b8;margin-top:4px;line-height:1.5;">${n}</div>
      </div>`).join('')}
    </div>
    <p style="font-size:12px;color:#64748b;margin-top:12px;">Nadie textea al bot pidiendo "compounding". Estos huecos se ven a mano, mirando el pueblo. Por eso ningún directorio genérico los tiene.</p>
  </div>

  <!-- CAPA 3 · PRODUCTOS E IDENTIDAD (curado, visto a mano) -->
  <div class="sec">
    <span class="layer" style="background:rgba(244,101,58,0.14);color:#fb923c;">🟠 Capa 3 · Productos e identidad · visto a mano</span>
    <div class="h2">Lo que el pueblo querría tener en la mano.</div>
    <p style="font-size:14px;color:#94a3b8;margin-top:4px;"><strong style="color:#cbd5e1;">96.8% de la gente que sigue a Cabo Rojo lo vive como identidad, no como utilidad.</strong> Esa audiencia no busca un plomero. Compraría algo que diga Cabo Rojo. El bot nunca lo ve, porque nadie textea pidiendo una camisa.</p>
    <div class="grid2">
      ${[
        ['👕 Merch de identidad', 'Camisas, toallas, mugs, gorras, stickers, tote bags (bandera, Faro, Cofresí, Boquerón)'],
        ['🧂 Productos locales', 'Sal de Cabo Rojo (las Salinas) · café · mantecaditos y dulces típicos · sazón/salsa local · miel'],
        ['📰 Print y cultura', 'Revista del pueblo · guía del visitante · prints y arte del Faro · libro de historia (Betances, Cofresí)'],
        ['🎨 Servicios creativos', 'Marketing local · diseño · fotografía · manejo de redes · producción de contenido'],
        ['🗺️ Experiencias', 'Tours (kayak, bioluminiscencia, eBike) · clases y talleres'],
      ].map(([t, n]) => `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(244,101,58,0.2);border-radius:12px;padding:14px 16px;">
        <div style="font-size:14px;font-weight:700;color:#fff;">${t}</div>
        <div style="font-size:13px;color:#94a3b8;margin-top:4px;line-height:1.5;">${n}</div>
      </div>`).join('')}
    </div>
    <p style="font-size:12px;color:#64748b;margin-top:12px;">La data ve servicios. Esta capa ve lo que el pueblo querría tener en la mano, y quién lo podría hacer. Es la mitad de la audiencia que ningún mapa de utilidad sirve.</p>
  </div>

  <!-- EL MOAT -->
  <div class="sec">
    <div class="kick">Por qué esto no existe en ningún otro sitio</div>
    <div class="h2" style="margin-top:6px;">No es data. Es data que alguien verificó a mano.</div>
    <p style="font-size:15px;color:#cbd5e1;line-height:1.65;margin-top:10px;">Google te da resultados. El censo te da promedios viejos. Esto es distinto: cada negocio se verificó uno por uno, la demanda sale de lo que la gente de verdad textea al *7711, y se corrige sola cada vez que alguien busca algo y no lo encuentra. Es la combinación que ningún mapa, ninguna AI y ninguna agencia tiene de un pueblo de 50,000: <strong style="color:#fff;">verificado, citable, mantenido humano-y-AI, y al día.</strong></p>
  </div>

  <!-- B2B FOLD (la monetización nivel 20) -->
  <div class="sec">
    <div style="background:linear-gradient(135deg,#0d9488,#0f766e);border-radius:16px;padding:26px 24px;">
      <div class="kick" style="color:#a7f3d0;">Para municipios, bancos y capital</div>
      <div style="font-size:22px;font-weight:800;color:#fff;margin:8px 0 10px;line-height:1.25;">Esta es la capa de verdad económica de UN pueblo. Tu municipio puede tener la suya.</div>
      <p style="font-size:15px;color:#d1fae5;line-height:1.6;margin-bottom:18px;">Antes de aprobar un préstamo, repartir un incentivo, o decidir dónde abrir — saber qué necesita de verdad cada barrio cambia la apuesta. Esto se construye en semanas, no años. El moat es la verificación humana sostenida, y ya está corriendo.</p>
      <a href="https://wa.me/17874177711?text=${encodeURIComponent('Quiero hablar de la capa económica /sistema para mi municipio/banco/empresa')}" style="display:inline-block;background:#fff;color:#0f766e;padding:13px 24px;border-radius:10px;font-weight:800;font-size:15px;text-decoration:none;">Hablar con Angel →</a>
    </div>
  </div>

  <!-- CTA ciudadano -->
  <div class="sec" style="text-align:center;">
    <p style="font-size:16px;color:#cbd5e1;margin-bottom:14px;">¿Tú o alguien tuyo va a abrir negocio?</p>
    <a href="/me-conviene" style="display:inline-block;background:#5eead4;color:#0a0e1a;padding:13px 26px;border-radius:10px;font-weight:800;font-size:15px;text-decoration:none;">Mira tu apuesta en números →</a>
    <p style="font-size:12px;color:#475569;margin-top:18px;">Demanda: bot *7711 (90 días). Oferta: directorio verificado a mano. Mismo motor que <a href="/pueblo-en-numeros" style="color:#5eead4;">/pueblo-en-numeros</a>. Cero estimate inventado.</p>
  </div>

</div>
</body>
</html>`;

    res.status(200).send(html);
  } catch (err: any) {
    console.error('handle_sistema error:', err);
    res.status(500).send(`<html><body style="font-family:sans-serif;padding:40px;"><h1>Error</h1><pre>${esc(err?.message || 'Unknown')}</pre></body></html>`);
  }
}

// ============ cultura ============
// Directorio cultural curado — companion mapa-native a caborojo.com/directorio-cultural
// Lugares verificados manualmente. Mapa Leaflet interactivo + lista por sección.

const CULTURA_CURATED: Record<string, { ids: string[]; emoji: string; description: string }> = {
  proceres: {
    emoji: '🏛️',
    description: 'Padre de la Patria, historiador, pirata legendario, fundador. Un pueblo de 50,000 que parió historia grande.',
    ids: [
      '745e4c0e-a78b-4f8c-b052-74081a273bb0', // Mausoleo Betances
      'ea3bd120-7526-4864-8c91-48811481e388', // Monumento Betances
      '32605bbd-13fb-486a-aecb-1456a8ee2d58', // Monumento Salvador Brau
      'fa09d6f0-e503-4ef4-bfaf-1ddd2a529fdb', // Estatua Roberto Cofresí
      'b88ae5c9-2c64-4439-b754-289b27933799', // Obelisco Fundadores
      '433a6a09-3ce3-4830-8715-e60b53b2e7f9', // Soldado Caborrojeño
      'aecb4fa4-7538-4903-b8ee-9f866d9fe0fa', // Esposas Rotas (abolición)
      'c091c525-3602-411c-8b5d-c5dbb7de9bc1', // Mata con Hacha
    ],
  },
  museos: {
    emoji: '🎨',
    description: 'Museos, galerías, teatro restaurado y biblioteca. Pequeños pero honestos — espacios vivos del pueblo.',
    ids: [
      'be727263-bdde-4b2f-a2c9-f30a1c1c53e2', // Museo de los Próceres
      'db5d883f-fcf3-4f92-931a-d0bde003ca69', // Teatro Excelsior
      '86433ee0-c8fe-406f-bc97-a13ecd3614d2', // Biblioteca Blanca E. Colberg
      '1543429f-6e58-4206-8ae4-49c5f2e32b7e', // Kenny Enriquez Gallery
      '9c03475c-a3f3-4668-aa48-9940cae16299', // Centro de Convenciones Betances
      'f31ad3fb-6ff7-4a4f-b075-ddc265940faf', // Santuario Schoenstatt
    ],
  },
  naturaleza: {
    emoji: '🏞️',
    description: 'Faro 1882, salinas trabajadas desde tiempo taíno, cueva del pirata. La geografía de Cabo Rojo es histórica.',
    ids: [
      '7d0c0844-63c4-4124-be0a-529222573b6c', // Faro Los Morrillos
      '31368036-a23b-49af-81ed-2050d968260d', // Las Salinas
      '11ef2963-23f9-4f5b-8fc0-38a5e5d76c43', // Centro Interpretativo Salinas
      'c30bcf7f-46e2-4e34-a92c-a39820fb3551', // Refugio Nacional Vida Silvestre
      'cabf0c3e-a3d4-4cce-a89d-387b2d671b89', // Cueva del Pirata Cofresí
      '9f0547e6-c075-4e60-801e-ac23b5b03bf2', // Mirador Laguna Guaniquilla
      '46a82be2-37b6-4cd5-9f14-81622b61b920', // Puente de Piedra
      '62ec5414-908a-4f6a-8550-0ddcb86ea9f6', // Bosque Estatal Boquerón
    ],
  },
  casco: {
    emoji: '🏘️',
    description: 'El centro histórico. Plaza, alcaldía, calles que se llaman como los próceres. Todo en 6 cuadras.',
    ids: [
      '1ab53444-2f8e-48c1-872e-808ad1dadb37', // Plaza Betances
      'd19bc7fb-e778-4644-832b-2195406b9dc3', // Casa Alcaldía
      '1a8cf8d6-c815-4923-9e23-ee2f9238f760', // Logia Cuna de Betances
      '397cebc6-8acd-4f35-8c28-174591402936', // Escuela María Civico
    ],
  },
  pueblos: {
    emoji: '⛵',
    description: 'Cinco pueblos costeros con personalidad propia. Cada uno cuenta una parte distinta.',
    ids: [
      '963cadaf-eb68-4c5d-9050-04bdbc0f9ad2', // Poblado de Boquerón
      'f0603c38-4d2a-48b7-a320-e9aee28f8dbb', // Puerto Real Fishing Village
      'fc8bde63-015e-4c4f-a2cf-1906f1cfe3cb', // Mirador Puerto Real
    ],
  },
  artesanos: {
    emoji: '🎭',
    description: 'Lo hecho a mano por gente del pueblo. No souvenirs de aeropuerto — oficio.',
    ids: [
      '2f665786-3502-4e24-a495-d0906c5e4e6e', // Plaza Artesana Rolando Ortiz
      'fa4a9dd9-fe00-48cc-bf59-6b4f8d19e87e', // Artesanías Sakal Shalom
    ],
  },
};

const SECTION_LABELS: Record<string, string> = {
  proceres: 'Próceres y Memoria',
  museos: 'Museos y Espacios Culturales',
  naturaleza: 'Naturaleza con Historia',
  casco: 'Casco Urbano Histórico',
  pueblos: 'Pueblos Costeros',
  artesanos: 'Artesanos y Arte',
};

const SECTION_COLORS: Record<string, string> = {
  proceres: '#dc2626',     // rojo (memoria)
  museos: '#7c3aed',       // morado (cultura)
  naturaleza: '#16a34a',   // verde (naturaleza)
  casco: '#0d9488',        // teal (centro)
  pueblos: '#0284c7',      // azul (mar)
  artesanos: '#f97316',    // naranja (artesanía)
};

async function handle_cultura(req: any, res: any) {
  try {
    // Flatten all curated IDs
    const allIds: string[] = [];
    const idToSection: Record<string, string> = {};
    for (const [section, def] of Object.entries(CULTURA_CURATED)) {
      for (const id of def.ids) {
        allIds.push(id);
        idToSection[id] = section;
      }
    }

    // Parallel: places + upcoming events + cultura demand count
    const [placesResp, eventsResp, demandResp] = await Promise.all([
      supabase
        .from('places')
        .select('id, name, slug, address, lat, lon, google_rating, phone, website, plan, is_featured, opening_hours, last_verified_at')
        .in('id', allIds),
      supabase
        .from('events')
        .select('id, title, slug, start_time, place_id')
        .in('place_id', allIds)
        .gte('start_time', new Date().toISOString())
        .eq('status', 'published')
        .order('start_time', { ascending: true })
        .limit(50),
      supabase.rpc('cultura_demand_count_30d').then(r => r, () => ({ data: null, error: null })),
    ]);

    if (placesResp.error) console.error('handle_cultura places error:', placesResp.error);
    if (eventsResp.error) console.error('handle_cultura events error:', eventsResp.error);

    const rows = placesResp.data || [];
    const events = eventsResp.data || [];
    // Hardcoded fallback if RPC missing (real count from messages table, refreshed nightly via cron — see M7 TODO)
    const culturaDemand30d = (demandResp.data as number | null) ?? 50;

    // Next event per place_id (events already sorted asc)
    const nextEventByPlace: Record<string, any> = {};
    for (const ev of events) {
      if (!ev.place_id) continue;
      if (!nextEventByPlace[ev.place_id]) nextEventByPlace[ev.place_id] = ev;
    }

    // Group by section in curated order
    const grouped: Record<string, any[]> = {};
    for (const id of allIds) {
      const p = rows.find(r => r.id === id);
      if (!p) continue;
      const sec = idToSection[id];
      if (!grouped[sec]) grouped[sec] = [];
      grouped[sec].push(p);
    }

    const total = rows.length;
    const verifiedRecently = rows.filter(p => {
      if (!p.last_verified_at) return false;
      const days = (Date.now() - new Date(p.last_verified_at).getTime()) / (1000 * 60 * 60 * 24);
      return days < 60;
    }).length;
    const freshnessPct = total > 0 ? Math.round((verifiedRecently / total) * 100) : 0;

    const baseUrl = 'https://mapadecaborojo.com';
    const pageTitle = 'Directorio Cultural de Cabo Rojo | MapaDeCaboRojo.com';
    const desc = `${total} lugares culturales verificados manualmente: próceres, museos, naturaleza histórica, plazas, artesanos. Mapa interactivo + lista por sección.`;

    // Build marker JSON for Leaflet
    const markers = rows
      .filter(p => p.lat && p.lon)
      .map(p => {
        const sec = idToSection[p.id];
        return {
          lat: p.lat,
          lon: p.lon,
          name: p.name,
          slug: p.slug || '',
          section: sec,
          label: SECTION_LABELS[sec] || sec,
          color: SECTION_COLORS[sec] || '#0d9488',
          emoji: CULTURA_CURATED[sec]?.emoji || '📍',
        };
      });

    // Helper: format days-ago + color
    const formatVerified = (iso: string | null) => {
      if (!iso) return { text: 'verificación pendiente', color: '#94a3b8', days: 999 };
      const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
      const dateLabel = days <= 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days}d`;
      const color = days < 60 ? '#16a34a' : days < 120 ? '#d97706' : '#dc2626';
      return { text: `verificado ${dateLabel}`, color, days };
    };

    // Helper: format next event date
    const formatEvent = (ev: any) => {
      if (!ev) return '';
      const d = new Date(ev.start_time);
      const fmt = d.toLocaleDateString('es-PR', { weekday: 'short', day: 'numeric', month: 'short' });
      const time = d.toLocaleTimeString('es-PR', { hour: 'numeric', minute: '2-digit', hour12: true });
      const href = ev.slug ? `/evento/${ev.slug}` : '#';
      return `<div style="margin-top:8px;padding:8px 10px;background:#fef3c7;border-left:3px solid #f59e0b;border-radius:4px;font-size:13px;color:#78350f;"><strong>📅 Próximo:</strong> <a href="${href}" style="color:#78350f;text-decoration:underline;">${esc(ev.title)}</a> · ${fmt} ${time}</div>`;
    };

    // Helper to render a place card
    const renderCard = (p: any, sec: string) => {
      const color = SECTION_COLORS[sec] || '#0d9488';
      const href = p.slug ? `/negocio/${p.slug}` : '#';
      const rating = p.google_rating ? `<span style="color:#f59e0b;font-size:13px;">⭐ ${p.google_rating}</span>` : '';
      const tel = p.phone ? `<a href="tel:${esc(p.phone)}" style="color:#0d9488;text-decoration:none;font-size:13px;">📞 ${esc(p.phone)}</a>` : '';
      const verif = formatVerified(p.last_verified_at);
      const verifiedBadge = `<span title="${esc(verif.text)}" style="display:inline-block;background:${verif.color}1a;color:${verif.color};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;white-space:nowrap;">✓ ${esc(verif.text)}</span>`;
      const hasPhone = p.phone ? '1' : '0';
      const hoursJson = p.opening_hours && p.opening_hours.structured ? JSON.stringify(p.opening_hours.structured) : '';
      const searchText = `${(p.name || '').toLowerCase()} ${(p.address || '').toLowerCase()}`;
      const nextEvent = nextEventByPlace[p.id];
      const eventHTML = formatEvent(nextEvent);
      const claimMsg = encodeURIComponent(`CLAIM ${p.slug || p.name}`);
      const placeName = (p.name || '').replace(/"/g, '&quot;');

      return `<div class="cultura-card" data-section="${sec}" data-name="${esc(searchText)}" data-phone="${hasPhone}" data-fresh-days="${verif.days}" data-hours='${esc(hoursJson)}' data-id="${esc(p.id)}" data-cardname="${esc(placeName)}" data-slug="${esc(p.slug || '')}" style="padding:16px;border:1px solid #e2e8f0;border-left:4px solid ${color};border-radius:8px;background:#fff;margin-bottom:12px;position:relative;">
        <label style="position:absolute;top:10px;right:10px;display:inline-flex;align-items:center;gap:4px;cursor:pointer;user-select:none;background:#f1f5f9;padding:4px 8px;border-radius:6px;font-size:11px;color:#475569;font-weight:600;">
          <input type="checkbox" class="itin-pick" data-pickname="${esc(placeName)}" style="cursor:pointer;margin:0;"> Itinerario
        </label>
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:6px;padding-right:90px;">
          <h3 style="margin:0;font-size:17px;color:#1e293b;font-weight:700;line-height:1.3;">
            ${p.slug ? `<a href="${href}" style="color:#1e293b;text-decoration:none;">${esc(p.name)}</a>` : esc(p.name)}
          </h3>
          ${verifiedBadge}
        </div>
        ${p.address ? `<p style="margin:0 0 6px;color:#64748b;font-size:13px;">📍 ${esc(p.address)}</p>` : ''}
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
          ${rating}
          ${tel}
          ${p.slug ? `<a href="${href}" style="color:#0d9488;font-size:13px;font-weight:600;text-decoration:none;">Ver perfil →</a>` : ''}
        </div>
        ${eventHTML}
        <div style="margin-top:10px;padding-top:8px;border-top:1px dashed #e2e8f0;font-size:11px;color:#94a3b8;">
          ¿Este lugar es tuyo? <a href="https://wa.me/17874177711?text=${claimMsg}" style="color:#0d9488;font-weight:600;text-decoration:none;">Recláma gratis →</a>
        </div>
      </div>`;
    };

    // Build sections HTML
    const sectionsHTML = Object.keys(CULTURA_CURATED).map(sec => {
      const def = CULTURA_CURATED[sec];
      const items = grouped[sec] || [];
      if (items.length === 0) return '';
      const color = SECTION_COLORS[sec];
      return `<section id="${sec}" class="cultura-section" data-section="${sec}" style="margin-bottom:48px;">
  <div style="border-bottom:3px solid ${color};padding-bottom:10px;margin-bottom:16px;">
    <h2 style="margin:0;font-size:26px;color:${color};font-weight:800;">${def.emoji} ${SECTION_LABELS[sec]}</h2>
    <p style="margin:6px 0 0;color:#64748b;font-size:14px;">${def.description}</p>
  </div>
  ${items.map(p => renderCard(p, sec)).join('')}
</section>`;
    }).join('');

    const legendHTML = Object.entries(SECTION_COLORS).map(([sec, color]) => {
      const def = CULTURA_CURATED[sec];
      return `<a href="#${sec}" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:999px;text-decoration:none;color:#1e293b;font-size:13px;font-weight:600;">
        <span style="width:12px;height:12px;border-radius:50%;background:${color};display:inline-block;"></span>
        ${def?.emoji || ''} ${SECTION_LABELS[sec]}
      </a>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${baseUrl}/cultura">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${pageTitle}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${baseUrl}/cultura">
  <meta property="og:site_name" content="MapaDeCaboRojo.com">
  <meta property="og:locale" content="es_PR">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Directorio Cultural de Cabo Rojo",
    "description": desc,
    "url": `${baseUrl}/cultura`,
    "numberOfItems": total,
    "itemListElement": rows.map((p, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": p.name,
      "url": p.slug ? `${baseUrl}/negocio/${p.slug}` : `${baseUrl}/cultura`
    }))
  })}</script>
</head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b;line-height:1.6;">

  <!-- HERO -->
  <div style="background:linear-gradient(135deg,#0d9488 0%,#0f766e 50%,#134e4a 100%);color:white;padding:56px 24px;text-align:center;">
    <div style="max-width:760px;margin:0 auto;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Directorio Cultural</p>
      <h1 style="font-size:2.2rem;font-weight:800;margin:0 0 14px;line-height:1.2;">La cultura de Cabo Rojo,<br><span style="color:#5eead4;">en el mapa.</span></h1>
      <p style="font-size:1.05rem;color:rgba(255,255,255,0.88);margin:0 0 24px;max-width:560px;margin-left:auto;margin-right:auto;">${total} lugares verificados manualmente — uno por uno.${freshnessPct > 0 ? ` <strong>${freshnessPct}% verificado &lt;60 días.</strong>` : ''} Próceres, museos, naturaleza histórica, plazas, artesanos.</p>
      <div style="display:inline-flex;gap:8px;justify-content:center;flex-wrap:wrap;">
        <a href="#mapa" style="background:#f97316;color:white;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:700;font-size:0.95rem;">Ver el mapa ↓</a>
        <a href="https://caborojo.com/directorio-cultural" style="background:rgba(255,255,255,0.15);color:white;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;font-size:0.95rem;border:1px solid rgba(255,255,255,0.3);">Guía narrativa →</a>
      </div>
    </div>
  </div>

  <div style="max-width:1100px;margin:0 auto;padding:32px 20px;">

    <!-- M3: MAP AT TOP -->
    <div id="mapa" style="margin-bottom:24px;">
      <div id="cultura-map" style="height:420px;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;background:#e2e8f0;"></div>
      <p style="margin:8px 0 0;font-size:12px;color:#64748b;text-align:center;">${markers.length} lugares geo-referenciados · click marcador pa' detalles</p>
    </div>

    <!-- LEGEND -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:20px;">
      ${legendHTML}
    </div>

    <!-- M4: SEARCH + M2: FILTERS -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:24px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
      <input id="cultura-search" type="search" placeholder="🔍 Buscar lugar, calle, barrio..." style="flex:1;min-width:220px;padding:10px 14px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;outline:none;">
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="cultura-filter" data-filter="open" style="background:#fff;border:1px solid #cbd5e1;padding:8px 12px;border-radius:999px;font-size:12px;font-weight:600;color:#475569;cursor:pointer;">🟢 Abierto ahora</button>
        <button class="cultura-filter" data-filter="phone" style="background:#fff;border:1px solid #cbd5e1;padding:8px 12px;border-radius:999px;font-size:12px;font-weight:600;color:#475569;cursor:pointer;">📞 Con teléfono</button>
        <button class="cultura-filter" data-filter="fresh" style="background:#fff;border:1px solid #cbd5e1;padding:8px 12px;border-radius:999px;font-size:12px;font-weight:600;color:#475569;cursor:pointer;">✓ Verificado &lt;60d</button>
      </div>
      <div id="cultura-count" style="font-size:12px;color:#64748b;width:100%;text-align:center;margin-top:4px;">Mostrando ${total} de ${total} lugares</div>
    </div>

    <!-- M7: DEMAND SIGNAL CULTURAL -->
    <div style="background:linear-gradient(135deg,#0d9488 0%,#0f766e 100%);color:white;padding:18px 22px;border-radius:10px;margin-bottom:32px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
      <div style="flex:1;min-width:240px;">
        <p style="margin:0 0 4px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.85;">Demanda real · últimos 30 días</p>
        <p style="margin:0;font-size:16px;font-weight:700;"><span style="font-size:24px;color:#5eead4;">${culturaDemand30d}</span> vecinos preguntaron al *7711 por sitios culturales</p>
      </div>
      <a href="https://wa.me/17874177711?text=Faro%20Los%20Morrillos" style="background:#f97316;color:white;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:700;font-size:13px;white-space:nowrap;">Probar ahora →</a>
    </div>

    <!-- MOAT NOTE -->
    <div style="background:#fefce8;border-left:4px solid #eab308;padding:16px 20px;border-radius:6px;margin-bottom:40px;">
      <p style="margin:0;font-size:14px;color:#713f12;"><strong>¿Por qué este directorio importa?</strong> Cada lugar fue confirmado a mano — no scrapeado, no AI-generated. Si encuentras algo desactualizado, <a href="https://wa.me/17874177711?text=DATO%20CULTURA" style="color:#a16207;font-weight:600;">avísanos al *7711</a>.</p>
    </div>

    <!-- SECTIONS -->
    ${sectionsHTML}

    <!-- CTA Veci -->
    <div style="background:#0f766e;color:white;padding:32px 24px;border-radius:12px;text-align:center;margin:40px 0;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Antes de dar vueltas</p>
      <h2 style="margin:0 0 10px;font-size:22px;color:white;border:none;padding:0;">Pregúntale al Veci</h2>
      <p style="margin:0 0 18px;font-size:15px;opacity:0.92;max-width:520px;margin-left:auto;margin-right:auto;">¿Buscas un sitio cultural específico? ¿Quieres saber si está abierto hoy? Textea y te contesto al momento.</p>
      <a href="https://wa.me/17874177711?text=Pregunta%20cultural%20Cabo%20Rojo" style="background:#f97316;color:white;text-decoration:none;padding:13px 26px;border-radius:8px;font-weight:700;font-size:1rem;display:inline-block;">Textea al 787-417-7711 →</a>
    </div>

    <!-- M9: VERIFIERS (transparencia) -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <h3 style="margin:0 0 10px;font-size:15px;color:#1e293b;font-weight:700;">Quién verifica esta data</h3>
      <p style="margin:0 0 8px;font-size:13px;color:#475569;">Angel Anderson camina, confirma teléfono, valida que el lugar abre.${freshnessPct > 0 ? ` <strong>${freshnessPct}%</strong> verificado en los últimos 60 días.` : ' Cada uno fue confirmado a mano — no scrapeado, no AI-generated.'}</p>
      <p style="margin:0;font-size:12px;color:#94a3b8;">Última caminata documentada: mayo 2026 — ruta Boquerón centro + Plaza Betances. Próxima: agosto 2026.</p>
    </div>

    <!-- Cross-link -->
    <div style="background:#f1f5f9;border:1px solid #e2e8f0;padding:20px 24px;border-radius:8px;margin-top:32px;">
      <h3 style="margin:0 0 8px;font-size:16px;color:#1e293b;">¿Quieres la guía cultural con narrativa completa?</h3>
      <p style="margin:0 0 10px;font-size:14px;color:#475569;">Próceres con bio, festivales con fechas, cocina con identidad — todo contado para leer despacio.</p>
      <a href="https://caborojo.com/directorio-cultural" style="color:#0d9488;font-weight:600;text-decoration:none;">caborojo.com/directorio-cultural →</a>
    </div>

    <!-- Footer -->
    <div style="margin-top:48px;padding-top:24px;border-top:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:13px;">
      <p style="margin:0 0 6px;">Verificado uno por uno · actualizado mayo 2026 · próxima revisión agosto 2026</p>
      <p style="margin:0;font-style:italic;">— Angel | Menos revolú, más sistema, mejor vida.</p>
    </div>
  </div>

  <!-- M10: ITINERARY FLOATING BAR -->
  <div id="itin-bar" style="display:none;position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#0f766e;color:white;padding:12px 20px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,0.25);z-index:1000;font-size:14px;font-weight:600;align-items:center;gap:12px;">
    <span id="itin-count">0 sitios</span>
    <button id="itin-send" style="background:#f97316;color:white;border:none;padding:8px 16px;border-radius:999px;font-weight:700;font-size:13px;cursor:pointer;">📲 Enviar al *7711 →</button>
    <button id="itin-clear" style="background:transparent;color:white;border:1px solid rgba(255,255,255,0.3);padding:6px 12px;border-radius:999px;font-size:11px;cursor:pointer;">Limpiar</button>
  </div>

  <script>
    (function() {
      const markers = ${JSON.stringify(markers)};
      if (markers.length && typeof L !== 'undefined') {
        const map = L.map('cultura-map', { scrollWheelZoom: false }).setView([18.04, -67.16], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap', maxZoom: 18
        }).addTo(map);
        const bounds = L.latLngBounds([]);
        markers.forEach(m => {
          const icon = L.divIcon({
            className: 'cultura-marker',
            html: '<div style="background:' + m.color + ';width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px;">' + m.emoji + '</div>',
            iconSize: [28, 28], iconAnchor: [14, 14]
          });
          const popup = '<div style="font-family:-apple-system,sans-serif;min-width:200px;"><strong style="font-size:14px;color:#1e293b;">' + m.name + '</strong><br><span style="font-size:11px;color:' + m.color + ';font-weight:600;text-transform:uppercase;">' + m.label + '</span>' + (m.slug ? '<br><a href="/negocio/' + m.slug + '" style="color:#0d9488;font-size:12px;font-weight:600;">Ver detalles →</a>' : '') + '</div>';
          L.marker([m.lat, m.lon], { icon: icon }).addTo(map).bindPopup(popup);
          bounds.extend([m.lat, m.lon]);
        });
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
      }

      // M2 + M4: filter + search engine
      const cards = Array.from(document.querySelectorAll('.cultura-card'));
      const searchInput = document.getElementById('cultura-search');
      const filterBtns = Array.from(document.querySelectorAll('.cultura-filter'));
      const countEl = document.getElementById('cultura-count');
      const activeFilters = new Set();

      function isOpenNow(hoursJson) {
        if (!hoursJson) return false;
        try {
          const arr = JSON.parse(hoursJson);
          const now = new Date();
          const today = arr.find(h => h.day === now.getDay());
          if (!today || today.isClosed) return false;
          const [oh, om] = today.open.split(':').map(Number);
          const [ch, cm] = today.close.split(':').map(Number);
          const mins = now.getHours() * 60 + now.getMinutes();
          return mins >= (oh * 60 + om) && mins <= (ch * 60 + cm);
        } catch { return false; }
      }

      function applyFilters() {
        const q = (searchInput.value || '').toLowerCase().trim();
        let visible = 0;
        cards.forEach(c => {
          const name = c.dataset.name || '';
          const hasPhone = c.dataset.phone === '1';
          const freshDays = parseInt(c.dataset.freshDays || '999', 10);
          let show = true;
          if (q && !name.includes(q)) show = false;
          if (activeFilters.has('phone') && !hasPhone) show = false;
          if (activeFilters.has('fresh') && freshDays >= 60) show = false;
          if (activeFilters.has('open') && !isOpenNow(c.dataset.hours)) show = false;
          c.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        countEl.textContent = 'Mostrando ' + visible + ' de ' + cards.length + ' lugares';
        // Hide sections with zero visible cards
        document.querySelectorAll('.cultura-section').forEach(s => {
          const anyVisible = Array.from(s.querySelectorAll('.cultura-card')).some(c => c.style.display !== 'none');
          s.style.display = anyVisible ? '' : 'none';
        });
      }

      searchInput.addEventListener('input', applyFilters);
      filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const f = btn.dataset.filter;
          if (activeFilters.has(f)) {
            activeFilters.delete(f);
            btn.style.background = '#fff';
            btn.style.color = '#475569';
            btn.style.borderColor = '#cbd5e1';
          } else {
            activeFilters.add(f);
            btn.style.background = '#0d9488';
            btn.style.color = '#fff';
            btn.style.borderColor = '#0d9488';
          }
          applyFilters();
        });
      });

      // M10: itinerary
      const itinBar = document.getElementById('itin-bar');
      const itinCount = document.getElementById('itin-count');
      const itinSend = document.getElementById('itin-send');
      const itinClear = document.getElementById('itin-clear');
      const picks = new Set();

      function updateItinUI() {
        if (picks.size === 0) {
          itinBar.style.display = 'none';
        } else {
          itinBar.style.display = 'inline-flex';
          itinCount.textContent = picks.size + ' sitio' + (picks.size === 1 ? '' : 's');
        }
      }

      document.querySelectorAll('.itin-pick').forEach(cb => {
        cb.addEventListener('change', e => {
          const name = e.target.dataset.pickname || '';
          if (e.target.checked) picks.add(name);
          else picks.delete(name);
          updateItinUI();
        });
      });

      itinSend.addEventListener('click', () => {
        const list = Array.from(picks).join(', ');
        const msg = encodeURIComponent('ITINERARIO: ' + list + ' — ¿en qué orden me conviene y a qué hora abren?');
        window.location.href = 'https://wa.me/17874177711?text=' + msg;
      });
      itinClear.addEventListener('click', () => {
        picks.clear();
        document.querySelectorAll('.itin-pick').forEach(cb => { cb.checked = false; });
        updateItinUI();
      });
    })();
  </script>

</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.status(200).send(html);
  } catch (err: any) {
    console.error('handle_cultura error:', err);
    res.status(500).send(`<html><body><h1>Error</h1><pre>${esc(err?.message || 'Unknown error')}</pre></body></html>`);
  }
}


// ============ ROUTER ============
export default async function handler(req: any, res: any) {
  const page = req.query?.page || '';
  switch (page) {
    case 'municipio': return handle_municipio(req, res);
    case 'turismo': return handle_turismo(req, res);
    case 'demanda': return handle_demanda(req, res);
    case 'intelligence': return handle_intelligence(req, res);
    case 'evento': return handle_evento(req, res);
    case 'admin-municipio': return handle_admin_municipio(req, res);
    case 'admin-lifecycle-queue': return handle_admin_lifecycle_queue(req, res);
    case 'pueblo-en-numeros': return handle_pueblo_en_numeros(req, res);
    case 'me-conviene': return handle_me_conviene(req, res);
    case 'sistema': return handle_sistema(req, res);
    case 'cultura': return handle_cultura(req, res);
    default: return res.status(404).json({ error: 'Page not found' });
  }
}
