---
status: accepted
---

# A sensitive path is built, and merged by hand

Decided on 2026-10-13, in issue #520. Amends
`docs/adr/0076-the-backlog-works-itself.md` and
`docs/adr/0083-the-backlog-runs-on-one-set-of-skills.md` on what the routines do
with a change that touches a path in `.github/agent-sensitive-paths`.

0076 had `agent-merge.yml` hand such a pull request to the developer instead of
merging it. The routines went further: Triage and the Atelier sent the issue to
`ready-for-human` and built nothing. Since `server/db/schema.ts` and
`server/db/migrations/` are on the list, every spec that adds a column stopped
there, and every ticket under it with it: #501 and #512 were handed back whole.

The list now falls in two.

- **The flow's own rules and the sign-in** — `.github/`, `.claude/`,
  `.githooks/` and `server/routes/auth/` — are still not built. A pull request
  runs the workflows of its own branch with the repository's secrets, the flow's
  App key among them, so a session that rewrote a workflow, a routine or a hook
  would be rewriting the rules it is judged by before anybody read them. A
  mistake in the sign-in is a mistake in who is let in.
- **The rest** — the schema, the migrations, `package.json` and its lock,
  `compose.yaml`, `vercel.json` — is built and verified like any other change.
  `agent-merge.yml` still refuses to merge it and labels it `ready-for-human`,
  so the developer reads a pull request that has passed the Validation, rather
  than writing it.

A spec now waits for the issues blocking it, the way a ticket already did. Two
specs that each add a migration would otherwise be built side by side, and the
second would conflict with the first while the first waits for the developer.

## Considered Options

**Building those specs by hand.** It unblocks two specs, and the next one that
adds a column stops in the same place.

**Carving the schema out of each spec.** The developer writes the migration, and
the Atelier builds the rest once it is on `dev`. A migration rarely comes apart
from the code that reads its column: #513's dependency, its Compose service and
its migration are one change.

## Consequences

`.github/agent-sensitive-paths` stays the one list `agent-merge.yml` reads. The
four paths that are not built are named in `.claude/routines/atelier.md`,
`.claude/routines/triage.md` and `AGENTS.md`, and the three change together.

Nothing reaches production without the developer either way. Only `main`
deploys, and the deploy is what applies a migration to Neon.
