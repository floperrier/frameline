---
status: accepted
---

# The interface's Locale is not the Story's Language

A Story carries a `language` column, written by the Author when the Story is
created and defaulting to `en`. It is the language the work is written in.
Nothing translates a Story — a Story written in French is read in French by
everyone who opens its link — so this column exists to be *declared*, never to
select between versions of anything.

The Locale is the other thing entirely: the language the interface is read in,
detected from the person and held in a cookie. The two meet on screen. The
Reader's page sets `lang` on the Story's text from the Story's Language and on
its own chrome from the Locale, so a screen reader reads a French Story in a
French voice while the button that turns the page stays in the Reader's own
language.

Making the application multilingual is what forced the distinction. In one
language the two are the same fact and no column is needed; in two, "the
application is in French" stops having a single meaning, and the Aperçu is
exactly where that shows — an Author reading their own work, in their own tool,
where the work's language and the tool's language are independently true.

## Considered Options

Constraining `language` to the Locales the interface can be shown in — `fr` and
`en` — was the tempting simplification, and it is the confusion this ADR
exists to prevent. Someone writing in Spanish inside a French interface is an
ordinary case, and the set of languages a work can be written in has no reason
to be the set of languages the editor has been translated into.

Declaring nothing and setting `lang` from the Locale was the cheaper option. It
is an accessibility defect adopted deliberately: a French Story announced as
English is read aloud wrong, and the page currently declares no language at
all, so there was nothing to preserve.

## Consequences

**Existing Stories are English by migration.** `language` is
`text not null default 'en'`, which is true of everything in the database when
this lands, *Reel Change* included.

**The creation form gains a field.** A short list — fr, en, es, de, it — with
English preselected. The list is a convenience, not a constraint: the column
holds a BCP-47 code and a longer list costs nothing later.

**A Story's Language is not editable from the Locale switcher, and never
follows it.** An Author who reads their editor in French has said nothing about
the language of the work in front of them.
