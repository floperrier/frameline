#!/usr/bin/env bash
# Usage: verify.sh launch [--no-build] | doctor | stop
set -euo pipefail

root=$(git rev-parse --show-toplevel)
here="$root/.claude/skills/verify"
state="$root/.verify"
pidfile="$state/server.pid"
portfile="$state/server.port"
password="$state/session-password"
# The e2e suite's own database from compose.yaml, never Neon, whose free quota is
# production's: see docs/adr/0075-the-suite-brings-its-own-database.md. drive.ts
# names the same one.
database=postgres://postgres:postgres@db.localtest.me:4445/main
mkdir -p "$state/runs"
cd "$root"

alive() { [ -s "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2> /dev/null; }

database_answers() { (exec 3<> /dev/tcp/127.0.0.1/4445) 2> /dev/null; }

# One database for the machine, whichever worktree started it. Compose names a
# project after its directory, so another worktree's `pnpm test:db` would start a
# second stack fighting the first for 4445; and compose recreates a container whose
# file changed, which would empty the database under whoever is using it. So a
# stack that answers is left alone, and one is started only where none does.
database() {
  if ! database_answers; then
    docker compose -p frameline up -d --wait > "$state/database.log" 2>&1 ||
      { tail -20 "$state/database.log"; exit 1; }
  fi
  DATABASE_URL=$database node server/db/migrate.ts > "$state/migrate.log" 2>&1 ||
    { tail -20 "$state/migrate.log"; exit 1; }
}

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
  database
  if [ "${1:-}" != --no-build ]; then
    # The build writes DATABASE_URL into the server as its default, and would
    # otherwise take it from .env, which names Neon.
    DATABASE_URL=$database pnpm build > "$state/build.log" 2>&1 ||
      { tail -30 "$state/build.log"; exit 1; }
  fi
  [ -s "$password" ] || openssl rand -hex 32 > "$password"
  local port
  port=$(free_port)
  # The NUXT_ names override whatever the build wrote, so a build made by
  # `pnpm build` beside .env still serves the suite's database here.
  PORT=$port NUXT_DATABASE_URL=$database NUXT_SESSION_PASSWORD=$(cat "$password") \
    nohup node .output/server/index.mjs > "$state/server.log" 2>&1 &
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
  local failed=0 port pid code stale migrations
  report() { printf '%-5s %s\n' "$1" "$2"; [ "$1" = ok ] || failed=1; }

  if database_answers; then report ok "the suite's database answers on 4445"
  else report FAIL "nothing answers on 4445; run launch, which starts the database"; fi

  migrations=$(node --input-type=module -e "
    import { readdirSync } from 'node:fs'
    import { sql } from '$here/drive.ts'
    const [{ n }] = await sql\`select count(*)::int as n from drizzle.__drizzle_migrations\`
    const files = readdirSync('server/db/migrations').filter((f) => f.endsWith('.sql')).length
    console.log(n === files ? 'ok' : 'FAIL', n + ' of ' + files + ' migrations applied to the suite\'s database' + (n === files ? '' : '; run launch, which applies them'))
  " 2>&1) || migrations="FAIL the suite's database does not answer a query: ${migrations##*Error: }"
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
  if database_answers; then node "$here/drive.ts" sweep; fi
  if alive; then kill "$(cat "$pidfile")"; fi
  rm -f "$pidfile" "$portfile"
  echo "stopped; evidence kept in $state/runs; the suite's database stays up for whoever shares it"
}

case "${1:-}" in
  launch) shift; launch "$@" ;;
  doctor) doctor ;;
  stop) stop ;;
  *) echo "usage: $0 launch [--no-build] | doctor | stop" >&2; exit 2 ;;
esac
