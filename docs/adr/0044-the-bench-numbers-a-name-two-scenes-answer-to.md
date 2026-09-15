---
status: accepted
---

# The bench numbers a name two Scenes answer to

Nothing stops an Author calling two Scenes the same thing. `readSceneName` in
`server/utils/scenes.ts` refuses an empty name and a name past
`SCENE_NAME_MAX_LENGTH`, and nothing else — and the bench writes the collision
itself: a Scene split twice leaves two called *{name}, continued*, and a Scene
written from nothing arrives under the provisional name every other one does.

A Scene is also what almost everything on the bench is named for. *Shot {place} of
{scene}*, *The image of Shot {place} of {scene}*, *of the image of Shot {place} of
{scene}*, *Writing {scene}*, *Go to {name}*, *the Exit {place} to {scene}, out of
{from}*: the Place tells two rows of one Scene apart, and until now nothing told
two Scenes apart at all. Two of one name therefore put two controls under one name
in every reading at once, and what that costs is what
`docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md` is
about — a screen reader announces two different acts in the same words, the bar of
Commands offers one name for two Scenes and running it presses whichever came
first, and a spec reaching for either breaks in strict mode.

Measured in Chromium against a production build, reading the names out of the
browser's own accessibility tree rather than off the template: on a Story of two
Scenes called *The bar* with an Image apiece, 22 names said twice in the writing,
4 of the Remarks' sentences and 2 on the Contact Sheet. On one whose ways on lead
to both of them and twice to one, the six marks that renumber the Preview's ways
on stood under two names between them, and the bar of Commands offered *Go to The
bar* twice.

**The name stays the Author's, and the bench numbers what it draws.**

`namesOnTheBench(story, say)` in `shared/utils/scenes.ts` is the whole of it: a map
of Scene id to the name the bench calls that Scene. The Author's own name where one
Scene carries it, and *{name} ({number})* — `editor.namedAlike` — where several do.
Every surface that names a Scene *as the bench* reads that map and nothing else, so
none of them can disagree about which *The bar* a control acts on: the writing, the
Contact Sheet, the Remarks, the rail's marks — and so the bar of Commands, which
reads its names off those marks — and the Preview's own controls.

Three things settle how the number is drawn.

**In the order the Story is written in**, `inDocumentOrder`: the one walk the
document's sections, the sheet's bands and the rail's columns are all laid out by.
The first *The bar* an Author meets reading down is *The bar (1)*, and no reading
disagrees with the page it is drawn on.

**Against the names it draws, not against the names it read.** A number that
collides tells nobody anything, and an Author arrives there by hand rather than by
accident: they read *The bar (2)* on the bench and type those words into the field
that names where a way on leads, which writes a Scene called exactly that. So the
number walks on past a name already spoken for — a Scene really called *The bar
(2)* beside two called *The bar* leaves *(1)*, *(2)* and *(3)*, all three
different.

**Never written back.** The number is drawn where a control is named, and nowhere
else. What the field holds, what a rename sends, the name a split writes and the
names offered in the list a way on is named from are the Author's own, because a
name typed there has to be the name the Scene is written under — typing *The bar
(2)* into it writes a third Scene, and then the numbering walks past that one too.

And it stops at the edge of the work, where
`docs/adr/0022-the-metaphor-stops-at-the-edge-of-the-work.md` stops every rule of
the bench. `Reading.vue` draws the frames and the buttons a Reader presses, in the
words the Author wrote, and the Preview runs the engine a Reader runs: two ways on
saying the same thing read alike there because the Story says so, and that is the
Story's defect to fix rather than the bench's to paper over. What the Preview puts
*around* that reading is bench — the marks that renumber a way on, the Scene it
says no Reading has reached, the visits it counts — and every one of them is
numbered like the rest.

The value in the message is `{number}` and not `{place}`. A **Place** is where a
Shot comes in its Scene's run or an Exit among the ways on offered at the end of
one; a Scene has none, and three neighbouring keys use that name for the real
thing. See `docs/adr/0014-the-glossary-is-the-codes-language.md`, which makes the
glossary the language of the code and not only of the screen.

## Considered Options

**Refusing the second name — a Story whose Scene names are unique.** It is the
bench correcting the work, which is the one thing nothing here does: a Remark
reports and never refuses. It would have to be refused at the API, where the
Samples and the demonstration write Stories too, and the bench would then have to
answer for the collisions it writes itself when a Scene is split twice. An Author
with two bars in their film has two bars.

**A Remark saying two Scenes share a name.** Advisory, and it does nothing at all
for the screen reader announcing two identical acts while the Author decides. It
would also read as the bench saying a Story is wrong, which no Remark does.

**The number in each key instead, `editor.shotOfScene` gaining a value of its
own.** Five keys, one per reading, each free to drift from the others, and a sixth
reading arriving would have to remember. What issue #284 asks is that this be
settled in one place; a map of names is that place.

**Something other than a number: the id, or the Scene's column in the Graph.** An
id is nothing an Author recognises. A column moves with the Story exactly as a
number does and says less.

**Numbering by the order the Scenes were created.** The document and the sheet are
laid out by the walk, so a number out of any other order would put *The bar (2)*
above *The bar (1)* on the page.

## Consequences

The number moves when the Story does. An Exit drawn above a Scene renumbers the
pair, the way the rail's columns and the sheet's bands already move under the same
walk — the Graph is a reading of the Story, see
`docs/adr/0041-the-graph-is-drawn-from-the-story.md`, and this is one more reading
of it.

`remarks()` takes the `Phrase` it reads with, because a Remark names a Scene by the
name the bench gives it and that name is a message rather than a column.

The property is held as a property rather than as the cases that found it.
`tests/e2e/bench-signed-in.spec.ts` builds a Story that collides every way at once
and asserts that nothing the bench offers answers to a name another thing it offers
answers to — over the three readings, the Remarks and the bar of Commands, in both
languages, at each of the five widths the layout folds at. A spec naming the
strings issues #276 and #284 produced would go on passing the day a seventh key
leaves a fact out.
