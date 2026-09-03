# asu-events-api

A backend-only hybrid retrieval service over 1,962 real upcoming ASU campus events, built for the ASU AIR Spark Challenge. No UI. Runs on port 5001. It owns its own SQLite database and deliberately does not share the asu-guide app's database.

## Running it

```bash
pnpm install
pnpm seed     # requires RC_OPENAI_API_KEY and the ASU VPN, for the embedding pass
pnpm start    # http://127.0.0.1:5001
```

`pnpm seed` is idempotent and safe to re-run. Without the VPN it still produces a working BM25-only database and prints a warning.

## Dependencies, and what was left out

It uses node:http directly instead of a web framework — five routes did not justify one.
Storage is better-sqlite3 + drizzle-orm. There is NO vector database and no sqlite-vec: 1,962
vectors x 2,560 dimensions is about 5 million multiply-adds per query, which is under a
millisecond in JavaScript, so the vectors live in a BLOB column and are scanned in memory. This is a deliberate sizing decision. It would not survive two orders of magnitude more data.

## How retrieval works

Four stages, each independently callable and separately timed:

1. BM25 over a SQLite FTS5 index of title, description, club and type, using FTS5's own bm25()
   ranking with column weights 10/3/5/2 (title deliberately worth about three times description).
   Note that bm25() returns a negative score where more negative is better.
2. Dense retrieval. At seed time each event's `title + club + type + first ~200 characters of
description` is embedded once with qwen3-embedding-4b (2,560 dimensions) and stored as a
   Float32Array BLOB. At query time the query is embedded and cosine similarity is brute-forced
   in JavaScript.
3. Reciprocal rank fusion of the two candidate lists, k = 60. RRF is used rather than a normalised score blend because BM25 scores and cosine similarities are on incomparable scales, and per-query normalisation is unstable on result sets this small.
4. Rerank of the top 20 fused candidates through AIR's POST /v1/rerank.
   Then a title+club de-duplication pass, because the feed carries recurring events as separate rows
   with identical titles.

### What the trace tells you

Every /search response carries a `trace` object reporting each stage's latency, hit count, top three titles, how many fused candidates came from BM25 only, dense only or both, and `rerank.movedIntoTop` — the events that reranking promoted into the visible top that plain fusion had missed.

## Incremental re-embedding

Each event's embedded text is hashed (sha256) into `embed_hash`. A re-seed only sends rows whose
hash changed or whose embedding is null, so a refresh of the feed costs one embedding call per
genuinely changed event rather than 1,962.

## Endpoints

| Method | Path                   | Body / query                   | Returns               |
| ------ | ---------------------- | ------------------------------ | --------------------- |
| GET    | /health                |                                | 200 OK                |
| POST   | /search                | query, days_ahead, type, limit | Array of events       |
| GET    | /events/:id            |                                | Single event          |
| POST   | /reservations          | asurite, event_id              | Reservation object    |
| GET    | /reservations?asurite= |                                | Array of reservations |

```bash
curl -X POST http://127.0.0.1:5001/search \
  -H "Content-Type: application/json" \
  -d '{"query":"computer science","limit":10}'

curl -X POST http://127.0.0.1:5001/reservations \
  -H "Content-Type: application/json" \
  -d '{"asurite":"jdoe","event_id":"12345"}'
```

## Reservations are mock

Reservations are written only to this demo's local SQLite database. Nothing is sent to Sun Devil Central or any ASU system, no real seat is held, and every reservation response carries `\"mock\": true` plus an explicit notice string saying so.

## Data notes

- The feed's `location` field is the literal string \"Sign in to download the location\" on about
  84% of rows. That is a placeholder, not a venue; the service normalises it to empty at seed
  time and the API returns `venue: null`, so it can never be displayed. The club is shown instead.
- \"Today\" is pinned to 2026-09-03 so the snapshot always looks live.
- iCal timestamps like 20260902T000000Z are parsed to UTC at seed time; times are formatted in
  America/Phoenix.

## Environment

RC_OPENAI_API_KEY (required for the embedding and rerank calls, VPN-gated),
AIR_BASE_URL (defaults to https://openai.rc.asu.edu/v1), EVENTS_DB (defaults to events.db),
EVENTS_JSON (defaults to ../asu-guide/data/asu-events.json), PORT (defaults to 5001).
