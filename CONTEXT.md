# Frameline

Frameline is an editor for interactive narrative works that speaks the grammar of
cinema rather than that of prose fiction or video games. Authors assemble shots
into scenes and connect scenes with cuts; readers play the result at a public
link.

## Language

Every term below is the word the code uses. The interface is also read in
French, so each entry carries the word it is shown as — `_Affiché_` — and that
word binds as tightly as the English one: a screen that says something else is
wrong, and so is a synonym invented where it is displayed. See
`docs/adr/0014-the-glossary-is-the-codes-language.md`.

### The work

**Story**:
A complete interactive work, owned by one Author.
_Affiché_: Récit
_Avoid_: film, movie, project, game, narrative, experience, histoire

**Scene**:
A linear run of Shots, and the only unit at which a Story branches. The run is
linear for every Reader, but not the same length for each: a Shot whose Conditions
do not hold is not played.
_Affiché_: Scène
_Avoid_: passage, knot, node, chapter, page, card, séquence

**Shot**:
The atomic unit of a Story — a Still and its text, shown to the Reader as a single
beat. Either may stand alone, but a Shot with neither is one the Author has not
written yet.
_Affiché_: Plan
_Avoid_: panel, slide, frame, beat, step, séquence

**Still**:
The one image a Shot carries. A Shot may be text alone, so a Still is what a Shot
has at most one of, never a thing of its own.
_Affiché_: Photogramme
_Avoid_: picture, photo, frame, visual, asset, media, image

**Description**:
What a Still shows, written by the Author for a Reader who cannot see it. A Still
may have none, and a Shot's text is never used as one: the text carries the beat,
the Description carries the frame.
_Affiché_: Description
_Avoid_: alt, alt text, label, caption, tooltip, legend

**Place**:
Where a Shot comes in its Scene's run, or a Cut in the ways on offered at the end
of the Scene it leaves — the Author's own numbering, counted from the first, with
nothing missing. Never used of a Reading, which has a Position instead.
_Affiché_: Rang
_Avoid_: index, order, rank, slot, sort key

**Cut**:
A directed connection from one Scene to another, offered to the Reader at the end
of a Scene as something to take. Named after the film edit that joins two shots.
_Affiché_: Coupe
_Avoid_: choice, option, link, branch, edge, transition, raccord, montage

**Graph**:
A whole Story seen at once, as its Scenes and the Cuts between them. A Scene is
drawn in it as a node and a Cut as an edge — words for the drawing, never for the
Scene or the Cut itself.
_Affiché_: Graphe
_Avoid_: map, tree, flowchart, board, canvas

**Opening Scene**:
The one Scene a Reading starts on, named by the Story itself. The first Scene an
Author writes becomes it, and the Author can name another. Deleting it leaves the
Story with none — where a Story starts is the Author's to say, so the role is not
passed on behind their back — and a Story with none can be neither previewed nor
published until one is marked.
_Affiché_: Scène d'ouverture
_Avoid_: start, entry point, root, first scene, home

**Condition**:
A flat test on State, carried by a Cut or by a Shot: it decides whether the Cut is
offered to this Reader, or whether the Shot plays for them. Either may carry
several, and is offered or played only where all of them hold; one carrying none
always is.
_Affiché_: Condition
_Avoid_: rule, guard, requirement, predicate, gate

**Leader**:
The short Story an Author is given when their account is created, written to be
taken apart rather than read: three Scenes carrying Flags, Conditions and Stills
already working. Theirs like any other Story — they change it, publish it, delete
it — and there is one per Language, never a translation of another.
_Affiché_: Amorce
_Avoid_: tutorial, sample, template, demo, onboarding, exemple, didacticiel

**Cue**:
One step of what the bench asks of an Author writing their first Story: a test on
the Story open on the bench, an element it points at, and a sentence it says. Met
by the Author doing the thing, in whatever order they get there. Named after the
cue marks that tell a projectionist to act now, and never a Flag — _Repère_ and
_Marqueur_ sit close enough together in French that the two have to be told
apart on purpose.
_Affiché_: Repère
_Avoid_: hint, tip, tour, step, onboarding, coach mark, marqueur, astuce

### The reading

**State**:
Everything a Story has accumulated during one Reading — a flat map of Flags, plus
a visit count per Scene. Never shared between Readings.
_Affiché_: État
_Avoid_: variables, memory, save, progress, context, session data

**Flag**:
A single named value in State, set by the Author and tested by Conditions. A
Scene carries the Flags it sets, and sets them on every entry.
_Affiché_: Marqueur
_Avoid_: variable, switch, toggle, key, drapeau

**Reading**:
One traversal of a published Story by one Reader, carrying its own State.
_Affiché_: Lecture
_Avoid_: session, playthrough, run, visit

**Position**:
How far one Reading has got: the Cuts it has taken, in order, and how many Shots
of the Scene it stands in are behind it. Everything else about a Reading — the
Scene, the Shot on screen, the Cuts on offer, the State — is computed from it.
Where a Shot or a Cut comes in its own list is a Place, never a Position.
_Affiché_: Position
_Avoid_: cursor, pointer, progress, step, index

### The people

**Author**:
A signed-in person who writes Stories. The only actor who can change anything.
_Affiché_: Auteur
_Avoid_: user, creator, owner, writer, director

**Reader**:
Anyone who plays a published Story. Needs no account.
_Affiché_: Lecteur
_Avoid_: user, player, viewer, visitor, audience

**Preview**:
An Author reading their own Story before it is published, on the same engine a
Reader runs. Not a mode of the editor and not a Publish: nothing about the Story
changes, and nobody else can reach it.
_Affiché_: Aperçu
_Avoid_: test, play mode, simulate, dry run, rehearse

**Publish**:
To make a Story readable by Readers at a public link. A Story that has never been
published is visible only to its Author.
_Affiché_: Publier
_Avoid_: release, share, deploy, ship, go live

### The languages

**Language**:
The one language a Story is written in, named by its Author. Nothing translates
a Story: a Story written in French is read in French by everyone who opens its
link, whatever their own Locale.
_Affiché_: Langue
_Avoid_: locale, translation, i18n, region

**Locale**:
The language the interface is read in, detected from the person reading and
never a property of a Story. A Reader whose Locale is English reads a French
Story in French, with English around it.
_Affiché_: Langue de l'interface
_Avoid_: language, translation, region, market
