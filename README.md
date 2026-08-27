# MapaDeCaboRojo · RegistroMedicoPR · PuertoRicoSinFiltros

**Un solo motor, tres propiedades.** Este repo sirve tres sitios desde el mismo deployment de Vercel (detección por host):

| Sitio | Qué es |
|---|---|
| [mapadecaborojo.com](https://www.mapadecaborojo.com) | Mapa + directorio de Cabo Rojo (1,173 negocios en CR, 35,621 fichas publicadas en PR) con El Veci detrás |
| [registromedicopr.com](https://registromedicopr.com) | Registro de especialistas médicos de PR pareado contra NPPES: 30,622 fichas con NPI federal, 32 especialidades × 5 regiones × 78 pueblos, desiertos médicos, guías por situación, bilingüe ES/EN |
| [puertoricosinfiltros.com](https://puertoricosinfiltros.com) | Récords cívicos con data verificable: el número, la fuente, y qué hacer con él |

**El Veci** — textea al **787-417-7711** (SMS o [WhatsApp](https://wa.me/17874177711)) y te contesta 24/7. Guárdalo: [/veci](https://www.mapadecaborojo.com/veci).

---

## Los récords (PRSF)

Cada récord junta data pública verificable + data propia del substrato, y cierra con acción (no solo muestra el problema): `/prediccion` · `/costo-de-vida` · `/rendimiento` · `/cupon` · `/exposicion-ai` · `/decidir` · `/trabajo` · `/luz` · `/agua` · `/basura` · `/recuperacion` · `/sigue-el-dinero` · `/registro/estado` · `/diabetes` · `/telemedicina` · `/esencia` y más. Índice: [puertoricosinfiltros.com](https://puertoricosinfiltros.com).

## El registro médico (RegistroMedicoPR)

"El único registro de especialistas médicos de PR verificado contra el gobierno federal (NPPES) que un humano normal puede leer." Superficies:

- **[/registro](https://registromedicopr.com/registro)** — buscador por nombre, especialidad, región, **síntoma** ("me falta el aire" → neumólogo, con guard de 911) y **plan médico** (✓ solo si la oficina lo confirmó; sin ✓ = "llama y pregunta", nunca oculta a nadie)
- **[/pueblo](https://registromedicopr.com/pueblo)** — semáforo de acceso de los 78 municipios (🔴<5 · 🟡5-15 · 🟢15+ especialistas/10k hab, vista canónica `v_registro_muni_ratio`) + página por pueblo: qué hay, qué falta y dónde queda lo más cerca, badge HPSA federal, **datos citables copy-paste con fuente**, y alerta "🔔 te aviso cuando llegue uno nuevo" (tabla `registro_alerts`, cron diario `api/cron?job=alertas` cierra el loop por email)
- **[/necesito](https://registromedicopr.com/necesito)** — 5 guías por intención (cita rápido · sin plan · cuido a mis padres desde afuera · acabo de llegar · no hay en mi pueblo), traducidas completas pa' la diáspora (`?lang=en`)
- **[/especialista/:slug](https://registromedicopr.com/registro)** — 6,300+ páginas: NPI verificable, planes confirmados, checklist "antes de llamar", botón "enviárselo por WhatsApp a mami o papi", claim form (crowdsource de `accepted_plans`)
- **[/registro/desiertos](https://registromedicopr.com/registro/desiertos)** · [/registro/mapa](https://registromedicopr.com/registro/mapa) · [/registro/estado](https://registromedicopr.com/registro/estado) · [/observatorio](https://registromedicopr.com/observatorio) — la capa cívica (ausencia documentada, HPSA, podcast + reporte)

Regla de data: todo per cápita sale de las vistas canónicas (`v_registro_muni_ratio` / `v_registro_muni_spec`), nunca de `places.region` crudo.

## El motor SEO que se auto-repara (fabrica-seo)

Cada noche (4:45am AT) la edge function `fabrica-seo` (repo Vecinoai) lee Search Console, encuentra páginas "borde de página 1" (posición 3-15, impresiones reales, CTR flojo) y escribe título/meta mejorados a `places.seo_title/seo_description` (máx. 3/noche). Cada cambio es un **experimento** en `seo_experiments` con baseline; a los 14 días el motor re-mide el CTR contra GSC y decide solo: se queda (`kept`) o **revierte automáticamente** (`reverted`). Recibo diario en `nightly_receipts` (routine `fabrica-seo`). Las páginas `/negocio` y `/farmacia` respetan los overrides; sin override usan la fórmula CTR (`Nombre en Pueblo · Teléfono, Horario y Dirección`) + FAQPage JSON-LD + badge "Abierto ahora" calculado en tiempo real (AST).

## El motor de demanda

Demanda real medida por dos canales independientes y triangulada:

- **Texteo** (log crudo del *7711 — alta intención, "lo necesito ahora")
- **Búsqueda** (Google Search Console — alcance amplio, "lo estoy averiguando")

Vistas en Supabase: `v_demanda_oeste` (message-level, PII, **acceso solo service-role**), `v_demanda_gsc`, `v_demanda_triangulada`, `v_demanda_vs_oferta_oeste` (cruce con oferta verificada = pitch fuel). Récord público: [/demanda](https://www.mapadecaborojo.com/demanda).

## Palabras mágicas del Veci

`ALERTA` (avisos de emergencia/agua por pueblo) · `CUPON` (crédito por hijos sin cobrar) · `COSTO` (pulso del costo de vida) · `MEDICO` (récord de médicos + $75k federal) · `MANUAL` · `RECALL <med>` · o simplemente lo que necesites ("plomero en Combate").

## Para dueños de negocio

Aparecer en el directorio verificado es **gratis** — [ponte en el mapa](https://wa.me/17874177711?text=Quiero%20mi%20negocio%20en%20el%20mapa). Destacarte tiene precio claro: [La Vitrina — $799/año](https://caborojo.com/patrocina).

---

## Stack

React + TypeScript + Vite (frontend del mapa) · Vercel serverless (14 fns, páginas SSR con cache CDN) · Supabase (Postgres + RLS + vistas + pg_cron) · Twilio SMS/WhatsApp (firma fail-closed) · OpenAI embeddings (768d).

**Seguridad:** RLS activo en tablas públicas; vistas con PII sin grants para anon/authenticated; webhook Twilio valida firma; llaves server-side sin prefijos públicos. Último lockdown: 2026-07-07.

**Deploy:** push a `main` → Vercel auto-deploy. El bot vive en el repo Vecinoai (edge functions de Supabase, 1,140 tests).

---

## El marcador honesto

Corrido contra la base el **2026-08-27**. Se re-corre, no se cita de memoria.

```sql
select count(*) filter (where visibility='published') as publicadas,
       count(*) filter (where visibility='published' and npi is not null) as con_npi_federal,
       count(*) filter (where visibility='published' and verification_source is not null
         and verification_source !~* '(nppes|sulme|google_places|merge)') as confirmadas_por_persona
from places;
```

| | |
|---|---|
| Fichas publicadas | **35,621** |
| Municipios cubiertos | **78** |
| Pareadas al registro federal NPPES | **30,622** |
| **Confirmadas por una persona** | **292** (0.8%) |
| Señales de demanda humana, 90 días | 676, de 374 personas |

**Importado no es verificado.** Una ficha copiada de NPPES es la misma que ya tiene el plan médico: no hereda nada y no se vende como chequeo. Por eso el sello tiene 3 niveles y no 1, y por eso el nivel más alto solo lo escribe una persona. Ese 0.8% es la deuda, y es el trabajo.

Si un directorio no te enseña esta proporción, también la tiene.

## Las 5 reglas de la data

Cada una costó un incidente real:

1. **Importado no es verificado.** El reclamo se parte por `verification_source` o no se hace.
2. **La exclusión de sintéticos se define por la FUENTE del tráfico, nunca por el canal.** Todo canal nuevo llega sin filtro por defecto.
3. **Un cero no es evidencia.** Una sección sin instrumentar reporta "no medido", no "cero".
4. **El sello dice quién confirmó** (`procedenciaSello()`, `api/_lib/procedencia.ts`): persona, fuente corroborada, o copia de registro que no reclama nada.
5. **Un dato interno también se vence.** Todo número lleva la fecha en que se verificó, incluidos los de este archivo.

## Dónde termina el sistema

Nombrado a propósito, porque son las costuras:

- **La llamada.** De 157 teléfonos medidos con Twilio Lookup, solo 39.5% son móviles. Al resto no le llega un texto, y confirmar "¿todavía toman ese plan?" termina en una persona marcando una recepción en horario de oficina.
- **El claim form que nadie llena.** Es el camino más barato a una ficha confirmada y el más lento en la práctica.
- **La ausencia.** Probar que un pueblo NO tiene cardiólogo cuesta más que listar los que hay, y es el dato que de verdad cambia lo que una familia hace después.

---

¿Redacción, plan médico o municipio que necesita esta data con chequeo verificable? Escribe a **angel@angelanderson.com** y dime qué estás tratando de probar.

Hecho en Cabo Rojo por [Angel Anderson](https://angelanderson.com) — una persona, con AI. *Menos revolú, más sistema, mejor vida.*
