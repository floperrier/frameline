# Frameline

An editor for interactive narrative works that speaks the grammar of cinema.
Read `CONTEXT.md` before touching anything — the glossary is binding.

## Agent skills

Skills come from the plugins `.claude/settings.json` enables — the Neon ones
from `neon-postgres@neon`, whose marketplace the same file declares so a clone
can install it. Nothing is vendored into the repository, so there is no copy
here to update.

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

The widths the interface folds at are the one thing a token cannot carry, because
a custom property cannot be read inside a media query. They are declared as
custom media queries in `app/assets/css/folds.css` — names and no rules — and
reached by name from the scoped block of every surface that folds at one. See
`docs/adr/0037-the-reading-folds-before-the-writing-does.md` and
`docs/adr/0041-the-graph-is-drawn-from-the-story.md`.

## Git flow

A pull request per issue, squash-merged into `dev`, the default branch. `main`
is what deploys to production, and `dev` reaches it whole in a promotion of its
own. See `docs/git-flow.md` and
`docs/adr/0039-autonomous-work-waits-on-dev.md`.

## Languages

The interface is read in French or in English, and the two message files —
`i18n/locales/en.json` and `i18n/locales/fr.json` — are the only place a
displayed string may be written. English is the `defaultLocale`, so it is the
language of unprefixed URLs and the language a new key is authored in; French is
reached at `/fr/...`. `CONTEXT.md` says which French word each glossary term is
shown as, and that word binds: see
`docs/adr/0014-the-glossary-is-the-codes-language.md`.

**A control that acts is labelled in title case**, in English: the first word and
every word that carries meaning take a capital, and the articles, prepositions
and determiners between them stay lowercase — *Add a Shot*, *Close this Panel*,
*Take Out*, *Duplicate Exit to {scene}*. The article is not dropped to save a
word: it is *Add a Shot* beside *Add a Flag*, never *Add Shot*. A glossary term
keeps the capital `CONTEXT.md` gives it wherever it falls, and the capital title
case puts on an ordinary word — the *Panel* in *Close this Panel* — claims
nothing about that word: only `CONTEXT.md` makes a term.

The rule reaches the words on a button and the accessible name of one, and stops
there. The label over a field is not an act — *Name of this Scene*, *Title of a
new Story* — and neither is a sentence the interface says to somebody, which is
written as a sentence: *Leave the Exit from {name} where it leads*, *I can take
it from here*. French does not title-case, so a French label is a French sentence
with the `_Affiché_` word carrying its own capital: *Ajouter un Plan*, *Fermer ce
panneau*.

What makes it worth settling is the bar of Commands —
`docs/adr/0035-every-act-of-the-bench-is-reachable-by-naming-it.md`. Matching
there ignores case, so nothing breaks; but the bar is the one surface that reads
every label in the product side by side, and a list where half the acts are
titled and half are not is the mixed convention on show.

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
code already does in case it is ever pointed at it. Generated files are ignored
outright: the migration snapshots are the generator's to write.

## Tests

`pnpm test` runs the Vitest suite over the modules that are pure functions: the
Reading engine, what a Shot's image is read to be, the Conditions a request is
allowed to write, the sequence of Places it renumbers a Scene by, the Scenes a
Exit may land on, where every Scene of a Story is drawn on the Graph and the geometry of the lines
between them, the two message
files held against each other, the language a refusal is phrased in, the Steps the
bench asks a Story for — whose targets are held against the editor's template
read as source — the Remarks the bench reads back out of a Story, and the two
Samples, that each holds together as a work and that the two of them are one
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
its Scenes, Shots, Exits and Conditions, and the recipe for each image. The
Samples are the three-Scene Story a new Author is given, one per Language, in
`samples.ts`; their images are the WebP files in `images/`, developed once by
`images.ts` and committed, because the runtime this deploys to has no ImageMagick
on it — see `docs/adr/0018-a-leader-exists-once-per-language.md`. `work.ts` is
what both are written as, and `write.ts` writes either into a running instance
through the same API the editor uses, then publishes it — and lists the
demonstration in the Catalogue, so a fresh install is never an empty one.

```sh
node --env-file=.env demonstration/write.ts --author you@example.com
node --env-file=.env demonstration/write.ts --author you@example.com --sample fr
```

The Author has to have signed in to that instance already, `DATABASE_URL` and
`NUXT_SESSION_PASSWORD` have to be the ones it runs on, and Node has to be 22.18
or newer, which is the version that strips the types itself. ImageMagick has to
be on the path for *Reel Change*, whose images are developed by `magick` as the
work is written rather than stored here; a Sample's are already bytes and need
none. Running it again writes a second copy rather than replacing the first.

Always answer to prompts in french.
