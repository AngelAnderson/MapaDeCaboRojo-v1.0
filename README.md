# MapaDeCaboRojo · RegistroMedicoPR · PuertoRicoSinFiltros

**Un solo motor, tres propiedades.** Este repo sirve tres sitios desde el mismo deployment de Vercel (detección por host):

| Sitio | Qué es |
|---|---|
| [mapadecaborojo.com](https://www.mapadecaborojo.com) | Mapa + directorio verificado de Cabo Rojo (1,000+ negocios en CR, 12,000+ listados en PR) con El Veci detrás |
| [registromedicopr.com](https://registromedicopr.com) | Registro de especialistas médicos de PR (NPPES): 6,346 servibles, 32 especialidades × 5 regiones, desiertos médicos |
| [puertoricosinfiltros.com](https://puertoricosinfiltros.com) | Récords cívicos con data verificable: el número, la fuente, y qué hacer con él |

**El Veci** — textea al **787-417-7711** (SMS o [WhatsApp](https://wa.me/17874177711)) y te contesta 24/7. Guárdalo: [/veci](https://www.mapadecaborojo.com/veci).

---

## Los récords (PRSF)

Cada récord junta data pública verificable + data propia del substrato, y cierra con acción (no solo muestra el problema): `/prediccion` · `/costo-de-vida` · `/rendimiento` · `/cupon` · `/exposicion-ai` · `/decidir` · `/trabajo` · `/luz` · `/agua` · `/basura` · `/recuperacion` · `/sigue-el-dinero` · `/registro/estado` · `/diabetes` · `/telemedicina` · `/esencia` y más. Índice: [puertoricosinfiltros.com](https://puertoricosinfiltros.com).

## El motor de demanda

Demanda real medida por dos canales independientes y triangulada:

- **Texteo** (log crudo del *7711 — alta intención, "lo necesito ahora")
- **Búsqueda** (Google Search Console — alcance amplio, "lo estoy averiguando")

Vistas en Supabase: `v_demanda_oeste` (message-level, PII, **acceso solo service-role**), `v_demanda_gsc`, `v_demanda_triangulada`, `v_demanda_vs_oferta_oeste` (cruce con oferta verificada = pitch fuel). Récord público: [/demanda](https://www.mapadecaborojo.com/demanda).

## Palabras mágicas del Veci

`ALERTA` (avisos de emergencia/agua por pueblo) · `CUPON` (crédito por hijos sin cobrar) · `COSTO` (pulso del costo de vida) · `MEDICO` (récord de médicos + $75k federal) · `MANUAL` · `RECALL <med>` · o simplemente lo que necesites ("plomero en Combate").

## Para dueños de negocio

Aparecer en el directorio verificado es **gratis** — [ponte en el mapa](https://wa.me/17874177711?text=Quiero%20mi%20negocio%20en%20el%20mapa). Destacarte tiene precio claro: [La Vitrina desde $40](https://caborojo.com/patrocina).

---

## Stack

React + TypeScript + Vite (frontend del mapa) · Vercel serverless (14 fns, páginas SSR con cache CDN) · Supabase (Postgres + RLS + vistas + pg_cron) · Twilio SMS/WhatsApp (firma fail-closed) · OpenAI embeddings (768d).

**Seguridad:** RLS activo en tablas públicas; vistas con PII sin grants para anon/authenticated; webhook Twilio valida firma; llaves server-side sin prefijos públicos. Último lockdown: 2026-07-07.

**Deploy:** push a `main` → Vercel auto-deploy. El bot vive en el repo Vecinoai (edge functions de Supabase, 1,140 tests).

---

Hecho en Cabo Rojo por [Angel Anderson](https://angelanderson.com) — una persona, con AI. *Menos revolú, más sistema, mejor vida.*
