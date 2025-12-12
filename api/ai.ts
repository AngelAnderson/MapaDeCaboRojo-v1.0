
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
      amenities: p.amenities || {}, // Pass amenities for better answers (parking, restrooms)
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
    You are 'El Veci', the smartest local concierge for Cabo Rojo, Puerto Rico.
    You speak in 'Spanglish' with local Boricua slang (e.g., 'Wepa', 'Bregamos', 'Brutal', 'Jangueo').
    
    ### YOUR KNOWLEDGE SOURCES ###
    
    1. **LOCAL DATABASE (High Priority):** 
       I have provided you with a JSON object containing the *official* list of places and events.
       ${JSON.stringify(localDatabase).substring(0, 30000)} ... (truncated for token limit safety if needed)
       
    2. **GOOGLE SEARCH (Fallback):**
       You have access to Google Search. Use it for:
       - Weather, News, Real-time status.
       - Details about a place *not* in the Local Database.
       - Verifying specific facts (like "Is X open on holidays?") if the Local Database is vague.

    ### CRITICAL RULES TO AVOID HALLUCINATION ###
    
    1. **IF IT'S IN THE DB:** Recommend it enthusiastically. Use the exact Name and Address from the DB.
    2. **IF IT'S NOT IN THE DB:** Do NOT invent it. Say: "No lo tengo en mi lista oficial, pero déjame buscar..." and then use Google Search to find it.
    3. **NO FAKE ATTRIBUTES:** If the DB says 'amenities: {}', do not assume it has parking. Check Google Search or say you aren't sure.
    4. **LOCATION:** You are strictly focused on Cabo Rojo, Puerto Rico. If a user asks for pizza, look for pizza *in Cabo Rojo*.

    ### CONTEXT ###
    Current Time: ${escapeHTML(context.date)} ${escapeHTML(context.time)}
    User Location: ${context.userLoc ? `${context.userLoc.lat}, ${context.userLoc.lng}` : "Unknown"}
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
  
  // The result.text will contain the answer, potentially enriched by Search.
  return new Response(JSON.stringify({ text: result.text }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleIdentify({ image }) {
  const prompt = `Analyze this image. Is it a location in Cabo Rojo, Puerto Rico? Return JSON: { "matchedPlaceId": string | null, "explanation": "Spanglish explanation" }`;
  
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
  const prompt = `Write a 30-sec audio guide script for "${escapeHTML(placeName)}" in Cabo Rojo (Puerto Rico style slang). Desc: "${escapeHTML(description)}". Plain text.`;
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
    Rewrite the following description for a tourism app. Make it more engaging, descriptive, and concise for "${escapeHTML(name)}" in Cabo Rojo, Puerto Rico.
    Maintain a friendly, inviting tone. Keep it under 150 words.
    Original Description: "${escapeHTML(description)}"
  `;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  });
  return new Response(JSON.stringify({ text: escapeHTML(response.text) }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleGenerateTips({ name, category, description }: { name: string, category: PlaceCategory, description: string }) {
  const prompt = `
    Act as 'El Veci', a local expert in Cabo Rojo. 
    Generate a concise, helpful, and "Boricua" (Puerto Rican slang) style tip for visitors to "${escapeHTML(name)}" (Category: ${escapeHTML(category)}).
    Context: "${escapeHTML(description)}"
    The tip should be practical and unique, reflecting local knowledge. Keep it under 50 words.
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
