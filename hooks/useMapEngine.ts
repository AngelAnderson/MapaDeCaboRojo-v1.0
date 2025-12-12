import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Place, PlaceCategory, Coordinates } from '../types';
import { CABO_ROJO_CENTER, DEFAULT_PLACE_ID, CATEGORY_COLORS, getMarkerColor, DEFAULT_PLACE_ZOOM } from '../constants';
import { escapeHTML } from '../services/supabase'; // Import the HTML escaper

// --- INTERNAL HELPERS ---
// CATEGORY_COLORS and getMarkerColor are now imported from constants.ts

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

const generateMarkerHtml = (place: Place): string => { // Removed isMarina parameter
  const isClosed = place.status === 'closed';
  const catColor = isClosed ? '#64748b' : (CATEGORY_COLORS[place.category] || CATEGORY_COLORS.DEFAULT);
  const iconClass = getSmartIcon(place); 

  return `
    <div style="width: 36px; height: 36px; background: ${catColor}; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.2); cursor: pointer; transition: transform 0.2s ease;">
      <i class="fa-solid ${iconClass} text-white" style="transform: rotate(45deg); font-size: 15px; opacity: ${isClosed ? '0.7' : '1'};"></i>
    </div>
  `;
};

// --- HOOK ---

export const useMapEngine = (
    mapContainerRef: React.RefObject<HTMLDivElement | null>,
    isDarkMode: boolean,
    mapStyle: 'standard' | 'satellite',
    placesToRender: Place[],
    onPlaceSelect: (p: Place) => void
) => {
    const map = useRef<L.Map | null>(null);
    const tileLayer = useRef<L.TileLayer | null>(null);
    const markersRef = useRef<L.Marker[]>([]);
    // Removed boatMarkerRef as boat animation is no longer needed
    const userLocMarkerRef = useRef<L.Marker | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);

    // 1. Initialize Map
    useEffect(() => {
        if (map.current || !mapContainerRef.current) return;
        try {
            map.current = L.map(mapContainerRef.current, { 
                center: [CABO_ROJO_CENTER.lat, CABO_ROJO_CENTER.lng], 
                zoom: 13, zoomControl: false, attributionControl: false, zoomSnap: 0.1, zoomDelta: 0.5 
            });
            map.current.on('moveend', () => { /* Optional: Update bounds state if needed */ });
            setMapLoaded(true);
        } catch (error) { console.error("Map Init failed", error); }
        return () => { map.current?.remove(); map.current = null; };
    }, []);

    // 2. Tile Management
    useEffect(() => {
        if (!map.current) return;
        if (tileLayer.current) tileLayer.current.remove();
        let tileUrl = '';
        let attribution = '';

        if (mapStyle === 'satellite') {
            tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
            attribution = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
        } else {
            const lightTiles = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
            const darkTiles = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
            tileUrl = isDarkMode ? darkTiles : lightTiles;
            attribution = '&copy; OpenStreetMap and CARTO'; // Changed to & OpenStreetMap and CARTO as previously only CARTO was there
        }
        tileLayer.current = L.tileLayer(tileUrl, { 
            attribution,
            maxZoom: 19 
        }).addTo(map.current);
    }, [isDarkMode, mapLoaded, mapStyle]);

    // 3. Render Markers
    useEffect(() => {
        if (!map.current || !mapLoaded) return;

        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];
        const bounds = L.latLngBounds([]);

        placesToRender.forEach(place => {
            // Only render marker if both lat and lng are defined
            if (!place.coords?.lat || !place.coords?.lng) return;
            
            bounds.extend([place.coords.lat, place.coords.lng]);

            // Removed isMarina check here
            const html = generateMarkerHtml(place); 
            const icon = L.divIcon({ className: 'custom-pin group', html: html, iconSize: [40, 40], iconAnchor: [20, 40] });
            
            const marker = L.marker([place.coords.lat, place.coords.lng], { icon: icon, zIndexOffset: place.id === DEFAULT_PLACE_ID ? 1000 : 0 }) // Keep zIndex for DEFAULT_PLACE_ID if it needs to be on top
                .addTo(map.current!);
            
            // Tooltip Logic - --- SECURITY FIX: Escape HTML content ---
            const tooltipHtml = `
                <div class="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-2xl rounded-xl px-4 py-2 text-center transform transition-all min-w-[140px] -translate-y-1">
                <div class="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight mb-1">${escapeHTML(place.name)}</div>
                <div class="flex items-center justify-center gap-2 text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                    <span>${escapeHTML(place.category)}</span>
                </div>
                </div>
            `;
            marker.bindTooltip(tooltipHtml, { direction: 'top', offset: [0, -50], className: 'custom-tooltip', opacity: 1 });
            marker.on('click', (e) => { L.DomEvent.stopPropagation(e); onPlaceSelect(place); });
            markersRef.current.push(marker);
        });

        // Smart Zoom (Only if we have points and they changed significantly)
        if (placesToRender.length > 0 && map.current && placesToRender.length < 50) {
             // Optional: map.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
    }, [placesToRender, mapLoaded]);

    // Removed the boat animation logic as requested.

    // Public Methods
    const flyTo = (coords: Coordinates, zoom: number | undefined = DEFAULT_PLACE_ZOOM) => { // Default to DEFAULT_PLACE_ZOOM
        map.current?.flyTo([coords.lat, coords.lng], zoom, { duration: 1.5, easeLinearity: 0.2 });
    };

    const flyHome = () => {
        map.current?.flyTo([CABO_ROJO_CENTER.lat, CABO_ROJO_CENTER.lng], 13, { duration: 1.5 });
    };

    const showUserLocation = (lat: number, lng: number) => {
        if (!map.current) return;
        if (!userLocMarkerRef.current) {
            const html = `<div class="relative w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md"><div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75"></div></div>`;
            const icon = L.divIcon({ className: 'bg-transparent', html, iconSize: [20, 20] });
            userLocMarkerRef.current = L.marker([lat, lng], { icon, zIndexOffset: 2000 }).addTo(map.current);
        } else {
            userLocMarkerRef.current.setLatLng([lat, lng]);
        }
    };

    const invalidateSize = () => map.current?.invalidateSize();
    const zoomIn = () => map.current?.zoomIn(); // Expose zoomIn
    const zoomOut = () => map.current?.zoomOut(); // Expose zoomOut

    return { mapLoaded, flyTo, flyHome, showUserLocation, invalidateSize, zoomIn, zoomOut };
};