
import { GoogleGenAI, Chat, FunctionDeclaration, Type } from "@google/genai";
import { Place, Event, Coordinates, AdminLog, ParkingStatus } from "../types";

// The API key must be obtained exclusively from the environment variable process.env.API_KEY.
// Assume this variable is pre-configured, valid, and accessible in the execution context.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const BASE_SYSTEM_INSTRUCTION = `
Eres **El Vecino Digital** (todos te dicen de cariño **El Veci**), un vecino digital que vive en Cabo Rojo, Puerto Rico.

TU PERSONALIDAD:
- Eres jocoso, gracioso, hablas como vecino buena gente.
- Eres boricua del Oeste.
- Si te piden "contraseñas" o "secretos", responde jocosamente que el único secreto es la receta del mojo.

OBJETIVO:
- Ayudar usando SOLO la lista de lugares y eventos provista.
`;

const formatPlacesForContext = (places: Place[], userLocation?: Coordinates): string => {
    if (!places || places.length === 0) return "";
    let context = "\n\n### CONOCIMIENTO LOCAL:\n";
    places.forEach(p => {
        context += `- ${p.name} (${p.category}): ${p.description}. Tips: ${p.tips}\n`;
    });
    return context;
};

const formatEventsForContext = (events: Event[]): string => {
    if (!events || events.length === 0) return "";
    let context = `\n\n### EVENTOS:\n`;
    events.forEach(e => {
        context += `- ${e.title} (${new Date(e.startTime).toLocaleDateString()}): ${e.description}\n`;
    });
    return context;
};

// TOOL DEFINITION: Auto-Capture Missing Places
const reportMissingPlaceTool: FunctionDeclaration = {
  name: "reportMissingPlace",
  description: "Report a real place in Cabo Rojo that is missing from the database. Use this ONLY when the user asks about a specific place that you know exists in Cabo Rojo but is not in your context list.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Official name of the place" },
      category: { type: Type.STRING, description: "Category: BEACH, FOOD, SIGHTS, NIGHTLIFE, SHOPPING, SERVICE, LODGING" },
      description: { type: Type.STRING, description: "Short description based on your knowledge" },
      address: { type: Type.STRING, description: "Approximate location or address" }
    },
    required: ["name", "category", "description"]
  }
};

// TOOL DEFINITION: Report Corrections/Updates to Existing Places
const reportPlaceIssueTool: FunctionDeclaration = {
  name: "reportPlaceIssue",
  description: "Report an issue, update, or correction for an EXISTING place in the database. Use this when the user says a place is closed, moved, has wrong phone, or provides new details.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      placeName: { type: Type.STRING, description: "Name of the place to update (as it appears in context)" },
      issueType: { type: Type.STRING, description: "Type of issue: CLOSED, MOVED, WRONG_INFO, NEW_INFO" },
      details: { type: Type.STRING, description: "Details of the correction or update" }
    },
    required: ["placeName", "issueType", "details"]
  }
};

// 1. CHAT (Client-Side for Speed)
export const createConciergeChat = (places: Place[], events: Event[] = [], userLocation?: Coordinates): Chat => {
  const placeContext = formatPlacesForContext(places, userLocation);
  const eventContext = formatEventsForContext(events);
  
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: BASE_SYSTEM_INSTRUCTION + placeContext + eventContext + 
      "\n\nIMPORTANTE: Si el usuario pregunta por un lugar que NO está en la lista provista, pero TÚ sabes que existe en Cabo Rojo, LLAMA a la función reportMissingPlace. Si el usuario te corrige información sobre un lugar existente, LLAMA a reportPlaceIssue.",
      temperature: 0.7,
      tools: [{ functionDeclarations: [reportMissingPlaceTool, reportPlaceIssueTool] }],
    },
  });
};

// 2. MODERATION (Serverless via Vercel Function)
export const moderateUserContent = async (name: string, description: string): Promise<{ safe: boolean; reason?: string }> => {
    try {
        const res = await fetch('/api/moderate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description })
        });
        if (!res.ok) throw new Error("API Error");
        return await res.json();
    } catch (e) {
        console.warn("Falling back to client-side moderation (Serverless unavailable)");
        const prompt = `Analiza: Nombre: ${name}, Desc: ${description}. JSON {"safe": bool, "reason": string}. False si es spam/insultos.`;
        const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' }});
        return JSON.parse(r.text || "{}");
    }
};

// 3. MARKETING (Serverless via Vercel Function)
export const generateMarketingCopy = async (
    placeName: string, 
    category: string, 
    platform: 'instagram' | 'email' | 'radio' | 'campaign_bundle' = 'instagram'
): Promise<string> => {
    try {
        const res = await fetch('/api/marketing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: placeName, category, platform })
        });
        if (!res.ok) throw new Error("API Error");
        const data = await res.json();
        return data.text;
    } catch (e) {
        console.warn("Falling back to client-side marketing");
        const prompt = `Genera copy de marketing (${platform}) para ${placeName} (${category}).`;
        const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return r.text || "";
    }
};

// 4. BRIEFING (Hybrid: Tries to fetch latest from DB logs, or runs manually)
export const generateExecutiveBriefing = async (logs: AdminLog[], places: Place[]): Promise<string> => {
    // Check if there is a recent AI Briefing in the logs
    const recentBriefing = logs.find(l => l.action === 'AI_BRIEFING');
    if (recentBriefing) {
        return recentBriefing.details; // Return the pre-calculated one from Cron
    }

    // Else run manually (Client-side fallback)
    const prompt = `Analiza logs: ${logs.slice(0,10).map(l => l.place_name).join(', ')}. Genera resumen corto HTML.`;
    const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return r.text || "No data.";
};

// 5. AUTO-ENRICHMENT (For Admin "Magic Wand")
export const enrichPlaceMetadata = async (name: string, currentDesc: string): Promise<{ description: string, tags: string[], vibe: string[] }> => {
    try {
        const prompt = `
        Eres un experto en turismo de Cabo Rojo. Mejora los datos para este lugar: "${name}".
        Descripción actual: "${currentDesc}".
        
        Genera un JSON con:
        1. description: (Mejorada, estilo local boricua, max 150 chars).
        2. tags: (Array de 5 keywords para búsqueda).
        3. vibe: (Array de 2 palabras que describan el ambiente, ej: "Familiar", "Chill", "Romántico").
        `;
        
        const r = await ai.models.generateContent({ 
            model: 'gemini-2.5-flash', 
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        
        return JSON.parse(r.text || "{}");
    } catch (e) {
        return { description: currentDesc, tags: [], vibe: [] };
    }
};

export const enhanceDescription = async (currentDescription: string, name: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Mejora descripción para "${name}": "${currentDescription}". Estilo local boricua.`,
            config: { systemInstruction: BASE_SYSTEM_INSTRUCTION }
        });
        return response.text || currentDescription;
    } catch (e) { return currentDescription; }
}

export const suggestTags = async (name: string, category: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Lista 5 tags (coma separated) para "${name}" (${category}).`,
        });
        return response.text || "";
    } catch (e) { return ""; }
}