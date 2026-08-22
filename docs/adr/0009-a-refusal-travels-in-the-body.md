---
status: accepted
---

# A refusal travels in the body

Every refusal the editor shows an Author started life as a `statusMessage` on
`createError`, and h3 answers each one with a warning: it means to sanitize that
field, and sanitizing it means stripping everything outside ASCII. The
sentences here are written with the punctuation they need — `A Flag is a name
and a value, written “courage → high”.` — so the field they rode on was
scheduled to take the quotation marks and the arrow out of them, and the
sentence itself soon after, leaving the Author reading "That did not work."

The reason `statusMessage` was ever readable from the page is the reason it gets
sanitized: on the client `error.statusMessage` is the HTTP reason phrase, so the
refusal was travelling on the status line, where a header's rules apply. A
`message` arrives in the JSON body instead. So every refusal is a `message`,
and `useEditing` reads `error.data.message`.

## Considered Options

Keeping `statusMessage` and writing the sentences in ASCII was the smaller
change, and it is the wrong one twice over: the Author would read a worse
sentence, and h3's plan for the field would still arrive.

Setting both fields everywhere reads as belt and braces and is neither. Two
copies of the same sentence drift, and the copy on the status line is the one
about to be sanitized, so the belt is the part that breaks.

## Consequences

One refusal is written twice, and it is the one a Reader reads. Nuxt hands its
error page a fatal error, and nitro replaces a fatal error's `message` with
"Server Error" before it leaves the server — so `statusMessage` is the only
sentence that survives to someone who opens the link to an unpublished Story.
`notFound` therefore carries both. `No such Story.` is ASCII and stays that way,
so sanitizing costs it nothing, and the end-to-end suite reads the words off
that page rather than only its status: it asserted `404` alone before, which
`404 Server Error` would have passed.

The refusals a Reader never sees stay single. An editor refusal has one home,
the body, and the end-to-end assertions on them read `message` out of the parsed
response rather than matching the response text, so a refusal that slid back
onto the status line fails them instead of passing by accident.
