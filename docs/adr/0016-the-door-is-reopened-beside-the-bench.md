---
status: accepted
---

# The door is reopened beside the bench

Nothing signs an Author out on a timer. The cookie `nuxt-auth-utils` writes has
no `Expires`, because `nuxt.config.ts` sets no `session.maxAge`, and the seal
around it is made with `ttl: 0` — never. An Author stays in until the browser is
closed, the cookie is cleared, they sign out, or a deploy rotates
`NUXT_SESSION_PASSWORD` and invalidates every seal at once. That is the whole
list, and it stays the whole list: no expiry is added.

When a refusal from one of those four does arrive, it arrives on a page that is
already open, mid-edit. The Author is not sent anywhere. The refusal says what
happened and offers the door in a second tab, and the tab holding the Story is
never navigated, so the field being typed in when the door shut is still there
to be written when it reopens.

## Considered Options

**An expiry, with a refusal to match.** The obvious reading of "an expired
session" is that sessions expire, so the first move is to make them: an hour, a
week, a sliding window. It buys nothing here. There is one Author per Story,
nothing is shared, and the editor holds no secret a stranger at the same machine
could not already read from the Stories list. What an expiry does buy is a new
way for an Author to lose their place, on a clock nobody asked for. The default
that shipped — out until the browser closes — is not an oversight to be
corrected; it is the right answer arrived at by not being changed.

**Sending the Author to the door.** Redirecting on a `401` is what most
applications do, and it is the version of this that loses work.
`signInAuthor` ends with `sendRedirect(event, '/stories')`, a fixed
destination, so a same-tab sign-in does not even come back to the Story. Adding
a return address would fix the place and not the writing: the page reloads, and
what was in the field goes with it.
`docs/adr/0008-refetch-is-for-a-refusal.md` already refused the smaller version
of this — reading the Story back over what the Author is typing — and a
redirect is the same tort with a wider blast radius.

**Keeping the draft.** Writing the unsent field into `localStorage` and replaying
it after sign-in makes the redirect safe. It also makes the product one that
holds drafts: what is kept, for how long, whose, what happens when the Story it
belonged to is gone, and what the Author sees when a replay is itself refused.
That is a feature, not a mitigation, and the second tab makes it unnecessary.

**The phrase written on the client.** `requireUserSession` refuses with
`message: "Unauthorized"`, hardcoded English, which nitro passes through in the
body — so `useEditing` reads it and shows it, and a French Author reads an
English word nobody wrote. The one-line fix is to catch `401` on the client and
substitute a phrase of our own. It leaves the raw string reachable from anything
that does not go through `useEditing`, and it puts this one refusal somewhere no
other refusal lives. `server/utils/phrases.ts` settles the language of every
refusal from the request that asked; this one goes through it too, via a
`requireAuthor` that the twenty-three call sites use in place of the bare
`requireUserSession`.

## Consequences

An Author who loses the door mid-edit loses, at most, the field they are typing
in — and only if they choose to leave the tab. Every write fires on `change`,
which is to say on blur, so everything already left is in the Story.

The refusal carries a gesture, which no other refusal does. `problem` grows room
for one optional action rather than a taxonomy of refusal kinds, and the page
attaches it on the `401` status alone: the phrase cannot say whether a door
belongs beside it, so the status decides that and the server decides the words.

The door offered is the landing page rather than a provider, because the session
records no provider — only `{ id, email, name }`. The Author picks GitHub or
Google again as they did the first time, and the second tab lands on the Stories
list, which is how they see the door is open before coming back to try again.

Nothing announces that it reopened. The page does not watch for the door, so the
refusal stays on screen until the Author acts, and the next attempt clears it.
