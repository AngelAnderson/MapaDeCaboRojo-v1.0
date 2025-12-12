
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
  // 1. CORS & Method Check
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 2. Body Parsing (Handle both parsed and string bodies)
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: "Invalid JSON body" }); }
    }
    const { action, payload } = body;

    // 3. Routing
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
      default:
        return res.status(400).json({ error: "Unknown action" });
    }

    return res.status(200).json(result);

  } catch (e: any) {
    console.error(`AI API Error:`, e);
    // Return a friendly error structure that the frontend can handle safely
    return res.status(500).json({ 
      error: "Service Error", 
      details: e.message,
      text: "Mala mía, El Veci se fue de break. Intenta ya mismo." 
    });
  }
}

// --- HANDLERS ---

async function handleChat({ message, history, context }: any) {
  // Use the places sent directly from the frontend (which now come from Supabase)
  // We include MORE fields now for "Smarter" recommendations
  const localDatabase = {
    places: context.places.map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      desc: p.description, 
      tips: p.tips,
      vibe: p.vibe, // Critical for "mood" matching
      status: p.status,
      price: p.priceLevel, // Critical for budget matching
      best_time: p.bestTimeToVisit, // Critical for logistics
      address: p.address,
      opening_hours: p.opening_hours 
    })).slice(0, 150), 
    events: context.events.map((e: any) => ({
      title: e.title,
      date: e.start,
      desc: e.description,
      loc: e.location
    }))
  };

  const systemInstruction = `
    Eres "El Veci", el guía local experto de Cabo Rojo, Puerto Rico.
    
    BASE DE DATOS LOCAL (LA ÚNICA VERDAD):
    ${JSON.stringify(localDatabase)}

    REGLAS ESTRICTAS DE DATOS:
    1. **Inventario Cerrado**: Para recomendar lugares (comida, playas) o listar eventos, usa ÚNICAMENTE la 'BASE DE DATOS LOCAL' de arriba.
    2. **Eventos**: Si te preguntan por eventos ("¿Qué hay para hacer?", "Eventos hoy"), revisa el array 'events' en tu base de datos. Si está vacío o no hay coincidencias, di explícitamente: "No veo eventos programados en la app por ahora." NO busques eventos en Google.
    3. **Lugares**: Si te piden "mejores playas" o "restaurantes", escoge SOLO de la lista 'places'. No inventes lugares ni traigas lugares de internet que no estén en la lista.

    USO DE GOOGLE SEARCH:
    - Úsalo SOLO para: Clima actual, noticias de emergencia (tráfico, luz, agua), o para verificar horarios de apertura *si* la base de datos dice 'null'.
    - PROHIBIDO usar Google Search para buscar "listas de eventos" o "lugares turísticos".

    PERSONALIDAD:
    - Boricua "Sangre Liviana": Amable, gracioso, usas slang suave (brutal, nítido, jangueo, chinchorreo).
    - Servicial: Si preguntan por comida, sugiere 2-3 opciones de tu lista.
    - Cierre: Termina (50% de las veces) con un chiste corto y sano ("chiste mongu") o un refrán boricua.

    INSTRUCCIONES DE LÓGICA:
    1. **Recomendaciones**: Si recomiendas un lugar de la DB, AÑADE su ID al array 'suggested_place_ids' del JSON de respuesta.
    2. **SIN IDs EN TEXTO**: NUNCA escribas el ID del lugar (ej. uuid, números largos) en el campo "text". El ID es solo para uso interno del sistema.
    3. **Contexto Temporal**:
       - Fecha PR: ${context.date} | Hora PR: ${context.time}
       - Verifica 'opening_hours' en tu DB antes de sugerir.
    4. **Formato Markdown**: Usa **negritas** para nombres de lugares.

    FORMATO DE RESPUESTA (JSON):
    {
      "text": "Respuesta en Markdown con emojis...",
      "suggested_place_ids": ["id1", "id2"]
    }
  `;

  // Filter and format history to prevent API errors
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
      // ENABLE GOOGLE SEARCH GROUNDING - But limited by prompt constraints above
      tools: [{ googleSearch: {} }], 
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
      // Fallback if model fails to return JSON
      return { text: result.text };
  }
}

async function handleItinerary({ vibe, places }: any) {
  // Use a Strict Schema to prevent "White Bubble" (empty JSON) errors
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

  const simplifiedPlaces = places.map((p: any) => `${p.name} (ID: ${p.id}, Cat: ${p.category})`).join(', ');

  const prompt = `
    Crea un itinerario de 1 día en Cabo Rojo, Puerto Rico.
    Vibe: "${vibe}"
    Lugares Disponibles (USA SOLO ESTOS): ${simplifiedPlaces}
    
    Reglas:
    1. LÓGICA GEOGRÁFICA: Agrupa lugares cercanos (ej. Faro y Playa Sucia van juntos).
    2. COMIDA: Incluye paradas para comer en horas lógicas usando los lugares disponibles.
    3. TIEMPO: Considera el tiempo de traslado y disfrute.
    4. ICONOS: Usa iconos FontAwesome divertidos.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { 
      responseMimeType: 'application/json',
      responseSchema: responseSchema
    }
  });

  // Since we use responseSchema, parsing is safer, but we still try/catch
  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Itinerary JSON parse error:", response.text);
    return []; // Return empty array safely on parse failure
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
  return JSON.parse(response.text);
}

// --- SIMPLER HELPERS (Standard Text Responses) ---

async function handleScript({ placeName, description }: any) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Escribe un guión de audio guía de 30 segundos para "${placeName}". Descripción: "${description}". Tono: Amable.`
  });
  return { text: response.text };
}

async function handleCategorizeAndTag({ name, description }: any) {
  const prompt = `Categories: BEACH, FOOD, SIGHTS, LOGISTICS, LODGING, SHOPPING, HEALTH, NIGHTLIFE, ACTIVITY, SERVICE. 
  Place: "${name}". Desc: "${description}". 
  Return JSON { "category": string, "tags": string[] }`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text);
}

async function handleEnhanceDescription({ name, description }: any) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Mejora esta descripción para una app de turismo (max 150 palabras, tono atractivo): "${description}" para el lugar "${name}".`
  });
  return { text: response.text };
}

async function handleGenerateTips({ name, category, description }: any) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Dame un consejo "Local" (El Veci) para "${name}" (${category}). Contexto: ${description}. Max 50 palabras.`
  });
  return { text: response.text };
}

async function handleGenerateAltText({ imageUrl }: any) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', 
    contents: { parts: [{ image: { url: imageUrl } }, { text: "Generate concise alt text for this image (max 15 words)." }] }
  });
  return { text: response.text };
}

async function handleGenerateSeoMetaTags({ name, description, category }: any) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Generate SEO JSON { "metaTitle": string, "metaDescription": string } for "${name}" (${category}). Desc: ${description}.`,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text);
}
