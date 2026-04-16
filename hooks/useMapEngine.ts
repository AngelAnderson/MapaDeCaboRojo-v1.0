
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { Place, PlaceCategory, Coordinates, Category } from '../types';
import { CABO_ROJO_CENTER, DEFAULT_PLACE_ID, CATEGORY_COLORS, DEFAULT_PLACE_ZOOM } from '../constants';
import { escapeHTML } from '../services/supabase';

// --- INTERNAL HELPERS ---

const getSmartIcon = (place: Place, categories?: Category[]): string => {
    let icon = '';

    // 1. Custom Icon (Highest Priority)
    if (place.customIcon) {
        icon = place.customIcon;
    }

    // 2. Dynamic Category from DB
    else if (categories) {
        const cat = categories.find(c => c.id === place.category);
        if (cat && cat.icon) {
            icon = cat.icon;
        }
    }

    // 3. Keyword Match (Smart Fallback)
    if (!icon) {
        const lowerName = place.name.toLowerCase();
        const iconMap: Record<string, string> = {
            'hospital': 'fa-hospital',
            'farmacia': 'fa-pills',
            'policia': 'fa-shield-halved',
            'mechanic': 'fa-wrench',
            'gasolina': 'fa-gas-pump',
            'pizza': 'fa-pizza-slice',
            'coffee': 'fa-mug-hot',
            'cafe': 'fa-mug-hot',
            'burger': 'fa-burger',
            'sushi': 'fa-fish',
            'tacos': 'fa-pepper-hot',
            'ice cream': 'fa-ice-cream',
            'beer': 'fa-beer-mug-empty',
            'bar': 'fa-martini-glass-citrus',
            'faro': 'fa-lighthouse'
        };
        for (const key in iconMap) {
            if (lowerName.includes(key)) {
                icon = iconMap[key];
                break;
            }
        }
    }

    // 3b. Subcategory-specific icon (e.g. farmacia within HEALTH)
    // PHASE 2: extend this for medico, dentista, lab, hospital
    if (!icon && place.subcategory) {
        const sub = place.subcategory.toLowerCase();
        if (sub === 'farmacia') icon = 'fa-pills';
        // else if (sub === 'medico' || sub === 'médico') icon = 'fa-user-doctor';
        // else if (sub === 'dentista') icon = 'fa-tooth';
        // else if (sub === 'lab' || sub === 'laboratorio') icon = 'fa-flask';
    }

    // 4. Static Category Fallback
    if (!icon) {
        switch (place.category) {
            case 'BEACH':    icon = 'fa-umbrella-beach'; break;
            case 'FOOD':     icon = 'fa-utensils'; break;
            case 'SIGHTS':   icon = 'fa-binoculars'; break;
            case 'LOGISTICS':icon = 'fa-gas-pump'; break;
            case 'LODGING':  icon = 'fa-bed'; break;
            case 'NIGHTLIFE':icon = 'fa-champagne-glasses'; break;
            case 'HEALTH':   icon = 'fa-pills'; break; // Salud layer — pills for farmacia (most common HEALTH subcategory)
            case 'SHOPPING': icon = 'fa-bag-shopping'; break;
            case 'ACTIVITY': icon = 'fa-person-hiking'; break;
            case 'CULTURE':  icon = 'fa-masks-theater'; break;
            case 'SERVICE':  icon = 'fa-bell-concierge'; break;
            default:         icon = 'fa-location-dot'; break;
        }
    }

    return icon.startsWith('fa-') ? icon : `fa-${icon}`;
};

/**
 * Returns a lighter tint of a hex color for use as the gradient start.
 * Blends toward white by the given factor (0=same, 1=white).
 */
const lightenColor = (hex: string, factor = 0.4): string => {
    const h = hex.replace('#', '');
    const num = parseInt(h.length === 3
        ? h.split('').map(c => c + c).join('')
        : h, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    const lr = Math.round(r + (255 - r) * factor);
    const lg = Math.round(g + (255 - g) * factor);
    const lb = Math.round(b + (255 - b) * factor);
    return `rgb(${lr},${lg},${lb})`;
};

const generateMarkerHtml = (place: Place, categories?: Category[]): string => {
    const isClosed  = place.status === 'closed';
    const isSponsor = place.is_featured === true || place.plan === 'vitrina';

    // Resolve color
    let catColor = CATEGORY_COLORS[place.category] || CATEGORY_COLORS.DEFAULT;
    if (categories && categories.length > 0) {
        const cat = categories.find(c => c.id === place.category);
        if (cat) catColor = cat.color;
    }

    // Size hierarchy
    const size   = isSponsor ? 44 : isClosed ? 24 : 32;
    const border = isSponsor ? 3  : 2;
    const fontSize = isSponsor ? 18 : isClosed ? 11 : 14;

    // Visual states
    const opacity  = isClosed ? '0.6' : '1';
    const filter   = isClosed ? 'grayscale(1)' : 'none';
    const gradient = isClosed
        ? 'linear-gradient(135deg,#94a3b8,#64748b)'
        : `linear-gradient(135deg,${lightenColor(catColor, 0.35)},${catColor})`;
    const shadow   = isSponsor
        ? '0 3px 12px rgba(0,0,0,0.35)'
        : '0 2px 8px rgba(0,0,0,0.3)';

    // Pulse ring for sponsors (color matches category)
    const pulseRing = isSponsor
        ? `<div class="sponsor-pulse-ring" style="color:${catColor};"></div>`
        : '';

    // Photo avatar or icon
    const innerContent = (place as any).photo_url
        ? `<div style="width:${size - border * 2 - 6}px;height:${size - border * 2 - 6}px;border-radius:50%;background-image:url('${escapeHTML((place as any).photo_url)}');background-size:cover;background-position:center;"></div>`
        : `<i class="fa-solid ${getSmartIcon(place, categories)}" style="font-size:${fontSize}px;color:white;"></i>`;

    return `
      <div style="
        position:relative;
        width:${size}px;
        height:${size}px;
        background:${gradient};
        border-radius:50%;
        border:${border}px solid white;
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:${shadow};
        cursor:pointer;
        opacity:${opacity};
        filter:${filter};
        transition:transform 0.2s ease, box-shadow 0.2s ease;
      ">
        ${pulseRing}
        ${innerContent}
      </div>
    `;
};

// --- HOOK ---

export const useMapEngine = (
    mapContainerRef: React.RefObject<HTMLDivElement | null>,
    isDarkMode: boolean,
    mapStyle: 'standard' | 'satellite',
    placesToRender: Place[],
    onPlaceSelect: (p: Place) => void,
    categories?: Category[]
) => {
    const map             = useRef<L.Map | null>(null);
    const tileLayer       = useRef<L.TileLayer | null>(null);
    const clusterGroup    = useRef<L.MarkerClusterGroup | null>(null);
    const markersRef      = useRef<L.Marker[]>([]);
    const userLocMarkerRef = useRef<L.Marker | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);

    // 1. Initialize Map
    useEffect(() => {
        if (map.current || !mapContainerRef.current) return;
        try {
            map.current = L.map(mapContainerRef.current, {
                center: [CABO_ROJO_CENTER.lat, CABO_ROJO_CENTER.lng],
                zoom: 13, zoomControl: false, attributionControl: false,
                zoomSnap: 0.1, zoomDelta: 0.5
            });
            map.current.on('moveend', () => { /* bounds update if needed */ });
            setMapLoaded(true);
        } catch (error) { console.error('Map Init failed', error); }
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
            attribution = 'Tiles &copy; Esri';
        } else {
            const lightTiles = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
            const darkTiles  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
            tileUrl      = isDarkMode ? darkTiles : lightTiles;
            attribution  = '&copy; OpenStreetMap and CARTO';
        }
        tileLayer.current = L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(map.current);
    }, [isDarkMode, mapLoaded, mapStyle]);

    // 3. Render Markers with Clustering
    useEffect(() => {
        if (!map.current || !mapLoaded) return;

        // Clear previous cluster group
        if (clusterGroup.current) {
            map.current.removeLayer(clusterGroup.current);
            clusterGroup.current = null;
        }
        markersRef.current = [];

        // Build cluster group with custom cluster icon using dominant category color
        clusterGroup.current = (L as any).markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            iconCreateFunction: (cluster: any) => {
                const markers: L.Marker[] = cluster.getAllChildMarkers();
                // Dominant color: pick from first sponsor, else first marker
                const domColor = (() => {
                    for (const m of markers) {
                        const p: Place = (m as any)._placeData;
                        if (!p) continue;
                        if (p.is_featured || (p as any).plan === 'vitrina') {
                            let c = CATEGORY_COLORS[p.category] || CATEGORY_COLORS.DEFAULT;
                            if (categories) {
                                const cat = categories.find(cc => cc.id === p.category);
                                if (cat) c = cat.color;
                            }
                            return c;
                        }
                    }
                    const first: Place = (markers[0] as any)?._placeData;
                    if (first) {
                        let c = CATEGORY_COLORS[first.category] || CATEGORY_COLORS.DEFAULT;
                        if (categories) {
                            const cat = categories.find(cc => cc.id === first.category);
                            if (cat) c = cat.color;
                        }
                        return c;
                    }
                    return '#4f46e5';
                })();
                const count = cluster.getChildCount();
                const size  = count < 10 ? 36 : count < 50 ? 44 : 52;
                return L.divIcon({
                    html: `<div class="marker-cluster-custom" style="width:${size}px;height:${size}px;background:linear-gradient(135deg,${lightenColor(domColor, 0.3)},${domColor});">${count}</div>`,
                    className: '',
                    iconSize: L.point(size, size, true)
                });
            }
        });

        placesToRender.forEach(place => {
            if (!place.coords?.lat || !place.coords?.lng) return;

            const isSponsor = place.is_featured === true || (place as any).plan === 'vitrina';
            const size = isSponsor ? 44 : place.status === 'closed' ? 24 : 32;

            const html = generateMarkerHtml(place, categories);
            const icon = L.divIcon({
                className: 'custom-pin',
                html,
                iconSize:   [size + 8, size + 8],
                iconAnchor: [(size + 8) / 2, (size + 8) / 2]
            });

            const marker = L.marker([place.coords.lat, place.coords.lng], {
                icon,
                zIndexOffset: isSponsor ? 1500 : place.id === DEFAULT_PLACE_ID ? 1000 : 0
            });

            // Attach place data for cluster color resolution
            (marker as any)._placeData = place;

            // Tooltip
            const tooltipHtml = `
                <div class="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-2xl rounded-xl px-4 py-2 text-center transform transition-all min-w-[140px] -translate-y-1">
                  <div class="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight mb-1">${escapeHTML(place.name)}</div>
                  <div class="flex items-center justify-center gap-2 text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                    <span>${escapeHTML(place.category)}</span>
                  </div>
                </div>
            `;
            marker.bindTooltip(tooltipHtml, {
                direction: 'top',
                offset: [0, -(size / 2 + 12)],
                className: 'custom-tooltip',
                opacity: 1
            });

            // Hover scale effect via DOM
            marker.on('mouseover', () => {
                const el = marker.getElement()?.querySelector('div') as HTMLElement | null;
                if (el) el.style.transform = 'scale(1.15)';
            });
            marker.on('mouseout', () => {
                const el = marker.getElement()?.querySelector('div') as HTMLElement | null;
                if (el) el.style.transform = 'scale(1)';
            });

            // Click/tap
            const handleSelect = (e: L.LeafletEvent) => {
                L.DomEvent.stopPropagation(e as any);
                onPlaceSelect(place);
            };
            marker.on('click', handleSelect);
            marker.on('tap' as any, handleSelect);

            clusterGroup.current!.addLayer(marker);
            markersRef.current.push(marker);
        });

        map.current.addLayer(clusterGroup.current);
    }, [placesToRender, mapLoaded, categories]);

    // Public Methods
    const flyTo = (coords: Coordinates, zoom: number | undefined = DEFAULT_PLACE_ZOOM) => {
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
    const zoomIn  = () => map.current?.zoomIn();
    const zoomOut = () => map.current?.zoomOut();

    return { mapLoaded, flyTo, flyHome, showUserLocation, invalidateSize, zoomIn, zoomOut };
};
