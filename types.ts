
export enum PlaceCategory {
  BEACH = 'BEACH',
  FOOD = 'FOOD',
  SIGHTS = 'SIGHTS',
  LOGISTICS = 'LOGISTICS',
  LODGING = 'LODGING',
  SHOPPING = 'SHOPPING',
  HEALTH = 'HEALTH',
  NIGHTLIFE = 'NIGHTLIFE',
  ACTIVITY = 'ACTIVITY',
  SERVICE = 'SERVICE'
}

export enum ParkingStatus {
  FREE = 'FREE',
  PAID = 'PAID',
  NONE = 'NONE',
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface DaySchedule {
  day: number; // 0 = Sunday, 1 = Monday, etc.
  open: string; // "09:00"
  close: string; // "17:00"
  isClosed: boolean;
}

export interface Place {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: PlaceCategory;
  subcategory?: string;
  tags: string[];
  
  address: string;
  coords: Coordinates;
  gmapsUrl: string;
  location?: any;

  imageUrl: string;
  videoUrl: string;
  customIcon?: string;

  website: string;
  phone: string;
  contact_info?: Record<string, any>;

  status: 'open' | 'closed' | 'pending';
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  sponsor_weight: number;
  is_featured: boolean;
  isSecret?: boolean;
  isMobile?: boolean; // New: For businesses that come to you

  parking: ParkingStatus;
  hasRestroom: boolean;
  hasShowers: boolean;
  hasGenerator: boolean; // New: Planta Eléctrica
  tips: string;
  amenities?: Record<string, any>;
  
  priceLevel: string;
  bestTimeToVisit: string;
  vibe: string[];
  isPetFriendly: boolean;
  isHandicapAccessible: boolean;
  
  isVerified: boolean;
  verified_at?: string;
  created_at?: string;

  opening_hours?: {
    type?: 'fixed' | '24_7' | 'sunrise_sunset'; // New field
    note?: string; // Free text fallback
    structured?: DaySchedule[]; // Structured data
  };

  rating?: number;
  crowdLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface Event {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  startTime: string;
  endTime?: string;
  isRecurring: boolean;
  recurrenceRule?: string;
  locationName: string;
  placeId?: string;
  imageUrl?: string;
  status: string;
  isFeatured: boolean;
  mapLink?: string;
  coords?: Coordinates;
}

export enum EventCategory {
  MUSIC = 'MUSIC',
  FESTIVAL = 'FESTIVAL',
  SPORTS = 'SPORTS',
  COMMUNITY = 'COMMUNITY',
  FOOD = 'FOOD'
}

export interface Collection {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  placeIds: string[]; // IDs of places in this collection
  tags?: string[]; // Or match by tags
}

export interface WeatherData {
  temp: number;
  condition: string;
  windSpeed: number;
}

export interface ItineraryItem {
  time: string;
  activity: string;
  placeName?: string; // If it matches a DB place
  placeId?: string;
  description: string;
  icon: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isItinerary?: boolean;
  itineraryData?: ItineraryItem[];
  imageUrl?: string;
}

export interface AdminLog {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'MARKETING_GEN' | 'USER_SEARCH' | 'USER_CHAT' | 'AI_BRIEFING' | 'CREATE_EVENT' | 'UPDATE_EVENT' | 'DELETE_EVENT' | 'UPDATE_SUGGESTION';
  place_name: string;
  details: string;
  created_at: string;
}