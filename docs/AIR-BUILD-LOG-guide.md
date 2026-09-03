# AIR Build Log — asu-guide-air

Every line of application source in this project was written by an **ASU AIR open-weight model**
via the `opencode` CLI against `https://openai.rc.asu.edu/v1` (provider `asu`).
The human/orchestrator only ran tooling (`pnpm`, `create-next-app`, `shadcn init`, `pnpm dev`),
copied the data file, inspected results, and wrote the prompts fed to the AIR models.

Deterministic scaffold (no AI): `pnpm create next-app` (TS/Tailwind/App Router/src dir),
`pnpm add drizzle-orm better-sqlite3`, `pnpm dlx shadcn init && shadcn add button card badge`.

## opencode invocations

| Time | Model | Prompt (one-line summary) | Outcome | Duration |
| --- | --- | --- | --- | --- |
| 03:45 | asu/qwen3-coder-30b-a3b-instruct | two-file db schema + client in one prompt | FAILED — no output after 600s, killed (prompt too broad) | 600s |
| 03:56 | asu/qwen3-coder-30b-a3b-instruct | smoke test: write hello.txt | OK (harness verified) | 38s |
| 04:04 | asu/qwen3-coder-30b-a3b-instruct | write `src/db/schema.ts` (drizzle sqlite events table) | OK, correct first try | 8s |
| 04:09 | asu/qwen3-coder-30b-a3b-instruct | write `src/db/index.ts` (better-sqlite3 + drizzle client, WAL, hot-reload global cache) | OK first try (1 cold-start stall, retried) | 16s |
| 04:14 | asu/qwen3-coder-30b-a3b-instruct | write `scripts/seed.ts` (iCal ts -> epoch, skip blank titles, null out "Sign in to download the location", batch insert) | OK — seeded 1962/1962, but wrote `org_url` instead of `orgUrl` so that column came back NULL | 45s |
| 04:22 | asu/qwen3-coder-30b-a3b-instruct | FIX #1: orgUrl key mismatch + type batches as `$inferInsert` | OK, bug fixed by the model from the error report | 114s |
| 04:30 | asu/qwen3-coder-30b-a3b-instruct | write `src/lib/events.ts` (DEMO_NOW, formatWhen, venueLabel, truncate, getRecommendedEvents, searchEvents) | OK — good logic, but verbose/triplicated and a nullable-column type error | 56s |
| 04:33 | asu/qwen3-coder-30b-a3b-instruct | write `src/app/api/events/route.ts` | OK first try | 17s |
| 04:35 | asu/qwen3-coder-30b-a3b-instruct | rewrite `src/app/layout.tsx` (Inter via next/font, black body, viewport) | OK first try | 20s |
| 04:36 | asu/qwen3-coder-30b-a3b-instruct | append Gemini design tokens + `.g-glow` / `.g-shimmer` / `.g-fade-up` to `globals.css` | OK first try, shadcn tokens left intact | 33s |
| 04:40 | asu/qwen3-coder-30b-a3b-instruct | write `src/components/icons.tsx` (Sparkle, Menu, Pencil, Chevron, Plus, Mic, Waveform, Check) | OK — but Mic rendered as a blob and the Sparkle gradient showed only 2 of 5 colours | 47s |
| 04:43 | asu/qwen3-coder-30b-a3b-instruct | write `src/components/chat-header.tsx` (48px circular buttons, "ASU Guide"+"AIR"+chevron+blue dot) | OK first try, pixel-accurate | 49s |
| 04:45 | asu/qwen3-coder-30b-a3b-instruct | write `src/components/composer.tsx` (64px pill, +, mic, blue send) | OK first try | 24s |
| 04:48 | asu/qwen3-coder-30b-a3b-instruct | write `src/components/event-card.tsx` (Register -> Registered flip) | OK first try | 32s |
| 04:49 | asu/qwen3-coder-30b-a3b-instruct | write `src/components/empty-state.tsx` (sparkle + headline + chips) | OK first try | 17s |
| 04:52 | asu/devstral2-123b | write `src/components/chat.tsx` — the scripted-flow orchestrator (600ms beat, char streaming, cards after) | Logic all correct; emitted `use client;` WITHOUT quotes -> TS1434 | 66s |
| 04:55 | asu/qwen3-coder-30b-a3b-instruct | rewrite `src/app/page.tsx` | OK first try | 10s |
| 04:57 | asu/qwen3-coder-30b-a3b-instruct | FIX #2: restore the `"use client"` directive quotes | OK | 14s |
| 05:00 | asu/devstral2-123b | FIX #3: `EventCardData.url` nullable type error x6 + extract `toCard()` + dedupe by id across fallback passes | OK, one failed edit (ambiguous oldString) then succeeded; typecheck clean | 174s |
| 05:06 | asu/devstral2-123b | FIX #4: times rendered as "1:30 AM" — switch `formatWhen` to America/Phoenix, keep UTC-midnight all-day heuristic | OK, correct | 43s |
| 05:12 | asu/qwen3-coder-30b-a3b-instruct | FIX #5: `DEMO_NOW` -> Phoenix midnight so cards stop showing Sep 1 | OK | 21s |
| 05:14 | asu/devstral2-123b | polish: sparkle gradient, mic icon, headline nowrap, stronger `.g-glow` | PARTIAL — only the CSS edit landed; 3 edits failed because it did not Read the files first | 109s |
| 05:18 | asu/devstral2-123b | retry polish with "Read the file first" instruction | OK — all three edits landed | 48s |
| 05:22 | asu/qwen3-coder-30b-a3b-instruct | sparkle gradient stops pushed inward (concave star hid the end stops) | OK | 24s |
| 05:26 | asu/devstral2-123b | FIX #6: streamed greeting rendered as "ey Azhar" (leading H dropped) | FAILED — looped ~25x on "oldString and newString are identical", killed at 420s | 421s |
| 05:34 | asu/qwen3-coder-30b-a3b-instruct | FIX #6 retry, prescribing an idempotent `GREETING.slice(0, index)` instead of append | OK — greeting now renders in full | 31s |
| 05:37 | asu/qwen3-coder-30b-a3b-instruct | write `README.md` (run steps, data provenance, "responses are scripted") | OK first try | 28s |
| 05:40 | asu/gpt-oss-120b | REVIEW: read the 5 core files, report real bugs only | OK — 4 findings; 2 valid (unmount race, duplicated pass logic), 2 false positives (drizzle `sql` already parameterises; all-day heuristic is intentional) | 205s |
| 05:46 | asu/qwen3-coder-30b-a3b-instruct | write `src/app/global-error.tsx` + `src/app/not-found.tsx` to fix a `pnpm build` prerender crash | Files written correctly, but the crash is an upstream Next.js 16 `_global-error` bug and persists. `pnpm dev` is unaffected. | 18s |

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

| Time | Model | Prompt (one-line summary) | Outcome | Duration |
| --- | --- | --- | --- | --- |
| 22:43 | asu/qwen3-coder-30b-a3b-instruct | write `.env.example` + `src/lib/sso.ts` (config consts, PKCE verifier/challenge, `authorizeUrl`, `exchangeCode`, `fetchUserInfo`) | OK first try | 39s |
| 22:44 | asu/qwen3-coder-30b-a3b-instruct | write `src/lib/session.ts` (HMAC-signed cookie sign/verify, async `getSession()`) | OK first try | 28s |
| 22:45 | asu/qwen3-coder-30b-a3b-instruct | write `src/app/api/auth/login/route.ts` + `.../logout/route.ts` | OK first try | 20s |
| 22:45 | asu/qwen3-coder-30b-a3b-instruct | write `src/app/api/auth/callback/route.ts` (state check, code+verifier exchange, userinfo, set session) | OK — but destructured `url.searchParams` as if it were a plain object (`const { code, state, error } = url.searchParams`) | 22s |
| 22:46 | asu/qwen3-coder-30b-a3b-instruct | write `src/components/user-menu.tsx` (Sign-in pill / avatar badge + dropdown, outside-click and Escape close) | OK first try, including the `"use client"` quoting that tripped devstral in session 1 | 30s |
| 22:47 | asu/qwen3-coder-30b-a3b-instruct | edit `src/components/chat-header.tsx` (accept `asurite`, mount `UserMenu`) + rewrite `src/app/page.tsx` (`await getSession()`) | OK first try | 87s |
| 22:49 | asu/qwen3-coder-30b-a3b-instruct | edit `src/components/chat.tsx` (`greetingFor(asurite)`, thread props, AI-disclaimer footnote) + `src/components/empty-state.tsx` (conditional headline) | OK first try — the fragile `GREETING.slice(0, index)` streaming loop survived intact | 104s |
| 22:51 | asu/qwen3-coder-30b-a3b-instruct | FIX #1: `URLSearchParams` destructuring (3x TS2339), fed back verbatim | OK — `tsc --noEmit` clean | 29s |
| 22:53 | asu/qwen3-coder-30b-a3b-instruct | append a `## Sign-in (demo SSO)` section to `README.md` without disturbing the existing sections | OK first try | 43s |

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
