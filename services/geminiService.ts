
import { GoogleGenAI, Type } from "@google/genai";
import { Place, Event, Coordinates, AdminLog, ItineraryItem, PlaceCategory, ChatMessage, DaySchedule } from "../types";

// Initialize Client-Side AI (Fallback)
const clientAI = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// --- HELPER: TIME FORMATTER ---
const formatTimeShort = (timeStr: string) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 || 12;
    // If minutes is 00, omit them (e.g., "5pm"). If not, show them ("5:30pm")
    return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2,'0')}${ampm}`;
};

// --- HELPER: GET TODAY'S HOURS ---
const getHoursString = (place: Place, dayIndex: number): string => {
    const oh = place.opening_hours;
    if (!oh) return "Horario no disp.";
    
    if (oh.type === '24_7') return "24/7";
    if (oh.type === 'sunrise_sunset') return "Sol-a-Sol";
    
    if (oh.structured && Array.isArray(oh.structured)) {
        const today = oh.structured.find((d: DaySchedule) => d.day === dayIndex);
        if (today) {
            if (today.isClosed) return "Cerrado hoy";
            return `${formatTimeShort(today.open)} - ${formatTimeShort(today.close)}`;
        }
    }
    
    return oh.note || "Verificar horario";
};

// --- HELPER: CONTEXT PREPARATION ---
// Optimized for Token Economy: Sends only essential data for decision making
const prepareAiContext = (places: Place[], events: Event[], userLoc: Coordinates | undefined, contextInfo: any) => {
    
    // 1. Establish "NOW" (Two Concepts)
    
    // A) Absolute Now (For Filtering): Use system timestamp. 
    // This compares UTC vs UTC. If an event ended 1 second ago, it is in the past.
    const absoluteNow = new Date();

    // B) PR Local Now (For Opening Hours & Chat Context):
    // We explicitly format a date string in PR time to get the correct day of week.
    const prTimeStr = new Date().toLocaleString("en-US", {timeZone: "America/Puerto_Rico"});
    const prNow = new Date(prTimeStr); 
    const currentDayIndex = prNow.getDay();

    // 2. Enrich Places (Minified)
    const enrichedPlaces = places.map(p => {
        const amenities = [];
        if (p.hasGenerator) amenities.push("Generador");
        if (p.isPetFriendly) amenities.push("PetFriendly");
        if (p.hasRestroom) amenities.push("Baños");
        
        // Truncate description to save tokens, AI only needs the gist
        const shortDesc = p.description ? p.description.substring(0, 100) : "";
        
        // Calculate Specific Hours for TODAY based on PR Time Day Index
        const hoursToday = getHoursString(p, currentDayIndex);

        return {
            id: p.id,
            n: p.name, // n = name
            c: p.category, // c = category
            d: `${shortDesc}...`, // d = desc
            l: p.address ? p.address.split(',')[0] : 'Cabo Rojo', // l = location zone
            a: amenities.join(','), // a = amenities
            s: p.status === 'open' ? 'Open' : 'Closed', // s = general status flag
            h: hoursToday // h = exact hours for today (NEW)
        };
    });

    // 3. Enrich Events (Strict Filtering)
    // We only want events that end AFTER "Now" (minus a 2 hour buffer for "just finished")
    // Using absoluteNow ensures we don't get timezone confusion.
    const activeThreshold = new Date(absoluteNow.getTime() - (2 * 60 * 60 * 1000));
    
    // Cap at 14 days into the future to focus the AI
    const twoWeeksFromNow = new Date(absoluteNow);
    twoWeeksFromNow.setDate(absoluteNow.getDate() + 14);

    const enrichedEvents = events
        .filter(e => {
            // Robust Date Parsing: Handle ISO strings from Supabase
            const eventEnd = new Date(e.endTime || e.startTime);
            const eventStart = new Date(e.startTime);
            
            // FILTER 1: Is it in the past? (Compare Absolute Timestamps)
            if (eventEnd.getTime() < activeThreshold.getTime()) return false;

            // FILTER 2: Is it too far in the future?
            if (eventStart.getTime() > twoWeeksFromNow.getTime()) return false;

            return true;
        })
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .map(e => ({
            t: e.title,
            d: e.description?.substring(0, 100),
            // Format strictly to ISO for AI logic, plus human readable for chat
            w: `${new Date(e.startTime).toLocaleString('es-PR', { timeZone: 'America/Puerto_Rico', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
            l: e.locationName
        }));

    return {
        p: enrichedPlaces, // p = places
        e: enrichedEvents, // e = events (Filtered strictly)
        ctx: { // User Context
            loc: userLoc ? "known" : "unknown",
            time: contextInfo.time, // "4:30 PM" (PR)
            day: contextInfo.date, // "Lunes, 24 de Octubre 2025" (PR)
            iso: contextInfo.iso_date, // Machine readable PR date
            weather: contextInfo.weather
        }
    };
};

// --- CLIENT-SIDE FALLBACK HANDLER ---
async function handleClientSideAI(action: string, payload: any) {
    console.log(`🤖 Switching to Client-Side AI for: ${action}`);
    
    switch (action) {
        case 'chat': {
            const { message, history, context } = payload;
            
            // Reconstruct system prompt with minified context awareness
            const systemInstruction = `
                Eres "El Veci", un señor amable, sabio y servicial que ha vivido en Cabo Rojo toda la vida.

                TU PERSONALIDAD Y TONO:
                1. **La Regla de los 105 Años:** Habla tan claro, sencillo y respetuoso que una persona de 105 años te entienda perfectamente. Evita palabras complicadas.
                2. **Boricua Sano:** Usa expresiones de aquí pero sanas ("¡Wepa!", "Ay bendito").
                3. **Humor:** Si se presta, termina con un chiste "mongo" sobre: la suegra, los hoyos, la luz o el calor.

                TU MISIÓN:
                Ayudar a tus vecinos usando *exclusivamente* los apuntes de tu libreta (la data provista).

                CONTEXTO CRÍTICO:
                - Fecha Actual (PR): ${context.ctx.day}
                - Hora Actual (PR): ${context.ctx.time}
                - Clima: ${context.ctx.weather}.

                LA LIBRETA (Data Minified):
                p=Places(n=name, c=cat, l=loc, h=HOY_HORARIO), e=Events.
                ${JSON.stringify(context)}

                REGLAS DE ORO:
                1. **Horarios Exactos:** Si preguntan "¿está abierto?" o "¿a qué hora cierra?", mira el campo 'h' (horario de hoy) y dilo exacto. Ej: "Sí, hoy cierran a las 5pm".
                2. **Anti-Alucinación:** Si no está en 'p' o 'e', di: "Mala mía, no lo tengo anotado".
                3. **Solo el Futuro:** La lista 'e' (Eventos) YA HA SIDO FILTRADA. Contiene SOLO eventos futuros próximos. Si la lista está vacía, no hay eventos. NO MENCIONES eventos pasados que recuerdes de tu entrenamiento general.
            `;
            
            const formattedHistory = history.map((h: any) => ({
                role: h.role === 'model' ? 'model' : 'user',
                parts: [{ text: h.text }]
            }));

            const chat = clientAI.chats.create({
                model: 'gemini-2.5-flash',
                history: formattedHistory,
                config: { 
                    systemInstruction,
                    responseMimeType: 'application/json'
                }
            });
            
            try {
                const result = await chat.sendMessage({ message });
                const json = JSON.parse(result.text || "{}");
                return { text: json.text, suggestedPlaceIds: json.suggested_place_ids };
            } catch (e) {
                return { text: "Mala mía, se me cayó la llamada. Intenta otra vez." };
            }
        }
        // ... (Keep other cases like itinerary, identify, etc. as they were) ...
        default: return { text: "Operación no soportada offline." };
    }
}

// --- MAIN CALLER ---
const callAI = async (action: string, payload: any) => {
    try {
        const res = await fetch(action === 'marketing' ? '/api/marketing' : '/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action === 'marketing' ? payload : { action, payload })
        });
        
        const contentType = res.headers.get("content-type");
        if (!res.ok || !contentType || !contentType.includes("application/json")) {
            throw new Error("Backend unavailable");
        }
        return await res.json();
    } catch (e) {
        if (!process.env.API_KEY) return null;
        try {
            return await handleClientSideAI(action, payload);
        } catch (clientError) {
            console.error(`Client AI Failed [${action}]:`, clientError);
            return null;
        }
    }
};

const extractJson = (data: any) => {
    if (!data) return {};
    if (typeof data === 'object') return data;
    try { return JSON.parse(data); } catch(e) { return {}; }
};

// --- EXPORTS ---

export const sendConciergeMessage = async (
    message: string, 
    history: ChatMessage[], 
    places: Place[], 
    events: Event[], 
    userLoc: Coordinates | undefined, 
    contextInfo: any
) => {
    // PRE-PROCESS DATA LOCALLY BEFORE SENDING TO API
    // This reduces the payload size and increases "smartness" by formatting data
    const optimizedContext = prepareAiContext(places, events, userLoc, contextInfo);

    const payload = {
        message,
        history: history.map(h => ({ role: h.role, text: h.text })),
        context: optimizedContext // Send the optimized object
    };

    const response = await callAI('chat', payload);
    return response || { text: "El Veci está durmiendo. Intenta más tarde." };
};

export const identifyPlaceFromImage = async (base64Image: string, places: Place[]) => {
    const res = await callAI('identify', { image: base64Image });
    return extractJson(res) || { matchedPlaceId: null, explanation: "No pude procesar la imagen." };
};

export const generateTripItinerary = async (vibe: string, places: Place[]): Promise<ItineraryItem[]> => {
    const res = await callAI('itinerary', { vibe, places: places.map(p => ({ name: p.name })) });
    return Array.isArray(res) ? res : (res?.itinerary || []);
};

export const moderateUserContent = async (name: string, description: string): Promise<{ safe: boolean; reason?: string }> => {
    try {
        const res = await fetch('/api/moderate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description })
        });
        if (res.ok) return await res.json();
    } catch (e) {}
    return { safe: true }; 
};

export const generateMarketingCopy = async (name: string, platform: string, tone: string): Promise<string> => {
    const res = await callAI('marketing', { name, category: 'General', platform, tone });
    return res?.text || "Error generating copy.";
};

export const categorizeAndTagPlace = async (name: string, description: string) => {
    const res = await callAI('categorize-tags', { name, description });
    return res;
};

export const enhanceDescription = async (name: string, description: string) => {
    const res = await callAI('enhance-description', { name, description });
    return res?.text;
};

export const generateElVeciTip = async (name: string, category: string, description: string) => {
    const res = await callAI('generate-tips', { name, category, description });
    return res?.text;
};

export const generateImageAltText = async (imageUrl: string) => {
    const res = await callAI('generate-alt-text', { imageUrl });
    return res?.text;
};

export const generateSeoMetaTags = async (name: string, description: string, category: string) => {
    const res = await callAI('generate-seo-meta-tags', { name, description, category });
    return res;
};

export const analyzeUserDemand = async (searchTerms: string[], categories: string[]) => {
    const res = await callAI('analyze-demand', { searchTerms, categories });
    return res;
};

export const parsePlaceFromRawText = async (text: string) => {
    const res = await callAI('parse-raw', { text });
    return res;
};

export const parseBulkPlaces = async (text: string) => {
    const res = await callAI('parse-bulk', { text });
    return res;
};

export const parseHoursFromText = async (text: string) => {
    const res = await callAI('parse-hours', { text });
    return res;
};

export const enrichPlaceMetadata = async () => ({});
export const generateExecutiveBriefing = async () => "{}";
export const generateAudioScript = async () => "";
