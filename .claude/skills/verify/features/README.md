# Frameline verification map

This directory is the maintained source for proving what an Author or a Reader
sees. Read the index, then use the matching file as the recipe. The words are
`CONTEXT.md`'s: a Story is made of Scenes, a Scene is a run of Shots, and an
Exit leads from one Scene to another.

| Feature | What it covers |
| --- | --- |
| [`stories.md`](stories.md) | The Author's list of Stories: create, open, delete, the Locale switch |
| [`bench.md`](bench.md) | Writing a Story on the bench: Scenes, Shots, Exits, the Preview |
| [`publishing-and-reading.md`](publishing-and-reading.md) | Publish, the public link, a Reader playing the Story to an ending |
| [`catalogue.md`](catalogue.md) | Listing a published Story where anyone finds it |

## Baseline preconditions

- `verify.sh doctor` reads `ok` on every line.
- Each script opens one `session(label)` and closes it in a `finally`.
- The session's Author starts with no Story. Seeding bypasses sign-in, so no
  Sample is given.

## Driving conventions

- Seed preconditions through `s.request`, the Author's API client, and drive
  the act under test through `s.page` or `s.reader()`.
- Call `s.live(page)` after every `goto` before typing or clicking.
- Address controls with `getByRole(role, { name })`. Pass `exact: true` when
  one name contains another: *Publish this Story* is part of *Unpublish this
  Story*.
- A typed field writes when it loses focus. Call `blur()`, then wait for the
  row with `expect(async () => ...).toPass()`.

## Proof and skip reporting

- A `proof` before the act and one after it, both on the page that shows it.
- A `sql` read of the row the act wrote, after the interface said it was done.
- For anything a Reader sees, the proof comes from `s.reader()`, not from the
  Author's page.
- Name the feature file and the entry point used with the run folder.

## Feature entry contract

Each feature file starts with an H1 and one paragraph, then four H2s in this
order: `Sub-features`, `How to get to it (user POV)`, `Driving it with
drive.ts` (opening with `Preconditions:`), and `Gotchas`.
