
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export default async function handler(request: Request) {
  if (request.method !== 'POST') return new Response("Method not allowed", { status: 405 });
  
  const body = await request.json();
  const { name, category, platform, tone = 'chill', language = 'spanglish' } = body;

  // --- SECURITY FIX: Sanitize all incoming user-controlled inputs ---
  const sanitizedName = escapeHTML(name);
  const sanitizedCategory = escapeHTML(category);
  const sanitizedPlatform = escapeHTML(platform);
  const sanitizedTone = escapeHTML(tone);
  const sanitizedLanguage = escapeHTML(language);

  const toneDesc = sanitizedTone === 'hype' ? 'Excited, High Energy, use many emojis !!!' : sanitizedTone === 'professional' ? 'Formal, Informative, Polite' : 'Relaxed, Friendly, Local vibe';
  const langDesc = sanitizedLanguage === 'en' ? 'English' : sanitizedLanguage === 'es' ? 'Spanish' : 'Spanglish (Puerto Rico Style)';

  let prompt = "";
  let isJson = false;

  if (sanitizedPlatform === 'campaign_bundle') {
      isJson = true;
      prompt = `Act as a Social Media Manager for "${sanitizedName}" (${sanitizedCategory}) in Cabo Rojo, Puerto Rico.
      Tone: ${toneDesc}.
      Language: ${langDesc}.

      Generate a Campaign Bundle in JSON format:
      {
        "instagram_caption": "Caption with emojis and hashtags (under 200 chars)",
        "story_script": "Short script for a 15s video (Scene + Text, under 100 words)",
        "email_subject": "Catchy email subject line (under 50 chars)",
        "email_body": "Short promo email body (under 150 words)"
      }
      Ensure all generated text is HTML escaped within the JSON values.`;
  } else {
      prompt = `Generate a ${sanitizedPlatform} copy for "${sanitizedName}" (${sanitizedCategory}) in Cabo Rojo.
      Tone: ${toneDesc}.
      Language: ${langDesc}.
      Include local emojis and hashtags. Max 150 words.
      Ensure all generated text is HTML escaped.`;
  }

  try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: isJson ? { responseMimeType: "application/json" } : undefined
      });

      // --- SECURITY FIX: Always HTML escape the final output from AI ---
      // If it's JSON, the internal values should already be escaped by the prompt.
      // If it's plain text, escape the whole thing.
      const escapedText = isJson ? response.text : escapeHTML(response.text);

      return new Response(JSON.stringify({ text: escapedText, isJson }), {
          headers: { 'Content-Type': 'application/json' }
      });
  } catch (e) {
      console.error("AI Marketing API Error:", e);
      return new Response(JSON.stringify({ error: "Failed to generate marketing copy." }), { status: 500 });
  }
}

// Basic HTML escaping utility (can be imported from common utils if available)
function escapeHTML(str: string | undefined): string {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
