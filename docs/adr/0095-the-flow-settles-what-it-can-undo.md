---
status: accepted
---

# The flow settles what it can undo

Decided on 2026-10-15, in issue #526. Amends
`docs/adr/0083-the-backlog-runs-on-one-set-of-skills.md` on what a second
refusal does and how `agent-merge.yml` waits for CI, and
`docs/adr/0094-no-path-is-held-back.md` on what still comes to the developer.

Amended in issue #531, by
`docs/adr/0096-a-change-is-proved-by-a-test-that-fails-on-dev.md`: the
Entretien runs every Monday, and also brings the flow's files up to the kit.

The flow moves to the current version of the kit it was installed from. What it
changes, the protection staying the full one of two rulesets:

- **A small product decision is the agent's.** Triage and the Atelier settle a
  product decision that is small and can be undone from the Produit section of
  `AGENTS.md` and the ADRs, and record it in an ADR with `domain-modeling`.
  One that cannot be undone, or that shapes what comes after it, still goes to
  the developer as `ready-for-human`, with nothing built. `retro-report.yml`
  lists the week's new ADRs, so each decision taken this way is read within the
  week.
- **Triage asks last.** Before it posts a question, it looks for the answer in
  the code, `GLOSSARY.md`, the ADRs, and with `research` for a third-party
  service.
- **No cap on a run.** Each routine goes as far as its quota and stops cleanly
  where it runs out; what is left is the next run's.
- **A second refusal re-cuts the issue once.** The Atelier closes the pull
  request and cuts its issue with `to-tickets` into smaller sub-issues, which it
  labels `replanned` and builds as a spec. An issue already `replanned` goes to
  the developer. `to-tickets` is made model-invocable for it.
- **`agent-merge.yml` waits on the checks itself.** It runs on the
  `agent-verified` label and at the end of every CI and `agent-guard` run, and
  squashes once every check on the current commit has passed, with
  `--match-head-commit`. A red check sends the pull request back as
  `changes-needed`. GitHub's auto-merge is no longer asked for.
- **One path is held back: the approved install scripts.** A pull request that
  changes which dependencies may run a script at install, `allowBuilds` in
  `pnpm-workspace.yaml` or its equivalent in a `package.json`, goes to the
  developer to merge.
- **The promotion says what to read first.** Its description lists the direct
  dependencies `dev` adds and the areas of `.github/promotion-watch` it touches.
- **A pull request's CI can only read.** `ci.yml` and `agent-guard.yml` run with
  `contents: read` and leave no credential in the checkout.
- **The Entretien routine** opens a monthly pull request from
  `chore/skills-update` with the copied skills brought up to date. It carries
  `ready-for-human` and not `agent`: it changes how every routine works, so the
  developer merges it. `deps-intake.yml` labels a Dependabot or Renovate pull
  request for the Validation, which reads its release notes; neither bot is set
  up yet.

## Considered Options

**Keeping every product decision for the developer (0094).** Most of what came
back as `ready-for-human` was small enough to be undone by the next pull
request, and waited on the developer all the same.

**Holding no path back (0094).** 0094 let the list go because holding back a
merge never stopped a workflow from running before it. An install script is the
other way round: before the merge it runs only in CI, which now holds no secret
and can only read; after it, it runs on the developer's machine and in every
cloud session.

**A cap on each run.** It kept the quota predictable and the backlog waiting.

## Consequences

`docs/adr/` now holds decisions nobody but an agent has read; the weekly retro
is where the developer reads them, and a revert undoes one.

An issue refused twice gets one more attempt from a cut the Atelier made
without the conversation the spec came from, which 0083 held a cut should have.
