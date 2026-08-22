---
status: accepted
---

# Refetch is for a refusal

Every write in the editor used to read the whole Story back afterwards, refused
or not. The reason was a good one: a form here edits the fetched Story in place,
so a change the server turned down would otherwise sit on screen as though it had
persisted. But a read that lands while the Author is still typing replaces the
field they are typing in, and the keystrokes go with it. Writing a Condition's
Flag name and then its value lost the value: moving focus from the name to the
value wrote the name, and the read that followed came back with the value still
empty and emptied the field. Under a slow connection the same read swallowed a
Condition that had been added but not yet written at all.

So the Story is read back when a write is **refused**, and not when it succeeds.

## Considered Options

The alternative we expected to take was to apply each response instead of
refetching — every write already answers with the row it wrote. It is more code
for the same benefit, and it does not cover the Condition that was added and
never written, because no response describes a row the server was never told
about. Holding what is being typed apart from what was fetched would cover
everything, but it is a shape change across both editor pages and the Conditions
component, in exchange for a case the cheaper answer already handles.

The line is not success against refusal, though — it is **typed against
clicked**, and finding that out is what made the cheap answer viable. A click
that alters the shape of the Story learns its result from the server and nowhere
else: a Shot added has no other way onto the screen, a Shot moved is a swap of
two rows the server picks, and a delete answers with nothing to apply. Those keep
reading the Story back. What the Author typed is already on screen in the field
they typed it into, so those read back only when refused. `useEditing` offers the
two as `change` and `write`, named rather than switched on a flag, because the
call sites divide cleanly and a boolean at a call site says nothing about which
kind of write it is.

One typed field had to be brought into line first. The Flags a Scene sets on
entry are drawn from what the Scene carries rather than bound to it, so that
field alone had no on-screen result of its own and depended entirely on the read
that followed. It now writes the parsed Flags onto the fetched Scene as well as
into the request — which is also what keeps `courage=high` snapping to
`courage = high`, since that canonical form was the refetch's doing.

## Consequences

A refusal still reads the whole Story back, and so still takes any other field
mid-typing with it. That is the original problem in miniature, kept deliberately:
a refusal is the one moment where what persisted matters more than what was
typed, and making it granular means buying the shape change we just declined,
for a path the Author reaches by accident.

The server trims what it stores — a Condition's Flag name and the value it holds.
A value typed with a trailing space is now stored trimmed and shown untrimmed
until the Story is next read for some other reason. Mirroring the trim in the
page would put one rule in two places and let them drift; the visible cost is a
space in a field the Author is looking at, which their next keystroke settles.

The end-to-end suite carried a helper that waited for each write to come back
before typing the next thing, which is not something an Author can do. It is
gone, and the test now types the Flag name, its value and a second Condition
straight through. That test is the check on this decision: if a typed write
starts reading the Story back again, it fails in the way the friction was first
met in.
