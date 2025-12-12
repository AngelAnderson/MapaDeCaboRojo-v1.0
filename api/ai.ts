
import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';
import { escapeHTML } from '../services/supabase'; // Import the new HTML escaper
import { PlaceCategory } from '../types'; // Import PlaceCategory

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response("Method not allowed", { status: 405 });

  try {
    const { action, payload } = await req.json();

    // RED TEAM / SECURITY NOTE:
    // All AI endpoints are susceptible to abuse (cost, resource exhaustion).
    // Implement robust server-side rate-limiting for ALL actions here to prevent:
    // - Excessive API calls to Gemini (cost overruns).
    // - Denial-of-Service (DoS) against your serverless functions.
    // Consider adding IP-based or user-based rate limits.

    switch (action) {
      case 'chat':
        return await handleChat(payload);
      case 'identify':
        // RED TEAM / SECURITY NOTE:
        // This endpoint involves image processing (potentially expensive).
        // Ensure strong server-side rate-limiting is applied specifically to 'identify' requests.
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
      case 'generate-seo-meta-tags': // New AI action
        return await handleGenerateSeoMetaTags(payload);
      default:
        return new Response("Unknown action", { status: 400 });
    }
  } catch (e: any) {
    // RED TEAM / SECURITY NOTE:
    // Avoid exposing raw error messages to the client.
    // Log detailed errors securely on the server, but return generic messages.
    console.error("AI API Error:", e);
    return new Response(JSON.stringify({ error: "An AI service error occurred." }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}

// --- HANDLERS ---

async function handleChat({ message, history, context }: any) {
  // --- SECURITY FIX: Sanitize context variables and user message before passing to AI ---
  const sanitizedPlacesList = context.places
    .map((p: any) => `${escapeHTML(p.name)} (${escapeHTML(p.category)}): ${escapeHTML(p.description)}`)
    .join('\n');
  
  const systemInstruction = `
    You are 'El Veci', a local concierge for Cabo Rojo, Puerto Rico. 
    Speak in 'Spanglish' with local Puerto Rican slang (Boricua style). Be helpful, friendly, and cool.
    
    Context:
    Date/Time: ${escapeHTML(context.date)} ${escapeHTML(context.time)}
    Weather: ${escapeHTML(context.weather)}
    User Location: ${context.userLoc ? `${escapeHTML(String(context.userLoc.lat))}, ${escapeHTML(String(context.userLoc.lng))}` : "Unknown"}
    
    Places Database:
    ${sanitizedPlacesList}
    
    Answer questions about where to go. If you recommend a place, use its exact name.
  `;

  // Reconstruct Chat History for Gemini SDK, ensuring messages are sanitized
  const chatHistory = history.map((msg: any) => ({
    role: msg.role,
    parts: [{ text: escapeHTML(msg.text) }] // Sanitize historical messages
  }));

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    history: chatHistory,
    config: { systemInstruction }
  });

  const result = await chat.sendMessage(escapeHTML(message)); // Sanitize current message
  return new Response(JSON.stringify({ text: escapeHTML(result.text) }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleIdentify({ image }) {
  // No direct text prompt from user here, but if there were, it would be sanitized.
  const prompt = `Analyze this image. Is it a location in Cabo Rojo, Puerto Rico? Return JSON: { "matchedPlaceId": string | null, "explanation": "Spanglish explanation" }`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: image } }, // Image data doesn't need HTML escaping
        { text: escapeHTML(prompt) } // Sanitize the fixed prompt
      ]
    },
    config: { responseMimeType: 'application/json' }
  });
  return new Response(escapeHTML(response.text), { headers: { 'Content-Type': 'application/json' } });
}

async function handleItinerary({ vibe, places }) {
  // --- SECURITY FIX: Sanitize context variables ---
  const sanitizedPlacesList = places
    .map((p: any) => `${escapeHTML(p.name)} (${escapeHTML(p.category)})`)
    .join(', ');
  
  const prompt = `Create a 1-day itinerary for Cabo Rojo based on vibe: "${escapeHTML(vibe)}". Available: ${sanitizedPlacesList}. Return JSON array: [{ "time": "09:00 AM", "activity": "Title", "description": "Desc", "placeId": "id", "icon": "fa-icon" }]`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: escapeHTML(prompt), // Sanitize the constructed prompt
    config: { responseMimeType: 'application/json' }
  });
  return new Response(escapeHTML(response.text), { headers: { 'Content-Type': 'application/json' } });
}

async function handleScript({ placeName, description }) {
  // --- SECURITY FIX: Sanitize placeName and description ---
  const prompt = `Write a 30-sec audio guide script for "${escapeHTML(placeName)}" in Cabo Rojo (Puerto Rico style slang). Desc: "${escapeHTML(description)}". Plain text.`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: escapeHTML(prompt) // Sanitize the constructed prompt
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
    
    Return a JSON object with 'category' (one of the predefined categories) and 'tags' (array of strings, max 5, in Spanish).
    Example: {"category": "BEACH", "tags": ["playa", "familiar", "arena blanca"]}
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
  // Assuming imageUrl is a publicly accessible URL for the AI to fetch.
  const prompt = `
    Describe this image for an accessibility alt text. Focus on key visual elements of the place.
    Keep it concise and descriptive, under 15 words.
  `;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // Vision capable model
    contents: {
      parts: [
        { image: { url: imageUrl } }, // Pass URL directly for vision model
        { text: escapeHTML(prompt) }
      ]
    }
  });
  return new Response(JSON.stringify({ text: escapeHTML(response.text) }), { headers: { 'Content-Type': 'application/json' } });
}

// New AI action handler for SEO Meta Tags
async function handleGenerateSeoMetaTags({ name, description, category }: { name: string, description: string, category: PlaceCategory }) {
  const prompt = `
    Generate SEO-optimized meta title and meta description for a tourism app entry.
    
    Place Name: "${escapeHTML(name)}"
    Category: "${escapeHTML(category)}"
    Description: "${escapeHTML(description)}"
    
    Meta Title: Should be under 60 characters, include place name and "Cabo Rojo", and be keyword-rich.
    Meta Description: Should be under 160 characters, compelling, descriptive, and include relevant keywords for tourism in Cabo Rojo.
    
    Return a JSON object: {"metaTitle": "string", "metaDescription": "string"}
    Example: {"metaTitle": "Playa Sucia: Joya de Cabo Rojo, PR", "metaDescription": "Descubre Playa Sucia, la playa más virgen de Cabo Rojo, Puerto Rico. Aguas turquesas, arena blanca y vistas espectaculares del Faro Los Morrillos."}
  `;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });
  return new Response(escapeHTML(response.text), { headers: { 'Content-Type': 'application/json' } });
}
