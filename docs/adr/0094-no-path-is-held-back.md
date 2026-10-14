---
status: accepted
---

# No path is held back

Decided on 2026-10-13, in issue #522. Supersedes
`docs/adr/0093-a-sensitive-path-is-built-and-merged-by-hand.md`, and amends
`docs/adr/0076-the-backlog-works-itself.md` and
`docs/adr/0083-the-backlog-runs-on-one-set-of-skills.md` on what holds a change
back from `dev`.

Amended in issue #526, by `docs/adr/0095-the-flow-settles-what-it-can-undo.md`:
the approved install scripts are held back, and a small product decision that can
be undone is the agent's to settle.

`.github/agent-sensitive-paths` is gone. The Atelier builds whatever a spec or a
ticket asks for, the flow's own workflows, routines and hooks included. The
Validation judges it like any other change, and `agent-merge.yml` merges what
the Validation passes. What still comes to the developer is a product decision,
a one-way door the Merge Danger announces, and a pull request refused twice.

## Considered Options

**Building the listed paths and merging them by hand (0093).** Every spec that
touched the schema then waited on the developer's merge, and so did every spec
blocked behind it.

**Keeping the flow's own rules out of the Atelier's hands.** A pull request runs
the workflows of its own branch with the repository's secrets, the flow's App
key among them. The list never stopped that: it held back the merge, and a
workflow runs before it is merged.

## Consequences

Nothing on `dev` has been read by the developer before the promotion, which is
the one human gate left: what deploys is still read whole before it does.

A routine can rewrite its own prompt, a workflow or a hook, and the next run
follows what it wrote.
