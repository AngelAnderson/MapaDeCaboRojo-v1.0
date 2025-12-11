
import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import { Place, Event, Coordinates, AdminLog, ItineraryItem, PlaceCategory, ParkingStatus } from "../types";

// --- ROBUST API KEY INITIALIZATION ---
const getApiKey = (): string => {
  // Check standard Vite env var
  // @ts-ignore
  if (import.meta.env?.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
  
  // Check alternative Vite env var
  // @ts-ignore
  if (import.meta.env?.VITE_GOOGLE_API_KEY) return import.meta.env.VITE_GOOGLE_API_KEY;
  
  // Check process.env (injected by vite.config.ts define)
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env?.API_KEY) return process.env.API_KEY;

  return '';
};

const apiKey = getApiKey();

if (!apiKey) {
    console.error("⚠️ GEMINI API KEY MISSING. Smart features will fail. Check .env file.");
}

const ai = new GoogleGenAI({ apiKey });

// 1. CHAT & CONCIERGE
export const createConciergeChat = (places: Place[], events: Event[], userLoc: Coordinates | undefined, context: any) => {
    const placesContext = places.map(p => `${p.name} (${p.category}): ${p.description}`).join('\n');
    const eventsContext = events.map(e => `${e.title} (${e.startTime}): ${e.description}`).join('\n');
    
    const systemInstruction = `
    You are 'El Veci', a local concierge for Cabo Rojo, Puerto Rico. 
    Speak in 'Spanglish' with local Puerto Rican slang (Boricua style). Be helpful, friendly, and cool.
    
    Context:
    Date/Time: ${context.date} ${context.time}
    Weather: ${context.weather}
    User Location: ${userLoc ? `${userLoc.lat}, ${userLoc.lng}` : "Unknown"}
    
    Places Database:
    ${placesContext}
    
    Events Database:
    ${eventsContext}
    
    Answer questions about where to go, what to eat, and what to do. 
    If you recommend a place, use its exact name so the UI can link to it.
    `;

    const reportMissingPlaceTool: FunctionDeclaration = {
        name: "reportMissingPlace",
        description: "Report a place that is missing from the database.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING },
                category: { type: Type.STRING },
                description: { type: Type.STRING },
                address: { type: Type.STRING }
            },
            required: ["name", "category"]
        }
    };

    const reportPlaceIssueTool: FunctionDeclaration = {
        name: "reportPlaceIssue",
        description: "Report an issue with a place (closed, wrong info).",
        parameters: {
            type: Type.OBJECT,
            properties: {
                placeName: { type: Type.STRING },
                issueType: { type: Type.STRING },
                details: { type: Type.STRING }
            },
            required: ["placeName", "issueType"]
        }
    };

    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction,
            tools: [{ functionDeclarations: [reportMissingPlaceTool, reportPlaceIssueTool] }]
        }
    });
};

// 2. IMAGE IDENTIFICATION
export const identifyPlaceFromImage = async (base64Image: string, places: Place[]) => {
    const prompt = `
    Analyze this image. Is it a location in Cabo Rojo, Puerto Rico? 
    Compare it with these known places: ${places.map(p => p.name).join(', ')}.
    
    Return JSON: { "matchedPlaceId": string | null, "explanation": string }
    The explanation should be in Puerto Rican Spanish/Spanglish, friendly style.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                    { text: prompt }
                ]
            },
            config: { responseMimeType: 'application/json' }
        });
        
        const text = response.text || "{}";
        return JSON.parse(text);
    } catch (e) {
        return { matchedPlaceId: null, explanation: "Mala mía, no pude reconocer la foto." };
    }
};

// 3. TRIP ITINERARY
export const generateTripItinerary = async (vibe: string, places: Place[]): Promise<ItineraryItem[]> => {
    const placesList = places.map(p => `${p.name} (${p.category})`).join(', ');
    const prompt = `
    Create a 1-day itinerary for Cabo Rojo based on this vibe: "${vibe}".
    Available places: ${placesList}.
    
    Return JSON array of objects: 
    [{ "time": "09:00 AM", "activity": "Title", "description": "Short desc", "placeId": "id if matches", "icon": "fa-icon" }]
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        
        const text = response.text || "[]";
        return JSON.parse(text);
    } catch (e) {
        return [];
    }
};

// 4. CONTENT MODERATION
export const moderateUserContent = async (name: string, description: string) => {
    const prompt = `
    Analyze this user-submitted place:
    Name: ${name}
    Desc: ${description}
    
    Is it safe/appropriate for a family-friendly tourism app?
    Return JSON: { "safe": boolean, "reason": "Reason in Spanish if unsafe" }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        return JSON.parse(response.text || '{"safe": true}');
    } catch (e) {
        return { safe: true };
    }
};

// 5. ENRICH METADATA
export const enrichPlaceMetadata = async (name: string, description: string) => {
    const prompt = `
    Improve this place description for a travel app (Cabo Rojo, PR). Make it engaging (Spanglish).
    Also generate tags and a "vibe" list.
    Name: ${name}
    Original: ${description}
    
    Return JSON: { "description": string, "tags": string[], "vibe": string[] }
    `;

    try {
         const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return { description, tags: [], vibe: [] };
    }
};

// 6. BRIEFING
export const generateExecutiveBriefing = async (logs: AdminLog[], places: Place[]) => {
    const logSummary = logs.slice(0, 20).map(l => `${l.action}: ${l.details}`).join('\n');
    const prompt = `
    Generate a daily briefing based on these logs:
    ${logSummary}
    
    Return JSON with HTML strings for "en" and "es" dashboard widgets.
    { "en": "<div>...</div>", "es": "<div>...</div>" }
    `;

    try {
         const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        return response.text || "{}";
    } catch (e) {
        return "{}";
    }
};

// 7. EDITORIAL
export const generateEditorialContent = async (type: string, places: Place[], events: Event[]) => {
     const prompt = `Generate editorial content for ${type}. Context: ${places.length} places, ${events.length} events.`;
     try {
         const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return response.text || "";
    } catch (e) {
        return "Error generating content.";
    }
};

// 8. LOCATION RESOLVER
export const findCoordinates = async (query: string): Promise<{ lat: number, lng: number } | null> => {
    const linkRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const match = query.match(linkRegex);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

    const qParamRegex = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
    const qMatch = query.match(qParamRegex);
    if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };

    const prompt = `
    Find coordinates for "${query}" in Puerto Rico.
    Return ONLY a raw JSON object: { "lat": number, "lng": number }.
    If not found, return null.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { 
                // responseMimeType: "application/json", // REMOVED: Cannot be used with googleSearch tool
                tools: [{ googleSearch: {} }]
            }
        });
        // Clean markdown if present
        const text = (response.text || "{}").replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (e) {
        console.error("Coords API Error:", e);
        return null;
    }
}

// 9. PLACE DETAILS (SMART IMPORT)
export const fetchPlaceDetails = async (query: string): Promise<Partial<Place> | null> => {
    const prompt = `
    Search for '${query}'. If it is a real place in or near Cabo Rojo, Puerto Rico, extract its details.
    
    Return a strict JSON object (no markdown) with this schema:
    {
      "name": "Official Name",
      "description": "Short, engaging description in local Puerto Rican spanish style (max 150 chars).",
      "category": "One of: BEACH, FOOD, SIGHTS, NIGHTLIFE, LOGISTICS, SHOPPING, LODGING, HEALTH, ACTIVITY, SERVICE",
      "lat": number (latitude),
      "lng": number (longitude),
      "address": "Full physical address",
      "phone": "Phone number or empty string",
      "website": "Website or Facebook URL or empty string",
      "priceLevel": "$" or "$$" or "$$$",
      "tags": ["Tag1", "Tag2", "Tag3"],
      "tips": "One specific local tip for this place (e.g. what to order, best time)",
      "imageUrl": "URL of a representative photo if found (otherwise null)",
      "hours": "Summary of opening hours (e.g. 'Daily 8am-5pm' or 'Wed-Sun 12pm-9pm')",
      "parking": "One of: 'FREE', 'PAID', 'NONE' (Infer from context/reviews)",
      "petFriendly": boolean (Infer if possible, default false),
      "hasRestroom": boolean (Infer if possible, default true for restaurants),
      "hasGenerator": boolean (Look for keywords like 'planta', 'generador' in reviews. Default false if unsure.)
    }
    
    If the place is NOT found or NOT in Puerto Rico, return null.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { 
                // responseMimeType: "application/json", // REMOVED: Cannot be used with googleSearch tool
                tools: [{ googleSearch: {} }] 
            }
        });
        
        let jsonStr = response.text || "null";
        // Ensure clean JSON string
        jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const data = JSON.parse(jsonStr);
        if (!data || !data.name) return null;

        // Map String Parking to Enum
        let parkingStatus = ParkingStatus.FREE;
        if (data.parking === 'PAID') parkingStatus = ParkingStatus.PAID;
        if (data.parking === 'NONE') parkingStatus = ParkingStatus.NONE;

        return {
            name: data.name,
            description: data.description,
            category: data.category as PlaceCategory,
            coords: { lat: data.lat, lng: data.lng },
            address: data.address,
            phone: data.phone,
            website: data.website,
            priceLevel: data.priceLevel,
            tags: data.tags || [],
            tips: data.tips || '',
            imageUrl: data.imageUrl || '',
            parking: parkingStatus,
            isPetFriendly: !!data.petFriendly,
            hasRestroom: !!data.hasRestroom,
            hasGenerator: !!data.hasGenerator,
            opening_hours: { note: data.hours || '', type: 'fixed' },
            // Construct a smart Google Maps URL if one wasn't provided (usually easier to just search query)
            gmapsUrl: query.includes('http') ? query : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.name + ' Cabo Rojo')}`
        };
    } catch (e) {
        console.error("Smart Import Error (Detail):", e);
        return null;
    }
};
