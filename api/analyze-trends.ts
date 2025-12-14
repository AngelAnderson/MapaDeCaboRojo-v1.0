
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

  const { socialText } = req.body; // Raw text from IG caption, TikTok description, etc.

  if (!socialText) return res.status(400).json({ error: "No text provided" });

  const prompt = `
    You are a Social Media Trend Analyst for Cabo Rojo, PR.
    Analyze this raw text from Instagram/TikTok:
    "${socialText.substring(0, 3000)}"

    Task: Extract places mentioned that seem to be "Trending", "Hidden Gems", or "New Openings".
    
    Return a JSON ARRAY of 'Place' objects ready for import:
    [
      {
        "name": "Place Name",
        "description": "Short description derived from the post (e.g. 'Viral spot for sunsets')",
        "category": "FOOD" | "SIGHTS" | "BEACH" | "NIGHTLIFE",
        "vibe": ["Viral", "Instagrammable"],
        "tags": ["Social Find"]
      }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });

    return res.status(200).json({ 
        success: true, 
        results: JSON.parse(response.text || "[]") 
    });

  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
