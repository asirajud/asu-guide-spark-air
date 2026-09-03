# ASU Guide — AIR demo

A pitch demo for the ASU AIR Spark Challenge: a campus events assistant styled as a
near-pixel replica of the Google Gemini mobile app (dark theme). Ask anything, and it
surfaces real upcoming ASU club events you can register for in one tap.

> **The responses are scripted.** There is no LLM and no API call anywhere in this app.
> Whatever you type, the assistant replies with the same fixed line and the same
> server-rendered shortlist of events. The events themselves are real; the "reasoning"
> is theatre for the pitch.

## Run it

```bash
pnpm install
pnpm db:seed     # builds local.db from data/asu-events.json
pnpm dev         # http://localhost:3000
```

That's it — no env file, no API keys, no accounts.

## What you'll see

1. Empty state: the rainbow sparkle, "Where should we start?", and tappable suggestion chips.
2. Type anything (or tap a chip) → your message appears as a right-aligned bubble.
3. A ~600ms shimmer, then the reply streams in word by word.
4. Five real upcoming events render as cards — title, day + time (America/Phoenix),
   organizing club, a type pill, a one-line blurb, and a **Register** button.
5. Register flips the card to a confirmed state. Local state only; nothing is written anywhere.
6. A quiet footnote hints at the learn-over-time story.

## Data

`data/asu-events.json` — 1,962 upcoming events scraped from the **public Sun Devil Central
iCal feed** (`sundevilcentral.eoss.asu.edu`). No authentication, no scraping behind a login,
no personal or student data: club name, event title, time, type, and public description only.

Two quirks the app handles:

- Times arrive as iCal UTC stamps (`20260902T000000Z`) and are rendered in `America/Phoenix`.
- `location` is the literal string `"Sign in to download the location"` for ~84% of records,
  so the UI **never** shows location — it shows the organizing club instead.

The demo pins "today" to **Sept 2, 2026** (`DEMO_NOW` in `src/lib/events.ts`) and picks from
the next two weeks, preferring events with real titles, usable descriptions, one per club and
one per day, ranked by a stand-in interest score.

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · shadcn/ui · Drizzle ORM over local
SQLite (better-sqlite3) · Inter via `next/font`.

- `src/db/` — Drizzle schema, client, and the seed script
- `src/lib/events.ts` — the curation query and date formatting
- `src/components/chat.tsx` — the scripted interaction (thinking → stream → cards)

## Known limitation

`pnpm build` currently fails prerendering Next.js 16's built-in `/_global-error` route — an
upstream Next 16.3.4 issue unrelated to this app's code. Run it with `pnpm dev`, which is all
the demo needs.
