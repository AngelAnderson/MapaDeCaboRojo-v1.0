import { createClient } from '@supabase/supabase-js';
import { correctButtonHtml } from './_lib/correct-button.js';

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
  if (opening_hours.type === 'always_open') return '🟢 Abierto 24h';
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
    .select('id,name,slug,category,subcategory,image_url,phone,address,municipality,google_rating,google_review_count,status,plan,sponsor_weight,tags,services,opening_hours,lat,lon,npi,one_liner,is_emergency_resource')
    .eq('status', 'open');
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

  // Map pins: physically-in-CR businesses only. Service-area businesses (tagged
  // sirve-cabo-rojo but located elsewhere, e.g. Manatí) are listed but NOT pinned,
  // so the map doesn't zoom out across the island to show a far-away HQ.
  const mapPlaces = filtered.filter((p: any) => p.lat && p.lon && (p.address || '').toLowerCase().includes('cabo rojo'));

  // Category-specific SEO content
  const CATEGORY_SEO: Record<string, { title?: string; description: string; intro: string }> = {
    salud: {
      title: 'Salud en Cabo Rojo — Médicos, Farmacias, Dentistas y más',
      description: `Directorio de salud en Cabo Rojo, PR: ${filtered.length} médicos, farmacias, dentistas, laboratorios y especialistas — con teléfono, horario y verificación en el registro federal de salud (NPPES).`,
      intro: `Todo lo de salud en Cabo Rojo en un solo sitio: médicos, farmacias, dentistas, laboratorios, ópticas, salud mental y especialistas. Filtra por lo que necesitas, mira quién está abierto, y si no sabes a quién ir, dile tu síntoma a El Veci.`,
    },
    cardiologo: {
      title: 'Cardiólogos en Cabo Rojo y el Oeste de PR — Verificados, con teléfono',
      description: `Cardiólogos en Cabo Rojo, Mayagüez, San Germán, Aguadilla y todo el oeste de Puerto Rico — ${filtered.length} verificados en el registro federal NPPES, con nombre, pueblo y teléfono. PR tiene 339 cardiólogos y más de la mitad están en San Juan; aquí están los del oeste.`,
      intro: `El corazón no espera, y en el oeste hay pocos cardiólogos — por eso casi todos hay que buscarlos por teléfono. Aquí tienes ${filtered.length} cardiólogos del oeste (Cabo Rojo, Mayagüez, San Germán, Aguadilla, Añasco y más), verificados uno por uno, con su teléfono. Llama antes de ir para confirmar tu plan médico. ¿Buscas en otro pueblo? Escríbele CARDIOLOGO a El Veci al 787-417-7711.`,
    },
    cardiologos: {
      title: 'Cardiólogos en Cabo Rojo y el Oeste de PR — Verificados, con teléfono',
      description: `Cardiólogos en Cabo Rojo, Mayagüez, San Germán, Aguadilla y todo el oeste de Puerto Rico — ${filtered.length} verificados en el registro federal NPPES, con nombre, pueblo y teléfono. PR tiene 339 cardiólogos y más de la mitad están en San Juan; aquí están los del oeste.`,
      intro: `El corazón no espera, y en el oeste hay pocos cardiólogos — por eso casi todos hay que buscarlos por teléfono. Aquí tienes ${filtered.length} cardiólogos del oeste (Cabo Rojo, Mayagüez, San Germán, Aguadilla, Añasco y más), verificados uno por uno, con su teléfono. Llama antes de ir para confirmar tu plan médico. ¿Buscas en otro pueblo? Escríbele CARDIOLOGO a El Veci al 787-417-7711.`,
    },
    cardiologia: {
      title: 'Cardiólogos en Cabo Rojo y el Oeste de PR — Verificados, con teléfono',
      description: `Cardiólogos en Cabo Rojo, Mayagüez, San Germán, Aguadilla y todo el oeste de Puerto Rico — ${filtered.length} verificados en el registro federal NPPES, con nombre, pueblo y teléfono. PR tiene 339 cardiólogos y más de la mitad están en San Juan; aquí están los del oeste.`,
      intro: `El corazón no espera, y en el oeste hay pocos cardiólogos — por eso casi todos hay que buscarlos por teléfono. Aquí tienes ${filtered.length} cardiólogos del oeste (Cabo Rojo, Mayagüez, San Germán, Aguadilla, Añasco y más), verificados uno por uno, con su teléfono. Llama antes de ir para confirmar tu plan médico. ¿Buscas en otro pueblo? Escríbele CARDIOLOGO a El Veci al 787-417-7711.`,
    },
    'cardiología': {
      title: 'Cardiólogos en Cabo Rojo y el Oeste de PR — Verificados, con teléfono',
      description: `Cardiólogos en Cabo Rojo, Mayagüez, San Germán, Aguadilla y todo el oeste de Puerto Rico — ${filtered.length} verificados en el registro federal NPPES, con nombre, pueblo y teléfono. PR tiene 339 cardiólogos y más de la mitad están en San Juan; aquí están los del oeste.`,
      intro: `El corazón no espera, y en el oeste hay pocos cardiólogos — por eso casi todos hay que buscarlos por teléfono. Aquí tienes ${filtered.length} cardiólogos del oeste (Cabo Rojo, Mayagüez, San Germán, Aguadilla, Añasco y más), verificados uno por uno, con su teléfono. Llama antes de ir para confirmar tu plan médico. ¿Buscas en otro pueblo? Escríbele CARDIOLOGO a El Veci al 787-417-7711.`,
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
      intro: `Con el calor de Cabo Rojo, un helado no se discute. Aquí tienes ${filtered.length} heladerías y sitios de mantecado verificados, con su pueblo, horario y rating real, pa' que no llegues y esté cerrado. ¿Buscas algo cerca ahora mismo? Escríbele HELADOS a El Veci al 787-417-7711.`,
    },
    panaderia: {
      title: 'Panaderías y Reposterías en Cabo Rojo',
      description: `${filtered.length} panaderías y reposterías en Cabo Rojo, PR. Pan caliente, bizcochos y repostería por encargo, con teléfono y horario.`,
      intro: `El pan de la mañana y el bizcocho del cumpleaños salen de aquí. ${filtered.length} panaderías y reposterías de Cabo Rojo verificadas, con teléfono pa' encargar y horario pa' que no llegues tarde. ¿Necesitas un bizcocho pa' este finde? Escríbele PANADERIA a El Veci al 787-417-7711.`,
    },
    pizza: {
      title: 'Pizzerías en Cabo Rojo, dónde comer pizza',
      description: `${filtered.length} pizzerías en Cabo Rojo, PR, con teléfono, horario y rating real. Mira cuál entrega y cuál está abierta esta noche.`,
      intro: `Pizza un viernes en la noche es plan seguro. Aquí tienes ${filtered.length} pizzerías de Cabo Rojo con su teléfono, horario y rating real, pa' que llames antes y no des la vuelta en balde. ¿Cuál entrega cerca de ti? Escríbele PIZZA a El Veci al 787-417-7711.`,
    },
    mariscos: {
      title: 'Restaurantes de Mariscos en Cabo Rojo, de Joyuda a Boquerón',
      description: `${filtered.length} restaurantes de mariscos y pescado fresco en Cabo Rojo, PR, con dirección, horario y rating. Joyuda, Boquerón y El Combate.`,
      intro: `Cabo Rojo es mariscos: Joyuda, Boquerón, El Combate. Aquí tienes ${filtered.length} restaurantes de mariscos verificados, con su zona, horario y rating real, pa' que escojas con calma y no por el primer letrero. ¿Cuál tiene vista al mar y está abierto? Escríbele MARISCOS a El Veci al 787-417-7711.`,
    },
    lavanderia: {
      title: 'Lavanderías en Cabo Rojo, laundromats abiertos',
      description: `${filtered.length} lavanderías y laundromats en Cabo Rojo, PR, con dirección y horario. La utilidad que nadie te dice dónde queda, aquí sí.`,
      intro: `Buscar una lavandería en un pueblo nuevo es un dolor de cabeza, y Google casi nunca lo resuelve. Aquí tienes ${filtered.length} lavanderías y laundromats de Cabo Rojo con su dirección y horario, verificados. ¿La más cerca de ti? Escríbele LAVANDERIA a El Veci al 787-417-7711.`,
    },
    cafe: {
      title: 'Cafés y Brunch en Cabo Rojo',
      description: `${filtered.length} cafés y sitios de brunch en Cabo Rojo, PR, con horario y rating real. Café de la mañana, desayuno tarde y buen ambiente.`,
      intro: `Un buen café o un brunch sin prisa cambian el día. Aquí tienes ${filtered.length} cafés y sitios de brunch de Cabo Rojo verificados, con horario y rating real. ¿Cuál abre temprano cerca de ti? Escríbele CAFE a El Veci al 787-417-7711.`,
    },
    barberia: {
      title: 'Barberías en Cabo Rojo',
      description: `${filtered.length} barberías en Cabo Rojo, PR, con teléfono, horario y rating real. Mira cuál coge walk-in y cuál es por cita.`,
      intro: `Un buen corte no se improvisa. Aquí tienes ${filtered.length} barberías de Cabo Rojo con su teléfono, horario y rating real, pa' que sepas cuál coge walk-in y cuál es por cita. ¿La más cerca? Escríbele BARBERIA a El Veci al 787-417-7711.`,
    },
    peluqueria: {
      title: 'Peluquerías y Salones de Belleza en Cabo Rojo',
      description: `${filtered.length} peluquerías y salones en Cabo Rojo, PR, con teléfono y horario. Corte, color, uñas y más, con rating real.`,
      intro: `Aquí tienes ${filtered.length} peluquerías y salones de Cabo Rojo verificados, con teléfono pa' coger cita y rating real. ¿Cuál te queda cerca y tiene buena reseña? Escríbele PELUQUERIA a El Veci al 787-417-7711.`,
    },
    imprenta: {
      title: 'Imprentas y Rotulación en Cabo Rojo, flyers, banners y letreros',
      description: `${filtered.length} imprentas y servicios de rotulación que sirven Cabo Rojo: flyers, banners, stickers, tazas, camisas y letreros, con teléfono.`,
      intro: `Cuando necesitas flyers pa'l negocio, un banner pa'l evento o stickers, esto es lo que hay. ${filtered.length} imprentas y servicios de rotulación que sirven Cabo Rojo, con su teléfono. ¿Cuál te hace el trabajo rápido? Escríbele IMPRENTA a El Veci al 787-417-7711.`,
    },
  };
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

  const itemListElements = filtered.map((p: any, i: number) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: p.name,
    url: detailRoute ? `${baseUrl}/${detailRoute}/${p.slug || p.id}` : `${baseUrl}/negocio/${p.slug || p.id}`,
  }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${displayName} en Cabo Rojo, Puerto Rico`,
    description,
    numberOfItems: filtered.length,
    itemListElement: itemListElements,
  };

  // FAQ — health categories + high-LTV capture categories (electricista/plomero/ac/solar)
  const isHealthCat = !!detailRoute;
  const topRated = filtered.filter((p: any) => p.google_rating).sort((a: any, b: any) => Number(b.google_rating) - Number(a.google_rating))[0];

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
    faqItems = [
      { q: `¿Cuántos ${displayName.toLowerCase()} hay en Cabo Rojo?`, a: `Actualmente hay ${filtered.length} ${displayName.toLowerCase()} registrados en Cabo Rojo, Puerto Rico en MapaDeCaboRojo.com.` },
      ...(topRated ? [{ q: `¿Cuál es el ${displayName.toLowerCase().replace(/s$/, '')} con mejor rating en Cabo Rojo?`, a: `${topRated.name} tiene la mejor valoración con ${topRated.google_rating}/5 estrellas${topRated.google_review_count ? ` basado en ${topRated.google_review_count} reseñas` : ''}.` }] : []),
      { q: `¿Cómo encuentro ${displayName.toLowerCase()} cerca de mí en Cabo Rojo?`, a: `Puedes explorar todos los ${displayName.toLowerCase()} aquí en MapaDeCaboRojo.com o textear "${displayName}" al 787-417-7711 para que El Veci te recomiende.` },
    ];
  } else if (captureKey) {
    const singular = CAPTURE_SINGULAR[captureKey];
    faqItems = [
      CAPTURE_URGENT_FAQ[captureKey],
      { q: `¿Cuántos ${displayName.toLowerCase()} hay en Cabo Rojo?`, a: `Hay ${filtered.length} ${displayName.toLowerCase()} listados en Cabo Rojo en MapaDeCaboRojo.com, con teléfono y rating verificados.` },
      ...(topRated ? [{ q: `¿Cuál es el ${singular} mejor evaluado en Cabo Rojo?`, a: `${topRated.name} tiene ${topRated.google_rating}/5 estrellas${topRated.google_review_count ? ` (${topRated.google_review_count} reseñas)` : ''}.` }] : []),
      { q: `¿Cómo encuentro un ${singular} cerca de mí en Cabo Rojo?`, a: `Explora la lista aquí en MapaDeCaboRojo.com o textea "${displayName}" al 787-417-7711 para que El Veci te recomiende al momento.` },
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
    ? `<p style="color:#64748b;text-align:center;padding:2rem;">No encontramos negocios en esta categoría todavía.</p>`
    : filtered.map((p: any) => {
        const slug = p.slug || p.id;
        const rc = Number(p.google_review_count) || 0;
        // On health pages a bare "⭐5" with 0–1 reviews is misleading (number needs a source).
        // Require ≥3 reviews to show the rating, and always show the count when we do.
        const stars = p.google_rating
          ? (isHealth
              ? (rc >= 3 ? `⭐ ${p.google_rating} <span style="color:#94a3b8;font-weight:400;">(${rc})</span>` : '')
              : `⭐ ${p.google_rating}`)
          : '';
        const npiBadge = (isHealth && p.npi)
          ? `<div style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.68rem;font-weight:700;color:#0369a1;background:#e0f2fe;padding:0.15rem 0.5rem;border-radius:999px;margin-bottom:0.4rem;" title="Verificado en el registro federal de salud (NPPES)">✅ Verificado · registro federal</div>`
          : '';
        const oneLinerHtml = (isHealth && p.one_liner)
          ? `<p style="font-size:0.8rem;color:#475569;margin:0 0 0.45rem;line-height:1.4;">${esc(p.one_liner)}</p>`
          : '';
        const dataSpec = isHealth ? ` data-specialty="${esc((specMap.get(p.id) || { key: 'otros' }).key)}"` : '';
        const servesCR = Array.isArray(p.tags) && p.tags.includes('sirve-cabo-rojo');
        const inCR = (p.address || '').toLowerCase().includes('cabo rojo');
        const locHtml = (servesCR && !inCR)
          ? `<p style="font-size:0.8rem;color:#64748b;margin-bottom:0.4rem;">📍 ${esc(p.municipality || '')}${p.municipality ? ' · ' : ''}<span style="color:#0d9488;font-weight:600;">sirve Cabo Rojo</span></p>`
          : (p.address ? `<p style="font-size:0.8rem;color:#64748b;margin-bottom:0.4rem;">📍 ${esc(p.address)}</p>` : '');
        const planBadge = p.plan === 'vip' ? '<span style="background:#f97316;color:white;font-size:0.65rem;padding:0.15rem 0.4rem;border-radius:999px;text-transform:uppercase;margin-left:0.4rem;">VIP</span>' : '';
        const detailPath = detailRoute ? `${baseUrl}/${detailRoute}/${esc(slug)}` : `${baseUrl}/negocio/${esc(slug)}`;
        const phoneInfo = normalizePhone(p.phone);
        const contactBlock = phoneInfo
          ? `<div style="display:flex;gap:0.4rem;padding:0.55rem 1rem 0.65rem;border-top:1px solid #f1f5f9;">
               <a href="tel:+1${phoneInfo.digits10}" style="flex:1;background:#0d9488;color:white;text-decoration:none;padding:0.45rem;border-radius:6px;font-size:0.78rem;text-align:center;font-weight:600;">📞 ${phoneInfo.display}</a>
               <a href="https://wa.me/1${phoneInfo.digits10}" style="flex:1;background:#22c55e;color:white;text-decoration:none;padding:0.45rem;border-radius:6px;font-size:0.78rem;text-align:center;font-weight:600;">💬 WhatsApp</a>
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
            ? `<a href="https://wa.me/17874177711?text=${encodeURIComponent('DATO ' + p.name + ': ')}" style="display:block;border-top:1px solid #f1f5f9;padding:0.55rem 1rem;background:#f8fafc;color:#475569;text-decoration:none;font-size:0.75rem;text-align:center;">
                 ¿Sabes algo de ${esc(p.name)}? Cuéntale a El Veci →
               </a>`
            : '');
        return `
        <div${dataSpec} style="background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.07);transition:box-shadow 0.2s;">
          <a href="${detailPath}" style="display:block;text-decoration:none;color:inherit;">
            ${p.image_url
              ? `<div style="width:100%;height:160px;background:linear-gradient(135deg,#0d9488,#f97316);display:flex;align-items:center;justify-content:center;font-size:2.5rem;" data-emoji="${esc(emoji)}"><img src="${esc(p.image_url)}" alt="${esc(p.name)}" style="width:100%;height:160px;object-fit:cover;display:block;" loading="lazy" onerror="this.style.display='none';this.parentElement.textContent=this.parentElement.dataset.emoji"></div>`
              : `<div style="width:100%;height:160px;background:linear-gradient(135deg,#0d9488,#f97316);display:flex;align-items:center;justify-content:center;font-size:2.5rem;">${emoji}</div>`}
            <div style="padding:1rem;">
              <h2 style="font-size:1rem;font-weight:700;color:#0f172a;margin-bottom:0.25rem;">${esc(p.name)}${planBadge}</h2>
              ${npiBadge}
              ${stars ? `<div style="color:#f59e0b;font-size:0.85rem;margin-bottom:0.25rem;">${stars}</div>` : ''}
              ${oneLinerHtml}
              ${(() => {
                const openLabel = getOpenStatusLabel(p.opening_hours);
                if (!openLabel) return '';
                const isOpen = openLabel.startsWith('🟢');
                // Emit structured hours so the badge recomputes client-side on
                // every view (PR time). SSR HTML is cached up to 24h via
                // stale-while-revalidate, so the baked-in label can lie — the
                // client script below rewrites it against the real current time.
                const oh: any = p.opening_hours || {};
                const payload = esc(JSON.stringify({
                  type: oh.type === 'always_open' ? 'always_open' : 'fixed',
                  structured: Array.isArray(oh.structured)
                    ? oh.structured.map((e: any) => ({ day: e.day, open: e.open, close: e.close, isClosed: !!e.isClosed }))
                    : [],
                }));
                return `<div class="open-status" data-oh="${payload}" style="font-size:0.78rem;font-weight:600;margin-bottom:0.4rem;color:${isOpen ? '#16a34a' : '#dc2626'};">${esc(openLabel)}</div>`;
              })()}
              ${locHtml}
              ${Array.isArray(p.services) && p.services.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:0.25rem;">${p.services.slice(0, 4).map((s: string) => `<span style="font-size:0.65rem;background:#f0fdf4;color:#166534;padding:0.15rem 0.4rem;border-radius:999px;">${esc(s)}</span>`).join('')}${p.services.length > 4 ? `<span style="font-size:0.65rem;color:#94a3b8;">+${p.services.length - 4}</span>` : ''}</div>` : ''}
            </div>
          </a>
          ${contactBlock}
          ${memoriaBlock}
        </div>`;
      }).join('');

  // Emergency banner for urgent service categories (solar excluded — not an emergency)
  const URGENT_BANNER: Record<string, string> = {
    electricista: '⚡ ¿Se fue la luz o un breaker no para de saltar? Textea <strong>ELECTRICISTA</strong> al 787-417-7711 y El Veci te dice a quién llamar — al momento.',
    plomero: '🔧 ¿Salidero o emergencia de plomería ahora? Textea <strong>PLOMERO</strong> al 787-417-7711 y El Veci te recomienda al que resuelve.',
    ac: '❄️ ¿AC dañado en pleno calor? Textea <strong>AC</strong> al 787-417-7711 y El Veci te dice qué técnico está disponible.',
  };
  const urgentBanner = captureKey && URGENT_BANNER[captureKey]
    ? `<a href="https://wa.me/17874177711?text=${encodeURIComponent(displayName)}" style="display:block;background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:10px;padding:0.9rem 1.1rem;margin-bottom:1.25rem;color:#7f1d1d;text-decoration:none;font-size:0.92rem;line-height:1.5;">${URGENT_BANNER[captureKey]}</a>`
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
      .triage-veci { display:block; background:#0d9488; color:white; text-decoration:none; text-align:center; padding:0.7rem 1rem; border-radius:10px; font-weight:600; font-size:0.9rem; }
      .pills { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:1.25rem; }
      .sb-pill { background:white; border:1.5px solid #5eead4; color:#0f766e; padding:7px 14px; border-radius:999px; font-size:0.85rem; cursor:pointer; font-weight:600; transition:all 0.15s; }
      .sb-pill:hover { background:#ccfbf1; }
      .sb-pill.active { background:#0d9488; color:white; border-color:#0d9488; }
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
  ${faqSchema ? `<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>` : ''}
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="anonymous">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Source Sans 3", -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #faf9f7; color: #1c1917; }
    h1, h2, h3, .font-display { font-family: 'Fraunces', Georgia, serif; letter-spacing: -0.01em; }
    .container { max-width: 960px; margin: 0 auto; padding: 1rem; }
    header { background: linear-gradient(135deg, #0d9488, #0f766e); color: white; padding: 2rem 1rem; text-align: center; margin-bottom: 0; }
    header h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem; }
    header p { opacity: 0.85; font-size: 0.95rem; }
    #cat-map { width: 100%; height: 55vw; max-height: 380px; min-height: 240px; background: #e2e8f0; }
    .back { display: inline-block; margin-bottom: 1.25rem; color: #0d9488; text-decoration: none; font-size: 0.9rem; }
    .back:hover { text-decoration: underline; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .cta-bar { background: #0d9488; color: white; text-align: center; padding: 1.25rem; border-radius: 10px; margin-bottom: 2rem; }
    .cta-bar p { margin-bottom: 0.5rem; font-size: 0.9rem; opacity: 0.9; }
    .cta-bar a { display: inline-block; background: #f97316; color: white; text-decoration: none; padding: 0.6rem 1.5rem; border-radius: 8px; font-weight: 600; }
    footer { text-align: center; padding: 1.5rem 0; color: #94a3b8; font-size: 0.8rem; }
    /* Leaflet popup override for dark branding */
    .leaflet-popup-content-wrapper { border-radius: 8px; }
    .leaflet-popup-content { margin: 10px 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; line-height: 1.45; }
    .leaflet-popup-content a { color: #0d9488; text-decoration: none; font-weight: 600; }
    .leaflet-popup-content a:hover { text-decoration: underline; }
    .map-section-label { font-size: 0.7rem; text-align: center; color: #94a3b8; padding: 0.35rem 0; background: #f1f5f9; margin-bottom: 1.5rem; letter-spacing: 0.03em; }
  </style>
</head>
<body>
  <header>
    <h1>${emoji} ${alreadyHasCaboRojo ? esc(displayName) : `${esc(displayName)} en Cabo Rojo`}</h1>
    <p>${filtered.length} negocio${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''} · Cabo Rojo, Puerto Rico</p>
  </header>

  <!-- Leaflet map embedded at top of category page -->
  <div id="cat-map" aria-label="Mapa de ${esc(displayName)} en Cabo Rojo"></div>
  <p class="map-section-label">📍 ${mapPlaces.length} ubicaciones en el mapa</p>

  <div class="container">
    ${urgentBanner}
    ${catSeo?.intro ? `<p style="font-size:1.05rem;line-height:1.6;color:#475569;margin-bottom:1.5rem;max-width:720px">${esc(catSeo.intro)}</p>` : ''}

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

    ${isSaludUmbrella ? saludTriageHtml : `<div class="cta-bar">
      <p>¿Buscas algo específico? Pregúntale a El Veci.</p>
      <a href="https://wa.me/17874177711?text=${encodeURIComponent(displayName)}">Textea al 787-417-7711</a>
    </div>`}

    <div class="grid">
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
      <h2 style="color:white;font-size:1.2rem;font-weight:700;margin-bottom:0.5rem;">¿Tienes ${detailRoute && HEALTH_CTA_NOUN[cat] ? `${HEALTH_CTA_NOUN[cat].article} ${HEALTH_CTA_NOUN[cat].noun}` : 'un negocio'} en Cabo Rojo?</h2>
      <p style="color:rgba(255,255,255,0.9);font-size:0.9rem;margin-bottom:1rem;">${(() => {
        const totalUsers = demandRows.reduce((s, r) => s + r.users, 0);
        const totalFailed = demandRows.reduce((s, r) => s + r.failed, 0);
        if (totalFailed >= 2) return `${totalFailed} vecinos buscaron y NO encontraron resultado este trimestre. Destaca con La Vitrina — apareces primero, servicios y fotos visibles. $799/año.`;
        if (totalUsers >= 3) return `${totalUsers} vecinos buscaron ${displayName.toLowerCase()} en El Veci este trimestre. Destaca con La Vitrina — apareces primero. $799/año.`;
        return `Destaca con La Vitrina — servicios, fotos, reviews, y apareces primero. $799/año.`;
      })()}</p>
      <a href="https://wa.me/17874177711?text=${encodeURIComponent('VITRINA ' + displayName)}" style="display:inline-block;background:white;color:#0d9488;text-decoration:none;padding:0.65rem 1.5rem;border-radius:8px;font-weight:700;font-size:0.95rem;">Textea VITRINA al 787-417-7711</a>
    </div>

    <footer style="margin-top: 48px; padding: 24px 0; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
        Hecho con orgullo en Cabo Rojo, Puerto Rico
      </p>
      <p style="color: #94a3b8; font-size: 11px; margin: 4px 0 0 0;">
        <a href="https://mapadecaborojo.com" style="color: #0d9488; text-decoration: none;">MapaDeCaboRojo.com</a>
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

        var icon = L.divIcon({
          className: '',
          html: '<div style="width:28px;height:28px;background:' + teal + ';border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:12px;">📍</div>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -16],
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
      if (oh.type === 'always_open') return '🟢 Abierto 24h';
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
        el.style.color = lbl.indexOf('🟢') === 0 ? '#16a34a' : '#dc2626';
      });
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
