import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
  // Standard Vercel/Node.js CORS and Method check
  if (req.method !== 'POST') {
    return res.status(405).send("Method not allowed");
  }

  try {
    // In Vercel Node.js runtime, req.body is already parsed automatically
    const { action, payload } = req.body;

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

    // Send the result back immediately
    return res.status(200).json(result);

  } catch (e: any) {
    console.error("AI API Error:", e);
    return res.status(500).json({ error: "An AI service error occurred." });
  }
}

// --- HANDLERS ---

async function handleChat({ message, history, context }: any) {
  const localDatabase = {
    places: context.places.map((p: any) => ({
      id: p.id,
      name: escapeHTML(p.name),
      category: p.category,
      description: escapeHTML(p.description),
      amenities: p.amenities || {}, 
      status: p.status,
      address: escapeHTML(p.address)
    })),
    events: context.events.map((e: any) => ({
      title: escapeHTML(e.title),
      start: e.start,
      description: escapeHTML(e.description)
    }))
  };

  const systemInstruction = `
    Hola. Eres "El Vecino Digital", pero tus amigos te dicen "El Veci".
    Tu misión es ser el guía más servicial, amable y paciente de Cabo Rojo, Puerto Rico.
    
    ### TU PERSONALIDAD (IMPORTANTE) ###
    1. **Sabiduría y Respeto:** Hablas de manera clara, pausada y respetuosa. Imagina que le explicas las cosas a una persona de 105 años que quieres mucho. Usa un tono cálido de "buen vecino".
    2. **Cero Drama:** Te mantienes alejado de controversias, chismes o negatividad. Todo es constructivo, positivo y útil.
    3. **Claridad Total:** Evita la jerga moderna confusa (nada de slang de internet). Usa un español de Puerto Rico clásico, educado y fácil de entender.
    4. **El Toque Final (Chiste):** SIEMPRE, sin excepción, termina tu respuesta con un chiste sano, corto y simpático (puede ser de pepito, jíbaros, o bobo) para alegrar el día.

    ### TUS FUENTES DE INFORMACIÓN ###
    1. **BASE DE DATOS LOCAL (Tu Memoria):** 
       Aquí tienes la lista oficial de lugares y eventos en Cabo Rojo. Úsala primero.
       ${JSON.stringify(localDatabase).substring(0, 30000)} ...
       
    2. **GOOGLE SEARCH (Tu Lupa):**
       Úsalo OBLIGATORIAMENTE para:
       - El clima actual (si te preguntan).
       - Noticias recientes.
       - Horarios o datos que no estén en tu base de datos.
       - Temas generales de Puerto Rico fuera de Cabo Rojo.

    ### CONTEXTO ACTUAL ###
    Fecha: ${escapeHTML(context.date)}
    Hora: ${escapeHTML(context.time)}
    Clima Reportado: ${escapeHTML(context.weather)}
  `;

  const chatHistory = history.map((msg: any) => ({
    role: msg.role,
    parts: [{ text: escapeHTML(msg.text) }]
  }));

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    history: chatHistory,
    config: { 
      systemInstruction,
      tools: [{ googleSearch: {} }],
    }
  });

  const result = await chat.sendMessage(escapeHTML(message));
  return { text: result.text };
}

async function handleIdentify({ image }: any) {
  const prompt = `Analyze this image. Is it a location in Cabo Rojo, Puerto Rico? Return JSON: { "matchedPlaceId": string | null, "explanation": "Explicación amable y clara en español." }`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: image } },
        { text: escapeHTML(prompt) }
      ]
    },
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text);
}

async function handleItinerary({ vibe, places }: any) {
  const sanitizedPlacesList = places.map((p: any) => `${escapeHTML(p.name)} (${escapeHTML(p.category)})`).join(', ');
  const prompt = `Create a 1-day itinerary for Cabo Rojo based on vibe: "${escapeHTML(vibe)}". Available: ${sanitizedPlacesList}. Return JSON array: [{ "time": "09:00 AM", "activity": "Title", "description": "Desc", "placeId": "id", "icon": "fa-icon" }]`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: escapeHTML(prompt),
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text);
}

async function handleScript({ placeName, description }: any) {
  const prompt = `Escribe un guión de audio guía de 30 segundos para "${escapeHTML(placeName)}" en Cabo Rojo. Tono: Amable, educado, como un vecino sabio. Texto plano.`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: escapeHTML(prompt)
  });
  return { text: escapeHTML(response.text) };
}

async function handleCategorizeAndTag({ name, description }: any) {
  const categories = "BEACH, FOOD, SIGHTS, LOGISTICS, LODGING, SHOPPING, HEALTH, NIGHTLIFE, ACTIVITY, SERVICE";
  const prompt = `Act as a tourism analyst. Identify best category/tags. Categories: ${categories}. Place: "${escapeHTML(name)}". Desc: "${escapeHTML(description)}". Return JSON { "category": string, "tags": string[] }`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text);
}

async function handleEnhanceDescription({ name, description }: any) {
  const prompt = `Reescribe descripción para app turismo. Tono respetuoso y claro. Lugar: "${escapeHTML(name)}". Original: "${escapeHTML(description)}". Max 150 palabras.`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  });
  return { text: escapeHTML(response.text) };
}

async function handleGenerateTips({ name, category, description }: any) {
  const prompt = `Actúa como 'El Veci'. Consejo sabio y práctico para "${escapeHTML(name)}" (${category}). Contexto: "${escapeHTML(description)}". Max 50 palabras.`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  });
  return { text: escapeHTML(response.text) };
}

async function handleGenerateAltText({ imageUrl }: any) {
  const prompt = `Describe image for alt text. Concise, descriptive. Max 15 words.`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', 
    contents: { parts: [{ image: { url: imageUrl } }, { text: escapeHTML(prompt) }] }
  });
  return { text: escapeHTML(response.text) };
}

async function handleGenerateSeoMetaTags({ name, description, category }: any) {
  const prompt = `Generate SEO meta tags. Place: "${escapeHTML(name)}". JSON: {"metaTitle": string, "metaDescription": string}`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text);
}