---
status: accepted
---

# A Flag is said by its name

A Scene may draw one of several values for a Flag as the Reading arrives, and
nothing a Reader reads could say which: an Author wrote one Shot per value, each
under a Condition testing it. A text now writes a Flag's name between braces,
`{coat}`, and the Reader reads in its place the value this Reading holds. What
the Reader sees is a sentence and no mark of where a value stood. Decided on
2026-10-01, issue #351.

**It is said by its exact name and by nothing else.** A run between braces is
the name of a Flag, case and spaces included, as a Condition reads one. There is
no default, no filter and no test inside the braces, so the absence of a parser
that `docs/adr/0004-conditions-stay-flat.md` protects is kept: a Reading holding
nothing is given something else to read by a Shot under `is: ''`, which already
exists.

**Only a name some Scene sets is said, and that is the whole escaping rule.**
Any other run between braces is read as it is written, so a brace is written by
writing one, and a misspelt name shows in the Preview as typed. There is no
`{{`, and no backslash.

**A Flag the Reading does not hold says the empty string.** That is what `holds`
already reads absence as. The braces are not left in view, which would hand the
Reader the bench's notation, and no word of the interface is put in their place,
which would be the Reader's Locale inside the Story's Language.

**The Reading alone says a text.** It does so against the State fixed for its
Scene, in `Reading.vue`, after the engine has answered where the Reading stands:
`reading()` is called at every step of the search and the step back, and would
say texts nobody reads. The bench quotes every text as it is written. A Shot's
formatted text is said run by run, so a name split across two runs of different
formatting is two runs and reads as typed. What a bar hides is not said.

**A Flag's name may not hold a brace.** The request boundary refuses it, by name
of the brace, since such a name could never be said. A value may hold one: it is
said as text and never read again.

## Considered and refused

- **A default, a filter or a test inside the braces.** A grammar an Author can
  type wrong, which `0004` keeps out of the product.
- **Leaving the braces in view, or a word of the interface's, where no value is
  held.** See above.
- **An escape**, `\{coat}` or `{{coat}}`. A second rule every Author learns for a
  text almost none will write.
- **Double braces as the mark.** Two characters where one pair does the work, and
  a promise of the loops and conditions of a template language.
- **Matching loosely**, ignoring case, spaces or accents. `Coat` and `coat` would
  be one name in a text and two in a Condition.
- **Offering the Story's Flags as the Author types `{`.** A combobox tracking the
  caret in a textarea, more machinery than the thing needs.
- **Marking the braced names in the writing.** A textarea cannot style a run of
  its own text, and the Preview already shows what the text becomes.
- **Refusing a text whose braces name no Flag.** A Flag is often set after the
  text that says it, and `docs/adr/0032-the-bench-reads-the-story-back.md`
  refuses to refuse a Story mid-sentence.

## Consequences

- `LETTERS_SPLIT_MAX` likewise bounds the letters an Author writes under a
  scramble, wave or tremor, not the letters a value says there, so a run saying
  long values many times takes apart more letters than the bound; it is the
  Author's own text, and the bound is kept to what is written.
- Nothing is stored and the schema does not move. A text keeps its braces as the
  Author typed them.
- A text that already holds the exact name of one of its own Story's Flags
  between braces is said from the day this ships.
- A name stored before this and holding a brace reads as it did in every
  Condition, and is refused the next time its Scene's Flags are written.
