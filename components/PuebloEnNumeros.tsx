import React, { useMemo } from 'react';
import { Place } from '../types';
import { isInCaboRojo } from '../utils/inCaboRojo';

interface Props {
  places: Place[];
  onClose?: () => void;
  onJumpToCategory?: (categoryId: string) => void;
}

// "Cabo Rojo en Números" — solo cuenta lo que ESTÁ en Cabo Rojo.
// La DB del Mapa cubre todo PR; este panel filtra por bbox + barrios.
// Tiles drilldownables sin auto-dismiss del panel.
const PuebloEnNumeros: React.FC<Props> = ({ places, onClose, onJumpToCategory }) => {
  const stats = useMemo(() => {
    const cr = places.filter(isInCaboRojo);
    const total = cr.length;

    const byCategory = cr.reduce<Record<string, number>>((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {});

    const pharmacies = byCategory['HEALTH'] || 0;
    const food = byCategory['FOOD'] || 0;
    const lodging = byCategory['LODGING'] || 0;
    const beach = byCategory['BEACH'] || 0;
    const sights = byCategory['SIGHTS'] || 0;
    const shopping = byCategory['SHOPPING'] || 0;
    const service = byCategory['SERVICE'] || 0;
    const nightlife = byCategory['NIGHTLIFE'] || 0;

    const sponsorCount = cr.filter((p) => p.plan && p.plan !== 'free').length;
    const featuredFree = cr.filter((p) => p.is_featured && (!p.plan || p.plan === 'free')).length;

    return {
      total,
      sponsorCount,
      featuredFree,
      pharmacies,
      food,
      lodging,
      beach,
      sights,
      shopping,
      service,
      nightlife,
    };
  }, [places]);

  if (stats.total === 0) return null;

  const tiles: { label: string; value: number; sub: string; icon: string; color: string; categoryId?: string }[] = [
    {
      label: 'Negocios en CR',
      value: stats.total,
      sub: 'mapeados en el pueblo',
      icon: 'shop',
      color: 'from-teal-500 to-cyan-500',
    },
    {
      label: 'Comer',
      value: stats.food,
      sub: 'restaurants + panaderías',
      icon: 'utensils',
      color: 'from-orange-500 to-amber-500',
      categoryId: 'FOOD',
    },
    {
      label: 'Hospedaje',
      value: stats.lodging,
      sub: 'casas + Airbnb',
      icon: 'bed',
      color: 'from-indigo-500 to-purple-500',
      categoryId: 'LODGING',
    },
    {
      label: 'Playas',
      value: stats.beach,
      sub: 'con info de parking + baños',
      icon: 'umbrella-beach',
      color: 'from-sky-500 to-blue-500',
      categoryId: 'BEACH',
    },
    {
      label: 'Salud',
      value: stats.pharmacies,
      sub: 'farmacias, dentistas, médicos',
      icon: 'pills',
      color: 'from-rose-500 to-pink-500',
      categoryId: 'HEALTH',
    },
    {
      label: 'Compras',
      value: stats.shopping,
      sub: 'boutiques + tiendas',
      icon: 'bag-shopping',
      color: 'from-fuchsia-500 to-pink-500',
      categoryId: 'SHOPPING',
    },
    {
      label: 'Atracciones',
      value: stats.sights,
      sub: 'Faro, Esencia, Cofresí',
      icon: 'binoculars',
      color: 'from-emerald-500 to-teal-500',
      categoryId: 'SIGHTS',
    },
    {
      label: 'Servicios',
      value: stats.service,
      sub: 'plomero, AC, mecánico, notario',
      icon: 'screwdriver-wrench',
      color: 'from-slate-500 to-zinc-500',
      categoryId: 'SERVICE',
    },
  ];

  return (
    <section
      className="relative bg-gradient-to-br from-white via-slate-50 to-teal-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-teal-950/30 border border-white/60 dark:border-slate-700/50 rounded-3xl shadow-xl p-5 md:p-6"
      aria-labelledby="pueblo-numeros-title"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">
            Solo lo que está en Cabo Rojo
          </p>
          <h2
            id="pueblo-numeros-title"
            className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight"
            style={{ fontFamily: 'Fraunces, serif' }}
          >
            Cabo Rojo en números reales
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Math, no chismes. Toca un número pa' ver la lista.
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
        {tiles.map((tile) => {
          const clickable = !!tile.categoryId && !!onJumpToCategory;
          const Tag: any = clickable ? 'button' : 'div';
          return (
            <Tag
              key={tile.label}
              onClick={clickable ? () => onJumpToCategory!(tile.categoryId!) : undefined}
              className={`relative overflow-hidden rounded-2xl p-3 text-left bg-white/80 dark:bg-slate-800/60 backdrop-blur-sm border border-white/60 dark:border-slate-700/50 ${
                clickable ? 'hover:scale-[1.03] active:scale-95 transition-transform cursor-pointer' : ''
              }`}
            >
              <div className={`absolute -top-2 -right-2 w-12 h-12 rounded-full bg-gradient-to-br ${tile.color} opacity-20`} />
              <i className={`fa-solid fa-${tile.icon} text-base text-slate-400 dark:text-slate-500 mb-1`} aria-hidden="true"></i>
              <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-none" style={{ fontFamily: 'Fraunces, serif' }}>
                {tile.value.toLocaleString()}
              </div>
              <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-1">{tile.label}</div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug mt-0.5">{tile.sub}</div>
            </Tag>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-3 text-center">
        {stats.sponsorCount + stats.featuredFree > 0 && (
          <span className="mr-2">
            <i className="fa-solid fa-star text-amber-500"></i> {stats.sponsorCount} Vitrina · {stats.featuredFree} recomendados ·{' '}
          </span>
        )}
        Cada número se cuenta solo si está en Cabo Rojo.
      </p>
    </section>
  );
};

export default PuebloEnNumeros;
