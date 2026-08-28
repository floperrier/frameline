# Frameline

An editor for interactive narrative works that speaks the grammar of cinema
rather than that of prose fiction or video games. Authors assemble Shots into
Scenes and connect Scenes with Cuts; Readers play the result from a public link.

**[Try it →](https://frameline-three.vercel.app)**

## How a Story is built

A **Story** is made of **Scenes**. A Scene is a linear run of **Shots** — the
atomic unit, an Image and text shown to the Reader in a single beat — and
it is the only place a Story branches. At the end of a Scene, the Reader is
offered **Cuts**: directed connections to other Scenes, named after the film
edit that joins two shots.

Both Shots and Cuts can carry **Conditions**, flat tests against the Reader's
**State**, so the same Scene plays differently for different Readers without
ever becoming non-linear.

The full vocabulary — every term, and the words deliberately avoided — is in
[`CONTEXT.md`](CONTEXT.md). It is worth reading before the code: the domain
language is the design.

## Stack

Nuxt 4 · Vue 3 · TypeScript · Drizzle ORM · Neon Postgres · `nuxt-auth-utils`
(GitHub and Google OAuth) · Vitest · Playwright · Vercel

## Running it locally

You need a Neon project and OAuth applications for both providers.
[`docs/deploy.md`](docs/deploy.md) walks through creating them once.

```sh
pnpm install
cp .env.example .env      # fill in the session secret and both OAuth pairs
neon checkout development # writes DATABASE_URL into .env
pnpm db:migrate
pnpm dev                  # serves on http://localhost:3100
```

## Checks

```sh
pnpm typecheck
pnpm test        # Vitest
pnpm test:e2e    # Playwright
```

Each CI run forks a disposable Neon branch from `development` for the
end-to-end suite and deletes it afterwards, so no run touches a branch anyone
else is using.

## Documentation

| Where | What |
| --- | --- |
| [`CONTEXT.md`](CONTEXT.md) | The domain vocabulary — the canonical reference |
| [`docs/adr/`](docs/adr) | Architecture decisions and why they were made |
| [`docs/deploy.md`](docs/deploy.md) | First-time Neon, OAuth and Vercel setup |
| [`docs/git-flow.md`](docs/git-flow.md) | Branch and database separation |
