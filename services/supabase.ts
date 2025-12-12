
import { createClient } from '@supabase/supabase-js';
import { Place, PlaceCategory, ParkingStatus, AdminLog, Event, EventCategory } from '../types';

// --- SAFE ENVIRONMENT VARIABLE EXTRACTION (Vite/Browser Compatible) ---
const getEnvVar = (key: string): string => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      if (import.meta.env[key]) return import.meta.env[key];
    }
  } catch (e) {}

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

/**
 * RED TEAM / SECURITY NOTE:
 * For a production application, robust Row Level Security (RLS) policies
 * MUST be configured directly on your Supabase tables (e.g., `places`, `events`, `admin_logs`, `storage.buckets.places-images`).
 * This is the primary line of defense against unauthorized data access and modification.
 * Client-side checks are for UX, not security.
 * Ensure your `places-images` storage bucket also has appropriate RLS to prevent unauthorized uploads/deletions.
 * Also, consider implementing server-side rate-limiting for write operations (e.g., `createPlace`, `uploadImage`)
 * to prevent abuse and manage API costs.
 */

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
    
    try {
      return JSON.stringify(error);
    } catch (e) {
      return "Error object details unavailable";
    }
  }
  
  return String(error);
};

// --- HELPER: PII SCRUBBER ---
const scrubPII = (text: string): string => {
    if (!text) return '';
    // Redact Emails
    let scrubbed = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL REDACTED]');
    // Redact Phone Numbers (Simple Pattern: ###-###-#### or ##########)
    scrubbed = scrubbed.replace(/\b(?:\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{10})\b/g, '[PHONE REDACTED]');
    return scrubbed;
};

// --- HELPER: HTML ESCAPER (XSS Prevention) ---
const escapeHTML = (str: string | undefined): string => {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
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
  console.log("🔌 Supabase Client Initialized");
} else {
  console.log("⚠️ Supabase Credentials not found. Using Mock Client.");
}

export const supabase = isLive 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : createMockClient() as any;

// --- MAPPERS ---
const mapCategory = (catRaw: string, subCatRaw?: string): PlaceCategory => {
  const cleanCat = (catRaw || '').toUpperCase().trim();
  
  const validCategories = Object.values(PlaceCategory) as string[];
  if (validCategories.includes(cleanCat)) {
      return cleanCat as PlaceCategory;
  }

  const combined = (catRaw || '').toLowerCase() + ' ' + (subCatRaw || '').toLowerCase();
  
  if (combined.includes('beach') || combined.includes('playa') || combined.includes('cayo')) return PlaceCategory.BEACH;
  if (combined.includes('sight') || combined.includes('faro') || combined.includes('turis')) return PlaceCategory.SIGHTS;
  if (combined.includes('bar') || combined.includes('pub') || combined.includes('discoteca')) return PlaceCategory.NIGHTLIFE;
  if (combined.includes('food') || combined.includes('restaurant') || combined.includes('comida')) return PlaceCategory.FOOD;
  if (combined.includes('hotel') || combined.includes('airbnb') || combined.includes('guesthouse')) return PlaceCategory.LODGING;
  if (combined.includes('hospital') || combined.includes('pharmacy') || combined.includes('medical')) return PlaceCategory.HEALTH;
  if (combined.includes('shop') || combined.includes('store') || combined.includes('mall')) return PlaceCategory.SHOPPING;
  if (combined.includes('tour') || combined.includes('rental') || combined.includes('boat')) return PlaceCategory.ACTIVITY;
  if (combined.includes('mechanic') || combined.includes('taller') || combined.includes('bank')) return PlaceCategory.SERVICE;
  
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
    const cleanName = escapeHTML(name).toLowerCase().trim()
        .replace(/[^\w\s-]/g, '') 
        .replace(/[\s_-]+/g, '-') 
        .replace(/^-+|-+$/g, ''); 
    
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    return `${cleanName}-${randomSuffix}`;
};

const mapPlaceToDb = (place: Partial<Place>) => {
    const slug = place.slug && place.slug.length > 2 
        ? escapeHTML(place.slug) 
        : generateSlug(place.name || 'untitled');

    let dbStatus = place.status;

    // --- SECURITY FIX: Coordinate Validation ---
    // Only validate if coordinates are actually provided (not null/undefined)
    if (place.coords?.lat !== undefined && place.coords?.lat !== null &&
        place.coords?.lng !== undefined && place.coords?.lng !== null) {
        const lat = place.coords.lat;
        const lon = place.coords.lng;
        if (lat > 90 || lat < -90) throw new Error("Invalid Latitude. Must be between -90 and 90.");
        if (lon > 180 || lon < -180) throw new Error("Invalid Longitude. Must be between -180 and 180.");
    }

    return {
        name: escapeHTML(place.name) || '',
        slug: slug,
        description: escapeHTML(place.description) || '',
        category: place.category || 'SIGHTS', 
        lat: place.coords?.lat ?? null, // Store as null if not provided
        lon: place.coords?.lng ?? null, // Store as null if not provided
        image_url: escapeHTML(place.imageUrl) || '',
        video_url: escapeHTML(place.videoUrl) || '',
        sponsor_weight: place.sponsor_weight ?? (place.is_featured ? 100 : 0),
        plan: place.plan || 'free',
        status: dbStatus || 'open',
        is_verified: place.status === 'pending' ? false : (place.isVerified ?? false),
        verified_at: place.isVerified ? new Date().toISOString() : null,
        website: escapeHTML(place.website) || '',
        phone: escapeHTML(place.phone) || '',
        address: escapeHTML(place.address) || '',
        gmaps_url: escapeHTML(place.gmapsUrl) || '',
        custom_icon: escapeHTML(place.customIcon) || '', 
        price_level: escapeHTML(place.priceLevel) || '$',
        best_time_to_visit: escapeHTML(place.bestTimeToVisit) || '',
        vibe: place.vibe?.map(v => escapeHTML(v)) || [], 
        is_pet_friendly: place.isPetFriendly ?? false,
        is_handicap_accessible: place.isHandicapAccessible ?? false,
        tags: place.tags?.map(t => escapeHTML(t)) || [],
        amenities: {
            ...(place.amenities || {}), // Preserves existing fields not managed by UI
            parking: place.parking || ParkingStatus.FREE,
            restrooms: place.hasRestroom ?? false,
            showers: place.hasShowers ?? false,
            has_generator: place.hasGenerator ?? false,
            tips: escapeHTML(place.tips) || '',
            custom_icon: escapeHTML(place.customIcon) || '',
            is_mobile: place.isMobile ?? false,
            is_landing: place.isLanding === true,
            image_position: escapeHTML(place.imagePosition) || 'center',
            image_alt: escapeHTML(place.imageAlt) || '', // Add imageAlt here
        },
        opening_hours: place.opening_hours || { note: "No especificado" },
        contact_info: place.contact_info || {}, // This field is assumed to be handled as JSON and potentially parsed/stringified already
        // REMOVED: default_zoom, meta_title, meta_description to fix schema mismatch errors
    };
};

const mapEventToDb = (event: Partial<Event>) => {
    return {
        title: escapeHTML(event.title) || 'Untitled Event',
        description: escapeHTML(event.description) || '',
        category: event.category || 'COMMUNITY',
        start_time: event.startTime,
        end_time: event.endTime,
        location_name: escapeHTML(event.locationName) || '',
        place_id: event.placeId || null,
        image_url: escapeHTML(event.imageUrl) || '',
        status: event.status || 'published',
        is_recurring: event.isRecurring || false,
        is_featured: event.isFeatured || false,
        map_link: escapeHTML(event.mapLink) || ''
    };
};

const logAction = async (action: string, placeName: string, details: string) => {
    try {
        await supabase.from('admin_logs').insert([{
            action: escapeHTML(action),
            place_name: scrubPII(escapeHTML(placeName)), // PII Scrubbing + HTML Escaping
            details: scrubPII(escapeHTML(details)), // PII Scrubbing + HTML Escaping
            created_at: new Date().toISOString()
        }]);
    } catch (e) { console.warn(e); }
};

// --- AUTH HELPERS ---
export const loginAdmin = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    // Note: Error messages here are for admin UI, so verbose is acceptable.
    return { user: data.user, error: error ? getErrorMessage(error) : null };
};

export const checkSession = async () => {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
};

// --- PUBLIC METHODS ---

export const logUserActivity = async (action: 'USER_SEARCH' | 'USER_CHAT' | 'UPDATE_SUGGESTION', term: string) => {
    try {
        // --- SECURITY FIX: PII SCRUBBING BEFORE LOGGING ---
        const safeTerm = scrubPII(escapeHTML(term)).substring(0, 100);
        
        await supabase.from('admin_logs').insert([{
            action: escapeHTML(action),
            place_name: safeTerm,
            details: action === 'UPDATE_SUGGESTION' ? safeTerm : 'User Activity',
            created_at: new Date().toISOString()
        }]);
    } catch (e) { 
        console.warn("User logging failed:", e); 
    }
};

export const getAdminLogs = async (): Promise<AdminLog[]> => {
    try {
        // RED TEAM / SECURITY NOTE:
        // Ensure RLS on 'admin_logs' table restricts access ONLY to authenticated administrators.
        // Even with client-side authentication, a malicious actor could bypass and attempt to fetch logs
        // if RLS is not properly configured.
        const { data, error } = await supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(50);
        if (error) {
            console.warn("Log fetch error:", error.message);
            return [];
        }
        return data as AdminLog[];
    } catch (e) { return []; }
};

export const getPlaces = async (): Promise<Place[]> => {
  try {
    const { data, error } = await supabase.from('places').select('*'); 
    
    if (error) {
        console.error("Supabase Fetch Error:", error.message);
        return [];
    }
    
    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      name: row.name, // Already escaped on insert
      description: row.description || '', // Already escaped on insert
      category: mapCategory(row.category, row.subcategory),
      coords: (row.lat !== null && row.lon !== null) ? { lat: row.lat, lng: row.lon } : undefined, // Map to undefined if null in DB
      parking: mapParking(row.amenities),
      hasRestroom: row.amenities?.restrooms || false,
      hasShowers: row.amenities?.showers || false,
      hasGenerator: row.amenities?.has_generator || false,
      imageUrl: row.image_url || `https://picsum.photos/600/400?random=${row.id.substring(0,4)}`, // Already escaped on insert
      imagePosition: row.amenities?.image_position || 'center',
      imageAlt: row.amenities?.image_alt || '', // Map imageAlt from DB
      tips: row.amenities?.tips || '', // Already escaped on insert
      is_featured: (row.sponsor_weight && row.sponsor_weight > 80) || false,
      sponsor_weight: row.sponsor_weight || 0,
      plan: row.plan || 'free',
      // FIX: Explicit cast for Status to avoid TypeScript union errors
      status: (!row.is_verified ? 'pending' : (row.status || 'open')) as unknown as Place['status'],
      slug: row.slug || '', // Already escaped on insert
      tags: row.tags || [], // Already escaped on insert
      address: row.address || '', // Already escaped on insert
      gmapsUrl: row.gmaps_url || '', // Already escaped on insert
      videoUrl: row.video_url || '', // Already escaped on insert
      website: row.website || '', // Already escaped on insert
      phone: row.phone || '', // Already escaped on insert
      priceLevel: row.price_level || '$', // Already escaped on insert
      bestTimeToVisit: row.best_time_to_visit || '', // Already escaped on insert
      vibe: row.vibe || [], // Already escaped on insert
      isPetFriendly: row.is_pet_friendly || false,
      isHandicapAccessible: row.is_handicap_accessible || false,
      isVerified: row.is_verified || false,
      verified_at: row.verified_at,
      created_at: row.created_at,
      opening_hours: row.opening_hours || { note: '' },
      contact_info: row.contact_info || {},
      customIcon: row.custom_icon || row.amenities?.custom_icon || '', // Already escaped on insert
      isMobile: row.amenities?.is_mobile || false,
      isLanding: row.amenities?.is_landing === true || row.amenities?.is_landing === 'true',
      amenities: row.amenities || {},
      defaultZoom: row.default_zoom ?? undefined, // Map default_zoom from DB to Place object
      metaTitle: row.meta_title || '', // New: Map meta_title from DB
      metaDescription: row.meta_description || '', // New: Map meta_description from DB
    }));
  } catch (err) { 
    console.error("Unexpected Error in getPlaces:", err);
    return []; 
  }
};

export const getEvents = async (): Promise<Event[]> => {
    try {
        const { data, error } = await supabase.from('events').select(`*, places (lat, lon)`).order('start_time', { ascending: true });
        
        if (error) {
            // Fallback for when relationship doesn't exist yet
            const simple = await supabase.from('events').select('*').order('start_time', { ascending: true });
            if (simple.error) throw simple.error;
            if (!simple.data) return [];
            
             return simple.data.map((row: any) => ({
                id: row.id,
                title: escapeHTML(row.title), // Added HTML escaping
                description: escapeHTML(row.description) || '', // Added HTML escaping
                category: (row.category as EventCategory) || EventCategory.COMMUNITY,
                startTime: row.start_time,
                endTime: row.end_time,
                isRecurring: row.is_recurring || false,
                recurrenceRule: row.recurrence_rule,
                locationName: escapeHTML(row.location_name) || '', // Added HTML escaping
                placeId: row.place_id,
                imageUrl: escapeHTML(row.image_url), // Added HTML escaping
                status: row.status,
                isFeatured: row.is_featured || false,
                mapLink: escapeHTML(row.map_link), // Added HTML escaping
                coords: undefined 
            }));
        }

        if (!data) return [];
        return data.map((row: any) => ({
            id: row.id,
            title: escapeHTML(row.title), // Added HTML escaping
            description: escapeHTML(row.description) || '', // Added HTML escaping
            category: (row.category as EventCategory) || EventCategory.COMMUNITY,
            startTime: row.start_time,
            endTime: row.end_time,
            isRecurring: row.is_recurring || false,
            recurrenceRule: row.recurrence_rule,
            locationName: escapeHTML(row.location_name) || '', // Added HTML escaping
            placeId: row.place_id,
            imageUrl: escapeHTML(row.image_url), // Added HTML escaping
            status: row.status,
            isFeatured: row.is_featured || false,
            mapLink: escapeHTML(row.map_link), // Added HTML escaping
            coords: row.places ? { lat: row.places.lat, lng: row.places.lon } : undefined
        }));
    } catch (e) { 
        console.error("Event fetch error:", e);
        return []; 
    }
};

export const createPlace = async (place: Partial<Place>): Promise<{ success: boolean; error?: string }> => {
    // Declare isAdmin outside the try block so it's accessible in the catch block.
    let isAdmin: boolean = false; 
    try {
        const { data: { session } } = await supabase.auth.getSession();
        isAdmin = !!session?.user;
        let dbPayload = mapPlaceToDb(place);
        
        // --- SECURITY FIX: Enforce Pending Status & Sanitize for Public Submissions ---
        if (!isAdmin) {
            dbPayload.status = 'pending'; 
            dbPayload.is_verified = false; 
            dbPayload.sponsor_weight = 0;
            // Additional sanitization (already done by mapPlaceToDb now, but kept for redundancy)
            dbPayload.name = escapeHTML(dbPayload.name).replace(/<[^>]*>?/gm, '');
            dbPayload.description = escapeHTML(dbPayload.description).replace(/<[^>]*>?/gm, '');
        }
        
        const { error } = await supabase.from('places').insert([dbPayload]);
        if (error) throw error;
        await logAction('CREATE', place.name || 'Unknown', isAdmin ? 'Record created by Admin' : 'User Suggestion');
        return { success: true };
    } catch (e: any) { 
        console.error("Create Error:", e);
        // For user-facing errors, provide a generic message to avoid disclosing backend details
        return { success: false, error: isAdmin ? getErrorMessage(e) : "Failed to submit. Please try again later." }; 
    }
};

export const updatePlace = async (id: string, place: Partial<Place>): Promise<{ success: boolean; error?: string }> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error("Unauthorized: Please log in.");
        
        const dbPayload = mapPlaceToDb(place);
        console.log("🚀 Updating Place ID:", id);

        const { data, error } = await supabase.from('places').update(dbPayload).eq('id', id).select();
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            throw new Error("Update failed: No records modified. Check Permissions/RLS.");
        }

        console.log("✅ Update Success");
        await logAction('UPDATE', place.name || 'Unknown', 'Record updated');
        return { success: true };
    } catch (e: any) { 
        console.error("Update Error Exception:", e); 
        return { success: false, error: getErrorMessage(e) }; 
    }
};

export const deletePlace = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error("Unauthorized");

        // 1. Unlink associated events (Set place_id to null) to avoid Foreign Key Constraint violations
        // This is crucial because "places" often have dependent "events".
        const { error: eventError } = await supabase
            .from('events')
            .update({ place_id: null })
            .eq('place_id', id);
        
        if (eventError) {
            console.warn("Failed to unlink events (might not exist), attempting delete anyway:", eventError);
        }

        // 2. Delete the place
        const { error } = await supabase.from('places').delete().eq('id', id);
        if (error) throw error;

        await logAction('DELETE', id, 'Record deleted');
        return { success: true };
    } catch (e: any) { 
        console.error("Delete Error:", e);
        return { success: false, error: getErrorMessage(e) }; 
    }
};

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
        
        // RED TEAM / SECURITY NOTE:
        // Client-side file size limits (5MB in SuggestPlaceModal) are for UX.
        // Implement server-side file size limits and RLS policies on your Supabase Storage bucket
        // to prevent large file uploads, ensure content validity, and restrict who can upload.
        // For content moderation, consider sending images through an AI vision API BEFORE storing.
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

export { escapeHTML }; // Export escapeHTML for other components to use if needed (e.g., in useMapEngine)
