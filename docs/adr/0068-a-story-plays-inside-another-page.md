---
status: accepted
---

# A Story plays inside another page

Decided on 2026-10-02, issue #414.

A published Story travels as its link, and the link unfurls as a card wherever
it is pasted (`docs/adr/0063-a-story-opens-on-its-title-card.md`). That still
sends every Reader away from the page where they found it. An Author with a blog,
a portfolio or an itch.io page could not put the Story *in* that page. Framing
`/read/<id>` by hand showed the whole reading page squeezed into somebody else's
column, with its wordmark, *Favourite*, the way to the Catalogue and the
Comments form. And nothing stopped any site from framing the bench itself: no
response said who may frame it, so a hostile page could lay the bench under a
decoy and have it pressed.

**A published Story gets a page made to be framed, `/embed/<id>`, and the bench
hands its Author the code that frames it. Every other response refuses to be
framed by another site.**

The page reads the Story through `GET /api/read/:id`, as the reading page does,
and gives the same not-found for a Story that is unpublished or was never
written. Like every public link it carries no locale segment
(`docs/adr/0012-the-public-link-carries-no-locale.md`), and the interface around
the Story is in the visitor's Locale. Before the Reading starts it draws the
title card, which is now one component, `TitleCard.vue`, drawn by both pages.
After the press, the card gives the frame over to the Reading, which is kept per
Story in this browser like any other. Under both there is one link, *Read on
Frameline*, to `/read/<id>`. That link and the Author's Name open in a tab of
their own, so a press never navigates the host's frame away from the Story. The
page names `/read/<id>` as its canonical address and asks not to be indexed, so
a search engine sends people to the reading page rather than to the bare frame.

On the bench, beside the public link, *Copy the Embed Code* writes one line to
the clipboard: an `<iframe>` of `{origin}/embed/{id}`, titled with the Story's
title, allowed `fullscreen` and `autoplay`, loaded lazily, as wide as the column
it is pasted into and 640 pixels tall. At that height a column 720 pixels wide
shows the card with its press, and then the Sample's opening Shot, which is laid
out full, with *Next Shot* under it. A Shot taller than the frame scrolls inside
the frame. There are no options. The code is one code.

## Why a page of its own and not a flag on the reading page

Who may frame a page is decided by the page's address, before anything on it
runs. A flag on `/read/<id>` would therefore make the reading page framable too,
by anybody, with everything it carries. Kept apart, the reading page goes on
refusing every other site, and the embed carries nothing that would need
protecting.

## Why it carries no Comments and no Gathering

Both need the Reader's session, and a browser does not send the session cookie
to a frame of another site. Inside a blog, the Comments form would ask a Reader
who is signed in to sign in, and *Favourite* would refuse them. So the frame
offers neither, and the one link it draws leads to the reading page, where both
work.

## Why everything else now refuses framing

Framing was not refused anywhere before, so inviting it on one page is the day
to close the rest. `frame-ancestors *` on the embed is safe because the Story is
already public at its link, and the frame shows nothing the link does not. Every
other page and every `/api/**` response carries `frame-ancestors 'self'` and
`X-Frame-Options: SAMEORIGIN`. The second is for browsers that predate the
first. Frameline still frames itself freely, and nothing in it does so today:
the Preview draws the Reading in the page, not in a frame.

## Why the policy is set by a middleware rather than by `routeRules`

The issue asked for `routeRules`, where the `cache-control` of the public link
is set. That does not work for this policy. Nitro merges every rule that matches
a path (`getRouteRulesForPath` folds them with `defu`), and a more particular
rule can override a header but cannot remove one. So a `/**` rule's
`X-Frame-Options: SAMEORIGIN` would reach the embed, and the embed would then
depend on every browser letting `frame-ancestors` take precedence. On Vercel the
same rules are also copied into the platform's routes, where two of them would
set the one `content-security-policy` header and the platform would decide which
one wins. `server/middleware/frames.ts` sets one policy or the other on each
request, from its path, and nothing has to be merged. The embed takes the public
link's `no-store` in `routeRules`, beside `/read/**`, because an unpublished
Story must stop answering inside other pages as it stops answering at its link.

One consequence is accepted rather than worked around. Nuxt draws a not-found
through a request of its own to `/__nuxt_error`, and the headers of that
response replace the page's. So the embed of a Story unpublished after its code
was pasted is refused its frame by the browser, rather than saying *No such
Story.* inside it. Opened directly, it is the reading page's not-found. Making
the error page framable would mean reading Nuxt's internal route in the
middleware, and leaving the error handler's `X-Frame-Options: DENY` for the
browsers to ignore, for a page whose only message is that the Story is gone.

## Left out

An oEmbed endpoint or discovery tag. Resizing the frame to its content through
`postMessage`. Embedding an unpublished Story, a List, a Profile or the
Catalogue. Counting where a Story is embedded. Options in the code.
