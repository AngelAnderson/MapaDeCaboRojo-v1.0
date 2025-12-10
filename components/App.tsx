
import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { Place, PlaceCategory, Coordinates, Event, ParkingStatus, Collection } from '../types';
import { PLACES as FALLBACK_PLACES, FALLBACK_EVENTS, COLLECTIONS, CABO_ROJO_CENTER, DEFAULT_PLACE_ID } from '../constants';
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

const getMarkerColor = (cat: PlaceCategory | string): string => { 
  return CATEGORY_COLORS[cat as string] || CATEGORY_COLORS.DEFAULT;
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

  const isClosed = place.status === 'closed';
  // Use Grey (#64748b - slate-500) for closed places, otherwise use category color
  const catColor = isClosed ? '#64748b' : getMarkerColor(place.category);
  const iconClass = getSmartIcon(place);

  return `
    <div style="width: 36px; height: 36px; background: ${catColor}; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.2); cursor: pointer; transition: transform 0.2s ease;">
      <i class="fa-solid ${iconClass} text-white" style="transform: rotate(45deg); font-size: 15px; opacity: ${isClosed ? '0.7' : '1'};"></i>
    </div>
  `;
};

// Haversine Distance Helper (km)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

const CATEGORY_GROUPS = {
  ALL: { categories: 'ALL' },
  EXPLORA: { categories: [PlaceCategory.BEACH, PlaceCategory.SIGHTS, PlaceCategory.ACTIVITY] },
  COMIDA: { categories: [PlaceCategory.FOOD, PlaceCategory.NIGHTLIFE] },
  HOSPEDAJE: { categories: [PlaceCategory.LODGING] },
  SERVICIOS: { categories: [PlaceCategory.LOGISTICS, PlaceCategory.SHOPPING, PlaceCategory.HEALTH, PlaceCategory.SERVICE] },
  EVENTOS: { categories: 'EVENTS' },
  FAVORITOS: { categories: 'FAVORITES' }
};

// --- MAIN COMPONENT ---

const MainApp: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  
  // Refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tileLayer = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const userLocMarkerRef = useRef<L.Marker | null>(null); // New Ref for User Location
  const boatMarkerRef = useRef<L.Marker | null>(null);
  const requestRef = useRef<number>(0);
  
  // Data State
  const [places, setPlaces] = useState<Place[]>(FALLBACK_PLACES);
  const [events, setEvents] = useState<Event[]>(FALLBACK_EVENTS); 
  const [filteredList, setFilteredList] = useState<Place[]>([]);
  
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
  const [resultCount, setResultCount] = useState(0); 
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

  const toggleFavorite = (id: string) => {
    setSavedIds(prev => {
        const newIds = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
        localStorage.setItem('cabo_saved_places', JSON.stringify(newIds));
        return newIds;
    });
  };

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

  // --- DEEP LINKING & URL STATE ---
  
  // 1. On Load: Check URL for ?place=slug
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const placeSlug = params.get('place');
    if (placeSlug && places.length > 0) {
        const found = places.find(p => p.slug === placeSlug || p.id === placeSlug);
        if (found) {
            setSelectedPlace(found);
            // Fly to it
            if (map.current && found.coords) {
                 setTimeout(() => {
                    map.current?.flyTo([found.coords.lat, found.coords.lng], 16, { duration: 1.5 });
                 }, 1000);
            }
        }
    }
  }, [places]);

  // 2. On Selection: Update URL (Deep Link)
  useEffect(() => {
    if (selectedPlace) {
        const url = new URL(window.location.href);
        url.searchParams.set('place', selectedPlace.slug || selectedPlace.id);
        window.history.pushState({}, '', url);
    } else {
        const url = new URL(window.location.href);
        url.searchParams.delete('place');
        window.history.pushState({}, '', url);
    }
  }, [selectedPlace]);

  // 3. Handle Browser Back Button
  useEffect(() => {
    const handlePopState = () => {
        const params = new URLSearchParams(window.location.search);
        const placeSlug = params.get('place');
        if (!placeSlug) {
            setSelectedPlace(null);
        } else {
            const found = places.find(p => p.slug === placeSlug || p.id === placeSlug);
            if (found) setSelectedPlace(found);
        }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [places]);


  // Initial Data Fetch & FlyTo
  const fetchRealData = async () => {
      console.log("Fetching real data from Supabase...");
      const realPlaces = await getPlaces();
      if (realPlaces.length > 0) setPlaces(realPlaces);
      
      const realEvents = await getEvents();
      if (realEvents.length > 0) {
        setEvents(realEvents);
      }
      return realPlaces;
  };

  useEffect(() => {
    const initData = async () => {
        const realPlaces = await fetchRealData();
        
        // Initial fly logic (only if no URL param)
        const params = new URLSearchParams(window.location.search);
        if (!params.get('place')) {
            let initialPlace = realPlaces.find(p => p.id === DEFAULT_PLACE_ID);
            if (!initialPlace && realPlaces.length > 0) initialPlace = realPlaces.find(p => p.is_featured);
            if (!initialPlace) initialPlace = FALLBACK_PLACES.find(p => p.id === DEFAULT_PLACE_ID);

            if (initialPlace && map.current && initialPlace.coords) {
                setTimeout(() => {
                    map.current?.flyTo([initialPlace!.coords.lat, initialPlace!.coords.lng], 16, { duration: 3, easeLinearity: 0.25 });
                }, 800);
            }
        }
    };
    if (mapLoaded) initData();
  }, [mapLoaded]);

  // Try to get location on mount silently
  useEffect(() => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                setUserLocation({ lat: latitude, lng: longitude });
            },
            () => {}, // ignore error
            { enableHighAccuracy: false }
        );
    }
  }, []);

  // Map Initialization
  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    try {
        map.current = L.map(mapContainer.current, { 
            center: [CABO_ROJO_CENTER.lat, CABO_ROJO_CENTER.lng], 
            zoom: 13, 
            zoomControl: false, 
            attributionControl: false,
            zoomSnap: 0.1, 
            zoomDelta: 0.5, 
            wheelPxPerZoomLevel: 3, 
            inertia: true,
            inertiaDeceleration: 3500, 
            easeLinearity: 0.2 
        });
        map.current.on('moveend', () => { /* Optional: Update bounds state if needed */ });
        setMapLoaded(true);
    } catch (error) { console.error("Map failed", error); }
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  // Fix: Map Layout Invalidation
  useEffect(() => {
    if (!mapLoaded || !map.current) return;
    const timer = setTimeout(() => { map.current?.invalidateSize(); }, 200);
    const handleResize = () => { map.current?.invalidateSize(); };
    window.addEventListener('resize', handleResize);
    return () => { clearTimeout(timer); window.removeEventListener('resize', handleResize); };
  }, [mapLoaded]);

  // Map Tile Manager (Standard vs Satellite)
  useEffect(() => {
      if (!map.current) return;
      if (tileLayer.current) tileLayer.current.remove();

      let tileUrl = '';
      let attribution = '';

      if (mapStyle === 'satellite') {
          // ESRI World Imagery
          tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
          attribution = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
      } else {
          // Standard CartoDB (Light/Dark)
          const lightTiles = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
          const darkTiles = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
          tileUrl = isDarkMode ? darkTiles : lightTiles;
          attribution = '&copy; OpenStreetMap & CARTO';
      }
      
      tileLayer.current = L.tileLayer(tileUrl, { 
          attribution,
          maxZoom: 19 // ESRI allows usually up to 19 or higher
      }).addTo(map.current);

  }, [isDarkMode, mapLoaded, mapStyle]);

  // Boat Animation
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const DOCK_POS = { lat: 18.0750, lng: -67.1886 }; 
    const SEA_POS = { lat: 18.0736, lng: -67.1900 };
    const boatHtml = `
      <div id="animated-boat" class="animate-bob transition-transform duration-700 ease-in-out" style="font-size: 28px; color: #007AFF; filter: drop-shadow(0 4px 8px rgba(0,122,255,0.4));">
        <i class="fa-solid fa-sailboat"></i>
      </div>
    `;
    const boatIcon = L.divIcon({ className: 'bg-transparent', html: boatHtml, iconSize: [30, 30], iconAnchor: [15, 15] });
    boatMarkerRef.current = L.marker([SEA_POS.lat, SEA_POS.lng], { icon: boatIcon, interactive: false, zIndexOffset: 50 }).addTo(map.current);
    
    const animateBoat = (time: number) => {
        const phase = (Math.sin(time / 3000 - Math.PI / 2) + 1) / 2; 
        const lat = SEA_POS.lat + (DOCK_POS.lat - SEA_POS.lat) * phase;
        const lng = SEA_POS.lng + (DOCK_POS.lng - SEA_POS.lng) * phase;
        if (boatMarkerRef.current) {
            boatMarkerRef.current.setLatLng([lat, lng]);
            const isMovingToDock = Math.sin(time / 3000) > 0;
            const el = document.getElementById('animated-boat');
            if (el) el.style.transform = isMovingToDock ? 'scaleX(-1)' : 'scaleX(1)';
        }
        requestRef.current = requestAnimationFrame(animateBoat);
    };
    requestRef.current = requestAnimationFrame(animateBoat);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [mapLoaded]);

  // Filtering & Marker Rendering Logic
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    
    // @ts-ignore
    const groupDef = CATEGORY_GROUPS[activeGroup] || CATEGORY_GROUPS['ALL'];
    let filtered: Place[] = [];
    
    // Helper to map Events to Places
    const mappedEvents = events.map(e => ({
        id: e.id,
        name: e.title,
        slug: `event-${e.id}`,
        description: e.description,
        category: e.category as unknown as PlaceCategory,
        coords: e.coords || { lat: 0, lng: 0 },
        imageUrl: e.imageUrl || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=1000',
        videoUrl: '',
        website: '',
        phone: '',
        address: e.locationName,
        gmapsUrl: e.mapLink || '',
        customIcon: 'fa-calendar-check',
        status: 'open',
        plan: 'free',
        sponsor_weight: e.isFeatured ? 100 : 50,
        is_featured: e.isFeatured,
        tags: ['Evento', e.category],
        parking: ParkingStatus.FREE,
        hasRestroom: true,
        hasShowers: false,
        tips: `Horario: ${new Date(e.startTime).toLocaleTimeString([], {hour:'numeric', minute:'2-digit', hour12:true})}`,
        priceLevel: new Date(e.startTime).toLocaleDateString([], {month:'short', day:'numeric'}), 
        bestTimeToVisit: 'A tiempo',
        vibe: ['Social', 'Comunidad'],
        isPetFriendly: true,
        isHandicapAccessible: true,
        isVerified: true,
        opening_hours: { note: new Date(e.startTime).toLocaleString() },
        contact_info: { 
            eventStart: e.startTime, 
            eventEnd: e.endTime,
            isEvent: true 
        }
    } as Place));

    // Base Filter: Only show published places (Verified and Open/Closed) - Pending are hidden
    const publishedPlaces = places.filter(p => p.status !== 'pending' && p.isVerified);

    if (activeCollection) {
        // COLLECTION MODE
        const allItems = [...publishedPlaces, ...mappedEvents];
        filtered = allItems.filter(p => activeCollection.placeIds.includes(p.id));
    } else if (groupDef.categories === 'EVENTS') {
        filtered = mappedEvents;
    } else if (groupDef.categories === 'FAVORITES') {
        const allItems = [...publishedPlaces, ...mappedEvents];
        filtered = allItems.filter(p => savedIds.includes(p.id));
    } else {
        filtered = groupDef.categories === 'ALL' 
          ? publishedPlaces 
          : publishedPlaces.filter(p => (groupDef.categories as PlaceCategory[]).includes(p.category));
    }

    if (searchText.trim()) {
        const lower = searchText.toLowerCase();
        filtered = filtered.filter(p => 
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
    
    const bounds = L.latLngBounds([]);

    filtered.forEach(place => {
      if (!place.coords.lat || !place.coords.lng) return;
      bounds.extend([place.coords.lat, place.coords.lng]);

      const isMarina = place.id === DEFAULT_PLACE_ID; 
      const html = generateMarkerHtml(place, isMarina);
      const size: L.PointTuple = [40, 40];
      const anchor: L.PointTuple = [20, 40];

      const icon = L.divIcon({ className: 'custom-pin group', html: html, iconSize: size, iconAnchor: anchor });
      
      const marker = L.marker([place.coords.lat, place.coords.lng], { 
        icon: icon, 
        zIndexOffset: isMarina ? 1000 : 0 
      }).addTo(map.current!);
      
      const tooltipContent = `
        <div class="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-2xl rounded-xl px-4 py-2 text-center transform transition-all min-w-[140px] -translate-y-1">
          <div class="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight mb-1">${place.name}</div>
          <div class="flex items-center justify-center gap-2 text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
              <span>${place.category}</span>
              <span class="text-teal-500">•</span>
              <span>${place.priceLevel || 'Free'}</span>
          </div>
          ${place.status === 'closed' ? '<div class="mt-1 text-[10px] font-bold text-red-500 bg-red-100 dark:bg-red-900/30 rounded px-1">CERRADO</div>' : ''}
        </div>
      `;

      marker.bindTooltip(tooltipContent, {
        direction: 'top',
        offset: [0, -50], // Shifted slightly higher to clear the pin head
        className: 'custom-tooltip',
        opacity: 1,
        permanent: false 
      });

      marker.on('click', (e) => { 
        L.DomEvent.stopPropagation(e); 
        setSelectedPlace(place); 
        map.current?.flyTo([place.coords.lat, place.coords.lng], 16, { duration: 1.2, easeLinearity: 0.2 }); 
      });
      
      markersRef.current.push(marker);
    });
    
    // --- SMART ZOOM (Fit Bounds) ---
    // Automatically zoom to show all results if filter changed, unless it's just a text search (too jumpy)
    if (filtered.length > 0 && map.current && !selectedPlace && !searchText) {
        // Add padding so pins aren't on the edge
        map.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true, duration: 1.5 });
    }

  }, [activeGroup, mapLoaded, places, events, language, searchText, isVipUnlocked, savedIds, activeCollection]); 

  // --- HANDLERS ---

  const handleNavigate = () => { 
    if (selectedPlace) window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedPlace.coords.lat},${selectedPlace.coords.lng}`, '_blank'); 
  };

  const centerOnUser = () => { 
    if (!navigator.geolocation) return alert("Geolocation not supported"); 
    navigator.geolocation.getCurrentPosition(
      (pos) => { 
          const { latitude, longitude } = pos.coords;
          setUserLocation({ lat: latitude, lng: longitude });

          // Fly to user
          map.current?.flyTo([latitude, longitude], 15);
          
          // Add User Marker if not exists
          if (!userLocMarkerRef.current && map.current) {
               const userIconHtml = `
                <div class="relative w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md">
                    <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75"></div>
                </div>
               `;
               const userIcon = L.divIcon({ className: 'bg-transparent', html: userIconHtml, iconSize: [20, 20] });
               userLocMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon, zIndexOffset: 2000 }).addTo(map.current);
          } else if (userLocMarkerRef.current) {
              userLocMarkerRef.current.setLatLng([latitude, longitude]);
          }
      }, 
      (err) => console.error(err), 
      { enableHighAccuracy: true }
    ); 
  };
  
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
          setActiveGroup('ALL');
          setActiveCollection(null);
          setSearchText('');
          if (map.current) map.current.flyTo([CABO_ROJO_CENTER.lat, CABO_ROJO_CENTER.lng], 13, { duration: 1.5 });
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
          case 'sys_theme': toggleTheme(); break;
          case 'sys_lang': setLanguage(language === 'es' ? 'en' : 'es'); break;
          case 'sys_admin': setIsAdminOpen(true); break;
      }
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
        <WeatherWidget />
        <div className="pointer-events-auto flex flex-col gap-3 items-end">
            <button onClick={toggleTheme} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-amber-500 dark:text-purple-300 p-2.5 rounded-full shadow-lg border border-white/40 dark:border-slate-700 font-bold text-xl hover:scale-105 transition-transform w-10 h-10 flex items-center justify-center">
              <i className={`fa-solid ${isDarkMode ? 'fa-moon' : 'fa-sun'}`}></i>
            </button>
            <button onClick={() => setLanguage(language === 'es' ? 'en' : 'es')} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-800 dark:text-white p-2.5 rounded-full shadow-lg border border-white/40 dark:border-slate-700 font-bold text-[10px] uppercase hover:scale-105 transition-transform w-10 h-10 flex items-center justify-center">{language === 'es' ? 'EN' : 'ES'}</button>
            <button onClick={() => setIsAdminOpen(true)} className="bg-slate-900/80 dark:bg-slate-800/80 backdrop-blur-md text-white w-10 h-10 rounded-full flex items-center justify-center text-xs hover:bg-black transition-colors shadow-lg"><i className="fa-solid fa-lock"></i></button>
            
            {/* Satellite Toggle */}
            <button 
              onClick={() => setMapStyle(prev => prev === 'standard' ? 'satellite' : 'standard')} 
              className={`backdrop-blur-md w-10 h-10 rounded-full flex items-center justify-center text-xs shadow-lg transition-all active:scale-95 border ${
                mapStyle === 'satellite'
                  ? 'bg-teal-600 text-white border-teal-500' 
                  : 'bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-white/40 dark:border-slate-700 hover:scale-105'
              }`}
              title="Toggle Satellite View"
            >
              <i className={`fa-solid ${mapStyle === 'satellite' ? 'fa-map' : 'fa-globe'}`}></i>
            </button>
        </div>
      </header>
      
      <main ref={mapContainer} className="flex-1 w-full h-full focus:outline-none relative z-0 bg-slate-100 dark:bg-slate-800" role="application" aria-label="Interactive Map of Cabo Rojo" />
      
      {/* Map Controls (Location) */}
      <div className="absolute right-5 bottom-[100px] z-[1000] flex flex-col gap-3">
        {/* User Location */}
        <button onClick={centerOnUser} className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md text-blue-600 dark:text-blue-400 w-12 h-12 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.15)] flex items-center justify-center border border-white dark:border-slate-700 active:scale-95 transition-transform">
          <i className="fa-solid fa-location-crosshairs text-xl"></i>
        </button>
      </div>

      <aside>
        <ExplorerSheet 
          places={filteredList} 
          onSelect={(p) => setSelectedPlace(p)} 
          isVisible={activeTab === 'explore'}
          searchText={searchText}
          onSearchChange={setSearchText}
          resultCount={resultCount}
          activeGroup={activeGroup}
          onCategoryChange={(g) => { setActiveGroup(g); setActiveCollection(null); setSearchText(''); }}
          focusTrigger={searchFocusTrigger}
          savedIds={savedIds}
          onToggleFavorite={toggleFavorite}
          activeCollectionId={activeCollection?.id}
          onSelectCollection={setActiveCollection}
          onCameraClick={() => {
              setActiveTab('explore'); // Ensure sheet is visible if triggered elsewhere
              setIsConciergeOpen(true);
          }}
          userLocation={userLocation || undefined}
        />
      </aside>

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} onAction={handleNavAction} />
      <CommandMenu isOpen={isCommandMenuOpen} onClose={() => setIsCommandMenuOpen(false)} onSelect={handleCommandSelect} isDarkMode={isDarkMode} />

      {selectedPlace && (
        <div className="z-[3100] relative">
          <PlaceCard 
            place={selectedPlace} 
            allPlaces={places}
            onSelect={setSelectedPlace}
            onClose={() => setSelectedPlace(null)} 
            onNavigate={handleNavigate} 
            onAskAi={() => { setSelectedPlace(null); setIsConciergeOpen(true); }} 
            onSuggestEdit={() => { setSelectedPlace(null); setIsSuggestOpen(true); }}
            isFavorite={savedIds.includes(selectedPlace.id)}
            onToggleFavorite={() => toggleFavorite(selectedPlace.id)}
            userLocation={userLocation || undefined}
          />
        </div>
      )}
      
      <div className="z-[3200] relative"><Concierge isOpen={isConciergeOpen} onClose={() => setIsConciergeOpen(false)} places={places} events={events} onNavigateToPlace={handleChatNavigation} /></div>
      <div className="z-[3200] relative"><ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} onSuggest={() => { setIsContactOpen(false); setIsSuggestOpen(true); }} /></div>
      <div className="z-[3300] relative"><SuggestPlaceModal isOpen={isSuggestOpen} onClose={() => setIsSuggestOpen(false)} /></div>
      {isAdminOpen && <div className="z-[3500] relative"><Admin onClose={() => setIsAdminOpen(false)} places={places} events={events} onUpdate={fetchRealData} /></div>}
    </div>
  );
};

const App: React.FC = () => { return <LanguageProvider><MainApp /></LanguageProvider>; };
export default App;
