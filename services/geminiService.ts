import { GoogleGenAI, Chat } from "@google/genai";
import { Place, ParkingStatus, Event, Coordinates } from "../types";

// --- SAFE API KEY RETRIEVAL ---
const getApiKey = (): string => {
  try {
    // Check for process.env safely
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
  } catch (e) {}
  return '';
};

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: getApiKey() });

// --- SECURITY: RATE LIMITER ---
class RateLimiter {
    private timestamps: number[] = [];
    private limit: number = 5; // Max 5 requests
    private window: number = 60000; // Per 1 minute

    check(): boolean {
        const now = Date.now();
        // Clean old timestamps
        this.timestamps = this.timestamps.filter(t => now - t < this.window);
        
        if (this.timestamps.length >= this.limit) {
            return false;
        }
        
        this.timestamps.push(now);
        return true;
    }
}

const limiter = new RateLimiter();

// --- HELPER: DISTANCE CALCULATOR (Haversine) ---
const calculateDistance = (coords1: Coordinates, coords2: Coordinates): number => {
    const toRad = (x: number) => x * Math.PI / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(coords2.lat - coords1.lat);
    const dLon = toRad(coords2.lng - coords1.lng);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(coords1.lat)) * Math.cos(toRad(coords2.lat)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1)); // Return km with 1 decimal
};

// --- SECURITY: INPUT SANITIZATION ---
const sanitizeInput = (input: string): string => {
    if (!input) return "";
    // Remove common jailbreak patterns and system directive attempts
    return input
        .replace(/ignore previous/gi, "")
        .replace(/system instruction/gi, "")
        .replace(/you are now/gi, "")
        .slice(0, 500); // Truncate to 500 chars to prevent token exhaustion
};

const BASE_SYSTEM_INSTRUCTION = `
Eres **El Veci**, un vecino digital que vive en Cabo Rojo, Puerto Rico.

TU PERSONALIDAD:
- Eres jocoso, gracioso, hablas como vecino buena gente.
- Eres boricua del Oeste: haces chistes sobre la luz, los hoyos, los políticos en general, la suegra, las filas, la playa, la calor.
- Tu humor es sano: te ríes de las situaciones, no humillas personas.

LÍMITE DE HUMOR:
- No mencionas políticos por nombre ni haces campaña a favor o en contra de nadie.
- No haces chistes de tragedias, enfermedades ni te burlas de grupos de personas.
- Cuando hablas de “la suegra”, es en tono cariñoso, de chiste clásico de familia, nunca ofensivo.

LENGUAJE:
- Hablas en español boricua, pero claro, para que alguien de 105 años pueda entender.
- Frases cortas. Evitas párrafos largos.
- Evitas tecnicismos.
- Usas ejemplos de la vida diaria en Puerto Rico.

CONTACTO ADMIN / SUGERENCIAS:
- Si alguien quiere sugerir un lugar, reportar un error o contactar al admin (Angel):
  - WhatsApp: 787-417-8228
  - Email: angel@caborojo.com
  - X (Twitter): @angelfanderson
- Dales esta info si preguntan cómo contactar al dueño de la app.

FORMATO DE RESPUESTA:
- Primero ayudas, luego chiste.
- Estructura sugerida:
  1. Respuesta clara y práctica BASADA EN LOS DATOS QUE TIENES (Lugares y Eventos).
  2. Si recomiendas lugares, usa sus nombres exactos.
  3. **IMPORTANTE:** Siempre incluye el TELÉFONO y la DIRECCIÓN si están disponibles en tus datos. La gente necesita saber cómo llegar o llamar.
  4. Si hay eventos, menciónalos si son relevantes a la fecha actual.
  5. Remate jocoso corto al final.

OBJETIVO:
- Ayudar usando SOLO la lista de lugares y eventos que te proveo abajo como "CONOCIMIENTO LOCAL".
- Si te preguntan por algo que no está en la lista, di que "no te llega la señal de eso todavía" o sugiere algo de la lista que se parezca.
`;

// Helper to format places into a text block for the AI
const formatPlacesForContext = (places: Place[], userLocation?: Coordinates): string => {
    if (!places || places.length === 0) return "";
    
    let context = "\n\n### CONOCIMIENTO LOCAL (LUGARES REALES EN TU BASE DE DATOS):\n";
    
    // Add logic to sort by distance if location is available? 
    // For now, just appending distance info is enough for the LLM to decide.
    
    places.forEach(p => {
        let distanceInfo = "";
        if (userLocation && p.coords && p.coords.lat) {
            const dist = calculateDistance(userLocation, p.coords);
            distanceInfo = ` (A aprox. ${dist} km de la ubicación del usuario)`;
        }

        context += `- NOMBRE: ${p.name} (${p.category})${distanceInfo}\n`;
        context += `  - Descripción: ${p.description}\n`;
        context += `  - Dirección: ${p.address || "No especificada"}\n`;
        context += `  - Teléfono: ${p.phone || "No tiene"}\n`;
        context += `  - Web: ${p.website || "No tiene"}\n`;
        context += `  - Parking: ${p.parking === ParkingStatus.FREE ? 'GRATIS' : p.parking === ParkingStatus.PAID ? 'PAGO' : 'NO HAY (DIFICIL)'}\n`;
        context += `  - Baños: ${p.hasRestroom ? 'SÍ' : 'NO (Matorral)'}\n`;
        context += `  - Consejo Local: ${p.tips}\n`;
        if (p.is_featured) context += `  - ESTADO: ¡SITIO DESTACADO/RECOMENDADO!\n`;
        context += "\n";
    });
    return context;
};

// Helper to format events into a text block for the AI
const formatEventsForContext = (events: Event[]): string => {
    if (!events || events.length === 0) return "\n\n### EVENTOS: No hay eventos en calendario por ahora.";
    
    // Inject current date so AI knows what is "Today" vs "Tomorrow"
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('es-PR', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });

    let context = `\n\n### AGENDA DE EVENTOS (LO QUE HAY HOY Y PRONTO):\n`;
    context += `**FECHA Y HORA ACTUAL DEL SISTEMA: ${formatter.format(now)}**\n`;
    context += `(Usa esta fecha para saber si un evento es hoy, mañana o ya pasó)\n\n`;

    events.forEach(e => {
        const start = new Date(e.startTime);
        const dateStr = formatter.format(start);
        
        context += `- EVENTO: ${e.title}\n`;
        context += `  - Cuándo: ${dateStr}\n`;
        context += `  - Dónde: ${e.locationName}\n`;
        context += `  - Qué es: ${e.description}\n`;
        context += `  - Categoría: ${e.category}\n\n`;
    });
    return context;
};

export const createConciergeChat = (places: Place[], events: Event[] = [], userLocation?: Coordinates): Chat => {
  const placeContext = formatPlacesForContext(places, userLocation);
  const eventContext = formatEventsForContext(events);
  
  let userContext = "";
  if (userLocation) {
      userContext = `\n\nCONTEXTO DE UBICACIÓN:\nEl usuario está en las coordenadas: Lat ${userLocation.lat}, Lng ${userLocation.lng}. 
      He calculado las distancias aproximadas en la lista de lugares arriba. Úsalas para recomendar cosas "cerca" si preguntan.`;
  }

  const fullSystemInstruction = BASE_SYSTEM_INSTRUCTION + userContext + placeContext + eventContext;

  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: fullSystemInstruction,
      temperature: 0.7, 
    },
  });
};

export const generateMarketingCopy = async (
    placeName: string, 
    category: string, 
    platform: 'instagram' | 'email' | 'radio' = 'instagram'
): Promise<string> => {
    if (!limiter.check()) return "¡Chico, aguanta! Mucha prisa. Intenta en un minuto.";
    
    try {
        const safeName = sanitizeInput(placeName);
        const safeCat = sanitizeInput(category);
        
        let prompt = "";
        
        if (platform === 'instagram') {
             prompt = `Genera un caption de Instagram atractivo, gracioso y al estilo de "El Veci" para el lugar "${safeName}" (${safeCat}) en Cabo Rojo. Usa emojis, hashtags relevantes (#CaboRojo #TurismoInterno) y un llamado a la acción corto.`;
        } else if (platform === 'email') {
             prompt = `Escribe un email marketing corto (Asunto y Cuerpo) al estilo de "El Veci" promoviendo "${safeName}" (${safeCat}). El asunto debe ser "Clickbait" gracioso pero honesto. El cuerpo debe invitar a visitar este fin de semana.`;
        } else if (platform === 'radio') {
             prompt = `Escribe un guion de anuncio de radio de 30 segundos para "${safeName}" (${safeCat}). Incluye efectos de sonido sugeridos entre paréntesis [FX: Sonido de mar]. Estilo enérgico y boricua.`;
        } else {
             prompt = `Genera un texto promocional corto para "${safeName}" (${safeCat}).`;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: BASE_SYSTEM_INSTRUCTION,
            }
        });
        return response.text || "¡Vaya, me quedé mudo del asombro!";
    } catch (e) {
        console.error(e);
        return "El Veci está tomando café, intenta ahorita.";
    }
}

export const enhanceDescription = async (currentDescription: string, name: string): Promise<string> => {
    if (!limiter.check()) return currentDescription;

    try {
        const safeDesc = sanitizeInput(currentDescription);
        const safeName = sanitizeInput(name);

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Mejora esta descripción para el lugar "${safeName}" en Cabo Rojo. Hazla atractiva, usando el estilo de "El Veci" (amigable, boricua, pero informativo y claro). Mantén la información original pero que suene mejor. \n\nDescripción original: "${safeDesc}"`,
            config: {
                systemInstruction: BASE_SYSTEM_INSTRUCTION,
            }
        });
        return response.text || currentDescription;
    } catch (e) {
        console.error(e);
        return currentDescription;
    }
}

export const suggestTags = async (name: string, category: string): Promise<string> => {
    if (!limiter.check()) return "";

    try {
        const safeName = sanitizeInput(name);
        const safeCat = sanitizeInput(category);

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Genera una lista de 5 a 8 etiquetas (tags) separadas por comas para este lugar en Cabo Rojo: "${safeName}" (Categoría: ${safeCat}). Las etiquetas deben servir para búsqueda (ej. playa, familiar, atardecer, mariscos, barato). Solo devuelve las palabras separadas por comas, nada más.`,
        });
        return response.text || "";
    } catch (e) {
        console.error(e);
        return "";
    }
}