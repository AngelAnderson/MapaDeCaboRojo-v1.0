#!/usr/bin/env bash
# Uso: buscar.sh "<especialidad>" ["<municipio>"] [limite] [solo_confirmados=true|false]
# Devuelve el JSON tal cual del servidor MCP público de Registro Médico PR. Solo lectura, sin llave.
set -euo pipefail
ESP="${1:?especialidad}"; MUN="${2:-}"; LIM="${3:-8}"; SOLO="${4:-false}"
URL="https://vprjteqgmanntvisjrvp.supabase.co/functions/v1/mcp-puerto-rico"
BODY=$(python3 -c '
import json,sys
args={"especialidad":sys.argv[1],"municipio":sys.argv[2],"limite":int(sys.argv[3]),"solo_confirmados":sys.argv[4]=="true"}
print(json.dumps({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"buscar_medico","arguments":args}},ensure_ascii=False))
' "$ESP" "$MUN" "$LIM" "$SOLO")
curl -s -m 40 -X POST "$URL" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -H 'User-Agent: skill-buscar-medico-pr/1.0' \
  --data "$BODY" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["result"]["content"][0]["text"] if "result" in d else json.dumps(d,ensure_ascii=False))'
