---
status: accepted
---

# A change costs what it changes

Decided on 2026-10-10, issue #449, built by #479, #480 and #481. Gathers what
`docs/adr/0008-refetch-is-for-a-refusal.md`, `docs/adr/0032-the-bench-reads-the-story-back.md`,
`docs/adr/0043-a-story-is-written-as-one-document.md` and
`docs/adr/0061-what-a-beat-plays-as-is-folded-under-its-words.md` were amended to
say, and keeps the measure that holds them.

Nobody had used the bench at the size of a real work. *Reel Change* is five
Scenes and the Sample three; a work an evening long is tens of them. On a Story
of forty Scenes in a chain with eight Shots each, every Shot carrying about thirty
words and an Image, the bench cost what the Story held rather than what the
Author did. Three things made it so. The whole document was one component, so one
Shot's words changing drew every Scene, Shot and Exit again. An act read the Story
back and put the read in its place, so every part was a new object and every row
was drawn again. And every Shot's shut *how it plays* fold drew its controls in
full, three hundred and twenty times, for folds nobody had opened.

So a change now costs what it changes, and four rules keep it true for whoever
adds the next control.

## A row draws from its own Scene, Shot or Exit

A beat's row is `app/components/ShotRow.vue`, its fold `app/components/ShotPlays.vue`,
a way on's row `app/components/ExitRow.vue` and a Scene's Question
`app/components/Asking.vue`; the Scene's head stays in `Writing.vue`. A row is
handed its own Shot, Exit or Scene, and otherwise only what is a primitive or
keeps its identity while it says the same. The names the bench gives the Scenes
and the Exits, and the Flags of the Story, are one `reactive` Map or Set each for
the document's whole life, laid over in place by `keep` in `app/utils/sharing.ts`;
a value worked out of the whole Story and handed down whole goes through `steady`
in the same file; the lists of where a way on may land are handed ids and read
names from a Map. `0043`'s Consequence *The one document is drawn a row at a time*
says what a key struck in each field draws, and
`tests/e2e/rows-drawn-signed-in.spec.ts` counts it.

For whoever adds to a row: a function handed down is handed by reference and never
written inline in the template, since an inline function is a new value every time
the document is drawn and every row would be drawn with it; an act that needs
nothing back goes up as an emit; and what is worked out of the whole Story goes
through `keep` or `steady`, so an act that changes one Scene does not hand three
hundred rows a new object. Each component's scoped block holds the rules of the
writing that reach its elements, so a rule still matches what it matched when the
document was one template.

## A read-back keeps the identity of what did not change

The page lays the Story it reads back over the one it holds with `sharing` in
`app/utils/sharing.ts`. A Scene, Shot or Exit equal to the read keeps its object;
one that differs is the read's own object, and nothing the bench holds is written
into, so a typed write still in the queue sends what was typed. A refusal's read
is put in place whole, so a choice sent without being written into the held Story
first goes back to what persisted.

Reads that cross land newest first, and each act is answered on its own read:
`app/utils/reads.ts`. **When a read-back fails**, it drops nothing. The Story on
the bench stays as the last read that landed, and an older read that comes back
after a newer one failed is still laid over it. An act whose every read fails is
told so: after an act the server kept, the bench says *Kept, but the Story could
not be read back. Reload the bench to see it.* beside the document, and never says
it as a refusal, which the Author would answer by doing the act a second time.
Before this, a refetch that failed emptied the bench. `0008`'s amendment is the
whole of it, and `tests/e2e/refused-choice-signed-in.spec.ts` holds it.

## A fold draws its controls when it is opened

Shut and never opened, a Shot's or a Scene's fold is its `<summary>` and nothing
else. It is wanted on the `click` of that summary, heard before the browser opens
it, so its answers are drawn in the same task and it never shows open and empty;
its `toggle` wants it too, for a fold opened from code. Its answers stay drawn
while its row stands. No `open` is bound, so whether a fold is open is still the
browser's. No Command is marked in a fold and no Step points into one. The
browser's find no longer reaches the labels of a fold nobody opened, which are
the product's words and not the Author's. `0061`'s amendment is the whole of it.

## A reading of the whole Story follows the written words

The Remarks and the counts beside the document are read off `written`, a copy of
the Story taken when a typed write lands and whenever a read-back changes it, and
never as a key is struck. Nobody reads a Remark mid-word, and a reading of three
hundred Shots redone on every character is the cost this record is about. A
Scene's own count of its words is the one figure that still follows the key,
because it is about the Shot being typed and costs one Scene.

## The measure

`tests/e2e/length-signed-in.spec.ts` plants the Sample, seeds the long Story with
`seedLong` from `tests/e2e/author.ts`, and measures both in one browser, one after
the other: the median of twenty keystrokes, from `insertText` to the frame after
it; pressing a Shot, until its editor is drawn; and *Add a Shot*, until the new
row is drawn. Each long figure is held to four times the Sample's. A ratio taken
inside one test holds on a slow runner, because the runner slows both sides.

The long Story keeps an Image on every Shot, and they come in lazily as the
document is scrolled to the Shot pressed or the Scene added to. Six to eight of
them used to land inside the timed window, and *Add a Shot* read five to seven
times the Sample's in most runs, against about one and a half without them. So the
spec scrolls before it starts the clock, and waits until no Image is still on its
way and every Image the page shows is drawn. The cost of bringing an Image in is
`docs/adr/0005-a-shots-image-lives-in-its-row.md`'s and #448's, not a change's.

Measured with that spec on production builds, in headless Chromium in one cloud
container, so the milliseconds are that machine's and only the ratios carry. Before
is `dev` at 41e8c3d, the commit before #479, the median of three runs:

| before | Sample | 40 Scenes |
|---|---|---|
| a keystroke in a Shot, to the frame after it | 36.8 ms | 545 ms (×14.8) |
| pressing a Shot, to the frame after its editor | 61.8 ms | 580 ms (×9.4) |
| *Add a Shot*, to the frame after the new row | 365 ms | 3,294 ms (×9.0) |
| elements in the document | 3,173 | 71,849 |

After is the change that adds this record, on top of #479 and #480, the median of
ten runs:

| after | Sample | 40 Scenes |
|---|---|---|
| a keystroke in a Shot, to the frame after it | 16.7 ms | 18.5 ms (×1.1) |
| pressing a Shot, to the frame after its editor | 35.0 ms | 69.3 ms (×2.0) |
| *Add a Shot*, to the frame after the new row | 271 ms | 491 ms (×1.8) |
| elements in the document | 1,255 | 20,658 |

Across the ten runs the ratios ranged from 1.0 to 1.4, 1.7 to 2.2 and 1.5 to 2.2.
What is left of *Add a Shot* at length is mostly `GET /api/stories/:id`, which
answers this Story whole and which nothing here shortens.

## Keystrokes that still cost more than their row

Counted by `tests/e2e/rows-drawn-signed-in.spec.ts` and set out in `0043`:

- **A way on's words** draw that row, and every list of Conditions holding a
  Condition on an Exit, since each offers every Exit by its words.
- **The Flag a Question is held under** draws that Question, and every list of
  Conditions holding a Condition on a Flag. A Flag declared after it is taken out
  and put back to keep the order.
- **A Scene's name** is drawn by the document's own template, so a key struck in it
  draws `Writing.vue` and whatever says that name: every row of its section and
  their Conditions, every way on that leads to it, every list of Conditions on a
  Scene or on an Exit, and every list of landings that offers it. The rows of
  other Scenes are not drawn again.
- **A Scene's Transcript** also stands in the document's template, and draws
  `Writing.vue` and no row.

None of them is measured by the spec above. Each is what the field changes, or
would take making a Scene's whole section a component, which no measure has asked
for yet.

## What stays

The Story is still written as one document: every Scene is in the DOM, written
where it stands, and the browser's find reaches every word of it. Nothing is
virtualized and nothing is left to `content-visibility`, because what was measured
was script and not layout. The Contact Sheet and the Preview are not changed.
