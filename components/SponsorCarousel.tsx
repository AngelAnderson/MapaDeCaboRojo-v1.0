import React from 'react';
import { Place } from '../types';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';

interface SponsorCarouselProps {
  places: Place[];
  onSelect: (p: Place) => void;
}

const SponsorCarousel: React.FC<SponsorCarouselProps> = ({ places, onSelect }) => {
  const sponsors = places.filter(p => p.is_featured === true || (p.plan && p.plan !== 'free'));
  if (sponsors.length === 0) return null;

  return (
    <div className="absolute top-32 left-0 right-0 z-[1400] px-4">
      <div className="flex gap-3 overflow-x-auto scrollbar-hide scroll-snap-x pb-2" style={{ scrollSnapType: 'x mandatory' }}>
        {sponsors.slice(0, 10).map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className="flex-shrink-0 flex items-center gap-2.5 bg-white/85 dark:bg-slate-800/85 backdrop-blur-md rounded-2xl px-3 py-2.5 shadow-lg border border-white/60 dark:border-slate-700/50 hover:scale-[1.03] active:scale-95 transition-all"
            style={{ scrollSnapAlign: 'start', minWidth: '160px', maxWidth: '200px' }}
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-teal-500 to-cyan-500">
              {p.imageUrl && (
                <img src={getOptimizedImageUrl(p.imageUrl, 80)} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
              )}
            </div>
            <div className="min-w-0 text-left">
              <div className="font-bold text-xs text-slate-800 dark:text-white truncate">{p.name}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{p.category}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SponsorCarousel;
