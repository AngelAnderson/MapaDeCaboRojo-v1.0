# Replicar el Observatorio a otro pueblo

El motor de accountability (Promesómetro + /promesas + /civico.json) es **town-agnostic**:
las funciones de render (`renderPromesometroRows`, `renderPromesasByTopic`, `civicCounts`,
`handleCivicoJson`) toman un `Promesa[]`. Un pueblo nuevo NO es código nuevo — es un array nuevo.

## La data ya está desacoplada

En `api/mapa-pages.ts`:
- `type Promesa` — el shape de cada promesa.
- `PROMESAS_CABOROJO: Promesa[]` — la data de Cabo Rojo (38 entradas).
- Render: `renderPromesometroRows(promesas)` (featured → observatorio), `renderPromesasByTopic(promesas)` (todas → /promesas), `civicCounts(promesas)`.

## Añadir un pueblo (4 pasos)

1. **Minar.** Correr el pipeline de captura sobre las entrevistas del alcalde del pueblo nuevo:
   `Claude/scripts/cerebro/ingest-civico.py` (pull de Castmagic) → pozo `civico` →
   extracción de promesas (un agente por grabación, schema topic/text/quien/src/status).
   Resultado: un array `PROMESAS_<PUEBLO>: Promesa[]`.

2. **Verificar.** Cruzar cada status contra el presupuesto municipal del pueblo (Drive/Contralor),
   FEMA, y prensa. Marcar HECHO / EMPEZO / NO / ESPERANDO con `detail` + `src` (link al video o fuente).
   Regla: sin fuente verificable → ESPERANDO. Récord, no acusación.

3. **Registrar.** Pegar el array en `mapa-pages.ts` y parametrizar (cuando haya 2+ pueblos,
   mover a `CIVIC_TOWNS[slug] = { municipio, alcalde, promesas }` y que los handlers tomen `?town=slug`).

4. **Rutear.** Añadir a `vercel.json`:
   `/<pueblo>/observatorio`, `/<pueblo>/promesas`, `/<pueblo>/civico.json` → `mapa-pages?page=...&town=slug`.
   Más la fila en `api/sitemap.ts`.

## Tiempo estimado por pueblo
- Captura + minería: depende de horas de video disponibles (Cabo Rojo: ~8h → 38 promesas).
- Verificación: ~1-2h por pueblo (presupuesto + FEMA + prensa).
- Wiring: ~15 min (es config, no código).

## Gate
NO publicar un pueblo nuevo sin: (a) data verificada row-by-row, (b) fecha de cada grabación,
(c) revisión legal/adversarial (nombra funcionarios vivos). Aplica la regla "3 Pagos / validar antes de construir":
el pueblo #2 se hace cuando haya señal real de demanda, no especulativamente.

## Por qué esto es el moat
Cada pueblo replicado usa las MISMAS funciones de render y el MISMO endpoint JSON.
La data verificada (imposible de fabricar sin las horas de captura) es lo único que cambia.
Eso es el substrato cívico de PR: un motor, N pueblos, data ground-verified que nadie más tiene.
