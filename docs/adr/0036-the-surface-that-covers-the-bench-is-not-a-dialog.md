---
status: accepted
---

# The surface that covers the bench is not a dialog

`docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md` made writing a Scene a
state the whole bench is in: the graph folds into a rail and the writing surface
takes the width that frees. Below 44rem there is no width to free — a phone is
narrower than one node — so the surface stops being a column of the bench and
covers it: `position: fixed; inset: 0`, the whole window, opaque.

That is the right drawing and it was the whole of what was written. The surface
went on being the `role="group"` it is at every other width, and took on none of
what a thing covering a screen owes: the header and the graph stayed in the
document and in the tab order, so a keyboard Author leaving *Close this panel*
walked into *Publish this Story*, the zoom dial and every card of a graph that
was not on the screen; the padding was `var(--s4)` on all four sides, with
nothing said about the hardware standing in the corners of a phone; and a swipe
past the last row of a Scene was handed on to the document underneath, which is
the bench nobody can see.

**The surface is given those three things at that width, and stays a group.** It
is made inert behind rather than modal in front. `app/pages/stories/[id]/index.vue`
holds the width as well as the writing, and hands `covered` to the two components
that draw what is behind: the header goes inert, and so do the row of controls
and the window onto the graph.

## Considered Options

**Opening it as a modal `<dialog>` at that width.** The obvious shape, and the
one `app/components/Commands.vue` already uses for the bar of Commands. The
browser then gives four things without a line written: the rest of the page goes
inert, Escape dismisses, focus moves in as it opens and back to the control that
opened it as it closes.

Counted honestly, only the first of those four is missing here. The page already
sends focus into the Scene's name as the surface appears and back onto the card's
own control as it closes, and it already answers Escape on the document. So the
dialog would buy one behaviour, and it would be bought with a state change: the
same component is a plain column at 1680px and a modal sheet at 375px, opened and
closed through `showModal()` and `close()` alongside an address that already says
whether a Scene is being written. Two facts saying the same thing is one of them
eventually being wrong.

And the top layer is not free. A modal dialog is drawn above everything, and the
guided path is drawn over the bench —
`docs/adr/0019-the-guided-path-is-anchored-to-the-template.md`. The Step's
spotlight and its bubble are a `z-index` on the page, and four of the eight Steps
point at a control inside the writing surface. Made a dialog, the surface would
come up over its own guidance: an Author would be asked for a Flag by a sentence
behind the sheet holding the Flags. `app/components/Step.vue` is explicit that
nothing may make the page inert, because the Author has to be able to type into
the very field being pointed at, and that constraint reaches the surface as much
as the bench.

The Escape handler is the other thing that had to be read again rather than
inherited. `letGoOnEscape` refuses to close the writing while
`document.querySelector('dialog:modal')` finds anything — recorded in
`docs/adr/0035-every-act-of-the-bench-is-reachable-by-naming-it.md` as the fact
being the browser's own. A panel that became a modal dialog would be found by
that query and would refuse to close itself. It could be worked around; that it
needs working around is the shape being wrong.

**`inert` on what the surface covers.** One attribute in three places, no new
focus behaviour, no state, and the layout untouched — the bench keeps its scroll
and its scale, and nothing reflows when the surface opens. It removes exactly
what was missing.

**Taking the bench out of the page with `display: none`,** which is how the
reading beside the Scene already disappears at this width
(`app/components/Preview.vue`). Cheaper still — pure CSS, no width read in
script, correct before hydration. Refused because of what it takes with it: the
bar of Commands reads the acts it offers off the controls the bench is drawing
(`[data-command]`), so a bench that is not drawn is a bar that no longer offers
*Go to The bar*, *Publish this Story* or *Fit the graph*. A control that is
merely inert is still in the page, and pressing one from the bar still works —
`element.click()` is not user interaction. Inertness takes the bench out of the
keyboard's way without taking it out of the bar's reach, which is
`0035`'s contract holding at the width where it matters most.

## Consequences

**A Step never lights what the Author cannot press.** `look()` reads a target
inside `[inert]` as absent, the same as one scrolled out of view, so the bubble
goes adrift and says its sentence from the corner. This was already wrong before
the attribute existed — the spotlight sits above the writing surface, so a Step
pointing at Publish on a phone drew a lit hole in the middle of the Scene being
written — and it is now settled by the attribute the bench marks that with,
rather than by the width, which is only one of the reasons a bench might mark it.

**The width is read twice, in CSS and in script, and the two must agree.** There
is no way to say `inert` from a stylesheet and no way to ask a stylesheet what it
decided. Both sides name 44rem, `app/components/Panel.vue` and the page each
point at the other, and this record is the third place that says so. The
end-to-end suite asserts the two facts in one breath — the surface is `fixed` and
nothing behind it takes focus — so a width moved on one side alone comes back red.

**The bench is focusable for as long as the page takes to hydrate.** There is no
width on the server, so the first render says the surface is beside the bench
even where it is over it, and the answer arrives on mounting. The window is a
page that is not yet answering to anything at all — Escape does not close the
writing either, and neither does the control that says so — so what is briefly
reachable is reachable in a page nobody can act on. Closing it would mean
guessing the width from the request, which is a worse thing to be wrong about
than a tick of tab order.

**Safe-area insets are a token rather than a value.** `--safe-top` and its three
neighbours live in `app/assets/css/frameline.css` beside the spacing scale, and
the surface adds them to its own padding. They are the same fact for every
full-bleed surface and the writing surface is only the first one: the reading
room is the next.

They are zero today, on every screen. `env(safe-area-inset-*)` answers zero until
a page asks for the whole window with `viewport-fit=cover`, and no page here does
— nothing sets a viewport meta at all, so the browser keeps the document inside
the safe area itself and the insets are the browser's to apply. What the token
buys is that the one surface that goes edge to edge is already right on the day
the product does ask for the whole window, and that the answer is written once
when it does.

**The bar of Commands cannot be opened by pointer while a Scene is written on a
phone.** Its control is in the row above the bench, which the surface covers —
that was true before this change and inertness does not alter it, since the
control was already under an opaque layer. `⌘K` still opens the bar, and a phone
has no `⌘K`. So on a phone the acts of the bench are reachable by closing the
writing and not by naming it, which is a hole in `0035` at one width. It is not
this record's to close.
