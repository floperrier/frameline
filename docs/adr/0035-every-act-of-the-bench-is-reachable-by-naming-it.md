---
status: accepted
---

# Every act of the bench is reachable by naming it

`docs/adr/0034-a-story-is-written-without-the-canvas.md` left a single field
above the bench that went to a Scene by typing its name, and that field was the
only thing on the whole bench an Author could reach by naming it. Everything
else — Publish in the header, the fit in the row of controls, Delete Scene
inside the writing surface — had to be found where it was drawn.

There is now one bar for all of it. `⌘K` opens it, so does a control in the row
above the bench, typing narrows the list, `↓` walks it and `Enter` runs what is
under focus. Matching ignores case and the accents on a letter, so *Le café* is
reached by typing `cafe`. The field that went to a Scene by name is gone: every
Scene is in the list, which is that field absorbed rather than kept beside — two
controls for one act is what `0034` refused for the Exit's text.

**A Command is not written twice.** It is a control that already stands
somewhere on the bench, marked in its own template with a `data-command` that
carries the name the bar shows it under, and running one presses that control.
The bar reads them off the page as it opens and holds no list of its own.

That is the load-bearing decision, and what it buys is not brevity:

- The bar cannot offer an act the bench does not. A control that is absent from
  the page, or disabled, is simply not a Command, and nothing in the bar can
  invent one.
- **No key is the only way to do what it does** — the constraint carried out of
  `0034` and the one a modal bar is likeliest to break — is held by the
  structure rather than by whoever remembers it. A Command that had no control
  behind it could not be listed.
- The words are the button's own, already translated, already the words on the
  screen. A bar with its own list would have its own second phrasing of every
  act, and the two would drift.

It is the same anchoring the guided path uses for the element a Step points at —
`docs/adr/0019-the-guided-path-is-anchored-to-the-template.md` — for the same
reason: a selector held away from the template rots silently when the template
moves, and an attribute moves with it.

## Considered Options

**A list of acts held in the bar, each with its own handler.** The obvious
shape, and the one every palette in the field has. Refused on all three counts
above: it duplicates every act, it duplicates every phrase, and it makes
"everything here is also reachable by pointer" a rule somebody has to keep
rather than a fact of how the thing is built. It also wants the page to hand it
`change`, `write`, `ask` and `announce`, which is the whole editor threaded
through a control that performs nothing itself.

**Reading each Command's name off the control's own text.** Nearly free, and
wrong on the one control that matters most: the button that writes a Scene says
*Write*, with the Scene's name after it for what reads the page but not for the
bar. The names would have come out as *Write Scene named Le café*. The attribute
carries the name deliberately, which also lets a Command read as an act — *Go to
Le café* — where the button it presses reads as a label on a card.

**A combobox, with `aria-activedescendant` and a listbox.** The pattern the ARIA
practices describe, and more machinery than the thing needs. The results are
buttons and the keyboard moves real focus onto them, so each one is announced as
it is arrived at because it genuinely has focus, and a press with the pointer is
the same press. There is no second state saying which row is active and
therefore no way for it to disagree with where focus actually is.

**Naming it out of the grammar of cinema.**
`docs/adr/0022-the-metaphor-stops-at-the-edge-of-the-work.md` settles it the
other way: the cinema words name the work and what is inside it, and a bar of
acts is a tool of the bench. *Command* / _Commande_ is the plain word, and the
glossary entry carries palette, spotlight, quick open and raccourci on its
`_Avoid_` list — a plain word is not a loose word.

**Making a Scene that joins nothing, from the bar.** Not offered, and not by
omission: a Scene is born from an Exit —
`docs/adr/0031-a-scene-is-born-from-an-exit-dropped-on-the-bench.md` — so there
is no standalone control to mark. The bar adds no act the bench does not have,
which is the whole of its contract.

## Consequences

**Escape is the open dialog's, whichever dialog it is.** Two listeners on the
document answer Escape — the page closes the writing surface, the graph lets go
of an Exit being drawn — and each of them used to be told a confirmation was up
by a flag threaded down from the page. A second dialog would have meant a second
flag, and a third a third. Both now ask the document instead:
`document.querySelector('dialog:modal')`. The fact is the browser's own, the
graph loses a prop, and the day a fourth surface opens modally nothing has to be
remembered.

**A Command is one press of one control.** Nothing in the bar composes two, and
an act that asks a question asks it after the bar has gone: Delete Scene closes
the bar and puts the confirmation up, which is the same sequence as pressing the
control by hand.

**The bar reads the page once, as it opens.** It is modal, so nothing can add or
remove a control while it is up, and a live read would be a `MutationObserver`
earning nothing. What that costs is that the list is of the bench as it stood a
moment ago — which is exactly what the Author was looking at when they opened it.

**Marking a new control is one attribute.** The cost of keeping the bar honest
is that a control worth naming has to say so. That is deliberate: an act that
nobody bothered to mark is an act nobody wanted to reach by name, and the
alternative — everything with an `onclick` — would fill the list with the eleven
marks that renumber a Shot.
