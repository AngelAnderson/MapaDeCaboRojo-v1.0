# El casco en 3D y la regla `sin_local`

**Qué es:** el botón `🏛 El casco` en `/3d` levanta 3,155 edificios del casco de
Cabo Rojo y los pinta según **quién está adentro**.

## Las 2 mitades, y cuál es honesta

| Dato | De dónde sale | ¿Es real? |
|---|---|---|
| La **huella** de cada edificio | OpenStreetMap (Overpass) | **Sí.** Levantadas a mano por mapeadores |
| La **altura** | Calculada del área de la huella | **No.** OSM no trae ni un `building:levels` para Cabo Rojo (0 de 3,341) |
| El **color** | Cruce punto-en-polígono contra `places` | **Sí.** Es el directorio |
| El **techo oscuro** | `v` = verificado a mano en 90 días | **Sí.** 43 edificios |

La altura estimada **se declara en pantalla**, dentro del mapa. Un mapa que inventa
alturas y no lo dice tiene el mismo problema que un directorio con teléfonos
muertos: se ve bien y miente.

## Por qué el color es el moat

Cualquiera baja los edificios de OSM. Lo que no se baja de ningún lado es quién
está adentro. Por eso **la calle comercial se dibuja sola** sin que nadie la trace:
127 edificios en color contra 3,028 en hueso.

## Cómo se regenera

```bash
node scripts/make-casco.mjs      # Overpass + cruce contra datos-*.js, 3 espejos
# imprime el CASCO_URL nuevo; pegarlo en public/3d/index.html
```

El archivo (709 KB) **no se baja al entrar**: solo al tocar el botón.

## La cámara: el casco es la plaza, y lleva padding

`CASCO_VISTA` para sobre `cabo-rojo-town-square` (Plaza Dr. Ramón Emeterio
Betances y Alacán). Dos errores que ya se cometieron:

1. **Poner el centro a ojo.** Cayó 150 m al sureste. Un centro se calcula, no se
   escoge.
2. **Olvidar el padding.** `center` centra el *viewport completo*, pero los paneles
   tapan ~670px de él, así que la plaza aterrizaba corrida. Con padding el desvío
   pasó de ~180px a 5px en escritorio y 0px en móvil.

Se verifica midiendo, no mirando: `map.project([lon,lat])` contra el centro del
área visible.

---

# `places.sin_local` — quién NO lleva pin

**La regla:** un negocio que va a TU casa no tiene un sitio al que ir. Ponerle un
pin es decir "está aquí" donde no está, y este directorio se vende sobre que lo
que dice se puede ir a comprobar.

**El síntoma que lo destapó:** Oso Electric estaba con un pin encima de la plaza.
Su dirección es solo "Cabo Rojo, PR", y cuando no hay calle el geocodificador tira
al centro del pueblo. En Cabo Rojo hay **66 puntos con más de un negocio encima,
141 negocios apilados**. Tres grúas comparten la coordenada exacta.

**Lo que NO es señal suficiente:** compartir coordenada. Tres doctores en la misma
plaza médica es real. La señal es punto compartido **más** categoría que por
definición no tiene local.

**Lo que NO se hace:** borrar la coordenada ni sacar el negocio del directorio.
Siguen en la búsqueda y en el Veci, que es donde se les llama. Solo pierden el pin.

**Precedente que ya existía sin nombre:** Pipeline Plumbing y Quickfix PR nunca
tuvieron pin porque no tenían coordenada. Esto le pone nombre a esa regla para
poder aplicarla a propósito.

**La categoría sola no decide.** Se marcaron y se desmarcaron *Taller Richie* y
*Higuaca*: un taller y una finca sí tienen dónde llegar.

Al 16 ago 2026: **11 marcados** en Cabo Rojo, que bajó de 931 a 920 pines.
Quedan ~130 negocios apilados sin revisar; esos necesitan ojo humano.

```sql
-- los que quedan por revisar, agrupados por punto compartido
select round(lat::numeric,5) la, round(lon::numeric,5) lo, count(*) n,
       string_agg(name || ' (' || coalesce(subcategory,'?') || ')', ' · ') quienes
from places
where municipality='Cabo Rojo' and status::text='open'
  and not coalesce(fuera_de_pr,false) and lat is not null and not sin_local
group by 1,2 having count(*) > 1 order by n desc;
```
