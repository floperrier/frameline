---
status: superseded by 0029
---

# A Scene is written in a panel at the edge of the bench

Superseded by `docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md`: the
reopening condition below arrived — an Exit's Conditions and the Scene they test
are wanted side by side — and writing a Scene is now a state the whole bench is
in, with the Graph folded into a rail, rather than a panel docked at its edge.
What follows is the record as it stood.

A Scene is written in one panel docked at the trailing edge of the bench, and a
node is a card. The panel is three hundred and eighty pixels of the bench's own
width, outside the graph's surface, and it pushes the graph narrower rather than
covering it; below `44rem`, the width the graph already breaks at, it fills the
screen over the graph and is closed explicitly. It holds the selected Scene or
the selected Cut, one at a time and never both. What is in it for a Scene is
exactly what an opened node held — the name, the Opening Scene mark, the Flags
the Scene sets, the Shots with their text, stills, Descriptions, Conditions,
order and delete, the ways on with their order, and the delete — and for a Cut
what the panel on its own line held, with the name of the Scene it leaves as the
way back to that Scene.

A card is `NODE_WIDTH` by `NODE_HEIGHT` and always is: the Scene's name, the
still of its first Shot, its Shot count, the Scenes its ways on lead to — three
named and the rest counted — and the mark that says a Reading opens on it. There
is nothing on it to type into.

This supersedes `docs/adr/0011-the-scene-editor-is-the-scenes-own-node.md`, which
named two conditions it would come apart at. The second has arrived: a node at a
quarter of its size cannot be typed into, so the graph gaining a viewport turns
"open a Scene" from *make this node tall* into *a panel beside the graph*. What
arrived first is the same fact from the other end — a bench of forty Scenes is
read by moving between them, and a node that grows to the height of the bench
when it is written in is a node that hides the graph it is part of. The editor
came out of the node either way.

## Considered Options

**A page per Scene** is what `0011` rejected, and the reason it gave still
holds: almost nothing here is about one Scene alone, `Conditions` is handed every
Scene in the Story because a Condition names a neighbour, and two rooms make that
edit a navigation, a reading, a navigation back, and a graph that has forgotten
where it was scrolled to. A panel at the edge of the same page is the graph and
the writing on one surface, which is what `0011` was defending. The deviation is
about where the writing sits on that surface, not about how many surfaces there
are.

**Folding, kept.** `0011` argued for several nodes open at once: reading a
neighbour while writing a Condition that names it. That argument is met without
folding, because the neighbour is not read off the graph at all — `Conditions` is
handed every Scene in the Story by name, and the Scene a visit count counts is
chosen from a list. What folding actually bought was legibility at forty Scenes,
and a card of a fixed size buys that outright: every node is the same box, so the
bench is uniform with nothing to fold and nothing to remember the fold of.

**A panel floating over the graph**, the way the Cut's panel floated on the
middle of its own line. Rejected on what it covers. A Cut's panel is small and
sits between the two boxes its line joins; a Scene's panel is the whole editor,
and one floating over the bench would be over the Scenes the Author is writing
about. Docked, it takes width from the graph and hides nothing — the trade is
that the graph is narrower while the panel is open, which is a scroll rather than
a thing gone missing.

**One panel or two.** Two would be a Scene and a Cut on screen together, which
reads well and answers the question "what am I writing" twice. One is the
decision: the Cut leaving a Scene is written *from* that Scene's ways on, so the
two are steps of one gesture rather than two things held at once, and the Cut's
panel names the Scene it left with a way back to it.

## Consequences

The card is a fixed height, so the geometry a Cut's line is drawn against is
known from the Story alone. `measureNodes`, `onUpdated`, `nodeHeights` and the
assumed height a box fell back to before it had been measured are gone, and
`NodeBox` with them: `cutLine` takes two points, and the lines are right in the
first frame the server renders rather than moving onto the boxes a tick later.
That is the last of the measurement `0010` named as the one thing that arrived
late.

`NODE_HEIGHT` drops from four hundred and twenty to what a card actually is, and
`NODE_SPACING` with it, so a Story written from here on is laid out tighter.
Scenes already written keep the coordinates they have: where an Author put their
Scenes is the one part of the graph that is theirs, and nothing renumbers a
layout behind them. A Story part-written therefore has generous gaps between its
early Scenes and tight ones between its late ones, which is the Author's own
history of the bench and not a defect.

The Move button is gone. A card has nothing to type into, so the whole card is
the handle: it is dragged from anywhere on it bar its controls and the strip a
Cut is drawn from, and `startDrag` tests for a control rather than listing the
two there are today. The arrow keys went with the button, so the card itself
takes focus and moves by `NODE_PITCH` — a graph that answers only to a pointer is
not one everyone can lay out.

The guided path lost the step that opened a node and gained the one that writes a
Scene: `openScene` is `writeScene`, pointing at the card's own button. The Cues
that pointed inside a node point into the panel and need no scoping to a Scene,
because the panel holds one Scene by construction — see
`docs/adr/0019-the-guided-path-is-anchored-to-the-template.md`, whose `within`
went away with them.

Nothing is deep-linkable below the Story still, and which Scene is in the panel
is written nowhere: it is the Author's view of their own graph and lasts as long
as the page.

The panel pushes the graph rather than covering it, so nothing being worked on
ends up hidden underneath — and that push is what narrows the graph, which the
drag that lays a Scene out had to be taught. A hand holding a card can be out over
the panel; a card that went on following it was dropped where the Author could
neither see it nor aim it. So the point a drag reads is held at the edge of the
window onto the graph: the card stops where it can be seen to stop, with part of
it still on the bench. See
`docs/adr/0010-the-graph-is-written-here-not-pulled-in.md`, which carries the rest
of the viewport.

The reopening condition is a second thing worth writing at the same time as a
Scene. A panel holds one, so the day an Author needs a Cut's Conditions and the
Scene they test side by side — or two Scenes' Shots against each other — the
answer is a second panel or a split one, and the single selection this record
rests on is what has to give.
