# Git flow

One developer, one long-lived branch. `main` is always deployable, and every
change reaches it through a pull request.

There is no `develop`, no release branch and no tag: nothing here is
distributed, so a deploy _is_ a release. A second long-lived branch would only
give the same commits a second place to sit.

## The loop

1. Branch from `main`, named after the issue it closes:
   `git switch -c 12-rename-a-scene`.
2. Commit as you go and push early.
3. Open the pull request on the first push: `pnpm pr`. It fills the body from
   `.github/pull_request_template.md`, with `Closes #` already carrying the
   number the branch is named after. `gh pr create --fill` would take the
   commit messages instead and never see the template.

## Why a pull request when nobody reviews it

The pull request is not a review surface here, it is the only place the
end-to-end suite runs. `.github/workflows/ci.yml` runs `e2e` on `pull_request`
alone, because each run takes a Neon branch of its own and proves the migrations
against a database that has only ever seen them. A push to a topic branch runs
nothing.

There are no preview deployments. `vercel.json` disables Git deployments for
every branch but `main`, because a preview cannot sign anyone in: the OAuth
callback URLs are registered for the production origin and `localhost:3100`
only, so a preview shows the signed-out pages and nothing more. What a preview
did prove — that a production build succeeds — the `check` job now proves with
`pnpm build`.

The `check` job also runs `pnpm test`, the Vitest suite over the Reading engine.
That one needs no database at all, so it runs on every push rather than waiting
for a Neon branch it would not use.

Committing straight to `main` skips the tests and puts an unproven commit in
production.

## Which database a change talks to

The git flow above has a database counterpart, and it matters more here than the
branch names do: a Neon branch is cheap, but there is only one production
dataset.

| Where the code runs | Neon branch |
| --- | --- |
| production deployment | `production` |
| `pnpm dev` | `development` |
| a CI run | a branch of its own, forked from `development`, deleted at the end |

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
git branch would only add bookkeeping — the disposable CI branch already covers
the case where isolation actually pays.

## Squash, not merge

Commit messages here are sentences describing a change ("Let an Author create,
rename and delete Stories"), not micro-steps. Squashing keeps one such sentence
per change on `main`; a merge commit would bury it under the work in progress
that led there.

The pull request body is where the detail goes — it stays reachable from the
squashed commit.

## Protecting `main`

`main` requires the `check` and `e2e` status checks to pass before a merge. The
point is not to guard against other people; it is to stop a tired evening from
merging red.

```sh
gh api -X PUT repos/floperrier/frameline/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["check", "e2e"] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
JSON
```

`enforce_admins` stays off deliberately: a broken production deploy needs a
hotfix path, and with one developer that path is an admin override.
