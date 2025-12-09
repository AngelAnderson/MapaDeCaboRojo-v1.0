
import React, { useState, useEffect } from 'react';
import { Place } from '../types';
import SearchBar from './SearchBar';
import CategoryPills from './CategoryPills';
import { logUserActivity } from '../services/supabase';

interface ExplorerSheetProps {
  places: Place[];
  onSelect: (place: Place) => void;
  isVisible: boolean;
  searchText: string;
  onSearchChange: (text: string) => void;
  resultCount: number;
  activeGroup: string;
  onCategoryChange: (group: string) => void;
  focusTrigger?: number; 
  savedIds?: string[];
  onToggleFavorite?: (id: string) => void;
}

const ExplorerSheet: React.FC<ExplorerSheetProps> = ({ 
  places, 
  onSelect, 
  isVisible,
  searchText,
  onSearchChange,
  resultCount,
  activeGroup,
  onCategoryChange,
  focusTrigger = 0,
  savedIds = [],
  onToggleFavorite
}) => {
  const [expanded, setExpanded] = useState(false);

  // Debounced Logging for Search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchText.trim().length > 2) {
        logUserActivity('USER_SEARCH', searchText.trim());
      }
    }, 2000); // Wait 2 seconds after typing stops

    return () => clearTimeout(delayDebounceFn);
  }, [searchText]);

  useEffect(() => {
    if (isVisible) {
      // Optional reset
    }
  }, [isVisible]);

  return (
    <div 
        className={`fixed left-0 right-0 z-[2000] bg-white/80 dark:bg-slate-800/85 backdrop-blur-xl border-t border-white/60 dark:border-slate-700/50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.3)] rounded-t-[32px] transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1) flex flex-col bottom-0 
        ${isVisible ? 'translate-y-0' : 'translate-y-[120%]'} 
        ${expanded ? 'h-[92vh]' : 'h-[75vh]'}`}
    >
      <div onClick={() => setExpanded(!expanded)} className="w-full flex justify-center pt-4 pb-2 cursor-pointer touch-none active:opacity-50">
        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
      </div>

      <div className="px-5 pb-2 space-y-4 shrink-0">
        <div className="flex justify-between items-baseline">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Explorar</h3>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{resultCount} Lugares</span>
        </div>
        <SearchBar 
            value={searchText} 
            onChange={onSearchChange} 
            onClear={() => onSearchChange('')} 
            resultCount={resultCount}
            focusTrigger={focusTrigger}
        />
        <CategoryPills 
            activeGroup={activeGroup} 
            onSelect={onCategoryChange} 
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 pb-32 mask-image-b">
        {places.length === 0 ? (
            <div className="text-center py-16 opacity-40">
                <i className="fa-solid fa-map-location-dot text-5xl mb-3 text-slate-300 dark:text-slate-500"></i>
                <p className="text-base font-bold text-slate-400 dark:text-slate-500">Sin resultados</p>
            </div>
        ) : (
            places.map(place => {
                const isEvent = place.contact_info?.isEvent === true;
                const isFavorite = savedIds.includes(place.id);

                return (
                    <div key={place.id} onClick={() => onSelect(place)} className="flex items-center gap-4 p-3 pr-4 rounded-[24px] bg-white/50 dark:bg-slate-700/40 hover:bg-white dark:hover:bg-slate-700 active:scale-[0.98] transition-all cursor-pointer border border-white/60 dark:border-slate-600/50 shadow-sm group backdrop-blur-sm relative">
                        <div className="relative w-20 h-20 shrink-0">
                            <img src={place.imageUrl} className="w-full h-full rounded-[18px] object-cover bg-slate-200 dark:bg-slate-700 shadow-inner" alt={place.name} />
                            {place.is_featured && <div className="absolute top-1 left-1 w-2.5 h-2.5 bg-yellow-400 rounded-full border-2 border-white dark:border-slate-900 shadow-sm"></div>}
                            {isFavorite && <div className="absolute bottom-1 right-1 bg-pink-500 text-white text-[8px] w-5 h-5 flex items-center justify-center rounded-full shadow-md"><i className="fa-solid fa-heart"></i></div>}
                        </div>
                        <div className="flex-1 min-w-0 py-1">
                            <div className="flex justify-between items-start mb-0.5">
                                <h4 className="font-bold text-slate-900 dark:text-white truncate text-[16px] leading-tight">{place.name}</h4>
                            </div>
                            
                            {/* Special display for events (Date vs Category) */}
                            {isEvent ? (
                                <p className="text-xs text-purple-600 dark:text-purple-400 font-bold truncate mb-2 uppercase">
                                    <i className="fa-regular fa-calendar mr-1"></i> {place.priceLevel}
                                </p>
                            ) : (
                                <p className="text-xs text-slate-500 dark:text-slate-300 font-medium truncate mb-2">{place.category} • {place.priceLevel || '$'}</p>
                            )}
                            
                            <div className="flex flex-wrap gap-1.5">
                                {place.parking === 'FREE' && <span className="text-[9px] bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md font-bold uppercase tracking-wide border border-emerald-100/50 dark:border-emerald-800/30">Free Parking</span>}
                                {place.is_featured && <span className="text-[9px] bg-amber-100/50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md font-bold uppercase tracking-wide border border-amber-100/50 dark:border-amber-800/30">Top Pick</span>}
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-600/50 flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-slate-500 transition-colors">
                            <i className="fa-solid fa-chevron-right text-slate-400 dark:text-slate-300 text-xs group-hover:text-slate-600 dark:group-hover:text-white"></i>
                        </div>
                    </div>
                );
            })
        )}
      </div>
    </div>
  );
};
export default ExplorerSheet;
