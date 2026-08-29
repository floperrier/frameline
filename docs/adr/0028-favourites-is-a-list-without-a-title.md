---
status: accepted
---

# Favourites is a List without a title

An Author keeps the Stories they want to come back to, and there are two words
for that in every product that has it: a favourite, which is one click, and a
list, which is a title and things under it. They are usually two mechanisms — a
`favourites` table beside a `lists` table, or a boolean on the join — and the two
then have to be kept saying the same thing.

Here they are one. A List is Stories gathered under a title of the Author's own;
Favourites is the List every account has, and its title is null. To favourite a
Story is to put it in that List, and there is no other way to do it: no
`favourite` column, no second endpoint, and nothing that could disagree with what
the List holds. The endpoint that gathers a Story is the same request whichever
List it names — `PUT /api/lists/<list>/stories/<story>` — so the button on an
entry in the Catalogue and the checkbox beside a title an Author wrote are one
act on two rows.

The null title is what makes Favourites untitled by construction rather than by
a handler remembering: there is nothing to write and nothing to draw, so the word
it is shown under is the interface's own, in the Locale of whoever is reading.
Renaming and deleting are scoped to a List with a title, so the one List every
account has is out of their reach rather than guarded by a check the next handler
could forget. A unique index on the Author, where the title is null, is what
keeps it one.

## Consequences

**Favourites is written by the read that needs it, not by the sign-in.** An
account created before Lists existed never had one planted, and an Author seeded
straight into the table by a test or a script does not either. So the endpoint
that answers with an Author's Lists writes the row first, with an insert that does
nothing where it is already there. Every account therefore has Favourites from
the start, whatever wrote the account.

**A List is private, and that is a fact about the handlers.** Nothing in the
schema says who may read one. Every query is scoped by `author_id`, there is no
route that takes a List's id and hands its contents over, and no Profile draws
one — the glossary's Profile is the Name and the Stories that Author has Listed,
never what they thought of other people's. Public Lists would be a second surface
of public text to answer for and are out of scope until there is enough published
to be worth arranging.

**A List hands over only a Story anybody can still read.** The entry leads to the
public link, so a Story unpublished since it was gathered is left out of the
answer rather than drawn as a link to a not-found. The row stays where it is: the
Story comes back to the shelf its Author put it on if it is published again. For
the same reason a Story nobody has published cannot be gathered at all — an
unpublished Story is its own Author's alone, and answering anything but a
not-found would say whether a guessed id exists.

**Gathering a Story twice changes nothing.** The row is keyed on the pair, so the
second insert conflicts with the first and does nothing, which is why the request
is a `PUT`. Nothing is counted: there is no column a number of favourites could
be kept in, so a Story's place in the Catalogue cannot be played from here — the
same refusal ADR 0023 makes about the Catalogue's own ordering.
