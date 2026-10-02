---
status: accepted
---

# A Shot is laid out as its Scene says

A Shot was always one frame in the reading column with its text under it,
whatever it carried and however it was framed. Two things follow from asking more
of it: how large a Shot is thrown, and where in the frame an Image is cut when the
frame is not the Image's own shape. The first is the **Layout**, the second is a
point on the Image.

**What a Shot carries decides whether it is a picture, a card or both, and no
setting says so.** A Shot with only an Image draws no text, so it loses the empty
band that was padding around nothing and the hairline that separated the Image
from it. A Shot with only text stops being a caption under an absent picture and
becomes a card: its words centred on the dark, at sixteen by nine under `inset`
and growing past it where the text needs the room. A setting for either would be a
second statement of what the Shot carries, able to disagree with it. A text that
is only white space draws no caption, exactly like an empty one.

Stories already written change on screen in those two ways, in a third for a Shot
with neither text nor Image, and in the Preview pane of the bench, which the
Consequences say. Every Scene is `inset`, every point is the centre, and every crop in the
product already sat at the centre, so no crop moves. A Story with no `full` Shot is
drawn at the widths it had.

**The Layout is the Cut's shape, column for column.** A Scene says how its run is
laid out, `scenes.layout` `text not null default 'inset'`; a Shot may say
otherwise, `shots.layout` nullable, and null is *as the Scene says*. `layout()` in
`shared/utils/reading.ts` is the one place the two are resolved, beside `cut()`.
There are two values and no third. The text laid over an Image inside the column is
`full`'s relation between the words and the picture at `inset`'s size, and the size
is the Reader's room, not something a Shot means; it also has nowhere to put a text
of 2000 characters. The text beside the Image on a wide screen would be two layouts
depending on the Reader's screen, which an Author cannot see from the bench. There
is no Story-wide Layout above the Scene's, for the reason the Cut has none.

**Under `full` the Reading is one room tall, so nothing a Reader presses is below
the fold.** The frame is as wide as the room the Reading is shown in and takes
every line the rows under it do not: *Next Shot* or the Exits, the drain, the
Transcripts and the trail. The text lies over the frame's foot on a scrim that is
never lighter than 70% `--room`, which is arithmetic, not taste: that is what
holds 4.5:1 for `--paper` over a white Image. A text too long for the room grows
the gate past it, and no word is cut off.

The rest was left to the prototype and settled against the demonstration work.

- The Reading is as wide as the room at every Layout, by one negative inline
  margin that undoes the padding both doors give it. Everything in it but the gate
  stays in the reading column, which is drawn on named grid lines,
  `minmax(auto, 46rem)`, so a word too long for a phone widens the column rather
  than being cut.
- The room is the container the Reading is drawn in, not the viewport. The bench's
  `.preview` is the size container, and is given `block-size: 100%` so that it can
  be one; on the Reader's page nothing is, and the frame's block units fall back to
  the small viewport height, which a phone's browser bar cannot reach under.
- A `full` frame drops the gate's border and curve, because its edges are the
  room's, and draws its focus ring inside itself over the Image (`isolation:
  isolate`, the picture at `z-index: -1`).
- A card is set larger under `full`, as an intertitle is.
- The beat leaving has its box read when the move starts, so a passage between
  Layouts keeps each frame its own size.
- A move of the hand onto a `full` beat focuses the frame without scrolling and
  scrolls the Reading to the top of its scroller, so the rows under the frame are in
  the window. A move of the clock does neither, for the reason
  `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md` keeps the
  Reader's focus where it is.

**The point is a value on the Image, not a null.** `crop_x` and `crop_y` are
`integer not null default 50`, whole percent from the Image's leading edge and its
top. Two nullable columns, null meaning the centre, can disagree: `crop_x` null
beside `crop_y` 30 is a point half said, which `docs/adr/0047-an-exit-says-whether-it-is-crossed-backwards.md`
and `0050` refuse in their own pairs. Each column is one axis and always holds a
number, so there is no pair to disagree. It is whole percent because it is what
`object-position` reads, and `cropPosition()` is how none of the places that crop
an Image writes the two numbers the other way round. It is not called `focus`, a
word that already means the keyboard's in this code
(`docs/adr/0014-the-glossary-is-the-codes-language.md`), and it takes no glossary
entry of its own, because it is one fact about one Image that is pressed and never
named.

**Wherever an Image is cropped, it is cropped around its point.** The frame of a
Shot laid out `full`, the Cover on a shelf and on the title card, the frames the
Cover is chosen among, a Shot's thumbnail in the writing and a print on the
Contact Sheet all read `cropPosition()`. The Cover is the Image a Story is
presented by, never an upload of its own
(`docs/adr/0040-a-story-is-presented-by-one-of-its-own-frames.md`), so it is cropped
around the same point as the Shot it is taken from, and a shelf's `cover` becomes
`{ image, cropX, cropY }`, one object, since a Cover that is null beside a point
that is not would be one more pair that can disagree. Percent lays the point of the
Image at the same fraction of the frame, so it stays in view however the frame cuts
it; it is not centred, which would need both shapes known at every width.

**The point is pressed on the Contact Sheet, beside the Description.** It is where
the Author is looking at the Image, which is why
`docs/adr/0043-a-story-is-written-as-one-document.md` put the Description there.
The print beside the bands is drawn whole, at the Image's own shape, so a press's
coordinates are the point in percent with no letterbox to subtract, and the point
is drawn on it as a ring in the grease pencil, because it is something the Author
wrote on the film. Two native ranges write the same two columns on `change` and
move the ring on `input`, since a press at a coordinate is a pointer's alone and
the keyboard and the screen reader are owed the same act. The sheet does not show
the Layout, because it draws every Shot as one box of one size and that is what the
holes in it are counted by. Replacing an Image keeps its point, as it keeps its
Description.

**No Remark watches either.** A Remark for a `full` Shot whose Image is smaller than
the frame would need two sizes the product holds neither of: the Image's, which
the server reads no further than its first bytes, and the frame's, which is the
Reader's window and not a fact of the Story.

## Considered and refused

**A third value, the text over the Image inside the column; the text beside the
Image on a wide screen.** Above.

***Framing* and *Cadrage* for the term.** Framing is what a camera does to one
image, and in this product *frame* is the apparatus and `.frame` the gate, so it
would read as a property of the gate. *Cadrage* is worse in French, where
*recadrer* is exactly what the point does.

**A setting for a Shot carrying only an Image or only text.** The Shot already says
which it is.

**The Exits laid over the frame under `full`.** The text is part of the beat and
dissolves with its Image; the Exits do not. One flow cannot hold both, and two at
one foot collide on a long text or on four ways on.

**A press anywhere on a `full` frame as *Next Shot*.** A Reader pressing the
picture to look at it would be carried on by accident.

**The point's columns nullable, as a fraction from 0 to 1, or reset when the Image
is replaced.** The first is a pair that can disagree, the second is multiplied by a
hundred in every place that crops, and the third throws away what the Author
pressed on a picture that shows itself at once in every print.

**Outlines of the crop at a phone's shape and a desktop's on the Contact Sheet.**
The shape of the screen is the Reader's, so any outline is one guess among many.

## Consequences

- The migration is additive: every column has a default or is nullable, which is
  what `docs/adr/0002-the-schema-moves-with-the-deploy.md` asks, and the defaults
  are what every Story already is.
- *Duplicate Scene* copies the Layout and the points, and *Split* gives the second
  half the first half's Layout so that the Shots that said nothing are laid out as
  they were.
- The Preview pane changes for every Story, not only for those with a `full`
  Shot. A size container needs a definite height, since it is not sized by what it
  holds, and `cqb` inside it is the room a `full` frame covers; so the pane is
  exactly one document tall and scrolls itself, where it used to grow with its
  Reading and leave the scrolling to the document. The Reading is centred in it,
  and the bench is at its foot.
- A Shot with neither text nor Image takes the `card` class, as a Shot with text
  and no Image does: it is drawn as an empty dark card, sixteen by nine under
  `inset` and the whole room under `full`, where it was an empty band.
- The Reader's door names `layout` among the fields a Scene leaves by.
- *Reel Change* lays the booth out `full` with a point on each Image and one beat of
  *The gate* answering `full` for itself; both Samples open on a Shot that answers
  `full` inside an `inset` Scene, and each carries an Image alone and a card.
