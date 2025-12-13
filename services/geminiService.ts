
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
    return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2,'0')}${ampm}`;
};

// --- HELPER: DYNAMIC STATUS CALCULATOR ---
const analyzeStatus = (place: Place, prNow: Date): { text: string, isOpen: boolean } => {
    const oh = place.opening_hours;
    if (!oh) return { text: "Horario no disp.", isOpen: true }; // Benefit of doubt
    
    if (oh.type === '24_7') return { text: "Abierto 24/7", isOpen: true };
    if (oh.type === 'sunrise_sunset') {
        const h = prNow.getHours();
        const isDay = h >= 6 && h < 19;
        return { text: isDay ? "Abierto (Sol)" : "Cerrado (Noche)", isOpen: isDay };
    }

    if (oh.structured && Array.isArray(oh.structured)) {
        const dayIndex = prNow.getDay();
        const today = oh.structured.find((d: DaySchedule) => d.day === dayIndex);
        
        if (!today || today.isClosed) return { text: "Cerrado hoy", isOpen: false };
        if (!today.open || !today.close) return { text: "Horario varía", isOpen: true };

        const nowMins = prNow.getHours() * 60 + prNow.getMinutes();
        const [openH, openM] = today.open.split(':').map(Number);
        const [closeH, closeM] = today.close.split(':').map(Number);
        
        if (isNaN(openH) || isNaN(closeH)) return { text: oh.note || "Verificar", isOpen: true };

        const openMins = openH * 60 + openM;
        const closeMins = closeH * 60 + closeM;

        if (nowMins >= openMins && nowMins < closeMins) {
            const diff = closeMins - nowMins;
            if (diff < 60) return { text: `Cierra pronto (${diff} min)`, isOpen: true };
            return { text: `Abierto hasta ${formatTimeShort(today.close)}`, isOpen: true };
        } else {
            if (nowMins < openMins) return { text: `Abre a las ${formatTimeShort(today.open)}`, isOpen: false };
            return { text: "Cerrado por hoy", isOpen: false };
        }
    }
    
    return { text: oh.note || "Verificar", isOpen: true };
};

// --- HELPER: CONTEXT PREPARATION ---
const prepareAiContext = (places: Place[], events: Event[], userLoc: Coordinates | undefined, contextInfo: any) => {
    
    // 1. Establish "NOW"
    const absoluteNow = new Date();
    // PR Local Time for Logic
    const prTimeStr = new Date().toLocaleString("en-US", {timeZone: "America/Puerto_Rico"});
    const prNow = new Date(prTimeStr); 

    // 2. Weather Context Logic
    const weatherRaw = (contextInfo.weather || '').toLowerCase();
    const isRaining = weatherRaw.includes('rain') || weatherRaw.includes('lluvia') || weatherRaw.includes('tormenta');
    
    // 3. Enrich Places
    const enrichedPlaces = places.map(p => {
        const amenities = [];
        if (p.hasGenerator) amenities.push("Generador");
        if (p.isPetFriendly) amenities.push("PetFriendly");
        
        // Smart Status
        const status = analyzeStatus(p, prNow);
        
        // Rain Safety Logic
        // Outdoor categories are risky in rain
        const outdoorCats = ['BEACH', 'SIGHTS', 'ACTIVITY', 'PROJECT'];
        const isOutdoor = outdoorCats.includes(p.category);
        const isRainSafe = !isOutdoor || (p.tags && p.tags.includes('techo')); 

        return {
            id: p.id,
            n: p.name,
            c: p.category,
            d: p.description ? p.description.substring(0, 100) : "",
            l: p.address ? p.address.split(',')[0] : 'Cabo Rojo',
            a: amenities.join(','),
            // NEW FIELDS FOR AI LOGIC
            st: status.text, // "Abierto hasta 5pm" or "Cerrado"
            op: status.isOpen, // boolean for sorting
            rs: isRainSafe // Rain Safe boolean
        };
    });

    // 4. Smart Sort: Prioritize Open & Weather-Appropriate places
    enrichedPlaces.sort((a, b) => {
        // 1. Open places first
        if (a.op !== b.op) return a.op ? -1 : 1;
        
        // 2. If raining, RainSafe places first
        if (isRaining) {
            if (a.rs !== b.rs) return a.rs ? -1 : 1;
        }
        return 0;
    });

    // 5. Enrich Events
    const activeThreshold = new Date(absoluteNow.getTime() - (2 * 60 * 60 * 1000));
    const twoWeeksFromNow = new Date(absoluteNow);
    twoWeeksFromNow.setDate(absoluteNow.getDate() + 14);

    const enrichedEvents = events
        .filter(e => {
            const eventEnd = new Date(e.endTime || e.startTime);
            const eventStart = new Date(e.startTime);
            if (eventEnd.getTime() < activeThreshold.getTime()) return false;
            if (eventStart.getTime() > twoWeeksFromNow.getTime()) return false;
            return true;
        })
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .map(e => ({
            t: e.title,
            d: e.description?.substring(0, 100),
            w: `${new Date(e.startTime).toLocaleString('es-PR', { timeZone: 'America/Puerto_Rico', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
            l: e.locationName,
            iso: e.startTime // Pass ISO for easy comparison
        }));

    return {
        p: enrichedPlaces,
        e: enrichedEvents,
        ctx: {
            loc: userLoc ? "known" : "unknown",
            time: contextInfo.time,
            day: contextInfo.date,
            iso: contextInfo.iso_date, // Re-added ISO field
            weather: contextInfo.weather,
            is_raining: isRaining // Explicit flag for AI
        }
    };
};

// --- CLIENT-SIDE FALLBACK HANDLER ---
async function handleClientSideAI(action: string, payload: any) {
    console.log(`🤖 Switching to Client-Side AI for: ${action}`);
    
    switch (action) {
        case 'chat': {
            const { message, history, context } = payload;
            
            const systemInstruction = `
                Eres "El Veci", un señor amable, sabio y servicial que ha vivido en Cabo Rojo toda la vida.

                CONTEXTO CRÍTICO:
                - Fecha: ${context.ctx.day} (ISO: ${context.ctx.iso})
                - Hora: ${context.ctx.time}
                - Clima: ${context.ctx.weather} (Lluvia: ${context.ctx.is_raining ? 'SÍ' : 'NO'})

                LA LIBRETA (Priorizada):
                Los lugares ya están ordenados. Los primeros son los mejores para AHORA (están abiertos y convienen por el clima).
                Key: n=Nombre, st=STATUS_REAL (¡Confía en esto!), rs=RainSafe (Apto Lluvia).
                
                Lugares (p): ${JSON.stringify(context.p.slice(0, 50))} 
                Eventos (e): ${JSON.stringify(context.e)}

                REGLAS DE ORO:
                1. **Usa 'st':** Si 'st' dice "Cerrado", dile al usuario que está cerrado. No adivines.
                2. **Lluvia:** Si 'is_raining' es true, advierte sobre lugares al aire libre (donde rs=false). Recomienda los que tengan rs=true.
                3. **Humor:** Boricua sano ("Ay bendito", "Wepa").
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
    const optimizedContext = prepareAiContext(places, events, userLoc, contextInfo);

    const payload = {
        message,
        history: history.map(h => ({ role: h.role, text: h.text })),
        context: optimizedContext
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
