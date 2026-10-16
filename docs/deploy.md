# Deploying Frameline

One Nuxt application on Vercel, one Neon Postgres database. Both steps need
credentials, so they are run by a human once.

## 1. Database

Create a Neon project. Its default branch, `production`, is the production
deployment's and nothing else's. Neither `pnpm dev` nor the end-to-end suite
reaches Neon: each starts a Postgres of its own on the machine it runs on — see
`docs/adr/0075-the-suite-brings-its-own-database.md` and
`docs/adr/0082-development-brings-its-own-database.md`.

Apply the schema to a branch by pointing `DATABASE_URL` at it:

```sh
DATABASE_URL='postgres://…' pnpm db:migrate
```

Locally, `.env` names the database `pnpm dev` starts, and `pnpm dev` migrates it
itself — see `docs/git-flow.md` for why the separation matters. You never name
`production` yourself: the deploy applies migrations to it, as
`docs/adr/0002-the-schema-moves-with-the-deploy.md` explains.

Neon's branch protection needs a paid plan, so `production` is not protected.
What keeps it apart is that `.env` names a database on the machine and that the
only automation naming production is the deploy itself.

## 2. OAuth applications

Both providers need a callback URL on the deployed origin:

- GitHub OAuth app → `https://<origin>/auth/github`
- Google OAuth client → `https://<origin>/auth/google`

For local development, add `http://localhost:3100/auth/{github,google}` as a
second redirect URI on each provider — `pnpm dev` serves on 3100.

## 3. Vercel

```sh
vercel login
vercel link
```

`vercel.json` disables Git deployments for every branch but `main`, so the
project only ever has a Production environment. Set these environment variables
there:

| Variable | Value |
| --- | --- |
| `NUXT_SESSION_PASSWORD` | 32+ random characters, sealing the session cookie |
| `NUXT_DATABASE_URL` (Production only) | pooled connection string of the `production` Neon branch, for the running application |
| `DATABASE_URL` (Production only) | direct connection string of the same branch, read by `pnpm db:migrate` during the build |
| `NUXT_OAUTH_GITHUB_CLIENT_ID` / `_SECRET` | from the GitHub OAuth app |
| `NUXT_OAUTH_GOOGLE_CLIENT_ID` / `_SECRET` | from the Google OAuth client |
| `NUXT_PUBLIC_LANDING_STORY` | id of the published Story the landing page links a visitor to read — a Sample published from your own account. Unset, no such link is shown |

Both connection strings point at the same Neon branch and differ only in the
endpoint: the pooler drops the session state a migration relies on, so the
migration takes the direct one. `DATABASE_URL` has to exist before the first
deploy, or the build fails on its own migration step.

Then `vercel --prod`. Afterwards a push to `main` deploys from the repository;
no other branch does.
