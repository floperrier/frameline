---
status: accepted
---

# Autonomous work waits on `dev`

`docs/git-flow.md` opened on one long-lived branch, and gave its reason: a second
one would only give the same commits a second place to sit. That reason held for
as long as every change was written by the one developer at the keyboard, who
read it as they wrote it. It stopped holding when an agent loop began writing
changes overnight — deciding for itself what to improve, opening its own issue,
building it and merging its own pull request with nobody awake to read any of it.

What that work needs is not review before it lands, because there is nobody to
give it. It needs somewhere to land that is not production.

So there are two long-lived branches, and the difference between them is not
where a commit sits but whether it has been read. **`dev`** is the base every
branch is taken from and the target every pull request is opened against; a run
merges into it on its own authority. **`main`** is what deploys, and the only
thing that reaches it is `dev`, whole, in a promotion the developer performs
once they have read what accumulated there.

## Considered Options

**Keeping one branch, and reviewing before the merge.** The pull request would
sit open until someone woke up. That throws away the one thing the loop buys —
work happening while nobody is there — and it makes a worse review surface, not
a better one: five pull requests each stale against the other four are harder to
read than one branch's diff, and none of them can be built on until it lands.

**Keeping one branch, and letting the loop merge into `main`.** Then production
is the review surface. A schema migration reaches `production` in the deploy
that carries the code needing it — see
`docs/adr/0002-the-schema-moves-with-the-deploy.md` — so an unread change would
take an Author's data with it. Production holds the only dataset there is one of.

**A long-lived branch per run.** Bookkeeping for one developer, and the branches
compete rather than compose: each run would build on a base that three other
runs had already moved.

**Squashing `dev` into `main` at each promotion.** It is the letter of *Squash,
not merge*, and it breaks that rule's own purpose. Squashing exists here to keep
one sentence per change; a batch of thirty-five changes squashed into one commit
keeps one sentence per batch, which is the thing the rule was written to prevent
one scale down.

## Consequences

**`dev` is the default branch of the repository.** GitHub records a pull
request's closing link only for the default branch, so with `main` in that role
an autonomous run's `Closes #` did nothing on merge and the issue had to be
closed after the fact — the loop carried a function that re-read pull request
bodies to do it. An issue now closes when its pull request lands, and the
tickets it blocks are freed without anyone intervening.

**`dev` requires the same two status checks as `main`.** The guarantee that
nothing red lands in the quarantine was, until now, a convention of the agent
that happened to arm auto-merge rather than a rule of the repository. It is a
rule now.

**Promotion is a merge commit, and `main` reads as one merge per release.**
Within a change, `main`'s history was the thing being protected from work in
progress; between `dev` and `main` there is no work in progress left to bury —
every commit on `dev` is already one squashed sentence. The merge commit is what
marks the release, which is the one thing this repository had no marker for
after deciding it needed no tags.

**Nothing deploys from `dev`, and a promotion is used all the same — by
running `dev`.** `vercel.json` enables Git deployments for `main` alone, and a
deployment elsewhere could sign nobody in: the OAuth callback URLs are
registered for the production origin and `localhost:3100` only. The second of
those two is the point. A checkout of `dev` run with `pnpm dev` signs in and
behaves like the product, with `pnpm db:migrate` exercising any waiting
migration against the `development` branch of the database, so what the quarantine
withholds from Authors is still held by the developer before they release it.
This record first called that a weakness and proposed a stable origin for `dev`
registered with the identity provider; that was reaching for infrastructure the
loopback callback already makes unnecessary.

**Anything that derives the base branch from `origin/HEAD` now gets `dev`.**
That resolution is why this record exists: a run took `main` from `origin/HEAD`,
judged a product thirty-five commits old, and built a feature against files that
had all moved. A tool that has to be told the base instead should be told in the
repository rather than on the command line, so the answer cannot be forgotten
for a night.

The condition this record would fall on is nobody writing changes here
autonomously any more. Then `dev` really is a second place for the same commits
to sit, and it should go — the original reason comes back exactly as it was
written.
