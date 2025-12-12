
import { useState, useEffect, useMemo } from 'react';
import { Place, Event, PlaceCategory, ParkingStatus } from '../types';
import { getPlaces, getEvents } from '../services/supabase';
import { PLACES as FALLBACK_PLACES, FALLBACK_EVENTS, DEFAULT_PLACE_ID } from '../constants';

export const usePlacesData = () => {
  const [places, setPlaces] = useState<Place[]>(FALLBACK_PLACES);
  const [events, setEvents] = useState<Event[]>(FALLBACK_EVENTS);
  const [loading, setLoading] = useState(true);

  // Initial Fetch
  useEffect(() => {
    const initData = async () => {
        try {
            console.log("Fetching real data...");
            const realPlaces = await getPlaces();
            if (realPlaces.length > 0) setPlaces(realPlaces);
            
            const realEvents = await getEvents();
            if (realEvents.length > 0) setEvents(realEvents);
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

  // Map Events to "Place-like" objects for the map
  const mappedEvents = useMemo(() => {
    return events.map(e => ({
        id: e.id,
        name: e.title,
        slug: `event-${e.id}`,
        description: e.description,
        category: e.category as unknown as PlaceCategory,
        // If coords are not available for an event, default to 0,0 for mapping convenience,
        // but the 'Place' type itself now allows `coords` to be optional.
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
        hasGenerator: false,
        tips: `Horario: ${new Date(e.startTime).toLocaleTimeString([], {hour:'numeric', minute:'2-digit', hour12:true})}`,
        priceLevel: new Date(e.startTime).toLocaleDateString([], {month:'short', day:'numeric'}), 
        bestTimeToVisit: 'A tiempo',
        vibe: ['Social', 'Comunidad'],
        isPetFriendly: true,
        isHandicapAccessible: true,
        isVerified: true,
        opening_hours: { note: new Date(e.startTime).toLocaleString() },
        contact_info: { eventStart: e.startTime, eventEnd: e.endTime, isEvent: true }
    } as Place)); // Cast to Place as coords are now definitely present or defaulted
  }, [events]);

  const refreshData = async () => {
      const p = await getPlaces();
      if(p.length > 0) setPlaces(p);
      const e = await getEvents();
      if(e.length > 0) setEvents(e);
  };

  return { places, events, publishedPlaces, mappedEvents, loading, refreshData };
};
