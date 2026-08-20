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
3. Open the pull request on the first push: `gh pr create --fill`.
4. Merge once the checks are green:
   `gh pr merge --squash --delete-branch`. Vercel deploys `main` to production.

## Why a pull request when nobody reviews it

The pull request is not a review surface here, it is the only place two things
happen:

- **The end-to-end suite runs.** `.github/workflows/ci.yml` runs `e2e` only on
  `pull_request`, because each run takes a Neon branch of its own and proves the
  migrations against a database that has only ever seen them. A push to a topic
  branch runs no tests at all.
- **Vercel builds a preview.** Clicking through the change on a real deployment
  catches what Playwright was not asked to look at.

Committing straight to `main` skips both and puts the untested commit in
production.

## Which database a change talks to

The git flow above has a database counterpart, and it matters more here than the
branch names do: a Neon branch is cheap, but there is only one production
dataset.

| Where the code runs | Neon branch |
| --- | --- |
| production deployment | `production` |
| `pnpm dev`, Vercel previews | `development` |
| a CI run | a branch of its own, forked from `development`, deleted at the end |

So `pnpm db:migrate` on your machine touches `development`, never production. A
migration reaches `production` when you run it against that branch deliberately,
after the pull request is merged.

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
