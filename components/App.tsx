
import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { Place, PlaceCategory, Coordinates, Event, ParkingStatus, Collection } from '../types';
import { PLACES as FALLBACK_PLACES, FALLBACK_EVENTS, COLLECTIONS, CABO_ROJO_CENTER, DEFAULT_PLACE_ID, DEFAULT_PLACE_ZOOM } from '../constants';
import PlaceCard from './PlaceCard';
import Concierge from './Concierge';
import Admin from './Admin';
import ContactModal from './ContactModal';
import SuggestPlaceModal from './SuggestPlaceModal'; 
import SuggestPage from './SuggestPage'; 
import AboutPage from './AboutPage'; // Import Component
import WeatherWidget from './WeatherWidget'; 
import { getPlaces, getEvents, checkEmergencyMode, getEmergencyPlaces } from '../services/supabase';
import { LanguageProvider, useLanguage } from '../i18n/LanguageContext';
import ExplorerSheet from './ExplorerSheet';
import BottomNav from './BottomNav';
import CommandMenu from './CommandMenu';
import SeoEngine from './SeoEngine';

// --- CUSTOM HOOKS (Logic Extraction) ---
import { usePlacesData } from '../hooks/usePlacesData';
import { useMapEngine } from '../hooks/useMapEngine';
import { useRouter } from '../hooks/useRouter';
import { useWeather } from '../hooks/useWeather';

// --- MAP APPLICATION COMPONENT ---
// This contains the heavy logic for the map view
const MapApp: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  
  // Refs
  const mapContainer = useRef<HTMLDivElement>(null);
  
  // Data State
  const { places, events, categories, people, publishedPlaces, mappedEvents, loading, refreshData } = usePlacesData();
  const weather = useWeather(); // Centralized Weather
  
  // Favorites State
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cabo_saved_places');
      return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
  });
  
  // Smart Sorting Logic
  const getSmartCategory = () => {
      const h = new Date().getHours();
      if (h >= 5 && h < 11) return 'FOOD';
      if (h >= 11 && h < 18) return 'BEACH';
      if (h >= 18 || h < 5) return 'NIGHTLIFE';
      return 'ALL';
  };

  // UI State
  const [activeTab, setActiveTab] = useState('map');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>(() => getSmartCategory());
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null);
  const [searchText, setSearchText] = useState('');
  const [searchFocusTrigger, setSearchFocusTrigger] = useState(0);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [isMapMenuOpen, setIsMapMenuOpen] = useState(false);

  // Emergency Mode State
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [emergencyMessage, setEmergencyMessage] = useState('Modo de Emergencia Activo');

  useEffect(() => {
    // Check URL param first (?emergency=on activates locally)
    const params = new URLSearchParams(window.location.search);
    if (params.get('emergency') === 'on') {
      setEmergencyMode(true);
      return;
    }
    // Then check Supabase config
    checkEmergencyMode().then(cfg => {
      if (cfg.is_active) {
        setEmergencyMode(true);
        setEmergencyMessage(cfg.message || 'Modo de Emergencia Activo');
      }
    });
  }, []);

  // Offline State
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
      };
  }, []);
  
  // Map State
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite'>('standard');

  // Modal State
  const [isConciergeOpen, setIsConciergeOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false); 
  const [isAboutOpen, setIsAboutOpen] = useState(false); // NEW: About State
  
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
    // Emergency mode: only show essential services
    if (emergencyMode) {
      return getEmergencyPlaces(publishedPlaces);
    }
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
  }, [emergencyMode, activeGroup, activeCollection, publishedPlaces, mappedEvents, savedIds, searchText]);

  // --- EFFECTS ---
  useEffect(() => { 
    const vip = localStorage.getItem('cabo_vip_status'); 
    if (vip === 'unlocked') setIsVipUnlocked(true); 
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

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

  // Close 3-dot menu on outside click
  useEffect(() => {
    if (!isMapMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.relative')) setIsMapMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isMapMenuOpen]);

  // Initialize Map Engine
  const { mapLoaded, flyTo, flyHome, showUserLocation, invalidateSize, zoomIn, zoomOut } = useMapEngine( 
    mapContainer,
    isDarkMode,
    mapStyle,
    filteredList,
    (p) => { setSelectedPlace(p); if (p.coords) flyTo(p.coords, p.defaultZoom); },
    categories
  );

  // Initialize Router
  useRouter(
    publishedPlaces, 
    selectedPlace, 
    setSelectedPlace, 
    flyTo,
    (action) => {
      // 'suggest' action in map view opens the modal
      if (action === 'suggest') setIsSuggestOpen(true);
      // 'about' action opens the overlay
      if (action === 'about') setIsAboutOpen(true);
    }
  );

  useEffect(() => {
    if (mapLoaded) invalidateSize();
  }, [mapLoaded, activeTab]);

  const handleNavigate = () => { 
    if (selectedPlace && selectedPlace.coords) window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedPlace.coords.lat},${selectedPlace.coords.lng}`, '_blank');
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
          case 'action_about': setIsAboutOpen(true); break; // UPDATED
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

      {/* Emergency Mode Banner */}
      {emergencyMode && (
        <div className="absolute top-0 left-0 right-0 z-[2000] bg-red-600 text-white px-4 py-2 flex flex-col items-center gap-1 shadow-lg">
          <div className="flex items-center gap-2 font-bold text-sm">
            <i className="fa-solid fa-triangle-exclamation animate-pulse"></i>
            <span>🚨 {emergencyMessage} — Solo servicios esenciales</span>
            <button
              onClick={() => setEmergencyMode(false)}
              className="ml-2 text-white/70 hover:text-white text-xs underline"
              title="Salir del modo emergencia"
            >
              Salir
            </button>
          </div>
          <div className="flex gap-4 text-xs font-medium">
            <a href="tel:911" className="flex items-center gap-1 hover:underline"><i className="fa-solid fa-phone"></i> 911 Emergencias</a>
            <a href="tel:18006247420" className="flex items-center gap-1 hover:underline"><i className="fa-solid fa-house-flood-water"></i> FEMA 1-800-621-3362</a>
            <a href="tel:7872598520" className="flex items-center gap-1 hover:underline"><i className="fa-solid fa-heart-pulse"></i> Cruz Roja PR 787-259-8520</a>
          </div>
        </div>
      )}

      <SeoEngine
        place={selectedPlace} 
        title={selectedPlace ? `${selectedPlace.name} | Cabo Rojo` : undefined}
        description={selectedPlace ? selectedPlace.description : undefined}
        image={selectedPlace ? selectedPlace.imageUrl : undefined}
      />
      
      <header className={`absolute left-0 right-0 z-[1000] px-5 pb-5 pointer-events-none flex justify-between items-start ${emergencyMode ? 'top-[72px] pt-4' : 'top-0 pt-20 md:pt-10'}`}>
        <WeatherWidget weather={weather} />
        <div className="pointer-events-auto flex flex-col gap-3 items-end">
            {isOffline && (
                <div className="bg-amber-500/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg border border-white/40 animate-pulse" title="Signal Saver Mode (Offline)">
                    OFFLINE
                </div>
            )}
            {/* GPS location button */}
            <button onClick={centerOnUser} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-blue-500 dark:text-blue-400 p-2.5 rounded-full shadow-lg border border-white/40 dark:border-slate-700 font-bold text-xl hover:scale-105 transition-transform w-10 h-10 flex items-center justify-center" title="Mi ubicación"><i className="fa-solid fa-location-crosshairs"></i></button>
            {/* 3-dot menu button */}
            <div className="relative">
              <button onClick={() => setIsMapMenuOpen(prev => !prev)} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-600 dark:text-slate-400 p-2.5 rounded-full shadow-lg border border-white/40 dark:border-slate-700 font-bold text-xl hover:scale-105 transition-transform w-10 h-10 flex items-center justify-center" title="Opciones"><i className="fa-solid fa-ellipsis-vertical"></i></button>
              {isMapMenuOpen && (
                <div className="absolute right-0 top-12 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/40 dark:border-slate-700 py-2 min-w-[160px] z-50 animate-fade-in">
                  <button onClick={() => { setMapStyle(prev => prev === 'standard' ? 'satellite' : 'standard'); setIsMapMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <i className={`fa-solid ${mapStyle === 'standard' ? 'fa-satellite' : 'fa-map'} text-emerald-600 dark:text-emerald-400 w-4`}></i>
                    <span>{mapStyle === 'standard' ? 'Vista satélite' : 'Vista mapa'}</span>
                  </button>
                  <button onClick={() => { setIsDarkMode(!isDarkMode); setIsMapMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'} text-amber-500 dark:text-purple-300 w-4`}></i>
                    <span>{isDarkMode ? 'Modo claro' : 'Modo oscuro'}</span>
                  </button>
                  <button onClick={() => { setLanguage(language === 'es' ? 'en' : 'es'); setIsMapMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <i className="fa-solid fa-language text-slate-500 dark:text-slate-400 w-4"></i>
                    <span>{language === 'es' ? 'Switch to English' : 'Cambiar a español'}</span>
                  </button>
                </div>
              )}
            </div>
        </div>
      </header>

      <main className="flex-1 relative w-full h-full">
        <div ref={mapContainer} className="absolute inset-0 z-0 bg-slate-200 dark:bg-slate-800 transition-colors" />
      </main>

      <ExplorerSheet places={filteredList} onSelect={(p) => { setSelectedPlace(p); if (p.coords) flyTo(p.coords, p.defaultZoom); handleTabChange('map', false); }} isVisible={activeTab === 'explore'} searchText={searchText} onSearchChange={setSearchText} resultCount={filteredList.length} activeGroup={activeGroup} onCategoryChange={setActiveGroup} focusTrigger={searchFocusTrigger} savedIds={savedIds} onToggleFavorite={toggleFavorite} onSelectCollection={setActiveCollection} activeCollectionId={activeCollection?.id} onCameraClick={() => { setIsConciergeOpen(true); }} userLocation={userLocation || undefined} onTabChange={handleTabChange} categories={categories} />
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} onAction={handleNavAction} />
      
      {selectedPlace && <PlaceCard place={selectedPlace} allPlaces={publishedPlaces} onSelect={(p) => { setSelectedPlace(p); if (p.coords) flyTo(p.coords, p.defaultZoom); }} onClose={() => setSelectedPlace(null)} onNavigate={handleNavigate} onAskAi={() => setIsConciergeOpen(true)} onSuggestEdit={() => { setIsContactOpen(true); }} isFavorite={savedIds.includes(selectedPlace.id)} onToggleFavorite={() => toggleFavorite(selectedPlace.id)} userLocation={userLocation || undefined} />}
      
      <Concierge 
        isOpen={isConciergeOpen} 
        onClose={() => setIsConciergeOpen(false)} 
        places={publishedPlaces} 
        events={events} 
        people={people} // Pass people data to Concierge
        onNavigateToPlace={handleChatNavigation}
        userLocation={userLocation || undefined}
        weather={weather}
      />
      
      <SuggestPlaceModal isOpen={isSuggestOpen} onClose={() => setIsSuggestOpen(false)} />
      
      {/* MODALS */}
      <ContactModal 
        isOpen={isContactOpen} 
        onClose={() => setIsContactOpen(false)} 
        onSuggest={() => { setIsContactOpen(false); setIsSuggestOpen(true); }} 
        onChat={() => { setIsContactOpen(false); setIsConciergeOpen(true); }}
        onAbout={() => { setIsContactOpen(false); setIsAboutOpen(true); }} // Added Handler
      />
      
      {isAdminOpen && <Admin onClose={() => setIsAdminOpen(false)} places={places} events={events} categories={categories} onUpdate={refreshData} />}
      
      {/* About Page Overlay */}
      <AboutPage isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      
      <CommandMenu isOpen={isCommandMenuOpen} onClose={() => setIsCommandMenuOpen(false)} onSelect={handleCommandSelect} isDarkMode={isDarkMode} />
    </div>
  );
};

// --- ROOT ROUTER COMPONENT ---
const App: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<'map' | 'suggest'>('map');

  useEffect(() => {
    const checkRoute = () => {
      if (typeof window === 'undefined') return;
      const searchParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      const path = window.location.pathname;

      if (searchParams.get('page') === 'suggest' || hash.includes('page=suggest') || path === '/suggest') {
        setCurrentRoute('suggest');
      } else {
        setCurrentRoute('map');
      }
    };
    checkRoute();
    window.addEventListener('popstate', checkRoute);
    window.addEventListener('hashchange', checkRoute);
    return () => {
      window.removeEventListener('popstate', checkRoute);
      window.removeEventListener('hashchange', checkRoute);
    };
  }, []);

  if (currentRoute === 'suggest') {
    return <SuggestPage />;
  }
  
  return <MapApp />;
};

export default App;
