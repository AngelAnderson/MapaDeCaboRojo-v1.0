# La prueba de humo del sitio

**Decisión Angel, 2026-07-27.** El bot tiene 51 archivos de prueba. El sitio tenía cero.

## Por qué existe

En una sola semana se rompieron estas cosas, en producción, y ninguna la agarró un sistema:

| Qué se rompió | Cómo se enteró Angel | Cuánto llevaba roto |
|---|---|---|
| El mapa cargaba sin un solo pin | abrió el teléfono un domingo | horas |
| "El Pulso del Pueblo" salía vacío | mirando la página | meses |
| Los eventos eran de junio, en pleno julio | mirando la página | 46 días |
| La búsqueda fallaba 1 de cada 4 veces | nunca, salió en una auditoría | ~2 meses |
| 918 KB de basura en cada carga | nunca, salió en una auditoría | desde que entró el Registro |

El detector no puede ser un humano mirando.

## Cómo se corre

```bash
npm run smoke                                  # contra producción
SMOKE_URL=https://mi-preview.vercel.app npm run smoke
npm run deploy                                 # build + deploy + prueba, en una orden
```

`npm run deploy` es la forma correcta de subir: si la prueba falla después del deploy, sale con error y hay que revertir con `vercel rollback`.

## Qué prueba

**Capa 1, HTTP (sin dependencias, corre donde sea):** la portada responde y pesa menos de 50 KB, enlaza la página de "pon tu negocio", la búsqueda devuelve resultados con Cabo Rojo de primero, `live3d` pesa menos de 20 KB y trae Pulso, conteos y eventos, ningún evento publicado ya pasó, la mayoría de los eventos tienen coordenadas, las rutas vivas dan 200 y las podadas redirigen.

**Capa 2, el mapa en un navegador de verdad:** las capas de datos están montadas, el mapa dibuja más de 100 pines, la cámara está sobre Cabo Rojo, el control de tiempo tiene sus 3 momentos, hay camino de vuelta al inicio, mover el mapa en el tiempo cambia cuántos negocios están abiertos, y la consola está limpia.

## El detalle que hace que esto funcione

Chromium sin ventana **no trae WebGL**. Sin WebGL, MapLibre cae al fallback "necesita un navegador más nuevo" y **la prueba pasaría con el mapa completamente roto**. Ese fue exactamente el agujero que dejó salir el bug del 27 de julio.

La prueba levanta Chromium con `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`, que da WebGL por software. Verificado: sin esos flags, WebGL no existe; con ellos, sí.

Si la página cae al fallback, la prueba lo marca como **fallo**, no como salto. Un mapa que no se pudo mirar no es un mapa que pasó.

## Playwright

La prueba lo busca en dos sitios: el `node_modules` del repo, y la instalación de gstack en la máquina de Angel. **No está en las dependencias del repo a propósito:** Vercel instala las devDependencies al construir, y meterle Playwright con su Chromium alargaría cada build por algo que solo se corre a mano.

Si no lo encuentra, la capa del mapa se salta con aviso claro y la capa HTTP corre igual. Para instalarlo en otra máquina:

```bash
npm i -D playwright && npx playwright install chromium
```

## Cuando falle

El mensaje dice qué y por qué. Dos que ya pasaron y valen de ejemplo:

- **"la portada volvió a quedar sin puerta"**: alguien quitó el enlace a `/pon-tu-negocio-en-el-mapa`. Esa página estuvo con cero visitas en 56 días por no estar enlazada desde ningún lado, y es la que hace dinero.
- **"el mapa cargó vacío"**: `setupLayers()` tiró. Mira la consola del navegador: casi siempre es una expresión de MapLibre mal formada o una constante usada antes de declararse.

## Qué le falta

- No corre solo. Hoy hay que acordarse (`npm run deploy` lo hace por ti). El próximo paso es un GitHub Action que lo corra en cada push a main.
- No prueba `registromedicopr.com` ni `puertoricosinfiltros.com`, que salen del mismo código. Un cambio "obvio" en una ruta puede romperlas sin que esto se entere.
- No prueba que se pueda comprar nada. Cuando haya checkout, va aquí.
