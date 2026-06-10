// _correct-button.ts — shared HTML/JS snippet for "El Botón de Corregir"
// Embed in api/*.ts handlers that render full HTML pages.
//
// Usage:
//   import { correctButtonHtml } from './_correct-button';
//   // inside the HTML template, before </body>:
//   ${correctButtonHtml({ pageType: 'categoria', placeId: null })}
//
// Routes feedback to:
//   1. WhatsApp deep-link (wa.me/17874177711, primary) → bot intent CORREGIR
//   2. Form POST to /functions/v1/submit-correction (fallback)

interface CorrectButtonOpts {
  pageType?: string;       // 'categoria' | 'negocio' | 'farmacia' | 'pueblo_en_numeros' | 'municipio' | 'otro'
  placeId?: string | null; // optional uuid
}

const SUBMIT_URL =
  (process.env.VITE_SUPABASE_URL || 'https://vprjteqgmanntvisjrvp.supabase.co') +
  '/functions/v1/submit-correction';

export function correctButtonHtml(opts: CorrectButtonOpts = {}): string {
  const pageType = opts.pageType || 'otro';
  const placeId = opts.placeId || '';

  return `
<!-- El Botón de Corregir -->
<div id="cb-root" style="max-width:720px;margin:32px auto 16px;padding:16px;text-align:center;font-family:system-ui,-apple-system,sans-serif">
  <button id="cb-open" type="button" style="background:transparent;border:1px solid #94a3b8;color:#475569;padding:10px 18px;border-radius:999px;font-size:14px;cursor:pointer;line-height:1.4">
    🛠 ¿Algo está mal o falta? Avísanos.
  </button>
</div>

<div id="cb-modal" role="dialog" aria-modal="true" aria-labelledby="cb-title" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:9999;align-items:center;justify-content:center;padding:16px;font-family:system-ui,-apple-system,sans-serif">
  <div style="background:#fff;max-width:520px;width:100%;border-radius:12px;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,0.3);max-height:90vh;overflow-y:auto">
    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
      <h2 id="cb-title" style="margin:0;font-size:20px;color:#0f172a">Corrige lo que veas</h2>
      <button id="cb-close" type="button" aria-label="Cerrar" style="background:transparent;border:0;font-size:24px;cursor:pointer;color:#64748b;line-height:1">×</button>
    </div>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.5">Vio algo mal o que falta en esta página? Cuéntenos en una línea — Angel lo revisa el lunes.</p>

    <textarea id="cb-msg" rows="4" placeholder="Ej: la farmacia cerró · este horario está mal · falta el teléfono · etc." maxlength="2000" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit;font-size:14px;resize:vertical;margin-bottom:12px"></textarea>

    <!-- Honeypot: hidden from humans, bots fill it -->
    <input type="text" id="cb-website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true" />

    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
      <a id="cb-wa" href="#" style="display:block;background:#25D366;color:#fff;text-align:center;padding:12px 16px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
        Enviar por WhatsApp (787-417-7711)
      </a>
      <button id="cb-submit" type="button" style="background:#0f172a;color:#fff;border:0;padding:12px 16px;border-radius:8px;font-weight:600;font-size:15px;cursor:pointer">
        O enviar aquí
      </button>
    </div>

    <div id="cb-feedback" style="display:none;padding:10px;border-radius:6px;font-size:14px;margin-bottom:12px"></div>

    <p style="margin:16px 0 0;font-size:12px;color:#64748b;font-style:italic;line-height:1.5;border-top:1px solid #e2e8f0;padding-top:12px">Google no siempre sabe. Facebook se pierde. Pero si los vecinos corrigen, Cabo Rojo se organiza.</p>
  </div>
</div>

<script>
(function(){
  var openBtn = document.getElementById('cb-open');
  var modal = document.getElementById('cb-modal');
  var closeBtn = document.getElementById('cb-close');
  var msgEl = document.getElementById('cb-msg');
  var waLink = document.getElementById('cb-wa');
  var submitBtn = document.getElementById('cb-submit');
  var feedback = document.getElementById('cb-feedback');
  var websiteEl = document.getElementById('cb-website');
  var PAGE_TYPE = ${JSON.stringify(pageType)};
  var PLACE_ID = ${JSON.stringify(placeId)};
  var SUBMIT_URL = ${JSON.stringify(SUBMIT_URL)};
  var PHONE = '17874177711';

  function buildWaUrl() {
    var url = window.location.href;
    var msg = msgEl.value.trim();
    var body = 'CORREGIR ' + url + ': ' + (msg || '');
    return 'https://wa.me/' + PHONE + '?text=' + encodeURIComponent(body);
  }

  function refreshWa(){ waLink.href = buildWaUrl(); }

  function setFeedback(text, ok){
    feedback.style.display = 'block';
    feedback.style.background = ok ? '#dcfce7' : '#fee2e2';
    feedback.style.color = ok ? '#166534' : '#991b1b';
    feedback.textContent = text;
  }

  openBtn.addEventListener('click', function(){
    modal.style.display = 'flex';
    refreshWa();
    setTimeout(function(){ msgEl.focus(); }, 50);
  });
  closeBtn.addEventListener('click', function(){ modal.style.display = 'none'; });
  modal.addEventListener('click', function(e){ if (e.target === modal) modal.style.display = 'none'; });
  msgEl.addEventListener('input', refreshWa);
  waLink.addEventListener('click', refreshWa);

  submitBtn.addEventListener('click', function(){
    var msg = msgEl.value.trim();
    if (msg.length < 5) { setFeedback('Escribe al menos 5 caracteres.', false); return; }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';
    fetch(SUBMIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_url: window.location.href,
        page_type: PAGE_TYPE,
        place_id: PLACE_ID || null,
        raw_message: msg,
        website: websiteEl.value
      })
    }).then(function(r){
      if (r.ok) {
        setFeedback('Gracias vecino. Angel lo revisa el lunes.', true);
        msgEl.value = '';
        setTimeout(function(){ modal.style.display = 'none'; submitBtn.disabled = false; submitBtn.textContent = 'O enviar aquí'; feedback.style.display = 'none'; }, 2500);
      } else if (r.status === 429) {
        setFeedback('Demasiadas correcciones desde tu IP. Inténtalo en unos minutos.', false);
        submitBtn.disabled = false;
        submitBtn.textContent = 'O enviar aquí';
      } else {
        setFeedback('No pude enviar ahora. Usa el botón de WhatsApp.', false);
        submitBtn.disabled = false;
        submitBtn.textContent = 'O enviar aquí';
      }
    }).catch(function(){
      setFeedback('No pude enviar ahora. Usa el botón de WhatsApp.', false);
      submitBtn.disabled = false;
      submitBtn.textContent = 'O enviar aquí';
    });
  });
})();
</script>
`;
}
