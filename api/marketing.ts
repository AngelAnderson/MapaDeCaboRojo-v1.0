import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export default async function handler(request: Request) {
  if (request.method !== 'POST') return new Response("Method not allowed", { status: 405 });
  
  const body = await request.json();
  const { name, category, platform, tone = 'chill', language = 'spanglish' } = body;

  const toneDesc = tone === 'hype' ? 'Excited, High Energy, use many emojis !!!' : tone === 'professional' ? 'Formal, Informative, Polite' : 'Relaxed, Friendly, Local vibe';
  const langDesc = language === 'en' ? 'English' : language === 'es' ? 'Spanish' : 'Spanglish (Puerto Rico Style)';

  let prompt = "";
  let isJson = false;

  if (platform === 'campaign_bundle') {
      isJson = true;
      prompt = `Act as a Social Media Manager for "${name}" (${category}) in Cabo Rojo, Puerto Rico.
      Tone: ${toneDesc}.
      Language: ${langDesc}.

      Generate a Campaign Bundle in JSON format:
      {
        "instagram": "Caption with emojis and hashtags",
        "story_script": "Short script for a 15s video (Scene + Text)",
        "email_subject": "Catchy subject line",
        "email_body": "Short promo email body"
      }`;
  } else {
      prompt = `Generate a ${platform} copy for "${name}" (${category}) in Cabo Rojo.
      Tone: ${toneDesc}.
      Language: ${langDesc}.
      Include local emojis and hashtags.`;
  }

  try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: isJson ? { responseMimeType: "application/json" } : undefined
      });

      return new Response(JSON.stringify({ text: response.text, isJson }), {
          headers: { 'Content-Type': 'application/json' }
      });
  } catch (e) {
      return new Response(JSON.stringify({ error: "Failed" }), { status: 500 });
  }
}