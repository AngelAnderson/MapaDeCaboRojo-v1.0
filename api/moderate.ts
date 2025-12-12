import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).send("Method not allowed");
  }
  
  const { name, description } = req.body;

  const prompt = `Analiza el siguiente texto sugerido por un usuario.
        Nombre: ${name}
        Descripción: ${description}
        Responde SOLAMENTE con un objeto JSON:
        {"safe": boolean, "reason": "string (español boricua)"}
  `;

  try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      return res.status(200).json(JSON.parse(response.text || "{}"));
  } catch (e) {
      return res.status(200).json({ safe: true, error: "AI Unreachable" });
  }
}