
import { createClient } from '@supabase/supabase-js';
import { Place, PlaceCategory, ParkingStatus, AdminLog, Event, EventCategory } from '../types';

// --- SAFE ENVIRONMENT VARIABLE EXTRACTION (Vite/Browser Compatible) ---
const getEnvVar = (key: string): string => {
  // 1. Check Vite Import Meta (Standard for Vite apps)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      if (import.meta.env[key]) return import.meta.env[key];
    }
  } catch (e) {}

  // 2. Fallback check for process.env (but protected against RefError)
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && typeof process.env !== 'undefined') {
      // @ts-ignore
      if (process.env[key]) return process.env[key];
    }
  } catch (e) {}
  
  return '';
};

// HARDCODED FALLBACKS (To fix "Fake Data" issue if env vars fail)
const DEFAULT_URL = 'https://vprjteqgmanntvisjrvp.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwcmp0ZXFnbWFubnR2aXNqcnZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NDAwODgsImV4cCI6MjA4MDAxNjA4OH0.JBRyroLWbjh6Ow9un24c77mbr_zl9P7hdd6YUzt8LgY';

// Use VITE_ keys primarily, fallback to hardcoded strings
const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL') || DEFAULT_URL;
const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY') || DEFAULT_KEY;

// --- HELPER: ERROR MESSAGE EXTRACTION ---
const getErrorMessage = (error: any): string => {
  if (!error) return "Unknown error occurred";
  if (typeof error === 'string') return error;
  
  // Prioritize standard Error object message
  if (error instanceof Error) return error.message;
  
  // Handle Supabase/Postgrest Error structure
  if (typeof error === 'object') {
    const msg = error.message || error.error_description || error.details || error.hint;
    if (msg && typeof msg === 'string') return msg;
    
    // Fallback to JSON stringify for objects
    try {
      return JSON.stringify(error);
    } catch (e) {
      return "Error object details unavailable";
    }
  }
  
  return String(error);
};

// --- FALLBACK MOCK CLIENT ---
const createMockClient = () => {
  console.warn("⚠️  SUPABASE KEY MISSING: App running in Offline/Mock Mode. Database features will not persist.");
  
  const mockChainable = (data: any = [], error: any = null) => {
      const chain: any = {
          select: () => chain,
          insert: () => Promise.resolve({ data: null, error: { message: "Offline Mode: Cannot write to DB" } }),
          update: () => chain,
          delete: () => chain,
          eq: () => chain,
          gte: () => chain,
          gt: () => chain,
          lte: () => chain,
          lt: () => chain,
          order: () => chain,
          limit: () => chain,
          single: () => chain,
          then: (onfulfilled: any) => Promise.resolve({ data, error }).then(onfulfilled)
      };
      return chain;
  };

  return {
    from: (table: string) => ({
      select: () => mockChainable([], null),
      insert: () => Promise.resolve({ data: null, error: { message: "Offline Mode: Cannot write to DB" } }),
      update: () => mockChainable(null, { message: "Offline Mode: Cannot update DB" }),
      delete: () => mockChainable(null, { message: "Offline Mode: Cannot delete" }),
      upload: () => Promise.resolve({ data: null, error: { message: "Offline Mode: No Storage" } }),
      getPublicUrl: () => ({ data: { publicUrl: "" } })
    }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: ({ email }: any) => {
          console.log("Mock Login Success for:", email);
          return Promise.resolve({ 
              data: { user: { id: 'mock-user-id', email: email }, session: { access_token: 'mock-token' } }, 
              error: null 
          });
      },
      signOut: () => Promise.resolve({ error: null })
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: { message: "Offline Mode: No Storage" } }),
        getPublicUrl: () => ({ data: { publicUrl: "" } })
      })
    }
  };
};

const isLive = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
if (isLive) {
  console.log("🔌 Supabase Client Initialized for: vprjteqgmanntvisjrvp");
} else {
  console.log("⚠️ Supabase Credentials not found. Using Mock Client.");
}

export const supabase = isLive 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : createMockClient() as any;

// --- MAPPERS ---
const mapCategory = (catRaw: string, subCatRaw?: string): PlaceCategory => {
  const cleanCat = (catRaw || '').toUpperCase().trim();
  
  // 1. Direct Match: If the DB value exactly matches a known Category Enum, use it.
  const validCategories = Object.values(PlaceCategory) as string[];
  if (validCategories.includes(cleanCat)) {
      return cleanCat as PlaceCategory;
  }

  // 2. Fuzzy Match: Fallback for legacy data or free-text entries
  const combined = (catRaw || '').toLowerCase() + ' ' + (subCatRaw || '').toLowerCase();
  
  if (combined.includes('beach') || combined.includes('playa') || combined.includes('cayo') || combined.includes('balneario')) return PlaceCategory.BEACH;
  if (combined.includes('sight') || combined.includes('faro') || combined.includes('turis') || combined.includes('landmark') || combined.includes('monument')) return PlaceCategory.SIGHTS;
  if (combined.includes('bar') || combined.includes('pub') || combined.includes('discoteca') || combined.includes('night') || combined.includes('drinks') || combined.includes('club')) return PlaceCategory.NIGHTLIFE;
  if (combined.includes('food') || combined.includes('restaurant') || combined.includes('comida') || combined.includes('bakery') || combined.includes('cafe') || combined.includes('pizza') || combined.includes('burger')) return PlaceCategory.FOOD;
  if (combined.includes('hotel') || combined.includes('airbnb') || combined.includes('motel') || combined.includes('guesthouse') || combined.includes('resort')) return PlaceCategory.LODGING;
  if (combined.includes('hospital') || combined.includes('pharmacy') || combined.includes('medical') || combined.includes('clinic') || combined.includes('doctor') || combined.includes('health')) return PlaceCategory.HEALTH;
  if (combined.includes('shop') || combined.includes('store') || combined.includes('mall') || combined.includes('boutique') || combined.includes('market')) return PlaceCategory.SHOPPING;
  if (combined.includes('tour') || combined.includes('rental') || combined.includes('boat') || combined.includes('activity') || combined.includes('charter') || combined.includes('dive')) return PlaceCategory.ACTIVITY;
  if (combined.includes('mechanic') || combined.includes('taller') || combined.includes('gov') || combined.includes('bank') || combined.includes('police') || combined.includes('atm') || combined.includes('service')) return PlaceCategory.SERVICE;
  
  return PlaceCategory.LOGISTICS;
};

const mapParking = (amenities: any): ParkingStatus => {
  if (!amenities) return ParkingStatus.FREE; 
  const p = (amenities.parking || '').toLowerCase();
  if (p.includes('paid') || p.includes('pago')) return ParkingStatus.PAID;
  if (p.includes('no') || p.includes('none')) return ParkingStatus.NONE;
  return ParkingStatus.FREE;
};

const generateSlug = (name: string): string => {
    const cleanName = name.toLowerCase().trim()
        .replace(/[^\w\s-]/g, '') // Remove non-word chars
        .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with -
        .replace(/^-+|-+$/g, ''); // Trim leading/trailing -
    
    // Append random string to ensure uniqueness and avoid PK/Unique constraint errors
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    return `${cleanName}-${randomSuffix}`;
};

const mapPlaceToDb = (place: Partial<Place>) => {
    // Ensure we handle partial updates gracefully, but for now we reconstruct the whole object.
    // Use nullish coalescing (??) to preserve 0/false values.
    
    // If it has a slug (existing item), keep it. If not, generate new unique one.
    const slug = place.slug && place.slug.length > 2 
        ? place.slug 
        : generateSlug(place.name || 'untitled');

    return {
        name: place.name || '',
        slug: slug,
        description: place.description || '',
        category: place.category || 'SIGHTS', 
        lat: place.coords?.lat ?? 0,
        lon: place.coords?.lng ?? 0,
        image_url: place.imageUrl || '',
        video_url: place.videoUrl || '',
        sponsor_weight: place.sponsor_weight ?? (place.is_featured ? 100 : 0),
        plan: place.plan || 'free',
        status: place.status || 'open',
        is_verified: place.isVerified ?? false,
        verified_at: place.isVerified ? new Date().toISOString() : null,
        website: place.website || '',
        phone: place.phone || '',
        address: place.address || '',
        gmaps_url: place.gmapsUrl || '',
        custom_icon: place.customIcon || '', 
        price_level: place.priceLevel || '$',
        best_time_to_visit: place.bestTimeToVisit || '',
        vibe: place.vibe || [], 
        is_pet_friendly: place.isPetFriendly ?? false,
        is_handicap_accessible: place.isHandicapAccessible ?? false,
        tags: place.tags || [],
        amenities: {
            parking: place.parking || ParkingStatus.FREE,
            restrooms: place.hasRestroom ?? false,
            showers: place.hasShowers ?? false,
            tips: place.tips || '',
            custom_icon: place.customIcon || ''
        },
        opening_hours: place.opening_hours || { note: "No especificado" },
        contact_info: place.contact_info || {}
    };
};

const mapEventToDb = (event: Partial<Event>) => {
    return {
        title: event.title || 'Untitled Event',
        description: event.description || '',
        category: event.category || 'COMMUNITY',
        start_time: event.startTime,
        end_time: event.endTime,
        location_name: event.locationName || '',
        place_id: event.placeId || null,
        image_url: event.imageUrl || '',
        status: event.status || 'published',
        is_recurring: event.isRecurring || false,
        is_featured: event.isFeatured || false,
        map_link: event.mapLink || ''
    };
};

const logAction = async (action: string, placeName: string, details: string) => {
    try {
        await supabase.from('admin_logs').insert([{
            action,
            place_name: placeName,
            details,
            created_at: new Date().toISOString()
        }]);
    } catch (e) { console.warn(e); }
};

export const logUserActivity = async (action: 'USER_SEARCH' | 'USER_CHAT' | 'UPDATE_SUGGESTION', term: string) => {
    try {
        await supabase.from('admin_logs').insert([{
            action,
            place_name: term.substring(0, 100), // Truncate for safety
            details: action === 'UPDATE_SUGGESTION' ? term : 'User Activity',
            created_at: new Date().toISOString()
        }]);
    } catch (e) { 
        console.warn("User logging failed (Likely Permissions/RLS):", e); 
    }
};

export const getAdminLogs = async (): Promise<AdminLog[]> => {
    try {
        const { data, error } = await supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(50);
        if (error) {
            console.warn("Log fetch error (table might not exist yet):", error.message);
            return [];
        }
        return data as AdminLog[];
    } catch (e) { return []; }
};

export const getPlaces = async (): Promise<Place[]> => {
  try {
    const { data, error } = await supabase.from('places').select('*'); 
    
    if (error) {
        console.error("🔴 Supabase Fetch Error (places):", error.message, error.details);
        return [];
    }
    
    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      category: mapCategory(row.category, row.subcategory),
      coords: { lat: row.lat || 0, lng: row.lon || 0 },
      parking: mapParking(row.amenities),
      hasRestroom: row.amenities?.restrooms || false,
      hasShowers: row.amenities?.showers || false,
      imageUrl: row.image_url || `https://picsum.photos/600/400?random=${row.id.substring(0,4)}`,
      tips: row.amenities?.tips || '',
      is_featured: (row.sponsor_weight && row.sponsor_weight > 80) || false,
      sponsor_weight: row.sponsor_weight || 0,
      plan: row.plan || 'free',
      status: row.status || 'open',
      slug: row.slug || '',
      tags: row.tags || [],
      address: row.address || '',
      gmapsUrl: row.gmaps_url || '',
      videoUrl: row.video_url || '',
      website: row.website || '',
      phone: row.phone || '',
      priceLevel: row.price_level || '$',
      bestTimeToVisit: row.best_time_to_visit || '',
      vibe: row.vibe || [],
      isPetFriendly: row.is_pet_friendly || false,
      isHandicapAccessible: row.is_handicap_accessible || false,
      isVerified: row.is_verified || false,
      verified_at: row.verified_at,
      created_at: row.created_at,
      opening_hours: row.opening_hours || { note: '' },
      contact_info: row.contact_info || {},
      customIcon: row.custom_icon || row.amenities?.custom_icon || '' 
    }));
  } catch (err) { 
    console.error("🔴 Unexpected Error in getPlaces:", err);
    return []; 
  }
};

export const getEvents = async (): Promise<Event[]> => {
    try {
        // Try simple select first to avoid join errors if relation is missing
        const { data, error } = await supabase.from('events').select(`*, places (lat, lon)`).order('start_time', { ascending: true });
        
        if (error) {
             // Fallback: If relation 'places' doesn't exist, try simple select
            console.warn("Complex event fetch failed, trying simple:", error.message);
            const simple = await supabase.from('events').select('*').order('start_time', { ascending: true });
            if (simple.error) throw simple.error;
            if (!simple.data) return [];
            
             return simple.data.map((row: any) => ({
                id: row.id,
                title: row.title,
                description: row.description || '',
                category: (row.category as EventCategory) || EventCategory.COMMUNITY,
                startTime: row.start_time,
                endTime: row.end_time,
                isRecurring: row.is_recurring || false,
                recurrenceRule: row.recurrence_rule,
                locationName: row.location_name || '',
                placeId: row.place_id,
                imageUrl: row.image_url,
                status: row.status,
                isFeatured: row.is_featured || false,
                mapLink: row.map_link,
                coords: undefined // No coords in simple fetch
            }));
        }

        if (!data) return [];
        return data.map((row: any) => ({
            id: row.id,
            title: row.title,
            description: row.description || '',
            category: (row.category as EventCategory) || EventCategory.COMMUNITY,
            startTime: row.start_time,
            endTime: row.end_time,
            isRecurring: row.is_recurring || false,
            recurrenceRule: row.recurrence_rule,
            locationName: row.location_name || '',
            placeId: row.place_id,
            imageUrl: row.image_url,
            status: row.status,
            isFeatured: row.is_featured || false,
            mapLink: row.map_link,
            coords: row.places ? { lat: row.places.lat, lng: row.places.lon } : undefined
        }));
    } catch (e) { 
        console.error("Event fetch error:", e);
        return []; 
    }
};

export const createPlace = async (place: Partial<Place>): Promise<{ success: boolean; error?: string }> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const isAdmin = !!session?.user;
        let dbPayload = mapPlaceToDb(place);
        if (!isAdmin) {
            dbPayload.status = 'open'; // Auto-publish for MVP
            dbPayload.is_verified = false;
            dbPayload.sponsor_weight = 0;
            // Basic sanitization
            dbPayload.name = dbPayload.name.replace(/<[^>]*>?/gm, '');
            dbPayload.description = dbPayload.description.replace(/<[^>]*>?/gm, '');
        }
        const { error } = await supabase.from('places').insert([dbPayload]);
        if (error) throw error;
        await logAction('CREATE', place.name || 'Unknown', isAdmin ? 'Record created by Admin' : 'User Suggestion');
        return { success: true };
    } catch (e: any) { 
        console.error("Create Error:", JSON.stringify(e, null, 2));
        return { success: false, error: getErrorMessage(e) }; 
    }
};

export const updatePlace = async (id: string, place: Partial<Place>): Promise<{ success: boolean; error?: string }> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error("Unauthorized");
        const dbPayload = mapPlaceToDb(place);
        
        console.log("🚀 Updating Place ID:", id);
        console.log("📦 Payload:", dbPayload);

        // CRITICAL FIX: Add .select() to ensure the DB actually performs the update and returns the row.
        const { data, error } = await supabase.from('places').update(dbPayload).eq('id', id).select();
        
        if (error) {
            console.error("❌ Supabase Update Failed:", JSON.stringify(error, null, 2));
            throw error;
        }
        
        if (!data || data.length === 0) {
            console.warn("⚠️ No records updated. ID mismatch or RLS policy block.");
            throw new Error("Update failed: No records modified. Check RLS policies.");
        }

        console.log("✅ Update Success:", data);
        await logAction('UPDATE', place.name || 'Unknown', 'Record updated');
        return { success: true };
    } catch (e: any) { 
        console.error("Update Error Exception:", JSON.stringify(e, null, 2));
        return { success: false, error: getErrorMessage(e) }; 
    }
};

export const deletePlace = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error("Unauthorized");
        const { error } = await supabase.from('places').delete().eq('id', id);
        if (error) throw error;
        await logAction('DELETE', id, 'Record deleted');
        return { success: true };
    } catch (e: any) { 
        console.error("Delete Error:", e);
        return { success: false, error: getErrorMessage(e) }; 
    }
};

// --- EVENT CRUD ---

export const createEvent = async (event: Partial<Event>): Promise<{ success: boolean; error?: string }> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error("Unauthorized");
        const dbPayload = mapEventToDb(event);
        const { error } = await supabase.from('events').insert([dbPayload]);
        if (error) throw error;
        await logAction('CREATE_EVENT', event.title || 'Unknown', 'Event created by Admin');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
};

export const updateEvent = async (id: string, event: Partial<Event>): Promise<{ success: boolean; error?: string }> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error("Unauthorized");
        const dbPayload = mapEventToDb(event);
        const { error } = await supabase.from('events').update(dbPayload).eq('id', id).select();
        if (error) throw error;
        await logAction('UPDATE_EVENT', event.title || 'Unknown', 'Event updated by Admin');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
};

export const deleteEvent = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error("Unauthorized");
        const { error } = await supabase.from('events').delete().eq('id', id);
        if (error) throw error;
        await logAction('DELETE_EVENT', id, 'Event deleted');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
};

export const uploadImage = async (file: File): Promise<{ success: boolean; url?: string; error?: string }> => {
    try {
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) return { success: false, error: "Invalid format. Use JPG/PNG/WEBP." };
        const bucketName = 'places-images';
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `${fileName}`;
        // @ts-ignore
        const { error } = await supabase.storage.from(bucketName).upload(filePath, file);
        if (error) throw error;
        // @ts-ignore
        const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
        return { success: true, url: data.publicUrl };
    } catch (e: any) { 
        console.error("Upload Error:", e);
        return { success: false, error: getErrorMessage(e) }; 
    }
};