#!/usr/bin/env node
/**
 * Cross-reference NPPES-imported farmacias against Google Places API.
 *
 * For every place with NPI, fetch current phone/address/business_status
 * from Google. Store results in:
 *   - verified_phone, verified_address, business_status
 *   - data_quality_score (0-100)
 *   - verification_issues (jsonb array)
 *   - last_verified_at, verification_source
 *
 * Designed to run quarterly via cron, or on demand after import.
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/verify-pharmacies.mjs
 *
 * Cost: ~$0.005 per place (~$0.25 for 45 farmacias). Stays under
 * Google's $200/mo free tier even at 40,000 verifications/month.
 *
 * See: Outbox/PharmaAPI/nppes-quality-audit.md
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE || !GOOGLE_KEY) {
  console.error('Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_PLACES_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.businessStatus',
].join(',');

function normPhone(p) {
  if (!p) return '';
  return p.replace(/\D/g, '').slice(-10);
}

function nameSimilarity(a, b) {
  if (!a || !b) return 0;
  const A = a.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  const B = b.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  const tokensA = new Set(A.split(/\s+/).filter(Boolean));
  const tokensB = new Set(B.split(/\s+/).filter(Boolean));
  if (!tokensA.size || !tokensB.size) return 0;
  let hits = 0;
  for (const t of tokensA) if (tokensB.has(t)) hits++;
  return hits / Math.max(tokensA.size, tokensB.size);
}

async function findPlace(name, address) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: `${name} ${address}`, maxResultCount: 1, regionCode: 'PR' }),
  });
  if (!r.ok) return { error: `HTTP ${r.status}` };
  const data = await r.json();
  return data.places?.[0] || { notFound: true };
}

function score(place, g) {
  const issues = [];
  let score = 100;

  if (g.error || g.notFound) {
    return { score: 0, issues: [g.error || 'NOT_FOUND_ON_GOOGLE'] };
  }

  const sim = nameSimilarity(place.name, g.displayName?.text);
  const trustGoogle = sim >= 0.4;

  if (g.businessStatus && g.businessStatus !== 'OPERATIONAL') {
    score -= 60;
    issues.push(`BUSINESS_STATUS=${g.businessStatus}`);
  }

  if (trustGoogle) {
    const pNppes = normPhone(place.phone);
    const pGoogle = normPhone(g.nationalPhoneNumber || g.internationalPhoneNumber);
    if (pNppes && pGoogle && pNppes !== pGoogle) {
      score -= 25;
      issues.push(`PHONE_MISMATCH nppes=${pNppes} google=${pGoogle}`);
    } else if (!pNppes && pGoogle) {
      score -= 10;
      issues.push(`NPPES_MISSING_PHONE google=${pGoogle}`);
    } else if (pNppes && !pGoogle) {
      score -= 10;
      issues.push('GOOGLE_MISSING_PHONE');
    }
  } else {
    score -= 20;
    issues.push(`WEAK_NAME_MATCH sim=${sim.toFixed(2)} google_name=${g.displayName?.text}`);
  }

  return { score: Math.max(0, score), issues, trustGoogle };
}

async function main() {
  const { data: places, error } = await supabase
    .from('places')
    .select('id, name, address, phone, npi')
    .not('npi', 'is', null);

  if (error) {
    console.error(error);
    process.exit(1);
  }

  console.log(`Verifying ${places.length} NPPES farmacias...`);
  const summary = { verified: 0, stale: 0, closed: 0, errors: 0 };

  for (const place of places) {
    const g = await findPlace(place.name, place.address ?? '');
    const { score: s, issues, trustGoogle } = score(place, g);

    const update = {
      data_quality_score: s,
      verification_issues: issues,
      last_verified_at: new Date().toISOString(),
      verification_source: 'google_places',
      business_status: g.businessStatus ?? null,
      verified_phone: trustGoogle ? g.nationalPhoneNumber ?? null : null,
      verified_address: trustGoogle ? g.formattedAddress ?? null : null,
    };

    const { error: upErr } = await supabase.from('places').update(update).eq('id', place.id);
    if (upErr) {
      summary.errors++;
      console.error(`  ! ${place.name}: ${upErr.message}`);
    } else if (g.businessStatus === 'CLOSED_PERMANENTLY') {
      summary.closed++;
      console.log(`  X ${place.name} CLOSED`);
    } else if (s >= 90) {
      summary.verified++;
    } else {
      summary.stale++;
      console.log(`  ~ ${place.name} score=${s} ${issues.join(', ')}`);
    }

    await new Promise((r) => setTimeout(r, 150)); // rate-limit
  }

  console.log('\nSummary:', summary);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
