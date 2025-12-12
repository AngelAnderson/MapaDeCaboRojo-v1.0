
import { GoogleGenAI, Type } from "@google/genai";
import { Place, Event, Coordinates, AdminLog, ItineraryItem, PlaceCategory } from "../types";
import { escapeHTML } from './supabase'; 

// Initialize Client-Side AI (Fallback)
// Note: In production, API calls should go through the backend to protect the Key.
// This fallback ensures the app works in local dev environments or if the backend is down.
const clientAI = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// --- PROMPTS & LOGIC (Shared/Fallback) ---

const getSystemInstruction = (context: any) => `
    Eres "El Veci", el guía local de Cabo Rojo, Puerto Rico.
    
    PERSONALIDAD:
    - Amable, respetuoso y hablas español de Puerto Rico (pero claro).
    - Tu objetivo es ayudar a la gente a pasarla bien.
    - Siempre terminas con un chiste corto y sano.

    DATOS:
    - Base de datos local: ${JSON.stringify(context.localDatabase).substring(0, 20000)}...
    - Usa Google Search SOLAMENTE si preguntan por el clima actual o noticias recientes. Para lugares, usa tu base de datos primero.

    CONTEXTO:
    - Fecha: ${context.date}
    - Hora: ${context.time}
    - Clima: ${context.weather}
`;

// Helper to call Server-Side AI with Client-Side Fallback
const callAI = async (action: string, payload: any) => {
    // 1. Try Server-Side API
    try {
        const res = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload })
        });
        
        // If 404 (Local dev without server) or 500, throw to fallback
        const contentType = res.headers.get("content-type");
        if (!res.ok || !contentType || !contentType.includes("application/json")) {
            throw new Error(`Server unavailable (${res.status})`);
        }
        
        return await res.json();
    } catch (serverError) {
        console.warn(`Backend AI [${action}] unreachable, switching to Client-Side Fallback.`);
        
        // 2. Client-Side Fallback
        if (!process.env.API_KEY) {
            console.error("No API Key found for client fallback.");
            return null;
        }

        try {
            return await handleClientSideAI(action, payload);
        } catch (clientError) {
            console.error("Client AI Error:", clientError);
            return null;
        }
    }
};

// Client-Side Implementation of API Handlers
async function handleClientSideAI(action: string, payload: any) {
    switch (action) {
        case 'chat': {
            const { message, history, context } = payload;
            
            // Prepare local DB context similar to backend
            const localDatabase = {
                places: context.places.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    category: p.category,
                    desc: p.description?.substring(0, 150),
                    tags: p.tags,
                    status: p.status,
                    address: p.address
                })).slice(0, 100),
                events: context.events
            };

            const systemInstruction = getSystemInstruction({ ...context, localDatabase });
            
            const validHistory = (history || [])
                .filter((h: any) => h.role && h.text)
                .map((h: any) => ({
                    role: h.role,
                    parts: [{ text: h.text }]
                }));

            const chat = clientAI.chats.create({
                model: 'gemini-2.5-flash',
                history: validHistory,
                config: { systemInstruction }
            });

            const result = await chat.sendMessage({ message });
            return { text: result.text };
        }

        case 'itinerary': {
            const { vibe, places } = payload;
            const simplifiedPlaces = places.map((p: any) => `${p.name} (ID: ${p.id}, Cat: ${p.category})`).join(', ');
            const prompt = `Crea un itinerario de 1 día en Cabo Rojo. Vibe: "${vibe}". Lugares: ${simplifiedPlaces}. Rules: JSON Array, use FontAwesome icons.`;
            
            const responseSchema = {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        time: { type: Type.STRING },
                        activity: { type: Type.STRING },
                        description: { type: Type.STRING },
                        placeId: { type: Type.STRING, nullable: true },
                        icon: { type: Type.STRING }
                    },
                    required: ["time", "activity", "description", "icon"]
                }
            };

            const res = await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { 
                    responseMimeType: 'application/json',
                    responseSchema: responseSchema
                }
            });
            return JSON.parse(res.text || "[]");
        }

        case 'identify': {
            const { image } = payload;
            const prompt = `Analyze image. Is it Cabo Rojo, PR? Return JSON: { "matchedPlaceId": string | null, "explanation": "Spanish explanation" }`;
            const res = await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: image } }, { text: prompt }] },
                config: { responseMimeType: 'application/json' }
            });
            return JSON.parse(res.text || "{}");
        }
        
        // Simple Text Handlers
        case 'script':
        case 'enhance-description':
        case 'generate-tips':
        case 'generate-alt-text':
            const promptMap: Record<string, string> = {
                'script': `Escribe guión audio guía para "${payload.placeName}".`,
                'enhance-description': `Mejora descripción: "${payload.description}" para "${payload.name}".`,
                'generate-tips': `Consejo local para "${payload.name}".`,
                'generate-alt-text': `Alt text for image (max 15 words).`
            };
            
            const content = action === 'generate-alt-text' 
                ? { parts: [{ image: { url: payload.imageUrl } }, { text: promptMap[action] }] }
                : promptMap[action];

            const txtRes = await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: content as any
            });
            return { text: txtRes.text };

        case 'categorize-tags':
        case 'generate-seo-meta-tags':
             const jsonPrompts: Record<string, string> = {
                'categorize-tags': `Categorize "${payload.name}". Desc: "${payload.description}". Return JSON {category, tags[]}`,
                'generate-seo-meta-tags': `SEO meta tags for "${payload.name}". Return JSON {metaTitle, metaDescription}`
             };
             const jsonRes = await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: jsonPrompts[action],
                config: { responseMimeType: 'application/json' }
             });
             return JSON.parse(jsonRes.text || "{}");

        default:
            return null;
    }
}

const extractJson = (data: any) => {
    if (!data) return {};
    if (typeof data === 'object') return data;
    try { return JSON.parse(data); } catch(e) { return {}; }
};

// 1. CHAT & CONCIERGE (Proxy)
export const createConciergeChat = (places: Place[], events: Event[], userLoc: Coordinates | undefined, context: any) => {
    // Keep history locally
    let history: any[] = [];
    
    return {
        sendMessage: async ({ message }: { message: string }) => {
            // OPTIMIZATION: Send minified data
            const minPlaces = places.map(p => ({
                id: p.id,
                name: p.name,
                category: p.category,
                description: p.description ? p.description.substring(0, 200) : "",
                status: p.status,
                address: p.address,
                tags: p.tags
            }));

            const payload = {
                message,
                history,
                context: {
                    places: minPlaces,
                    events: events.map(e => ({ title: e.title, start: e.startTime })),
                    userLoc,
                    ...context
                }
            };

            const response = await callAI('chat', payload);
            
            if (response && response.text) {
                history.push({ role: 'user', text: message });
                history.push({ role: 'model', text: response.text });
                return { text: response.text };
            }
            return { text: "Mala mía, El Veci se fue de break. Verifica tu conexión." };
        }
    };
};

// 2. IMAGE IDENTIFICATION
export const identifyPlaceFromImage = async (base64Image: string, places: Place[]) => {
    const res = await callAI('identify', { image: base64Image });
    return extractJson(res) || { matchedPlaceId: null, explanation: "No pude ver bien la foto." };
};

// 3. TRIP ITINERARY
export const generateTripItinerary = async (vibe: string, places: Place[]): Promise<ItineraryItem[]> => {
    const minPlaces = places.map(p => ({ id: p.id, name: p.name, category: p.category }));
    const res = await callAI('itinerary', { vibe, places: minPlaces });
    return Array.isArray(res) ? res : [];
};

// 4. CONTENT MODERATION
export const moderateUserContent = async (name: string, description: string) => {
    // Use direct fetch here or reuse callAI with a new 'moderate' action if moved to client
    try {
        const res = await fetch('/api/moderate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description })
        });
        if (!res.ok) throw new Error("Backend Moderate Failed");
        return await res.json();
    } catch (e) { 
        // Simple client-side fallback check
        const badWords = ['bad', 'hate', 'kill']; // Add real list
        const isSafe = !badWords.some(w => (name + description).toLowerCase().includes(w));
        return { safe: isSafe }; 
    }
};

// 5. ENRICH METADATA
export const enrichPlaceMetadata = async (name: string, description: string) => {
    return { description, tags: [], vibe: [] };
};

// 6. BRIEFING
export const generateExecutiveBriefing = async (logs: AdminLog[], places: Place[]) => {
    return "{}";
};

// 7. AUDIO GUIDE SCRIPT
export const generateAudioScript = async (placeName: string, description: string) => {
    const res = await callAI('script', { placeName, description });
    return res?.text || "Bienvenidos a Cabo Rojo.";
};

// 8. MARKETING GENERATOR
export const generateMarketingCopy = async (name: string, platform: string, tone: string) => {
    // Try api/marketing first
    try {
        const res = await fetch('/api/marketing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, platform, tone })
        });
        if (!res.ok) throw new Error("Backend Marketing Failed");
        const data = await res.json();
        return data.text;
    } catch (e) {
        // Simple fallback
        return `Come visit ${name}! It's great.`; 
    }
};

// 9. NEW ADMIN AI FUNCTIONS
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
