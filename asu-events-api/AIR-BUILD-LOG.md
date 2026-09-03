# AIR Build Log — asu-events-api

Every line of application source in this project was written by an **ASU AIR open-weight model**
via the `opencode` CLI against `https://openai.rc.asu.edu/v1` (provider `asu`). The
human/orchestrator only ran tooling (`pnpm init`, `pnpm add`, `pnpm seed`, `tsc --noEmit`,
`eslint`, `curl`), probed the gateway to establish platform facts, inspected results, and wrote
the prompts fed to the AIR models plus this log.

Deterministic scaffold (no AI): `pnpm init`, `pnpm add drizzle-orm better-sqlite3`,
`pnpm add -D typescript tsx @types/node @types/better-sqlite3 eslint typescript-eslint @eslint/js drizzle-kit`,
and setting the `dev` / `start` / `seed` / `lint` / `typecheck` scripts in `package.json`.
`tsconfig.json` and `eslint.config.mjs` were written by the model, not copied.

All times are local (MST), 2026-09-03.

## opencode invocations

| Time | Model | Prompt (one-line summary) | Outcome | Duration |
| --- | --- | --- | --- | --- |
| 01:01 | asu/qwen3-coder-30b-a3b-instruct | `tsconfig.json` + `eslint.config.mjs` (also the harness smoke test) | OK first try | 26s |
| 01:02 | asu/qwen3-coder-30b-a3b-instruct | `src/db/schema.ts` + `src/db/index.ts` (drizzle schema with embedding BLOB, raw FTS5 DDL) | OK first try | 46s |
| 01:03 | asu/qwen3-coder-30b-a3b-instruct | `src/air.ts` (batched embeddings, rerank, Float32Array BLOB codec, cosine) | OK — but imported three of its own constants from a non-existent `./constants` | 50s |
| 01:05 | asu/qwen3-coder-30b-a3b-instruct | `src/seed.ts` (iCal parse, location-placeholder normalisation, upsert, hash-gated re-embed, FTS5 rebuild) | OK — but forgot to import the `events` table it referenced 20 times | 106s |
| 01:08 | asu/qwen3-coder-30b-a3b-instruct | FIX #1: both files at once — phantom import, `unknown` JSON narrowing, missing table import, implicit `any[]` | PARTIAL — 480s, 19 tool steps, only `air.ts` landed. A two-file fix prompt is what made it wander; every later prompt was scoped to one file | 480s |
| 01:19 | asu/qwen3-coder-30b-a3b-instruct | FIX #2: `seed.ts` — `Date` not epoch ms, `$inferInsert` typing, `excluded.*` on conflict, batches of 200 | OK | 188s |
| 01:20 | asu/qwen3-coder-30b-a3b-instruct | FIX #3: `air.ts` — narrow `unknown` in catch, rethrow `AirError` unchanged | OK | 28s |
| 01:21 | asu/qwen3-coder-30b-a3b-instruct | FIX #4: `events.id.eq(...)` → `eq(events.id, ...)` | OK | 36s |
| 01:23 | asu/qwen3-coder-30b-a3b-instruct | FIX #5: 7 eslint errors (`any`, unused imports) across both files | OK — `tsc` and `eslint` clean | 92s |
| 01:27 | asu/qwen3-coder-30b-a3b-instruct | FIX #6: seeder threw `Transaction function cannot return a promise`; bogus `Events updated: -9000` counter | OK on the transaction, left a scope bug | 78s |
| 01:29 | asu/qwen3-coder-30b-a3b-instruct | FIX #7: `embeddingsWritten` declared inside the try block, read in the summary | PARTIAL — introduced four new "cannot find name" errors | 72s |
| 01:30 | asu/qwen3-coder-30b-a3b-instruct | FIX #8: finish the counter cleanup | OK — `pnpm seed` runs clean end to end | 70s |
| 01:41 | asu/qwen3-coder-30b-a3b-instruct | `src/search.ts` — the whole engine in one file (4 stages + fusion + trace) | FAILED — the spec was too large; the model started `touch`ing the file and shelling out. Killed at ~10 min and the empty file removed | ~600s |
| 01:56 | asu/qwen3-coder-30b-a3b-instruct | `src/format.ts` (split #1: DTO shaping, Phoenix formatting, window filter) | OK, one missing type import | 28s |
| 01:57 | asu/qwen3-coder-30b-a3b-instruct | FIX: add the `EventRow` type import | OK | 30s |
| 01:58 | asu/qwen3-coder-30b-a3b-instruct | `src/stages.ts` (split #2: FTS5/bm25, dense cosine with vector cache, rerank) | OK — wrong names in the import block | 50s |
| 01:59 | asu/qwen3-coder-30b-a3b-instruct | FIX: correct the import block (`sqliteDb`, not `sqlite`) | OK — clean | 32s |
| 02:00 | asu/qwen3-coder-30b-a3b-instruct | `src/search.ts` (split #3: RRF fusion + orchestrator + trace) | OK first try | 68s |
| 02:02 | asu/qwen3-coder-30b-a3b-instruct | FIX: unused callback param, `rerankMs` never reported | OK, but moved the bug rather than fixing it | 48s |
| 02:03 | asu/qwen3-coder-30b-a3b-instruct | FIX: `rerankMs` read before its declaration (runtime `ReferenceError` on the empty-result path) | OK | 52s |
| 02:04 | asu/qwen3-coder-30b-a3b-instruct | FIX: `RERANK_MODEL` was invented as `'qwen-rerank'`, which 400s on the gateway | OK | 26s |
| 02:05 | asu/qwen3-coder-30b-a3b-instruct | FIX: BM25 bound its date window in **milliseconds**; drizzle `timestamp` mode stores **seconds**, so BM25 returned [] for every query | OK — both stages live | 40s |
| 02:07 | asu/qwen3-coder-30b-a3b-instruct | FIX: stage timers all reported 0, `movedIntoTop` compared titles (recurring events share titles), recurring events crowded the results | OK — title+club de-duplication added | 104s |
| 02:09 | asu/qwen3-coder-30b-a3b-instruct | FIX: `performance.now()` timers, drop dead initialisers | OK — clean | 82s |
| 02:10 | asu/qwen3-coder-30b-a3b-instruct | `src/server.ts` (node:http, five routes, mock-RSVP notice) | OK — passed an `EventDto` back through `toDto()` three times | 62s |
| 02:12 | asu/qwen3-coder-30b-a3b-instruct | FIX: `req.res` does not exist; the three `toDto` double-conversions | OK | 96s |
| 02:13 | asu/qwen3-coder-30b-a3b-instruct | FIX: type the request bodies now that `readJson` returns `unknown` | OK — clean | 76s |
| 02:15 | asu/qwen3-coder-30b-a3b-instruct | FIX: `GET /events/:id` 404'd on every valid id (`path.split('/')[3]`, off by one) | OK | 30s |
| 02:16 | asu/qwen3-coder-30b-a3b-instruct | FIX: `stages` recorded each stage's score where it documented a rank | OK | 66s |
| 02:55 | asu/qwen3-coder-30b-a3b-instruct | `README.md` | OK content — but transcribed its own writing instructions ("Say that…", "State that…") into the prose | 40s |
| 02:57 | asu/qwen3-coder-30b-a3b-instruct | FIX: turn every leftover imperative into the statement it asked for; real curl blocks; endpoint table | OK | 80s |

## Totals

- **31 opencode invocations**, all `asu/qwen3-coder-30b-a3b-instruct`. One run (the monolithic
  `search.ts` spec) failed outright and was replaced by three smaller ones.
- Every `.ts` / `.json` / `.mjs` / `.md` file in this project was written by that model.
- Orchestrator actions, none of them authoring app code: `pnpm init` / `pnpm add`,
  the `package.json` scripts, `pnpm seed`, `npx tsc --noEmit`, `npx eslint src`,
  `curl` probes of the AIR gateway and of the finished service, and writing the prompts + this log.

## Platform facts established by probing, then handed to the models as given

- `POST /v1/rerank` is live but undocumented, and it only accepts **`model: "qwen3-embedding-4b"`**.
  There is no reranker model id on this gateway — `qwen3-reranker-8b`, `bge-reranker-v2-m3` and
  `qwen3-rerank-4b` all 400 with "Invalid model name".
- Measured on a fixed query and four documents, `/v1/rerank`'s `relevance_score` values are
  **numerically identical to the cosine similarities of `qwen3-embedding-4b`** to four decimal
  places. The endpoint is a bi-encoder scorer, not a cross-encoder reranker.
- `qwen3-embedding-4b` returns 2,560 dimensions; embedding 1,962 events in batches of 32 took
  ~160s wall clock at ~2.5s per batch.
- Drizzle's `integer(..., { mode: 'timestamp' })` stores epoch **seconds**. Raw SQL against such a
  column must divide `Date.getTime()` by 1000. This cost one silent defect (BM25 returning nothing).

## Harness notes

- opencode 1.18.27, provider `asu`, ASU Cisco VPN required.
- Backgrounded `opencode run` given `< /dev/null`, watchdog driven off `--print-logs` with a
  **35s idle threshold**, and the model instructed to write a `.air-sentinel` file as its last
  action so "finished" is observable rather than guessed. Zero bootstrap hangs across 31 runs.
- `chdir` into the project before spawning, per the previous session's finding.
- **One file per run.** The single two-file fix prompt (01:08) burned 480s and 19 tool steps and
  landed half its edits; the single largest new-file prompt (01:41) failed completely. Splitting
  that file into `format.ts` / `stages.ts` / `search.ts` and re-prompting cost 150s total and
  worked first time in each case.
