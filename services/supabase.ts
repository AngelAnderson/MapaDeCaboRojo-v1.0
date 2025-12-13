
import { createClient } from '@supabase/supabase-js';
import { get, set, del } from 'idb-keyval';
import { Place, PlaceCategory, ParkingStatus, AdminLog, Event, EventCategory, Category, InsightSnapshot } from '../types';
import { DEFAULT_CATEGORIES } from '../constants';

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

// --- SIGNAL SAVER CACHE SYSTEM ---
const memoryCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_KEY_PREFIX = 'cabo_signal_saver_';
const MEMORY_TTL = 5 * 60 * 1000; // 5 Minutes for RAM
const PERSISTENT_TTL = 24 * 60 * 60 * 1000; // 24 Hours for Disk (Signal Saver)

const getFromCache = async (key: string) => {
    // 1. Try Memory first (Fastest)
    if (memoryCache[key] && (Date.now() - memoryCache[key].timestamp < MEMORY_TTL)) {
        return memoryCache[key].data;
    }

    // 2. Try Persistent Storage (Signal Saver Mode) - IDB
    try {
        const stored = await get(CACHE_KEY_PREFIX + key);
        if (stored) {
            // stored is { data, timestamp }
            if (Date.now() - stored.timestamp < PERSISTENT_TTL) {
                // Hydrate memory cache for this session
                memoryCache[key] = { data: stored.data, timestamp: Date.now() };
                console.log(`🔌 Signal Saver: Loaded ${key} from offline cache (IDB).`);
                return stored.data;
            }
        }
    } catch(e) { 
        console.warn("Signal Saver read error:", e); 
    }
    
    return null;
};

const setCache = async (key: string, data: any) => {
    const timestamp = Date.now();
    // Update Memory
    memoryCache[key] = { data, timestamp };
    
    // Update Persistent Storage (IDB)
    try {
        await set(CACHE_KEY_PREFIX + key, { data, timestamp });
    } catch (e) { 
        console.warn("Signal Saver write error (IDB):", e); 
    }
};

const invalidateCache = async (key: string) => {
    delete memoryCache[key];
    try {
        await del(CACHE_KEY_PREFIX + key);
    } catch (e) {
        console.warn("Signal Saver clear error:", e);
    }
};

// --- HELPER: ERROR MESSAGE EXTRACTION ---
const getErrorMessage = (error: any): string => {
  if (!error) return "Unknown error occurred";
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const msg = error.message || error.error_description || error.details || error.hint;
    if (msg && typeof msg === 'string') return msg;
    try { return JSON.stringify(error); } catch (e) { return "Error object details unavailable"; }
  }
  return String(error);
};

// --- HELPER: PII SCRUBBER ---
const scrubPII = (text: string): string => {
    if (!text) return '';
    let scrubbed = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL REDACTED]');
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

// --- HELPER: IMAGE COMPRESSION ---
const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const maxWidth = 1200;
        const maxHeight = 1200;
        const quality = 0.8;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                // Convert to WebP blob
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("Canvas conversion failed"));
                }, 'image/webp', quality);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

// --- HELPER: DELETE IMAGE FROM STORAGE ---
const deleteImageFromUrl = async (fullUrl: string) => {
    if (!fullUrl || typeof fullUrl !== 'string') return;
    
    // Only attempt to delete if it matches our Supabase project/bucket pattern
    // Pattern usually: .../storage/v1/object/public/places-images/filename.ext
    const bucketName = 'places-images';
    if (!fullUrl.includes(`${bucketName}/`)) return;

    try {
        // Extract the path after the bucket name
        // Split by the bucket name and take the last part
        const path = fullUrl.split(`${bucketName}/`).pop();
        if (path) {
            // Decoding URI component handles spaces or special chars in filename
            const cleanPath = decodeURIComponent(path);
            const { error } = await supabase.storage.from(bucketName).remove([cleanPath]);
            if (error) {
                console.warn("Failed to garbage collect old image:", error.message);
            } else {
                console.log("🗑️ Garbage collected old image:", cleanPath);
            }
        }
    } catch (e) {
        console.warn("Error parsing image URL for deletion:", e);
    }
};

// --- HELPER: DUPLICATE DETECTOR ---
// Returns string ID of duplicate if found, otherwise null
const checkForDuplicates = async (name: string, gmapsUrl: string, coords?: { lat: number, lng: number }): Promise<string | null> => {
    // 1. Google Maps URL Check (Strongest Signal)
    if (gmapsUrl && gmapsUrl.length > 10) {
        // Extract ID if possible
        let cleanUrlFragment = gmapsUrl;
        if (gmapsUrl.includes('place_id:')) cleanUrlFragment = gmapsUrl.split('place_id:')[1].split('&')[0];
        else if (gmapsUrl.includes('/place/')) cleanUrlFragment = gmapsUrl.split('/place/')[1].split('/')[0];
        
        // Search DB for partial match
        const { data: urlMatches } = await supabase
            .from('places')
            .select('id, name, gmaps_url')
            .ilike('gmaps_url', `%${cleanUrlFragment}%`)
            .limit(1);
            
        if (urlMatches && urlMatches.length > 0) return `Duplicate URL with: ${urlMatches[0].name}`;
    }

    // 2. Name Normalization Check
    const cleanName = name.toLowerCase().trim().replace(/[^\w\s]/gi, ''); // Remove special chars
    const { data: nameMatches } = await supabase
        .from('places')
        .select('id, name')
        .ilike('name', cleanName) // Case-insensitive exact match
        .limit(1);

    if (nameMatches && nameMatches.length > 0) return `Duplicate Name with: ${nameMatches[0].name}`;

    // 3. Proximity Check (25 meters)
    if (coords) {
        // Note: Ideally use PostGIS, but for this scale, client-side filtering of a small area is fine
        // We fetch places roughly within 0.001 degrees (~100m) and then refine distance
        const { data: nearPlaces } = await supabase
            .from('places')
            .select('id, name, lat, lon')
            .gt('lat', coords.lat - 0.001)
            .lt('lat', coords.lat + 0.001)
            .gt('lon', coords.lng - 0.001)
            .lt('lon', coords.lng + 0.001);

        if (nearPlaces) {
            for (const p of nearPlaces) {
                if (p.lat && p.lon) {
                    const dist = Math.sqrt(Math.pow(p.lat - coords.lat, 2) + Math.pow(p.lon - coords.lng, 2));
                    // Roughly 0.0002 degrees is ~22 meters
                    if (dist < 0.0002) return `Location too close to: ${p.name}`;
                }
            }
        }
    }

    return null;
};

// --- FALLBACK MOCK CLIENT ---
const createMockClient = () => {
  console.warn("⚠️  SUPABASE KEY MISSING: App running in Offline/Mock Mode. Write operations will be simulated.");
  
  const mockChainable = (data: any = [], error: any = null) => {
      const chain: any = {
          select: () => chain,
          insert: () => Promise.resolve({ data: [{}], error: null }),
          update: () => chain,
          delete: () => chain,
          eq: () => chain,
          gte: () => chain,
          gt: () => chain,
          lte: () => chain,
          lt: () => chain,
          ilike: () => chain, // Added for duplicate check
          order: () => chain,
          limit: () => chain,
          single: () => chain,
          upload: () => Promise.resolve({ data: { path: "mock_path" }, error: null }),
          getPublicUrl: () => ({ data: { publicUrl: "https://picsum.photos/seed/mock/800/600" } }),
          remove: () => Promise.resolve({ data: [], error: null }),
          then: (onfulfilled: any) => Promise.resolve({ data, error }).then(onfulfilled)
      };
      return chain;
  };

  return {
    from: (table: string) => ({
      select: () => mockChainable([], null),
      insert: () => Promise.resolve({ data: [{}], error: null }),
      update: () => mockChainable([], null),
      delete: () => mockChainable([], null),
      upload: () => Promise.resolve({ data: { path: "mock_path" }, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "https://picsum.photos/seed/mock/800/600" } })
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
        upload: () => Promise.resolve({ data: { path: "mock_path" }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "https://picsum.photos/seed/mock/800/600" } }),
        remove: () => Promise.resolve({ data: [], error: null })
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
const mapCategory = (catRaw: string, subCatRaw?: string): string => {
  return (catRaw || '').toUpperCase().trim();
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

// Maps App `Place` object to Database Columns (Schema matched)
const mapPlaceToDb = (place: Partial<Place>) => {
    const slug = place.slug && place.slug.length > 2 
        ? escapeHTML(place.slug) 
        : generateSlug(place.name || 'untitled');

    let dbStatus = place.status;
    if (dbStatus === 'pending') {
        dbStatus = 'closed';
    }

    // Validate Coordinates
    if (place.coords?.lat !== undefined && place.coords?.lat !== null &&
        place.coords?.lng !== undefined && place.coords?.lng !== null) {
        if (place.coords.lat > 90 || place.coords.lat < -90) throw new Error("Invalid Latitude");
        if (place.coords.lng > 180 || place.coords.lng < -180) throw new Error("Invalid Longitude");
    }

    return {
        name: escapeHTML(place.name) || '',
        slug: slug,
        description: escapeHTML(place.description) || '',
        category: place.category || 'SIGHTS', 
        lat: place.coords?.lat ?? null, 
        lon: place.coords?.lng ?? null,
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
            ...(place.amenities || {}),
            parking: place.parking || ParkingStatus.FREE,
            restrooms: place.hasRestroom ?? false,
            showers: place.hasShowers ?? false,
            has_generator: place.hasGenerator ?? false,
            tips: escapeHTML(place.tips) || '',
            custom_icon: escapeHTML(place.customIcon) || '',
            is_mobile: place.isMobile ?? false,
            is_landing: place.isLanding === true,
            image_position: escapeHTML(place.imagePosition) || 'center',
            image_alt: escapeHTML(place.imageAlt) || '',
        },
        opening_hours: place.opening_hours || { note: "No especificado" },
        contact_info: place.contact_info || {},
        is_featured: place.is_featured || false,
        default_zoom: place.defaultZoom || null, 
    };
};

const mapEventToDb = (event: Partial<Event>) => {
    return {
        title: escapeHTML(event.title) || 'Untitled Event',
        description: escapeHTML(event.description) || '',
        // Enforce lowercase for Postgres Enum compatibility
        category: (event.category ? event.category.toUpperCase() : 'COMMUNITY').toLowerCase(),
        start_time: event.startTime,
        end_time: event.endTime,
        location_name: escapeHTML(event.locationName) || '',
        place_id: event.placeId || null,
        image_url: escapeHTML(event.imageUrl) || '',
        status: event.status || 'pending', // Default to pending as per schema
        is_recurring: event.isRecurring || false,
        is_featured: event.isFeatured || false,
        map_link: escapeHTML(event.mapLink) || ''
    };
};

const logAction = async (action: string, placeName: string, details: string) => {
    try {
        await supabase.from('admin_logs').insert([{
            action: escapeHTML(action),
            place_name: scrubPII(escapeHTML(placeName)),
            details: scrubPII(escapeHTML(details)),
            created_at: new Date().toISOString()
        }]);
    } catch (e) { console.warn(e); }
};

// --- AUTH HELPERS ---
export const loginAdmin = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { user: data.user, error: error ? getErrorMessage(error) : null };
};

export const checkSession = async () => {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
};

// --- PUBLIC METHODS ---

export const logUserActivity = async (action: 'USER_SEARCH' | 'USER_CHAT' | 'UPDATE_SUGGESTION', term: string) => {
    try {
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

export const getAdminLogs = async (limit: number = 50): Promise<AdminLog[]> => {
    try {
        const { data, error } = await supabase
            .from('admin_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) return [];
        return data as AdminLog[];
    } catch (e) { return []; }
};

export const saveInsightSnapshot = async (analysis: InsightSnapshot) => {
    try {
        const jsonDetails = JSON.stringify(analysis);
        // Reuse admin_logs table to store insights history without schema migration
        await logAction('INSIGHT_SNAPSHOT', 'AI Intelligence', jsonDetails);
    } catch (e) { console.error(e); }
};

export const getLatestInsights = async (): Promise<InsightSnapshot[]> => {
    try {
        const { data, error } = await supabase
            .from('admin_logs')
            .select('*')
            .eq('action', 'INSIGHT_SNAPSHOT')
            .order('created_at', { ascending: false })
            .limit(5); // Get last 5 snapshots
        
        if (error || !data) return [];
        
        return data.map((log: any) => {
            try {
                const parsed = JSON.parse(log.details);
                return { ...parsed, timestamp: log.created_at };
            } catch { return null; }
        }).filter(Boolean) as InsightSnapshot[];
    } catch (e) { return []; }
};

export const getCategories = async (): Promise<Category[]> => {
    // Cache Check
    const cached = await getFromCache('CATEGORIES');
    if (cached) return cached;

    try {
        const { data, error } = await supabase.from('categories').select('*').order('order_index', { ascending: true });
        
        if (error) {
            // Suppress warnings for missing tables (42P01) OR specific schema cache errors
            const isTableMissing = error.code === '42P01' || error.message.includes('Could not find the table');
            
            if (!isTableMissing) {
                console.warn("Supabase category fetch:", error.message);
            }
            return DEFAULT_CATEGORIES;
        }

        if (!data || data.length === 0) {
            return DEFAULT_CATEGORIES;
        }

        await setCache('CATEGORIES', data);
        return data as Category[];
    } catch (e) {
        console.error("Error fetching categories:", e);
        return DEFAULT_CATEGORIES;
    }
};

export const createCategory = async (category: Category): Promise<{ success: boolean; error?: string }> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error("Unauthorized");
        const { error } = await supabase.from('categories').insert([category]);
        if (error) throw error;
        await logAction('CREATE_CAT', category.id, `Created category ${category.label_en}`);
        
        await invalidateCache('CATEGORIES');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
};

export const updateCategory = async (id: string, category: Partial<Category>): Promise<{ success: boolean; error?: string }> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error("Unauthorized");
        const { error } = await supabase.from('categories').update(category).eq('id', id);
        if (error) throw error;
        await logAction('UPDATE_CAT', id, `Updated category`);
        
        await invalidateCache('CATEGORIES');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
};

export const deleteCategory = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error("Unauthorized");
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) throw error;
        await logAction('DELETE_CAT', id, `Deleted category`);
        
        await invalidateCache('CATEGORIES');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
};

export const getPlaces = async (): Promise<Place[]> => {
  // Cache Check
  const cached = await getFromCache('PLACES');
  if (cached) return cached;

  try {
    // Select ALL records for Admin/Chat usage
    const { data, error } = await supabase.from('places').select('*'); 
    
    if (error) {
        console.error("Supabase Fetch Error:", error.message);
        return [];
    }
    
    if (!data) return [];

    const mapped = data.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      category: mapCategory(row.category, row.subcategory),
      coords: (row.lat !== null && row.lon !== null) ? { lat: row.lat, lng: row.lon } : undefined,
      parking: mapParking(row.amenities),
      hasRestroom: row.amenities?.restrooms || false,
      hasShowers: row.amenities?.showers || false,
      hasGenerator: row.amenities?.has_generator || false,
      imageUrl: row.image_url || `https://picsum.photos/600/400?random=${row.id.substring(0,4)}`,
      imagePosition: row.amenities?.image_position || 'center',
      imageAlt: row.amenities?.image_alt || '',
      tips: row.amenities?.tips || '',
      is_featured: (row.sponsor_weight && row.sponsor_weight > 80) || false,
      sponsor_weight: row.sponsor_weight || 0,
      plan: row.plan || 'free',
      // Logic: If !is_verified, treat as 'pending' in App, even if DB says 'closed'
      status: (!row.is_verified ? 'pending' : (row.status || 'open')) as unknown as Place['status'],
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
      customIcon: row.custom_icon || row.amenities?.custom_icon || '',
      isMobile: row.amenities?.is_mobile || false,
      isLanding: row.amenities?.is_landing === true || row.amenities?.is_landing === 'true',
      amenities: row.amenities || {},
      defaultZoom: row.default_zoom ?? undefined,
    }));

    await setCache('PLACES', mapped);
    return mapped;
  } catch (err) { 
    console.error("Unexpected Error in getPlaces:", err);
    return []; 
  }
};

export const getEvents = async (): Promise<Event[]> => {
    // Cache Check
    const cached = await getFromCache('EVENTS');
    if (cached) return cached;

    try {
        // Simple select first to ensure data access works, avoiding potential JOIN issues with RLS
        const { data, error } = await supabase.from('events').select('*').order('start_time', { ascending: true });
        
        if (error) {
            console.error("Supabase Events Error:", error.message);
            return [];
        }

        if (!data) return [];

        const mapped = data.map((row: any) => ({
            id: row.id,
            title: escapeHTML(row.title),
            description: escapeHTML(row.description) || '',
            // Cast enum safely, schema uses lowercase, app uses uppercase enum
            category: (row.category ? row.category.toUpperCase() : 'COMMUNITY') as EventCategory,
            startTime: row.start_time,
            endTime: row.end_time,
            isRecurring: row.is_recurring || false,
            recurrenceRule: row.recurrence_rule,
            locationName: escapeHTML(row.location_name) || '',
            placeId: row.place_id,
            imageUrl: escapeHTML(row.image_url),
            status: row.status || 'pending',
            isFeatured: row.is_featured || false,
            mapLink: escapeHTML(row.map_link),
            coords: undefined // We won't join here to keep it robust; map logic handles missing coords
        }));

        await setCache('EVENTS', mapped);
        return mapped;
    } catch (e) { 
        console.error("Event fetch error:", e);
        return []; 
    }
};

export const createPlace = async (place: Partial<Place>): Promise<{ success: boolean; error?: string }> => {
    let isAdmin: boolean = false; 
    try {
        const { data: { session } } = await supabase.auth.getSession();
        isAdmin = !!session?.user;
        let dbPayload = mapPlaceToDb(place);
        
        // --- DUPLICATE CHECK (GATEKEEPER) ---
        // Run checks before insertion
        const duplicateReason = await checkForDuplicates(dbPayload.name, dbPayload.gmaps_url, place.coords);
        if (duplicateReason) {
            console.warn("Duplicate Prevention:", duplicateReason);
            // Return error to UI
            return { success: false, error: `Duplicate detected: ${duplicateReason}` };
        }

        if (!isAdmin) {
            // FIX: Use 'closed' instead of 'pending' to satisfy DB enum
            dbPayload.status = 'closed'; 
            dbPayload.is_verified = false; 
            dbPayload.sponsor_weight = 0;
            dbPayload.name = escapeHTML(dbPayload.name).replace(/<[^>]*>?/gm, '');
            dbPayload.description = escapeHTML(dbPayload.description).replace(/<[^>]*>?/gm, '');
        }
        
        const { error } = await supabase.from('places').insert([dbPayload]);
        if (error) throw error;
        await logAction('CREATE', place.name || 'Unknown', isAdmin ? 'Record created by Admin' : 'User Suggestion');
        
        // Invalidate Cache (both memory and persistent)
        await invalidateCache('PLACES');
        
        return { success: true };
    } catch (e: any) { 
        console.error("Create Error:", e);
        return { success: false, error: isAdmin ? getErrorMessage(e) : "Failed to submit. Please try again later." }; 
    }
};

export const updatePlace = async (id: string, place: Partial<Place>): Promise<{ success: boolean; error?: string }> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error("Unauthorized: Please log in.");
        
        // 1. Fetch current record BEFORE update to get old image URL
        const { data: currentPlace } = await supabase.from('places').select('image_url').eq('id', id).single();

        const dbPayload = mapPlaceToDb(place);
        console.log("🚀 Updating Place ID:", id);

        const { data, error } = await supabase.from('places').update(dbPayload).eq('id', id).select();
        
        if (error) throw error;
        if (!data || data.length === 0) {
            if (isLive) throw new Error("Update failed: No records modified. Check Permissions/RLS.");
        }

        // 2. Garbage Collect Old Image
        // If update was successful, and we have a new image URL, delete the old one if it differs
        if (currentPlace && currentPlace.image_url && dbPayload.image_url && currentPlace.image_url !== dbPayload.image_url) {
            await deleteImageFromUrl(currentPlace.image_url);
        }

        await logAction('UPDATE', place.name || 'Unknown', 'Record updated');
        
        // Invalidate Cache (both memory and persistent)
        await invalidateCache('PLACES');

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

        // 1. Fetch current record to get image URL for cleanup later
        const { data: currentPlace } = await supabase.from('places').select('image_url').eq('id', id).single();

        const { error: eventError } = await supabase.from('events').update({ place_id: null }).eq('place_id', id);
        if (eventError) console.warn("Failed to unlink events:", eventError);

        const { error } = await supabase.from('places').delete().eq('id', id);
        if (error) throw error;

        // 2. Garbage collect the image
        if (currentPlace && currentPlace.image_url) {
            await deleteImageFromUrl(currentPlace.image_url);
        }

        await logAction('DELETE', id, 'Record deleted');
        
        // Invalidate Cache (both memory and persistent)
        await invalidateCache('PLACES');

        return { success: true };
    } catch (e: any) { 
        console.error("Delete Error:", e);
        if (e.code === '23503') { 
             return { success: false, error: "Cannot delete: This place is linked to other records (e.g. Events). Please delete those first." };
        }
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
        
        // Invalidate Cache
        await invalidateCache('EVENTS');

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
        
        // Invalidate Cache
        await invalidateCache('EVENTS');

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
        
        // Invalidate Cache
        await invalidateCache('EVENTS');

        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
};

export const uploadImage = async (file: File): Promise<{ success: boolean; url?: string; error?: string }> => {
    try {
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) return { success: false, error: "Invalid format. Use JPG/PNG/WEBP." };
        
        // --- CLIENT SIDE COMPRESSION ---
        // We compress BEFORE uploading to save storage space and egress bandwidth
        let processedBlob: Blob = file;
        try {
            console.log(`Original size: ${(file.size / 1024).toFixed(2)} KB`);
            processedBlob = await compressImage(file);
            console.log(`Compressed size: ${(processedBlob.size / 1024).toFixed(2)} KB`);
        } catch (compError) {
            console.warn("Compression failed, falling back to original", compError);
        }

        const bucketName = 'places-images';
        // Force .webp extension if we compressed it
        const fileExt = processedBlob.type === 'image/webp' ? 'webp' : file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `${fileName}`;
        
        // @ts-ignore
        const { error } = await supabase.storage.from(bucketName).upload(filePath, processedBlob);
        if (error) throw error;
        // @ts-ignore
        const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
        return { success: true, url: data.publicUrl };
    } catch (e: any) { 
        console.error("Upload Error:", e);
        return { success: false, error: getErrorMessage(e) }; 
    }
};

export { escapeHTML };
