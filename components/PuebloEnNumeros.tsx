import React, { useMemo } from 'react';
import { Place } from '../types';
import { isInCaboRojo } from '../utils/inCaboRojo';

interface Props {
  places: Place[];
  onClose?: () => void;
}

// "Cabo Rojo en Números" — solo cuenta lo que ESTÁ en Cabo Rojo.
// Tiles son <a href> que llevan a páginas server-rendered (api/categoria.ts).
// Sub-chips para Salud y Servicios surface las especialidades directo.
const PuebloEnNumeros: React.FC<Props> = ({ places, onClose }) => {
  const stats = useMemo(() => {
    const cr = places.filter(isInCaboRojo);
    const total = cr.length;

    const byCategory = cr.reduce<Record<string, number>>((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {});

    const sponsorCount = cr.filter((p) => p.plan && p.plan !== 'free').length;
    const featuredFree = cr.filter((p) => p.is_featured && (!p.plan || p.plan === 'free')).length;

    return {
      total,
      sponsorCount,
      featuredFree,
      food: byCategory['FOOD'] || 0,
      lodging: byCategory['LODGING'] || 0,
      beach: byCategory['BEACH'] || 0,
      health: byCategory['HEALTH'] || 0,
      shopping: byCategory['SHOPPING'] || 0,
      sights: byCategory['SIGHTS'] || 0,
      service: byCategory['SERVICE'] || 0,
    };
  }, [places]);

  if (stats.total === 0) return null;

  const tiles: { label: string; value: number; sub: string; icon: string; color: string; href: string }[] = [
    {
      label: 'Negocios en CR',
      value: stats.total,
      sub: 'mapeados en el pueblo',
      icon: 'map-location-dot',
      color: 'from-teal-500 to-cyan-500',
      href: '/pueblo-en-numeros',
    },
    {
      label: 'Comer',
      value: stats.food,
      sub: 'restaurants + panaderías',
      icon: 'utensils',
      color: 'from-orange-500 to-amber-500',
      href: '/categoria/restaurantes',
    },
    {
      label: 'Hospedaje',
      value: stats.lodging,
      sub: 'casas + Airbnb',
      icon: 'bed',
      color: 'from-indigo-500 to-purple-500',
      href: '/categoria/hospedaje',
    },
    {
      label: 'Playas',
      value: stats.beach,
      sub: 'con info de parking + baños',
      icon: 'umbrella-beach',
      color: 'from-sky-500 to-blue-500',
      href: '/categoria/playa',
    },
    {
      label: 'Salud',
      value: stats.health,
      sub: 'farmacias, dentistas, médicos',
      icon: 'briefcase-medical',
      color: 'from-rose-500 to-pink-500',
      href: '/categoria/salud',
    },
    {
      label: 'Compras',
      value: stats.shopping,
      sub: 'boutiques + tiendas',
      icon: 'bag-shopping',
      color: 'from-fuchsia-500 to-pink-500',
      href: '/categoria/compras',
    },
    {
      label: 'Atracciones',
      value: stats.sights,
      sub: 'Faro, Esencia, Cofresí',
      icon: 'binoculars',
      color: 'from-emerald-500 to-teal-500',
      href: '/categoria/turismo',
    },
    {
      label: 'Servicios',
      value: stats.service,
      sub: 'plomero, AC, mecánico, notario',
      icon: 'screwdriver-wrench',
      color: 'from-slate-500 to-zinc-500',
      href: '/categoria/servicios',
    },
  ];

  // Sub-chips: especialidades dentro de Salud y Servicios. Cada uno es un
  // slug que ya existe en api/categoria.ts CATEGORY_MAP (los 6 nuevos de Servicios
  // se agregaron en este mismo PR).
  const saludChips: { label: string; href: string }[] = [
    { label: 'Farmacias', href: '/categoria/farmacia' },
    { label: 'Dentistas', href: '/categoria/dentista' },
    { label: 'Médicos', href: '/categoria/medico' },
    { label: 'Vets', href: '/categoria/veterinario' },
    { label: 'Labs', href: '/categoria/laboratorio' },
    { label: 'Ópticas', href: '/categoria/optica' },
    { label: 'Salud mental', href: '/categoria/salud-mental' },
    { label: 'Quiroprácticos', href: '/categoria/quiropractico' },
  ];

  const serviciosChips: { label: string; href: string }[] = [
    { label: 'Plomero', href: '/categoria/plomero' },
    { label: 'AC', href: '/categoria/ac' },
    { label: 'Mecánico', href: '/categoria/mecanico' },
    { label: 'Eléctrico', href: '/categoria/electrico' },
    { label: 'Notario', href: '/categoria/notario' },
    { label: 'Catering', href: '/categoria/catering' },
  ];

  const chipCls =
    'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/80 dark:bg-slate-800/60 border border-white/60 dark:border-slate-700/50 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all whitespace-nowrap';

  return (
    <section
      className="relative bg-gradient-to-br from-white via-slate-50 to-teal-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-teal-950/30 border border-white/60 dark:border-slate-700/50 rounded-3xl shadow-xl flex flex-col min-h-0 max-h-full overflow-hidden"
      aria-labelledby="pueblo-numeros-title"
    >
      {/* Inner scroll container — header + content scroll together, close button stays accessible */}
      <div className="overflow-y-auto overscroll-contain p-5 md:p-6 min-h-0">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">
            El mapa vivo
          </p>
          <h2
            id="pueblo-numeros-title"
            className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight"
            style={{ fontFamily: 'Fraunces, serif' }}
          >
            Pa' poner orden en el revolú de Cabo Rojo
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Encuentra lugares, negocios, servicios y oportunidades sin perder el día buscando entre screenshots, posts viejos y recomendaciones sueltas.
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="shrink-0 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 w-9 h-9 rounded-full bg-white/60 dark:bg-slate-800/60 flex items-center justify-center"
            aria-label="Cerrar"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {tiles.map((tile) => (
          <a
            key={tile.label}
            href={tile.href}
            className="relative overflow-hidden rounded-2xl p-3 text-left bg-white/80 dark:bg-slate-800/60 backdrop-blur-sm border border-white/60 dark:border-slate-700/50 hover:scale-[1.03] active:scale-95 transition-transform cursor-pointer block no-underline"
          >
            <div className={`absolute -top-2 -right-2 w-12 h-12 rounded-full bg-gradient-to-br ${tile.color} opacity-20`} />
            <i className={`fa-solid fa-${tile.icon} text-base text-slate-400 dark:text-slate-500 mb-1`} aria-hidden="true"></i>
            <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-none" style={{ fontFamily: 'Fraunces, serif' }}>
              {tile.value.toLocaleString()}
            </div>
            <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-1">{tile.label}</div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug mt-0.5">{tile.sub}</div>
          </a>
        ))}
      </div>

      {/* Sub-chips Salud */}
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-1.5">
          <i className="fa-solid fa-briefcase-medical text-rose-500 text-xs" aria-hidden="true"></i>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Salud por especialidad</p>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {saludChips.map((c) => (
            <a key={c.href} href={c.href} className={chipCls}>{c.label}</a>
          ))}
        </div>
      </div>

      {/* Sub-chips Servicios */}
      <div className="mt-3">
        <div className="flex items-center gap-2 mb-1.5">
          <i className="fa-solid fa-screwdriver-wrench text-slate-500 text-xs" aria-hidden="true"></i>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Servicios por categoría</p>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {serviciosChips.map((c) => (
            <a key={c.href} href={c.href} className={chipCls}>{c.label}</a>
          ))}
        </div>
      </div>

      {/* CTA buttons — drive visitors from map exploration to sales pages */}
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <a
          href="/pon-tu-negocio-en-el-mapa"
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold no-underline transition-colors"
        >
          <i className="fa-solid fa-store text-xs" aria-hidden="true"></i>
          Pon tu negocio en el mapa
        </a>
        <a
          href="/mira-la-vuelta"
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border-2 border-teal-600 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-slate-700 text-sm font-bold no-underline transition-colors"
        >
          <i className="fa-solid fa-eye text-xs" aria-hidden="true"></i>
          Antes de abrir, mira la vuelta
        </a>
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-3 text-center">
        {stats.sponsorCount + stats.featuredFree > 0 && (
          <span className="mr-2">
            <i className="fa-solid fa-star text-amber-500"></i> {stats.sponsorCount} Vitrina · {stats.featuredFree} recomendados ·{' '}
          </span>
        )}
        Cada número se cuenta solo si está en Cabo Rojo.
      </p>
      <p className="text-[10px] italic text-slate-500 dark:text-slate-400 mt-1 text-center">
        Google tiene datos. Facebook tiene ruido. Nosotros tenemos contexto local.
      </p>
      <p className="text-[11px] text-center mt-2">
        <a href="/menos-revolu" className="text-teal-600 dark:text-teal-400 hover:underline font-semibold">
          ¿Qué es esto? Lee la versión corta →
        </a>
      </p>
      </div>
    </section>
  );
};

export default PuebloEnNumeros;
