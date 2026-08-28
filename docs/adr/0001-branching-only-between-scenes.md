---
status: accepted
---

# Branching happens only between Scenes, never between Shots

Every comparable tool — Twine, Ink, Arcweave — branches at the level of the
individual text passage, which means the story graph has one node per passage and
becomes unreadable past a hundred of them. We instead make a Scene a strictly
linear run of Shots and allow Cuts only between Scenes, so that a Story graph has
one node per Scene.

## Considered Options

Branching at the Shot level was the obvious choice and we rejected it. It is more
expressive — an author can fork mid-sentence, as Ink's weave syntax allows — but
it collapses the distinction we are actually selling: inside a Scene you are
doing montage, at a Scene boundary you are doing dramaturgy. It also makes the
graph editor unusable at realistic story sizes.

## Consequences

**Still holds since a Shot may carry a Condition** (#31, ADR 0004). A Shot whose
Conditions fail is dropped from the run this Reading plays; the run is still a
run, read start to end, with no Cut inside it and nowhere for the Reader to
choose. What varies between Readings is the length of the line, never its shape,
so the Story graph still has one node per Scene and no edge lives inside one.

An author who wants to fork mid-Scene must split the Scene in two. This is a real
loss of convenience and the most likely source of early complaints; the answer is
a "split Scene here" action in the editor, not a change to this decision. The
Shot ordering within a Scene can stay a simple ordered list rather than a graph,
which keeps both the schema and the state engine substantially simpler.

## Since

A Cut is now an Exit, shown as _Sortie_ — see
`docs/adr/0022-the-metaphor-stops-at-the-edge-of-the-work.md` and the glossary in
`CONTEXT.md`. What was decided here is untouched by the renaming: read Cut as
Exit throughout.
