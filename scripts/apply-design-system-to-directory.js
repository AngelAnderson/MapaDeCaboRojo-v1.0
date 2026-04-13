#!/usr/bin/env node
/**
 * Apply CaboRojo.com Design System (DESIGN.md) to the /directorio/ page.
 *
 * The directory page uses inline CSS with generic blue-cold colors.
 * This script replaces them with the warm Océano/Salinas/Lino palette
 * and adds the correct typography (Fraunces, Source Sans 3, Geist Mono).
 *
 * Usage:
 *   node scripts/apply-design-system-to-directory.js          # dry-run
 *   node scripts/apply-design-system-to-directory.js --push   # update WordPress
 */

const WP_API = 'https://caborojo.com/wp-json/wp/v2';
const WP_PAGE_ID = 10128;
const WP_USER = 'claude';
const WP_APP_PASS = '8GFw LxpV xTrk EqM3 Kfoy D1nM';
const PUSH = process.argv.includes('--push');
const AUTH = Buffer.from(`${WP_USER}:${WP_APP_PASS}`).toString('base64');

// ── Design System Tokens (from DESIGN.md) ──────────────────────────
const DS = {
  oceano:  '#1B4B5A',  // Primary
  salinas: '#D4603A',  // Secondary
  lino:    '#FAF8F5',  // Background
  tinta:   '#2C2418',  // Text
  piedra:  '#8A7E6F',  // Muted
  arena:   '#E8E2D9',  // Border
  mangle:  '#3D7A4A',  // Success
  mango:   '#C4841D',  // Warning
  bandera: '#B83B2E',  // Error
};

// ── CSS Variable Remapping ─────────────────────────────────────────
const VAR_MAP = [
  // Core variables
  ['--cr-ink:#16325c',    `--cr-ink:${DS.tinta}`],
  ['--cr-muted:#58749b',  `--cr-muted:${DS.piedra}`],
  ['--cr-line:#dbe5f2',   `--cr-line:${DS.arena}`],
  ['--cr-chip:#eaf2ff',   `--cr-chip:${DS.lino}`],
  ['--cr-accent:#133b73', `--cr-accent:${DS.oceano}`],
];

// ── Color Replacements (component-specific) ────────────────────────
const COLOR_MAP = [
  // Kicker (DIRECTORIO LOCAL label)
  ['color:#b65027', `color:${DS.salinas}`],
  // Badge "Abierto" green
  ['background:#effbf2', `background:#eef6ef`],
  ['color:#1c7a3f',      `color:${DS.mangle}`],
  // Badge "Cerrado" red
  ['background:#fff0f0', `background:#fdf0ef`],
  ['color:#9c2f2f',      `color:${DS.bandera}`],
  // Default badge blue tint → warm
  ['background:#edf3ff',  `background:${DS.lino}`],
  ['color:#224575',       `color:${DS.oceano}`],
  // Search focus ring → oceano
  ['border-color:#84a6da', `border-color:${DS.oceano}`],
  ['rgba(116,155,220,.15)', `rgba(27,75,90,.12)`],
  // Hero copy gradient → warm
  ['#f8fbff', DS.lino],
  // CEO block gradient
  ['linear-gradient(180deg,#f8fbff 0%,#ffffff 100%)', `linear-gradient(180deg,${DS.lino} 0%,#ffffff 100%)`],
  // Help button colors
  ['color:#15335e', `color:${DS.tinta}`],
  ['color:#25456f', `color:${DS.oceano}`],
  // Media fallback gradient
  ['#dfeeff', '#e8e2d9'],
  ['#fff4e7', '#faf8f5'],
  ['rgba(19,59,115,.08)', 'rgba(27,75,90,.08)'],
  // Card body text
  ['color:#3b5a83', `color:${DS.piedra}`],
  // More button hover
  ['border-color:#9db6d9', `border-color:${DS.piedra}`],
  ['background:#f7fbff',   `background:${DS.lino}`],
];

// ── Typography Addition ────────────────────────────────────────────
const TYPOGRAPHY_CSS = `
#cr-directory-app { font-family: 'Source Sans 3', -apple-system, sans-serif; }
#cr-directory-app h1, #cr-directory-app h2, #cr-directory-app .crd-ceo-heading { font-family: 'Fraunces', Georgia, serif; letter-spacing: -0.02em; }
#cr-directory-app .crd-badge, #cr-directory-app .crd-address, #cr-directory-app .crd-kicker { font-family: 'Geist Mono', 'SF Mono', monospace; }
`;

// ── Sponsor badge update (gold → Mango) ────────────────────────────
const SPONSOR_COLOR_MAP = [
  ['#d4a843', DS.mango],
  ['rgba(212,168,67,.15)', `rgba(196,132,29,.12)`],
  ['#fdf6e3', '#fef8ef'],
  ['#fff8dc', '#fff5e6'],
  ['#8b6914', DS.mango],
];

// ── CTA block update ───────────────────────────────────────────────
const CTA_COLOR_MAP = [
  ['linear-gradient(180deg,#f0f7ff 0%,#ffffff 100%)', `linear-gradient(180deg,${DS.lino} 0%,#ffffff 100%)`],
];

async function fetchPage() {
  const res = await fetch(`${WP_API}/pages/${WP_PAGE_ID}?context=edit`, {
    headers: { 'Authorization': `Basic ${AUTH}` },
  });
  if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
  return res.json();
}

async function updatePage(content) {
  const res = await fetch(`${WP_API}/pages/${WP_PAGE_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${AUTH}` },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Update error: ${res.status} — ${await res.text()}`);
  return res.json();
}

function applyDesignSystem(raw) {
  let content = raw;
  let changes = 0;

  // 1. Remap CSS variables
  for (const [from, to] of VAR_MAP) {
    if (content.includes(from)) {
      content = content.replaceAll(from, to);
      changes++;
    }
  }
  console.log(`   CSS variables: ${changes} remapped`);

  // 2. Component colors
  let colorChanges = 0;
  for (const [from, to] of [...COLOR_MAP, ...SPONSOR_COLOR_MAP, ...CTA_COLOR_MAP]) {
    if (content.includes(from)) {
      content = content.replaceAll(from, to);
      colorChanges++;
    }
  }
  console.log(`   Component colors: ${colorChanges} updated`);

  // 3. Typography
  if (!content.includes("'Source Sans 3'")) {
    content = content.replace('</style>', `${TYPOGRAPHY_CSS}</style>`);
    console.log('   Typography: added Fraunces + Source Sans 3 + Geist Mono');
  } else {
    console.log('   Typography: already present');
  }

  return content;
}

async function main() {
  console.log('📄 Fetching page...');
  const page = await fetchPage();
  const raw = page.content?.raw;
  if (!raw) throw new Error('Could not get raw content');

  console.log('\n🎨 Applying design system...');
  const upgraded = applyDesignSystem(raw);

  const changed = upgraded !== raw;
  console.log(`\n📊 Changes: ${changed ? 'YES' : 'NO'}`);

  if (!changed) { console.log('   Nothing to update.'); return; }
  if (!PUSH) { console.log('\n🔍 DRY RUN — use --push to apply.'); return; }

  console.log('\n🚀 Pushing to WordPress...');
  await updatePage(upgraded);
  console.log('   ✅ Design system applied to /directorio/!');
  console.log('   👉 https://caborojo.com/directorio/');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
