---
status: accepted
---

# Two rooms, one language

The interface is dark throughout, and its whole visual language lives in
`app/assets/css/frameline.css`: a set of custom properties for colour, type and
spacing, and defaults for the elements every page already uses. Pages add only
what is theirs — the graph's bench, the Reading's frame — in a scoped block.
There is no component library, no utility framework, and no light theme.

## Considered Options

A component library was the obvious answer, and it is the one the acceptance
criteria of the issue rule out: the work exists in part to show front-end
competence, and an untouched library demonstrates the opposite. Nuxt UI or
shadcn-style components would also have decided the typography and the palette
for us, which is exactly the decision worth making here.

The direction comes from the two places this product is actually used, and they
are not the same room. An Author works at a bench: a machine, dense, everything
labelled, the graph ruled like a cutting table. A Reader sits in front of a
projection: the room goes dark, one frame at a time is thrown onto it, and
nothing else is on screen. Both are dark, because moving images have never been
graded on cream paper, and the difference between them is density rather than
hue.

Two accents carry the whole of the colour, and they never trade jobs. The cyan
is the machine's own light, so it marks what the interface does: focus rings,
links, the one action a surface is for. The orange is a grease pencil, so it
marks only what the Author wrote on the film: the Cuts drawn across the graph,
the Opening Scene, the public link a Publish handed out. An Author can therefore
read a screen by colour alone — cyan is the tool, orange is their own hand.

Four faces, each with one job. Titles are set in a condensed grotesque, because
that is what a title card and a closing crawl have always been set in. The
interface and its labels are one superfamily, so a stencilled micro-label
belongs to the control beside it. A Shot's text — the only prose in the product —
gets a serif of its own, and nothing else on any screen is set in it: seeing that
face means reading a Story. Everything that is data, from a Shot's number to a
Condition's two sides, is mono. The faces are downloaded and self-hosted at build
time by `@nuxt/fonts`, which needs
`experimental.processCSSVariables` because every face here is reached through a
custom property.

`CONTEXT.md` puts "frame" on the list of words to avoid for a Shot, and it stays
there: nothing user-visible, and no name for a Shot, calls it a frame. What the
design calls the frame is the apparatus — the gate a Shot is thrown onto, shared
by the Reading and by the specimen on the signed-out page — and a Shot's own
number in the editor is `.shot-number`. The rule is that "frame" may name the
surface and never the thing shown on it.

## Consequences

The design is a stylesheet and a handful of scoped blocks, so there is no
component API to keep and nothing to upgrade. It also means there is no
enforcement: a new page can quietly invent a seventh grey. The tokens are the
only guard, and a colour written as a hex value outside
`app/assets/css/frameline.css` is the smell to look for in review.

`color-scheme: dark` is declared once and there is no light theme. Form controls
and scrollbars come out of that dark for nothing, and a light theme would be a
second design rather than an inversion of this one, because the Reading room is
dark on purpose.

An open Scene's node was drawn 420 pixels tall, which showed a Shot with its
still and the Flags the Scene sets and left the Cuts a scroll away: a Scene with
one Shot, one Cut and a Condition on it measures about 730 pixels, and one with
several Shots scrolled sooner. That ceiling is gone. An open node takes the
height of what is in it, capped at the height of the bench, and what paid for
that was removing a block rather than finding more room — a Cut's own writing
left the node for a panel on its line, so an open node holds three things: the
Shots, the Flags the Scene sets, and a bare strip of the ways on. The 420 was
the compromise of a world where every node was the same size, and the paragraph
below had already abandoned that rule; this is the same reversal finished.

The node's width stays at what a phone can show — a node wider than the screen is
a graph nobody can lay out on one — and it now gives twenty of those pixels to a
strip down its leading edge. That strip is the surface a Cut is dragged from, and
it is where the mark naming the Opening Scene moved to. It sits outside the part
of the node that scrolls, which is what lets a finger start a gesture on it
without the node losing its scroll, and twenty is the pitch the bench is pricked
out at rather than a new number.

Every node being the same size was held here to be what makes the graph readable
as a graph, and forty Scenes said otherwise: forty nodes of the same 420 pixels
is forty open editors to scroll through, and the shape of the work cannot be seen
at all. So a node folds — its name, its Shot count and where its ways on land —
and what a node is the same size as is every other folded node. The Author opens
one when they mean to write in it. What is folded is the Author's view of their
own graph and is written nowhere, which is why this is a note about the drawing
and not a decision about the Story. That rule survives an open node being as
tall as its writing: uniformity is a property of the folded nodes, and an open
one is the Author saying which Scene they are working in.

_A second file sits beside the stylesheet, and holds no rules: the widths the
interface folds at are declared as custom media queries in
`app/assets/css/folds.css`, because a media query's condition is the one thing a
custom property cannot carry — see
`docs/adr/0037-the-reading-folds-before-the-writing-does.md`. It compiles to
nothing, and the rules a fold turns on stay in the scoped block of the surface
that folds. "The tokens are the whole vocabulary" stands; this is the one part of
the vocabulary CSS will not let a token hold._
