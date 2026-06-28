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
    site: 'RegistroMedicoPR.com',
    place: 'Puerto Rico',
  },
};

const CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzáéíóúüñÁÉÍÓÚÜÑ0123456789.,·-—|()¿?¡!&/°#%+ ';

async function loadFont(weight: number): Promise<ArrayBuffer | null> {
  const url = `https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@${weight}&text=${encodeURIComponent(
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

function words(text: string, color: string, size: number) {
  return text.split(' ').map((w, i) => (
    <span key={i} style={{ color, marginRight: size * 0.24 }}>
      {w}
    </span>
  ));
}

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const t = (searchParams.get('t') || 'Cabo Rojo, verificado').slice(0, 90);
  const k = (searchParams.get('k') || '').slice(0, 40);
  const subRaw = (searchParams.get('sub') || '').slice(0, 140);
  const badge = (searchParams.get('badge') || '').slice(0, 40);
  const themeKey = searchParams.get('theme') === 'medico' ? 'medico' : 'mapa';
  const th = THEMES[themeKey];
  const site = searchParams.get('site') || th.site;

  const titleSize = t.length > 42 ? 64 : t.length > 26 ? 78 : 92;

  const [w400, w600, w700, w900] = await Promise.all([
    loadFont(400),
    loadFont(600),
    loadFont(700),
    loadFont(900),
  ]);
  const fonts = [
    { weight: 400 as const, data: w400 },
    { weight: 600 as const, data: w600 },
    { weight: 700 as const, data: w700 },
    { weight: 900 as const, data: w900 },
  ]
    .filter((f) => f.data)
    .map((f) => ({ name: 'Source Sans 3', weight: f.weight, data: f.data as ArrayBuffer, style: 'normal' as const }));

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
                flexWrap: 'wrap',
                width: '100%',
                fontWeight: 900,
                fontSize: titleSize,
                lineHeight: 1.05,
                letterSpacing: -2,
              }}
            >
              {words(t, th.title, titleSize)}
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
    }
  );
}
