-- Pharmacy verification columns
-- Cross-reference NPPES (self-reported, often stale) with Google Places
-- (actively maintained by business owners via GMB).
--
-- Applied to project vprjteqgmanntvisjrvp on 2026-04-16.
-- See Outbox/PharmaAPI/nppes-quality-audit.md for methodology.

ALTER TABLE places
  ADD COLUMN IF NOT EXISTS verified_phone text,
  ADD COLUMN IF NOT EXISTS verified_address text,
  ADD COLUMN IF NOT EXISTS business_status text,
  ADD COLUMN IF NOT EXISTS data_quality_score integer,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_source text,
  ADD COLUMN IF NOT EXISTS verification_issues jsonb;

COMMENT ON COLUMN places.verified_phone IS 'Phone confirmed via Google Places (more current than NPPES self-reported phone)';
COMMENT ON COLUMN places.verified_address IS 'Address confirmed via Google Places';
COMMENT ON COLUMN places.business_status IS 'OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY (from Google Places)';
COMMENT ON COLUMN places.data_quality_score IS '0-100 score: 100 = NPPES + Google fully match; lower = stale/conflicting data';
COMMENT ON COLUMN places.last_verified_at IS 'Timestamp of last cross-reference run';
COMMENT ON COLUMN places.verification_source IS 'google_places | manual | unverified';
COMMENT ON COLUMN places.verification_issues IS 'Array of issue codes: PHONE_MISMATCH, BUSINESS_STATUS=X, etc.';
