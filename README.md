# Frameline

An editor for interactive narrative works that speaks the grammar of cinema
rather than that of prose fiction or video games. Authors assemble Shots into
Scenes and connect Scenes with Exits; Readers play the result from a public link.

**[Try it →](https://frameline-three.vercel.app)**

## How a Story is built

A **Story** is made of **Scenes**. A Scene is a linear run of **Shots** — the
atomic unit, an Image and text shown to the Reader in a single beat — and
it is the only place a Story branches. At the end of a Scene, the Reader is
offered **Exits**: directed connections to other Scenes, each of them a way out
the Reader takes.

Both Shots and Exits can carry **Conditions**, flat tests against the Reader's
**State**, so the same Scene plays differently for different Readers without
ever becoming non-linear.

The full vocabulary — every term, and the words deliberately avoided — is in
[`GLOSSARY.md`](GLOSSARY.md). It is worth reading before the code: the domain
language is the design.

## Stack

Nuxt 4 · Vue 3 · TypeScript · Drizzle ORM · Neon Postgres · `nuxt-auth-utils`
(GitHub and Google OAuth) · Vitest · Playwright · Vercel

## Running it locally

You need Docker and OAuth applications for both providers.
[`docs/deploy.md`](docs/deploy.md) walks through creating them once. The database
runs on your machine, in a container `pnpm dev` starts — see
[`docs/adr/0082-development-brings-its-own-database.md`](docs/adr/0082-development-brings-its-own-database.md).

```sh
pnpm install
cp .env.example .env      # fill in the session secret and both OAuth pairs
pnpm dev                  # starts and migrates the database, serves on http://localhost:3100
```

## Checks

```sh
pnpm typecheck
pnpm test        # Vitest
pnpm test:db     # starts and migrates the suite's own database
pnpm test:e2e    # Playwright
```

The end-to-end suite runs against a Postgres of its own, in CI and on your
machine alike, and never against Neon or the database `pnpm dev` uses.

## Documentation

| Where | What |
| --- | --- |
| [`GLOSSARY.md`](GLOSSARY.md) | The domain vocabulary — the canonical reference |
| [`docs/adr/`](docs/adr) | Architecture decisions and why they were made |
| [`docs/deploy.md`](docs/deploy.md) | First-time Neon, OAuth and Vercel setup |
| [`docs/git-flow.md`](docs/git-flow.md) | Branch and database separation |
