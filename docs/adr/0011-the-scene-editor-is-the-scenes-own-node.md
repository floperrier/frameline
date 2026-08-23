---
status: accepted
---

# The Scene editor is the Scene's own node

An Author works on one surface. `/stories/[id]` is the graph, and a Scene's node
opened on it is where that Scene is written: its Shots with their text, their
stills and their Descriptions, the Conditions each Shot plays under, the Flags
the Scene sets on entry, the Cuts leaving it with their own text and Conditions,
and the Scene's own name, Opening Scene radio and delete. There is no editing
route below `/stories/[id]` and no second room to navigate to; the one page
beneath it is the Preview, which is the Reading engine and not the editor.

The v1 spec said two surfaces: "a graph of Scenes and the Cuts between them, and
a Scene editor where the Shots of one Scene are written and given images."
`docs/adr/0006-two-rooms-one-language.md` names what shipped — the bench — and
describes how it looks, but not why the second room went away. This record is
that.

## Considered Options

A Scene editor of its own is the ordinary shape, and it was rejected on what an
Author actually does between two keystrokes rather than on the effort of
building it.

Almost nothing here is about one Scene alone. A Cut's Condition tests a Flag some
other Scene sets, and a Shot's Condition can count visits to a Scene the Author
has to name; the `Conditions` component is handed every Scene in the Story for
exactly that reason. Writing a Condition therefore means reading a neighbour, and
on one surface the neighbour is already on screen: the Author opens the two nodes
that concern each other and works between them. In two rooms the same edit is a
navigation, a reading, a navigation back, and a graph that has forgotten where it
was scrolled to.

The second room also costs a second everything. One page means one
`readStoryGraph` fetch, one `useEditing` holding the Story that every control
writes into, and one place a refusal is shown. A Scene page would fetch a Scene
and its neighbours, hold its own copy, and have to decide what the graph behind
it does when a Cut is drawn from over there.

What makes it work rather than merely cheaper is that the graph is written here
rather than pulled in — see
`docs/adr/0010-the-graph-is-written-here-not-pulled-in.md`. A node is ordinary
markup in an ordinary page, so putting a textarea and a file picker in one costs
nothing, and that record says what the same node costs inside a library.

## Consequences

The node carries a whole editor in 320 pixels of width, of which twenty are the
strip down its leading edge, so a Scene with several Shots is read in a column
narrower than a phone. It is as tall as its writing up to the height of the
bench, and scrolls inside itself past that. That trade and the numbers behind it
are in `docs/adr/0006-two-rooms-one-language.md`, along with the folding that
keeps forty of them readable. The Story-wide things that have nowhere else
to live — the title, the Preview, the Publish and the public link — sit in a
header above the graph that stays on screen while it scrolls.

Nothing is deep-linkable below the Story. An Author cannot send themselves a link
to one Scene, and a refusal about a Shot is shown against the Story rather than
against a page of its own.

Two things would push the editor back out into a room of its own. A Shot that
needs more room than a node can give is the first: the still is deliberately
small here, because the Preview is where an Author meets an image at the size a
Reader will, and a Shot that grew an editor for its image rather than a picker
would have outgrown the node. The second is zoom. A node at a quarter of its size
cannot be typed into, so the day the graph gains a viewport — the reopening
condition of the sibling record — opening a Scene stops meaning "make this node
tall" and starts meaning a panel or a page beside the graph. The two decisions
were taken together and they come apart together.
