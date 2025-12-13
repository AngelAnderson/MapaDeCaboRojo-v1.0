
import { useState, useEffect, useMemo } from 'react';
import { Place, Event, PlaceCategory, ParkingStatus, Category } from '../types';
import { getPlaces, getEvents, getCategories, checkDataVersion } from '../services/supabase';
import { PLACES as FALLBACK_PLACES, FALLBACK_EVENTS, DEFAULT_CATEGORIES } from '../constants';

export const usePlacesData = () => {
  const [places, setPlaces] = useState<Place[]>(FALLBACK_PLACES);
  const [events, setEvents] = useState<Event[]>(FALLBACK_EVENTS);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);

  // Initial Fetch
  useEffect(() => {
    const initData = async () => {
        try {
            console.log("Syncing...");
            
            // 1. Heartbeat Check
            await checkDataVersion();

            // 2. Load Data (will hit network if cache was cleared, or cache if valid)
            console.log("Fetching real data...");
            const [realPlaces, realEvents, realCategories] = await Promise.all([
                getPlaces(),
                getEvents(),
                getCategories()
            ]);

            if (realPlaces.length > 0) setPlaces(realPlaces);
            if (realEvents.length > 0) setEvents(realEvents);
            if (realCategories.length > 0) setCategories(realCategories);
            
        } catch (e) {
            console.error("Data load failed, using fallbacks", e);
        } finally {
            setLoading(false);
        }
    };
    initData();
  }, []);

  // Strict Filtering for Public View
  const publishedPlaces = useMemo(() => {
    return places.filter(p => {
       if (p.status === 'pending') return false;
       if (!p.isVerified) return false;
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
      const [p, e, c] = await Promise.all([getPlaces(), getEvents(), getCategories()]);
      if(p.length > 0) setPlaces(p);
      if(e.length > 0) setEvents(e);
      if(c.length > 0) setCategories(c);
  };

  return { places, events, categories, publishedPlaces, mappedEvents, loading, refreshData };
};
