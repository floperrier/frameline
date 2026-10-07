#!/usr/bin/env bash
# Readies a cloud session to build, test and verify: the dependencies, the suite's
# own database, the headless Chromium the verify skill drives, and the repository's
# git hooks. The SessionStart hook in .claude/settings.json runs it on every start,
# and on a laptop it returns at once. Each step leaves alone what is already there.
#
# No account to provision: the verify skill and the e2e suite each seed an Author
# of their own and seal its session cookie, so nothing here signs in through OAuth.
# Nothing here reaches Neon either, whose free quota is production's: see
# docs/adr/0075-the-suite-brings-its-own-database.md.
[ "${CLAUDE_CODE_REMOTE:-}" = true ] || exit 0
cd "$(dirname "$0")/.." || exit 0
log=/tmp/cloud-setup.log

step() {
  local name=$1
  shift
  if "$@" >> "$log" 2>&1; then echo "cloud-setup: $name ok"
  else echo "cloud-setup: $name FAILED, see $log${hint:+; $hint}"; fi
}

root() { if [ "$(id -u)" = 0 ]; then "$@"; else sudo -n "$@"; fi; }

# verify.sh finds the port its server holds with lsof, which the image lacks.
lsof_installed() {
  command -v lsof && return
  root apt-get update -qq && root apt-get install -y -qq lsof
}

# The driver reaches the suite's database by this name; a resolver that cannot look
# it up still has the hosts file.
local_name() {
  grep -q db.localtest.me /etc/hosts || echo '127.0.0.1 db.localtest.me' | root tee -a /etc/hosts
}

docker_up() {
  docker info > /dev/null 2>&1 && return
  root sh -c 'nohup dockerd > /tmp/dockerd.log 2>&1 &'
  for _ in $(seq 30); do docker info > /dev/null 2>&1 && return; sleep 1; done
  return 1
}

step 'git hooks' git config core.hooksPath .githooks
step lsof lsof_installed
step db.localtest.me local_name
step dependencies pnpm install --frozen-lockfile
step docker docker_up
# One stack per machine, under the project name verify.sh starts it with. The
# proxy's image comes from ghcr.io, whose blobs are served from another host.
hint='the environment has to allow pkg-containers.githubusercontent.com' \
  step database env COMPOSE_PROJECT_NAME=frameline pnpm test:db
hint='the environment has to allow cdn.playwright.dev and playwright.download.prss.microsoft.com' \
  step chromium pnpm exec playwright install chromium
exit 0
