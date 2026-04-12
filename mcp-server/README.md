# MapaDeCaboRojo MCP Server

The Cabo Rojo business directory, exposed as an MCP-compatible JSON-RPC API. Any AI agent can query the directory without a UI.

## Endpoint

```
POST https://mapadecaborojo.com/api/mcp
```

## Discovery / Manifest

```
GET https://mapadecaborojo/.well-known/mcp.json
```

---

## Methods

### search_businesses

Search by keyword, category, or service type.

```json
{
  "method": "search_businesses",
  "params": {
    "query": "pizza",
    "category": "FOOD",
    "limit": 5
  }
}
```

### get_business

Full details for a single business by slug.

```json
{
  "method": "get_business",
  "params": {
    "slug": "antares-caribbean-cuisine"
  }
}
```

### get_categories

All categories with business counts.

```json
{
  "method": "get_categories"
}
```

### get_open_now

Businesses currently open, with optional category filter.

```json
{
  "method": "get_open_now",
  "params": {
    "category": "FOOD"
  }
}
```

---

## Example (curl)

```bash
curl -X POST https://mapadecaborojo.com/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"search_businesses","params":{"query":"dentista","limit":3}}'
```

---

## For AI Agents

### Claude Code (local MCP)

Registered in `~/.claude/mcp.json` via the bridge script at `~/.claude/tools/mapadecaborojo-mcp.sh`.

The bridge implements the MCP stdio protocol and translates calls to the HTTP API. Claude Code can call `search_businesses`, `get_business`, `get_categories`, and `get_open_now` as native tools.

### ChatGPT / GPT Actions

Use the manifest at `https://mapadecaborojo.com/.well-known/mcp.json` to configure a custom GPT action.

### Any HTTP Agent

POST directly to the endpoint with `method` + `params`. No auth required for read operations.

---

## Bridge Script (standalone usage)

```bash
# Search
~/.claude/tools/mapadecaborojo-mcp.sh search_businesses '{"query":"pizza","limit":5}'

# Get a business
~/.claude/tools/mapadecaborojo-mcp.sh get_business '{"slug":"antares-caribbean-cuisine"}'

# List categories
~/.claude/tools/mapadecaborojo-mcp.sh get_categories '{}'

# Open now
~/.claude/tools/mapadecaborojo-mcp.sh get_open_now '{"category":"FOOD"}'
```

---

## Contact

angel@caborojo.com | 787-417-7711
