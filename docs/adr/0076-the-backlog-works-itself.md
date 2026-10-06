---
status: accepted
---

# The backlog works itself

Decided on 2026-10-06. Amends `docs/adr/0039-autonomous-work-waits-on-dev.md`
on who merges into `dev`, and `docs/git-flow.md` on how a commit is titled and
how the two branches are protected.

Until now the autonomous work was one loop on the developer's laptop. It chose
the next issue, built it, opened the pull request and armed its auto-merge, all
in the one run that wrote the change. Nothing it merged had been looked at by
anything but the run that wrote it, and nothing ran while the laptop slept.

The work is now three scheduled cloud sessions, each with one job and the
issue's labels as the only state they share. Their prompts are in
`.claude/routines/`.

- **Triage** reads what nobody has sorted yet. It reproduces a bug with
  `verify` before calling it one and writes the brief an implementer needs.
  It asks a single question in a comment when the issue does not say enough,
  and hands anything touching a sensitive path or a product decision to the
  developer.
- **Atelier** cuts each `needs-plan` spec into issues whose files do not
  overlap, so they can be built side by side. It builds `ready-for-agent`
  issues into pull requests labelled `agent` and `to-verify`. When a refused
  pull request has failed twice, it sends the issue back to the plan
  (`replanned`) rather than trying a third time.
- **Validation** reads those pull requests without having written them. It
  labels a change `agent-verified` with its proof, or `changes-needed` with
  what is missing.

`agent-verified` is what arms the merge, in `agent-merge.yml`, which squashes
into `dev` once the checks are green. That workflow refuses any pull request
that touches a path in `.github/agent-sensitive-paths` and hands it to the
developer instead. A push after the verdict withdraws it.

## Considered Options

**Keeping the laptop loop.** It verified its own work. Its throughput was capped
by one machine being awake, and on 2026-10-02 it spent the Neon quota production
lives on (`docs/adr/0075-the-suite-brings-its-own-database.md`).

**Letting the routine that builds a change merge it.** This is the same
self-verification, moved to the cloud. A second session that only reads costs
one run and catches what the author is blind to.

**Requiring the developer's approval on every pull request.** Then nothing lands
while the developer is away, which is the case `dev` exists for. The developer
still reads everything once, at the promotion.

## Consequences

**The repository enforces what a run could forget.** Two rulesets hold `dev` and
`main` to a pull request, `check`, `e2e` and `agent-guard`, with no bypass for
anyone. A routine acts under the owner's account, and a rule that account could
bypass would not stop it. The developer gives up the admin override
`docs/git-flow.md` kept as a hotfix path.

**Titles are Conventional Commits.** `agent-guard` checks the title of every
pull request, and the squash takes that title as the commit's subject. `dev`
reads as `feat:`, `fix:` and `chore:` rather than as sentences, which tells a
promotion's reader which commits change what an Author or a Reader sees.

**No trace of the tool reaches the record.** `.githooks/commit-msg` strips the
trailers, the settings turn the attribution off, and `agent-guard` fails a pull
request whose body or commits carry one. The commits already on `dev` from the
laptop loop predate the guard, so a promotion is exempt from the commit check.

**The skills are copied into the repository.** A cloud session loads none of the
developer's plugins. `.claude/skills/` therefore holds the triage, spec and
pstack skills the routines name, and `.claude/rules/pstack-models.md` holds the
models pstack runs them on. `.claude/cloud-setup.sh` readies each session to
build, test and verify. It reaches no Neon database.

**`dev` remains the quarantine.** Nothing here touches `main`. The promotion is
still the developer's act, and the condition 0039 would fall on, nobody writing
changes autonomously, is further away than before.
