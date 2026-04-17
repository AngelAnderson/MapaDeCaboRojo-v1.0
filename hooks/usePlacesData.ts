
import { useState, useEffect, useMemo } from 'react';
import { Place, Event, PlaceCategory, ParkingStatus, Category, Person } from '../types';
import { getMapPlaces, getPlaceDetail, getEvents, getCategories, getPeople, checkDataVersion } from '../services/supabase';
import { PLACES as FALLBACK_PLACES, FALLBACK_EVENTS, DEFAULT_CATEGORIES } from '../constants';

export const usePlacesData = () => {
  const [places, setPlaces] = useState<Place[]>(FALLBACK_PLACES);
  const [events, setEvents] = useState<Event[]>(FALLBACK_EVENTS);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [people, setPeople] = useState<Person[]>([]); // New State for People
  const [loading, setLoading] = useState(true);

  // Initial Fetch
  useEffect(() => {
    const initData = async () => {
        try {
            console.log("Syncing...");

            // 1. Heartbeat Check (fire-and-forget — don't block data fetch)
            checkDataVersion();

            // 2. Load Data — use the Phase 3 minimal RPC (~230KB) instead of the full
            // paginated getPlaces (~1.5MB). Detail is fetched lazily when user taps a pin.
            console.log("Fetching real data (minimal)...");
            const [realPlaces, realEvents, realCategories, realPeople] = await Promise.all([
                getMapPlaces(),
                getEvents(),
                getCategories(),
                getPeople()
            ]);

            // Hydrate Places with People
            const hydratedPlaces = realPlaces.map(p => {
                // Find people linked to this place
                const linkedPeople = realPeople.filter(person => person.placeId === p.id);
                if (linkedPeople.length > 0) {
                    return { ...p, relatedPeople: linkedPeople };
                }
                return p;
            });

            if (hydratedPlaces.length > 0) setPlaces(hydratedPlaces);
            if (realEvents.length > 0) setEvents(realEvents);
            if (realCategories.length > 0) setCategories(realCategories);
            if (realPeople.length > 0) setPeople(realPeople);
            
        } catch (e) {
            console.error("Data load failed, using fallbacks", e);
        } finally {
            setLoading(false);
        }
    };
    initData();
  }, []);

  // Public filter — aligned with the bot *7711 rule in CLAUDE.md:
  // "visibility = 'published' for any status = 'open' business — or the keyword search silently hides it."
  // Previously this required `isVerified=true` AND `status!=='pending'`, which was too aggressive and
  // silently hid hundreds of real businesses from the map. Now: render anything that isn't explicitly
  // closed or hidden. The badge in the card still surfaces verification state if needed later.
  const publishedPlaces = useMemo(() => {
    return places.filter(p => {
       if (p.status === 'closed') return false;
       // Respect explicit hiding via a visibility flag if it exists on the row
       const vis = (p as any).visibility;
       if (vis && vis !== 'published') return false;
       return true;
    });
  }, [places]);

  // Map Events to "Place-like" objects for the map & explorer
  const mappedEvents = useMemo(() => {
    return events.map(e => {
        // Smart Tagging based on content to make search "idiot proof"
        const smartTags = ['Evento', e.category];
        const textToSearch = (e.title + ' ' + e.description).toLowerCase();
        
        if (textToSearch.includes('music') || textToSearch.includes('música') || textToSearch.includes('jazz') || textToSearch.includes('rock') || textToSearch.includes('salsa')) smartTags.push('Música en vivo');
        if (textToSearch.includes('comida') || textToSearch.includes('food') || textToSearch.includes('cena')) smartTags.push('Gastronomía');
        if (textToSearch.includes('kids') || textToSearch.includes('niños') || textToSearch.includes('familia')) smartTags.push('Familiar');
        if (textToSearch.includes('art') || textToSearch.includes('arte')) smartTags.push('Cultura');

        // Derive Vibe from Category
        let vibes = ['Social'];
        switch(e.category) {
            case 'MUSIC': vibes = ['Fiesta', 'Jangueo', 'En Vivo']; break;
            case 'FOOD': vibes = ['Gastronómico', 'Casual']; break;
            case 'SPORTS': vibes = ['Energético', 'Competitivo']; break;
            case 'COMMUNITY': vibes = ['Local', 'Familiar']; break;
            case 'FESTIVAL': vibes = ['Multitud', 'Celebración']; break;
        }

        return {
            id: e.id,
            name: e.title,
            slug: `event-${e.id}`,
            description: e.description || "Evento especial en Cabo Rojo.",
            category: e.category as unknown as string,
            // If coords are not available for an event, default to 0,0 for mapping convenience,
            // but the 'Place' type itself now allows `coords` to be optional.
            coords: e.coords || { lat: 0, lng: 0 }, 
            imageUrl: e.imageUrl || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=1000',
            videoUrl: '',
            website: '',
            phone: '',
            address: e.locationName || "Ubicación por confirmar",
            gmapsUrl: e.mapLink || '',
            customIcon: 'fa-calendar-check',
            status: 'open',
            plan: 'free',
            sponsor_weight: e.isFeatured ? 100 : 50,
            is_featured: e.isFeatured,
            tags: smartTags,
            parking: ParkingStatus.FREE,
            hasRestroom: true,
            hasShowers: false,
            hasGenerator: false,
            tips: `Horario: ${new Date(e.startTime).toLocaleTimeString([], {hour:'numeric', minute:'2-digit', hour12:true})}. ${e.description?.substring(0, 50)}...`,
            priceLevel: new Date(e.startTime).toLocaleDateString([], {weekday: 'short', month:'short', day:'numeric'}), 
            bestTimeToVisit: 'A tiempo',
            vibe: vibes,
            isPetFriendly: true,
            isHandicapAccessible: true,
            isVerified: true,
            opening_hours: { note: new Date(e.startTime).toLocaleString([], {weekday: 'long', hour: 'numeric', minute:'2-digit'}) },
            contact_info: { eventStart: e.startTime, eventEnd: e.endTime, isEvent: true }
        } as Place;
    }); 
  }, [events]);

  const refreshData = async () => {
      const [realPlaces, realEvents, realCategories, realPeople] = await Promise.all([
          getMapPlaces(),
          getEvents(),
          getCategories(),
          getPeople()
      ]);

      const hydratedPlaces = realPlaces.map(p => {
          const linkedPeople = realPeople.filter(person => person.placeId === p.id);
          if (linkedPeople.length > 0) return { ...p, relatedPeople: linkedPeople };
          return p;
      });

      if(hydratedPlaces.length > 0) setPlaces(hydratedPlaces);
      if(realEvents.length > 0) setEvents(realEvents);
      if(realCategories.length > 0) setCategories(realCategories);
      if(realPeople.length > 0) setPeople(realPeople);
  };

  // Lazy-fetch full detail for a single place. Merges into the places array
  // so subsequent renders don't re-fetch. Returns the hydrated Place.
  const fetchDetail = async (placeId: string): Promise<Place | null> => {
    // Already loaded?
    const existing = places.find(p => p.id === placeId);
    if (existing && (existing as any)._detailLoaded) return existing;

    const detail = await getPlaceDetail(placeId);
    if (!detail) return existing ?? null;

    // Merge: detail overrides minimal fields; keep relatedPeople from hydration
    const merged = { ...existing, ...detail, relatedPeople: existing?.relatedPeople, _detailLoaded: true } as Place;

    // Update in-memory array so the card doesn't re-fetch if closed + reopened
    setPlaces(prev => prev.map(p => p.id === placeId ? merged : p));
    return merged;
  };

  return { places, events, categories, people, publishedPlaces, mappedEvents, loading, refreshData, fetchDetail };
};
