
import { GoogleGenAI, Type } from "@google/genai";
import { Place, Event, Coordinates, AdminLog, ItineraryItem, PlaceCategory, ChatMessage } from "../types";

// Initialize Client-Side AI (Fallback)
const clientAI = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// --- CLIENT-SIDE FALLBACK HANDLER ---
async function handleClientSideAI(action: string, payload: any) {
    console.log(`🤖 Switching to Client-Side AI for: ${action}`);
    
    switch (action) {
        case 'chat': {
            const { message, history, context } = payload;
            const systemInstruction = `
                Eres "El Veci", el guía local de Cabo Rojo, Puerto Rico.
                PERSONALIDAD: Amable, respetuoso, boricua.
                
                DATOS EN TIEMPO REAL:
                Aquí tienes la lista actualizada de lugares y eventos en Cabo Rojo:
                ${JSON.stringify(context.places.map((p:any) => ({
                    id: p.id,
                    name: p.name, 
                    cat: p.category, 
                    desc: p.description,
                    tips: p.tips,
                    vibe: p.vibe
                })).slice(0, 100))}

                Instrucciones:
                1. Usa SOLAMENTE esta información para responder sobre lugares.
                2. Si recomiendas un lugar, trata de mencionar su nombre exacto.
                3. Responde siempre en JSON: { "text": "...", "suggested_place_ids": ["id"] }
            `;
            
            // Map history for Gemini SDK
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
            const result = await chat.sendMessage({ message });
            try {
                const json = JSON.parse(result.text || "{}");
                return { text: json.text, suggestedPlaceIds: json.suggested_place_ids };
            } catch (e) {
                return { text: result.text };
            }
        }

        case 'itinerary': {
            const { vibe, places } = payload;
            const prompt = `Crea un itinerario de 1 día en Cabo Rojo. Vibe: "${vibe}". Lugares: ${places.map((p:any)=>p.name).join(', ')}. Return JSON Array with fields: time, activity, description, icon (fontawesome).`;
            const res = await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            return JSON.parse(res.text || "[]");
        }

        case 'identify': {
            const prompt = `Analyze image. Is it Cabo Rojo? Return JSON { "matchedPlaceId": null, "explanation": "string" }`;
            const res = await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: payload.image } }, { text: prompt }] },
                config: { responseMimeType: 'application/json' }
            });
            return JSON.parse(res.text || "{}");
        }

        case 'moderate': {
            const { name, description } = payload;
            const prompt = `Analiza el siguiente texto sugerido por un usuario.
            Nombre: ${name}
            Descripción: ${description}
            Responde SOLAMENTE con un objeto JSON:
            {"safe": boolean, "reason": "string (español boricua)"}`;
            
            const res = await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            return JSON.parse(res.text || "{\"safe\": true}");
        }

        case 'marketing': {
            const { name, category, platform, tone } = payload;
            let prompt = "";
            let isJson = false;
            
            if (platform === 'campaign_bundle') {
                isJson = true;
                prompt = `Act as Social Media Manager for "${name}" (${category}) in Cabo Rojo. Tone: ${tone}. Generate JSON Campaign Bundle: { "instagram_caption": "", "story_script": "", "email_subject": "", "email_body": "" }`;
            } else {
                prompt = `Generate ${platform} copy for "${name}" (${category}). Tone: ${tone}. Max 150 words.`;
            }

            const res = await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: isJson ? { responseMimeType: 'application/json' } : undefined
            });
            return { text: res.text };
        }

        // Admin Helpers
        case 'categorize-tags':
            return JSON.parse((await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Categorize "${payload.name}". Desc: "${payload.description}". Return JSON {category, tags[]}`,
                config: { responseMimeType: 'application/json' }
            })).text || "{}");

        case 'enhance-description':
            return { text: (await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Improve description for "${payload.name}": "${payload.description}"`
            })).text };

        case 'generate-tips':
            return { text: (await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Give a local tip for "${payload.name}" (${payload.category}).`
            })).text };

        case 'generate-alt-text':
            return { text: (await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [{ image: { url: payload.imageUrl } }, { text: "Generate alt text (max 15 words)." }] }
            })).text };

        case 'generate-seo-meta-tags':
            return JSON.parse((await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `SEO Meta Tags for "${payload.name}". Return JSON {metaTitle, metaDescription}`,
                config: { responseMimeType: 'application/json' }
            })).text || "{}");

        default:
            throw new Error(`Unknown Action: ${action}`);
    }
}

// --- MAIN CALLER ---
const callAI = async (action: string, payload: any) => {
    try {
        // 1. Try Backend API
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
        // 2. Fallback to Client-Side
        if (!process.env.API_KEY) {
            console.error("Missing API_KEY for client fallback.");
            return null;
        }
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

// REFACTORED: Stateless message sender to ensure fresh data on every turn
export const sendConciergeMessage = async (
    message: string, 
    history: ChatMessage[], 
    places: Place[], 
    events: Event[], 
    userLoc: Coordinates | undefined, 
    contextInfo: any
) => {
    const payload = {
        message,
        history: history.map(h => ({ role: h.role, text: h.text })),
        context: {
            // We pass the Full Place Data here so the AI sees Supabase updates immediately
            places: places.map(p => ({ 
                id: p.id, 
                name: p.name, 
                category: p.category, 
                description: p.description, // No truncation to give AI full context
                tips: p.tips,
                vibe: p.vibe,
                address: p.address,
                status: p.status,
                opening_hours: p.opening_hours // Passed so AI can check time
            })),
            events: events.map(e => ({ title: e.title, start: e.startTime })),
            userLoc, 
            ...contextInfo
        }
    };

    const response = await callAI('chat', payload);
    // Response object now contains { text, suggestedPlaceIds }
    return response || { text: "El Veci está durmiendo. Intenta más tarde." };
};

// Deprecated: Kept only if other files reference it, but `sendConciergeMessage` is preferred.
export const createConciergeChat = (places: Place[], events: Event[], userLoc: Coordinates | undefined, context: any) => {
    let history: any[] = [];
    return {
        sendMessage: async ({ message }: { message: string }) => {
            // This legacy wrapper now just calls the new stateless function
            const response = await sendConciergeMessage(message, history.map(h => ({ role: h.role, text: h.text })), places, events, userLoc, context);
            const text = response.text;
            history.push({ role: 'user', text: message });
            history.push({ role: 'model', text: text });
            return { text: text };
        }
    };
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
        const contentType = res.headers.get("content-type");
        if (res.ok && contentType && contentType.includes("application/json")) {
             return await res.json();
        }
    } catch (e) {
        // Fallback handled below
    }

    if (process.env.API_KEY) {
        try {
            return await handleClientSideAI('moderate', { name, description });
        } catch(e) { console.error(e); }
    }
    
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

export const enrichPlaceMetadata = async () => ({});
export const generateExecutiveBriefing = async () => "{}";
export const generateAudioScript = async () => "";
