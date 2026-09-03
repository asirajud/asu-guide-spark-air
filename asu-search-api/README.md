# asu-search-api

Web search, exposed as a `web_search` tool for the Sol tool registry
(`asu-tools-api`). It exists so the assistant can answer questions that are not
in the campus events data — official ASU pages, deadlines, news — without that
concern leaking into the events engine.

No AI runs here. It is a thin, deployable wrapper over the Brave Search API:
results are fetched over HTTPS with a key from the environment, stripped of
markup, and normalised to `{title, url, snippet, age, source}`.

## Run

```bash
pnpm install
cp .env.example .env   # add BRAVE_API_KEY
pnpm dev               # :5003
```

- `GET /health` — includes `configured: false` when no key is present
- `GET /tools` — the published tool contract, so the registry pulls it rather than duplicating it
- `POST /search` — `{ query, count?, freshness? }`

Without a key the service still starts and answers `/health`; `/search` returns
**503 with a clear message** rather than pretending to be broken.
