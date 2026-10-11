---
status: accepted
---

# A Comment may answer another

Decided on 2026-10-11, in a design session held before any issue. Amends
`docs/adr/0027-a-comment-is-said-of-the-whole-story.md`.

0027 made the Comments under a Story one list, read oldest first. Once more than
two people take part, that list is hard to follow: an answer lands three Comments
below the one it answers. **A Comment may now answer any other Comment under the
same Story, at any depth.** It is still said of the Story whole. An answer points
at a Comment and never at a Scene or a Shot, so nothing 0027 kept out of a Comment
comes in through it. A single level of answers was considered and refused: it
pushes an answer to an answer back onto the Comment above, and loses who answered
whom.

**Answers are read under what they answer**, oldest first at each level, as 0027
reads the list. The indent stops at the third level. A deeper answer stands at the
third level and names whom it answers, so a long exchange stays readable on a
phone.

**The Story's Author is marked** wherever they answer under their own Story,
because the person who wrote the work answering is the conversation Readers came
for.

**A Comment taken away while it has answers leaves its place.** Its words and its
Name go, and its place stays, marked as taken away, so the answers keep what they
answer. A Comment with no answers goes entirely, as before. The two people who may
take a Comment away are still the two 0027 named.

**How many Comments a Story has is shown wherever the Story is presented**: in
the Catalogue, on a Profile, on a public List and in the Feed. The number counts
answers and leaves out Comments taken away. It is shown and never ranked, since
nothing is ordered by it
(`docs/adr/0084-the-catalogue-is-ordered-by-nothing-counted.md`). It is the
length of a list anybody can read on the Story's page, and inflating it means
writing in public, under one's Name. 0027's *nothing is counted* is read the way
0072 reads it: what is refused is a number that orders.

## Consequences

**An answer is a Notification** for the Author of the Comment it answers, and any
Comment is one for the Story's Author
(`docs/adr/0089-a-notification-reaches-an-author-three-ways.md`).
