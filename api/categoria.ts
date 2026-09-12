import { createClient } from '@supabase/supabase-js';
import { correctButtonHtml } from './_lib/correct-button.js';
import { coleccionLd, bloqueRespuesta, pluralEs, ldScript, selloConFecha, fechaCortaAT } from './_lib/procedencia.js';
import { quiereMarkdown, enviarMd, linkAlternoMd, pieMd } from './_lib/agente-md.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function logApiCall(endpoint: string, method: string | null, query: string | null, userAgent: string | null, ip: string | null, responseCount: number | null, referrer?: string | null) {
  try {
    await supabase.from('api_logs').insert({
      endpoint,
      method,
      query,
      user_agent: (userAgent || '').substring(0, 500),
      ip: (ip || '').substring(0, 45),
      response_count: responseCount,
      referrer: (referrer || '').substring(0, 500) || null
    });
  } catch {} // fire-and-forget, never block the response
}

function esc(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Normalize messy phone formats in `places.phone` ("+1 787-899-1686", "(787) 892-0944",
// "+19393470111") to a single 10-digit string + display form. Returns null if unusable.
function normalizePhone(raw: string | null | undefined): { digits10: string; display: string } | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const last10 = digits.slice(-10);
  return { digits10: last10, display: `${last10.slice(0, 3)}-${last10.slice(3, 6)}-${last10.slice(6)}` };
}

function formatTime12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h)) return hhmm;
  const period = h >= 12 ? 'pm' : 'am';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`;
}

// Open/closed status label. Returns null when no usable hours data.
// Note: page is cached 1h (s-maxage=3600), so badge can lag by up to 1h —
// trade-off accepted for SSR. If accuracy needed, recompute client-side.
// deno-lint-ignore no-explicit-any
function getOpenStatusLabel(opening_hours: any): string | null {
  if (!opening_hours || typeof opening_hours !== 'object') return null;
  // 'always_open' (1 fila) y '24_7' (12) conviven en la data: entraron por
  // importadores distintos. Cada archivo chequeaba solo una, asi que los 12
  // negocios de 24 horas salian sin horario en las paginas del servidor.
  if (opening_hours.type === 'always_open' || opening_hours.type === '24_7') return '🟢 Abierto 24h';
  if (!Array.isArray(opening_hours.structured) || opening_hours.structured.length === 0) return null;

  // Puerto Rico = UTC-4 (no DST)
  const prNow = new Date(Date.now() - 4 * 3600_000);
  const dayOfWeek = prNow.getUTCDay();
  const currentTime = `${String(prNow.getUTCHours()).padStart(2, '0')}:${String(prNow.getUTCMinutes()).padStart(2, '0')}`;

  // deno-lint-ignore no-explicit-any
  const byDay = new Map<number, any>();
  for (const e of opening_hours.structured) byDay.set(e.day, e);

  const today = byDay.get(dayOfWeek);
  if (today && !today.isClosed && today.open && today.close) {
    if (currentTime >= today.open && currentTime <= today.close) return '🟢 Abierto';
    if (currentTime < today.open) return `🔴 Cerrado · abre ${formatTime12h(today.open)}`;
  }

  const dayNames = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  for (let i = 1; i <= 7; i++) {
    const d = (dayOfWeek + i) % 7;
    const entry = byDay.get(d);
    if (entry && !entry.isClosed && entry.open) {
      const dayLabel = i === 1 ? 'mañana' : dayNames[d];
      return `🔴 Cerrado · abre ${dayLabel} ${formatTime12h(entry.open)}`;
    }
  }
  return '🔴 Cerrado';
}

// Las 34 categorías que anuncia el sitemap (espejo de api/sitemap.ts § Category pages).
// Cualquier otro slug de CATEGORY_MAP es un alias y redirige 301 a la suya. Si agregas una
// categoría al sitemap, agrégala aquí en el mismo commit o el alias se comerá la canónica.
const CANONICAL_CATEGORY_SLUGS = new Set(['restaurantes', 'playas', 'salud', 'farmacia', 'dentista', 'veterinario', 'medico', 'hospital', 'laboratorio', 'optica', 'salud-mental', 'quiropractico', 'gimnasio', 'fisiatra', 'hospedaje', 'servicios', 'compras', 'entretenimiento', 'turismo', 'deportes', 'belleza', 'automotriz', 'marina', 'educacion', 'gobierno', 'helados', 'panaderia', 'pizza', 'mariscos', 'lavanderia', 'cafe', 'barberia', 'peluqueria', 'imprenta']);

// Maps URL slug / search term → canonical category values in DB + display name
const CATEGORY_MAP: Record<string, { match: string[]; display: string; emoji: string; nameMatch?: boolean }> = {
  restaurante:    { match: ['restaurante', 'restaurant', 'food', 'comida', 'FOOD', 'RESTAURANTE'], display: 'Restaurantes', emoji: '🍽️' },
  restaurantes:   { match: ['restaurante', 'restaurant', 'food', 'comida', 'FOOD', 'RESTAURANTE'], display: 'Restaurantes', emoji: '🍽️' },
  playa:          { match: ['playa', 'beach', 'BEACH', 'PLAYA'], display: 'Playas', emoji: '🏖️' },
  playas:         { match: ['playa', 'beach', 'BEACH', 'PLAYA'], display: 'Playas', emoji: '🏖️' },
  salud:          { match: ['salud', 'health', 'HEALTH', 'SALUD', 'farmacia', 'medico', 'médico', 'dentista', 'laboratorio'], display: 'Salud', emoji: '🏥' },
  farmacia:       { match: ['farmacia', 'pharmacy', 'FARMACIA', 'Farmacia'], display: 'Farmacias en Cabo Rojo', emoji: '💊', nameMatch: true },
  farmacias:      { match: ['farmacia', 'pharmacy', 'FARMACIA', 'Farmacia'], display: 'Farmacias en Cabo Rojo', emoji: '💊', nameMatch: true },
  dentista:       { match: ['dentista', 'dentist', 'dental', 'ortodoncista', 'orthodontist', 'Dentista'], display: 'Dentistas', emoji: '🦷', nameMatch: true },
  dentistas:      { match: ['dentista', 'dentist', 'dental', 'ortodoncista', 'orthodontist', 'Dentista'], display: 'Dentistas', emoji: '🦷', nameMatch: true },
  veterinario:    { match: ['veterinario', 'veterinary', 'vet', 'Veterinario'], display: 'Veterinarios', emoji: '🐾', nameMatch: true },
  veterinarios:   { match: ['veterinario', 'veterinary', 'vet', 'Veterinario'], display: 'Veterinarios', emoji: '🐾', nameMatch: true },
  medico:         { match: ['doctor', 'médico', 'medico', 'physician', 'Medico General', 'Medicina Interna', 'internista'], display: 'Médicos', emoji: '👨‍⚕️', nameMatch: true },
  medicos:        { match: ['doctor', 'médico', 'medico', 'physician', 'Medico General', 'Medicina Interna', 'internista'], display: 'Médicos', emoji: '👨‍⚕️', nameMatch: true },
  hospital:       { match: ['hospital', 'centro medico', 'centro médico', 'emergencia', 'CDT', 'clínica', 'clinica', 'Clínica'], display: 'Hospitales y Clínicas', emoji: '🏥', nameMatch: true },
  hospitales:     { match: ['hospital', 'centro medico', 'centro médico', 'emergencia', 'CDT', 'clínica', 'clinica', 'Clínica'], display: 'Hospitales y Clínicas', emoji: '🏥', nameMatch: true },
  laboratorio:    { match: ['laboratorio', 'laboratory', 'lab', 'Laboratorio Clínico', 'diagnostico', 'Centro de Diagnostico'], display: 'Laboratorios', emoji: '🔬', nameMatch: true },
  laboratorios:   { match: ['laboratorio', 'laboratory', 'lab', 'Laboratorio Clínico', 'diagnostico', 'Centro de Diagnostico'], display: 'Laboratorios', emoji: '🔬', nameMatch: true },
  optica:         { match: ['óptica', 'optica', 'optometry', 'oftalmología', 'oftalmologia', 'optometrista', 'Óptica'], display: 'Ópticas', emoji: '👓', nameMatch: true },
  opticas:        { match: ['óptica', 'optica', 'optometry', 'oftalmología', 'oftalmologia', 'optometrista', 'Óptica'], display: 'Ópticas', emoji: '👓', nameMatch: true },
  'salud-mental': { match: ['salud mental', 'Salud Mental', 'psicólogo', 'psicología', 'psychologist', 'psychiatrist', 'psiquiatra', 'terapeuta'], display: 'Salud Mental', emoji: '🧠', nameMatch: true },
  quiropractico:  { match: ['quiropractico', 'quiropráctico', 'chiropractor', 'chiropractic', 'quiropráctica'], display: 'Quiroprácticos', emoji: '🦴', nameMatch: true },
  fisiatra:       { match: ['fisiatra', 'fisiatría', 'fisiatria', 'medicina física', 'medicina fisica', 'rehabilitación', 'rehabilitacion', 'physiatrist', 'physical medicine'], display: 'Fisiatras en Cabo Rojo', emoji: '🩺', nameMatch: true },
  fisiatras:      { match: ['fisiatra', 'fisiatría', 'fisiatria', 'medicina física', 'medicina fisica', 'rehabilitación', 'rehabilitacion', 'physiatrist', 'physical medicine'], display: 'Fisiatras en Cabo Rojo', emoji: '🩺', nameMatch: true },
  cardiologo:     { match: ['cardiolog', 'cardiólog', 'Cardiología', 'cardiology', 'cardiovascular'], display: 'Cardiólogos del Oeste', emoji: '❤️', nameMatch: true },
  cardiologos:    { match: ['cardiolog', 'cardiólog', 'Cardiología', 'cardiology', 'cardiovascular'], display: 'Cardiólogos del Oeste', emoji: '❤️', nameMatch: true },
  cardiologia:    { match: ['cardiolog', 'cardiólog', 'Cardiología', 'cardiology', 'cardiovascular'], display: 'Cardiólogos del Oeste', emoji: '❤️', nameMatch: true },
  nefrologo:      { match: ['nefrolog', 'nefrólog', 'nephrolog', 'riñón', 'rinon', 'riñones', 'renal', 'diálisis', 'dialisis'], display: 'Nefrólogos del Oeste', emoji: '🩺', nameMatch: true },
  nefrologos:     { match: ['nefrolog', 'nefrólog', 'nephrolog', 'riñón', 'rinon', 'riñones', 'renal', 'diálisis', 'dialisis'], display: 'Nefrólogos del Oeste', emoji: '🩺', nameMatch: true },
  endocrinologo:  { match: ['endocrin', 'endocrinólog', 'endocrinology', 'diabetes', 'tiroides', 'thyroid', 'hormona'], display: 'Endocrinólogos del Oeste', emoji: '🩺', nameMatch: true },
  endocrinologos: { match: ['endocrin', 'endocrinólog', 'endocrinology', 'diabetes', 'tiroides', 'thyroid', 'hormona'], display: 'Endocrinólogos del Oeste', emoji: '🩺', nameMatch: true },
  neurologo:      { match: ['neurolog', 'neurólog', 'neurology', 'derrame', 'epilepsia', 'migraña', 'migrana', 'parkinson', 'neuropat'], display: 'Neurólogos del Oeste', emoji: '🧠', nameMatch: true },
  neurologos:     { match: ['neurolog', 'neurólog', 'neurology', 'derrame', 'epilepsia', 'migraña', 'migrana', 'parkinson', 'neuropat'], display: 'Neurólogos del Oeste', emoji: '🧠', nameMatch: true },
  ortopeda:       { match: ['ortoped', 'orthopaed', 'orthoped', 'huesos', 'fractura', 'rodilla', 'cadera', 'columna'], display: 'Ortopedas del Oeste', emoji: '🦴', nameMatch: true },
  ortopedas:      { match: ['ortoped', 'orthopaed', 'orthoped', 'huesos', 'fractura', 'rodilla', 'cadera', 'columna'], display: 'Ortopedas del Oeste', emoji: '🦴', nameMatch: true },
  'cardiología':  { match: ['cardiolog', 'cardiólog', 'Cardiología', 'cardiology', 'cardiovascular'], display: 'Cardiólogos del Oeste', emoji: '❤️', nameMatch: true },
  gimnasio:       { match: ['fitness', 'gym', 'gimnasio', 'crossfit', 'training', 'ejercicio', 'boxeo', 'boxing', 'yoga', 'pilates', 'cardio', 'pesas', 'zumba', 'spinning', 'runner', 'running'], display: 'Gimnasios & Fitness', emoji: '💪', nameMatch: true },
  gimnasios:      { match: ['fitness', 'gym', 'gimnasio', 'crossfit', 'training', 'ejercicio', 'boxeo', 'boxing', 'yoga', 'pilates', 'cardio', 'pesas', 'zumba', 'spinning', 'runner', 'running'], display: 'Gimnasios & Fitness', emoji: '💪', nameMatch: true },
  hospedaje:      { match: ['hospedaje', 'lodging', 'hotel', 'LODGING', 'HOSPEDAJE', 'alojamiento'], display: 'Hospedaje', emoji: '🏨' },
  hotel:          { match: ['hospedaje', 'lodging', 'hotel', 'LODGING', 'HOSPEDAJE', 'alojamiento'], display: 'Hospedaje', emoji: '🏨' },
  servicio:       { match: ['servicio', 'service', 'SERVICE', 'SERVICIO', 'servicios'], display: 'Servicios', emoji: '🔧' },
  servicios:      { match: ['servicio', 'service', 'SERVICE', 'SERVICIO', 'servicios'], display: 'Servicios', emoji: '🔧' },
  // Sub-slugs de Servicios (Angel feedback May 19 — sub-chips del hero apuntan acá)
  plomero:        { match: ['plomero', 'plumber', 'plomería', 'plomeria', 'plumbing'], display: 'Plomeros', emoji: '🔧', nameMatch: true },
  plomeros:       { match: ['plomero', 'plumber', 'plomería', 'plomeria', 'plumbing'], display: 'Plomeros', emoji: '🔧', nameMatch: true },
  ac:             { match: ['aire acondicionado', 'aire-acondicionado', 'air condition', 'refrigeración', 'refrigeracion', 'hvac', 'ac repair', 'air conditioning'], display: 'AC y Refrigeración', emoji: '❄️', nameMatch: true },
  'aire-acondicionado': { match: ['aire acondicionado', 'aire-acondicionado', 'air condition', 'refrigeración', 'refrigeracion', 'hvac', 'ac repair', 'air conditioning'], display: 'AC y Refrigeración', emoji: '❄️', nameMatch: true },
  mecanico:       { match: ['mecánico', 'mecanico', 'mechanic', 'taller mecánico', 'taller mecanico', 'auto repair', 'taller'], display: 'Mecánicos y Talleres', emoji: '🔧', nameMatch: true },
  mecanicos:      { match: ['mecánico', 'mecanico', 'mechanic', 'taller mecánico', 'taller mecanico', 'auto repair', 'taller'], display: 'Mecánicos y Talleres', emoji: '🔧', nameMatch: true },
  electrico:      { match: ['eléctrico', 'electrico', 'electrician', 'electricista', 'electricidad'], display: 'Electricistas', emoji: '⚡', nameMatch: true },
  electricista:   { match: ['eléctrico', 'electrico', 'electrician', 'electricista', 'electricidad'], display: 'Electricistas', emoji: '⚡', nameMatch: true },
  electricistas:  { match: ['eléctrico', 'electrico', 'electrician', 'electricista', 'electricidad'], display: 'Electricistas', emoji: '⚡', nameMatch: true },
  solar:          { match: ['solar', 'placas solares', 'placa solar', 'fotovoltaic', 'paneles solares', 'energía solar', 'energia solar'], display: 'Instaladores de Placas Solares', emoji: '☀️', nameMatch: true },
  solares:        { match: ['solar', 'placas solares', 'placa solar', 'fotovoltaic', 'paneles solares', 'energía solar', 'energia solar'], display: 'Instaladores de Placas Solares', emoji: '☀️', nameMatch: true },
  placas:         { match: ['solar', 'placas solares', 'placa solar', 'fotovoltaic', 'paneles solares', 'energía solar', 'energia solar'], display: 'Instaladores de Placas Solares', emoji: '☀️', nameMatch: true },
  notario:        { match: ['notario', 'notary', 'notaría', 'notaria', 'abogado', 'lawyer', 'law firm', 'lcdo', 'lcda'], display: 'Notarios y Abogados', emoji: '⚖️', nameMatch: true },
  notarios:       { match: ['notario', 'notary', 'notaría', 'notaria', 'abogado', 'lawyer', 'law firm', 'lcdo', 'lcda'], display: 'Notarios y Abogados', emoji: '⚖️', nameMatch: true },
  abogado:        { match: ['notario', 'notary', 'notaría', 'notaria', 'abogado', 'lawyer', 'law firm', 'lcdo', 'lcda'], display: 'Notarios y Abogados', emoji: '⚖️', nameMatch: true },
  catering:       { match: ['catering', 'cátering', 'banquete', 'banquetes'], display: 'Catering y Banquetes', emoji: '🍽️', nameMatch: true },
  compras:        { match: ['compras', 'shopping', 'SHOPPING', 'COMPRAS', 'tienda'], display: 'Compras', emoji: '🛍️' },
  tienda:         { match: ['compras', 'shopping', 'SHOPPING', 'COMPRAS', 'tienda'], display: 'Compras', emoji: '🛍️' },
  entretenimiento:{ match: ['entretenimiento', 'entertainment', 'ENTERTAINMENT', 'ENTRETENIMIENTO'], display: 'Entretenimiento', emoji: '🎉' },
  turismo:        { match: ['turismo', 'tourism', 'TOURISM', 'TURISMO', 'atraccion', 'atracción'], display: 'Turismo', emoji: '🗺️' },
  deporte:        { match: ['deporte', 'sport', 'SPORT', 'DEPORTE', 'deportes'], display: 'Deportes', emoji: '⚽' },
  deportes:       { match: ['deporte', 'sport', 'SPORT', 'DEPORTE', 'deportes'], display: 'Deportes', emoji: '⚽' },
  educacion:      { match: ['educacion', 'educación', 'education', 'EDUCATION', 'escuela', 'colegio'], display: 'Educación', emoji: '📚' },
  gobierno:       { match: ['gobierno', 'government', 'GOBIERNO', 'GOVERNMENT', 'municipal'], display: 'Gobierno', emoji: '🏛️' },
  belleza:        { match: ['belleza', 'beauty', 'BEAUTY', 'BELLEZA', 'salon', 'salón', 'spa'], display: 'Belleza & Spa', emoji: '💅' },
  spa:            { match: ['belleza', 'beauty', 'BEAUTY', 'BELLEZA', 'salon', 'salón', 'spa'], display: 'Belleza & Spa', emoji: '💅' },
  automotriz:     { match: ['automotriz', 'automotive', 'AUTOMOTIVE', 'AUTOMOTRIZ', 'taller', 'auto'], display: 'Automotriz', emoji: '🚗' },
  marina:         { match: ['marina', 'MARINA', 'naútico', 'nautico', 'boat'], display: 'Marina & Náutico', emoji: '⛵' },
  ropa:           { match: ['ropa', 'clothing', 'moda', 'fashion', 'zapatos', 'thrift_shop'], display: 'Tiendas de Ropa', emoji: '👗' },
  'tiendas-de-ropa': { match: ['ropa', 'clothing', 'moda', 'fashion', 'zapatos', 'thrift_shop'], display: 'Tiendas de Ropa', emoji: '👗' },
  // ── Demanda real del bot *7711, verificada en places 2026-06-29 (helados 31 búsq, mariscos 30, lavandería 20, pizza 17, bakery 27) ──
  helados:        { match: ['helado', 'helados', 'ice cream', 'mantecado', 'heladería', 'heladeria', 'gelato'], display: 'Heladerías', emoji: '🍦', nameMatch: true },
  heladeria:      { match: ['helado', 'helados', 'ice cream', 'mantecado', 'heladería', 'heladeria', 'gelato'], display: 'Heladerías', emoji: '🍦', nameMatch: true },
  panaderia:      { match: ['panadería', 'panaderia', 'bakery', 'repostería', 'reposteria', 'bizcocho', 'pastelería', 'pasteleria'], display: 'Panaderías y Reposterías', emoji: '🥖', nameMatch: true },
  reposteria:     { match: ['panadería', 'panaderia', 'bakery', 'repostería', 'reposteria', 'bizcocho', 'pastelería', 'pasteleria'], display: 'Panaderías y Reposterías', emoji: '🥖', nameMatch: true },
  pizza:          { match: ['pizza', 'pizzería', 'pizzeria'], display: 'Pizzerías', emoji: '🍕', nameMatch: true },
  pizzeria:       { match: ['pizza', 'pizzería', 'pizzeria'], display: 'Pizzerías', emoji: '🍕', nameMatch: true },
  mariscos:       { match: ['marisco', 'mariscos', 'seafood', 'pescadería', 'pescaderia'], display: 'Restaurantes de Mariscos', emoji: '🦞', nameMatch: true },
  seafood:        { match: ['marisco', 'mariscos', 'seafood', 'pescadería', 'pescaderia'], display: 'Restaurantes de Mariscos', emoji: '🦞', nameMatch: true },
  lavanderia:     { match: ['lavandería', 'lavanderia', 'laundromat', 'laundry', 'lavamática', 'lavamatica'], display: 'Lavanderías', emoji: '🧺', nameMatch: true },
  lavanderias:    { match: ['lavandería', 'lavanderia', 'laundromat', 'laundry', 'lavamática', 'lavamatica'], display: 'Lavanderías', emoji: '🧺', nameMatch: true },
  cafe:           { match: ['café', 'cafetería', 'cafeteria', 'coffee', 'brunch', 'coffee shop'], display: 'Cafés y Brunch', emoji: '☕', nameMatch: true },
  brunch:         { match: ['café', 'cafetería', 'cafeteria', 'coffee', 'brunch', 'coffee shop'], display: 'Cafés y Brunch', emoji: '☕', nameMatch: true },
  barberia:       { match: ['barbería', 'barberia', 'barber', 'barbershop'], display: 'Barberías', emoji: '💈', nameMatch: true },
  peluqueria:     { match: ['peluquería', 'peluqueria', 'salón de belleza', 'salon de belleza', 'estilista', 'hair salon'], display: 'Peluquerías y Salones', emoji: '💇', nameMatch: true },
  imprenta:       { match: ['imprenta', 'printing', 'print shop', 'letrero', 'letreros', 'banner', 'rótulo', 'rotulo', 'serigrafía', 'serigrafia', 'flyer'], display: 'Imprentas y Rotulación', emoji: '🖨️', nameMatch: true },
  imprentas:      { match: ['imprenta', 'printing', 'print shop', 'letrero', 'letreros', 'banner', 'rótulo', 'rotulo', 'serigrafía', 'serigrafia', 'flyer'], display: 'Imprentas y Rotulación', emoji: '🖨️', nameMatch: true },
};

export default async function handler(req: any, res: any) {
  const cat = (req.query.cat as string || '').toLowerCase().trim();

  if (!cat) {
    res.status(400).send('<h1>400 – Categoría requerida</h1>');
    return;
  }

  // Una categoría, una URL. CATEGORY_MAP tiene ~40 pares alias (playa/playas,
  // dentista/dentistas, restaurante/restaurantes…) que servían la MISMA lista, cada copia
  // auto-canónica. Search Console lo reportó como "Duplicada: Google eligió una versión
  // canónica diferente" — eligió /categoria/playa cuando el sitemap anuncia /categoria/playas.
  // La canónica es la que anuncia el sitemap (CANONICAL_CATEGORY_SLUGS, espejo de
  // api/sitemap.ts § Category pages); si el grupo no está en el sitemap, gana la primera
  // clave del mapa. Los demás alias redirigen 301 en vez de competir.
  const canonicalFor = (slug: string): string | null => {
    const m = CATEGORY_MAP[slug];
    if (!m || CANONICAL_CATEGORY_SLUGS.has(slug)) return null;
    const sig = m.match.join('|');
    const twins = Object.keys(CATEGORY_MAP).filter((k) => CATEGORY_MAP[k].match.join('|') === sig);
    const winner = twins.find((k) => CANONICAL_CATEGORY_SLUGS.has(k)) || twins[0];
    return winner && winner !== slug ? winner : null;
  };
  const canonicalSlug = canonicalFor(cat);
  if (canonicalSlug) {
    res.writeHead(301, { Location: `https://www.mapadecaborojo.com/categoria/${canonicalSlug}` });
    return res.end();
  }

  const mapping = CATEGORY_MAP[cat];
  const displayName = mapping ? mapping.display : cat.charAt(0).toUpperCase() + cat.slice(1);
  const emoji = mapping ? mapping.emoji : '📍';
  const matchTerms = mapping ? mapping.match : [cat];

  // Build an OR filter to push filtering to Postgres instead of fetching all 3900+ rows
  // Uses ilike for category (enum-like, e.g. SHOPPING), exact match via cs for tags array
  const useNameMatch = mapping?.nameMatch === true;
  const orParts = matchTerms.flatMap(term => [
    `category.ilike.%${term}%`,
    `subcategory.ilike.%${term}%`,
    `tags.cs.{${term}}`,
  ]);
  // For health subcategories, also match by business name (catches HEALTH/null businesses)
  if (useNameMatch) {
    matchTerms.forEach(term => {
      orParts.push(`name.ilike.%${term}%`);
    });
  }
  const orClauses = orParts.join(',');

  // High-LTV service categories serve a region, not just one town — include businesses
  // tagged 'sirve-cabo-rojo' even when their HQ/address is elsewhere (e.g. a solar installer
  // in Manatí that serves the suroeste). All other categories stay strictly local-by-address.
  const CAPTURE_CATS = new Set(['electrico', 'electricista', 'electricistas', 'plomero', 'plomeros', 'ac', 'aire-acondicionado', 'solar', 'solares', 'placas']);
  const isCaptureCat = CAPTURE_CATS.has(cat);

  // Scarce specialties (e.g. cardiología) barely exist in Cabo Rojo — the vecino HAS to travel.
  // For these we serve the whole oeste by municipality instead of restricting to a Cabo Rojo
  // address (which would surface only the lone CR cardiologist). The full island-wide directory
  // lives on the standalone health property; the bot serves all of PR via *7711.
  const REGION_HEALTH_CATS = new Set(['cardiologo', 'cardiologos', 'cardiologia', 'cardiología', 'fisiatra', 'fisiatras', 'nefrologo', 'nefrologos', 'endocrinologo', 'endocrinologos', 'neurologo', 'neurologos', 'ortopeda', 'ortopedas']);
  const isRegionHealth = REGION_HEALTH_CATS.has(cat);
  const OESTE_MUNIS = ['Cabo Rojo', 'Mayagüez', 'San Germán', 'Sabana Grande', 'Añasco', 'Aguada', 'Aguadilla', 'Moca', 'San Sebastián', 'Lajas', 'Hormigueros', 'Las Marías', 'Maricao', 'Rincón', 'Isabela', 'Camuy', 'Quebradillas', 'Guánica', 'Yauco'];

  let placesQuery = supabase
    .from('places')
    .select('id,name,slug,category,subcategory,image_url,phone,address,municipality,google_rating,google_review_count,status,plan,sponsor_weight,tags,services,opening_hours,lat,lon,npi,one_liner,is_emergency_resource,last_verified_at,verified_at,verification_source')
    .eq('status', 'open')
    // Lista negra: quien busca POR NOMBRE los encuentra (ficha propia y pin en el mapa
    // siguen vivos), pero quien busca una CATEGORÍA no los recibe como recomendación.
    // Mismo criterio que ya aplican los RPCs de búsqueda del bot.
    .neq('quality_tier', 'hidden');
  if (isRegionHealth) {
    placesQuery = placesQuery.in('municipality', OESTE_MUNIS);
  } else if (isCaptureCat) {
    placesQuery = placesQuery.or('address.ilike.%Cabo Rojo%,tags.cs.{sirve-cabo-rojo}');
  } else {
    placesQuery = placesQuery.ilike('address', '%Cabo Rojo%');
  }
  const { data: places, error } = await placesQuery
    .or(orClauses)
    .order('sponsor_weight', { ascending: false })
    .order('google_rating', { ascending: false, nullsFirst: false })
    .order('google_review_count', { ascending: false, nullsFirst: false })
    .limit(500);

  if (error) {
    res.status(500).send('<h1>Error cargando negocios</h1>');
    return;
  }

  // Demand signals — what vecinos searched for in this category (last 90 days, test phones excluded)
  // RPC: get_demand_for_keywords (Vecinoai migration 20260430000000_get_demand_for_keywords)
  // Fail-open: never block render if demand fetch errors
  type DemandRow = { query_normalized: string; users: number; queries: number; failed: number };
  let demandRows: DemandRow[] = [];
  try {
    const demandKeywords = matchTerms.map(t => `%${t.toLowerCase()}%`);
    const { data: demandData } = await supabase
      .rpc('get_demand_for_keywords', { p_keywords: demandKeywords, p_days: 90 });
    if (Array.isArray(demandData)) demandRows = demandData as DemandRow[];
  } catch { /* fail open */ }

  // Secondary JS filter to remove false positives from the broad Postgres query
  const filtered = (places || []).filter((p: any) => {
    const pCat = (p.category || '').toLowerCase();
    const pSub = (p.subcategory || '').toLowerCase();
    const pName = (p.name || '').toLowerCase();
    const pTags = Array.isArray(p.tags) ? p.tags.map((t: string) => t.toLowerCase()) : [];
    // Service capture pages (plomero/electricista/ac/solar) list service PROVIDERS, not
    // product sellers. A ferretería/lumber yard sells plomería + electrical supplies (and
    // is tagged as such) but isn't a plumber/electrician — exclude it here. It still appears
    // under Compras/Ferretería. Catches Comercial Toro, National Lumber, etc.
    if (isCaptureCat && (pSub.includes('ferret') || pSub === 'hardware' || /ferreter|lumber/.test(pName))) {
      return false;
    }
    return matchTerms.some(term => {
      const t = term.toLowerCase();
      // Exact match on subcategory (e.g. "Ropa" = "ropa", not "Naturopatía" containing "ropa")
      if (pSub === t) return true;
      // Exact word match on category
      if (pCat.split(/[\s\/,]+/).includes(t)) return true;
      // Exact match on tags (tag must equal the term, not just contain it as substring)
      if (pTags.includes(t)) return true;
      // For health subcategories, also match by business name
      if (useNameMatch && pName.includes(t)) return true;
      return false;
    });
  });

  // Sin resultados = 404, no una página vacía con 200. /categoria/[loquesea] respondía 200
  // con título generado ("Xyzabc-no-existe en Cabo Rojo") y cero negocios: una fábrica de
  // soft-404 que Google rastrea e indexa. Las 34 canónicas tienen resultados (verificado
  // 30 jul 2026, de 2 a 239 cada una), así que esto no toca ninguna página viva.
  if (filtered.length === 0) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>Categoría no encontrada | MapaDeCaboRojo.com</title></head>
<body><h1>404 — No tenemos esa categoría</h1><p>Puede que la escribiéramos distinto. <a href="https://www.mapadecaborojo.com">Ver el directorio completo</a>.</p></body></html>`);
  }

  // Map pins: physically-in-CR businesses only. Service-area businesses (tagged
  // sirve-cabo-rojo but located elsewhere, e.g. Manatí) are listed but NOT pinned,
  // so the map doesn't zoom out across the island to show a far-away HQ.
  const mapPlaces = filtered.filter((p: any) => p.lat && p.lon && (p.address || '').toLowerCase().includes('cabo rojo'));

  // Category-specific SEO content
  const CATEGORY_SEO: Record<string, { title?: string; description: string; intro: string }> = {
    farmacia: {
      title: 'Farmacias en Cabo Rojo, horario, domingos y delivery',
      description: `${filtered.length} farmacias en Cabo Rojo, PR con teléfono, horario y quién abre domingo. Mira cuál está abierta antes de salir con la receta.`,
      intro: `La receta no espera al lunes. Aquí tienes ${filtered.length} farmacias de Cabo Rojo con teléfono y horario, y arriba te decimos cuáles abren domingo y cuál cierra más tarde. ¿No sabes cuál te queda cerca? Escríbele FARMACIA a El Veci al 787-417-7711. ¿Quieres saber si un medicamento tiene recall de la FDA? Escríbele RECALL y el nombre del medicamento.`,
    },
    salud: {
      title: 'Salud en Cabo Rojo — Médicos, Farmacias, Dentistas y más',
      description: `Directorio de salud en Cabo Rojo, PR: ${filtered.length} médicos, farmacias, dentistas, laboratorios y especialistas — con teléfono, horario y verificación en el registro federal de salud (NPPES).`,
      intro: `Todo lo de salud en Cabo Rojo en un solo sitio: médicos, farmacias, dentistas, laboratorios, ópticas, salud mental y especialistas. Filtra por lo que necesitas, mira quién está abierto, y si no sabes a quién ir, dile tu síntoma a El Veci.`,
    },
    cardiologo: {
      title: 'Cardiólogos en Cabo Rojo y el Oeste de PR — Verificados, con teléfono',
      description: `Cardiólogos en Cabo Rojo, Mayagüez, San Germán, Aguadilla y todo el oeste de Puerto Rico — ${filtered.length} del registro federal NPPES, con nombre, pueblo y teléfono. PR tiene 339 cardiólogos y más de la mitad están en San Juan; aquí están los del oeste.`,
      intro: `El corazón no espera, y en el oeste hay pocos cardiólogos — por eso casi todos hay que buscarlos por teléfono. Aquí tienes ${filtered.length} cardiólogos del oeste (Cabo Rojo, Mayagüez, San Germán, Aguadilla, Añasco y más), del registro federal NPPES, con su teléfono. Llama antes de ir para confirmar tu plan médico. ¿Buscas en otro pueblo? Escríbele CARDIOLOGO a El Veci al 787-417-7711.`,
    },
    cardiologos: {
      title: 'Cardiólogos en Cabo Rojo y el Oeste de PR — Verificados, con teléfono',
      description: `Cardiólogos en Cabo Rojo, Mayagüez, San Germán, Aguadilla y todo el oeste de Puerto Rico — ${filtered.length} del registro federal NPPES, con nombre, pueblo y teléfono. PR tiene 339 cardiólogos y más de la mitad están en San Juan; aquí están los del oeste.`,
      intro: `El corazón no espera, y en el oeste hay pocos cardiólogos — por eso casi todos hay que buscarlos por teléfono. Aquí tienes ${filtered.length} cardiólogos del oeste (Cabo Rojo, Mayagüez, San Germán, Aguadilla, Añasco y más), del registro federal NPPES, con su teléfono. Llama antes de ir para confirmar tu plan médico. ¿Buscas en otro pueblo? Escríbele CARDIOLOGO a El Veci al 787-417-7711.`,
    },
    cardiologia: {
      title: 'Cardiólogos en Cabo Rojo y el Oeste de PR — Verificados, con teléfono',
      description: `Cardiólogos en Cabo Rojo, Mayagüez, San Germán, Aguadilla y todo el oeste de Puerto Rico — ${filtered.length} del registro federal NPPES, con nombre, pueblo y teléfono. PR tiene 339 cardiólogos y más de la mitad están en San Juan; aquí están los del oeste.`,
      intro: `El corazón no espera, y en el oeste hay pocos cardiólogos — por eso casi todos hay que buscarlos por teléfono. Aquí tienes ${filtered.length} cardiólogos del oeste (Cabo Rojo, Mayagüez, San Germán, Aguadilla, Añasco y más), del registro federal NPPES, con su teléfono. Llama antes de ir para confirmar tu plan médico. ¿Buscas en otro pueblo? Escríbele CARDIOLOGO a El Veci al 787-417-7711.`,
    },
    'cardiología': {
      title: 'Cardiólogos en Cabo Rojo y el Oeste de PR — Verificados, con teléfono',
      description: `Cardiólogos en Cabo Rojo, Mayagüez, San Germán, Aguadilla y todo el oeste de Puerto Rico — ${filtered.length} del registro federal NPPES, con nombre, pueblo y teléfono. PR tiene 339 cardiólogos y más de la mitad están en San Juan; aquí están los del oeste.`,
      intro: `El corazón no espera, y en el oeste hay pocos cardiólogos — por eso casi todos hay que buscarlos por teléfono. Aquí tienes ${filtered.length} cardiólogos del oeste (Cabo Rojo, Mayagüez, San Germán, Aguadilla, Añasco y más), del registro federal NPPES, con su teléfono. Llama antes de ir para confirmar tu plan médico. ¿Buscas en otro pueblo? Escríbele CARDIOLOGO a El Veci al 787-417-7711.`,
    },
    gimnasio: {
      title: 'Gimnasios y Fitness en Cabo Rojo',
      description: `${filtered.length} gimnasios y centros fitness en Cabo Rojo, PR — boxing, CrossFit, yoga, pesas, running y más. Horarios, direcciones y contacto.`,
      intro: `Cabo Rojo tiene ${filtered.length} opciones para ponerte en forma — desde gimnasios tradicionales hasta estudios de boxeo, fitness por cita y clubes de running. Encuentra el que mejor te quede.`,
    },
    gimnasios: {
      title: 'Gimnasios y Fitness en Cabo Rojo',
      description: `${filtered.length} gimnasios y centros fitness en Cabo Rojo, PR — boxing, CrossFit, yoga, pesas, running y más. Horarios, direcciones y contacto.`,
      intro: `Cabo Rojo tiene ${filtered.length} opciones para ponerte en forma — desde gimnasios tradicionales hasta estudios de boxeo, fitness por cita y clubes de running. Encuentra el que mejor te quede.`,
    },
    // High-LTV service categories — capture-optimized SEO (demand-driven, 2026-06)
    electrico: {
      title: 'Electricistas en Cabo Rojo',
      description: `Electricistas en Cabo Rojo, PR — instalación, breakers, emergencias eléctricas post-apagón. ${filtered.length} opciones locales con teléfono, rating y WhatsApp.`,
      intro: `Cuando se va la luz o un breaker no para de saltar, necesitas un electricista de confianza en Cabo Rojo — no el primer resultado de Google que queda en San Juan. Aquí tienes ${filtered.length} opciones locales con teléfono y rating real. Si no sabes a quién llamar, El Veci te lo dice al momento.`,
    },
    electricista: {
      title: 'Electricistas en Cabo Rojo',
      description: `Electricistas en Cabo Rojo, PR — instalación, breakers, emergencias eléctricas post-apagón. ${filtered.length} opciones locales con teléfono, rating y WhatsApp.`,
      intro: `Cuando se va la luz o un breaker no para de saltar, necesitas un electricista de confianza en Cabo Rojo — no el primer resultado de Google que queda en San Juan. Aquí tienes ${filtered.length} opciones locales con teléfono y rating real. Si no sabes a quién llamar, El Veci te lo dice al momento.`,
    },
    electricistas: {
      title: 'Electricistas en Cabo Rojo',
      description: `Electricistas en Cabo Rojo, PR — instalación, breakers, emergencias eléctricas post-apagón. ${filtered.length} opciones locales con teléfono, rating y WhatsApp.`,
      intro: `Cuando se va la luz o un breaker no para de saltar, necesitas un electricista de confianza en Cabo Rojo — no el primer resultado de Google que queda en San Juan. Aquí tienes ${filtered.length} opciones locales con teléfono y rating real. Si no sabes a quién llamar, El Veci te lo dice al momento.`,
    },
    plomero: {
      title: 'Plomeros en Cabo Rojo',
      description: `Plomeros en Cabo Rojo, PR — emergencias, salideros, calentadores, sistemas sépticos. ${filtered.length} plomeros locales con teléfono y rating real.`,
      intro: `Un salidero a las 11pm no espera. Aquí tienes ${filtered.length} opciones de plomeros de Cabo Rojo con su teléfono directo y rating real — pa' que llames al que resuelve, no al que te roba. Si no sabes por dónde empezar, pregúntale a El Veci.`,
    },
    plomeros: {
      title: 'Plomeros en Cabo Rojo',
      description: `Plomeros en Cabo Rojo, PR — emergencias, salideros, calentadores, sistemas sépticos. ${filtered.length} plomeros locales con teléfono y rating real.`,
      intro: `Un salidero a las 11pm no espera. Aquí tienes ${filtered.length} opciones de plomeros de Cabo Rojo con su teléfono directo y rating real — pa' que llames al que resuelve, no al que te roba. Si no sabes por dónde empezar, pregúntale a El Veci.`,
    },
    ac: {
      title: 'AC y Refrigeración en Cabo Rojo',
      description: `Técnicos de aire acondicionado y refrigeración en Cabo Rojo, PR — instalación, mantenimiento y reparación. ${filtered.length} opciones con teléfono y rating.`,
      intro: `En el calor de Cabo Rojo, un AC dañado es emergencia. Aquí tienes ${filtered.length} opciones de técnicos de aire acondicionado y refrigeración locales, con teléfono y rating real. El Veci te ayuda a escoger si no sabes a quién llamar.`,
    },
    'aire-acondicionado': {
      title: 'AC y Refrigeración en Cabo Rojo',
      description: `Técnicos de aire acondicionado y refrigeración en Cabo Rojo, PR — instalación, mantenimiento y reparación. ${filtered.length} opciones con teléfono y rating.`,
      intro: `En el calor de Cabo Rojo, un AC dañado es emergencia. Aquí tienes ${filtered.length} opciones de técnicos de aire acondicionado y refrigeración locales, con teléfono y rating real. El Veci te ayuda a escoger si no sabes a quién llamar.`,
    },
    solar: {
      title: 'Instaladores de Placas Solares en Cabo Rojo',
      description: `Instaladores de placas solares en Cabo Rojo, PR — baja tu factura de LUMA, baterías, financiamiento. ${filtered.length} instaladores que sirven Cabo Rojo, con teléfono y rating.`,
      intro: `Con la luz subiendo cada año, las placas solares dejaron de ser lujo. Aquí tienes ${filtered.length} opciones de instaladores de placas solares que sirven Cabo Rojo, con teléfono y rating real — pa' que compares antes de firmar nada. Si quieres orientación primero, pregúntale a El Veci.`,
    },
    solares: {
      title: 'Instaladores de Placas Solares en Cabo Rojo',
      description: `Instaladores de placas solares en Cabo Rojo, PR — baja tu factura de LUMA, baterías, financiamiento. ${filtered.length} instaladores que sirven Cabo Rojo, con teléfono y rating.`,
      intro: `Con la luz subiendo cada año, las placas solares dejaron de ser lujo. Aquí tienes ${filtered.length} opciones de instaladores de placas solares que sirven Cabo Rojo, con teléfono y rating real — pa' que compares antes de firmar nada. Si quieres orientación primero, pregúntale a El Veci.`,
    },
    placas: {
      title: 'Instaladores de Placas Solares en Cabo Rojo',
      description: `Instaladores de placas solares en Cabo Rojo, PR — baja tu factura de LUMA, baterías, financiamiento. ${filtered.length} instaladores que sirven Cabo Rojo, con teléfono y rating.`,
      intro: `Con la luz subiendo cada año, las placas solares dejaron de ser lujo. Aquí tienes ${filtered.length} opciones de instaladores de placas solares que sirven Cabo Rojo, con teléfono y rating real — pa' que compares antes de firmar nada. Si quieres orientación primero, pregúntale a El Veci.`,
    },
    // ── Demanda real del bot *7711 (2026-06) — comida + utilidad ──
    helados: {
      title: 'Heladerías en Cabo Rojo, dónde comer helados y mantecado',
      description: `${filtered.length} heladerías y sitios de mantecado en Cabo Rojo, PR, con dirección, horario y rating real. Mira cuál está abierto antes de salir con el calor.`,
      intro: `Con el calor de Cabo Rojo, un helado no se discute. Aquí tienes ${filtered.length} heladerías y sitios de mantecado con su pueblo, horario y rating real, pa' que no llegues y esté cerrado. ¿Buscas algo cerca ahora mismo? Escríbele HELADOS a El Veci al 787-417-7711.`,
    },
    panaderia: {
      title: 'Panaderías y Reposterías en Cabo Rojo',
      description: `${filtered.length} panaderías y reposterías en Cabo Rojo, PR. Pan caliente, bizcochos y repostería por encargo, con teléfono y horario.`,
      intro: `El pan de la mañana y el bizcocho del cumpleaños salen de aquí. ${filtered.length} panaderías y reposterías de Cabo Rojo, con teléfono pa' encargar y horario pa' que no llegues tarde. ¿Necesitas un bizcocho pa' este finde? Escríbele PANADERIA a El Veci al 787-417-7711.`,
    },
    pizza: {
      title: 'Pizzerías en Cabo Rojo, dónde comer pizza',
      description: `${filtered.length} pizzerías en Cabo Rojo, PR, con teléfono, horario y rating real. Mira cuál entrega y cuál está abierta esta noche.`,
      intro: `Pizza un viernes en la noche es plan seguro. Aquí tienes ${filtered.length} pizzerías de Cabo Rojo con su teléfono, horario y rating real, pa' que llames antes y no des la vuelta en balde. ¿Cuál entrega cerca de ti? Escríbele PIZZA a El Veci al 787-417-7711.`,
    },
    mariscos: {
      title: 'Restaurantes de Mariscos en Cabo Rojo, de Joyuda a Boquerón',
      description: `${filtered.length} restaurantes de mariscos y pescado fresco en Cabo Rojo, PR, con dirección, horario y rating. Joyuda, Boquerón y El Combate.`,
      intro: `Cabo Rojo es mariscos: Joyuda, Boquerón, El Combate. Aquí tienes ${filtered.length} restaurantes de mariscos con su zona, horario y rating real, pa' que escojas con calma y no por el primer letrero. ¿Cuál tiene vista al mar y está abierto? Escríbele MARISCOS a El Veci al 787-417-7711.`,
    },
    lavanderia: {
      title: 'Lavanderías en Cabo Rojo, laundromats abiertos',
      description: `${filtered.length} lavanderías y laundromats en Cabo Rojo, PR, con dirección y horario. La utilidad que nadie te dice dónde queda, aquí sí.`,
      intro: `Buscar una lavandería en un pueblo nuevo es un dolor de cabeza, y Google casi nunca lo resuelve. Aquí tienes ${filtered.length} lavanderías y laundromats de Cabo Rojo con su dirección y horario. ¿La más cerca de ti? Escríbele LAVANDERIA a El Veci al 787-417-7711.`,
    },
    cafe: {
      title: 'Cafés y Brunch en Cabo Rojo',
      description: `${filtered.length} cafés y sitios de brunch en Cabo Rojo, PR, con horario y rating real. Café de la mañana, desayuno tarde y buen ambiente.`,
      intro: `Un buen café o un brunch sin prisa cambian el día. Aquí tienes ${filtered.length} cafés y sitios de brunch de Cabo Rojo, con horario y rating real. ¿Cuál abre temprano cerca de ti? Escríbele CAFE a El Veci al 787-417-7711.`,
    },
    barberia: {
      title: 'Barberías en Cabo Rojo',
      description: `${filtered.length} barberías en Cabo Rojo, PR, con teléfono, horario y rating real. Mira cuál coge walk-in y cuál es por cita.`,
      intro: `Un buen corte no se improvisa. Aquí tienes ${filtered.length} barberías de Cabo Rojo con su teléfono, horario y rating real, pa' que sepas cuál coge walk-in y cuál es por cita. ¿La más cerca? Escríbele BARBERIA a El Veci al 787-417-7711.`,
    },
    peluqueria: {
      title: 'Peluquerías y Salones de Belleza en Cabo Rojo',
      description: `${filtered.length} peluquerías y salones en Cabo Rojo, PR, con teléfono y horario. Corte, color, uñas y más, con rating real.`,
      intro: `Aquí tienes ${filtered.length} peluquerías y salones de Cabo Rojo, con teléfono pa' coger cita y rating real. ¿Cuál te queda cerca y tiene buena reseña? Escríbele PELUQUERIA a El Veci al 787-417-7711.`,
    },
    imprenta: {
      title: 'Imprentas y Rotulación en Cabo Rojo, flyers, banners y letreros',
      description: `${filtered.length} imprentas y servicios de rotulación que sirven Cabo Rojo: flyers, banners, stickers, tazas, camisas y letreros, con teléfono.`,
      intro: `Cuando necesitas flyers pa'l negocio, un banner pa'l evento o stickers, esto es lo que hay. ${filtered.length} imprentas y servicios de rotulación que sirven Cabo Rojo, con su teléfono. ¿Cuál te hace el trabajo rápido? Escríbele IMPRENTA a El Veci al 787-417-7711.`,
    },
  };
  // ── Restaurantes tier-up (2026-07-24): zona + abierto-ahora + sub-páginas + FAQ ──
  const isRestaurant = cat === 'restaurante' || cat === 'restaurantes';
  type Zone = { key: string; label: string; emoji: string };
  function zoneOf(p: any): Zone {
    const hay = `${(p.address || '').toLowerCase()} ${(p.name || '').toLowerCase()}`;
    if (hay.includes('joyuda') || hay.includes('carr 102') || hay.includes('carr. 102') || hay.includes('pr-102')) return { key: 'joyuda', label: 'Joyuda', emoji: '🦞' };
    if (hay.includes('boquer')) return { key: 'boqueron', label: 'Boquerón', emoji: '🌅' };
    if (hay.includes('combate')) return { key: 'combate', label: 'El Combate', emoji: '🏖️' };
    if (hay.includes('puerto real')) return { key: 'puerto-real', label: 'Puerto Real', emoji: '⚓' };
    return { key: 'pueblo', label: 'Pueblo y alrededores', emoji: '🏘️' };
  }
  const zoneMap = new Map<string, Zone>();
  if (isRestaurant) for (const p of filtered) zoneMap.set(p.id, zoneOf(p));

  // Tipo de negocio (producto) + bandera food truck — "foodtruck es foodtruck, helado es helado" (Angel 2026-07-24)
  type FoodType = { key: string; label: string; emoji: string };
  function typeOf(p: any): FoodType {
    const hay = `${(p.subcategory || '').toLowerCase()} ${(p.name || '').toLowerCase()} ${(Array.isArray(p.tags) ? p.tags.join(' ') : '').toLowerCase()}`;
    const has = (...xs: string[]) => xs.some(x => hay.includes(x));
    if (has('helado', 'ice cream', 'mantecado', 'creamery', 'gelato', 'frozen', 'açaí', 'acai', 'frappe')) return { key: 'heladeria', label: 'Heladerías y postres', emoji: '🍦' };
    if (has('panad', 'bakery', 'reposter', 'pastry', 'bizcocho', 'cake', 'pastel', 'dulce')) return { key: 'panaderia', label: 'Panaderías y repostería', emoji: '🥖' };
    if (has('café', 'cafe', 'coffee', 'brunch', 'cafeter')) return { key: 'cafe', label: 'Cafés y brunch', emoji: '☕' };
    if (has('pizza', 'pizzer')) return { key: 'pizza', label: 'Pizzerías', emoji: '🍕' };
    if (has('marisco', 'seafood', 'pescad', 'ostion', 'ostión')) return { key: 'mariscos', label: 'Mariscos', emoji: '🦞' };
    if (has('gastrobar', 'bar &', '& bar', 'cervec', 'tapas', 'pub', 'grill house', 'rooftop')) return { key: 'bar', label: 'Bares y grills', emoji: '🍻' };
    if (has('pincho', 'burger', 'hamburgues', 'hot dog', 'hot_dog', 'sandwich', 'sándwich', 'empanadilla', 'taco', 'cuchifrito', 'lechonera', 'fritura', 'comida rápida', 'comida rapida', 'fast')) return { key: 'rapida', label: 'Comida rápida y chinchorro', emoji: '🍢' };
    return { key: 'mesa', label: 'Restaurantes de mesa', emoji: '🍽️' };
  }
  const typeMap = new Map<string, FoodType>();
  const ftSet = new Set<string>();
  if (isRestaurant) {
    for (const p of filtered) {
      typeMap.set(p.id, typeOf(p));
      const sub = (p.subcategory || '').toLowerCase();
      const tgs = Array.isArray(p.tags) ? p.tags.join(' ').toLowerCase() : '';
      if (sub.includes('food truck') || sub.includes('foodtruck') || tgs.includes('food truck') || tgs.includes('foodtruck')) ftSet.add(p.id);
    }
  }
  const TYPE_ORDER = ['mesa', 'mariscos', 'pizza', 'cafe', 'panaderia', 'heladeria', 'bar', 'rapida'];
  const typeCounts = new Map<string, { label: string; emoji: string; n: number }>();
  if (isRestaurant) {
    for (const p of filtered) {
      const t = typeMap.get(p.id)!;
      const cur = typeCounts.get(t.key);
      if (cur) cur.n++; else typeCounts.set(t.key, { label: t.label, emoji: t.emoji, n: 1 });
    }
  }
  const typeGroups = TYPE_ORDER.filter(k => typeCounts.has(k)).map(k => ({ key: k, ...typeCounts.get(k)! }));
  const ftCount = ftSet.size;
  const ZONE_ORDER = ['joyuda', 'boqueron', 'combate', 'puerto-real', 'pueblo'];
  const zoneCounts = new Map<string, { label: string; emoji: string; n: number }>();
  if (isRestaurant) {
    for (const p of filtered) {
      const z = zoneMap.get(p.id)!;
      const cur = zoneCounts.get(z.key);
      if (cur) cur.n++; else zoneCounts.set(z.key, { label: z.label, emoji: z.emoji, n: 1 });
    }
  }
  const zoneGroups = ZONE_ORDER.filter(k => zoneCounts.has(k)).map(k => ({ key: k, ...zoneCounts.get(k)! }));

  if (isRestaurant) {
    CATEGORY_SEO.restaurante = CATEGORY_SEO.restaurantes = {
      title: 'Restaurantes en Cabo Rojo — Joyuda, Boquerón, El Combate y el pueblo',
      description: `${filtered.length} restaurantes en Cabo Rojo, PR con teléfono, horario y rating real. Mariscos en Joyuda, ambiente en Boquerón, atardecer en El Combate y la comida criolla del pueblo — mira cuál está abierto antes de salir.`,
      intro: `En Cabo Rojo se come por zona: mariscos frente al mar en Joyuda, el ambiente del poblado de Boquerón, el atardecer de El Combate y la comida criolla del pueblo. Aquí tienes ${filtered.length} lugares para comer con teléfono, horario y rating real — filtra por zona, mira cuál está abierto ahora, y llama antes de dar la vuelta en balde. ¿No sabes cuál escoger? Escríbele COMIDA a El Veci al 787-417-7711.`,
    };
  }
  if (cat === 'farmacias' && CATEGORY_SEO.farmacia) CATEGORY_SEO.farmacias = CATEGORY_SEO.farmacia;
  const catSeo = CATEGORY_SEO[cat];

  const baseUrl = 'https://www.mapadecaborojo.com';
  const pageUrl = `${baseUrl}/categoria/${esc(cat)}`;
  const alreadyHasCaboRojo = displayName.toLowerCase().includes('cabo rojo');
  const title = catSeo?.title ? `${catSeo.title} | MapaDeCaboRojo.com` : (alreadyHasCaboRojo ? `${displayName} | MapaDeCaboRojo.com` : `${displayName} en Cabo Rojo | MapaDeCaboRojo.com`);
  const description = catSeo?.description || `Descubre los mejores ${displayName.toLowerCase()} en Cabo Rojo, Puerto Rico. ${filtered.length} negocios listados con dirección, teléfono y horarios.`;

  // Per-category social share image (1200×630). Falls back to no og:image.
  const CATEGORY_OG: Record<string, string> = {
    cardiologo: 'cardiologos', cardiologos: 'cardiologos', cardiologia: 'cardiologos', 'cardiología': 'cardiologos',
    fisiatra: 'fisiatras', fisiatras: 'fisiatras',
    nefrologo: 'nefrologos', nefrologos: 'nefrologos',
    endocrinologo: 'endocrinologos', endocrinologos: 'endocrinologos',
    neurologo: 'neurologos', neurologos: 'neurologos',
    ortopeda: 'ortopedas', ortopedas: 'ortopedas',
    restaurante: 'restaurantes', restaurantes: 'restaurantes',
  };
  const ogImage = CATEGORY_OG[cat] ? `${baseUrl}/og/${CATEGORY_OG[cat]}.png` : '';

  // Route health categories to their dedicated detail pages
  const HEALTH_DETAIL_ROUTES: Record<string, string> = {
    farmacia: 'farmacia', farmacias: 'farmacia',
    dentista: 'dentista', dentistas: 'dentista',
    veterinario: 'veterinario', veterinarios: 'veterinario',
    medico: 'medico', medicos: 'medico',
    cardiologo: 'medico', cardiologos: 'medico', cardiologia: 'medico', 'cardiología': 'medico',
    hospital: 'hospital', hospitales: 'hospital',
    laboratorio: 'laboratorio', laboratorios: 'laboratorio',
    optica: 'optica', opticas: 'optica',
    'salud-mental': 'salud-mental',
    quiropractico: 'quiropractico',
    gimnasio: 'gimnasio', gimnasios: 'gimnasio',
    fisiatra: 'fisiatra', fisiatras: 'fisiatra',
  };
  const detailRoute = HEALTH_DETAIL_ROUTES[cat] || null;

  // ── Salud umbrella (Tier 3): normalize messy subcategories into clean specialty groups ──
  // The DB has dozens of duplicate/case/language variants (pharmacy/farmacia/Farmacia,
  // dentist/Dentista, salud mental/Salud Mental/salud-mental). Collapse them so the flat
  // 137-card list becomes a triage page filterable by what a sick vecino actually needs.
  const isSaludUmbrella = cat === 'salud';
  const isHealth = isSaludUmbrella || !!detailRoute;
  type Spec = { key: string; label: string; emoji: string };
  function specialtyOf(p: any): Spec {
    const hay = `${(p.subcategory || '').toLowerCase()} ${(p.name || '').toLowerCase()}`;
    const has = (...xs: string[]) => xs.some(x => hay.includes(x));
    // NOTE: do NOT use is_emergency_resource here — it's a near-universal flag on health
    // rows (124/134), not "this is an ambulance". Classify by actual name/subcategory only.
    if (has('ambulanc', 'paramedic', '911', 'emergencias medicas', 'emergencias médicas')) return { key: 'emergencia', label: 'Emergencia / Ambulancia', emoji: '🚑' };
    if (has('farmac', 'pharmac', 'botica')) return { key: 'farmacia', label: 'Farmacias', emoji: '💊' };
    if (has('pediatr')) return { key: 'pediatria', label: 'Pediatría', emoji: '🧒' };
    if (has('dentist', 'dental', 'odontolog', 'ortodonc')) return { key: 'dentista', label: 'Dentistas', emoji: '🦷' };
    if (has('laboratorio', 'clinical lab', 'radiolog', 'diagnostic', 'imagen')) return { key: 'laboratorio', label: 'Laboratorios y Diagnóstico', emoji: '🔬' };
    if (has('óptica', 'optica', 'oftalmolog', 'optometr', 'audiolog')) return { key: 'optica', label: 'Ópticas y Audición', emoji: '👓' };
    if (has('psicolog', 'psicólog', 'psiquiatr', 'psycholog', 'psychiatr', 'salud mental', 'salud-mental', 'social_worker', 'terapeuta', 'mental')) return { key: 'salud-mental', label: 'Salud Mental', emoji: '🧠' };
    if (has('veterinari')) return { key: 'veterinario', label: 'Veterinarios', emoji: '🐾' };
    if (has('quiropr', 'chiropract')) return { key: 'quiropractico', label: 'Quiroprácticos', emoji: '🦴' };
    if (has('nutricion', 'nutrición', 'nutrition', 'dietist')) return { key: 'nutricion', label: 'Nutrición', emoji: '🥗' };
    if (has('fisiatr', 'physical_therapy', 'fisioterap', 'terapia fisica', 'terapia física', 'rehabilit')) return { key: 'fisiatra', label: 'Fisiatría y Terapia', emoji: '🩺' };
    if (has('cardiolog', 'cardiólog', 'dermatolog', 'dermatólog', 'ginecolog', 'ginecólog', 'neurolog', 'neurólog', 'nefrolog', 'nefrólog', 'gastroenter', 'oncolog', 'oncólog', 'infectolog', 'urolog', 'urólog', 'endocrin', 'reumatolog', 'neumolog', 'cirug', 'cirujano', 'plástic', 'plastic', 'otorrino', 'internista', 'medicina interna', 'especialista')) return { key: 'especialista', label: 'Especialistas', emoji: '🩺' };
    if (has('doctor', 'medico', 'médico', 'physician', 'medicina general', 'clinica', 'clínica', 'cdt', 'centro de salud')) return { key: 'medico', label: 'Médicos generales', emoji: '👨‍⚕️' };
    return { key: 'otros', label: 'Otros servicios de salud', emoji: '🏥' };
  }
  const specMap = new Map<string, Spec>();
  if (isHealth) for (const p of filtered) specMap.set(p.id, specialtyOf(p));
  // Order groups by triage priority, drop empties; build pill metadata with counts.
  const SPEC_ORDER = ['emergencia', 'farmacia', 'medico', 'especialista', 'pediatria', 'dentista', 'laboratorio', 'optica', 'salud-mental', 'fisiatra', 'quiropractico', 'nutricion', 'veterinario', 'otros'];
  const specCounts = new Map<string, { label: string; emoji: string; n: number }>();
  if (isSaludUmbrella) {
    for (const p of filtered) {
      const s = specMap.get(p.id)!;
      const cur = specCounts.get(s.key);
      if (cur) cur.n++; else specCounts.set(s.key, { label: s.label, emoji: s.emoji, n: 1 });
    }
  }
  const specGroups = SPEC_ORDER.filter(k => specCounts.has(k)).map(k => ({ key: k, ...specCounts.get(k)! }));

  // Trust-first ordering for the salud umbrella: NPI-verified + well-reviewed surface first.
  // Other categories keep the DB ordering (sponsor_weight → rating → reviews).
  if (isSaludUmbrella) {
    filtered.sort((a: any, b: any) => {
      const sw = (Number(b.sponsor_weight) || 0) - (Number(a.sponsor_weight) || 0);
      if (sw) return sw;
      const npi = (b.npi ? 1 : 0) - (a.npi ? 1 : 0);
      if (npi) return npi;
      const rc = (Number(b.google_review_count) || 0) - (Number(a.google_review_count) || 0);
      if (rc) return rc;
      return (Number(b.google_rating) || 0) - (Number(a.google_rating) || 0);
    });
  }

  // Singular noun + article for the Vitrina CTA ("¿Tienes <article> <noun> en Cabo Rojo?").
  // Replaces the old `'una ' + displayName.toLowerCase().replace(/s$/,'')` which broke for
  // masculine nouns (un veterinario) and compound display names (Hospitales y Clínicas).
  const HEALTH_CTA_NOUN: Record<string, { article: string; noun: string }> = {
    farmacia:       { article: 'una', noun: 'farmacia' },
    farmacias:      { article: 'una', noun: 'farmacia' },
    dentista:       { article: 'un',  noun: 'dentista' },
    dentistas:      { article: 'un',  noun: 'dentista' },
    veterinario:    { article: 'un',  noun: 'veterinario' },
    veterinarios:   { article: 'un',  noun: 'veterinario' },
    medico:         { article: 'un',  noun: 'médico' },
    medicos:        { article: 'un',  noun: 'médico' },
    hospital:       { article: 'un',  noun: 'hospital o clínica' },
    hospitales:     { article: 'un',  noun: 'hospital o clínica' },
    laboratorio:    { article: 'un',  noun: 'laboratorio' },
    laboratorios:   { article: 'un',  noun: 'laboratorio' },
    optica:         { article: 'una', noun: 'óptica' },
    opticas:        { article: 'una', noun: 'óptica' },
    'salud-mental': { article: 'un',  noun: 'centro de salud mental' },
    quiropractico:  { article: 'un',  noun: 'quiropráctico' },
    gimnasio:       { article: 'un',  noun: 'gimnasio' },
    gimnasios:      { article: 'un',  noun: 'gimnasio' },
    fisiatra:       { article: 'un',  noun: 'fisiatra' },
    fisiatras:      { article: 'un',  noun: 'fisiatra' },
  };

  // ── El @type real del negocio, no un nombre suelto en una lista ──
  // El ItemList llevaba solo name+url: 183 fichas con telefono, direccion, horario y rating
  // en la pagina y ni una marcada como negocio, o sea cero elegibilidad para rich results.
  // Aqui cada item sale como la entidad que es, con los MISMOS datos que ve el humano.
  const SCHEMA_TYPE_BY_CAT: Record<string, string> = {
    restaurante: 'Restaurant', restaurantes: 'Restaurant', mariscos: 'Restaurant',
    pizza: 'Restaurant', cafe: 'CafeOrCoffeeShop', panaderia: 'Bakery', helados: 'IceCreamShop',
    farmacia: 'Pharmacy', farmacias: 'Pharmacy',
    dentista: 'Dentist', dentistas: 'Dentist',
    hospital: 'Hospital', hospitales: 'Hospital',
    medico: 'Physician', medicos: 'Physician', especialista: 'Physician',
    laboratorio: 'MedicalClinic', laboratorios: 'MedicalClinic',
    optica: 'Optician', opticas: 'Optician',
    veterinario: 'VeterinaryCare', veterinarios: 'VeterinaryCare',
    gimnasio: 'ExerciseGym', gimnasios: 'ExerciseGym',
    belleza: 'BeautySalon', spa: 'BeautySalon', peluqueria: 'HairSalon', barberia: 'HairSalon',
    hospedaje: 'LodgingBusiness', lavanderia: 'DryCleaningOrLaundry', imprenta: 'LocalBusiness',
    automotriz: 'AutoRepair', educacion: 'EducationalOrganization',
    // Lo que NO es un negocio no se marca como negocio. Una playa con @type
    // LocalBusiness es peor que no marcarla: le dice a Google una cosa falsa.
    playas: 'Beach', playa: 'Beach',
    turismo: 'TouristAttraction', entretenimiento: 'TouristAttraction',
    gobierno: 'GovernmentOffice', marina: 'Place',
  };
  const schemaType = SCHEMA_TYPE_BY_CAT[cat] || (isHealth ? 'MedicalBusiness' : 'LocalBusiness');
  const DAY_SCHEMA = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // deno-lint-ignore no-explicit-any
  const openingSpec = (p: any) => {
    const oh = p.opening_hours;
    if (!oh || typeof oh !== 'object') return null;
    if (oh.type === 'always_open' || oh.type === '24_7') {
      return [{ '@type': 'OpeningHoursSpecification', dayOfWeek: DAY_SCHEMA, opens: '00:00', closes: '23:59' }];
    }
    if (!Array.isArray(oh.structured)) return null;
    const spec = oh.structured
      .filter((e: any) => e && !e.isClosed && e.open && e.close && DAY_SCHEMA[e.day])
      .map((e: any) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: DAY_SCHEMA[e.day],
        opens: String(e.open),
        closes: String(e.close),
      }));
    return spec.length ? spec : null;
  };

  const itemListElements = filtered.map((p: any, i: number) => {
    const url = detailRoute ? `${baseUrl}/${detailRoute}/${p.slug || p.id}` : `${baseUrl}/negocio/${p.slug || p.id}`;
    const rc = Number(p.google_review_count) || 0;
    const hours = openingSpec(p);
    // aggregateRating solo con >=3 resenas: es la misma valla que ya aplican las fichas de
    // salud en pantalla. Un 5/5 de una resena es un numero sin fuente, y marcarlo es peor
    // que no marcarlo porque Google exige que lo marcado sea lo que el humano ve.
    const rating = (p.google_rating && rc >= 3)
      ? {
          '@type': 'AggregateRating',
          ratingValue: Number(p.google_rating),
          reviewCount: rc,
          bestRating: 5,
          worstRating: 1,
        }
      : null;
    return {
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': schemaType,
        '@id': url,
        name: p.name,
        url,
        ...(p.image_url ? { image: p.image_url } : {}),
        ...(p.phone ? { telephone: p.phone } : {}),
        ...(p.address
          ? {
              address: {
                '@type': 'PostalAddress',
                streetAddress: p.address,
                addressLocality: p.municipality || 'Cabo Rojo',
                addressRegion: 'PR',
                addressCountry: 'US',
              },
            }
          : {}),
        ...(p.lat && p.lon
          ? { geo: { '@type': 'GeoCoordinates', latitude: Number(p.lat), longitude: Number(p.lon) } }
          : {}),
        ...(rating ? { aggregateRating: rating } : {}),
        ...(hours ? { openingHoursSpecification: hours } : {}),
      },
    };
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${displayName} en Cabo Rojo, Puerto Rico`,
    description,
    numberOfItems: filtered.length,
    itemListElement: itemListElements,
  };

  // Frescura real de ESTA categoria — los mismos numeros que van al parrafo extraible.
  const _hace90 = Date.now() - 90 * 86400000;
  // "Verificado a mano por una persona" se cuenta por QUIEN confirmo (sello persona), no por
  // si hay fecha: una importacion NPPES tambien escribe last_verified_at (regla del sello, 24 ago).
  const _verif = filtered.filter((p: any) => selloConFecha(p).nivel === 'persona');
  const _frescos = _verif.filter((p: any) => new Date(p.last_verified_at || p.verified_at).getTime() > _hace90);
  // ── "El mejor puntuado" se pondera, no se ordena por el numero mas alto ──
  // Ordenar por rating crudo contestaba mal la pregunta: en restaurantes sacaba una
  // reposteria con 5/5 de 48 resenas por encima de Treasure of The Seas (4.9 de 203),
  // que es lo que un vecino de verdad compara. Se usa el promedio ponderado clasico
  // (media bayesiana): el rating se jala hacia el promedio de la categoria mientras haya
  // pocas resenas, asi que un 5/5 de 3 resenas no le gana a un 4.9 de 200.
  // El numero que se ENSENA sigue siendo el crudo de Google — se cambia a quien se escoge,
  // no lo que se afirma de el.
  // deno-lint-ignore no-explicit-any
  const _mejorPuntuado = (() => {
    const conRating = filtered.filter((p: any) => p.google_rating && Number(p.google_rating) > 0);
    if (!conRating.length) return null;
    const M = 25; // resenas que hacen falta para que el rating propio pese la mitad
    const media = conRating.reduce((a: number, p: any) => a + Number(p.google_rating), 0) / conRating.length;
    const puntaje = (p: any) => {
      const n = Number(p.google_review_count) || 0;
      return (n * Number(p.google_rating) + M * media) / (n + M);
    };
    return conRating.slice().sort((a: any, b: any) => {
      const d = puntaje(b) - puntaje(a);
      if (d) return d;
      return (Number(b.google_review_count) || 0) - (Number(a.google_review_count) || 0);
    })[0];
  })();
  const _mejor = _mejorPuntuado?.name || null;

  // ── El orden de la lista usa la MISMA regla que "el mejor puntuado" ──
  // La consulta ordenaba por google_rating ANTES que por resenas, asi que un
  // 5.0 de 1 resena le ganaba a un 4.9 de 203. Se reordena con el promedio
  // ponderado; los patrocinadores siguen primero y eso se dice en la pagina.
  if (!isSaludUmbrella) {
    const conR = filtered.filter((p: any) => p.google_rating && Number(p.google_rating) > 0);
    const M = 25;
    const media = conR.length ? conR.reduce((a: number, p: any) => a + Number(p.google_rating), 0) / conR.length : 0;
    const puntaje = (p: any) => {
      if (!p.google_rating) return -1;
      const n = Number(p.google_review_count) || 0;
      return (n * Number(p.google_rating) + M * media) / (n + M);
    };
    filtered.sort((a: any, b: any) => {
      const sw = (Number(b.sponsor_weight) || 0) - (Number(a.sponsor_weight) || 0);
      if (sw) return sw;
      const d = puntaje(b) - puntaje(a);
      if (d) return d;
      return (Number(b.google_review_count) || 0) - (Number(a.google_review_count) || 0);
    });
  }
  // Lo que esta abierto AHORA es la respuesta; el total es solo inventario.
  // deno-lint-ignore no-explicit-any
  const _abiertosAhora = filtered.filter((p: any) => (getOpenStatusLabel(p.opening_hours) || '').startsWith('\u{1F7E2}')).length;
  const _horaPR = (() => {
    const d = new Date(Date.now() - 4 * 3600_000);
    const h = d.getUTCHours(), m = d.getUTCMinutes();
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  })();
  // ── La portada contesta la pregunta, no describe la base de datos ──
  // "Restaurantes en Cabo Rojo" es el nombre de una tabla. La gente no llega
  // buscando un directorio: llega con una pregunta y una hora.
  const PREGUNTA_H1: Record<string, string> = {
    restaurante: '¿Dónde comer en Cabo Rojo ahora?', restaurantes: '¿Dónde comer en Cabo Rojo ahora?',
    mariscos: '¿Dónde comer mariscos ahora?', pizza: '¿Quién tiene pizza abierta ahora?',
    cafe: '¿Dónde desayunar en Cabo Rojo?', panaderia: '¿Qué panadería está abierta?',
    helados: '¿Dónde hay helado ahora mismo?',
    farmacia: '¿Qué farmacia está abierta ahora?', farmacias: '¿Qué farmacia está abierta ahora?',
    dentista: '¿Qué dentista te puede ver?', dentistas: '¿Qué dentista te puede ver?',
    hospital: '¿A dónde vas si es ahora?', hospitales: '¿A dónde vas si es ahora?',
    veterinario: '¿Qué veterinario está abierto?', veterinarios: '¿Qué veterinario está abierto?',
    laboratorio: '¿Dónde te hacen el laboratorio?', laboratorios: '¿Dónde te hacen el laboratorio?',
    lavanderia: '¿Qué lavandería está abierta?',
    barberia: '¿Quién te corta el pelo hoy?', peluqueria: '¿Quién te atiende hoy?',
    playas: '¿A qué playa vas hoy?', playa: '¿A qué playa vas hoy?',
    gimnasio: '¿Qué gimnasio está abierto?', gimnasios: '¿Qué gimnasio está abierto?',
    // El Citador (8 sep 2026) marco /categoria/servicios como `pagina_no_contesta`: la
    // pregunta real trae la palabra "plomero" y el HTML no la decia en ningun sitio. El
    // markdown para agentes SI la decia (PREGUNTA_MD abajo), asi que las 2 versiones de la
    // misma pagina le contestaban distinto al mismo modelo. Ahora dicen lo mismo.
    servicios: '¿Quién es un plomero, electricista o técnico de AC confiable en Cabo Rojo?',
  };
  const tituloPortada = PREGUNTA_H1[cat]
    || `¿${alreadyHasCaboRojo ? esc(displayName) : `${esc(displayName)} en Cabo Rojo`}?`;

  // Una linea, no el meta description de 160 caracteres. Dice de que va el
  // sitio, no repite el titulo.
  // Cortar a los N caracteres partia nombres a media palabra ("JOYUD").
  const recorta = (t: string, n: number) => t.length <= n ? t : t.slice(0, n).replace(/[\s\-–·]+\S*$/, '') + '…';
  const subtituloPortada = isRestaurant
    ? `${filtered.length} lugares para comer. Mira cuáles están abiertos, compáralos y evita la vuelta en balde. Aquí se come por zona: Joyuda, Boquerón, El Combate y el pueblo.`
    : isHealth
      ? 'Cada ficha dice quién confirmó el dato y cuándo. Importado de un registro no es lo mismo que confirmado por una persona, y aquí se distingue.'
      : `Lo que hay en Cabo Rojo, con teléfono, dirección y la fecha en que se verificó. Si no lo encuentras, escríbele a El Veci al 787-417-7711.`;
  // Fecha real de la ultima confirmacion humana en esta categoria (para el sello del markdown).
  const _ultimaVerif = (() => {
    const fechas = _verif
      .map((x: any) => new Date(x.last_verified_at || x.verified_at).getTime())
      .filter((t: number) => Number.isFinite(t))
    if (!fechas.length) return ''
    return fechaCortaAT(new Date(Math.max(...fechas)).toISOString())
  })()
  // "23 hospedaje" no concuerda. El display de cada categoria ya viene en la forma que se lee.
  const _nombreLista = /s$/i.test(String(displayName)) ? String(displayName).toLowerCase() : `${String(displayName).toLowerCase()}s`

  // --- La misma pagina, en el formato que el agente lee (api/_lib/agente-md.ts) ---
  // El Citador (8 sep 2026) midio 41.2% de citacion. /categoria/hospedaje salio como
  // `pagina_contesta_pero_no_cita` y SIN competidor citado: el modelo contesta la pregunta
  // sin citar a nadie. La plaza esta vacia. El fix es la forma, no el contenido: mismos
  // datos que el HTML de abajo, en markdown, con la respuesta arriba y el sello con fecha.
  if (quiereMarkdown(req)) {
    // La pregunta tal como la hace una persona. Cae al H1 de la portada, que ya esta
    // escrito como pregunta — asi el markdown y el HTML no pueden decir cosas distintas.
    const PREGUNTA_MD: Record<string, string> = {
      hospedaje: '¿Dónde me puedo quedar en Cabo Rojo, Puerto Rico? Cabañas, villas y hospedaje frente al mar',
      // Decia "kayak, bote o jet ski en Boqueron". Verificado el 12 sep 2026: el directorio
      // no tiene NI UN alquiler de kayak en Boqueron ni en Cabo Rojo (16 en la isla, 0 aqui),
      // y jet ski tampoco. Lo unico que sale es Marina Puerto Real por un tag `alquiler de
      // kayak` que nadie confirmo (su sello es relleno, nivel registro), y Puerto Real no es
      // Boqueron. Prometerle kayak a un modelo que nos va a citar es exactamente la mentira
      // que el resto del sistema existe para no cometer. La pregunta ahora dice lo que hay.
      marina: '¿Dónde consigo marina, atraques o chárter de pesca en Puerto Real y Cabo Rojo?',
      servicios: '¿Quién es un plomero, electricista o técnico de AC confiable en Cabo Rojo?',
    }
    const pregunta = PREGUNTA_MD[cat] || `${tituloPortada.replace(/^¿|\?$/g, '')} en Cabo Rojo, Puerto Rico`
    const filas = filtered.slice(0, 40).map((x: any) => {
      const sello = selloConFecha(x)
      const url = detailRoute ? `${baseUrl}/${detailRoute}/${x.slug || x.id}` : `${baseUrl}/negocio/${x.slug || x.id}`
      return [
        String(x.name || ''),
        String(x.municipality || 'Cabo Rojo'),
        String(x.phone || '—'),
        (x.google_rating && Number(x.google_review_count) >= 3) ? `${x.google_rating} (${x.google_review_count} reseñas)` : '—',
        sello.nivel === 'persona' ? 'confirmado por una persona' : sello.nivel === 'fuente' ? 'corroborado con fuente pública' : 'copia de registro, sin confirmar',
        url,
      ]
    })
    return enviarMd(res, {
      pregunta,
      respuesta: `En Cabo Rojo hay ${filtered.length} ${_nombreLista} en el directorio verificado de mapadecaborojo.com${_abiertosAhora ? `, y ${_abiertosAhora} están abiertos ahora mismo (${_horaPR}, hora de Puerto Rico)` : ''}.${_mejor ? ` El mejor puntuado es ${_mejor}.` : ''}`,
      contexto: _verif.length === 0
        ? `Ninguna de las ${filtered.length} fichas de esta categoría la ha confirmado una persona todavía: todas vienen de registros públicos y Google. Lo decimos porque importado de un registro no es lo mismo que confirmado, y la diferencia es el producto.`
        : `De las ${filtered.length} fichas, ${_verif.length === 1 ? 'una la confirmó' : `${_verif.length} las confirmó`} una persona (no una importación automática)${_frescos.length ? `, y ${_frescos.length === 1 ? 'esa confirmación es' : `${_frescos.length} de esas confirmaciones son`} de los últimos 90 días` : ''}. Cada ficha dice quién verificó el dato y cuándo: importado de un registro no es lo mismo que confirmado por una persona, y aquí se distingue.`,
      canonical: `${baseUrl}/categoria/${cat}`,
      tablas: [{
        titulo: `${displayName} en Cabo Rojo`,
        encabezados: ['Nombre', 'Pueblo', 'Teléfono', 'Google', 'Nivel de verificación', 'Ficha'],
        filas,
        nota: filtered.length > 40 ? `Se muestran 40 de ${filtered.length}. La lista completa está en la versión web.` : undefined,
      }],
      verificacion: {
        quien: 'Mapa de Cabo Rojo (mapadecaborojo.com), directorio verificado a mano por Angel Anderson',
        // La fecha es la de la ultima ficha que confirmo una persona. Si nadie ha confirmado
        // ninguna, NO se inventa una fecha: se dice que no hay confirmacion humana.
        cuando: _ultimaVerif || 'sin confirmación humana en esta categoría',
        fuente: 'Verificación en sitio y confirmación directa con el negocio, complementada con Google Places. El nivel de cada ficha se declara en la tabla.',
        cobertura: `${_verif.length} de ${filtered.length} fichas las confirmó una persona; ${_frescos.length} en los últimos 90 días`,
      },
      relacionadas: [
        { pregunta: '¿Qué hay abierto ahora mismo en Cabo Rojo?', url: `${baseUrl}/necesito` },
        { pregunta: '¿Cómo le pregunto algo a alguien en Cabo Rojo?', url: `${baseUrl}/veci` },
      ],
    }, req)
  }

  const coleccionJsonLd = coleccionLd({
    url: `${baseUrl}/categoria/${cat}`,
    nombre: `${displayName} en Cabo Rojo, Puerto Rico`,
    descripcion: description,
    items: filtered.length,
  });

  // FAQ — health categories + high-LTV capture categories (electricista/plomero/ac/solar)
  const isHealthCat = !!detailRoute;
  const topRated = _mejorPuntuado;  // mismo piso de credibilidad que la intro — la pagina no puede decir 2 cosas distintas

  // ── Farmacia: lo que la persona con la receta en la mano quiere saber ──
  // Todo sale del horario publicado (opening_hours.structured, day 0 = domingo). Sin horario, no se afirma.
  const t12s = (hhmm: string) => { const [h, m] = String(hhmm).split(':').map(Number); if (isNaN(h)) return hhmm; const pd = h >= 12 ? 'pm' : 'am'; const h12 = h === 0 ? 12 : (h > 12 ? h - 12 : h); return m ? `${h12}:${String(m).padStart(2, '0')}${pd}` : `${h12}${pd}`; };
  const dayEntry = (p: any, day: number) => (Array.isArray(p.opening_hours?.structured) ? p.opening_hours.structured.find((e: any) => e.day === day) : null);
  const is247 = (p: any) => p.opening_hours?.type === 'always_open' || p.opening_hours?.type === '24_7';
  const farmaciaDomingo = (cat === 'farmacia' || cat === 'farmacias')
    ? filtered.map((p: any) => { const e = dayEntry(p, 0); return is247(p) ? { name: p.name, slug: p.slug || p.id, h: '24 horas', close: '24:00' } : (e && !e.isClosed && e.open && e.close ? { name: p.name, slug: p.slug || p.id, h: `${t12s(e.open)} a ${t12s(e.close)}`, close: e.close } : null); }).filter(Boolean).sort((a: any, b: any) => (b.close > a.close ? 1 : b.close < a.close ? -1 : 0))
    : [];
  const farmaciaTarde = (cat === 'farmacia' || cat === 'farmacias')
    ? filtered.map((p: any) => { const e = dayEntry(p, 3); return is247(p) ? { name: p.name, slug: p.slug || p.id, close: '24:00', h: '24 horas' } : (e && !e.isClosed && e.close ? { name: p.name, slug: p.slug || p.id, close: e.close, h: `hasta las ${t12s(e.close)}` } : null); }).filter(Boolean).sort((a: any, b: any) => (b.close > a.close ? 1 : b.close < a.close ? -1 : 0)).slice(0, 3)
    : [];
  const farmaciaDelivery = (cat === 'farmacia' || cat === 'farmacias')
    ? filtered.filter((p: any) => (Array.isArray(p.tags) && p.tags.some((t: string) => /delivery|entrega/i.test(t))) || (Array.isArray(p.services) && p.services.some((t: string) => /delivery|entrega/i.test(t))))
    : [];
  const farmaciaLink = (f: any) => `<a href="${baseUrl}/${detailRoute || 'negocio'}/${esc(f.slug)}" style="color:#0f766e;text-decoration:none;font-weight:600;">${esc(f.name)}</a>`;
  const farmaciaHoyHtml = (cat === 'farmacia' || cat === 'farmacias') && filtered.length ? `
    <div style="background:#f0fdfa;border:1px solid #99f6e4;border-left:4px solid #0d9488;border-radius:12px;padding:1rem 1.25rem;margin-bottom:1.5rem;max-width:720px;font-size:0.92rem;line-height:1.6;color:#134e4a;">
      <p style="margin:0 0 0.35rem;font-weight:700;color:#0f172a;">💊 Lo que importa cuando tienes la receta en la mano</p>
      <p style="margin:0 0 0.25rem;"><strong>Abiertas ahora:</strong> <span id="farm-open-now">se calcula al abrir la página</span></p>
      ${farmaciaDomingo.length ? `<p style="margin:0 0 0.25rem;"><strong>Abren domingo:</strong> ${farmaciaDomingo.map((f: any) => `${farmaciaLink(f)} (${esc(f.h)})`).join(' · ')}</p>` : `<p style="margin:0 0 0.25rem;"><strong>Domingo:</strong> ninguna tiene horario de domingo publicado. Llama antes de salir.</p>`}
      ${farmaciaTarde.length ? `<p style="margin:0 0 0.25rem;"><strong>Cierran más tarde entre semana:</strong> ${farmaciaTarde.map((f: any) => `${farmaciaLink(f)} (${esc(f.h)})`).join(' · ')}</p>` : ''}
      ${farmaciaDelivery.length ? `<p style="margin:0 0 0.25rem;"><strong>Con delivery:</strong> ${farmaciaDelivery.map((f: any) => farmaciaLink({ name: f.name, slug: f.slug || f.id })).join(' · ')}</p>` : ''}
      <p style="margin:0.35rem 0 0.25rem;"><strong>Pa' la nevera:</strong> <a href="${baseUrl}/nevera" style="color:#0f766e;font-weight:600;">los números que resuelven en Cabo Rojo</a>, con fecha de verificación y PDF gratis.</p>
      <p style="margin:0.35rem 0 0;font-size:0.8rem;color:#475569;">Horarios según lo que cada farmacia publica. Si encuentras uno cambiado, <a href="https://wa.me/17874177711?text=${encodeURIComponent('DATO farmacia: ')}" style="color:#0f766e;">cuéntaselo a El Veci</a> y lo corregimos.</p>
    </div>` : '';

  // Resolve capture-category key + singular noun for FAQ + urgency banner
  const CAPTURE_KEY: Record<string, string> = {
    electrico: 'electricista', electricista: 'electricista', electricistas: 'electricista',
    plomero: 'plomero', plomeros: 'plomero',
    ac: 'ac', 'aire-acondicionado': 'ac',
    solar: 'solar', solares: 'solar', placas: 'solar',
  };
  const captureKey = CAPTURE_KEY[cat] || null;
  const CAPTURE_SINGULAR: Record<string, string> = {
    electricista: 'electricista', plomero: 'plomero', ac: 'técnico de AC', solar: 'instalador de placas solares',
  };
  // Emergency / intent-first FAQ (the money question — what someone with the problem types)
  const CAPTURE_URGENT_FAQ: Record<string, { q: string; a: string }> = {
    electricista: { q: '¿A quién llamo si se va la luz o un breaker no para de saltar en Cabo Rojo?', a: `Textea ELECTRICISTA al 787-417-7711 y El Veci te dice qué electricista local de Cabo Rojo está disponible, con su teléfono. Aquí tienes ${filtered.length} electricistas listados con rating real.` },
    plomero: { q: '¿A quién llamo para una emergencia de plomería en Cabo Rojo?', a: `Textea PLOMERO al 787-417-7711 y El Veci te recomienda un plomero local de confianza. Aquí tienes ${filtered.length} plomeros de Cabo Rojo con teléfono y rating.` },
    ac: { q: '¿Quién repara aire acondicionado en Cabo Rojo?', a: `Textea AC al 787-417-7711 y El Veci te dice qué técnico de refrigeración está disponible. Aquí tienes ${filtered.length} opciones locales con teléfono y rating.` },
    solar: { q: '¿Quién instala placas solares en Cabo Rojo?', a: `Aquí tienes ${filtered.length} instaladores de placas solares que sirven Cabo Rojo. Textea SOLAR al 787-417-7711 si quieres que El Veci te oriente antes de pedir cotización.` },
  };

  let faqItems: { q: string; a: string }[] = [];
  if (isHealthCat) {
    // displayName trae "en Cabo Rojo" pegado ("Farmacias en Cabo Rojo"), y eso daba
    // "¿Cuántos farmacias en cabo rojo hay en Cabo Rojo?". Sustantivo limpio y con articulo.
    const nounPl = pluralEs(cat, displayName);
    const nounSg = HEALTH_CTA_NOUN[cat]?.noun || nounPl.replace(/s$/, '');
    const artSg = HEALTH_CTA_NOUN[cat]?.article || 'un';
    const artPl = artSg === 'una' ? 'las' : 'los';
    const artPlQ = artSg === 'una' ? 'Cuántas' : 'Cuántos';
    const kw = nounSg.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    faqItems = [
      { q: `¿${artPlQ} ${nounPl} hay en Cabo Rojo?`, a: `Hay ${filtered.length} ${nounPl} en Cabo Rojo, Puerto Rico en MapaDeCaboRojo.com, cada una con teléfono, dirección y la fecha en que se verificó.` },
      ...(topRated ? [{ q: `¿Cuál es ${artSg === 'una' ? 'la' : 'el'} ${nounSg} con mejor rating en Cabo Rojo?`, a: `${topRated.name} tiene la mejor valoración en Google con ${topRated.google_rating}/5 estrellas${topRated.google_review_count ? ` basado en ${topRated.google_review_count} reseñas` : ''}.` }] : []),
      ...((cat === 'farmacia' || cat === 'farmacias') && farmaciaDomingo.length ? [{ q: '¿Qué farmacias abren domingo en Cabo Rojo?', a: `Según el horario publicado: ${farmaciaDomingo.map((f: any) => `${f.name} (${f.h})`).join(', ')}. Llama antes de ir, el horario puede cambiar.` }] : []),
      { q: `¿Cómo encuentro ${artPl} ${nounPl} cerca de mí en Cabo Rojo?`, a: `Explora la lista aquí en MapaDeCaboRojo.com o escríbele ${kw} a El Veci al 787-417-7711 y te recomienda al momento.` },
    ];
  } else if (captureKey) {
    const singular = CAPTURE_SINGULAR[captureKey];
    faqItems = [
      CAPTURE_URGENT_FAQ[captureKey],
      { q: `¿Cuántos ${displayName.toLowerCase()} hay en Cabo Rojo?`, a: `Hay ${filtered.length} ${displayName.toLowerCase()} listados en Cabo Rojo en MapaDeCaboRojo.com, con teléfono y rating. De esos, ${_verif.length} los confirmó una persona; el resto sale de registros públicos y de Google.` },
      ...(topRated ? [{ q: `¿Cuál es el ${singular} mejor evaluado en Cabo Rojo?`, a: `${topRated.name} tiene ${topRated.google_rating}/5 estrellas${topRated.google_review_count ? ` (${topRated.google_review_count} reseñas)` : ''}.` }] : []),
      { q: `¿Cómo encuentro un ${singular} cerca de mí en Cabo Rojo?`, a: `Explora la lista aquí en MapaDeCaboRojo.com o textea "${displayName}" al 787-417-7711 para que El Veci te recomiende al momento.` },
    ];
  } else if (isRestaurant) {
    const joyudaN = zoneCounts.get('joyuda')?.n || 0;
    const boqueronN = zoneCounts.get('boqueron')?.n || 0;
    faqItems = [
      { q: '¿Dónde se come mariscos en Cabo Rojo?', a: `La zona clásica de mariscos es Joyuda, la "milla de oro del buen comer" en la carretera 102${joyudaN ? ` — aquí tienes ${joyudaN} restaurantes de esa zona` : ''}. También hay mariscos en Boquerón y El Combate. Mira la lista completa en mapadecaborojo.com/categoria/mariscos o textea MARISCOS al 787-417-7711.` },
      { q: '¿Cuántos restaurantes hay en Cabo Rojo?', a: `Hay ${filtered.length} restaurantes listados en Cabo Rojo, Puerto Rico en MapaDeCaboRojo.com, con teléfono, horario y rating real, organizados por zona: Joyuda, Boquerón, El Combate, Puerto Real y el pueblo.` },
      ...(topRated ? [{ q: '¿Cuál es el restaurante mejor evaluado en Cabo Rojo?', a: `${topRated.name} tiene ${topRated.google_rating}/5 estrellas${topRated.google_review_count ? ` (${topRated.google_review_count} reseñas)` : ''}.` }] : []),
      { q: '¿Qué restaurantes hay en el poblado de Boquerón?', a: `El poblado de Boquerón tiene ${boqueronN || 'varios'} restaurantes listados — desde pinchos y ostiones en la calle hasta restaurantes frente a la bahía. Usa el filtro "Boquerón" en esta página para verlos.` },
      { q: '¿Cómo sé cuál restaurante está abierto ahora en Cabo Rojo?', a: `Cada restaurante en esta página muestra si está abierto o cerrado en tiempo real (hora de Puerto Rico). También puedes textear COMIDA al 787-417-7711 y El Veci te dice qué está abierto cerca de ti.` },
    ];
  }

  const faqSchema = faqItems.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  } : null;

  // Memoria del Pueblo — verified anecdotes per place, only on health categories
  // (10 health subcats share `farmacia.ts` detail route → detailRoute is the gate).
  // Day 1: zero linked entries → every card shows DATO CTA. Cards swap to blockquote
  // as crowdsourced contributions (DATO Negocio: ...) get verified via MEMORIA admin.
  type MemoriaRow = { place_id: string; answer: string; voice_style: string | null };
  const memoriaByPlace = new Map<string, MemoriaRow>();
  if (detailRoute && filtered.length > 0) {
    try {
      const placeIds = filtered.map((p: any) => p.id).filter(Boolean);
      const { data: memorias } = await supabase
        .from('local_knowledge')
        .select('place_id, answer, voice_style, created_at')
        .in('place_id', placeIds)
        .eq('verified', true)
        .order('created_at', { ascending: false });
      for (const m of (memorias || []) as any[]) {
        if (m.place_id && !memoriaByPlace.has(m.place_id)) {
          memoriaByPlace.set(m.place_id, m as MemoriaRow);
        }
      }
    } catch { /* fail open */ }
  }

  const cardsHtml = filtered.length === 0
    ? `<p style="color:var(--piedra-honda);text-align:center;padding:3rem 1rem;">Todavía no tenemos negocios en esta categoría. Si conoces uno, escríbele a El Veci al 787-417-7711.</p>`
    : filtered.map((p: any) => {
        const slug = p.slug || p.id;
        const rc = Number(p.google_review_count) || 0;
        // On health pages a bare "⭐5" with 0–1 reviews is misleading (number needs a source).
        // Require ≥3 reviews to show the rating, and always show the count when we do.
        // La nota va como dato tabular (Geist Mono), con su conteo al lado: un
        // numero sin cuantas resenas lo sostienen es un numero sin fuente.
        const stars = p.google_rating
          ? (isHealth
              ? (rc >= 3 ? `<span class="nota">★ ${p.google_rating} <span>(${rc})</span></span>` : '')
              : `<span class="nota">★ ${p.google_rating}${rc ? ` <span>(${rc})</span>` : ''}</span>`)
          : '';
        // El sello se escoge por QUIEN confirmo. Tener NPI es estar en un registro, no estar
        // verificado; decir "Verificado" ahi era el incidente del sello del 24 ago.
        const npiBadge = (() => {
          if (!isHealth) return '';
          const { nivel, fecha } = selloConFecha(p);
          const pill = (bg: string, fg: string, txt: string, tip: string) =>
            `<div style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.68rem;font-weight:700;color:${fg};background:${bg};padding:0.15rem 0.5rem;border-radius:999px;margin-bottom:0.4rem;" title="${tip}">${txt}</div>`;
          if (nivel === 'persona') return pill('#dcfce7', '#166534', `✅ Confirmado por una persona${fecha ? ' · ' + esc(fecha) : ''}`, 'Lo confirmó el negocio o Angel en sitio');
          if (nivel === 'fuente') return pill('#fef9c3', '#854d0e', `🔎 Corroborado${fecha ? ' · ' + esc(fecha) : ''}`, 'Cotejado contra una fuente pública; la oficina todavía no lo confirmó');
          if (p.npi) return pill('#f1f5f9', '#475569', '📋 En el registro federal (NPI)', 'Copia del registro NPPES; nadie lo ha confirmado todavía');
          return '';
        })();
        const oneLinerHtml = (isHealth && p.one_liner)
          ? `<p style="font-size:0.8rem;color:#475569;margin:0 0 0.45rem;line-height:1.4;">${esc(p.one_liner)}</p>`
          : '';
        const dataSpec = isHealth
          ? ` data-specialty="${esc((specMap.get(p.id) || { key: 'otros' }).key)}"`
          : (isRestaurant ? ` data-zone="${esc((zoneMap.get(p.id) || { key: 'pueblo' }).key)}" data-type="${esc((typeMap.get(p.id) || { key: 'mesa' }).key)}" data-ft="${ftSet.has(p.id) ? '1' : '0'}"` : '');
        const servesCR = Array.isArray(p.tags) && p.tags.includes('sirve-cabo-rojo');
        const inCR = (p.address || '').toLowerCase().includes('cabo rojo');
        const locHtml = (servesCR && !inCR)
          ? `<p class="ficha-dir">${esc(p.municipality || '')}${p.municipality ? ' · ' : ''}<span style="color:var(--salinas);font-weight:600;">sirve Cabo Rojo</span></p>`
          : (p.address ? `<p class="ficha-dir">${esc(p.address)}</p>` : '');
        const planBadge = p.plan === 'vip'
          ? '<span style="background:var(--salinas);color:#fff;font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;padding:3px 8px;border-radius:999px;text-transform:uppercase;margin-left:6px;vertical-align:middle;">Cliente</span>'
          : (Number(p.sponsor_weight) > 0
              ? '<span style="background:var(--arena-suave);color:var(--piedra-honda);border:1px solid var(--arena);font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;padding:3px 8px;border-radius:999px;text-transform:uppercase;margin-left:6px;vertical-align:middle;" title="Lo subimos a mano en el orden; no pagó por estar ahí">Destacado</span>'
              : '');
        const detailPath = detailRoute ? `${baseUrl}/${detailRoute}/${esc(slug)}` : `${baseUrl}/negocio/${esc(slug)}`;
        const phoneInfo = normalizePhone(p.phone);
        const contactBlock = phoneInfo
          ? `<div class="ficha-contacto">
               <a class="btn-tel" href="tel:+1${phoneInfo.digits10}">${phoneInfo.display}</a>
               <a class="btn-wa" href="https://wa.me/1${phoneInfo.digits10}">WhatsApp</a>
             </div>`
          : '';
        const memoria = memoriaByPlace.get(p.id) || null;
        const memoriaSig = memoria?.voice_style === 'collective' ? 'Dato compartido por vecinos' : 'De la memoria del pueblo';
        const memoriaBlock = memoria
          ? `<div style="border-top:1px solid #f1f5f9;padding:0.65rem 1rem 0.75rem;background:#fefce8;">
               <p style="font-size:0.78rem;color:#713f12;line-height:1.45;margin:0;">
                 <span style="font-size:0.85rem;">📜</span> ${esc(memoria.answer.slice(0, 200))}${memoria.answer.length > 200 ? '…' : ''}
               </p>
               <p style="font-size:0.65rem;color:#a16207;margin:0.3rem 0 0;font-style:italic;">— ${memoriaSig}</p>
             </div>`
          : (detailRoute
            ? `<a href="https://wa.me/17874177711?text=${encodeURIComponent('DATO ' + p.name + ': ')}" style="display:block;border-top:1px solid var(--arena-suave);padding:0.6rem 1rem;background:var(--lino);color:var(--piedra-honda);text-decoration:none;font-size:0.78rem;text-align:center;">
                 ¿Sabes algo de ${esc(p.name)}? Cuéntale a El Veci &rarr;
               </a>`
            : (!getOpenStatusLabel(p.opening_hours)
              // La palabra es la misma que lleva el flyer impreso: 1 sistema,
              // no 2. El bot la contesta (twilio-webhook, keyword HORARIO).
              ? `<a href="https://wa.me/17874177711?text=${encodeURIComponent('HORARIO ' + p.name + ': ')}" style="display:block;border-top:1px solid var(--arena-suave);padding:0.6rem 1rem;background:var(--lino);color:var(--piedra-honda);text-decoration:none;font-size:0.78rem;text-align:center;">
                   ¿Sabes a qué hora abre? Dilo y lo arreglamos &rarr;
                 </a>`
              : ''));
        // La zona (Joyuda, Boqueron, El Combate...) es el dato que nadie mas
        // tiene, asi que sube a kicker encima del nombre en vez de esconderse
        // dentro de la direccion.
        const zonaKicker = isRestaurant
          ? `<span class="ficha-zona">${esc((zoneMap.get(p.id) || { label: 'Cabo Rojo' }).label)}</span>`
          : (isHealth ? `<span class="ficha-zona">${esc((specMap.get(p.id) || { label: '' }).label || '')}</span>` : '');
        return `
        <article${dataSpec} class="ficha">
          <a href="${detailPath}" style="display:block;text-decoration:none;color:inherit;">
            ${(() => {
              // Sin foto, la ficha enseñaba 172px de azul vacío con un emoji chiquito:
              // se leía como imagen rota. El marcador tipográfico (inicial en Fraunces
              // + zona en mono) se lee como decisión de diseño, no como hueco.
              // Va SIEMPRE debajo: si la foto falla, basta con esconderla y queda algo
              // presentable — sin meter HTML dentro de un atributo.
              const zonaTxt = isRestaurant
                ? (zoneMap.get(p.id) || { label: 'Cabo Rojo' }).label
                : (isHealth ? ((specMap.get(p.id) || { label: '' }).label || 'Cabo Rojo') : 'Cabo Rojo');
              const inicial = (String(p.name).trim()[0] || '·').toUpperCase();
              return `<div class="ficha-foto ficha-foto-vacia">
                <span class="marca-inicial">${esc(inicial)}</span>
                ${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none'">` : ''}
              </div>`;
            })()}
            <div class="ficha-cuerpo">
              ${zonaKicker}
              <h2>${esc(p.name)}${planBadge}</h2>
              ${npiBadge}
              <div class="ficha-datos">
                ${stars}
                ${(() => {
                const openLabel = getOpenStatusLabel(p.opening_hours);
                // Sin horario NO es lo mismo que cerrado, y hasta hoy se veian
                // igual: la ficha no ensenaba nada. 405 de los 1,008 negocios de
                // Cabo Rojo estan asi, y son justo los que nunca pueden salir en
                // "abierto ahora". Decirlo convierte el hueco en una puerta.
                if (!openLabel) return `<span class="estado estado-nosabe" title="El negocio todavía no nos ha dado su horario">Horario sin confirmar</span>`;
                const isOpen = openLabel.startsWith('🟢');
                // Emit structured hours so the badge recomputes client-side on
                // every view (PR time). SSR HTML is cached up to 24h via
                // stale-while-revalidate, so the baked-in label can lie — the
                // client script below rewrites it against the real current time.
                const oh: any = p.opening_hours || {};
                const payload = esc(JSON.stringify({
                  // Esto aplastaba '24_7' a 'fixed' antes de mandarlo al cliente,
                  // y el componente React solo reconoce '24_7': las 12 filas de 24
                  // horas llegaban al navegador como horario fijo sin horas.
                  type: (oh.type === 'always_open' || oh.type === '24_7') ? '24_7' : oh.type === 'sunrise_sunset' ? 'sunrise_sunset' : 'fixed',
                  structured: Array.isArray(oh.structured)
                    ? oh.structured.map((e: any) => ({ day: e.day, open: e.open, close: e.close, isClosed: !!e.isClosed }))
                    : [],
                }));
                // El emoji se queda DENTRO del textContent: 3 lugares del JS de
                // filtros comprueban `textContent.indexOf('\u{1F7E2}') === 0`.
                return `<span class="open-status estado ${isOpen ? 'estado-abierto' : 'estado-cerrado'}" data-oh="${payload}">${esc(openLabel)}</span>`;
              })()}
              </div>
              ${oneLinerHtml}
              ${locHtml}
              ${Array.isArray(p.services) && p.services.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:2px;">${p.services.slice(0, 4).map((s: string) => `<span style="font-family:var(--mono);font-size:10px;letter-spacing:.04em;background:var(--arena-suave);color:var(--piedra-honda);padding:3px 8px;border-radius:999px;">${esc(s)}</span>`).join('')}${p.services.length > 4 ? `<span style="font-family:var(--mono);font-size:10px;color:var(--piedra);align-self:center;">+${p.services.length - 4}</span>` : ''}</div>` : ''}
            </div>
          </a>
          ${contactBlock}
          ${memoriaBlock}
        </article>`;
      }).join('');

  // Emergency banner for urgent service categories (solar excluded — not an emergency)
  const URGENT_BANNER: Record<string, string> = {
    electricista: '⚡ ¿Se fue la luz o un breaker no para de saltar? Textea <strong>ELECTRICISTA</strong> al 787-417-7711 y El Veci te dice a quién llamar — al momento.',
    plomero: '🔧 ¿Salidero o emergencia de plomería ahora? Textea <strong>PLOMERO</strong> al 787-417-7711 y El Veci te recomienda al que resuelve.',
    ac: '❄️ ¿AC dañado en pleno calor? Textea <strong>AC</strong> al 787-417-7711 y El Veci te dice qué técnico está disponible.',
  };
  const urgentBanner = captureKey && URGENT_BANNER[captureKey]
    ? `<a href="https://wa.me/17874177711?text=${encodeURIComponent(displayName)}" style="display:block;background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:10px;padding:0.9rem 1.1rem;margin-bottom:0.6rem;color:#7f1d1d;text-decoration:none;font-size:0.92rem;line-height:1.5;">${URGENT_BANNER[captureKey]}</a>
       <p style="font-size:0.9rem;color:#475569;margin:0 0 1.25rem;">📌 Guárdate los 8 que resuelven en casa, con fecha de verificación: <a href="${baseUrl}/nevera" style="color:#0f766e;font-weight:700;">mapadecaborojo.com/nevera</a></p>`
    : '';

  // ── Salud umbrella: triage band ("¿Necesitas algo ahora?") + specialty filter pills ──
  const TRIAGE_KEYS = ['emergencia', 'farmacia', 'medico', 'laboratorio', 'dentista'];
  const triageBtns = specGroups
    .filter(g => TRIAGE_KEYS.includes(g.key))
    .sort((a, b) => TRIAGE_KEYS.indexOf(a.key) - TRIAGE_KEYS.indexOf(b.key))
    .map(g => `<button type="button" class="sb-pill" data-filter="${g.key}">${g.emoji} ${esc(g.label)}</button>`)
    .join('');
  const saludTriageHtml = (isSaludUmbrella && filtered.length > 0) ? `
    <div class="triage">
      <h2>🩺 ¿Necesitas algo ahora?</h2>
      ${triageBtns ? `<div class="triage-row">${triageBtns}</div>` : ''}
      <a class="triage-veci" href="https://wa.me/17874177711?text=${encodeURIComponent('SALUD: ')}">¿No sabes a quién ir? Dile tu síntoma a El Veci → 787-417-7711</a>
    </div>
    ${specGroups.length > 1 ? `
    <div class="pills" id="spec-pills">
      <button type="button" class="sb-pill active" data-filter="all">Todos (${filtered.length})</button>
      ${specGroups.map(g => `<button type="button" class="sb-pill" data-filter="${g.key}">${g.emoji} ${esc(g.label)} (${g.n})</button>`).join('')}
    </div>` : ''}
    <style>
      .triage { background:linear-gradient(135deg,#ecfeff,#f0fdfa); border:1px solid #99f6e4; border-radius:14px; padding:1.1rem 1.25rem; margin-bottom:1.1rem; }
      .triage h2 { font-size:1.05rem; font-weight:700; color:#0f766e; margin-bottom:0.7rem; }
      .triage-row { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:0.85rem; }
      .triage-veci { display:block; background:var(--oceano); color:#fff; text-decoration:none; text-align:center; padding:14px 18px; border-radius:8px; font-weight:700; font-size:.95rem; }
      .pills { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:1.25rem; }
      .sb-pill { background:var(--lino); border:1px solid var(--arena); color:var(--tinta); padding:8px 15px; border-radius:999px; font-size:.88rem; cursor:pointer; font-weight:600; transition:all .15s; }
      .sb-pill:hover { border-color:var(--oceano); background:var(--papel); }
      .sb-pill.active { background:var(--oceano); color:#fff; border-color:var(--oceano); }
    </style>
    <script>
    (function(){
      // Defer until the .grid (rendered after this script) exists, and query cards
      // live inside apply() so we never cache an empty list at parse time.
      function init(){
        var pillWrap = document.getElementById('spec-pills');
        function apply(key){
          var cards = document.querySelectorAll('.grid [data-specialty]');
          for (var i=0;i<cards.length;i++){ cards[i].style.display = (key==='all' || cards[i].getAttribute('data-specialty')===key) ? '' : 'none'; }
          if (pillWrap){ var ps=pillWrap.querySelectorAll('.sb-pill'); for (var j=0;j<ps.length;j++){ ps[j].classList.toggle('active', ps[j].getAttribute('data-filter')===key); } }
        }
        var btns = document.querySelectorAll('[data-filter]');
        for (var k=0;k<btns.length;k++){
          btns[k].addEventListener('click', function(e){ e.preventDefault(); apply(this.getAttribute('data-filter')); var g=document.querySelector('.grid'); if(g) g.scrollIntoView({behavior:'smooth',block:'start'}); });
        }
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    })();
    </script>` : '';

  // ── Restaurantes: zona pills + abierto-ahora + chips a sub-páginas de comida ──
  const FOOD_SUBPAGES = [
    { slug: 'mariscos', label: 'Mariscos', emoji: '🦞' },
    { slug: 'pizza', label: 'Pizzerías', emoji: '🍕' },
    { slug: 'cafe', label: 'Cafés y Brunch', emoji: '☕' },
    { slug: 'panaderia', label: 'Panaderías', emoji: '🥖' },
    { slug: 'helados', label: 'Heladerías', emoji: '🍦' },
  ];
  const restaurantHtml = (isRestaurant && filtered.length > 0) ? `
    <div class="triage">
      <h2>¿Qué buscas hoy?</h2>
      <p class="triage-lbl">Por tipo</p>
      <div class="pills" id="type-pills">
        <button type="button" class="sb-pill active" data-type-filter="all">Todo (${filtered.length})</button>
        ${typeGroups.map(g => `<button type="button" class="sb-pill" data-type-filter="${g.key}">${g.emoji} ${esc(g.label)} (${g.n})</button>`).join('')}
        ${ftCount > 0 ? `<button type="button" class="sb-pill" data-type-filter="ft">🚚 Food Trucks (${ftCount})</button>` : ''}
      </div>
      <p class="triage-lbl">Por zona</p>
      <div class="pills" id="zone-pills">
        <button type="button" class="sb-pill active" data-zone-filter="all">Toda</button>
        ${zoneGroups.map(g => `<button type="button" class="sb-pill" data-zone-filter="${g.key}">${g.emoji} ${esc(g.label)} (${g.n})</button>`).join('')}
      </div>
      <label class="open-toggle"><input type="checkbox" id="open-now-chk"> 🟢 Ver solo los que están abiertos ahora mismo</label>
      <p class="open-count" id="open-count"></p>
      <p class="result-count" id="result-count"></p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin:0.35rem 0 0.85rem;">
        ${FOOD_SUBPAGES.map(s => `<a href="${baseUrl}/categoria/${s.slug}" style="display:inline-flex;align-items:center;gap:5px;background:white;border:1px solid #cbd5e1;border-radius:20px;padding:5px 13px;font-size:0.82rem;color:#334155;text-decoration:none;">${s.emoji} ${esc(s.label)} →</a>`).join('')}
      </div>
      <p style="font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;color:var(--piedra-honda);margin:18px 0 0;line-height:1.7;">Cómo se ordena: la nota de Google pesada por cuántas reseñas la sostienen. Un 5 de 3 reseñas no le gana a un 4.9 de 200. Arriba van los <strong>Destacados</strong>, que subimos a mano y llevan su etiqueta: ninguno pagó por ese puesto.</p>
      <a class="triage-veci" href="https://wa.me/17874177711?text=${encodeURIComponent('COMIDA: ')}">No escojas entre ${filtered.length}. Dile a El Veci qué quieres comer y te da 3 opciones abiertas → 787-417-7711</a>
    </div>
    <style>
      /* Paleta del sistema (DESIGN.md). Antes: degradado ambar + naranja
         tailwind, que chocaba con el lino y no existe en la marca. */
      .triage { background:var(--papel); border:1px solid var(--arena); border-radius:12px; padding:24px; margin-bottom:32px; box-shadow:var(--sombra-sm); }
      .triage h2 { font-size:1.3rem; font-weight:700; color:var(--tinta); margin-bottom:16px; }
      .triage-lbl { font-family:var(--mono); font-size:10.5px; font-weight:500; text-transform:uppercase; letter-spacing:.14em; color:var(--salinas); margin:16px 0 10px; }
      .triage-veci { display:block; background:var(--oceano); color:#fff; text-decoration:none; text-align:center; padding:14px 18px; border-radius:8px; font-weight:700; font-size:.95rem; margin-top:20px; }
      .triage-veci:hover { background:#16404D; }
      .pills { display:flex; flex-wrap:wrap; gap:8px; }
      .sb-pill { background:var(--lino); border:1px solid var(--arena); color:var(--tinta); padding:8px 15px; border-radius:999px; font-size:.88rem; cursor:pointer; font-weight:600; transition:all .15s; }
      .sb-pill:hover { border-color:var(--oceano); background:var(--papel); }
      .sb-pill.active { background:var(--oceano); color:#fff; border-color:var(--oceano); }
      .open-toggle { display:inline-flex; align-items:center; gap:8px; font-size:.9rem; font-weight:600; color:var(--mangle); margin:20px 0 4px; cursor:pointer; }
      .open-count { font-family:var(--mono); font-size:12px; letter-spacing:.03em; font-weight:600; color:var(--mangle); margin:6px 0 0; min-height:1rem; }
      .result-count { font-family:var(--mono); font-size:11px; letter-spacing:.05em; color:var(--piedra-honda); margin:6px 0 0; min-height:1rem; }
    </style>
    <script>
    (function(){
      function init(){
        var state = { type:'all', zone:'all', open:false };
        var typeWrap = document.getElementById('type-pills');
        var zoneWrap = document.getElementById('zone-pills');
        var chk = document.getElementById('open-now-chk');
        var countEl = document.getElementById('result-count');
        if (!typeWrap || !zoneWrap) return;

        // Atajos de la portada: no duplican logica de filtrado, mueven el estado
        // que ya existe y bajan a la rejilla. Si manana cambia un filtro, esto
        // sigue sirviendo porque hace click en la misma pastilla que el humano.
        var atajos = document.querySelectorAll('[data-salto]');
        for (var a=0;a<atajos.length;a++){
          atajos[a].addEventListener('click', function(){
            var v = this.getAttribute('data-salto') || '';
            var destino = document.querySelector('.grid');
            if (v === 'abierto') {
              if (chk) { chk.checked = true; state.open = true; apply(); }
            } else if (v === 'filtros') {
              destino = typeWrap.closest('.triage') || typeWrap;
            } else if (v.indexOf('tipo:') === 0) {
              var bt = typeWrap.querySelector('[data-type-filter="' + v.slice(5) + '"]');
              if (bt) bt.click(); else destino = typeWrap;
            } else if (v.indexOf('zona:') === 0) {
              var bz = zoneWrap.querySelector('[data-zone-filter="' + v.slice(5) + '"]');
              if (bz) bz.click(); else destino = zoneWrap;
            }
            if (destino) destino.scrollIntoView({ behavior:'smooth', block:'start' });
          });
        }
        function apply(){
          var cards = document.querySelectorAll('.grid [data-type]');
          var shown = 0;
          for (var i=0;i<cards.length;i++){
            var c = cards[i], ok = true;
            if (state.type === 'ft') { if (c.getAttribute('data-ft') !== '1') ok = false; }
            else if (state.type !== 'all' && c.getAttribute('data-type') !== state.type) ok = false;
            if (ok && state.zone !== 'all' && c.getAttribute('data-zone') !== state.zone) ok = false;
            if (ok && state.open) { var st = c.querySelector('.open-status'); if (!(st && st.textContent.indexOf('🟢') === 0)) ok = false; }
            c.style.display = ok ? '' : 'none';
            if (ok) shown++;
          }
          if (countEl) countEl.textContent = shown + (shown === 1 ? ' sitio' : ' sitios') + ' con este filtro';
        }
        function bind(wrap, attr, key){
          var btns = wrap.querySelectorAll('['+attr+']');
          for (var k=0;k<btns.length;k++){
            btns[k].addEventListener('click', function(e){
              e.preventDefault();
              state[key] = this.getAttribute(attr);
              var ps = wrap.querySelectorAll('.sb-pill');
              for (var j=0;j<ps.length;j++){ ps[j].classList.toggle('active', ps[j]===this); }
              apply();
              var g=document.querySelector('.grid'); if(g) g.scrollIntoView({behavior:'smooth',block:'start'});
              try { gtag('event','restaurantes_filter',{ type: state.type, zone: state.zone, open: state.open }); } catch(err) {}
            });
          }
        }
        bind(typeWrap, 'data-type-filter', 'type');
        bind(zoneWrap, 'data-zone-filter', 'zone');
        if (chk) chk.addEventListener('change', function(){ state.open = chk.checked; apply(); });
        // Autónomo: los abiertos AHORA flotan arriba (preserva el orden curado dentro de cada grupo).
        // Corre tras el 'load' para que los badges de horario ya estén recomputados en hora de PR.
        function openFirst(){
          var grid = document.querySelector('.grid'); if(!grid) return;
          var cards = Array.prototype.slice.call(grid.querySelectorAll('[data-type]'));
          var open = [], rest = [];
          cards.forEach(function(c){ var st = c.querySelector('.open-status'); if (st && st.textContent.indexOf('🟢') === 0) open.push(c); else rest.push(c); });
          if (!open.length) return;
          open.concat(rest).forEach(function(c){ grid.appendChild(c); });
          var n = document.getElementById('open-count'); if (n) n.textContent = open.length + (open.length === 1 ? ' abierto ahora mismo' : ' abiertos ahora mismo') + ' · arriba';
          var hn = document.getElementById('hero-abiertos'); if (hn) hn.textContent = String(open.length);
          var an = document.getElementById('atajo-n'); if (an) an.textContent = String(open.length);
        }
        if (document.readyState === 'complete') openFirst(); else window.addEventListener('load', openFirst);
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    })();
    </script>` : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-6KBMV0LKQ4"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-6KBMV0LKQ4');
  </script>
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${pageUrl}">
  ${linkAlternoMd(pageUrl)}
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:site_name" content="MapaDeCaboRojo.com">
  <meta property="og:locale" content="es_PR">
  ${ogImage ? `<meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(displayName)} en MapaDeCaboRojo.com">` : ''}
  <meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  ${ogImage ? `<meta name="twitter:image" content="${ogImage}">` : ''}
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  ${ldScript(coleccionJsonLd)}
  ${faqSchema ? `<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>` : ''}
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="anonymous">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;0,9..144,800;0,9..144,900;1,9..144,500&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    /* ─────────────────────────────────────────────────────────────
       Sistema de diseño de Cabo Rojo (DESIGN.md). Esta página corría
       con #0d9488 y grises fríos — o sea con la lista de anti-patrones
       del propio sistema: fondo blanco puro, gris frío, todo centrado,
       emoji en el H1. Los colores tienen nombre porque significan algo.
       ───────────────────────────────────────────────────────────── */
    :root {
      --oceano:#1B4B5A; --oceano-claro:#2A6B80; --salinas:#D4603A; --salinas-hondo:#B04A28;
      --lino:#FAF8F5; --papel:#FFFFFF; --tinta:#2C2418; --piedra:#8A7E6F; --piedra-honda:#6B6052;
      --arena:#E8E2D9; --arena-suave:#F0EBE4;
      --mangle:#3D7A4A; --mango:#C4841D; --bandera:#B83B2E;
      --sombra-sm:0 1px 3px rgba(44,36,24,.06), 0 1px 2px rgba(44,36,24,.04);
      --sombra-md:0 4px 12px rgba(44,36,24,.08), 0 2px 4px rgba(44,36,24,.04);
      --sombra-lg:0 12px 32px rgba(44,36,24,.12), 0 4px 8px rgba(44,36,24,.05);
      --mono:'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family:"Source Sans 3", -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:var(--lino); color:var(--tinta); -webkit-font-smoothing:antialiased; }
    h1, h2, h3, .font-display { font-family:'Fraunces', Georgia, serif; letter-spacing:-0.02em; }
    a { color:var(--oceano); }
    .container { max-width:1120px; margin:0 auto; padding:0 24px; }

    /* ── Kicker: la etiqueta mono en versalitas que ordena cada sección ── */
    .kicker { font-family:var(--mono); font-size:11px; font-weight:500; text-transform:uppercase; letter-spacing:.14em; color:var(--salinas); }

    /* ── Portada editorial ───────────────────────────────────────────
       Antes: banda teal en degradado, centrada, con el conteo debajo
       del título. Un conteo no es una respuesta. Ahora la portada ES
       el tablero: lo que está abierto AHORA manda sobre el total.     */
    .portada { background:var(--oceano); color:var(--lino); padding:56px 0 0; position:relative; overflow:hidden; }
    .portada::after { content:''; position:absolute; right:-120px; top:-120px; width:420px; height:420px; border-radius:50%; background:radial-gradient(circle, rgba(212,96,58,.28), transparent 68%); pointer-events:none; }
    .portada .kicker { color:#E8A98E; }
    .portada h1 { font-size:clamp(2.4rem, 7vw, 4.2rem); font-weight:800; line-height:1.02; margin:10px 0 14px; color:#FFFFFF; max-width:16ch; position:relative; z-index:1; }
    .portada-sub { font-size:1.05rem; line-height:1.6; color:rgba(250,248,245,.78); max-width:52ch; margin-bottom:30px; position:relative; z-index:1; }

    /* ── Tablero de cifras: Fraunces grande + etiqueta mono ── */
    .cifras { display:flex; flex-wrap:wrap; gap:0; border-top:1px solid rgba(232,226,217,.2); position:relative; z-index:1; }
    .cifra { flex:1 1 0; min-width:132px; padding:20px 22px 24px; border-right:1px solid rgba(232,226,217,.16); }
    .cifra:last-child { border-right:none; }
    .cifra-n { font-family:'Fraunces', Georgia, serif; font-size:2.6rem; font-weight:800; line-height:1; font-variant-numeric:tabular-nums; display:block; }
    .cifra-abierto .cifra-n { color:#7FD4A8; }
    .cifra-l { font-family:var(--mono); font-size:10.5px; text-transform:uppercase; letter-spacing:.12em; color:rgba(250,248,245,.62); margin-top:8px; display:block; line-height:1.45; }

    /* ── Atajos de decisión: la primera fila que ve la persona ──
       La pregunta no es "¿qué categorías existen?" sino "¿qué hago ahora?".
       Estos 5 botones bajan a los filtros que ya existen y los aplican. */
    .atajos { padding:22px 0 26px; position:relative; z-index:1; }
    .atajos-lbl { display:block; font-family:var(--mono); font-size:10px; text-transform:uppercase; letter-spacing:.14em; color:rgba(250,248,245,.55); margin-bottom:10px; }
    .atajos-fila { display:flex; flex-wrap:wrap; gap:8px; }
    .atajo { font-family:"Source Sans 3", sans-serif; font-size:.92rem; font-weight:600; color:var(--lino); background:rgba(250,248,245,.09); border:1px solid rgba(250,248,245,.26); padding:9px 17px; border-radius:999px; cursor:pointer; transition:all .15s; }
    .atajo:hover { background:rgba(250,248,245,.18); border-color:rgba(250,248,245,.5); }
    .atajo-vivo { background:#7FD4A8; border-color:#7FD4A8; color:#123B29; }
    .atajo-vivo:hover { background:#96E0BA; border-color:#96E0BA; }

    /* ── Mapa ── */
    #cat-map { width:100%; height:52vw; max-height:400px; min-height:240px; background:var(--arena); }
    .map-section-label { font-family:var(--mono); font-size:10.5px; text-transform:uppercase; letter-spacing:.12em; text-align:center; color:var(--piedra-honda); padding:10px 0; background:var(--arena-suave); border-bottom:1px solid var(--arena); }

    .bloque { padding:40px 0 0; }
    .back { display:inline-block; margin-bottom:24px; color:var(--salinas); text-decoration:none; font-weight:600; font-size:.9rem; }
    .back:hover { text-decoration:underline; }

    /* ── Rejilla de fichas ── */
    .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(268px, 1fr)); gap:24px; margin:0 0 48px; }
    .ficha { position:relative; background:var(--papel); border:1px solid var(--arena); border-radius:12px; overflow:hidden; box-shadow:var(--sombra-sm); transition:transform .2s ease-out, box-shadow .2s ease-out, border-color .2s ease-out; }
    .ficha:hover { transform:translateY(-2px); box-shadow:var(--sombra-md); border-color:#D9D0C3; }
    .ficha-foto { width:100%; height:172px; background:var(--oceano); display:flex; align-items:center; justify-content:center; font-size:2.5rem; overflow:hidden; }
    .ficha-foto-vacia { position:relative; flex-direction:column; background:var(--oceano); background-image:radial-gradient(circle at 78% 18%, rgba(212,96,58,.34), transparent 62%); }
    .marca-inicial { font-family:'Fraunces', Georgia, serif; font-size:4.6rem; font-weight:900; line-height:1; color:rgba(250,248,245,.16); letter-spacing:-.04em; }
    .marca-zona { position:absolute; bottom:14px; left:0; right:0; text-align:center; font-family:var(--mono); font-size:10px; text-transform:uppercase; letter-spacing:.16em; color:rgba(250,248,245,.5); }
    .ficha-foto img { position:absolute; inset:0; width:100%; height:172px; object-fit:cover; display:block; z-index:1; }
    .ficha-cuerpo { padding:18px 20px 16px; }
    .ficha-zona { font-family:var(--mono); font-size:10px; text-transform:uppercase; letter-spacing:.13em; color:var(--salinas); display:block; margin-bottom:6px; }
    .ficha h2 { font-size:1.18rem; font-weight:700; line-height:1.22; color:var(--tinta); margin:0 0 8px; }
    .ficha-datos { display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-family:var(--mono); font-size:12px; font-variant-numeric:tabular-nums; color:var(--piedra-honda); margin-bottom:8px; }
    .nota { color:var(--mango); font-weight:600; }
    .nota span { color:var(--piedra); font-weight:400; }
    .estado { display:inline-flex; align-items:center; font-family:var(--mono); font-size:11px; font-weight:600; letter-spacing:.03em; padding:3px 9px; border-radius:999px; }
    .estado-abierto { background:#E8F3EB; color:#2F6B3C; }
    .estado-cerrado { background:#F5EFEA; color:var(--piedra-honda); }
    .estado-nosabe { background:transparent; color:var(--piedra); border:1px dashed var(--arena); }
    .ficha-dir { font-size:.86rem; color:var(--piedra-honda); line-height:1.5; margin-bottom:8px; }
    .ficha-contacto { display:flex; gap:8px; padding:0 20px 18px; }
    .ficha-contacto a { flex:1; text-align:center; padding:9px 6px; border-radius:8px; font-size:.82rem; font-weight:600; text-decoration:none; font-family:var(--mono); letter-spacing:.02em; }
    .btn-tel { background:var(--oceano); color:#fff; }
    .btn-wa { background:var(--papel); color:var(--oceano); border:1.5px solid var(--arena); }
    .btn-wa:hover { border-color:var(--oceano); }

    /* ── Filtros ── */
    .panel-filtros { background:var(--papel); border:1px solid var(--arena); border-radius:12px; padding:24px; margin-bottom:32px; box-shadow:var(--sombra-sm); }
    .sb-pill { font-family:"Source Sans 3", sans-serif; }

    .cta-bar { background:var(--oceano); color:#fff; text-align:center; padding:32px 24px; border-radius:12px; margin-bottom:40px; }
    .cta-bar p { margin-bottom:14px; font-size:1rem; color:rgba(250,248,245,.82); }
    .cta-bar a { display:inline-block; background:var(--salinas); color:#fff; text-decoration:none; padding:13px 28px; border-radius:8px; font-weight:700; }
    .cta-bar a:hover { background:var(--salinas-hondo); }
    footer { text-align:center; padding:40px 24px 56px; color:var(--piedra); font-size:.85rem; border-top:1px solid var(--arena); margin-top:24px; }

    .leaflet-popup-content-wrapper { border-radius:10px; }
    .leaflet-popup-content { margin:12px 16px; font-family:"Source Sans 3", sans-serif; font-size:13px; line-height:1.45; }
    .leaflet-popup-content a { color:var(--oceano); text-decoration:none; font-weight:700; }
    .leaflet-popup-content a:hover { text-decoration:underline; }

    @media (max-width:640px) {
      .container { padding:0 18px; }
      .portada { padding-top:38px; }
      .cifra { flex:1 1 50%; min-width:0; padding:16px 18px 18px; }
      .cifra:nth-child(2n) { border-right:none; }
      .cifra-n { font-size:2.1rem; }
      .grid { grid-template-columns:1fr; gap:18px; }
    }
  </style>
</head>
<body>
  <header class="portada">
    <div class="container">
      <span class="kicker">${emoji}&nbsp; ${_verif.length} de ${filtered.length} confirmados por una persona &middot; Cabo Rojo, Puerto Rico</span>
      <h1>${tituloPortada}</h1>
      <p class="portada-sub">${esc(subtituloPortada)}</p>
      <div class="cifras">
        <div class="cifra cifra-abierto">
          <span class="cifra-n" id="hero-abiertos">${_abiertosAhora}</span>
          <span class="cifra-l">abierto${_abiertosAhora === 1 ? '' : 's'} ahora<br>son las ${_horaPR} en PR</span>
        </div>
        <div class="cifra">
          <span class="cifra-n">${filtered.length}</span>
          <span class="cifra-l">en el directorio<br>con teléfono y dirección</span>
        </div>
        <div class="cifra">
          <span class="cifra-n">${_verif.length}</span>
          <span class="cifra-l">confirmado${_verif.length === 1 ? '' : 's'} por<br>una persona, no por un registro</span>
        </div>
        ${_mejorPuntuado ? `<div class="cifra">
          <span class="cifra-n">${Number(_mejorPuntuado.google_rating)}</span>
          <span class="cifra-l">mejor puntuado<br>${esc(recorta(String(_mejorPuntuado.name), 26))}</span>
        </div>` : ''}
      </div>
      ${isRestaurant ? `<div class="atajos">
        <span class="atajos-lbl">Empieza por aquí</span>
        <div class="atajos-fila">
          <button type="button" class="atajo atajo-vivo" data-salto="abierto">Abiertos ahora (<span id="atajo-n">${_abiertosAhora}</span>)</button>
          <button type="button" class="atajo" data-salto="tipo:mariscos">Mariscos</button>
          <button type="button" class="atajo" data-salto="tipo:cafe">Desayuno y café</button>
          <button type="button" class="atajo" data-salto="zona:joyuda">Frente al mar · Joyuda</button>
          <button type="button" class="atajo" data-salto="filtros">Por zona</button>
        </div>
      </div>` : ''}
    </div>
  </header>

  <!-- Leaflet map embedded at top of category page -->
  <div id="cat-map" aria-label="Mapa de ${esc(displayName)} en Cabo Rojo"></div>
  <p class="map-section-label">${mapPlaces.length} ubicaciones en el mapa</p>

  <div class="container bloque">
    ${bloqueRespuesta({
      nombrePlural: pluralEs(cat, displayName),
      total: filtered.length,
      verificados: _verif.length,
      frescos90: _frescos.length,
      mejor: _mejor,
      mejorRating: _mejorPuntuado ? Number(_mejorPuntuado.google_rating) : null,
      mejorResenas: _mejorPuntuado ? (Number(_mejorPuntuado.google_review_count) || null) : null,
    })}
    ${urgentBanner}
    ${catSeo?.intro ? `<p style="font-size:1.05rem;line-height:1.6;color:#475569;margin-bottom:1.5rem;max-width:720px">${esc(catSeo.intro)}</p>` : ''}
    ${farmaciaHoyHtml}

    ${(cat === 'fisiatra' || cat === 'fisiatras') && filtered.length > 0 ? `
    <!-- #1 Quiz: "¿Cuál fisiatra te conviene?" -->
    <div id="fis-quiz" style="background:linear-gradient(135deg,#ecfeff,#f0fdfa);border:1px solid #67e8f9;border-radius:14px;padding:1.5rem;margin-bottom:1.5rem;max-width:720px;">
      <h2 style="font-size:1.15rem;font-weight:700;color:#0e7490;margin-bottom:0.5rem;">🩺 ¿Cuál fisiatra te conviene?</h2>
      <p style="font-size:0.9rem;color:#475569;margin-bottom:1rem;">3 preguntas. Te recomendamos la mejor opción según tu zona, plan médico y necesidad.</p>
      <div id="fis-quiz-step-1">
        <p style="font-weight:600;color:#0f172a;margin-bottom:0.5rem;font-size:0.95rem;">1. ¿Por qué necesitas fisiatra?</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:1rem;">
          <button data-need="postop" class="fis-q-btn">🩹 Post-cirugía / lesión</button>
          <button data-need="sport" class="fis-q-btn">🏃 Lesión deportiva</button>
          <button data-need="chronic" class="fis-q-btn">😣 Dolor crónico</button>
          <button data-need="emg" class="fis-q-btn">⚡ EMG / NCV</button>
          <button data-need="other" class="fis-q-btn">❓ Otra</button>
        </div>
      </div>
      <div id="fis-quiz-step-2" style="display:none;">
        <p style="font-weight:600;color:#0f172a;margin-bottom:0.5rem;font-size:0.95rem;">2. ¿En qué zona te queda mejor?</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:1rem;">
          <button data-zone="cr_pueblo" class="fis-q-btn">📍 Cabo Rojo (pueblo / Santos Ortiz)</button>
          <button data-zone="cr_joyuda" class="fis-q-btn">🌊 Cabo Rojo (Joyuda / Carr 102)</button>
          <button data-zone="san_german" class="fis-q-btn">🏥 San Germán</button>
          <button data-zone="mayaguez" class="fis-q-btn">🌆 Mayagüez</button>
          <button data-zone="any" class="fis-q-btn">🤷 Cualquiera me sirve</button>
        </div>
      </div>
      <div id="fis-quiz-step-3" style="display:none;">
        <p style="font-weight:600;color:#0f172a;margin-bottom:0.5rem;font-size:0.95rem;">3. ¿Tienes preferencia de horario?</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:1rem;">
          <button data-time="weekday_am" class="fis-q-btn">🌅 L-V mañana</button>
          <button data-time="weekday_pm" class="fis-q-btn">🌇 L-V tarde</button>
          <button data-time="any" class="fis-q-btn">⏰ Cualquiera</button>
        </div>
      </div>
      <div id="fis-quiz-result" style="display:none;background:white;border-radius:10px;padding:1.25rem;box-shadow:0 2px 8px rgba(0,0,0,0.06);"></div>
      <div id="fis-quiz-reset" style="display:none;margin-top:0.75rem;text-align:right;">
        <a href="#" id="fis-quiz-restart" style="color:#0e7490;font-size:0.85rem;text-decoration:underline;">↺ Empezar de nuevo</a>
      </div>
    </div>
    <style>
      .fis-q-btn { background:white; border:1.5px solid #67e8f9; color:#0e7490; padding:8px 14px; border-radius:20px; font-size:0.85rem; cursor:pointer; transition:all 0.15s; font-weight:500; }
      .fis-q-btn:hover { background:#0e7490; color:white; border-color:#0e7490; }
    </style>
    <script>
      (function() {
        var state = { need: null, zone: null, time: null };
        // Practices: pre-loaded from server-rendered filtered list (only fisiatras shown)
        var practices = ${JSON.stringify(filtered.map((p: any) => ({
          name: p.name,
          slug: p.slug || p.id,
          municipality: p.municipality || '',
          phone: p.phone || '',
          address: p.address || '',
          lat: p.lat, lon: p.lon,
        })))};

        function esc(s) {
          return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }

        function show(stepId) {
          ['fis-quiz-step-1','fis-quiz-step-2','fis-quiz-step-3','fis-quiz-result'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.style.display = id === stepId ? 'block' : 'none';
          });
        }

        function score() {
          var scored = practices.map(function(p) {
            var s = 50, reasons = [];
            var nameL = (p.name || '').toLowerCase();
            var addrL = (p.address || '').toLowerCase();
            var muniL = (p.municipality || '').toLowerCase();

            if (state.zone === 'cr_pueblo' && (addrL.indexOf('santos ortiz') !== -1 || addrL.indexOf('san jos') !== -1)) { s += 30; reasons.push('queda en Cabo Rojo pueblo, Santos Ortiz'); }
            else if (state.zone === 'cr_joyuda' && (addrL.indexOf('joyuda') !== -1 || addrL.indexOf('102') !== -1)) { s += 30; reasons.push('queda en el corredor Joyuda / Carr 102'); }
            else if (state.zone === 'san_german' && muniL.indexOf('germ') !== -1) { s += 35; reasons.push('queda en San Germán'); }
            else if (state.zone === 'mayaguez' && muniL.indexOf('may') !== -1) { s += 35; reasons.push('queda en Mayagüez'); }
            else if (state.zone === 'any') { s += 5; }
            else if (state.zone && state.zone !== 'any' && muniL.indexOf('cabo rojo') !== -1) { s -= 15; }

            if (state.need === 'emg' && nameL.indexOf('quiñones') !== -1) { s += 25; reasons.push('hacen EMG / NCV in-house'); }
            if (state.need === 'sport' && nameL.indexOf('quiñones') !== -1) { s += 20; reasons.push('sub-especialidad medicina deportiva'); }
            if (state.need === 'postop') { s += 10; reasons.push('manejan post-cirugía'); }
            if (state.need === 'chronic') { s += 10; reasons.push('manejan dolor crónico'); }

            return { p: p, score: s, reasons: reasons };
          });
          scored.sort(function(a,b) { return b.score - a.score; });
          return scored[0];
        }

        function renderResult() {
          var winner = score();
          var p = winner.p;
          var reasons = winner.reasons.length ? winner.reasons.slice(0,2).join(' · ') : 'mejor match disponible para tu búsqueda';
          var fmtPhone = (p.phone || '').replace(/\\D/g, '');
          var telLink = fmtPhone ? '<a href="tel:+1' + esc(fmtPhone) + '" style="display:inline-block;background:#0e7490;color:white;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700;font-size:0.95rem;margin-right:6px;margin-top:6px;">📞 Llamar ' + esc(p.phone || '') + '</a>' : '';
          var waLink = fmtPhone.length >= 10 ? '<a href="https://wa.me/1' + esc(fmtPhone.slice(-10)) + '?text=' + encodeURIComponent('Hola, mapadecaborojo.com me recomendó su práctica — quisiera agendar') + '" target="_blank" rel="noopener" style="display:inline-block;background:#25D366;color:white;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700;font-size:0.95rem;margin-top:6px;">💬 WhatsApp</a>' : '';
          var detail = '<a href="/fisiatra/' + esc(p.slug) + '" style="color:#0e7490;font-size:0.9rem;text-decoration:underline;display:inline-block;margin-top:10px;">Ver perfil completo →</a>';
          // All dynamic strings escaped (name, address, municipality, phone, slug, reasons) — XSS-safe
          document.getElementById('fis-quiz-result').innerHTML =
            '<p style="font-size:0.85rem;color:#64748b;margin-bottom:0.25rem;">Te conviene:</p>' +
            '<h3 style="font-size:1.2rem;font-weight:700;color:#0e7490;margin-bottom:0.5rem;">🩺 ' + esc(p.name) + '</h3>' +
            '<p style="font-size:0.9rem;color:#475569;margin-bottom:1rem;">📍 ' + esc(p.address || p.municipality) + '</p>' +
            '<p style="font-size:0.9rem;color:#0f172a;margin-bottom:1rem;"><strong>Por qué:</strong> ' + esc(reasons) + '.</p>' +
            telLink + waLink + '<br>' + detail;
          show('fis-quiz-result');
          document.getElementById('fis-quiz-reset').style.display = 'block';
          try { gtag('event', 'fisiatra_quiz_complete', { need: state.need, zone: state.zone, time: state.time, recommended: p.slug }); } catch(e) {}
        }

        document.querySelectorAll('#fis-quiz-step-1 .fis-q-btn').forEach(function(b) {
          b.addEventListener('click', function() { state.need = b.dataset.need; show('fis-quiz-step-2'); });
        });
        document.querySelectorAll('#fis-quiz-step-2 .fis-q-btn').forEach(function(b) {
          b.addEventListener('click', function() { state.zone = b.dataset.zone; show('fis-quiz-step-3'); });
        });
        document.querySelectorAll('#fis-quiz-step-3 .fis-q-btn').forEach(function(b) {
          b.addEventListener('click', function() { state.time = b.dataset.time; renderResult(); });
        });
        document.getElementById('fis-quiz-restart').addEventListener('click', function(e) {
          e.preventDefault();
          state = { need: null, zone: null, time: null };
          document.getElementById('fis-quiz-reset').style.display = 'none';
          show('fis-quiz-step-1');
        });
      })();
    </script>
    ` : ''}

    ${captureKey === 'solar' ? `
    <!-- Solar capture: savings calculator + why-now + pre-sign checklist -->
    <div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fcd34d;border-radius:14px;padding:1.5rem;margin-bottom:1.5rem;">
      <h2 style="font-size:1.2rem;font-weight:700;color:#92400e;margin-bottom:0.4rem;">☀️ ¿Te conviene solar? Calcula en 10 segundos</h2>
      <p style="font-size:0.9rem;color:#78350f;margin-bottom:1rem;">Dinos cuánto pagas de luz al mes y te decimos cuánto podrías ahorrar.</p>
      <p style="font-weight:600;color:#1f2937;margin-bottom:0.5rem;font-size:0.92rem;">¿Cuánto pagas de luz al mes?</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:0.5rem;">
        <button class="solar-bill-btn" data-bill="75">$50–100</button>
        <button class="solar-bill-btn" data-bill="125">$100–150</button>
        <button class="solar-bill-btn" data-bill="175">$150–200</button>
        <button class="solar-bill-btn" data-bill="250">$200+</button>
      </div>
      <div id="solar-calc-result" style="display:none;background:white;border-radius:10px;padding:1.1rem;margin-top:0.75rem;box-shadow:0 2px 8px rgba(0,0,0,0.06);"></div>
    </div>
    <style>
      .solar-bill-btn { background:white; border:1.5px solid #f59e0b; color:#92400e; padding:8px 16px; border-radius:20px; font-size:0.9rem; cursor:pointer; font-weight:600; transition:all 0.15s; }
      .solar-bill-btn:hover { background:#f59e0b; color:white; }
    </style>
    <script>
      (function(){
        var WA = 'https://wa.me/17874177711?text=';
        var rec = ${JSON.stringify(filtered[0]?.name || 'POS Depot (Power On Solar)')};
        function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
        document.querySelectorAll('.solar-bill-btn').forEach(function(b){
          b.addEventListener('click', function(){
            var bill = parseInt(b.dataset.bill, 10);
            var newLow = Math.round(bill*0.2), newHigh = Math.round(bill*0.5);
            var saveLow = Math.round(bill*0.5)*12, saveHigh = Math.round(bill*0.8)*12;
            var msg = 'SOLAR — pago como $' + bill + ' al mes de luz, quiero una cotización';
            var res = document.getElementById('solar-calc-result');
            res.innerHTML =
              '<p style="font-size:0.9rem;color:#374151;margin-bottom:0.5rem;">Con un sistema bien diseñado, una factura de ~$'+bill+'/mes podría bajar a <strong>$'+newLow+'–$'+newHigh+'</strong> al mes.</p>'+
              '<p style="font-size:1.05rem;color:#92400e;font-weight:700;margin-bottom:0.5rem;">Ahorro estimado: $'+saveLow+'–$'+saveHigh+' al año</p>'+
              '<p style="font-size:0.72rem;color:#9ca3af;margin-bottom:0.9rem;font-style:italic;">Estimado — depende de tu techo, tu consumo real y el sistema. La cotización exacta es gratis.</p>'+
              '<a href="'+WA+encodeURIComponent(msg)+'" style="display:inline-block;background:#f59e0b;color:white;text-decoration:none;padding:0.6rem 1.2rem;border-radius:8px;font-weight:700;font-size:0.9rem;">Textea tu factura al 787-417-7711 → '+esc(rec)+' te cotiza</a>';
            res.style.display='block';
            try { gtag('event','solar_calc',{ bill: bill }); } catch(e) {}
          });
        });
      })();
    </script>

    <div style="background:white;border-radius:12px;padding:1.4rem 1.5rem;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:1.5rem;border-left:4px solid #f59e0b;">
      <h2 style="font-size:1.1rem;font-weight:700;color:#0f172a;margin-bottom:0.6rem;">¿Por qué ahora?</h2>
      <p style="font-size:0.9rem;color:#475569;line-height:1.6;margin-bottom:0.6rem;">La luz en Puerto Rico solo sube — LUMA pasó de $0.27 a $0.33 el kWh, y va a seguir. Mi mamá pasó de pagar <strong>$90 a $42 al mes</strong> con un programa que casi nadie conoce.</p>
      <p style="font-size:0.9rem;color:#475569;line-height:1.6;margin:0;">Además hay fondos federales (HUD, FEMA) ayudando con la instalación — pero cierran, y mucha gente ni sabe que existen. Por eso vale preguntar ahora, no cuando ya cerraron.</p>
    </div>

    <div style="background:white;border-radius:12px;padding:1.4rem 1.5rem;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:1.5rem;">
      <h2 style="font-size:1.1rem;font-weight:700;color:#0f172a;margin-bottom:0.3rem;">Antes de firmar, pregunta esto</h2>
      <p style="font-size:0.8rem;color:#64748b;margin-bottom:0.9rem;">Pa' que no te cojan de bobo. Un buen instalador contesta las 6 sin rodeos.</p>
      <ul style="list-style:none;padding:0;margin:0;">
        ${[
          '¿Cuánto de mi consumo real cubre el sistema — no el promedio del pueblo, el mío?',
          '¿Incluye baterías o solo placas? ¿Qué pasa cuando se va la luz?',
          '¿La garantía cubre placas, inversor Y mano de obra? ¿Por cuántos años?',
          '¿Están certificados? ¿Cuántas instalaciones llevan en la zona?',
          '¿El financiamiento es préstamo, lease o PPA? ¿A nombre de quién queda el sistema?',
          '¿Qué pasa con el sistema si vendo la casa?',
        ].map(q => `<li style="padding:0.5rem 0;border-bottom:1px solid #f1f5f9;font-size:0.9rem;color:#334155;line-height:1.45;"><span style="color:#f59e0b;font-weight:700;margin-right:0.4rem;">✓</span>${q}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    <a class="back" href="${baseUrl}">← Volver al mapa</a>

    ${isSaludUmbrella ? saludTriageHtml : isRestaurant ? restaurantHtml : `<div class="cta-bar">
      <p>¿Buscas algo específico? Pregúntale a El Veci.</p>
      <a href="https://wa.me/17874177711?text=${encodeURIComponent(displayName)}">Textea al 787-417-7711</a>
    </div>`}

    <div class="grid"${detailRoute && !isSaludUmbrella ? ' data-open-first="1"' : ''}>
      ${cardsHtml}
    </div>

    ${faqItems.length > 0 ? `
    <div style="background:white;border-radius:12px;padding:1.5rem;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:2rem;">
      <h2 style="font-size:1.15rem;font-weight:700;color:#0f172a;margin-bottom:1rem;">Preguntas frecuentes</h2>
      ${faqItems.map(f => `
        <div style="margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid #f1f5f9;">
          <h3 style="font-size:0.95rem;font-weight:600;color:#1e293b;margin-bottom:0.35rem;">${esc(f.q)}</h3>
          <p style="font-size:0.875rem;color:#475569;margin:0;">${esc(f.a)}</p>
        </div>`).join('')}
    </div>` : ''}

    ${demandRows.length > 0 ? (() => {
      const totalUsers = demandRows.reduce((s, r) => s + r.users, 0);
      const totalFailed = demandRows.reduce((s, r) => s + r.failed, 0);
      const subtitle = `Últimos 90 días en El Veci (*7711) · ${totalUsers} ${totalUsers === 1 ? 'persona' : 'personas'}${totalFailed > 0 ? ` · ${totalFailed} sin resultado` : ''}`;
      const items = demandRows.map(r => {
        const failBadge = r.failed > 0 ? '<span style="font-size:0.7rem;color:#dc2626;background:#fee2e2;padding:0.1rem 0.45rem;border-radius:999px;margin-left:0.5rem;font-weight:600;">sin resultado</span>' : '';
        return `<li style="padding:0.55rem 0;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:0.5rem;font-size:0.9rem;color:#334155;">
          <strong style="color:#0d9488;min-width:2.5rem;font-variant-numeric:tabular-nums;">${r.users}×</strong>
          <span>"${esc(r.query_normalized)}"</span>
          ${failBadge}
        </li>`;
      }).join('');
      return `
    <div style="background:white;border-radius:12px;padding:1.5rem;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:2rem;border-left:4px solid #0d9488;">
      <h2 style="font-size:1.1rem;font-weight:700;color:#0f172a;margin-bottom:0.35rem;">📊 Lo que vecinos están buscando</h2>
      <p style="font-size:0.8rem;color:#64748b;margin-bottom:1rem;">${esc(subtitle)}</p>
      <ul style="list-style:none;padding:0;margin:0;">${items}</ul>
    </div>`;
    })() : ''}

    <div style="background:linear-gradient(135deg,#0d9488 0%,#f97316 100%);border-radius:12px;padding:1.75rem 1.5rem;text-align:center;margin-bottom:2rem;">
      <h2 style="color:white;font-size:1.2rem;font-weight:700;margin-bottom:0.5rem;">${isRestaurant ? '¿Tu restaurante debería estar en La Selección?' : `¿Tienes ${detailRoute && HEALTH_CTA_NOUN[cat] ? `${HEALTH_CTA_NOUN[cat].article} ${HEALTH_CTA_NOUN[cat].noun}` : 'un negocio'} en Cabo Rojo?`}</h2>
      <p style="color:rgba(255,255,255,0.9);font-size:0.9rem;margin-bottom:1rem;">${(() => {
        const totalUsers = demandRows.reduce((s, r) => s + r.users, 0);
        const totalFailed = demandRows.reduce((s, r) => s + r.failed, 0);
        // Sin precios en páginas públicas (capa discovery, 27 ago): el negocio trae su idea y se habla 1 a 1.
        if (isRestaurant) return `<strong>La Selección se gana. La Vitrina se compra. El ranking no se vende.</strong> El orden sale de la nota de Google pesada por cuántas reseñas la sostienen, para que un 5 de 3 reseñas no le gane a un 4.9 de 200. Los marcados «Destacado» los subimos a mano por criterio editorial y no pagaron por ese puesto. Lo que sí se paga es la ficha: foto, horario y datos al día, donde la gente decide dónde comer. Si te interesa, tráeme tu idea y lo cuadramos.`;
        if (totalFailed >= 2) return `${totalFailed} vecinos buscaron y NO encontraron resultado este trimestre. Si ese negocio es el tuyo, tráeme tu idea: te digo cómo aparecer primero, con tus servicios y fotos a la vista.`;
        if (totalUsers >= 3) return `${totalUsers} vecinos buscaron ${pluralEs(cat, displayName)} en El Veci este trimestre. Si quieres que te encuentren primero, tráeme tu idea y lo cuadramos.`;
        return `Si quieres aparecer primero, con servicios, fotos y reseñas a la vista, tráeme tu idea y lo cuadramos.`;
      })()}</p>
      <a href="https://wa.me/17874177711?text=${encodeURIComponent('VITRINA ' + displayName)}" style="display:inline-block;background:white;color:#0d9488;text-decoration:none;padding:0.65rem 1.5rem;border-radius:8px;font-weight:700;font-size:0.95rem;">Textea VITRINA al 787-417-7711</a>
    </div>

    <footer style="margin-top: 48px; padding: 24px 0; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
        Hecho con orgullo en Cabo Rojo, Puerto Rico
      </p>
      <p style="color: #94a3b8; font-size: 11px; margin: 4px 0 0 0;">
        <a href="https://www.mapadecaborojo.com" style="color: #0d9488; text-decoration: none;">MapaDeCaboRojo.com</a>
        · Un proyecto de <a href="https://angelanderson.com" style="color: #0d9488; text-decoration: none;">Angel Anderson</a>
      </p>
    </footer>
  </div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin="anonymous"></script>
  <script>
    (function() {
      var places = ${JSON.stringify(
        mapPlaces
          .map((p: any) => ({
            lat: p.lat,
            lon: p.lon,
            name: p.name,
            slug: p.slug || p.id,
            rating: p.google_rating || null,
            phone: (() => {
              const ph = p.phone ? p.phone.replace(/\D/g, '').slice(-10) : null;
              return ph && ph.length === 10 ? ph : null;
            })(),
            emoji: isRestaurant ? (typeMap.get(p.id) || { emoji: '🍽️' }).emoji : emoji,
            detailPath: (HEALTH_DETAIL_ROUTES[cat] || null)
              ? `/${HEALTH_DETAIL_ROUTES[cat]}/${p.slug || p.id}`
              : `/negocio/${p.slug || p.id}`,
          }))
      )};

      if (!places.length) return; // no coords → skip map init

      function escHtml(s) {
        return String(s == null ? '' : s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      var map = L.map('cat-map', { scrollWheelZoom: false, tap: false });

      // OpenStreetMap tiles — free, no key needed
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map);

      var markers = [];
      var teal = '#0d9488';

      places.forEach(function(p) {
        var popupParts = [
          '<strong>' + escHtml(p.name) + '</strong>',
          p.rating ? '⭐ ' + escHtml(p.rating) : '',
          p.phone
            ? '<a href="tel:+1' + p.phone + '">📞 ' + p.phone.slice(0,3) + '-' + p.phone.slice(3,6) + '-' + p.phone.slice(6) + '</a>'
            : '',
          '<a href="' + escHtml(p.detailPath) + '">Ver perfil →</a>',
        ].filter(Boolean).join('<br>');

        // Marcador tipo "pin": círculo blanco con el emoji del tipo (más legible que el pin genérico)
        var glyph = p.emoji || '📍';
        var icon = L.divIcon({
          className: '',
          html: '<div style="width:34px;height:34px;background:white;border:2.5px solid ' + teal + ';border-radius:50% 50% 50% 4px;transform:rotate(45deg);box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(-45deg);font-size:16px;line-height:1;">' + glyph + '</span></div>',
          iconSize: [34, 34],
          iconAnchor: [17, 32],
          popupAnchor: [0, -30],
        });

        var marker = L.marker([p.lat, p.lon], { icon: icon })
          .bindPopup(popupParts, { maxWidth: 200 });
        marker.addTo(map);
        markers.push(marker);
      });

      // Fit map to show all markers, with padding; fallback to CR center
      if (markers.length === 1) {
        map.setView([places[0].lat, places[0].lon], 15);
      } else {
        var group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.15));
        // Cap zoom so we don't zoom out to entire PR
        if (map.getZoom() > 16) map.setZoom(16);
        if (map.getZoom() < 11) map.setView([17.9620, -67.1650], 12);
      }
    })();
  </script>
  ${correctButtonHtml({ pageType: 'categoria' })}
  ${pieMd(pageUrl)}
  <!-- Open/closed badges recompute client-side in PR time so cached HTML never lies -->
  <script>
  (function () {
    function prParts() {
      var p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Puerto_Rico', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
      var o = {}; p.forEach(function (x) { o[x.type] = x.value; });
      var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      var hh = (o.hour === '24' ? '00' : o.hour);
      return { day: days[o.weekday], time: ('0' + hh).slice(-2) + ':' + o.minute };
    }
    function t12(hhmm) {
      var a = String(hhmm).split(':'), h = parseInt(a[0], 10), m = parseInt(a[1], 10);
      if (isNaN(h)) return hhmm;
      var pd = h >= 12 ? 'pm' : 'am', h12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
      return m === 0 ? h12 + pd : h12 + ':' + ('0' + m).slice(-2) + pd;
    }
    function label(oh) {
      if (!oh) return null;
      if (oh.type === 'always_open' || oh.type === '24_7') return '🟢 Abierto 24h';
      if (!oh.structured || !oh.structured.length) return null;
      var n = prParts(), byDay = {};
      oh.structured.forEach(function (e) { byDay[e.day] = e; });
      var today = byDay[n.day];
      if (today && !today.isClosed && today.open && today.close) {
        if (n.time >= today.open && n.time <= today.close) return '🟢 Abierto';
        if (n.time < today.open) return '🔴 Cerrado · abre ' + t12(today.open);
      }
      var dn = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
      for (var i = 1; i <= 7; i++) {
        var d = (n.day + i) % 7, e = byDay[d];
        if (e && !e.isClosed && e.open) { return '🔴 Cerrado · abre ' + (i === 1 ? 'mañana' : dn[d]) + ' ' + t12(e.open); }
      }
      return '🔴 Cerrado';
    }
    try {
      document.querySelectorAll('.open-status').forEach(function (el) {
        var oh; try { oh = JSON.parse(el.getAttribute('data-oh')); } catch (e) { return; }
        var lbl = label(oh); if (!lbl) return;
        el.textContent = lbl;
        var abierto = lbl.indexOf('🟢') === 0;
        el.classList.remove('estado-abierto', 'estado-cerrado');
        el.classList.add('estado', abierto ? 'estado-abierto' : 'estado-cerrado');
        el.style.color = '';
      });
      // Salud (farmacia, dentista, etc.): las abiertas AHORA suben, y el bloque de arriba las nombra.
      var grid = document.querySelector('.grid[data-open-first]');
      if (grid) {
        var cards = Array.prototype.slice.call(grid.children), open = [], rest = [];
        cards.forEach(function (c) { var st = c.querySelector('.open-status'); if (st && st.textContent.indexOf('🟢') === 0) open.push(c); else rest.push(c); });
        if (open.length) open.concat(rest).forEach(function (c) { grid.appendChild(c); });
        var now = document.getElementById('farm-open-now');
        if (now) {
          if (!open.length) { now.textContent = 'ninguna a esta hora, según su horario publicado'; }
          else {
            now.innerHTML = open.map(function (c) { var h = c.querySelector('h2'); var a = c.querySelector('a[href]'); var n = h ? h.textContent.replace(/VIP$/, '').trim() : ''; return a ? '<a href="' + a.getAttribute('href') + '" style="color:#0f766e;text-decoration:none;font-weight:600;">' + n.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</a>' : n; }).join(' · ');
          }
        }
      }
    } catch (e) {}
  })();
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  logApiCall('categoria', null, cat, req.headers['user-agent'] as string, req.headers['x-forwarded-for'] as string, filtered.length, req.headers['referer'] as string);
  return res.status(200).send(html);
}
