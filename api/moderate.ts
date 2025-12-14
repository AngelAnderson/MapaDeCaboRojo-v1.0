
// DEPRECATED: This logic has been moved to api/ai.ts (action: 'moderate')
// to comply with Vercel serverless function limits.
export default async function handler(req: any, res: any) {
  return res.status(410).json({ error: "Endpoint deprecated. Use /api/ai with action 'moderate'." });
}
