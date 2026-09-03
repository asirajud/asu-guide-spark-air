# ASU Guide — Spark Challenge 2026

A campus assistant built on the **ASU AI Research Acceleration Platform (AIR)**.
Team **InnovatAIRs** · ASU AIR Spark Challenge, Sept 2–4 2026.

Every model call in this project runs on ASU's own self-hosted open-weight
models via `https://openai.rc.asu.edu/v1` (Intel Gaudi nodes on Sol). No
external AI vendor is used at runtime.

## Apps

| Path | Port | What it is |
| --- | --- | --- |
| `asu-guide/` | 3000 | The assistant — chat, voice, image, video, saved conversations |
| `asu-sso/` | 4000 | A **mock** OAuth 2.0 + PKCE identity provider, so sign-in is a real handshake |

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
  gateway *refuses* is benched for 24h; a model that is merely *slow* is not.
  See `src/lib/air/`.
- **Sign in** — real authorization-code flow with PKCE against `asu-sso`.

## Running it

Requires the **ASU VPN** (the AIR gateway is not reachable off-network) and an
API key from `voyager.rc.asu.edu` → AI LLM → Create Key.

```bash
# terminal 1
cd asu-sso && pnpm install && pnpm dev        # :4000

# terminal 2
cd asu-guide && pnpm install
cp .env.example .env.local                     # add RC_OPENAI_API_KEY
pnpm db:push && pnpm db:seed
pnpm dev                                       # :3000
```

`ffmpeg` must be on PATH for video (`brew install ffmpeg`).

## Notes

- The event shortlist is scripted for the demo; image, video, voice and title
  generation are real model calls. See `asu-guide/README.md`.
- `asu-sso` is a **demo** identity provider. It accepts any ASURITE and never
  reads the password field. Its client credentials are fake and committed on
  purpose. It is not, and must not become, an ASU login.
- Data: public event listings only. No student records — ASU AIR's terms forbid
  sending regulated data or PII to the gateway. See `docs/PRIVACY-AND-MEMORY.md`
  for the memory/personalisation design and where that line sits.
- `docs/AIR-BUILD-LOG-*.md` record which AIR model wrote which file during the
  builds that were authored through `opencode`.
