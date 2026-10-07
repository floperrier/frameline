---
status: accepted
---

# A change costs what it changes

Decided on 2026-10-02, issue #449. Amends
`docs/adr/0008-refetch-is-for-a-refusal.md`, whose read-back now keeps what did
not change, `docs/adr/0043-a-story-is-written-as-one-document.md`, whose one
document is now drawn a row at a time, `docs/adr/0061-what-a-beat-plays-as-is-folded-under-its-words.md`,
whose folds now draw their answers when opened, and
`docs/adr/0032-the-bench-reads-the-story-back.md`, whose Remarks now follow the
written words.

Nobody had used the bench at the size of a real work. *Reel Change* is five
Scenes and the Sample three; a work an evening long is tens of them. On a Story
of forty Scenes in a chain with eight Shots each, every Shot carrying about thirty
words and an Image, the bench cost what the Story held rather than what the
Author did. Measured inside the page, on the built app, the Sample and the forty
Scenes in the same browser and each ratio taken within its own run — before, on
`dev` at 84a7eaa:

| before | Sample | 40 Scenes |
|---|---|---|
| a keystroke in a Shot, to the frame after it | 8.7 ms | 105.5 ms (×12) |
| pressing a Shot to write it, to the frame after its editor | 10.9 ms | 104.7 ms (×9.6) |
| *Add a Shot*, from the press to the frame after the new row | 52 ms | 616 ms (×11.8) |
| elements in the document | — | 71,774, the issue's count |

and after, on the change this record is about:

| after | Sample | 40 Scenes |
|---|---|---|
| a keystroke in a Shot, to the frame after it | 8.7 ms | 9.5 ms (×1.1) |
| pressing a Shot to write it, to the frame after its editor | 9.2 ms | 13.4 ms (×1.5) |
| *Add a Shot*, from the press to the frame after the new row | 34 ms | 78 ms (×2.3) |
| elements in the document | 1,238 | 20,576 |

Three things made it so. The whole document was one component, `Writing.vue`, so
one Shot's words changing re-ran the render of every Scene and every Shot and
diffed all of it. An act read the Story back and put the read in its place, so
every Scene, Shot and Exit was a new object and every row was drawn again. And
every Shot's closed *how it plays* fold drew its controls in full — the Sound
library's thirty sounds, the Cut, the Layout, the Movement, four Effects —
three hundred and twenty times, for folds nobody had opened.

So a change now costs what it changes, and four rules keep it true for whoever
adds the next control.

## A row draws from its own Scene, Shot or Exit

A Shot's row is `app/components/ShotRow.vue` and a way on's is
`app/components/ExitRow.vue`; the Scene's head stays in `Writing.vue`. A row is
handed its own Shot or Exit and its Scene, and otherwise only what is a primitive
or keeps its identity while it says the same: the bench's name for the Scene, the
Place, whether it is the last, whether the caret's Scene is this one, whether the
one editor is on it. A component is drawn again only when what its own render read
has changed or a prop it was handed is a different value, so a keystroke in a
Shot redraws that row and the Scene's count of words, and nothing in
`Writing.vue`'s own render reads a Shot's words any more.

Two consequences for whoever adds to a row. A function handed down as a prop is
handed by reference — `:changing="changing"` — and never written inline in the
template, because an inline function is a new value every time the document is
drawn and every row would be drawn with it. An act that needs nothing back goes
up as an emit, which Vue never counts as a changed prop — save one said after a
request, which a row unmounted meanwhile could not say: `attached` is a function
of the document's, handed down the way `changing` is. And what a row is handed
that is worked out of the whole Story — the names the bench gives its Scenes and
Exits, the Flags a Condition may ask about, the face a Shot is set in, the Scenes a
way on may land on — goes through `steady` in `app/utils/sharing.ts`, so an act
that changes one Scene does not hand three hundred rows a new Map.

What a row writes about its own Shot or Exit moves with it. What touches the
document's shared state stays in `Writing.vue`: the one editor, the keys that cut,
join and walk, a file over a run, the one field a Shot is moved from, deleting and
putting back, splitting a Scene, duplicating, renumbering. The stylesheet is one
file, `app/assets/css/writing.css`, included scoped by all three components, so
every rule still matches exactly what it matched when the document was one
component — `0006`'s scoped block, held in a file because three components draw
it.

## A read-back keeps the identity of what did not change

The page reads the Story back itself and lays the read over the Story it holds
with `sharing` in `app/utils/sharing.ts`. A Scene, Shot or Exit equal to what was
read keeps its object; one that differs is the read's new object, with what did
not change inside it kept in turn. Only the read asked last lands, and one that
fails leaves the Story as it is, where a refetch that failed used to empty the
bench.

Nothing the bench holds is written into, which is what keeps `0008` whole. A
typed write still waiting in the queue holds the object it was typed into, and
sends what that object says when its turn comes; a read laid over it in place
would have put the old words back into it first. A part that differs is a new
object instead, so the one the write holds still says what was typed — exactly
what a refetch that replaced everything did.

## A fold draws its controls when it is opened

A Shot's *how it plays* and a Scene's draw their answers on the first `toggle`
that opens them, and keep them drawn while the row stands. No `open` is bound, so
whether a fold is open is still the browser's own. Nothing the bar of Commands or
the guided path reaches stands inside a fold, which `0061` already said of the
bar, so neither changed; a control added inside one later is reached by opening
the fold first, the way `unfold` in `tests/e2e/author.ts` opens one by hand. The
browser's find no longer reaches the options of a fold nobody opened, which are
the product's words and not the Author's.

## A reading of the whole Story follows the written words

The Remarks and the counts beside the document are read from the Story as it was
last written: a copy taken when a typed write lands and whenever a read-back
changes the Story, and never as a key is struck. Nobody reads a Remark mid-word,
and a reading of three hundred Shots redone on every character is the cost this
record is about. A Scene's own count of its words is the one figure that still
follows the key, because it is about the Shot being typed and costs one Scene.

## What stays

The Story is still written as one document: every Scene is in the DOM, written
where it stands, and the browser's find reaches every word of it. Nothing is
virtualized and nothing is left to `content-visibility`, because what was measured
was script and not layout.

A keystroke in a Scene's name or in an Exit's words is not one of the figures
above and is left as it falls out: a rename still renumbers every control that
names the Scene, which is what a rename changes. The Contact Sheet and the Preview
are not changed. `GET /api/stories/:id` answers this Story in some fifty
milliseconds and is the part of *Add a Shot* nothing here can shorten.

`tests/e2e/length-signed-in.spec.ts` measures the three figures on the Sample and
then on `seedLong`'s Story in the same browser, and holds each ratio to four: a
ratio taken inside one test holds on a slow runner, because the runner slows both
sides.
