---
status: accepted
---

# The Catalogue is ordered by nothing counted

Decided on 2026-10-11, in a design session held before any issue. Amends
`docs/adr/0023-being-published-and-being-found-are-two-acts.md`.

The Catalogue has been every Listed Story at once, most recently published first,
in one answer with no limit. That holds for a dozen Stories and not for the few
hundred this is now designed for. So the Catalogue is searched, filtered, sorted
and cut into pages, and the first thing settled was what it may be sorted by.

**It is sorted by what a Story is, never by what anybody did with it.** There are
four orders: most recently Listed, which is the default; shortest and longest
Reading Time; and a shuffle drawn from the day, the same for everybody on that day,
so that page two never repeats page one. Nothing is sorted by Readings,
Favourites, Comments or anything else counted. ADRs 0027, 0028 and 0072 each
refused a public score in passing, and this says it once for the Catalogue. The
Readings counted for an Author arrive through routes that need no session, so any
of them can be inflated by hand, and a number that decides who is seen first is
the number worth inflating. A small community ranked by popularity also hands the
shelf to whoever arrived first. The shuffle is what gives an older Story its turn
at the top without a score.

**Most recently Listed means the first time.** A Story is sorted by the day it
first entered the Catalogue, kept once and never written again. Until now it was
the first Publish, but a Story published to three friends in January and Listed
in October is new to the Catalogue in October. It is not the last Edition either,
nor the last time the Story was Listed, because republishing, or unlisting and
listing again, every morning would keep a Story on top.

**A Story is found by its words, its Genre, its Language and its Reading Time.**
One field searches the title, the Synopsis and the Author's Name. A Genre comes
from a closed set that Frameline writes and translates, one or two per Story, and
is asked for in the listing the way a Name is
(`docs/adr/0025-a-name-is-asked-for-in-the-listing.md`). Free tags were refused.
Written by Authors, they come apart by Language — *mémoire* beside *memory* — and
at this size most would hold a single Story. They would also be public text with
nobody to answer for it, and the Synopsis already carries the words a tag would.
No Language is preset from the visitor's Locale: the two are kept apart
(`docs/adr/0013-the-interfaces-locale-is-not-the-storys-language.md`), and a small
Catalogue split five ways would look empty.

**Reading Time is the longest Reading, estimated.** A Reader deciding whether to
begin wants to know how long it takes, and a Reader is never told how many Shots
or Scenes a Story holds (`docs/adr/0054-the-reader-is-shown-what-the-author-wrote.md`).
So the Edition is measured in time. Each Shot weighs the longest of three times:
what its clock gives it, its words read at about two hundred a minute, and the
time its text takes to arrive. A Shot without words is given a floor of a few
seconds. The Story weighs its heaviest route from the Opening Scene to an ending.
A Scene is entered once and an Exit only leads onwards
(`docs/adr/0048-a-scene-is-entered-once.md`), so the Graph has no cycle and the
heaviest route is found in one pass. Conditions are left out, so the figure is an
upper bound and is shown as one: *up to 20 min*. It is measured at every Publish,
beside the Edition. It is shown as one figure and not a range, because showing
the shortest Reading would tell a Reader there is a quick ending to find.

**The whole state of the Catalogue is its URL.** The search, the filters, the
order and the page all sit in the query string, so a narrowed Catalogue is a link
to Share. Pages are numbered and hold twenty-four Stories each, drawn on the
server. An endless scroll was refused because it breaks the Back button and loses
the place a Reader had reached. A page of fixed size also caps how many Covers one
view pulls through the database, which the free quota needs (issue #499).

## Consequences

**The same URL shows everyone the same Catalogue**, except for Stories For Adults
(`docs/adr/0091-a-story-for-adults-is-read-behind-an-account.md`). Nothing else in
it depends on who is looking, which is what lets it be cached in front of the
database. A filter for the Authors one follows was considered and dropped for that
reason. The Feed does that work
(`docs/adr/0088-an-author-knows-who-follows-them.md`).

**A number shown is not a number ranked.** A card says how many Comments a Story
has (`docs/adr/0086-a-comment-may-answer-another.md`), and nothing is sorted by
it.
