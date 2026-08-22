---
status: accepted
---

# The glossary is the code's language, the screen has its own

`CONTEXT.md` stays in English and stays binding: `Story`, `Scene`, `Shot`,
`Cut`, `Still`, `Place`. Every entry now also carries an `_Affiché_` line — the
one word the French interface shows that term as — and that word binds as
tightly as the English one. Story is *Récit* on screen and `Story` in the code,
in the ADRs, and in every issue.

The English terms were chosen for the grammar of cinema, and the French words
for the same grammar were sitting in the `_Avoid_` lists: `plan` was forbidden
for a Shot and `raccord` for a Cut. That is what a French interface makes
untenable — the vocabulary refused its own translation. So the lists changed
job: they no longer keep French out, they keep the *wrong* French out.
*séquence* is not a Scene, *histoire* is not a Story, *image* is not a Still.

The displayed words:

| Glossary | Affiché | Glossary | Affiché |
|---|---|---|---|
| Story | Récit | State | État |
| Scene | Scène | Flag | Marqueur |
| Shot | Plan | Reading | Lecture |
| Still | Photogramme | Position | Position |
| Place | Rang | Author | Auteur |
| Cut | Coupe | Reader | Lecteur |
| Graph | Graphe | Preview | Aperçu |
| Opening Scene | Scène d'ouverture | Publish | Publier |

`Cut` is **Coupe**, not *Raccord*. A raccord is the continuity between two
plans — a matched look, a matched movement — not the edit that joins them. The
glossary says a Cut is named after the film edit, and in French that edit is a
coupe. *Raccord* stays in the `_Avoid_` list for exactly this reason.

`Preview` is **Aperçu**, the word every tool uses, over *Épreuve*, which holds
the photographic register the rest of the glossary is built on. Understood
immediately beat understood on reflection.

`Author` and `Reader` are shown as *Auteur* and *Lecteur*, but the French text
reaches for them as little as possible: "Votre Récit" rather than a sentence
about an Auteur. French has to choose a gender where English did not, and
rewriting around the noun is shorter than a doublet on every agreement — the
masculine is a fallback for where the glossary term is structurally needed, not
a default reached for first.

## Considered Options

Translating the glossary and renaming the code with it would have made one
language of the whole repository. It rewrites eleven ADRs, the schema, the test
suite and the issue history, for no gain a Reader or an Author can see.

Leaving the English terms in the French interface — "Ajouter un Shot" — costs
nothing and reads as neither language. It also gives up the reason the glossary
exists: these words were picked because they are the ones the craft uses, and
the craft uses *plan* in French.

## Consequences

**`i18n/locales/fr.json` is where the `_Affiché_` column lives in force.** The
glossary states the word; the message file is the only place it may be written
in a rendered string. A French synonym invented at a call site is a bug of the
same kind as calling a Scene a chapter.

**Adding a term to `CONTEXT.md` now requires two words, not one.** An entry
without an `_Affiché_` line is unfinished.
