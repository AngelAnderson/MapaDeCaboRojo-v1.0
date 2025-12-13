
// services/placesService.ts
import { Place, PlaceCategory, ParkingStatus, Coordinates, DaySchedule } from "../types";
import { escapeHTML } from './supabase'; // Import the HTML escaper

// Helper to call our Places API Proxy
const callPlacesProxy = async (action: string, params: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    try {
        const res = await fetch(`/api/places-proxy?action=${action}&${query}`);
        
        // If action is photo, we can't parse as JSON
        if (action === 'photo') {
            if (!res.ok) throw new Error("Image fetch failed");
            return res.blob();
        }

        // Read response text once to avoid issues with stream consumption
        const responseText = await res.text(); 
        
        let parsedData;
        try {
            parsedData = JSON.parse(responseText);
        } catch (jsonError) {
            console.error(`JSON Parse Error for action ${action}:`, jsonError, "Raw response:", responseText.substring(0, 200));
            throw new Error(`Invalid JSON response from places proxy: ${responseText.substring(0, 100)}...`);
        }

        if (!res.ok) {
            // If response is not OK, parsedData should contain an error message
            throw new Error(parsedData.error || `Places Proxy Error: ${res.statusText}`);
        }
        return parsedData;
    } catch (e: any) {
        console.error(`Places Proxy Error [${action}]:`, e);
        throw e; // Re-throw for upstream error handling
    }
};

interface AutocompletePrediction {
    description: string;
    place_id: string;
    structured_formatting?: {
        main_text: string;
        secondary_text: string;
    };
}

export const autocompletePlace = async (query: string): Promise<AutocompletePrediction[]> => {
    if (!query) return [];
    try {
        const res = await callPlacesProxy('autocomplete', { query });
        return res.predictions || [];
    } catch (e) {
        console.error("Autocomplete failed:", e);
        return [];
    }
};

export const findCoordinates = async (query: string): Promise<{ lat: number, lng: number } | null> => {
    if (!query) return null;
    try {
        // First try to get a place_id via autocomplete
        const predictions = await autocompletePlace(query);
        if (predictions.length > 0) {
            const placeId = predictions[0].place_id;
            const details = await fetchPlaceDetails(placeId); // Re-use fetchPlaceDetails
            if (details?.coords) {
                return details.coords;
            }
        }
        return null; 
    } catch (e) {
        console.error("Find Coordinates failed:", e);
        return null;
    }
};

export const fetchPlaceDetails = async (queryOrPlaceId: string): Promise<Partial<Place> | null> => {
    if (!queryOrPlaceId) return null;

    let placeId: string | null = null;

    // 1. Try to extract Place ID from Google Maps URL
    const gmapsUrlMatch = queryOrPlaceId.match(/place\/([^\/]+)\/data/);
    if (gmapsUrlMatch && gmapsUrlMatch[1]) {
        // More reliably, Place ID is in `place/ChIJ_...` format.
        const placeIdMatch = queryOrPlaceId.match(/ChI[a-zA-Z0-9_-]+/);
        if (placeIdMatch) {
            placeId = placeIdMatch[0];
        } else {
            // Or extract readable name from URL for autocomplete
            const nameFromUrl = decodeURIComponent(queryOrPlaceId.split('/').pop()?.split('?')[0] || '');
            if (nameFromUrl) {
                const predictions = await autocompletePlace(nameFromUrl);
                if (predictions.length > 0) {
                    placeId = predictions[0].place_id;
                }
            }
        }
    } else if (queryOrPlaceId.startsWith('ChI')) { // Direct Place ID
        placeId = queryOrPlaceId;
    } else { // Assume it's a place name, try to autocomplete
        const predictions = await autocompletePlace(queryOrPlaceId);
        if (predictions.length > 0) {
            placeId = predictions[0].place_id;
        }
    }

    if (!placeId) {
        console.warn("Could not determine place_id for query:", queryOrPlaceId);
        return null;
    }

    try {
        const res = await callPlacesProxy('details', { place_id: placeId });
        const data = res.result;

        if (!data || !data.name) return null;

        const openingHours = data.opening_hours?.weekday_text?.map((dayText: string, index: number) => {
            const parts = dayText.split(': ');
            const dayName = parts[0]; 
            const hours = parts[1]; 

            let open = '';
            let close = '';
            let isClosed = false;

            if (hours && hours.toLowerCase().includes('closed')) {
                isClosed = true;
            } else if (hours) {
                const hourMatches = hours.match(/(\d{1,2}:\d{2}\s(?:AM|PM))\s–\s(\d{1,2}:\d{2}\s(?:AM|PM))/);
                if (hourMatches) {
                    const convertTo24h = (time12h: string) => {
                        const [time, modifier] = time12h.split(' ');
                        let [hours, minutes] = time.split(':');
                        if (hours === '12') hours = '00';
                        if (modifier === 'PM') hours = String(parseInt(hours, 10) + 12);
                        return `${hours.padStart(2, '0')}:${minutes}`;
                    };
                    open = convertTo24h(hourMatches[1]);
                    close = convertTo24h(hourMatches[2]);
                }
            }
            return {
                day: index,
                open,
                close,
                isClosed
            };
        });

        // IMAGE EXTRACTION
        let imageUrl = '';
        if (data.photos && data.photos.length > 0) {
            // Use the first photo reference
            const ref = data.photos[0].photo_reference;
            // Construct a proxy URL that the frontend can use securely
            imageUrl = `/api/places-proxy?action=photo&reference=${ref}`;
        } else {
            imageUrl = `https://picsum.photos/600/400?random=${placeId?.substring(0,4)}`;
        }

        const mappedPlace: Partial<Place> = {
            name: data.name,
            description: data.editorial_summary?.overview || data.name, 
            category: PlaceCategory.SERVICE, // Default, admin can change
            coords: data.geometry?.location ? { lat: data.geometry.location.lat, lng: data.geometry.location.lng } : undefined,
            address: data.formatted_address,
            phone: data.international_phone_number,
            website: data.website,
            priceLevel: data.price_level ? '$'.repeat(data.price_level) : '$',
            tags: [], 
            tips: '', 
            imageUrl: imageUrl, // Now uses the proxy URL
            parking: ParkingStatus.FREE,
            isPetFriendly: false, 
            hasRestroom: false, 
            hasGenerator: false, 
            opening_hours: {
                type: (data.opening_hours?.open_now === true && !data.opening_hours?.weekday_text) ? '24_7' : 'fixed',
                note: data.opening_hours?.weekday_text?.join(', ') || '',
                structured: openingHours
            },
            gmapsUrl: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
        };
        return mappedPlace;

    } catch (e) {
        console.error("Fetch Place Details failed:", e);
        return null;
    }
};
