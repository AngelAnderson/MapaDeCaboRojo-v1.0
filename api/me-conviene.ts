/**
 * api/me-conviene.ts — GPS del Emprendedor de Cabo Rojo
 *
 * Route: /me-conviene  →  /api/me-conviene (via vercel.json rewrite)
 *
 * Phase 1 — Modo ABRIR only.
 *   Screen 1: Intent (4 modos, solo ABRIR activo)
 *   Screen 2: Categoría picker (24 categorías)
 *   Screen 3: Zona picker (8 barrios)
 *   Screen 4: Veredicto (🔴/🟡/🟢 + número grande + 3 pasos del lunes)
 *
 * Voice: Boricua coloquial, abuelita-friendly.
 * Tagline: "Si vas a abrir negocio en Cabo Rojo, primero chequea acá. Gratis. 60 segundos."
 *
 * Sources: Sobreoferta-CR-2026-05-06.md (density data), bot demand signals, HEAT_BUCKETS_DEF
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

function esc(s: string | null | undefined): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============ DATA: 24 CATEGORÍAS × MODO ABRIR ============

type StatusColor = '🔴' | '🟡' | '🟢';

type VeredictoCat = {
  key: string;
  label: string;
  emoji: string;
  status: StatusColor;
  headline_number: string;
  one_sentence: string;
  pasos_lunes: [string, string, string];
  cross_link: {
    type: 'ajorao' | 'vitrina' | 'verify_name' | 'bot_search' | 'call_angel';
    url: string;
    copy: string;
  };
  caveat?: string; // opcional: nota adicional de honestidad
};

/**
 * Veredictos pre-calculados modo ABRIR.
 * Fuente: Sobreoferta-CR-2026-05-06.md + bot demand signals + HEAT_BUCKETS_DEF.
 * Calibración: 🔴=saturado/debajo breakeven · 🟡=sano/borderline · 🟢=escaso/oportunidad
 *
 * Nota: zona no cambia el veredicto base en Phase 1 — se menciona en copy cuando relevante.
 * Phase 2 calculará por zona.
 */
const VEREDICTOS: VeredictoCat[] = [
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
    key: 'aire', label: 'AC / Refrigeración', emoji: '❄️',
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
    key: 'plomeria', label: 'Plomería', emoji: '🔧',
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
    key: 'hotel', label: 'Hospedaje / Airbnb', emoji: '🏨',
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
    key: 'belleza', label: 'Salón / Belleza / Barbería', emoji: '💇',
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
    key: 'auto', label: 'Mecánica / Taller de Auto', emoji: '🔩',
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

// ============ ZONAS ============

const ZONAS = [
  { key: 'pueblo', label: 'Pueblo / Casco Urbano', note: 'La zona más densa — más tráfico, más competencia.' },
  { key: 'boqueron', label: 'Boquerón', note: 'Turismo alto, opciones de negocio ya saturadas en servicios básicos.' },
  { key: 'joyuda', label: 'Joyuda', note: 'Zona de playa con oportunidades sin cubrir fuera de restaurantes.' },
  { key: 'combate', label: 'Combate / Playa Sucia', note: 'Turismo natural creciente — poca oferta local.' },
  { key: 'puerto_real', label: 'Puerto Real', note: 'Marina y pesca — servicios náuticos con demanda.' },
  { key: 'llanos_tuna', label: 'Llanos Tuna / Interior', note: 'Comunidades rurales — servicios básicos escasos.' },
  { key: 'bajura', label: 'Bajura / Costa Sur', note: 'Zona agrícola y costera — poca cobertura de servicios.' },
  { key: 'no_se', label: 'Todavía no sé', note: 'No importa — el veredicto sirve igual.' },
];

// ============ LEAD CAPTURE (POST) ============

async function handleLeadCapture(req: any, res: any) {
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

// ============ HTML HELPERS ============

function pageShell(bodyHtml: string, title: string, description: string): string {
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
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"¿Me Conviene? — Decisión de Negocio Cabo Rojo","description":"${esc(description)}","url":"https://mapadecaborojo.com/me-conviene","applicationCategory":"BusinessApplication","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}}</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b;-webkit-font-smoothing:antialiased;line-height:1.5}
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

// ============ SCREEN 1: INTENT ============

function renderScreen1(): string {
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
  return pageShell(body, '¿Me Conviene? · Decisión de Negocio en Cabo Rojo', 'Antes de abrir negocio en Cabo Rojo, chequea la matemática del pueblo. Gratis. 60 segundos. Datos reales del directorio + demanda bot *7711.');
}

// ============ SCREEN 2: CATEGORÍA ============

function renderScreen2(): string {
  const catItems = VEREDICTOS.map(v =>
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
  const names = ${JSON.stringify(Object.fromEntries(VEREDICTOS.map(v => [v.key, v.label + ' ' + v.emoji])))};
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
  return pageShell(body, 'Elige tu categoría · ¿Me Conviene?', 'Elige qué tipo de negocio piensas abrir en Cabo Rojo.');
}

// ============ SCREEN 3: ZONA ============

function renderScreen3(cat: string): string {
  const v = VEREDICTOS.find(x => x.key === cat);
  const catLabel = v ? v.label : cat;

  const zonaItems = ZONAS.map(z =>
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
  return pageShell(body, 'Elige tu zona · ¿Me Conviene?', `¿En qué parte de Cabo Rojo piensas abrir tu ${catLabel}?`);
}

// ============ SCREEN 4: VEREDICTO ============

function renderVeredicto(cat: string, zona: string): string {
  const v = VEREDICTOS.find(x => x.key === cat);
  if (!v) {
    // Fallback for unknown category
    return renderFallbackVeredicto(cat, zona);
  }

  const zonaInfo = ZONAS.find(z => z.key === zona);
  const zonaLabel = zonaInfo ? zonaInfo.label : 'Cabo Rojo';

  const statusClass = v.status === '🔴' ? 'pill-red' : v.status === '🟡' ? 'pill-yellow' : 'pill-green';
  const statusWord = v.status === '🔴' ? 'Saturado' : v.status === '🟡' ? 'Hay espacio — con cautela' : 'Oportunidad real';
  const bgColor = v.status === '🔴' ? '#fef2f2' : v.status === '🟡' ? '#fffbeb' : '#f0fdf4';
  const borderColor = v.status === '🔴' ? '#fca5a5' : v.status === '🟡' ? '#fcd34d' : '#6ee7b7';

  const waText = encodeURIComponent(`¿Me conviene abrir ${v.label} en ${zonaLabel}, Cabo Rojo? El resultado dice: ${v.status} ${statusWord}. Número clave: ${v.headline_number}. Pasos del lunes: (1) ${v.pasos_lunes[0]} (2) ${v.pasos_lunes[1]} (3) ${v.pasos_lunes[2]}. Verifica en mapadecaborojo.com/me-conviene`);

  const body = `
<!-- PROGRESS -->
<div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;">
  <a href="/me-conviene?screen=zona&cat=${encodeURIComponent(cat)}" style="font-size:13px;color:#0d9488;font-weight:600;">← Atrás</a>
  <div style="flex:1;height:4px;background:#e2e8f0;border-radius:2px;">
    <div style="width:100%;height:4px;background:#0d9488;border-radius:2px;"></div>
  </div>
  <span style="font-size:12px;color:#94a3b8;">Tu veredicto</span>
</div>

<!-- VEREDICTO HERO -->
<div style="background:${bgColor};border:2px solid ${borderColor};border-radius:16px;padding:24px;margin-bottom:16px;text-align:center;">
  <div style="font-size:48px;margin-bottom:8px;">${v.status}</div>
  <span class="pill ${statusClass}" style="font-size:16px;padding:8px 18px;margin-bottom:14px;display:inline-block;">${statusWord}</span>
  <h2 style="font-size:22px;font-weight:800;letter-spacing:-0.3px;margin-bottom:10px;margin-top:14px;">${esc(v.headline_number)}</h2>
  <p style="font-size:15px;color:#374151;line-height:1.5;">${esc(v.one_sentence)}</p>
  ${v.caveat ? `<p style="font-size:13px;color:#6b7280;margin-top:10px;padding-top:10px;border-top:1px solid ${borderColor};font-style:italic;">${esc(v.caveat)}</p>` : ''}
</div>

<!-- ZONA CONTEXTO -->
${zonaInfo && zona !== 'no_se' ? `
<div style="background:#f8fafc;border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:13px;color:#475569;">
  <strong>Zona elegida: ${esc(zonaLabel)}</strong> — ${esc(zonaInfo.note)}
  <span style="color:#94a3b8;font-size:11px;display:block;margin-top:2px;">Veredicto por zona llega en Fase 2 — este resultado es para Cabo Rojo en general.</span>
</div>
` : ''}

<!-- 3 PASOS DEL LUNES -->
<div class="card">
  <p style="font-size:12px;color:#0d9488;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:14px;">📋 Antes de invertir — haz esto el lunes</p>
  <div class="paso">
    <div class="paso-num">1</div>
    <div style="font-size:14px;color:#1e293b;line-height:1.5;">${esc(v.pasos_lunes[0])}</div>
  </div>
  <div class="paso">
    <div class="paso-num">2</div>
    <div style="font-size:14px;color:#1e293b;line-height:1.5;">${esc(v.pasos_lunes[1])}</div>
  </div>
  <div class="paso">
    <div class="paso-num">3</div>
    <div style="font-size:14px;color:#1e293b;line-height:1.5;">${esc(v.pasos_lunes[2])}</div>
  </div>
</div>

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
    const r = await fetch('/api/me-conviene?action=lead', {
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

  return pageShell(body, `${v.status} ${v.label} en Cabo Rojo · ¿Me Conviene?`, `¿Conviene abrir ${v.label} en Cabo Rojo? ${statusWord}. ${v.one_sentence}`);
}

// ============ FALLBACK VEREDICTO ============

function renderFallbackVeredicto(cat: string, zona: string): string {
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
  return pageShell(body, `¿Me Conviene? — ${esc(cat)}`, `Evaluación de negocio en Cabo Rojo — categoría ${esc(cat)}.`);
}

// ============ MAIN HANDLER ============

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  // POST — lead capture
  if (req.method === 'POST') {
    const action = String(req.query?.action || '');
    if (action === 'lead') {
      res.setHeader('Content-Type', 'application/json');
      return handleLeadCapture(req, res);
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
        res.send(renderScreen2());
        break;
      case 'zona':
        res.send(renderScreen3(cat));
        break;
      case 'veredicto':
        res.send(renderVeredicto(cat, zona));
        break;
      default:
        res.send(renderScreen1());
    }
  } catch (err: any) {
    console.error('me-conviene error:', err);
    res.status(500).send(`<html><body><h1>Error 500</h1><pre>${esc(err?.message)}</pre></body></html>`);
  }
}
