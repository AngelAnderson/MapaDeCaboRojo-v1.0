-- me_conviene_leads: captures phone + context from /me-conviene flow
-- Phase 1: modo ABRIR only. Phase 2 adds CRECER/INVERTIR/CITAR.

CREATE TABLE IF NOT EXISTS me_conviene_leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL,
  categoria   TEXT,
  zona        TEXT,
  veredicto_status TEXT CHECK (veredicto_status IN ('🔴', '🟡', '🟢', 'fallback')),
  modo        TEXT NOT NULL DEFAULT 'abrir',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for analytics queries by category + status
CREATE INDEX IF NOT EXISTS idx_me_conviene_leads_cat ON me_conviene_leads (categoria);
CREATE INDEX IF NOT EXISTS idx_me_conviene_leads_created ON me_conviene_leads (created_at DESC);

-- Row Level Security: only service role can read
ALTER TABLE me_conviene_leads ENABLE ROW LEVEL SECURITY;

-- Anon can INSERT (lead capture from browser)
CREATE POLICY "allow anon insert" ON me_conviene_leads
  FOR INSERT TO anon WITH CHECK (true);

-- Only service role (Angel, server-side) can SELECT
CREATE POLICY "allow service select" ON me_conviene_leads
  FOR SELECT TO service_role USING (true);

COMMENT ON TABLE me_conviene_leads IS
  'Leads captured from /me-conviene decision tool. Phase 1 = modo ABRIR. '
  'Used for 30-day follow-up via WhatsApp and for measuring tool conversion.';
