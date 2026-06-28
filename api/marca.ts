// /marca — guía de marca viva. Host-aware: mapadecaborojo.com (teal) y
// registromedicopr.com (medico azul) sirven su propia marca desde un archivo.
// Muestra tokens, tipografía, componentes y previews EN VIVO de las tarjetas
// (img -> /api/og). noindex (referencia interna).

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
  cardTheme: string;
  cardEx: string;
  colors: { n: string; hex: string }[];
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
  cardTheme: '',
  cardEx: '/api/og?t=Tino%27s&k=Comida&badge=Verificado&sub=Cabo%20Rojo%20%C2%B7%20frente%20al%20mar',
  colors: [
    { n: 'Teal (Océano)', hex: '#0d9488' },
    { n: 'Tinta', hex: '#0f172a' },
    { n: 'Tinta suave', hex: '#475569' },
    { n: 'Teal claro', hex: '#5eead4' },
    { n: 'Borde', hex: '#e2e8f0' },
    { n: 'Bandera (rojo)', hex: '#dc2626' },
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
  cardTheme: 'medico',
  cardEx: '/api/og?theme=medico&t=Dra.%20Ana%20Mar%C3%ADa%20Ram%C3%ADrez&k=Cardiolog%C3%ADa&badge=En%20el%20registro',
  colors: [
    { n: 'Azul', hex: '#1d4ed8' },
    { n: 'Tinta', hex: '#0f172a' },
    { n: 'Tinta suave', hex: '#475569' },
    { n: 'Azul claro', hex: '#93c5fd' },
    { n: 'Borde', hex: '#e2e8f0' },
    { n: 'Verde ok', hex: '#16a34a' },
  ],
};

function swatch(c: { n: string; hex: string }): string {
  return `<div><div style="height:96px;border-radius:14px;border:1px solid #e2e8f0;background:${c.hex}"></div>
  <div style="font-weight:800;font-size:14px;margin-top:8px">${c.n}</div>
  <div style="font-size:12px;color:#94a3b8;font-weight:700;text-transform:uppercase">${c.hex}</div></div>`;
}

export default function handler(req: any, res: any) {
  // Marca por host (registromedicopr.com -> medico) con override ?theme=medico|mapa.
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
  @media(max-width:680px){.grid{grid-template-columns:repeat(2,1fr)}}
  .cardimg{width:100%;border-radius:14px;border:1px solid #e2e8f0;display:block}
  code{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:2px 7px;font-size:13px;color:${b.ink};font-family:ui-monospace,monospace;word-break:break-all}
  .btn{display:inline-block;border-radius:999px;background:${b.accent};color:#fff;font-weight:800;padding:13px 28px;font-size:16px;text-decoration:none}
  .btn2{display:inline-block;border-radius:999px;border:1px solid #cbd5e1;color:${b.ink};font-weight:700;padding:12px 26px;font-size:15px;text-decoration:none}
  .badge{display:inline-flex;align-items:center;gap:8px;background:${b.key==='mapa'?'#f0fdfa':'#eff6ff'};border:2px solid ${b.key==='mapa'?'#5eead4':'#93c5fd'};color:${b.key==='mapa'?'#0f766e':'#1e40af'};border-radius:999px;padding:10px 20px;font-weight:800;font-size:15px}
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
    <div class="row" style="align-items:flex-end;gap:36px">
      <div class="specA">Aa</div>
      <div>
        <div style="font-family:'Fraunces',serif;font-weight:900;font-size:30px;letter-spacing:-.5px">Fraunces — display, títulos</div>
        <div class="ty">900 Black · 600 Semibold</div>
        <div style="font-weight:700;font-size:22px;margin-top:14px">Source Sans 3 — cuerpo y UI</div>
        <div class="ty">400 · 600 · 700 · 900</div>
      </div>
    </div>
  </section>

  <section>
    <p class="kh">Componentes</p>
    <div class="row">
      <a class="btn" href="/">Buscar en el mapa</a>
      <a class="btn2" href="/">Ver categorías</a>
      <span class="badge">✓ Verificado</span>
    </div>
  </section>

  <section>
    <p class="kh">Tarjeta OG · en vivo (motor /api/og)</p>
    <img class="cardimg" alt="Tarjeta OG ${b.name}" src="${b.cardEx}">
    <p style="color:${b.sub};margin-top:16px">Esta imagen se genera en vivo desde <code>/api/og</code>. Cada negocio sin foto usa su propia tarjeta automáticamente.</p>
    <p class="kh" style="margin-top:24px">Parámetros</p>
    <ul>
      <li><code>t</code> — título (nombre del negocio)</li>
      <li><code>k</code> — kicker / categoría</li>
      <li><code>sub</code> — subtítulo (opcional)</li>
      <li><code>badge</code> — texto del sello verificado (opcional)</li>
      <li><code>theme</code> — <code>mapa</code> (default) · <code>medico</code> · <code>caborojo</code></li>
    </ul>
    <p style="margin-top:14px"><code>https://${b.site}/api/og?${b.cardTheme ? 'theme=' + b.cardTheme + '&amp;' : ''}t=Nombre&amp;k=Categor%C3%ADa&amp;badge=Verificado</code></p>
  </section>

  <section>
    <p class="kh">El motor sirve 3 marcas</p>
    <div class="grid">
      <img class="cardimg" alt="mapa" src="/api/og?t=Farmacia%20Encarnaci%C3%B3n&k=Farmacia&badge=Verificado">
      <img class="cardimg" alt="medico" src="/api/og?theme=medico&t=Dra.%20Ram%C3%ADrez&k=Cardiolog%C3%ADa&badge=En%20el%20registro">
      <img class="cardimg" alt="caborojo" src="/api/og?theme=caborojo&t=Tino%27s&k=Comida&badge=Verificado">
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
