/**
 * MapaDeCaboRojo Embeddable Business Card Widget
 * Usage:
 *   <div data-mapa-place="antares-caribbean-cuisine"></div>
 *   <script src="https://mapadecaborojo.com/widget.js" async></script>
 *
 * Legacy support (id="mapa-widget" + data-place):
 *   <div id="mapa-widget" data-place="antares-caribbean-cuisine"></div>
 *
 * Security: all user-supplied data from the API is inserted via textContent or
 * setAttribute — never via innerHTML. Only static template markup uses innerHTML.
 */
(function () {
  'use strict';

  var BASE_URL = 'https://mapadecaborojo.com';
  var API_URL  = BASE_URL + '/api/public?action=mcp';

  /* ─── CSS injected into Shadow DOM ─── */
  var STYLES = [
    ':host { display: block; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }',
    '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }',

    /* Card */
    '.mdc-card {',
    '  border-radius: 16px;',
    '  overflow: hidden;',
    '  background: #ffffff;',
    '  box-shadow: 0 2px 12px rgba(0,0,0,.10);',
    '  max-width: 600px;',
    '  min-width: 280px;',
    '  width: 100%;',
    '}',

    /* Dark mode */
    '@media (prefers-color-scheme: dark) {',
    '  .mdc-card { background: #1e293b; color: #f1f5f9; }',
    '  .mdc-meta { color: #94a3b8; }',
    '  .mdc-footer { background: #0f172a; }',
    '  .mdc-footer a { color: #5eead4; }',
    '  .mdc-pill { background: rgba(13,148,136,.25); color: #5eead4; }',
    '  .mdc-badge-open { background: #14532d; color: #86efac; }',
    '  .mdc-badge-closed { background: #450a0a; color: #fca5a5; }',
    '  .mdc-btn-veci { background: #0f172a; color: #5eead4; border-color: #0d9488; }',
    '}',

    /* Photo / gradient header */
    '.mdc-photo {',
    '  width: 100%;',
    '  height: 160px;',
    '  object-fit: cover;',
    '  display: block;',
    '}',
    '.mdc-photo-placeholder {',
    '  width: 100%;',
    '  height: 160px;',
    '  background: linear-gradient(135deg, #0d9488 0%, #0891b2 50%, #7c3aed 100%);',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '}',

    /* Body */
    '.mdc-body { padding: 16px; }',

    /* Top row: name + status badge */
    '.mdc-toprow {',
    '  display: flex;',
    '  align-items: flex-start;',
    '  justify-content: space-between;',
    '  gap: 8px;',
    '  margin-bottom: 6px;',
    '}',
    '.mdc-name {',
    '  font-size: 18px;',
    '  font-weight: 700;',
    '  line-height: 1.25;',
    '  color: inherit;',
    '}',

    /* Status badges */
    '.mdc-badge {',
    '  flex-shrink: 0;',
    '  font-size: 11px;',
    '  font-weight: 600;',
    '  padding: 3px 8px;',
    '  border-radius: 999px;',
    '  white-space: nowrap;',
    '}',
    '.mdc-badge-open  { background: #dcfce7; color: #166534; }',
    '.mdc-badge-closed { background: #fee2e2; color: #991b1b; }',

    /* Category pill */
    '.mdc-pill {',
    '  display: inline-block;',
    '  font-size: 11px;',
    '  font-weight: 600;',
    '  padding: 2px 10px;',
    '  border-radius: 999px;',
    '  background: rgba(13,148,136,.12);',
    '  color: #0d9488;',
    '  margin-bottom: 10px;',
    '  text-transform: uppercase;',
    '  letter-spacing: .04em;',
    '}',

    /* Meta lines */
    '.mdc-meta {',
    '  font-size: 13px;',
    '  color: #64748b;',
    '  margin-bottom: 4px;',
    '  display: flex;',
    '  align-items: flex-start;',
    '  gap: 6px;',
    '  line-height: 1.4;',
    '}',
    '.mdc-meta svg { flex-shrink: 0; margin-top: 1px; }',
    '.mdc-meta a { color: inherit; text-decoration: none; }',
    '.mdc-meta a:hover { text-decoration: underline; }',

    /* CTA buttons row */
    '.mdc-actions {',
    '  display: flex;',
    '  gap: 8px;',
    '  margin-top: 14px;',
    '  flex-wrap: wrap;',
    '}',
    '.mdc-btn {',
    '  flex: 1 1 0;',
    '  min-width: 120px;',
    '  display: inline-flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  gap: 5px;',
    '  padding: 9px 14px;',
    '  border-radius: 10px;',
    '  font-size: 13px;',
    '  font-weight: 600;',
    '  text-decoration: none;',
    '  cursor: pointer;',
    '  border: 2px solid transparent;',
    '  transition: opacity .15s;',
    '}',
    '.mdc-btn:hover { opacity: .85; }',
    '.mdc-btn-map {',
    '  background: #0d9488;',
    '  color: #ffffff;',
    '}',
    '.mdc-btn-veci {',
    '  background: #f8fafc;',
    '  color: #0d9488;',
    '  border-color: #0d9488;',
    '}',

    /* Footer */
    '.mdc-footer {',
    '  background: #f8fafc;',
    '  padding: 8px 16px;',
    '  text-align: center;',
    '  font-size: 11px;',
    '  color: #94a3b8;',
    '}',
    '.mdc-footer a {',
    '  color: #0d9488;',
    '  text-decoration: none;',
    '  font-weight: 600;',
    '}',
    '.mdc-footer a:hover { text-decoration: underline; }',

    /* Loading / error */
    '.mdc-state {',
    '  padding: 24px 16px;',
    '  text-align: center;',
    '  color: #94a3b8;',
    '  font-size: 13px;',
    '}',
    '.mdc-spinner {',
    '  width: 28px; height: 28px;',
    '  border: 3px solid #e2e8f0;',
    '  border-top-color: #0d9488;',
    '  border-radius: 50%;',
    '  animation: mdc-spin .7s linear infinite;',
    '  margin: 0 auto 10px;',
    '}',
    '@keyframes mdc-spin { to { transform: rotate(360deg); } }',
  ].join('\n');

  /* ─── SVG icon fragments (static markup only, no user data) ─── */
  var ICON_PHONE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.4 2 2 0 0 1 3.6 2.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.9a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  var ICON_PIN   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  var ICON_MAP   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>';
  var ICON_MSG   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var ICON_BIZ   = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>';

  /* ─── DOM helpers ─── */
  function el(tag, classes) {
    var node = document.createElement(tag);
    if (classes) node.className = classes;
    return node;
  }

  function svgNode(svgString) {
    // SVG icons are 100% static strings defined above — safe to use innerHTML here
    var wrap = document.createElement('span');
    // Note: this innerHTML contains ONLY the static SVG constants defined in this file.
    // No user-supplied data is ever passed to this function.
    wrap.innerHTML = svgString; // safe: static only
    return wrap.firstChild;
  }

  /* ─── Determine open/closed from opening_hours ─── */
  function getOpenStatus(opening_hours) {
    if (!opening_hours) return null;
    var t = (opening_hours.type || '').toLowerCase();
    if (t === 'always_open' || t === '24_7' || t === '24/7') return 'open';
    if (t === 'closed' || t === 'permanently_closed') return 'closed';

    if (Array.isArray(opening_hours.periods) && opening_hours.periods.length) {
      var now = new Date();
      var day  = now.getDay();
      var mins = now.getHours() * 60 + now.getMinutes();
      for (var i = 0; i < opening_hours.periods.length; i++) {
        var p = opening_hours.periods[i];
        if (!p.open || p.open.day === undefined) continue;
        if (p.open.day === day) {
          var openMins  = (p.open.hours || 0) * 60 + (p.open.minutes || 0);
          var closeMins = (p.close && p.close.hours !== undefined)
            ? p.close.hours * 60 + (p.close.minutes || 0)
            : 1440;
          if (mins >= openMins && mins < closeMins) return 'open';
        }
      }
      return 'closed';
    }

    if (opening_hours.open_now === true)  return 'open';
    if (opening_hours.open_now === false) return 'closed';
    return null;
  }

  /* ─── Build card using DOM API — no user data in innerHTML ─── */
  function buildCard(biz, slug) {
    var name     = String(biz.name || 'Negocio');
    var category = String(biz.category || biz.tipo || '');
    var phone    = String(biz.phone || biz.telefono || '');
    var address  = String(biz.address || biz.direccion || '');
    var photoUrl = String(biz.photo_url || biz.imagen || biz.cover_photo || '');
    var oh       = biz.opening_hours || biz.horario || null;
    var status   = getOpenStatus(oh);
    var detailURL = BASE_URL + '/negocio/' + encodeURIComponent(slug);
    var veciSMS   = 'sms:+17874177711?body=' + encodeURIComponent(name);

    var card = el('div', 'mdc-card');
    card.setAttribute('role', 'article');
    card.setAttribute('aria-label', name);

    /* — Photo — */
    if (photoUrl) {
      var img = document.createElement('img');
      img.className = 'mdc-photo';
      img.setAttribute('alt', name);
      img.setAttribute('loading', 'lazy');
      img.src = photoUrl; // URL from API — sets as attribute, not parsed as HTML
      var placeholder = el('div', 'mdc-photo-placeholder');
      placeholder.style.display = 'none';
      placeholder.appendChild(svgNode(ICON_BIZ)); // static SVG only
      img.onerror = function () {
        img.style.display = 'none';
        placeholder.style.display = 'flex';
      };
      card.appendChild(img);
      card.appendChild(placeholder);
    } else {
      var ph = el('div', 'mdc-photo-placeholder');
      ph.appendChild(svgNode(ICON_BIZ)); // static SVG only
      card.appendChild(ph);
    }

    /* — Body — */
    var body = el('div', 'mdc-body');

    /* Top row */
    var topRow = el('div', 'mdc-toprow');
    var nameEl = el('h2', 'mdc-name');
    nameEl.textContent = name; // safe: textContent
    topRow.appendChild(nameEl);

    if (status === 'open' || status === 'closed') {
      var badge = el('span', 'mdc-badge mdc-badge-' + status);
      badge.textContent = status === 'open' ? 'Abierto' : 'Cerrado'; // static label
      topRow.appendChild(badge);
    }
    body.appendChild(topRow);

    /* Category pill */
    if (category) {
      var pill = el('div', 'mdc-pill');
      pill.textContent = category; // safe: textContent
      body.appendChild(pill);
    }

    /* Phone */
    if (phone) {
      var phoneRow = el('p', 'mdc-meta');
      phoneRow.appendChild(svgNode(ICON_PHONE)); // static SVG
      var phoneLink = document.createElement('a');
      phoneLink.href = 'tel:' + phone.replace(/\D/g, ''); // digits only
      phoneLink.textContent = phone; // safe: textContent
      phoneRow.appendChild(phoneLink);
      body.appendChild(phoneRow);
    }

    /* Address */
    if (address) {
      var addrRow = el('p', 'mdc-meta');
      addrRow.appendChild(svgNode(ICON_PIN)); // static SVG
      var addrSpan = document.createElement('span');
      addrSpan.textContent = address; // safe: textContent
      addrRow.appendChild(addrSpan);
      body.appendChild(addrRow);
    }

    /* Actions */
    var actions = el('div', 'mdc-actions');

    var mapBtn = document.createElement('a');
    mapBtn.className = 'mdc-btn mdc-btn-map';
    mapBtn.href = detailURL; // constructed from slug (validated below)
    mapBtn.setAttribute('target', '_blank');
    mapBtn.setAttribute('rel', 'noopener');
    mapBtn.appendChild(svgNode(ICON_MAP)); // static SVG
    mapBtn.appendChild(document.createTextNode(' Ver en el mapa'));
    actions.appendChild(mapBtn);

    var veciBtn = document.createElement('a');
    veciBtn.className = 'mdc-btn mdc-btn-veci';
    veciBtn.href = veciSMS; // sms: URI — name is encodeURIComponent'd
    veciBtn.appendChild(svgNode(ICON_MSG)); // static SVG
    veciBtn.appendChild(document.createTextNode(' Pregunta a El Veci'));
    actions.appendChild(veciBtn);

    body.appendChild(actions);
    card.appendChild(body);

    /* — Footer — */
    var footer = el('div', 'mdc-footer');
    var footerLink = document.createElement('a');
    footerLink.href = BASE_URL; // static constant
    footerLink.setAttribute('target', '_blank');
    footerLink.setAttribute('rel', 'noopener');
    footerLink.textContent = 'MapaDeCaboRojo.com'; // static label
    footer.appendChild(footerLink);
    footer.appendChild(document.createTextNode(' \u2014 Directorio local de Cabo Rojo, PR'));
    card.appendChild(footer);

    return card;
  }

  /* ─── Loading state node ─── */
  function loadingNode() {
    var card  = el('div', 'mdc-card');
    var state = el('div', 'mdc-state');
    var spin  = el('div', 'mdc-spinner');
    state.appendChild(spin);
    state.appendChild(document.createTextNode('Cargando...'));
    card.appendChild(state);
    return card;
  }

  /* ─── Error state node ─── */
  function errorNode(msg) {
    var card  = el('div', 'mdc-card');
    var state = el('div', 'mdc-state');
    state.textContent = '\u26a0\ufe0f ' + (msg || 'Error al cargar'); // safe: textContent
    card.appendChild(state);
    return card;
  }

  /* ─── Fetch business data via POST /api/mcp ─── */
  function fetchBusiness(slug, callback) {
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ method: 'get_business', params: { slug: slug } }),
    })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var biz = data.result || data.business || data.place || data;
      if (!biz || (!biz.name && !biz.id)) throw new Error('Negocio no encontrado');
      callback(null, biz);
    })
    .catch(function (err) {
      callback(err, null);
    });
  }

  /* ─── Validate slug (alphanumeric + hyphens only) ─── */
  function validSlug(slug) {
    return /^[a-zA-Z0-9\-_]+$/.test(slug);
  }

  /* ─── Initialize a single host element ─── */
  function initElement(el, slug) {
    if (!slug) return;
    slug = slug.trim();
    if (!slug || !validSlug(slug)) return;

    // Attach Shadow DOM to isolate styles from host page
    var shadow = el.attachShadow ? el.attachShadow({ mode: 'open' }) : null;
    var container = shadow || el;

    if (shadow) {
      var styleEl = document.createElement('style');
      styleEl.textContent = STYLES; // static CSS string only
      shadow.appendChild(styleEl);
    }

    // Show loading
    container.appendChild(loadingNode());

    // Fetch and render
    fetchBusiness(slug, function (err, biz) {
      // Clear loading
      while (container.firstChild && !(shadow && container.firstChild.tagName === 'STYLE')) {
        var child = container.lastChild;
        if (shadow && child.tagName === 'STYLE') break;
        container.removeChild(child);
      }
      container.appendChild(err ? errorNode(err.message) : buildCard(biz, slug));
    });
  }

  /* ─── Find all widget targets ─── */
  function boot() {
    var targets = [];

    // Primary: any element with data-mapa-place attribute
    var byAttr = document.querySelectorAll('[data-mapa-place]');
    for (var i = 0; i < byAttr.length; i++) {
      targets.push({ node: byAttr[i], slug: byAttr[i].getAttribute('data-mapa-place') });
    }

    // Legacy: #mapa-widget + data-place
    var legacy = document.getElementById('mapa-widget');
    if (legacy && !legacy.getAttribute('data-mapa-place')) {
      var legacySlug = legacy.getAttribute('data-place');
      if (legacySlug) targets.push({ node: legacy, slug: legacySlug });
    }

    targets.forEach(function (t) { initElement(t.node, t.slug); });
  }

  /* ─── Run after DOM ready ─── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
