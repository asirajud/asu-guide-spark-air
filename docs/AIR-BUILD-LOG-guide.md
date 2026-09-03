# AIR Build Log — asu-guide-air

Every line of application source in this project was written by an **ASU AIR open-weight model**
via the `opencode` CLI against `https://openai.rc.asu.edu/v1` (provider `asu`).
The human/orchestrator only ran tooling (`pnpm`, `create-next-app`, `shadcn init`, `pnpm dev`),
copied the data file, inspected results, and wrote the prompts fed to the AIR models.

Deterministic scaffold (no AI): `pnpm create next-app` (TS/Tailwind/App Router/src dir),
`pnpm add drizzle-orm better-sqlite3`, `pnpm dlx shadcn init && shadcn add button card badge`.

## opencode invocations

| Time  | Model                            | Prompt (one-line summary)                                                                                                | Outcome                                                                                                                                                   | Duration |
| ----- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 03:45 | asu/qwen3-coder-30b-a3b-instruct | two-file db schema + client in one prompt                                                                                | FAILED — no output after 600s, killed (prompt too broad)                                                                                                  | 600s     |
| 03:56 | asu/qwen3-coder-30b-a3b-instruct | smoke test: write hello.txt                                                                                              | OK (harness verified)                                                                                                                                     | 38s      |
| 04:04 | asu/qwen3-coder-30b-a3b-instruct | write `src/db/schema.ts` (drizzle sqlite events table)                                                                   | OK, correct first try                                                                                                                                     | 8s       |
| 04:09 | asu/qwen3-coder-30b-a3b-instruct | write `src/db/index.ts` (better-sqlite3 + drizzle client, WAL, hot-reload global cache)                                  | OK first try (1 cold-start stall, retried)                                                                                                                | 16s      |
| 04:14 | asu/qwen3-coder-30b-a3b-instruct | write `scripts/seed.ts` (iCal ts -> epoch, skip blank titles, null out "Sign in to download the location", batch insert) | OK — seeded 1962/1962, but wrote `org_url` instead of `orgUrl` so that column came back NULL                                                              | 45s      |
| 04:22 | asu/qwen3-coder-30b-a3b-instruct | FIX #1: orgUrl key mismatch + type batches as `$inferInsert`                                                             | OK, bug fixed by the model from the error report                                                                                                          | 114s     |
| 04:30 | asu/qwen3-coder-30b-a3b-instruct | write `src/lib/events.ts` (DEMO_NOW, formatWhen, venueLabel, truncate, getRecommendedEvents, searchEvents)               | OK — good logic, but verbose/triplicated and a nullable-column type error                                                                                 | 56s      |
| 04:33 | asu/qwen3-coder-30b-a3b-instruct | write `src/app/api/events/route.ts`                                                                                      | OK first try                                                                                                                                              | 17s      |
| 04:35 | asu/qwen3-coder-30b-a3b-instruct | rewrite `src/app/layout.tsx` (Inter via next/font, black body, viewport)                                                 | OK first try                                                                                                                                              | 20s      |
| 04:36 | asu/qwen3-coder-30b-a3b-instruct | append Gemini design tokens + `.g-glow` / `.g-shimmer` / `.g-fade-up` to `globals.css`                                   | OK first try, shadcn tokens left intact                                                                                                                   | 33s      |
| 04:40 | asu/qwen3-coder-30b-a3b-instruct | write `src/components/icons.tsx` (Sparkle, Menu, Pencil, Chevron, Plus, Mic, Waveform, Check)                            | OK — but Mic rendered as a blob and the Sparkle gradient showed only 2 of 5 colours                                                                       | 47s      |
| 04:43 | asu/qwen3-coder-30b-a3b-instruct | write `src/components/chat-header.tsx` (48px circular buttons, "ASU Guide"+"AIR"+chevron+blue dot)                       | OK first try, pixel-accurate                                                                                                                              | 49s      |
| 04:45 | asu/qwen3-coder-30b-a3b-instruct | write `src/components/composer.tsx` (64px pill, +, mic, blue send)                                                       | OK first try                                                                                                                                              | 24s      |
| 04:48 | asu/qwen3-coder-30b-a3b-instruct | write `src/components/event-card.tsx` (Register -> Registered flip)                                                      | OK first try                                                                                                                                              | 32s      |
| 04:49 | asu/qwen3-coder-30b-a3b-instruct | write `src/components/empty-state.tsx` (sparkle + headline + chips)                                                      | OK first try                                                                                                                                              | 17s      |
| 04:52 | asu/devstral2-123b               | write `src/components/chat.tsx` — the scripted-flow orchestrator (600ms beat, char streaming, cards after)               | Logic all correct; emitted `use client;` WITHOUT quotes -> TS1434                                                                                         | 66s      |
| 04:55 | asu/qwen3-coder-30b-a3b-instruct | rewrite `src/app/page.tsx`                                                                                               | OK first try                                                                                                                                              | 10s      |
| 04:57 | asu/qwen3-coder-30b-a3b-instruct | FIX #2: restore the `"use client"` directive quotes                                                                      | OK                                                                                                                                                        | 14s      |
| 05:00 | asu/devstral2-123b               | FIX #3: `EventCardData.url` nullable type error x6 + extract `toCard()` + dedupe by id across fallback passes            | OK, one failed edit (ambiguous oldString) then succeeded; typecheck clean                                                                                 | 174s     |
| 05:06 | asu/devstral2-123b               | FIX #4: times rendered as "1:30 AM" — switch `formatWhen` to America/Phoenix, keep UTC-midnight all-day heuristic        | OK, correct                                                                                                                                               | 43s      |
| 05:12 | asu/qwen3-coder-30b-a3b-instruct | FIX #5: `DEMO_NOW` -> Phoenix midnight so cards stop showing Sep 1                                                       | OK                                                                                                                                                        | 21s      |
| 05:14 | asu/devstral2-123b               | polish: sparkle gradient, mic icon, headline nowrap, stronger `.g-glow`                                                  | PARTIAL — only the CSS edit landed; 3 edits failed because it did not Read the files first                                                                | 109s     |
| 05:18 | asu/devstral2-123b               | retry polish with "Read the file first" instruction                                                                      | OK — all three edits landed                                                                                                                               | 48s      |
| 05:22 | asu/qwen3-coder-30b-a3b-instruct | sparkle gradient stops pushed inward (concave star hid the end stops)                                                    | OK                                                                                                                                                        | 24s      |
| 05:26 | asu/devstral2-123b               | FIX #6: streamed greeting rendered as "ey Azhar" (leading H dropped)                                                     | FAILED — looped ~25x on "oldString and newString are identical", killed at 420s                                                                           | 421s     |
| 05:34 | asu/qwen3-coder-30b-a3b-instruct | FIX #6 retry, prescribing an idempotent `GREETING.slice(0, index)` instead of append                                     | OK — greeting now renders in full                                                                                                                         | 31s      |
| 05:37 | asu/qwen3-coder-30b-a3b-instruct | write `README.md` (run steps, data provenance, "responses are scripted")                                                 | OK first try                                                                                                                                              | 28s      |
| 05:40 | asu/gpt-oss-120b                 | REVIEW: read the 5 core files, report real bugs only                                                                     | OK — 4 findings; 2 valid (unmount race, duplicated pass logic), 2 false positives (drizzle `sql` already parameterises; all-day heuristic is intentional) | 205s     |
| 05:46 | asu/qwen3-coder-30b-a3b-instruct | write `src/app/global-error.tsx` + `src/app/not-found.tsx` to fix a `pnpm build` prerender crash                         | Files written correctly, but the crash is an upstream Next.js 16 `_global-error` bug and persists. `pnpm dev` is unaffected.                              | 18s      |

## Totals

- **26 opencode invocations** that reached a model (plus 3 that stalled at opencode's own bootstrap and were auto-retried).
- Models: `qwen3-coder-30b-a3b-instruct` x18, `devstral2-123b` x6, `gpt-oss-120b` x1 (review), plus one smoke test.
- Every `.ts`/`.tsx`/`.css`/`.md` file under `src/`, `scripts/` and the README was written or edited **only** by those models.
- Human/orchestrator actions, none of them authoring app code: `pnpm create next-app`, `pnpm add`, `pnpm dlx shadcn init/add`,
  copying `asu-events.json`, adding the `db:seed` / `dev --port 3001` npm scripts, running `pnpm db:seed` / `tsc --noEmit` / `pnpm dev` / `pnpm build`,
  driving the browser to look at the result, and writing the prompts + this log.

## Harness notes (for reproducing)

- opencode 1.18.27, provider `asu` -> `https://openai.rc.asu.edu/v1`, ASU Cisco VPN required.
- Backgrounded `opencode run` must be given `< /dev/null`; without it roughly half of all runs hang at bootstrap before creating a session.
- `opencode run` frequently writes the file in 8-30s and then hangs on the closing assistant turn. Runs here were driven by a watchdog that
  polls `--print-logs` output and kills the process once the edits have landed and the stream goes idle.

---

# Session 2 — SSO login (2026-09-02, 22:43–22:54 MST)

Wiring this app up as an OAuth 2.0 **client** of the mock identity provider in `../asu-sso`
(see that project's `AIR-BUILD-LOG.md` for the IdP side). Same rules: every line of application
source written by an ASU AIR model through `opencode`; the orchestrator only ran tooling,
inspected results, drove a browser, and wrote the prompts.

## opencode invocations

| Time  | Model                            | Prompt (one-line summary)                                                                                                                               | Outcome                                                                                                                   | Duration |
| ----- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| 22:43 | asu/qwen3-coder-30b-a3b-instruct | write `.env.example` + `src/lib/sso.ts` (config consts, PKCE verifier/challenge, `authorizeUrl`, `exchangeCode`, `fetchUserInfo`)                       | OK first try                                                                                                              | 39s      |
| 22:44 | asu/qwen3-coder-30b-a3b-instruct | write `src/lib/session.ts` (HMAC-signed cookie sign/verify, async `getSession()`)                                                                       | OK first try                                                                                                              | 28s      |
| 22:45 | asu/qwen3-coder-30b-a3b-instruct | write `src/app/api/auth/login/route.ts` + `.../logout/route.ts`                                                                                         | OK first try                                                                                                              | 20s      |
| 22:45 | asu/qwen3-coder-30b-a3b-instruct | write `src/app/api/auth/callback/route.ts` (state check, code+verifier exchange, userinfo, set session)                                                 | OK — but destructured `url.searchParams` as if it were a plain object (`const { code, state, error } = url.searchParams`) | 22s      |
| 22:46 | asu/qwen3-coder-30b-a3b-instruct | write `src/components/user-menu.tsx` (Sign-in pill / avatar badge + dropdown, outside-click and Escape close)                                           | OK first try, including the `"use client"` quoting that tripped devstral in session 1                                     | 30s      |
| 22:47 | asu/qwen3-coder-30b-a3b-instruct | edit `src/components/chat-header.tsx` (accept `asurite`, mount `UserMenu`) + rewrite `src/app/page.tsx` (`await getSession()`)                          | OK first try                                                                                                              | 87s      |
| 22:49 | asu/qwen3-coder-30b-a3b-instruct | edit `src/components/chat.tsx` (`greetingFor(asurite)`, thread props, AI-disclaimer footnote) + `src/components/empty-state.tsx` (conditional headline) | OK first try — the fragile `GREETING.slice(0, index)` streaming loop survived intact                                      | 104s     |
| 22:51 | asu/qwen3-coder-30b-a3b-instruct | FIX #1: `URLSearchParams` destructuring (3x TS2339), fed back verbatim                                                                                  | OK — `tsc --noEmit` clean                                                                                                 | 29s      |
| 22:53 | asu/qwen3-coder-30b-a3b-instruct | append a `## Sign-in (demo SSO)` section to `README.md` without disturbing the existing sections                                                        | OK first try                                                                                                              | 43s      |

## Session 2 totals

- **9 opencode invocations**, all reaching a model, all `qwen3-coder-30b-a3b-instruct`. One defect (the `URLSearchParams` destructure), fixed on the first retry. `devstral2-123b` was not needed — nothing here required multi-file reasoning beyond a two-file edit.
- New files, all model-written: `.env.example`, `src/lib/sso.ts`, `src/lib/session.ts`, `src/app/api/auth/{login,callback,logout}/route.ts`, `src/components/user-menu.tsx`.
- Edited by models: `src/app/page.tsx`, `src/components/chat.tsx`, `src/components/chat-header.tsx`, `src/components/empty-state.tsx`, `README.md`.
- Orchestrator actions: `pnpm exec tsc --noEmit`, `pnpm dev`, a scripted `curl` round-trip of the whole handshake, driving Chrome through sign-in / greeting / avatar menu / sign-out, and writing the prompts + this log.

## Verified end to end

`/api/auth/login` -> IdP `/authorize` (demo sign-in page) -> form POST -> `code` + `state` back to
`/api/auth/callback` -> token exchange with `code_verifier` (PKCE S256 verified server-side) ->
`/api/userinfo` -> signed `asu_guide_session` cookie -> home page renders the `asirajud` avatar badge
and the assistant greets "Hey asirajud". Reload keeps the session; Sign out clears it and the header
falls back to the "Sign in" pill. Negative paths confirmed too: a wrong `code_verifier`, a reused
authorization code, and a bad client secret are all rejected by the IdP.

## Harness notes

Both fixes carried over from session 1 held up. `< /dev/null` on backgrounded runs: zero bootstrap
hangs in 25 runs across both projects. The write-then-hang behaviour still exists but was much rarer
this time — only 2 of 25 runs needed the watchdog kill. One new gotcha found: when the target
directory is not a git repo, opencode resolves its instance directory from the launching shell's cwd
and ignores the spawned process's `cwd`, so files land in the wrong place. Always `chdir` into the
project before spawning.

---

# Session 3 — ASU brand, a real chat model, mic-only composer (2026-09-03, 00:21–00:55 MST)

Three changes: swap the Google-blue accent layer for ASU maroon/gold, replace the scripted
`scriptedReply()` with a genuine multi-turn conversation against an AIR reasoning model that keeps
context across modalities, and reduce the composer to a mic that swaps to a send control. Same rules
as before: every line of application source written by an ASU AIR model through `opencode`; the
orchestrator only ran tooling, benchmarked the gateway with `curl`, drove a browser, and wrote the
prompts and this log.

## opencode invocations

| Time (MST) | Model                            | Prompt (one-line summary)                                                                                                         | Outcome                                                                                               | Duration |
| ---------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| 00:21      | asu/qwen3-coder-30b-a3b-instruct | `globals.css`: add `--asu-*` tokens, `@theme` aliases, maroon ambient glow                                                        | PARTIAL — only the `:root` tokens landed; the watchdog killed the run after the first edit            | 90s      |
| 00:23      | asu/qwen3-coder-30b-a3b-instruct | `globals.css`: the two remaining edits, re-specified                                                                              | OK                                                                                                    | 114s     |
| 00:26      | asu/qwen3-coder-30b-a3b-instruct | `icons.tsx`: Sparkle gradient rainbow → maroon→gold                                                                               | OK first try                                                                                          | 109s     |
| 00:28      | asu/qwen3-coder-30b-a3b-instruct | `header.tsx`: status dot → gold, avatar ring + Sign-in pill → maroon                                                              | OK first try                                                                                          | 178s     |
| 00:28      | asu/qwen3-coder-30b-a3b-instruct | `event-card.tsx`: "Registered" state → gold on maroon tint                                                                        | OK first try                                                                                          | 187s     |
| 00:28      | asu/qwen3-coder-30b-a3b-instruct | `side-nav.tsx`: active row → maroon, footer avatar ring                                                                           | OK first try                                                                                          | 78s      |
| 00:32      | asu/qwen3-coder-30b-a3b-instruct | `icons.tsx`: add a `SendArrow` icon                                                                                               | OK first try                                                                                          | 37s      |
| 00:33      | asu/qwen3-coder-30b-a3b-instruct | `models.ts`: reorder the `chat` service list                                                                                      | OK (later corrected — see 00:36)                                                                      | 52s      |
| 00:33      | asu/qwen3-coder-30b-a3b-instruct | `events.ts`: add `shortlistEvents(query, limit)` — query-relevance ranking over the same window/quality filter as `getDemoEvents` | OK first try, typechecked                                                                             | 58s      |
| 00:36      | asu/qwen3-coder-30b-a3b-instruct | NEW `src/app/api/chat/route.ts` — full history + event grounding + `EVENTS: n,n` citation parsing                                 | OK first try; one prompt-authoring slip left a line break inside a quoted marker in the system prompt | 57s      |
| 00:36      | asu/qwen3-coder-30b-a3b-instruct | `models.ts`: correct the `chat` order after benchmarking (see below)                                                              | OK                                                                                                    | 39s      |
| 00:38      | asu/qwen3-coder-30b-a3b-instruct | `composer.tsx`: delete the blue waveform button, mic ⇄ gold send swap                                                             | OK first try                                                                                          | 58s      |
| 00:40      | asu/qwen3-coder-30b-a3b-instruct | `chat.tsx`: full rewrite — `Turn[]` thread, real `/api/chat` loop, media turns folded into history, scroll-to-bottom              | OK first try; slowest run of the session                                                              | 445s     |
| 00:41      | asu/qwen3-coder-30b-a3b-instruct | `app-shell.tsx`: per-turn persistence, lazy conversation creation via a promise ref, whole-thread restore                         | OK first try                                                                                          | 61s      |
| 00:49      | asu/qwen3-coder-30b-a3b-instruct | FIX: unused `busy`, stray spec comment, empty-reply guard, stale "blue glow" comment                                              | OK                                                                                                    | 78s      |
| 00:49      | asu/qwen3-coder-30b-a3b-instruct | FIX: unused `err`, repair the split system-prompt line, add an event-card backstop                                                | OK                                                                                                    | 54s      |
| 00:52      | asu/qwen3-coder-30b-a3b-instruct | FIX: backstop must stand down when the model has just said it has nothing                                                         | OK                                                                                                    | 33s      |
| 00:54      | asu/qwen3-coder-30b-a3b-instruct | FIX: a silent voice clip left the composer stuck behind the transcribing spinner (pre-existing, exposed by the rewrite)           | OK                                                                                                    | 55s      |

## Session 3 totals

- **18 opencode invocations**, all reaching a model, all `asu/qwen3-coder-30b-a3b-instruct`.
  `devstral2-123b` was not needed — every step was one file, spec'd at near-pseudocode density.
  `gpt-oss-120b` was not used as a reviewer (it still emits Harmony tokens agentically).
- Four defects total, all fixed on the first retry: one truncated multi-edit run (watchdog, not the
  model), two lint-level leftovers, and one latent voice bug the rewrite surfaced.
- New file, model-written: `src/app/api/chat/route.ts`.
  Edited by models: `globals.css`, `icons.tsx`, `header.tsx`, `event-card.tsx`, `side-nav.tsx`,
  `composer.tsx`, `chat.tsx`, `app-shell.tsx`, `lib/air/models.ts`, `lib/events.ts`.
- Orchestrator actions, none of them authoring app code: `npx tsc --noEmit`, `npx eslint src`,
  `curl` benchmarks against the gateway, driving Chrome through the whole flow, and writing the
  prompts + this log.

## Which chat model, and why

Benchmarked with `curl` on a 4-turn cross-modal prompt (a vision-model flyer description followed by
"what time was that again, and is there anything robotics-y before it?"), 400 output tokens, all
three cited the right events:

| Model                           | Latency         | Notes                                                                                                                                                                                                |
| ------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `qwen35-27b` (thinking off)     | **1.7s**        | clean prose, correct `EVENTS:` line                                                                                                                                                                  |
| `gpt-oss-120b`                  | 7.1s → one word | spent the entire 400-token budget on `reasoning_content`. At `max_tokens: 900` + `reasoning_effort: 'low'` it answers correctly in 3.4s, but emits U+202F narrow no-break spaces that render as tofu |
| `qwen3-235b-a22b-instruct-2507` | 21.0s           | correct, far too slow for a chat turn                                                                                                                                                                |

So the brief's suggested order was inverted: `chat: ['qwen35-27b', 'gpt-oss-120b',
'qwen3-235b-a22b-instruct-2507']`. The route special-cases `gpt-oss*` (bigger ceiling, reasoning
dialled down) so the fallback is actually usable, and normalises U+202F/U+00A0 out of every reply.

## Cross-modal context retention — how it was tested

The specialist models' output is stored as an assistant message with `kind: 'vision'`, and the chat
route re-labels it as `[Media the student shared earlier, as read by an ASU AIR vision or speech
model]: …` on every subsequent turn. Verified end to end in the browser: a generated flyer
("Midnight Build Night, Friday September 11, 8:30 PM – 1:00 AM, Brickyard Engineering 210") was
uploaded, read by `gemma4-31b-it` in 3.3s, and two turns later "what time does that one start and
which room was it in?" was answered from the description by `qwen35-27b` — including an honest "the
room number isn't visible in the cropped image". All eight turns, vision ones included, came back
from SQLite with their kinds intact after a reload.

---

# Session 4 — decoupled retrieval + tool-registry services, real tool calling (2026-09-03, 01:00–03:10 MST)

Two new backend services were built alongside this app, each with its own build log:
`../asu-events-api/AIR-BUILD-LOG.md` (31 runs) and `../asu-tools-api/AIR-BUILD-LOG.md` (21 runs).
This section covers only the changes made **inside `asu-guide`** to consume them. Same rules as
before: every line of application source written by an ASU AIR model through `opencode`; the
orchestrator ran tooling, drove a browser, and wrote the prompts and this log.

The change in substance: the regex `shortlistEvents()` grounding is gone. Events are no longer
pasted into the system prompt at all. `/api/chat` now fetches an OpenAI-shaped tool array from
`asu-tools-api` at session start and runs a real tool-calling loop, capped at three rounds per
user turn, and the event cards render from actual tool results rather than from a keyword
citation heuristic.

## opencode invocations

| Time  | Model                            | Prompt (one-line summary)                                                                                       | Outcome                                                                                                     | Duration |
| ----- | -------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| 02:42 | asu/qwen3-coder-30b-a3b-instruct | new `src/lib/tools.ts` (registry client, process-level tool cache, MCP `tools/call` dispatch, result trimming)  | OK — one nullable-cache type error                                                                          | 54s      |
| 02:44 | asu/qwen3-coder-30b-a3b-instruct | FIX: narrow the cache guard so `getTools()` cannot return null                                                  | PARTIAL                                                                                                     | 80s      |
| 02:45 | asu/qwen3-coder-30b-a3b-instruct | FIX: assign to a local before returning; narrow `res.json()`; drop an `any`                                     | OK                                                                                                          | 32s      |
| 02:46 | asu/qwen3-coder-30b-a3b-instruct | FIX: narrow the reservation shape in `extractEvents`                                                            | PARTIAL — same class of error moved down the file                                                           | 50s      |
| 02:47 | asu/qwen3-coder-30b-a3b-instruct | FIX: type the collected array as `Record<string, unknown>[]` at the point it is built                           | OK — clean                                                                                                  | 56s      |
| 02:49 | asu/qwen3-coder-30b-a3b-instruct | full rewrite of `src/app/api/chat/route.ts` — tool loop, 3-round cap, shortlist and `EVENTS:` heuristic deleted | Logic right, but invented a `callAir(service, {options})` signature and a `gpt-4o` default                  | 56s      |
| 02:50 | asu/qwen3-coder-30b-a3b-instruct | FIX: use the real `callAir(service, attempt)` callback contract with `airFetch`, fed as literal code            | OK — clean                                                                                                  | 70s      |
| 02:53 | asu/qwen3-coder-30b-a3b-instruct | delete `shortlistEvents()` from `src/lib/events.ts`, keep `getDemoEvents` and its helpers                       | OK first try                                                                                                | 160s     |
| 03:06 | asu/qwen3-coder-30b-a3b-instruct | FIX: a confirmation turn redrew the whole search list, and the model promised a confirmation email              | OK — cards now show only the reserved event, and the prompt forbids inventing an email, invite or held seat | 58s      |
| 03:09 | asu/qwen3-coder-30b-a3b-instruct | `event-card.tsx`: render `event.url` as a "View event" link — the data carried it but the card never showed it  | OK                                                                                                          | 32s      |

## Session 4 totals (asu-guide only)

- **10 opencode invocations**, all `asu/qwen3-coder-30b-a3b-instruct`.
- New file, model-written: `src/lib/tools.ts`. Rewritten: `src/app/api/chat/route.ts`.
  Edited: `src/lib/events.ts`, `src/components/event-card.tsx`.
- `src/components/chat.tsx` needed no change: it already rendered `data.events` as cards, so
  swapping the source of that array from a heuristic to real tool results was invisible to it.

## Verified end to end in the browser

Signed in as `admin`, "any robotics or engineering events in the next two weeks?" → one
`search_events` call → five real cards. Then "reserve me a spot for the first one" → three tool
calls in one turn: `reserve_spot` fails first because the model guessed an event id, it reads the
structured `invalid_arguments` / not-found envelope, calls `search_events` to recover the real id,
and reserves successfully — inside the 3-round cap. The confirmation turn shows only the reserved
event. Signed out, the same reservation request searches, finds the event, and declines to
reserve, asking the student to sign in first.

## What the tool budget costs

Four tool definitions (`search_events`, `get_event_details`, `reserve_spot`, `list_capabilities`)
are re-sent on every turn. Anything else registered in `asu-tools-api` is reachable only after the
model calls `list_capabilities`, so the per-turn prompt cost stays flat as the registry grows.

---

# Session 5 — Notebooks: sequential page ingest + running digest (2026-09-03, 14:10–14:45 MST)

Every application file below was written by an ASU AIR model through `opencode`, one file per
run at near-pseudocode spec density; the orchestrator wrote specs, ran `tsc`/`eslint`/`vitest`,
fed errors back, and drove the browser. Hand-edits afterwards (review pass): preview-URL indexing
in the hook, page cards → rows, the rename input, and the admin feature switch.

| Run    | Model                            | File                                                                         | Outcome                                                                                     | Wall       |
| ------ | -------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------- |
| 01     | qwen3-coder-30b-a3b-instruct     | `lib/air/models.ts` + `capabilities.ts` (new `ocr` service)                  | OK first try                                                                                | 74s        |
| 02     | qwen3-coder-30b                  | `db/schema.ts` (`notebooks`, `notebook_pages`)                               | OK, byte-exact to spec                                                                      | 50s        |
| 03     | qwen3-coder-30b                  | `lib/notebook-prompts.ts`                                                    | one bug: `'…student's name'` unterminated string                                            | 51s        |
| 04     | qwen3-coder-30b                  | `lib/notebooks.ts`                                                           | OK first try                                                                                | 66s        |
| 05     | qwen3-coder-30b                  | `api/notebooks/route.ts`                                                     | bug: `(await req.json()).catch(…)`                                                          | 75s        |
| 06     | qwen3-coder-30b                  | `api/notebooks/[id]/route.ts`                                                | OK first try                                                                                | 60s        |
| 07     | qwen3-coder-30b → **qwen36-27b** | `api/notebooks/[id]/ingest/route.ts` (NDJSON, sequential OCR + digest merge) | first run hung at bootstrap; qwen36 wrote it clean first try, improved the failed-read path | 98s        |
| 08     | qwen3-coder-30b                  | `api/notebooks/[id]/chat/route.ts`                                           | OK first try                                                                                | 147s       |
| 09, 12 | qwen3-coder-30b                  | fixes for 03 and 05 from the tsc / code-review text                          | OK                                                                                          | 50s, 25s   |
| 10     | qwen3-coder-30b                  | `lib/notebook-prompts.test.ts` (14 cases)                                    | OK, all green                                                                               | 59s        |
| 11     | qwen3-coder-30b                  | `hooks/use-notebook.ts`                                                      | ASI bug `let x = false\n(async…)()`, setState-in-effect, an `any`                           | 117s       |
| 13     | qwen3-coder-30b → **qwen36-27b** | `components/notebook-view.tsx`                                               | 30b idled out mid-write at 60s; qwen36 finished in one go                                   | 121s + ~9m |
| 14     | qwen3-coder-30b                  | `side-nav.tsx` edit (real notebooks, New notebook row)                       | OK, diff exact                                                                              | 177s       |
| 15     | qwen3-coder-30b                  | `app-shell.tsx` edit + delete preview                                        | OK; missed one `type` import                                                                | 337s       |
| 16–21  | qwen3-coder-30b                  | six small fix runs (lint, ASI, spacing, headings)                            | each OK                                                                                     | 25–93s     |

**Measured on the live gateway (3 synthetic CSE 340 pages, 1240×1600):** `qwen3-vl-32b-instruct` read
a page in 8.4–13.9s; `qwen35-27b` rewrote the digest in ~5s per page; a notebook question answered
in 1.9–3.6s. Cross-page recall verified: "which language was shown to be not regular, and how does it
come back later?" → pumping lemma on p. 2, returns as the CFG `S → 0S1 | ε` on p. 3.

**New harness lesson:** a watchdog that kills on _log idle_ truncates long single-file writes —
the model emits nothing while it composes a 250-line file. For big files use a 150s idle window,
or better, the sentinel file (`touch .air-done/<run>`) as the run's mandatory last action.
