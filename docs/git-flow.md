# Git flow

Two long-lived branches, and what separates them is whether a commit has been
read. `dev` is where every change lands. `main` is what deploys, and `dev`
reaches it whole, in a promotion performed once what accumulated there has been
read.

The second branch is there because changes are written here overnight by an
agent loop, with nobody awake to review them: what that work needs is not review
before it lands but a place to land that is not production. See
`docs/adr/0039-autonomous-work-waits-on-dev.md`, which also says what would make
one branch the right answer again.

There is still no release branch and no tag: nothing here is distributed, so a
deploy _is_ a release, and the merge commit of a promotion is what marks one.

## The loop

1. Branch from `dev`, named after the issue it closes:
   `git switch -c 12-rename-a-scene`.
2. Commit as you go and push early.
3. Open the pull request on the first push, against `dev`: `pnpm pr`. It takes
   the title from the last commit's subject, so that subject is written in
   Conventional Commits (`feat: let an Author rename a Scene`), and fills the
   body from `.github/pull_request_template.md`, with `Closes #` already
   carrying the number the branch is named after. `gh pr create --fill` would
   take the commit messages instead and never see the template.

The backlog's routines run this same loop, from an issue labelled
`ready-for-agent` to a pull request that lands once another routine has
verified it: see `docs/adr/0076-the-backlog-works-itself.md` and
`docs/adr/0083-the-backlog-runs-on-one-set-of-skills.md`. A push to `dev` runs
`check`, and when it fails `dev-health` opens a `dev-broken` issue: until that
issue is closed, `agent-merge` lands only the pull request that closes it. `agent-guard`
holds every pull request to the branch name, the Conventional Commits title and
a record free of any mention of the tool that wrote it.

`dev` is the repository's default branch, so nothing has to be told where to
aim and `Closes #` closes its issue on merge. GitHub records that link for the
default branch alone, which is why the default is the branch work lands on
rather than the branch that deploys.

## Why a pull request when nobody reviews it

The pull request is not a review surface here, it is the only place the
end-to-end suite runs. `.github/workflows/ci.yml` runs `e2e` on `pull_request`
alone, and each run makes a database of its own — a Postgres that has only ever
seen the migrations, which proves them before the pull request can go green. A
push to a topic branch runs nothing.

There are no preview deployments. `vercel.json` disables Git deployments for
every branch but `main`, because a preview cannot sign anyone in: the OAuth
callback URLs are registered for the production origin and `localhost:3100`
only, so a preview shows the signed-out pages and nothing more. What a preview
did prove — that a production build succeeds — the `check` job now proves with
`pnpm build`.

**Nothing deploys from `dev` either, and nothing needs to: `dev` is judged by
running it.** `localhost:3100` is one of the two registered OAuth callbacks, so
a checkout signs in and behaves like the product — which is exactly what a
preview deployment cannot do. Before a promotion:

```sh
git switch dev && git pull
pnpm install && pnpm dev
```

`pnpm dev` applies the migrations to the database on your machine before it
serves, never to production, so a migration waiting in the promotion is
exercised on the way in.
A promotion is therefore read as a diff *and* used as a product, which is more
than a preview origin would have bought.

The `check` job also runs `pnpm test`, the Vitest suite over the Reading engine.
That one needs no database at all, so it runs on every push rather than waiting
for a database it would not use.

Committing straight to either branch skips the tests, and on `main` it puts an
unproven commit in production.

## Promoting `dev` to `main`

A promotion is its own act, and the only one that reaches production. A pull
request from `dev` to `main` stands open: it is the standing answer to what is
waiting to be deployed, carrying the whole diff and every commit. Reading it and
merging it is the release.

Merge it with a **merge commit**, not a squash. Every commit on `dev` is already
one squashed sentence per change, so there is no work in progress left to bury,
and squashing the batch would replace thirty-five sentences with one. The merge
commit is also the release marker this repository has no tags for.

`.github/workflows/promotion.yml` keeps it: on every push to `dev` it opens the
pull request as a draft if none stands open, and rewrites its description as
`dev`'s log since the last promotion, grouped by Conventional Commits type.
Reading it means marking it ready and merging it. The workflow opens it with the
token of the flow's GitHub App, not `GITHUB_TOKEN`: a pull request created with
`GITHUB_TOKEN` triggers no workflow of its own, so it would arrive with neither
`check` nor `e2e` and `main`'s protection would refuse it.

Let a promotion be small enough to read. A batch that has grown past reading is
a batch that gets promoted unread, which puts the quarantine back where it
started.

## Which database a change talks to

The git flow above has a database counterpart, and it matters more here than the
branch names do: a database is cheap, but there is only one production
dataset.

| Where the code runs | Database |
| --- | --- |
| production deployment | the Neon branch `production` |
| `pnpm dev` | a Postgres container on your machine, kept in a volume, which `pnpm dev` starts |
| a CI run | a Postgres container of its own, thrown away with the runner |
| `pnpm test:e2e` on your machine | the container `pnpm test:db` starts, unless the environment names another |

The end-to-end suite never needs Neon, and in CI it never touches it. Its runs
used to take Neon branches in the project production lives in, until on
2026-10-02 they spent that project's free quota and Neon suspended every compute
in it, production's with them — see
`docs/adr/0075-the-suite-brings-its-own-database.md`. On your machine,
`pnpm test:db` starts the same two containers CI does (`compose.yaml`) and
migrates them, and `pnpm test:e2e` reaches them at
`postgres://postgres:postgres@db.localtest.me:4445/main` unless the environment
names another database.

`pnpm dev` stopped reaching Neon too, once the same suspension left it with no
database at all — see `docs/adr/0082-development-brings-its-own-database.md`. It
runs `pnpm db:dev` first, which starts those two containers again as a stack of
their own (`compose.dev.yaml`, named `frameline-dev`, on 4446) and migrates them.
That stack keeps its data in a volume, and `.env` names it. Neither stack ever
touches the other's database.

So a migration on your machine reaches the database `pnpm dev` starts, never
production. A
migration reaches `production` in the deploy that carries the code needing it:
`vercel.json` builds with `pnpm db:migrate && pnpm build`, so a migration that
fails takes the deploy down with it and the previous one keeps serving. Nobody
runs a migration against production by hand — see
`docs/adr/0002-the-schema-moves-with-the-deploy.md`, which also says what that
demands of a migration that drops something.

When the database on your machine has drifted into a mess, throw it away rather
than repairing it: `docker compose -f compose.yaml -f compose.dev.yaml down -v`,
and the next `pnpm dev` starts an empty one.

One database on the machine is enough for one developer, whichever worktree runs
`pnpm dev`: the stack's name is fixed rather than taken from the directory. A
database per git branch would only add bookkeeping — the suite's own database
already covers the case where isolation actually pays.

## Squash, not merge

A change lands on `dev` as one commit whose subject is its pull request's title,
in Conventional Commits (`feat: let an Author rename a Scene`), and whose body is
the pull request's description. The repository squashes with exactly those two,
so a branch's work in progress never reaches `dev`, and the prefix says at a
glance which commits of a promotion change what an Author or a Reader sees.

The one merge commit is the promotion above, where there is no work in progress
left to bury and squashing would cost one subject per change.

## Protecting both branches

Two rulesets, one per branch, hold `dev` and `main` to the same rules: a change
arrives by pull request, `check`, `e2e` and `agent-guard` pass before it merges,
the branch is never force-pushed nor deleted, and nobody bypasses any of it, the
repository's owner included. `dev` takes squash merges alone and `main` merge
commits alone, so each branch can only be written the way this document says.

No bypass is the point. The routines act under the owner's GitHub account, and a
rule that account could bypass would not stop them: a broken production deploy
now goes through a pull request like everything else, which `check` makes a few
minutes long.

The checks are not `strict`. A routine verifies several pull requests in one run
and auto-merge does not bring a branch up to date with its base, so asking for it
would hold every pull request but the first until somebody updated it by hand. A
change two green pull requests break together surfaces in the next pull
request's CI, which builds on `dev` as it then stands, and at the latest in the
promotion's.

```sh
for branch in dev main; do
  method=$([ "$branch" = dev ] && echo squash || echo merge)
  gh api -X POST repos/floperrier/frameline/rulesets --input - <<JSON
{
  "name": "$branch",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": { "ref_name": { "include": ["refs/heads/$branch"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "require_extra_approval_for_unattributed_changes": false,
        "allowed_merge_methods": ["$method"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "check", "integration_id": 15368 },
          { "context": "e2e", "integration_id": 15368 },
          { "context": "agent-guard", "integration_id": 15368 }
        ]
      }
    }
  ]
}
JSON
done
```

`15368` is GitHub Actions, so a status of the same name from anywhere else does
not count. `require_extra_approval_for_unattributed_changes` has to be said out
loud: GitHub turns it on wherever a payload leaves it out, and it then holds any
pull request carrying a commit no GitHub account claims until somebody approves
it, which nobody here does.
