#!/usr/bin/env bash
# Usage: verify.sh launch [--no-build] | doctor | stop
set -euo pipefail

root=$(git rev-parse --show-toplevel)
here="$root/.claude/skills/verify"
state="$root/.verify"
pidfile="$state/server.pid"
portfile="$state/server.port"
mkdir -p "$state/runs"
cd "$root"

alive() { [ -s "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2> /dev/null; }

# 3100 is `pnpm dev`, 3101 is the e2e suite's own server.
free_port() {
  for port in $(seq 3190 3199); do
    lsof -nP -iTCP:"$port" -sTCP:LISTEN > /dev/null 2>&1 || { echo "$port"; return; }
  done
  echo "no free port in 3190-3199" >&2
  return 1
}

launch() {
  if alive; then
    echo "already serving http://localhost:$(cat "$portfile") (pid $(cat "$pidfile"))"
    return
  fi
  if [ "${1:-}" != --no-build ]; then
    pnpm build > "$state/build.log" 2>&1 || { tail -30 "$state/build.log"; exit 1; }
  fi
  local port
  port=$(free_port)
  PORT=$port nohup node --env-file=.env .output/server/index.mjs > "$state/server.log" 2>&1 &
  echo $! > "$pidfile"
  echo "$port" > "$portfile"
  for _ in $(seq 60); do
    if curl -sf -o /dev/null "http://localhost:$port/"; then
      echo "serving http://localhost:$port (pid $(cat "$pidfile"))"
      return
    fi
    alive || { tail -30 "$state/server.log"; exit 1; }
    sleep 1
  done
  echo "no answer on $port after 60s, see $state/server.log" >&2
  exit 1
}

doctor() {
  local failed=0 port pid code stale
  report() { printf '%-5s %s\n' "$1" "$2"; [ "$1" = ok ] || failed=1; }

  for name in NUXT_SESSION_PASSWORD DATABASE_URL; do
    if grep -q "^$name=." .env 2> /dev/null; then report ok "$name is set in .env"
    else report FAIL "$name is missing from .env"; fi
  done

  local migrations
  migrations=$(node --env-file=.env --input-type=module -e "
    import { readdirSync } from 'node:fs'
    import { neon } from '@neondatabase/serverless'
    const [{ n }] = await neon(process.env.DATABASE_URL)\`select count(*)::int as n from drizzle.__drizzle_migrations\`
    const files = readdirSync('server/db/migrations').filter((f) => f.endsWith('.sql')).length
    console.log(n === files ? 'ok' : 'FAIL', n + ' of ' + files + ' migrations applied to the .env database' + (n === files ? '' : '; run pnpm db:migrate'))
  " 2>&1) || migrations="FAIL the .env database does not answer: $migrations"
  report "${migrations%% *}" "${migrations#* }"

  if ! alive; then
    report FAIL "no server started by verify.sh; run launch"
    return 1
  fi
  port=$(cat "$portfile")
  pid=$(cat "$pidfile")
  if [ "$(lsof -tiTCP:"$port" -sTCP:LISTEN | sort -u)" = "$pid" ]; then
    report ok "pid $pid owns port $port"
  else report FAIL "port $port is not held by pid $pid"; fi
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$port/")
  if [ "$code" = 200 ]; then report ok "GET / answers 200"; else report FAIL "GET / answers $code"; fi
  stale=$(find app server shared i18n nuxt.config.ts -type f -newer .output/nitro.json 2> /dev/null | head -1)
  if [ -z "$stale" ]; then report ok "the build is newer than every source file"
  else report STALE "$stale changed after the build; stop, then launch"; fi
  return $failed
}

stop() {
  node --env-file=.env "$here/drive.ts" sweep
  if alive; then kill "$(cat "$pidfile")"; fi
  rm -f "$pidfile" "$portfile"
  echo "stopped; evidence kept in $state/runs"
}

case "${1:-}" in
  launch) shift; launch "$@" ;;
  doctor) doctor ;;
  stop) stop ;;
  *) echo "usage: $0 launch [--no-build] | doctor | stop" >&2; exit 2 ;;
esac
