---
status: accepted
---

# A Sound is carried by what plays it

A Story is watched as well as read, and until now the only matter it carried was
a still image and words. A Scene is heard under something, and a beat strikes.

**The bytes live in the row that plays them.** A Scene's Sound is a `bytea` on
`scenes`, a Shot's is a `bytea` on `shots`, and both are served one request
apiece under the access rule of the Story they belong to. It is
`docs/adr/0005-a-shots-image-lives-in-its-row.md` read again, for the same
reason and at the same cap: nothing of the work lives outside the work, a
published Story depends on no file the product might later withdraw, and a
`bytea` that big is TOASTed out of the row by Postgres and never touched by a
query that does not select it — which is why `readStoryGraph` selects
`sound is not null` and never the column itself.

**A Scene may name a Scene instead of carrying bytes, one hop and no further.**
Depositing a 400 KB bed twelve times is work; naming is how an Author avoids it,
the way a Cover is named among the Images the Shots already carry. The
`<select>` offers carriers alone and the API refuses the rest in the body of the
response. A Shot has no such column deliberately: a struck sound weighs 20 KB
and is re-picked from the library in one press, and a column to save 400 KB is
not a trade worth making.

**A Sound is the carrier's, entire.** The bytes, the Transcript and whether it
loops all live on the row that carries them, and a Scene that names another
reads all three off the Scene it names. So the same rain is transcribed once,
and two Scenes heard under one Sound cannot disagree about whether it loops.

**Two kinds, and Opus refused.** AAC in an MPEG-4 container and MP3, read out of
the first bytes on the way in and again on the way out — never declared by the
client. Opus is the best ratio of the three and is refused because of Safari:
Opus in Ogg does not play there at all, and a Sound is one deposit served exactly
as it was given, so there is no second `<source>` to fall back to. Accepting a
file a third of Readers cannot hear would be a trap laid at the Author's expense.

**What crosses the cut is the carrier.** Within a Scene the bed holds from Shot
to Shot and never restarts on a press; between Scenes it goes on uninterrupted
when the carrier is the same — B names A, A names B, or both name C — and stops
otherwise. Held in a loop it repeats until the Scene is left; played once it
falls silent and the Scene stays silent. A Shot's Sound strikes when the Shot
plays, does not loop, and lies over the bed without ducking it. There is no
mixing and no priority.

**A Sound is not a position.** Nothing records where it had got to and a Path
carries no seconds, so the bed restarts exactly when the carrier changes: a step
back inside a Scene touches nothing, and a step back across an Exit into a Scene
heard under something else starts that Sound from the beginning. A Shot played
again strikes again.

**The press on the title card is the consent.** A browser will not play sound
into a page nobody has touched, and a Reader who did not ask for it should not
be given it. So a Story that carries a Sound anywhere opens on its title card as
a control, and the Reading begins when it is pressed. A silent Story keeps the
page it had. Sound is then on, and the control that turns it off keeps its answer
beside the Path and never inside it — a Path is a reading of the Story, and
muting is a property of the person.

**The Transcript is always in the DOM.** Hidden, it is `visually-hidden` and
still read by a screen reader; it is never removed from the accessibility tree
and never announced in a live region, which would trample the reading.

## Considered Options

**Object storage, a CDN and a signed URL.** What `0005` refused for an Image and
refuses again here: a published Story would depend on bytes that live outside it,
and unpublishing would stop meaning anything.

**`Range` requests.** The endpoint returns the whole body. At a 2 MB cap the
browser buffers the file and can move inside it, and the cost is one function
invocation and one database read per Sound — which is what `0005` already
accepts per still. `Range` is the ceiling this decision is reopened at.

**A Sound named on a Shot as well.** Refused above: a column and a `<select>` to
save 400 KB.

**Mixing, ducking, or a priority between the two layers.** Out of scope on
purpose. A bed and a strike play together, and an Author who wants one quieter
records it quieter.

## Consequences

- A Scene whose carrier is deleted falls silent, because `sound_of_scene_id` is
  `on delete set null` — the Cover's own mechanism, for the Cover's own reason.
  Nothing in the Story then remembers it was ever heard, so no Remark can see it:
  the confirmation before the delete says it instead, and the same confirmation
  stands before *Remove the Sound* on a carrier another Scene names.
- A Remark is owed for a Sound nobody transcribed, and none for a silent Scene:
  silence is not a defect, and a Remark on every text-only Story is noise.
- The Preview needs no press. The control that turns to it is one, so sound is
  unlocked there already and `docs/adr/0030-a-story-is-read-where-it-is-written.md`
  holds without a word added.
- The Contact Sheet is unchanged. It is the Story seen rather than read, a contact
  sheet is silent, and the Transcript is written where the Sound is deposited.
