---
status: accepted
---

# The guided path is anchored to the editor's own template

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
element makes the coupling visible: `tests/unit/cues.spec.ts` reads the template
as source and holds the `data-cue` attributes in it against the targets the Cues
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

The Author may fold a node or scroll a target off the bench at any moment, so the
bubble degrades rather than pointing at nothing: with no rectangle to work from
it becomes a fixed panel carrying the same sentence.

Nothing about the guidance is modal. The Author has to type into the very field
being pointed at, so the page is never made inert, and the spotlight takes no
pointer events — everything under the dimming is still worked at normally.

Adding a step means adding an attribute to the template and a target to the list,
and the spec fails until both are there. Removing a control the guidance points
at means removing its Repère, and the spec says so.
