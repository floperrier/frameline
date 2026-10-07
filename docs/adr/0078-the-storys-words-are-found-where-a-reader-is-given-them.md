---
status: accepted
---

# The Story's words are found where a Reader is given them

Decided on 2026-10-02, issue #447. Amends
`docs/adr/0017-a-confirmation-is-drawn-on-the-bench.md`, whose table of the acts
that ask gains *Replace All*.

A writer renames a character, settles a name spelt two ways, or changes a line
that recurs through the work. On the bench each of those was done by hand: the
browser's find reaches the words drawn in the document but not a Transcript in a
closed fold, and every place it finds has to be opened and retyped. No act
changed words in more than one place. **The bench's *Find and Replace* finds a
word wherever the Story gives it to a Reader, and writes another in its place, at
one place or at all of them at once.** The places are counted by `placesIn` in
`shared/utils/found.ts`, the same function for the bar that lights them and for
`POST /api/stories/:id/replace`, which replaces them all.

## What counts as the Story's words

The fields a Reader is given and the writing draws, in the order the document
draws them: a Scene's Transcript where it carries a Sound of its own, each of its
Shots' words, a Shot's Description where it carries an Image and its Transcript
where it carries a Sound, then the Scene's Question and the words of each Exit
leaving it. A column the document draws no field for is not looked at, even when
it holds text: the Description of a Shot that carries no Image, the Transcript of
a Scene heard under another's Sound. Replacing there would change
words the Author cannot see, behind their back, in a place no Reader is given
them.

Scene names, Flag names and values, the title and the Synopsis are not looked at
either. A Scene's name and a Flag's are what Conditions and braces point at, so
changing one is renaming, which is a different act. The title and the Synopsis
are the Story's outside, written on its edge and not in the document.

## A Flag between braces is not a word

`{coat}` is the Flag, and not the word *coat*
(`docs/adr/0059-a-flag-is-said-by-its-name.md`): the Reader reads the value this
Reading holds in its place. Replacing *coat* with *jacket* inside it would leave
`{jacket}`, which names no Flag and so is read as written, braces included, by
every Reader. A match that touches a run between braces naming a Flag some Scene
sets is therefore not a place. A run between braces that names no Flag is read as
it is written, so it is found like any other words. Rewriting a Flag's name in
every brace, every Condition and the Scene that sets it is renaming a Flag, and
is left out.

## A place stays inside one run

A Shot's words are runs, each in one set of styles. A replacement written into a
run takes that run's styles, so an italic *neither* replaced is an italic
*nothing*. A match across two runs has no one style to give its replacement, and
sharing it out between them would be a guess. **So a place lies inside one run,
and a word half in italics is not found.** The count the bar shows is then
exactly the number of changes *Replace All* makes, and the number the
confirmation names is true. A Redaction is not a run of words, so neither its bar
nor the words it hides are looked through.

Both sides are read letter by letter in NFC, so a composed and a decomposed *é*
are found alike and an *e* is never found inside an *é*. Case is folded in the
Story's Language unless *Match case* is on, and accents are never folded:
*café* and *cafe* are two words in every Language the bench writes.

## *Replace All* asks, *Replace* does not

`0017` asks before an act that takes something the Author did not name in it, and
its table was drawn over deletions. *Replace All* writes over every place at
once, most of them places the Author never looked at, and nothing undoes it. So
it asks, through the confirmation drawn on the bench: *Replace “{find}” with
“{replace}” in {n} places?*, with *Replace All* on the button that does it.
*Replace* changes the one place the bar has wound the document to and lit, which
the Author is looking at as they press. It is typing over a word, so it asks
nothing and goes through the row's own PATCH as typing does.

## The server recomputes

The request carries three short strings: what to find, what replaces it, and
whether case counts. The server reads the Author's own Story, finds the places
with the same function the bar used, and writes every changed row in one
statement, because the neon-http driver has no transactions and a Story half
replaced is worse than a refusal. A result that would take any field past what it
may hold refuses the whole act, naming the first such place in document order. A
Shot's words go through the boundary that reads them for every other write, so
every rule they are held to still holds.

## How the bar is drawn

**The bar is a `<form role="search">` at the head of the writing, and not a
dialog.** Finding is a walk through the document: the Author reads around a
place, fixes a word by hand, and goes on to the next. A modal bar would make inert
the very document it is finding things in. Esc puts it away and gives the focus
back where it was when it opened. It works over the writing alone, because the
fields it lights are drawn there and nowhere else, so opening it from the Contact
Sheet or the Preview turns the bench to the writing first, and turning away
closes it.

A Shot's words are lit with the Custom Highlight API, the current place in the
grease pencil and the rest more faintly. A plain field is an `<input>`, whose text
no Range reaches, **so the field itself is lit**, outlined, the current one more
heavily. Where the browser has no highlights, the current place is still wound
into view.

*Previous Place* and *Next Place* wind the document the way a press on the rail
does, opening a closed fold around the place. They wrap, as the browser's own find
and every editor's do. The bar of Commands does not wrap, because a list that came
round to its top would have no end the Author could see. Here the count says how
many places there are and the line under it says which one is current, so the end
is always in view.

*Next Place* is title case on an ordinary word, as AGENTS.md has it. It is not
the glossary's Place, the how-manyth Shot or Exit, shown in French as *Rang*. So
French says *Lieu précédent* and *Lieu suivant*. *Find and Replace* is plain
English for a tool of the bench and needs no glossary entry
(`docs/adr/0022-the-metaphor-stops-at-the-edge-of-the-work.md`).

## Considered Options

**A modal dialog.** It is what most editors draw, and the browser would do its
focus and its Esc. It would also make the writing behind it inert, so the Author
could not touch the word they had just been taken to, and every fix by hand would
mean closing the dialog and finding the place again.

**Regular expressions, and whole words only.** A pattern language is a parser for
an Author who writes rather than programs, and a mistyped pattern under *Replace
All* changes every place at once. Whole words need word boundaries in every
Language a Story is written in. Both are left out until an Author asks for them.

**Sending the changed rows from the bench.** The bench already holds the Story
and has computed the replacement, so it could send the new values. The route would
then hold every rule of every field again, on values it did not compute, and test
the ownership of every row it was handed. A bench open on a Story another tab has
since changed would write its old words back over the new ones. Recomputing costs
one read of the Story, and every rule stays where it already is.

## Consequences

`shared/utils/found.ts` is covered by Vitest in `tests/unit/found.spec.ts` over
every case the issue lists, and the bench end to end by
`tests/e2e/find-signed-in.spec.ts` on the planted Sample. *Find and Replace* is a
Command (`docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`),
and `tests/e2e/commands-signed-in.spec.ts` lists it.

A *Replace All* is not undone. The confirmation is the whole of its guard, which
is why it names both words and the count.

The lighting is redrawn whenever the places or the current one change, not when
the document alone does. A Shot whose box has just become its editor shows no
lighting until the places or the current one change, which typing in that editor
does as well as typing in the bar.

Readers read the change when the Author publishes it, and the marks of #422 show
which Scenes changed, with nothing added here: the digest columns are kept by
trigger.
