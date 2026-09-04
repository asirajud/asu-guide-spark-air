#!/usr/bin/env bash
# Start all five services in one terminal with prefixed logs. Ctrl-C stops them all.
# Run ./install.sh first.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

[ -f .env ] || { echo "no ./.env — run ./install.sh first"; exit 1; }
set -a
# shellcheck disable=SC1091
. ./.env
set +a

if command -v pnpm >/dev/null; then PM=pnpm; else PM=npm; fi

# macOS AirPlay Receiver also listens on *:5000 and answers 403. Our tools API
# binds 127.0.0.1:5000 and works, but anything resolving localhost → ::1 hits AirPlay.
if [ "$(uname)" = Darwin ] && lsof -nP -iTCP:5000 -sTCP:LISTEN 2>/dev/null | grep -q ControlCe; then
  echo "! AirPlay Receiver is on port 5000. Fine for the app (it uses 127.0.0.1), but curl 127.0.0.1:5000, not localhost:5000."
fi

# Ports already in use? Usually a previous dev.sh or a stray `pnpm dev`. Ask.
PORTS=(3000 4000 5000 5001 5003 5004)
busy=()
for port in "${PORTS[@]}"; do
  # exclude AirPlay (ControlCenter) on 5000 — it does not block our 127.0.0.1 bind
  while read -r cmd pid; do
    [ "$cmd" = ControlCe ] && continue
    busy+=("$port $pid $cmd")
  done < <(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $1, $2}' | sort -u)
done
if [ "${#busy[@]}" -gt 0 ]; then
  echo "! These ports are already in use:"
  printf '    :%s  pid %s  (%s)\n' $(printf '%s\n' "${busy[@]}")
  if [ -t 0 ]; then
    read -r -p "  [k]ill them and start fresh / [c]ontinue anyway / [q]uit (default): " answer
  else
    answer=q
  fi
  case "$answer" in
    k | K)
      for entry in "${busy[@]}"; do
        pid="${entry#* }"; pid="${pid%% *}"
        kill "$pid" 2>/dev/null || true
      done
      sleep 1
      ;;
    c | C) echo "  continuing — services on busy ports will fail to bind and exit; the rest run" ;;
    *) echo "  quitting. Stop the old processes (or rerun and press k)."; exit 1 ;;
  esac
fi

if [ -t 1 ]; then RST=$'\e[0m'; C=($'\e[35m' $'\e[33m' $'\e[36m' $'\e[32m' $'\e[34m' $'\e[31m'); else RST=''; C=('' '' '' '' '' ''); fi

PIDS=()
run() {
  local name="$1" dir="$2" color="$3"
  shift 3
  (cd "$dir" && exec "$@") 2>&1 | sed -u "s/^/${color}[${name}]${RST} /" &
  PIDS+=($!)
}

trap 'echo; echo "stopping…"; kill 0 2>/dev/null' INT TERM EXIT

run sso        asu-sso        "${C[0]}" $PM run dev
run events     asu-events-api "${C[1]}" $PM run dev
run tools      asu-tools-api  "${C[2]}" $PM run dev
run search     asu-search-api "${C[3]}" $PM run dev
run heat       asu-heatroute-api "${C[5]}" $PM run dev
run guide      asu-guide      "${C[4]}" $PM run dev

echo
echo "  asu-guide      http://localhost:3000"
echo "  asu-sso        http://localhost:4000"
echo "  asu-tools-api  http://127.0.0.1:5000/health"
echo "  asu-events-api http://127.0.0.1:5001/health"
echo "  asu-heatroute-api http://127.0.0.1:5004/health"
echo "  asu-search-api http://127.0.0.1:5003/health"
echo

wait
