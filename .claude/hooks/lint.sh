#!/usr/bin/env bash
# After an edit: Prettier on the kinds of file it formats here, css, json and yaml.
# AGENTS.md says why the TypeScript and the Vue are left as their authors wrap them.
file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  "$CLAUDE_PROJECT_DIR"/*.css | "$CLAUDE_PROJECT_DIR"/*.json | "$CLAUDE_PROJECT_DIR"/*.yml | "$CLAUDE_PROJECT_DIR"/*.yaml) ;;
  *) exit 0 ;;
esac
cd "$CLAUDE_PROJECT_DIR" || exit 0
out=$(pnpm exec prettier --write --log-level warn "$file" 2>&1) || { printf '%s\n' "$out" >&2; exit 2; }
