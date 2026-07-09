# 🗺️ Roadmap — Mapa · Registro · SinFiltros

**Misión:** el substrato de data verificada de Puerto Rico, empezando por el oeste — directorio + demanda + récords cívicos que resuelven.

**Norte operativo:** cada pieza pasa El Filtro (¿convierte revolú en acción útil? ¿mueve dinero/paz/tiempo/comunidad/futuro?) y la regla 3-Pagos (no se construye SKU nuevo sin 3 clientes pagando).

*Actualizado: 2026-07-09.*

---

## ✅ Hecho (lo que ya corre solo)

- **Fortaleza:** RLS lockdown completo (jul 2026) · vistas PII sin acceso anon · firma Twilio fail-closed · llaves server-side auditadas · repo en GitHub · backups Supabase
- **Motor de demanda 3 capas:** log crudo *7711 (`v_demanda_oeste`) × Google/GSC (`v_demanda_gsc`) → triangulada (`v_demanda_triangulada`) + cruce con oferta (`v_demanda_vs_oferta_oeste`) → [/demanda](https://www.mapadecaborojo.com/demanda) unificado
- **Récords de decisión (PRSF):** predicción · costo-de-vida (panel IPC vivo) · rendimiento del dólar (78 municipios) · cupón federal sin cobrar (~$310M CTC) · exposición-AI (78 municipios, data original) · decidir · trabajo · luz/agua/basura · sigue-el-dinero · registro/estado ($75k HPSA)
- **El Veci keywords:** ALERTA (opt-in avisos por pueblo + fan-out editor) · CUPON · COSTO · MEDICO · MANUAL · RECALL · landing /veci con vCard + home screen
- **Registro médico:** 6,300+ especialistas verificados · 32 especialidades × 5 regiones · desiertos · observatorio
- **Registro médico — capa de utilidad e intención (jul 8-9):** filtro "¿acepta mi plan?" (honesto: ✓ solo confirmado) · búsqueda por síntoma con guard 911 · 5 guías /necesito · checklist antes-de-llamar · botón WA a mami/papi · disclaimer canon · **semáforo /pueblo de los 78 municipios** (qué hay/qué falta/HPSA/datos citables) · alertas por pueblo con cron que cierra el loop (`registro_alerts`) · bilingüe ES/EN completo · nav desktop 3+Más · menú mobile hamburguesa · footer 4 columnas
- **Ambient agents:** 15+ crons (digest 7am, canary, GSC pulse, watchdog de crons, learning gaps…)

---

## 🔜 Ahora (próximas 2-4 semanas)

- [ ] **Distribución del ranking /pueblo** — LA pieza compartible del registro ("¿cuántos médicos tiene tu pueblo?"): post FB + carrusel 5 peores/5 mejores + mención newsletter. Sin ojos no hay disrupción.
- [ ] **Crowdsource "¿cuánto tardó tu cita?"** — tiempos de espera por especialista (patrón claim form); en 6 meses = la data más citable del sitio.
- [ ] **Pitch plomería** — el gap más caliente del cruce demanda×oferta (42 personas / 7 proveedores / 90d). Mensaje "abra puertas" con recibo real → primer pitch del motor de demanda.
- [ ] **Distribución Ola 1** (salud/prensa) — kit listo en `Outbox/PRSF/Distribucion-Ola1-Salud.md`; los récords no sirven si nadie los ve.
- [ ] **Audios NotebookLM pendientes** — tanda 2 (10 audios) + /exposicion-ai + /luz + regenerar 2 infográficos con typo (cuota diaria).
- [ ] **Keyword DECIDIR** en el bot — el Veci guía la decisión me-quedo/me-voy/me-mudo por SMS.
- [ ] **Notifs a email** — mover digests SMS del cron (willy/infra morning) a Resend: ~44% del tráfico Twilio saliente es auto-notificación (~$25-30/mes).
- [ ] **IPC mensual** — 1 UPDATE a `pr_cost_indicators` cuando DTRH publique (~día 26). Mueve página + bot juntos.

## 🌱 Después (trimestre)

- [ ] **Canasta por pueblo** — el premio sin reclamar de /costo-de-vida: renta (hecho en /rendimiento) + luz + DACO mayorista → costo real de vivir por municipio, con histórico.
- [ ] **ALERTA fase 2** — sensores automáticos (agua EPA / sismo USGS) disparan avisos sin humano; hoy es human-in-the-loop (ALERTAR).
- [ ] **GSC profundo** — más propiedades + cola larga (hoy top-50/sitio) + trending semanal → alimentar récords y pitches.
- [ ] **Demanda→Vitrina pipeline** — de `v_demanda_vs_oferta_oeste` al email semanal de pitches (extender sponsor-pipeline-filler).
- [ ] **Verificación freshness %** — la métrica madre del mapa (target 80%+ de listados verificados <90d), instrumentada.
- [ ] **Claim de negocios** — dueños reclaman y actualizan su listado (horas/especiales).

## 🧊 Parqueo (con trigger)

- **Replicación a otros municipios** — trigger: 5+ Vitrinas en CR (regla No Chasing).
- **API Pro $99/mes** (recalls + demanda) — trigger: primer prospecto inbound real.
- **Audio tour geofenced / beach cams / tráfico** — ideas viejas, sin revenue path claro todavía.
- **Reviews "vibe check"** — trigger: retención del bot >25%.

---

## Reglas de mantenimiento

1. Nada entra a "Ahora" sin pasar El Filtro.
2. Todo récord nuevo: fuente + fecha + límites declarados + acción que resuelve (alivio, no peso).
3. Tabla nueva en Supabase = RLS habilitado en el mismo commit (lección jul 2026).
4. Antes de crear una página, buscar la existente y mejorarla (lección /demanda jul 2026).
