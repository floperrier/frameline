# Deploying Frameline

One Nuxt application on Vercel, one Neon Postgres database. Both steps need
credentials, so they are run by a human once.

## 1. Database

Create a Neon project, then two branches that never mix:

| Neon branch | Who connects to it |
| --- | --- |
| `production` (default) | the production deployment, nothing else |
| `development` | `pnpm dev` |

Each CI run forks a third, disposable branch from `development` and deletes it
afterwards, so the end-to-end suite never touches either of these.

Apply the schema to a branch by pointing `DATABASE_URL` at it:

```sh
DATABASE_URL='postgres://…' pnpm db:migrate
```

Locally, `neon checkout development` writes the right `DATABASE_URL` into
`.env` for you — see `docs/git-flow.md` for why the separation matters.

Neon's branch protection needs a paid plan, so `production` is not protected.
Nothing enforces the separation above — it holds because `.env` points at
`development` and because no automation ever names the production branch. Treat
a command that spells out the production connection string as a deliberate act.

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
| `NUXT_DATABASE_URL` (Production only) | pooled connection string of the `production` Neon branch |
| `NUXT_OAUTH_GITHUB_CLIENT_ID` / `_SECRET` | from the GitHub OAuth app |
| `NUXT_OAUTH_GOOGLE_CLIENT_ID` / `_SECRET` | from the Google OAuth client |

Then `vercel --prod`. Afterwards a push to `main` deploys from the repository;
no other branch does.
