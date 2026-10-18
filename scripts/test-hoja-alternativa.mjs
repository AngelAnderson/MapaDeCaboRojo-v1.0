// Prueba (18 oct 2026, revision externa): "otra opcion" en el Registro solo manda a la lista de
// la MISMA especialidad y MISMO pueblo; si no la hay, dice que no hay alternativa verificada.
// Caso real 12 oct: /registro/generalista/lajas -> hub -> trabajador social en Manati.
// Uso: node scripts/test-hoja-alternativa.mjs
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'
const src = transformSync(readFileSync('api/_lib/hoja-llamada.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code
const m = { exports: {} }; vm.runInNewContext(src, { module: m, exports: m.exports })
const js = m.exports.hojaLlamadaScript('registro')
let ok = 0, fail = 0
const t = (n, c) => { c ? ok++ : (fail++, console.error('FALLA', n)) }
const mk = (path, link) => { const ctx = { location: { pathname: path }, document: { querySelector: () => link ? { getAttribute: () => link } : null } }
  const fn = /function LA\(\).*?(?=function P\()/s.exec(js); vm.runInNewContext(fn[0] + ';result=LA()', ctx); return ctx.result }
t('lista: se devuelve a si misma', mk('/registro/generalista/lajas') === '/registro/generalista/lajas')
t('ficha con enlace de su lista', mk('/especialista/x-lajas-1', '/registro/generalista/lajas') === '/registro/generalista/lajas')
t('ficha sin enlace: vacio, nunca el hub', mk('/especialista/x-lajas-1') === '')
t('hub no cuenta como lista', mk('/registro') === '')
t('enlace ajeno (otro prefijo) se rechaza', mk('/especialista/x', '/negocio/abc') === '')
t('enlace con 4 segmentos se rechaza', mk('/especialista/x', '/registro/a/b/c') === '')
t('ya no manda al hub general', !js.includes("'Busca otra opción en <a href=\"/registro\""))
t('sin lista dice que no hay alternativa verificada', js.includes('no tenemos una alternativa verificada'))
console.log(`${ok} pasaron, ${fail} fallaron`); process.exit(fail ? 1 : 0)
