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
  residents: 50_798,           // Census 2020 — Cabo Rojo Municipio FIPS 72023
  regional_pull: 78_000,       // CR + Hormigueros 16K + Lajas 25K partial + San Germán 31K partial — Phase 2 confirms with commuter data
  visitors_annual: 250_000,    // PRTC estimate, conservative — Phase 2 calibrates with Boquerón–Joyuda–Combate counters
  visitor_spend_per_visit: 150, // mid of $120-180 range — Phase 2 calibrates with PRTC + spend surveys
  household_count: 17_500,     // Census ACS — household_size 2.4 implied
  household_size: 2.4,
  median_income: 25_000,       // mid of $22-28K — Census ACS
  source_population: 'US Census Bureau 2020 + ACS 5-year estimates',
  source_visitors: 'PRTC visitor counts (estimate)',
  pr_avg_business_per_capita: 90, // 1 negocio per ~90 personas (PR municipal median benchmark) — Phase 2 source via BLS QCEW
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
  tatuajes: (p) => /tatua|tattoo|piercing/i.test(p.name || '') || (p.category || '') === 'Tatuajes',
  colmado: (p) => /colmado|mini.*mark|min(i|í).*super/i.test(p.name || '') || (p.category || '') === 'Colmado',
  barberia: (p) => /barber/i.test(p.name || '') || /barber/i.test(p.subcategory || ''),
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
🔧 **El pueblo necesita oficios, no más food trucks.**
Plomero, electricista, AC tech, cardiólogo, ginecólogo: 0 detectados en directorio, 100+ búsquedas/90d. La barrera no es dinero — es tiempo + certificación gubernamental. Un boricua puede abrir food truck en 3 meses con $25K. No puede ser cardiólogo en 3 meses con ningún capital.

## gimnasio:below-breakeven
⚪ **Los gimnasios están bajo breakeven.**
SOM $136K/biz vs breakeven $150-250K. Los 11 gimnasios viven al filo. La categoría tiene baja fricción de entrada (capital chiquito + licencia rápida) — replican lo que vieron, sin medir saturación porque no hay portal que la mida.

## feedback-loop:none
🔍 **Nadie en PR publica densidad por categoría — hasta hoy.**
La decisión "abrir un food truck más" se toma con cero data sobre saturación. CRIM publica patentes pero no agregadas. Junta de Planificación procesa permisos sin métricas. El alcalde no tiene un density dashboard. Por eso esta página existe.

## cabo-rojo:density-50pct
📊 **Cabo Rojo tiene 50% más negocios per cápita que la mediana PR.**
1 negocio por cada 53 personas en CR vs ~1 cada 90 en el resto del archipiélago. No es "el pueblo emprendedor" — es estructural: low-friction categories sin feedback loop = saturación replicada generación tras generación.

## medico:paradox-overdemand
🩺 **Hay ~59 médicos + 9 dentistas en CR (no 191 como decía el chart antes). El problema es estructural, no de cantidad.**
44 médicos generales/pediatras + 15 especialistas verificados (cardiólogos, ginecólogos, dermatólogos, oncólogos, neurólogos, etc.). Mayoría concentrados en pueblo. Panel típico 1,500-2,000 pacientes (PR avg) + insurance-driven scheduling = 30-90 días pa cita. Más gente no abre más slots: abre más espera. El chart anterior contaba 191 porque metía a la cuenta laboratorios, ambulancias, ópticos, quiroprácticos y clínicas con "Pharmacy" en inglés. **Honestidad operativa:** lo arreglamos.

## farmacia:concentration-paradox
💊 **CR tiene casi 2× más densidad de farmacias que la mediana PR.**
18 farmacias verificadas open para 50,798 personas = 1 por cada 2,820. Mediana PR ~1 cada 4,500. Mayoría concentradas en pueblo (varias en mismo radio de Calle Comercio). Chains (Walgreens, Walmart Pharmacy, CVS) absorben 70% del gasto vía Plan Médico/PBM. Las 18 sobreviven porque el TAM está holgado, pero margen pisado. El número 43 anterior contaba farmacias de toda la región oeste — corregido hoy.

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
    matches:(p)=>/(aire\s|refriger|\bac\b|frigo)/i.test(p.name||'') || ((p.tags||[]) as string[]).some(t=>/refriger|aire/i.test(t)) },
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
    matches:(p)=>/handyman|albañil|reparac/i.test(p.name||'') },
  { key:'boutique', label:'Boutique', emoji:'👗', categorySlug:'tiendas-de-ropa',
    qRegex:/(boutique|tienda\s+ropa)/i,
    matches:(p)=>/boutique/i.test(p.name||'') },
  { key:'gimnasio', label:'Gimnasio', emoji:'🏋️', categorySlug:'gimnasio',
    qRegex:/(gimnasio|\bgym\b|crossfit)/i,
    matches:(p)=>/gimnasio|\bgym\b/i.test(p.name||'') || (p.subcategory||'').toLowerCase()==='gimnasio' },
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
        .eq('status', 'active')
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
<title>Cabo Rojo OS — Panel Ciudadano</title>
<meta name="description" content="Panel público de Cabo Rojo: 3,900+ negocios verificados, búsquedas en tiempo real del bot *7711, eventos próximos, y oportunidades para nuevos negocios.">
<meta property="og:title" content="Cabo Rojo OS — Panel Ciudadano">
<meta property="og:description" content="Lo que el pueblo está buscando, los negocios verificados a mano, y el mapa económico real.">
<meta name="robots" content="index,follow">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;color:#1e293b;-webkit-font-smoothing:antialiased}a{color:inherit}a:hover{opacity:0.85}</style>
</head>
<body>

<!-- HEADER -->
<div style="background:#1e293b;color:#fff;padding:24px 32px;">
  <div style="max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
    <div>
      <div style="font-size:13px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">📊 Panel Ciudadano</div>
      <h1 style="font-size:28px;font-weight:700;letter-spacing:-0.5px;">Cabo Rojo OS</h1>
      <div style="font-size:14px;color:#94a3b8;margin-top:4px;">Lo que el pueblo está buscando, lo que está verificado, lo que falta.</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:12px;color:#64748b;">Última actualización</div>
      <div style="font-size:13px;font-weight:600;color:#cbd5e1;">${esc(generatedAt)}</div>
      <div style="margin-top:8px;">
        <a href="https://mapadecaborojo.com" style="background:#0d9488;color:#fff;padding:6px 14px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">Ver directorio →</a>
      </div>
    </div>
  </div>
</div>

<div style="max-width:1100px;margin:32px auto;padding:0 16px;">

  <!-- STAT CARDS — corrected counts from views -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:32px;">
    ${[
      { label: 'Negocios totales', value: total.toLocaleString('es-PR'), icon: '🏢', color: '#0d9488', tooltip: 'Todos los places de Cabo Rojo en nuestra base de datos (visibles al público). Algunos pueden estar cerrados temporalmente.' },
      { label: 'Abiertos hoy', value: openCount.toLocaleString('es-PR'), icon: '✅', color: '#16a34a', tooltip: 'Negocios con status=open en Cabo Rojo. La diferencia con "totales" son places cerrados o de estado dudoso.' },
      { label: 'Verif. en 90 días', value: `${fresh90d.toLocaleString('es-PR')} · ${freshnessPct}%`, icon: '🛡️', color: freshnessPct >= 80 ? '#16a34a' : freshnessPct >= 60 ? '#ca8a04' : '#dc2626', tooltip: 'Negocios que Angel verificó en persona en los últimos 90 días — caminó la calle, entró, confirmó que sigue abierto. Sin Google Places, sin AI: ojos humanos.' },
      { label: 'Top 10 búsq. (30d)', value: totalSearches30d.toLocaleString('es-PR'), icon: '🔍', color: '#0369a1', tooltip: 'Suma de las 10 categorías más buscadas al *7711 en los últimos 30 días. El total absoluto es mayor — esto es la concentración de demanda en lo más pedido.' },
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
        <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.3px;line-height:1.3;">1 negocio por cada 53 personas. <span style="color:#5eead4;">50% más denso que PR.</span></div>
        <div style="font-size:13px;color:#fbbf24;margin-top:8px;font-weight:600;">💊 Ej: 18 farmacias en Cabo Rojo verificadas open = 1 por cada 2,820 personas. Mediana PR ~1 cada 4,500. <span style="color:#fff;">Casi 2× más densa que el resto.</span></div>
        <div style="font-size:12px;color:#cbd5e1;margin-top:6px;">TAM/SAM/SOM por categoría · sobreoferta visible · ajá moments que nadie publica.</div>
      </div>
      <div style="background:#0d9488;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;white-space:nowrap;">Ver el pueblo en números →</div>
    </div>
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
    <h2 style="font-size:18px;font-weight:700;color:#1e293b;margin-bottom:4px;">🌡️ Demanda vs Oferta — el mapa económico real</h2>
    <p style="font-size:13px;color:#64748b;margin-bottom:18px;">Búsquedas en 90 días dividido entre negocios en el directorio. <strong>Calientes</strong> = oportunidad de nuevo negocio. <strong>Saturadas</strong> = mucha oferta, baja demanda.</p>
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
  const surgeList: SurgeRow[] = Array.isArray(surges) ? surges : [];

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
      <td style="padding:10px 12px;font-weight:600;color:#0f172a;text-transform:capitalize;">${esc(row.term)}</td>
      <td style="padding:10px 12px;text-align:center;font-weight:700;color:${color};">${row.this_week}</td>
      <td style="padding:10px 12px;text-align:center;color:#94a3b8;">${row.last_week}</td>
      <td style="padding:10px 12px;text-align:center;">${badge}</td>
    </tr>`;
  }).join('');

  const opportunityCards = opportunities.length > 0
    ? opportunities.map(row => `
      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:8px;">
        <span style="font-weight:700;color:#92400e;text-transform:capitalize;">${esc(row.term)}</span>
        <span style="color:#78350f;font-size:13px;margin-left:8px;">${row.this_week} búsquedas esta semana — sin negocio asociado</span>
      </div>`).join('')
    : '<p style="color:#64748b;font-size:14px;">No hay términos sin cobertura esta semana.</p>';

  const baseUrl = 'https://mapadecaborojo.com';
  const waLink = `https://wa.me/17874177711?text=${encodeURIComponent('Hola, quiero suscribirme a las alertas de demanda para mi negocio')}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Radar de Demanda — Cabo Rojo | MapaDeCaboRojo.com</title>
  <meta name="description" content="Descubre qué buscan los residentes y visitantes de Cabo Rojo en tiempo real. Análisis semanal de demanda local para negocios.">
  <link rel="canonical" href="${baseUrl}/demanda">
  <meta property="og:title" content="Radar de Demanda — Cabo Rojo">
  <meta property="og:description" content="Lo que Cabo Rojo está buscando esta semana.">
  <meta property="og:url" content="${baseUrl}/demanda">
  <meta property="og:site_name" content="MapaDeCaboRojo.com">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Radar de Demanda — Cabo Rojo","url":"${baseUrl}/demanda","description":"Análisis de demanda local semanal para negocios en Cabo Rojo, Puerto Rico."}</script>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b;line-height:1.6;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0d9488 0%,#0f766e 50%,#1d4ed8 100%);padding:48px 24px 56px;text-align:center;">
    <a href="${baseUrl}" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:13px;display:inline-block;margin-bottom:16px;">← MapaDeCaboRojo.com</a>
    <div style="font-size:40px;margin-bottom:8px;">📈</div>
    <h1 style="color:white;font-size:28px;font-weight:800;margin:0 0 8px 0;">Radar de Demanda</h1>
    <p style="color:rgba(255,255,255,0.85);font-size:16px;margin:0;">Lo que Cabo Rojo está buscando esta semana</p>
  </div>

  <div style="max-width:720px;margin:-24px auto 0;padding:0 16px 48px;">

    <!-- Hero stat -->
    <div style="background:white;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.1);padding:28px 32px;margin-bottom:24px;display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
      <div style="flex:1;min-width:180px;">
        <div style="font-size:48px;font-weight:800;color:#0d9488;line-height:1;">${totalSearches}</div>
        <div style="color:#64748b;font-size:15px;margin-top:4px;">búsquedas esta semana</div>
      </div>
      <div style="flex:1;min-width:180px;border-left:2px solid #e2e8f0;padding-left:24px;">
        <div style="font-size:36px;font-weight:800;line-height:1;color:${overallPct >= 0 ? '#10b981' : '#ef4444'};">
          ${overallPct >= 0 ? '+' : ''}${overallPct}%
        </div>
        <div style="color:#64748b;font-size:15px;margin-top:4px;">vs semana pasada</div>
      </div>
      <div style="flex:1;min-width:180px;border-left:2px solid #e2e8f0;padding-left:24px;">
        <div style="font-size:36px;font-weight:800;line-height:1;color:#8b5cf6;">${surgeList.filter(r => r.last_week === 0).length}</div>
        <div style="color:#64748b;font-size:15px;margin-top:4px;">términos nuevos</div>
      </div>
    </div>

    <!-- Surge Table -->
    <div style="background:white;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08);margin-bottom:24px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:2px solid #e2e8f0;">
        <h2 style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">Tendencias de búsqueda</h2>
        <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Últimos 7 días vs semana anterior · Mínimo 3 búsquedas</p>
      </div>
      ${surgeList.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Término</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Esta semana</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Sem. anterior</th>
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

    <!-- Opportunities -->
    <div style="background:white;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:24px;margin-bottom:24px;">
      <h2 style="margin:0 0 6px;font-size:18px;font-weight:700;color:#0f172a;">⚡ Oportunidades sin cubrir</h2>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;">Términos con demanda activa pero sin negocio que los satisfaga directamente.</p>
      ${opportunityCards}
    </div>

    <!-- CTA Banner -->
    <div style="background:linear-gradient(135deg,#0d9488,#0f766e);border-radius:16px;padding:32px 28px;text-align:center;margin-bottom:24px;">
      <h2 style="color:white;font-size:22px;font-weight:800;margin:0 0 8px;">Suscríbete a alertas de demanda</h2>
      <p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0 0 20px;">Recibe un aviso cuando alguien busque algo relacionado con tu negocio. Sé el primero en responder.</p>
      <div style="background:rgba(255,255,255,0.15);border-radius:12px;padding:16px;margin-bottom:20px;text-align:left;">
        <div style="color:rgba(255,255,255,0.9);font-size:14px;margin-bottom:8px;">✓ Alertas semanales por WhatsApp</div>
        <div style="color:rgba(255,255,255,0.9);font-size:14px;margin-bottom:8px;">✓ Términos personalizados para tu negocio</div>
        <div style="color:rgba(255,255,255,0.9);font-size:14px;">✓ Datos exclusivos de Cabo Rojo</div>
      </div>
      <div style="font-size:28px;font-weight:800;color:#fcd34d;margin-bottom:16px;">$49/mes</div>
      <a href="${waLink}" style="display:inline-block;background:#f97316;color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:16px;">Textea al 787-417-7711</a>
      <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:12px 0 0;">O escríbenos por WhatsApp — respondemos en minutos</p>
    </div>

    <!-- Subscribe Form -->
    <div style="background:white;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:28px 24px;margin-bottom:24px;">
      <h2 style="margin:0 0 6px;font-size:18px;font-weight:700;color:#0f172a;">Registra tu negocio</h2>
      <p style="margin:0 0 20px;color:#64748b;font-size:14px;">Dinos qué términos quieres monitorear y te avisamos cuando suban.</p>
      <form id="alertForm" onsubmit="handleSubmit(event)">
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Nombre del negocio *</label>
          <input id="business_name" type="text" required placeholder="Ej: Farmacia Encarnación" style="width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:15px;box-sizing:border-box;outline:none;">
        </div>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Teléfono (WhatsApp) *</label>
          <input id="phone" type="tel" required placeholder="787-000-0000" style="width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:15px;box-sizing:border-box;outline:none;">
        </div>
        <div style="margin-bottom:20px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Palabras clave a monitorear *</label>
          <input id="keywords" type="text" required placeholder="Ej: farmacia, medicamentos, pastillas" style="width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:15px;box-sizing:border-box;outline:none;">
          <div style="color:#94a3b8;font-size:12px;margin-top:4px;">Separadas por coma</div>
        </div>
        <button type="submit" style="width:100%;background:#0d9488;color:white;border:none;padding:14px;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;">Registrarme — $49/mes</button>
        <div id="formMsg" style="margin-top:12px;text-align:center;font-size:14px;display:none;"></div>
      </form>
    </div>

    <footer style="text-align:center;padding:16px 0;border-top:1px solid #e2e8f0;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">Hecho con orgullo en Cabo Rojo, Puerto Rico</p>
      <p style="color:#94a3b8;font-size:11px;margin:4px 0 0;">
        <a href="${baseUrl}" style="color:#0d9488;text-decoration:none;">MapaDeCaboRojo.com</a>
        · Un proyecto de <a href="https://angelanderson.com" style="color:#0d9488;text-decoration:none;">Angel Anderson</a>
      </p>
    </footer>
  </div>

  <script>
    async function handleSubmit(e) {
      e.preventDefault();
      const msg = document.getElementById('formMsg');
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Enviando...';
      try {
        const res = await fetch('/api/demanda', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_name: document.getElementById('business_name').value,
            phone: document.getElementById('phone').value,
            keywords: document.getElementById('keywords').value,
          })
        });
        const json = await res.json();
        if (json.success) {
          msg.style.display = 'block';
          msg.style.color = '#10b981';
          msg.textContent = '¡Listo! Te contactaremos para activar tu suscripción.';
          e.target.reset();
        } else {
          throw new Error(json.error || 'Error desconocido');
        }
      } catch(err) {
        msg.style.display = 'block';
        msg.style.color = '#ef4444';
        msg.textContent = 'Error al enviar. Escríbenos al 787-417-7711.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Registrarme — $49/mes';
      }
    }
  </script>
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

  const payload = {
    period,
    generated_at: nowISO,
    total_searches: totalSearches,
    unique_users: uniqueUsers,
    top_terms: topTerms,
    categories_demand: categoriesDemand,
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
      { key:'aire', label:'Aire/Refrig.', emoji:'❄️', qRegex:/(aire acond|frigo|refriger)/i, matches:(p)=>/(aire|refriger)/i.test(p.name||'') },
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
    ]);

    const c: any = censusResult;

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
    const densitySorted = [...densityRows].sort((a, b) => {
      if (a.verdict === 'zero' && b.verdict !== 'zero') return -1;
      if (b.verdict === 'zero' && a.verdict !== 'zero') return 1;
      return b.multiplier - a.multiplier;
    }).slice(0, 12);

    const generatedAt = new Date().toLocaleString('es-PR', { timeZone: 'America/Puerto_Rico' });

    const total = c.total ?? 0;
    const openCount = c.open_count ?? 0;
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
      return `<a href="${linkUrl}" style="display:block;text-decoration:none;color:inherit;padding:10px 12px;background:#f8fafc;border-radius:8px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:13px;font-weight:600;color:#1e293b;">${r.emoji} ${esc(r.label)} · ${r.supplyCr}</span>
          <span style="font-size:11px;color:${accent};font-weight:700;">${tag}</span>
        </div>
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

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cabo Rojo en Números — el pueblo viéndose en el espejo</title>
<meta name="description" content="3,887 negocios para 50,798 personas. 1 cada 53 = 50% más denso que el resto de PR. TAM/SAM/SOM por categoría, sobreoferta visible, lo que el pueblo necesita.">
<meta property="og:title" content="Cabo Rojo en Números — el pueblo viéndose en el espejo">
<meta property="og:description" content="50% más denso que el resto de PR. TAM/SAM/SOM por categoría, los ajá moments que nadie publica.">
<meta name="robots" content="index,follow">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b;-webkit-font-smoothing:antialiased;line-height:1.5}a{color:inherit}a:hover{opacity:0.85}h2{letter-spacing:-0.3px}.card{background:#fff;border-radius:14px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.06);margin-bottom:20px;}.kicker{font-size:12px;color:#0d9488;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;margin-bottom:6px;}</style>
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
  <div style="max-width:780px;margin:0 auto;text-align:center;">
    <div style="font-size:13px;color:#5eead4;letter-spacing:0.15em;text-transform:uppercase;font-weight:700;margin-bottom:18px;">📊 Cabo Rojo en Números</div>
    <h1 style="font-size:42px;font-weight:800;letter-spacing:-1px;line-height:1.15;margin-bottom:20px;">1 negocio cada <span style="color:#5eead4;">53 personas</span> en Cabo Rojo.</h1>
    <p style="font-size:20px;color:#cbd5e1;line-height:1.5;margin-bottom:8px;">La mediana en Puerto Rico: 1 cada ~90.</p>
    <p style="font-size:16px;color:#94a3b8;font-style:italic;">50% más denso. Esto es lo que esa cifra significa.</p>
  </div>
</div>

<div style="max-width:980px;margin:32px auto;padding:0 16px;">

  <!-- SECTION 1.5: TL;DR ABUELA (plain-language summary) -->
  <div class="card" style="background:#ecfdf5;border-left:4px solid #0d9488;">
    <div style="font-size:11px;color:#0f766e;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;margin-bottom:8px;">Lo que esta página dice, en una línea</div>
    <p style="font-size:16px;color:#134e4a;line-height:1.6;margin:0;">En Cabo Rojo hay 937 negocios verificados abiertos para 50,798 personas — más negocios de los que el pueblo solo puede sostener. <strong>Sobran de unas cosas</strong> (food trucks, boutiques, restaurantes — porque entrar es barato y rápido). <strong>Faltan de otras</strong> (plomero, electricista, cardiólogo — porque entrar requiere licencia, años de estudio o capital alto). El por qué de cada uno está abajo. Si tú o alguien tuyo está pensando en abrir negocio, busca tu categoría en la tabla y léela antes de firmar nada.</p>
  </div>

  <!-- SECTION 2: BASELINE STAT CARDS -->
  <div class="card">
    <h2 style="font-size:18px;font-weight:700;color:#1e293b;margin-bottom:6px;">El pueblo en cifras</h2>
    <p style="font-size:13px;color:#64748b;margin-bottom:20px;">La base que define todo lo demás. Sources citadas inline.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;">
      ${[
        { lbl: 'Población', val: fmt(CABO_ROJO_BASELINE.residents), sub: 'Census 2020', subUrl: 'https://data.census.gov/profile?q=Cabo+Rojo+Municipio,+Puerto+Rico', icon: '👥', color: '#0d9488' },
        { lbl: 'Hogares', val: '~' + fmt(CABO_ROJO_BASELINE.household_count), sub: 'Census ACS · 2.4/hogar', subUrl: 'https://www.census.gov/programs-surveys/acs', icon: '🏠', color: '#7c3aed' },
        { lbl: 'Mediana income', val: '$22-28K/yr', sub: 'Census ACS', subUrl: 'https://www.census.gov/programs-surveys/acs', icon: '💵', color: '#16a34a' },
        { lbl: 'Pull regional', val: '~' + fmt(CABO_ROJO_BASELINE.regional_pull), sub: 'CR + Hormigueros + Lajas + S.Germán', subUrl: 'https://data.census.gov/profile?q=Cabo+Rojo+Municipio,+Puerto+Rico', icon: '🌐', color: '#0369a1' },
        { lbl: 'Visitantes/año', val: '~' + fmt(CABO_ROJO_BASELINE.visitors_annual), sub: 'PRTC estimate · Phase 2', subUrl: 'https://www.tourism.pr.gov/', icon: '🏖️', color: '#ea580c' },
        { lbl: 'Negocios open', val: fmt(openCount), sub: 'Live · directorio', subUrl: 'https://mapadecaborojo.com', icon: '🏢', color: '#dc2626' },
      ].map(s => `
        <div style="padding:16px 14px;background:#f8fafc;border-radius:10px;border-left:3px solid ${s.color};">
          <div style="font-size:20px;margin-bottom:4px;">${s.icon}</div>
          <div style="font-size:18px;font-weight:800;color:#1e293b;">${s.val}</div>
          <div style="font-size:11px;color:#475569;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-top:6px;">${s.lbl}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:2px;"><a href="${s.subUrl}" target="_blank" rel="noopener" style="color:#0d9488;text-decoration:none;border-bottom:1px dotted #0d9488;">${s.sub} →</a></div>
        </div>`).join('')}
    </div>
    <p style="font-size:11px;color:#94a3b8;margin-top:14px;font-style:italic;">Click en cada source link para verificar tú mismo. Las cifras de visitor flow y pull regional son estimates conservadores — Phase 2 las reemplaza con <a href="https://www.bls.gov/cew/" target="_blank" rel="noopener" style="color:#94a3b8;">BLS QCEW</a> + <a href="https://www.tourism.pr.gov/" target="_blank" rel="noopener" style="color:#94a3b8;">PRTC</a> + commuter data sourced.</p>
  </div>

  <!-- SECTION 3: DENSITY COMPARISON -->
  <div class="card">
    <div class="kicker">Densidad per cápita</div>
    <h2 style="font-size:22px;font-weight:800;color:#1e293b;margin-bottom:6px;">CR vs PR — categoría por categoría</h2>
    <p style="font-size:13px;color:#64748b;margin-bottom:18px;">Cuántas personas necesitas para tener 1 negocio de cada tipo. Mientras más bajo el número CR vs PR avg, más denso (y posiblemente saturado) está Cabo Rojo.</p>
    ${densitySorted.length === 0
      ? '<p style="color:#64748b;font-size:13px;">Sin data suficiente.</p>'
      : densitySorted.map(renderDensityBar).join('')}
    <p style="font-size:11px;color:#94a3b8;margin-top:14px;">Click una categoría → te lleva al directorio o WhatsApp con el bot. PR avg = estimate based on BLS QCEW benchmarks (Phase 2).</p>
  </div>

  <!-- SECTION 3.5: GLOSSARY — "Cómo leer este reporte" -->
  <div class="card" style="background:#fffbeb;border-left:4px solid #f59e0b;">
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
  <div class="card">
    <div class="kicker">La matemática en dólares</div>
    <h2 style="font-size:22px;font-weight:800;color:#1e293b;margin-bottom:6px;">TAM · SAM · SOM por categoría</h2>
    <p style="font-size:13px;color:#64748b;margin-bottom:14px;">Cada columna explicada arriba en el diccionario. <strong>Si SOM &lt; breakeven, hay sobreoferta económica real.</strong> Pasa el cursor sobre cada header para refresh rápido.</p>
    <div style="background:#ecfdf5;border-left:3px solid #0d9488;padding:12px 14px;border-radius:6px;margin-bottom:18px;font-size:13px;color:#134e4a;line-height:1.55;">
      <strong>¿Tu negocio está aquí? ¿La categoría que está pensando tu hijo está aquí?</strong> Busca la fila. Mira la columna <strong>Veredicto</strong> (🟢 sano · 🟡 al filo · ⚪ debajo breakeven · 🔥 hace falta). La columna <strong>Acción</strong> te dice qué pensar antes de decidir.
    </div>
    <div style="background:#fef3c7;border-left:3px solid #ca8a04;padding:12px 14px;border-radius:6px;margin-bottom:18px;font-size:12px;color:#78350f;line-height:1.55;">
      ⚠️ <strong>Caveat honesto:</strong> per-cápita spend y local capture rate son benchmarks de industria (<a href="https://www.bls.gov/cex/tables.htm" target="_blank" style="color:#92400e;text-decoration:underline;">BLS CES</a>, <a href="https://restaurant.org/research-and-media/research/economic-impact/" target="_blank" style="color:#92400e;text-decoration:underline;">NRA</a>, <a href="https://www.convenience.org/Research" target="_blank" style="color:#92400e;text-decoration:underline;">NACS</a>, <a href="https://www.ncpdp.org/" target="_blank" style="color:#92400e;text-decoration:underline;">NCPDP</a>, <a href="https://www.ihrsa.org/" target="_blank" style="color:#92400e;text-decoration:underline;">IHRSA</a>, <a href="https://www.ada.org/resources/research" target="_blank" style="color:#92400e;text-decoration:underline;">ADA</a>, <a href="https://www.tourism.pr.gov/" target="_blank" style="color:#92400e;text-decoration:underline;">PRTC</a>). Phase 2 sources cada uno individualmente. <strong>SOM es matemática live</strong> = SAM ÷ supply en directorio.
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="border-bottom:2px solid #1e293b;">
            <th style="text-align:left;padding:8px 6px;color:#475569;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;" title="Sector económico — la categoría">Categoría</th>
            <th style="text-align:right;padding:8px 6px;color:#475569;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;" title="TAM = mercado total. Todo el dinero gastado en esa categoría (incluye fuga).">TAM/yr</th>
            <th style="text-align:right;padding:8px 6px;color:#475569;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;" title="Qué % del TAM se queda en CR (lo demás fuga)">Capture</th>
            <th style="text-align:right;padding:8px 6px;color:#475569;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;" title="SAM = mercado capturable local. TAM × Capture %.">SAM/yr</th>
            <th style="text-align:right;padding:8px 6px;color:#475569;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;" title="Cuántos negocios open hay en directorio">Supply</th>
            <th style="text-align:right;padding:8px 6px;color:#475569;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;" title="SOM = revenue avg/biz/yr. SAM ÷ Supply.">SOM/biz</th>
            <th style="text-align:right;padding:8px 6px;color:#475569;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;" title="Lo mínimo para no quebrar (rango categoría)">Breakeven</th>
            <th style="text-align:right;padding:8px 6px;color:#475569;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;" title="Veredicto: holgado (verde) · borderline (amarillo) · debajo breakeven (rojo) · cero supply (rojo)">Veredicto</th>
            <th style="text-align:left;padding:8px 6px;color:#475569;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;" title="Qué hacer con esta data según tu situación">Acción</th>
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
            return `<tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:10px 6px;font-weight:600;color:#1e293b;">${esc(t.label)}</td>
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

  <!-- SECTION 5: GEOGRAPHIC CONCENTRATION -->
  <div class="card">
    <div class="kicker">Concentración geográfica</div>
    <h2 style="font-size:22px;font-weight:800;color:#1e293b;margin-bottom:6px;">¿Dónde está el supply, barrio por barrio?</h2>
    <p style="font-size:13px;color:#64748b;margin-bottom:18px;"><strong>60-70% del supply turístico se concentra en 2 barrios costeros.</strong> No es opinión — es geografía pura. Solo se muestran los ~25% de places con barrio asignado (Phase 2 backfill via lat/lon clustering).</p>
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
          <div style="font-size:14px;font-weight:700;color:#1e293b;margin-bottom:8px;">${esc(g.cat)} <span style="color:#94a3b8;font-weight:400;">· ${g.total} georreferenciados</span></div>
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
    <p style="font-size:13px;color:#64748b;margin-bottom:14px;">Cada punto = un negocio en su ubicación real (lat/lon del directorio). Categoría seleccionada en color · resto del directorio en gris claro pa' contexto. Click una categoría pa' cambiar el mapa.</p>
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
      <strong>${selectedPlaces.length}</strong> ${esc(selectedTab.label.toLowerCase())} en Cabo Rojo. ${selectedPlaces.length >= 30 ? 'La concentración visual es la cifra.' : selectedPlaces.length >= 10 ? 'Distribución visible en el mapa.' : 'Pocos puntos — categoría escasa o invisible al directorio.'} Hover sobre los puntos pa' ver el nombre. ${crPlaces.length} de ${(allPlaces as any[]).length} places dentro del bounding box CR (resto está en municipios vecinos).
    </p>
  </div>`;
  })()}

  <!-- SECTION 6: AJÁ MOMENTS -->
  <div class="card" style="background:#fffbeb;border-left:4px solid #ca8a04;">
    <div class="kicker" style="color:#ca8a04;">Ajá moments</div>
    <h2 style="font-size:22px;font-weight:800;color:#1e293b;margin-bottom:6px;">Lo que la mayoría no ve</h2>
    <p style="font-size:13px;color:#78350f;margin-bottom:20px;">Detectados automáticamente por la matemática + curados editorialmente. Son los hallazgos contraintuitivos — donde la primera intuición está incorrecta y el data corrige.</p>
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

  <!-- SECTION 6.5: CÓMO SABEMOS QUE ESTO ES VERDAD -->
  <div class="card" style="border-left:4px solid #16a34a;">
    <div class="kicker" style="color:#16a34a;">Verificable tú mismo</div>
    <h2 style="font-size:20px;font-weight:800;color:#1e293b;margin-bottom:6px;">Cómo sabemos que esto es verdad</h2>
    <p style="font-size:13px;color:#64748b;margin-bottom:16px;">Cada número arriba se puede comprobar. Sin secretos, sin opacidad. Cero "trust me bro."</p>
    <ul style="padding-left:20px;font-size:13px;color:#374151;line-height:1.85;list-style:none;">
      <li style="padding:8px 0;border-bottom:1px solid #f1f5f9;">📍 <strong>Población (50,798):</strong> abre <a href="https://data.census.gov/profile?q=Cabo+Rojo+Municipio,+Puerto+Rico" target="_blank" rel="noopener" style="color:#0d9488;font-weight:600;">data.census.gov</a> → busca "Cabo Rojo Municipio". FIPS 72023.</li>
      <li style="padding:8px 0;border-bottom:1px solid #f1f5f9;">🏢 <strong>Supply (negocios open):</strong> <a href="https://mapadecaborojo.com" target="_blank" rel="noopener" style="color:#0d9488;font-weight:600;">mapadecaborojo.com</a> → directorio live. Cada place tiene <code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;">last_verified_at</code>.</li>
      <li style="padding:8px 0;border-bottom:1px solid #f1f5f9;">🔍 <strong>Demanda:</strong> logs reales del bot *7711 (visible en <a href="/admin/municipio" style="color:#0d9488;font-weight:600;">/admin/municipio</a> si tienes acceso admin).</li>
      <li style="padding:8px 0;border-bottom:1px solid #f1f5f9;">💵 <strong>Per-cápita spend:</strong> <a href="https://www.bls.gov/cex/tables.htm" target="_blank" rel="noopener" style="color:#0d9488;font-weight:600;">BLS CES Tables</a> + industry sources (NRA, NACS, NCPDP, IHRSA, ADA).</li>
      <li style="padding:8px 0;border-bottom:1px solid #f1f5f9;">📊 <strong>Breakeven:</strong> <a href="https://www.bls.gov/cew/" target="_blank" rel="noopener" style="color:#0d9488;font-weight:600;">BLS QCEW</a> establishments + payroll por NAICS sector.</li>
      <li style="padding:8px 0;">🏖️ <strong>Visitor flow (250K/yr):</strong> <a href="https://www.tourism.pr.gov/" target="_blank" rel="noopener" style="color:#0d9488;font-weight:600;">PRTC</a> estimate — Phase 2 calibra con counters Boquerón/Joyuda/Combate.</li>
    </ul>
    <div style="margin-top:14px;padding:12px 14px;background:#f0fdf4;border-radius:8px;font-size:12px;color:#14532d;">
      <strong>¿Encontraste un error?</strong> Texteanos al <a href="https://wa.me/17874177711?text=Encontr%C3%A9%20un%20error%20en%20pueblo-en-numeros" target="_blank" rel="noopener" style="color:#0d9488;font-weight:700;">787-417-7711</a>. Si tienes razón, lo arreglamos hoy + agregamos tu corrección citada en el reporte.
    </div>
  </div>

  <!-- SECTION 7: LO QUE NO SABEMOS -->
  <div class="card" style="border-left:4px solid #64748b;">
    <div class="kicker" style="color:#64748b;">Transparencia honesta</div>
    <h2 style="font-size:20px;font-weight:800;color:#1e293b;margin-bottom:6px;">Lo Que NO Sabemos</h2>
    <p style="font-size:13px;color:#64748b;margin-bottom:18px;">El moat del portal honesto: las cosas que la data actual no cubre. Phase 2 cubre cada una.</p>
    <ol style="padding-left:24px;font-size:13px;color:#374151;line-height:1.8;">
      <li><strong>Cuántos negocios son zombi.</strong> Solo 791 de 3,887 verificados — 1.5% en 90 días. La cifra "open" puede estar inflada 5-15%. Phase 2: scrape Google Places <code>business_status</code>.</li>
      <li><strong>Tasa de mortalidad real.</strong> No tenemos data longitudinal de cierres/año. Hipótesis: 15-20% turnover en categorías saturadas.</li>
      <li><strong>Margen y health financiero por categoría.</strong> Datos privados. Inferible solo por proxy (reseñas, hours, antigüedad).</li>
      <li><strong>Economía informal completa.</strong> La repostería casera (4 demand, 0 supply en DB) probablemente tiene 30-100 productores via FB/IG. El bot no los ve. Google Maps tampoco.</li>
      <li><strong>True visitor count.</strong> PRTC es encuestas, no ground truth. Sin esto no calibramos bien la oversupply turística.</li>
      <li><strong>Cross-municipality flow.</strong> Cuántos clientes de farmacia/médico vienen de Lajas, Hormigueros, San Germán. Si CR sirve a 80K en vez de 50K, los ratios cambian.</li>
      <li><strong>Si la sobreoferta empeora o se estabiliza.</strong> Sin time-series. Phase 2: yearly snapshots Google Places 2020-2025.</li>
      <li><strong>Si los dueños actuales son rentables.</strong> Pueden estar oversupplied y RICOS (turistas pagan premium) o oversupplied y QUEBRANDO. Diferente prescripción.</li>
      <li><strong>El verdadero rol de los chains.</strong> Walgreens, McDonald's, Subway no los trackeamos. 0 chain_id en toda la data.</li>
      <li><strong>Bodas/eventos.</strong> 10 búsquedas/90d, 0 supply en DB. Hay docenas de wedding planners en FB sin licencia. Categoría 100% invisible al stack.</li>
    </ol>
  </div>

  <!-- SECTION 8: ¿QUÉ HAGO CON ESTO? -->
  <div class="card">
    <div class="kicker">Acción</div>
    <h2 style="font-size:22px;font-weight:800;color:#1e293b;margin-bottom:18px;">¿Qué hago con esto?</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;">

      <div style="padding:18px;background:#f0fdf4;border-radius:10px;border-left:3px solid #16a34a;">
        <div style="font-size:13px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">🎯 Si vas a abrir negocio</div>
        <div style="font-size:13px;color:#1e293b;font-weight:600;margin-bottom:6px;">Categorías a EVITAR:</div>
        <p style="font-size:12px;color:#475569;line-height:1.6;margin-bottom:10px;">Restaurante casual, food truck, salón de belleza, boutique, car wash, gimnasio, abogado nuevo, gasolinera. La matemática dice que la próxima abre en mercado ya pisado.</p>
        <div style="font-size:13px;color:#1e293b;font-weight:600;margin-bottom:6px;">Donde el pueblo TE NECESITA:</div>
        <p style="font-size:12px;color:#475569;line-height:1.6;">Plomero, electricista, AC tech, cardiólogo, ginecólogo, especialistas médicos, nursing home, repostería con licencia, terapia física. Si tienes la habilidad — esa apertura paga rápido.</p>
      </div>

      <div style="padding:18px;background:#fef3c7;border-radius:10px;border-left:3px solid #ca8a04;">
        <div style="font-size:13px;font-weight:700;color:#ca8a04;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">⚙️ Si eres dueño en categoría saturada</div>
        <p style="font-size:12px;color:#475569;line-height:1.6;margin-bottom:8px;">Las 3 únicas movidas que mueven aguja según la data:</p>
        <ol style="padding-left:18px;font-size:12px;color:#475569;line-height:1.7;">
          <li><strong>Hacer una cosa específica que nadie más hace.</strong> No "mejor servicio" abstracto — algo concreto. La única pizzería con masa de 72 horas y horno de leña. La única panadería que entrega antes de las 6am.</li>
          <li><strong>Salir del consumer y entrar B2B.</strong> Si vendes pan al cliente, también véndele a los hoteles, a los cafés, a las panaderías más chicas. El consumer es donde está la sobreoferta. El B2B es nicho protegido.</li>
          <li><strong>Especializarte en UN tipo de cliente.</strong> No "todo el mundo." El bar de los músicos locales con bookings semanales. La barbería de los hombres que cortan corto y rápido en el almuerzo.</li>
        </ol>
        <p style="font-size:11px;color:#92400e;margin-top:8px;font-style:italic;">"Mejor servicio" o "renovamos imagen" es ilusión en mercado oversupplied.</p>
      </div>

      <div style="padding:18px;background:#eff6ff;border-radius:10px;border-left:3px solid #0369a1;">
        <div style="font-size:13px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">🏛️ Si eres alcalde / Cámara Comercio</div>
        <p style="font-size:12px;color:#475569;line-height:1.6;margin-bottom:10px;"><strong>El argumento:</strong> Cabo Rojo aprueba patentes sin data de saturación. 50% más densidad que la mediana PR. 5+ categorías oversupplied confirmadas. 17 categorías con ZERO supply pero demanda real.</p>
        <p style="font-size:12px;color:#475569;line-height:1.6;"><strong>Política propuesta:</strong> dashboard público de density por categoría (este) + freeze suave a aprobaciones en categorías con search_per_biz &lt; 1.0 + incentivos a categorías ZERO_SUPPLY.</p>
        <p style="font-size:11px;color:#1e40af;margin-top:8px;font-style:italic;">Esto es lo que hace política basada en data en vez de en política.</p>
      </div>
    </div>
  </div>

  <!-- SECTION 8.5: COMPARTE CTA (residente-facing close) -->
  <div class="card" style="background:#ecfdf5;border-left:4px solid #0d9488;text-align:center;">
    <div style="font-size:32px;margin-bottom:8px;">🤝</div>
    <div style="font-size:18px;font-weight:800;color:#134e4a;margin-bottom:6px;">Si alguien en tu mesa está pensando abrir negocio — mándale esta página.</div>
    <div style="font-size:13px;color:#0f766e;line-height:1.5;">Es la única regla: que no abra a ciegas. Léela una vez. Compártela una vez. Y vuelve cuando alguien diga "voy a abrir X."</div>
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
      <strong>Visitor flow:</strong> <a href="https://www.tourism.pr.gov/" target="_blank" rel="noopener" style="color:#0d9488;">PRTC</a> estimate (Phase 2 calibrates). ·
      <strong>Per-cápita spend:</strong> <a href="https://www.bls.gov/cex/tables.htm" target="_blank" rel="noopener" style="color:#0d9488;">BLS CES</a>, <a href="https://restaurant.org/research-and-media/research/economic-impact/" target="_blank" rel="noopener" style="color:#0d9488;">NRA</a>, <a href="https://www.convenience.org/Research" target="_blank" rel="noopener" style="color:#0d9488;">NACS</a>, <a href="https://www.ncpdp.org/" target="_blank" rel="noopener" style="color:#0d9488;">NCPDP</a>, <a href="https://www.ihrsa.org/" target="_blank" rel="noopener" style="color:#0d9488;">IHRSA</a>, <a href="https://www.ada.org/resources/research" target="_blank" rel="noopener" style="color:#0d9488;">ADA</a>, <a href="https://www.cms.gov/" target="_blank" rel="noopener" style="color:#0d9488;">CMS</a>, <a href="https://www.probeauty.org/" target="_blank" rel="noopener" style="color:#0d9488;">PBA</a> — industry benchmarks. ·
      <strong>Supply:</strong> <a href="https://mapadecaborojo.com" target="_blank" rel="noopener" style="color:#0d9488;">Live directorio MapaDeCaboRojo.com</a>. ·
      <strong>Demand:</strong> Live bot *7711 search logs (90 días). ·
      <strong>PR business density benchmark:</strong> estimate via <a href="https://www.bls.gov/cew/" target="_blank" rel="noopener" style="color:#0d9488;">BLS QCEW</a> (Phase 2 sources properly).
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
    case 'pueblo-en-numeros': return handle_pueblo_en_numeros(req, res);
    default: return res.status(404).json({ error: 'Page not found' });
  }
}
