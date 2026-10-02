---
status: accepted
---

# A beat lands when its Image can be shown

Decided on 2026-10-02, issue #441.

Everything an Author writes about a beat's time is counted from the moment the
beat lands: the Cut *after 3 s*, the Movement over the Shot's time, the Effect
*from a blur as the Image arrives*, the text *after 1 s, word by word*. Until now
a beat landed the instant the Reader pressed, or the instant the clock ran out,
and its Image was only asked for then. On `localhost` that is invisible. Read
through an ordinary 4G (9 Mbit/s, 85 ms), the Sample's Images arrived 1.3 to
2.3 s after they were asked for: Shot 1's blur ran on black, and an Image alone
with a Cut after 3 s collapsed to a 2 px line for half of the three seconds its
Author gave it. The grammar the product is about held only on the developer's
machine.

**A beat lands when its Image can be shown.** The Reading brings in the Images
it is about to need before it needs them, and a move whose Image is not in yet
holds the beat leaving on screen, as it is, until it is. So the Cut, the
Movement, the Effects and the text's arrival are all counted from a frame the
Reader can see. On an ordinary connection the hold is never felt, because the
next Image arrived while the Reader was reading this one.

## What is brought in ahead

`needed(story, at)` in `shared/utils/reading.ts` says it, built on `reading`,
`advance` and `take` alone, so what is brought in and what plays cannot
disagree:

- the Images of **the next two beats of the run**, judged against this Reading's
  State, so a Shot a Condition skips is never fetched. Two, because the shortest
  Cut an Author can write is half a second (`CUT_AFTER_MIN`) and the commonest is
  the press;
- at **the last beat of a run, and while its ways on are offered**, the first
  beat behind every Exit on offer there, which covers a Scene that flows into the
  next;
- while **the title card** stands, the beat the Reading opens on: the opening
  one, or the one a kept Path resumes on. *Begin* and *Resume* wait for it the
  way every move does — but for a Story that carries a Sound, which is begun
  inside the press whatever has arrived, because the press is the consent its
  Sound plays on (`docs/adr/0063-a-story-opens-on-its-title-card.md`) and Safari
  hears that consent only while the press is being made.

The Image on screen is held as well, so a step back onto it asks for nothing.

## How a move waits

Every move goes through `moveTo` — the press, the clock, an Exit, a step back,
an answer, reading again — and waits on `untilShown(imageHeld(story, to))` in
`app/utils/brought.ts` before the Path changes. A beat whose Image is in already
is not waited on at all and lands in the task it was asked for in, exactly as
before. The wait has a ceiling of eight seconds, long enough for a megabyte on a
poor 3G connection and short enough that a broken Image does not look like a
broken Reading; past it, or once a load has failed, the beat lands anyway. One
move is held at a time: a press made during the hold does nothing, because two
presses landing a split second apart would show the Reader a beat they never
saw. A hold past half a second puts `aria-busy` on the frame and *The next Shot
is on its way.* in the trail, both gone as the beat lands, and no live region.

Nothing about a beat that has landed changes: its Cut, Movement, Effects, text,
the flash rule, its Sound's strike, where the focus goes and reduced motion all
behave as they did, counted from a frame that has its Image.

## Why the document holds the bytes, and not the HTTP cache

Every Image is still served `no-store`, as
`docs/adr/0005-a-shots-image-lives-in-its-row.md` and
`docs/adr/0069-a-published-story-is-read-as-it-was-published.md` set it,
because a link can be taken away and nothing it served may outlive the Publish.
Changing that is 0005's own reopening condition, not this one's.

An Image is brought in by an element of its own — `new Image()`, its `src` the
very address the frame's `<img>` will carry — and decoded. The HTML standard's
*list of available images* then hands a later `<img>` with that address its
bytes at once, in the same document, *even when they don't allow caching per
HTTP*. So nothing outlives the page and no address changes. The elements are
kept referenced for as long as the Reading is mounted, because a `no-store`
resource nothing references is the browser's to let go: measured without that,
one step back in two asked for its Image again.

## Consequences

A Reading of a hundred beats holds a hundred encoded Images, tens of megabytes,
which a browser manages itself. If a long Story shows memory trouble on a phone,
holding only what is within some beats of the Path is the next step. Sounds are
not brought in ahead: a Scene's Sound plays under the run rather than with a
beat, and can go through the same module once it is wanted. Smaller Images for
smaller screens stay out, for 0005's one Image per row.
