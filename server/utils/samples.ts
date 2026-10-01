import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { SAMPLES, type SampleLanguage } from '../../demonstration/samples'
import type { WorkCondition } from '../../demonstration/work'
import { exits, scenes, shots, stories } from '../db/schema'
import { useDb } from '../db'
import { textOf } from '../../shared/utils/formatted'
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
  bench: Bench = { db: useDb(), image: sampleImage, sound: sampleSound },
) {
  const sample = SAMPLES[language as SampleLanguage]
  if (!sample) return

  const { db, image, sound } = bench
  let planted: string | undefined

  // Each Scene's ways on, by their Place there, given their ids before anything
  // is inserted: a Condition may name an Exit, and the Shots carrying one go in
  // before the Exits do, in statements no order of theirs would help — an Exit's
  // own Conditions may name another Exit.
  const minted = new Map<string, string[]>()
  for (const exit of sample.exits) {
    minted.set(exit.from, [...minted.get(exit.from) ?? [], randomUUID()])
  }

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
      .values(await Promise.all(sample.scenes.map(async (scene, order) => ({
        storyId: planted!,
        name: scene.name,
        sets: scene.sets ?? {},
        createdAt: new Date(Date.now() + order),
        sound: scene.sound ? await sound(scene.sound) : null,
        transcript: scene.transcript ?? '',
        // A field the Sample does not name is `undefined`, which the driver
        // writes as the column's own default, so a Sample carrying no Cut is
        // planted exactly as it was before the Cut existed.
        layout: scene.layout ?? 'inset',
        movementBy: scene.movementBy ?? 0,
        movementDirection: scene.movementDirection ?? 'closer',
        movementOver: scene.movementOver ?? 0,
        cutAfter: scene.cutAfter,
        cutOver: scene.cutOver,
        cutThrough: scene.cutThrough,
        exitsAfter: scene.exitsAfter,
        textAfter: scene.textAfter,
        textBy: scene.textBy,
        textPace: scene.textPace,
        textOver: scene.textOver,
        textStays: scene.textStays,
      }))))
      .returning({ id: scenes.id, name: scenes.name })

    const idOf = (name: string) => {
      const scene = written.find(scene => scene.name === name)
      if (!scene) throw new Error(`No Scene called ${name} was planted`)
      return scene.id
    }

    const exitIdOf = ({ from, place }: { from: string, place: number }) => {
      const id = minted.get(from)?.[place - 1]
      if (!id) throw new Error(`No Exit ${place} out of ${from} was planted`)
      return id
    }

    // A Condition names its Scene and its Exit by an id, and the work names a
    // Scene by its name and an Exit by the Scene it leaves and its Place there.
    const identified = (condition: WorkCondition): Condition =>
      'scene' in condition ? { ...condition, scene: idOf(condition.scene) }
      : 'exit' in condition ? { ...condition, exit: exitIdOf(condition.exit) }
      : condition

    await db.insert(shots).values(await Promise.all(sample.scenes.flatMap(scene =>
      scene.shots.map(async (shot, position) => ({
        sceneId: idOf(scene.name),
        text: shot.formatted ? textOf(shot.formatted) : shot.text,
        formatted: shot.formatted ?? null,
        position,
        description: shot.description ?? '',
        conditions: (shot.when ?? []).map(identified),
        // A Sample's images are the WebP files committed beside the work, never
        // developed here: the runtime this deploys to has no ImageMagick on it.
        image: typeof shot.image === 'string' ? await image(shot.image) : null,
        sound: shot.sound ? await sound(shot.sound) : null,
        transcript: shot.transcript ?? '',
        layout: shot.layout ?? null,
        cropX: shot.cropX ?? 50,
        cropY: shot.cropY ?? 50,
        movementBy: shot.movementBy ?? null,
        movementDirection: shot.movementDirection ?? null,
        movementOver: shot.movementOver ?? null,
        cutAfter: shot.cutAfter,
        cutOver: shot.cutOver,
        cutThrough: shot.cutThrough,
        imageArrives: shot.imageArrives ?? null,
        imageLasts: shot.imageLasts ?? null,
        textArrives: shot.textArrives ?? null,
        textLasts: shot.textLasts ?? null,
        textAfter: shot.textAfter,
        textBy: shot.textBy,
        textPace: shot.textPace,
        textOver: shot.textOver,
        textStays: shot.textStays,
      })))))

    // The Place an Exit takes among the ways on leaving its Scene is the order the
    // Reader is offered them in, and so a decision of the work's: it is the
    // order they are written here, counted per Scene.
    const places = new Map<string, number>()

    await db.insert(exits).values(sample.exits.map((exit) => {
      const place = places.get(exit.from) ?? 0
      places.set(exit.from, place + 1)

      return {
        id: minted.get(exit.from)![place],
        fromSceneId: idOf(exit.from),
        toSceneId: idOf(exit.to),
        text: exit.text,
        position: place,
        conditions: (exit.when ?? []).map(identified),
        cutOver: exit.cutOver,
        cutThrough: exit.cutThrough,
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
 * image or a Sound. All three are had from nitro in production and all three are
 * handed in by the end-to-end spec, which runs outside nitro and so has none of
 * the auto-imports.
 */
type Bench = {
  db: ReturnType<typeof useDb>
  image: (name: string) => Promise<Buffer>
  sound: (file: string) => Promise<Buffer>
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

/**
 * The bytes of one library Sound. They ride into the build as a server asset,
 * declared in `nuxt.config.ts`, because the deployed bundle is not the repository
 * and `public/sounds/` is a folder the CDN serves rather than a path the server
 * can read.
 */
async function sampleSound(file: string) {
  const bytes = await useStorage('assets:sounds').getItemRaw<Uint8Array>(file)
  if (!bytes) throw new Error(`No Sound called ${file} is in the library`)

  return Buffer.from(bytes)
}
