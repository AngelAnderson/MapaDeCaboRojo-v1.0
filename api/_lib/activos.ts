// /activos — Los activos dormidos de Cabo Rojo: el récord del costo operacional.
// Récord PRSF (área Cabo Rojo). Frame: el edificio vacío no es neutral, cobra todos los meses.
// El récord es del activo, no del político: los contadores cruzan administraciones.
// Fuentes: expediente del alcalde (video al minuto + OpenFEMA), Radar de Cabo Rojo
// (radardepueblo.com, estimados con metodología abierta), y la voz del pueblo
// (post público de Caborojo.com, 9 feb 2026). Cero data inventada: lo que es
// estimado se dice, lo que no existe (el costo operacional oficial) se reclama.

type Deps = {
  layout: (opts: {
    title: string; description: string; slug: string; bodyHtml: string
    jsonLd?: object; ogImage?: string; host?: string
    canonicalHost?: string; canonicalUrl?: string; lang?: 'es' | 'en'
  }) => string
  escapeHtml: (s: string) => string
}

const FB_POST_URL = 'https://www.facebook.com/caborojoweb/posts/pfbid079c7FzQHiVtvKf2ogkvYEBvjcJwwWxSBuCFcsvecdqGgTZ6bPKgE8X6SeK6MnPgGl'
const RADAR_URL = 'https://www.radardepueblo.com'
const EXPEDIENTE_URL = '/expediente/alcalde-cabo-rojo'

const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso + 'T12:00:00-04:00').getTime()) / 86400000))
const n = (x: number) => x.toLocaleString('en-US')

export function handleActivos(req: any, res: any, deps: Deps) {
  const { layout, escapeHtml } = deps

  // Relojes vivos (se calculan al render, igual que el expediente).
  const dColiseo = daysSince('2025-06-17')   // venció el plazo "mala suerte dos años" del alcalde
  const dCabanas = daysSince('2026-03-31')   // venció el "par de años" de las cabañas
  const hoy = new Date().toLocaleDateString('es-PR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Puerto_Rico' })

  type Activo = {
    id: string; emoji: string; nombre: string; estado: string; estadoColor: string
    verificado: string[]; pregunta: string
  }

  const activos: Activo[] = [
    {
      id: 'coliseo', emoji: '🏟️', nombre: 'Coliseo Rebekah Colberg', estado: 'CERRADO · plazo vencido', estadoColor: 'bg-red-50 text-red-700 border-red-200',
      verificado: [
        `El alcalde dijo en video (jun 2023): "año y medio, mala suerte dos años". El escenario "mala suerte" venció el 17 de junio de 2025. Lleva <strong>${n(dColiseo)} días vencido</strong> y el coliseo sigue sin reabrir.`,
        `<strong>$5.2 millones de FEMA ya están obligados</strong> para la obra. El dinero externo llegó; la obra terminada no. Fuente: OpenFEMA, en el <a href="${EXPEDIENTE_URL}" class="text-teal-700 font-semibold">expediente del alcalde</a>.`,
      ],
      pregunta: '¿Fecha de reapertura, y qué falta exactamente entre los $5.2M obligados y las puertas abiertas?',
    },
    {
      id: 'boqueron', emoji: '🏖️', nombre: 'Cabañas del Balneario de Boquerón', estado: 'PARCIAL · plazo vencido', estadoColor: 'bg-red-50 text-red-700 border-red-200',
      verificado: [
        `El alcalde dijo en video (mar 2024): "par de años". Venció en marzo de 2026, hace <strong>${n(dCabanas)} días</strong>, con <strong>29 cabañas rehabilitadas de 280+</strong>.`,
        `Cada cabaña cerrada es pernoctación que no ocurre: el visitante que duerme gasta en el pueblo la cena, el desayuno y la vuelta del día siguiente.`,
      ],
      pregunta: '¿Calendario público de rehabilitación por fase: cuántas cabañas, para cuándo, y quién responde por cada fase?',
    },
    {
      id: 'faro', emoji: '🗼', nombre: 'Faro Los Morrillos', estado: 'CERRADO al público', estadoColor: 'bg-red-50 text-red-700 border-red-200',
      verificado: [
        `El alcalde dijo en video (mar 2024) que abriría "antes de la temporada de playa". Sigue cerrado.`,
        `El acuerdo de manejo del Faro <strong>venció en 2016</strong>: hace ${new Date().getFullYear() - 2016} años que el papel que define quién lo administra está vencido. Fuente: <a href="${EXPEDIENTE_URL}" class="text-teal-700 font-semibold">expediente del alcalde</a>.`,
      ],
      pregunta: '¿Quién es hoy el custodio legal del Faro, y qué falta para renovar el acuerdo de manejo vencido desde 2016?',
    },
    {
      id: 'escuelas', emoji: '🏫', nombre: 'Escuelas cerradas (3 planteles)', estado: 'VACÍAS desde ~2017', estadoColor: 'bg-amber-50 text-amber-800 border-amber-200',
      verificado: [
        `Cabo Rojo tiene <strong>3 planteles escolares vacíos</strong> rastreados por el Radar de Cabo Rojo. El más emblemático: la <strong>Pedro Fidel Colberg</strong>, cerrada en la ola de cierres del Departamento de Educación, con más de <strong>3,400 días</strong> en el contador (jul 2026).`,
        `Cuando Caborojo.com publicó el recibo de la Colberg (feb 2026), el pueblo respondió con <strong>450 reacciones, 158 comentarios y 155 compartidos</strong>, y propuso usos concretos. La voz del pueblo está más abajo en esta página.`,
      ],
      pregunta: '¿Cuánto gasta (o deja de ganar) el municipio al año por cada plantel vacío, y qué restricciones de uso tiene cada traspaso?',
    },
    {
      id: 'ratones', emoji: '🏝️', nombre: 'Isla de Ratones (muelle)', estado: 'PROYECTO RETIRADO', estadoColor: 'bg-slate-100 text-slate-700 border-slate-300',
      verificado: [
        `El DRNA <strong>retiró el proyecto del muelle</strong>: la zona se hundió en los terremotos de 2020, pese a ~$735K de FEMA. Este es el caso honesto del récord: a veces la respuesta verificada es "ya no se puede", y eso también se anota.`,
        `La pregunta que queda viva es la del plan B: el acceso a la isla y el empuje a los negocios de Joyuda no murieron con el muelle.`,
      ],
      pregunta: '¿Cuál es el plan B oficial para el acceso a Isla de Ratones, o se archivó sin sustituto?',
    },
    {
      id: 'cultura', emoji: '🎭', nombre: 'La agenda cultural del casco', estado: 'INTERMITENTE', estadoColor: 'bg-amber-50 text-amber-800 border-amber-200',
      verificado: [
        `No es un edificio: es el activo que enciende a los demás. Un casco urbano con programación constante multiplica lo que producen el coliseo, la plaza y los negocios de la calle. Hoy la programación es intermitente.`,
      ],
      pregunta: '¿Existe un calendario cultural anual publicado, con responsable y presupuesto, o se improvisa mes a mes?',
    },
  ]

  const cardActivo = (a: Activo) => `
  <section id="${a.id}" class="not-prose bg-white border border-slate-200 rounded-2xl p-5 mb-4 scroll-mt-20">
    <div class="flex justify-between items-start gap-3">
      <h3 class="text-xl font-black text-slate-900 m-0" style="font-family:'Fraunces',Georgia,serif">${a.emoji} ${escapeHtml(a.nombre)}</h3>
      <span class="shrink-0 text-xs font-bold rounded-full px-2.5 py-1 border ${a.estadoColor}">${escapeHtml(a.estado)}</span>
    </div>
    <ul class="mt-3 space-y-2 text-sm text-slate-700 list-disc pl-5">
      ${a.verificado.map(v => `<li>${v}</li>`).join('')}
    </ul>
    <div class="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
      <p class="text-xs font-bold text-teal-700 uppercase tracking-wide m-0 mb-1">La pregunta pendiente</p>
      <p class="text-sm text-slate-800 m-0">${escapeHtml(a.pregunta)}</p>
    </div>
  </section>`

  const tile = (num: string, label: string, color: string) => `
    <div class="bg-white border border-slate-200 rounded-xl p-4 text-center">
      <div class="text-3xl font-black ${color}" style="font-family:'Fraunces',Georgia,serif">${num}</div>
      <div class="text-xs text-slate-500 mt-1 leading-tight">${label}</div>
    </div>`

  const citable = (id: string, text: string) => `
    <div class="bg-white border border-slate-200 rounded-xl p-4">
      <p class="text-sm text-slate-800 m-0">${text}</p>
      <button type="button" class="activos-copy mt-2 inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full" data-copy="${escapeHtml(text.replace(/<[^>]+>/g, ''))} · Fuente: Puerto Rico Sin Filtros (puertoricosinfiltros.com/activos), julio 2026.">📋 Copiar con fuente</button>
    </div>`

  const usosPueblo = [
    ['Hospital o centro de salud', 'con estacionamiento, "hacer un hospital grande" (comentario público)'],
    ['Asilo o centro de retiro', 'propuesto en español y en inglés por vecinos y diáspora'],
    ['Escuela de artes, oficios y deportes', 'baile, bomba y plena, cuatro, tutorías por la tarde'],
    ['Centro de adiestramiento para adultos', 'artesanía, repostería, computadoras, exámenes libres de 4to año'],
    ['Plan cooperativo de clases graduadas', 'convocar a los exalumnos para limpiar y adquirirla en orden'],
    ['Centro comunal de barrio', 'el uso base que propone el Radar: tres escuelas, tres motores de barrio'],
  ]

  const shareText = 'El récord de los activos dormidos de Cabo Rojo: el Coliseo con $5.2M de FEMA obligados y el plazo vencido, 29 cabañas de 280+, el Faro cerrado con el acuerdo vencido desde 2016, y 3 escuelas vacías. Con fuente: https://puertoricosinfiltros.com/activos'

  const body = `
  <div class="max-w-3xl mx-auto px-4 py-8">
    <p class="text-teal-700 font-bold uppercase tracking-wide text-xs mb-1">Récord municipal · Cabo Rojo</p>
    <h1 class="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight mb-3" style="font-family:'Fraunces',Georgia,serif">Los activos dormidos: lo que cuesta un edificio vacío</h1>
    <p class="text-lg text-slate-700 leading-relaxed">Una propiedad pública cerrada no es neutral. <strong>Cobra todos los meses</strong>: limpieza, seguridad, seguros, deterioro, y lo que el pueblo deja de recibir. Este récord junta las propiedades dormidas de Cabo Rojo con lo que está verificado de cada una, la pregunta que falta, y lo que el pueblo ya propuso. Actualizado: ${hoy}.</p>

    <div class="grid grid-cols-3 gap-3 my-6">
      ${tile('6', 'activos en el récord', 'text-teal-700')}
      ${tile('2', 'plazos del alcalde ya vencidos', 'text-red-600')}
      ${tile('$5.2M', 'de FEMA obligados al Coliseo, sin reapertura', 'text-slate-800')}
    </div>

    <div class="bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 rounded-xl p-4 text-sm text-slate-800 mb-6">
      <strong>El récord es del activo, no del político.</strong> Casi todo esto empezó hace años y cruza administraciones. Aquí no se busca culpable de turno: se cuenta el tiempo, se anota lo verificado, y se registra el verde igual que el rojo (cuando algo abra, se celebra aquí mismo). Es un espejo, no una alarma.
    </div>

    <div class="not-prose bg-slate-900 text-white rounded-2xl p-6 my-8">
      <p class="text-xs uppercase tracking-widest text-teal-300 font-bold m-0">La regla que nadie escribe</p>
      <p class="text-xl font-black mt-2 leading-snug" style="font-family:'Fraunces',Georgia,serif">Cuando no arreglas lo pequeño, compras lo grande.</p>
      <p class="text-slate-300 mt-3 text-sm leading-relaxed">Pasa en los negocios heredados: como al heredero no le duele gastar, el negocio no crece y se apaga. Con las propiedades públicas pasa igual, con un agravante: <strong>mientras se espera "que lleguen fondos externos", el mantenimiento y las excusas se pagan con dinero local</strong>. Hoy: limpiar, sellar, podar, verificar. Mañana: goteras, plagas, vandalismo. Pasado mañana: fondos federales, porque ya es crisis. El Coliseo es la prueba de que el dinero externo tampoco resuelve solo: los $5.2M llegaron y las puertas siguen cerradas.</p>
      <p class="text-slate-300 mt-3 text-sm leading-relaxed m-0"><strong>Estos activos no tienen que dar ganancia. Tienen que dejar de ser drenaje.</strong> Producir para el pueblo de una manera u otra: uso, renta, cesión con condiciones, o una venta honesta. Lo único que no aguanta cuentas es dejarlos caer con presupuesto.</p>
    </div>

    <h2 class="text-2xl font-black text-slate-900 mt-8 mb-1" style="font-family:'Fraunces',Georgia,serif">Los expedientes, uno por uno</h2>
    <p class="text-slate-600 text-sm mb-4">Lo verificado viene del <a href="${EXPEDIENTE_URL}" class="text-teal-700 font-semibold">expediente del alcalde</a> (promesas en video, al minuto, cruzadas con OpenFEMA) y del <a href="${RADAR_URL}" target="_blank" rel="noopener" class="text-teal-700 font-semibold">Radar de Cabo Rojo</a>. Cada tarjeta cierra con la pregunta que sigue sin contestarse en público.</p>

    ${activos.map(cardActivo).join('')}

    <div class="not-prose bg-white border-2 border-teal-200 rounded-2xl p-5 my-8">
      <p class="text-teal-700 font-bold uppercase tracking-wide text-xs m-0 mb-1">El número que no existe</p>
      <h3 class="text-xl font-black text-slate-900 m-0" style="font-family:'Fraunces',Georgia,serif">¿Cuánto cuesta mantener lo cerrado? Nadie lo publica.</h3>
      <p class="text-sm text-slate-700 mt-2">El municipio no publica cuánto gasta al año en mantener (o dejar caer) cada propiedad dormida. Ese es el hueco central de este récord. El <a href="${RADAR_URL}" target="_blank" rel="noopener" class="text-teal-700 font-semibold">Radar de Cabo Rojo</a> publica estimados con metodología abierta (por ejemplo: ~$3,500 diarios de costo por los 3 planteles vacíos); son estimados, no cifras oficiales, y ahí mismo está el punto: <strong>si el número real existe, que se publique y esta página se corrige</strong>. Tres preguntas que solo el municipio puede contestar:</p>
      <ol class="text-sm text-slate-700 mt-2 space-y-1.5 list-decimal pl-5">
        <li><strong>El costo:</strong> ¿cuánto gasta el municipio al año, propiedad por propiedad, en seguridad, limpieza, seguros y reclamaciones de estas estructuras?</li>
        <li><strong>El gravamen:</strong> ¿alguna de estas propiedades está comprometida como colateral de un préstamo o emisión, y por eso no se puede ceder ni vender?</li>
        <li><strong>Las reglas:</strong> ¿qué restricciones de uso tiene cada traspaso (por ejemplo, "solo sin fines de lucro"), y qué proceso existe para pedir una dispensa cuando la regla es la que mantiene el edificio vacío?</li>
      </ol>
      <p class="text-xs text-slate-500 mt-3 mb-0">Lo mínimo que se le pide a cada activo, tomado del recibo que el pueblo ya compartió 155 veces: <strong>estatus + fecha + plan + un responsable con nombre y apellido + evidencia (fotos antes y después)</strong>.</p>
    </div>

    <div class="not-prose border border-teal-200 bg-teal-50/40 rounded-2xl p-5 my-8">
      <p class="text-teal-700 font-bold uppercase tracking-wide text-xs m-0 mb-1">La voz del pueblo · el archivo</p>
      <h3 class="text-xl font-black text-slate-900 m-0" style="font-family:'Fraunces',Georgia,serif">El pueblo ya contestó qué haría con la Colberg</h3>
      <p class="text-sm text-slate-700 mt-2">El 9 de febrero de 2026, Caborojo.com publicó el recibo de la escuela Pedro Fidel Colberg. La respuesta: <strong>450 reacciones, 158 comentarios y 155 compartidos</strong>, y algo mejor que el coraje: propuestas. Exalumnos de tres generaciones (hay quien estudió allí desde 1959) dejaron por escrito los usos que le darían:</p>
      <div class="grid sm:grid-cols-2 gap-2 mt-3">
        ${usosPueblo.map(([t, d]) => `<div class="bg-white border border-slate-200 rounded-xl p-3"><p class="text-sm font-bold text-slate-900 m-0">${escapeHtml(t)}</p><p class="text-xs text-slate-500 m-0 mt-0.5">${escapeHtml(d)}</p></div>`).join('')}
      </div>
      <blockquote class="mt-4 text-slate-800 text-sm leading-relaxed border-l-4 border-teal-500 pl-3 m-0">"No todo se lo podemos dejar al Municipio o Gobierno. Es hora que el pueblo comience a llenar los espacios vacíos. Claro, en orden." <span class="text-slate-500">· Comentario público en el post, el más respaldado por otros vecinos (proponía convocar a las clases graduadas con un plan cooperativo).</span></blockquote>
      <div class="mt-4 flex flex-wrap gap-2 text-sm">
        <a href="${FB_POST_URL}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-full hover:border-teal-400">Ver la publicación original ↗</a>
        <a href="${RADAR_URL}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-full hover:border-teal-400">Ver el contador vivo en el Radar ↗</a>
      </div>
    </div>

    <h2 class="text-2xl font-black text-slate-900 mt-8 mb-1" style="font-family:'Fraunces',Georgia,serif">Datos citables de este récord</h2>
    <p class="text-slate-600 text-sm mb-3">Para prensa, investigadores y el vecino que quiera llevar el dato exacto. Copia y pega, la fuente va incluida.</p>
    <div class="space-y-3">
      ${citable('coliseo', `El Coliseo Rebekah Colberg de Cabo Rojo tiene <strong>$5.2 millones de FEMA obligados</strong> y sigue cerrado. El plazo que el alcalde puso en video ("mala suerte, dos años", jun 2023) venció el 17 de junio de 2025: lleva ${n(dColiseo)} días vencido.`)}
      ${citable('cabanas', `De las <strong>280+ cabañas del Balneario de Boquerón</strong>, 29 estaban rehabilitadas al vencerse (marzo 2026) el "par de años" que el alcalde prometió en video en marzo 2024.`)}
      ${citable('faro', `El <strong>acuerdo de manejo del Faro Los Morrillos está vencido desde 2016</strong>. El Faro sigue cerrado al público pese a la promesa en video (mar 2024) de abrirlo "antes de la temporada de playa".`)}
      ${citable('colberg', `Cuando se publicó el recibo de la escuela Pedro Fidel Colberg (feb 2026), el pueblo respondió con 450 reacciones, 158 comentarios y 155 compartidos, y propuso 6 usos concretos para el plantel. El costo operacional oficial de mantenerla vacía no está publicado.`)}
    </div>

    <div class="not-prose bg-teal-900 text-white rounded-2xl p-5 my-8">
      <p class="font-bold text-base m-0 mb-1">📤 Pásalo a quien le toca</p>
      <p class="text-sm text-teal-100 m-0 mb-3">Al exalumno de la Colberg, al que pregunta "¿y el Coliseo pa' cuándo?", y al periodista que cubre el oeste. Un mensaje con fuente vale más que diez opiniones.</p>
      <div class="flex flex-wrap gap-2">
        <a href="https://wa.me/?text=${encodeURIComponent(shareText)}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-full text-sm"><i class="fa-brands fa-whatsapp"></i> Compartir por WhatsApp</a>
        <button type="button" class="activos-copy inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white font-bold px-4 py-2.5 rounded-full text-sm" data-copy="${escapeHtml(shareText)}">📋 Copiar el texto</button>
      </div>
    </div>

    <div class="text-center bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-8">
      <p class="text-slate-700 text-sm m-0">¿Pasaste por una de estas propiedades y viste algo (mejor o peor)? Mándalo con foto al <strong>787-417-7711</strong> y se verifica antes de publicarse. Y si hoy no es el día, tranquilo: el récord se queda aquí, contando.</p>
    </div>

    <div class="text-xs text-slate-500 border-t border-slate-200 pt-4">
      <strong>Metodología:</strong> los hechos verificados salen del expediente público del alcalde de Cabo Rojo (promesas en video con cita textual y minuto exacto, cruzadas con obligaciones de OpenFEMA) y de registros públicos. Los estimados de costo diario son del Radar de Cabo Rojo (radardepueblo.com), con metodología abierta publicada allí; se identifican siempre como estimados. La lista de usos propuestos sale de los comentarios públicos del post de Caborojo.com del 9 feb 2026 (engagement verificado el 10 jul 2026). El costo operacional oficial por propiedad no está publicado por el municipio; si se publica, este récord se corrige. ¿Ves un error? Escríbelo al 787-417-7711 y se corrige con crédito.
    </div>
  </div>
  <script>document.addEventListener('click',function(e){var b=e.target.closest('.activos-copy');if(!b)return;navigator.clipboard.writeText(b.getAttribute('data-copy')||'').then(function(){var o=b.innerHTML;b.innerHTML='✓ Copiado';setTimeout(function(){b.innerHTML=o},1600);});});</script>`

  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'Dataset',
      name: 'Los activos dormidos de Cabo Rojo: propiedades públicas cerradas o subutilizadas',
      description: 'Récord de las propiedades públicas de Cabo Rojo cerradas o a medio uso (Coliseo Rebekah Colberg, cabañas del Balneario de Boquerón, Faro Los Morrillos, 3 escuelas cerradas, Isla de Ratones), con lo verificado de cada una, los plazos públicos vencidos, y las preguntas de costo operacional sin contestar.',
      url: 'https://puertoricosinfiltros.com/activos', inLanguage: 'es', license: 'https://creativecommons.org/licenses/by/4.0/',
      creator: { '@type': 'Organization', name: 'Puerto Rico Sin Filtros', url: 'https://puertoricosinfiltros.com' },
      temporalCoverage: '2016/2026',
      spatialCoverage: { '@type': 'Place', name: 'Cabo Rojo, Puerto Rico' },
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
        { '@type': 'Question', name: '¿Por qué sigue cerrado el Coliseo Rebekah Colberg de Cabo Rojo?', acceptedAnswer: { '@type': 'Answer', text: 'El Coliseo tiene $5.2 millones de FEMA obligados para la obra y sigue cerrado. El plazo que el alcalde puso en video en junio de 2023 ("año y medio, mala suerte dos años") venció el 17 de junio de 2025. La fecha de reapertura no se ha anunciado públicamente.' } },
        { '@type': 'Question', name: '¿Qué pasó con la escuela Pedro Fidel Colberg?', acceptedAnswer: { '@type': 'Answer', text: 'Es uno de los 3 planteles escolares vacíos de Cabo Rojo, cerrada en la ola de cierres del Departamento de Educación (~2017). En febrero de 2026 el pueblo respondió a su recibo público con 450 reacciones y 158 comentarios, proponiendo usos como hospital, asilo, escuela de artes y oficios, y un plan cooperativo de exalumnos.' } },
        { '@type': 'Question', name: '¿Cuánto le cuesta al municipio mantener las propiedades cerradas?', acceptedAnswer: { '@type': 'Answer', text: 'El número oficial no está publicado. El Radar de Cabo Rojo (radardepueblo.com) publica estimados con metodología abierta (por ejemplo, ~$3,500 diarios por los 3 planteles vacíos), identificados siempre como estimados. La pregunta del costo operacional real, propiedad por propiedad, sigue sin contestarse en público.' } },
        { '@type': 'Question', name: '¿Se va a reconstruir el muelle de Isla de Ratones?', acceptedAnswer: { '@type': 'Answer', text: 'No con el proyecto original: el DRNA lo retiró porque la zona se hundió en los terremotos de 2020, pese a unos $735,000 de FEMA. No se ha anunciado públicamente un plan alterno de acceso a la isla.' } },
      ],
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Puerto Rico Sin Filtros', item: 'https://puertoricosinfiltros.com' },
        { '@type': 'ListItem', position: 2, name: 'Los activos dormidos de Cabo Rojo', item: 'https://puertoricosinfiltros.com/activos' },
      ],
    },
  ]

  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600')
  res.status(200).send(layout({
    title: 'Los activos dormidos de Cabo Rojo: lo que cuesta un edificio vacío',
    description: 'El récord de las propiedades públicas dormidas de Cabo Rojo: el Coliseo con $5.2M de FEMA y el plazo vencido, 29 cabañas de 280+, el Faro con el acuerdo vencido desde 2016, y 3 escuelas vacías. Con fuente, contadores, y las preguntas de costo operacional que nadie contesta.',
    slug: 'activos', bodyHtml: body, jsonLd,
    ogImage: `https://puertoricosinfiltros.com/api/og?theme=sinfiltros&k=${encodeURIComponent('Récord municipal · Cabo Rojo')}&t=${encodeURIComponent('Los activos dormidos||lo que cuesta un edificio vacío')}&sub=${encodeURIComponent(`Coliseo: $5.2M de FEMA y ${n(dColiseo)} días de plazo vencido · 29 cabañas de 280+ · el Faro con acuerdo vencido desde 2016 · 3 escuelas vacías`)}&badge=${encodeURIComponent('El récord es del activo, no del político')}`,
    host: req.headers?.host, canonicalHost: 'https://puertoricosinfiltros.com',
    canonicalUrl: 'https://puertoricosinfiltros.com/activos',
    lang: 'es',
  }))
}
