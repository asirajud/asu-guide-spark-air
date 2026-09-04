#!/usr/bin/env bash
# Sol — one-shot setup for the whole monolith.
#
#   ./install.sh            interactive (asks for anything it cannot find)
#   ./install.sh --yes      never prompt: skip anything that needs input
#
# What it does, in order:
#   1. checks node >= 22, picks pnpm (falls back to npm), warns if ffmpeg is missing
#   2. collects RC_OPENAI_API_KEY — reuses the shell env if already exported
#   3. tests the ASU AIR gateway (needs the Cisco VPN); lets you connect and retry
#   4. optionally collects BRAVE_API_KEY for web search (skip = "not configured")
#   5. optionally collects a MapTiler key or style URL for the HeatRoute basemap
#   6. writes .env (root) + asu-guide/.env.local + asu-search-api/.env
#   7. installs dependencies for the root (Prettier + pre-commit hook) and all seven services
#   8. seeds the two SQLite databases (events embeddings need VPN + key)
#
# Nothing here sends anything anywhere except the AIR gateway health probe.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

AIR_BASE_URL="${AIR_BASE_URL:-https://openai.rc.asu.edu/v1}"
SERVICES=(asu-sso asu-guide asu-events-api asu-tools-api asu-search-api asu-heatroute-api asu-weather-api)
YES=0
for arg in "$@"; do
  case "$arg" in
    -y | --yes) YES=1 ;;
    -h | --help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      echo "unknown flag: $arg"
      exit 2
      ;;
  esac
done

# ---------------------------------------------------------------- output helpers
if [ -t 1 ]; then
  BOLD=$'\e[1m' DIM=$'\e[2m' RED=$'\e[31m' GRN=$'\e[32m' YEL=$'\e[33m' RST=$'\e[0m'
else
  BOLD='' DIM='' RED='' GRN='' YEL='' RST=''
fi
step() { printf '\n%s==> %s%s\n' "$BOLD" "$*" "$RST"; }
ok() { printf '  %s✓%s %s\n' "$GRN" "$RST" "$*"; }
warn() { printf '  %s!%s %s\n' "$YEL" "$RST" "$*"; }
fail() { printf '  %s✗%s %s\n' "$RED" "$RST" "$*"; }
die() {
  fail "$*"
  exit 1
}

# ask VAR "prompt" [secret]  — reads into VAR; empty when --yes or non-interactive
ask() {
  local __var="$1" __prompt="$2" __secret="${3:-}" __val=''
  if [ "$YES" = 1 ] || [ ! -t 0 ]; then
    printf -v "$__var" ''
    return
  fi
  if [ -n "$__secret" ]; then
    read -rs -p "  $__prompt" __val
    echo
  else
    read -r -p "  $__prompt" __val
  fi
  printf -v "$__var" '%s' "$__val"
}

# set_env_line FILE KEY VALUE — replace or append KEY=VALUE, keep everything else
set_env_line() {
  local file="$1" key="$2" value="$3" tmp
  touch "$file"
  tmp="$(mktemp)"
  grep -v "^${key}=" "$file" >"$tmp" || true
  printf '%s=%s\n' "$key" "$value" >>"$tmp"
  mv "$tmp" "$file"
}

# ---------------------------------------------------------------- 1. toolchain
step "Toolchain"

# The demo machine already has a compatible local Node. Prefer it so a shell
# whose system default is Node 20 cannot install an addon that later segfaults.
if [ -x "$HOME/.local/node22/bin/node" ]; then
  export PATH="$HOME/.local/node22/bin:$HOME/.local/bin:$PATH"
fi
command -v node >/dev/null || die "node is not installed — install Node 22+ (https://nodejs.org or nvm)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  die "node $(node -v) is too old; this repo requires Node 22+ for better-sqlite3"
fi
ok "node $(node -v)"

if command -v pnpm >/dev/null; then
  PM=pnpm
  ok "pnpm $(pnpm -v)"
elif command -v npm >/dev/null; then
  PM=npm
  warn "pnpm not found — using npm $(npm -v). Lockfiles are pnpm's, so versions may drift slightly."
else
  die "neither pnpm nor npm found"
fi

if command -v ffmpeg >/dev/null; then
  ok "ffmpeg $(ffmpeg -version 2>/dev/null | head -1 | awk '{print $3}')"
else
  warn "ffmpeg not found — video uploads will fail. Chat, voice and images work without it. (brew install ffmpeg)"
fi

command -v curl >/dev/null || die "curl is required for the gateway test"

# ---------------------------------------------------------------- 2. AIR key
step "ASU AIR gateway key (RC_OPENAI_API_KEY)"

# Reuse a key already written by a previous run so re-running is idempotent.
if [ -z "${RC_OPENAI_API_KEY:-}" ] && [ -f .env ]; then
  RC_OPENAI_API_KEY="$(grep '^RC_OPENAI_API_KEY=' .env | cut -d= -f2- || true)"
  [ -n "$RC_OPENAI_API_KEY" ] && ok "found in ./.env from a previous run"
fi

if [ -n "${RC_OPENAI_API_KEY:-}" ]; then
  ok "already set (${RC_OPENAI_API_KEY:0:6}…) — skipping prompt"
else
  echo "  Get one: ASU VPN → https://voyager.rc.asu.edu → AI LLM tab → Create Key"
  ask RC_OPENAI_API_KEY "Paste your key (input hidden): " secret
  if [ -z "$RC_OPENAI_API_KEY" ]; then
    warn "no key given — every model call will fail until you add RC_OPENAI_API_KEY to ./.env and asu-guide/.env.local"
  fi
fi

# ---------------------------------------------------------------- 3. VPN test
step "ASU VPN / gateway reachability"
echo "  The gateway ($AIR_BASE_URL) only answers on the Cisco VPN."

VPN_OK=0
probe_gateway() {
  # prints an HTTP status, or "000" when the connection itself failed
  curl -sS -o /dev/null -w '%{http_code}' -m 12 \
    -H "Authorization: Bearer ${RC_OPENAI_API_KEY:-none}" \
    "$AIR_BASE_URL/models" 2>/dev/null || echo 000
}

while :; do
  code="$(probe_gateway)"
  case "$code" in
    200)
      VPN_OK=1
      ok "VPN up, key accepted (GET /models → 200)"
      break
      ;;
    401 | 403)
      VPN_OK=1
      fail "VPN is up but the gateway rejected the key (HTTP $code)"
      if [ "$YES" = 1 ] || [ ! -t 0 ]; then break; fi
      ask answer "[r]e-enter key / [s]kip: "
      case "$answer" in
        r | R) ask RC_OPENAI_API_KEY "Paste your key (input hidden): " secret ;;
        *) break ;;
      esac
      ;;
    000)
      fail "cannot reach the gateway — the ASU VPN is probably not connected"
      if [ "$YES" = 1 ] || [ ! -t 0 ]; then break; fi
      ask answer "Connect the VPN, then [r]etry, or [s]kip: "
      case "$answer" in
        r | R | '') continue ;;
        *) break ;;
      esac
      ;;
    *)
      warn "gateway answered HTTP $code — reachable, but not healthy. Continuing."
      VPN_OK=1
      break
      ;;
  esac
done
if [ "$VPN_OK" = 0 ]; then
  warn "skipping — events will be seeded BM25-only (no embeddings); re-run ./install.sh on the VPN to add them"
fi

# ---------------------------------------------------------------- 4. Brave (optional)
step "Web search (optional — Brave Search API)"

if [ -z "${BRAVE_API_KEY:-}" ] && [ -f asu-search-api/.env ]; then
  BRAVE_API_KEY="$(grep '^BRAVE_API_KEY=' asu-search-api/.env | cut -d= -f2- || true)"
fi
if [ -n "${BRAVE_API_KEY:-}" ]; then
  ok "BRAVE_API_KEY already set — skipping prompt"
else
  echo "  Free tier (2,000 queries/month): https://brave.com/search/api/"
  echo "  Without it the assistant still runs; web_search answers \"Web search is not configured\"."
  ask BRAVE_API_KEY "Brave key, or Enter to skip: " secret
  if [ -z "${BRAVE_API_KEY:-}" ]; then
    warn "skipped — web search not configured"
  fi
fi

# ---------------------------------------------------------------- 5. MapTiler (optional)
step "HeatRoute basemap (optional — MapTiler)"

if [ -z "${NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL:-}" ] && [ -f asu-guide/.env.local ]; then
  NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL="$(grep '^NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL=' asu-guide/.env.local | cut -d= -f2- || true)"
fi
if [ -n "${NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL:-}" ]; then
  if [[ "$NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL" != http://* && "$NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL" != https://* ]]; then
    NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL="https://api.maptiler.com/maps/streets-v2/style.json?key=${NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL}"
  fi
  ok "already set — skipping prompt"
else
  echo "  Free key: https://cloud.maptiler.com/account/keys/ — then the style URL is"
  echo "  https://api.maptiler.com/maps/streets-v2/style.json?key=YOUR_KEY"
  echo "  Without it HeatRoute still works and draws its SVG pilot map instead."
  ask NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL "MapTiler key or style URL, or Enter to skip: "
  if [ -z "${NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL:-}" ]; then
    warn "skipped — HeatRoute will draw the SVG pilot map"
  elif [[ "$NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL" != http://* && "$NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL" != https://* ]]; then
    NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL="https://api.maptiler.com/maps/streets-v2/style.json?key=${NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL}"
  elif [[ "$NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL" != http*style.json?key=* ]]; then
    warn "that does not look like a MapLibre style URL (…/style.json?key=…) — writing it anyway"
  fi
fi

# ---------------------------------------------------------------- 6. env files
step "Writing env files"

# Root .env — sourced by ./dev.sh so the plain-node services see the key.
set_env_line .env RC_OPENAI_API_KEY "${RC_OPENAI_API_KEY:-}"
set_env_line .env AIR_BASE_URL "$AIR_BASE_URL"
set_env_line .env APP_URL "http://localhost:3000"
ok ".env"

# asu-guide/.env.local — created from the example once, then only the key line is touched.
if [ ! -f asu-guide/.env.local ]; then
  cp asu-guide/.env.example asu-guide/.env.local
fi
set_env_line asu-guide/.env.local RC_OPENAI_API_KEY "${RC_OPENAI_API_KEY:-}"
# Pin the app origin so the SSO redirect_uri never depends on a code default.
set_env_line asu-guide/.env.local APP_URL "http://localhost:3000"
# Only written when given: an empty value would override a real one on a re-run.
if [ -n "${NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL:-}" ]; then
  set_env_line asu-guide/.env.local NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL "$NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL"
fi
ok "asu-guide/.env.local"

set_env_line asu-search-api/.env BRAVE_API_KEY "${BRAVE_API_KEY:-}"
ok "asu-search-api/.env"

# ---------------------------------------------------------------- 7. dependencies
step "Installing dependencies with $PM"

# Root: Prettier + the pre-commit hook that runs it on staged files.
printf '  %sroot (prettier, git hooks)%s\n' "$DIM" "$RST"
if [ "$PM" = pnpm ]; then
  pnpm install --reporter=append-only 2>&1 | grep -vE '^\s*$' | tail -n 2
else
  npm install --no-audit --no-fund --loglevel=error
fi
git config core.hooksPath .githooks
ok "root — commits are auto-formatted via .githooks/pre-commit"

for svc in "${SERVICES[@]}"; do
  printf '  %s%s%s\n' "$DIM" "$svc" "$RST"
  if [ "$PM" = pnpm ]; then
    (cd "$svc" && pnpm install --reporter=append-only 2>&1 | grep -vE '^\s*$' | tail -n 3)
  else
    (cd "$svc" && npm install --no-audit --no-fund --loglevel=error)
  fi
  ok "$svc"
done

# ---------------------------------------------------------------- 8. seed
step "Seeding databases"

export RC_OPENAI_API_KEY AIR_BASE_URL

printf '  %sasu-guide%s (local.db from data/asu-events.json)\n' "$DIM" "$RST"
(cd asu-guide && $PM run db:push >/dev/null && $PM run db:seed | tail -n 2)
ok "asu-guide/local.db"

printf '  %sasu-events-api%s (events.db + embeddings — this is the slow part on first run)\n' "$DIM" "$RST"
if [ "$VPN_OK" = 1 ] && [ -n "${RC_OPENAI_API_KEY:-}" ]; then
  (cd asu-events-api && $PM run seed | tail -n 3)
  ok "asu-events-api/events.db with dense embeddings"
else
  (cd asu-events-api && $PM run seed 2>&1 | tail -n 3) || true
  warn "asu-events-api/events.db seeded WITHOUT embeddings (BM25 only). Re-run on VPN to add them."
fi

# The registry seeds registry.json from services.json only when registry.json is
# absent, so drop the runtime copy so a new checkout picks up every service.
rm -f asu-tools-api/registry.json
ok "asu-tools-api registry will seed from services.json on first start"

# asu-sso creates sso.db and its three demo accounts on first start; nothing to do.

# ---------------------------------------------------------------- done
step "Done"
cat <<EOF
  Start everything:      ${BOLD}./dev.sh${RST}
  Then open:             http://localhost:3000

  Demo sign-ins (fictional, local only):
    admin / admin · sundevil / sundevil

  Services:  asu-guide :3000 · asu-sso :4000 · asu-tools-api :5000
             asu-events-api :5001 · asu-search-api :5003 · asu-heatroute-api :5014 · asu-weather-api :5005
EOF
[ "$VPN_OK" = 1 ] || printf '  %s!%s VPN was not verified. Connect it before ./dev.sh or every model call fails.\n' "$YEL" "$RST"
command -v ffmpeg >/dev/null || printf '  %s!%s ffmpeg missing: video upload disabled.\n' "$YEL" "$RST"
[ -n "${BRAVE_API_KEY:-}" ] || printf '  %s!%s Web search not configured (optional).\n' "$YEL" "$RST"
[ -n "${NEXT_PUBLIC_HEATROUTE_MAP_STYLE_URL:-}" ] || printf '  %s!%s No MapTiler style URL: HeatRoute draws its SVG pilot map (optional).\n' "$YEL" "$RST"
echo
