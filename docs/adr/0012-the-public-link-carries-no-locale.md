---
status: accepted
---

# The public link carries no Locale

The editor is served under `prefix_except_default`, so an Author works at
`/stories` in English and `/fr/stories` in French. The Reader's page is the one
route left out of it: `app/pages/read/[id].vue` carries
`definePageMeta({ i18n: false })`, and a published Story is readable at
`/read/<id>` and nowhere else, whatever language the person opening it reads.

ADR 0003 makes the public link a property of the Story rather than of an act of
publishing, and that is the whole of the reason. A locale segment would make it
a property of the browser the Author had open when they copied it: paste
`/en/read/<id>` to a French Reader and they get English chrome around a Story
the Author never chose the language of. The Reader has no account, so nothing
about them is known except what their browser announces — which is a better
guess than the Author's address bar.

## Considered Options

`no_prefix` for the whole application was the alternative that keeps one URL
everywhere, with the Locale held in a cookie. It costs the editor its
shareable, indexable localized routes, and it hides the Locale from the URL
entirely — the one place a person can see and change it by hand.

`prefix_except_default` with no exception was the other, and it is what the
module does if left alone. It is what this decision refuses, for the reason
above.

## Consequences

**A Reader's Locale on the public link comes from their browser alone.** There
is no route to switch to, so `/read/<id>` carries no language switcher: the only
thing it would offer to change is the chrome, and offering it beside an
untranslated Story reads as a promise to translate the Story.

**The exception is a page-level flag, not a route rewrite.** `i18n: false` is
the module's documented way to leave a page out of localized routing, so this
survives an upgrade as a supported option rather than as a workaround.

**`cache-control: no-store` on `/read/**` still holds, for its own reason.**
Nothing here changes what ADR 0003 says about caching; the two decisions only
share a route.
