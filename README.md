# ASU Guide — Spark Challenge 2026

A campus assistant built on the **ASU AI Research Acceleration Platform (AIR)**.
Team **InnovatAIRs** · ASU AIR Spark Challenge, Sept 2–4 2026.

Every model call in this project runs on ASU's own self-hosted open-weight
models via `https://openai.rc.asu.edu/v1` (Intel Gaudi nodes on Sol). No
external AI vendor is used at runtime.

## Apps

| Path              | Port | What it is                                                                           |
| ----------------- | ---- | ------------------------------------------------------------------------------------ |
| `asu-guide/`      | 3000 | The assistant — chat with a tool loop, voice, image, video, saved conversations      |
| `asu-sso/`        | 4000 | A **mock** OAuth 2.0 + PKCE identity provider, so sign-in is a real handshake        |
| `asu-tools-api/`  | 5000 | MCP tool registry + dispatch; also renders the registry as an OpenAI `tools` array   |
| `asu-events-api/` | 5001 | Hybrid BM25 + dense retrieval over the events, mock RSVPs                            |
| `asu-search-api/` | 5003 | Optional Brave web search. Without a key it answers "not configured", nothing breaks |

## Architecture

```mermaid
flowchart TB
  subgraph Browser["Browser · asu-guide UI"]
    UI["Chat thread\nmarkdown + event cards"]
    MIC["Mic\nwebm/opus, loudness gate"]
    IMG["Image upload\ndownscale to 1536px JPEG"]
    VID["Video upload"]
  end

  subgraph Guide["asu-guide · Next.js 16 · :3000"]
    CHAT["/api/chat\n3-round tool loop"]
    ASR["/api/transcribe"]
    VIS["/api/vision"]
    VIDEO["/api/video\nffmpeg split → vision ∥ ASR → fuse"]
    TITLE["/api/title"]
    CHATS["/api/chats\nownership-checked"]
    AUTH["/api/auth\nPKCE client, cookie session"]
    FALLBACK["src/lib/air\nordered model list per job\nrefused model benched 24h"]
    TOOLS["src/lib/tools.ts\npull tools array (60s cache)\ndispatch via registry"]
    GDB[("local.db\nchats, messages, events")]
  end

  subgraph SSO["asu-sso · demo IdP · :4000"]
    OIDC["/.well-known · /authorize · /token\nauthorization code + PKCE"]
    SDB[("sso.db\n3 fictional accounts\nscrypt + per-user salt")]
  end

  subgraph Registry["asu-tools-api · MCP registry · 127.0.0.1:5000"]
    MCP["POST /mcp · JSON-RPC 2.0\ninitialize · ping · tools/list · tools/call"]
    OAI["GET /openai/tools\nsame registry as OpenAI tools[]"]
    REG["services.json seed → registry.json\najv validation per call\nerror envelope: unreachable · timeout · upstream_error · bad_response"]
    SESSION["SESSION_TOOLS\nsearch_events · get_event_details\nreserve_spot · web_search\n(+ list_capabilities)"]
  end

  subgraph Events["asu-events-api · :5001"]
    SEARCH["POST /search\nBM25 (FTS5) + dense cosine\nRRF k=60 → rerank → dedupe\nper-stage trace"]
    RSVP["POST /reservations\nmock, says so"]
    EDB[("events.db\n1,962 events · float32 embeddings\nsha256-gated re-embed")]
  end

  subgraph Search["asu-search-api · :5003"]
    WEB["POST /search → Brave\nno key: 503 not configured"]
  end

  subgraph AIR["ASU AIR gateway · openai.rc.asu.edu/v1 · VPN only"]
    M_CHAT["qwen35-27b\nchat + tool calls · ~1.7s"]
    M_TITLE["qwen3-30b-a3b-instruct-2507\ntitles · ~0.3s"]
    M_ASR["qwen3-asr-1p7b\nspeech→text · ~0.4s"]
    M_VIS["gemma4-31b-it\nimage · ~1.8s"]
    M_VID["qwen3-vl-32b-instruct\nvideo · 5–12s"]
    M_EMB["qwen3-embedding-4b\nembed + /rerank · ~0.3s"]
  end

  ICAL["Sun Devil Central\npublic iCal feed"] -. "seed: data/asu-events.json" .-> GDB
  ICAL -. "seed + embed" .-> EDB

  UI --> CHAT
  MIC --> ASR
  IMG --> VIS
  VID --> VIDEO
  UI --> CHATS
  UI --> AUTH

  AUTH <--> OIDC
  OIDC --> SDB
  CHATS --> GDB

  CHAT --> FALLBACK
  ASR --> FALLBACK
  VIS --> FALLBACK
  VIDEO --> FALLBACK
  TITLE --> FALLBACK
  FALLBACK --> M_CHAT
  FALLBACK --> M_TITLE
  FALLBACK --> M_ASR
  FALLBACK --> M_VIS
  FALLBACK --> M_VID

  CHAT --> TOOLS
  TOOLS --> OAI
  TOOLS --> MCP
  MCP --> REG
  OAI --> SESSION
  REG --> SEARCH
  REG --> RSVP
  REG --> WEB
  SEARCH --> EDB
  RSVP --> EDB
  SEARCH -- "embed query, rerank top 20" --> M_EMB
  WEB --> BRAVE["Brave Search API"]
```

**One turn, end to end.** A signed-in student types _"reserve me a spot for the first one"_. `/api/chat` reads the ASURITE from the server session, pulls the four session tools from the registry, and sends the thread to `qwen35-27b`. The model calls `reserve_spot` with a guessed id; the registry validates the arguments, dispatches to `asu-events-api`, and returns a structured error. The model reads it, calls `search_events` to recover the real id, then `reserve_spot` again — three tool calls in one turn, all through the same validation layer. Specialist outputs (a flyer photo, a voice note) are folded back into the thread as text, so the chat model can answer "what time was that again?" several turns later.

## What it does

- **Campus events** — 1,962 real upcoming events from the public Sun Devil
  Central iCal feed. No login, no personal data, no scraping behind auth.
- **Voice input** — record in the browser, transcribed by `qwen3-asr-1p7b` in
  ~0.4s. webm/opus goes straight to the gateway; no transcode.
- **Images** — `gemma4-31b-it` (~1.8s), downscaled client-side first because the
  gateway rejects bodies over roughly 3MB of base64.
- **Video** — ffmpeg splits the clip; `qwen3-vl-32b-instruct` watches it while
  `qwen3-asr-1p7b` listens, and a third model fuses the two. Audio is checked
  for actual signal first: ASR models invent text from silence.
- **Conversation titles** — named by `qwen3-30b-a3b-instruct-2507` (~0.3s).
- **Model fallback** — every service has an ordered model list. A model the
  gateway _refuses_ is benched for 24h; a model that is merely _slow_ is not.
  See `src/lib/air/`.
- **Sign in** — real authorization-code flow with PKCE against `asu-sso`.

## Running it

Requires the **ASU VPN** (the AIR gateway is not reachable off-network) and an
API key from `voyager.rc.asu.edu` → AI LLM → Create Key.

```bash
./install.sh   # checks node/pnpm/ffmpeg, asks for the key, tests the VPN, installs, seeds
./dev.sh       # starts all five services in one terminal; Ctrl-C stops them
```

`install.sh` is interactive and idempotent. It reuses `RC_OPENAI_API_KEY` and
`BRAVE_API_KEY` if they are already in your shell, writes `./.env`,
`asu-guide/.env.local` and `asu-search-api/.env` (all gitignored), installs with
pnpm (npm if pnpm is missing), then seeds both SQLite databases. The events
embedding pass needs the VPN; off-VPN it seeds BM25-only and says so. Brave is
optional — skip it and web search reports "not configured". `./install.sh --yes`
never prompts.

Manual equivalent, per service: `pnpm install` then `pnpm dev` in each folder;
`pnpm db:push && pnpm db:seed` in `asu-guide`, `pnpm seed` in `asu-events-api`.

`ffmpeg` must be on PATH for video (`brew install ffmpeg`); everything else
works without it.

## Notes

- Chat is a real model (`qwen35-27b`) calling real tools through `asu-tools-api`
  — `search_events`, `get_event_details`, `reserve_spot`, `web_search`. Nothing
  is scripted. Reservations are mock and say so in the response.
- `asu-sso` is a **demo** identity provider with three fictional, locally seeded
  accounts (`admin`/`admin`, `sundevil`/`sundevil`, `asirajud`/`sparkdemo`).
  Passwords are verified (scrypt). Its client credentials are fake and committed
  on purpose. It is not, and must not become, an ASU login.
- Data: public event listings only. No student records — ASU AIR's terms forbid
  sending regulated data or PII to the gateway. See `docs/PRIVACY-AND-MEMORY.md`
  for the memory/personalisation design and where that line sits.
- `docs/AIR-BUILD-LOG-*.md` record which AIR model wrote which file during the
  builds that were authored through `opencode`.
