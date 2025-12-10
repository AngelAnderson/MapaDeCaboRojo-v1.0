import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export default async function handler(request: Request) {
  if (request.method !== 'POST') return new Response("Method not allowed", { status: 405 });
  
  const body = await request.json();
  const { name, description } = body;

  const prompt = `Analiza el siguiente texto sugerido por un usuario para un directorio turístico.
        Nombre: ${name}
        Descripción: ${description}
        
        Responde SOLAMENTE con un objeto JSON:
        {"safe": boolean, "reason": "string (en español boricua, estilo El Veci)"}
        
        Reglas:
        1. safe: false si contiene insultos, pornografía, spam, gibberish.
        2. safe: true si parece un lugar legítimo.
  `;

  try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      return new Response(response.text || "{}", {
          headers: { 'Content-Type': 'application/json' }
      });
  } catch (e) {
      return new Response(JSON.stringify({ safe: true, error: "AI Unreachable" }), { status: 200 });
  }
}