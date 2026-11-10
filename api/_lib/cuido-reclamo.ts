// "¿Este es tu hogar? Ponlo al día" (dale de Angel, 10 nov 2026).
//
// La ficha de un hogar de cuido dice 2 veces "no sabemos": cuántas camas están ocupadas y si
// la tarifa que el hogar le informó a Familia sigue siendo esa. El único que lo sabe es el
// hogar. Esta fila cerrada, debajo de los datos, le deja decirlo. Es gratis y no vende nada.
//
// Reglas:
//  - Usa el mismo POST que "¿Es tu perfil?" (page=especialista-claim → provider_claims) con
//    origen 'cuido'. Lo propio de un hogar (tarifa, camas hoy, a quién reciben) viaja en
//    `notes`: el trigger aplicar_reclamo_a_ficha solo escribe solo horario y planes, y este
//    formulario no manda ninguno de los 2, así que NADA se publica sin que alguien lo revise.
//  - Nunca "verificado", nunca "camas libres" como dato nuestro: es lo que el hogar dice.
//  - Mayores primero: todo 16px o más, todo lo que se toca 48px o más, etiquetas visibles.
//  - Medida: evento `reclamo_abierto` en registro_events (alguien abrió la fila) y filas en
//    provider_claims con source='cuido_page'. Cobro: fechas.cuido-reclamo-cobro-2026-12-09.

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>
)[c])

const CAMPO = 'w-full min-h-[48px] rounded-xl border-2 border-slate-400 bg-white px-3 text-lg font-normal text-slate-900'
const ETIQ = 'block text-base font-semibold text-slate-900'
const RADIO = 'inline-flex items-center gap-2 min-h-[48px] px-3 rounded-xl border-2 border-slate-400 bg-white text-lg text-slate-900'

export function reclamoHogarHtml(o: { placeId: string; name: string; path: string }): string {
  return `<details id="hogar-reclamo" class="not-prose mt-6 rounded-2xl border-2 border-teal-300 bg-teal-50" data-place="${esc(o.placeId)}" data-name="${esc(o.name)}" data-path="${esc(o.path)}">
  <summary class="flex items-center justify-between gap-3 min-h-[56px] px-4 py-2 cursor-pointer list-none text-lg font-bold text-teal-900">
    <span>¿Este es tu hogar? Ponlo al día<span class="block text-base font-normal text-slate-800">Es gratis.</span></span>
    <span aria-hidden="true" class="text-teal-800 text-xl">▾</span>
  </summary>
  <form id="hogar-reclamo-form" class="px-4 pb-5 pt-1 space-y-4">
    <p class="text-base text-slate-800 m-0">Nadie sabe mejor que tú cuánto cobras y si tienes camas hoy. Lo que nos digas lo revisamos antes de publicarlo.</p>
    <label class="${ETIQ}">Tu nombre
      <input name="claimant_name" required autocomplete="name" class="${CAMPO} mt-1"></label>
    <fieldset class="m-0 p-0 border-0"><legend class="${ETIQ}">¿Qué eres en el hogar?</legend>
      <div class="flex flex-wrap gap-2 mt-1">
        <label class="${RADIO}"><input type="radio" name="claimant_role" value="dueno" required> Dueño o dueña</label>
        <label class="${RADIO}"><input type="radio" name="claimant_role" value="encargado"> Encargado o encargada</label>
        <label class="${RADIO}"><input type="radio" name="claimant_role" value="empleado"> Trabajo aquí</label>
      </div></fieldset>
    <label class="${ETIQ}">Tu teléfono, para confirmar contigo
      <input name="contact_phone" type="tel" inputmode="tel" required autocomplete="tel" class="${CAMPO} mt-1"></label>
    <fieldset class="m-0 p-0 border-0"><legend class="${ETIQ}">¿Ese teléfono recibe textos?</legend>
      <div class="flex flex-wrap gap-2 mt-1">
        <label class="${RADIO}"><input type="radio" name="recibe_sms" value="si" checked> Sí</label>
        <label class="${RADIO}"><input type="radio" name="recibe_sms" value="no"> No, es fijo</label>
      </div></fieldset>
    <label class="${ETIQ}">Tu correo <span class="font-normal text-slate-700">(si quieres)</span>
      <input name="contact_email" type="email" autocomplete="email" class="${CAMPO} mt-1"></label>
    <label class="${ETIQ}">Tarifa al mes, en dólares
      <input name="tarifa" inputmode="numeric" placeholder="1,600" class="${CAMPO} mt-1"></label>
    <fieldset class="m-0 p-0 border-0"><legend class="${ETIQ}">¿Tienes camas disponibles hoy?</legend>
      <div class="flex flex-wrap gap-2 mt-1">
        <label class="${RADIO}"><input type="radio" name="camas_hoy" value="si"> Sí</label>
        <label class="${RADIO}"><input type="radio" name="camas_hoy" value="no"> No</label>
      </div></fieldset>
    <label class="${ETIQ}">¿Cuántas? <span class="font-normal text-slate-700">(si tienes)</span>
      <input name="camas_cuantas" inputmode="numeric" class="${CAMPO} mt-1"></label>
    <label class="${ETIQ}">¿A quién reciben? <span class="font-normal text-slate-700">(por ejemplo: encamados, Alzheimer, estadías cortas)</span>
      <input name="reciben" class="${CAMPO} mt-1"></label>
    <label class="${ETIQ}">¿El teléfono de arriba está mal? Pon el correcto
      <input name="corrected_phone" type="tel" inputmode="tel" class="${CAMPO} mt-1"></label>
    <button type="submit" class="w-full min-h-[56px] rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-lg px-6">Enviar los datos de mi hogar</button>
    <p id="hogar-reclamo-estado" role="status" class="hidden text-lg font-semibold m-0"></p>
  </form>
</details>`
}

// Sin `<` dentro de los strings y sin dependencias: corre igual en el dominio propio de Cuido.
// El toggle lo hace <details>; el script solo cuenta la primera apertura y manda el formulario.
export const RECLAMO_HOGAR_SCRIPT = `<script>(function(){var d=document.getElementById('hogar-reclamo');if(!d)return;var f=document.getElementById('hogar-reclamo-form'),st=document.getElementById('hogar-reclamo-estado'),visto=false;
d.addEventListener('toggle',function(){if(!d.open||visto)return;visto=true;var V='';try{V=localStorage.getItem('rg_vid')||''}catch(x){}try{fetch('/api/mapa-pages?page=registro-log',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'reclamo_abierto',record:location.pathname.slice(0,120),target:'cuido',referrer:document.referrer||'',vid:V})})}catch(x){}});
f.addEventListener('submit',function(e){e.preventDefault();var b=f.querySelector('button[type=submit]');b.disabled=true;b.textContent='Enviando…';
var body={origen:'cuido',place_id:d.getAttribute('data-place'),provider_name:d.getAttribute('data-name'),ficha_path:d.getAttribute('data-path')};new FormData(f).forEach(function(v,k){body[k]=v});
var falla=function(){st.className='text-lg font-semibold m-0 text-red-700';st.textContent='No se pudo enviar. Escríbele al Veci al 787-417-7711.';b.disabled=false;b.textContent='Enviar los datos de mi hogar'};
fetch('/api/mapa-pages?page=especialista-claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json()}).then(function(j){if(!j||!j.ok){falla();return}
st.className='text-lg font-semibold m-0 text-emerald-800';st.textContent='Gracias. Lo revisamos antes de publicarlo y te avisamos.';b.style.display='none'}).catch(falla)})})();</script>`

// Lo propio de un hogar va a provider_claims.notes como texto legible para quien revisa.
// Devuelve null si no trajo nada de eso (un reclamo con solo el teléfono corregido es válido).
export function notasReclamoHogar(b: any): string | null {
  const limpio = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
  const partes: string[] = []
  const tarifa = limpio(b?.tarifa, 20)
  if (tarifa) partes.push(`Tarifa al mes: ${tarifa}`)
  if (b?.camas_hoy === 'si' || b?.camas_hoy === 'no') {
    const cuantas = limpio(b?.camas_cuantas, 10)
    partes.push(`Camas disponibles hoy: ${b.camas_hoy === 'si' ? 'sí' : 'no'}${b.camas_hoy === 'si' && cuantas ? ` (${cuantas})` : ''}`)
  }
  const reciben = limpio(b?.reciben, 200)
  if (reciben) partes.push(`A quién reciben: ${reciben}`)
  return partes.length ? `[hogar de cuido] ${partes.join(' · ')}` : null
}

// La ruta de la ficha llega del navegador: solo se usa si tiene la forma exacta de una ficha
// de cuido. Sirve para el correo de confirmación (places.slug es nulo en los hogares).
export function rutaFichaHogar(p: unknown): string | null {
  const s = String(p ?? '')
  return /^(\/cuido)?\/[a-z0-9-]{1,80}\/[a-z0-9-]{1,80}$/.test(s) ? s : null
}
