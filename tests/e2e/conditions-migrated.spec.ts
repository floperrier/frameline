import { readFile } from 'node:fs/promises'
import { neon } from '@neondatabase/serverless'
import { expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import type { Condition } from '../../shared/utils/scenes'
import { readExits, readShotConditions, test } from './author'

/**
 * What the deploy leaves behind when it rewrites the Conditions already stored.
 *
 * The statements are read off the migration rather than written out again here,
 * so what is asserted is what production runs: a copy of them kept in a spec is a
 * copy that drifts, and the thing under test is the file. The old shape is still
 * readable at the request boundary until #307, which is what lets the rows be
 * written through the API in the shape the migration is about to take away.
 *
 * It runs against the same database the rest of the suite does, and touches
 * nothing else in it: the statements are scoped to rows holding a counting test,
 * which nothing but this spec writes any more.
 */
const sql = neon(process.env.DATABASE_URL!)

const MIGRATION = 'server/db/migrations/0021_conditions_ask_whether_entered.sql'

/** The deploy's own statements, one at a time, the way `drizzle-kit migrate` runs them. */
async function migrate() {
  const written = await readFile(MIGRATION, 'utf8')

  for (const statement of written.split('--> statement-breakpoint')) {
    await sql.query(statement)
  }
}

/**
 * A Story carrying every test the old shape could hold: the two that survive as
 * questions, the two that no longer say anything, and a Flag test beside them to
 * prove the rest of a list is left where it was.
 *
 * Written through the API, because that is where a Condition's shape is kept and
 * the Scene it names is scoped to the Story — so what the migration is handed is a
 * Story an Author really could have written, not rows put in behind it.
 */
async function storyHoldingCounts(request: APIRequestContext) {
  const story = await (await request.post('/api/stories', {
    data: { title: 'A Story' },
  })).json() as { id: string }
  const scene = await (await request.post(`/api/stories/${story.id}/scenes`, {
    data: { name: 'The booth' },
  })).json() as { id: string }
  const onward = await (await request.post(`/api/stories/${story.id}/scenes`, {
    data: { name: 'The house' },
  })).json() as { id: string }

  const played: Condition[][] = [
    // The Flag test stays where it stood, and the count beside it becomes a question.
    [{ flag: 'reel', is: 'threaded' }, { scene: scene.id, visits: 'at least', times: 1 }],
    // One survives, one can never hold and goes — and the Places close up behind it.
    [{ scene: onward.id, visits: 'fewer than', times: 1 },
      { scene: scene.id, visits: 'at least', times: 2 }],
    // Its only test goes, so the Shot is one every Reading sees.
    [{ scene: scene.id, visits: 'at least', times: 5 }],
  ]
  for (const conditions of played) {
    const shot = await (await request.post(`/api/scenes/${scene.id}/shots`)).json() as { id: string }
    expect((await request.put(`/api/shots/${shot.id}/conditions`, { data: { conditions } })).ok())
      .toBeTruthy()
  }

  const offered: Condition[][] = [
    // A test that always held now that a Scene is entered once, and so says nothing.
    [{ scene: scene.id, visits: 'fewer than', times: 3 }, { flag: 'reel', is: 'threaded' }],
    // Already written in the shape that replaced the others: untouched.
    [{ scene: scene.id, entered: true }],
  ]
  for (const conditions of offered) {
    const exit = await (await request.post(`/api/scenes/${scene.id}/exits`, {
      data: { toSceneId: onward.id },
    })).json() as { id: string }
    expect((await request.put(`/api/exits/${exit.id}/conditions`, { data: { conditions } })).ok())
      .toBeTruthy()
  }

  return { story, scene: scene.id, onward: onward.id }
}

/** How many Conditions of this Story are still written in the shape that counted. */
async function stillCounting(storyId: string) {
  const [counted] = await sql`
    select (
      (select count(*) from shots
        join scenes on scenes.id = shots.scene_id
        where scenes.story_id = ${storyId}
          and jsonb_path_exists(shots.conditions, '$[*].visits'))
      + (select count(*) from exits
        join scenes on scenes.id = exits.from_scene_id
        where scenes.story_id = ${storyId}
          and jsonb_path_exists(exits.conditions, '$[*].visits'))
    )::int as held` as { held: number }[]

  return counted!.held
}

test('the deploy rewrites every Condition already stored', async ({ request }) => {
  const { story, scene, onward } = await storyHoldingCounts(request)

  // The Story really is holding the old shape before the deploy touches it, so
  // what is read back after it is a rewrite and not a coincidence.
  expect(await stillCounting(story.id)).toBe(4)

  await migrate()

  // A test for at least one entry is that the Scene has been entered; one for
  // fewer than one is that it has not; and a test compared against a number no
  // Reading can reach is gone from the list rather than rewritten into something
  // else — see `docs/adr/0048-a-scene-is-entered-once.md` and #303.
  await expect(readShotConditions(scene)).resolves.toEqual([
    [{ flag: 'reel', is: 'threaded' }, { scene, entered: true }],
    [{ scene: onward, entered: false }],
    [],
  ])
  await expect(readExits(scene)).resolves.toMatchObject([
    { conditions: [{ flag: 'reel', is: 'threaded' }] },
    { conditions: [{ scene, entered: true }] },
  ])

  // And nothing of this Story is left in the shape the product no longer writes.
  expect(await stillCounting(story.id)).toBe(0)
})

/**
 * A build that fails after the statements have landed is retried, and a rollback
 * puts the previous code back without putting the rows back — so the deploy has to
 * be safe to run again. It is, because it touches only what still counts.
 */
test('leaves what it has already rewritten exactly as it is', async ({ request }) => {
  const { story, scene } = await storyHoldingCounts(request)

  await migrate()
  const once = await readShotConditions(scene)
  await migrate()

  await expect(readShotConditions(scene)).resolves.toEqual(once)
  expect(await stillCounting(story.id)).toBe(0)
})
