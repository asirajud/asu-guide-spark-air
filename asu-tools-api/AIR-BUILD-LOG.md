# AIR Build Log — asu-tools-api

Every line of application source in this project was written by an **ASU AIR open-weight model**
via the `opencode` CLI against `https://openai.rc.asu.edu/v1` (provider `asu`). The
human/orchestrator only ran tooling (`pnpm init`, `pnpm add`, `tsc --noEmit`, `eslint`, `curl`),
inspected results, and wrote the prompts plus this log.

Deterministic scaffold (no AI): `pnpm init`, `pnpm add ajv ajv-formats`,
`pnpm add -D typescript tsx @types/node eslint typescript-eslint @eslint/js`, and setting the
`dev` / `start` / `lint` / `typecheck` scripts. `tsconfig.json`, `eslint.config.mjs` and
`services.json` were written by the model.

All times are local (MST), 2026-09-03.

## opencode invocations

| Time  | Model                            | Prompt (one-line summary)                                                                                                              | Outcome                                                                                                                                   | Duration |
| ----- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 02:19 | asu/qwen3-coder-30b-a3b-instruct | `tsconfig.json`, `eslint.config.mjs`, `services.json` (the seed registry: one service, three tools with full JSON Schemas)             | OK first try                                                                                                                              | 48s      |
| 02:21 | asu/qwen3-coder-30b-a3b-instruct | `src/registry.ts` (load/persist, hand-written contract validation, tool lookup, `SESSION_TOOLS`)                                       | OK first try, typecheck clean                                                                                                             | 68s      |
| 02:22 | asu/qwen3-coder-30b-a3b-instruct | `src/validate.ts` (ajv wrapper, field-level recoverable errors, `describeSchema`)                                                      | OK — one `{}`-typed `.includes`                                                                                                           | 40s      |
| 02:22 | asu/qwen3-coder-30b-a3b-instruct | FIX: narrow `inputSchema.required` before use                                                                                          | OK, surfaced one more                                                                                                                     | 30s      |
| 02:24 | asu/qwen3-coder-30b-a3b-instruct | FIX: `prop` unknown, `preserve-caught-error`, `no-case-declarations`                                                                   | OK                                                                                                                                        | 54s      |
| 02:25 | asu/qwen3-coder-30b-a3b-instruct | FIX: `registry.ts` — unused catch bindings, six `any`s                                                                                 | OK                                                                                                                                        | 84s      |
| 02:26 | asu/qwen3-coder-30b-a3b-instruct | FIX: five `no-useless-escape` in an error **message** the model had written as if it were a regex                                      | OK — clean                                                                                                                                | 26s      |
| 02:27 | asu/qwen3-coder-30b-a3b-instruct | `src/dispatch.ts` (path-param substitution, timeout, four-code error envelope, health check)                                           | OK — read `entry.route` where the type is `entry.tool.route`                                                                              | 48s      |
| 02:30 | asu/qwen3-coder-30b-a3b-instruct | FIX: `RegisteredTool` field paths, `unknown` JSON narrowing, `any` removal                                                             | OK, left one stale `tool.` reference                                                                                                      | 186s     |
| 02:32 | asu/qwen3-coder-30b-a3b-instruct | FIX: last bare `tool.` reference; collapse a dead `let` into a ternary                                                                 | OK — clean                                                                                                                                | 84s      |
| 02:33 | asu/qwen3-coder-30b-a3b-instruct | `src/mcp.ts` (JSON-RPC, `initialize`/`ping`/`tools/list`/`tools/call`, notifications, `list_capabilities`, OpenAI adapter)             | OK first try functionally                                                                                                                 | 56s      |
| 02:35 | asu/qwen3-coder-30b-a3b-instruct | FIX: six eslint errors (`any` in the RPC narrowing, case-block declarations)                                                           | OK                                                                                                                                        | 62s      |
| 02:36 | asu/qwen3-coder-30b-a3b-instruct | `src/server.ts` (node:http, MCP endpoint, registry CRUD, OpenAI adapter, debug wrapper)                                                | OK — but wrote `server.listen(127.0.0.1, PORT, …)`, which is not valid JavaScript                                                         | 60s      |
| 02:37 | asu/qwen3-coder-30b-a3b-instruct | FIX: quoted host + correct `listen(port, host, cb)` order; `allTools()` shape                                                          | OK                                                                                                                                        | 28s      |
| 02:38 | asu/qwen3-coder-30b-a3b-instruct | FIX: `upsertService` has no `tools` field; unused import                                                                               | OK — service boots                                                                                                                        | 42s      |
| 02:39 | asu/qwen3-coder-30b-a3b-instruct | FIX: every response envelope carried `"jsonrpc": "2025-06-18"` — the MCP protocol date had been put in the JSON-RPC wire-version field | OK                                                                                                                                        | 30s      |
| 02:39 | asu/qwen3-coder-30b-a3b-instruct | FIX: bound-violation messages read `must be <= or >= 90`; split into at most / at least                                                | OK                                                                                                                                        | 28s      |
| 02:40 | asu/qwen3-coder-30b-a3b-instruct | FIX: the `JsonRpcResponse` type still pinned `jsonrpc` to the protocol date                                                            | OK — clean                                                                                                                                | 26s      |
| 02:58 | asu/qwen3-coder-30b-a3b-instruct | `README.md`                                                                                                                            | OK content, same instruction-transcription problem as the sibling project                                                                 | 40s      |
| 03:00 | asu/qwen3-coder-30b-a3b-instruct | FIX: real curl blocks, real JSON envelopes                                                                                             | PARTIAL — four instruction fragments survived                                                                                             | 102s     |
| 03:02 | **asu/devstral2-123b**           | FIX: whole-document copy-edit pass over the README                                                                                     | OK — clean. The only escalation in the session; the 30b model kept fixing the fragments it was pointed at and missing the ones it was not | 96s      |

## Totals

- **21 opencode invocations**: 20 × `qwen3-coder-30b-a3b-instruct`, 1 × `devstral2-123b`.
- Every `.ts` / `.json` / `.mjs` / `.md` file in this project was written by those models.
- Orchestrator actions: `pnpm init` / `pnpm add`, the `package.json` scripts,
  `npx tsc --noEmit`, `npx eslint src`, `curl` exercising the MCP surface (including registering
  and then deleting a second, deliberately-dead service to prove the failure path), and writing
  the prompts + this log.

## Verified end to end with curl

- `initialize` → protocol `2025-06-18`; `notifications/initialized` → 202, empty body.
- `tools/list` → exactly four tools (the three-tool session budget plus `list_capabilities`).
- `tools/call` with a missing required field, an unknown field and an out-of-range number →
  one `invalid_arguments` envelope naming all three, inside `isError: true` rather than a 500.
- Registering `asu-dining-api` pointing at a port with nothing on it: it appears in
  `list_capabilities` with `loaded_at_session_start: false`, `GET /registry/services` reports it
  unhealthy, calling its tool returns the `unreachable` envelope, and the session tool list is
  unchanged at four. A malformed contract is rejected 400 with the offending field named.

## Harness notes

Same as the sibling project: `< /dev/null` on backgrounded runs, a `--print-logs` watchdog with a
35s idle threshold, a model-written `.air-sentinel` as the completion signal, `chdir` before
spawning, and one file per prompt. Twenty-one runs, zero bootstrap hangs, zero watchdog kills.
