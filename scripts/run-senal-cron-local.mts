// Corrida local del latido de LA SEÑAL (job=demanda): agrega, mide y escribe
// su recibo real a nightly_receipts. Idempotente por run_date.
// Uso: SUPABASE_SERVICE_ROLE_KEY=... CRON_SECRET=x npx tsx scripts/run-senal-cron-local.mts
import handler from '../api/cron.js'

process.env.CRON_SECRET = process.env.CRON_SECRET || 'local-check'
const req: any = { query: { job: 'demanda' }, headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }
const res: any = {
  statusCode: 0,
  status(c: number) { this.statusCode = c; return this },
  json(o: any) { console.log('STATUS', this.statusCode, JSON.stringify(o)); process.exit(this.statusCode === 200 ? 0 : 1) },
}
await handler(req, res)
