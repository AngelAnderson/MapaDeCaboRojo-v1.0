import React, { useMemo } from 'react';
import { Place } from '../types';
import { getFreshnessTier } from '../utils/freshness';

interface Props {
  places: Place[];
  onClose?: () => void;
  onJumpToCategory?: (categoryId: string) => void;
}

// "Cabo Rojo en Números" — homepage hero that proves the substrate.
// Computed in-memory from publishedPlaces; no extra fetch needed.
// Counters answer: "Is this thing real and maintained, or another dead directory?"
const PuebloEnNumeros: React.FC<Props> = ({ places, onClose, onJumpToCategory }) => {
  const stats = useMemo(() => {
    const total = places.length;
    const verified = places.filter((p) => p.isVerified || p.verified_at).length;
    const freshCount = places.filter((p) => getFreshnessTier(p.verified_at, p.isVerified).tier === 'fresh').length;
    const sponsorCount = places.filter((p) => p.plan && p.plan !== 'free').length;
    const featuredFree = places.filter((p) => p.is_featured && (!p.plan || p.plan === 'free')).length;

    // Category counts
    const byCategory = places.reduce<Record<string, number>>((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {});

    const pharmacies = byCategory['HEALTH'] || 0;
    const food = byCategory['FOOD'] || 0;
    const lodging = byCategory['LODGING'] || 0;
    const beach = byCategory['BEACH'] || 0;

    const verifiedPct = total > 0 ? Math.round((verified / total) * 100) : 0;
    const freshPct = total > 0 ? Math.round((freshCount / total) * 100) : 0;

    return {
      total,
      verified,
      verifiedPct,
      freshCount,
      freshPct,
      sponsorCount,
      featuredFree,
      pharmacies,
      food,
      lodging,
      beach,
    };
  }, [places]);

  if (stats.total === 0) return null;

  const tiles: { label: string; value: string | number; sub: string; icon: string; color: string; categoryId?: string }[] = [
    {
      label: 'Negocios',
      value: stats.total.toLocaleString(),
      sub: 'mapeados en el pueblo',
      icon: 'shop',
      color: 'from-teal-500 to-cyan-500',
    },
    {
      label: 'Verificados',
      value: `${stats.verifiedPct}%`,
      sub: `${stats.verified.toLocaleString()} a pie, no scraped`,
      icon: 'circle-check',
      color: 'from-emerald-500 to-green-500',
    },
    {
      label: 'Frescos <90d',
      value: stats.freshCount.toLocaleString(),
      sub: `${stats.freshPct}% revisados últimos 3 meses`,
      icon: 'sparkles',
      color: 'from-lime-500 to-emerald-500',
    },
    {
      label: 'Farmacias',
      value: stats.pharmacies,
      sub: 'NPI federal cleaned',
      icon: 'pills',
      color: 'from-rose-500 to-pink-500',
      categoryId: 'HEALTH',
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
      sub: 'casas + Airbnb verificados',
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
      label: 'Sponsors',
      value: stats.sponsorCount + stats.featuredFree,
      sub: `${stats.sponsorCount} Vitrina + ${stats.featuredFree} comp`,
      icon: 'star',
      color: 'from-yellow-500 to-amber-500',
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
            Substrate cívico verificado
          </p>
          <h2
            id="pueblo-numeros-title"
            className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight"
            style={{ fontFamily: 'Fraunces, serif' }}
          >
            Cabo Rojo en números reales
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Verificados a pie. Math, no chismes.
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
                {tile.value}
              </div>
              <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-1">{tile.label}</div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug mt-0.5">{tile.sub}</div>
            </Tag>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-3 text-center">
        Cada número se revisa a pie. <span className="underline">/errores</span> documenta lo que sale mal.
      </p>
    </section>
  );
};

export default PuebloEnNumeros;
