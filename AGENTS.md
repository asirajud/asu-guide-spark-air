# AGENTS.md — Sol (asu-guide-spark-air)

Read this before running or changing anything. It records constraints that are
expensive to rediscover, several of which fail _silently_ rather than loudly.

## What this is

A five-service monorepo. Every model call runs on ASU's self-hosted open-weight
models via `https://openai.rc.asu.edu/v1` (Intel Gaudi nodes on Sol). No
external AI vendor is used at runtime. The gateway is reachable **only on the
ASU VPN**.

| Path              | Port | What it is                                                        |
| ----------------- | ---- | ----------------------------------------------------------------- |
| `asu-guide/`      | 3000 | The assistant — Next.js 16, chat + tool loop, voice, image, video |
| `asu-sso/`        | 4000 | Mock OAuth 2.0 + PKCE identity provider                           |
| `asu-tools-api/`  | 5000 | MCP tool registry + dispatch (binds `127.0.0.1`)                  |
| `asu-events-api/` | 5001 | Hybrid BM25 + dense retrieval over events                         |
| `asu-search-api/` | 5003 | Optional Brave web search                                         |

## Toolchain — this is where builds fail

**Node 22 or newer is mandatory.** `better-sqlite3@13` targets Node-API v10;
Node 20 caps at v9, and the prebuilt addon **segfaults instead of raising an
error**. A `Segmentation fault (core dumped)` during `pnpm db:seed` or
`pnpm dev` means the wrong Node. No `engines` field declares this, and
`install.sh` only checks `node >= 20`, so nothing catches it for you.

A local Node 22 lives at `~/.local/node22/bin` — prepend it to `PATH`.
`pnpm` is a corepack shim at `~/.local/bin`. So:

```bash
export PATH="$HOME/.local/node22/bin:$HOME/.local/bin:$PATH"
```

`ffmpeg` must be on `PATH` for video; everything else works without it.

## Running

```bash
./install.sh --yes   # idempotent; reuses keys already in ./.env
./dev.sh             # all five services, prefixed logs, Ctrl-C stops them
```

Per service: `pnpm dev`. Seeding: `pnpm db:push && pnpm db:seed` in
`asu-guide`, `pnpm seed` in `asu-events-api` (the embedding pass needs the VPN;
off-VPN it seeds BM25-only). Tests: `pnpm test` (vitest) in `asu-guide`;
`pnpm typecheck` in the three plain-node services.

`dev.sh` uses `lsof` to find port squatters. Ports 3000/4000/5000/5001/5003.

## The AIR layer — never call the gateway directly

`src/lib/air/` owns every model call. Do not hand-roll `fetch` to the gateway.

- `models.ts` — an ordered model list per service (`AirService`). First entry is
  primary, the rest are fallbacks.
- `call.ts` — `callAir(service, fn)` walks that chain. It distinguishes a model
  the gateway **refuses** (unknown model, unsupported modality → benched 24h)
  from one that is merely **slow** (not benched). Preserve that distinction.

To add a capability, add an `AirService` key and its chain in `models.ts`. Do
not hardcode a model id at a call site.

`THINKING_OFF` in `models.ts` lists models that must have thinking explicitly
disabled or they answer slowly. Respect it.

## Patterns to copy, not reinvent

- **Parallel specialists + a synthesis model** — `src/app/api/video/route.ts:73`
  runs `Promise.allSettled([vision, asr])` then fuses with a `summarize` model.
  This is the template for any fan-out. `allSettled`, not `all`: one branch
  failing must not kill the request.
- **Streaming step events to the UI** — `src/app/api/chat/route.ts:92-113`
  streams **newline-delimited JSON** over a `ReadableStream`. Use NDJSON. Do not
  introduce SSE as a second transport; the client already parses this.
  There is **no token-level partial streaming** anywhere — `call.ts` never sends
  `stream: true`, and adding it would break the retry logic, since a model that
  fails mid-stream cannot be cleanly retried.
- **Bounded round loops** — `src/app/api/chat/route.ts:135` caps tool rounds and
  withholds tools on the final round to force a text answer. Any agentic loop
  needs a hard cap and a forced exit.

## Long-running servers — never in the foreground of a tool call

`pnpm dev` (`next dev`), `./dev.sh`, and the three `tsx watch` services run
forever. A backgrounded job still inherits the shell's stdout, and an agent's
bash tool reads that pipe until EOF — so `pnpm dev &` **hangs the tool call
indefinitely even though the server started fine**. It looks exactly like a
stalled model; it is not.

Detach the pipe, in a subshell:

```bash
cd asu-guide && (nohup pnpm dev > /tmp/next-dev.log 2>&1 & echo $! > /tmp/next-dev.pid)
```

Then poll instead of waiting, and give Turbopack time to compile the route on
the first request (it can take 30s+ before the first response):

```bash
curl -s -o /dev/null -w '%{http_code}\n' --max-time 60 http://127.0.0.1:3000
```

Read `/tmp/next-dev.log` for startup errors. Stop it with the recorded pid, not
by killing every node process. Note that `$!` after a `pnpm`/`npm` wrapper is
the wrapper, not the server — confirm with `pgrep -f next-server`.

## Test evidence goes in the repo, never `/tmp`

`permission.external_directory` is `deny`, so anything outside this repo is
unreadable — and the orchestrator additionally has `bash: deny`, so it cannot
`cat` its way around that. Evidence written to `/tmp` **cannot be verified by
the agent that dispatched the work**, which is how a subagent came to report
passing smoke tests it had never run.

Write every artifact under `.council-smoke/` (gitignored) instead:

```bash
mkdir -p .council-smoke
(nohup pnpm dev > .council-smoke/dev.log 2>&1 & echo $! > .council-smoke/dev.pid)
curl -s -D .council-smoke/session.headers -o .council-smoke/session.json ...
```

A report is a claim; the file on disk is the evidence. Paste verbatim command
output into the reply as well — never a summary of what the output "should"
have been.

## Model constraints (measured on this cluster, not guessed)

- **Long output must be returned as message content, never as a tool-call
  argument.** `qwen35-27b` writes a 2-character payload reliably and a document
  not at all — the tool call collapses with truncated JSON and no `content` key.
  Have models emit prose; parse server-side.
- **`gpt-oss-120b`** emits malformed JSON in tool arguments. Fine for prose (it
  is a fallback in the `chat` chain), unsafe for tool-calling paths. It also
  needs a raised reasoning budget — at ~400 tokens it spends the lot thinking
  and returns one word (see the comment at `models.ts:38`).
- **`glm-5-3-flash`** — do not use. 1/4 on agentic tasks with silent ~300s
  stalls. A serving problem, not a capability one.
- **`qwen3-30b-a3b-instruct-2507`** — do not use for reasoning or agentic work;
  it returns confidently wrong answers with no error. It is fine and already in
  use as the primary for `title` and `summarize`, which are not reasoning tasks.
  Do not rip it out of those chains.
- **`qwen3-235b-a22b-*`** — correct but 160s–280s. Never in an interactive path.

## Secrets

`RC_OPENAI_API_KEY` is server-side only. It lives in `./.env`,
`asu-guide/.env.local`, and `asu-search-api/.env` — all gitignored. It must
never reach a client bundle. `asu-sso/clients.json` holds deliberately fake,
committed demo credentials; that file is not a leak.

`asu-guide/.env.example` documents the required vars. `APP_URL` must be
`http://localhost:3000` — it is the OAuth redirect origin, and
`asu-sso/clients.json` registers only that exact callback. The code default is
`:3001`, which silently breaks sign-in.

## Data sources — what exists

ASU has no public developer API. `developer.asu.edu`, `api.asu.edu`,
`events.asu.edu`, `shuttle.asu.edu`, `clubs.asu.edu` do **not resolve in DNS**.
Do not design against them.

| Source            | Endpoint                       | Status                                                                              |
| ----------------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| ASU AIR           | `openai.rc.asu.edu/v1`         | Confirmed working (VPN only)                                                        |
| Sun Devil Central | `sundevilcentral.eoss.asu.edu` | Unconfirmed — ICS documented, CampusGroups-backed                                   |
| ASU Events        | `asuevents.asu.edu`            | Unconfirmed — Drupal 10; **not** Localist (`/api/2/events` 404s)                    |
| ASU LibCal        | `asu.libcal.com`               | API needs an institutional key; public pages scrapeable                             |
| Canvas LMS        | `canvas.asu.edu`               | Available via per-user tokens; deferred                                             |
| OpenStreetMap     | `overpass-api.de`              | Confirmed open, no key                                                              |
| Speech models     | —                              | **None exist in the AIR catalog** — text and vision only. Speech must be on-device. |

Sun Devil **Sync** was retired in May 2025. Anything referencing it is stale;
the live platform is Sun Devil **Central**.

Put every external source behind an adapter with a fixture implementation.
Demos run off fixtures; no live scrape on a demo path.

## Conventions

- Prettier via the `.githooks/pre-commit` hook; `pnpm format` at the root.
- `asu-guide/AGENTS.md` is a 9-line block generated by `next dev` — it is not a
  project guide, and removing it only re-creates it.
- Event data is public listings only. No student records or PII reaches the
  gateway; see `docs/PRIVACY-AND-MEMORY.md`.
