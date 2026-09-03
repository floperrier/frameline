---
status: accepted
---

# The reading folds before the writing does

The bench holds three columns while a Scene is being written: the graph folded
into a rail, the Scene's document, the reading of the Story beside it — see
`docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md` and
`docs/adr/0030-a-story-is-read-where-it-is-written.md`. Below the width three of
them need, the reading folds away and comes back by a control in the row above
the bench, in the column the Scene was in. The Scene keeps a column wide enough
to write in from there all the way down to the phone, where the writing surface
becomes the page as it already did.

The width is read off the writing column and not chosen. Two rows measure it.
The first is a beat's: the marks it is moved and deleted by drop off the line
they share with the control that puts a Condition on it, so the same row is read
one way at one width and another at another. The second is the Flags row: it
breaks after a dangling *or* and drops a value onto the next line. Swept in
eight-pixel steps, the beat's row is what binds — the Flags row holds two values
on one line to well under four hundred pixels of column, so it is satisfied with
many steps to spare wherever the beat's row is — and French binds over English,
being the longer of the two languages the interface is read in.

**What is measured is rendered text, and rendered text is not the same width on
every platform.** The same sweep, the same fonts, the same browser: the beat's
row holds one line down to a column of four hundred and seventy-six pixels on a
Mac and four hundred and ninety-two on the Linux the end-to-end suite runs on.
The first number was taken alone and put the fold at seventy-four rem, where CI
promptly wrapped the row it was chosen to keep flat — and passed on the next run,
because the measurement was also racing the moment the interface's own face
replaced the fallback. So the number carries a margin over the widest reading
rather than sitting on the narrowest: **seventy-eight rem**, whose narrowest
three-column writing column is five hundred and twelve pixels, twenty clear of
Linux and thirty-six clear of a Mac. A threshold with no margin is a threshold
that is only true where it was taken.

The band the fold covers therefore runs from the phone's forty-four rem to
seventy-eight, and each number is written once, in `app/assets/css/folds.css`;
the band composes the two names rather than restating either. The two rows are
held at both edges of the band by an end-to-end test, in French, and that test
waits for the faces before it measures anything: at seventy-eight rem the bench
must be folded, and one pixel above it the Preview must stand beside a Scene
whose two rows each read across one line.

The bench also stops being a fraction of the window and becomes what the window
leaves it: the page is a column exactly one viewport tall, and the bench is the
one thing on it that grows.

## Considered Options

**Leaving it.** What existed: three columns from the phone's breakpoint upward,
whatever the arithmetic came to. Between seven hundred and a thousand pixels —
an iPad in portrait, a Chromebook, a window at half a desktop screen — each of
the three was under two hundred and fifty pixels wide. A Shot's field held
sixteen characters, the Flags row broke after a dangling *or*, and `Delete Scene`
wrapped onto two lines. The layout was worst exactly where it was neither of the
two states it was designed for, and the phone — one column, and nothing to share
it with — was the best-behaved of the three widths.

**Folding the rail instead.** Cheaper, and it takes a hundred and sixty pixels
back rather than the reading's whole column, so it does not buy enough on its
own. It also gives up the thing `0029` folded the graph to keep: an Author
recognises their own Story by its shape, and the rail is what says where the
Scene being written sits in it. The fold has to be of the column that can be
asked for again in a breath, and the rail is not it — unfolding it changes what
the bench is doing.

**Letting the reading wrap under the writing** rather than fold away, so all
three are reachable without a control. It reads well until it is measured: the
reading is as tall as the bench by design and scrolls inside itself, so wrapped
it makes the page twice as long as the window and the Author scrolls the page to
see what they typed reach the reading. The pane's whole claim is that a line is
judged between two keystrokes, and a page-scroll away is not between two
keystrokes.

**Making the three columns fit by shrinking what is in them** — a narrower rail,
a shorter measure for the reading, marks instead of the Conditions control. Each
one buys tens of pixels off a column that is short by hundreds, and every one of
them makes the wide screen worse to pay for the narrow one. The reading is
already at thirty-four rem, which is a measure and not a spare margin.

**A container query on the bench instead of a media query on the window.** The
honest question is how wide the bench is, not how wide the window is, and
`container-type: inline-size` would ask it directly. It cannot be used here:
that declaration also makes the bench a containing block for fixed positioning,
and the writing surface is fixed to the viewport on a phone. The window is the
same question asked one step further out, and the page's own padding is a
constant.

**Reading the width off a media query in JavaScript**, so the control could be
absent from the document rather than hidden in it. Then the server renders a
bench it cannot know the width of, and every hard load of a Scene on an iPad
draws three columns for a frame before hydration folds one away. The fold is a
fact about the width, which is CSS's own question; what JavaScript holds is only
which of the two the Author last asked for.

## Consequences

**A media query's condition is shared through `@custom-media`.** It is the one
thing plain CSS gives no way to name: a custom property cannot be read inside a
media query, so a width used by four surfaces was written out four times, and
that is how two of them drift. The two widths the interface folds at are declared
in `app/assets/css/folds.css` and imported by name into each scoped block that
needs one — the file compiles to nothing, so a surface importing it carries no
rule it did not write. `postcss-custom-media` is what resolves them, named in
`nuxt.config.ts`. The landing page's own sixty rem stays where it is used,
because nothing else reads it.

**The bench takes the height that is there.** `--bench-height` is gone.
`min(70dvh, 44rem)` left a hundred and twenty-seven pixels of page empty under
the bench on a tall window while the document scrolled inside it, and ran past a
short one so the page scrolled to make room for a bench that was showing less
than it could. The page is now exactly one viewport tall, the bench grows into
what the rows above it leave, and every column of it is that tall because they
stretch. Nothing on this page scrolls but the columns themselves.

**The bench is never shorter than thirty rem.** A bench that shrank with the
window without a floor becomes a slot: below about that, a graph pulled all the
way back no longer shows a Story spread across the surface, because the scale
stops at a quarter. A window too short to leave that much is the one case this
page still scrolls, which is what it did at every height before.

**A bench dragged taller is gone.** The window onto the graph carried
`resize: vertical`, and the panel beside it never followed — the `ponytail:` note
in `Graph.vue` recorded exactly that. Reaching the page's foot by itself is what
that drag was for, and a drag that only half worked is not worth a height model
that cannot be resolved without it: a column whose height comes from its content
cannot also be the thing that decides how much content there is room for.

**The bar of Commands offers what the bench is drawing, and no longer what it
merely marked.** It reads the controls carrying `data-command` off the page, and
a fold takes a column away by hiding it, so the acts inside that column go with
it. The bar now asks the browser whether each control is drawn rather than
working it out from a width — see
`docs/adr/0035-every-act-of-the-bench-is-reachable-by-naming-it.md`, whose claim
is that the bar offers nothing the bench does not. Visually hidden controls,
which are on screen for a hand on the keyboard, still count as drawn.

**Writing begins on the Scene, and leaving it goes through the Scene.** Which of
the two is showing is let go of when the writing closes, so a Scene opened for
writing opens on the Scene whatever was last asked for — the focus the bench
sends into the Scene's name has to land on something that is drawn. And the way
out of the writing is a control on the surface being written, so leaving it while
the reading is up is two presses: back to the Scene, then close it. `Escape`
still closes the writing from anywhere, as it did.

**The control says what pressing it does, and its name changes with what that
is.** There is no `aria-pressed` and no `aria-expanded`: a button whose
accessible name is already the act — *Read the Story*, then *Write the Scene* —
would be announcing the same fact twice, and the second announcement is the one
that can contradict the screen. It is the pattern every other control on the
bench follows, which is that a control is named by what it does.

**The word `Reading` is left to the glossary.** The pane is a **Preview**, so
what the bench holds is `previewing` and the holders are marked
`data-holds="preview"` and `data-holds="document"`. A **Reading** is one
traversal of a published Story by one Reader, and
`docs/adr/0014-the-glossary-is-the-codes-language.md` makes that binding on
identifiers. The prose of `0030` and of this record goes on calling the pane a
reading of the Story, which is the ordinary verb and not the glossary's noun, and
the slot the page fills keeps the name it had.

**The fold is not offered on a phone.** There the writing surface is the page and
covers the row the control stands in, so there is no column to give the reading
and nothing to press. `0029` already said the narrow screen is made coherent
rather than comfortable, and the reading stays where that record left it.

**A column of the bench is the containing block for what is inside it.** Both
columns scroll their own content, and an absolutely positioned box whose
containing block lies outside a scroller is not clipped by it — a visually hidden
label deep in a long Scene was extending the document by a few pixels and the
page grew a scrollbar for text a millimetre wide.

The condition this record would fall on is a writing column that stops being the
narrowest thing on the bench. The threshold is a measurement of one row of the
document, so a document laid out differently is a different number, and the place
to take it again is the beat's row in the longer language — on more than one
platform, and with the margin kept.
