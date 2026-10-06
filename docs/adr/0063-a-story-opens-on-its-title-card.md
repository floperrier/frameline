---
status: accepted
---

# A Story opens on its title card

Amends `docs/adr/0049-a-sound-is-carried-by-what-plays-it.md`, whose paragraph
*The press on the title card is the consent* said that *a silent Story keeps the
page it had*. Decided on 2026-10-02, issue #409.

A silent Story used to open with its Reading already playing under a small title
card. That spent three things the Reader had not yet looked at:

- **The first beat's arrival and its clock.** An Image coming from white, a text
  arriving after a while, a Movement closing in: all of it played while the
  Reader was still reading the title. A Scene cut by the clock started counting
  as the page loaded, so its first Shot could be gone before the Reader looked
  down at it.
- **The window.** A beat laid out full makes the Reading one room tall, but that
  room started under the title card, so its foot was below the fold: on *Reel
  Change* at 1440 × 900 and at 390 × 844, *Next Shot* was off the screen. The
  Reader scrolled before the first beat could be read or left.
- **The presentation.** The Synopsis is carried by the Story wherever it is
  presented, and reached the link's unfurl card, but not the page the link opens.
  The Author's Name was signed under the Reading rather than where the work is
  named.

**Every Story opens on its title card.** The Cover drawn as wide as the column
the Reading stands in, in a 16 / 9 frame cropped around the Author's point; the
title; the Synopsis where one is written; *By {Name}* where the Author has a
Name; and one press, *Begin*, or *Resume* where this browser kept a Path. A Story
with no Image is presented by its words alone.

**The press mounts the Reading and brings its head to the window's head.** The
first beat arrives, and its clock starts, under the Reader's eyes, with its words
and its own press in the window at every width. The jump is instant, as the jump
a press onto a full beat already makes inside the Reading. The focus goes where a
press always puts it. For a Story that carries a Sound the same press is still
the consent, and Sound is on from it, as 0049 says.

**The Reading stays in the page.** The card is not replaced and the Reading does
not take the window away: the press scrolls, so *Favourite* and the Story's name
are one scroll up and the page is still one document with the Comments under it.

## Considered Options

**Keeping the silent page and only scrolling it.** It fits the first beat in the
window, but the arrival and the clock still run before anybody asked for them,
and the Story is still not presented where it is opened.

**A Reading that takes the window over** — an overlay, or a route of its own. A
second surface to keep in step with the first, for a jump a scroll already makes.

## Consequences

- One press more for a silent Story. A film opens on its title before its first
  shot, and this is that title.
- The reading page renders no Reading on the server at all. The title card is
  still the server's, so the page answers with JavaScript off and unfurlers read
  it as before, but there is no opening beat in the response.
- So `docs/adr/0060-the-seed-is-carried-to-the-browser.md` has nothing to carry
  on the reading page: every Reading a Reader opens is set up in the browser and
  draws its seed there. Its code stays. `useState` draws the seed in the browser
  when no payload holds one, which is now always the case, and a server that
  renders a Reading again carries it without a line changed. The same holds for
  the flash rule's `painted`, which reads `false` for a Reading mounted by a press.
- The Preview is unchanged. It draws the Reading directly and has no title card,
  and the control that turns the bench to it is the press, as 0049 already says.
