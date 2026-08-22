# Frameline

An editor for interactive narrative works that speaks the grammar of cinema.
Read `CONTEXT.md` before touching anything — the glossary is binding.

## Agent skills

Skills vendored from other repositories live in `.agents/skills/`, with
`.claude/skills/` symlinked to them and `skills-lock.json` recording the source
and content hash of each. Update them through the tool that wrote the lock file
rather than editing the copies.

### Issue tracker

Issues and specs live in GitHub Issues for `floperrier/frameline`, via the `gh`
CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name. See
`docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See
`docs/agents/domain.md`.

## Git flow

A pull request per issue, squash-merged into `main`, which deploys to
production. See `docs/git-flow.md`.

## Tests

`pnpm test` runs the Vitest suite over the modules that are pure functions: the
Reading engine, and what a Shot's image is read to be. Neither needs a database,
because neither has one in reach. `pnpm test:e2e` runs Playwright against a
built app and a real Neon branch — `docs/git-flow.md` says which branch.

## Running the app

`pnpm dev` after copying `.env.example` to `.env` and filling it in. The Neon
schema is applied with `pnpm db:migrate`; never edit the database by hand.
Migrations are generated from `server/db/schema.ts` with `pnpm db:generate`.
