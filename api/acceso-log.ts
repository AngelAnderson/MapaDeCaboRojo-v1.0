// api/acceso-log.ts — lightweight usage/demand logger for the /acceso health-access tool.
// Client beacons here on every lookup + click-through. Server-side insert (service role);
// no Supabase key ever touches the browser. Fire-and-forget: always 204, never blocks the UI.
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
)

const ALLOWED = new Set(['lookup', 'click_directory', 'click_bot'])

export default async function handler(req: any, res: any) {
  try {
    let body: any = req.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { body = {} }
    }
    body = body || {}
    const event = String(body.event || req.query?.event || '').slice(0, 40)
    if (!ALLOWED.has(event)) { res.status(204).end(); return }

    const specialty = body.specialty ? String(body.specialty).slice(0, 40) : null
    const town = body.town ? String(body.town).slice(0, 60) : null
    const ua = String(req.headers['user-agent'] || '').slice(0, 300)

    await supabase.from('acceso_events').insert({ event, specialty, town, ua })
  } catch {
    // swallow — analytics must never break the page
  }
  res.status(204).end()
}
