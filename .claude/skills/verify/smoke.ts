#!/usr/bin/env node
// The whole product in one path: a Story of two Scenes joined by an Exit,
// published from the bench, and read to its ending by somebody with no account.
import { expect, session, sql } from './drive.ts'

const s = await session('smoke')
try {
  const { page, request } = s
  const story = await (await request.post('/api/stories', {
    data: { title: 'A Story', language: 'en' },
  })).json()
  const scenes = []
  for (const [name, texts] of [
    ['The street', ['A door opens.', 'She steps out.']],
    ['The bar', ['Smoke, and no one she knows.']],
  ] as const) {
    const scene = await (await request.post(`/api/stories/${story.id}/scenes`, {
      data: { name },
    })).json()
    for (const text of texts) {
      const shot = await (await request.post(`/api/scenes/${scene.id}/shots`)).json()
      await request.patch(`/api/shots/${shot.id}`, { data: { text, description: '' } })
    }
    scenes.push(scene)
  }
  const exit = await (await request.post(`/api/scenes/${scenes[0].id}/exits`, {
    data: { toSceneId: scenes[1].id },
  })).json()
  await request.patch(`/api/exits/${exit.id}`, { data: { text: 'Follow her out' } })

  const link = `${s.baseURL}/read/${story.id}`
  const early = await s.reader()
  expect((await early.goto(link))!.status(), 'unpublished link answers 404').toBe(404)
  await s.proof('unpublished-link', early)

  await page.goto(`/stories/${story.id}`)
  await s.live()
  await s.proof('bench-before-publish')
  await page.getByRole('button', { name: 'Publish this Story', exact: true }).click()
  await expect(page.getByRole('link', { name: link })).toBeVisible()
  await s.proof('bench-published')
  const [row] = await sql`select published_at from stories where id = ${story.id}`
  expect(row?.published_at, 'stories.published_at is written').toBeTruthy()

  const reader = await s.reader()
  expect((await reader.goto(link))!.status(), 'published link answers 200').toBe(200)
  await s.live(reader)
  await s.proof('reader-title-card', reader)
  await reader.getByRole('button', { name: 'Begin' }).click()
  await expect(reader.getByRole('figure', { name: 'A door opens.' })).toBeVisible()
  await reader.getByRole('button', { name: 'Next Shot' }).click()
  await expect(reader.getByRole('figure', { name: 'She steps out.' })).toBeVisible()
  await reader.getByRole('button', { name: 'Next Shot' }).click()
  await reader.getByRole('button', { name: 'Follow her out' }).click()
  await expect(reader.getByRole('figure', { name: 'Smoke, and no one she knows.' })).toBeVisible()
  await reader.getByRole('button', { name: 'Next Shot' }).click()
  await expect(reader.getByRole('status')).toHaveText('The Reading ends here.')
  await s.proof('reader-at-the-ending', reader)
  // A Reading is counted without being awaited, so the rows are waited for, and
  // for a while only: outside the test runner `toPass` has no timeout of its own.
  await expect(async () => {
    const counts = await sql`
      select kind, subject_id, count from reading_counts where story_id = ${story.id}
      order by kind`
    expect(counts, 'one Reading begun, its Exit taken, and the Reading ended in The bar').toEqual([
      { kind: 'begun', subject_id: story.id, count: 1 },
      { kind: 'ended', subject_id: scenes[1].id, count: 1 },
      { kind: 'taken', subject_id: exit.id, count: 1 },
    ])
  }).toPass({ timeout: 10_000 })

  console.log(`smoke passed; proof in ${s.run}`)
} finally {
  await s.close()
}
