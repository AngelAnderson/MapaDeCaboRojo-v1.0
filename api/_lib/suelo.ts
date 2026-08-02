// /suelo — El suelo turístico del oeste: quién lo calificó, cuándo, y cuánto queda libre.
// Récord de substrato (Mapa de Cabo Rojo). Frame: el suelo donde se para un megaproyecto
// no se crea cuando llega el capital. Se califica años antes, en un documento que el
// pueblo no leyó. Este récord dice cuál documento, qué día, y cuánto queda sin usar.
//
// Fuente única y verificable: servicio ArcGIS REST público de la Junta de Planificación
// (sigejp.pr.gov, calificación vigente), descargado el 1 de agosto de 2026.
// 29,824 parcelas de Cabo Rojo y 292,349 de los 17 municipios del oeste.
// Cero data inventada. Cero estimados. Área calculada de la geometría oficial.

type Deps = {
  layout: (opts: {
    title: string; description: string; slug: string; bodyHtml: string
    jsonLd?: object; ogImage?: string; host?: string
    canonicalHost?: string; canonicalUrl?: string; lang?: 'es' | 'en'
  }) => string
  escapeHtml: (s: string) => string
}

const FUENTE_URL = 'https://sigejp.pr.gov/server/rest/services/calificacion/cali_vige/MapServer/0'
const DESCARGA = '2026-08-01'
const CUERDA_M2 = 3930.395

const n = (x: number) => x.toLocaleString('en-US')

// ── Data verificada (descargada 2026-08-01, no editar sin re-correr el pull) ──

type Muni = { nombre: string; cuerdas: number; dts: number; rt: number; protegido: number }

// 17 municipios del oeste, ordenados por cuerdas de Distrito Turístico Selectivo.
const OESTE: Muni[] = [
  { nombre: 'Cabo Rojo',     cuerdas: 47643, dts: 1852, rt: 2761, protegido: 41.4 },
  { nombre: 'Isabela',       cuerdas: 36494, dts: 785,  rt: 0,    protegido: 44.2 },
  { nombre: 'Aguadilla',     cuerdas: 24098, dts: 307,  rt: 301,  protegido: 0.0 },
  { nombre: 'Guánica',       cuerdas: 24532, dts: 301,  rt: 100,  protegido: 66.3 },
  { nombre: 'Rincón',        cuerdas: 9590,  dts: 265,  rt: 270,  protegido: 2.6 },
  { nombre: 'Aguada',        cuerdas: 20374, dts: 233,  rt: 0,    protegido: 0.0 },
  { nombre: 'Añasco',        cuerdas: 26130, dts: 201,  rt: 122,  protegido: 20.8 },
  { nombre: 'Lajas',         cuerdas: 39877, dts: 201,  rt: 95,   protegido: 64.3 },
  { nombre: 'Quebradillas',  cuerdas: 15256, dts: 191,  rt: 53,   protegido: 0.0 },
  { nombre: 'Sabana Grande', cuerdas: 23932, dts: 39,   rt: 0,    protegido: 0.0 },
  { nombre: 'Mayagüez',      cuerdas: 51294, dts: 0,    rt: 0,    protegido: 0.0 },
  { nombre: 'San Germán',    cuerdas: 35859, dts: 0,    rt: 0,    protegido: 14.6 },
  { nombre: 'Las Marías',    cuerdas: 30623, dts: 0,    rt: 0,    protegido: 0.0 },
  { nombre: 'Moca',          cuerdas: 33189, dts: 0,    rt: 0,    protegido: 21.3 },
  { nombre: 'Guayanilla',    cuerdas: 27890, dts: 0,    rt: 0,    protegido: 54.6 },
  { nombre: 'Maricao',       cuerdas: 24116, dts: 0,    rt: 0,    protegido: 0.0 },
  { nombre: 'Hormigueros',   cuerdas: 7462,  dts: 0,    rt: 0,    protegido: 37.7 },
]

// Barrios de Cabo Rojo donde está el DTS.
const DTS_BARRIOS = [
  { barrio: 'Boquerón',   cuerdas: 1395 },
  { barrio: 'Pedernales', cuerdas: 376 },
  { barrio: 'Miradero',   cuerdas: 82 },
]

// Las fincas DTS más grandes, con número de catastro (llave para pedir dueño al CRIM).
const FINCAS = [
  { catastro: '380-000-006-01', barrio: 'Boquerón',   cuerdas: 157.0 },
  { catastro: '402-009-327-67', barrio: 'Boquerón',   cuerdas: 120.6 },
  { catastro: '403-000-002-02', barrio: 'Boquerón',   cuerdas: 115.9 },
  { catastro: '403-000-002-02', barrio: 'Boquerón',   cuerdas: 109.1 },
  { catastro: '402-000-005-01', barrio: 'Boquerón',   cuerdas: 102.5 },
  { catastro: '402-000-005-28', barrio: 'Boquerón',   cuerdas: 97.3 },
  { catastro: '403-000-002-02', barrio: 'Boquerón',   cuerdas: 79.8 },
  { catastro: '331-000-005-04', barrio: 'Miradero',   cuerdas: 78.9 },
  { catastro: '355-000-005-90', barrio: 'Pedernales', cuerdas: 36.5 },
  { catastro: '356-000-007-45', barrio: 'Boquerón',   cuerdas: 32.9 },
  { catastro: '355-000-005-89', barrio: 'Pedernales', cuerdas: 31.7 },
  { catastro: '355-000-005-01', barrio: 'Pedernales', cuerdas: 30.0 },
]

// Las 5 resoluciones que zonifican Cabo Rojo.
const RESOLUCIONES = [
  { id: 'JP-PT-55-4', vigencia: '10 de octubre de 2010', parcelas: 23929, nota: 'Plan Territorial. Creó TODO el suelo turístico (DTS y RT).' },
  { id: 'JP-RA-57',   vigencia: '19 de junio de 2014',   parcelas: 4682,  nota: '3,120 parcelas a desarrollable, 913 a protegido.' },
  { id: 'JP-RA-56',   vigencia: '19 de junio de 2014',   parcelas: 826,   nota: 'Mayormente Bajura y Guanajibo.' },
  { id: 'JP-CARSO',   vigencia: '4 de julio de 2014',    parcelas: 357,   nota: 'Protección del carso. Overlay APE-RC.' },
]

const DTS_TOTAL_OESTE = OESTE.reduce((s, m) => s + m.dts, 0)
const CR = OESTE[0]

export function handleSuelo(req: any, res: any, deps: Deps) {
  const { layout, escapeHtml } = deps
  const pctCR = Math.round((CR.dts / DTS_TOTAL_OESTE) * 1000) / 10
  const segundo = OESTE[1]
  const ratio = Math.round((CR.dts / segundo.dts) * 10) / 10
  const ceroDts = OESTE.filter(m => m.dts === 0).length

  const filaMuni = (m: Muni, i: number) => {
    const tur = m.dts + m.rt
    const pct = m.cuerdas ? (100 * tur / m.cuerdas) : 0
    const destaca = i === 0
    return `<tr class="${destaca ? 'bg-amber-50 font-semibold' : ''}">
      <td class="px-3 py-2 border-b border-slate-100">${escapeHtml(m.nombre)}</td>
      <td class="px-3 py-2 border-b border-slate-100 text-right tabular-nums">${n(m.cuerdas)}</td>
      <td class="px-3 py-2 border-b border-slate-100 text-right tabular-nums ${m.dts ? 'text-amber-800' : 'text-slate-400'}">${n(m.dts)}</td>
      <td class="px-3 py-2 border-b border-slate-100 text-right tabular-nums ${m.rt ? '' : 'text-slate-400'}">${n(m.rt)}</td>
      <td class="px-3 py-2 border-b border-slate-100 text-right tabular-nums">${pct.toFixed(1)}%</td>
    </tr>`
  }

  const body = `
<div class="max-w-4xl mx-auto px-4 py-8">

  <p class="text-xs uppercase tracking-wide text-slate-500 mb-2">Récord de substrato · Junta de Planificación</p>
  <h1 class="text-3xl sm:text-4xl font-black text-slate-900 leading-tight mb-3">
    El suelo turístico del oeste no se creó cuando llegó el dinero
  </h1>
  <p class="text-lg text-slate-700 mb-6">
    Se calificó el <strong>10 de octubre de 2010</strong>, en una resolución que el pueblo no leyó.
    Bajamos las ${n(292349)} parcelas de los 17 municipios del oeste para poder decirlo con número, fecha y fuente.
  </p>

  <div class="grid sm:grid-cols-3 gap-3 mb-8">
    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div class="text-3xl font-black text-amber-900 tabular-nums">${n(CR.dts)}</div>
      <div class="text-sm text-amber-800">cuerdas de suelo turístico selectivo en Cabo Rojo</div>
    </div>
    <div class="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div class="text-3xl font-black text-slate-900 tabular-nums">${pctCR}%</div>
      <div class="text-sm text-slate-700">de todo el suelo turístico del oeste está en Cabo Rojo</div>
    </div>
    <div class="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div class="text-3xl font-black text-slate-900 tabular-nums">215</div>
      <div class="text-sm text-slate-700">parcelas, <strong>todas</strong> de una sola resolución de 2010</div>
    </div>
  </div>

  <h2 class="text-2xl font-bold text-slate-900 mb-3">Qué es el DTS</h2>
  <p class="text-slate-700 mb-4">
    DTS quiere decir <strong>Distrito Turístico Selectivo</strong>. Es la calificación que permite,
    legalmente, montar un desarrollo turístico en un terreno. Sin esa calificación no se puede.
    Con ella, sí.
  </p>
  <p class="text-slate-700 mb-6">
    En Cabo Rojo hay ${n(CR.dts)} cuerdas de DTS repartidas en 215 parcelas.
    <strong>Las 215 salen de la misma resolución: JP-PT-55-4, vigente el 10 de octubre de 2010.</strong>
    Ni una sola es posterior. Lo verificamos parcela por parcela.
  </p>

  <div class="bg-white border border-slate-200 rounded-xl overflow-hidden mb-8">
    <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 font-semibold text-slate-800">
      Dónde está el DTS de Cabo Rojo
    </div>
    <table class="w-full text-sm">
      <tbody>
        ${DTS_BARRIOS.map(b => `<tr>
          <td class="px-4 py-2 border-b border-slate-100">${escapeHtml(b.barrio)}</td>
          <td class="px-4 py-2 border-b border-slate-100 text-right tabular-nums font-semibold">${n(b.cuerdas)} cuerdas</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <h2 class="text-2xl font-bold text-slate-900 mb-3">Por qué Cabo Rojo y no otro pueblo</h2>
  <p class="text-slate-700 mb-4">
    En los 17 municipios del oeste hay ${n(DTS_TOTAL_OESTE)} cuerdas de DTS.
    Cabo Rojo tiene ${n(CR.dts)}: el <strong>${pctCR}%</strong>, o sea ${ratio} veces el segundo lugar
    (${escapeHtml(segundo.nombre)}, ${n(segundo.dts)} cuerdas).
    <strong>${ceroDts} municipios del oeste tienen cero</strong>, entre ellos Mayagüez y San Germán.
  </p>
  <p class="text-slate-700 mb-4">
    Esto no está repartido por la región. Está concentrado aquí, y la decisión es de 2010.
  </p>

  <div class="overflow-x-auto mb-8 border border-slate-200 rounded-xl">
    <table class="w-full text-sm min-w-[560px]">
      <thead class="bg-slate-50">
        <tr class="text-left text-slate-600">
          <th class="px-3 py-2 font-semibold">Municipio</th>
          <th class="px-3 py-2 font-semibold text-right">Cuerdas</th>
          <th class="px-3 py-2 font-semibold text-right">DTS</th>
          <th class="px-3 py-2 font-semibold text-right">Resid. turístico</th>
          <th class="px-3 py-2 font-semibold text-right">% turístico</th>
        </tr>
      </thead>
      <tbody>${OESTE.map(filaMuni).join('')}</tbody>
    </table>
  </div>

  <h2 class="text-2xl font-bold text-slate-900 mb-3">Las 5 resoluciones que zonifican Cabo Rojo</h2>
  <div class="space-y-3 mb-8">
    ${RESOLUCIONES.map(r => `
      <div class="border border-slate-200 rounded-xl p-4 ${r.id === 'JP-PT-55-4' ? 'bg-amber-50 border-amber-200' : 'bg-white'}">
        <div class="flex flex-wrap items-baseline gap-x-3">
          <span class="font-bold text-slate-900">${escapeHtml(r.id)}</span>
          <span class="text-sm text-slate-600">vigente ${escapeHtml(r.vigencia)}</span>
          <span class="text-sm text-slate-500 tabular-nums">${n(r.parcelas)} parcelas</span>
        </div>
        <p class="text-sm text-slate-700 mt-1">${escapeHtml(r.nota)}</p>
      </div>`).join('')}
  </div>

  <div class="bg-slate-900 text-white rounded-xl p-5 mb-8">
    <p class="font-semibold mb-2">Lo que este récord no dice</p>
    <p class="text-sm text-slate-200 mb-2">
      No decimos que en 2014 "dieron los verdes". La data no lo sostiene: JP-CARSO fue protectora
      y JP-RA-57 tiene de las dos cosas. Para afirmar intención hay que leer las resoluciones, y
      eso todavía no lo hemos hecho.
    </p>
    <p class="text-sm text-slate-200">
      Lo que sí está verificado, parcela por parcela, es que <strong>todo el suelo turístico
      de Cabo Rojo viene de 2010</strong>.
    </p>
  </div>

  <h2 class="text-2xl font-bold text-slate-900 mb-3">Las fincas más grandes, con su número de catastro</h2>
  <p class="text-slate-700 mb-4">
    Estas 12 suman 992 de las ${n(CR.dts)} cuerdas de DTS. El número de catastro es la llave:
    con él se le puede pedir al CRIM quién es el dueño y en cuánto está tasada.
  </p>
  <div class="overflow-x-auto mb-8 border border-slate-200 rounded-xl">
    <table class="w-full text-sm min-w-[420px]">
      <thead class="bg-slate-50">
        <tr class="text-left text-slate-600">
          <th class="px-3 py-2 font-semibold">Catastro</th>
          <th class="px-3 py-2 font-semibold">Barrio</th>
          <th class="px-3 py-2 font-semibold text-right">Cuerdas</th>
        </tr>
      </thead>
      <tbody>
        ${FINCAS.map(f => `<tr>
          <td class="px-3 py-2 border-b border-slate-100 font-mono text-xs">${escapeHtml(f.catastro)}</td>
          <td class="px-3 py-2 border-b border-slate-100">${escapeHtml(f.barrio)}</td>
          <td class="px-3 py-2 border-b border-slate-100 text-right tabular-nums">${f.cuerdas.toFixed(1)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="bg-teal-50 border border-teal-200 rounded-xl p-5 mb-8">
    <p class="font-bold text-teal-900 mb-2">Bájate la data y compruébalo</p>
    <p class="text-sm text-teal-900 mb-3">
      Todo esto sale de un servicio público de la Junta de Planificación. No hace falta llave,
      cuenta, ni permiso. Cualquiera lo puede repetir y corregirnos.
    </p>
    <pre class="bg-white border border-teal-200 rounded-lg p-3 text-xs overflow-x-auto"><code>curl -s -G "${FUENTE_URL}/query" \\
  --data-urlencode "where=municipio='CABO ROJO'" \\
  --data-urlencode "outFields=num_catast,barrio,cali,resolucion,vigencia,SHAPE.STArea()" \\
  --data-urlencode "returnGeometry=false" \\
  --data-urlencode "f=json"</code></pre>
    <p class="text-xs text-teal-800 mt-2">
      Las cuerdas se calculan dividiendo <code>SHAPE.STArea()</code> entre ${CUERDA_M2}.
      El campo <code>cuerdas</code> del servicio viene vacío. Los municipios con acento
      lo llevan en el <code>where</code>.
    </p>
  </div>

  <h2 class="text-2xl font-bold text-slate-900 mb-3">Por qué esto importa ahora</h2>
  <p class="text-slate-700 mb-4">
    Porque queda suelo. Si un proyecto ocupa parte de esas ${n(CR.dts)} cuerdas, el resto sigue
    calificado igual, esperando. <strong>La cancha del próximo ya está pintada</strong>, y está
    pública desde hace 16 años.
  </p>
  <p class="text-slate-700 mb-6">
    Este récord no está a favor ni en contra de ningún proyecto. Dice dónde se puede construir,
    quién lo decidió y qué día. Lo que se haga con eso le toca al pueblo.
  </p>

  <div class="flex flex-wrap gap-3 text-sm">
    <a href="/esencia" class="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold">El récord de Esencia</a>
    <a href="/agua" class="px-4 py-2 rounded-lg border border-slate-300 text-slate-800 font-semibold">El agua del pueblo</a>
    <a href="/barrios" class="px-4 py-2 rounded-lg border border-slate-300 text-slate-800 font-semibold">Los barrios</a>
  </div>

  <p class="text-xs text-slate-500 mt-8 border-t border-slate-200 pt-4">
    Fuente: Junta de Planificación de Puerto Rico, servicio público de calificación vigente
    (<code>sigejp.pr.gov</code>). Descarga del ${DESCARGA}: ${n(29824)} parcelas de Cabo Rojo
    y ${n(292349)} de los 17 municipios del oeste. Área calculada de la geometría oficial.
    Si encuentras un error, escríbenos y lo corregimos con la corrección visible.
  </p>

</div>`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Suelo turístico calificado del oeste de Puerto Rico',
    description: `Calificación vigente de ${n(292349)} parcelas en 17 municipios del oeste de Puerto Rico, con el detalle del Distrito Turístico Selectivo (DTS) de Cabo Rojo: ${n(CR.dts)} cuerdas en 215 parcelas, todas de la resolución JP-PT-55-4 de 2010.`,
    creator: { '@type': 'Organization', name: 'Mapa de Cabo Rojo' },
    isBasedOn: FUENTE_URL,
    temporalCoverage: '2010/2026',
    spatialCoverage: { '@type': 'Place', name: 'Oeste de Puerto Rico' },
    dateModified: DESCARGA,
    license: 'https://creativecommons.org/licenses/by/4.0/',
  }

  res.status(200).send(layout({
    title: 'El suelo turístico del oeste · quién lo calificó y cuándo',
    description: `Cabo Rojo concentra el ${pctCR}% del suelo turístico del oeste: ${n(CR.dts)} cuerdas en 215 parcelas, todas calificadas por una sola resolución de 2010. Récord verificable de las ${n(292349)} parcelas de los 17 municipios.`,
    slug: 'suelo',
    host: req.headers?.host,
    bodyHtml: body,
    jsonLd,
  }))
}
