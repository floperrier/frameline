---
status: accepted
---

# The suite brings its own database

Decided on 2026-10-03, issue #454. Amends
`docs/adr/0002-the-schema-moves-with-the-deploy.md` on one point: the
migrations are still proven before a pull request can go green, but no longer on
a Neon branch.

Every end-to-end run used to take a Neon branch forked from `development`, in
the Neon project `production` lives in. On the free plan a project's quota is one
allowance — compute and public network transfer, by the month — and when it runs
out Neon suspends every compute in the project until the month turns or the plan
changes. On 2026-10-02 at 11:38 UTC the agent loop's runs spent it: 94 of them in
a day and a half, each one writing and reading back the Images a Shot holds in
its own row (`docs/adr/0005-a-shots-image-lives-in-its-row.md`) across the
public network. Production answered `/api/catalogue` with a 500 from that minute,
and every pull request after went red at *Create a Neon branch for this run*,
whatever it changed.

What the suite needs from a database is a Postgres that has seen nothing but the
migrations, reached the way the app reaches its own. **It now makes one for each
run**: `compose.yaml` holds `postgres:18` and, beside it, a proxy that speaks
Neon's HTTP protocol to the serverless driver
(`ghcr.io/timowilhelm/local-neon-http-proxy`, the one Neon's own guide to local
development uses, pinned by digest), and `pnpm test:db` starts both and migrates
them — in CI and on a development machine alike. `server/db/endpoint.ts` sends a
connection string naming `db.localtest.me` — a name that resolves to the machine
itself — to that proxy, and every other host to Neon exactly as before.

The proxy is Neon's own, tuned for a service shared by thousands of databases
and run here for one suite. As the image starts it, it checks the password on
every request by hashing it 4096 times, four at a time; opens a fresh connection
for every query unless the driver asks for a pooled one, which it does not; and
caps the requests a second an endpoint may send. CI got through a third of the
suite in the twenty minutes the job allows. `compose.yaml` starts it with the
password hashed once, pooling on for every request and the cap lifted — about
fourteen times the throughput — and lets Postgres take a thousand clients rather
than a hundred, which a suite's bursts went past.

## Considered Options

**A Neon project of its own for CI and `development`.** Each free project has its
own allowance, so production would no longer share theirs — but the suite would
still spend one, the loop would stop for the rest of the month each time it ran
out, and every run would still pay a branch's creation and the network's
latency. It remains worth doing for `development`, which `pnpm dev` and the
agents' own runs still reach.

**A paid plan.** It removes the cliff by billing past it, for a database the
suite throws away after seven minutes.

**Neon Local**, Neon's proxy for local work, creates an ephemeral Neon branch per
session: it is the same spending with a different front door.

## Consequences

**The migrations are applied by drizzle's migrator, not by `drizzle-kit
migrate`.** `drizzle-kit` reaches Postgres through the serverless driver's
WebSocket and cannot be pointed at the proxy; `server/db/migrate.ts` calls the
migrator `drizzle-kit migrate` itself runs, over the same files and the same
journal, through the app's own HTTP driver. The deploy still runs `pnpm
db:migrate` against Neon, so what proves a migration and what applies it to
production are one migrator driven two ways.

**The suite no longer meets Neon's network.** The latency between a GitHub runner
and a database in London was the ground several races grew in (#367), and the
pooler's transaction mode was exercised on every run. Neither is now; a bug that
only Neon's network shows would show first on `development` or in production.

**CI needs no Neon secret any more.** `NEON_API_KEY` stays in the repository's
secrets for whatever else wants it, and nothing in `ci.yml` reads it.

**`development` still shares production's project.** `pnpm dev` and any suite
run pointed at `.env` spend the same allowance. The agent loop runs its suite
against `pnpm test:db`'s containers and checks that the database answers before
each turn, but a project of its own for `development` is what would take
production out of reach entirely.
