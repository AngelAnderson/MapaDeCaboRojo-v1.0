import React, { useState } from 'react';

interface Section {
  id: string;
  icon: string;
  faIcon: string;
  title: string;
  content: React.ReactNode;
}

const CodeBlock: React.FC<{ children: string }> = ({ children }) => (
  <pre className="bg-slate-900 border border-slate-700 rounded-lg p-3 mt-2 text-xs text-teal-300 overflow-x-auto whitespace-pre-wrap break-all">
    <code>{children}</code>
  </pre>
);

const Tip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex gap-2 bg-teal-900/20 border border-teal-700/30 rounded-lg p-3 mt-3 text-sm text-teal-300">
    <i className="fa-solid fa-lightbulb mt-0.5 shrink-0"></i>
    <span>{children}</span>
  </div>
);

const Warning: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex gap-2 bg-amber-900/20 border border-amber-700/30 rounded-lg p-3 mt-3 text-sm text-amber-300">
    <i className="fa-solid fa-triangle-exclamation mt-0.5 shrink-0"></i>
    <span>{children}</span>
  </div>
);

const Step: React.FC<{ num: number; children: React.ReactNode }> = ({ num, children }) => (
  <div className="flex gap-3 items-start mt-3">
    <span className="shrink-0 w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center">{num}</span>
    <span className="text-sm text-slate-300 pt-0.5">{children}</span>
  </div>
);

const H3: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="font-bold text-white text-sm mt-5 mb-1">{children}</h3>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-sm text-slate-400 mt-2 leading-relaxed">{children}</p>
);

const Ul: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="mt-2 space-y-1.5">
    {items.map((item, i) => (
      <li key={i} className="flex gap-2 text-sm text-slate-400">
        <i className="fa-solid fa-circle-check text-teal-500 mt-0.5 text-xs shrink-0"></i>
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

const sections: Section[] = [
  {
    id: 'primeros-pasos',
    icon: '🗺️',
    faIcon: 'map',
    title: 'Guía Rápida — Primeros Pasos',
    content: (
      <div>
        <H3>Cómo navegar el panel</H3>
        <P>El panel de administración se abre desde el mapa principal. En la barra superior verás todas las pestañas disponibles: Dashboard, Inbox, Negocios, Eventos, People, Categorías, Logs y Ayuda.</P>
        <Ul items={[
          'Toca cualquier pestaña para cambiar de sección.',
          'En móvil, la lista de items aparece primero; toca un item para editarlo.',
          'El botón "←" (flecha atrás) cierra el editor y regresa a la lista.',
        ]} />

        <H3>Pestañas principales</H3>
        <div className="mt-2 space-y-2">
          {[
            { tab: 'Dashboard', desc: 'Estadísticas generales: negocios abiertos, verificados, con foto.' },
            { tab: 'Inbox', desc: 'Negocios nuevos que están pendientes de aprobación.' },
            { tab: 'Negocios', desc: 'Lista completa de todos los negocios. Aquí se edita todo.' },
            { tab: 'Eventos', desc: 'Crear y editar eventos del calendario de Cabo Rojo.' },
            { tab: 'Logs', desc: 'Registro de cambios recientes (quién cambió qué).' },
            { tab: 'Ayuda', desc: 'Esta guía que estás leyendo ahora mismo.' },
          ].map(({ tab, desc }) => (
            <div key={tab} className="flex gap-2 text-sm">
              <span className="font-bold text-teal-400 w-24 shrink-0">{tab}</span>
              <span className="text-slate-400">{desc}</span>
            </div>
          ))}
        </div>

        <H3>Cómo cerrar sesión / volver al mapa</H3>
        <P>Toca la "✕" en la esquina superior derecha del panel para cerrarlo y volver al mapa. Tu sesión se mantiene activa aunque cierres el panel.</P>
        <Tip>Si llevas mucho tiempo sin usarlo, puede pedirte que entres de nuevo con tu correo y contraseña.</Tip>
      </div>
    ),
  },
  {
    id: 'negocios',
    icon: '📍',
    faIcon: 'location-dot',
    title: 'Negocios — Cómo Editarlos',
    content: (
      <div>
        <H3>Cómo buscar un negocio</H3>
        <Step num={1}>Ve a la pestaña <strong>Negocios</strong>.</Step>
        <Step num={2}>Escribe el nombre en la barra de búsqueda que aparece arriba de la lista.</Step>
        <Step num={3}>Toca el negocio en la lista para abrirlo y editarlo.</Step>

        <H3>Campos que puedes editar</H3>
        <Ul items={[
          'Nombre del negocio',
          'Categoría (selecciona de la lista)',
          'Teléfono, dirección, horario de atención',
          'Descripción corta del negocio',
          'Foto principal',
          'Coordenadas (lat / lon) — importante para que aparezca en el mapa',
          'Status: open = aparece en el mapa, pending = está oculto',
        ]} />

        <H3>Cómo marcar un negocio como verificado</H3>
        <P>Dentro del editor del negocio, activa el toggle <strong>"Verificado"</strong>. Esto le pone una palomita azul en el mapa y sube su visibilidad en búsquedas.</P>
        <Warning>Un negocio con <code>status = pending</code> NO aparece en el mapa ni en búsquedas, aunque esté verificado. Asegúrate de cambiarlo a <code>open</code>.</Warning>

        <H3>Cambiar la foto de un negocio</H3>
        <Step num={1}>Abre el negocio que quieres editar.</Step>
        <Step num={2}>Busca el campo de foto y toca el botón de subir imagen.</Step>
        <Step num={3}>Selecciona la foto desde tu teléfono o computadora.</Step>
        <Step num={4}>Espera a que suba (verás un spinner). Luego guarda los cambios.</Step>

        <H3>Prioridad editorial</H3>
        <P>Enfócate primero en negocios que son sponsors o candidatos a serlo. Son los que más impacto tienen en los ingresos del directorio.</P>
        <Tip>Sponsors actuales en el bot: <strong>Luis David Refrigeración</strong> y <strong>Marina Puerto Real</strong>. Estos deben tener foto, horario y estar verificados siempre.</Tip>
      </div>
    ),
  },
  {
    id: 'fotos',
    icon: '📸',
    faIcon: 'camera',
    title: 'Fotos — Guía Para Noelia',
    content: (
      <div>
        <P>Las fotos son lo primero que ve la gente. Una buena foto = más clics. Aquí van las reglas.</P>

        <H3>Cómo tomar la foto (desde iPhone)</H3>
        <Ul items={[
          <><strong>Siempre en horizontal (landscape).</strong> Rota el teléfono. Las fotos verticales se ven mal en el directorio.</>,
          <><strong>Muestra la fachada del negocio.</strong> Que se vea el letrero o la entrada principal.</>,
          <><strong>Buena luz: mañana (8–10am) o tarde (4–6pm).</strong> El mediodía tiene sombras fuertes que quedan mal.</>,
          <><strong>Sin personas en primer plano.</strong> La foto es del negocio, no de la gente que está ahí.</>,
          <>Limpia el lente del iPhone antes de disparar. Las manchas de dedos arruinan la foto.</>,
        ]} />

        <H3>Ajustes recomendados en iPhone</H3>
        <Ul items={[
          'Modo foto normal (no retrato, no panorama).',
          'Activa HDR si hay mucha diferencia entre zonas claras y oscuras.',
          'Toca la pantalla en la zona más importante (el letrero) para que el enfoque quede ahí.',
        ]} />

        <H3>Cómo subir la foto al admin</H3>
        <Step num={1}>Abre el negocio en la pestaña Negocios.</Step>
        <Step num={2}>Encuentra el campo de imagen y toca "Subir foto".</Step>
        <Step num={3}>Selecciona la foto desde tu galería.</Step>
        <Step num={4}>Espera a que suba completamente (verás el preview de la foto).</Step>
        <Step num={5}>Toca Guardar.</Step>
        <Tip>El sistema acepta cualquier tamaño. Supabase (donde se guardan las fotos) maneja el almacenamiento automáticamente.</Tip>
        <Warning>Si ves que la foto no aparece después de guardar, verifica que el upload haya terminado antes de guardar. El spinner tiene que desaparecer primero.</Warning>
      </div>
    ),
  },
  {
    id: 'eventos',
    icon: '📅',
    faIcon: 'calendar-days',
    title: 'Eventos — Cómo Agregar',
    content: (
      <div>
        <H3>Cómo crear un evento nuevo</H3>
        <Step num={1}>Ve a la pestaña <strong>Eventos</strong>.</Step>
        <Step num={2}>Toca el botón <strong>"+ Nuevo evento"</strong> o similar en la lista.</Step>
        <Step num={3}>Llena los campos del evento.</Step>
        <Step num={4}>Toca <strong>Guardar</strong>.</Step>

        <H3>Campos importantes</H3>
        <Ul items={[
          <><strong>Título</strong> — Nombre del evento. Claro y corto.</>,
          <><strong>Fecha y hora de inicio</strong> — Cuándo empieza. Requerido.</>,
          <><strong>Fecha y hora de fin</strong> — Cuándo termina (opcional pero recomendado).</>,
          <><strong>Ubicación</strong> — Dirección o nombre del lugar.</>,
          <><strong>Descripción</strong> — Detalles adicionales, link de tickets, etc.</>,
          <><strong>Imagen</strong> — Foto del evento o flyer (opcional).</>,
        ]} />

        <H3>¿Dónde aparecen los eventos?</H3>
        <P>Los eventos aprobados aparecen automáticamente en el mapa de Cabo Rojo y en el calendario del directorio. También pueden ser servidos por El Veci cuando alguien pregunta "¿qué hay este fin de semana?".</P>
        <Tip>Si el evento lo consigues en Facebook (página de Piratas, Marina, etc.), añádelo aquí para que quede registrado en el sistema y el bot pueda responder sobre él.</Tip>
      </div>
    ),
  },
  {
    id: 'equipo',
    icon: '👥',
    faIcon: 'users',
    title: 'Equipo — Gestión de Usuarios',
    content: (
      <div>
        <H3>Administradores actuales</H3>
        <P>Actualmente todos los administradores tienen acceso completo al panel. No hay roles diferenciados todavía.</P>

        <H3>Cómo agregar un nuevo administrador</H3>
        <P>Esto se hace desde Supabase, no desde el panel de admin. Contacta a Angel para agregar un nuevo usuario administrador.</P>

        <H3>Cómo cambiar tu contraseña</H3>
        <Step num={1}>Ve a tu correo y busca un email de recuperación (si lo solicitaste).</Step>
        <Step num={2}>Si no lo recuerdas, contacta a Angel para que haga el reset desde Supabase.</Step>
        <Warning>No compartas tu contraseña. Si crees que alguien más la tiene, pide un reset inmediatamente a Angel.</Warning>

        <H3>Si no puedes entrar</H3>
        <P>Envíale un mensaje a Angel por WhatsApp. El reset de contraseña tarda menos de 5 minutos.</P>
      </div>
    ),
  },
  {
    id: 'herramientas',
    icon: '🔗',
    faIcon: 'link',
    title: 'Herramientas Externas — Lo Que Existe',
    content: (
      <div>
        <H3>Páginas SEO de cada negocio</H3>
        <P>Cada negocio en el directorio tiene su propia página pública en:</P>
        <CodeBlock>{'https://mapadecaborojo.com/negocio/{slug}'}</CodeBlock>
        <P>Usa estos links para compartir con dueños de negocios. La página incluye botón "Verificar mi información" que conecta directamente con El Veci.</P>

        <H3>API pública</H3>
        <P>Cualquier developer puede buscar negocios de Cabo Rojo con:</P>
        <CodeBlock>https://mapadecaborojo.com/api/places?q=pizza</CodeBlock>
        <Ul items={[
          'Gratis, abierta, sin API key requerida.',
          'Devuelve negocios en formato JSON.',
          'Puedes cambiar "pizza" por cualquier término de búsqueda.',
        ]} />

        <H3>Widget para negocios</H3>
        <P>Los negocios pueden poner este código en su propia página web para mostrar su info del directorio:</P>
        <CodeBlock>{'<div data-mapa-place="slug-del-negocio"></div>\n<script src="https://mapadecaborojo.com/widget.js" async></script>'}</CodeBlock>
        <Tip>Reemplaza <code>slug-del-negocio</code> con el slug real del negocio (el que aparece en la URL de su página SEO).</Tip>

        <H3>Feed para AI (llms.txt)</H3>
        <P>ChatGPT, Claude, y otros AI pueden leer este archivo para conocer y recomendar los negocios de Cabo Rojo:</P>
        <CodeBlock>https://mapadecaborojo.com/llms-full.txt</CodeBlock>

        <H3>El Veci — Bot *7711</H3>
        <P>El bot de WhatsApp y SMS conectado al directorio. Los dueños de negocios pueden usarlo para:</P>
        <Ul items={[
          'Textear "RECLAMAR [nombre del negocio]" para iniciar el proceso de verificación.',
          'Actualizar horarios, teléfono, dirección directamente por WhatsApp.',
          'Preguntar sobre otros negocios del área.',
        ]} />
        <P>Número público: <strong>787-417-7711</strong></P>
      </div>
    ),
  },
  {
    id: 'sponsors',
    icon: '💰',
    faIcon: 'dollar-sign',
    title: 'Sponsors — El Pipeline de La Vitrina',
    content: (
      <div>
        <Warning>La Vitrina cuesta <strong>$799/año</strong>. NUNCA $699. Ese precio estaba mal y ya fue corregido.</Warning>

        <H3>Sponsors actuales en el bot (*7711)</H3>
        <Ul items={[
          'Luis David Refrigeración',
          'Marina Puerto Real',
        ]} />
        <P>Estos dos negocios tienen prioridad máxima en búsquedas del bot. Deben tener siempre foto, horario y estar verificados.</P>

        <H3>Cómo funciona el flujo de venta</H3>
        <Step num={1}>Angel le envía al dueño el link de su negocio: <code>mapadecaborojo.com/negocio/{'{slug}'}</code></Step>
        <Step num={2}>El dueño ve su página y toca el botón "Verificar mi información".</Step>
        <Step num={3}>Esto abre El Veci. El bot ofrece La Vitrina automáticamente.</Step>
        <Step num={4}>Angel cierra la venta por WhatsApp (sin llamadas telefónicas).</Step>

        <H3>Qué incluye La Vitrina</H3>
        <Ul items={[
          'Prioridad en resultados de búsqueda del directorio.',
          'Widget embebible para su página web.',
          'Prioridad en respuestas de El Veci (*7711).',
          'Badge de "Sponsor verificado" en su perfil.',
        ]} />

        <Tip>Si un dueño te pregunta por el precio: <strong>$799 al año</strong>, se paga una sola vez. Menos de $67 al mes.</Tip>
      </div>
    ),
  },
  {
    id: 'problemas',
    icon: '🆘',
    faIcon: 'circle-exclamation',
    title: 'Problemas Comunes',
    content: (
      <div>
        <div className="space-y-4 mt-1">
          {[
            {
              problema: 'No puedo entrar al admin',
              solucion: 'Envíale un mensaje a Angel por WhatsApp para hacer reset de contraseña. Tarda menos de 5 minutos.',
            },
            {
              problema: 'La foto no se ve después de subirla',
              solucion: 'Verifica que el spinner de carga haya desaparecido antes de guardar. Si sigue sin verse, entra de nuevo al negocio para confirmar que la URL de la foto quedó guardada.',
            },
            {
              problema: 'El negocio no aparece en el mapa',
              solucion: 'Dos causas comunes: (1) El status está en "pending" — cámbialo a "open". (2) No tiene coordenadas (lat/lon) — agrégalas manualmente o pídele a Angel que las complete.',
            },
            {
              problema: 'El negocio no aparece en búsquedas del mapa',
              solucion: 'Verifica que el campo "visibility" esté en "published". Los negocios con status "open" deben tener visibility "published" o el buscador no los muestra.',
            },
            {
              problema: 'El bot (*7711) no encuentra un negocio',
              solucion: 'El bot tiene su propio sistema de búsqueda distinto al del mapa. Esto lo maneja Angel directamente. Envíale el nombre exacto del negocio que no aparece.',
            },
            {
              problema: 'Guardé cambios pero no se actualizaron',
              solucion: 'Recarga la página y vuelve a abrir el negocio. Si el cambio sí se guardó en el admin pero no en el mapa público, puede ser caché — espera unos minutos o avísale a Angel.',
            },
            {
              problema: 'No sé el slug de un negocio',
              solucion: 'El slug aparece en la URL cuando abres la página pública del negocio: mapadecaborojo.com/negocio/ESTE-ES-EL-SLUG. También puedes buscarlo en el admin — está en el campo "Slug" del editor del negocio.',
            },
          ].map(({ problema, solucion }) => (
            <div key={problema} className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
              <p className="font-bold text-amber-400 text-sm flex items-center gap-2">
                <i className="fa-solid fa-circle-question"></i>
                {problema}
              </p>
              <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{solucion}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 bg-teal-900/20 border border-teal-700/30 rounded-xl p-4">
          <p className="font-bold text-teal-400 text-sm flex items-center gap-2">
            <i className="fa-solid fa-comments"></i>
            ¿El problema no está aquí?
          </p>
          <p className="text-sm text-slate-400 mt-1.5">Envíale un mensaje a Angel por WhatsApp con una captura de pantalla del problema. Así se resuelve más rápido.</p>
        </div>
      </div>
    ),
  },
];

export const HelpCenter: React.FC = () => {
  const [openSection, setOpenSection] = useState<string | null>('primeros-pasos');

  const toggle = (id: string) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto pb-16">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-black text-white flex items-center gap-2">
          <i className="fa-solid fa-circle-question text-teal-500"></i>
          Centro de Ayuda
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Guía de uso del panel de administración de MapaDeCaboRojo — en español, para el equipo.
        </p>
      </div>

      {/* Accordion sections */}
      <div className="space-y-3">
        {sections.map((section) => {
          const isOpen = openSection === section.id;
          return (
            <div
              key={section.id}
              className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden transition-all"
            >
              <button
                onClick={() => toggle(section.id)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/40 transition-colors"
              >
                <span className="flex items-center gap-3 font-bold text-white">
                  <span className="text-lg leading-none">{section.icon}</span>
                  <span className="text-sm">{section.title}</span>
                </span>
                <i
                  className={`fa-solid fa-chevron-down text-slate-500 text-xs transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 border-t border-slate-700/50">
                  <div className="pt-4">{section.content}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-slate-600">
        MapaDeCaboRojo Admin — Ayuda interna para Angel y Noelia
      </div>
    </div>
  );
};
