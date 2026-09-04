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
3. Open the pull request on the first push, against `dev`: `pnpm pr`. It fills
   the body from `.github/pull_request_template.md`, with `Closes #` already
   carrying the number the branch is named after. `gh pr create --fill` would
   take the commit messages instead and never see the template.

`dev` is the repository's default branch, so nothing has to be told where to
aim and `Closes #` closes its issue on merge. GitHub records that link for the
default branch alone, which is why the default is the branch work lands on
rather than the branch that deploys.

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

**Nothing deploys from `dev` either, so what is read before a promotion is a
diff and a list of commits, not a product anyone can hold.** That is the known
cost of the arrangement. Closing it means giving `dev` a stable origin and
registering it with the identity provider; until then, a change is judged on
`dev` the way it was judged in its pull request, and used only once it is in
production.

The `check` job also runs `pnpm test`, the Vitest suite over the Reading engine.
That one needs no database at all, so it runs on every push rather than waiting
for a Neon branch it would not use.

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

Merging it closes it, so the next one has to be opened. The agent loop does that
when it finishes a night, which is the moment there is something new to promote;
opening it by hand is `gh pr create --base main --head dev`. It is deliberately
not opened by a workflow: a pull request created with `GITHUB_TOKEN` triggers no
workflow of its own, so it would arrive with neither `check` nor `e2e` and
`main`'s protection would refuse it.

Let a promotion be small enough to read. A batch that has grown past reading is
a batch that gets promoted unread, which puts the quarantine back where it
started.

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
per change on `dev`; a merge commit would bury it under the work in progress
that led there.

The pull request body is where the detail goes — it stays reachable from the
squashed commit.

The one merge commit is the promotion above, where there is no work in progress
left to bury and squashing would cost one sentence per change.

## Protecting both branches

`dev` and `main` each require the `check` and `e2e` status checks to pass before
a merge. The point is not to guard against other people; it is to stop a tired
evening from merging red, and to make the quarantine a rule of the repository
rather than a habit of whatever opened the pull request.

```sh
for branch in main dev; do
  gh api -X PUT "repos/floperrier/frameline/branches/$branch/protection" \
    --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["check", "e2e"] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
JSON
done
```

`enforce_admins` stays off deliberately: a broken production deploy needs a
hotfix path, and with one developer that path is an admin override.

`strict` asks a branch to be up to date with its base before it merges. It costs
nothing here because the loop lands one pull request at a time by design, and it
is what makes `e2e` on a pull request a statement about `dev` and not only about
the branch in isolation.
