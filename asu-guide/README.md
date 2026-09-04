# Sol — the assistant

The front end of the ASU AIR Spark Challenge demo: a campus assistant that answers
in chat, listens, looks at photos and video, and acts on campus events through
tools. Every model call goes to ASU's own AIR gateway (`openai.rc.asu.edu`); no
external AI vendor is used at runtime.

## Run it

From the repo root, `./install.sh` then `./dev.sh` brings up this app and the
four services it talks to. On its own:

```bash
pnpm install
cp .env.example .env.local     # add RC_OPENAI_API_KEY (ASU VPN required)
pnpm db:push && pnpm db:seed   # builds local.db from data/asu-events.json
pnpm dev                       # http://localhost:3000
```

HeatRoute uses its SVG pilot map unless `NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL` is
set in `.env.local` to a MapLibre-compatible provider style URL. For MapTiler:

1. Create a key at <https://cloud.maptiler.com/account/keys/>.
2. Name it `HeatRoute ASU Local Dev`.
3. Leave `Allowed user-agent header` empty.
4. For local development, either leave `Allowed HTTP Origins` empty while
   testing, or set:

   ```text
   localhost:3000
   127.0.0.1:3000
   ```

5. Add the style URL to `.env.local`:

   ```bash
   NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL=https://api.maptiler.com/maps/streets-v2/style.json?key=YOUR_MAPTILER_KEY
   ```

The value after `key=` must be only the MapTiler key, not another URL. Restart
`pnpm dev` after changing any `NEXT_PUBLIC_` env var.

Sign-in needs `asu-sso` on :4000; tools need `asu-tools-api` on 127.0.0.1:5000,
which in turn dispatches to `asu-events-api` (:5001) and `asu-search-api` (:5003).

## What it does

- **Chat** — `qwen35-27b` (thinking off, ~1.7s) owns the whole thread. `/api/chat`
  runs up to three rounds of native OpenAI tool calls against the registry
  (`src/lib/tools.ts`): `search_events`, `get_event_details`, `reserve_spot`,
  `web_search`. Nothing is scripted. The model reads structured JSON-Schema
  errors from the registry and recovers — a guessed event id fails, it searches
  for the real one, then reserves.
- **Voice** — tap to record, webm/opus straight to `qwen3-asr-1p7b` (~0.4s), no
  transcode. Audio is checked for loudness first; ASR models invent text from
  silence.
- **Images** — downscaled client-side to 1536px JPEG (the gateway 413s above
  ~3MB of base64), then `gemma4-31b-it` (~1.8s).
- **Video** — ffmpeg splits the clip; `qwen3-vl-32b-instruct` watches while
  `qwen3-asr-1p7b` listens, in parallel, and a third call fuses them.
- **Cross-modal memory** — specialist outputs fold back into the thread as
  `[Media the student shared earlier…]` turns, so "what time was that again?"
  works several turns later.
- **Saved chats** — per ASURITE, titled by `qwen3-30b-a3b-instruct-2507`
  (~0.3s), restored on reload. Every `/api/chats` route is ownership-checked.
- **Sign in** — real authorization-code + PKCE round trip against `asu-sso`.
  The signed-in ASURITE comes from the server session, never from the client.
- **Fallback layer** — `src/lib/air/` holds an ordered model list per job. A
  model the gateway refuses is benched for 24h; a slow one is not.

Signed out, chat/voice/image still work; reserving a spot and image upload
require sign-in. `/api/*` model routes are unauthenticated on purpose so the
signed-out demo works — fine on localhost, not for a public host.

## Data

`data/asu-events.json` — 1,962 upcoming events from the **public Sun Devil
Central iCal feed** (`sundevilcentral.eoss.asu.edu`). No authentication, no
scraping behind a login, no personal or student data: club, title, time, type,
public description only.

Two quirks the app handles:

- Times arrive as iCal UTC stamps (`20260902T000000Z`) and render in `America/Phoenix`.
- `location` is the literal string `"Sign in to download the location"` for
  ~84% of records, so the UI **never** shows location — it shows the club.

"Today" is `max(DEMO_NOW, now)` in `src/lib/events.ts`: the snapshot stays
plausible after the event dates pass, and never sits in the past.

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · shadcn/ui · Drizzle ORM
over SQLite (better-sqlite3) · ASU maroon/gold on near-black.

- `src/app/api/` — `chat`, `transcribe`, `vision`, `video`, `title`, `chats`, `auth`, `air-health`
- `src/lib/air/` — gateway client, model preference lists, ffmpeg video split
- `src/lib/tools.ts` — pulls the OpenAI-shaped tool array from the registry (60s cache), dispatches calls back through it
- `src/lib/sso.ts`, `src/lib/session.ts` — PKCE client and cookie session
- `src/components/chat.tsx` — the thread, tool loop rendering, media folding

## Known limitation

`pnpm build` fails prerendering Next.js 16's built-in `/_global-error` route — an
upstream Next 16.3.4 issue unrelated to this app. Run with `pnpm dev`.
