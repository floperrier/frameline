#!/usr/bin/env bash
# Before a session stops: the typecheck and the unit suite, whenever there is work in
# progress, a topic branch or uncommitted changes. A session that sits on dev or main
# with a clean tree, a triage run for one, changed nothing there is to check.
#
# It blocks the stop once. When the session stops again after that, the gate lets it
# go, so a red it cannot fix, one already on dev for instance, is reported rather
# than retried until the quota runs out.
jq -e '.stop_hook_active' > /dev/null && exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
branch=$(git branch --show-current)
if { [ "$branch" = dev ] || [ "$branch" = main ]; } && [ -z "$(git status --porcelain)" ]; then
  exit 0
fi
out=$({ pnpm typecheck && pnpm test; } 2>&1) || {
  printf 'The typecheck or the unit suite fails:\n%s\n' "$(printf '%s\n' "$out" | tail -40)" >&2
  exit 2
}
