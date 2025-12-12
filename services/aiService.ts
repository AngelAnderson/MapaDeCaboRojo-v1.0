
import { Place, Event, Coordinates, AdminLog, ItineraryItem, PlaceCategory } from "../types";
import { escapeHTML } from './supabase'; // Import the HTML escaper

// Helper to call Server-Side AI
const callAI = async (action: string, payload: any) => {
    try {
        const res = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload })
        });
        if (!res.ok) throw new Error("AI Service Error");
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
            const payload = {
                message,
                history,
                context: {
                    places: places.map(p => ({ name: p.name, category: p.category, description: p.description })),
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
    const res = await callAI('itinerary', { vibe, places: places.map(p => ({ name: p.name, category: p.category })) });
    const data = extractJson(res);
    return Array.isArray(data) ? data : [];
};

// 4. CONTENT MODERATION (Uses existing api/moderate.ts)
export const moderateUserContent = async (name: string, description: string) => {
    try {
        const res = await fetch('/api/moderate', {
            method: 'POST',
            body: JSON.stringify({ name, description })
        });
        return await res.json();
    } catch (e) { return { safe: true }; }
};

// 5. ENRICH METADATA
export const enrichPlaceMetadata = async (name: string, description: string) => {
    // Basic implementation for now, or route to details
    return { description, tags: [], vibe: [] };
};

// 6. BRIEFING (Uses existing api/cron-briefing.ts manually if needed, or skipped)
export const generateExecutiveBriefing = async (logs: AdminLog[], places: Place[]) => {
    return "{}"; // Briefings handled by CRON mostly
};

// 7. AUDIO GUIDE SCRIPT
export const generateAudioScript = async (placeName: string, description: string) => {
    const res = await callAI('script', { placeName, description });
    return res?.text || "Bienvenidos a Cabo Rojo.";
};

// 8. MARKETING GENERATOR (Uses existing api/marketing.ts)
export const generateMarketingCopy = async (name: string, platform: string, tone: string): Promise<string> => {
    try {
        const res = await fetch('/api/marketing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }, // Ensure Content-Type is set
            body: JSON.stringify({ name, platform, tone })
        });
        const data = await res.json();
        // If it's a campaign bundle, data.text will be the JSON string.
        // Otherwise, it's plain text.
        return data.text || "Error.";
    } catch (e) { return "Service unavailable."; }
};

// --- NEW AI ADMIN FUNCTIONS ---

// 9. CATEGORIZE & TAG PLACE
export const categorizeAndTagPlace = async (name: string, description: string): Promise<{ category: PlaceCategory, tags: string[] } | null> => {
    const res = await callAI('categorize-tags', { name, description });
    return extractJson(res);
};

// 10. ENHANCE DESCRIPTION
export const enhanceDescription = async (name: string, description: string): Promise<string | null> => {
    const res = await callAI('enhance-description', { name, description });
    return res?.text || null;
};

// 11. GENERATE EL VECI TIP
export const generateElVeciTip = async (name: string, category: PlaceCategory, description: string): Promise<string | null> => {
    const res = await callAI('generate-tips', { name, category, description });
    return res?.text || null;
};

// 12. GENERATE IMAGE ALT TEXT
export const generateImageAltText = async (imageUrl: string): Promise<string | null> => {
    const res = await callAI('generate-alt-text', { imageUrl });
    return res?.text || null;
};

// 13. GENERATE SEO META TAGS
export const generateSeoMetaTags = async (name: string, description: string, category: PlaceCategory): Promise<{ metaTitle: string, metaDescription: string } | null> => {
    const res = await callAI('generate-seo-meta-tags', { name, description, category });
    return extractJson(res);
};

// Removed findCoordinates and fetchPlaceDetails from here.
// They will now reside in services/placesService.ts and use the Google Places API via a proxy.
