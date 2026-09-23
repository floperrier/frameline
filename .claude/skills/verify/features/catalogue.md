# The Catalogue

`/catalogue` lists the published Stories their Authors chose to list, for
anyone to find, signed in or not. Listing is a second act after publishing:
a published Story is readable at its link without being in the Catalogue.

## Sub-features

- `catalogue-list` puts a published Story in the Catalogue.
- `catalogue-unlist` takes it out without breaking its link.
- `catalogue-browse` shows each entry with its title and Synopsis, linked to
  its reading page.

## How to get to it (user POV)

- On the bench, once published, choose **List this Story in the Catalogue**.
- Go to `/catalogue`, or follow **Frameline** or
  **Find Stories in the Catalogue** from a reading page.

## Driving it with drive.ts

Preconditions:

- A published Story whose title carries a `randomUUID()`, seeded with
  `s.request` and published from the bench as in `publishing-and-reading.md`.

- **List.** Click
  `getByRole('button', { name: 'List this Story in the Catalogue' })`. It
  becomes **Take this Story Out of the Catalogue**.
  ``sql`select listed from stories where id = ${id}` `` is `true`.
- **Browse.** In `await s.reader()`, `goto('/catalogue')`. The entry is
  `getByRole('listitem').filter({ hasText: title })`, and its
  `getByRole('link', { name: title })` opens `/read/<id>`.
- **Unlist.** Click
  `getByRole('button', { name: 'Take this Story Out of the Catalogue' })`. A
  fresh reader's `/catalogue` has no such entry, and `/read/<id>` still answers
  200.
- **Proof.** `proof` the reader's `/catalogue` before and after, and read
  `listed`.

## Gotchas

- The Catalogue is shared by every Author in the `development` database, and
  by the e2e suite when it runs locally. Find the entry by its unique title,
  never by position or count.
- The Synopsis is written on the bench under **Synopsis and Cover**, with
  `getByRole('textbox', { name: 'Synopsis' })`.
