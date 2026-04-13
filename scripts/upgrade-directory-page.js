#!/usr/bin/env node
/**
 * Upgrade caborojo.com/directorio/ page with:
 * 1. Sponsor visual differentiation (gold border, "Recomendado" badge) — via post-render script
 * 2. Monetization CTAs ("Agrega tu negocio" + "Destaca tu negocio")
 *
 * Strategy: Instead of modifying the card() template literal (WordPress wpautop corrupts it),
 * we add a SEPARATE script that runs AFTER render() and upgrades sponsor cards via DOM.
 *
 * Usage:
 *   node scripts/upgrade-directory-page.js          # dry-run
 *   node scripts/upgrade-directory-page.js --push   # update WordPress
 */

const WP_API = 'https://caborojo.com/wp-json/wp/v2';
const WP_PAGE_ID = 10128;
const WP_USER = 'claude';
const WP_APP_PASS = '8GFw LxpV xTrk EqM3 Kfoy D1nM';
const PUSH = process.argv.includes('--push');

const AUTH = Buffer.from(`${WP_USER}:${WP_APP_PASS}`).toString('base64');

// --- NEW CSS for sponsors + CTAs ---
const SPONSOR_CSS = `
#cr-directory-app .crd-card.crd-sponsor {
  border:2px solid #d4a843;
  box-shadow:0 2px 12px rgba(212,168,67,.15);
}
#cr-directory-app .crd-badge.badge-sponsor {
  background:linear-gradient(135deg,#fdf6e3,#fff8dc);
  color:#8b6914;
  border:1px solid #d4a843;
  font-size:.72rem;
}
#cr-directory-app .crd-cta-block {
  max-width:680px;
  margin:2rem auto;
  padding:1.8rem 2rem;
  background:linear-gradient(180deg,#f0f7ff 0%,#ffffff 100%);
  border:2px solid var(--cr-accent);
  border-radius:16px;
  text-align:center;
}
#cr-directory-app .crd-cta-block h3 {
  margin:0 0 .5rem;
  font-size:1.15rem;
  color:var(--cr-accent);
}
#cr-directory-app .crd-cta-block p {
  margin:0 0 1rem;
  color:var(--cr-muted);
  font-size:.95rem;
}
#cr-directory-app .crd-cta-buttons {
  display:flex;
  gap:12px;
  justify-content:center;
  flex-wrap:wrap;
}
#cr-directory-app .crd-cta-btn {
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:12px 20px;
  border-radius:999px;
  text-decoration:none;
  font-weight:800;
  font-size:.95rem;
}
#cr-directory-app .crd-cta-btn.cta-primary {
  background:var(--cr-accent);
  color:#fff;
}
#cr-directory-app .crd-cta-btn.cta-secondary {
  background:linear-gradient(135deg,#fdf6e3,#fff8dc);
  color:#8b6914;
  border:2px solid #d4a843;
}
`;

// --- Post-render sponsor upgrade script (runs after the main IIFE) ---
// This avoids touching the card() template literal that WordPress corrupts
const SPONSOR_SCRIPT = `
<script>
(function(){
  var dd = typeof DIRECTORY_DATA !== 'undefined' ? DIRECTORY_DATA : [];
  var lookup = {};
  dd.forEach(function(p){ lookup[p.name] = p; });
  function upgradeSponsorCards(){
    var cards = document.querySelectorAll('#cr-directory-app .crd-card');
    cards.forEach(function(card){
      var titleEl = card.querySelector('.crd-title');
      if(!titleEl) return;
      var name = titleEl.textContent.trim();
      var place = lookup[name];
      if(!place || !place.sponsor_weight) return;
      card.classList.add('crd-sponsor');
      var topline = card.querySelector('.crd-topline');
      if(topline && !topline.querySelector('.badge-sponsor')){
        var badge = document.createElement('span');
        badge.className = 'crd-badge badge-sponsor';
        badge.textContent = String.fromCodePoint(11088) + ' Recomendado';
        topline.insertBefore(badge, topline.firstChild);
      }
    });
  }
  var obs = new MutationObserver(function(){ upgradeSponsorCards(); });
  var grid = document.getElementById('crd-results');
  if(grid){ obs.observe(grid, {childList:true}); }
  upgradeSponsorCards();
})();
</script>`;

// --- CTA HTML block ---
const CTA_HTML = `<div class="crd-cta-block">
<h3>Tu negocio merece estar aquí</h3>
<p>Aparece gratis en el directorio más útil de Cabo Rojo, o destácalo para que más gente te encuentre.</p>
<div class="crd-cta-buttons">
<a class="crd-cta-btn cta-primary" href="https://wa.me/17874177711?text=Quiero%20agregar%20mi%20negocio%20al%20directorio" target="_blank" rel="noreferrer noopener">Agregar mi negocio GRATIS</a>
<a class="crd-cta-btn cta-secondary" href="https://wa.me/17874177711?text=Me%20interesa%20destacar%20mi%20negocio%20en%20CaboRojo.com" target="_blank" rel="noreferrer noopener">⭐ Destacar mi negocio</a>
</div>
</div>`;

async function fetchPage() {
  const res = await fetch(`${WP_API}/pages/${WP_PAGE_ID}?context=edit`, {
    headers: { 'Authorization': `Basic ${AUTH}` },
  });
  if (!res.ok) throw new Error(`WP fetch error: ${res.status}`);
  return res.json();
}

async function updatePage(content) {
  const res = await fetch(`${WP_API}/pages/${WP_PAGE_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${AUTH}`,
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`WP update error: ${res.status} — ${await res.text()}`);
  return res.json();
}

function upgradeContent(raw) {
  let content = raw;

  // FIRST: revert any broken sponsorClass/sponsorBadge injections from previous attempt
  // Remove the sponsorClass/sponsorBadge lines from the card function
  content = content.replace(
    /const sponsorClass = \(item\.sponsor_weight.*?;\s*const sponsorBadge = \(item\.sponsor_weight.*?;\s*/s,
    ''
  );
  // Fix the article class back if it was modified
  content = content.replace(
    /return `<\/p>\s*\n<article class="crd-card\$\{sponsorClass\}">/,
    'return `</p>\n<article class="crd-card">'
  );
  // Remove sponsorBadge from badges array
  content = content.replace(
    /const badges = \[\s*sponsorBadge,\s*\n\s*/,
    'const badges = [\n      '
  );

  // 1. Add sponsor CSS before the closing </style>
  if (!content.includes('.crd-sponsor')) {
    content = content.replace(
      '</style>',
      `${SPONSOR_CSS}</style>`
    );
    console.log('   ✅ Added sponsor CSS');
  } else {
    console.log('   ⏭️  Sponsor CSS already present');
  }

  // 2. Add sponsor upgrade script AFTER the main script
  if (!content.includes('upgradeSponsorCards')) {
    // Find the closing </script> of the main IIFE and add our script after it
    const lastScriptClose = content.lastIndexOf('</script>');
    if (lastScriptClose !== -1) {
      content = content.substring(0, lastScriptClose + '</script>'.length)
        + '\n' + SPONSOR_SCRIPT
        + content.substring(lastScriptClose + '</script>'.length);
      console.log('   ✅ Added sponsor upgrade script');
    }
  } else {
    console.log('   ⏭️  Sponsor script already present');
  }

  // 3. Add CTA block before the CEO block (remove any existing one first)
  content = content.replace(/<div class="crd-cta-block">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*(?=<div class="crd-ceo-block">)/, '');
  if (!content.includes('crd-cta-block')) {
    content = content.replace(
      '<div class="crd-ceo-block">',
      `${CTA_HTML}\n<div class="crd-ceo-block">`
    );
    console.log('   ✅ Added CTA block');
  } else {
    console.log('   ⏭️  CTA block already present');
  }

  return content;
}

async function main() {
  console.log('📄 Fetching current page (raw)...');
  const page = await fetchPage();
  const raw = page.content?.raw;
  if (!raw) throw new Error('Could not get raw content');
  console.log(`   Page length: ${raw.length} chars`);

  console.log('\n🔧 Applying upgrades...');
  const upgraded = upgradeContent(raw);

  const changed = upgraded !== raw;
  console.log(`\n📊 Changes: ${changed ? 'YES' : 'NO changes needed'}`);

  if (!changed) {
    console.log('   Nothing to update.');
    return;
  }

  if (!PUSH) {
    console.log('\n🔍 DRY RUN — use --push to apply changes.');
    return;
  }

  console.log('\n🚀 Pushing to WordPress...');
  await updatePage(upgraded);
  console.log('   ✅ Page upgraded!');
  console.log('   👉 https://caborojo.com/directorio/');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
