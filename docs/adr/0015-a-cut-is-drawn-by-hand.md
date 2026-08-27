---
status: accepted
---

# A Cut is drawn by hand

A Cut is made by dragging from the edge of one Scene's node to another. A strip
twenty pixels wide down the leading edge of every node is where the gesture
starts, a line follows the pointer while it is live, the Scenes that can take the
Cut light up and the ones that cannot go quiet, and letting go over a Scene
writes the Cut. Letting go over the empty bench writes a new Scene at that point
and cuts to it. There is no form, nothing to arm, and no list of Scenes to pick an
arrival out of.

The form it replaces was a `<select>` of every Scene in the Story and a submit
button, inside the node of the departing Scene, under its Shots and its Flags and
every Cut already leaving it. The Graph was on screen the whole time — the two
Scenes were boxes the Author had arranged with their own hands — and none of it
was what they touched.

## Considered Options

**The form, kept.** It has one real virtue: it is the only route that needs no
gesture at all, and it works identically for a pointer, a finger and a keyboard.
Everything below has to earn that back.

**A dedicated handle on the slate**, beside the two that fold and move a node.
This was the first recommendation and it was rejected in favour of the edge. The
slate is where the things done *to a node* live — folded, moved — and a Cut is
done to the Scene, not to its drawing. The edge is also where a Cut visibly
leaves.

**The node's own padding as the source**, which is what "the edge" meant at
first: one pixel of border and twelve of padding, a thirteen-pixel rim. It does
not survive contact. The right-hand rim is where the scrollbar sits, and the
scrollbars here are visible by choice — `color-scheme: dark` is declared so they
come out of the dark for nothing. The bottom rim is not where it looks: inside a
scrolling box, `padding-block-end` is at the bottom of the *content*, so the
thirteen pixels at the foot of the node on screen are whatever field happens to
be there, and the real rim is reachable only after scrolling to the end. That
leaves one usable side. And a fingertip's contact patch is around forty pixels,
so a thirteen-pixel rim cannot be aimed at with a thumb at all, while suppressing
touch scrolling on it would kill the scroll of a node the width of the screen.

**So the edge was given a surface.** The node became two columns that do not
themselves scroll — a twenty-pixel strip, and the body that scrolls inside itself
— which turns a thirteen-pixel thread into a target twenty pixels by the whole
height of the node. Because the strip is outside the scrolling part, the gesture
is immediate under a finger with no long press, which is the thing a rim, a
handle-plus-modifier or a long-press affordance all failed at. Twenty pixels is
the pitch the bench is already pricked out at and the distance an arrow key moves
a node, so it is the step and not a new number. The mark that names the Opening
Scene, which that edge already carried, moved onto it.

The cost is real and was accepted: twenty pixels come out of the node's existing
width rather than being added to it, because the width is what a phone can show.
A Scene's writing is twenty pixels narrower than it was.

**A graph library, again.** Drawing a live line, hit-testing a drop and lighting
a target set is a large part of what Vue Flow is for, and this is the second time
that library has been the obvious answer and not been taken. The reasons in
`docs/adr/0010-the-graph-is-written-here-not-pulled-in.md` did not change: the
graph still has to render whole on the server, and a node still has to be
ordinary markup because it holds an editor. The gesture is a pointer capture on a
page that already captures a pointer to move a node.

## Consequences

**The keyboard route is a button nothing draws.** The gesture is the only
*visible* way in — that was the requirement — so the keyboard reaches the same
aiming through a button that is hidden until it takes focus, the pattern a skip
link uses. It is a real button with a real accessible name, so assistive
technology finds it whether or not an eye ever sees it, and it enters exactly the
state the drag does: one aiming, two ways in, not two code paths to keep in
agreement.

**A finger and a pointer draw a Cut. A finger does not renumber one.** Where a
gesture and a pair of controls do the same write, the controls are the touch and
keyboard route and the gesture is not made to work for everyone — the strip of
ways on and a Shot's number are dragged by a pointer only. This is defensible
because the controls are the same write and not a degraded one; it would not be
defensible for drawing a Cut, which has no controls, and that is why the hidden
button exists.

**The set of Scenes a Cut may land on is fixed when the gesture begins.** It
depends on the departing Scene and the Cuts already leaving it, and neither
changes mid-gesture, so nothing is recomputed as the pointer moves and the whole
live state is two static classes. A Scene may not be aimed at itself, nor aimed
at twice from the same Scene — so the hand cannot slip into either.

**The server still allows both.** A Scene that cuts to itself is one a Reading
re-enters, and two Cuts to one Scene under opposite Conditions is what Conditions
on a Cut are for; neither gains a constraint, and a future reader of the schema
looking for the missing uniqueness should find this paragraph instead. What the
interface withholds is the slip, not the Story: the second way on to a Scene is
written by duplicating the first from its panel, which copies its Conditions.

**The line being drawn is the grease pencil, and it marches.** The interface's
cyan marks what the interface does and the grease pencil marks what the Author
wrote on the film. A Cut being drawn is the Author's mark, so it is the grease
pencil — and since it is then dragged across a bench full of finished Cuts in the
same colour, what tells it apart is that its dashes move. That is the first
animation in the product, so it is also the first thing that has to stop under a
reduced-motion preference. Over a Scene that cannot take the Cut the line loses
its arrowhead: the head is what says "this will land", so removing it is the
cheapest way to say "not here", and it says it before the Author lets go rather
than after.

**Dropping on the empty bench writes two things.** A Scene, at the snapped point
of the drop, and the Cut to it. The Scene is written under a provisional name with
its node opened on that name in a field, which is why a Scene had to become
renameable at all: a name typed in the middle of a gesture that could never be
corrected would have been worse than the form. The endpoint that adds a Scene
learned to accept a placement and still chooses one itself when given none.

**The form that named a new Scene at the top of the page stays.** It is no longer
the ordinary way, but it is the only way to write the *first* Scene of a Story,
when there is no node to pull a thread from.

**The gesture is held by Scene id, never by the Scene.** A read landing mid-drag
replaces every Scene in the Story, and a gesture holding the old object would go
on aiming from a Scene nothing draws any more — the same reason the drag that
moves a node holds an id, and the same trap.

Zoom has since arrived — see
`docs/adr/0010-the-graph-is-written-here-not-pulled-in.md` — and this is what it
did to the gesture. The pointer is read on the surface rather than on the screen,
so a Cut lands where the hand is at every scale, and the Scene a Cut dropped on
the bare bench writes is snapped on the same lattice it always was. What a
quarter takes is the strip: twenty surface pixels are five on screen, which is
nothing to aim at. So the gesture is a gesture for a bench near its own size, and
a pulled-back bench keeps both of the routes that never needed the strip — the
hidden button on each node, which is the keyboard's way through the same aiming,
and coming closer, which is now one press away.
