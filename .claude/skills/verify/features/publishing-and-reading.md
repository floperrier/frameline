# Publishing and reading

An Author publishes a Story from its bench, which makes `/read/<id>` answer.
Anyone with that link, signed in or not, plays the Story Shot by Shot and takes
Exits to an ending. Unpublishing takes the link away, and publishing again
gives the same one back.

## Sub-features

- `publish` turns the bench's button into the public link.
- `unpublish` makes the link answer 404 again.
- `read-shots` steps through a Scene's Shots.
- `read-exit` takes an Exit to another Scene.
- `read-ending` reaches the end of a path and offers to start again.
- `read-back` steps back over the Exit a Reader came by.

## How to get to it (user POV)

- On the bench, in **Where it can be read**, choose **Publish this Story**.
- A Reader opens the link the bench shows.
- From the reading page, **Find Stories in the Catalogue** leads to `/catalogue`.

## Driving it with drive.ts

Preconditions:

- A Story with at least two Scenes joined by an Exit, seeded as in `smoke.ts`.
- The Story is unpublished: `s.reader()` at `/read/<id>` answers 404 with the
  heading `No such Story.`

- **Publish.** On the bench, click
  `getByRole('button', { name: 'Publish this Story', exact: true })`. A link named
  with the full `http://localhost:<port>/read/<id>` appears, beside
  **List this Story in the Catalogue** and **Unpublish this Story**.
  ``sql`select published_at from stories where id = ${id}` `` is set.
- **Read.** In `await s.reader()`, `goto` the link: status 200, the Story's title
  as the heading, the first Shot's text in a `figure`.
- **Step through.** `getByRole('button', { name: 'Next Shot' })` advances, and
  `Shot <n> of <m>` says where. At a Scene's end the Exits are buttons named by
  their text.
- **Ending.** `getByRole('status')` reads `The path ends here.`, and
  **Read Again from the Start** has the focus. **Step Back** returns over the
  Exit taken.
- **Unpublish.** Click `getByRole('button', { name: 'Unpublish this Story' })`.
  A fresh `s.reader()` at the link answers 404.
- **Proof.** `smoke.ts` is this recipe end to end; its run folder holds the
  four proofs.

## Gotchas

- `name: 'Publish this Story'` without `exact: true` also matches
  **Unpublish this Story**, and clicks the opposite button once published.
- The reader's `browser.log` shows a console error for the 404 of an
  unpublished link. It is expected.
- A Reading is kept in the Reader's browser. Open a second `s.reader()` to see
  a Reading start over; reloading the same one resumes it.
