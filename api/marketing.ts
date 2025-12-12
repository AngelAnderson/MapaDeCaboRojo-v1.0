import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const escapeHTML = (str: string | undefined): string => {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).send("Method not allowed");
  }
  
  const { name, category, platform, tone = 'chill', language = 'spanglish' } = req.body;

  const sanitizedName = escapeHTML(name);
  const sanitizedCategory = escapeHTML(category);
  const sanitizedPlatform = escapeHTML(platform);
  const sanitizedTone = escapeHTML(tone);
  const sanitizedLanguage = escapeHTML(language);

  const toneDesc = sanitizedTone === 'hype' ? 'Excited, High Energy' : sanitizedTone === 'professional' ? 'Formal, Polite' : 'Relaxed, Friendly';
  const langDesc = sanitizedLanguage === 'en' ? 'English' : sanitizedLanguage === 'es' ? 'Spanish' : 'Spanglish (PR Style)';

  let prompt = "";
  let isJson = false;

  if (sanitizedPlatform === 'campaign_bundle') {
      isJson = true;
      prompt = `Act as Social Media Manager for "${sanitizedName}" (${sanitizedCategory}) in Cabo Rojo. Tone: ${toneDesc}. Lang: ${langDesc}. Generate JSON Campaign Bundle: { "instagram_caption": "", "story_script": "", "email_subject": "", "email_body": "" }`;
  } else {
      prompt = `Generate ${sanitizedPlatform} copy for "${sanitizedName}" (${sanitizedCategory}). Tone: ${toneDesc}. Lang: ${langDesc}. Max 150 words.`;
  }

  try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: isJson ? { responseMimeType: "application/json" } : undefined
      });

      const escapedText = isJson ? response.text : escapeHTML(response.text);

      return res.status(200).json({ text: escapedText, isJson });
  } catch (e) {
      console.error("AI Marketing API Error:", e);
      return res.status(500).json({ error: "Failed to generate marketing copy." });
  }
}