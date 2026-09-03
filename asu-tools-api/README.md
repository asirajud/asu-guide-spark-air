# asu-tools-api

asu-tools-api is the tool registry and dispatch engine for the ASU AIR Spark Challenge demo. It is a Model Context Protocol server over HTTP plus a thin OpenAI-tools adapter over the same registry. Backend only, port 5000, no web framework (node:http directly). It binds 127.0.0.1 explicitly because macOS AirPlay Receiver also listens on \*:5000.

## Running it

```bash
pnpm install
pnpm start          # http://127.0.0.1:5000
curl -s http://127.0.0.1:5000/health
```

## The two faces of one registry

- POST /mcp speaks JSON-RPC 2.0 and implements initialize, ping, tools/list and tools/call. A request with no `id` is a notification and is answered with 202 and an empty body. A tool failure is reported inside a successful result as `isError: true` with the error in the content — a JSON-RPC error means the protocol call itself was malformed. That distinction is what lets a model see and recover from a bad-argument response.
- GET /openai/tools renders the same registry as an OpenAI `tools` array, so a chat model can consume it directly without the caller speaking MCP.

```bash
curl -s -X POST http://127.0.0.1:5000/mcp -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

curl -s -X POST http://127.0.0.1:5000/mcp -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_events","arguments":{"query":"robotics","limit":3}}}'
```

## The tool budget

Exactly three tools are exposed at session start — search_events, get_event_details, reserve_spot — plus list_capabilities. Every tool description is re-sent on every turn, so the descriptions are one sentence each and the schemas are tight. Anything else in the registry is reachable only by calling list_capabilities first, which keeps the per-turn prompt cost flat as the registry grows. list_capabilities is answered inside this process and is not owned by any registered service.

## Registering a new service

1. Stand up your service with a health endpoint that answers 200.
2. Write the registration object: id (lowercase, hyphens), description, baseUrl, healthPath, contractVersion (semver), and a tools array. The full JSON for a minimal one-tool service is:
3. Each tool needs name (lowercase, underscores), description (one sentence — it is re-sent every turn), route ({ method, path }, where :placeholders in the path are filled from the arguments and removed from the body), and inputSchema (a JSON Schema object with "type": "object", explicit "required", and "additionalProperties": false).
4. POST it to /registry/services. A 201 means created, a 200 means an existing id was replaced. A malformed contract comes back 400 with the offending field named, e.g. `{"error":"invalid_contract","message":"tools[0].route.method must be GET or POST"}`.
5. Alternatively add it to services.json, the checked-in seed, and POST /registry/reload. registry.json is the mutable runtime state and is written by the registry itself.
6. Confirm with GET /registry/services, which also health-checks every registered service.
7. Your new tool is immediately callable and immediately visible through list_capabilities, but it is NOT added to the session tool set — that list is deliberately fixed at three. A service is removed with `DELETE /registry/services/:id`.

## Argument validation

Every tools/call argument set is validated against the published JSON Schema with ajv BEFORE anything is dispatched. A failure never becomes a 500: it becomes a structured, machine-readable error naming each offending field, the rule it broke and a plain-English message.

```json
{
  "error": "invalid_arguments",
  "tool": "search_events",
  "message": "\"query\" is required. \"quer\" is not a parameter of this tool. \"days_ahead\" must be at most 90.",
  "fields": [
    {
      "field": "query",
      "rule": "required",
      "message": "\"query\" is required."
    },
    {
      "field": "quer",
      "rule": "additionalProperties",
      "message": "\"quer\" is not a parameter of this tool."
    },
    {
      "field": "days_ahead",
      "rule": "maximum",
      "message": "\"days_ahead\" must be at most 90."
    }
  ]
}
```

## Dispatch and failure

Dispatch is a plain HTTP call to the owning service with a 20-second timeout. Every failure mode has its own machine-readable code — unreachable, timeout, upstream_error, bad_response — carried in an envelope with the service id and a sentence a model can read out. The registry keeps working when a registered service is down: tools/list still lists its tools, GET /registry/services reports it unhealthy, and a call to it returns the `unreachable` envelope.

```json
{
  "error": "unreachable",
  "service": "asu-dining-api",
  "status": null,
  "message": "asu-dining-api is not reachable at http://127.0.0.1:5099 (fetch failed)."
}
```

## Endpoints

| Endpoint                      | Method | Description                                    |
| ----------------------------- | ------ | ---------------------------------------------- |
| GET /health                   | GET    | Health check endpoint                          |
| POST /mcp                     | POST   | JSON-RPC 2.0 endpoint for MCP                  |
| GET /mcp                      | GET    | 405, POST-only Streamable HTTP variant, no SSE |
| GET /openai/tools             | GET    | OpenAI tools array endpoint                    |
| GET /registry/services        | GET    | List registered services                       |
| POST /registry/services       | POST   | Register a new service                         |
| DELETE /registry/services/:id | DELETE | Remove a service                               |
| POST /registry/reload         | POST   | Reload services from seed                      |
| POST /tools/:name             | POST   | REST convenience wrapper over tools/call       |

## Environment

PORT (default 5000), REGISTRY_FILE (default registry.json), DISPATCH_TIMEOUT_MS (default 20000).
