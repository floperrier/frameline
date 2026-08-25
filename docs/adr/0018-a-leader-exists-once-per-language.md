---
status: accepted
---

# A Leader exists once per Language

A Leader — the short Story a new Author is given, three Scenes written to be
taken apart rather than read — is written once per Language, as a work of its
own. `demonstration/leaders.ts` holds two of them, one English and one French,
and an Author is given the one their Locale asks for at the moment their account
is created. Nothing translates between the two at read time.

This is `docs/adr/0013-the-interfaces-locale-is-not-the-storys-language.md`
followed through to the one place it bites. A Story's Language is a column on the
Story, and nothing translates a Story; a Leader is a Story like any other, so a
Leader cannot be one work read in two languages. Two works is the only shape the
engine already understands.

So a Leader's text does not live in `i18n/locales`. The message files are the
interface's, and every key in them is one string shown in whichever Locale the
person reading has: that is chrome, and a Leader is not chrome. It is a work,
and it sits beside the other work this repository holds, *Reel Change*, under
the same types and written into an instance by the same writer.

## Considered Options

**One Leader, with its text in the message files.** The tempting one, because
the interface already has a translation mechanism and this would reuse it. It
breaks on the Story's own Language: the Story planted in the account would have
to carry a Language, and whichever one it carried would be a lie for the Author
reading the other. It also puts a work's prose in the same file as button
labels, where the next person to touch it has no way to tell one from the other.

**Reel Change as the Leader.** It exists, it is written, and it has stills. It
is also five Scenes of a short film with an ending, English only, and the wrong
length: a Leader has to be legible in under a minute and read like a diagram of
the product, and *Reel Change* is deliberately neither. It stays the
demonstration.

**A Leader per Locale rather than per Language.** The same thing said with the
wrong word, and it would drift the moment the interface gained a third Locale
with no Leader written for it. The set of Languages a Leader exists in is the
set of Leaders somebody has written, which is a fact about `leaders.ts` and not
about `i18n/locales`.

## Consequences

**The Leaders agree in structure and share nothing else.** Their Scene names,
their prose, and even the names of the Flags they set are each language's own.
`tests/unit/leaders.spec.ts` holds the two shapes against each other — how many
Scenes, which Shot shows which still, which Scene leads to which, and what each
Condition tests, all by Place rather than by name — and asserts that not one
line of what they say is shared. No test holds their text against the other's:
neither is a translation of the other, and a spec that checked otherwise would
make them one work again.

**A Language with no Leader written is an ordinary case.** An Author whose
Locale has no Leader is given none, which is the same page every Author saw
before Leaders existed. Adding a Language means writing a work, not filling in
keys.

**The stills are committed bytes.** A Shot may carry a JPEG, a PNG or a WebP,
read from its own first bytes, and the demonstration develops its stills through
ImageMagick, which is not on the runtime this deploys to. So a Leader's stills
are developed once, by the demonstration's own pipeline, and checked in as WebP
under `demonstration/stills/` — `demonstration/stills.ts` is what develops them
from the recipes in `leaders.ts`. They are the one thing the two Leaders share,
because a diagram of the product carries no words.

**A Leader is not special once it is planted.** It is the Author's Story: they
open it on the bench, change it, publish it, delete it. Nothing marks it, and
nothing puts it back.
