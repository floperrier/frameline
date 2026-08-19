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

An author who wants to fork mid-Scene must split the Scene in two. This is a real
loss of convenience and the most likely source of early complaints; the answer is
a "split Scene here" action in the editor, not a change to this decision. The
Shot ordering within a Scene can stay a simple ordered list rather than a graph,
which keeps both the schema and the state engine substantially simpler.
