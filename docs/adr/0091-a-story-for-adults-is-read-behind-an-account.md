---
status: accepted
---

# A Story For Adults is read behind an account

Decided on 2026-10-11, in a design session held before any issue. Amends
`docs/adr/0038-a-reading-is-kept-in-the-readers-browser.md` and
`docs/adr/0068-a-story-plays-inside-another-page.md`.

An Author may write for adults, and a Genre would protect nobody, because a Drama
with one explicit scene is filed as a Drama. So being for adults is a mark of its
own. **For Adults** is set by the Story's Author, and the Genre for erotica sets it
whatever else the Author says.

**A Story For Adults is presented and read only to an Author who has said, in
their Settings, that they are an adult and want to see such Stories.** Without
that setting:
- the Story is left out of the Catalogue, the Profile, every public List and the
  Feed;
- its link asks the visitor to sign in and turn the setting on;
- it never plays inside another page, because a frame on another site carries no
  session.

With the setting on, its Cover is shown like any other and nothing asks again.
When its link is unfolded elsewhere, it never shows the Cover.

Another option kept the Reader free of any account: hide the Story from the
shelves, and leave its link readable after a warning on the title card. It was
refused, because a lock that opens for anyone holding the link is not a lock.

**Pornographic content is not allowed at all**, and the terms of use say so. Our
understanding, still to be confirmed, is that French law requires a real check of
age for pornographic content (article 227-24 of the Code pénal, and the SREN law
of 2024), and a person's own declaration is not such a check. Frameline checks
nobody's age. Before this ships, a research note in `docs/research/` will say
whether the declaration in Settings is enough for what remains. That note will
also answer the questions `docs/adr/0087-anything-public-can-be-reported.md` leaves
to it.

## Consequences

**A Reader needs no account, except for a Story For Adults.** 0038 kept every
Reading account-free by design, and this is the one exception.

**A Story For Adults cannot be embedded.** 0068 gives every published Story a page
made to be framed, and this Story is the one exception.

**The Catalogue is no longer the same for everyone.** Anyone with the setting off,
including a visitor without an account, sees one Catalogue, and that one can still
be cached. Those with the setting on see that Catalogue with the Stories For
Adults added (`docs/adr/0084-the-catalogue-is-ordered-by-nothing-counted.md`).
