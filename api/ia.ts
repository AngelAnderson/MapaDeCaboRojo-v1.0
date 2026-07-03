// /ia — "¿Te conoce la IA?" — el espejo público del moonshot de citabilidad.
// El dueño escribe su negocio + lo que hace → le preguntamos a la IA (OpenAI
// Responses API + web_search, mismo motor que la edge fn ai-visibility-check)
// la pregunta que un vecino REALMENTE haría, y medimos si la IA lo nombra.
//
// Si no te ven, no te compran. El ❌ es el hook; el arreglo es el índice
// verificado del Veci. Doc: Moonshot-Citabilidad-IA-PR-2026-06-30.md
//
// GET /ia            → landing + formulario
// GET /ia?q=..&c=..  → chequeo server-side y veredicto. URL compartible:
//   el resultado se cachea 24h en ia_checks (mismo negocio+categoría no
//   re-gasta OpenAI) y cada chequeo real se loggea ahí = pipeline de leads.
// Env: OPENAI_API_KEY · VITE_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY ·
//   IA_DAILY_CAP (opcional, default 200)

const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = "gpt-4o";

// Tope de gasto diario (global, todo el sitio). ~$0.05–0.10 por chequeo.
const DAILY_CAP = parseInt(process.env.IA_DAILY_CAP || "200", 10);
const SB_URL = process.env.VITE_SUPABASE_URL || "";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SB_HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };

// Previews de FB/WhatsApp/Twitter y crawlers no pagan OpenAI: cache o landing.
const BOT_UA = /facebookexternalhit|whatsapp|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|googlebot|bingbot|duckduckbot|baiduspider|yandex|pinterest|redditbot|applebot|crawler|spider|preview/i;

const norm = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

type Check = { cited: boolean; answer: string };

// Bump atómico vía RPC. Fail-CLOSED: si no podemos verificar el contador, NO
// gastamos (devolvemos blocked). El cost cap es el requisito, no el uptime.
async function bumpUsage(): Promise<{ allowed: boolean; error?: boolean }> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/ia_usage_bump`, {
      method: "POST", headers: SB_HEADERS, body: JSON.stringify({ p_cap: DAILY_CAP }),
    });
    if (!r.ok) return { allowed: false, error: true };
    const rows = await r.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    return { allowed: !!row?.allowed };
  } catch {
    return { allowed: false, error: true };
  }
}

async function getCached(qn: string, cn: string): Promise<Check | null> {
  try {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const u = `${SB_URL}/rest/v1/ia_checks?select=cited,answer&q_norm=eq.${encodeURIComponent(qn)}&c_norm=eq.${encodeURIComponent(cn)}&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=1`;
    const r = await fetch(u, { headers: SB_HEADERS });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows[0] ? { cited: !!rows[0].cited, answer: rows[0].answer || "" } : null;
  } catch { return null; }
}

async function logCheck(qn: string, cn: string, name: string, cat: string, c: Check): Promise<void> {
  try {
    await fetch(`${SB_URL}/rest/v1/ia_checks`, {
      method: "POST", headers: { ...SB_HEADERS, Prefer: "return=minimal" },
      body: JSON.stringify({ q_norm: qn, c_norm: cn, business_name: name, category: cat, cited: c.cited, answer: c.answer.slice(0, 4000) }),
    });
  } catch { /* log best-effort: no romper la página por esto */ }
}

const escapeHTML = (s: string | undefined): string =>
  typeof s === "string"
    ? s.replace(/[&<>'"]/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[t] || t))
    : "";

// Rate limit por IP (in-memory, reset cada minuto) — mismo patrón que api/ai.ts
const rl = new Map<string, { c: number; r: number }>();
function rateOk(ip: string): boolean {
  const now = Date.now();
  const e = rl.get(ip);
  if (!e || now > e.r) { rl.set(ip, { c: 1, r: now + 60_000 }); return true; }
  e.c++;
  return e.c <= 12;
}

async function openai(body: Record<string, unknown>): Promise<any> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.json();
}
function outText(data: any): string {
  let text = "";
  try {
    for (const o of data.output || []) for (const c of o.content || []) if (c.type === "output_text") text += " " + c.text;
  } catch {}
  return text.trim();
}

async function checkVisibility(name: string, cat: string): Promise<Check> {
  const question = `Soy de Puerto Rico. ¿Cuáles son los mejores ${cat} en Cabo Rojo, Puerto Rico? Menciona nombres de negocios específicos.`;
  const search = await openai({ model: MODEL, tools: [{ type: "web_search_preview" }], input: question });
  const answer = outText(search);
  if (!answer) return { cited: false, answer: "" };

  // El modelo juzga su propia respuesta — más robusto que match de strings.
  // El nombre va sin comillas/saltos pa' que no pueda romper el prompt.
  const safeName = name.replace(/["\n\r]/g, " ").trim();
  const judge = await openai({
    model: MODEL,
    input: `Texto:\n"""${answer.slice(0, 4000)}"""\n\n¿El texto anterior menciona o recomienda un negocio llamado "${safeName}" (o una variación obvia del mismo nombre)? Responde únicamente con la palabra SI o la palabra NO.`,
  });
  // Normaliza acentos ("sí" → "si") — el \b de JS no reconoce la í.
  const first = outText(judge).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z\s]/g, "").trim().split(/\s+/)[0] || "";
  return { cited: first === "si", answer };
}

// La respuesta del modelo trae markdown y marcadores de cita — limpiar pa' mostrar.
function cleanAnswer(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [texto](url) → texto
    .replace(/【[^】]*】/g, "")
    .replace(/[*_#`]+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const WA = (text: string) => `https://wa.me/17874177711?text=${encodeURIComponent(text)}`;

function shell(inner: string, opts: { noindex?: boolean; title: string; desc: string }): string {
  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHTML(opts.title)}</title>
<meta name="description" content="${escapeHTML(opts.desc)}">
${opts.noindex ? '<meta name="robots" content="noindex">' : '<link rel="canonical" href="https://www.mapadecaborojo.com/ia">'}
<meta property="og:title" content="${escapeHTML(opts.title)}">
<meta property="og:description" content="${escapeHTML(opts.desc)}">
<meta property="og:image" content="https://www.mapadecaborojo.com/api/og?t=${encodeURIComponent("¿Te conoce la IA?")}&k=${encodeURIComponent("Cabo Rojo")}&sub=${encodeURIComponent("Si no te ven, no te compran")}">
<style>
  :root{--teal:#0d9488;--teal-d:#0f766e;--ink:#0f172a;--sub:#475569;--line:#e2e8f0;--paper:#f8fafc;--red:#dc2626}
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--paper);line-height:1.55;-webkit-font-smoothing:antialiased}
  .wrap{max-width:640px;margin:0 auto;padding:28px 20px 64px}
  a{color:var(--teal-d)}
  .bar{height:5px;background:var(--teal);border-radius:99px;width:56px;margin-bottom:22px}
  h1{font-size:30px;line-height:1.15;margin:0 0 12px;letter-spacing:-.02em}
  .lede{font-size:17px;color:var(--sub);margin:0 0 24px}
  form{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
  label{display:block;font-weight:600;font-size:14px;margin:0 0 6px}
  input{width:100%;padding:13px 14px;font-size:16px;border:1px solid var(--line);border-radius:10px;margin-bottom:16px;background:#fff}
  input:focus{outline:2px solid var(--teal);border-color:var(--teal)}
  .hint{font-size:13px;color:var(--sub);margin:-10px 0 16px}
  button{width:100%;padding:15px;font-size:17px;font-weight:700;color:#fff;background:var(--teal);border:0;border-radius:12px;cursor:pointer}
  button:hover{background:var(--teal-d)}
  .card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px;margin:0 0 20px}
  .verdict{font-size:24px;font-weight:800;letter-spacing:-.01em;margin:0 0 6px}
  .no{color:var(--red)} .yes{color:var(--teal-d)}
  .snippet{font-size:14px;color:var(--sub);background:var(--paper);border-left:3px solid var(--line);padding:12px 14px;border-radius:8px;margin:14px 0;white-space:pre-wrap}
  .cta{display:block;text-align:center;padding:16px;font-size:17px;font-weight:700;color:#fff;background:var(--teal);border-radius:12px;text-decoration:none;margin:8px 0}
  .cta.wa{background:#16a34a}
  .muted{font-size:13px;color:var(--sub);margin-top:26px;border-top:1px solid var(--line);padding-top:16px}
  .err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:12px 14px;border-radius:10px;margin-bottom:16px;font-size:14px}
</style></head><body><div class="wrap">${inner}</div></body></html>`;
}

function landing(err?: string, pre?: { q: string; c: string }): string {
  return shell(`
    <div class="bar"></div>
    <h1>¿Te conoce la inteligencia artificial?</h1>
    <p class="lede">Cada vez más gente le pregunta a ChatGPT o a Google AI "¿quién hace esto en Cabo Rojo?" — y recibe <strong>una</strong> respuesta. Si tu negocio no está en esa respuesta, no existe para ese cliente. Averígualo en 15 segundos.</p>
    ${err ? `<div class="err">${escapeHTML(err)}</div>` : ""}
    <form method="GET" action="/ia">
      <label for="q">Nombre de tu negocio</label>
      <input id="q" name="q" maxlength="80" required placeholder="Ej: Refrigeración Luis David" value="${escapeHTML(pre?.q || "")}">
      <label for="c">¿Qué haces? (categoría)</label>
      <input id="c" name="c" maxlength="60" required placeholder="Ej: reparación de aires acondicionados" value="${escapeHTML(pre?.c || "")}">
      <div class="hint">En pocas palabras, como lo buscaría un cliente.</div>
      <button type="submit">Ver si la IA me conoce →</button>
    </form>
    <p class="muted">Le preguntamos a la IA (con búsqueda web en vivo) lo que un vecino realmente preguntaría, y miramos si te nombra. Es una foto, no un juicio final — pero si no sales, ya sabes por qué el teléfono no suena. — <a href="https://www.mapadecaborojo.com">MapaDeCaboRojo.com</a>, el directorio verificado de Cabo Rojo.</p>
  `, { title: "¿Te conoce la IA? · Cabo Rojo", desc: "Averigua si la inteligencia artificial recomienda tu negocio en Cabo Rojo. Si no te ven, no te compran." });
}

function result(name: string, cat: string, r: Check): string {
  const clean = cleanAnswer(r.answer);
  const snippet = clean ? escapeHTML(clean.slice(0, 420)) + (clean.length > 420 ? "…" : "") : "(La IA no devolvió respuesta esta vez — intenta de nuevo.)";
  const block = r.cited
    ? `<div class="card">
        <p class="verdict yes">✅ La IA sí te nombra.</p>
        <p style="margin:0;color:var(--sub)">Cuando alguien pregunta por <strong>${escapeHTML(cat)}</strong> en Cabo Rojo, la IA menciona a <strong>${escapeHTML(name)}</strong>. Bien. La próxima pregunta: ¿sales de primero, o de tercero? Aparecer no es lo mismo que ganar.</p>
        <div class="snippet">${snippet}</div>
        <a class="cta wa" href="${WA(`Vi que la IA sí me nombra pa' ${cat}. Quiero salir de primero. ¿Cómo?`)}">Quiero salir de primero →</a>
      </div>`
    : `<div class="card">
        <p class="verdict no">❌ La IA no te conoce.</p>
        <p style="margin:0;color:var(--sub)">Cuando alguien le pregunta a la IA por <strong>${escapeHTML(cat)}</strong> en Cabo Rojo, <strong>${escapeHTML(name)}</strong> no aparece. Recomienda a otros. Esto es lo que contestó:</p>
        <div class="snippet">${snippet}</div>
        <p style="margin:0 0 8px;font-weight:600">Si no te ven, no te compran.</p>
        <a class="cta wa" href="${WA(`Vi que la IA no me encuentra pa' ${cat} en Cabo Rojo. Quiero que me consiga. ¿Qué hago?`)}">Quiero que la IA me encuentre →</a>
        <a class="cta" href="https://www.mapadecaborojo.com/pon-tu-negocio-en-el-mapa">Cómo funciona el índice verificado →</a>
      </div>`;
  return shell(`
    <div class="bar"></div>
    <h1>${r.cited ? "✅" : "❌"} ${escapeHTML(name)}</h1>
    <p class="lede">Le preguntamos a la IA: <em>"${escapeHTML(cat)} en Cabo Rojo"</em>.</p>
    ${block}
    <a class="cta" style="background:#fff;color:var(--teal-d);border:1px solid var(--line)" href="/ia">← Probar otro negocio</a>
    <p class="muted">Hecho con IA + búsqueda web en vivo. Es una foto del momento; la respuesta puede variar. Lo que no varía: quien está en el índice verificado del Veci aparece cuando lo buscan. — <a href="https://www.mapadecaborojo.com">MapaDeCaboRojo.com</a></p>
  `, { noindex: true, title: `${r.cited ? "✅" : "❌"} ${name} · ¿Te conoce la IA?`, desc: "Chequeo de visibilidad en IA para negocios de Cabo Rojo." });
}

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  try {
    const url = new URL(req.url, "https://www.mapadecaborojo.com");
    // Truncar server-side también — el maxlength del form no protege la API.
    const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
    const c = (url.searchParams.get("c") || "").trim().slice(0, 60);

    if (!q && !c) return res.status(200).send(landing());
    if (!q || !c) return res.status(200).send(landing("Escribe el nombre de tu negocio y qué haces.", { q, c }));
    if (q.length < 2 || c.length < 2) return res.status(200).send(landing("Un poquito más de detalle, por favor.", { q, c }));

    const qn = norm(q), cn = norm(c);

    // Cache 24h: links compartidos y re-visitas no re-gastan OpenAI ni cupo,
    // y el veredicto compartido se mantiene consistente.
    const cached = await getCached(qn, cn);
    if (cached) return res.status(200).send(result(q, c, cached));

    // Bots/previews (FB, WhatsApp, crawlers) nunca disparan un chequeo nuevo.
    const ua = String(req.headers["user-agent"] || "");
    if (BOT_UA.test(ua)) return res.status(200).send(landing());

    const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
    if (!rateOk(ip)) return res.status(200).send(landing("Muchas consultas seguidas. Espera un minuto y vuelve a intentar.", { q, c }));

    // Sin llave no hay chequeo — y no quemamos cupo del día.
    if (!OPENAI_KEY) return res.status(200).send(landing("Estamos afinando la herramienta. Vuelve en un ratito.", { q, c }));

    // Tope de gasto diario — antes de gastar un centavo en OpenAI.
    const cap = await bumpUsage();
    if (!cap.allowed) {
      const msg = cap.error
        ? "Estamos afinando la herramienta. Vuelve en un ratito."
        : "Hoy ya se hicieron muchos chequeos gratis. Vuelve mañana y con gusto lo miramos.";
      return res.status(200).send(landing(msg, { q, c }));
    }

    const r = await checkVisibility(q, c);
    await logCheck(qn, cn, q, c, r); // cache pa'l próximo + lead pa'l pipeline
    return res.status(200).send(result(q, c, r));
  } catch (e: any) {
    return res.status(200).send(landing("Algo falló al consultar la IA. Intenta de nuevo en un momento."));
  }
}
