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
      color: 'from-brand-500 to-cyan-500',
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
      color: 'from-emerald-500 to-brand-500',
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
    { label: 'Fisiatras', href: '/categoria/fisiatra' },
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
    'tap shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-bold bg-paper border border-line text-ink-soft hover:text-ink hover:border-line-strong transition-colors whitespace-nowrap no-underline';

  return (
    <section
      className="relative surface rounded-2xl shadow-e4 flex flex-col min-h-0 max-h-full overflow-hidden"
      aria-labelledby="pueblo-numeros-title"
    >
      {/* Inner scroll container — header + content scroll together, close button stays accessible */}
      <div className="overflow-y-auto overscroll-contain p-5 md:p-6 min-h-0">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">
            El mapa vivo
          </p>
          <h2
            id="pueblo-numeros-title"
            className="text-2xl md:text-3xl font-black text-ink leading-tight"
            style={{ fontFamily: 'Fraunces, serif' }}
          >
            Pa' poner orden en el revolú de Cabo Rojo
          </h2>
          <p className="text-sm text-ink-soft mt-1">
            Encuentra lugares, negocios, servicios y oportunidades sin perder el día buscando entre screenshots, posts viejos y recomendaciones sueltas.
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="shrink-0 text-ink-muted hover:text-ink w-9 h-9 rounded-full bg-paper-2 flex items-center justify-center"
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
            className="tap group relative overflow-hidden rounded-xl p-3.5 text-left surface-2 hover:shadow-e2 hover:border-line-strong transition-all cursor-pointer block no-underline"
          >
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tile.color} flex items-center justify-center mb-2 shadow-e1`}>
              <i className={`fa-solid fa-${tile.icon} text-sm text-white`} aria-hidden="true"></i>
            </div>
            <div className="font-display text-3xl md:text-4xl font-semibold text-ink leading-none tracking-tight">
              {tile.value.toLocaleString()}
            </div>
            <div className="text-xs font-bold text-ink mt-1.5">{tile.label}</div>
            <div className="text-2xs text-ink-muted leading-snug mt-0.5">{tile.sub}</div>
          </a>
        ))}
      </div>

      {/* Sub-chips Salud */}
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-1.5">
          <i className="fa-solid fa-briefcase-medical text-rose-500 text-xs" aria-hidden="true"></i>
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Salud por especialidad</p>
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
          <i className="fa-solid fa-screwdriver-wrench text-ink-muted text-xs" aria-hidden="true"></i>
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Servicios por categoría</p>
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
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold no-underline transition-colors"
        >
          <i className="fa-solid fa-store text-xs" aria-hidden="true"></i>
          Pon tu negocio en el mapa
        </a>
        <a
          href="/mira-la-vuelta"
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-paper border-2 border-brand-600 text-brand-700 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-paper-2 text-sm font-bold no-underline transition-colors"
        >
          <i className="fa-solid fa-eye text-xs" aria-hidden="true"></i>
          Antes de abrir, mira la vuelta
        </a>
      </div>

      <p className="text-[10px] text-ink-muted mt-3 text-center">
        {stats.sponsorCount + stats.featuredFree > 0 && (
          <span className="mr-2">
            <i className="fa-solid fa-star text-amber-500"></i> {stats.sponsorCount} Vitrina · {stats.featuredFree} recomendados ·{' '}
          </span>
        )}
        Cada número se cuenta solo si está en Cabo Rojo.
      </p>
      <p className="text-[10px] italic text-ink-muted mt-1 text-center">
        Google tiene datos. Facebook tiene ruido. Nosotros tenemos contexto local.
      </p>
      <p className="text-[11px] text-center mt-2">
        <a href="/menos-revolu" className="text-brand-600 dark:text-brand-400 hover:underline font-semibold">
          ¿Qué es esto? Lee la versión corta →
        </a>
      </p>
      </div>
    </section>
  );
};

export default PuebloEnNumeros;
