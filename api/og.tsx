import { ImageResponse } from '@vercel/og';

// Fábrica de tarjetas OG para MapaDeCaboRojo.com / RegistroMedicoPR.com.
// Edge function parametrizada: cada página (negocio, categoría, home) le pasa
// título + kicker + badge y recibe un PNG 1200x630 on-brand. Reemplaza el
// og-default.png estático y los negocios sin foto por una tarjeta verificada.
//
//   /api/og?t=Farmacia%20Encarnación&k=Farmacia&badge=Verificado
//   /api/og?t=...&k=...&sub=...&site=registromedicopr.com&theme=medico
//
// Nota Satori: títulos por palabra para que hagan wrap; div con >1 hijo lleva flex.

export const config = { runtime: 'edge' };

const THEMES = {
  mapa: {
    bg: '#ffffff',
    bar: '#0d9488',
    kicker: '#0d9488',
    title: '#0f172a',
    sub: '#475569',
    badgeBg: '#f0fdfa',
    badgeBorder: '#5eead4',
    badgeInk: '#0f766e',
    titleFont: 'Source Sans 3',
    site: 'MapaDeCaboRojo.com',
    place: 'Cabo Rojo, Puerto Rico',
  },
  medico: {
    bg: '#ffffff',
    bar: '#1d4ed8',
    kicker: '#1d4ed8',
    title: '#0f172a',
    sub: '#475569',
    badgeBg: '#eff6ff',
    badgeBorder: '#93c5fd',
    badgeInk: '#1e40af',
    titleFont: 'Source Sans 3',
    site: 'RegistroMedicoPR.com',
    place: 'Puerto Rico',
  },
  // caborojo.com: teal Océano + coral Salinas sobre lino, título en Fraunces.
  caborojo: {
    bg: '#faf8f5',
    bar: '#1b4b5a',
    kicker: '#d4603a',
    title: '#2c2418',
    sub: '#8a7e6f',
    badgeBg: '#fdf1ec',
    badgeBorder: '#e8b9a6',
    badgeInk: '#b8492a',
    titleFont: 'Fraunces',
    site: 'CaboRojo.com',
    place: 'Cabo Rojo, Puerto Rico',
  },
  // angelanderson.com: rojo AJORÁO + navy sobre papel, título en Fraunces.
  angel: {
    bg: '#fdfaf6',
    bar: '#c23a22',
    kicker: '#c23a22',
    title: '#1a1a1a',
    sub: '#6b6b6b',
    badgeBg: '#fdecea',
    badgeBorder: '#e8a99e',
    badgeInk: '#a83020',
    titleFont: 'Fraunces',
    site: 'AngelAnderson.com',
    place: 'Cabo Rojo, Puerto Rico',
  },
};

const CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzáéíóúüñÁÉÍÓÚÜÑ0123456789.,·-—|()¿?¡!&/°#%+ ';

async function loadFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  const url = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(
    CHARSET
  )}`;
  try {
    const css = await (await fetch(url)).text();
    const m = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/);
    if (!m) return null;
    return await (await fetch(m[1])).arrayBuffer();
  } catch {
    return null;
  }
}

// Título: separa con || en líneas (cada segmento su propia línea); el 2do
// segmento sale en el color de acento del tema. Dentro, las palabras envuelven.
function titleLines(text: string, base: string, accent: string, size: number) {
  const [a, b] = text.split('||');
  const segs = [{ text: a.trim(), color: base }];
  if (b) segs.push({ text: b.trim(), color: accent });
  return segs.map((seg, si) => (
    <div key={si} style={{ display: 'flex', flexWrap: 'wrap', width: '100%' }}>
      {seg.text
        .split(' ')
        .filter(Boolean)
        .map((w, wi) => (
          <span key={wi} style={{ color: seg.color, marginRight: size * 0.24 }}>
            {w}
          </span>
        ))}
    </div>
  ));
}

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const t = (searchParams.get('t') || 'Cabo Rojo, verificado').slice(0, 90);
  const k = (searchParams.get('k') || '').slice(0, 40);
  const subRaw = (searchParams.get('sub') || '').slice(0, 140);
  const badge = (searchParams.get('badge') || '').slice(0, 40);
  const tp = searchParams.get('theme');
  const themeKey =
    tp === 'medico' || tp === 'caborojo' || tp === 'angel' ? tp : 'mapa';
  const th = THEMES[themeKey];
  const download = searchParams.get('dl') === '1';
  const site = searchParams.get('site') || th.site;

  // Señal del Día: demanda real del *7711 (número de bot_real_inbound, limpio).
  const senal = searchParams.get('mode') === 'senal';
  const kw = (searchParams.get('kw') || 'plomero').slice(0, 28);
  const n = Math.max(0, parseInt(searchParams.get('n') || '0', 10) || 0);
  const period = (searchParams.get('p') || 'este mes').slice(0, 24);

  const tlen = t.replace('||', '').trim().length;
  const titleSize = tlen > 42 ? 64 : tlen > 26 ? 78 : 92;

  const needsFraunces = th.titleFont === 'Fraunces' || senal;
  const [w400, w600, w700, w900, fr900] = await Promise.all([
    loadFont('Source+Sans+3', 400),
    loadFont('Source+Sans+3', 600),
    loadFont('Source+Sans+3', 700),
    loadFont('Source+Sans+3', 900),
    needsFraunces ? loadFont('Fraunces', 900) : Promise.resolve(null),
  ]);
  const fonts = [
    { name: 'Source Sans 3', weight: 400 as const, data: w400 },
    { name: 'Source Sans 3', weight: 600 as const, data: w600 },
    { name: 'Source Sans 3', weight: 700 as const, data: w700 },
    { name: 'Source Sans 3', weight: 900 as const, data: w900 },
    { name: 'Fraunces', weight: 900 as const, data: fr900 },
  ]
    .filter((f) => f.data)
    .map((f) => ({ name: f.name, weight: f.weight, data: f.data as ArrayBuffer, style: 'normal' as const }));

  // ---- Señal del Día (demanda real *7711) ----
  if (senal) {
    const KW = kw.toUpperCase();
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#faf8f5', fontFamily: 'Source Sans 3' }}>
          <div style={{ height: 14, width: '100%', background: '#1b4b5a' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '54px 66px' }}>
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#d4603a' }}>
              Señal del día · El Veci *7711
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', width: '100%' }}>
              <span style={{ fontFamily: 'Fraunces', fontWeight: 900, fontSize: 150, lineHeight: 0.9, color: '#1b4b5a', marginRight: 28 }}>{n}</span>
              <span style={{ fontFamily: 'Fraunces', fontWeight: 900, fontSize: 60, lineHeight: 1.05, letterSpacing: -1, color: '#2c2418' }}>
                vecinos buscaron <span style={{ color: '#d4603a' }}>{kw}</span> {period}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 14 }}>
              <div style={{ display: 'flex', background: '#fff', border: '2px solid #e8e2d9', borderRadius: 18, padding: '20px 26px', fontSize: 30, fontWeight: 700, color: '#2c2418' }}>
                {`¿${kw} en Cabo Rojo? Escríbele ${KW} al 787-417-7711`}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 22, fontWeight: 800 }}>
                <span style={{ color: '#1b4b5a' }}>CaboRojo.com</span>
                <span style={{ color: '#8a7e6f' }}>Demanda real, no inventada</span>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        ...(fonts.length ? { fonts } : {}),
        ...(download ? { headers: { 'Content-Disposition': `attachment; filename="senal-${kw}.png"` } } : {}),
      }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: th.bg,
          fontFamily: 'Source Sans 3',
        }}
      >
        <div style={{ height: 12, width: '100%', background: th.bar }} />
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '58px 66px',
          }}
        >
          {k ? (
            <div
              style={{
                display: 'flex',
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: th.kicker,
              }}
            >
              {k}
            </div>
          ) : (
            <div style={{ display: 'flex' }} />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 22 }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                fontFamily: th.titleFont,
                fontWeight: 900,
                fontSize: titleSize,
                lineHeight: 1.05,
                letterSpacing: -2,
              }}
            >
              {titleLines(t, th.title, th.kicker, titleSize)}
            </div>
            {subRaw ? (
              <div
                style={{
                  display: 'flex',
                  width: '100%',
                  fontSize: 30,
                  fontWeight: 400,
                  lineHeight: 1.35,
                  color: th.sub,
                }}
              >
                {subRaw}
              </div>
            ) : null}
            {badge ? (
              <div style={{ display: 'flex' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: th.badgeBg,
                    border: `2px solid ${th.badgeBorder}`,
                    color: th.badgeInk,
                    borderRadius: 999,
                    padding: '12px 26px',
                    fontSize: 26,
                    fontWeight: 700,
                  }}
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 12.5l5 5L20 6"
                      stroke={th.badgeInk}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span style={{ color: th.badgeInk }}>{badge}</span>
                </div>
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: 'flex',
              width: '100%',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            <span style={{ color: th.title }}>{site}</span>
            <span style={{ color: th.sub }}>{th.place}</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      ...(fonts.length ? { fonts } : {}),
      ...(download
        ? { headers: { 'Content-Disposition': `attachment; filename="${themeKey}-tarjeta.png"` } }
        : {}),
    }
  );
}
