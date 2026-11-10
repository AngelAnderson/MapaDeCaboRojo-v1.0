// Hoja "¿Cómo te fue con la llamada?" (28 sep 2026). Una sola copia para el Registro
// (registromedicopr.com, api/mapa-pages.ts) y el directorio (mapadecaborojo.com, api/negocio.ts):
// son el mismo producto, "¿a quién llamo?". Registra en /api/mapa-pages?page=registro-log;
// el servidor decide el sitio por el host. vid (28 sep 2026) = id anónimo al azar en localStorage
// para contar personas, no toques (ayudadas_contador). Sin nombre ni teléfono.
// 5 oct 2026 (dale de Angel): en el celular, la puerta del Veci es el SMS, no WhatsApp.
// Primer mensaje por SMS vuelve en 30 días 15.4% (n=337) vs WhatsApp 6.5% (n=649); hábito 7.1% vs 1.7%.
// Solo cambia enlaces al 7711 y solo en iPhone/Android (en la computadora el sms: no abre nada).
// Mismo texto prellenado. Medir: bot_real_inbound.channel de los primerizos a 30 días; kill si
// el regreso de los nuevos por SMS baja de 10%. Doc: Outbox/Estrategia/Hallazgos-Fuera-del-Registro-2026-10-05.md
export function veciSmsScript(): string {
  return `<script>(function(){if(!/iPhone|iPad|iPod|Android/i.test(navigator.userAgent||''))return;var S='a[href*="wa.me/17874177711"]';function fx(a){var h=a.getAttribute('href')||'',t='',q=h.indexOf('text=');if(q>=0)t=h.slice(q+5).split('&')[0];a.setAttribute('href','sms:+17874177711'+(t?'?&body='+t:''));a.removeAttribute('target');a.setAttribute('data-veci','sms');var ic=a.querySelector('.fa-whatsapp');if(ic)ic.className=ic.className.replace('fa-brands','fa-solid').replace('fa-whatsapp','fa-comment-sms');var w=document.createTreeWalker(a,4),n;while((n=w.nextNode()))if(n.nodeValue.indexOf('WhatsApp')>=0)n.nodeValue=n.nodeValue.replace('por WhatsApp','por texto').replace('WhatsApp','Texto');}function sw(){var as=document.querySelectorAll(S);for(var i=0;i<as.length;i++)fx(as[i]);}document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest(S):null;if(a)fx(a);},true);sw();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sw);setTimeout(sw,1500);})();</script>`
}

// "El próximo" (10 nov 2026, plan aprobado por Angel). Solo Registro.
// Dato de 7 días (registro_events, sitio=registro, 3-10 nov): de 183 reportes negativos, solo 98 (54%)
// hicieron otra llamada en 15 min; llegar al próximo consultorio tomaba 4 toques y un enlace que se iba
// a los 7 segundos. Ahora: (1) cuando no contestan, la hoja entrega el próximo de la lista con su botón;
// (2) la lista y la ficha recuerdan a quién llamaste (localStorage rg_mias, 30 días, solo en el aparato);
// (3) la fila sin resultado pregunta "¿Te contestaron?" ahí mismo (antes 13.6% de las llamadas lo decían).
// "El próximo" es el orden de la lista (registro_senal_telefono primero, luego alfabético): nunca se dice
// "recomendado" ni "verificado". Una llamada desde "El próximo" se registra con record = la lista, no la
// ficha donde estaba la persona, para que ningún resultado caiga en el consultorio equivocado.
// Cobro 17 nov 2026: negativos con otra llamada en 15 min 54% -> 70%; si no se mueve, sale.
// Ojo al editar: va dentro de un template literal; sin backticks, sin barras invertidas, sin dólar-llave.
function proximoScript(): string {
  return `<style>.rg-t-si{background:#ecfdf5}.rg-t-no{background:#fffbeb}html.dark .rg-t-si,html.dark .rg-t-no{background:#1e293b}
.rg-mia{font-size:16px;line-height:1.35;margin:0 0 6px;color:#0f172a}html.dark .rg-mia{color:#f1f5f9}
.rg-b{min-height:48px;min-width:76px;padding:0 16px;font-size:17px;font-weight:700;border-radius:10px;border:0;color:#fff;cursor:pointer}
.rg-tira{margin:16px 0 0;padding:14px 16px;border-radius:14px;border:2px solid #0f766e;background:#f0fdfa;color:#0f172a}html.dark .rg-tira{background:#1e293b;color:#f1f5f9;border-color:#2dd4bf}
.rg-nom{font-family:'Fraunces','Fraunces Fallback',Georgia,serif;font-size:22px;font-weight:700;line-height:1.2;color:#0f172a}html.dark .rg-nom{color:#f1f5f9}
.rg-call2{display:flex;align-items:center;justify-content:center;gap:8px;min-height:56px;padding:0 16px;border-radius:12px;background:#0f766e;color:#fff!important;font-size:19px;font-weight:700;text-decoration:none!important}
.rg-lk{display:inline-flex;align-items:center;min-height:48px;color:#0f766e!important;font-size:17px;font-weight:600;text-decoration:underline!important}html.dark .rg-lk{color:#5eead4!important}</style>
<script>(function(){
var R=window.__rg;if(!R)return;
var KM='rg_mias',DIA=86400000,MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function d10(h){return String(h||'').replace(/[^0-9]/g,'').slice(-10);}
function gm(){var m={},o={},ks=[],now=Date.now(),k,i;try{m=JSON.parse(localStorage.getItem(KM)||'{}')||{};}catch(e){m={};}
  for(k in m){if(Object.prototype.hasOwnProperty.call(m,k)&&m[k]&&m[k].t&&now-m[k].t<30*DIA)ks.push(k);}
  ks.sort(function(a,b){return m[b].t-m[a].t;});
  for(i=0;i<ks.length&&i<60;i++)o[ks[i]]=m[ks[i]];
  return o;}
function sm(m){try{localStorage.setItem(KM,JSON.stringify(m));}catch(e){}}
function cuando(t){var h=new Date(),d0=new Date(h.getFullYear(),h.getMonth(),h.getDate()).getTime(),a=new Date(t);if(t>=d0)return 'hoy';if(t>=d0-DIA)return 'ayer';return 'el '+a.getDate()+' '+MES[a.getMonth()];}
function local(l){return !!l&&l.charAt(0)==='/'&&l.charAt(1)!=='/';}
function veci(){var mv=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent||'');return '<a class="rg-lk" href="'+(mv?'sms:+17874177711?&body=ESPECIALISTA':'https://wa.me/17874177711?text=ESPECIALISTA')+'">787-417-7711</a>';}
// Las filas de la lista, en el orden en que salen: g=1 las del pueblo, g=2 las de cerca.
function filas(doc){var as=doc.querySelectorAll('table a.reg-call[data-rg-n]'),o=[],i,a,h,d;
  for(i=0;i<as.length;i++){a=as[i];h=a.getAttribute('href')||'';d=d10(h);if(h.indexOf('tel:')!==0||d.length!==10)continue;
    o.push({a:a,h:h,d:d,n:a.getAttribute('data-rg-n')||'',m:a.getAttribute('data-rg-m')||'',g:a.getAttribute('data-rg-g')||'1'});}
  return o;}
function cuenta(c,m){var q={n:0,x:0,nx:null,donde:''},p='',uno=1,i,e;
  for(i=0;i<c.length;i++){e=c[i];if(e.g==='1'){q.n++;if(m[e.d])q.x++;if(!p)p=e.m;else if(p!==e.m)uno=0;}if(!q.nx&&!m[e.d])q.nx=e;}
  q.donde=(uno&&p)?' en '+p:' de esta lista';return q;}
// En una lista se leen las filas de la página; en una ficha se trae la lista de su pueblo 1 vez.
function lista(z,cb){var c=filas(document);if(c.length){cb(c,location.pathname);return;}
  var l=(z&&z.l)||R.LA()||'';if(!local(l)||!window.fetch||!window.DOMParser){cb([],local(l)?l:'');return;}
  fetch(l,{credentials:'omit'}).then(function(r){return r.ok?r.text():'';}).then(function(t){var x=[];try{x=filas(new DOMParser().parseFromString(t,'text/html'));}catch(e){}cb(x,l);}).catch(function(){cb([],l);});}
function tarjeta(e,rec){return '<div class="rg-mia" style="margin:10px 0 2px;">El próximo de la lista</div><div class="rg-nom">'+esc(e.n)+'</div>'+(e.m?'<div class="rg-mia" style="font-size:17px;margin:2px 0 10px;">'+esc(e.m)+'</div>':'<div style="height:10px;"></div>')+'<a href="tel:'+e.h.replace(/[^0-9]/g,'')+'" class="rg-call2" data-rg-prox="1" data-rg-rec="'+esc(rec)+'" data-rg-n="'+esc(e.n)+'">📞 Llamar al próximo</a>';}
function prox(d,z){var box=d.querySelector('#rg-prox');if(!box)return;
  lista(z,function(c,l){if(!box.parentNode)return;var m=gm(),q=cuenta(c,m),ok=local(l),rec=ok?l.split('?')[0]:'',h='';
    if(q.nx){h=tarjeta(q.nx,rec)+'<p class="rg-mia" style="margin:10px 0 0;">'+(q.n&&q.x?'Llevas '+q.x+' de '+q.n+esc(q.donde)+'. ':'')+(ok&&rec!==location.pathname?'<a class="rg-lk" href="'+esc(l)+'">Ver la lista completa</a>':'')+'</p>';}
    else{var ti=d.querySelector('#rg-tit');if(ti)ti.textContent='Anotado.';
      h='<p class="rg-mia" style="font-size:17px;margin:10px 0 0;">'+(c.length?'Ya llamaste a todos los de esta lista. ':'')+'Textea al Veci: '+veci()+(!c.length&&ok?' o mira <a class="rg-lk" href="'+esc(l)+'">la lista completa</a>.':'')+'</p>';}
    box.innerHTML=h;});}
function linea(e,d){var w=cuando(e.t),ed=Date.now()-e.t,q,h;
  if(e.r==='si')return '✅ Llamaste '+w+' · te contestaron';
  if(e.r==='sn')return '🟡 Llamaste '+w+' · contestaron, sin resolver';
  if(e.r==='no')return '📞 Llamaste '+w+' · no te contestaron';
  h='📞 Llamaste '+w+'.';q=R.G();
  if(ed>8000&&ed<7*DIA&&!(q&&q.c===e.c&&!q.r&&document.getElementById('rg-res')))h+=' ¿Te contestaron?<span style="display:flex;gap:8px;margin:6px 0 2px;"><button type="button" class="rg-b" data-rg-mia="si" data-rg-d="'+esc(d)+'" style="background:#0f766e;">Sí</button><button type="button" class="rg-b" data-rg-mia="no" data-rg-d="'+esc(d)+'" style="background:#b91c1c;">No</button></span>';
  return h;}
function marcar(){var m=gm(),c=filas(document),i,e,tr,td,o,x,t,q,any=0,w,f,l,fd,hs=!!document.getElementById('rg-res');
  for(i=0;i<c.length;i++){tr=c[i].a.closest?c[i].a.closest('tr'):null;if(!tr||!tr.cells.length)continue;td=tr.cells[0];
    o=td.querySelector('.rg-mia');if(o)o.parentNode.removeChild(o);tr.classList.remove('rg-t-si');tr.classList.remove('rg-t-no');
    e=m[c[i].d];if(!e)continue;any=1;
    x=document.createElement('div');x.className='rg-mia';x.innerHTML=linea(e,c[i].d);td.appendChild(x);tr.classList.add(e.r==='si'?'rg-t-si':'rg-t-no');}
  t=document.getElementById('rg-tira');
  if(c.length){
    if(!any){if(t)t.parentNode.removeChild(t);}
    else{q=cuenta(c,m);
      if(!t){t=document.createElement('div');t.id='rg-tira';t.className='not-prose rg-tira';w=c[0].a.closest('table');if(w.parentNode&&w.parentNode.tagName==='DIV')w=w.parentNode;w.parentNode.insertBefore(t,w);}
      t.innerHTML='<div style="font-size:18px;font-weight:700;">'+(q.n&&q.x?'Llevas '+q.x+' de '+q.n+esc(q.donde)+'.':'Ya empezaste a llamar.')+'</div>'+(hs?'':(q.nx?tarjeta(q.nx,location.pathname):'<div class="rg-mia" style="font-size:17px;margin:8px 0 0;">Ya llamaste a todos los de esta lista. Textea al Veci: '+veci()+'</div>'))+'<div class="rg-mia" style="margin:10px 0 0;">Solo tú ves esto. Se guarda en este teléfono o computadora.</div>';}}
  f=document.getElementById('rg-mia-f');
  if(f){fd=f.getAttribute('data-rg-d')||'';e=m[fd];l=R.LA();
    f.innerHTML=e?'<div class="rg-tira" style="margin-top:10px;"><div class="rg-mia" style="font-size:17px;font-weight:600;margin:0;">'+linea(e,fd)+'</div>'+(local(l)?'<a class="rg-lk" href="'+esc(l)+'">Ver el próximo de la lista →</a>':'')+'</div>':'';}}
function llamo(a,h,c){var d=d10(h);if(d.length!==10)return;var m=gm(),rec=a.getAttribute('data-rg-rec')||'',n=a.getAttribute('data-rg-n')||'',h1;
  if(!n&&location.pathname.indexOf('/especialista/')===0){h1=document.querySelector('h1');n=h1?h1.textContent:'';}
  m[d]={t:Date.now(),c:c,r:'',n:String(n).replace(/^ +| +$/g,'').slice(0,80),p:rec||location.pathname};sm(m);
  if(a.getAttribute('data-rg-prox')){R.L('proximo_click',h,c,rec);try{gtag('event','click_to_call',{proximo:1});}catch(e){}
    var s=document.getElementById('rg-res');if(s&&s.contains(a))setTimeout(function(){if(s.parentNode)s.parentNode.removeChild(s);},400);}
  setTimeout(marcar,600);}
function res(cid,k){if(!cid)return;var m=gm(),d,e=null;for(d in m){if(m[d].c===cid){e=m[d];break;}}if(!e)return;
  if(k==='no_llame')delete m[d];
  else if(k==='contesto'||k==='cita'||k==='resuelto'||k==='otro_numero')e.r='si';
  else if(k==='contesto_no_resolvio'||k==='no_aceptan')e.r='sn';
  else if(k==='no_contestaron'||k==='numero_malo')e.r='no';
  sm(m);marcar();}
document.addEventListener('click',function(ev){var b=ev.target.closest?ev.target.closest('[data-rg-mia]'):null;if(!b)return;
  var d=b.getAttribute('data-rg-d'),k=b.getAttribute('data-rg-mia'),m=gm(),e=m[d],out,q,s;if(!e)return;
  out=k==='si'?'contesto':'no_contestaron';R.L('call_outcome',out,e.c,e.p);try{gtag('event','call_outcome',{resultado:out,tarde:1});}catch(x){}
  e.r=k==='si'?'si':'no';sm(m);
  q=R.G();if(q&&q.c===e.c&&!q.r){q.r=1;R.P(q);s=document.getElementById('rg-res');if(s)s.parentNode.removeChild(s);}
  marcar();});
window.__rgM={llamo:llamo,res:res,prox:prox};
// La hoja entra y sale de body: al cambiar, la lista se vuelve a pintar (tira y preguntas de fila).
if(window.MutationObserver&&document.body){new MutationObserver(function(ms){var i,j,a,r;for(i=0;i<ms.length;i++){a=ms[i].addedNodes;r=ms[i].removedNodes;for(j=0;j<a.length;j++){if(a[j].id==='rg-res'){setTimeout(marcar,30);return;}}for(j=0;j<r.length;j++){if(r[j].id==='rg-res'){setTimeout(marcar,30);return;}}}}).observe(document.body,{childList:true});}
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')setTimeout(marcar,700);});
window.addEventListener('pageshow',function(){setTimeout(marcar,900);});
marcar();
})();</script>`
}

export function hojaLlamadaScript(sitio: 'registro' | 'directorio'): string {
  const esReg = sitio === 'registro'
  return veciSmsScript() + `<script>(function(){var V='';try{V=localStorage.getItem('rg_vid')||'';if(!V){V=Date.now().toString(36)+Math.random().toString(36).slice(2,10);localStorage.setItem('rg_vid',V);}}catch(e){}function L(ev,t,c,r){try{fetch('/api/mapa-pages?page=registro-log',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({event:ev,record:(r||location.pathname).slice(0,120),target:(t||'').slice(0,200),referrer:document.referrer||'',cid:c||'',vid:V})});}catch(e){}}var K='rg_llamada';function G(){try{return JSON.parse(sessionStorage.getItem(K)||'null');}catch(e){return null;}}function LA(){var ok=function(h){var p=(h||'').split('?')[0].split('/').filter(Boolean);return p.length===3&&p[0]==='registro'?h:'';};var r=ok(location.pathname);if(r)return r;var a=document.querySelector('a[data-rg-lista]');return a?ok(a.getAttribute('href')||''):'';}function P(v){try{sessionStorage.setItem(K,JSON.stringify(v));}catch(e){}}function M(f,a,b,c){try{if(window.__rgM&&window.__rgM[f])return window.__rgM[f](a,b,c);}catch(e){}}${esReg ? `window.__rg={L:L,G:G,P:P,LA:LA};` : ''}function hoja(){var q=G();if(!q||q.r)return;var dt=Date.now()-q.t;if(dt<8000||dt>7200000)return;if(document.getElementById('rg-res'))return;var dk=document.documentElement.classList.contains('dark');var d=document.createElement('div');d.id='rg-res';d.setAttribute('role','dialog');d.setAttribute('aria-label','¿Cómo te fue con la llamada?');d.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:9999;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));background:'+(dk?'#0f172a':'#fff')+';color:'+(dk?'#f1f5f9':'#0f172a')+';border-top:1px solid '+(dk?'#334155':'#e2e8f0')+';box-shadow:0 -8px 24px rgba(0,0,0,.15);';var O2=${esReg ? `[['cita','✅ Me dieron cita'],['contesto_no_resolvio','🟡 Contestaron, pero no se resolvió'],['no_aceptan','🔴 No aceptan pacientes nuevos o mi plan'],['otro_numero','📞 Me dieron otro número directo']]` : `[['resuelto','✅ Me resolvieron o quedamos en algo'],['contesto_no_resolvio','🟡 Contestaron, pero no se resolvió']]`};var BT='display:block;width:100%;min-height:48px;text-align:left;margin:0 0 8px;padding:12px 14px;font-size:17px;border-radius:10px;border:1px solid '+(dk?'#334155':'#cbd5e1')+';background:'+(dk?'#1e293b':'#f8fafc')+';color:inherit;cursor:pointer;';var X='<button type="button" data-rg="cerrar" aria-label="Cerrar" style="background:none;border:0;font-size:28px;line-height:1;color:inherit;cursor:pointer;min-width:44px;min-height:44px;padding:0;">×</button>';function paso2(){var t='<div style="max-width:560px;margin:0 auto;"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><strong style="font-size:18px;">Gracias. ¿Y qué pasó?</strong>'+X+'</div><p style="margin:4px 0 12px;font-size:16px;opacity:.85;">Si quieres, 1 toque más. Si no, ciérralo: ya quedó anotado.</p>';for(var i=0;i<O2.length;i++){t+='<button type="button" data-rg="'+O2[i][0]+'" style="'+BT+'">'+O2[i][1]+'</button>';}return t+'</div>';}function pasoNo(){return ${esReg ? `'<div style="max-width:560px;margin:0 auto;"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><strong id="rg-tit" style="font-size:20px;">Anotado. Vamos con el próximo.</strong>'+X+'</div><div id="rg-prox" style="min-height:60px;"></div><button type="button" data-rg="numero_malo" style="'+BT+'margin-top:12px;">🔴 El número está malo o es de otro sitio</button></div>'` : `'<div style="max-width:560px;margin:0 auto;"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><strong style="font-size:18px;">Gracias, lo anotamos.</strong>'+X+'</div><p style="margin:4px 0 12px;font-size:16px;opacity:.85;">Eso le avisa a la próxima persona. ¿Algo más?</p><button type="button" data-rg="numero_malo" style="'+BT+'">🔴 El número está malo o es de otro sitio</button><button type="button" data-rg="otra_opcion" style="'+BT+'">➡️ Necesito otra opción</button></div>'`};}var h='<div style="max-width:560px;margin:0 auto;"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><strong style="font-size:20px;">¿Te contestaron?</strong><button type="button" data-rg="x" aria-label="Cerrar" style="background:none;border:0;font-size:28px;line-height:1;color:inherit;cursor:pointer;min-width:44px;min-height:44px;padding:0;">×</button></div><p style="margin:4px 0 12px;font-size:16px;opacity:.85;">1 toque. Le ahorra una vuelta a la próxima persona. No te pedimos nombre ni teléfono.</p><div style="display:flex;gap:10px;"><button type="button" data-rg="si" style="flex:1;display:block;width:100%;min-height:56px;text-align:center;margin:0 0 10px;padding:12px 14px;font-size:19px;font-weight:700;border-radius:12px;cursor:pointer;border:0;background:#0f766e;color:#fff;">✅ Sí</button><button type="button" data-rg="no" style="flex:1;display:block;width:100%;min-height:56px;text-align:center;margin:0 0 10px;padding:12px 14px;font-size:19px;font-weight:700;border-radius:12px;cursor:pointer;border:0;background:#b91c1c;color:#fff;">🔴 No</button></div><button type="button" data-rg="no_llame" style="display:block;margin:2px auto 0;min-height:44px;background:none;border:0;color:inherit;font-size:16px;text-decoration:underline;cursor:pointer;">No llegué a llamar</button></div>';d.innerHTML=h;d.addEventListener('click',function(e){var b=e.target.closest?e.target.closest('[data-rg]'):null;if(!b)return;var k=b.getAttribute('data-rg');if(k==='cerrar'){d.remove();return;}if(k==='guardar_num'){var zz=G()||{};var inp=document.getElementById('rg-num');var dg=((inp&&inp.value)||'').replace(/[^0-9]/g,'');if(dg.length===11&&dg.charAt(0)==='1')dg=dg.slice(1);if(dg.length!==10){if(inp){inp.style.borderColor='#dc2626';inp.focus();}return;}L('numero_reportado',dg,zz.c,zz.p);d.innerHTML='<div style="max-width:560px;margin:0 auto;font-size:16px;"><strong>Gracias.</strong> Lo revisamos y lo ponemos en la ficha para la próxima persona.</div>';setTimeout(function(){if(d.parentNode)d.remove();},7000);return;}var z=G()||{};z.r=1;P(z);if(k==='x'){L('call_outcome','descartado',z.c,z.p);d.remove();M('res',z.c,'descartado');return;}if(k==='si'){L('call_outcome','contesto',z.c,z.p);M('res',z.c,'contesto');try{gtag('event','call_outcome',{resultado:'contesto'});}catch(e){}d.innerHTML=paso2();return;}if(k==='no'){L('call_outcome','no_contestaron',z.c,z.p);try{gtag('event','call_outcome',{resultado:'no_contestaron'});}catch(e){}M('res',z.c,'no_contestaron');d.innerHTML=pasoNo();M('prox',d,z);return;}L('call_outcome',k,z.c,z.p);M('res',z.c,k);try{gtag('event','call_outcome',{resultado:k});}catch(e){}if(k==='otro_numero'){d.innerHTML='<div style="max-width:560px;margin:0 auto;"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><strong style="font-size:18px;">¿Qué número te dieron?</strong><button type="button" data-rg="cerrar" aria-label="Cerrar" style="background:none;border:0;font-size:28px;line-height:1;color:inherit;cursor:pointer;min-width:44px;min-height:44px;padding:0;">×</button></div><p style="margin:4px 0 12px;font-size:15px;opacity:.85;">El número directo de la oficina. Lo revisamos y lo ponemos en la ficha.</p><label for="rg-num" style="display:block;font-size:16px;margin-bottom:6px;">Número de la oficina</label><input id="rg-num" type="tel" inputmode="numeric" autocomplete="off" placeholder="787-555-1234" style="display:block;width:100%;box-sizing:border-box;min-height:48px;padding:10px 12px;font-size:18px;border-radius:10px;border:2px solid '+(dk?'#475569':'#94a3b8')+';background:'+(dk?'#1e293b':'#fff')+';color:inherit;margin:0 0 10px;"><button type="button" data-rg="guardar_num" style="display:block;width:100%;min-height:48px;font-size:17px;font-weight:700;border-radius:10px;border:0;background:#0f766e;color:#fff;cursor:pointer;">Guardar número</button></div>';setTimeout(function(){var i=document.getElementById('rg-num');if(i)i.focus();},50);return;}${esReg ? `var px=(k==='contesto_no_resolvio'||k==='no_aceptan'||k==='numero_malo');d.innerHTML='<div style="max-width:560px;margin:0 auto;font-size:17px;"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><span><strong>Gracias.</strong> '+(k==='no_llame'?'Cuando llames, el número sigue aquí.':(k==='cita'||k==='resuelto')?'Qué bueno que se resolvió.':(k==='contesto_no_resolvio'?'Lo anotamos para que la próxima persona llegue mejor.':'Lo anotamos.'))+'</span>'+(px?X:'')+'</div>'+(px?'<div id="rg-prox" style="min-height:60px;"></div>':'')+'</div>';if(px){M('prox',d,z);}else{setTimeout(function(){if(d.parentNode)d.remove();},7000);}` : `d.innerHTML='<div style="max-width:560px;margin:0 auto;font-size:16px;"><strong>Gracias.</strong> '+(k==='no_llame'?'Cuando llames, el número sigue aquí.':(k==='cita'||k==='resuelto')?'Qué bueno que se resolvió.':(k==='contesto_no_resolvio'?'Lo anotamos para que la próxima persona llegue mejor.':'Busca otra opción en <a href="/" style="text-decoration:underline;">el directorio</a> o textea al Veci: 787-417-7711.'))+'</div>';setTimeout(function(){if(d.parentNode)d.remove();},7000);`}});document.body.appendChild(d);}document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')setTimeout(hoja,400);});var T0=Date.now(),SAL=0;window.addEventListener('pagehide',function(){if(SAL||location.pathname.indexOf('/especialista/')!==0)return;var q=G();if(q&&(q.p===location.pathname||q.o===location.pathname))return;SAL=1;var sg=(Date.now()-T0)/1000;L('salida',sg<10?'0-10':sg<30?'10-30':sg<90?'30-90':'90+');});window.addEventListener('pageshow',function(){setTimeout(hoja,600);});document.addEventListener('click',function(e){var a=e.target.closest?e.target.closest('a'):null;if(!a)return;var h=a.getAttribute('href')||'';if(h.indexOf('tel:')===0){var c=Date.now().toString(36)+Math.random().toString(36).slice(2,10);var rec=a.getAttribute('data-rg-rec')||'';P({c:c,t:Date.now(),p:rec||location.pathname,o:location.pathname,l:LA()});L('click_to_call',h,c,rec);M('llamo',a,h,c);if(a.className.indexOf('reg-call')>=0){try{gtag('event','click_to_call',{lista:1});}catch(e){}}return;}if(h.indexOf('wa.me/17874177711')>=0||h.indexOf('sms:+17874177711')===0){L('veci_click',h);return;}if(h.indexOf('wa.me/')>=0||h.indexOf('whatsapp.com')>=0){L('click_whatsapp',h);}},true);})();</script>` + (esReg ? proximoScript() : '')
}
