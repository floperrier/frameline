# Deploying Frameline

One Nuxt application on Vercel, one Neon Postgres database. Both steps need
credentials, so they are run by a human once.

## 1. Database

Create a Neon project, take the pooled connection string, then apply the schema:

```sh
NUXT_DATABASE_URL='postgres://…' pnpm db:migrate
```

## 2. OAuth applications

Both providers need a callback URL on the deployed origin:

- GitHub OAuth app → `https://<origin>/auth/github`
- Google OAuth client → `https://<origin>/auth/google`

For local development, use `http://localhost:3000/auth/{github,google}`.

## 3. Vercel

```sh
vercel login
vercel link
```

Set these environment variables on the project (all environments):

| Variable | Value |
| --- | --- |
| `NUXT_SESSION_PASSWORD` | 32+ random characters, sealing the session cookie |
| `NUXT_DATABASE_URL` | Neon pooled connection string |
| `NUXT_OAUTH_GITHUB_CLIENT_ID` / `_SECRET` | from the GitHub OAuth app |
| `NUXT_OAUTH_GOOGLE_CLIENT_ID` / `_SECRET` | from the Google OAuth client |

Then `vercel --prod`. Subsequent pushes deploy from the repository, with a
preview per branch.
