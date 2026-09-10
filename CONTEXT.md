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

**Cover**:
The one Image a Story is presented by wherever it is met before it is opened — the
Catalogue, a Profile, a List, the title card of the reading page — named by the
Author from among the Images its Shots already carry, never uploaded on its own.
A Story nobody named one for is presented by the first Image of its Opening
Scene, and a Story with no Image at all by its words alone. A plain word rather
than a cinematic one, because a cover is what this is — see
`docs/adr/0040-a-story-is-presented-by-one-of-its-own-frames.md`.
_Affiché_: Couverture
_Avoid_: poster, still, key art, thumbnail, hero image, affiche, vignette

**Place**:
Where a Shot comes in its Scene's run, or an Exit in the ways on offered at the end
of the Scene it leaves — the Author's own numbering, counted from the first, with
nothing missing.
_Affiché_: Rang
_Avoid_: index, order, rank, slot, sort key

**Exit**:
A directed connection from one Scene to another, offered to the Reader at the end
of a Scene as something to take. It is the Reader's way out of the Scene, named
for what they do with it rather than for anything the screen shows them.
The English interface shows the word itself — _Exits_ over the part of a Scene's
document that holds them, _the Exit 1 to …_ on every control of a row — and a
Step may gloss it as _the way on_ once, when it introduces the term; the gloss
is never a label.
_Affiché_: Sortie
_Avoid_: choice, option, link, branch, edge, transition, cut, coupe, raccord,
montage

**Graph**:
A whole Story seen at once, as its Scenes and the Exits between them. A Scene is
drawn in it as a node and an Exit as an edge — words for the drawing, never for the
Scene or the Exit itself. Where every node stands is read off the Story — how far the Scene is from the
Opening Scene in Exits taken, and in what order it is offered — and never placed
by hand: the Graph is a reading of the Story and moves when the Story does, a
band across the bench above the Scene being written — see
`docs/adr/0041-the-graph-is-drawn-from-the-story.md`. Nothing is written in the
drawing: an Exit is written in the document of the Scene it leaves, by naming the
Scene it leads to, and a press on a node puts that Scene on the bench — see
`docs/adr/0034-a-story-is-written-without-the-canvas.md`.
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

**Command**:
One thing the bench can be asked to do by naming it — go to a Scene, publish the
Story, delete the Scene being written — offered in a bar an Author types into
rather than found among the controls. Almost every Command is a control already
standing on the bench, marked in its own template with the name the bar shows it
under, and running it presses that control — so the bar offers nothing the bench
does not, and nothing it offers is reachable by the keyboard alone. Not every
act of the bench is one: the mark is on the controls whose act an Author would
say out loud — go to a Scene, add a Flag, mark the Opening Scene — and off the
marks that renumber a row, which are pressed beside the row they are done to,
and off the two acts whose control is a `<select>`, which no press can open.
The one Command with no control behind it is the offer to write a Scene under a
name that reached nothing, because an Author who has just typed the name of a Scene
that does not exist has said what they want. Named in plain language rather than out of
the grammar of cinema, because it is a tool of the bench and not a part of the
Story — see `docs/adr/0022-the-metaphor-stops-at-the-edge-of-the-work.md`.
_Affiché_: Commande
_Avoid_: palette, command palette, action, shortcut, quick open, spotlight,
raccourci, action rapide, recherche

**Remark**:
One thing the bench has noticed about the Story open on it — a Scene no Exit
arrives at, a Flag set and never tested, a Condition that can never hold — as a
sentence and the Scene it is said of. Read off the Story like a Step, and
advisory like nothing else in the product: it never refuses a write and never
says a Story is wrong, because every one of them is a Story an Author may be in
the middle of. Never a Step, which asks for something the Author has not done
yet; a Remark reports something they have.
_Affiché_: Remarque
_Avoid_: error, warning, issue, problem, lint, validation, avertissement, alerte

### The reading

**State**:
Everything a Story has accumulated during one Reading — a flat map of Flags, plus
a visit count per Scene. Never shared between Readings.
_Affiché_: État
_Avoid_: variables, memory, save, progress, context, session data

**Flag**:
A single named value in State, set by the Author and tested by Conditions. A
Scene carries the Flags it sets, and sets them on every entry. A Scene may name
several values for one Flag, and one of them is drawn on each entry — what holds
a list is the Scene, never the State, where a Flag is the one value drawn.
_Affiché_: Marqueur
_Avoid_: variable, switch, toggle, key, drapeau

**Reading**:
One traversal of a published Story by one Reader, carrying its own State. Kept in
the Reader's browser between visits and nowhere else, so a Reader who leaves comes
back to where they stood — see
`docs/adr/0038-a-reading-is-kept-in-the-readers-browser.md`.
_Affiché_: Lecture
_Avoid_: session, playthrough, run, visit

**Path**:
How far one Reading has got: the Exits it has taken, in order, how many Shots
of the Scene it stands in are behind it, and the seed every draw a Scene makes
comes out of. Everything else about a Reading — the Scene, the Shot on screen,
the Exits on offer, the State — is computed from it. Both the route taken and the
taking of it, which is why it is not a point: where a Shot or an Exit comes in its
own list is a Place.
_Affiché_: Parcours
_Avoid_: position, cursor, pointer, progress, step, index

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
An Author reading their own Story on the same engine a Reader runs — a pane
inside the editor, beside the Scene being written, which replays the Path the
Author is on with the State it has accumulated and stops on that Scene. Beside
the Scene where the bench can hold both, and in the Scene's own place where it
cannot — see
`docs/adr/0037-the-reading-folds-before-the-writing-does.md`. Not a
Publish: nobody else can reach it. It is the one screen where the order the ways
on are offered in is set, on the choice buttons as they are read, so a Preview is
no longer without consequence for the Story — see
`docs/adr/0030-a-story-is-read-where-it-is-written.md`.
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
