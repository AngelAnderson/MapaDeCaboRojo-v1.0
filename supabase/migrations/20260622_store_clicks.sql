-- store_clicks: tracks intent on the /tienda product store.
-- Each card CTA (vitrina, libro, conserje, boost, verificado) logs a click so
-- Angel can see which products draw real intent — the same demand-signal logic
-- the bot uses, applied to the storefront. Analytics only; never blocks the page.

CREATE TABLE IF NOT EXISTS store_clicks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product     TEXT NOT NULL,           -- product key: vitrina_prueba | vitrina_mensual | vitrina_anual | vitrina_veci | boost | libro | conserje | verificado
  action      TEXT,                    -- 'checkout' (stripe) | 'whatsapp' | 'sms'
  ua          TEXT,
  referrer    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_clicks_product ON store_clicks (product);
CREATE INDEX IF NOT EXISTS idx_store_clicks_created ON store_clicks (created_at DESC);

ALTER TABLE store_clicks ENABLE ROW LEVEL SECURITY;

-- Anon can INSERT (click tracking from browser). No read for anon.
CREATE POLICY "allow anon insert" ON store_clicks
  FOR INSERT TO anon WITH CHECK (true);

-- Only service role (Angel, server-side) can SELECT.
CREATE POLICY "allow service select" ON store_clicks
  FOR SELECT TO service_role USING (true);

COMMENT ON TABLE store_clicks IS
  'Intent tracking for /tienda storefront CTAs. product = which product card, action = checkout|whatsapp|sms. Inserted server-side via /api/mapa-pages?page=tienda-log.';
