
// DEPRECATED: This logic has been moved to api/ops.ts (action: 'sync-weather').
// PLEASE DELETE THIS FILE TO REDUCE SERVERLESS FUNCTION COUNT.
export default async function handler(req: any, res: any) {
  return res.status(410).json({ error: "Endpoint deprecated. Use /api/ops with action 'sync-weather'." });
}
