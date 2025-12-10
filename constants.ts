
import { Place, PlaceCategory, ParkingStatus, Event, EventCategory, Collection } from './types';

// Leaflet/OSM does not require a token for standard tiles
export const CABO_ROJO_CENTER = { lat: 17.9620, lng: -67.1650 };

// The ID of the place to showcase on load (Maria Puerto Real)
export const DEFAULT_PLACE_ID = 'e8618968-ef0c-4113-9084-0765f716d6f9';

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
};

export const PLACES: Place[] = [
  {
    ...DEFAULT_PLACE_PROPS,
    id: '1',
    name: 'Playa Sucia (La Playuela)',
    slug: 'playa-sucia',
    description: 'La joya de la corona. Aguas turquesas y vista al faro.',
    category: PlaceCategory.BEACH,
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
  {
    ...DEFAULT_PLACE_PROPS,
    id: '2',
    name: 'Faro Los Morrillos',
    slug: 'faro-los-morrillos',
    description: 'Histórico faro sobre acantilados de piedra caliza.',
    category: PlaceCategory.SIGHTS,
    coords: { lat: 17.9355, lng: -67.1956 },
    parking: ParkingStatus.FREE,
    hasRestroom: false,
    hasShowers: false,
    crowdLevel: 'MEDIUM',
    imageUrl: 'https://picsum.photos/600/400?random=2',
    tips: 'Sube con tenis, no chanclas. Cuidado con los bordes del acantilado.',
    tags: ['historia', 'vista', 'faro'],
    address: 'Final PR-301',
    vibe: ['Histórico', 'Romántico']
  },
  {
    ...DEFAULT_PLACE_PROPS,
    id: '3',
    name: 'Playa Buyé',
    slug: 'playa-buye',
    description: 'Aguas tranquilas y ambiente familiar.',
    category: PlaceCategory.BEACH,
    coords: { lat: 18.0478, lng: -67.1983 },
    parking: ParkingStatus.PAID,
    hasRestroom: true,
    hasShowers: true,
    crowdLevel: 'HIGH',
    imageUrl: 'https://picsum.photos/600/400?random=3',
    tips: 'Llega antes de las 9AM para conseguir parking. Hay kioscos de comida.',
    tags: ['familiar', 'playa', 'comida'],
    address: 'PR-307',
    vibe: ['Familiar', 'Fiesta'],
    priceLevel: '$$'
  },
  {
    ...DEFAULT_PLACE_PROPS,
    id: '4',
    name: 'Poblado de Boquerón',
    slug: 'poblado-boqueron',
    description: 'El corazón de la vida nocturna y gastronomía.',
    category: PlaceCategory.FOOD,
    coords: { lat: 18.0245, lng: -67.1726 },
    parking: ParkingStatus.PAID,
    hasRestroom: true,
    hasShowers: true,
    crowdLevel: 'HIGH',
    imageUrl: 'https://picsum.photos/600/400?random=4',
    tips: 'Prueba las ostiones frescos en la calle principal.',
    tags: ['comida', 'noche', 'barras'],
    address: 'PR-101',
    vibe: ['Fiesta', 'Gastronómico'],
    priceLevel: '$$'
  },
  {
    ...DEFAULT_PLACE_PROPS,
    id: '5',
    name: 'Combate Beach',
    slug: 'combate-beach',
    description: 'Playa extensa, perfecta para ver el atardecer.',
    category: PlaceCategory.BEACH,
    coords: { lat: 17.9754, lng: -67.2120 },
    parking: ParkingStatus.FREE,
    hasRestroom: false,
    hasShowers: true,
    crowdLevel: 'MEDIUM',
    imageUrl: 'https://picsum.photos/600/400?random=5',
    tips: 'Entra por el lado de Annie\'s Place para mejor acceso.',
    tags: ['atardecer', 'playa'],
    address: 'PR-3301',
    vibe: ['Relax', 'Atardecer'],
    priceLevel: '$'
  },
  {
    ...DEFAULT_PLACE_PROPS,
    id: '6',
    name: 'Las Salinas',
    slug: 'las-salinas',
    description: 'Paisaje surrealista de aguas rosadas.',
    category: PlaceCategory.SIGHTS,
    coords: { lat: 17.9546, lng: -67.1997 },
    parking: ParkingStatus.FREE,
    hasRestroom: true,
    hasShowers: false,
    crowdLevel: 'LOW',
    imageUrl: 'https://picsum.photos/600/400?random=6',
    tips: 'Perfecto para fotos. Visita el centro interpretativo si está abierto.',
    tags: ['fotos', 'naturaleza'],
    address: 'PR-301',
    vibe: ['Educativo', 'Visual']
  },
  {
    ...DEFAULT_PLACE_PROPS,
    id: '7',
    name: 'Farmacia & Suministros',
    slug: 'farmacia-suministros',
    description: 'Artículos de primera necesidad, hielo y bloqueador.',
    category: PlaceCategory.LOGISTICS,
    coords: { lat: 18.0260, lng: -67.1700 },
    parking: ParkingStatus.FREE,
    hasRestroom: false,
    hasShowers: false,
    crowdLevel: 'LOW',
    imageUrl: 'https://picsum.photos/600/400?random=7',
    tips: 'Abierto hasta las 9PM.',
    tags: ['farmacia', 'hielo', 'sunblock'],
    address: 'PR-100',
    vibe: ['Práctico']
  }
];

export const FALLBACK_EVENTS: Event[] = [
  {
    id: 'evt-1',
    title: 'Noche de Jazz en la Plaza',
    description: 'Música en vivo con artistas locales. Trae tu silla.',
    category: EventCategory.MUSIC,
    startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    endTime: new Date(Date.now() + 90000000).toISOString(),
    locationName: 'Plaza Ramón Emeterio Betances',
    status: 'published',
    isFeatured: true,
    isRecurring: false,
    coords: { lat: 18.0865, lng: -67.1457 },
    imageUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&q=80&w=1000'
  },
  {
    id: 'evt-2',
    title: 'Festival del Pescao',
    description: 'Gastronomía, artesanías y música en Puerto Real.',
    category: EventCategory.FESTIVAL,
    startTime: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
    locationName: 'Puerto Real',
    status: 'published',
    isFeatured: true,
    isRecurring: false,
    coords: { lat: 18.0750, lng: -67.1886 },
    imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=1000'
  }
];

export const COLLECTIONS: Collection[] = [
  {
    id: 'col-sunset',
    title: 'Atardeceres Mágicos',
    subtitle: 'Los mejores spots para ver caer el sol.',
    icon: 'sun',
    color: 'from-orange-400 to-red-500',
    placeIds: ['5', '2', '1'] // Combate, Faro, Playa Sucia
  },
  {
    id: 'col-foodie',
    title: 'Ruta del Sabor',
    subtitle: 'Mofongo, mariscos y buen ambiente.',
    icon: 'utensils',
    color: 'from-green-400 to-emerald-600',
    placeIds: ['4'] // Boqueron
  },
  {
    id: 'col-photo',
    title: 'Instagram Spots',
    subtitle: 'Lugares para la foto perfecta.',
    icon: 'camera',
    color: 'from-pink-500 to-purple-600',
    placeIds: ['6', '2', '1'] // Salinas, Faro, Playa Sucia
  },
  {
    id: 'col-family',
    title: 'Familiar y Relax',
    subtitle: 'Aguas tranquilas para niños.',
    icon: 'child-reaching',
    color: 'from-blue-400 to-cyan-500',
    placeIds: ['3', '6'] // Buye, Salinas
  }
];
