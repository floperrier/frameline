# Frameline

An editor for interactive narrative works that speaks the grammar of cinema.
Read `CONTEXT.md` before touching anything — the glossary is binding.

## Agent skills

Skills vendored from other repositories live in `.agents/skills/`, with
`.claude/skills/` symlinked to them and `skills-lock.json` recording the source
and content hash of each. Update them through the tool that wrote the lock file
rather than editing the copies.

### Issue tracker

Issues and specs live in GitHub Issues for `floperrier/frameline`, via the `gh`
CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The seven canonical triage roles — two of category, five of state — each label
string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See
`docs/agents/domain.md`.

## Design

The visual language is one stylesheet, `app/assets/css/frameline.css`, and pages
add only what is theirs in a scoped block. Colour, type and spacing come from
the tokens declared there and from nowhere else. See
`docs/adr/0006-two-rooms-one-language.md`.

## Git flow

A pull request per issue, squash-merged into `main`, which deploys to
production. See `docs/git-flow.md`.

## Languages

The interface is read in French or in English, and the two message files —
`i18n/locales/en.json` and `i18n/locales/fr.json` — are the only place a
displayed string may be written. English is the `defaultLocale`, so it is the
language of unprefixed URLs and the language a new key is authored in; French is
reached at `/fr/...`. `CONTEXT.md` says which French word each glossary term is
shown as, and that word binds: see
`docs/adr/0014-the-glossary-is-the-codes-language.md`.

The server reads the same two files. A refusal still travels as a phrase in the
response body — `docs/adr/0009-a-refusal-travels-in-the-body.md` — and
`server/utils/phrases.ts` is what settles which language it is phrased in,
negotiated from the request's cookie and `Accept-Language`.

Two things are deliberately not the Locale. The public link carries no locale
segment (`docs/adr/0012-the-public-link-carries-no-locale.md`), and a Story's
own Language is a column on the Story rather than a property of whoever reads it
(`docs/adr/0013-the-interfaces-locale-is-not-the-storys-language.md`).

## Formatting

The TypeScript and the Vue here are wrapped by hand — where a chain breaks and
where a comment ends are part of how the code reads — and Prettier cannot be
configured into producing it: the case of a hex literal, the separator inside a
type literal and the point a method chain breaks are all its own to decide.
Turned loose on this repo it rewrites nineteen hundred lines that nobody asked
it to. So the pre-commit hook runs it over `css`, `json` and `yaml` alone, where
its opinion and ours are the same, and `.prettierrc` says what the rest of the
code already does in case it is ever pointed at it. Generated and vendored files
are ignored outright: the migration snapshots are the generator's to write, and
a vendored skill is hashed in `skills-lock.json`.

## Tests

`pnpm test` runs the Vitest suite over the modules that are pure functions: the
Reading engine, what a Shot's image is read to be, the Conditions a request is
allowed to write, the sequence of Places it renumbers a Scene by, the Scenes a
Cut may land on, the geometry of the lines the graph draws, the two message
files held against each other, the language a refusal is phrased in, the Cues the
bench asks a Story for — whose targets are held against the editor's template
read as source, the way the message files are held against each other — and the
two Leaders, that each holds together as a work and that the two of them are one
shape in two languages. None of them needs a database, because none of them has
one in reach. `pnpm test:e2e` runs
Playwright against a built app and a real Neon branch — `docs/git-flow.md` says which branch.

## Running the app

`pnpm dev` after copying `.env.example` to `.env` and filling it in. The Neon
schema is applied with `pnpm db:migrate`; never edit the database by hand.
Migrations are generated from `server/db/schema.ts` with `pnpm db:generate`.

## The demonstration work

`demonstration/` holds the two works this repository carries. *Reel Change* is
the short film the product exists to carry: `reel-change.ts` is the work itself —
its Scenes, Shots, Cuts and Conditions, and the recipe for each still. The
Leaders are the three-Scene Story a new Author is given, one per Language, in
`leaders.ts`; their stills are the WebP files in `stills/`, developed once by
`stills.ts` and committed, because the runtime this deploys to has no ImageMagick
on it — see `docs/adr/0018-a-leader-exists-once-per-language.md`. `work.ts` is
what both are written as, and `write.ts` writes either into a running instance
through the same API the editor uses, then publishes it.

```sh
node --env-file=.env demonstration/write.ts --author you@example.com
node --env-file=.env demonstration/write.ts --author you@example.com --leader fr
```

The Author has to have signed in to that instance already, `DATABASE_URL` and
`NUXT_SESSION_PASSWORD` have to be the ones it runs on, and Node has to be 22.18
or newer, which is the version that strips the types itself. ImageMagick has to
be on the path for *Reel Change*, whose stills are developed by `magick` as the
work is written rather than stored here; a Leader's are already bytes and need
none. Running it again writes a second copy rather than replacing the first.
