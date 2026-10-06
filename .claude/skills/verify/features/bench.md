# The bench

The bench at `/stories/<id>` is where an Author writes a Story. It is one
document of Scenes, each a heading, a run of Shots and its Exits, beside a rail
that draws the Graph, a header with the Story's title and its publishing, and
the Remarks the bench reads back.

## Sub-features

- `bench-scene-name` renames a Scene where it stands.
- `bench-shot-text` writes a Shot's text.
- `bench-shot-add` adds a Shot to a Scene.
- `bench-shot-order` moves a Shot earlier or later, to another Scene, or
  deletes one.
- `bench-shot-split` cuts a Shot in two at the caret, and joins it back.
- `bench-exit` writes an Exit by naming the Scene it leads to.
- `bench-preview` reads the Story on the engine a Reader runs.
- `bench-contact-sheet` lays every Shot out as frames, and moves one by dragging.
- `bench-commands` reaches any act on the bench by typing its name.

## How to get to it (user POV)

- Create a Story on `/stories`, which opens its bench.
- Choose the Story's title on `/stories`.
- Go to `/stories/<id>`.

## Driving it with drive.ts

Preconditions:

- A Story seeded with `s.request`. `smoke.ts` shows how to seed two Scenes, their
  Shots and an Exit.
- `s.page.goto('/stories/<id>')`, then `s.live()`.

- **Rename a Scene.** Fill `getByRole('textbox', { name: 'Name of <scene>' })`
  and `blur()`. The Scene's `heading` follows, and so does its row:
  ``sql`select name from scenes where id = ${id}` ``.
- **Write a Shot.** `getByRole('textbox', { name: 'Shot <n> of <scene>' })` is
  the Shot's text drawn in a box; clicking it mounts the editor in its place, so
  `fill` does not work. Click it, wait for
  `page.locator('[id="<its id>"].ProseMirror')` to be focused, press
  `ControlOrMeta+A` and type. `Shift+Enter` is a line break; `Enter` cuts the
  Shot in two at the caret, and `Backspace` at a Shot's head joins it to the one
  before. Nothing is written until the editor loses focus, so `blur()` it.
  `writeShot` in `tests/e2e/author.ts` is this recipe.
- **Add a Shot.** Click `getByRole('button', { name: 'Add a Shot to <scene>' })`.
  A textbox `Shot <n+1> of <scene>` appears.
- **Order and delete.** `Move Earlier Shot <n> of <scene>`,
  `Move Later Shot <n> of <scene>`, `Move Shot <n> of <scene> to another Scene`,
  `Duplicate Shot <n> of <scene>`, `Delete Shot <n> of <scene>`, and
  `Split <scene> before Shot <n>` are buttons. The Shots renumber without a gap:
  read `position` with ``sql`select text, position from shots where scene_id = ${id} order by position` ``.
- **Contact Sheet.** Click `getByRole('button', { name: 'See the Contact Sheet' })`.
  `tests/e2e/move-shot-signed-in.spec.ts` drives its drag.
- **Write an Exit.** Pick a Scene in
  `getByRole('combobox', { name: 'An Exit from here <scene>' })`. The Exit's row
  then has `getByRole('combobox', { name: 'Where the Exit <n> out of <scene> leads' })`
  and its text,
  `getByRole('textbox', { name: 'What the Exit <n> out of <scene> says' })`.
  Once published, the row also says how often Readers took it: `Not taken yet`.
- **Preview.** Click `getByRole('button', { name: 'Read the Story' })`. The
  middle becomes `getByRole('region', { name: /^Preview/ })`.
- **Commands.** Click `getByRole('button', { name: /^Commands/ })`, or press
  Meta+K, and type in `getByRole('textbox', { name: 'Type a name' })`.
- **Proof.** `proof` before and after the act, then read the row with `sql`.

## Gotchas

- The rail is `aria-hidden`, so `getByRole` cannot reach a Scene on it. Reach
  one with `page.locator('.rail [data-command="Go to <scene>"]')`; a Scene is
  being written when that mark has the class `here`.
- A write that loses its race shows `getByRole('alert')` and the bench reads the
  Story again. Read `browser.log` for the refused request.
- The Remarks count what the Story still lacks; they change as you write, so do
  not assert their text unless the change is about them.
