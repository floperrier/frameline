---
status: accepted
---

# A Reading is counted for its Author

Decided on 2026-10-02, issue #430. Amends
`docs/adr/0038-a-reading-is-kept-in-the-readers-browser.md`. Amended on
2026-10-02, issue #431, with the Exits a Reading takes.

An Author publishes a Story, hands out its link, lists it in the Catalogue, and
then hears nothing unless somebody with an account writes a Comment. Whether
anybody read it is the first thing anyone who publishes wants to know, and
Frameline could not say. **The bench now says how many Readings a published Story
has had, and how many reached an ending**: *34 Readings begun, 12 ended.* on the
line beside the public link, and *34 Readings* beside the Comments on the shelf.

A Reading is **begun** when the Reader presses *Begin* on the title card and the
Reading starts at the opening, on `/read/<id>` or `/embed/<id>`. One picked up
from a kept Path was begun on an earlier visit and is not begun again. *Read
Again from the Start* begins a new one. A Reading is **ended** when it reaches its
ending, counted once per Reading under the Scene it ended in. The Preview, the
Story's own Author signed in and reading their own link, and an unpublished Story
are never counted.

## What it amends in 0038

0038 says *Nothing reaches the server.* That still holds for everything a Reading
holds: its Path, its State and the answers it gave stay in the Reader's browser.
Three things now do reach the server, which are that a Reading began, each Exit it
took, and that it ended, and in which Scene. Each is added to a number and kept as
nothing else. `reading_counts` holds a Story, a kind, the subject it is counted
under (the Story for `begun`, the Scene for `ended`, the Exit for `taken`) and an
integer. No address, no user agent and no Path is written anywhere, and nothing
ties one count to another: the Exits one Reading took are as many numbers, each
one more, and never a route.

## How it squares with 0023, 0027 and 0028

Those three refuse a count: *nothing is counted … nothing to play and nothing to
farm*. What they refuse is a public score, a number that orders what other people
see and so is worth inflating. This count is shown to the Story's Author alone,
on their bench and on their shelf. It is not on the reading page, the embed, the
Catalogue, a Profile or a List, and nothing is ordered by it. Inflating it changes
nothing anybody else sees, so there is still nothing to play.

## Why it is indicative, not audited

`POST /api/read/:id/begun`, `POST /api/read/:id/ended` and
`POST /api/read/:id/taken` need no session, and anyone can send them. Each is one
upsert that counts only for a published Story, an ending only in a Scene the
Story's Edition holds and a take only of an Exit it holds, so the rows stay as
many as the Story's own Scenes and Exits. Both answer 204 whether they counted or not, so they
say nothing about whether a Story exists. A request sent by hand inflates a
number only its Author reads, at the cost of nobody but that Author. The count is
an indication of whether a Story is being read, never a figure to be audited.
Telling Readers apart, filtering bots and rate limiting are left out.

## Why no Reader is told apart

A Reader needs no account by design (0038), and so carries nothing to be told
apart by. The routes set no cookie and start no session. The session is read only
where the request already carries one, which is how the Story's own Author is
recognised and not counted. Telling one Reader from another would mean keeping
something about them, which is exactly what 0038 keeps off the server. So a
Reader who begins twice is two Readings. *Reading* is the glossary's word for
what is counted, and the count never claims to be a number of Readers.

The Reading does not wait on its count. `Reading.vue` sends with `fetch(…, {
keepalive: true })`, never awaits the answer and swallows any failure. A count
that fails is lost, and the Reading goes on.

## The Exits taken

*Added by issue #431.* A Story branches, and how many Readings began says how many
read it but not which Story they read: whether anybody opens the cellar door,
which of four endings almost everybody reaches and which nobody does. That is the
one thing a branching work can teach its Author that a book cannot, and a path
nobody takes is either a door too well hidden or a Scene that can go. So **the
bench says, beside each Exit, how often Readers took it**, *Taken 20 times (62 %)*,
and in the opening line of each Scene a Reading ended in, *12 Readings ended here*.
The share is out of every take of the Exits the Scene holds, so they add up to a
hundred, each rounded to a whole one. Both are quiet text on the bench and nowhere
else, shown only while the Story is published; the Preview, the reading page, the
embed, the Catalogue, a Profile and a List say none of it, because the Reader is
shown what the Author wrote
(`docs/adr/0054-the-reader-is-shown-what-the-author-wrote.md`).

An Exit is **taken** the way a Reader takes it: by a press, by the clock where the
Exits stand for a time, or flowing on where the Scene gives them none. Each is
counted once per Reading. A step back across an Exit and the same Exit taken again
adds nothing; a Reading picked up from a kept Path starts with the Exits it holds
already told, since they were told on the visit that took them; *Read Again from
the Start* begins a Reading whose takes are its own.

An Exit is counted under its own id. The bench is answered the counts under the
Exits and the Scenes the Story still holds, so one deleted since is not shown,
though its endings stay in the sum the header says. An Exit deleted and written
again is a new Exit and starts at nought. The counts run across every Edition from
the moment they were kept, and a Publish resets nothing.

## What a count after a Question says

`docs/adr/0066-a-scene-may-end-on-a-question.md` promises that what a Reader types
never reaches the server or the Author, and that still holds: the answer stays in
the Path, and no route carries it. But an Exit offered only on one answer, once
its takes are counted, tells the Author how many Readings gave that answer — that
is what offering it on that answer means. It never says what any one Reader
wrote, nor which Reading gave it: a take is one more on a number, and nothing
about the Reading that took it is kept beside it.
