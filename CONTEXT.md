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
The atomic unit of a Story — one still image and its text, shown to the Reader as
a single beat.
_Avoid_: panel, slide, frame, plan, beat, step

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
An expression on a Cut that decides whether the Cut is offered to this Reader,
evaluated against State.
_Avoid_: rule, guard, requirement, predicate, gate

### The reading

**State**:
Everything a Story has accumulated during one Reading — a flat map of Flags, plus
a visit count per Scene. Never shared between Readings.
_Avoid_: variables, memory, save, progress, context, session data

**Flag**:
A single named value in State, set by the Author and tested by Conditions.
_Avoid_: variable, switch, toggle, key

**Reading**:
One traversal of a published Story by one Reader, carrying its own State.
_Avoid_: session, playthrough, run, visit

### The people

**Author**:
A signed-in person who writes Stories. The only actor who can change anything.
_Avoid_: user, creator, owner, writer, director

**Reader**:
Anyone who plays a published Story. Needs no account.
_Avoid_: user, player, viewer, visitor, audience

**Publish**:
To make a Story readable by Readers at a public link. A Story that has never been
published is visible only to its Author.
_Avoid_: release, share, deploy, ship, go live
