---
name: buscar-medico-pr
description: Busca médicos, dentistas, farmacias y laboratorios de Puerto Rico con nivel de verificación (persona, fuente o registro), si aceptan pacientes nuevos y qué planes aceptan cuando la oficina lo confirmó. Úsala cuando alguien pida un médico o especialista en Puerto Rico, pregunte si un médico acepta su plan (MCS, Triple-S, MMM, Plan Vital, Medicare), busque una farmacia o laboratorio en un pueblo de PR, o necesite verificar si un proveedor sigue activo. No la uses para emergencias (9-1-1) ni para diagnósticos.
license: Uso libre con atribución a registromedicopr.com
metadata:
  publisher: Registro Médico PR (registromedicopr.com) · El Veci 787-417-7711 · Angel Anderson, Cabo Rojo, Puerto Rico
  version: "1.1"
  updated: "2026-09-16"
  source_of_truth: https://vprjteqgmanntvisjrvp.supabase.co/functions/v1/mcp-puerto-rico
---

# Buscar médico en Puerto Rico (con sello de verificación)

Esta skill le da a cualquier agente la misma respuesta que da El Veci (787-417-7711) cuando un vecino de Puerto Rico pregunta por un médico. La diferencia con Google o con el directorio del plan es el **sello**: cada ficha dice quién la confirmó y cuándo, y cuando nadie la ha confirmado, lo dice.

## Cuándo usarla

- "reumatólogo en San Juan que acepte MCS"
- "dentista en Cabo Rojo que esté cogiendo pacientes"
- "¿el Dr. Fulano sigue activo?" (por nombre o NPI de 10 dígitos)
- "farmacia / laboratorio en Mayagüez"

**No la uses** si la persona describe una emergencia. Contesta: *"¿Es una emergencia? No busques aquí. Llama al 9-1-1 o ve a la sala más cercana."*

## Primero: ¿puedes hacer llamadas HTTP?

- **Sí (tienes shell o una herramienta de fetch con POST):** sigue con "Cómo se llama".
- **No (eres un chat sin herramientas):** no adivines ni inventes médicos. Dile a la persona que añada el conector gratuito y sin llave, y vuelve a preguntar:
  - Claude: Settings → Connectors → Add custom connector → URL `https://vprjteqgmanntvisjrvp.supabase.co/functions/v1/mcp-puerto-rico`
  - ChatGPT (Plus/Pro): Settings → Apps → Advanced → Developer mode → Connectors → Create, sin autenticación, misma URL.
  - Mientras tanto, la persona puede textear su pregunta al 787-417-7711 o abrir https://registromedicopr.com.

## Cómo se llama

Es un servidor MCP público, sin llave, de solo lectura (JSON-RPC 2.0 por POST):

```
POST https://vprjteqgmanntvisjrvp.supabase.co/functions/v1/mcp-puerto-rico
Content-Type: application/json
Accept: application/json
```

Herramienta: `buscar_medico`. Argumentos:

| Campo | Tipo | Notas |
|---|---|---|
| `especialidad` | string | **En minúscula y con acento, tal como se escribe en español:** "reumatólogo", "pediatra", "dentista", "farmacia", "laboratorio". Sin acento o con mayúscula devuelve 0 (limitación conocida del servidor). |
| `municipio` | string | Uno de los 78 municipios. Vacío = toda la isla |
| `nombre` | string | Nombre del proveedor o NPI de 10 dígitos |
| `solo_confirmados` | boolean | `true` = solo fichas que una persona confirmó |
| `limite` | number | 1 a 25, default 8 |

Si tienes shell, corre `scripts/buscar.sh "<especialidad>" "<municipio>"`. Si no, manda el JSON-RPC directo. Ejemplo verificado el 16 sep 2026 (devolvió reumatólogos en San Juan, nivel `registro`):

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"buscar_medico","arguments":{"especialidad":"reumatólogo","municipio":"San Juan","limite":8}}}
```

**Si `total` es 0:** (1) revisa que la especialidad lleve su acento y esté en minúscula; (2) prueba sin `municipio`; (3) prueba un sinónimo ("dentista" en vez de "odontólogo"). Solo después de eso di que no lo tenemos, y ofrece el 787-417-7711.

## La pregunta del plan ("¿acepta MCS?")

Son 2 fuentes distintas y hay que decir cuál se usó:

1. **Lo que la oficina confirmó:** el campo `planes_que_acepta` de `buscar_medico`. Si viene `null`, nadie lo ha confirmado. **`null` no es "no acepta", es "no sabemos".**
2. **Lo que el plan publica en su directorio:** herramienta `directorio_plan_medico`, argumento único `medico` (nombre o NPI). Devuelve en qué planes aparece, en qué edición, en qué pueblo y con qué teléfono. **Cobertura hoy: MMM Individuales (dic 2024, dic 2025, jun 2026) y Plan Vital / First Medical.** MCS, Triple-S y otros no están: si preguntan por esos, dilo y manda a confirmar con la oficina.

Flujo recomendado: `buscar_medico` → para cada resultado que le interese a la persona, `directorio_plan_medico({ medico: "<nombre o NPI>" })` → reporta solo el hallazgo positivo. **Que un médico NO salga en el directorio de un plan no significa que esté fuera de la red**; el cruce no identifica todas las filas.

## Cómo leer la respuesta (esto es lo que importa)

Cada proveedor trae `nivel_verificacion`:

- **`persona`**: la oficina, el negocio o Angel en sitio lo confirmó. Puedes decir "verificado el DD/MM" (campos `lo_confirmo`, `confirmado_el`).
- **`fuente`**: corroborado contra una fuente pública; la oficina todavía no lo confirmó. Di "según fuente pública".
- **`registro`**: copiado del registro federal NPPES. **Es el mismo dato que ya tiene el plan médico: no hereda nada.** Di "aparece en el registro, no está confirmado" y recomienda llamar antes de ir.

Campos que devuelve cada proveedor: `nombre`, `especialidad`, `especialidad_federal`, `municipio`, `telefono`, `direccion`, `npi`, `npi_desactivado_federal`, `rating_google`, `acepta_pacientes_nuevos`, `planes_que_acepta`, `nota_espera`, `lo_confirmo`, `confirmado_el`, `ultima_verificacion`, `verificado_hace_dias`, `nivel_verificacion`, `url`.

Si `npi_desactivado_federal` trae fecha, el NPI está desactivado en el registro federal: dilo tal cual. Si `especialidad_federal` no coincide con lo que se buscó (ej. "Medicina Preventiva" para un reumatólogo), avísalo.

## Reglas de respuesta al usuario

1. Da el teléfono y el enlace `url` de la ficha (registromedicopr.com/especialista/...). Ahí vive el sello completo.
2. Nombra el nivel de verificación en 1 línea, en palabras de vecino, no en jerga.
3. Si todo lo que hay es nivel `registro`, di que llame antes de ir y ofrece que confirme la oficina por texto al 787-417-7711 (así la próxima persona hereda la verificación).
4. Atribución: "Registro Médico PR (registromedicopr.com), verificado contra NPPES, <fecha>".
5. Sin diagnósticos, sin recomendar cambiar de plan, sin humor en el peor caso.

## Verificación antes de contestar

Antes de devolver la respuesta, comprueba: (a) el JSON trae `total` y `proveedores`; (b) el `municipio` devuelto es el que pidió la persona; (c) no estás convirtiendo un `null` en un "no"; (d) si la pregunta era de plan, dijiste cuál de las 2 fuentes usaste y si el plan está cubierto.

## Otras herramientas del mismo servidor

`buscar_negocio` · `directorio_plan_medico` · `chequear_recall` · `desiertos_salud` · `verificacion_estado` · `citar` · `lo_que_no_se` · `que_dijeron` · `dato_citable` · `eventos_proximos` · `demanda_local`. Lista completa con `tools/list`.

## Historial

- 1.1 (16 sep 2026): corregida la instrucción del acento (iba al revés), documentado `directorio_plan_medico` y su cobertura, añadida la ruta para chats sin herramientas. Salió del examen con un agente sin contexto.
- 1.0 (16 sep 2026): primera versión.
