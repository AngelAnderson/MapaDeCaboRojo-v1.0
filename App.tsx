
import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { Place, PlaceCategory, Coordinates, Event, ParkingStatus, Collection } from './types';
import { PLACES as FALLBACK_PLACES, FALLBACK_EVENTS, COLLECTIONS, CABO_ROJO_CENTER, DEFAULT_PLACE_ID, DEFAULT_PLACE_ZOOM } from './constants';
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
import SeoEngine from './components/SeoEngine';

// --- CUSTOM HOOKS (Logic Extraction) ---
import { usePlacesData } from './hooks/usePlacesData';
import { useMapEngine } from './hooks/useMapEngine';
import { useRouter } from './hooks/useRouter';
import { useWeather } from './hooks/useWeather';

// --- MAIN COMPONENT ---

const MainApp: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  
  // Refs
  const mapContainer = useRef<HTMLDivElement>(null);
  
  // Data State - Now includes categories
  const { places, events, categories, publishedPlaces, mappedEvents, loading, refreshData } = usePlacesData();
  const weather = useWeather();
  
  // Favorites State
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cabo_saved_places');
      return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
  });
  
  // UI State
  const [activeTab, setActiveTab] = useState('map');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>('ALL');
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null);
  const [searchText, setSearchText] = useState(''); 
  const [searchFocusTrigger, setSearchFocusTrigger] = useState(0);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  
  // Map State
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite'>('standard');

  // Modal State
  const [isConciergeOpen, setIsConciergeOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false); 
  
  // System State
  const [isVipUnlocked, setIsVipUnlocked] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // --- DERIVED STATE ---
  const filteredList = React.useMemo(() => {
    let list: Place[] = [];
    if (activeCollection) {
        list = [...publishedPlaces, ...mappedEvents].filter(p => activeCollection.placeIds.includes(p.id));
    } else if (activeGroup === 'EVENTS') {
        list = mappedEvents;
    } else if (activeGroup === 'FAVORITES') {
        list = [...publishedPlaces, ...mappedEvents].filter(p => savedIds.includes(p.id));
    } else if (activeGroup === 'ALL') {
        list = publishedPlaces;
    } else {
        // Dynamic Filtering based on Category ID
        list = publishedPlaces.filter(p => p.category === activeGroup);
    }
    if (searchText) {
        const lower = searchText.toLowerCase();
        list = list.filter(p => p.name.toLowerCase().includes(lower) || p.tags?.some(t => t.toLowerCase().includes(lower)));
    }
    return list;
  }, [activeGroup, activeCollection, publishedPlaces, mappedEvents, savedIds, searchText]);

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
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandMenuOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize Map Engine (Pass categories for dynamic colors)
  const { mapLoaded, flyTo, flyHome, showUserLocation, invalidateSize, zoomIn, zoomOut } = useMapEngine( 
    mapContainer,
    isDarkMode,
    mapStyle,
    filteredList,
    (p) => { setSelectedPlace(p); flyTo(p.coords, p.defaultZoom); },
    categories // NEW PROP
  );

  // Initialize Router (Handles all URL state safely)
  useRouter(publishedPlaces, selectedPlace, setSelectedPlace, flyTo);

  // Fix: Map Layout Invalidation
  useEffect(() => {
    if (mapLoaded) invalidateSize();
  }, [mapLoaded, activeTab]);

  // --- HANDLERS ---

  const handleNavigate = () => { 
    if (selectedPlace) window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedPlace.coords.lat},${selectedPlace.coords.lng}`, '_blank'); 
  };

  const centerOnUser = () => { 
    if (!navigator.geolocation) return alert(t('admin_geolocation_not_supported')); 
    navigator.geolocation.getCurrentPosition(
      (pos) => { 
          const { latitude, longitude } = pos.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          flyTo({ lat: latitude, lng: longitude }, 15);
          showUserLocation(latitude, longitude);
      }, 
      (err) => console.error(err), 
      { enableHighAccuracy: true }
    ); 
  };
  
  const handleChatNavigation = (place: Place) => {
      setIsConciergeOpen(false);
      setSelectedPlace(place);
      if (place.coords) flyTo(place.coords, place.defaultZoom || 16); 
  };

  const handleNavAction = (action: string) => {
    if (action === 'add') setIsSuggestOpen(true);
    if (action === 'help') setIsConciergeOpen(true);
    if (action === 'contact') setIsContactOpen(true);
  };

  const handleTabChange = (tabId: string, forceReset: boolean = true) => {
      setActiveTab(tabId);
      if (tabId === 'map') {
          if (forceReset) {
              setActiveGroup('ALL');
              setActiveCollection(null);
              setSearchText('');
              setSelectedPlace(null);
              
              const landingPlace = publishedPlaces.find(p => p.isLanding);
              if (landingPlace && landingPlace.coords) {
                  flyTo(landingPlace.coords, landingPlace.defaultZoom || DEFAULT_PLACE_ZOOM);
              } else {
                  flyHome();
              }
          }
      }
  };

  const handleCommandSelect = (cmdId: string) => {
      switch(cmdId) {
          case 'nav_map': handleTabChange('map'); break;
          case 'nav_explore': handleTabChange('explore'); break;
          case 'action_search': setActiveTab('explore'); setSearchFocusTrigger(prev => prev + 1); break;
          case 'action_add': setIsSuggestOpen(true); break;
          case 'action_chat': setIsConciergeOpen(true); break;
          case 'action_contact': setIsContactOpen(true); break;
          case 'sys_theme': setIsDarkMode(!isDarkMode); break;
          case 'sys_lang': setLanguage(language === 'es' ? 'en' : 'es'); break;
          case 'sys_admin': setIsAdminOpen(true); break;
      }
  };

  const toggleFavorite = (id: string) => {
    setSavedIds(prev => {
        const newIds = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
        localStorage.setItem('cabo_saved_places', JSON.stringify(newIds));
        return newIds;
    });
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden relative bg-slate-50 dark:bg-slate-900 font-sans transition-colors duration-500">
      <div className="noise-overlay"></div>
      
      {/* SEO Engine */}
      <SeoEngine 
        place={selectedPlace} 
        title={selectedPlace ? `${selectedPlace.name} | Cabo Rojo` : undefined}
        description={selectedPlace ? selectedPlace.description : undefined}
        image={selectedPlace ? selectedPlace.imageUrl : undefined}
      />
      
      <header className="absolute top-0 left-0 right-0 z-[1000] p-5 pointer-events-none flex justify-between items-start">
        <WeatherWidget weather={weather} />
        <div className="pointer-events-auto flex flex-col gap-3 items-end">
            <button 
              onClick={() => setMapStyle(prev => prev === 'standard' ? 'satellite' : 'standard')}
              className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-emerald-600 dark:text-emerald-400 p-2.5 rounded-full shadow-lg border border-white/40 dark:border-slate-700 font-bold text-xl hover:scale-105 transition-transform w-10 h-10 flex items-center justify-center mb-0"
              title={mapStyle === 'standard' ? t('satellite_view') : t('map_view')}
            >
              <i className={`fa-solid ${mapStyle === 'standard' ? 'fa-satellite' : 'fa-map'}`}></i>
            </button>
            <button 
              onClick={() => zoomIn()} 
              className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-600 dark:text-slate-400 p-2.5 rounded-full shadow-lg border border-white/40 dark:border-slate-700 font-bold text-xl hover:scale-105 transition-transform w-10 h-10 flex items-center justify-center"
              title={t('zoom_in')}
            >
                <i className="fa-solid fa-plus"></i>
            </button>
            <button 
              onClick={() => zoomOut()} 
              className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-600 dark:text-slate-400 p-2.5 rounded-full shadow-lg border border-white/40 dark:border-slate-700 font-bold text-xl hover:scale-105 transition-transform w-10 h-10 flex items-center justify-center"
              title={t('zoom_out')}
            >
                <i className="fa-solid fa-minus"></i>
            </button>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-amber-500 dark:text-purple-300 p-2.5 rounded-full shadow-lg border border-white/40 dark:border-slate-700 font-bold text-xl hover:scale-105 transition-transform w-10 h-10 flex items-center justify-center">
              <i className={`fa-solid ${isDarkMode ? 'fa-moon' : 'fa-sun'}`}></i>
            </button>
            <button onClick={() => setLanguage(language === 'es' ? 'en' : 'es')} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-800 dark:text-white p-2.5 rounded-full shadow-lg border border-white/40 dark:border-slate-700 font-bold text-[10px] uppercase hover:scale-105 transition-transform w-10 h-10 flex items-center justify-center">{language === 'es' ? 'EN' : 'ES'}</button>
            <button onClick={() => setIsAdminOpen(true)} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-600 dark:text-slate-400 p-2.5 rounded-full shadow-lg border border-white/40 dark:border-slate-700 font-bold text-xl hover:scale-105 transition-transform w-10 h-10 flex items-center justify-center">
              <i className="fa-solid fa-lock"></i>
            </button>
            <button onClick={centerOnUser} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-blue-500 dark:text-blue-400 p-2.5 rounded-full shadow-lg border border-white/40 dark:border-slate-700 font-bold text-xl hover:scale-105 transition-transform w-10 h-10 flex items-center justify-center">
                <i className="fa-solid fa-location-crosshairs"></i>
            </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative w-full h-full">
        <div ref={mapContainer} className="absolute inset-0 z-0 bg-slate-200 dark:bg-slate-800 transition-colors" />
      </main>

      {/* Sheets & Modals */}
      <ExplorerSheet 
        places={filteredList} 
        onSelect={(p) => { 
            setSelectedPlace(p); 
            flyTo(p.coords, p.defaultZoom);
            handleTabChange('map', false); // Switch to map tab, but DO NOT reset map position
        }} 
        isVisible={activeTab === 'explore'} 
        searchText={searchText}
        onSearchChange={setSearchText}
        resultCount={filteredList.length}
        activeGroup={activeGroup}
        onCategoryChange={setActiveGroup}
        focusTrigger={searchFocusTrigger}
        savedIds={savedIds}
        onToggleFavorite={toggleFavorite}
        onSelectCollection={setActiveCollection}
        activeCollectionId={activeCollection?.id}
        onCameraClick={() => { setIsConciergeOpen(true); }}
        userLocation={userLocation || undefined}
        onTabChange={handleTabChange}
        categories={categories} // NEW PROP
      />

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} onAction={handleNavAction} />

      {selectedPlace && (
        <PlaceCard 
            place={selectedPlace} 
            allPlaces={publishedPlaces} 
            onSelect={(p) => { setSelectedPlace(p); flyTo(p.coords, p.defaultZoom); }} 
            onClose={() => setSelectedPlace(null)} 
            onNavigate={handleNavigate}
            onAskAi={() => setIsConciergeOpen(true)}
            onSuggestEdit={() => { setIsContactOpen(true); }}
            isFavorite={savedIds.includes(selectedPlace.id)}
            onToggleFavorite={() => toggleFavorite(selectedPlace.id)}
            userLocation={userLocation || undefined}
        />
      )}

      <Concierge 
        isOpen={isConciergeOpen} 
        onClose={() => setIsConciergeOpen(false)} 
        places={publishedPlaces} 
        events={events} 
        onNavigateToPlace={handleChatNavigation}
        userLocation={userLocation || undefined}
        weather={weather}
      />
      
      <SuggestPlaceModal isOpen={isSuggestOpen} onClose={() => setIsSuggestOpen(false)} />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} onSuggest={() => { setIsContactOpen(false); setIsSuggestOpen(true); }} onChat={() => { setIsContactOpen(false); setIsConciergeOpen(true); }} />
      {isAdminOpen && <Admin onClose={() => setIsAdminOpen(false)} places={places} events={events} categories={categories} onUpdate={refreshData} />}
      <CommandMenu isOpen={isCommandMenuOpen} onClose={() => setIsCommandMenuOpen(false)} onSelect={handleCommandSelect} isDarkMode={isDarkMode} />

    </div>
  );
};

export default MainApp;
