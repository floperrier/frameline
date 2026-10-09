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

## Sounds are brought in too

Amended on 2026-10-09, issues #446 and #478.

A Shot's Sound strikes with its beat, and a Scene's is held under the run from
its first beat. Both were asked for only when they were needed, through the same
`no-store` doors, so on the 4G above a library strike sounded about 0.2 s after
its frame and an Author's own 2 MB Sound about 2 s after. Sound more than about
45 ms behind its picture is noticed.

So the Reading brings its Sounds in by the rule it uses for Images.
`soundsNeeded(story, at)` takes the same beats `needed` does and names each
beat's strike and the Sound its Scene is heard under. That goes through
`heardUnder`, so a Scene naming another is brought in under the carrier's
address. `soundsHeld(story, at)` names what the beat on screen plays. The title
card brings in the opening beat's Sounds beside its Image and never waits on
them, so *Begin* stays inside the press for a Story that carries a Sound. A card
left without that press lets go of what it brought in, since no Reading will.

Nothing is brought in before the Path the Reading stands on is laid. The
Reading is set up on the opening beat and reads a kept Path back only as it
mounts, so bringing in during setup made a Reader resuming a Reading ask for
the opening's strike and bed, up to 2 MB a bed, and never hear them.

A move waits on the Sounds of the beat it lands on together with its Image, under
the same ceiling and the same line. It does so only while sound is on, so a Reader
who turned it off is never held for a Sound. The Sound the bed is already playing
is left out of the wait, because a bed held across the move has nothing to wait
for. A Sound that fails, or runs past the ceiling, plays late from its own
address, as before.

### Why a Sound is held as a `Blob`, and not by an element

There is no *list of available images* for `<audio>`, so a `no-store` address set
again on the element is asked for again. A second `new Audio()` per Sound would
hold the bytes, but it would play its own copy of them. The Reading would then be
heard on one element per Sound instead of on its two, and muting, the Transcript
and the loop rules hang on those two. So a Sound is fetched into a `Blob` and
played from an object URL. That keeps `no-store` exactly as it is, nothing
outlives the page, and `letGo` revokes every URL as the Reading ends. Whether a bed
is held across two Scenes is still decided by the Sound's address, which the bed
keeps, and never by the element's `src`, which is now a `blob:` URL.

### Why the audio output is opened at *Begin*

The first Sound a page plays waits on the browser opening its audio output,
however long its bytes have been in. Measured in headless Chromium on one
fixture, four Readings at a time, the first strike of a page fired `playing`
43 to 141 ms after its frame, against 18 to 46 ms for the same strike played
again; on a loaded machine it was measured at 389 ms. So the Reading opens the
output as it is mounted, which is inside the press on *Begin*: where the beat
it opens on plays nothing on either element, the strike plays a hundredth of a
second of silence, a WAV written into the page as a `data:` address. The first
strike then fired `playing` 13 to 24 ms after its frame, the same as every
later one.

It is done only while sound is on and only in a Story heard at all, and it plays
silence, so it changes nothing of the consent
`docs/adr/0063-a-story-opens-on-its-title-card.md` settles: the press that
consents to the Story's Sound is the press that opens the output it is heard
through. Played inside the press too, it satisfies the browsers that play only
inside one. It is played on the `strike` element itself, so the Story is still
heard on two elements and no third.

## Consequences

A Reading of a hundred beats holds a hundred encoded Images, tens of megabytes,
which a browser manages itself, and its Sounds besides: forty library beds are
about 6 MB, and Authors' own Sounds at the 2 MB cap are tens of megabytes. If a
long Story shows memory trouble on a phone, holding only what is within some
beats of the Path is the next step, for both. Smaller Images for smaller screens
stay out, for 0005's one Image per row.
