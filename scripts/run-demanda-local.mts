// Render local de /demanda con data real (verificación pre-merge de LA SEÑAL).
// Uso: SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/run-demanda-local.mts
import handler from '../api/mapa-pages.js'
import { writeFileSync } from 'fs'

const req: any = { query: { page: 'demanda' }, headers: { 'user-agent': 'la-senal-local-check' }, method: 'GET' }
const res: any = {
  headers: {} as Record<string, string>,
  statusCode: 0,
  setHeader(k: string, v: string) { this.headers[k] = v },
  redirect(code: number, url: string) { console.log('REDIRECT', code, url); process.exit(2) },
  status(c: number) { this.statusCode = c; return this },
  send(html: string) {
    writeFileSync('/tmp/demanda-local.html', html)
    console.log('STATUS', this.statusCode, 'BYTES', html.length)
    process.exit(this.statusCode === 200 ? 0 : 1)
  },
  json(o: any) { console.log('JSON', JSON.stringify(o).slice(0, 300)); process.exit(1) },
}
await handler(req, res)
