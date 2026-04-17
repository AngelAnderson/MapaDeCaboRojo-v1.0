
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Place, Collection, Coordinates, Category } from '../types';
import SearchBar from './SearchBar';
import CategoryPills from './CategoryPills';
import { logUserActivity } from '../services/supabase';
import { COLLECTIONS } from '../constants';
import { useLanguage } from '../i18n/LanguageContext';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
import SearchTrends from './SearchTrends';

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
  onSelectCollection?: (collection: Collection | null) => void;
  activeCollectionId?: string | null;
  onCameraClick?: () => void; 
  userLocation?: Coordinates;
  onTabChange: (tabId: string, forceReset?: boolean) => void;
  categories?: Category[];
  showOpenOnly?: boolean;
  onToggleOpenOnly?: () => void;
}

const NEIGHBORHOODS = [
    "Joyuda", "Boquerón", "Puerto Real", "Combate", "Pueblo", "Corozo", "Miradero"
];

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
  onToggleFavorite,
  onSelectCollection,
  activeCollectionId,
  onCameraClick,
  userLocation,
  onTabChange,
  categories,
  showOpenOnly,
  onToggleOpenOnly,
}) => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<'recommended' | 'distance'>('recommended');
  const [activeNeighborhood, setActiveNeighborhood] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasAutoSorted = useRef(false);

  // Reset visible count when filters change
  useEffect(() => { setVisibleCount(50); }, [searchText, activeGroup, activeCollectionId, activeNeighborhood, showOpenOnly]);

  // Auto-sort by distance when location becomes available
  useEffect(() => {
    if (userLocation && !hasAutoSorted.current) {
      setSortBy('distance');
      hasAutoSorted.current = true;
    }
  }, [userLocation]);

  // Load more on scroll near bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) {
      setVisibleCount(prev => prev + 50);
    }
  }, []);

  // Debounced Logging for Search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchText.trim().length > 2) {
        logUserActivity('USER_SEARCH', searchText.trim());
      }
    }, 2000); 

    return () => clearTimeout(delayDebounceFn);
  }, [searchText]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const sortedPlaces = [...places]
    .filter(p => {
        if (!activeNeighborhood) return true;
        const normalizedHood = activeNeighborhood.toLowerCase();
        // Check address or tags for neighborhood name
        return (p.address && p.address.toLowerCase().includes(normalizedHood)) || 
               (p.tags && p.tags.some(t => t.toLowerCase().includes(normalizedHood)));
    })
    .sort((a, b) => {
        if (sortBy === 'distance' && userLocation && a.coords && b.coords) {
            const distA = calculateDistance(userLocation.lat, userLocation.lng, a.coords.lat, a.coords.lng);
            const distB = calculateDistance(userLocation.lat, userLocation.lng, b.coords.lat, b.coords.lng);
            return distA - distB;
        }
        if (a.is_featured === b.is_featured) return 0;
        return a.is_featured ? -1 : 1;
    });

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
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Explorar</h2>
            <div className="flex items-center gap-3">
                {userLocation && (
                    <button 
                        onClick={() => setSortBy(prev => prev === 'recommended' ? 'distance' : 'recommended')}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all flex items-center gap-1 ${sortBy === 'distance' ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}
                    >
                        <i className={`fa-solid ${sortBy === 'distance' ? 'fa-location-crosshairs' : 'fa-star'}`}></i>
                        {sortBy === 'distance' ? t('sort_distance') : t('sort_recommended')}
                    </button>
                )}
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{sortedPlaces.length}</span>
                {/* Close Button */}
                <button 
                  onClick={() => onTabChange('map', false)} 
                  className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-2 rounded-full"
                  aria-label={t('close')}
                >
                    <i className="fa-solid fa-xmark text-xl"></i>
                </button>
            </div>
        </div>
        <SearchBar 
            value={searchText} 
            onChange={onSearchChange} 
            onClear={() => onSearchChange('')} 
            resultCount={resultCount}
            focusTrigger={focusTrigger}
            onCameraClick={onCameraClick}
        />
        <CategoryPills 
            activeGroup={activeGroup} 
            onSelect={(g) => { onCategoryChange(g); if(onSelectCollection) onSelectCollection(null); }} 
            categories={categories} 
        />
        
        {/* Neighborhood Chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -ml-1 pl-1">
            {NEIGHBORHOODS.map(hood => (
                <button
                    key={hood}
                    onClick={() => setActiveNeighborhood(activeNeighborhood === hood ? null : hood)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide border transition-colors whitespace-nowrap ${
                        activeNeighborhood === hood 
                        ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900' 
                        : 'bg-transparent text-slate-500 border-slate-300 dark:border-slate-600 hover:border-slate-400'
                    }`}
                >
                    {hood}
                </button>
            ))}
          {/* Filter pills: Abierto + View toggle */}
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => onToggleOpenOnly?.()}
              className={`flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all ${
                showOpenOnly
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/30'
                  : 'bg-transparent text-slate-500 border-slate-300 dark:border-slate-600 hover:border-emerald-400'
              }`}
            >
              {showOpenOnly ? '🟢' : '⏰'} Abierto
            </button>
            <div className="ml-auto flex gap-1">
              <button onClick={() => setViewMode('list')} className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${viewMode === 'list' ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'text-slate-400'}`}>
                <i className="fa-solid fa-list"></i>
              </button>
              <button onClick={() => setViewMode('grid')} className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${viewMode === 'grid' ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'text-slate-400'}`}>
                <i className="fa-solid fa-grip"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Trends */}
      {activeGroup === 'ALL' && !searchText && !activeNeighborhood && (
        <div className="px-4 shrink-0">
          <SearchTrends onSelectTerm={(term) => onSearchChange(term)} />
        </div>
      )}

      {activeGroup === 'ALL' && !searchText && !activeNeighborhood && (
        <div className="pl-5 pb-2 shrink-0 overflow-x-auto no-scrollbar">
            <div className="flex gap-3 w-max pr-5">
                {COLLECTIONS
                    .filter(col => 
                        !['col-sunset', 'col-foodie', 'col-photo', 'col-family'].includes(col.id)
                    )
                    .map(col => {
                    const isActive = activeCollectionId === col.id;
                    return (
                        <button 
                            key={col.id}
                            onClick={() => onSelectCollection && onSelectCollection(isActive ? null : col)}
                            className={`relative w-40 h-24 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-end p-3 text-left transition-all active:scale-95 border ${isActive ? 'ring-2 ring-teal-500 border-transparent' : 'border-white/20'}`}
                        >
                            <div className={`absolute inset-0 bg-gradient-to-br ${col.color} opacity-90`}></div>
                            <div className="absolute top-2 right-2 text-white/30"><i className={`fa-solid fa-${col.icon} text-3xl`}></i></div>
                            <div className="relative z-10 text-white">
                                <p className="text-[10px] font-bold opacity-80 uppercase tracking-wide">Guía</p>
                                <h3 className="font-bold text-sm leading-tight">{col.title}</h3>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
      )}

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-2 space-y-3 pb-32 mask-image-b">
        {sortedPlaces.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center gap-4">
                <i className="fa-solid fa-map-location-dot text-5xl text-slate-200 dark:text-slate-600"></i>
                <p className="text-base font-bold text-slate-400 dark:text-slate-500">{t('no_results')}</p>
                <button
                    onClick={() => onTabChange('concierge')}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold px-5 py-3 rounded-full shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
                >
                    <i className="fa-solid fa-comments"></i>
                    Pregúntale a El Veci
                </button>
            </div>
        ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-3">
              {sortedPlaces.slice(0, visibleCount).map(place => {
                const isClosed = place.status === 'closed';
                let dist = '';
                if (userLocation && place.coords) {
                  dist = calculateDistance(userLocation.lat, userLocation.lng, place.coords.lat, place.coords.lng).toFixed(1) + ' km';
                }
                return (
                  <button key={place.id} onClick={() => onSelect(place)} className="relative aspect-square rounded-2xl overflow-hidden shadow-sm active:scale-95 transition-transform group">
                    <div className={`absolute inset-0 bg-gradient-to-br from-teal-500 to-cyan-500 ${isClosed ? 'grayscale opacity-70' : ''}`}>
                      {place.imageUrl && (
                        <img src={getOptimizedImageUrl(place.imageUrl, 300)} alt={place.name} className="w-full h-full object-cover" loading="lazy" decoding="async" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      )}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2.5">
                      <h4 className="font-bold text-white text-sm leading-tight truncate">{place.name}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-white/70 font-medium">{place.category}</span>
                        {dist && <span className="text-[10px] text-teal-300 font-bold">• {dist}</span>}
                      </div>
                    </div>
                    {place.is_featured && <div className="absolute top-2 left-2 w-2.5 h-2.5 bg-yellow-400 rounded-full border-2 border-white shadow-sm" />}
                  </button>
                );
              })}
            </div>
        ) : (
            sortedPlaces.slice(0, visibleCount).map(place => {
                const isEvent = place.contact_info?.isEvent === true;
                const isFavorite = savedIds.includes(place.id);
                const isClosed = place.status === 'closed';

                let dist = '';
                if (userLocation && place.coords) {
                    const d = calculateDistance(userLocation.lat, userLocation.lng, place.coords.lat, place.coords.lng);
                    dist = d.toFixed(1) + ' km';
                }

                const fallbackImage = '';

                return (
                    <div key={place.id} onClick={() => onSelect(place)} className="flex items-center gap-4 p-3 pr-4 rounded-[24px] bg-white/50 dark:bg-slate-700/40 hover:bg-white dark:hover:bg-slate-700 active:scale-[0.98] transition-all cursor-pointer border border-white/60 dark:border-slate-600/50 shadow-sm group backdrop-blur-sm relative">
                        <div className={`relative w-20 h-20 shrink-0 rounded-[18px] overflow-hidden bg-gradient-to-br from-teal-500 to-cyan-500 shadow-inner ${isClosed ? 'grayscale opacity-70' : ''}`}>
                            {place.imageUrl && (
                              <img
                                src={getOptimizedImageUrl(place.imageUrl, 200)}
                                className="w-full h-full object-cover"
                                style={{ objectPosition: place.imagePosition || 'center' }}
                                alt={place.name}
                                loading="lazy"
                                decoding="async"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                              />
                            )}
                            {place.is_featured && <div className="absolute top-1 left-1 w-2.5 h-2.5 bg-yellow-400 rounded-full border-2 border-white dark:border-slate-900 shadow-sm"></div>}
                            {isFavorite && <div className="absolute bottom-1 right-1 bg-pink-500 text-white text-[8px] w-5 h-5 flex items-center justify-center rounded-full shadow-md"><i className="fa-solid fa-heart"></i></div>}
                        </div>
                        <div className="flex-1 min-w-0 py-1">
                            <div className="flex justify-between items-start mb-0.5">
                                <h4 className={`font-bold truncate text-[16px] leading-tight ${isClosed ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>{place.name}</h4>
                            </div>
                            
                            {isEvent ? (
                                <p className="text-xs text-purple-600 dark:text-purple-400 font-bold truncate mb-2 uppercase">
                                    <i className="fa-regular fa-calendar mr-1"></i> {place.priceLevel}
                                </p>
                            ) : (
                                <p className="text-xs text-slate-500 dark:text-slate-300 font-medium truncate mb-2 flex items-center gap-2">
                                    <span>{place.category} • {place.priceLevel || '$'}</span>
                                    {dist && <span className="text-teal-600 dark:text-teal-400 font-bold">• {dist}</span>}
                                </p>
                            )}
                            
                            <div className="flex flex-wrap gap-1.5">
                                {isClosed && <span className="text-[9px] bg-red-100/50 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-2 py-0.5 rounded-md font-bold uppercase tracking-wide border border-red-100/50 dark:border-red-800/30">{t('status_closed')}</span>}
                                {place.parking === 'FREE' && <span className="text-[9px] bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md font-bold uppercase tracking-wide border border-emerald-100/50 dark:border-emerald-800/30">{t('free_parking_label')}</span>}
                                {place.is_featured && <span className="text-[9px] bg-amber-100/50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md font-bold uppercase tracking-wide border border-amber-100/50 dark:border-amber-800/30">{t('top_pick')}</span>}
                                {place.hasGenerator && <span className="text-[9px] bg-yellow-100/50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-2 py-0.5 rounded-md font-bold uppercase tracking-wide border border-yellow-100/50 dark:border-yellow-800/30"><i className="fa-solid fa-bolt mr-0.5"></i> {t('generator')}</span>}
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
