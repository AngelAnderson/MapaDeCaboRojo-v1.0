
import { GoogleGenAI, Type } from "@google/genai";
import { Place, Event, Coordinates, AdminLog, ItineraryItem, PlaceCategory, ChatMessage, Person } from "../types";
import { getAdminLogs, getPlaces, supabase } from "./supabase"; // Import data fetchers + supabase client

// Initialize Client-Side AI (Fallback)
const clientAI = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// --- LOCAL KNOWLEDGE CHECK (shared between server and client fallback) ---
async function checkLocalKnowledgeClient(query: string): Promise<string | null> {
    try {
        const { data } = await supabase.from('local_knowledge').select('answer, question_patterns');
        if (!data?.length) return null;
        const lower = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¿?¡!.,;:'"()]/g, '').trim();
        let bestScore = 0;
        let bestAnswer: string | null = null;
        for (const row of data) {
            for (const rawP of (row.question_patterns || [])) {
                const pat = rawP.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                let score = 0;
                if (lower === pat) score = 100;
                else if (lower.includes(pat) && pat.length >= 6) score = 50 + pat.length;
                else if (pat.includes(lower) && lower.length >= 4) score = 40 + lower.length;
                else if (pat.includes(' ')) {
                    const pWords = pat.split(/\s+/);
                    if (pWords.every((w: string) => w.length < 3 || lower.includes(w)) && pWords.length >= 2)
                        score = 30 + pWords.length * 5;
                }
                if (score > bestScore) { bestScore = score; bestAnswer = row.answer; }
            }
        }
        return bestScore >= 30 ? bestAnswer : null;
    } catch { return null; }
}

// --- CLIENT-SIDE FALLBACK HANDLER ---
async function handleClientSideAI(action: string, payload: any) {
    console.log(`🤖 Switching to Client-Side AI for: ${action}`);

    switch (action) {
        case 'chat': {
            const { message, history, context } = payload;
            const { ctx, ppl } = context;

            // Check local_knowledge FIRST (same 51 entries as *7711 bot)
            const knowledgeAnswer = await checkLocalKnowledgeClient(message);
            if (knowledgeAnswer) {
                return { text: knowledgeAnswer, suggestedPlaceIds: [] };
            }

            const systemInstruction = `
                Eres "El Veci", un señor amable y sabio que ha vivido en Cabo Rojo toda la vida.
                
                --- DATOS DE TIEMPO REAL (CLIENT-SIDE) ---
                FECHA DE HOY: ${ctx.date} (Día: ${ctx.current_day})
                HORA ACTUAL: ${ctx.time}
                CLIMA: ${ctx.weather}
                ------------------------------------------

                TU PERSONALIDAD:
                - **Regla de los 105 Años:** Habla tan sencillo y claro que un abuelo de 105 años te entienda perfectamente.
                - **Vecino:** Saluda como familia ("¡Wepa!", "Saludos", "Mijo/a").
                
                DATOS EN TIEMPO REAL:
                Usa SOLO esta lista:
                ${JSON.stringify(context.places.map((p:any) => ({
                    id: p.id,
                    name: p.name, 
                    cat: p.category, 
                    desc: p.description,
                    address: p.address,
                    opening_hours: p.opening_hours
                })).slice(0, 100))}

                EVENTOS:
                ${JSON.stringify(context.events || [])}

                GENTE (Alcalde, Próceres):
                ${JSON.stringify(ppl || [])}

                REGLAS DE ORO:
                1. **TIEMPO:** Si preguntan hora/fecha, usa los datos de arriba.
                2. **STATUS:** Usa la hora ${ctx.time} para saber si está abierto.
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

        case 'parse-raw': {
            const { text } = payload;
            const prompt = `
                Act as a Data Entry Specialist.
                Analyze this raw text about a place in Cabo Rojo, PR: "${text}"
                
                Extract structured data into this JSON format:
                {
                    "name": string (Title Case),
                    "description": string (Engaging, max 150 chars),
                    "category": string (One of: BEACH, FOOD, SIGHTS, LOGISTICS, LODGING, SHOPPING, HEALTH, NIGHTLIFE, ACTIVITY, SERVICE),
                    "address": string (or empty),
                    "phone": string (or empty),
                    "website": string (or empty),
                    "tips": string (Local tip based on text),
                    "tags": string[],
                    "priceLevel": string ($, $$, $$$),
                    "parking": string (FREE, PAID, NONE),
                    "hasRestroom": boolean,
                    "isPetFriendly": boolean
                }
            `;
            const res = await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            return JSON.parse(res.text || "{}");
        }

        case 'parse-bulk': {
            const { text } = payload;
            const prompt = `
                You are a data entry assistant for a tourism app in Cabo Rojo, Puerto Rico.
                Process this list of raw text (names or descriptions).
                Return a JSON ARRAY of objects.
                
                Input List:
                ${text}

                For EACH item, guess the following based on the name/context:
                - name: The clean name of the place.
                - category: One of [BEACH, FOOD, SIGHTS, LOGISTICS, LODGING, SHOPPING, HEALTH, NIGHTLIFE, ACTIVITY, SERVICE]. Default to SERVICE if unsure.
                - description: A short, catchy description (max 10 words) in Spanish.
                - tags: Array of 2-3 keywords.
                
                Return ONLY the JSON Array.
            `;
            const res = await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            return JSON.parse(res.text || "[]");
        }

        case 'analyze-demand': {
            const { searchTerms, categories } = payload;
            const prompt = `
            You are a Strategic Business Intelligence Analyst for Cabo Rojo Tourism.
            
            INPUT DATA:
            - Raw Search Terms: ${JSON.stringify(searchTerms)}
            - Existing Categories: ${categories.join(', ')}

            TASK:
            1. Analyze the search terms to "read the mind" of the user. What is the intent behind the searches? (e.g. "Pizza" at 9am might mean "Breakfast", "Romantic" might mean "Sunset").
            2. Identify Content Gaps: What are they searching for that we likely lack?
            3. Predict Trends: Based on this, what should we add next?

            RETURN JSON ONLY:
            {
              "trending_topics": [{"topic": string, "count": number}],
              "content_gaps": [{"gap": string, "description": string, "urgency": "HIGH" | "MEDIUM" | "LOW"}],
              "recommendation": string (executive summary in Spanish, focused on business decisions),
              "user_intent_prediction": string (What users *really* want, Spanish)
            }
            `;
            const res = await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            return JSON.parse(res.text || "{}");
        }

        // --- NEW: Client-Side Report Generation Fallback ---
        case 'generate-report': {
            const { range } = payload;
            // 1. Fetch Data Manually since we can't use server logs directly easily
            const logs = await getAdminLogs(100);
            const places = await getPlaces();
            
            // Filter logs
            const days = range === 'monthly' ? 30 : 7;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            const recentLogs = logs.filter((l: AdminLog) => new Date(l.created_at) >= startDate);
            
            const searchTerms = recentLogs.filter(l => l.action === 'USER_SEARCH').map(l => l.place_name);
            const chatCount = recentLogs.filter(l => l.action === 'USER_CHAT').length;
            const updatesCount = recentLogs.filter(l => ['CREATE', 'UPDATE', 'CREATE_EVENT'].includes(l.action)).length;

            const prompt = `
                Role: Business Intelligence Analyst for "El Veci" (Cabo Rojo Tourism App).
                Task: Generate a ${range === 'monthly' ? 'Monthly' : 'Weekly'} Executive Report (CLIENT SIDE).
                Period: Last ${days} days.
                
                DATA METRICS:
                - Total Places: ${places.length}
                - New User Searches: ${searchTerms.length}
                - Chat Interactions: ${chatCount}
                - Content Updates: ${updatesCount}
                
                SEARCH INTENT SAMPLES:
                "${searchTerms.slice(0, 50).join('", "')}"...

                OUTPUT FORMAT: Markdown.
                
                STRUCTURE:
                # 📅 ${range === 'monthly' ? 'Monthly' : 'Weekly'} Executive Briefing
                ## 🚀 Performance Pulse
                (Summary of activity)
                ## 🔍 User Intent Analysis
                (What are people looking for?)
                ## 🏗️ Operational Update
                (Content changes)
                ## 🎯 Action Items
                (3 recommendations)
            `;

            const res = await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });
            return { text: res.text };
        }

        // Admin Helpers
        case 'categorize-tags':
            return JSON.parse((await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Categorize "${payload.name}". Desc: "${payload.description}". Return structured JSON {category, tags[], amenities: {parking, hasRestroom, isPetFriendly...}}`,
                config: { responseMimeType: 'application/json' }
            })).text || "{}");

        case 'enhance-description':
            return { text: (await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Rewrite description for "${payload.name}": "${payload.description}". Tone: El Veci (Friendly, Boricua Sano, 105-year rule). Max 150 chars.`
            })).text };

        case 'generate-tips':
            return { text: (await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Consejo local "El Veci" para "${payload.name}" (${payload.category}). Contexto: ${payload.description}. Short & Helpful.`
            })).text };

        case 'generate-alt-text': {
            try {
                const response = await fetch(payload.imageUrl);
                const blob = await response.blob();
                const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                    reader.readAsDataURL(blob);
                });
                
                return { text: (await clientAI.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: { parts: [{ inlineData: { mimeType: blob.type || 'image/jpeg', data: base64 } }, { text: "Generate alt text (max 15 words)." }] }
                })).text };
            } catch (e) {
                return { text: "Error generating alt text." };
            }
        }

        case 'generate-seo-meta-tags':
            return JSON.parse((await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Generate 3 SEO Options for "${payload.name}". Return JSON { options: [{metaTitle, metaDescription}] }`,
                config: { responseMimeType: 'application/json' }
            })).text || "{ options: [] }");

        case 'parse-hours':
            return JSON.parse((await clientAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Parse hours text "${payload.text}". Return JSON { structured: DaySchedule[], note: string }.`,
                config: { responseMimeType: 'application/json' }
            })).text || "{}");

        default:
            throw new Error(`Unknown Action: ${action}`);
    }
}

// --- MAIN CALLER ---
const callAI = async (action: string, payload: any) => {
    try {
        // 1. Try Backend API (Consolidated Endpoint)
        // Note: 'marketing' action is now handled by generic handler too
        const res = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload })
        });
        
        const contentType = res.headers.get("content-type");
        // Check for HTML response (often means 404 or Vercel error page)
        if (!res.ok || !contentType || !contentType.includes("application/json")) {
            throw new Error("Backend unavailable or returned non-JSON");
        }
        return await res.json();
    } catch (e) {
        console.warn(`Backend AI failed for ${action}, falling back to Client-Side.`, e);
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

export const sendConciergeMessage = async (
    message: string, 
    history: ChatMessage[], 
    places: Place[], 
    events: Event[], 
    people: Person[], 
    userLoc: Coordinates | undefined, 
    contextInfo: any
) => {
    const payload = {
        message,
        history: history.map(h => ({ role: h.role, text: h.text })),
        context: {
            places: places.map(p => ({ 
                id: p.id, 
                name: p.name, 
                category: p.category, 
                description: p.description, 
                tips: p.tips,
                vibe: p.vibe,
                address: p.address,
                tags: p.tags, 
                status: p.status,
                opening_hours: p.opening_hours 
            })),
            events: events.map(e => ({ title: e.title, start: e.startTime })),
            ppl: people.map(p => ({ name: p.name, role: p.role, bio: p.bio, years: p.years })),
            userLoc,
            ctx: { ...contextInfo }
        }
    };

    const response = await callAI('chat', payload);
    return response || { text: "El Veci está durmiendo. Intenta más tarde." };
};

export const createConciergeChat = (places: Place[], events: Event[], people: Person[], userLoc: Coordinates | undefined, context: any) => {
    let history: any[] = [];
    return {
        sendMessage: async ({ message }: { message: string }) => {
            const response = await sendConciergeMessage(message, history.map(h => ({ role: h.role, text: h.text })), places, events, people, userLoc, context);
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
        const res = await callAI('moderate', { name, description });
        if (res) return res;
    } catch (e) {
        // Fallback
    }
    return { safe: true }; 
};

export const generateMarketingCopy = async (name: string, platform: string, tone: string): Promise<string> => {
    const res = await callAI('marketing', { name, category: 'General', platform, tone });
    return res?.text || "Error generating copy.";
};

export const generateAdminReport = async (range: 'weekly' | 'monthly') => {
    const res = await callAI('generate-report', { range });
    return res?.text;
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
