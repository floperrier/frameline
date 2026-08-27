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

There is a zoom and a pan, and they are written here too — see the last section,
which is the reopening condition met and declined. The graph is a surface as
large as the Scenes on it, drawn at a scale from a quarter to its own size inside
a box the browser scrolls, bounded on both sides of the wire by
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

Folding is since gone, and the reopening condition of the sibling record with it.
`docs/adr/0011-the-scene-editor-is-the-scenes-own-node.md` said the two decisions
were taken together and would come apart together; only one of them has. A Scene
is written in a panel at the edge of the bench and a node is a fixed-height card
— see
`docs/adr/0021-a-scene-is-written-in-a-panel-at-the-edge-of-the-bench.md` —
so legibility at forty Scenes is now bought with every node being one size, still
not with zoom. This record stands: the graph is still written here, the node is
still ordinary markup, and what came out of the node was the editor rather than
the drawing. What it loses is the measurement named above — every card is
`NODE_WIDTH` by `NODE_HEIGHT`, so the boxes a line joins are known from the Story
and nothing arrives late at all.

The drawing stopped being decoration. It was `aria-hidden` on the grounds that
every Cut was listed inside the node it left, so the lines said nothing a screen
reader needed and read nothing out. Two things ended that. A Cut is now drawn by
dragging from one node to another, and a Cut's text and Conditions are written in
a panel opened by pressing its line — so a line is a thing to aim at, which needs
a wide invisible stroke behind each one, a 1.5-pixel target being nobody's idea
of one. The lines did not thereby become the keyboard route: that is the strip of
ways on inside the node, which is where a Place is read and changed too. A line
is a pointer's way to a Cut and a second place the selected one is shown, and the
accessible account of where a Scene leads stays in the markup, where it was. So
the drawing is `aria-hidden` still, the wide strokes and the numbered discs with
it: what a line carries is a shortcut for the hand, and reading out forty
unfocusable lines and the numbers on their discs would be reading out a drawing
rather than a Story.

Zoom was the ceiling this decision was to be reopened at, because it was the one
thing the hand-written graph was thought unable to grow. A zoom is a viewport
transform that every other part has to agree with — the pointer maths of the
drag, the arrow key's twenty pixels, the coordinates the lines are drawn in, what
"within reach" means, and where the browser's scroll now is — and writing that
agreement was taken to be writing Vue Flow. So the day the Author needed to see
the whole shape of a large Story at once, the library would come back,
`shared/utils/scenes.ts` would go away with it, and the node's markup would move
into a custom node component behind `<ClientOnly>` with the server-rendered bench
as its fallback.

That day arrived, the library was looked at again, and it was declined. The
agreement the paragraph above dreads turned out to be one number and one
function. The scale is `scale()` on the surface with its origin in the surface's
own corner, so a Scene's coordinates, `cutLine`, `discOfCut`, `withinReach`, the
`NODE_PITCH` snap and every line already drawn are untouched by it — the graph is
drawn in surface pixels at every scale, as it always was. What had to agree is
what reads screen pixels, and there are three: the drag that lays a Scene out,
the Cut drawn by hand, and the push that pans. All three go through
`onTheSurface`, which takes the surface's own rectangle off a client point and
undoes the scale, and it is a pure function with a spec of its own beside
`cutLine`. The scroll extent is the surface's size multiplied by the scale, on a
box around it, because a transform moves nothing in the layout. The whole of it
is about a hundred lines and two exported functions.

Against that, the library still costs what it cost: the graph inside
`<ClientOnly>` and the Author's Scenes out of the server's HTML, a node that is a
box for a label rather than ordinary markup, and every gesture on a card opting
out of the library's own. Everything Vue Flow would bring here is this transform
and this division, and taking it would take back the markup that makes a node a
card. So the record stands with its ceiling raised: the graph is written here,
zoom and all. What would reopen it now is a want the transform cannot answer — a
minimap, marquee selection, edge routing that goes round the nodes rather than
across them — and not the viewport, which has arrived.

The `prefers-reduced-motion` half of it is small and belongs here: a step of the
zoom travels the distance so that what moved can be seen to have moved, and an
Author who has asked for no motion simply gets the new scale. The wheel is not
eased either way, because it is continuous already.

What the hundred lines do not save is the browsers disagreeing. Three of them
came out of the first day of use, and they are the cost this decision really
carries — the library would have had them solved.

A pinch is not one event. Chromium reports it as a wheel with Ctrl held, so the
gesture and the modifier are one handler; WebKit sends `gesturestart` and
`gesturechange` of its own and zooms the whole page itself, so Safari had no pinch
on the bench at all until those were taken too. `scale` there is the whole
gesture rather than a step, which is why the gesture holds the scale it began
from.

A wheel is not one hand. A trackpad sends scores of events a few pixels each and
a mouse sends one of a hundred, so the ratio that makes a pinch smooth takes a
single notch from the surface's own size to two thirds of it. The delta is capped
per event: a notch is a step, and no event of a pinch ever reaches the cap.

A key is not a character. `⌘0` on a French layout arrives as `à`, because the
digit row carries letters until it is shifted, so the shortcuts are read off
`event.code` — where the key sits, which every layout agrees on — as well as off
`event.key`. The numeric keypad comes along with it.

And the frame is a frame: `contain: inline-size` on the window onto the graph, so
that no engine's reading of an automatic minimum size can hand it the width of a
surface an Author has dragged ten thousand pixels wide. What scrolls or is pushed
about is the graph inside it.

The zoom's own controls are not on that surface either, and the reason is the
surface is worked at rather than looked at. A control floating in a corner of the
graph is a control something on the graph ends up under: the button that writes a
Scene did, on a bench scrolled so that its card came up beneath the corner, and
the press meant for the Scene was taken by the zoom for as long as anyone kept
trying. So the controls live in the row above the bench, in the flow of the page,
where they are always on screen, the same size at every scale, and over nothing.
A bench is `min(70dvh, 44rem)` tall, which is why the foot of it is no place for
them either.

What they are is an instrument rather than a pair of arrows: a graduation from a
quarter to the whole, notched at the four scales the two buttons step between, so
an Author sees which step they are on and can put the thumb on another. It is an
`<input type="range">`, which is where the drag, the arrow keys and the announced
value come from without any of them being written. Under it, engraved in the data
face, is what the hand can do that no control shows — the three shortcuts, in the
name this platform gives the key, and the push that moves the view. A gesture
nobody is told about is a gesture nobody uses.
