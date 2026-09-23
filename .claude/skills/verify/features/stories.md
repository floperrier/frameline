# Stories

The Author's own list of Stories at `/stories`. From it an Author creates a
Story, which opens its bench, opens an existing one, deletes one after being
asked, and switches the interface's Locale.

## Sub-features

- `stories-create` names a new Story and lands on its bench.
- `stories-open` opens a Story from its row.
- `stories-delete` asks before a Story goes, and can be left.
- `stories-rename` renames a Story from the bench's own heading.
- `stories-locale` switches the interface to French and back.

## How to get to it (user POV)

- Go to `/stories`.
- Choose **All Stories** on a bench.

## Driving it with drive.ts

Preconditions:

- `verify.sh doctor` reads `ok`.
- The session's Author has no Story, so the list reads `No Stories yet.`

- **Create.** Fill `getByRole('textbox', { name: 'Title of a new Story' })`,
  then click `getByRole('button', { name: 'Create Story' })`. The URL matches
  `/stories/<uuid>` and `getByRole('textbox', { name: 'Title of this Story' })`
  holds the title.
- **Open.** Back on `/stories`, click `getByRole('link', { name: 'Open <title>' })`.
  The bench's heading is the title.
- **Delete.** Click `getByRole('button', { name: 'Delete <title>' })`. A
  `getByRole('dialog')` asks with `“<title>” goes, and everything written in it.`
  **Leave It** closes it and the row stays. **Delete Story** removes the row and,
  for the last one, shows `No Stories yet.`
- **Rename.** On the bench, fill **Title of this Story** and `blur()`. The mark
  `getByText(/^Kept at /)` appears and the heading follows.
- **Locale.** On `/stories`, click `getByRole('link', { name: 'Français' })`. The
  URL gains `/fr` and the controls read in French.
- **Proof.** `proof` the list before and after, and read the rows:
  ``await sql`select id, title from stories where author_id = ${s.author.id}` ``.

## Gotchas

- The Locale link is on `/stories` only. The bench states the Story's Language
  (`Written in English`) and offers no switch: a Story's Language is not the
  interface's Locale.
- A deleted Story's id answers 404 afterwards; check that rather than the
  missing row alone.
