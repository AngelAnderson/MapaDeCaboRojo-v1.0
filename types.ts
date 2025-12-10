
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

  parking: ParkingStatus;
  hasRestroom: boolean;
  hasShowers: boolean;
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
    note?: string;
    structured?: any;
  };

  rating?: number;
  crowdLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export enum EventCategory {
  MUSIC = 'MUSIC',
  FESTIVAL = 'FESTIVAL',
  SPORTS = 'SPORTS',
  COMMUNITY = 'COMMUNITY',
  FOOD = 'FOOD'
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

export interface WeatherData {
  temp: number;
  condition: string;
  windSpeed: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface AdminLog {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'MARKETING_GEN' | 'USER_SEARCH' | 'USER_CHAT' | 'AI_BRIEFING' | 'CREATE_EVENT' | 'UPDATE_EVENT' | 'DELETE_EVENT' | 'UPDATE_SUGGESTION';
  place_name: string;
  details: string;
  created_at: string;
}