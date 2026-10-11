// Plazo para cada llamada a Supabase (11 oct 2026). Sin esto, cuando la base se pone lenta (apagón del 8 oct)
// la función espera hasta su maxDuration (15-60 s) y Vercel la mata: 10,436 timeouts y 4,382 visitantes con error
// entre jul y oct. Con plazo, la llamada falla rápido y la página sale con lo que tenga (o con su error manejado).
// mapa-pages.ts ya lo tenía (DB_TIMEOUT_MS); este archivo lo da a los otros 10 que crean su cliente.
export function opcionesConPlazo(ms = 8000) {
  return {
    global: {
      fetch: (input: any, init: any = {}) => {
        const deadline = AbortSignal.timeout(ms)
        const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline
        return fetch(input, { ...init, signal })
      },
    },
  }
}
