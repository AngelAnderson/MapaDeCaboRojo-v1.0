
import { GoogleGenAI, Type } from "@google/genai";
import { Buffer } from "buffer";
import { createClient } from '@supabase/supabase-js';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Initialize Supabase (Only needed for specific actions like JCA analysis)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

// Node-safe HTML Escaper
const escapeHTML = (str: string | undefined): string => {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: "Invalid JSON body" }); }
    }
    const { action, payload } = body;

    let result;
    switch (action) {
      case 'chat':
        result = await handleChat(payload);
        break;
      case 'identify':
        result = await handleIdentify(payload);
        break;
      case 'itinerary':
        result = await handleItinerary(payload);
        break;
      case 'script':
        result = await handleScript(payload);
        break;
      case 'categorize-tags':
        result = await handleCategorizeAndTag(payload);
        break;
      case 'enhance-description':
        result = await handleEnhanceDescription(payload);
        break;
      case 'generate-tips':
        result = await handleGenerateTips(payload);
        break;
      case 'generate-alt-text':
        result = await handleGenerateAltText(payload);
        break;
      case 'generate-seo-meta-tags':
        result = await handleGenerateSeoMetaTags(payload);
        break;
      case 'analyze-demand':
        result = await handleAnalyzeDemand(payload);
        break;
      case 'parse-raw':
        result = await handleParseRaw(payload);
        break;
      case 'parse-bulk':
        result = await handleParseBulk(payload);
        break;
      case 'parse-hours':
        result = await handleParseHours(payload);
        break;
      // --- Merged Handlers ---
      case 'marketing':
        result = await handleMarketing(payload);
        break;
      case 'moderate':
        result = await handleModerate(payload);
        break;
      case 'analyze-jca':
        result = await handleAnalyzeJca(payload);
        break;
      case 'analyze-trends':
        result = await handleAnalyzeTrends(payload);
        break;
      // --- Reporting ---
      case 'generate-report':
        result = await handleGenerateReport(payload);
        break;
      default:
        return res.status(400).json({ error: "Unknown action" });
    }

    return res.status(200).json(result);

  } catch (e: any) {
    console.error(`AI API Error [${req.body?.action}]:`, e);
    return res.status(500).json({ 
      error: "Service Error", 
      details: e.message,
      text: "¡Ay bendito! Se me cayó la libreta. Dame un breakesito e intenta ya mismo." 
    });
  }
}

// --- HANDLERS ---

async function handleChat({ message, history, context }: any) {
  const { ctx, p, e, ppl } = context;
  
  const systemInstruction = `
    Eres "El Veci", un señor amable, sabio y servicial que ha vivido en Cabo Rojo toda la vida.

    --- DATOS DE TIEMPO REAL (VERDAD ABSOLUTA) ---
    FECHA DE HOY: ${ctx.date} (Día: ${ctx.current_day})
    HORA ACTUAL: ${ctx.time}
    CLIMA: ${ctx.weather} (Lluvia: ${ctx.is_raining ? 'SÍ' : 'NO'})
    ----------------------------------------------

    TU MISIÓN:
    Ayudar a tus vecinos (los usuarios) a encontrar lugares, eventos y *conocer gente importante* de Cabo Rojo usando *exclusivamente* los apuntes de tu libreta.

    REGLAS DE ORO:
    1. **TIEMPO SAGRADO:** Si el usuario pregunta la fecha o la hora, responde con los datos de arriba.
    2. **STATUS:** Para saber si un lugar está abierto, usa la hora actual (${ctx.time}).
    3. **GENTE:** Si preguntan por el Alcalde, próceres o figuras, busca en la lista de "Gente".

    DATOS DE TU LIBRETA:
    Lugares: ${JSON.stringify(p)}
    Eventos: ${JSON.stringify(e)}
    Gente (Figuras Públicas/Históricas): ${JSON.stringify(ppl || [])}
  `;

  const validHistory = (history || [])
    .filter((h: any) => h.role && h.text)
    .map((h: any) => ({
      role: h.role,
      parts: [{ text: h.text }]
    }));

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    history: validHistory,
    config: { 
      systemInstruction,
      responseMimeType: "application/json", 
    }
  });

  const result = await chat.sendMessage(message);
  
  try {
      const jsonResponse = JSON.parse(result.text || "{}");
      return { 
          text: jsonResponse.text,
          suggestedPlaceIds: jsonResponse.suggested_place_ids 
      };
  } catch (e) {
      return { text: result.text || "" };
  }
}

async function handleItinerary({ vibe, places }: any) {
  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        time: { type: Type.STRING, description: "Hora (e.g. 09:00 AM)" },
        activity: { type: Type.STRING, description: "Nombre corto de la actividad" },
        description: { type: Type.STRING, description: "Breve descripción de qué hacer" },
        placeId: { type: Type.STRING, description: "ID del lugar si existe en la lista provista, o null", nullable: true },
        icon: { type: Type.STRING, description: "Nombre de icono FontAwesome sin el prefijo 'fa-', ej: 'umbrella-beach', 'utensils', 'camera'" }
      },
      required: ["time", "activity", "description", "icon"]
    }
  };

  const simplifiedPlaces = places.map((p: any) => `${p.name} (ID: ${p.id})`).join(', ');

  const prompt = `
    Crea un itinerario de 1 día en Cabo Rojo, Puerto Rico.
    Vibe: "${vibe}"
    Lugares Disponibles: ${simplifiedPlaces}
    
    Reglas:
    1. Usa SOLO lugares de la lista si es posible.
    2. Agrupa geográficamente.
    3. Incluye tiempos de comida.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { 
      responseMimeType: 'application/json',
      responseSchema: responseSchema
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return []; 
  }
}

async function handleIdentify({ image }: any) {
  const prompt = `Analyze this image. Is it a location in Cabo Rojo, Puerto Rico? 
  If yes, describe where it likely is. If no, say it doesn't look like Cabo Rojo.
  Return JSON: { "matchedPlaceId": string | null, "explanation": "Explicación amable y clara en español." }`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: image } },
        { text: prompt }
      ]
    },
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text || "{}");
}

async function handleAnalyzeDemand({ searchTerms, categories }: any) {
  const prompt = `
    Analyze search terms: ${JSON.stringify(searchTerms)}. 
    Existing Categories: ${categories.join(', ')}.
    Return JSON: {
      "trending_topics": [{"topic": string, "count": number}],
      "content_gaps": [{"gap": string, "description": string, "urgency": "HIGH" | "MEDIUM" | "LOW"}],
      "recommendation": string,
      "user_intent_prediction": string
    }
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text || "{}");
}

async function handleGenerateReport({ range }: any) {
  const days = range === 'monthly' ? 30 : 7;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const isoStart = startDate.toISOString();

  // Fetch logs
  const { data: logs } = await supabase
    .from('admin_logs')
    .select('action, place_name, created_at')
    .gte('created_at', isoStart);

  // Fetch totals
  const { count: totalPlaces } = await supabase.from('places').select('*', { count: 'exact', head: true });
  
  const searchTerms = logs?.filter((l:any) => l.action === 'USER_SEARCH').map((l:any) => l.place_name) || [];
  const chatCount = logs?.filter((l:any) => l.action === 'USER_CHAT').length || 0;
  const updatesCount = logs?.filter((l:any) => ['CREATE', 'UPDATE', 'CREATE_EVENT'].includes(l.action)).length || 0;

  const prompt = `
    Role: Business Intelligence Analyst for "El Veci" (Cabo Rojo Tourism App).
    Task: Generate a ${range === 'monthly' ? 'Monthly' : 'Weekly'} Executive Report.
    Period: Last ${days} days.
    
    DATA METRICS:
    - Total Places in Database: ${totalPlaces}
    - Total New User Searches: ${searchTerms.length}
    - AI Chat Interactions: ${chatCount}
    - Content Updates (Admin/System): ${updatesCount}
    
    RAW USER SEARCH INTENT SAMPLES:
    "${searchTerms.slice(0, 100).join('", "')}"... (list truncated)

    OUTPUT FORMAT: Markdown.
    
    STRUCTURE:
    # 📅 ${range === 'monthly' ? 'Monthly' : 'Weekly'} Executive Briefing
    ## 🚀 Performance Pulse
    (A professional summary of activity levels. Are we growing? Is it quiet?)
    ## 🔍 User Intent Analysis
    (Analyze the raw search terms provided above. What specific things are tourists looking for right now? Identify keywords like "pizza", "beach", "sunset", "hotel".)
    ## 🏗️ Operational Update
    (Comment on the volume of content updates vs user demand)
    ## 🎯 Action Items
    (3 concrete recommendations on what content to add or fix based on the search gaps identified)
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  });

  return { text: response.text || "Report generation incomplete." };
}

// --- NEW MERGED HANDLERS ---

async function handleMarketing({ name, category, platform, tone = 'chill', language = 'spanglish' }: any) {
  const sanitizedName = escapeHTML(name);
  const sanitizedCategory = escapeHTML(category);
  const toneDesc = tone === 'hype' ? 'Excited, High Energy' : tone === 'professional' ? 'Formal, Polite' : 'Relaxed, Friendly';
  const langDesc = language === 'en' ? 'English' : language === 'es' ? 'Spanish' : 'Spanglish (PR Style)';

  let prompt = "";
  let isJson = false;

  if (platform === 'campaign_bundle') {
      isJson = true;
      prompt = `Act as Social Media Manager for "${sanitizedName}" (${sanitizedCategory}) in Cabo Rojo. Tone: ${toneDesc}. Lang: ${langDesc}. Generate JSON Campaign Bundle: { "instagram_caption": "", "story_script": "", "email_subject": "", "email_body": "" }`;
  } else {
      prompt = `Generate ${platform} copy for "${sanitizedName}" (${sanitizedCategory}). Tone: ${toneDesc}. Lang: ${langDesc}. Max 150 words.`;
  }

  const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: isJson ? { responseMimeType: 'application/json' } : undefined
  });

  return { text: isJson ? res.text : escapeHTML(res.text), isJson };
}

async function handleModerate({ name, description }: any) {
  const prompt = `Analiza el siguiente texto sugerido por un usuario.
        Nombre: ${name}
        Descripción: ${description}
        Responde SOLAMENTE con un objeto JSON:
        {"safe": boolean, "reason": "string (español boricua)"}`;
  
  const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(res.text || "{\"safe\": true}");
}

async function handleAnalyzeJca({ reportText }: any) {
  const prompt = `
    Act as a Data Analyst for the Puerto Rico Environmental Quality Board (JCA).
    Analyze this Water Quality Report text:
    "${reportText.substring(0, 5000)}"

    Task: Identify the status of beaches in CABO ROJO (specifically: Buyé, Boquerón, Combate, La Playuela/Sucia).
    
    Output ONLY a JSON Array of objects:
    [
      { "name": "Name of Beach", "status": "SAFE" (Green Flag) or "UNSAFE" (Red/Yellow Flag/Enterococci), "details": "Bacteria levels or specific warning" }
    ]
    
    If a beach is not mentioned, do not include it.
  `;

  const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: "application/json" }
  });

  const parsedResults = JSON.parse(aiResponse.text || "[]");
  const updates = [];

  // Update Database via Supabase
  for (const result of parsedResults) {
      const { data: places } = await supabase
          .from('places')
          .select('id, name, amenities')
          .ilike('name', `%${result.name.split(' ')[0]}%`)
          .eq('category', 'BEACH')
          .limit(1);

      if (places && places.length > 0) {
          const place = places[0];
          const newAmenities = {
              ...(place.amenities || {}),
              water_quality: {
                  status: result.status,
                  date: new Date().toISOString(),
                  details: result.details,
                  source: "JCA Report (AI Parsed)"
              }
          };

          await supabase.from('places').update({ amenities: newAmenities }).eq('id', place.id);
          updates.push(`${place.name}: ${result.status}`);
      }
  }

  // Log
  if (updates.length > 0) {
      await supabase.from('admin_logs').insert([{
          action: 'UPDATE',
          place_name: 'JCA Sync',
          details: `Updated ${updates.length} beaches: ${updates.join(', ')}`,
          created_at: new Date().toISOString()
      }]);
  }

  return { success: true, updates };
}

async function handleAnalyzeTrends({ socialText }: any) {
  const prompt = `
    You are a Social Media Trend Analyst for Cabo Rojo, PR.
    Analyze this raw text from Instagram/TikTok:
    "${socialText.substring(0, 3000)}"

    Task: Extract places mentioned that seem to be "Trending", "Hidden Gems", or "New Openings".
    
    Return a JSON ARRAY of 'Place' objects ready for import:
    [
      {
        "name": "Place Name",
        "description": "Short description derived from the post (e.g. 'Viral spot for sunsets')",
        "category": "FOOD" | "SIGHTS" | "BEACH" | "NIGHTLIFE",
        "vibe": ["Viral", "Instagrammable"],
        "tags": ["Social Find"]
      }
    ]
  `;

  const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: "application/json" }
  });

  return { success: true, results: JSON.parse(res.text || "[]") };
}

// --- HELPER FUNCTIONS ---

async function handleScript({ placeName, description }: any) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Guión de audio guía (30s) para "${placeName}". Desc: "${description}". Tono: Amable.`
  });
  return { text: response.text || "" };
}

async function handleCategorizeAndTag({ name, description }: any) {
  const prompt = `
    Analyze place: "${name}". Context: "${description}".
    Return structured JSON:
    { 
      "category": string (One of: BEACH, FOOD, SIGHTS, LOGISTICS, LODGING, SHOPPING, HEALTH, NIGHTLIFE, ACTIVITY, SERVICE),
      "tags": string[] (Max 5, lowercase, spanish),
      "amenities": {
         "parking": string (FREE, PAID, or NONE),
         "isPetFriendly": boolean,
         "hasRestroom": boolean,
         "hasGenerator": boolean,
         "isHandicapAccessible": boolean
      }
    }
  `;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text || "{}");
}

async function handleEnhanceDescription({ name, description }: any) {
  const prompt = `
    Act as "El Veci", a local guide from Cabo Rojo, PR.
    Rewrite this description for "${name}": "${description}".
    
    TONE:
    - Boricua Sano: Use local phrases like "Familia", "La cosa está buena", but keep it respectful.
    - 105-Year Rule: Simple, clear, easy to read. No tech jargon.
    - Inviting: Make them want to visit.
    - Length: Max 150 characters (concise).
  `;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  });
  return { text: response.text || "" };
}

async function handleGenerateTips({ name, category, description }: any) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Consejo local "El Veci" para "${name}" (${category}). Contexto: ${description}. Short & Helpful.`
  });
  return { text: response.text || "" };
}

async function handleGenerateAltText({ imageUrl }: any) {
  try {
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) throw new Error("Failed to fetch image");
    const arrayBuffer = await imageRes.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = imageRes.headers.get('content-type') || 'image/jpeg';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { 
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Data } }, 
          { text: "Generate SEO alt text (max 15 words) for this place image. Spanish." }
        ] 
      }
    });
    return { text: response.text || "" };
  } catch (e) {
    return { text: "Vista de lugar en Cabo Rojo" };
  }
}

async function handleGenerateSeoMetaTags({ name, description, category }: any) {
  const prompt = `
    Generate 3 SEO Options for "${name}" (${category}).
    Context: ${description}.
    
    Return JSON:
    {
      "options": [
        { "metaTitle": "Title 1 (Max 60 chars)", "metaDescription": "Desc 1 (Max 160 chars)" },
        { "metaTitle": "Title 2", "metaDescription": "Desc 2" },
        { "metaTitle": "Title 3", "metaDescription": "Desc 3" }
      ]
    }
  `;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text || "{\"options\": []}");
}

async function handleParseHours({ text }: any) {
  const prompt = `
    Parse this opening hours text into a structured JSON array.
    Text: "${text}"
    
    Return JSON format:
    {
      "structured": [
        { "day": 0, "open": "09:00", "close": "17:00", "isClosed": boolean }, // Sunday
        { "day": 1, "open": "09:00", "close": "17:00", "isClosed": boolean }, // Monday
        ...
        { "day": 6, "open": "09:00", "close": "17:00", "isClosed": boolean }  // Saturday
      ],
      "note": "Short summary string (e.g. Lunes a Viernes 8am-5pm)"
    }
    
    Rules:
    - If a day is missing or closed, set isClosed: true.
    - Convert times to 24h format (HH:MM).
    - Array MUST have 7 items (index 0=Sun to 6=Sat).
  `;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text || "{}");
}

async function handleParseRaw({ text }: any) {
  const prompt = `Parse raw text into JSON place data: "${text}". Schema: { name, description, category, address, phone, website, tips, tags, priceLevel, parking, hasRestroom, isPetFriendly }`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text || "{}");
}

async function handleParseBulk({ text }: any) {
  const prompt = `Parse list of places: "${text}". Return JSON Array of Place objects.`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text || "[]");
}

// --- CLIENT-SIDE FALLBACK HANDLER ---
async function handleClientSideAI(action: string, payload: any) {
    console.log(`🤖 Switching to Client-Side AI for: ${action}`);
    
    const clientAI = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

    switch (action) {
        case 'chat': {
            const { message, history, context } = payload;
            const { ctx, ppl } = context;

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
