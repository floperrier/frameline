# The bench

The bench at `/stories/<id>` is where an Author writes a Story. It is one
document of Scenes, each a heading, a run of Shots and its Exits, beside a rail
that draws the Graph, a header with the Story's title and its publishing, and
the Remarks the bench reads back.

## Sub-features

- `bench-scene-name` renames a Scene where it stands.
- `bench-shot-text` writes a Shot's text.
- `bench-shot-add` adds a Shot to a Scene.
- `bench-shot-order` moves a Shot earlier or later, deletes one.
- `bench-exit` writes an Exit by naming the Scene it leads to.
- `bench-preview` reads the Story on the engine a Reader runs.
- `bench-commands` reaches any act on the bench by typing its name.

## How to get to it (user POV)

- Create a Story on `/stories`, which opens its bench.
- Choose **Open <title>** on `/stories`.
- Go to `/stories/<id>`.

## Driving it with drive.ts

Preconditions:

- A Story seeded with `s.request`. `smoke.ts` shows how to seed two Scenes, their
  Shots and an Exit.
- `s.page.goto('/stories/<id>')`, then `s.live()`.

- **Rename a Scene.** Fill `getByRole('textbox', { name: 'Name of <scene>' })`
  and `blur()`. The Scene's `heading` follows, and so does its row:
  ``sql`select name from scenes where id = ${id}` ``.
- **Write a Shot.** Fill `getByRole('textbox', { name: 'Shot <n> of <scene>' })`
  and `blur()`.
- **Add a Shot.** Click `getByRole('button', { name: 'Add a Shot to <scene>' })`.
  A textbox `Shot <n+1> of <scene>` appears.
- **Order and delete.** `Move Earlier Shot <n> of <scene>`,
  `Move Later Shot <n> of <scene>`, `Delete Shot <n> of <scene>`, and
  `Split <scene> before Shot <n>` are buttons. The Shots renumber without a gap.
- **Write an Exit.** Pick a Scene in
  `getByRole('combobox', { name: 'An Exit from here <scene>' })`. Its text is
  `getByRole('textbox', { name: 'What the Exit <n> out of <scene> says' })`.
- **Preview.** Click `getByRole('button', { name: 'Read the Story' })`. The
  middle becomes `getByRole('region', { name: /^Preview/ })`.
- **Commands.** Click `getByRole('button', { name: /^Commands/ })`, or press
  Meta+K, and type in `getByRole('textbox', { name: 'Type a name' })`.
- **Proof.** `proof` before and after the act, then read the row with `sql`.

## Gotchas

- The rail is `aria-hidden`, so `getByRole` cannot reach a Scene on it. Reach
  one with `page.locator('.rail [data-command="Go to <scene>"]')`; a Scene is
  being written when that mark has the class `here`.
- An empty Scene's controls are named by place, `Name of Scene <n>` and
  `Shot <m> of Scene <n>`, until it has a name.
- A write that loses its race shows `getByRole('alert')` and the bench reads the
  Story again. Read `browser.log` for the refused request.
- The Remarks count what the Story still lacks; they change as you write, so do
  not assert their text unless the change is about them.
