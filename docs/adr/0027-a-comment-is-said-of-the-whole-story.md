---
status: accepted
---

# A Comment is said of the whole Story

A Comment is the first text one person writes about another's work to appear in
this product, and the first thing decided about it was what it may point at. It
points at a Story, and never at a Scene or at a Shot.

The reason is the reader who has not read yet. A Story is a thing whose shape is
the work: which Scenes there are, where they branch, which Shot is skipped for
whom. A Comment on a Shot cannot help but say that shape out loud, on the page
somebody opens to find out. So the `comments` table carries a `story_id` and
nothing else that points into a Story — there is no `scene_id`, no `shot_id`, and
no column an anchor could hide in — and the body the endpoint reads carries text
alone. A handler that forgot would have nowhere to write it.

Comments are read oldest first, which is how a conversation is read, and
`created_at` is the whole of the ordering. Nothing is counted, rated or reacted
to: there is no column a score could be kept in, so there is nothing to play and
nothing to farm. This is the same refusal the Catalogue makes about its own
ordering — see ADR 0023.

## Consequences

**A Comment is written from the reading page and nowhere else.** It sits under
the Reading rather than over it, so whoever arrives meets the work before
anybody's answer to it. The Preview draws no Comments: an unpublished Story is
its Author's alone, and there is nobody to have answered it.

**Two people may take a Comment away, and only two.** The Author who wrote it,
and the Author of the Story it stands under, who answers for what is said on
their own page. Both grounds live in the one delete statement, so a Comment
nobody may delete and a Comment that was never written come back
indistinguishable — the not-found everything unreachable gets.

**A Name is required before commenting, and still asked for in one place.** A
Comment carries its Author's Name wherever it appears, so an Author with none is
refused — but the form that writes a Name stays on the list of an Author's own
Stories, where ADR 0025 put it. The refusal says where to go rather than growing
a second Name form on a page about somebody else's Story.

**There is no report queue.** It is an ongoing commitment rather than a feature,
and there is nobody to report yet. The day it is needed, a `mailto:` link is five
lines.
