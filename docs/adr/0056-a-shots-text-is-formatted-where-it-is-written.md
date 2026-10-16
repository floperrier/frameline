---
status: accepted
---

# A Shot's text is formatted where it is written

A Shot's text was one run of plain characters, written in a `<textarea>`, kept in
`shots.text` and drawn in one serif at one size. It is now formatted where the
Author writes it and read as it was formatted: italic, bold, underline, strike,
small capitals, raised or lowered, four sizes, four faces, five inks as letters
or as a band, spacing, a language, a redaction bar, and lines that are
quotations, speech, verse or separators, aligned and spaced, standing at the top,
the middle or the foot of the frame. A Story says the face and the alignment its
text is set in.

**It is written in an editor, not in markup.** Markdown or a tag syntax typed into
a box would be a second language the Author learns and a string the Reader's page
must never trust. The Author selects words on the Shot they are writing and sees
them as the Reader will. No new term enters `GLOSSARY.md`: a style is how a Shot's
words are set, not a thing a Story holds, refers to or tests.

**The shape is closed at the request boundary, and the plain words are derived.**
`shots.formatted` is `jsonb`, null, in ProseMirror's own JSON so the editor holds
it without translation. `parseFormatted` refuses an extra key, an unknown node or
style, a value outside its enumeration, an empty or line-broken run, a bar of
nought, a source that is not last and a `textOf` past `SHOT_TEXT_MAX_LENGTH`, as
`0004` answers for jsonb. In `drop` mode it leaves out what it does not know, so
the code before a later style reads a text that carries one. A PATCH writes
`formatted` with `text: textOf(formatted)` in the same update, `text` alone nulls
`formatted`, and both together are refused, since words said twice can disagree.
`shots.text` stays what the bench counts and quotes, and what every Remark reads.

**No contract step follows.** A null `formatted` is a Shot written before this,
read as `formattedOf(text)`, and so is one whose `formatted` no longer says its
`text`, which a rollback leaves. That rule is needed for rollbacks anyway, so a
backfill and a `not null` would add nothing to it. Every Story already written
looks exactly as it did (`0002`).

**The Reader reads with a pure renderer.** `drawFormatted` builds virtual nodes,
never a markup string, with no `v-html` and no `innerHTML`. It writes only
enumerated classes, a `lang` from `STORY_LANGUAGES` and a bar's length as a
number, so an Author's string is escaped as text and never read as markup. The
Reading, the Contact Sheet and every Shot the bench is not writing in draw
through it, the server renders it and the browser hydrates the same tree, and the
Reader's page loads no editor. A bar holds no words at all, only its length, and
a visually hidden text carries what the Author says it hides, for a Reader who
cannot see it. The static Shot and the editor are built from the same two
tables, so they cannot differ.

**One editor, on the Shot the caret is in.** It is a core Tiptap `Editor` over
ProseMirror, mounted with `<component :is>`, with no `@tiptap/vue-3`, which would
add a wrapper this does not use. Every other Shot is the renderer's output in a
box carrying what the textarea carried. The editor's chunk is fetched while the
bench is idle and a box mounts it when it takes the focus, so no first keystroke
is lost between the press and the editor. Its cost is paid on the bench only.
Pasting goes through the schema's parse rules and keeps italic, bold, underline,
strike, quotations, separators and lines, dropping colour, face, size, style
attributes, link addresses, scripts and images.

**The toolbar wraps where it stands.** It is positioned over the top of the
Shot's row by plain positioning, one tab stop with a roving tabindex, and wraps
onto further rows at every width instead of hiding controls. Compacted to glyphs
that carry their keys, it stays reachable and each toggle draws its shortcut and
carries `aria-keyshortcuts`. It has no undo control, because the messages table
names none and the editor's own `Mod+Z` is undo within the Shot. No Command is
marked, since each act is one key or press on a selection in view.

**The palette has its refusals.** There is no link, because a frame holds none and
underline stays unambiguous; no list, no heading, no image; no colour for a
picture, whose pixels the product does not hold; and no per-run size past four
steps, whose zoom the Reader keeps. Colour and highlight are one style, so a
pastel on a pastel cannot be written. A colour says nothing to a screen reader,
which is the Author's to mind. The Effects of `0052` are not a mark: #360 landed
first, with its Effects on the whole text, and none is added here.

**The inks sit above #350's scrim.** Its scrim is never lighter than 70% `--room`,
which composites over a white Image to a luminance of 0.092, so only a text of
luminance 0.59 or more holds 4.5:1 on it. The five inks are pale on purpose, from
rose at 4.6:1 on that scrim to green at 5.75:1, and 12:1 and more on the bench and
the room. They are read only on a Shot's text, and keep no accent's job.

**Two faces join the two there are**, amending `0006`, which kept the interface's
faces out of a Reading. A typewriter face, Courier Prime, and a hand, Caveat, are
the Author's to set a run in, drawn for a screenplay and a margin note, and the
interface's mono stays the interface's. Both are fetched with `preload: false`, so
a Reader pays for them only where they are used, and Newsreader gains the italic
and the 600 weight the emphasis and the bold ask for.

**A Story's face and alignment are what a default typography earns where the Cut
did not.** `0050` refused a Story-wide Cut because raccords are chosen cut by
cut. A work is set in one face and departs from it locally, so this default is of
`steps_back`'s kind: `stories.text_face` and `text_align` are defaulted columns,
and a line or run that says nothing is read as the Story is set. There is no Scene
level, because departures in type are local and a style carries them, and no
Story size, because the base clamp is tuned to the measure and a Reader has the
zoom.

**The works are formatted where their texts ask for it.** *Reel Change* gains its
reel's label, the second Shot of *The booth*, small in the typewriter with the
sender's name inked out behind a bar, its italic on *this*, and the card opening
*Daybreak* in the title face, largest, spaced wide and centred. The Samples'
text-only card becomes two speeches, a Flag is set in the typewriter as it looks
on its Scene, and the Sample's author speaks aside in the hand. Nothing in the
film is spoken, sung, quoted or coloured, and a colour invented only to be shown
would bend the work, the objection `0004` records from #26. The Story's face and
alignment stay at their defaults in both works for the same reason.

**The siblings landed in another order than the issue foresaw.** #358 and #360
landed first, so the renderer cuts #358's units from what it draws, every run's
words a leaf in `textOf` order and a bar one piece that arrives whole, and no
Effect mark exists. #351 has not landed and lands second: it rewrites its `said`
on positions and hands the renderer its Flags, which `drawFormatted` takes then
and has no parameter for today.

## Consequences

A Shot's words are said by `textOf`, so the length bound, the Remarks and the
Words count read what the Reader reads with the formatting set aside, a bar one
`█` per character it stands for. The Reader's page weighs no editor. A Story that
sets nothing is drawn as it was, and the `<textarea>` is gone from the bench,
with the end-to-end helpers that typed into it.
