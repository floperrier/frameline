import { eq } from 'drizzle-orm'
import { SAMPLES, type SampleLanguage } from '../../demonstration/samples'
import { exits, scenes, shots, stories } from '../db/schema'
import { useDb } from '../db'
import type { Condition } from '../../shared/utils/scenes'

/**
 * Plants a Sample in an Author's account: the short Story they are given at the
 * moment the account is created, in the Language their Locale asked for. After
 * this it is an ordinary Story of theirs — see
 * `docs/adr/0018-a-leader-exists-once-per-language.md` — so nothing here marks
 * it and nothing puts it back once it is deleted.
 *
 * A Locale no Sample is written in plants nothing, which is the empty `Stories`
 * page every Author saw before Samples existed.
 *
 * It is published as it is planted, because a Sample arrives finished: an
 * unpublished one would be a Story the bench has guidance for, and the guided
 * path is for the Story an Author writes rather than the one they were given.
 *
 * The five statements below are not a transaction — the neon-http driver has
 * none — so a Story that only half arrived is deleted rather than left in the
 * Author's Stories, and planting never refuses the sign-in that asked for it: an
 * Author with no Sample has an account, and an Author with no account has
 * nothing.
 */
export async function plantSample(
  authorId: string,
  language: string,
  bench: Bench = { db: useDb(), image: sampleImage },
) {
  const sample = SAMPLES[language as SampleLanguage]
  if (!sample) return

  const { db, image } = bench
  let planted: string | undefined

  try {
    const [story] = await db
      .insert(stories)
      .values({ authorId, title: sample.title, language: sample.language })
      .returning({ id: stories.id })

    planted = story!.id

    // Written a microsecond apart, because a Story's Scenes come back in the
    // order they were written and Scenes inserted in one statement would
    // otherwise share an instant and come back in the order of their ids.
    const written = await db
      .insert(scenes)
      .values(sample.scenes.map((scene, order) => ({
        storyId: planted!,
        name: scene.name,
        x: scene.at[0],
        y: scene.at[1],
        sets: scene.sets ?? {},
        createdAt: new Date(Date.now() + order),
      })))
      .returning({ id: scenes.id, name: scenes.name })

    const idOf = (name: string) => {
      const scene = written.find(scene => scene.name === name)
      if (!scene) throw new Error(`No Scene called ${name} was planted`)
      return scene.id
    }

    // A Condition names its Scene by an id, and the work names it by its name.
    const identified = (condition: Condition) =>
      'scene' in condition ? { ...condition, scene: idOf(condition.scene) } : condition

    await db.insert(shots).values(await Promise.all(sample.scenes.flatMap(scene =>
      scene.shots.map(async (shot, position) => ({
        sceneId: idOf(scene.name),
        text: shot.text,
        position,
        description: shot.description ?? '',
        conditions: (shot.when ?? []).map(identified),
        // A Sample's images are the WebP files committed beside the work, never
        // developed here: the runtime this deploys to has no ImageMagick on it.
        image: typeof shot.image === 'string' ? await image(shot.image) : null,
      })))))

    // The Place an Exit takes among the ways on leaving its Scene is the order the
    // Reader is offered them in, and so a decision of the work's: it is the
    // order they are written here, counted per Scene.
    const places = new Map<string, number>()

    await db.insert(exits).values(sample.exits.map((exit) => {
      const place = places.get(exit.from) ?? 0
      places.set(exit.from, place + 1)

      return {
        fromSceneId: idOf(exit.from),
        toSceneId: idOf(exit.to),
        text: exit.text,
        position: place,
        conditions: (exit.when ?? []).map(identified),
      }
    }))

    await db
      .update(stories)
      .set({
        openingSceneId: idOf(sample.opening ?? sample.scenes[0]!.name),
        publishedAt: new Date(),
      })
      .where(eq(stories.id, planted))
  }
  catch (failure) {
    console.error('Planting a Sample failed:', failure)
    if (planted) await db.delete(stories).where(eq(stories.id, planted)).catch(() => {})
  }
}

/**
 * What planting needs of the world around it: the database, and the bytes of an
 * image. Both are had from nitro in production and both are handed in by the
 * end-to-end spec, which runs outside nitro and so has neither auto-import.
 */
type Bench = {
  db: ReturnType<typeof useDb>
  image: (name: string) => Promise<Buffer>
}

/**
 * The bytes of one committed image. They ride into the build as a server asset,
 * declared in `nuxt.config.ts`, because the deployed bundle is not the
 * repository and `demonstration/images/` is not a path that survives it.
 */
async function sampleImage(name: string) {
  const bytes = await useStorage('assets:samples').getItemRaw<Uint8Array>(`${name}.webp`)
  if (!bytes) throw new Error(`No image called ${name} was committed`)

  return Buffer.from(bytes)
}
