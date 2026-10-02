---
status: accepted
---

# The Contact Sheet writes a Shot's Place

Decided on 2026-10-02, issue #440. Amends
`docs/adr/0043-a-story-is-written-as-one-document.md`, which made the Contact
Sheet a reading that writes a Shot's Description and the point its Image is
cropped around, and nothing else.

Cutting a photo story is putting the frames in order: the close-up after the
wide shot, the beat at the end brought forward to open the Scene. The Contact
Sheet is where an Author judges that order, because it is the one reading that
shows every frame of every Scene at once. Until now it could not change it. The
only way to change a Shot's Place was ↑ or ↓ beside its row in the document, one
Place, one request and one redraw per press: eleven presses to bring Shot 12 to
the head of its Scene, with the Author scrolling to keep the row in view. A Shot
moved into another Scene by naming it (#407) lands at the end there, and is
brought up from the end the same way.

**On the Contact Sheet a frame is carried to any Place by dragging it**, within
its own band to another Place there, or into another band at the Place it is let
go in. While it is carried, a bar in the grease pencil on the edge of a frame says
where it will land. On the drop the order is written, the Story is read back so
the document, the rail and the Remarks agree with the sheet, the frame takes the
focus and so stays the one chosen, and the page's status says what happened.

## Why here

The sheet is where order is seen, and the document is where words are written. A
row of the document is tall, and dragging one would carry the Author's words
about on the surface where they are typing. Dragging a row of the document is
left out for that reason.

## How it is written

Within a band, the whole new order is one `PUT /api/scenes/:id/shots/places`,
which is how ↑ and ↓ already write it: `server/utils/places.ts` was built for a
drag of four Places as well as a press of one. Where a dropped frame lands is
`carriedTo` in `shared/utils/scenes.ts`, the gap counted over the band as drawn,
so a frame let go either side of itself writes nothing.

Into another band, it is one `POST /api/shots/:id/move` given the `place` it
lands at, counted from nought as `position` is. The Shots there from that Place
on move one Place later, inside the statement the move already was, because
neon-http has no transactions. A move followed by a renumbering would be two
requests, leaving the Story in an order nobody asked for between them, and in it
for good if the second failed. No `place`, or one past the end, is the end, which
is the move made by naming a Scene, unchanged.

A refusal is said under the Story's edge, as everything the sheet writes is: no
section of the document is on screen to say it in. The Story is read back either
way, so after a refusal the sheet draws the order the server holds.

## What stays

The drag is the pointer's alone. ↑ and ↓ beside each row of the document, and
*Move to another Scene* by naming it, stay the keyboard's and the finger's way to
the same writes, which is the rule `docs/adr/0015-a-cut-is-drawn-by-hand.md` set
for a gesture beside a pair of controls doing the same write. Native drag and
drop on a touch screen is uneven, so no finger drags here. Nothing is announced
while a frame is carried, since nothing a keyboard can do starts a drag. The
roving tabindex and the arrows that walk the frames are unchanged.

The platform's own drag and drop is used, and no library. `draggable` stands on
each frame's `<li>` rather than its button, because Firefox starts no drag on a
`<button>`. The Image inside is not draggable itself, so what is carried is the
frame and not the file. The drag carries a type of the sheet's own rather than
`text/plain`, so a frame let go over the Description field types nothing into it.

Several frames at once, Exits reordered on the sheet (their order is set in the
Preview, where they are read, `0030`), and a keyboard way to carry a frame
several Places in one act are left out.
