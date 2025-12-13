
import { GoogleGenAI, Type } from "@google/genai";
import { Buffer } from "buffer";

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
      text: "¡Ay bendito! Se me cayó la libreta. Dame un breakesito e intenta ya mismo." 
    });
  }
}

// --- HANDLERS ---

async function handleChat({ message, history, context }: any) {
  // Use the pre-processed context from the frontend
  const { places, events, user_context } = context;

  const systemInstruction = `
    Eres "El Veci", un señor amable, sabio y servicial que ha vivido en Cabo Rojo toda la vida.

    TU PERSONALIDAD Y TONO:
    1. **La Regla de los 105 Años:** Habla tan claro, sencillo y respetuoso que una persona de 105 años te entienda perfectamente. Evita palabras complicadas o jerga tecnológica ("haz click", "scroll"). Mejor di: "toca aquí" o "mira abajo".
    2. **Vecino Bueno:** Eres servicial y alegre. Usas palabras como "Familia", "Mijo/a", "Saludos".
    3. **Boricua Sano:** Usa expresiones de aquí pero sanas ("¡Wepa!", "Ay bendito", "La cosa está buena", "Dar una vuelta"). NADA de jerga callejera agresiva ni ofensiva.
    4. **El Toque de Humor:** Si la conversación se presta, termina tu respuesta con un chiste "mongo" (bobo) y corto sobre: la suegra, los hoyos en la carretera, la falta de luz o el calor. Que sea tan sano e inocente que se lo puedas contar a un cura o a un niño.

    TU MISIÓN:
    Ayudar a tus vecinos (los usuarios) a encontrar lugares y eventos usando *exclusivamente* los apuntes de tu libreta (la base de datos provista).

    CONTEXTO CRÍTICO (LO SABES TODO):
    - Fecha/Hora: ${user_context.current_date} @ ${user_context.current_time}. **IMPORTANTE:** Úsalo para decir qué está abierto y qué está cerrado AHORA MISMO.
    - Clima: ${user_context.weather}. Si llueve, recomienda techo. Si hace sol, recomienda playa y agua.

    REGLAS DE ORO (ANTI-ALUCINACIÓN):
    1. **La Libreta es la Ley:** Si no está en la lista 'places', di: "Ay bendito, mala mía. Ese no lo tengo anotado en mi libreta todavía, pero te recomiendo [Lugar Similar de la Lista]".
    2. **Dirección Clara:** Sé directo. "Ve a X, está abierto." "No vayas a Y, está cerrado."
    3. **Soluciones Prácticas:** Si dicen "tengo calor", busca sitios con Aire Acondicionado o Playa. Si dicen "sin luz", busca "Planta Eléctrica".
    4. **Seguridad:** Si mencionan emergencias, diles que llamen al 911.

    LA LIBRETA (TUS DATOS):
    - Lugares Disponibles: ${JSON.stringify(places)}
    - Eventos (Prioridad Alta): ${JSON.stringify(events)}

    FORMATO DE RESPUESTA JSON:
    Debes responder SIEMPRE con este objeto JSON exacto:
    {
      "text": "Tu respuesta amable y clara en Markdown...", 
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

// --- HELPER FUNCTIONS ---

async function handleScript({ placeName, description }: any) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Guión de audio guía (30s) para "${placeName}". Desc: "${description}". Tono: Amable.`
  });
  return { text: response.text || "" };
}

async function handleCategorizeAndTag({ name, description }: any) {
  const prompt = `Place: "${name}". Desc: "${description}". Return JSON { "category": string, "tags": string[] }`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text || "{}");
}

async function handleEnhanceDescription({ name, description }: any) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Mejora descripción (max 150 palabras) para "${name}": "${description}".`
  });
  return { text: response.text || "" };
}

async function handleGenerateTips({ name, category, description }: any) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Consejo local para "${name}" (${category}). Contexto: ${description}.`
  });
  return { text: response.text || "" };
}

async function handleGenerateAltText({ imageUrl }: any) {
  try {
    // 1. Fetch the image
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) throw new Error("Failed to fetch image");
    const arrayBuffer = await imageRes.arrayBuffer();
    
    // 2. Convert to Base64
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = imageRes.headers.get('content-type') || 'image/jpeg';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { 
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Data } }, 
          { text: "Generate SEO alt text (max 15 words) for this place image." }
        ] 
      }
    });
    return { text: response.text || "" };
  } catch (e) {
    console.error("Generate Alt Text Error:", e);
    return { text: "Error generating alt text." };
  }
}

async function handleGenerateSeoMetaTags({ name, description, category }: any) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `SEO JSON { "metaTitle": string, "metaDescription": string } for "${name}" (${category}).`,
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
