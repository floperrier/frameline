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
verified it: see `docs/adr/0076-the-backlog-works-itself.md`. `agent-guard`
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
pnpm install && pnpm db:migrate && pnpm dev
```

`pnpm db:migrate` touches the `development` branch of the database and never
production, so a migration waiting in the promotion is exercised on the way in.
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

Merging it closes it, so the next one has to be opened, by hand:
`gh pr create --base main --head dev --title 'chore: promote dev to main'`, a
title `agent-guard` accepts. It is deliberately not opened by a workflow: a pull request created with `GITHUB_TOKEN` triggers no
workflow of its own, so it would arrive with neither `check` nor `e2e` and
`main`'s protection would refuse it.

Let a promotion be small enough to read. A batch that has grown past reading is
a batch that gets promoted unread, which puts the quarantine back where it
started.

## Which database a change talks to

The git flow above has a database counterpart, and it matters more here than the
branch names do: a Neon branch is cheap, but there is only one production
dataset.

| Where the code runs | Database |
| --- | --- |
| production deployment | the Neon branch `production` |
| `pnpm dev` | the Neon branch `development` |
| a CI run | a Postgres container of its own, thrown away with the runner |
| `pnpm test:e2e` on your machine | whatever `DATABASE_URL` names — `development`, or the container `pnpm test:db` starts |

The end-to-end suite never needs Neon, and in CI it never touches it. Its runs
used to take Neon branches in the project production lives in, until on
2026-10-02 they spent that project's free quota and Neon suspended every compute
in it, production's with them — see
`docs/adr/0075-the-suite-brings-its-own-database.md`. On your machine,
`pnpm test:db` starts the same two containers CI does (`compose.yaml`) and
migrates them, and the suite reaches them with
`DATABASE_URL=postgres://postgres:postgres@db.localtest.me:4445/main pnpm test:e2e`;
`.env` still names `development`, for `pnpm dev`.

So `pnpm db:migrate` on your machine touches `development`, never production. A
migration reaches `production` in the deploy that carries the code needing it:
`vercel.json` builds with `pnpm db:migrate && pnpm build`, so a migration that
fails takes the deploy down with it and the previous one keeps serving. Nobody
runs a migration against production by hand — see
`docs/adr/0002-the-schema-moves-with-the-deploy.md`, which also says what that
demands of a migration that drops something.

When `development` has drifted into a mess, throw it away rather than repairing
it: `neon branches reset development --parent` refills it from `production`.

One shared `development` branch is enough for one developer. A Neon branch per
git branch would only add bookkeeping — the suite's own database already covers
the case where isolation actually pays.

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
not count.
