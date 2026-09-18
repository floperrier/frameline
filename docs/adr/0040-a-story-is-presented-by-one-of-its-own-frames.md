# A Story is presented by one of its own frames

## Status

Accepted.

## Context

A Story is made of Images — a Shot is an Image and its text, and the product's
whole premise is that interactive narrative can be cut like film — yet until now a
Story was presented by words alone everywhere it was met before being opened. The
Catalogue was a column of titles and Synopses, a Profile a list of titles, the
reading page opened on an eyebrow and a title. Somebody deciding what to read next
scanned a table of contents for a medium that is pictures, and the Author had no
say in which frame stood for their work, the way they have a say in its title.

The Images are already there, in the Shots' own rows
(`docs/adr/0005-a-shots-image-lives-in-its-row.md`), served one request apiece
by `/api/shots/<id>/image` to anyone who can reach the Story.

## Decision

A Story carries a **Cover**: one nullable reference from `stories` to `shots`,
`on delete set null`. The Author names it on the bench from among the Images the
Story's Shots already carry, beside the Synopsis, because both are how a stranger
is handed the work. It is never a second upload: a Cover is always a frame of the
work itself.

Every shelf resolves the same rule, in SQL where the shelf is a query and in
`coverOf` where the bench holds the Story: the named Shot where it still carries an
Image, otherwise the first Shot of the Opening Scene that carries one, otherwise
nothing. The Catalogue, a Profile and an Author's Lists draw it at the head of the
entry; the reading page draws it over the title. Nothing is drawn inside the
Reading's frames, which are the Story's own.

Deleting the Shot whose Image is the Cover sets the reference null, and the Story
falls back to the Opening Scene without a refusal and without a hole on the shelf.
Taking the naming away is offered as an act of its own, so an Author who named the
Opening Scene's own first frame has named it, and a later change of Opening Scene
does not move their Cover from under them.

## Considered

**A cover uploaded on its own.** It would let a Story be sold by a frame that is
not in it, and it would be a second column of bytes with its own limits, types and
sniffing. Choosing from the Story keeps the shelf honest and the schema to one id.

**Fallback to the first Image anywhere in the Story.** Scenes are ordered by
creation, which is not an order a Reader ever meets. The Opening Scene's first
Image is what every Reader sees first, so it is the one honest stand-in.

**No fallback.** Then the Catalogue is a mix of pictures and holes until every
Author has done a chore, and the feature reads as broken on the day it ships.

**Choosing the Cover where the Shot is written, in the panel.** The act would sit
beside the Image, but the Author would be choosing without seeing the others, and
the result — how the Story is presented — belongs beside the Synopsis with
Publish and List, not inside one Scene.

## Consequences

The first thing a Story carries that points into its own Shots. The write is
checked at the boundary — the Shot must belong to this Story and carry an Image —
so a Story cannot wear another Story's frame. The migration is additive and
nullable, and rollback leaves a column nothing reads.

A shelf's entry and the reading page's title card carry the Image's address, so
an unpublished Story's Cover is as unreachable as its Shots: the image endpoint's
rule is the only rule.
