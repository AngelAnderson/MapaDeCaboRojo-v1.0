
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
      default:
        return res.status(400).json({ error: "Unknown action" });
    }

    return res.status(200).json(result);

  } catch (e: any) {
    console.error(`AI API Error:`, e);
    return res.status(500).json({ 
      error: "Service Error", 
      details: e.message,
      text: "Mala mía, El Veci se fue de break. Intenta ya mismo." 
    });
  }
}

// --- HANDLERS ---

async function handleChat({ message, history, context }: any) {
  // Use the pre-processed context from the frontend
  const { places, events, user_context } = context;

  const systemInstruction = `
    Eres "El Veci", un guía local digital de Cabo Rojo, Puerto Rico.
    
    TU MISIÓN:
    Ayudar a usuarios a encontrar lugares y eventos usando *exclusivamente* tu base de datos local.

    BASE DE DATOS (LA ÚNICA VERDAD):
    - Lugares Disponibles: ${JSON.stringify(places)}
    - Eventos (Prioridad Alta): ${JSON.stringify(events)}
    
    CONTEXTO ACTUAL:
    - Fecha/Hora: ${user_context.current_date} @ ${user_context.current_time}
    - Clima: ${user_context.weather}

    REGLAS ESTRICTAS DE RESPUESTA (ANTI-ALUCINACIÓN):
    1. **Cero Inventos:** Si el usuario pregunta por un lugar que NO está en la lista 'places', di: "No tengo ese lugar en mi registro oficial, pero te puedo recomendar..." y sugiere uno de la lista que sea similar. NUNCA inventes horarios o menús.
    2. **Busca por Contexto:** Si el usuario dice "tengo calor", busca lugares con "Aire Acondicionado" o "Playa" en 'full_context'. Si dice "sin luz", busca "Planta Eléctrica".
    3. **Eventos Primero:** Si preguntan "¿Qué hay hoy?", mira la lista de 'events' y compara con la Fecha Actual.
    4. **Privacidad de IDs:** Nunca muestres el UUID en el texto. Úsalo solo en el JSON de respuesta.

    FORMATO DE RESPUESTA JSON:
    Debes responder SIEMPRE con este objeto JSON exacto:
    {
      "text": "Tu respuesta amable en Markdown...", 
      "suggested_place_ids": ["id1", "id2"] // Array con los IDs de los lugares mencionados
    }
  `;

  // Clean history
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
      // Note: Google Search tool removed to enforce local-only logic as requested
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
      return { text: result.text };
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

  // Only pass names and IDs to save tokens
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
    return JSON.parse(response.text);
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
  return JSON.parse(response.text);
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
  return JSON.parse(response.text);
}

// --- HELPER FUNCTIONS ---

async function handleScript({ placeName, description }: any) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Guión de audio guía (30s) para "${placeName}". Desc: "${description}". Tono: Amable.`
  });
  return { text: response.text };
}

async function handleCategorizeAndTag({ name, description }: any) {
  const prompt = `Place: "${name}". Desc: "${description}". Return JSON { "category": string, "tags": string[] }`;
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
    contents: `Mejora descripción (max 150 palabras) para "${name}": "${description}".`
  });
  return { text: response.text };
}

async function handleGenerateTips({ name, category, description }: any) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Consejo local para "${name}" (${category}). Contexto: ${description}.`
  });
  return { text: response.text };
}

async function handleGenerateAltText({ imageUrl }: any) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', 
    contents: { parts: [{ image: { url: imageUrl } }, { text: "Alt text (max 15 words)." }] }
  });
  return { text: response.text };
}

async function handleGenerateSeoMetaTags({ name, description, category }: any) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `SEO JSON { "metaTitle": string, "metaDescription": string } for "${name}" (${category}).`,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text);
}

async function handleParseRaw({ text }: any) {
  const prompt = `Parse raw text into JSON place data: "${text}". Schema: { name, description, category, address, phone, website, tips, tags, priceLevel, parking, hasRestroom, isPetFriendly }`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text);
}

async function handleParseBulk({ text }: any) {
  const prompt = `Parse list of places: "${text}". Return JSON Array of Place objects.`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text);
}
