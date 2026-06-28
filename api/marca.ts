// /marca — guía de marca viva. Host-aware: mapadecaborojo.com (teal) y
// registromedicopr.com (medico azul). Tokens, tipografía (con specimen en
// imagen), componentes, y galería de tarjetas para redes DESCARGABLES (?dl=1).
// noindex (referencia interna).

type Preset = { label: string; q: string };
type Brand = {
  key: 'mapa' | 'medico';
  name: string;
  site: string;
  tagline: string;
  bar: string;
  accent: string;
  ink: string;
  sub: string;
  bg: string;
  theme: string;
  badgeBg: string;
  badgeBd: string;
  badgeInk: string;
  colors: { n: string; hex: string }[];
  specimen: string;
  presets: Preset[];
};

const MAPA: Brand = {
  key: 'mapa',
  name: 'MapaDeCaboRojo.com',
  site: 'mapadecaborojo.com',
  tagline: 'El directorio verificado de Cabo Rojo.',
  bar: '#0d9488',
  accent: '#0d9488',
  ink: '#0f172a',
  sub: '#475569',
  bg: '#ffffff',
  theme: '',
  badgeBg: '#f0fdfa',
  badgeBd: '#5eead4',
  badgeInk: '#0f766e',
  colors: [
    { n: 'Teal (Océano)', hex: '#0d9488' },
    { n: 'Tinta', hex: '#0f172a' },
    { n: 'Tinta suave', hex: '#475569' },
    { n: 'Teal claro', hex: '#5eead4' },
    { n: 'Borde', hex: '#e2e8f0' },
    { n: 'Bandera (rojo)', hex: '#dc2626' },
  ],
  specimen: 't=El%20directorio%20verificado%20de%20Cabo%20Rojo&k=Source%20Sans%203',
  presets: [
    { label: 'Negocio verificado', q: 't=Tino%27s&k=Comida&badge=Verificado&sub=Joyuda%20%C2%B7%20frente%20al%20mar' },
    { label: 'Categoría', q: 't=Las%20mejores%20farmacias%20de%20Cabo%20Rojo&k=Salud' },
    { label: 'Evento', q: 't=Festival%20del%20Pescao&k=Evento&sub=Este%20s%C3%A1bado%20en%20Boquer%C3%B3n' },
  ],
};

const MEDICO: Brand = {
  key: 'medico',
  name: 'RegistroMedicoPR.com',
  site: 'registromedicopr.com',
  tagline: 'El registro de especialistas de Puerto Rico.',
  bar: '#1d4ed8',
  accent: '#1d4ed8',
  ink: '#0f172a',
  sub: '#475569',
  bg: '#ffffff',
  theme: 'medico',
  badgeBg: '#eff6ff',
  badgeBd: '#93c5fd',
  badgeInk: '#1e40af',
  colors: [
    { n: 'Azul', hex: '#1d4ed8' },
    { n: 'Tinta', hex: '#0f172a' },
    { n: 'Tinta suave', hex: '#475569' },
    { n: 'Azul claro', hex: '#93c5fd' },
    { n: 'Borde', hex: '#e2e8f0' },
    { n: 'Verde ok', hex: '#16a34a' },
  ],
  specimen: 't=El%20registro%20de%20especialistas%20de%20PR&k=Source%20Sans%203',
  presets: [
    { label: 'Especialista', q: 't=Dra.%20Ana%20Mar%C3%ADa%20Ram%C3%ADrez&k=Cardiolog%C3%ADa&badge=En%20el%20registro' },
    { label: 'Por pueblo', q: 't=Cardi%C3%B3logos%20en%20Mayag%C3%BCez&k=Especialidad' },
    { label: 'Verificado', q: 't=Dr.%20Luis%20Torres&k=Pediatr%C3%ADa&badge=Licencia%20activa&sub=San%20Juan%20%C2%B7%20acepta%20planes' },
  ],
};

function og(b: Brand, q: string, dl = false): string {
  const t = b.theme ? `theme=${b.theme}&amp;` : '';
  return `/api/og?${t}${q}${dl ? '&amp;dl=1' : ''}`;
}

function swatch(c: { n: string; hex: string }): string {
  return `<div><div style="height:96px;border-radius:14px;border:1px solid #e2e8f0;background:${c.hex}"></div>
  <div style="font-weight:800;font-size:14px;margin-top:8px">${c.n}</div>
  <div style="font-size:12px;color:#94a3b8;font-weight:700;text-transform:uppercase">${c.hex}</div></div>`;
}

function dlcard(b: Brand, p: Preset): string {
  return `<div>
    <img class="cardimg" alt="${p.label}" src="${og(b, p.q)}">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;gap:8px">
      <span style="font-weight:800;font-size:14px">${p.label}</span>
      <a class="dl" href="${og(b, p.q, true)}" download>Descargar PNG</a>
    </div>
  </div>`;
}

export default function handler(req: any, res: any) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  const q = String((req.query && req.query.theme) || '').toLowerCase();
  const useMedico = q === 'medico' || (q !== 'mapa' && host.includes('registromedico'));
  const b = useMedico ? MEDICO : MAPA;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Marca | ${b.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,900&family=Source+Sans+3:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box}
  body{margin:0;background:${b.bg};color:${b.ink};font-family:'Source Sans 3',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{max-width:920px;margin:0 auto;padding:48px 20px 80px}
  .bar{height:12px;background:${b.bar};border-radius:999px;width:100%}
  h1{font-family:'Fraunces',serif;font-weight:900;font-size:46px;line-height:1.05;letter-spacing:-1px;margin:24px 0 6px}
  .tag{font-size:20px;font-weight:700;color:${b.sub};margin:0}
  .kh{font-size:13px;letter-spacing:.16em;text-transform:uppercase;font-weight:900;color:${b.accent};margin:0 0 18px}
  section{border-top:1px solid #e2e8f0;padding:40px 0}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
  .grid2{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
  @media(max-width:680px){.grid,.grid2{grid-template-columns:repeat(2,1fr)}}
  .cardimg{width:100%;border-radius:14px;border:1px solid #e2e8f0;display:block;background:#fff}
  code{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:2px 7px;font-size:13px;color:${b.ink};font-family:ui-monospace,monospace;word-break:break-all}
  .btn{display:inline-block;border-radius:999px;background:${b.accent};color:#fff;font-weight:800;padding:13px 28px;font-size:16px;text-decoration:none}
  .btn2{display:inline-block;border-radius:999px;border:1px solid #cbd5e1;color:${b.ink};font-weight:700;padding:12px 26px;font-size:15px;text-decoration:none}
  .dl{font-weight:800;font-size:13px;color:#fff;background:${b.accent};border-radius:999px;padding:7px 14px;text-decoration:none;white-space:nowrap}
  .badge{display:inline-flex;align-items:center;gap:8px;background:${b.badgeBg};border:2px solid ${b.badgeBd};color:${b.badgeInk};border-radius:999px;padding:10px 20px;font-weight:800;font-size:15px}
  .row{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
  .specA{font-family:'Fraunces',serif;font-weight:900;font-size:96px;line-height:.9}
  .ty{font-size:13px;color:#94a3b8;font-weight:700}
  ul{line-height:1.7;color:${b.sub}}
</style>
</head>
<body>
<div class="wrap">
  <div class="bar"></div>
  <h1>${b.name}</h1>
  <p class="tag">${b.tagline}</p>

  <section>
    <p class="kh">Color · tokens</p>
    <div class="grid">${b.colors.map(swatch).join('')}</div>
  </section>

  <section>
    <p class="kh">Tipografía</p>
    <div class="row" style="align-items:flex-end;gap:36px;margin-bottom:24px">
      <div class="specA">Aa</div>
      <div>
        <div style="font-family:'Fraunces',serif;font-weight:900;font-size:30px;letter-spacing:-.5px">Fraunces — display, títulos</div>
        <div class="ty">900 Black · 600 Semibold</div>
        <div style="font-weight:700;font-size:22px;margin-top:14px">Source Sans 3 — cuerpo y UI</div>
        <div class="ty">400 · 600 · 700 · 900</div>
      </div>
    </div>
    <img class="cardimg" alt="Specimen tipográfico" src="${og(b, b.specimen)}">
    <p class="ty" style="margin-top:8px">Specimen en imagen (cómo se ve el título en una tarjeta).</p>
  </section>

  <section>
    <p class="kh">Tarjetas para redes · descargables</p>
    <p style="color:${b.sub};margin:-6px 0 18px">Cada una se genera en vivo. Botón <strong>Descargar PNG</strong> = baja el archivo listo para Instagram / Facebook / WhatsApp.</p>
    <div class="grid2">${b.presets.map((p) => dlcard(b, p)).join('')}</div>
    <p class="kh" style="margin-top:28px">Hazla tuya · parámetros</p>
    <ul>
      <li><code>t</code> título · <code>k</code> kicker · <code>sub</code> subtítulo · <code>badge</code> sello</li>
      <li><code>theme</code> — <code>mapa</code> · <code>medico</code> · <code>caborojo</code> · <code>angel</code></li>
      <li><code>dl=1</code> — fuerza la descarga del PNG</li>
    </ul>
    <p style="margin-top:6px"><code>https://${b.site}/api/og?${b.theme ? 'theme=' + b.theme + '&amp;' : ''}t=Nombre&amp;k=Categor%C3%ADa&amp;badge=Verificado&amp;dl=1</code></p>
  </section>

  <section>
    <p class="kh">Componentes</p>
    <div class="row">
      <a class="btn" href="/">Buscar en el mapa</a>
      <a class="btn2" href="/">Ver categorías</a>
      <span class="badge">✓ Verificado</span>
    </div>
  </section>

  <p style="color:#94a3b8;font-size:13px;margin-top:40px">Página de referencia interna · ${b.site}</p>
</div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(html);
}
