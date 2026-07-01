import React from 'react';
import { Place } from '../types';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
import { getSponsorTier } from '../utils/sponsorTier';

interface SponsorCarouselProps {
  places: Place[];
  onSelect: (p: Place) => void;
}

// 3-tier visual hierarchy:
//   Vitrina (paid)        — gold border + crown badge + first in row
//   Comp (recommended)    — teal accent + thumbs-up badge
//   Free                  — never appears in the carousel
const SponsorCarousel: React.FC<SponsorCarouselProps> = ({ places, onSelect }) => {
  const sponsors = places
    .filter((p) => p.is_featured === true || (p.plan && p.plan !== 'free'))
    .sort((a, b) => {
      const ta = getSponsorTier(a).tier;
      const tb = getSponsorTier(b).tier;
      // Vitrina (paid) first, then Comp
      const rank = (t: string) => (t === 'vitrina' ? 0 : t === 'comp' ? 1 : 2);
      return rank(ta) - rank(tb);
    });
  if (sponsors.length === 0) return null;

  return (
    <div className="absolute top-32 left-0 right-0 z-[1400] px-4">
      <div className="flex gap-3 overflow-x-auto scrollbar-hide scroll-snap-x pb-2" style={{ scrollSnapType: 'x mandatory' }}>
        {sponsors.slice(0, 10).map((p) => {
          const tier = getSponsorTier(p);
          const isVitrina = tier.tier === 'vitrina';
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className={`relative flex-shrink-0 flex items-center gap-2.5 bg-white/85 dark:bg-slate-800/85 backdrop-blur-md rounded-2xl px-3 py-2.5 shadow-lg ${tier.borderClass} hover:scale-[1.03] active:scale-95 transition-all`}
              style={{ scrollSnapAlign: 'start', minWidth: '180px', maxWidth: '220px' }}
              title={tier.label}
            >
              {isVitrina && (
                <span
                  aria-hidden="true"
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-white text-[10px] font-black flex items-center justify-center shadow-md ring-2 ring-white dark:ring-slate-900"
                >
                  <i className="fa-solid fa-crown"></i>
                </span>
              )}
              <div className={`w-10 h-10 rounded-xl overflow-hidden shrink-0 ${isVitrina ? 'bg-gradient-to-br from-amber-400 to-yellow-500' : 'bg-gradient-to-br from-brand-500 to-cyan-500'}`}>
                {p.imageUrl && (
                  <img src={getOptimizedImageUrl(p.imageUrl, 80)} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="min-w-0 text-left flex-1">
                <div className="font-bold text-xs text-ink truncate">{p.name}</div>
                <div className={`text-[10px] font-bold truncate ${isVitrina ? 'text-amber-600 dark:text-amber-400' : 'text-brand-600 dark:text-brand-400'}`}>
                  {isVitrina ? 'Vitrina' : 'Recom. El Veci'}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SponsorCarousel;
