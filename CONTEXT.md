# Frameline

Frameline is an editor for interactive narrative works that speaks the grammar of
cinema rather than that of prose fiction or video games. Authors assemble shots
into scenes and connect scenes with cuts; readers play the result at a public
link.

## Language

### The work

**Story**:
A complete interactive work, owned by one Author.
_Avoid_: film, movie, project, game, narrative, experience

**Scene**:
A linear run of Shots, and the only unit at which a Story branches.
_Avoid_: passage, knot, node, chapter, page, card

**Shot**:
The atomic unit of a Story — a Still and its text, shown to the Reader as a single
beat. Either may stand alone, but a Shot with neither is one the Author has not
written yet.
_Avoid_: panel, slide, frame, plan, beat, step

**Still**:
The one image a Shot carries. A Shot may be text alone, so a Still is what a Shot
has at most one of, never a thing of its own.
_Avoid_: picture, photo, frame, visual, asset, media

**Description**:
What a Still shows, written by the Author for a Reader who cannot see it. A Still
may have none, and a Shot's text is never used as one: the text carries the beat,
the Description carries the frame.
_Avoid_: alt, alt text, label, caption, tooltip, legend

**Place**:
Where a Shot comes in its Scene's run, or a Cut in the ways on offered at the end
of the Scene it leaves — the Author's own numbering, counted from the first, with
nothing missing. Never used of a Reading, which has a Position instead.
_Avoid_: index, order, rank, slot, sort key

**Cut**:
A directed connection from one Scene to another, offered to the Reader at the end
of a Scene as something to take. Named after the film edit that joins two shots.
_Avoid_: choice, option, link, branch, edge, transition, raccord

**Graph**:
A whole Story seen at once, as its Scenes and the Cuts between them. A Scene is
drawn in it as a node and a Cut as an edge — words for the drawing, never for the
Scene or the Cut itself.
_Avoid_: map, tree, flowchart, board, canvas

**Opening Scene**:
The one Scene a Reading starts on, named by the Story itself. The first Scene an
Author writes becomes it, and the Author can name another.
_Avoid_: start, entry point, root, first scene, home

**Condition**:
A flat test on State, carried by a Cut, that decides whether the Cut is offered to
this Reader. A Cut may carry several, and is offered only where all of them hold;
a Cut carrying none is always offered.
_Avoid_: rule, guard, requirement, predicate, gate

### The reading

**State**:
Everything a Story has accumulated during one Reading — a flat map of Flags, plus
a visit count per Scene. Never shared between Readings.
_Avoid_: variables, memory, save, progress, context, session data

**Flag**:
A single named value in State, set by the Author and tested by Conditions. A
Scene carries the Flags it sets, and sets them on every entry.
_Avoid_: variable, switch, toggle, key

**Reading**:
One traversal of a published Story by one Reader, carrying its own State.
_Avoid_: session, playthrough, run, visit

**Position**:
How far one Reading has got: the Cuts it has taken, in order, and how many Shots
of the Scene it stands in are behind it. Everything else about a Reading — the
Scene, the Shot on screen, the Cuts on offer, the State — is computed from it.
Where a Shot or a Cut comes in its own list is a Place, never a Position.
_Avoid_: cursor, pointer, progress, step, index

### The people

**Author**:
A signed-in person who writes Stories. The only actor who can change anything.
_Avoid_: user, creator, owner, writer, director

**Reader**:
Anyone who plays a published Story. Needs no account.
_Avoid_: user, player, viewer, visitor, audience

**Preview**:
An Author reading their own Story before it is published, on the same engine a
Reader runs. Not a mode of the editor and not a Publish: nothing about the Story
changes, and nobody else can reach it.
_Avoid_: test, play mode, simulate, dry run, rehearse

**Publish**:
To make a Story readable by Readers at a public link. A Story that has never been
published is visible only to its Author.
_Avoid_: release, share, deploy, ship, go live
