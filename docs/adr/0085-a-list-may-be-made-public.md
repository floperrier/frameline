---
status: accepted
---

# A List may be made public

Decided on 2026-10-11, in a design session held before any issue. Amends
`docs/adr/0028-favourites-is-a-list-without-a-title.md`.

0028 kept every List private: *Public Lists would be a second surface of public
text to answer for and are out of scope until there is enough published to be
worth arranging.* What reopens it is the community itself. With no score to rank
by (`docs/adr/0084-the-catalogue-is-ordered-by-nothing-counted.md`), the way one
Author points another at a Story is by gathering it. A List with a title and a
reason is a recommendation somebody signed, and it cannot be farmed, because it
says nothing it does not say in words.

**A List is private until its Author makes it public.** A public List has a link
of its own, is drawn on its Author's Profile, and carries a few lines of theirs
saying why these Stories belong together. A List has only these two states. A
Story can be readable at a link and found nowhere (0023), but a List has nothing
between private and public. Favourites can never be made public: a single press
puts a Story there, and a press should not publish anything.

**A public List shows only Stories that are Listed.** A List may hold a Story that
is published but not Listed, because its link was sent to somebody who then kept
it. Drawn on a public List, that link would be handed to everyone, which is what
its Author refused by not listing it. So the public view leaves the Story out, as
0028 already leaves out a Story unpublished since it was gathered, and the row
stays where it is.

**Favourites may hold another Author's public List.** Keeping a List to come back
to is the same act as keeping a Story, so it goes in the same List with the same
press, and there is still no second mechanism. Only Favourites holds Lists. A List
with a title holds Stories alone, and nothing nests more than one step deep. A
List made private again drops out of the Favourites that kept it, and comes back
if it is made public again. Stories newly gathered into a List one keeps are
brought to one's Feed (`docs/adr/0088-an-author-knows-who-follows-them.md`).

## Consequences

**The Profile changes what it refuses.** The glossary said a Profile was never a
place where what an Author has said about other people's Stories is gathered up.
A public List is exactly that, by its Author's choice. A Profile still never
gathers their Comments.

**Who keeps a List is counted for its Author alone.** The Author of a public List
is told how many Authors keep it in their Favourites, and nobody else is told, in
the way 0072 keeps Readings for the Author.

**There is now a route that takes a List's id** and answers with its contents,
where 0028 said there was none. For a private List it answers the not-found that
everything unreachable gets.
