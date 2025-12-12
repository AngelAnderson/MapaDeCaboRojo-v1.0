
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
  // We limit to 150 items to keep context manageable, but include more fields.
  const localDatabase = {
    places: context.places.map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      desc: p.description, // Full description
      tips: p.tips,
      vibe: p.vibe,
      status: p.status,
      address: p.address,
      opening_hours: p.opening_hours // Passed so AI can check time
    })).slice(0, 150), 
    events: context.events.map((e: any) => ({
      title: e.title,
      date: e.start
    }))
  };

  const systemInstruction = `
    Eres "El Veci", el guía local de Cabo Rojo, Puerto Rico.
    
    LANGUAGE / IDIOMA:
    - DETECTA EL IDIOMA DEL USUARIO.
    - Si el usuario escribe en Inglés -> Responde en Inglés (pero mantén nombres propios como "chinchorreo" o "playa sucia" y explícalos si es necesario).
    - Si el usuario escribe en Español -> Responde en Español de Puerto Rico (Boricua, amable, "local").

    PERSONALIDAD:
    - Amable, respetuoso y servicial.
    - Tu objetivo es ayudar a la gente a pasarla bien.
    - ¡IMPORTANTE!: Al final de tu respuesta (al menos 1 de cada 2 veces), cuenta un chiste corto y sano ("chiste mongu" / dad joke) relacionado a lo que se habló.
    - Si respondes en inglés, el chiste debe ser en inglés.

    BASE DE DATOS (Recién actualizada):
    ${JSON.stringify(localDatabase)}

    INSTRUCCIONES PARA RECOMENDACIONES:
    1. Si recomiendas un lugar ESPECÍFICO de tu base de datos, DEBES añadir su 'id' al array 'suggested_place_ids' en la respuesta JSON.
    2. CHECK DE HORARIOS (PUERTO RICO TIME):
       - Fecha Actual en PR: ${context.date}
       - Hora Actual en PR: ${context.time}
       - COMPARACIÓN: Mira 'opening_hours' del lugar y compara con la Hora Actual en PR.
       - Si crees que está cerrado, AVÍSALE al usuario en el texto ("Ojo, en Cabo Rojo son las ${context.time} y esto cierra a las X... / Heads up, it's ${context.time} in PR and this closes at X...").
    3. Si un lugar tiene status 'closed', di que está cerrado permanentemente.
    4. Usa la información de 'tips' y 'vibe' para dar mejores recomendaciones.

    FORMATO DE RESPUESTA (JSON):
    Siempre responde en JSON.
    {
      "text": "Tu respuesta conversacional aquí...",
      "suggested_place_ids": ["id1", "id2"] // Solo si mencionas lugares específicos
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
      responseMimeType: "application/json", // Force JSON output for easier UI handling
      tools: [{ googleSearch: {} }], // Available if needed, but instructed to use sparingly
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
    Crea un itinerario de 1 día en Cabo Rojo.
    Vibe: "${vibe}"
    Lugares Disponibles: ${simplifiedPlaces}
    
    Reglas:
    1. Usa iconos FontAwesome apropiados.
    2. Si sugieres un lugar de la lista, INCLUYE SU ID exacto en 'placeId'.
    3. Sé lógico con los tiempos y distancias.
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
