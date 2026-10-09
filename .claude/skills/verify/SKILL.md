---
name: verify
description: Drive Frameline's real web app, the bench an Author writes a Story on and the public page a Reader reads it at, from a production build on a port of its own and the e2e suite's own database, signed in without OAuth, and keep screenshots, ARIA snapshots and database reads as proof. Use to prove a change to anything an Author or a Reader sees, before opening its pull request.
---

# Verify Frameline

Every command runs from the repository root. The helpers are `verify.sh` (the
database and the server), `drive.ts` (the browser and the database) and
`smoke.ts` (one whole path). They need Docker running and nothing from `.env`.

The database is the e2e suite's own from `compose.yaml`, a Postgres behind a
proxy that speaks Neon's protocol, at
`postgres://postgres:postgres@db.localtest.me:4445/main`. Nothing here reaches
Neon: its free quota is production's, and the suite once spent it — see
`docs/adr/0075-the-suite-brings-its-own-database.md`. Never point a script at
the `DATABASE_URL` in `.env`, and never run `pnpm db:migrate` to verify.

## Launch

```sh
.claude/skills/verify/verify.sh launch            # database, pnpm build, then serve it
.claude/skills/verify/verify.sh launch --no-build # serve the .output already there
```

It starts the database if nothing answers on 4445, applies the migrations to it
with `drizzle-kit migrate`, builds with that database's URL, and serves
`.output` with it, whatever the build or `.env` hold. It prints
`serving http://localhost:<port> (pid <pid>)` once `GET /` answers. The port is
the first free one from 3190 to 3199. Never drive 3100: that is somebody's
`pnpm dev`, on the developer's own database, and it does not pick up a new
auto-import in an existing file, so it can hide a `ReferenceError` a build would
show. 3101 belongs to the e2e suite. A second `launch` while the server lives
reports it and starts nothing.

## Doctor

```sh
.claude/skills/verify/verify.sh doctor
```

Run it first, and again whenever anything looks off. Every line has to read
`ok`: the database answers on 4445, every migration in `server/db/migrations` is
applied to it, the port is held by the pid `launch` wrote, `GET /` answers 200,
and no source file under `app`, `server`, `shared` or `i18n` is newer than the
build. `STALE` means stop, then launch again. Anything else that fails, launch
again: it starts what is missing and applies what is not applied.

## Drive

Write a script anywhere under the repository, usually `.verify/scripts/`, and
run it with `node <script>.ts`. Node strips the types itself.

```ts
import { expect, session, sql } from '../../.claude/skills/verify/drive.ts'

const s = await session('rename-a-scene')   // label for the evidence folder
try {
  await s.page.goto('/stories')
  await s.live()                           // Vue has mounted; goto alone is too early
  await s.proof('stories')
} finally {
  await s.close()
}
```

`session(label, { guided })` seeds a fresh Author named `A Verifier`, seals the
`nuxt-session` cookie with the password `launch` gave the server, the way
`tests/e2e/author.ts` does, and opens Chromium at 1440 by 900 in `en-US`. It
returns:

- `page`, signed in as that Author.
- `request`, the same Author's API client. Use it to seed preconditions,
  never to perform the act under test.
- `reader()`, a new page in a context with no cookie: somebody with no account.
- `live(page?)`, which waits until Vue has mounted.
- `proof(name, page?)`, which writes a numbered screenshot and ARIA snapshot.
- `author`, `baseURL`, `run` (the evidence folder), and `sql` as an export,
  for reading what a change wrote.
- `close()`, which closes the browser and deletes the Author, and with it every
  Story that Author wrote.

`guided` defaults to `false`, which waves the guided path's bubble away the way
an Author who knows the bench does. Pass `true` only to verify the guided path.

Address controls by role and accessible name, as the e2e specs do. When a name
is unknown, call `proof` and read the `.aria.txt` it writes: that is the live
tree. The recipes per feature are in `features/README.md`, and the helpers in
`tests/e2e/author.ts` show how the suite drives what a recipe leaves out.

Outside the test runner `expect` waits five seconds for a locator and
`toPass()` waits forever, so give `toPass` a `timeout`. A script stuck that way
can outlive `kill <pid>` while its browser is open; `kill -9` the `node` you
started, then run `stop`.

```sh
node .claude/skills/verify/smoke.ts
```

`smoke.ts` publishes a two-Scene Story from the bench, reads it to its ending as
a Reader, and checks the Reading was counted, in about two seconds. Run it to
check the harness itself.

## Evidence

Each session writes to `.verify/runs/<timestamp>-<label>/`, which git ignores:

- `NN-<name>.png` and `NN-<name>.aria.txt` from every `proof`.
- `browser.log`, one line per `/api/` response the pages made
  (`author PATCH /api/shots/<id> 200`), plus console errors and page errors.

`.verify/server.log`, `build.log`, `migrate.log` and `database.log` hold what
`launch` ran.

A proof drives the act under test through the interface, with the hands an
Author or a Reader has. It captures the state before and after the act, not
only the end screen. It reads the row the act wrote with `sql` after the
interface reports success, because a toast is not a write. The only things
replaced are the OAuth provider, by the sealed cookie, and Neon, by the suite's
database behind the same protocol. Report a path you could not reach with the
command you ran and the precondition that failed, and never as verified by
another path.

## Cleanup

```sh
.claude/skills/verify/verify.sh stop
```

It deletes every Author this checkout seeded that `close()` did not already
delete (their ids are in `.verify/authors`), kills the pid `launch` wrote and
nothing else, and keeps `.verify/runs/`. Run it after every failed attempt too.
It leaves the database up, because the e2e suite and other worktrees share it.
`docker compose -p frameline down` empties it, for when nobody else is using it.

## Isolation

Two worktrees can verify side by side: each has its own `.verify/` and takes
its own port. They share one database with each other and with a local
`pnpm test:e2e`, whichever of them started it: `launch` leaves alone a database
that answers on 4445, rather than have compose start a second one or recreate
the first. Touch only rows your session's Author owns, and give anything that
other Authors can see, such as a Catalogue entry, a title nobody else has: add
a `randomUUID()`.
