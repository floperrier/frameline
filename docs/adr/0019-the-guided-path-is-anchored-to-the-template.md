---
status: accepted
---

# The guided path is anchored to the editor's own template

Amended in issue #257, by
`docs/adr/0043-a-story-is-written-as-one-document.md`: the panel that held one
Scene by construction is gone, so the per-Scene scoping this record dropped comes
back, carried by the template rather than by a selector. What that replaces is the
two paragraphs beginning *A target the editor draws once per node*, marked where
they stand, and the two bold ones at the foot of the Consequences are what
replaces them — along with the other thing the amendment settles, which is what a
Step points at while the row its sentence names is still unwritten. Everything
else here stands, and two paragraphs are widened rather than changed: the one on
what is modal, because the bubble takes no pointer event any more than the light
does, and the one on a target taken off the screen, because a target the document
scrolled past is one of those.

Read *Repère* as *Step* and `data-cue` as `data-step` in everything below: both
were renamed with the vocabulary and neither survives anywhere in the code. The
body is left in the words the decision was taken in, which is what a record is
for.

A Repère points at a real element of `app/pages/stories/[id]/index.vue`, found by
a `data-cue` attribute written on that element. The guidance holds the name of
the attribute and nothing else: no CSS selector, no class, no id, and no
description in words of where on the bench the Author should look.

This is a coupling deliberately taken on, between a list of steps and a
two-thousand-line template, and it is the reason to write it down.

**A Repère that describes its target cannot be checked.** The alternative
considered at length was a decoupled rail: each step carrying a sentence and a
phrase naming its target — "the field a new Scene is named in" — with the bubble
placed by hand near where that is. It couples nothing, and it is wrong the first
time somebody moves the field, because nothing anywhere fails. Pointing at a real
element makes the coupling visible: `tests/unit/steps.spec.ts` reads the template
as source and holds the `data-step` attributes in it against the targets the Steps
declare, so a target renamed on one side and forgotten on the other fails the
suite rather than an Author.

**The attribute puts the coupling where it lives.** A selector held in the
guidance — `.naming input`, `#new-scene-name` — rots silently when a class is
renamed for reasons that have nothing to do with the guidance, and the template
gives no sign that anything depended on it. An attribute on the element is read
by whoever is editing that element, and deleting the element takes its target
with it in the same diff.

**Getting the target on screen is itself a step.** No Repère points at something
a previous Repère has not made visible, which is why opening a node is a step of
its own rather than something the guidance does. What is folded and where the
graph sits is how the Author sees their own work: the guidance never unfolds a
node, pans the graph or opens a panel on the Author's behalf.

## Considered Options

**A rail naming its targets in words.** Above: uncheckable, and silently wrong.

**`Teleport` and a component per step, living beside the control it points at.**
The guidance would be scattered through the template rather than readable as a
path, and the order of the steps — which is the whole design of the thing —
would have to be read out of nine separate places.

**Native CSS anchor positioning.** `anchor-name` on the target and
`position-anchor` on the bubble is exactly this coupling expressed in the
stylesheet, and would have cost no JavaScript at all. Rejected on browser
support: it is not yet in every engine the product is read in, and the fallback
is the hand-positioned bubble anyway, so it would be two placements to maintain
instead of one.

## Consequences

The bubble is positioned from the target's client rectangle, read every frame
for as long as a Repère is showing. A frame at a time rather than a list of the
things that move a target: the graph scrolls, a node folds, the window resizes, a
refusal appears above the bench and pushes everything down — and a light that
lags any one of those is a defect an Author sees at once. Nothing is written
unless the rectangle changed, and the loop stops the moment the step is met.

A target the editor draws once per node — the fold, the strip a Cut is drawn
from, the field a Scene's Flags are typed in — is found on the first node of the
graph, which is the first Scene the Author wrote and where most of the path is
walked. A Repère that asks about a particular Scene says which, and is scoped to
that node by the id the node already carries: this is the one selector the
guidance builds, and it is built out of two things the template says about
itself rather than out of a class. One naming a Scene the Story has not got yet
points at nothing, which is the same degradation as a folded node.

That scoping is since gone. A Scene is written in a panel at the edge of the
bench rather than inside its node — see
`docs/adr/0021-a-scene-is-written-in-a-panel-at-the-edge-of-the-bench.md` — so
every target inside a Scene is drawn once, in a panel that holds one Scene by
construction, and the only targets drawn per node are the ones on the card
itself. There is nothing left to say "which Scene", so the guidance names a
`data-cue` and nothing else.

Both of those paragraphs are since gone, and the amendment at the head of this
record is what stands in their place: the panel went with
`docs/adr/0043-a-story-is-written-as-one-document.md`, and the scoping it had
taken away came back carried by the mark rather than by an id — **Scoped to a
Scene again** at the foot of the Consequences.

What it asks about outside the Story is since gone too. Every gesture that makes
a Scene opens that Scene for writing, so no step is spent asking for the writing
surface to be opened, and the one step that did — the Write button on the card —
was dropped along with the button's anchor. A Step is now a predicate over the
Story and nothing else: the Story is the whole of the state the guidance reads,
which is what `docs/adr/0020-progress-is-the-story.md` says it should be.

A target can be taken off the screen at any moment — the middle of the bench
turned over to the reading takes the document and every mark in it, and a document
of forty Scenes scrolls its own marks out of the window under an Author's hand —
so the bubble degrades rather than pointing at nothing: with no rectangle to work
from it becomes a fixed panel carrying the same sentence. A rectangle that is
nowhere on the window is read as no rectangle at all, which is the case that
degrades. Room is a separate question and is answered separately, because the
light and the sentence can be parted: the sentence is placed from the target's
bottom edge where it fits under it and from its top edge where it does not, and
where it fits on neither side it goes to the corner while the light stays on the
target. What the guidance must never do is follow its target off the screen and
say nothing anywhere.

Nothing about the guidance is modal. The Author has to type into the very field
being pointed at, so the page is never made inert, and neither the spotlight nor
the bubble takes a pointer event — everything under them is still worked at
normally, and the bubble's own control takes the pointer back so the sentence can
still be waved away by hand. It is not enough that the light takes none: the
bubble stands over the document wherever it is placed, beside the control it points
at or in the corner where the document ends, and on a bench that is a Scene's own
last controls.

What that costs is the sentence: words a panel does not answer a pointer on are
words nobody can select with a mouse, and two Steps name a Flag and the value to
give it. Weighed against it in #257, driven: at 1280 by 720 the panel stands on
three controls of the Scene being written, so a sentence that answered a pointer
would cost three presses that silently do nothing. Retyping *courage = high* is
the cheaper of the two, and the trade is here so that it is reversed knowingly if
it is ever reversed.

**Scoped to a Scene again, and the template says which Scene.** The document holds
every Scene of the Story at once, so the five Steps that point into it have a
field per Scene to choose between — forty of them on a Story of forty Scenes, and
`document.querySelector` takes the first. What resolves it is the mark and not the
selector: a target inside the document is written on the Scene the caret is in and
on no other — `app/components/Writing.vue` writes `data-step` under `held.here`,
the same condition the bar of Commands reads its names under — so one element
carries it however long the Story is, and the guidance holds a `data-step` and
nothing else exactly as this record asks. The Scene a Step is *lit* on is
therefore the Scene the Author is standing in, which is what most of the sentences
say — *this Scene* — and getting to another is the rail, the address or the bar,
which is the rule below about bringing a target on screen rather than a gap in
this one.

Which Scene a Step *reads* is not the mark's to say, and for one of the eight it is
not the Scene the caret is in. A Step is met by a predicate over the Story, and the
Condition Step's reads the second Scene in the order the API returns it — measured
as *Scene 26* on a chain of forty whose caret stood in *Scene 01* — so an Author
who writes the Condition where the light is has not met it. That disagreement is
older than this amendment and is issue #278; it is written here rather than left
for the next reader to find, because the paragraph above is exactly where somebody
would look for it.

**A Step names the control that writes the row it is about, as well as the row.**
A Scene arrives with no Shot in it, deliberately, so the Step that asks for a Shot
and the one that asks for a Condition on one both named a field the Scene had not
got: no rectangle, and a bubble adrift in the corner over the very control the
sentence asked to be pressed. So a Step carries its targets in the order they are
tried — the row, then the control that writes it — and the template draws exactly
one of the two. It is the same anchoring twice rather than a second mechanism, and
the spec that reads the template as source holds both names.

Adding a step means adding an attribute to the template and a target to the list,
and the spec fails until both are there. Removing a control the guidance points
at means removing its Repère, and the spec says so.
