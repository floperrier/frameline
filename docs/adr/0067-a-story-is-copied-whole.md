---
status: accepted
---

# A Story is copied whole

Decided on 2026-10-02, issue #415.

A Story's Language is named once, when the Story is created, and nothing copies
a Story. Two things an Author plainly needs were therefore rebuilds by hand. One
is the same Story in the other Language: every Scene, Shot, Exit, Flag and
Condition written again, every Image and Sound uploaded again, every Cut,
Layout, Movement, Effect and crop point set again, and only then the words
rewritten. The other is a variant kept apart: a published Story is read live,
so an Author who wants to try another ending without doing it in front of their
Readers had nowhere to work on it. *Amended by
`docs/adr/0069-a-published-story-is-read-as-it-was-published.md`:* a published
Story is now read as its Author last published it, so the changes are written in
the Story itself, and a copy is for a variant kept apart for good.

**Every Story on the Author's shelf can be copied, under a title and in a
Language the Author names, and the copy opens on the bench.** *Duplicate*
stands beside *Delete* on `/stories` and opens a form under the entry, filled
with the Story's title and Language. `POST /api/stories/:id/copy` takes
`{ title, language }`, holds them to the rules a new Story's are held to, and
writes the copy in one statement.

## Why the copy is whole

A copy that left anything out would be the hand rebuild again, only shorter. So
it carries the Story's Synopsis, `steps_back` and text, and every Scene, Shot and
Exit with every column it has, the bytes of each Image and Sound among them. No
column is listed. Each row goes in as `to_jsonb` writes it, with the copy's own
ids laid over it, and is read back through `jsonb_populate_record`, the way a
deleted Shot is put back (`docs/adr/0064-a-deleted-shot-is-held-for-a-day.md`).
A column added later is copied without anybody remembering this route.

The ids are drawn before any row is written, one map per table, so every
reference inside the copy names the copy's own rows: the opening Scene, the
Cover, the Scene whose Sound a Scene is heard under, both ends of an Exit, and
the Scene or Exit inside a Condition. Deleting the original afterwards leaves the
copy standing whole. A Condition id that named no row of the original names none
in the copy either, and asks the same of both.

## Why nothing marks it as a copy

There is no origin column, and the title is whatever the Author typed. The form
is filled with the original's title, not with a *(copy)* suffix the Author would
only delete. That is the reason a Scene written again carries nothing that says
so (`server/api/scenes/[id]/duplicate.post.ts`): from the moment it exists it is
an ordinary Story. An origin column would be read by nothing today. It would
also bring back a question every reader of it would have to answer, namely what
the link means once either Story has been rewritten.

## Why the published state does not carry over

The copy is unpublished and unlisted even when the original is both. Being read
is a second act (`docs/adr/0023-being-published-and-being-found-are-two-acts.md`).
A copy that went live under a new link the moment it was made would show its
half-rewritten words to anyone who found that link, and a variant would be
exactly as public as the Story it was made to be kept apart from. It carries no
Comment either, because a Comment was said of the other Story, and it belongs to
no List, because a List is what somebody gathered and they gathered the other
one.

## Why the Language is chosen at the copy

The Language is still not editable on a written Story. The Story's words are in
the Language it names. The `lang` the Reading and every shelf set those words
in, and so the voice a screen reader reads them with, comes from it, and so does
the Language each shelf names beside the title. Changing it under the same words
would mislabel all of them until the Author had rewritten each Shot. A copy names its Language at the moment it is made and is
then rewritten at the Author's pace, while the original keeps reading as what it
is. A copy into another Language is not a translation: its words are the
original's until its Author rewrites them.
