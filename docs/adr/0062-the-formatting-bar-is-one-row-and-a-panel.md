---
status: accepted
---

# The formatting bar is one row and a panel

`0056` drew every control of a Shot's text in the toolbar over its row, and let
the toolbar wrap onto further rows at every width rather than hide one. That made
twenty-one controls: seven style toggles, *Redact the Selection*, *Add a
Separator*, the two acts of an Effect, and ten selects. At 1440 wide it came to
three rows, about 100 px, drawn over the foot of the beat above, which is the beat
an Author writes on from. The selects were named only by `aria-label`, so a
sighted Author saw each as its current value: the bar read *Normal · As the Story
i… · None · None · Normal · The Story's L… · A paragraph · As the Story i… ·
Normal · As the Layou…*, two *None*s and three *Normal*s with nothing to tell the
colour from the highlight. Everything was reachable, and little of it could be
read.

**The bar is one row of what a writer reaches for while typing.** *Italic*,
*Bold*, *Underline* and *Strikethrough*, glyphs carrying their keys as before;
*This line is*, the one select left in the row, because a line's kind is the
formatting `CONTEXT.md` names first and its options name themselves (*A
quotation*, *Someone speaking*); *Add a Separator*; *Redact the Selection*; and
**More Styles**, the one control of the row written in words. At 1280 wide or
more, with the panel shut, that is one row, under 48 px. Narrower, it wraps as
before, and nothing is hidden by width. The four marks are joined into one
cluster, and the keys inside them are drawn without a box of their own, which is
what lets the row hold `Ctrl+⇧+S` on Windows and Linux, in French as well, where a
Mac draws `⇧⌘S`.

**The rest is a panel under the row, every select under its name.** *More
Styles* toggles it, with `aria-expanded` and `aria-controls`. It holds *Small
Capitals*, *Superscript* and *Subscript*; the selects for the words (*Size*,
*Typeface*, *Colour*, *Highlight*, *Letter spacing*, *Language of these words*),
for the line (*Alignment*, *Line spacing*) and for the whole text (*Where the text
stands*, offered only where it is read); then *Add an Effect* and *Take the Effect
Off*, whose row of sentences opens inside the panel. Each select is drawn under a
`<label>` carrying the name it already had, so two that read *None* are told apart
by what is written over them, and no accessible name changes.

**Reachability is kept by one labelled control, not by drawing everything.** That
is what `0056` protected, and this keeps it. Every act the bar offered is in the
row or one press away in the panel. Every key still sets its style with the panel
shut, because the keys are the editor's and never the toolbar's. The toolbar is
still one tab stop with a roving tabindex, and while the panel is open the arrows
run on through it.

**A style the panel holds is never out of sight.** While the words under the caret
or the selection carry one, a pressed toggle of the panel's or a select of the
panel's that does not read `''`, *More Styles* is lit with a point of `--light`
and named *More Styles, Some Set Here*. This reads what the panel's controls
already read, so it adds no reading of the document. An Effect on the run is not
counted, because the bench already draws it, dotted, on the words themselves.

**The panel stays where the Author left it.** It is one `useState` for the page,
not the editor's, because each Shot the caret enters mounts an editor of its own.
Opened, it stays open from Shot to Shot; shut, it stays shut; a reload brings it
back shut.

## Considered Options

**Moving the bar out of the row**, under the text or into the bench's header, or
drawing it only on a selection. Out of scope here: each moves the bar away from
the words it acts on, and the one-row bar no longer covers the beat above.

**Hiding controls by width**, as an overflow menu does. Refused, for `0056`'s
reason: what the Author can do would then depend on the window.

## Consequences

**This amends `0056`'s *The toolbar wraps where it stands*.** The bar is one row
and a labelled panel. The specs that reach a control in the panel
(`formatted-written`, `run-effects`) open it first through `moreStyles` in
`tests/e2e/author.ts`, and otherwise assert what they asserted.
