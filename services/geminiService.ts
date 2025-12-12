
import { Place, Event, Coordinates, AdminLog, ItineraryItem, PlaceCategory, ParkingStatus } from "../types";

// Helper to call Server-Side AI
const callAI = async (action: string, payload: any) => {
    try {
        const res = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload })
        });
        
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "AI Service Error");
        }
        return await res.json();
    } catch (e) {
        console.error(`AI Error [${action}]:`, e);
        return null;
    }
};

const extractJson = (data: any) => {
    if (!data) return {};
    if (typeof data === 'object') return data;
    try { return JSON.parse(data); } catch(e) { return {}; }
};

// 1. CHAT & CONCIERGE (Proxy)
export const createConciergeChat = (places: Place[], events: Event[], userLoc: Coordinates | undefined, context: any) => {
    // Keep history locally to send to stateless server
    let history: any[] = [];
    
    return {
        sendMessage: async ({ message }: { message: string }) => {
            // OPTIMIZATION: Only send necessary fields to save tokens
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
                // Update local history
                history.push({ role: 'user', text: message });
                history.push({ role: 'model', text: response.text });
                return { text: response.text };
            }
            return { text: "Mala mía, El Veci se fue de break. Intenta ya mismo." };
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
    // Send lightweight place objects
    const minPlaces = places.map(p => ({ id: p.id, name: p.name, category: p.category }));
    const res = await callAI('itinerary', { vibe, places: minPlaces });
    
    // The API now returns the JSON directly, no need to extract from .text
    return Array.isArray(res) ? res : [];
};

// 4. CONTENT MODERATION
export const moderateUserContent = async (name: string, description: string) => {
    try {
        const res = await fetch('/api/moderate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description })
        });
        return await res.json();
    } catch (e) { return { safe: true }; }
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
    try {
        const res = await fetch('/api/marketing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, platform, tone })
        });
        const data = await res.json();
        return data.text || "Error.";
    } catch (e) { return "Service unavailable."; }
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
