---
status: accepted
---

# The Cut is made by the hand or by the clock

A Story is watched as well as read, and until now every cut in one was made by
the Reader's hand and made hard. What an editor has and an Author here did not
is when a Shot leaves the screen, and how it leaves it.

**Zero is what is not seen.** A Scene says how its run is cut in `cut_after`,
`cut_over` and `cut_through` on `scenes`, and a Shot answers for itself in the
same three on `shots`, where null is *as the Scene says* — the shape
`docs/adr/0047-an-exit-says-whether-it-is-crossed-backwards.md` gave
`steps_back`: three answers in one nullable column, the default consulted only
where the row said nothing. That leaves a Shot wanting to be held until the
press with nothing to say it in but nought, and nought is free to mean it,
because a Shot standing for no time would not be seen at all and so cannot be a
duration. A Scene's `exits_after` reads the same way. Ways on offered for no
time are not seen either, and there that is the whole point: the Scene flows
into the next without asking. Neither nought is ever typed — the panel offers a
`<select>` and never the number, so what the Author writes is a sentence and the
sentinel stays in the column.

**There is no `straight` to write.** A hard cut is `cut_over = 0`, and under a
duration of nought there is nothing for `cut_through` to be true of. A third
value beside `image` and `black` would say again what the duration already says,
and *a hard cut over eight hundred milliseconds* would become a sentence the
request boundary has to refuse rather than one that cannot be said. One fact per
column and no pair that can disagree, which is what `0047` asks of two settings
about one thing.

**The Exit's Cut has no Scene behind it.** A Scene's `cut_over` and
`cut_through` are about the Shots of its run. Reaching them from the Exit that
leaves the Scene would make one column mean two passages — the raccord inside a
run and the passage out of it — so an Author lengthening a dissolve between two
Shots would be lengthening the way out of the Scene without being told.
`cut_over` and `cut_through` on `exits` answer for themselves with nothing above
them, and there is no Story-wide default either: `stories.steps_back` exists
because a Story is one way or the other about doors, and nothing about a Story
is one way or the other about raccords.

**The clock presses what the hand would press.** `advance()` and `take()` do not
change, and `Path` gains nothing. A run that reaches the end of a hold is a run
that advances; a choice whose time runs out is the first Exit still offered
being taken, which is the one already holding focus and the one Enter would
press. So the order the ways on are written in is the whole of what names it,
and no column says which. A Path arrived at by waiting is indistinguishable from
one arrived at by pressing, and a forged one is refused by `offered()` exactly
as it is today.

**A Cut is not a position.** It is the rule
`docs/adr/0049-a-sound-is-carried-by-what-plays-it.md` settled about a Sound,
read again. Nothing records how far into a hold or a countdown a Reading had
got, because a Path is where a Reading has got to and not when. A step back
restarts the Shot it lands on, a visit resumed from the browser restarts the
Shot it resumes at, and a Shot played again stands again for its whole time.

**What the Reader is owed.** The press always cuts early, so a Reader ahead of
the clock is never made to wait for it. A pause stands beside the mute, which is
what WCAG 2.2.2 asks the moment anything advances by itself; the pacing is the
work rather than an ornament on it, which is the exception 2.2.1 grants where
timing is essential. `prefers-reduced-motion` reads every `cut_over` as nought
and leaves the hold alone, for the same reason: a dissolve is a decoration and a
hold is the rhythm of the work. The pause is held beside the Path and never
inside it, as the mute is — a Path is a reading of the Story — and unlike the
mute it is not kept between visits, because a mute is a preference and a pause
is a moment.

**The word has been used here once before.** It named what is now the Exit, in
`docs/adr/0007-the-order-of-the-ways-on-is-written-not-drawn.md` and in the
superseded `docs/adr/0015-a-cut-is-drawn-by-hand.md`, and the rename that
followed is why the Exit entry in `CONTEXT.md` keeps *cut* and *coupe* off its
word list to this day. `0007` says as much in its own closing note, and what it
settled about the order of the ways on is untouched by either naming: read Cut
as Exit there. In every document written from this one onwards it reads the
other way, as the thing decided above — which an Exit carries and is not.

## Considered Options

**A term of its own for the timed choice.** `Cut` names what takes a Shot off
the screen; how long the ways on stand is a clock, and a word for a clock is not
in the grammar of cinema —
`docs/adr/0022-the-metaphor-stops-at-the-edge-of-the-work.md`. The Exit entry
gains a sentence instead, which is enough: a Scene that offers nothing is still
a Scene offering its Exits, for a duration that happens to be nought.

**A column naming which Exit the clock takes.** The Place already orders them,
the first one offered already holds the focus, and the Preview is already where
that order is set —
`docs/adr/0007-the-order-of-the-ways-on-is-written-not-drawn.md`. A second way
of saying it is a second thing to disagree with the first.

**A boolean beside `exits_after` for whether the ways on are offered at all.**
Two settings about one fact, which can contradict each other. Three states of
one column cannot.

**Seconds in the Path**, so a hold could be resumed where a visit left it.
`0049` refused them for a Sound, and the refusal is the same one: the Path would
stop being the route and the taking of it and start carrying a clock, and every
Reading kept in a browser would come back holding a moment that was true when
the tab was closed.

**A fade on the Sound to go with the fade on the image.** `0049` refused mixing,
ducking and any priority between the two layers. An envelope on the bed reopens
that decision rather than following from this one, so it is its own ADR when a
Story asks for it.

**Video.** Other bytes, another cap, and another decision about what a Story
carries.

## Consequences

- A Scene that flows on and leads nowhere ends the Reading, which is what the
  engine does today with no line added. It is worth one Remark at the bench and
  no refusal, because a Remark never says a Story is wrong and this is a Story
  an Author may be in the middle of.
- Every Story written so far reads exactly as it read. `cut_after` and
  `exits_after` default to null, `cut_over` to 0 and `cut_through` to `image`,
  which is a run that waits for the press, cut hard, with its ways on standing
  until somebody takes one. Nothing is required and everything has a default,
  which is what `docs/adr/0002-the-schema-moves-with-the-deploy.md` asks of a
  schema that moves before the code that reads it.
- The Contact Sheet is unchanged. A contact sheet is still and silent; `0049`
  refused it a Sound for that reason, and this refuses it a Cut for the same
  one.
