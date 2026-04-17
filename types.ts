
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
  SERVICE = 'SERVICE',
  HISTORY = 'HISTORY', // New: For statues, markers
  PROJECT = 'PROJECT'  // New: For Esencia, developments
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

export interface Category {
  id: string; // The key (e.g., 'BEACH', 'FOOD')
  label_es: string;
  label_en: string;
  icon: string; // FontAwesome icon name (e.g., 'umbrella-beach')
  color: string; // Hex code (e.g., '#FF9500')
  order_index?: number;
}

export interface Person {
  id: string;
  name: string;
  role: string; // e.g. "Prócer", "Alcalde", "Dueño", "Leyenda"
  bio: string;
  imageUrl?: string;
  placeId?: string; // Optional Foreign Key to a Place
  years?: string; // e.g. "1791 - 1825"
}

export interface Place {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string; 
  subcategory?: string;
  tags: string[];
  
  address: string;
  coords?: Coordinates; 
  gmapsUrl: string;
  location?: any;

  imageUrl: string;
  imagePosition?: string; 
  imageAlt?: string; 
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
  isMobile?: boolean; 
  isLanding?: boolean; 
  defaultZoom?: number; 

  parking: ParkingStatus;
  hasRestroom: boolean;
  hasShowers: boolean;
  hasGenerator: boolean; 
  tips: string;
  amenities?: {
    water_quality?: {
      status: 'SAFE' | 'UNSAFE' | 'CAUTION';
      date: string;
      source?: string;
      details?: string;
    };
    [key: string]: any;
  };
  
  priceLevel: string;
  bestTimeToVisit: string;
  vibe: string[];
  isPetFriendly: boolean;
  isHandicapAccessible: boolean;
  
  isVerified: boolean;
  verified_at?: string;
  created_at?: string;

  opening_hours?: {
    type?: 'fixed' | '24_7' | 'sunrise_sunset'; 
    note?: string; 
    structured?: DaySchedule[]; 
  };

  rating?: number;
  crowdLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  is_emergency_resource?: boolean;
  emergency_type?: string;

  metaTitle?: string; 
  metaDescription?: string; 
  
  relatedPeople?: Person[]; // Hydrated in hook
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
  placeIds: string[]; 
  tags?: string[]; 
}

export interface WeatherData {
  temp: number;
  condition: string;
  windSpeed: number;
}

export interface ItineraryItem {
  time: string;
  activity: string;
  placeName?: string; 
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
  suggestedPlaceIds?: string[]; 
}

export interface AdminLog {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'MARKETING_GEN' | 'USER_SEARCH' | 'USER_CHAT' | 'AI_BRIEFING' | 'CREATE_EVENT' | 'UPDATE_EVENT' | 'DELETE_EVENT' | 'UPDATE_SUGGESTION' | 'CREATE_CAT' | 'UPDATE_CAT' | 'DELETE_CAT' | 'CREATE_PERSON' | 'UPDATE_PERSON' | 'DELETE_PERSON' | 'INSIGHT_SNAPSHOT';
  place_name: string;
  details: string; // JSON string for complicated data
  created_at: string;
}

export interface InsightSnapshot {
  trending_topics: { topic: string; count: number }[];
  content_gaps: { gap: string; description: string; urgency: 'HIGH' | 'MEDIUM' | 'LOW' }[];
  recommendation: string;
  user_intent_prediction: string;
  timestamp: string;
}
