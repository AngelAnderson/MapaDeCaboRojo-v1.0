
import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';
// Removed: import { escapeHTML } from '../services/supabase'; 
import { PlaceCategory } from '../types'; 

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

// Node-safe HTML Escaper (Regex based)
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

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response("Method not allowed", { status: 405 });

  try {
    const { action, payload } = await req.json();

    switch (action) {
      case 'chat':
        return await handleChat(payload);
      case 'identify':
        return await handleIdentify(payload);
      case 'itinerary':
        return await handleItinerary(payload);
      case 'script':
        return await handleScript(payload);
      case 'categorize-tags':
        return await handleCategorizeAndTag(payload);
      case 'enhance-description':
        return await handleEnhanceDescription(payload);
      case 'generate-tips':
        return await handleGenerateTips(payload);
      case 'generate-alt-text':
        return await handleGenerateAltText(payload);
      case 'generate-seo-meta-tags':
        return await handleGenerateSeoMetaTags(payload);
      default:
        return new Response("Unknown action", { status: 400 });
    }
  } catch (e: any) {
    console.error("AI API Error:", e);
    return new Response(JSON.stringify({ error: "An AI service error occurred." }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}

// --- HANDLERS ---

async function handleChat({ message, history, context }: any) {
  // 1. Prepare "Ground Truth" Data
  // We strictly structure this so the AI knows exactly what is "Verified Local Data".
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
    Tu trabajo es ser el guía más servicial, amable y paciente de Cabo Rojo, Puerto Rico.
    
    ### TU PERSONALIDAD ###
    1. **Sabiduría y Paciencia:** Hablas de manera clara, pausada y respetuosa. Imagina que le explicas las cosas a una persona de 105 años que quieres mucho. Usa un tono cálido y de "buen vecino".
    2. **Cero Drama:** Te mantienes alejado de controversias, chismes o negatividad. Todo es constructivo y positivo.
    3. **Claridad:** Evita la jerga moderna confusa (nada de "jangueo intenso" o palabras de Gen-Z). Usa un español de Puerto Rico clásico, educado y entendible.
    4. **El Toque Final:** SIEMPRE termina tu respuesta con un chiste sano, corto y simpático (puede ser de pepito, de jíbaros, o bobo).

    ### TUS FUENTES DE INFORMACIÓN ###
    1. **BASE DE DATOS LOCAL (Prioridad Máxima):** 
       Aquí tienes la lista oficial de lugares y eventos en Cabo Rojo. Úsala para recomendar sitios.
       ${JSON.stringify(localDatabase).substring(0, 30000)} ... (truncado por seguridad)
       
    2. **GOOGLE SEARCH (Herramienta de Apoyo):**
       Tienes acceso a Google Search. Úsalo OBLIGATORIAMENTE para:
       - Verificar el clima actual.
       - Buscar noticias recientes.
       - Confirmar horarios si la base de datos no los tiene.
       - Contestar preguntas generales si no encuentras el lugar en tu lista.

    ### REGLAS DE RESPUESTA ###
    - Si te preguntan por un lugar en la lista, da los detalles con entusiasmo y precisión.
    - Si te preguntan la hora o el clima, respóndelo con exactitud usando el contexto o Google Search.
    - Si no sabes algo, di: "Mire, honestamente no tengo ese dato a la mano, pero déjeme averiguarlo" y usa Google Search.
    - **IMPORTANTE:** Al despedirte en cada mensaje, cuenta el chiste.

    ### CONTEXTO ACTUAL ###
    Fecha: ${escapeHTML(context.date)}
    Hora: ${escapeHTML(context.time)}
    Clima Reportado: ${escapeHTML(context.weather)}
    Ubicación Usuario: ${context.userLoc ? `${context.userLoc.lat}, ${context.userLoc.lng}` : "Desconocida"}
  `;

  // Reconstruct Chat History
  const chatHistory = history.map((msg: any) => ({
    role: msg.role,
    parts: [{ text: escapeHTML(msg.text) }]
  }));

  // Create Chat with Google Search Tool enabled
  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    history: chatHistory,
    config: { 
      systemInstruction,
      tools: [{ googleSearch: {} }], // ENABLE GROUNDING
    }
  });

  const result = await chat.sendMessage(escapeHTML(message));
  
  return new Response(JSON.stringify({ text: result.text }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleIdentify({ image }) {
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
  return new Response(escapeHTML(response.text), { headers: { 'Content-Type': 'application/json' } });
}

async function handleItinerary({ vibe, places }) {
  const sanitizedPlacesList = places
    .map((p: any) => `${escapeHTML(p.name)} (${escapeHTML(p.category)})`)
    .join(', ');
  
  const prompt = `Create a 1-day itinerary for Cabo Rojo based on vibe: "${escapeHTML(vibe)}". Available: ${sanitizedPlacesList}. Return JSON array: [{ "time": "09:00 AM", "activity": "Title", "description": "Desc", "placeId": "id", "icon": "fa-icon" }]`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: escapeHTML(prompt),
    config: { responseMimeType: 'application/json' }
  });
  return new Response(escapeHTML(response.text), { headers: { 'Content-Type': 'application/json' } });
}

async function handleScript({ placeName, description }) {
  const prompt = `Escribe un guión de audio guía de 30 segundos para "${escapeHTML(placeName)}" en Cabo Rojo. Tono: Amable, educado, como un vecino sabio contando una historia. Texto plano.`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: escapeHTML(prompt)
  });
  return new Response(JSON.stringify({ text: escapeHTML(response.text) }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleCategorizeAndTag({ name, description }: { name: string, description: string }) {
  const categories = Object.values(PlaceCategory).join(', ');
  const prompt = `
    Act as a tourism content analyst.
    Given a place name and description, identify the best primary category and relevant tags from a predefined list.
    Predefined Categories: ${categories}
    Place Name: "${escapeHTML(name)}"
    Description: "${escapeHTML(description)}"
    Return a JSON object with 'category' and 'tags' (array of strings, max 5, in Spanish).
  `;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });
  return new Response(escapeHTML(response.text), { headers: { 'Content-Type': 'application/json' } });
}

async function handleEnhanceDescription({ name, description }: { name: string, description: string }) {
  const prompt = `
    Reescribe la siguiente descripción para una app de turismo. Hazla más atractiva pero mantén un tono respetuoso y claro.
    Lugar: "${escapeHTML(name)}" en Cabo Rojo.
    Original: "${escapeHTML(description)}"
    Mantenlo bajo 150 palabras.
  `;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  });
  return new Response(JSON.stringify({ text: escapeHTML(response.text) }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleGenerateTips({ name, category, description }: { name: string, category: PlaceCategory, description: string }) {
  const prompt = `
    Actúa como 'El Veci', un experto local sabio de Cabo Rojo. 
    Genera un consejo práctico y útil para visitantes de "${escapeHTML(name)}" (Categoría: ${escapeHTML(category)}).
    Contexto: "${escapeHTML(description)}"
    El consejo debe ser claro, como si se lo dieras a un amigo mayor. Mantenlo bajo 50 palabras.
  `;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  });
  return new Response(JSON.stringify({ text: escapeHTML(response.text) }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleGenerateAltText({ imageUrl }: { imageUrl: string }) {
  const prompt = `
    Describe this image for an accessibility alt text. Focus on key visual elements of the place.
    Keep it concise and descriptive, under 15 words.
  `;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', 
    contents: {
      parts: [
        { image: { url: imageUrl } },
        { text: escapeHTML(prompt) }
      ]
    }
  });
  return new Response(JSON.stringify({ text: escapeHTML(response.text) }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleGenerateSeoMetaTags({ name, description, category }: { name: string, description: string, category: PlaceCategory }) {
  const prompt = `
    Generate SEO-optimized meta title and meta description for a tourism app entry.
    Place Name: "${escapeHTML(name)}"
    Category: "${escapeHTML(category)}"
    Description: "${escapeHTML(description)}"
    Meta Title: Under 60 chars, keyword-rich.
    Meta Description: Under 160 chars, compelling.
    Return JSON: {"metaTitle": "string", "metaDescription": "string"}
  `;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });
  return new Response(escapeHTML(response.text), { headers: { 'Content-Type': 'application/json' } });
}
