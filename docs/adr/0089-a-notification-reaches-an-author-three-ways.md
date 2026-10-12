---
status: accepted
---

# A Notification reaches an Author three ways

Decided on 2026-10-11, in a design session held before any issue. Amends
`docs/adr/0025-a-name-is-asked-for-in-the-listing.md`.

An Author should hear of what happens to their work without having to come and
look: somebody answers their Comment, copies their Story, gathers it into a
public List, or starts following them. **A Notification is kept for the Author in
Frameline, and can also reach them on their device and by email.**

**What notifies.** A Notification is sent for:
- a Comment under one of their Stories;
- an answer to one of their Comments;
- one of their Stories copied by another Author
  (`docs/adr/0090-a-story-may-be-open-to-copying.md`);
- one of their Stories gathered into a public List.

A new follower notifies in Frameline only
(`docs/adr/0088-an-author-knows-who-follows-them.md`). What the Feed already
shows does not notify as well.

**In Frameline, always.** The header shows how many are unread, and a page lists
them all.

**On the device, by web push**, turned on device by device from that page, and
sent as things happen. This needs a service worker that delivers push and does
nothing else, with no offline cache, and a web app manifest. On iOS, a push
arrives only when Frameline has been added to the home screen.

**By email, at most once a day.** Each email gathers that day's Notifications and
is sent only on a day that brought some. It is on by default, and every email
carries a one-click unsubscribe. A daily gathering rather than one email per
event keeps a burst of Comments from becoming a burst of emails, and keeps the
volume inside a free sending allowance. Frameline pays no monthly bill, so the
provider and the daily schedule are chosen in a research note within what the
free tiers of the provider and of Vercel Hobby allow.

**Settings are per channel**: email on or off, and push on or off for each device.
There are no settings per kind of Notification. A Notification disappears when
the thing it is about does, for example a Comment taken away or a List made
private again. A Notification that has been read is deleted after ninety days.

**The settings live on a page of their own: Settings.** 0025 refused a settings
page because *a settings page for one field is a room built to hold a single
chair*. It now holds three things: the Name, the Notification channels and
whether the Author sees Stories For Adults
(`docs/adr/0091-a-story-for-adults-is-read-behind-an-account.md`). The Name moves
there from the list of the Author's own Stories. The listing still asks for a
missing Name, as 0025 decided.
