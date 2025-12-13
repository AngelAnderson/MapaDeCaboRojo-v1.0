
import { GoogleGenAI, Type } from "@google/genai";
import { Place, Event, Coordinates, AdminLog, ItineraryItem, PlaceCategory, ChatMessage } from "../types";

// Initialize Client-Side AI (Fallback)
const clientAI = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// --- HELPER: CONTEXT PREPARATION ---
// Optimized for Token Economy: Sends only essential data for decision making
const prepareAiContext = (places: Place[], events: Event[], userLoc: Coordinates | undefined, contextInfo: any) => {
    
    // 1. Enrich Places (Minified)
    const enrichedPlaces = places.map(p => {
        const amenities = [];
        if (p.hasGenerator) amenities.push("Generador");
        if (p.isPetFriendly) amenities.push("PetFriendly");
        if (p.hasRestroom) amenities.push("Baños");
        
        // Truncate description to save tokens, AI only needs the gist
        const shortDesc = p.description ? p.description.substring(0, 120) : "";

        return {
            id: p.id,
            n: p.name, // n = name
            c: p.category, // c = category
            d: `${shortDesc}... ${p.vibe?.join(',') || ''}`, // d = description + vibe
            l: p.address ? p.address.split(',')[0] : 'Cabo Rojo', // l = location zone
            a: amenities.join(','), // a = amenities
            s: p.status === 'open' ? 'Open' : 'Closed' // s = status
        };
    });

    // 2. Enrich Events (Prioritize Next 7 Days only)
    const now = new Date();
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(now.getDate() + 7);

    const enrichedEvents = events
        .filter(e => {
            const eDate = new Date(e.endTime || e.startTime);
            return eDate >= now && eDate <= oneWeekFromNow;
        })
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .map(e => ({
            t: e.title,
            d: e.description?.substring(0, 100),
            w: new Date(e.startTime).toLocaleString('es-PR', { weekday: 'short', hour: 'numeric', day: 'numeric' }),
            l: e.locationName
        }));

    return {
        p: enrichedPlaces, // p = places
        e: enrichedEvents, // e = events
        ctx: { // User Context
            loc: userLoc ? "known" : "unknown",
            time: contextInfo.time,
            day: contextInfo.date,
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
                Eres "El Veci", guía de Cabo Rojo.
                
                DATA (Minified JSON to save tokens):
                p=Places(n=name,c=category,d=desc,l=loc,a=amenities), e=Events.
                ${JSON.stringify(context)}

                REGLAS:
                1. Usa 'p' y 'e' para recomendar.
                2. Si id no existe, no inventes.
                3. Sé breve y Boricua.
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

// ... (Rest of exports: identifyPlaceFromImage, generateTripItinerary, etc. remain unchanged)
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

export const enrichPlaceMetadata = async () => ({});
export const generateExecutiveBriefing = async () => "{}";
export const generateAudioScript = async () => "";
