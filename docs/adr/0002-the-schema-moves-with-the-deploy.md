---
status: accepted
---

# The schema moves with the deploy, never by hand

A migration used to reach `production` when a human ran it against that branch
after the merge. That step proved nothing: CI has already applied every migration
to a disposable Neon branch forked from `development` before the pull request
could go green. All the step added was a window in which `main` was live against
a schema that had not caught up — a window we walked straight into once, shipping
a Scene editor to a production database with no `scenes` table.

So `vercel.json` builds with `pnpm db:migrate && pnpm build`. Vercel has no
release phase between the build and the traffic switch, which makes the build the
only place that runs before the new code serves anything; Neon documents the same
pattern for its own Vercel integration. A migration that fails fails the build,
and the previous deployment keeps serving.

## Considered Options

A GitHub Actions job on `push: main` would keep production write credentials off
the build machine, which is the one real advantage the build command gives up.
We rejected it because it loses the ordering that is the whole point: Vercel's
Git deploy fires in parallel with the workflow, so the new code can start serving
before the migration lands. Restoring the order means disabling Git deployments
and rebuilding the pipeline around `vercel build` and `vercel deploy --prebuilt`
— a great deal of machinery to buy what `pnpm db:migrate &&` already buys.

Keeping the manual step was the other option. Its only merit was the pause it
imposed before a destructive change, and a pause that depends on memory is not a
safeguard. The discipline below replaces it.

## Consequences

**Every migration has to be safe for the code already running.** The schema
changes before the new code serves traffic, and `vercel rollback` returns the
code without returning the schema, so there is always a moment — and after a
rollback, possibly a long one — where the previous revision is talking to the new
schema. Additive changes are fine. Anything that removes or narrows takes two
deploys: first the code that no longer needs the column, then the migration that
drops it.

**Migrations connect directly, the application connects through the pooler.**
Two environment variables name the same Neon branch through different endpoints,
because the pooler runs in transaction mode and drops the session state a
migration relies on. CI splits them the same way, so the suite exercises the
split rather than assuming it.

**The build machine can alter the production schema.** That is acceptable only
because `vercel.json` allows deployments from `main` alone. Turning previews back
on would hand the same power to every branch, and this decision would have to be
reopened.

**`pnpm build` in the `check` job is no longer the whole production build
command.** It still proves the part that can fail without a database, which is
what it was there for.
