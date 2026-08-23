---
status: accepted
---

# The graph is written here, not pulled in

The bench draws its own graph. A Scene's node is an `<article>` translated to the
`x` and `y` the Author dragged it to, the Cuts are `<line>` elements in one SVG
under the nodes, the drag is a pointer capture on the node's
handle and the nudge is four arrow keys — about a hundred and fifty lines in
`app/pages/stories/[id]/index.vue`, with the geometry that puts a line on the
edge of a box in `shared/utils/scenes.ts`. Vue Flow is not installed, and neither
is any other graph library.

The v1 spec said otherwise: "Vue Flow provides the graph surface: a Scene is a
node, a Cut is an edge, a Cut's Condition travels in the edge's data. Vue Flow
renders on the client only and must be isolated accordingly. No custom canvas is
written." This record is the deviation, so that the next session does not read
the spec and put the library back.

## Considered Options

Vue Flow is the right library for the job it does, and the job it does is mostly
viewport: pan, zoom, a minimap, marquee selection, snapping, edge routing with
handles the Author drags between. What this product needs of a graph is the small
end of that — a box at a remembered point, a straight line between two boxes,
and a drag that writes the point back — and every one is a few lines here.
`cutLine` is thirty of them and has unit tests of its own, which is a cheaper
assurance than the one a dependency asks for.

What tipped it is what the library costs at the two places it meets this app.

The first is the isolation the spec itself named. Vue Flow measures the DOM, so
it renders in the browser only; under Nuxt's default SSR the whole graph goes
inside `<ClientOnly>`, and the Author's Scenes stop being in the HTML the server
sends. Either the fallback is a second rendering of the same Scenes — the graph
written twice, which is the thing the library was meant to save — or an Author
opening their own Story meets an empty bench until the JavaScript lands. The
hand-written graph server-renders whole, with the nodes at their real positions,
and the only thing that arrives late is the measurement that moves the Cut lines
from the assumed node height onto the real boxes.

The second is what a node holds. A Vue Flow node is a component handed a `data`
object inside a viewport the library transforms and listens to, so a node
containing a textarea, a file picker, a Conditions editor and eight buttons has
to opt out of the library's drag, wheel and selection handling control by
control. Here the node is ordinary markup and the drag is one handle that asked
for it — see
`docs/adr/0011-the-scene-editor-is-the-scenes-own-node.md`, which is the decision
that put the Scene editor inside the node in the first place. The two deviations
are one: the library's node is a box for a label, and this one is a room.

## Consequences

There is no zoom and no pan. The graph is a surface as large as the Scenes on
it, which the browser scrolls, bounded on both sides of the wire by
`GRAPH_REACH` so nothing can be dropped where nobody can scroll to it, and a new
Scene is placed by the server in columns of `NODES_PER_COLUMN` so a long Story
stays inside that reach — or, when a Cut is dropped on the empty bench, at the
point of the drop, snapped to the same twenty pixels an arrow key moves a node
by. There is no minimap, no marquee, no snapping beyond the twenty pixels an arrow key
moves a node by, and no edge routing: a Cut is a straight line from the edge of
one box to the edge of another and it crosses whatever sits between them.

Legibility at forty Scenes was bought with folding rather than with zoom — a
folded node is its name, its Shot count and where its ways on land, and
`docs/adr/0006-two-rooms-one-language.md` carries the drawing of it. That was the
cheaper half of the problem in #46, and the deliberate order: fold first, zoom
only if forty Scenes still cannot be seen at once.

The drawing stopped being decoration. It was `aria-hidden` on the grounds that
every Cut was listed inside the node it left, so the lines said nothing a screen
reader needed and read nothing out. Two things ended that. A Cut is now drawn by
dragging from one node to another, and a Cut's text and Conditions are written in
a panel opened by pressing its line — so a line is a thing to aim at, which needs
a wide invisible stroke behind each one, a 1.5-pixel target being nobody's idea
of one. The lines did not thereby become the keyboard route: that is the strip of
ways on inside the node, which is where a Place is read and changed too. A line
is a pointer's way to a Cut and a second place the selected one is shown, and the
accessible account of where a Scene leads stays in the markup, where it was.

Zoom is the ceiling this decision is reopened at, because it is the one thing the
hand-written graph cannot reasonably grow. A zoom is a viewport transform that
every other part has to agree with — the pointer maths of the drag, the arrow
key's twenty pixels, the coordinates the lines are drawn in, what "within reach"
means, and where the browser's scroll now is — and writing that agreement is
writing Vue Flow. So the day the Author needs to see the whole shape of a large
Story at once, the library comes back, `shared/utils/scenes.ts` goes away with
it, and the node's markup moves into a custom node component behind
`<ClientOnly>` with the server-rendered bench as its fallback.
