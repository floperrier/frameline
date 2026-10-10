---
status: accepted
---

# The backlog runs on one set of skills

Decided on 2026-10-11. Amends `docs/adr/0076-the-backlog-works-itself.md` on
which skills the routines run, who cuts a spec, and what merges into `dev`.

The routines 0076 set up ran on two methods at once. Triage and specs followed
`mattpocock/skills`, building and verifying followed pstack's `poteto-mode`, and
the two did not share a vocabulary: since v1.3, Matt Pocock's skills read a
glossary called `GLOSSARY.md`, and this repository's was `CONTEXT.md`. The
Atelier also cut each `needs-plan` spec into issues itself, in a session that
had never seen the conversation the spec came out of.

The routines now run on `mattpocock/skills` v1.3.1 alone, copied into
`.claude/skills/`, and pstack's copies leave the repository.

- **A spec arrives cut.** The developer writes it with `/to-spec` and cuts it
  with `/to-tickets` in the same session, into sub-issues whose blocking is
  GitHub's own. The Atelier builds a spec whole with `implement-spec`, on one
  integration branch, as one pull request. A ticket on its own is built with
  `implement`, and a bug with `diagnosing-bugs`, down to its regression test. An
  open design question gets a `prototype` on a branch of its own, and the
  question goes to the developer.
- **The Validation reads what the author says could go wrong.** It runs
  `verify` and `code-review` itself, and reads the pull request's Merge Danger,
  which the `pr` skill writes and the pull request template carries. A one-way
  door goes to the developer.
- **Two refusals go to the developer.** The plan is now the developer's, so an
  issue refused twice goes to `ready-for-human` instead of back to it.
  `needs-plan`, `planned`, `replanned` and `agent-wip` are gone.
- **A merge runs `dev`'s CI.** `agent-merge.yml` merges with the token of the
  flow's own GitHub App, because a merge made with `GITHUB_TOKEN` triggers no
  workflow. `ci.yml` runs `check` on a push to `dev`. When that fails,
  `dev-health.yml` opens a `dev-broken` issue, and until it is closed
  `agent-merge.yml` lands only the pull request that closes it. The same token
  lets `promotion.yml` keep a draft promotion open from `dev` to `main`.
- **Two weekly reports.** `retro-report.yml` gathers the week's refusals,
  escalations and breaks into an issue labelled `retro`. The Architecture
  routine posts the week's deepening opportunities in an issue labelled
  `architecture`, without touching the code. Running `/retro` stays the
  developer's act: retros that run on their own end up fixing false positives,
  and the repository drifts.
- **`CONTEXT.md` is `GLOSSARY.md`**, the only name the skills read.

## Considered Options

**Keeping pstack for building and verifying.** `implement` and `implement-spec`
call a `tdd` and a `code-review` of their own, and pstack's `tdd` holds the same
name in `.claude/skills/`. Two methods in one session also means two answers to
every question of method.

**Letting the Atelier keep cutting specs.** A cut made from the spec alone loses
the reasoning that wrote it. `/to-tickets` run in the session that grilled and
wrote the spec has that reasoning.

**Keeping `GITHUB_TOKEN` for the merge.** Then nothing runs on `dev` after a
merge, a red `dev` goes unseen until the promotion, and the promotion has to be
opened by hand.

## Consequences

**The flow has an App of its own.** It needs write access to Contents, Pull
requests and Issues, a client ID in the variable `AGENT_APP_CLIENT_ID` and a key
in the secret `AGENT_APP_PRIVATE_KEY`. `scripts/setup-wizard.sh` creates it.
Without it, `agent-merge.yml` fails and nothing lands.

**A spec's pull request does not open as a draft.** The cloud refuses GraphQL,
and marking a draft ready exists only there. The integration branch's pull
request opens ready and unlabelled, and takes `agent` and `to-verify` once its
code review is done.

**An update from upstream has to be patched again.** Upstream keeps `triage`,
`implement`, `implement-spec` and `improve-codebase-architecture` for the user,
and has `triage` start every comment with a line saying an AI wrote it.
`scripts/skills-model-invocable.sh` undoes both after `npx skills update`, and
`agent-guard` fails a pull request on which either has come back.
