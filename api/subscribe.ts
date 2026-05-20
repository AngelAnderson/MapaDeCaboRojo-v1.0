/**
 * api/subscribe.ts — Newsletter subscriber capture endpoint
 *
 * POST /api/subscribe
 *   Body (form-urlencoded or JSON):
 *     email: required
 *     source: optional (defaults to 'unknown') — which page they came from
 *     audience: optional — self-identified audience (residente/turista/negocio/emprendedor/inversionista)
 *
 *   Response (JSON):
 *     200 { ok: true, message: '...' }
 *     400 { ok: false, error: '...' } — validation error
 *     500 { ok: false, error: '...' } — server error
 *
 * Side effects:
 *   - Insert into newsletter_subscribers table (Supabase)
 *   - Send welcome email via Resend (best-effort, doesn't fail the request)
 *
 * Pattern: server-side only. RESEND_API_KEY + SUPABASE_SERVICE_ROLE_KEY required.
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
)

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const FROM_EMAIL = 'MapaDeCaboRojo <newsletter@mapadecaborojo.com>'
const REPLY_TO = 'angel@angelanderson.com'

// Validate email — simple but practical
function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  if (email.length < 3 || email.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Privacy: hash IP rather than store raw
function hashIp(ip: string | undefined): string | null {
  if (!ip) return null
  return createHash('sha256').update(ip + 'mapadecaborojo-salt').digest('hex').slice(0, 16)
}

async function sendWelcomeEmail(email: string, audience: string | null): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  const audienceLine = audience
    ? `<p style="color:#475569;font-size:14px;">Te marcamos como <strong>${audience}</strong> — eso nos ayuda a mandarte solo lo que te sirve.</p>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="es-PR">
<head>
<meta charset="UTF-8">
<title>Bienvenido a MapaDeCaboRojo.com</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#fff;padding:32px 32px 28px;">
    <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;color:#5eead4;letter-spacing:2px;text-transform:uppercase;">📍 MapaDeCaboRojo.com</p>
    <h1 style="margin:0;font-size:24px;font-weight:800;line-height:1.25;">Bienvenido al mapa vivo.</h1>
    <p style="margin:8px 0 0 0;font-size:14px;color:#cbd5e1;">Menos revolú. Mejores decisiones. Mejor vida.</p>
  </div>
  <div style="padding:28px 32px;color:#1e293b;line-height:1.6;font-size:15px;">
    <p>Gracias por suscribirte.</p>
    <p>Esto es lo que vas a recibir:</p>
    <ul style="padding-left:20px;margin:12px 0;">
      <li>Cambios importantes en el mapa (verificaciones · negocios nuevos · cerrados)</li>
      <li>Señales del pueblo — qué busca la gente, qué falta, qué oportunidades aparecen</li>
      <li>Updates de transparencia — métricas mensuales sin spin</li>
    </ul>
    <p>Sin spam · sin trucos · si no te sirve, "Unsubscribe" un click y listo.</p>
    ${audienceLine}
    <p style="margin-top:24px;">— Angel | <a href="https://www.mapadecaborojo.com" style="color:#0d9488;text-decoration:none;">mapadecaborojo.com</a></p>
  </div>
  <div style="background:#f8fafc;padding:18px 32px;color:#94a3b8;font-size:11px;text-align:center;">
    <p style="margin:0;">Recibiste esto porque te suscribiste a updates de MapaDeCaboRojo.com.</p>
    <p style="margin:6px 0 0 0;">Si no fuiste tú o quieres salir, responde "BAJA" a este correo.</p>
  </div>
</div>
</body>
</html>`

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: 'Bienvenido al mapa vivo de Cabo Rojo',
        html,
        reply_to: REPLY_TO,
        tags: [
          { name: 'list', value: 'newsletter' },
          { name: 'event', value: 'welcome' },
        ],
      }),
    })
    if (!r.ok) {
      const errBody = await r.text()
      return { ok: false, error: `Resend ${r.status}: ${errBody.substring(0, 200)}` }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Resend network error' }
  }
}

export default async function handler(req: any, res: any) {
  // CORS for direct fetch from form (same-origin works without this, but safe)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed — use POST' })
    return
  }

  // Parse body (Vercel parses JSON + form automatically; fall back if not)
  let body: any = req.body || {}
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      // Try URL-encoded
      try {
        body = Object.fromEntries(new URLSearchParams(body))
      } catch {
        body = {}
      }
    }
  }

  const email = String(body.email || '').trim().toLowerCase()
  const source = String(body.source || 'unknown').slice(0, 64)
  const audience = body.audience ? String(body.audience).slice(0, 32) : null

  // Validation
  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: 'Email inválido' })
    return
  }

  // Honeypot — if a "phone" or "company" field is filled, it's a bot
  if (body.phone || body.company || body.website) {
    // Pretend success to not tip off bot
    res.status(200).json({ ok: true, message: 'Suscrito' })
    return
  }

  const ip = req.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim()
    || req.headers?.['x-real-ip']?.toString()
    || req.socket?.remoteAddress
  const userAgent = req.headers?.['user-agent']?.toString().slice(0, 256) || null

  try {
    // Upsert — if email exists and unsubscribed_at is set, we re-subscribe by clearing it.
    // If exists active, returns 200 idempotent.
    const { data: existing } = await supabase
      .from('newsletter_subscribers')
      .select('id, unsubscribed_at')
      .eq('email', email)
      .limit(1)
      .maybeSingle()

    if (existing && !existing.unsubscribed_at) {
      // Already subscribed — idempotent success, no welcome email re-sent
      res.status(200).json({ ok: true, message: 'Ya estás suscrito · gracias por volver' })
      return
    }

    if (existing && existing.unsubscribed_at) {
      // Re-subscribe
      const { error: upErr } = await supabase
        .from('newsletter_subscribers')
        .update({
          unsubscribed_at: null,
          source,
          audience_tag: audience,
          ip_hash: hashIp(ip),
          user_agent: userAgent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      if (upErr) throw upErr
    } else {
      // New subscriber
      const { error: insErr } = await supabase.from('newsletter_subscribers').insert({
        email,
        source,
        audience_tag: audience,
        ip_hash: hashIp(ip),
        user_agent: userAgent,
      })
      if (insErr) throw insErr
    }

    // Send welcome email (best-effort — log but don't fail)
    const sendResult = await sendWelcomeEmail(email, audience)
    if (!sendResult.ok) {
      console.error('[subscribe] welcome email failed:', sendResult.error)
      // Still return success — the subscription was saved
    }

    res.status(200).json({
      ok: true,
      message: 'Listo · te enviamos un correo de bienvenida',
    })
  } catch (e: any) {
    console.error('[subscribe] error:', e)
    res.status(500).json({ ok: false, error: 'Error al guardar — intenta de nuevo o textea al 787-417-7711' })
  }
}
