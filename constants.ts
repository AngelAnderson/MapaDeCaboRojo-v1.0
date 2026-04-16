
import { Place, PlaceCategory, ParkingStatus, Event, EventCategory, Collection, Category } from './types';

// Leaflet/OSM does not require a token for standard tiles
export const CABO_ROJO_CENTER = { lat: 17.9620, lng: -67.1650 };

// The ID of the place to showcase on load (Maria Puerto Real)
export const DEFAULT_PLACE_ID = 'e8618968-ef0c-4113-9084-0765f716d6f9';

// Default zoom level for places if not specified
export const DEFAULT_PLACE_ZOOM = 16; 

// --- DEFAULT CATEGORIES (Fallback & Seed Data) ---
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'BEACH', label_es: 'Playas', label_en: 'Beaches', icon: 'umbrella-beach', color: '#FF9500', order_index: 1 }, // Orange
  { id: 'FOOD', label_es: 'Gastronomía', label_en: 'Food & Drink', icon: 'utensils', color: '#FF3B30', order_index: 2 }, // Red
  { id: 'SIGHTS', label_es: 'Turismo', label_en: 'Landmarks', icon: 'binoculars', color: '#007AFF', order_index: 3 }, // Blue
  { id: 'NIGHTLIFE', label_es: 'Jangueo', label_en: 'Nightlife', icon: 'champagne-glasses', color: '#AF52DE', order_index: 4 }, // Purple
  { id: 'ACTIVITY', label_es: 'Actividades', label_en: 'Activities', icon: 'person-hiking', color: '#34C759', order_index: 5 }, // Green
  { id: 'CULTURE', label_es: 'Cultura', label_en: 'Culture', icon: 'masks-theater', color: '#5856D6', order_index: 6 }, // Indigo
  { id: 'LODGING', label_es: 'Hospedaje', label_en: 'Lodging', icon: 'bed', color: '#5AC8FA', order_index: 7 }, // Teal
  { id: 'SHOPPING', label_es: 'Compras', label_en: 'Shopping', icon: 'bag-shopping', color: '#FF2D55', order_index: 8 }, // Pink
  { id: 'HEALTH', label_es: 'Salud', label_en: 'Health', icon: 'staff-snake', color: '#10b981', order_index: 9 }, // Medical green
  { id: 'SERVICE', label_es: 'Servicios', label_en: 'Services', icon: 'bell-concierge', color: '#8E8E93', order_index: 10 }, // Gray
  { id: 'LOGISTICS', label_es: 'Transporte', label_en: 'Transport', icon: 'gas-pump', color: '#FFCC00', order_index: 11 }, // Yellow
  { id: 'EMERGENCY', label_es: 'Emergencia', label_en: 'Emergency', icon: 'truck-medical', color: '#D22B2B', order_index: 12 }, // Dark Red
];

// Map colors to IDs for fail-safe rendering
export const CATEGORY_COLORS: Record<string, string> = {
  BEACH: '#FF9500',
  FOOD: '#FF3B30',
  SIGHTS: '#007AFF',
  NIGHTLIFE: '#AF52DE',
  ACTIVITY: '#34C759',
  CULTURE: '#5856D6',
  LODGING: '#5AC8FA',
  SHOPPING: '#FF2D55',
  HEALTH: '#10b981', // Medical green — matches farmacia/salud marker pins
  SERVICE: '#8E8E93',
  LOGISTICS: '#FFCC00',
  EMERGENCY: '#D22B2B',
  DEFAULT: '#8E8E93'
};

const DEFAULT_PLACE_PROPS = {
  slug: '',
  tags: [],
  address: '',
  gmapsUrl: '',
  videoUrl: '',
  website: '',
  phone: '',
  status: 'open' as const,
  plan: 'free' as const,
  sponsor_weight: 0,
  is_featured: false,
  priceLevel: '$',
  bestTimeToVisit: '',
  vibe: [],
  isPetFriendly: false,
  isHandicapAccessible: false,
  isVerified: true,
  hasGenerator: false, // Default
  defaultZoom: DEFAULT_PLACE_ZOOM, // New default zoom
};

export const PLACES: Place[] = [
  // ... (Keep existing hardcoded PLACES as fallback, they are fine)
  {
    ...DEFAULT_PLACE_PROPS,
    id: '1',
    name: 'Playa Sucia (La Playuela)',
    slug: 'playa-sucia',
    description: 'La joya de la corona. Aguas turquesas y vista al faro.',
    category: 'BEACH',
    coords: { lat: 17.9377, lng: -67.1932 },
    parking: ParkingStatus.FREE,
    hasRestroom: false,
    hasShowers: false,
    crowdLevel: 'HIGH',
    imageUrl: 'https://picsum.photos/600/400?random=1',
    tips: 'El camino es de tierra y baches. Lleva tu propia basura. No hay baños.',
    tags: ['playa', 'vista'],
    address: 'Camino al Faro, Cabo Rojo',
    vibe: ['Aventura', 'Naturaleza'],
    isPetFriendly: true
  },
  // ... (Truncated for brevity, logic remains same)
];

export const FALLBACK_EVENTS: Event[] = [
  // ... (Keep existing fallback events)
  {
    id: 'evt-1',
    title: 'Noche de Jazz en la Plaza',
    description: 'Música en vivo con artistas locales. Trae tu silla.',
    category: EventCategory.MUSIC,
    startTime: new Date(Date.now() + 86400000).toISOString(), 
    endTime: new Date(Date.now() + 90000000).toISOString(),
    locationName: 'Plaza Ramón Emeterio Betances',
    status: 'published',
    isFeatured: true,
    isRecurring: false,
    coords: { lat: 18.0865, lng: -67.1457 },
    imageUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&q=80&w=1000'
  }
];

export const COLLECTIONS: Collection[] = [
  {
    id: 'col-sunset',
    title: 'Atardeceres Mágicos',
    subtitle: 'Los mejores spots para ver caer el sol.',
    icon: 'sun',
    color: 'from-orange-400 to-red-500',
    placeIds: ['5', '2', '1'] 
  },
  {
    id: 'col-foodie',
    title: 'Ruta del Sabor',
    subtitle: 'Mofongo, mariscos y buen ambiente.',
    icon: 'utensils',
    color: 'from-green-400 to-emerald-600',
    placeIds: ['4'] 
  }
];
