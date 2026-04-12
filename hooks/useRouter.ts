
import { useEffect, useRef } from 'react';
import { Place } from '../types';
import { DEFAULT_PLACE_ZOOM, CABO_ROJO_CENTER } from '../constants';

// Capture the initial ?place= param ONCE at module load time, before any useEffect
// can wipe it via pushState. This prevents the race condition where the URL-sync
// effect (which runs on selectedPlace=null at mount) deletes the param before the
// data-load effect can read it.
const INITIAL_PLACE_PARAM = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('place')
    || (window.location.hash.includes('place=') ? new URLSearchParams(window.location.hash.substring(1)).get('place') : null)
  : null;

export const useRouter = (
  publishedPlaces: Place[],
  selectedPlace: Place | null,
  setSelectedPlace: (p: Place | null) => void,
  onFlyTo: (coords: {lat: number, lng: number}, zoom?: number) => void,
  onAction?: (action: string) => void, // New callback for actions/pages
  onDeepLinkSelect?: (p: Place) => void // Phase 3: called when a ?place= URL opens a card so caller can fetchDetail
) => {
  
  // 1. On Load: Check URL (Search Params OR Hash)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // --- CHECK FOR STATIC PAGES/ACTIONS FIRST ---
    const searchParams = new URLSearchParams(window.location.search);
    const pageParam = searchParams.get('page');
    
    if (pageParam === 'suggest') {
        if (onAction) onAction('suggest');
        // We continue execution to load the map background, but the modal will overlay it.
    }

    if (publishedPlaces.length === 0) return;

    try {
        // Use the param captured at module load time — immune to the race condition
        // where the URL-sync effect wipes ?place= before this effect runs.
        let placeSlug = INITIAL_PLACE_PARAM;

        let targetPlace: Place | null = null;
        let targetZoom: number | undefined = undefined;

        if (placeSlug) {
            // Priority 1: Place specified in URL
            targetPlace = publishedPlaces.find(p => p.slug === placeSlug || p.id === placeSlug) || null;
            if (targetPlace?.coords) {
                targetZoom = targetPlace.defaultZoom || DEFAULT_PLACE_ZOOM;
            }
        } 
        
        if (!targetPlace && !pageParam) {
            // Priority 2: Find a designated 'isLanding' place if no URL place AND no specific page requested
            const landingPlace = publishedPlaces.find(p => p.isLanding);
            if (landingPlace) {
                targetPlace = landingPlace;
                if (targetPlace.coords) {
                    targetZoom = targetPlace.defaultZoom || DEFAULT_PLACE_ZOOM;
                }
            }
        }

        // Apply logic
        if (targetPlace && targetPlace.coords) {
            setTimeout(() => onFlyTo(targetPlace!.coords, targetZoom), 1000);
            // If URL has ?place=, open the card and fetch full detail.
            // Landing place (no param) just centers the map.
            if (placeSlug) {
                setSelectedPlace(targetPlace);
                if (onDeepLinkSelect) onDeepLinkSelect(targetPlace);
                deepLinkProcessed.current = true; // allow URL-sync effect to run normally
            } else {
                setSelectedPlace(null);
                deepLinkProcessed.current = true;
            }
        } else {
            // Fallback: Fly to default center if no specific place is targeted
            setTimeout(() => onFlyTo(CABO_ROJO_CENTER, 13), 1000); // Default zoom 13 for home view
            setSelectedPlace(null); // Explicitly ensure no place card is open
        }

    } catch (e) {
        console.warn("Deep link/Landing page load failed", e);
        // Ensure default behavior if error occurs
        setTimeout(() => onFlyTo(CABO_ROJO_CENTER, 13), 1000);
        setSelectedPlace(null);
    }
  }, [publishedPlaces.length]); // Re-run when places data is loaded

  // Track whether the deep-link effect has run (data loaded + card opened).
  // Until it has, the URL-sync effect must NOT wipe the ?place= param.
  const deepLinkProcessed = useRef(!INITIAL_PLACE_PARAM); // true if no deep link to process

  // 2. On Selection: Update URL safely
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.protocol === 'blob:' || window.location.href.startsWith('blob:') || window.location.protocol === 'data:') return;

    // Don't wipe ?place= until the deep-link effect has had a chance to read it
    if (!selectedPlace && !deepLinkProcessed.current) return;

    try {
        const url = new URL(window.location.href);
        try {
            if (selectedPlace) {
                url.searchParams.set('place', selectedPlace.slug || selectedPlace.id);
                url.searchParams.delete('page');
            } else {
                url.searchParams.delete('place');
            }
            window.history.pushState({}, '', url.toString());
        } catch (historyError) {
            // Strategy 2: Fallback to Hash if pushState is blocked (Sandboxes/Blobs)
            // This ensures "Share" links still work visually even if the URL bar doesn't look pretty
            if (selectedPlace) {
                window.location.hash = `place=${selectedPlace.slug || selectedPlace.id}`;
            } else {
                window.location.hash = '';
            }
        }
    } catch (e) {
        // Ultimate Fallback: Do nothing, just don't crash the app
        console.debug("Routing update suppressed due to environment restrictions.");
    }
  }, [selectedPlace]);

  // 3. Handle Back Button
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Skip if blob/sandbox
    if (window.location.protocol === 'blob:' || window.location.href.startsWith('blob:') || window.location.protocol === 'data:') return;

    const handlePopState = () => {
        try {
            let placeSlug = new URLSearchParams(window.location.search).get('place');
            
            // Check hash fallback on back button too
            if (!placeSlug && window.location.hash.includes('place=')) {
                 placeSlug = new URLSearchParams(window.location.hash.substring(1)).get('place');
            }

            if (!placeSlug) {
                setSelectedPlace(null);
                // Do NOT fly home here. Let the map stay at the last viewed position.
            } else {
                const found = publishedPlaces.find(p => p.slug === placeSlug || p.id === placeSlug);
                if (found) {
                    setSelectedPlace(found);
                    // Also fly to the place when navigating back to it
                    if (found.coords) {
                        setTimeout(() => onFlyTo(found.coords, found.defaultZoom || DEFAULT_PLACE_ZOOM), 100);
                    }
                } else {
                    setSelectedPlace(null); // Place not found, clear selection
                    // If place is invalid, we might want to stay or reset. Resetting seems safer here for invalid links.
                    setTimeout(() => onFlyTo(CABO_ROJO_CENTER, 13), 100); 
                }
            }
        } catch (e) { console.warn("Popstate failed", e); }
    };
    
    window.addEventListener('popstate', handlePopState);
    // Also listen to hashchange for fallback routing support
    window.addEventListener('hashchange', handlePopState);
    
    return () => {
        window.removeEventListener('popstate', handlePopState);
        window.removeEventListener('hashchange', handlePopState);
    };
  }, [publishedPlaces]);
};
