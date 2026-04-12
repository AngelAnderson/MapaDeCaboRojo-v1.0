#!/usr/bin/env node
/**
 * Sync Supabase places → WordPress caborojo.com/directorio/ page
 *
 * Usage:
 *   node scripts/sync-directory-to-wordpress.js          # dry-run (shows diff)
 *   node scripts/sync-directory-to-wordpress.js --push   # actually updates WordPress
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars');
  process.exit(1);
}

const WP_API = 'https://caborojo.com/wp-json/wp/v2';
const WP_PAGE_ID = 10128;
const WP_USER = 'claude';
const WP_APP_PASS = '8GFw LxpV xTrk EqM3 Kfoy D1nM';

const PUSH = process.argv.includes('--push');

// Fields to SELECT from Supabase (actual column names)
const SELECT_FIELDS = [
  'id', 'name', 'slug', 'category', 'subcategory', 'description', 'address',
  'gmaps_url', 'phone', 'website', 'status', 'is_verified',
  'tags', 'image_url', 'visibility', 'plan', 'sponsor_weight', 'lat', 'lon',
];

async function fetchPlaces() {
  // Supabase REST API with range headers for pagination
  const allPlaces = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/places?select=${SELECT_FIELDS.join(',')}&visibility=eq.published&status=eq.open&order=sponsor_weight.desc.nullslast,name.asc&offset=${offset}&limit=${pageSize}`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'count=exact',
      },
    });
    if (!res.ok) throw new Error(`Supabase error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    if (data.length === 0) break;

    for (const row of data) {
      // Transform to DIRECTORY_DATA format
      const place = {
        id: row.id,
        name: row.name,
        slug: row.slug,
        category: row.category,
        subcategory: row.subcategory || null,
        summary: row.description || '',  // DB calls it "description", page expects "summary"
        address: row.address || '',
        gmaps_url: row.gmaps_url || '',
        phone: row.phone || '',
        website: row.website || '',
        facebook: '',  // no longer stored as column; keep field for JS compat
        status: row.status,
        is_verified: !!row.is_verified,
        tags: Array.isArray(row.tags) ? row.tags : [],
        image_url: row.image_url || '',
        visibility: row.visibility,
        plan: row.plan || 'free',
        sponsor_weight: row.sponsor_weight || 0,
        has_coords: !!(row.lat && row.lon),
      };
      allPlaces.push(place);
    }

    offset += pageSize;
    if (data.length < pageSize) break;
  }

  return allPlaces;
}

async function fetchCurrentPage() {
  const res = await fetch(`${WP_API}/pages/${WP_PAGE_ID}`);
  if (!res.ok) throw new Error(`WP fetch error: ${res.status}`);
  return res.json();
}

function buildPageContent(currentContent, places) {
  // Replace the DIRECTORY_DATA array in the existing page content
  const jsonStr = JSON.stringify(places);
  const replaced = currentContent.replace(
    /const DIRECTORY_DATA\s*=\s*\[.*?\];/s,
    `const DIRECTORY_DATA = ${jsonStr};`
  );
  if (replaced === currentContent && !currentContent.includes('DIRECTORY_DATA')) {
    throw new Error('Could not find DIRECTORY_DATA in page content');
  }
  return replaced;
}

async function updatePage(content) {
  const auth = Buffer.from(`${WP_USER}:${WP_APP_PASS}`).toString('base64');
  const res = await fetch(`${WP_API}/pages/${WP_PAGE_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WP update error: ${res.status} — ${body}`);
  }
  return res.json();
}

async function main() {
  console.log('📡 Fetching places from Supabase...');
  const places = await fetchPlaces();
  console.log(`   Found ${places.length} published/open places`);

  // Stats
  const categories = {};
  let sponsors = 0;
  for (const p of places) {
    categories[p.category] = (categories[p.category] || 0) + 1;
    if (p.sponsor_weight > 0) sponsors++;
  }
  console.log(`   Categories: ${Object.entries(categories).sort((a,b) => b[1]-a[1]).map(([k,v]) => `${k}:${v}`).join(', ')}`);
  console.log(`   Sponsors (weight>0): ${sponsors}`);

  console.log('\n📄 Fetching current WordPress page...');
  const page = await fetchCurrentPage();
  const raw = page.content?.raw || page.content?.rendered;
  if (!raw) throw new Error('Could not get page content (need raw). Check auth.');

  // Count current items
  const currentMatch = raw.match(/DIRECTORY_DATA\s*=\s*(\[.*?\]);/s);
  const currentCount = currentMatch ? JSON.parse(currentMatch[1]).length : '?';
  console.log(`   Current page has ${currentCount} items`);

  const newContent = buildPageContent(raw, places);
  const diff = places.length - (typeof currentCount === 'number' ? currentCount : 0);
  console.log(`\n📊 Sync summary:`);
  console.log(`   Supabase: ${places.length} places`);
  console.log(`   WordPress (before): ${currentCount} places`);
  console.log(`   Difference: ${diff > 0 ? '+' : ''}${diff}`);

  if (!PUSH) {
    console.log('\n🔍 DRY RUN — no changes made. Use --push to update WordPress.');
    console.log(`   Would update page ${WP_PAGE_ID} with ${places.length} places.`);
    return;
  }

  console.log('\n🚀 Pushing to WordPress...');
  await updatePage(newContent);
  console.log(`   ✅ Page updated with ${places.length} places!`);
  console.log(`   👉 https://caborojo.com/directorio/`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
