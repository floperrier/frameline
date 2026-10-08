---
status: accepted
---

# Development brings its own database

Decided on 2026-10-08, issue #484. Takes up the last consequence of
`docs/adr/0075-the-suite-brings-its-own-database.md`, which left `pnpm dev` on the
Neon branch `development`, in the project production lives in.

That project went over its free quota on 2026-10-02, and Neon suspended every
compute in it until the month turns. The suite had stopped reaching Neon, but
`pnpm dev` had not: a checkout has served pages with no database behind them since,
so nobody can sign in to it or open a Story. That leaves `dev` with nothing to
judge it by before a promotion (`docs/git-flow.md`). And while Neon does answer,
every query a developer sends spends the same allowance production lives on.

**`pnpm dev` now runs on a Postgres on the machine.** It is the suite's two
containers from `compose.yaml`, a Postgres and the proxy that speaks Neon's
protocol, started a second time by `compose.dev.yaml` as a stack of its own:
named `frameline-dev`, published on 4446 rather than 4445, with its data in a
volume rather than in memory. `pnpm dev` runs `pnpm db:dev` first, which starts
the stack and applies the migrations through `server/db/migrate.ts` before Nuxt
starts. That takes about two seconds when the stack is already up. `.env.example`
names `postgres://postgres:postgres@db.localtest.me:4446/main`, and the app
reaches it through `server/db/endpoint.ts`, the same way the suite reaches its
own.

The two stacks never meet. The suite's database is still emptied each time its
stack goes down, because a database that has only ever seen the migrations is
its point. The developer's database keeps what an Author wrote from one day to
the next. Each has its own project name, port and containers, so either can be
started, stopped or recreated while the other is in use. Now that `.env` names
the developer's database, `playwright.config.ts` no longer takes the suite's
database from it: the suite reaches 4445 unless the environment names another.

## Considered Options

**A Neon project of its own for `development`**, which 0075 recommended. It
would take production out of the developer's reach, but development would
still stop each time that project's free quota ran out, and a database in
London would sit under every request a developer makes.

**The suite's stack, shared.** It already runs on the machine. Sharing it would
fill the developer's database with the suite's Authors, and every `docker compose
down` before a clean run would empty the developer's work.

**Plain Postgres, reached over TCP.** The app speaks to Neon over HTTP, through
`drizzle-orm/neon-http`. Going through the same proxy the suite uses means
`pnpm dev` runs the driver production runs, not one picked for development.

## Consequences

**`pnpm dev` needs Docker running.** Without it, the command stops at `pnpm db:dev`
with Docker's own error, before Nuxt starts.

**The `development` branch is no longer anybody's database.** What it holds stays
in Neon. Copying it to the machine has to wait until Neon answers again. A
migration on its way to production is still applied on the way into `dev`: it
reaches the developer's database the next time `pnpm dev` starts.

**`pnpm db:migrate` is what the deploy runs, and nothing else.** `drizzle-kit
migrate` cannot reach the proxy (0075). On a development machine, `pnpm dev` or
`pnpm db:dev` applies the migrations.

**`demonstration/write.ts` reaches the local database**, through the same routing,
so the works can be written into a checkout once its Author has signed in.
