/**
 * /api/carro.ts — "Verifica tu carro" (VIN → NHTSA recalls, en español)
 * Route: /carro (via vercel.json rewrite)
 *
 * VALIDATION TOOL — próxima herramienta en evaluación (aprobado por Angel jul 2026).
 * NO es dominio nuevo. Vive en el monolito mapadecaborojo.com.
 *
 * Flow:
 *   GET /carro                → formulario vacío
 *   GET /carro?vin=XXXX...    → decodifica VIN (NHTSA vPIC) + busca recalls abiertos
 *   GET /carro?make=X&model=Y&year=Z → busca recalls por marca/modelo/año (sin VIN)
 *
 * Data source: NHTSA vPIC (decode) + NHTSA Recalls API (recallsByVehicle). Federal, gratis, sin key.
 * CTA doble: textea CARRO al *7711 · directorio de mecánicos del mapa.
 */

const SITE_URL = 'https://mapadecaborojo.com';
const PHONE_CTA = '787-417-7711';

function esc(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidVin(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin.trim());
}

interface VpicResult {
  Make?: string;
  Model?: string;
  ModelYear?: string;
  ErrorCode?: string;
  ErrorText?: string;
  [key: string]: any;
}

interface Recall {
  Manufacturer?: string;
  NHTSACampaignNumber?: string;
  Component?: string;
  Summary?: string;
  Consequence?: string;
  Remedy?: string;
  ReportReceivedDate?: string;
}

async function decodeVin(vin: string): Promise<{ make: string; model: string; year: string } | null> {
  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const row: VpicResult = json?.Results?.[0];
    if (!row) return null;
    const make = (row.Make || '').trim();
    const model = (row.Model || '').trim();
    const year = (row.ModelYear || '').trim();
    if (!make || !year) return null;
    return { make, model, year };
  } catch {
    return null;
  }
}

async function getRecalls(make: string, model: string, year: string): Promise<Recall[]> {
  try {
    const params = new URLSearchParams({ make, model: model || '', modelYear: year });
    const res = await fetch(
      `https://api.nhtsa.gov/recalls/recallsByVehicle?${params.toString()}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.results) ? json.results : [];
  } catch {
    return [];
  }
}

function layout(opts: { title: string; description: string; body: string; canonical: string }): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<link rel="canonical" href="${esc(opts.canonical)}">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(opts.canonical)}">
<script src="https://cdn.tailwindcss.com"></script>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚗</text></svg>">
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen">
<header class="bg-teal-700 text-white py-4 px-4">
  <div class="max-w-3xl mx-auto flex items-center justify-between">
    <a href="/" class="font-bold text-lg">🗺️ MapaDeCaboRojo.com</a>
    <a href="/carro" class="text-sm underline">Verifica tu carro</a>
  </div>
</header>
<main class="max-w-3xl mx-auto px-4 py-8">
${opts.body}
</main>
<footer class="max-w-3xl mx-auto px-4 py-8 text-xs text-slate-400 border-t border-slate-200 mt-8">
  <p>Data de recalls: <a href="https://www.nhtsa.gov/recalls" target="_blank" rel="noopener" class="underline">NHTSA</a> (agencia federal de EE.UU.). El remedio de un recall lo hace el dealer <strong>gratis por ley</strong> — no tiene costo para ti.</p>
  <p class="mt-2">Si te sirve, llégate. Si no, sigue tu camino. — Angel | Menos revolú, más sistema, mejor vida.</p>
</footer>
</body>
</html>`;
}

function formHtml(prefill?: { vin?: string; make?: string; model?: string; year?: string }): string {
  return `
<h1 class="text-2xl md:text-3xl font-bold text-slate-900 mb-2">🚗 Verifica tu carro</h1>
<p class="text-slate-600 mb-6">Mete el número de VIN (17 caracteres, lo tienes en el registro o en el marco del parabrisas) y te decimos si tu carro tiene algún <strong>recall abierto</strong> — arreglos gratis que el dealer te debe.</p>

<form method="GET" action="/carro" class="bg-white border border-slate-200 rounded-xl p-5 mb-6">
  <label class="block text-sm font-semibold text-slate-700 mb-1">Número de VIN (17 caracteres)</label>
  <input type="text" name="vin" maxlength="17" placeholder="1FTFW1ET5DFC10312" value="${esc(prefill?.vin || '')}"
    class="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-teal-500 uppercase tracking-wide">
  <button type="submit" class="w-full sm:w-auto px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold">Buscar recalls</button>
</form>

<p class="text-center text-sm text-slate-400 mb-6">— o si no tienes el VIN a mano —</p>

<form method="GET" action="/carro" class="bg-white border border-slate-200 rounded-xl p-5 mb-6">
  <p class="text-sm font-semibold text-slate-700 mb-3">Busca por marca, modelo y año</p>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
    <input type="text" name="make" placeholder="Marca (ej. Toyota)" value="${esc(prefill?.make || '')}" class="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
    <input type="text" name="model" placeholder="Modelo (ej. Corolla)" value="${esc(prefill?.model || '')}" class="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
    <input type="text" name="year" placeholder="Año (ej. 2019)" value="${esc(prefill?.year || '')}" class="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
  </div>
  <button type="submit" class="w-full sm:w-auto px-5 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-sm font-bold">Buscar</button>
</form>

<div class="bg-teal-50 border border-teal-200 rounded-xl p-4 text-sm text-slate-700">
  <p class="font-semibold mb-1">📲 Más fácil por texto</p>
  <p>Textea <strong>CARRO</strong> al <a href="https://wa.me/17874177711?text=CARRO" class="underline font-semibold">${PHONE_CTA}</a> con tu VIN o marca/modelo/año — El Veci te contesta.</p>
</div>`;
}

function recallCard(r: Recall): string {
  return `<div class="bg-white border border-amber-300 rounded-xl p-4 mb-3">
    <div class="flex items-start justify-between gap-2 mb-2">
      <span class="text-xs font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Campaña #${esc(r.NHTSACampaignNumber)}</span>
      <span class="text-xs text-slate-400">${esc(r.ReportReceivedDate)}</span>
    </div>
    <p class="font-bold text-slate-900 mb-1">🔧 ${esc(r.Component) || 'Componente no especificado'}</p>
    ${r.Summary ? `<p class="text-sm text-slate-700 mb-2"><strong>Qué pasa:</strong> ${esc(r.Summary)}</p>` : ''}
    ${r.Consequence ? `<p class="text-sm text-slate-700 mb-2"><strong>Riesgo:</strong> ${esc(r.Consequence)}</p>` : ''}
    ${r.Remedy ? `<p class="text-sm text-slate-700"><strong>Remedio:</strong> ${esc(r.Remedy)} <span class="text-teal-700 font-semibold">(gratis por ley)</span></p>` : ''}
  </div>`;
}

function resultsHtml(vehicle: { make: string; model: string; year: string }, recalls: Recall[]): string {
  const label = `${vehicle.year} ${vehicle.make}${vehicle.model ? ' ' + vehicle.model : ''}`;
  const body = recalls.length > 0
    ? `<div class="bg-red-50 border border-red-300 rounded-xl p-4 mb-4">
        <p class="font-bold text-red-800">⚠️ Encontramos ${recalls.length} recall${recalls.length > 1 ? 's' : ''} abierto${recalls.length > 1 ? 's' : ''} para tu ${esc(label)}</p>
      </div>
      ${recalls.map(recallCard).join('')}`
    : `<div class="bg-green-50 border border-green-300 rounded-xl p-4 mb-4">
        <p class="font-bold text-green-800">✅ No encontramos recalls abiertos para tu ${esc(label)}</p>
        <p class="text-sm text-green-700 mt-1">Eso es buena noticia — pero verifica de vez en cuando, los recalls salen nuevos.</p>
      </div>`;

  return `
<a href="/carro" class="text-sm text-teal-700 underline mb-4 inline-block">← Buscar otro carro</a>
<h1 class="text-2xl font-bold text-slate-900 mb-4">${esc(label)}</h1>
${body}
<div class="bg-teal-50 border border-teal-200 rounded-xl p-4 text-sm text-slate-700 mt-6">
  <p class="font-semibold mb-1">¿Tienes un recall? Dos pasos:</p>
  <p class="mb-2">1. Textea <strong>CARRO</strong> al <a href="https://wa.me/17874177711?text=CARRO ${esc(vehicle.year)} ${esc(vehicle.make)} ${esc(vehicle.model)}" class="underline font-semibold">${PHONE_CTA}</a> pa' guardar esto y que te avisemos de recalls nuevos.</p>
  <p>2. ¿No es un recall, sino que el carro necesita servicio? <a href="/categoria/mecanico" class="underline font-semibold">Mira los mecánicos verificados de Cabo Rojo →</a></p>
</div>`;
}

function errorHtml(msg: string): string {
  return `
<a href="/carro" class="text-sm text-teal-700 underline mb-4 inline-block">← Volver</a>
<div class="bg-red-50 border border-red-300 rounded-xl p-4">
  <p class="font-bold text-red-800">${esc(msg)}</p>
</div>
${formHtml()}`;
}

export default async function handler(req: any, res: any) {
  const url = new URL(req.url, `https://${req.headers.host || 'mapadecaborojo.com'}`);
  const vinParam = (url.searchParams.get('vin') || '').trim();
  const makeParam = (url.searchParams.get('make') || '').trim();
  const modelParam = (url.searchParams.get('model') || '').trim();
  const yearParam = (url.searchParams.get('year') || '').trim();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');

  const title = 'Verifica tu carro — Recalls NHTSA en español | MapaDeCaboRojo.com';
  const description = 'Mete tu VIN o marca/modelo/año y verifica si tu carro tiene un recall abierto. Data federal NHTSA, en español. El arreglo es gratis por ley.';
  const canonical = `${SITE_URL}/carro`;

  // No input yet — show form
  if (!vinParam && !(makeParam && yearParam)) {
    res.status(200).send(layout({ title, description, canonical, body: formHtml() }));
    return;
  }

  let vehicle: { make: string; model: string; year: string } | null = null;

  if (vinParam) {
    if (!isValidVin(vinParam)) {
      res.status(200).send(layout({
        title, description, canonical,
        body: errorHtml('Ese VIN no parece válido — debe tener 17 caracteres (letras y números, sin I/O/Q).'),
      }));
      return;
    }
    vehicle = await decodeVin(vinParam);
    if (!vehicle) {
      res.status(200).send(layout({
        title, description, canonical,
        body: errorHtml('No pudimos decodificar ese VIN ahora mismo. Intenta de nuevo o busca por marca/modelo/año.'),
      }));
      return;
    }
  } else {
    vehicle = { make: makeParam, model: modelParam, year: yearParam };
  }

  const recalls = await getRecalls(vehicle.make, vehicle.model, vehicle.year);

  res.status(200).send(layout({
    title: `${vehicle.year} ${vehicle.make} — Recalls | MapaDeCaboRojo.com`,
    description: `Recalls NHTSA para ${vehicle.year} ${vehicle.make} ${vehicle.model}. Data federal, en español.`,
    canonical,
    body: resultsHtml(vehicle, recalls),
  }));
}
