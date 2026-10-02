---
status: accepted
---

# A Reading is counted for its Author

Decided on 2026-10-02, issue #430. Amends
`docs/adr/0038-a-reading-is-kept-in-the-readers-browser.md`.

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
holds: its Path, its State, the Exits it took and the answers it gave stay in the
Reader's browser. Two things now do reach the server, which are that a Reading
began and that it ended, and in which Scene. Each is added to a number and kept as
nothing else. `reading_counts` holds a Story, a kind, the subject it is counted
under (the Story for `begun`, the Scene for `ended`) and an integer. No address,
no user agent and no Path is written anywhere.

## How it squares with 0023, 0027 and 0028

Those three refuse a count: *nothing is counted … nothing to play and nothing to
farm*. What they refuse is a public score, a number that orders what other people
see and so is worth inflating. This count is shown to the Story's Author alone,
on their bench and on their shelf. It is not on the reading page, the embed, the
Catalogue, a Profile or a List, and nothing is ordered by it. Inflating it changes
nothing anybody else sees, so there is still nothing to play.

## Why it is indicative, not audited

`POST /api/read/:id/begun` and `POST /api/read/:id/ended` need no session, and
anyone can send them. Each is one upsert that counts only for a published Story,
and an ending only in a Scene the Story's Edition holds, so the rows stay as many
as the Story's own Scenes. Both answer 204 whether they counted or not, so they
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
