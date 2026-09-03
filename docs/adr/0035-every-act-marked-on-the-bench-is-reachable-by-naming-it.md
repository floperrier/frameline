---
status: accepted
---

# Every act marked on the bench is reachable by naming it

`docs/adr/0034-a-story-is-written-without-the-canvas.md` left a single field
above the bench that went to a Scene by typing its name, and that field was the
only thing on the whole bench an Author could reach by naming it. Everything
else — Publish in the header, the fit in the row of controls, Delete Scene
inside the writing surface — had to be found where it was drawn.

There is now one bar for all of it. `⌘K` opens it, so does a control in the row
above the bench — which says *Commands* and carries `⌘` `K` drawn on it, because
a shortcut nobody was told about is not a way in and the place to tell them is
the control that does the same thing. Typing narrows the list, `↓` walks it and
`Enter` runs what is under focus. Matching ignores case and the
accents on a letter, so *Le café* is reached by typing `cafe`. The field that
went to a Scene by name is gone: every
Scene is in the list, which is that field absorbed rather than kept beside — two
controls for one act is what `0034` refused for the Exit's text.

**A name that reaches nothing is offered as a Scene to write.** Where the typed
name answers to no Command, the bar offers exactly one thing: *Write a Scene
named X*. An Author who has typed the name of a Scene that does not exist has
already said what they want, and the alternative was a dead end — an empty state
saying *nothing here answers to that* and nothing to do about it.

This is not a new capability. `POST /api/stories/{id}/scenes` takes a name and
places the Scene itself, and both existing ways of making one — the Exit dropped
on the bare bench, the way on written towards a Scene that does not exist yet —
create under a provisional name and then select the name field so the Author
types over it. Naming a Scene into existence removes that step rather than
adding a concept.

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

**Naming the control by what is inside the bar rather than by the bar.** It
read *Name an act, or a Scene* for a while, on the argument that every other
control here says what pressing it does — *Write the first Scene*, *Fit the
graph*, *Publish this Story* — and that a first-time Author reading *Commands*
learns a category rather than a way in.

Refused, on two counts. A label that lists what is behind it has to be
maintained as what is behind it grows, and it was already narrower than the
truth: the bar carries every Scene, the acts that publish and list the Story,
the acts of the Scene on the writing surface, and whatever is marked next — the
first Command that is neither an act nor a Scene would leave the control lying.
And *Command* is the word the glossary binds, so the surface an Author sees most
of the time is the one place it most needs to be displayed.

What the enumerating label was good at is not lost, it moved to the moment it is
useful: the sentence labels the field inside the bar, read as the bar opens
rather than guessed at from the row above. The cost of the noun is that finding
out what it opens takes one press, and the key drawn beside it does most of that
work already.

**Naming it out of the grammar of cinema.**
`docs/adr/0022-the-metaphor-stops-at-the-edge-of-the-work.md` settles it the
other way: the cinema words name the work and what is inside it, and a bar of
acts is a tool of the bench. *Command* / _Commande_ is the plain word, and the
glossary entry carries palette, spotlight, quick open and raccourci on its
`_Avoid_` list — a plain word is not a loose word.

**Refusing to make a Scene from the bar, because no control performs it.** That
was the first position here, on the contract above: a Scene is born from an Exit
— `docs/adr/0031-a-scene-is-born-from-an-exit-dropped-on-the-bench.md` — so
there is nothing to mark, and the bar was to add no act the bench does not have.

Reversed, deliberately and once. What the contract protects still holds either
way: the act exists on the bench by pointer twice over, and the offer itself is
a row in a bar a pointer opens and presses, so nothing here is reachable by the
keyboard alone. What is genuinely paid is the third clause — this one act is
written a second time, in the page, beside the acts the page already owns. That
is the price of an empty state that invites rather than reports, and the
boundary is the sentence above: **one** offer, only where nothing answers, and
never a second act written into the bar because it was convenient.

That it stands only where nothing answers is not a detail. A Story of forty
Scenes would otherwise offer to write *Le* under an Author halfway through
typing *Le café*, and a making that stands under every partial name is a making
somebody presses by mistake.

## Consequences

**Escape is the open dialog's, whichever dialog it is.** Two listeners on the
document answer Escape — the page closes the writing surface, the graph lets go
of an Exit being drawn — and each of them used to be told a confirmation was up
by a flag threaded down from the page. A second dialog would have meant a second
flag, and a third a third. Both now ask the document instead:
`document.querySelector('dialog:modal')`. The fact is the browser's own, the
graph loses a prop, and the day a fourth surface opens modally nothing has to be
remembered.

**A Command is one press of one control that answers a press.** Nothing in the
bar composes two, and an act that asks a question asks it after the bar has
gone: Delete Scene closes the bar and puts the confirmation up, which is the
same sequence as pressing the control by hand.

A `<select>` does not answer a press. `element.click()` on one fires the event
and leaves the list shut, because a browser opens a menu under a gesture it
made itself and under nothing else. For a while that left the one act whose
control is a select — *A way on from here*, the field at the foot of the
document that is how a Story branches at all — out of the bar, and issue #203
asked whether it was owed a button beside the select so that it could answer a
press like everything else. It is not: two controls for one act is what `0034`
refused for the Exit's text. **The bar puts the hand on a select instead of
pressing it.** Running a Command whose control is a select moves focus onto
it and asks the browser to open its list — `showPicker()`, which runs under
the very gesture that ran the Command and so is a gesture the browser made
itself — and where a browser has no `showPicker()` for a select, focus alone
lands and one press of Space, or the first letter of a Scene's name, opens it.
That is one branch in the bar's press and nothing on the surface, and the
select carries its mark under *Add a Way On*, beside *Add a Shot* and *Add a
Flag*. The select on each existing way on, which says where it leads, stays
unmarked for the reason the marks that renumber or duplicate a row are: it is
done to a row an Author is already looking at.

**The mark comes off where the act has nothing left to do.** The bar's own
filter reaches `:disabled` and no further, and not every spent act is disabled:
a radio already checked answers a press with no `change` at all, so the Scene
the Story already opens on would offer *Mark as the Opening Scene* and leave the
Story exactly as it was. The template says so by leaving the attribute off,
which is the same dead row the paragraph above refuses — where the bench can
tell that an act is spent, it is the bench that has to tell the bar.

**The bar reads the page once, as it opens.** It is modal, so nothing can add or
remove a control while it is up, and a live read would be a `MutationObserver`
earning nothing. What that costs is that the list is of the bench as it stood a
moment ago — which is exactly what the Author was looking at when they opened it.

**The legend above the bench keeps its two bindings.** The scale's shortcuts
stay written there because nothing on the row performs them; this one does not,
because the control performing it is a hand's width away and can say so itself.
A key belongs on its control where there is one, and in the legend where there
is not.

**A Scene named into existence joins nothing**, which neither gesture that makes
one ever leaves a Story in on purpose: both draw the way to the Scene in the
same breath as the Scene. So the bar makes an orphan cheap — two seconds at the
keyboard — at exactly the moment `0034` took the canvas off the critical path
and with it the one place an Author saw a Scene nothing leads to. The Preview
says it for the Scene on the surface and nothing says it for the Story. That is
issue #187, and this record is half of why it is owed.

**A `<dialog>` reports its own shutting late.** `close()` queues the `close`
event rather than firing it, so a bar put away and asked for again inside one
breath — two presses of the key, which is one hand changing its mind — receives
the first report after the second opening. Believed at face value it says the
bar is gone while it is on the screen, and the state it writes back then shuts
the bar the Author has just opened. The report is therefore believed only where
the dialog agrees with it. The end-to-end suite holds the sequence, because
nothing about it is visible in a single press.

**Marking a new control is one attribute.** The cost of keeping the bar honest
is that a control worth naming has to say so. That is deliberate: an act that
nobody bothered to mark is an act nobody wanted to reach by name, and the
alternative — everything with an `onclick` — would fill the list with the eleven
marks that renumber a Shot.

**The test a mark is owed by is whether an Author would say it.** The first
round of marking left the bar a Scene switcher: the header, the row above the
graph and the way out of the writing surface were marked, and nothing the
document of a Scene does was — not a Flag set on entry, not a Condition on a
beat or on a way on, not the Scene marked as the one the Story opens on. Those
three are acts an Author says out loud, so they carry the attribute now. The
marks that renumber a beat or a way on, duplicate one, or attach an image still
do not: they are done to a row an Author is already looking at, and naming a row
in the bar takes longer than pressing the mark beside it. *Add a Condition*
carries what it is added to after it, because a Scene draws one of those lists
per Shot and one per way on and the words alone would name four acts at once.

Two of the three are named by a phrase that stands nowhere on the screen —
*Mark as the Opening Scene* for a radio whose label reads *Opening Scene*, and
*Add a Condition to Shot 3 of The bar* for a button that says the carrier under
its breath. That is the licence *Go to Le café* took above, and it carries the
same cost: a phrase to keep in step with words nobody sees beside it. It is paid
in the message files rather than in the templates, so the phrase is one string
in two languages and not a sentence assembled in code.

**The record is named for what is marked, which is not everything.** It was
called *every act of the bench is reachable by naming it* while about a third of
its acts were marked, and the title was read as a promise the code never made —
issue #197 is that reading. The name is narrowed to what the design does rather
than the marking widened until the old name came true, because an exhaustive
marking is a rule somebody has to keep, and refusing rules of that kind is what
this record did in the first place when it declined to hold a list of acts in
the bar. What holds the coverage instead is a spec: the end-to-end suite reads
the whole bar over a Scene being written and holds it against the acts named
here, so a control that arrives unmarked arrives with a red run.
