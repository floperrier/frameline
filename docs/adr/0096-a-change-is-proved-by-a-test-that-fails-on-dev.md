---
status: accepted
---

# A change is proved by a test that fails on dev

Decided on 2026-10-16, in issue #531. Amends
`docs/adr/0076-the-backlog-works-itself.md` on how Triage confirms a bug,
`docs/adr/0083-the-backlog-runs-on-one-set-of-skills.md` on what the Validation
runs, and `docs/adr/0095-the-flow-settles-what-it-can-undo.md` on the Entretien.

The flow moves to the current version of the kit it was installed from. What it
changes, the protection staying the full one of two rulesets:

- **`verify` leaves the flow, and the repository.** Every behaviour a pull
  request changes arrives with a test that fails on `dev` and passes on the
  pull request, Vitest or the Playwright suite. The Validation runs the new
  tests against `dev`'s code itself and refuses a changed behaviour that has
  none. What can only be seen by running the app is written on a line
  *Non testé* in its proof, which the promotion reads. Triage locates a bug in
  `dev`'s code and leaves the test that reproduces it to the Atelier.
- **A light model orchestrates, a strong one works.** The Atelier and the
  Validation run on Sonnet and hand each item to a sub-agent on Opus, which
  starts from a clean context; the Validation never judges a pull request in
  the session that wrote it.
- **A label starts the routine waiting on it.** `changes-needed` starts the
  Atelier, `to-verify` the Validation, through a `pull_request.labeled` trigger
  set in each routine's form on claude.ai. The Validation keeps one scheduled
  run a day, as a net.
- **A run leaves nothing behind.** It removes the worktrees it made and follows
  no pull request once it ends: each wake-up would replay the whole run.
- **The flow reports on itself.** A routine that stumbles on the flow — a hook,
  a workflow, a script, a routine's own instructions — rather than on the code
  writes it on the open issue *Écarts du flow*, labelled `flow-kit`, which the
  flow otherwise ignores.
- **The Entretien runs every Monday.** Besides the copied skills, it brings the
  flow's files up to the kit by a three-way merge against the version recorded
  in `.claude/flow-backlog.lock`, and turns *Écarts du flow* into a pull request
  on the kit's own repository. Each of its pull requests here carries
  `ready-for-human`.

## Considered Options

**Keeping `verify` in the Validation.** It drove a production build of the real
app on the suite's database and kept screenshots as proof, and it is what a
Reader or an Author would see. It also built and served the app for every pull
request, on the strongest model, to prove once what a test proves on every run
after it; and the proof it kept was a picture nobody re-reads. The Playwright
suite already drives the same build against the same database.

**Keeping `verify` for the developer alone.** The developer reviews a branch by
running it locally (`docs/git-flow.md`), which needs no skill.

## Consequences

A change to what an Author or a Reader sees now costs an e2e test, or a line
*Non testé* that the promotion has to act on. `.claude/cloud-setup.sh` keeps
Docker, the suite's database and Chromium for the Playwright suite, and no
longer installs `lsof`, which only `verify` used.
