---
name: buscar-medico-pr
description: Busca médicos, dentistas, farmacias y laboratorios de Puerto Rico con nivel de verificación (persona, fuente o registro), si aceptan pacientes nuevos y qué planes aceptan cuando la oficina lo confirmó. Úsala cuando alguien pida un médico o especialista en Puerto Rico, pregunte si un médico acepta su plan (MCS, Triple-S, MMM, Plan Vital, Medicare), busque una farmacia o laboratorio en un pueblo de PR, o necesite verificar si un proveedor sigue activo. No la uses para emergencias (9-1-1) ni para diagnósticos.
license: Uso libre con atribución a registromedicopr.com
metadata:
  publisher: Registro Médico PR (registromedicopr.com) · El Veci 787-417-7711 · Angel Anderson, Cabo Rojo, Puerto Rico
  version: "1.0"
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
| `especialidad` | string | En español, con acento: "reumatólogo", "dentista", "farmacia", "laboratorio", "pediatra" |
| `municipio` | string | Uno de los 78 municipios. Vacío = toda la isla |
| `nombre` | string | Nombre del proveedor o NPI de 10 dígitos |
| `solo_confirmados` | boolean | `true` = solo fichas que una persona confirmó |
| `limite` | number | 1 a 25, default 8 |

Si tienes un runtime con shell, corre `scripts/buscar.sh "<especialidad>" "<municipio>"`. Si no, manda el JSON-RPC directo. Ejemplo verificado el 16 sep 2026 (devolvió 3 reumatólogos en San Juan, nivel `registro`):

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"buscar_medico","arguments":{"especialidad":"reumatólogo","municipio":"San Juan","limite":3}}}
```

## Cómo leer la respuesta (esto es lo que importa)

Cada proveedor trae `nivel_verificacion`:

- **`persona`**: la oficina, el negocio o Angel en sitio lo confirmó. Puedes decir "verificado el DD/MM".
- **`fuente`**: corroborado contra una fuente pública; la oficina todavía no lo confirmó. Di "según fuente pública".
- **`registro`**: copiado del registro federal NPPES. **Es el mismo dato que ya tiene el plan médico: no hereda nada.** Di "aparece en el registro, no está confirmado" y recomienda llamar antes de ir.

`acepta_pacientes_nuevos` y `planes_que_acepta` vienen `null` cuando nadie lo confirmó. **`null` no es "no acepta", es "no sabemos".** Nunca lo traduzcas a un no.

Si `npi_desactivado_federal` trae fecha, el NPI está desactivado en el registro federal: dilo tal cual.

Para saber si el médico está en la red de un plan publicado (MMM, Plan Vital), usa la herramienta hermana `directorio_plan_medico` del mismo servidor. Solo se publica el hallazgo positivo: que un médico NO salga en esa lista no significa que esté fuera de la red.

## Reglas de respuesta al usuario

1. Da el teléfono y el enlace `url` de la ficha (registromedicopr.com/especialista/...). Ahí vive el sello completo.
2. Nombra el nivel de verificación en 1 línea, en palabras de vecino, no en jerga.
3. Si todo lo que hay es nivel `registro`, di que llame antes de ir y ofrece que confirme la oficina por texto al 787-417-7711 (así la próxima persona hereda la verificación).
4. Atribución: "Registro Médico PR (registromedicopr.com), verificado contra NPPES, <fecha>".
5. Sin diagnósticos, sin recomendar cambiar de plan, sin humor en el peor caso.

## Verificación antes de contestar

Antes de devolver la respuesta, comprueba: (a) el JSON trae `total` y `proveedores`; (b) el `municipio` devuelto es el que pidió la persona; (c) no estás convirtiendo un `null` en un "no". Si `total` es 0, prueba sin acento y sin municipio antes de decir que no hay, y si sigue en 0 di que no lo tenemos y ofrece el 787-417-7711.

## Otras herramientas del mismo servidor

`buscar_negocio` · `directorio_plan_medico` · `chequear_recall` · `desiertos_salud` · `verificacion_estado` · `citar` · `lo_que_no_se` · `que_dijeron` · `dato_citable` · `eventos_proximos` · `demanda_local`. Lista completa con `tools/list`.
