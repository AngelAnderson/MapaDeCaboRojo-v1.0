import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { Place, PlaceCategory, Coordinates, Event } from './types';
import { PLACES as FALLBACK_PLACES, CABO_ROJO_CENTER, DEFAULT_PLACE_ID } from './constants';
import PlaceCard from './components/PlaceCard';
import Concierge from './components/Concierge';
import Admin from './components/Admin';
import ContactModal from './components/ContactModal';
import SuggestPlaceModal from './components/SuggestPlaceModal'; 
import WeatherWidget from './components/WeatherWidget'; 
import { getPlaces, getEvents } from './services/supabase'; 
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import ExplorerSheet from './components/ExplorerSheet';
import BottomNav from './components/BottomNav';
import CommandMenu from './components/CommandMenu';

// --- CONSTANTS & HELPERS (Pure Functions) ---

const CATEGORY_COLORS: Record<string, string> = {
  [PlaceCategory.BEACH]: '#FF9500', // Orange
  [PlaceCategory.FOOD]: '#FF3B30', // Red
  [PlaceCategory.SIGHTS]: '#007AFF', // Blue
  [PlaceCategory.NIGHTLIFE]: '#AF52DE', // Purple
  [PlaceCategory.LODGING]: '#5AC8FA', // Teal/Cyan
  [PlaceCategory.HEALTH]: '#FF2D55', // Pink
  [PlaceCategory.SERVICE]: '#8E8E93', // Gray
  [PlaceCategory.LOGISTICS]: '#FFCC00', // Yellow
  DEFAULT: '#8E8E93'
};

const getMarkerColor = (cat: PlaceCategory): string => { 
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS.DEFAULT;
};

const getSmartIcon = (place: Place): string => {
    if (place.customIcon) return place.customIcon;
    const lowerName = place.name.toLowerCase();
    
    // Keyword-based icon overrides
    const iconMap: Record<string, string> = {
      'hospital': 'fa-hospital',
      'farmacia': 'fa-pills',
      'policia': 'fa-shield-halved',
      'mechanic': 'fa-wrench',
      'gasolina': 'fa-gas-pump',
      'pizza': 'fa-pizza-slice',
      'coffee': 'fa-mug-hot',
      'burger': 'fa-burger'
    };

    for (const key in iconMap) {
      if (lowerName.includes(key)) return iconMap[key];
    }
    
    // Category-based fallbacks
    switch (place.category) { 
        case PlaceCategory.BEACH: return 'fa-umbrella-beach'; 
        case PlaceCategory.FOOD: return 'fa-utensils'; 
        case PlaceCategory.SIGHTS: return 'fa-camera'; 
        case PlaceCategory.LOGISTICS: return 'fa-gas-pump'; 
        case PlaceCategory.LODGING: return 'fa-bed'; 
        case PlaceCategory.NIGHTLIFE: return 'fa-champagne-glasses'; 
        case PlaceCategory.HEALTH: return 'fa-heart-pulse';
        case PlaceCategory.SHOPPING: return 'fa-bag-shopping';
        case PlaceCategory.ACTIVITY: return 'fa-person-hiking';
        default: return 'fa-location-dot'; 
    }
};

/**
 * Generates the HTML string for a Leaflet DivIcon.
 * Keeps the main component code clean from template literals.
 */
const generateMarkerHtml = (place: Place, isMarina: boolean): string => {
  if (isMarina) {
    return `
      <div class="premium-pulse rounded-full" style="width: 50px; height: 50px; position: absolute; top: -5px; left: -5px; z-index: 0;"></div>
      <div class="premium-shine" style="width: 40px; height: 40px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2.5px solid white; display: flex; align-items: center; justify-content: center; position: relative; z-index: 10;">
          <i class="fa-solid fa-anchor text-white" style="transform: rotate(45deg); font-size: 18px; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.2));"></i>
      </div>
    `;
  }

  const catColor = getMarkerColor(place.category);
  const iconClass = getSmartIcon(place);

  return `
    <div style="width: 36px; height: 36px; background: ${catColor}; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.2); cursor: pointer; transition: transform 0.2s ease;">
      <i class="fa-solid ${iconClass} text-white" style="transform: rotate(45deg); font-size: 15px;"></i>
    </div>
  `;
};

const CATEGORY_GROUPS = {
  ALL: { categories: 'ALL' },
  EXPLORA: { categories: [PlaceCategory.BEACH, PlaceCategory.SIGHTS, PlaceCategory.ACTIVITY] },
  COMIDA: { categories: [PlaceCategory.FOOD, PlaceCategory.NIGHTLIFE] },
  HOSPEDAJE: { categories: [PlaceCategory.LODGING] },
  SERVICIOS: { categories: [PlaceCategory.LOGISTICS, PlaceCategory.SHOPPING, PlaceCategory.HEALTH, PlaceCategory.SERVICE] },
  EVENTOS: { categories: 'EVENTS' } 
};

// --- MAIN COMPONENT ---

const MainApp: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  
  // Refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tileLayer = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const boatMarkerRef = useRef<L.Marker | null>(null);
  const requestRef = useRef<number>(0);
  
  // Data State
  const [places, setPlaces] = useState<Place[]>(FALLBACK_PLACES);
  const [events, setEvents] = useState<Event[]>([]); 
  const [filteredList, setFilteredList] = useState<Place[]>([]);
  
  // UI State
  const [activeTab, setActiveTab] = useState('map');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>('ALL');
  const [searchText, setSearchText] = useState(''); 
  const [searchFocusTrigger, setSearchFocusTrigger] = useState(0);
  const [resultCount, setResultCount] = useState(0); 
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);

  // Modal State
  const [isConciergeOpen, setIsConciergeOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false); 
  
  // System State
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isVipUnlocked, setIsVipUnlocked] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // --- EFFECTS ---

  // VIP Check
  useEffect(() => { 
    const vip = localStorage.getItem('cabo_vip_status'); 
    if (vip === 'unlocked') setIsVipUnlocked(true); 
  }, []);

  // Theme Manager
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Command Menu with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandMenuOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initial Data Fetch & FlyTo
  const fetchRealData = async () => {
      console.log("Fetching real data from Supabase...");
      const realPlaces = await getPlaces();
      if (realPlaces.length > 0) setPlaces(realPlaces);
      const realEvents = await getEvents();
      if (realEvents.length > 0) setEvents(realEvents);
      return realPlaces;
  };

  useEffect(() => {
    const initData = async () => {
        const realPlaces = await fetchRealData();
        let initialPlace = realPlaces.find(p => p.id === DEFAULT_PLACE_ID);
        if (!initialPlace && realPlaces.length > 0) initialPlace = realPlaces.find(p => p.is_featured);
        if (!initialPlace) initialPlace = FALLBACK_PLACES.find(p => p.id === DEFAULT_PLACE_ID);

        if (initialPlace && map.current && initialPlace.coords) {
            setTimeout(() => {
                map.current?.flyTo([initialPlace!.coords.lat, initialPlace!.coords.lng], 16, { duration: 3, easeLinearity: 0.25 });
            }, 800);
        }
    };
    if (mapLoaded) initData();
  }, [mapLoaded]);

  // Map Initialization
  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    try {
        map.current = L.map(mapContainer.current, { center: [CABO_ROJO_CENTER.lat, CABO_ROJO_CENTER.lng], zoom: 13, zoomControl: false, attributionControl: false });
        map.current.on('moveend', () => { /* Optional: Update bounds state if needed */ });
        setMapLoaded(true);
    } catch (error) { console.error("Map failed", error); }
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  // --- FIX: Map Layout Invalidation (Prevents Grey Tiles) ---
  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    // Force map to recalculate container size after render
    const timer = setTimeout(() => {
        map.current?.invalidateSize();
    }, 200);

    const handleResize = () => {
        map.current?.invalidateSize();
    };

    window.addEventListener('resize', handleResize);
    return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', handleResize);
    };
  }, [mapLoaded]);

  // Map Tile Manager
  useEffect(() => {
      if (!map.current) return;
      if (tileLayer.current) tileLayer.current.remove();

      const lightTiles = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      const darkTiles = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      
      tileLayer.current = L.tileLayer(isDarkMode ? darkTiles : lightTiles, { 
          attribution: '&copy; OpenStreetMap & CARTO',
          maxZoom: 20 
      }).addTo(map.current);

  }, [isDarkMode, mapLoaded]);

  // Boat Animation
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    
    // --- UPDATED COORDINATES FOR MARINA PUERTO REAL (User Provided) ---
    // Dock (The Pier): 18.0750, -67.1886
    const DOCK_POS = { lat: 18.0750, lng: -67.1886 }; 
    // Sea (Start): Adjusted - Added 50m South West offset to previous correction
    // Previous (100m SW): 18.0741, -67.1895
    // New (Approx 150m SW): 
    const SEA_POS = { lat: 18.0736, lng: -67.1900 };
    
    // We add an ID to the icon so we can flip it via CSS based on direction
    const boatHtml = `
      <div id="animated-boat" class="animate-bob transition-transform duration-700 ease-in-out" style="font-size: 28px; color: #007AFF; filter: drop-shadow(0 4px 8px rgba(0,122,255,0.4));">
        <i class="fa-solid fa-sailboat"></i>
      </div>
    `;

    const boatIcon = L.divIcon({ 
      className: 'bg-transparent', 
      html: boatHtml, 
      iconSize: [30, 30],
      iconAnchor: [15, 15] // Center it
    });
    
    // Start at sea
    boatMarkerRef.current = L.marker([SEA_POS.lat, SEA_POS.lng], { icon: boatIcon, interactive: false, zIndexOffset: 50 }).addTo(map.current);
    
    const animateBoat = (time: number) => {
        // We use sine wave to oscillate between Sea (0) and Dock (1)
        // We shift phase by -PI/2 so at time=0 we are at -1 (which maps to 0 after normalized), i.e., at Sea.
        // As time increases, we go to 1 (Dock), then back to 0 (Sea).
        const phase = (Math.sin(time / 3000 - Math.PI / 2) + 1) / 2; 
        
        const lat = SEA_POS.lat + (DOCK_POS.lat - SEA_POS.lat) * phase;
        const lng = SEA_POS.lng + (DOCK_POS.lng - SEA_POS.lng) * phase;
        
        if (boatMarkerRef.current) {
            boatMarkerRef.current.setLatLng([lat, lng]);
            
            // Determine direction:
            // The derivative of sin(t) is cos(t).
            // cos(time/3000 - PI/2) = sin(time/3000).
            // If sin > 0, we are moving towards Dock (0->1).
            // If sin < 0, we are moving towards Sea (1->0).
            const isMovingToDock = Math.sin(time / 3000) > 0;

            const el = document.getElementById('animated-boat');
            if (el) {
                // If moving to dock (South East), we want the boat to face right-ish. 
                // fa-sailboat usually points Left. So scaleX(-1) makes it point Right.
                el.style.transform = isMovingToDock ? 'scaleX(-1)' : 'scaleX(1)';
            }
        }
        requestRef.current = requestAnimationFrame(animateBoat);
    };
    requestRef.current = requestAnimationFrame(animateBoat);
    
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [mapLoaded]);

  // Filtering & Marker Rendering Logic
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    
    // 1. Filter Places
    // @ts-ignore
    const groupDef = CATEGORY_GROUPS[activeGroup] || CATEGORY_GROUPS['ALL'];
    let filtered: Place[] = [];
    
    if (groupDef.categories === 'EVENTS') {
        // Events filtering logic placeholders if needed
    } else {
        filtered = groupDef.categories === 'ALL' 
          ? places 
          : places.filter(p => (groupDef.categories as PlaceCategory[]).includes(p.category));
    }

    if (searchText.trim()) {
        const lower = searchText.toLowerCase();
        filtered = places.filter(p => 
          p.name.toLowerCase().includes(lower) || 
          p.description.toLowerCase().includes(lower) || 
          p.tags?.some(t => t.toLowerCase().includes(lower))
        );
    }
    
    setFilteredList(filtered); 
    setResultCount(filtered.length);
    
    // 2. Render Markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    filtered.forEach(place => {
      if (!place.coords.lat || !place.coords.lng) return;

      const isMarina = place.id === DEFAULT_PLACE_ID; 
      const html = generateMarkerHtml(place, isMarina);
      const size: L.PointTuple = [40, 40];
      const anchor: L.PointTuple = [20, 40];

      const icon = L.divIcon({ className: 'custom-pin group', html: html, iconSize: size, iconAnchor: anchor });
      
      const marker = L.marker([place.coords.lat, place.coords.lng], { 
        icon: icon, 
        zIndexOffset: isMarina ? 1000 : 0 
      }).addTo(map.current!);
      
      marker.on('click', (e) => { 
        L.DomEvent.stopPropagation(e); 
        setSelectedPlace(place); 
        map.current?.flyTo([place.coords.lat, place.coords.lng], 16, { duration: 1.2, easeLinearity: 0.2 }); 
      });
      
      markersRef.current.push(marker);
    });

  }, [activeGroup, mapLoaded, places, events, language, searchText, isVipUnlocked]); 


  // --- HANDLERS ---

  const handleNavigate = () => { 
    if (selectedPlace) window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedPlace.coords.lat},${selectedPlace.coords.lng}`, '_blank'); 
  };

  const centerOnUser = () => { 
    if (!navigator.geolocation) return alert("Geolocation not supported"); 
    navigator.geolocation.getCurrentPosition(
      (pos) => { 
        map.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 15); 
      }, 
      (err) => console.error(err), 
      { enableHighAccuracy: true }
    ); 
  };
  
  // Magic Link Handler for Chat
  const handleChatNavigation = (place: Place) => {
      setIsConciergeOpen(false);
      setSelectedPlace(place);
      if (place.coords && map.current) {
          map.current.flyTo([place.coords.lat, place.coords.lng], 16, { duration: 1.5 });
      }
  };

  const handleNavAction = (action: string) => {
    if (action === 'add') setIsSuggestOpen(true);
    if (action === 'help') setIsConciergeOpen(true);
    if (action === 'contact') setIsContactOpen(true);
  };

  const handleTabChange = (tabId: string) => {
      setActiveTab(tabId);
      if (tabId === 'map') {
          // RESET: Show all pins and clear search
          setActiveGroup('ALL');
          setSearchText('');
          
          if (map.current) {
              map.current.flyTo([CABO_ROJO_CENTER.lat, CABO_ROJO_CENTER.lng], 13, { duration: 1.5 });
          }
      }
  };

  const handleCommandSelect = (cmdId: string) => {
      switch(cmdId) {
          case 'nav_map': handleTabChange('map'); break;
          case 'nav_explore': handleTabChange('explore'); break;
          case 'action_search': 
            setActiveTab('explore');
            setSearchFocusTrigger(prev => prev + 1);
            break;
          case 'action_add': setIsSuggestOpen(true); break;
          case 'action_chat': setIsConciergeOpen(true); break;
          case 'action_contact': setIsContactOpen(true); break;
          case 'sys_theme': toggleTheme(); break;
          case 'sys_lang': setLanguage(language === 'es' ? 'en' : 'es'); break;
          case 'sys_admin': setIsAdminOpen(true); break;
      }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden relative bg-slate-50 dark:bg-slate-900 font-sans transition-colors duration-500">
      <div className="noise-overlay"></div>
      
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-[1000] p-5 pointer-events-none flex justify-between items-start">
        <WeatherWidget />
        <div className="pointer-events-auto flex flex-col gap-3 items-end">
            <button onClick={toggleTheme} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-amber-500 dark:text-purple-300 p-2.5 rounded-full shadow-lg border border-white/40 dark:border-slate-700 font-bold text-xl hover:scale-105 transition-transform w-10 h-10 flex items-center justify-center">
              <i className={`fa-solid ${isDarkMode ? 'fa-moon' : 'fa-sun'}`}></i>
            </button>
            <button onClick={() => setLanguage(language === 'es' ? 'en' : 'es')} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-800 dark:text-white p-2.5 rounded-full shadow-lg border border-white/40 dark:border-slate-700 font-bold text-[10px] uppercase hover:scale-105 transition-transform w-10 h-10 flex items-center justify-center">{language === 'es' ? 'EN' : 'ES'}</button>
            <button onClick={() => setIsAdminOpen(true)} className="bg-slate-900/80 dark:bg-slate-800/80 backdrop-blur-md text-white w-10 h-10 rounded-full flex items-center justify-center text-xs hover:bg-black transition-colors shadow-lg"><i className="fa-solid fa-lock"></i></button>
        </div>
      </div>
      
      {/* Map Container */}
      <div ref={mapContainer} className="flex-1 w-full h-full focus:outline-none relative z-0 bg-slate-100 dark:bg-slate-800" />
      
      {/* User Location FAB */}
      <div className="absolute right-5 bottom-[100px] z-[1000]">
        <button onClick={centerOnUser} className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md text-blue-600 dark:text-blue-400 w-12 h-12 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.15)] flex items-center justify-center border border-white dark:border-slate-700 active:scale-95 transition-transform">
          <i className="fa-solid fa-location-crosshairs text-xl"></i>
        </button>
      </div>

      {/* Interface Elements */}
      <ExplorerSheet 
        places={filteredList} 
        onSelect={(p) => setSelectedPlace(p)} 
        isVisible={activeTab === 'explore'}
        searchText={searchText}
        onSearchChange={setSearchText}
        resultCount={resultCount}
        activeGroup={activeGroup}
        onCategoryChange={(g) => { setActiveGroup(g); setSearchText(''); }}
        focusTrigger={searchFocusTrigger}
      />

      <BottomNav 
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
        onAction={handleNavAction} 
      />

      {/* Modals & Overlays */}
      <CommandMenu 
        isOpen={isCommandMenuOpen} 
        onClose={() => setIsCommandMenuOpen(false)} 
        onSelect={handleCommandSelect}
        isDarkMode={isDarkMode}
      />

      {selectedPlace && <div className="z-[3100] relative"><PlaceCard place={selectedPlace} onClose={() => setSelectedPlace(null)} onNavigate={handleNavigate} onAskAi={() => { setSelectedPlace(null); setIsConciergeOpen(true); }} onSuggestEdit={() => { setSelectedPlace(null); setIsSuggestOpen(true); }} /></div>}
      
      <div className="z-[3200] relative"><Concierge isOpen={isConciergeOpen} onClose={() => setIsConciergeOpen(false)} places={places} events={events} onNavigateToPlace={handleChatNavigation} /></div>
      <div className="z-[3200] relative"><ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} onSuggest={() => { setIsContactOpen(false); setIsSuggestOpen(true); }} /></div>
      <div className="z-[3300] relative"><SuggestPlaceModal isOpen={isSuggestOpen} onClose={() => setIsSuggestOpen(false)} /></div>
      
      {isAdminOpen && <div className="z-[3500] relative"><Admin onClose={() => setIsAdminOpen(false)} places={places} onUpdate={fetchRealData} /></div>}
    </div>
  );
};

const App: React.FC = () => { return <LanguageProvider><MainApp /></LanguageProvider>; };
export default App;