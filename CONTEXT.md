# Frameline

Frameline is an editor for interactive narrative works that speaks the grammar of
cinema rather than that of prose fiction or video games. Authors assemble shots
into scenes and connect scenes with exits; readers play the result at a public
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
The atomic unit of a Story — an Image and its text, shown to the Reader as a single
beat. Either may stand alone, but a Shot with neither is one the Author has not
written yet.
_Affiché_: Plan
_Avoid_: panel, slide, frame, beat, step, séquence

**Image**:
The one image a Shot carries. A Shot may be text alone, so an Image is what a Shot
has at most one of, never a thing of its own.
_Affiché_: Image
_Avoid_: picture, photo, frame, visual, asset, media, photogramme, still

**Description**:
What an Image shows, written by the Author for a Reader who cannot see it. An Image
may have none, and a Shot's text is never used as one: the text carries the beat,
the Description carries the frame.
_Affiché_: Description
_Avoid_: alt, alt text, label, caption, tooltip, legend

**Synopsis**:
The few lines an Author writes presenting their Story to whoever is deciding
whether to read it, carried by the Story wherever it is presented. Never a
Description: a Description says what one Image shows to a Reader who cannot see
it, and a Story has one Synopsis where it has as many Descriptions as Images.
_Affiché_: Synopsis
_Avoid_: description, blurb, summary, pitch, résumé, présentation

**Place**:
Where a Shot comes in its Scene's run, or an Exit in the ways on offered at the end
of the Scene it leaves — the Author's own numbering, counted from the first, with
nothing missing. Never used of a Reading, which has a Position instead.
_Affiché_: Rang
_Avoid_: index, order, rank, slot, sort key

**Exit**:
A directed connection from one Scene to another, offered to the Reader at the end
of a Scene as something to take. It is the Reader's way out of the Scene, named
for what they do with it rather than for anything the screen shows them.
_Affiché_: Sortie
_Avoid_: choice, option, link, branch, edge, transition, cut, coupe, raccord,
montage

**Graph**:
A whole Story seen at once, as its Scenes and the Exits between them. A Scene is
drawn in it as a node and an Exit as an edge — words for the drawing, never for the
Scene or the Exit itself. A node is drawn as a card, which is a word for that
drawing on the same terms: the Scene it stands for is never a card, and what a
Scene is written in is the panel at the edge of the bench — see
`docs/adr/0021-a-scene-is-written-in-a-panel-at-the-edge-of-the-bench.md`.
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
A flat test on State, carried by an Exit or by a Shot: it decides whether the Exit is
offered to this Reader, or whether the Shot plays for them. Either may carry
several, and is offered or played only where all of them hold; one carrying none
always is.
_Affiché_: Condition
_Avoid_: rule, guard, requirement, predicate, gate

**Sample**:
The short Story an Author is given when their account is created, written to be
taken apart rather than read: three Scenes carrying Flags, Conditions and Images
already working. It is not a specimen shown to them: it is their Story like any
other, to change, to publish and to delete, and there is one per Language, never
a translation of another.
_Affiché_: Exemple
_Avoid_: tutorial, template, demo, onboarding, leader, amorce, didacticiel

**Step**:
One step of what the bench asks of an Author writing their first Story: a test on
the Story open on the bench, an element it points at, and a sentence it says. Met
by the Author doing the thing, in whatever order they get there. Never a Flag,
which is a value a Reading carries rather than something the bench asks for.
_Affiché_: Étape
_Avoid_: hint, tip, tour, cue, onboarding, coach mark, repère, astuce

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
How far one Reading has got: the Exits it has taken, in order, and how many Shots
of the Scene it stands in are behind it. Everything else about a Reading — the
Scene, the Shot on screen, the Exits on offer, the State — is computed from it.
Where a Shot or an Exit comes in its own list is a Place, never a Position.
_Affiché_: Position
_Avoid_: cursor, pointer, progress, step, index

### The people

**Author**:
A signed-in person who writes Stories. The only actor who can change anything —
and the only one who can Comment on a Story or gather one into a List, since
those are signed and a Reader has no account to sign with. An Author standing in
front of another Author's Story is still an Author: there is one kind of account
here, not two.
_Affiché_: Auteur
_Avoid_: user, creator, owner, writer, director, member, community member

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
published is visible only to its Author. Publishing puts the Story nowhere
anybody browses — being found is a second act, see Listed.
_Affiché_: Publier
_Avoid_: release, share, deploy, ship, go live

### The community

The words in this section are ordinary words, deliberately. The grammar of cinema
names the work and everything inside it; what surrounds the work — accounts,
being found, being answered — is named in plain language, because a catalogue is
a catalogue and calling it a programme buys a metaphor at the cost of a reader
understanding the screen. See
`docs/adr/0022-the-metaphor-stops-at-the-edge-of-the-work.md`.

**Listed**:
Said of a published Story its Author has chosen to show in the Catalogue. A
published Story that is not Listed is readable by anyone holding its link and
found by nobody else, which is what publishing alone has always meant.
_Affiché_: Répertorié
_Avoid_: public, private, visible, indexed, featured, promoted, unlisted

**Catalogue**:
Every Listed Story, most recently published first, readable by anyone with or
without an account. The one place a Story is found rather than sent.
_Affiché_: Catalogue
_Avoid_: programme, feed, gallery, explore, discover, browse, library, showcase

**Name**:
What an Author is called wherever they appear to someone else — beside a Listed
Story, under a Comment, on their Profile. It arrives from the provider they
signed in with and is theirs to rewrite; nothing appears until it is set, and an
Author's email is never it.
_Affiché_: Nom
_Avoid_: pseudo, username, handle, display name, nickname, alias

**Profile**:
The page an Author's Name leads to: that Name, and the Stories they have Listed.
Never a place where what an Author has said about other people's Stories is
gathered up.
_Affiché_: Profil
_Avoid_: account, page, wall, bio, biography, dashboard

**Comment**:
What one Author writes to another about a published Story, carrying their Name.
It is said of the Story whole and never of one Scene or Shot, which would tell
somebody who has not read it how it is built.
_Affiché_: Commentaire
_Avoid_: review, feedback, note, rating, score, reaction, avis, retour

**List**:
Stories an Author has gathered together under a title of their own. A List is
theirs alone until they say otherwise.
_Affiché_: Liste
_Avoid_: collection, playlist, folder, shelf, watchlist, sélection

**Favourites**:
The one List every account has from the start, which no Author writes the title
of and none can delete. To favourite a Story is to put it in this List and
nothing else — there is no second mechanism.
_Affiché_: Favoris
_Avoid_: bookmark, saved, liked, wishlist, star, étoile, coup de cœur

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
