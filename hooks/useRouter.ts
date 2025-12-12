
import { useEffect } from 'react';
import { Place } from '../types';
import { DEFAULT_PLACE_ZOOM, CABO_ROJO_CENTER } from '../constants'; // Import CABO_ROJO_CENTER

export const useRouter = (
  publishedPlaces: Place[], 
  selectedPlace: Place | null, 
  setSelectedPlace: (p: Place | null) => void,
  onFlyTo: (coords: {lat: number, lng: number}, zoom?: number) => void
) => {
  
  // 1. On Load: Check URL (Search Params OR Hash)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (publishedPlaces.length === 0) return;

    try {
        let placeSlug = new URLSearchParams(window.location.search).get('place');
        
        // Fallback: Check Hash if search param is missing (common in some embedded views)
        if (!placeSlug && window.location.hash.includes('place=')) {
            const hashParams = new URLSearchParams(window.location.hash.substring(1)); // Remove #
            placeSlug = hashParams.get('place');
        }

        let targetPlace: Place | null = null;
        let targetZoom: number | undefined = undefined;

        if (placeSlug) {
            // Priority 1: Place specified in URL
            targetPlace = publishedPlaces.find(p => p.slug === placeSlug || p.id === placeSlug) || null;
            if (targetPlace?.coords) {
                targetZoom = targetPlace.defaultZoom || DEFAULT_PLACE_ZOOM;
            }
        } 
        
        if (!targetPlace) {
            // Priority 2: Find a designated 'isLanding' place if no URL place
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
            // Only fly to the place, DO NOT set selectedPlace on initial load.
            // The PlaceCard will not pop up automatically.
            setTimeout(() => onFlyTo(targetPlace!.coords, targetZoom), 1000);
            setSelectedPlace(null); // Ensure no place card is open
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

  // 2. On Selection: Update URL safely
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Critical Sandbox Check: If we are in a blob URL (CodeSandbox preview), abort history API to prevent crash
    if (window.location.protocol === 'blob:' || window.location.href.startsWith('blob:') || window.location.protocol === 'data:') {
        return;
    }

    try {
        const url = new URL(window.location.href);
        
        // Strategy 1: Try Standard History API
        try {
            if (selectedPlace) {
                url.searchParams.set('place', selectedPlace.slug || selectedPlace.id);
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
