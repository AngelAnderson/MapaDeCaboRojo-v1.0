import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export default async function handler(request: Request) {
  if (request.method !== 'POST') return new Response("Method not allowed", { status: 405 });
  
  const body = await request.json();
  const { name, category, platform } = body;

  let prompt = "";
  if (platform === 'campaign_bundle') {
      prompt = `Genera una campaña completa para "${name}" (${category}) en Cabo Rojo.
      Formato:
      --- INSTAGRAM ---
      (Caption con emojis)
      --- EMAIL ---
      (Asunto y Cuerpo)
      `;
  } else {
      prompt = `Genera un caption de Instagram atractivo para "${name}" (${category}) en Cabo Rojo.`;
  }

  try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      return new Response(JSON.stringify({ text: response.text }), {
          headers: { 'Content-Type': 'application/json' }
      });
  } catch (e) {
      return new Response(JSON.stringify({ error: "Failed" }), { status: 500 });
  }
}